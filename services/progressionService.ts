import type { LocalState, MissionSession } from "@/types/game";
import type {
  Achievement,
  AchievementProgress,
  Progression,
} from "@/types/progression";

export function completedSessions(state: LocalState): MissionSession[] {
  return state.sessions
    .filter((s) => s.status === "completed" && s.result && s.completedAt)
    .toSorted(
      (a, b) =>
        a.completedAt!.localeCompare(b.completedAt!) ||
        a.id.localeCompare(b.id),
    );
}
export function matchesAchievement(
  session: MissionSession,
  achievement: Achievement,
): boolean {
  const filter = achievement.conditionValue.filter;
  return (
    (filter.category === undefined ||
      session.mission.category === filter.category) &&
    (filter.relationship === undefined ||
      session.answers.relationship === filter.relationship) &&
    (filter.outdoor === undefined ||
      session.mission.outdoor === filter.outdoor) &&
    (filter.zeroCost === undefined ||
      !filter.zeroCost ||
      session.result?.actualCost === 0)
  );
}
/** Completion history is the persisted source of offline unlocks, including old v1 documents. */
export function evaluateAchievements(
  state: LocalState,
  catalog: readonly Achievement[],
): AchievementProgress[] {
  const sessions = completedSessions(state);
  return catalog
    .filter((a) => a.active)
    .map((achievement) => {
      let count = 0;
      const categories = new Set<string>();
      let unlock: AchievementProgress["unlock"] = null;
      for (const session of sessions) {
        if (!matchesAchievement(session, achievement)) continue;
        categories.add(session.mission.category);
        count =
          achievement.conditionType === "distinct_categories"
            ? categories.size
            : count + 1;
        if (!unlock && count >= achievement.conditionValue.target)
          unlock = {
            achievementId: achievement.id,
            unlockedAt: session.completedAt!,
            earnedSessionId: session.id,
          };
      }
      return {
        achievement,
        count,
        target: achievement.conditionValue.target,
        unlock,
      };
    });
}
export function localProgression(
  state: LocalState,
  catalog: readonly Achievement[],
): Progression {
  return {
    achievements: [...catalog],
    unlocks: evaluateAchievements(state, catalog).flatMap((p) =>
      p.unlock ? [p.unlock] : [],
    ),
  };
}
/** In DB mode only persisted server awards unlock a title; calculated counts are display progress. */
export function achievementProgress(
  state: LocalState,
  progression: Progression,
): AchievementProgress[] {
  const unlocks = new Map(progression.unlocks.map((u) => [u.achievementId, u]));
  return evaluateAchievements(state, progression.achievements).map((p) => ({
    ...p,
    unlock: unlocks.get(p.achievement.id) ?? null,
  }));
}
