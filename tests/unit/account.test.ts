import { randomUUID } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState, transition } from "@/services/gameplayService";
import { missions } from "@/seed/missions";
import { prepareLocalImport } from "@/services/localImportService";
import { migrationActionSchema } from "@/lib/validation/account";
import { STORAGE_KEY } from "@/lib/repositories/localRepository";

const sdk = vi.hoisted(() => ({
  accessToken: vi.fn(),
  getUser: vi.fn(),
  linkIdentity: vi.fn(),
  signInWithOAuth: vi.fn(),
  updateUser: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));
vi.mock("@/lib/supabase/browser", () => ({
  accessToken: sdk.accessToken,
  getBrowserSupabase: () => ({ auth: sdk }),
}));
import {
  startGoogle,
  sendEmail,
  verifyEmail,
  exchangeCallback,
  finishAccountMigration,
  importLocalHistory,
  MIGRATION_KEY,
} from "@/services/accountService";

let storage: Map<string, string>;
let request: ReturnType<typeof vi.fn<typeof fetch>>;
const source = randomUUID();
beforeEach(() => {
  vi.resetAllMocks();
  storage = new Map();
  vi.stubGlobal("window", {
    location: { origin: "https://nowwhat.example" },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  sdk.accessToken.mockResolvedValue("auth-token");
  sdk.getUser.mockResolvedValue({
    data: { user: { id: source, is_anonymous: true } },
    error: null,
  });
  for (const name of [
    "linkIdentity",
    "signInWithOAuth",
    "updateUser",
    "signInWithOtp",
    "verifyOtp",
    "exchangeCodeForSession",
  ] as const)
    sdk[name].mockResolvedValue({ error: null });
  request = vi.fn<typeof fetch>(async () =>
    Response.json({ token: "a".repeat(64), imported: 1, moved: 1 }),
  );
  vi.stubGlobal("fetch", request);
});
afterEach(() => vi.unstubAllGlobals());

describe("account Auth orchestration", () => {
  it("prepares anonymous ownership before Google linking, with same-origin callback", async () => {
    await startGoogle(false);
    expect(request).toHaveBeenCalledOnce();
    expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({
      action: "prepare",
    });
    expect(sdk.linkIdentity).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://nowwhat.example/auth/callback" },
    });
    expect(sdk.signInWithOAuth).not.toHaveBeenCalled();
    expect(JSON.parse(storage.get(MIGRATION_KEY)!)).toMatchObject({
      sourceUserId: source,
      token: "a".repeat(64),
    });
  });
  it("uses separate existing-account login and reuses unexpired ownership proof", async () => {
    await startGoogle(false);
    await startGoogle(true);
    expect(request).toHaveBeenCalledOnce();
    expect(sdk.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://nowwhat.example/auth/callback" },
    });
  });
  it("email signup links the current anonymous identity; existing login avoids account creation", async () => {
    await sendEmail("test@example.com", false);
    expect(sdk.updateUser).toHaveBeenCalledWith(
      { email: "test@example.com" },
      { emailRedirectTo: "https://nowwhat.example/auth/callback" },
    );
    await sendEmail("test@example.com", true);
    expect(sdk.signInWithOtp).toHaveBeenCalledWith({
      email: "test@example.com",
      options: {
        shouldCreateUser: false,
        emailRedirectTo: "https://nowwhat.example/auth/callback",
      },
    });
  });
  it("verifies the matching email OTP type and passes current SDK PKCE flow ID", async () => {
    await verifyEmail("test@example.com", "123456", false);
    expect(sdk.verifyOtp).toHaveBeenLastCalledWith({
      email: "test@example.com",
      token: "123456",
      type: "email_change",
    });
    await verifyEmail("test@example.com", "123456", true);
    expect(sdk.verifyOtp).toHaveBeenLastCalledWith({
      email: "test@example.com",
      token: "123456",
      type: "email",
    });
    await exchangeCallback("one-use-code", "flow-id");
    expect(sdk.exchangeCodeForSession).toHaveBeenCalledWith("one-use-code", {
      flowId: "flow-id",
    });
    await expect(
      verifyEmail("test@example.com", "wrong", true),
    ).rejects.toThrow();
  });
  it("does not start login when preparing proof fails", async () => {
    request.mockResolvedValueOnce(
      Response.json({ error: "연결 실패" }, { status: 503 }),
    );
    await expect(startGoogle(true)).rejects.toThrow("연결 실패");
    expect(sdk.signInWithOAuth).not.toHaveBeenCalled();
    expect(storage.get(MIGRATION_KEY)).toBeUndefined();
  });
  it("retains the proof on failed migration and removes it only after server success", async () => {
    await startGoogle(false);
    const saved = storage.get(MIGRATION_KEY);
    request.mockResolvedValueOnce(
      Response.json({ error: "다시 시도" }, { status: 409 }),
    );
    await expect(finishAccountMigration()).rejects.toThrow("다시 시도");
    expect(storage.get(MIGRATION_KEY)).toBe(saved);
    await finishAccountMigration();
    expect(storage.has(MIGRATION_KEY)).toBe(false);
  });
  it("renews expired or corrupt proof while still anonymous", async () => {
    storage.set(
      MIGRATION_KEY,
      JSON.stringify({
        token: "a".repeat(64),
        sourceUserId: source,
        expiresAt: 0,
      }),
    );
    await startGoogle(false);
    expect(request).toHaveBeenCalledOnce();
    storage.set(MIGRATION_KEY, "bad json");
    await startGoogle(false);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("does not send or delete local records automatically during login", async () => {
    const state = createInitialState(randomUUID(), new Date());
    storage.set(STORAGE_KEY, JSON.stringify(state));
    const original = storage.get(STORAGE_KEY);
    await startGoogle(false);
    await finishAccountMigration();
    expect(storage.get(STORAGE_KEY)).toBe(original);
    expect(
      request.mock.calls.every(
        (call) => !String(call[1]?.body).includes('"state"'),
      ),
    ).toBe(true);
    await importLocalHistory();
    expect(storage.get(STORAGE_KEY)).toBe(original);
    expect(request.mock.calls.at(-1)?.[0]).toBe("/api/account/import");
  });
});

describe("local import trust boundary", () => {
  function completedState() {
    const env = { now: new Date(), id: randomUUID, random: () => 0, missions };
    const requested = transition(
      createInitialState(randomUUID(), env.now),
      {
        type: "request",
        answers: {
          relationship: "solo",
          durationMinutes: 15,
          budgetPerPerson: 0,
          travelScope: "home",
          energy: 1,
          intensity: "random",
        },
      },
      env,
    );
    const id = requested.sessionId!;
    let state = transition(
      requested.state,
      { type: "start", sessionId: id },
      env,
    ).state;
    for (let index = 0; index < state.sessions[0].mission.steps.length; index++)
      state = transition(
        state,
        { type: "check", sessionId: id, index, checked: true },
        env,
      ).state;
    return transition(
      state,
      {
        type: "complete",
        sessionId: id,
        input: {
          actualCost: 0,
          rating: 5,
          wouldDoAgain: true,
          comment: "내 기록",
        },
      },
      env,
    ).state;
  }
  it("keeps result details but never submits local EXP or invented titles as rewards", () => {
    const state = completedState();
    state.sessions[0].result!.awardedExp = 1000000;
    state.sessions[0].mission.title = "바뀐 제목";
    const result = prepareLocalImport({ state });
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      actual_cost: 0,
      rating: 5,
      comment: "내 기록",
    });
    expect(JSON.stringify(result)).not.toContain("awardedExp");
    expect(JSON.stringify(result)).not.toContain("바뀐 제목");
  });
  it("does not import active missions and rejects inconsistent ownership or oversized snapshots", () => {
    const initial = createInitialState(randomUUID(), new Date());
    expect(prepareLocalImport({ state: initial }).records).toHaveLength(0);
    const state = completedState();
    state.sessions[0].anonymousId = randomUUID();
    expect(() => prepareLocalImport({ state })).toThrow();
    const oversized = completedState();
    const first = oversized.sessions[0];
    oversized.sessions = Array.from({ length: 201 }, () => ({
      ...first,
      id: randomUUID(),
    }));
    expect(() => prepareLocalImport({ state: oversized })).toThrow();
  });
  it("rejects forged account IDs in API migration input", () => {
    expect(
      migrationActionSchema.safeParse({
        action: "prepare",
        sourceUserId: randomUUID(),
      }).success,
    ).toBe(false);
    expect(
      migrationActionSchema.safeParse({
        action: "claim",
        token: "a".repeat(64),
        targetUserId: randomUUID(),
      }).success,
    ).toBe(false);
    expect(
      migrationActionSchema.safeParse({ action: "claim", token: "guess" })
        .success,
    ).toBe(false);
  });
});
