import { z } from "zod";
import { analyticsEventSchema } from "@/lib/validation/analytics";

export const relationshipSchema = z.enum([
  "solo",
  "friend",
  "couple",
  "family",
]);
export const energySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);
export const intensitySchema = z.enum([
  "relaxed",
  "random",
  "adventure",
  "yolo",
]);
export const travelSchema = z.enum(["home", "nearby", "far", "anywhere"]);
export const onboardingSchema = z.object({
  relationship: relationshipSchema,
  durationMinutes: z.union([
    z.literal(15),
    z.literal(30),
    z.literal(60),
    z.literal(180),
    z.literal(360),
    z.null(),
  ]),
  budgetPerPerson: z.union([
    z.literal(0),
    z.literal(10000),
    z.literal(30000),
    z.literal(50000),
    z.null(),
  ]),
  travelScope: travelSchema,
  energy: energySchema,
  intensity: intensitySchema,
});

const stars = z.number().int().min(1).max(5);
export const missionSchema = z
  .object({
    id: z.string().min(1).max(80),
    version: z.literal(1),
    title: z.string().min(1).max(80),
    emoji: z.string().min(1).max(16),
    shortDescription: z.string().min(1).max(160),
    fullDescription: z.string().min(1).max(1000),
    category: z.enum([
      "food",
      "walk",
      "game",
      "conversation",
      "challenge",
      "exploration",
      "home",
      "creative",
      "photo",
      "shopping",
      "random",
      "date",
    ]),
    allowedRelationships: z.array(relationshipSchema).min(1),
    minPeople: z.number().int().min(1),
    maxPeople: z.number().int().min(1).nullable(),
    minBudget: z.number().int().nonnegative(),
    maxBudget: z.number().int().nonnegative(),
    minDuration: z.number().int().positive(),
    maxDuration: z.number().int().positive(),
    energyLevel: energySchema,
    intensity: energySchema,
    travelScope: travelSchema,
    indoor: z.boolean(),
    outdoor: z.boolean(),
    nightSafe: z.boolean(),
    soloSafe: z.boolean(),
    familySafe: z.boolean(),
    minorSafe: z.boolean(),
    requiresCar: z.boolean(),
    alcoholRelated: z.boolean(),
    physicalRiskLevel: z.number().int().min(0).max(3),
    physicalIntensity: energySchema,
    locationRequired: z.boolean(),
    difficulty: stars,
    estimatedFun: stars,
    baseExp: z.number().int().min(0).max(1000),
    steps: z.array(z.string().min(1).max(200)).min(1).max(6),
    constraints: z.array(z.string().min(1).max(200)).max(8),
    active: z.boolean(),
    createdAt: z.string().datetime(),
  })
  .refine(
    (m) => m.maxBudget >= m.minBudget && m.maxDuration >= m.minDuration,
    "Invalid mission bounds",
  );

export const rejectionReasonSchema = z.enum([
  "expensive",
  "low_energy",
  "too_far",
  "not_fun",
  "not_for_me",
]);
export const completionInputSchema = z.object({
  actualCost: z.number().int().min(0).max(10000000).nullable(),
  rating: stars.nullable(),
  wouldDoAgain: z.boolean().nullable(),
  comment: z.string().trim().max(140),
});
export const completionDraftSchema = z.object({
  costText: z.string().max(8),
  rating: stars.nullable(),
  wouldDoAgain: z.boolean().nullable(),
  comment: z.string().max(140),
});
export const sessionSchema = z
  .object({
    id: z.string().uuid(),
    anonymousId: z.string().uuid(),
    mission: missionSchema,
    answers: onboardingSchema,
    recommendationRunId: z.string().uuid(),
    rerollIndex: z.number().int().nonnegative(),
    status: z.enum([
      "recommended",
      "started",
      "completed",
      "rejected",
      "abandoned",
    ]),
    shownAt: z.string().datetime(),
    acceptedAt: z.string().datetime().nullable(),
    startedAt: z.string().datetime().nullable(),
    completedAt: z.string().datetime().nullable(),
    abandonedAt: z.string().datetime().nullable(),
    checkedSteps: z.array(z.number().int().nonnegative()),
    completionDraft: completionDraftSchema,
    result: completionInputSchema
      .extend({
        actualDurationSeconds: z.number().int().nonnegative(),
        awardedExp: z.number().int().nonnegative(),
        expBefore: z.number().int().nonnegative(),
        expAfter: z.number().int().nonnegative(),
      })
      .nullable(),
  })
  .superRefine((s, ctx) => {
    if (
      (s.status === "started" ||
        s.status === "completed" ||
        s.status === "abandoned") &&
      !s.startedAt
    )
      ctx.addIssue({ code: "custom", message: "Missing start time" });
    if (s.status === "completed" && (!s.result || !s.completedAt))
      ctx.addIssue({ code: "custom", message: "Missing completion result" });
    if (s.status !== "completed" && s.result)
      ctx.addIssue({ code: "custom", message: "Unexpected completion result" });
    if (
      s.checkedSteps.some((i) => i >= s.mission.steps.length) ||
      new Set(s.checkedSteps).size !== s.checkedSteps.length
    )
      ctx.addIssue({ code: "custom", message: "Invalid checklist" });
  });

export const feedbackSchema = z.object({
  id: z.string().uuid(),
  anonymousId: z.string().uuid(),
  sessionId: z.string().uuid(),
  missionId: z.string(),
  action: z.enum([
    "shown",
    "accepted",
    "rejected",
    "completed",
    "abandoned",
    "liked",
    "disliked",
  ]),
  reason: rejectionReasonSchema.nullable(),
  createdAt: z.string().datetime(),
});
export const localStateSchema = z
  .object({
    version: z.literal(1),
    anonymousId: z.string().uuid(),
    createdAt: z.string().datetime(),
    onboarding: z.object({
      answers: onboardingSchema.partial(),
      step: z.number().int().min(0).max(5),
    }),
    sessions: z.array(sessionSchema),
    feedback: z.array(feedbackSchema),
    analyticsEvents: z.array(analyticsEventSchema).max(2000).default([]),
  })
  .superRefine((state, ctx) => {
    const ids = new Set(state.sessions.map((s) => s.id));
    if (
      state.analyticsEvents.some((e) => e.anonymousId !== state.anonymousId) ||
      new Set(state.analyticsEvents.map((e) => e.id)).size !==
        state.analyticsEvents.length ||
      new Set(state.analyticsEvents.map((e) => e.dedupeKey)).size !==
        state.analyticsEvents.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid analytics ownership or duplicate",
      });
    if (
      ids.size !== state.sessions.length ||
      state.sessions.some((s) => s.anonymousId !== state.anonymousId)
    )
      ctx.addIssue({ code: "custom", message: "Invalid session ownership" });
    if (
      state.sessions.filter(
        (s) => s.status === "started" || s.status === "recommended",
      ).length > 1
    )
      ctx.addIssue({ code: "custom", message: "Multiple active sessions" });
    if (
      state.feedback.some(
        (f) => f.anonymousId !== state.anonymousId || !ids.has(f.sessionId),
      )
    )
      ctx.addIssue({ code: "custom", message: "Invalid feedback ownership" });
  });
