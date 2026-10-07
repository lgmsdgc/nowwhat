import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createInitialState, transition } from "@/services/gameplayService";
import { missionSharePayload, shareMission } from "@/services/shareService";
import { missions } from "@/seed/missions";
import type { MissionSession } from "@/types/game";

function completed(): MissionSession {
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
  const sessionId = requested.sessionId!;
  let state = transition(
    requested.state,
    { type: "start", sessionId },
    env,
  ).state;
  for (let index = 0; index < state.sessions[0].mission.steps.length; index++)
    state = transition(
      state,
      { type: "check", sessionId, index, checked: true },
      env,
    ).state;
  return transition(
    state,
    {
      type: "complete",
      sessionId,
      input: {
        actualCost: 13500,
        rating: 5,
        wouldDoAgain: true,
        comment: "private secret comment",
      },
    },
    env,
  ).state.sessions[0];
}
describe("opt-in mission sharing", () => {
  it("shares only title, emoji, EXP and public landing URL, omitting private result details", () => {
    const session = completed(),
      payload = missionSharePayload(session, "https://nowwhat.test");
    const serialized = JSON.stringify(payload);
    expect(payload.url).toBe("https://nowwhat.test/");
    expect(payload.text).toContain(session.mission.title);
    for (const value of [
      session.id,
      session.anonymousId,
      "13500",
      "private secret comment",
      "/complete/",
    ])
      expect(serialized).not.toContain(value);
  });
  it("records intent immediately, successful native share after resolution, and never calls copy", async () => {
    const track = vi.fn(),
      copy = vi.fn(),
      share = vi.fn(async () => {});
    expect(
      await shareMission(
        completed(),
        "https://nowwhat.test",
        { share, copy },
        track,
      ),
    ).toBe("shared");
    expect(track.mock.calls.map(([e]) => e.name)).toEqual([
      "mission_share_requested",
      "mission_shared",
    ]);
    expect(track.mock.calls[1][0].properties.channel).toBe("native");
    expect(copy).not.toHaveBeenCalled();
  });
  it("treats cancellation as an intent, never a completed share", async () => {
    const track = vi.fn();
    const error = new Error("User cancelled");
    error.name = "AbortError";
    expect(
      await shareMission(
        completed(),
        "https://nowwhat.test",
        {
          share: async () => {
            throw error;
          },
        },
        track,
      ),
    ).toBe("cancelled");
    expect(track.mock.calls.map(([e]) => e.name)).toEqual([
      "mission_share_requested",
    ]);
  });
  it("uses clipboard fallback with a separate copied result and channel", async () => {
    const copy = vi.fn<(text: string) => Promise<void>>(async () => {}),
      track = vi.fn();
    expect(
      await shareMission(completed(), "https://nowwhat.test", { copy }, track),
    ).toBe("copied");
    expect(copy.mock.calls[0][0]).toContain("https://nowwhat.test/");
    expect(track.mock.calls[1][0].properties.channel).toBe("clipboard");
  });
  it("records no success when permission or network sharing fails", async () => {
    const track = vi.fn();
    await expect(
      shareMission(
        completed(),
        "https://nowwhat.test",
        {
          copy: async () => {
            throw new Error("denied");
          },
        },
        track,
      ),
    ).rejects.toThrow("공유하지");
    expect(track).toHaveBeenCalledOnce();
  });
  it("does not let a telemetry failure interrupt sharing and rejects unsupported or unfinished shares", async () => {
    const session = completed();
    await expect(
      shareMission(
        session,
        "https://nowwhat.test",
        { copy: async () => {} },
        () => {
          throw new Error("analytics offline");
        },
      ),
    ).resolves.toBe("copied");
    await expect(
      shareMission(session, "https://nowwhat.test", {}, vi.fn()),
    ).rejects.toThrow("지원하지");
    expect(() =>
      missionSharePayload(
        { ...session, status: "started", result: null },
        "https://nowwhat.test",
      ),
    ).toThrow("완료한");
  });
});
