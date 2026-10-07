"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getDataConfig } from "@/lib/config/dataSource";
import type { Database } from "@/types/database";

let client: SupabaseClient<Database> | undefined;
export function getBrowserSupabase() {
  if (client) return client;
  const config = getDataConfig();
  if (config.mode !== "supabase") throw new Error("Supabase 모드가 아니에요.");
  client = createClient<Database>(config.url, config.publishableKey, {
    auth: { flowType: "pkce", detectSessionInUrl: false },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: init?.signal
            ? AbortSignal.any([init.signal, AbortSignal.timeout(20000)])
            : AbortSignal.timeout(20000),
        }),
    },
  });
  return client;
}
export async function accessToken() {
  const auth = getBrowserSupabase().auth;
  const { data, error } = await auth.getSession();
  if (error)
    throw new Error("익명 연결을 확인하지 못했어요. 다시 시도해주세요.");
  if (data.session) return data.session.access_token;
  const created = await auth.signInAnonymously();
  if (created.error || !created.data.session)
    throw new Error(
      "익명 연결을 시작하지 못했어요. Supabase의 익명 로그인 설정을 확인해주세요.",
    );
  return created.data.session.access_token;
}
