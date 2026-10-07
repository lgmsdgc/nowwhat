import { z } from "zod";
import { localStateSchema } from "@/lib/validation/models";

export const migrationActionSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("prepare") }),
  z.strictObject({
    action: z.literal("claim"),
    token: z.string().regex(/^[a-f0-9]{64}$/),
  }),
]);
export const localImportSchema = z
  .strictObject({ state: localStateSchema })
  .superRefine(({ state }, ctx) => {
    if (state.sessions.length > 200 || state.feedback.length > 2000)
      ctx.addIssue({ code: "custom", message: "Import size exceeded" });
  });
export const emailSchema = z.email().trim().max(254);
export const otpSchema = z.string().regex(/^\d{6,10}$/);
export const importedHistorySchema = z.object({
  id: z.string().uuid(),
  mission_id: z.string(),
  title: z.string(),
  completed_at: z.string(),
  actual_cost: z.number().nullable(),
  rating: z.number().nullable(),
  comment: z.string(),
  source: z.literal("local"),
});
export const accountResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    anonymous: z.boolean(),
    email: z.string().nullable(),
  }),
  imports: z.array(importedHistorySchema),
});
