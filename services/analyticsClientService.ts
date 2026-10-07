"use client";
import { getDataConfig } from "@/lib/config/dataSource";
import {
  LocalRepository,
  STORAGE_KEY,
} from "@/lib/repositories/localRepository";
import { AnalyticsOutbox } from "@/lib/analytics/outbox";
import { HttpAnalyticsTransport } from "@/lib/analytics/transport";
import { visitContext } from "@/lib/analytics/visit";
import { clientDedupeKey, makeClientEvent } from "@/services/analyticsService";
import type { ClientEventInput } from "@/types/analytics";

const recorded = new Set<string>();
const flushing = new Set<string>();
async function withLock<T>(key: string, operation: () => Promise<T> | T) {
  if (!navigator.locks) throw new Error("Analytics storage lock unavailable");
  return navigator.locks.request(key, operation);
}
/** Best effort: a failed delivery stays queued; gameplay never awaits the network. */
export async function flushAnalytics(anonymousId: string): Promise<void> {
  if (flushing.has(anonymousId)) return;
  flushing.add(anonymousId);
  try {
    if (getDataConfig().mode !== "supabase") return;
    const outbox = new AnalyticsOutbox(window.localStorage, anonymousId);
    const transport = new HttpAnalyticsTransport();
    // Bound a flush so repeated offline activity cannot monopolize the queue.
    for (let attempt = 0; attempt < 15; attempt++) {
      const batch = await withLock(outbox.key, () => outbox.batch());
      if (!batch.length) return;
      await transport.send(anonymousId, batch);
      await withLock(outbox.key, () => outbox.acknowledge(batch));
    }
  } catch {
    /* Retry on the next event, focus, or online transition. */
  } finally {
    flushing.delete(anonymousId);
  }
}
export async function recordClientEvent(
  anonymousId: string,
  input: ClientEventInput,
): Promise<void> {
  try {
    const context = visitContext();
    const now = new Date();
    const id = () => crypto.randomUUID();
    const candidates =
      input.name === "visit_started"
        ? [makeClientEvent(input, context, now, id)]
        : [
            makeClientEvent(
              { name: "visit_started", sessionId: null, properties: {} },
              context,
              now,
              id,
            ),
            makeClientEvent(input, context, now, id),
          ];
    const events = candidates.filter(
      (e) => !recorded.has(`${anonymousId}:${clientDedupeKey(e)}`),
    );
    if (events.length) {
      if (getDataConfig().mode === "local")
        await withLock(STORAGE_KEY, () =>
          new LocalRepository(window.localStorage).appendAnalytics(
            anonymousId,
            events,
          ),
        );
      else {
        const outbox = new AnalyticsOutbox(window.localStorage, anonymousId);
        await withLock(outbox.key, () => outbox.append(events));
      }
      for (const event of events)
        recorded.add(`${anonymousId}:${clientDedupeKey(event)}`);
      while (recorded.size > 1000)
        recorded.delete(recorded.values().next().value!);
    }
    void flushAnalytics(anonymousId);
  } catch {
    /* Storage and analytics errors do not interrupt a mission. */
  }
}
