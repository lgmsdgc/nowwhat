import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getDataConfig } from "@/lib/config/dataSource";
import { loadMissions } from "@/services/missionService";
import {
  RevisionConflict,
  type GameDatabase,
} from "@/services/serverGameService";
import type { Database, Json } from "@/types/database";

export class ApiFailure extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
const timedFetch: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    signal: init?.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(12000)])
      : AbortSignal.timeout(12000),
    cache: "no-store",
  });
export async function authenticatedContext(request: Request) {
  const config = getDataConfig();
  if (config.mode !== "supabase")
    throw new ApiFailure("DB 연결 모드가 설정되지 않았어요.", 503);
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new ApiFailure("서버 DB 연결 설정을 확인해주세요.", 503);
  const bearer = request.headers.get("authorization");
  if (!bearer?.startsWith("Bearer ") || bearer.length > 8192)
    throw new ApiFailure("익명 연결을 확인해주세요.", 401);
  const token = bearer.slice(7);
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: timedFetch },
  };
  const userClient = createClient<Database>(config.url, config.publishableKey, {
    ...options,
    global: {
      ...options.global,
      headers: { Authorization: `Bearer ${token}` },
    },
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user)
    throw new ApiFailure(
      "연결이 만료되었어요. 새로고침해서 다시 시도해주세요.",
      401,
    );
  const owner = data.user.id;
  const admin = createClient<Database>(config.url, secret, options);
  return { owner, user: data.user, userClient, admin };
}
export async function authenticatedDatabase(
  request: Request,
): Promise<GameDatabase> {
  const { owner, userClient, admin } = await authenticatedContext(request);
  return {
    async read() {
      const result = await userClient.rpc("get_game_state");
      if (result.error)
        throw new ApiFailure(
          "기록을 읽지 못했어요. DB 설정과 연결을 확인해주세요.",
          503,
        );
      return result.data;
    },
    missions: () => loadMissions(userClient),
    async commit(revision, state, analytics) {
      // Owner comes only from Auth getUser, and state only from server transition.
      const result = await admin.rpc("commit_game_state", {
        p_user_id: owner,
        p_expected_revision: revision,
        p_state: JSON.parse(JSON.stringify(state)) as Json,
        p_analytics_context: analytics ? { ...analytics } : null,
      });
      if (result.error?.code === "40001") throw new RevisionConflict();
      if (result.error)
        throw new ApiFailure(
          "기록을 저장하지 못했어요. 잠시 후 다시 시도해주세요.",
          503,
        );
    },
  };
}
