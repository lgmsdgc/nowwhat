import { z } from "zod";
import { missionSchema, relationshipSchema } from "@/lib/validation/models";

export const achievementFilterSchema = z.strictObject({
  category: missionSchema.shape.category.optional(),
  relationship: relationshipSchema.optional(),
  outdoor: z.boolean().optional(),
  zeroCost: z.boolean().optional(),
});
export const achievementSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{1,80}$/),
  name: z.string().min(1).max(80),
  emoji: z.string().min(1).max(16),
  description: z.string().min(1).max(200),
  conditionType: z.enum(["completed_count", "distinct_categories"]),
  conditionValue: z.strictObject({
    target: z.number().int().min(1).max(10000),
    filter: achievementFilterSchema,
  }),
  active: z.boolean(),
});
export const achievementUnlockSchema = z.strictObject({
  achievementId: z.string(),
  unlockedAt: z.iso.datetime({ offset: true }),
  earnedSessionId: z.uuid().nullable(),
});
export const progressionResponseSchema = z.strictObject({
  achievements: z.array(achievementSchema),
  unlocks: z.array(achievementUnlockSchema),
});
