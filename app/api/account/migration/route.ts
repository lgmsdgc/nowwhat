import { createHash, randomBytes } from "node:crypto";
import { authenticatedContext, ApiFailure } from "@/lib/supabase/server";
import { readJson, privateJson, gameApiError } from "@/lib/http/gameApi";
import { migrationActionSchema } from "@/lib/validation/account";

export async function POST(request: Request) {
  try {
    const action = migrationActionSchema.parse(await readJson(request, 4096));
    const { owner, user, userClient, admin } =
      await authenticatedContext(request);
    const initialized = await userClient.rpc("get_game_state");
    if (initialized.error)
      throw new ApiFailure("현재 기록을 확인하지 못했어요.", 503);
    if (action.action === "prepare") {
      if (user.is_anonymous !== true)
        throw new ApiFailure(
          "익명 사용자만 기록 연결을 준비할 수 있어요.",
          409,
        );
      const token = randomBytes(32).toString("hex");
      const result = await admin.rpc("prepare_account_migration", {
        p_source: owner,
        p_hash: createHash("sha256").update(token).digest("hex"),
      });
      if (result.error)
        throw new ApiFailure("기록 연결을 준비하지 못했어요.", 503);
      return privateJson({ token });
    }
    if (user.is_anonymous !== false)
      throw new ApiFailure("가입 또는 로그인을 먼저 완료해주세요.", 409);
    const result = await admin.rpc("claim_account_migration", {
      p_target: owner,
      p_hash: createHash("sha256").update(action.token).digest("hex"),
    });
    if (result.error)
      throw new ApiFailure(
        "기록 연결이 만료되었거나 사용할 수 없어요. 기존 기록은 유지했어요.",
        409,
      );
    return privateJson({ moved: result.data });
  } catch (error) {
    return gameApiError(error);
  }
}
