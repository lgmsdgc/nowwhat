import { z } from "zod";

export const analyticsTimeZoneSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Invalid time zone");
export const analyticsContextSchema = z.strictObject({
  visitId: z.uuid(),
  timeZone: analyticsTimeZoneSchema,
});
export const clientEventNameSchema = z.enum([
  "visit_started",
  "landing_view",
  "onboarding_started",
  "onboarding_completed",
  "mission_requested",
  "mission_share_requested",
  "mission_shared",
]);
export const eventNameSchema = z.enum([
  ...clientEventNameSchema.options,
  "mission_shown",
  "mission_rejected",
  "mission_accepted",
  "mission_started",
  "mission_completed",
  "mission_abandoned",
]);
export const analyticsPropertiesSchema = z.strictObject({
  requestKind: z.enum(["onboarding", "repeat", "reroll"]).optional(),
  channel: z.enum(["native", "clipboard"]).optional(),
  rerollIndex: z.number().int().nonnegative().optional(),
  reason: z
    .enum(["expensive", "low_energy", "too_far", "not_fun", "not_for_me"])
    .nullable()
    .optional(),
});
export const clientEventSchema = z
  .strictObject({
    id: z.uuid(),
    name: clientEventNameSchema,
    visitId: z.uuid(),
    timeZone: analyticsTimeZoneSchema,
    occurredAt: z.iso.datetime(),
    sessionId: z.uuid().nullable(),
    properties: analyticsPropertiesSchema,
  })
  .superRefine((event, ctx) => {
    const share =
      event.name === "mission_shared" ||
      event.name === "mission_share_requested";
    if (share && !event.sessionId)
      ctx.addIssue({
        code: "custom",
        message: "Share requires a completed session",
      });
    if (
      !share &&
      event.name !== "mission_requested" &&
      event.sessionId !== null
    )
      ctx.addIssue({ code: "custom", message: "Unexpected session" });
    const allowed =
      event.name === "mission_requested"
        ? ["requestKind"]
        : share
          ? ["channel"]
          : [];
    if (Object.keys(event.properties).some((key) => !allowed.includes(key)))
      ctx.addIssue({ code: "custom", message: "Unexpected event properties" });
    if (event.name === "mission_requested" && !event.properties.requestKind)
      ctx.addIssue({ code: "custom", message: "Missing request kind" });
    if (share && !event.properties.channel)
      ctx.addIssue({ code: "custom", message: "Missing share channel" });
  });
export const analyticsEventSchema = z.strictObject({
  id: z.uuid(),
  name: eventNameSchema,
  visitId: z.uuid(),
  anonymousId: z.uuid(),
  timeZone: analyticsTimeZoneSchema,
  occurredAt: z.iso.datetime({ offset: true }),
  localDate: z.iso.date(),
  sessionId: z.uuid().nullable(),
  recommendationRunId: z.uuid().nullable(),
  missionId: z.string().min(1).max(80).nullable(),
  dedupeKey: z.string().min(1).max(160),
  source: z.enum(["client", "game"]),
  properties: analyticsPropertiesSchema,
});
export const analyticsBatchSchema = z.strictObject({
  anonymousId: z.uuid(),
  events: z.array(clientEventSchema).min(1).max(20),
});
