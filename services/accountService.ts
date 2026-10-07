"use client";
import { z } from "zod";
import { getBrowserSupabase, accessToken } from "@/lib/supabase/browser";
import {
  accountResponseSchema,
  emailSchema,
  otpSchema,
} from "@/lib/validation/account";
import { LocalRepository } from "@/lib/repositories/localRepository";

export const MIGRATION_KEY = "nowwhat:account-migration:v1";
const ticketSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  sourceUserId: z.string().uuid(),
  expiresAt: z.number(),
});
export type Account = z.infer<typeof accountResponseSchema>;
async function api(path: string, body?: unknown) {
  const token = await accessToken();
  let response: Response;
  try {
    response = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error(
      "서버에 연결하지 못했어요. 연결을 확인한 뒤 다시 시도해주세요.",
    );
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error("연결 응답을 읽지 못했어요. 다시 시도해주세요.");
  }
  if (!response.ok)
    throw new Error(
      z.object({ error: z.string() }).safeParse(value).data?.error ??
        "연결을 확인한 뒤 다시 시도해주세요.",
    );
  return value;
}
export async function loadAccount() {
  return accountResponseSchema.parse(await api("/api/account"));
}
async function prepare() {
  await accessToken();
  const { data, error } = await getBrowserSupabase().auth.getUser();
  if (error || !data.user) throw new Error("현재 연결을 확인하지 못했어요.");
  if (!data.user.is_anonymous) return;
  const raw = window.localStorage.getItem(MIGRATION_KEY);
  if (raw) {
    let saved: unknown;
    try {
      saved = JSON.parse(raw);
    } catch {
      saved = null;
    }
    const existing = ticketSchema.safeParse(saved);
    if (
      existing.success &&
      existing.data.sourceUserId === data.user.id &&
      existing.data.expiresAt > Date.now()
    )
      return;
  }
  const result = z
    .object({ token: z.string() })
    .parse(await api("/api/account/migration", { action: "prepare" }));
  window.localStorage.setItem(
    MIGRATION_KEY,
    JSON.stringify({
      token: result.token,
      sourceUserId: data.user.id,
      expiresAt: Date.now() + 23 * 3600000,
    }),
  );
}
export async function finishAccountMigration() {
  const raw = window.localStorage.getItem(MIGRATION_KEY);
  if (!raw) return;
  const ticket = ticketSchema.parse(JSON.parse(raw));
  await api("/api/account/migration", { action: "claim", token: ticket.token });
  window.localStorage.removeItem(MIGRATION_KEY);
}
export async function startGoogle(existing: boolean) {
  await prepare();
  const auth = getBrowserSupabase().auth;
  const redirectTo = `${window.location.origin}/auth/callback`;
  const { error } = existing
    ? await auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      })
    : await auth.linkIdentity({ provider: "google", options: { redirectTo } });
  if (error)
    throw new Error(
      "Google 연결을 시작하지 못했어요. 기존 계정이 있다면 로그인으로 시도해주세요.",
    );
}
export async function sendEmail(email: string, existing: boolean) {
  const safe = emailSchema.parse(email);
  await prepare();
  const auth = getBrowserSupabase().auth;
  const redirect = `${window.location.origin}/auth/callback`;
  const { error } = existing
    ? await auth.signInWithOtp({
        email: safe,
        options: { shouldCreateUser: false, emailRedirectTo: redirect },
      })
    : await auth.updateUser({ email: safe }, { emailRedirectTo: redirect });
  if (error)
    throw new Error(
      "이메일 연결을 시작하지 못했어요. 이미 가입했다면 기존 계정 로그인을 선택해주세요.",
    );
}
export async function verifyEmail(
  email: string,
  token: string,
  existing: boolean,
) {
  const { error } = await getBrowserSupabase().auth.verifyOtp({
    email: emailSchema.parse(email),
    token: otpSchema.parse(token),
    type: existing ? "email" : "email_change",
  });
  if (error)
    throw new Error(
      "코드가 맞지 않거나 만료됐어요. 확인 후 다시 시도해주세요.",
    );
}
export async function exchangeCallback(code: string, flowId?: string) {
  const { error } = await getBrowserSupabase().auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined,
  );
  if (error)
    throw new Error(
      "연결 링크가 만료되었거나 다른 브라우저에서 열렸어요. 가입을 시작한 브라우저에서 다시 시도해주세요.",
    );
}
export async function importLocalHistory() {
  const state = new LocalRepository(window.localStorage).read();
  if (!state) return { imported: 0 };
  return z.object({ imported: z.number().int().nonnegative() }).parse(
    await api("/api/account/import", {
      state: { ...state, analyticsEvents: [] },
    }),
  );
}
