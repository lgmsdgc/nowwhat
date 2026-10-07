import { authenticatedContext, ApiFailure } from "@/lib/supabase/server";
import { privateJson, gameApiError } from "@/lib/http/gameApi";

export async function GET(request: Request) {
  try {
    const { user, userClient } = await authenticatedContext(request);
    const history = await userClient
      .from("local_mission_history")
      .select(
        "id,mission_id,title,completed_at,actual_cost,rating,comment,source",
      )
      .order("completed_at", { ascending: false });
    if (history.error)
      throw new ApiFailure("저장한 기록을 읽지 못했어요.", 503);
    return privateJson({
      user: {
        id: user.id,
        anonymous: user.is_anonymous !== false,
        email: user.email ?? null,
      },
      imports: history.data,
    });
  } catch (error) {
    return gameApiError(error);
  }
}
