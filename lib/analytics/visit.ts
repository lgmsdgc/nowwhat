"use client";
import { z } from "zod";
import type { AnalyticsContext } from "@/types/analytics";
import { analyticsTimeZoneSchema } from "@/lib/validation/analytics";

export const VISIT_KEY = "nowwhat:visit:v1";
export const VISIT_IDLE_MS = 30 * 60 * 1000;
const visitSchema = z.strictObject({
  id: z.uuid(),
  lastSeenAt: z.number().int().nonnegative(),
});
let memory: z.infer<typeof visitSchema> | undefined;
/** Per-tab visit survives reloads; inactivity starts a new visit. Storage is optional. */
export function visitContext(now = Date.now()): AnalyticsContext {
  let saved = memory;
  try {
    const raw = window.sessionStorage.getItem(VISIT_KEY);
    if (raw) saved = visitSchema.safeParse(JSON.parse(raw)).data;
  } catch {
    /* use in-memory visit */
  }
  if (
    !saved ||
    now < saved.lastSeenAt ||
    now - saved.lastSeenAt >= VISIT_IDLE_MS
  )
    saved = { id: crypto.randomUUID(), lastSeenAt: now };
  memory = { id: saved.id, lastSeenAt: now };
  try {
    window.sessionStorage.setItem(VISIT_KEY, JSON.stringify(memory));
  } catch {
    /* telemetry must not block gameplay */
  }
  let timeZone = "UTC";
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    /* UTC fallback */
  }
  return {
    visitId: memory.id,
    timeZone: analyticsTimeZoneSchema.safeParse(timeZone).data ?? "UTC",
  };
}
