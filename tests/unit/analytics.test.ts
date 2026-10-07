import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "@/services/gameplayService";
import {
  LocalRepository,
  STORAGE_KEY,
} from "@/lib/repositories/localRepository";
import { AnalyticsOutbox, OUTBOX_LIMIT } from "@/lib/analytics/outbox";
import { HttpAnalyticsTransport } from "@/lib/analytics/transport";
import { VISIT_IDLE_MS, VISIT_KEY, visitContext } from "@/lib/analytics/visit";
import {
  analyticsBatchSchema,
  clientEventSchema,
} from "@/lib/validation/analytics";
import { localStateSchema } from "@/lib/validation/models";
import {
  appendEvents,
  localClientEvent,
  localDateAt,
  makeClientEvent,
} from "@/services/analyticsService";
import { analyticsReport } from "@/services/analyticsReportService";
import { missions } from "@/seed/missions";
import type {
  AnalyticsEvent,
  AnalyticsRecord,
  ClientEvent,
} from "@/types/analytics";
import type { OnboardingAnswers } from "@/types/recommendation";

const config = vi.hoisted(() => ({ mode: "local" }));
vi.mock("@/lib/config/dataSource", () => ({ getDataConfig: () => config }));
vi.mock("@/lib/supabase/browser", () => ({ accessToken: async () => "token" }));
import { recordClientEvent } from "@/services/analyticsClientService";

const context = { visitId: randomUUID(), timeZone: "Asia/Seoul" };
const now = new Date("2026-10-07T03:00:00.000Z");
const answers: OnboardingAnswers = {
  relationship: "solo",
  durationMinutes: 15,
  budgetPerPerson: 0,
  travelScope: "home",
  energy: 1,
  intensity: "random",
};
const env = {
  now,
  id: randomUUID,
  random: () => 0,
  missions,
  analyticsContext: context,
};
let values: Map<string, string>;
const storage = () => ({
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => {
    values.set(key, value);
  },
});
const client = (
  name: ClientEvent["name"] = "landing_view",
  options: Partial<ClientEvent> = {},
) =>
  makeClientEvent(
    { name, sessionId: null, properties: {}, ...options },
    context,
    new Date(),
    randomUUID,
  );
