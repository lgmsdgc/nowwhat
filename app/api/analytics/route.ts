import {
  analyticsBatchSchema,
  analyticsEventSchema,
} from "@/lib/validation/analytics";
import { privateJson, gameApiError, readJson } from "@/lib/http/gameApi";
import { authenticatedContext, ApiFailure } from "@/lib/supabase/server";
import { analyticsReport } from "@/services/analyticsReportService";
import type { Json } from "@/types/database";

export async function POST(request: Request) {
  try {
    const batch = analyticsBatchSchema.parse(await readJson(request, 32768));
    const { owner, admin } = await authenticatedContext(request);
    const result = await admin.rpc("record_client_events", {
      p_user_id: owner,
      p_anonymous_id: batch.anonymousId,
      p_events: JSON.parse(JSON.stringify(batch.events)) as Json,
    });
    if (result.error)
      throw new ApiFailure("분석 이벤트를 저장하지 못했어요.", 503);
    return privateJson({ accepted: result.data });
  } catch (error) {
    return gameApiError(error);
  }
}
/** Private developer export; no public cross-user analytics endpoint. */
export async function GET(request: Request) {
  try {
    const { owner, userClient } = await authenticatedContext(request);
    const result = await userClient
      .from("analytics_events")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(2000);
    if (result.error) throw new ApiFailure("분석 기록을 읽지 못했어요.", 503);
    const records = result.data.toReversed().map((row) => ({
      ownerId: owner,
      event: analyticsEventSchema.parse({
        id: row.id,
        name: row.name,
        visitId: row.visit_id,
        anonymousId: row.anonymous_id,
        timeZone: row.time_zone,
        occurredAt: row.occurred_at,
        localDate: row.local_date,
        sessionId: row.session_id,
        recommendationRunId: row.recommendation_run_id,
        missionId: row.mission_id,
        dedupeKey: row.dedupe_key,
        source: row.source,
        properties: row.properties,
      }),
    }));
    return privateJson({
      scope: "own-latest-2000",
      records,
      report: analyticsReport(records),
    });
  } catch (error) {
    return gameApiError(error);
  }
}
