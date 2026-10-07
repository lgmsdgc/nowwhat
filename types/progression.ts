import type { z } from "zod";
import type {
  achievementSchema,
  achievementUnlockSchema,
  progressionResponseSchema,
} from "@/lib/validation/progression";

export type Achievement = z.infer<typeof achievementSchema>;
export type AchievementUnlock = z.infer<typeof achievementUnlockSchema>;
export type Progression = z.infer<typeof progressionResponseSchema>;
export interface AchievementProgress {
  achievement: Achievement;
  count: number;
  target: number;
  unlock: AchievementUnlock | null;
}
