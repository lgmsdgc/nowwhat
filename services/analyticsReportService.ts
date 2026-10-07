import { localDateAt } from "@/services/analyticsService";
import type { AnalyticsRecord } from "@/types/analytics";

const ratio = (numerator: number, denominator: number) =>
  denominator ? numerator / denominator : null;
const sessionKey = (record: AnalyticsRecord) =>
  `${record.ownerId}:${record.event.sessionId}`;
const addDay = (day: string) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + 86400000)
    .toISOString()
    .slice(0, 10);
/** Distinct session funnels; duplicate delivery and multiple shares cannot multiply conversion. */
export function analyticsReport(
  records: readonly AnalyticsRecord[],
  now = new Date(),
) {
  const seen = new Set<string>();
  const events = records.filter((record) => {
    const key = `${record.ownerId}:${record.event.dedupeKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const keys = (name: string) =>
    new Set(
      events
        .filter((r) => r.event.name === name && r.event.sessionId)
        .map(sessionKey),
    );
  const shown = keys("mission_shown");
  const accepted = new Set(
    [...keys("mission_accepted")].filter((k) => shown.has(k)),
  );
  const started = new Set(
    [...keys("mission_started")].filter((k) => accepted.has(k)),
  );
  const completed = new Set(
    [...keys("mission_completed")].filter((k) => accepted.has(k)),
  );
  const rejected = new Set(
    [...keys("mission_rejected")].filter((k) => shown.has(k)),
  );
  const shares = (name: string, channel?: "native" | "clipboard") =>
    new Set(
      events
        .filter(
          (r) =>
            r.event.name === name &&
            (!channel || r.event.properties.channel === channel) &&
            completed.has(sessionKey(r)),
        )
        .map(sessionKey),
    );
  const visits = events.filter((r) => r.event.name === "visit_started");
  const visitors = new Map<string, typeof visits>();
  for (const visit of visits)
    visitors.set(visit.ownerId, [
      ...(visitors.get(visit.ownerId) ?? []),
      visit,
    ]);
  let eligible = 0,
    returned = 0;
  for (const visitor of visitors.values()) {
    const sorted = visitor.toSorted(
      (a, b) =>
        a.event.localDate.localeCompare(b.event.localDate) ||
        a.event.occurredAt.localeCompare(b.event.occurredAt),
    );
    const first = sorted[0].event;
    const nextDay = addDay(first.localDate);
    // Exclude cohorts whose entire D1 observation day has not finished yet.
    if (nextDay >= localDateAt(now.toISOString(), first.timeZone)) continue;
    eligible++;
    if (visitor.some((r) => r.event.localDate === nextDay)) returned++;
  }
  const perUser = new Map<
    string,
    {
      recommendations: number;
      rerolls: number;
      requests: number;
      runs: Set<string>;
    }
  >();
  for (const record of events) {
    const stats = perUser.get(record.ownerId) ?? {
      recommendations: 0,
      rerolls: 0,
      requests: 0,
      runs: new Set<string>(),
    };
    if (record.event.name === "mission_requested") stats.requests++;
    if (record.event.name === "mission_shown") {
      stats.recommendations++;
      if ((record.event.properties.rerollIndex ?? 0) > 0) stats.rerolls++;
      if (record.event.recommendationRunId)
        stats.runs.add(record.event.recommendationRunId);
    }
    perUser.set(record.ownerId, stats);
  }
  return {
    events: events.length,
    visits: {
      visitors: visitors.size,
      visits: new Set(visits.map((r) => `${r.ownerId}:${r.event.visitId}`))
        .size,
      landingViews: events.filter((r) => r.event.name === "landing_view")
        .length,
      onboardingStarted: events.filter(
        (r) => r.event.name === "onboarding_started",
      ).length,
      onboardingCompleted: events.filter(
        (r) => r.event.name === "onboarding_completed",
      ).length,
    },
    funnel: {
      shown: shown.size,
      accepted: accepted.size,
      started: started.size,
      completed: completed.size,
      rejected: rejected.size,
      recommendationToAcceptedRate: ratio(accepted.size, shown.size),
      acceptedToCompletedRate: ratio(completed.size, accepted.size),
    },
    rerolls: {
      total: [...perUser.values()].reduce((sum, s) => sum + s.rerolls, 0),
      perUser: [...perUser]
        .filter(([, s]) => s.requests || s.recommendations)
        .map(([ownerId, s]) => ({
          ownerId,
          recommendations: s.recommendations,
          requests: s.requests,
          rerolls: s.rerolls,
          runs: s.runs.size,
          meanRerollsPerRun: ratio(s.rerolls, s.runs.size),
        })),
    },
    retention: {
      eligibleUsers: eligible,
      returnedUsers: returned,
      pendingUsers: visitors.size - eligible,
      d1Rate: ratio(returned, eligible),
    },
    sharing: {
      attemptedCompletedMissions: shares("mission_share_requested").size,
      successfulActions: shares("mission_shared").size,
      nativeShares: shares("mission_shared", "native").size,
      copiedLinks: shares("mission_shared", "clipboard").size,
      successfulActionRate: ratio(
        shares("mission_shared").size,
        completed.size,
      ),
      nativeShareRate: ratio(
        shares("mission_shared", "native").size,
        completed.size,
      ),
      clipboardCopyRate: ratio(
        shares("mission_shared", "clipboard").size,
        completed.size,
      ),
    },
  };
}
