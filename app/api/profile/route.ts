import { authenticatedContext, ApiFailure } from "@/lib/supabase/server";
import { privateJson, gameApiError } from "@/lib/http/gameApi";
import { progressionResponseSchema } from "@/lib/validation/progression";

export async function GET(request: Request) {
  try {
    const { userClient } = await authenticatedContext(request);
    const [catalog, earned] = await Promise.all([
      userClient
        .from("achievements")
        .select(
          "id,name,emoji,description,condition_type,condition_value,active",
        )
        .eq("active", true)
        .order("id"),
      userClient
        .from("user_achievements")
        .select("achievement_id,unlocked_at,earned_session_id"),
    ]);
    if (catalog.error || earned.error)
      throw new ApiFailure("칭호를 불러오지 못했어요. 다시 시도해주세요.", 503);
    const parsed = progressionResponseSchema.safeParse({
      achievements: catalog.data.map((a) => ({
        id: a.id,
        name: a.name,
        emoji: a.emoji,
        description: a.description,
        conditionType: a.condition_type,
        conditionValue: a.condition_value,
        active: a.active,
      })),
      unlocks: earned.data.map((u) => ({
        achievementId: u.achievement_id,
        unlockedAt: u.unlocked_at,
        earnedSessionId: u.earned_session_id,
      })),
    });
    if (!parsed.success)
      throw new ApiFailure(
        "칭호 설정을 읽지 못했어요. 잠시 후 다시 시도해주세요.",
        503,
      );
    return privateJson(parsed.data);
  } catch (error) {
    return gameApiError(error);
  }
}
