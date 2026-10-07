import type { z } from "zod";
import type {
  completionDraftSchema,
  completionInputSchema,
  feedbackSchema,
  localStateSchema,
  missionSchema,
  rejectionReasonSchema,
  sessionSchema,
} from "@/lib/validation/models";

export type Mission = z.infer<typeof missionSchema>;
export type MissionSession = z.infer<typeof sessionSchema>;
export type LocalState = z.infer<typeof localStateSchema>;
export type Feedback = z.infer<typeof feedbackSchema>;
export type RejectionReason = z.infer<typeof rejectionReasonSchema>;
export type CompletionInput = z.infer<typeof completionInputSchema>;
export type CompletionDraft = z.infer<typeof completionDraftSchema>;
