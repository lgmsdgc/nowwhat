import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { parseDataConfig } from "@/lib/config/dataSource";
import {
  commandRequestSchema,
  gameCommandSchema,
} from "@/lib/validation/commands";
import { gameApiError, privateJson, readCommand } from "@/lib/http/gameApi";
import { RemoteRepository } from "@/lib/repositories/remoteRepository";
import { createInitialState } from "@/services/gameplayService";
import {
  executeGame,
  RevisionConflict,
  type GameDatabase,
} from "@/services/serverGameService";
import { missions } from "@/seed/missions";
import type { OnboardingAnswers } from "@/types/recommendation";

describe("connection configuration and untrusted API input", () => {
  it("defaults to local and requires explicit complete Supabase configuration", () => {
    expect(parseDataConfig()).toEqual({ mode: "local" });
    expect(
      parseDataConfig("local", "https://example.com", "sb_secret_private"),
    ).toEqual({ mode: "local" });
    expect(
      parseDataConfig(
        "supabase",
        "https://project.supabase.co",
        "sb_publishable_example",
      ).mode,
    ).toBe("supabase");
    for (const [mode, url, key] of [
      ["other", "", ""],
      ["supabase", "", ""],
      ["supabase", "http://project.supabase.co", "sb_publishable_example"],
      ["supabase", "https://project.supabase.co", "sb_secret_private"],
    ])
      expect(() => parseDataConfig(mode, url, key)).toThrow();
  });
  it("allows legacy anon keys and rejects legacy service_role keys", () => {
    const key = (role: string) =>
      `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
    expect(
      parseDataConfig("supabase", "https://project.supabase.co", key("anon"))
        .mode,
    ).toBe("supabase");
    expect(() =>
      parseDataConfig(
        "supabase",
        "https://project.supabase.co",
        key("service_role"),
      ),
    ).toThrow();
  });
  it("rejects ownership, EXP, timestamps, malformed keys and nested input injection", () => {
    for (const command of [
      { type: "request", userId: randomUUID() },
      { type: "answer", key: "exp", value: 9999 },
      {
        type: "complete",
        sessionId: randomUUID(),
        input: {
          actualCost: 0,
          rating: 5,
          wouldDoAgain: true,
          comment: "",
          awardedExp: 999,
        },
      },
      {
        type: "start",
        sessionId: randomUUID(),
        startedAt: new Date().toISOString(),
      },
    ])
      expect(gameCommandSchema.safeParse(command).success).toBe(false);
    expect(
      commandRequestSchema.safeParse({
        command: { type: "request" },
        timeZone: "Mars/Space",
      }).success,
    ).toBe(false);
    expect(
      commandRequestSchema.safeParse({
        command: { type: "request" },
        timeZone: "Asia/Seoul",
      }).success,
    ).toBe(true);
  });
  it("limits both declared and streamed body size and rejects invalid JSON", async () => {
    const request = (body: string, headers?: HeadersInit) =>
      new Request("http://localhost/api/game", {
        method: "POST",
        headers: headers ?? { "Content-Type": "application/json" },
        body,
      });
    await expect(
      readCommand(request("{}", { "Content-Type": "text/plain" })),
    ).rejects.toMatchObject({ status: 415 });
    await expect(readCommand(request("not json"))).rejects.toMatchObject({
      status: 400,
    });
    await expect(readCommand(request(" ".repeat(17000)))).rejects.toMatchObject(
      { status: 413 },
    );
    await expect(
      readCommand(
        request("{}", {
          "Content-Type": "application/json",
          "Content-Length": "20000",
        }),
      ),
    ).rejects.toMatchObject({ status: 413 });
    expect(
      await readCommand(
        request(
          JSON.stringify({
            command: { type: "step", step: 1 },
            timeZone: "UTC",
          }),
        ),
      ),
    ).toMatchObject({ command: { type: "step", step: 1 } });
  });
  it("never caches private responses or exposes internal error details", async () => {
    expect(privateJson({}).headers.get("Cache-Control")).toContain("no-store");
    const failure = gameApiError(new Error("secret key sb_secret_test"));
    expect(failure.status).toBe(503);
    expect(JSON.stringify(await failure.json())).not.toContain("sb_secret");
  });
});

describe("remote repository", () => {
  it("sends commands and authenticated tokens, never a client-generated state", async () => {
    const state = createInitialState(randomUUID(), new Date());
    const request = vi.fn<typeof fetch>(async () => Response.json({ state }));
    const repository = new RemoteRepository(
      async () => "verified-at-server",
      request,
    );
    expect(await repository.initialize()).toEqual(state);
    await repository.execute({ type: "step", step: 2 });
    const init = request.mock.calls[1][1]!;
    expect(init.headers).toMatchObject({
      Authorization: "Bearer verified-at-server",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      command: { type: "step", step: 2 },
    });
    expect(String(init.body)).not.toContain("anonymousId");
    expect(init.cache).toBe("no-store");
  });
  it("surfaces network, authentication and invalid state errors without a local fallback", async () => {
    for (const request of [
      vi.fn<typeof fetch>(async () => {
        throw new TypeError("offline");
      }),
      vi.fn<typeof fetch>(async () =>
        Response.json({ error: "연결 확인" }, { status: 401 }),
      ),
      vi.fn<typeof fetch>(async () =>
        Response.json({ state: { version: 999 } }),
      ),
    ])
      await expect(
        new RemoteRepository(async () => "token", request).initialize(),
      ).rejects.toThrow();
  });
});

describe("server-authoritative time and retries", () => {
  it("uses the verified server timestamp in the user's time zone for night safety", async () => {
    const template = missions.find(
      (m) =>
        m.outdoor && !m.nightSafe && m.allowedRelationships.includes("solo"),
    )!;
    const state = createInitialState(randomUUID(), new Date());
    const database: GameDatabase = {
      read: async () => ({ state, revision: 0 }),
      missions: async () => [template],
      commit: vi.fn(async () => {}),
    };
    const answers: OnboardingAnswers = {
      relationship: "solo",
      durationMinutes: null,
      budgetPerPerson: null,
      travelScope: "anywhere",
      energy: 4,
      intensity: "random",
    };
    const now = () => new Date("2026-10-06T14:00:00Z");
    await expect(
      executeGame(database, { type: "request", answers }, "Asia/Seoul", now),
    ).rejects.toThrow("조건");
    expect(
      (await executeGame(database, { type: "request", answers }, "UTC", now))
        .sessionId,
    ).toBeDefined();
  });
  it("stops after three conflicts and never publishes an uncommitted result", async () => {
    const state = createInitialState(randomUUID(), new Date());
    const commit = vi.fn(async () => {
      throw new RevisionConflict();
    });
    const database: GameDatabase = {
      read: async () => ({ state, revision: 0 }),
      missions: async () => missions,
      commit,
    };
    await expect(
      executeGame(database, { type: "step", step: 1 }, "UTC"),
    ).rejects.toBeInstanceOf(RevisionConflict);
    expect(commit).toHaveBeenCalledTimes(3);
    expect(state.onboarding.step).toBe(0);
  });
});
