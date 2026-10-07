import type { Feedback, Mission, MissionSession } from "@/types/game";
import { recommendationPolicy as policy } from "@/lib/recommendation/policy";

export type Category = Mission["category"];

/** One preference per completed session; duplicate feedback cannot multiply a vote. */
export function categoryPreferences(
  history: readonly MissionSession[],
  feedback: readonly Feedback[],
): ReadonlyMap<Category, number> {
  const latestFeedback = new Map<string, Feedback>();
  for (const entry of feedback) {
    if (entry.action !== "liked" && entry.action !== "disliked") continue;
    const previous = latestFeedback.get(entry.sessionId);
    if (!previous || entry.createdAt >= previous.createdAt)
      latestFeedback.set(entry.sessionId, entry);
  }
  const completed = history
    .toReversed()
    .filter((session) => session.status === "completed" && session.result)
    .toSorted((a, b) =>
      (b.completedAt ?? b.shownAt).localeCompare(a.completedAt ?? a.shownAt),
    )
    .slice(0, policy.preferenceHistoryLimit);
  const seen = new Set<string>();
  const scores = new Map<Category, number>();
  for (const session of completed) {
    if (seen.has(session.id)) continue;
    seen.add(session.id);
    const entry = latestFeedback.get(session.id);
    const validFeedback =
      entry?.anonymousId === session.anonymousId &&
      entry.missionId === session.mission.id;
    const result = session.result!;
    const vote = validFeedback
      ? entry.action === "liked"
        ? 1
        : -1
      : result.wouldDoAgain !== null
        ? result.wouldDoAgain
          ? 1
          : -1
        : result.rating !== null && result.rating >= 4
          ? 1
          : result.rating !== null && result.rating <= 2
            ? -1
            : 0;
    const category = session.mission.category;
    scores.set(category, (scores.get(category) ?? 0) + vote);
  }
  return new Map(
    [...scores].map(([category, score]) => [
      category,
      Math.max(
        policy.categoryMin,
        Math.min(policy.categoryMax, 1 + score * policy.categoryStep),
      ),
    ]),
  );
}