beforeEach(() => {
  values = new Map();
  config.mode = "local";
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("validated analytics and visit identity", () => {
  it("calculates real local calendar dates around midnight", () => {
    expect(localDateAt("2026-10-06T14:59:00Z", "Asia/Seoul")).toBe(
      "2026-10-06",
    );
    expect(localDateAt("2026-10-06T15:01:00Z", "Asia/Seoul")).toBe(
      "2026-10-07",
    );
    expect(localDateAt("2026-10-06T15:01:00Z", "UTC")).toBe("2026-10-06");
  });
  it("preserves a tab visit across reloads and starts a new visit after inactivity", () => {
    const saved = randomUUID();
    values.set(VISIT_KEY, JSON.stringify({ id: saved, lastSeenAt: 1000 }));
    vi.stubGlobal("window", { sessionStorage: storage() });
    expect(visitContext(2000).visitId).toBe(saved);
    expect(visitContext(2000 + VISIT_IDLE_MS - 1).visitId).toBe(saved);
    const next = visitContext(2000 + 2 * VISIT_IDLE_MS);
    expect(next.visitId).not.toBe(saved);
    expect(JSON.parse(values.get(VISIT_KEY)!)).toMatchObject({
      id: next.visitId,
    });
  });
  it("rotates the visit after a backwards clock jump and survives blocked session storage", () => {
    const saved = randomUUID();
    values.set(VISIT_KEY, JSON.stringify({ id: saved, lastSeenAt: 5000 }));
    vi.stubGlobal("window", { sessionStorage: storage() });
    const next = visitContext(1000);
    expect(next.visitId).not.toBe(saved);
    vi.stubGlobal("window", {
      get sessionStorage() {
        throw new Error("blocked");
      },
    });
    expect(visitContext(2000).visitId).toBe(next.visitId);
  });
  it("rejects personal properties, arbitrary URLs, lifecycle claims and oversized batches", () => {
    const event = client();
    for (const invalid of [
      { ...event, properties: { comment: "private" } },
      { ...event, properties: { actualCost: 1234 } },
      { ...event, url: "https://private.test" },
      { ...event, name: "mission_completed" },
      { ...event, properties: { channel: "native" } },
    ])
      expect(clientEventSchema.safeParse(invalid).success).toBe(false);
    expect(
      analyticsBatchSchema.safeParse({
        anonymousId: randomUUID(),
        events: Array.from({ length: 21 }, () => event),
      }).success,
    ).toBe(false);
    expect(
      clientEventSchema.safeParse({
        ...event,
        name: "mission_shared",
        properties: { channel: "clipboard" },
      }).success,
    ).toBe(false);
  });
  it("keeps old v1 documents readable without analytics data", () => {
    const old = JSON.parse(
      JSON.stringify({
        ...createInitialState(randomUUID(), now),
        analyticsEvents: undefined,
      }),
    );
    expect(localStateSchema.parse(old).analyticsEvents).toEqual([]);
  });
});

describe("local lifecycle facts", () => {
  function ready() {
    const repo = new LocalRepository(storage());
    repo.initialize(env);
    return repo;
  }
  function checked(repo: LocalRepository) {
    const requested = repo.execute({ type: "request", answers }, env),
      sessionId = requested.sessionId!;
    repo.execute({ type: "start", sessionId }, env);
    for (
      let index = 0;
      index < requested.state.sessions[0].mission.steps.length;
      index++
    )
      repo.execute({ type: "check", sessionId, index, checked: true }, env);
    return sessionId;
  }
  const input = {
    actualCost: 0,
    rating: 5,
    wouldDoAgain: true,
    comment: "private comment",
  };
  it("writes shown, accepted, started and completed with the game, exactly once", () => {
    const repo = ready(),
      sessionId = checked(repo);
    const complete = repo.execute({ type: "complete", sessionId, input }, env);
    const events = complete.state.analyticsEvents;
    expect(events.map((e) => e.name)).toEqual([
      "mission_shown",
      "mission_accepted",
      "mission_started",
      "mission_completed",
    ]);
    expect(
      events.every(
        (e) =>
          e.sessionId === sessionId &&
          e.visitId === context.visitId &&
          e.source === "game",
      ),
    ).toBe(true);
    expect(JSON.stringify(events)).not.toContain("private comment");
    expect(JSON.stringify(events)).not.toContain("actualCost");
    repo.execute({ type: "complete", sessionId, input }, env);
    expect(repo.read()!.analyticsEvents).toEqual(events);
    repo.execute({ type: "step", step: 0 }, env);
    expect(repo.read()!.analyticsEvents).toEqual(events);
  });
  it("records rejection reason and reroll identity without turning abandonment into completion", () => {
    const repo = ready();
    const requested = repo.execute({ type: "request", answers }, env);
    const reroll = repo.execute(
      { type: "reroll", sessionId: requested.sessionId!, reason: "low_energy" },
      env,
    );
    repo.execute(
      { type: "reroll", sessionId: requested.sessionId!, reason: "low_energy" },
      env,
    );
    repo.execute({ type: "start", sessionId: reroll.sessionId! }, env);
    repo.execute({ type: "abandon", sessionId: reroll.sessionId! }, env);
    const events = repo.read()!.analyticsEvents;
    expect(events.filter((e) => e.name === "mission_shown")).toHaveLength(2);
    expect(
      events.find((e) => e.name === "mission_rejected")!.properties,
    ).toEqual({ reason: "low_energy", rerollIndex: 0 });
    expect(new Set(events.map((e) => e.recommendationRunId)).size).toBe(1);
    expect(events.at(-1)!.name).toBe("mission_abandoned");
    expect(events.some((e) => e.name === "mission_completed")).toBe(false);
  });
  it("preserves completion and rewards if telemetry exhausted the storage quota", () => {
    const repo = ready();
    const sessionId = checked(repo);
    const constrained = new LocalRepository({
      getItem: storage().getItem,
      setItem: (key, raw) => {
        if (localStateSchema.parse(JSON.parse(raw)).analyticsEvents.length)
          throw new Error("telemetry quota");
        values.set(key, raw);
      },
    });
    const completed = constrained.execute(
      { type: "complete", sessionId, input },
      env,
    );
    expect(completed.state.sessions[0].status).toBe("completed");
    expect(completed.state.sessions[0].result!.awardedExp).toBeGreaterThan(0);
    expect(completed.state.analyticsEvents).toEqual([]);
    expect(repo.read()).toEqual(completed.state);
  });
  it("does not publish completion analytics if the game write and telemetry-free retry fail", () => {
    const repo = ready(),
      sessionId = checked(repo),
      before = values.get(STORAGE_KEY);
    const failing = new LocalRepository({
      getItem: storage().getItem,
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(() =>
      failing.execute({ type: "complete", sessionId, input }, env),
    ).toThrow("저장하지");
    expect(values.get(STORAGE_KEY)).toBe(before);
    repo.execute({ type: "complete", sessionId, input }, env);
    expect(
      repo
        .read()!
        .analyticsEvents.filter((e) => e.name === "mission_completed"),
    ).toHaveLength(1);
  });
  it("keeps request attempts when recommendation fails, but invents no shown event", () => {
    const repo = ready(),
      owner = repo.read()!.anonymousId;
    repo.appendAnalytics(owner, [
      client("mission_requested", {
        properties: { requestKind: "onboarding" },
      }),
    ]);
    expect(() =>
      repo.execute({ type: "request", answers }, { ...env, missions: [] }),
    ).toThrow("조건");
    expect(repo.read()!.analyticsEvents.map((e) => e.name)).toEqual([
      "mission_requested",
    ]);
  });
  it("deduplicates page views and ignores a stale owner after a local reset", () => {
    const repo = ready(),
      owner = repo.read()!.anonymousId;
    const event = client();
    repo.appendAnalytics(owner, [event, { ...event, id: randomUUID() }]);
    expect(repo.read()!.analyticsEvents).toHaveLength(1);
    const before = values.get(STORAGE_KEY);
    repo.appendAnalytics(randomUUID(), [client()]);
    expect(values.get(STORAGE_KEY)).toBe(before);
  });
  it("bounds local retention and rejects sharing an unfinished session", () => {
    const state = createInitialState(randomUUID(), now);
    const first = localClientEvent(state, client());
    const incoming = Array.from({ length: 2010 }, (_, i) => ({
      ...first,
      id: randomUUID(),
      dedupeKey: `test:${i}`,
    }));
    expect(appendEvents([], incoming)).toHaveLength(2000);
    expect(appendEvents([], incoming)[0].dedupeKey).toBe("test:10");
    expect(() =>
      localClientEvent(
        state,
        client("mission_shared", {
          sessionId: randomUUID(),
          properties: { channel: "native" },
        }),
      ),
    ).toThrow();
  });
  it("swallows a client telemetry storage failure so the primary game write can succeed", async () => {
    const repo = ready(),
      owner = repo.read()!.anonymousId;
    vi.stubGlobal("navigator", {
      locks: { request: async (_key: string, fn: () => unknown) => fn() },
    });
    vi.stubGlobal("window", {
      sessionStorage: storage(),
      localStorage: {
        getItem: storage().getItem,
        setItem: () => {
          throw new Error("telemetry blocked");
        },
      },
    });
    await expect(
      recordClientEvent(owner, {
        name: "landing_view",
        sessionId: null,
        properties: {},
      }),
    ).resolves.toBeUndefined();
    expect(
      repo.execute({ type: "request", answers }, env).sessionId,
    ).toBeTruthy();
  });
});

describe("owned retransmission queue and transport", () => {
  it("retains offline events and removes only acknowledged IDs, preserving newly queued events", async () => {
    const queue = new AnalyticsOutbox(storage(), randomUUID()),
      event = client();
    queue.append([event, { ...event, id: randomUUID() }]);
    const sent = queue.batch();
    expect(sent).toHaveLength(1);
    const failing = new HttpAnalyticsTransport(
      async () => "token",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await expect(failing.send(randomUUID(), sent)).rejects.toThrow("offline");
    expect(queue.batch()).toEqual(sent);
    queue.append([
      client("mission_requested", { properties: { requestKind: "repeat" } }),
    ]);
    queue.acknowledge(sent);
    expect(queue.batch()).toHaveLength(1);
    expect(queue.batch()[0].name).toBe("mission_requested");
  });
  it("bounds pending data, batches 20 events and expires stale payloads", () => {
    const queue = new AnalyticsOutbox(storage(), randomUUID());
    queue.append(
      Array.from({ length: OUTBOX_LIMIT + 10 }, () =>
        client("mission_requested", { properties: { requestKind: "repeat" } }),
      ),
    );
    expect(queue.batch()).toHaveLength(20);
    expect(JSON.parse(values.get(queue.key)!)).toMatchObject({ dropped: 10 });
    expect(queue.batch(Date.now() + 8 * 86400000)).toHaveLength(0);
    expect(JSON.parse(values.get(queue.key)!)).toMatchObject({
      dropped: 310,
      events: [],
    });
  });
  it("preserves a corrupt queue and isolates queues belonging to different owners", () => {
    const a = new AnalyticsOutbox(storage(), randomUUID()),
      b = new AnalyticsOutbox(storage(), randomUUID());
    a.append([client()]);
    expect(b.batch()).toEqual([]);
    values.set(a.key, "broken original");
    expect(() => a.append([client()])).toThrow();
    expect(values.get(a.key)).toBe("broken original");
  });
  it("sends a token and strict event batch without uploading the game document", async () => {
    const request = vi.fn<typeof fetch>(async () =>
      Response.json({ accepted: 1 }),
    );
    const owner = randomUUID(),
      event = client();
    await new HttpAnalyticsTransport(
      async () => "verified-token",
      request,
    ).send(owner, [event]);
    expect(request.mock.calls[0]).toMatchObject([
      "/api/analytics",
      {
        method: "POST",
        cache: "no-store",
        headers: { Authorization: "Bearer verified-token" },
      },
    ]);
    expect(JSON.parse(String(request.mock.calls[0][1]!.body))).toEqual({
      anonymousId: owner,
      events: [event],
    });
  });
  it("does not acknowledge HTTP errors or malformed acknowledgements", async () => {
    for (const response of [
      Response.json({ accepted: 999 }),
      Response.json({ accepted: 1 }, { status: 503 }),
    ])
      await expect(
        new HttpAnalyticsTransport(
          async () => "token",
          vi.fn(async () => response),
        ).send(randomUUID(), [client()]),
      ).rejects.toThrow();
  });
});

describe("conversion and retention reports", () => {
  function record(
    name: AnalyticsEvent["name"],
    ownerId: string,
    sessionId: string | null = null,
    options: Partial<AnalyticsEvent> = {},
  ): AnalyticsRecord {
    return {
      ownerId,
      event: {
        id: randomUUID(),
        name,
        visitId: randomUUID(),
        anonymousId: ownerId,
        timeZone: "Asia/Seoul",
        occurredAt: now.toISOString(),
        localDate: "2026-10-07",
        sessionId,
        recommendationRunId: null,
        missionId: sessionId ? "photo-time" : null,
        dedupeKey: randomUUID(),
        source: name.startsWith("mission_") ? "game" : "client",
        properties: {},
        ...options,
      },
    };
  }
  it("uses distinct shown/accepted/completed cohorts and rejects unshown session claims", () => {
    const owner = randomUUID(),
      a = randomUUID(),
      b = randomUUID(),
      c = randomUUID(),
      orphan = randomUUID();
    const records = [
      record("mission_shown", owner, a),
      record("mission_shown", owner, b),
      record("mission_shown", owner, c),
      record("mission_accepted", owner, a),
      record("mission_started", owner, a),
      record("mission_accepted", owner, b),
      record("mission_completed", owner, a),
      record("mission_accepted", owner, orphan),
      record("mission_completed", owner, orphan),
    ];
    const report = analyticsReport([...records, ...records], now);
    expect(report.funnel).toMatchObject({
      shown: 3,
      accepted: 2,
      started: 1,
      completed: 1,
      recommendationToAcceptedRate: 2 / 3,
      acceptedToCompletedRate: 1 / 2,
    });
  });
  it("counts rerolls per user and recommendation run separately from failed requests", () => {
    const owner = randomUUID(),
      run = randomUUID();
    const records = [0, 1, 2].map((index) =>
      record("mission_shown", owner, randomUUID(), {
        recommendationRunId: run,
        properties: { rerollIndex: index },
      }),
    );
    for (let i = 0; i < 4; i++)
      records.push(record("mission_requested", owner));
    expect(analyticsReport(records, now).rerolls).toEqual({
      total: 2,
      perUser: [
        {
          ownerId: owner,
          recommendations: 3,
          requests: 4,
          rerolls: 2,
          runs: 1,
          meanRerollsPerRun: 2,
        },
      ],
    });
  });
  it("uses local calendar D1, excludes immature cohorts, and stitches identities by owner", () => {
    const a = randomUUID(),
      b = randomUUID(),
      c = randomUUID(),
      legacy = randomUUID();
    const visit = (owner: string, stamp: string, anon = owner) =>
      record("visit_started", owner, null, {
        occurredAt: stamp,
        localDate: localDateAt(stamp, "Asia/Seoul"),
        anonymousId: anon,
      });
    const report = analyticsReport(
      [
        visit(a, "2026-10-05T14:59:00Z", legacy),
        visit(a, "2026-10-05T15:01:00Z"),
        visit(b, "2026-10-05T01:00:00Z"),
        visit(c, "2026-10-06T01:00:00Z"),
      ],
      now,
    );
    expect(report.retention).toEqual({
      eligibleUsers: 2,
      returnedUsers: 1,
      pendingUsers: 1,
      d1Rate: 0.5,
    });
    expect(report.visits.visitors).toBe(3);
  });
  it("separates successful native share from copied text and counts a completed mission once", () => {
    const owner = randomUUID(),
      id = randomUUID();
    const records = [
      record("mission_shown", owner, id),
      record("mission_accepted", owner, id),
      record("mission_completed", owner, id),
      record("mission_share_requested", owner, id, {
        properties: { channel: "native" },
      }),
      record("mission_shared", owner, id, {
        properties: { channel: "native" },
      }),
      record("mission_shared", owner, id, {
        properties: { channel: "native" },
      }),
      record("mission_shared", owner, id, {
        properties: { channel: "clipboard" },
      }),
    ];
    expect(analyticsReport(records, now).sharing).toEqual({
      attemptedCompletedMissions: 1,
      successfulActions: 1,
      nativeShares: 1,
      copiedLinks: 1,
      successfulActionRate: 1,
      nativeShareRate: 1,
      clipboardCopyRate: 1,
    });
  });
  it("represents missing denominators as null rather than measured zero conversion", () => {
    const report = analyticsReport([], now);
    expect(report.funnel.recommendationToAcceptedRate).toBeNull();
    expect(report.retention.d1Rate).toBeNull();
    expect(report.sharing.successfulActionRate).toBeNull();
  });
});
