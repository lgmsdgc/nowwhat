import { authenticatedContext, ApiFailure } from "@/lib/supabase/server";
import { readJson, privateJson, gameApiError } from "@/lib/http/gameApi";
import { prepareLocalImport } from "@/services/localImportService";
import type { Json } from "@/types/database";

export async function POST(request: Request) {
  try {
    const input = prepareLocalImport(await readJson(request, 1048576));
    const { owner, user, userClient, admin } =
      await authenticatedContext(request);
    if (user.is_anonymous !== false)
      throw new ApiFailure("가입 또는 로그인을 먼저 완료해주세요.", 409);
    const initialized = await userClient.rpc("get_game_state");
    if (initialized.error)
      throw new ApiFailure("현재 기록을 확인하지 못했어요.", 503);
    const result = await admin.rpc("import_local_history", {
      p_target: owner,
      p_source: input.sourceId,
      p_records: JSON.parse(JSON.stringify(input.records)) as Json,
    });
    if (result.error)
      throw new ApiFailure(
        "기기 기록을 옮기지 못했어요. 원본 기록은 유지했어요.",
        409,
      );
    return privateJson({ imported: result.data });
  } catch (error) {
    return gameApiError(error);
  }
}
