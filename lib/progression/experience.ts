import type { LocalState } from "@/types/game";

export const EXP_PER_LEVEL = 300;
/** Reviewed template reward; copied into the session, never recalculated on completion. */
export function experienceForDifficulty(difficulty: number): number {
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5)
    throw new RangeError("Difficulty must be an integer from 1 to 5");
  return 100 + (difficulty - 1) * 20;
}
export const levelFor = (exp: number) => Math.floor(exp / EXP_PER_LEVEL) + 1;
export const totalExp = (state: LocalState) =>
  state.sessions.reduce(
    (sum, s) =>
      sum + (s.status === "completed" ? (s.result?.awardedExp ?? 0) : 0),
    0,
  );
