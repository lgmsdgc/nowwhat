import { z } from "zod";
import { clientEventSchema } from "@/lib/validation/analytics";
import { clientDedupeKey } from "@/services/analyticsService";
import type { ClientEvent } from "@/types/analytics";
import type { StoragePort } from "@/lib/repositories/localRepository";

export const OUTBOX_LIMIT = 300;
const queueSchema = z.strictObject({
  version: z.literal(1),
  anonymousId: z.uuid(),
  events: z.array(clientEventSchema).max(OUTBOX_LIMIT),
  dropped: z.number().int().nonnegative(),
});
export class AnalyticsOutbox {
  readonly key: string;
  constructor(
    private storage: StoragePort,
    private anonymousId: string,
  ) {
    this.key = `nowwhat:analytics:outbox:v1:${anonymousId}`;
  }
  private read() {
    const raw = this.storage.getItem(this.key);
    const queue =
      raw === null
        ? {
            version: 1 as const,
            anonymousId: this.anonymousId,
            events: [],
            dropped: 0,
          }
        : queueSchema.parse(JSON.parse(raw));
    if (queue.anonymousId !== this.anonymousId)
      throw new Error("Outbox ownership mismatch");
    return queue;
  }
  append(events: readonly ClientEvent[]) {
    const queue = this.read();
    const keys = new Set(queue.events.map(clientDedupeKey));
    for (const event of events)
      if (!keys.has(clientDedupeKey(event))) {
        queue.events.push(clientEventSchema.parse(event));
        keys.add(clientDedupeKey(event));
      }
    if (queue.events.length > OUTBOX_LIMIT) {
      queue.dropped += queue.events.length - OUTBOX_LIMIT;
      queue.events = queue.events.slice(-OUTBOX_LIMIT);
    }
    this.storage.setItem(this.key, JSON.stringify(queueSchema.parse(queue)));
  }
  batch(now = Date.now()): ClientEvent[] {
    const queue = this.read();
    const valid = queue.events.filter((e) => {
      const t = Date.parse(e.occurredAt);
      return t >= now - 7 * 86400000 && t <= now + 5 * 60000;
    });
    if (valid.length !== queue.events.length) {
      queue.dropped += queue.events.length - valid.length;
      queue.events = valid;
      this.storage.setItem(this.key, JSON.stringify(queue));
    }
    return valid.slice(0, 20);
  }
  acknowledge(sent: readonly ClientEvent[]) {
    const ids = new Set(sent.map((e) => e.id));
    const queue = this.read();
    queue.events = queue.events.filter((e) => !ids.has(e.id));
    this.storage.setItem(this.key, JSON.stringify(queue));
  }
}
