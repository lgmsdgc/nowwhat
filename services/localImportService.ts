import { localImportSchema } from "@/lib/validation/account";

export function prepareLocalImport(input: unknown) {
  const { state } = localImportSchema.parse(input);
  return {
    sourceId: state.anonymousId,
    records: state.sessions
      .filter((s) => s.status === "completed" && s.result)
      .map((s) => ({
        source_session_id: s.id,
        mission_id: s.mission.id,
        completed_at: s.completedAt!,
        actual_duration_seconds: Math.max(
          0,
          Math.min(
            31536000,
            Math.floor(
              (Date.parse(s.completedAt!) - Date.parse(s.startedAt!)) / 1000,
            ),
          ),
        ),
        actual_cost: s.result!.actualCost,
        rating: s.result!.rating,
        would_do_again: s.result!.wouldDoAgain,
        comment: s.result!.comment,
      })),
  };
}
