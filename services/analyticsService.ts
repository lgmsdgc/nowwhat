import {
  analyticsEventSchema,
  clientEventSchema,
} from "@/lib/validation/analytics";
import type {
  AnalyticsContext,
  AnalyticsEvent,
  ClientEvent,
  ClientEventInput,
} from "@/types/analytics";
import type { LocalState } from "@/types/game";

export const LOCAL_EVENT_LIMIT = 2000;
export function localDateAt(timestamp: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function clientDedupeKey(event: ClientEvent): string {
  return [
    "visit_started",
    "landing_view",
    "onboarding_started",
    "onboarding_completed",
  ].includes(event.name)
    ? `visit:${event.visitId}:${event.name}`
    : `event:${event.id}:${event.name}`;
}
export function makeClientEvent(
  input: ClientEventInput,
  context: AnalyticsContext,
  now: Date,
  id: () => string,
): ClientEvent {
  return clientEventSchema.parse({
    ...input,
    ...context,
    id: id(),
    occurredAt: now.toISOString(),
  });
}
export function localClientEvent(
  state: LocalState,
  event: ClientEvent,
): AnalyticsEvent {
  const session = event.sessionId
    ? state.sessions.find((s) => s.id === event.sessionId)
    : undefined;
  if (event.sessionId && !session)
    throw new Error("Analytics session not found");
  if (
    (event.name === "mission_shared" ||
      event.name === "mission_share_requested") &&
    session?.status !== "completed"
  )
    throw new Error("Share requires completed session");
  return analyticsEventSchema.parse({
    ...event,
    anonymousId: state.anonymousId,
    source: "client",
    dedupeKey: clientDedupeKey(event),
    localDate: localDateAt(event.occurredAt, event.timeZone),
    recommendationRunId: session?.recommendationRunId ?? null,
    missionId: session?.mission.id ?? null,
  });
}
export function appendEvents(
  existing: readonly AnalyticsEvent[],
  incoming: readonly AnalyticsEvent[],
): AnalyticsEvent[] {
  const keys = new Set(existing.map((e) => e.dedupeKey));
  const ids = new Set(existing.map((e) => e.id));
  const next = [...existing];
  for (const event of incoming) {
    if (keys.has(event.dedupeKey) || ids.has(event.id)) continue;
    next.push(event);
    keys.add(event.dedupeKey);
    ids.add(event.id);
  }
  return next.slice(-LOCAL_EVENT_LIMIT);
}
/** Lifecycle facts come from successful transitions, never from button impressions. */
export function gameAnalytics(
  before: LocalState,
  after: LocalState,
  context: AnalyticsContext,
  id: () => string,
): AnalyticsEvent[] {
  const prior = new Set(before.feedback.map((f) => f.id));
  const events: AnalyticsEvent[] = [];
  const names = {
    shown: "mission_shown",
    rejected: "mission_rejected",
    accepted: "mission_accepted",
    completed: "mission_completed",
    abandoned: "mission_abandoned",
  } as const;
  for (const feedback of after.feedback) {
    if (prior.has(feedback.id) || !(feedback.action in names)) continue;
    const session = after.sessions.find((s) => s.id === feedback.sessionId)!;
    const name = names[feedback.action as keyof typeof names];
    const fact = (eventName: AnalyticsEvent["name"]) =>
      analyticsEventSchema.parse({
        id: id(),
        name: eventName,
        ...context,
        anonymousId: after.anonymousId,
        occurredAt: feedback.createdAt,
        localDate: localDateAt(feedback.createdAt, context.timeZone),
        sessionId: session.id,
        recommendationRunId: session.recommendationRunId,
        missionId: session.mission.id,
        source: "game",
        dedupeKey: `session:${session.id}:${eventName}`,
        properties:
          name === "mission_rejected"
            ? { rerollIndex: session.rerollIndex, reason: feedback.reason }
            : { rerollIndex: session.rerollIndex },
      });
    events.push(fact(name));
    if (name === "mission_accepted") events.push(fact("mission_started"));
  }
  return events;
}
