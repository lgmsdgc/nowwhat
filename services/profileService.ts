import {
  EXP_PER_LEVEL,
  levelFor,
  totalExp,
} from "@/lib/progression/experience";
import { completedSessions } from "@/services/progressionService";
import type { LocalState } from "@/types/game";

export function profileSummary(state: LocalState) {
  const completed = completedSessions(state).toReversed();
  const exp = totalExp(state);
  const preferences = new Map<string, boolean>();
  for (const session of completed) {
    const latest = state.feedback
      .filter(
        (f) =>
          f.sessionId === session.id &&
          f.missionId === session.mission.id &&
          f.anonymousId === session.anonymousId &&
          (f.action === "liked" || f.action === "disliked"),
      )
      .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
      .at(0);
    const vote = latest
      ? latest.action === "liked"
      : session.result!.wouldDoAgain;
    // Lists reflect explicit thumbs only; an omitted choice stays neutral.
    if (vote !== null) preferences.set(session.id, vote);
  }
  return {
    completed,
    completedCount: completed.length,
    exp,
    level: levelFor(exp),
    levelExp: exp % EXP_PER_LEVEL,
    nextLevelExp: EXP_PER_LEVEL - (exp % EXP_PER_LEVEL),
    liked: completed.filter((s) => preferences.get(s.id) === true),
    disliked: completed.filter((s) => preferences.get(s.id) === false),
  };
}
