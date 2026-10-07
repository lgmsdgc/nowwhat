import type { z } from "zod";
import type {
  analyticsContextSchema,
  analyticsEventSchema,
  clientEventSchema,
} from "@/lib/validation/analytics";
export type AnalyticsContext = z.infer<typeof analyticsContextSchema>;
export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;
export type ClientEvent = z.infer<typeof clientEventSchema>;
export type ClientEventName = ClientEvent["name"];
export type ClientEventInput = Pick<
  ClientEvent,
  "name" | "sessionId" | "properties"
>;
export interface AnalyticsRecord {
  ownerId: string;
  event: AnalyticsEvent;
}
