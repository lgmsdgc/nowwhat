import { z } from "zod";
import { analyticsContextSchema } from "@/lib/validation/analytics";
import {
  completionDraftSchema,
  completionInputSchema,
  localStateSchema,
  onboardingSchema,
  rejectionReasonSchema,
} from "@/lib/validation/models";

const sessionId = z.string().uuid();
export const gameCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("answer"),
    key: onboardingSchema.keyof(),
    value: z.unknown(),
  }),
  z.strictObject({
    type: z.literal("step"),
    step: z.number().int().min(0).max(5),
  }),
  z.strictObject({
    type: z.literal("request"),
    answers: onboardingSchema.strict().optional(),
  }),
  z.strictObject({
    type: z.literal("reroll"),
    sessionId,
    reason: rejectionReasonSchema.nullable(),
  }),
  z.strictObject({ type: z.literal("discard"), sessionId }),
  z.strictObject({ type: z.literal("start"), sessionId }),
  z.strictObject({
    type: z.literal("check"),
    sessionId,
    index: z.number().int().min(0).max(5),
    checked: z.boolean(),
  }),
  z.strictObject({
    type: z.literal("completionDraft"),
    sessionId,
    patch: completionDraftSchema.partial().strict(),
  }),
  z.strictObject({
    type: z.literal("complete"),
    sessionId,
    input: completionInputSchema.strict(),
  }),
  z.strictObject({ type: z.literal("abandon"), sessionId }),
]);
export const commandRequestSchema = z.strictObject({
  command: gameCommandSchema,
  analytics: analyticsContextSchema.optional(),
  timeZone: z
    .string()
    .min(1)
    .max(100)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Invalid time zone"),
});
export const storedGameSchema = z.object({
  state: localStateSchema,
  revision: z.number().int().nonnegative(),
});
export const gameResponseSchema = z.object({
  state: localStateSchema,
  sessionId: sessionId.optional(),
});
