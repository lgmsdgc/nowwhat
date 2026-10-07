import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createInitialState, transition } from "@/services/gameplayService";
import { profileSummary } from "@/services/profileService";
import {
  achievementProgress,
  localProgression,
  evaluateAchievements,
} from "@/services/progressionService";
import {
  experienceForDifficulty,
  levelFor,
} from "@/lib/progression/experience";
import { localStateSchema } from "@/lib/validation/models";
import { achievementSchema } from "@/lib/validation/progression";
import { createMission } from "@/seed/missionFactory";
import { achievements } from "@/seed/achievements";
import type { LocalState, Mission } from "@/types/game";
import type { OnboardingAnswers } from "@/types/recommendation";

const now = new Date("2026-10-07T03:00:00.000Z");
const mission = createMission({
  id: "test-home",
  title: "작은 미션",
  emoji: "🌱",
  category: "home",
  shortDescription: "짧은 설명",
  fullDescription: "실행 가능한 설명",
  steps: ["실행"],
});
const empty = () => createInitialState(randomUUID(), now);
function finish(
  state: LocalState,
  template = mission,
  relationship: OnboardingAnswers["relationship"] = "solo",
  input = {
    actualCost: null as number | null,
    rating: null as number | null,
    wouldDoAgain: null as boolean | null,
    comment: "",
  },
) {
  const env = {
    now: new Date(now.getTime() + state.sessions.length * 60000),
    id: randomUUID,
    random: () => 0,
    localHour: 12,
    missions: [template],
  };
  const requested = transition(
    state,
    {
      type: "request",
      answers: {
        relationship,
        durationMinutes: null,
        budgetPerPerson: null,
        travelScope: "anywhere",
        energy: 4,
        intensity: "yolo",
      },
    },
    env,
  );
  const id = requested.sessionId!;
  let next = transition(
    requested.state,
    { type: "start", sessionId: id },
    env,
  ).state;
  for (let index = 0; index < template.steps.length; index++)
    next = transition(
      next,
      { type: "check", sessionId: id, index, checked: true },
      env,
    ).state;
  return transition(next, { type: "complete", sessionId: id, input }, env)
    .state;
}
describe("progression and player history", () => {
  it("handles level boundaries and the five validated reward tiers", () => {
    expect([0, 299, 300, 599, 600].map(levelFor)).toEqual([1, 1, 2, 2, 3]);
    expect([1, 2, 3, 4, 5].map(experienceForDifficulty)).toEqual([
      100, 120, 140, 160, 180,
    ]);
    for (const value of [0, 6, 1.5, NaN])
      expect(() => experienceForDifficulty(value)).toThrow(RangeError);
    expect(
      createMission({ ...mission, difficulty: 2, baseExp: undefined }).baseExp,
    ).toBe(120);
  });
  it("awards snapshotted EXP, preserving historical rewards and retry idempotency", () => {
    const harder: Mission = { ...mission, difficulty: 2, baseExp: 120 };
    const state = finish(finish(empty(), { ...harder, baseExp: 100 }), harder);
    expect(profileSummary(state).exp).toBe(220);
    const session = state.sessions[1];
    const retry = transition(
      state,
      { type: "complete", sessionId: session.id, input: {} },
      {
        now,
        id: randomUUID,
        random: () => 0,
        missions: [{ ...harder, baseExp: 900 }],
      },
    ).state;
    expect(retry).toEqual(state);
    expect(retry.sessions[0].result!.awardedExp).toBe(100);
  });
  it("keeps old v1 documents readable and reconstructs the original unlock time", () => {
    const state = finish(empty());
    const loaded = localStateSchema.parse(JSON.parse(JSON.stringify(state)));
    const result = localProgression(loaded, achievements);
    expect(result.unlocks).toEqual([
      {
        achievementId: "first-step",
        earnedSessionId: state.sessions[0].id,
        unlockedAt: state.sessions[0].completedAt,
      },
    ]);
    expect(
      localProgression(finish(loaded), achievements).unlocks.find(
        (u) => u.achievementId === "first-step",
      ),
    ).toEqual(result.unlocks[0]);
  });
  it("counts three home completions and uses the threshold session", () => {
    const first = finish(empty()),
      second = finish(first),
      third = finish(second);
    expect(
      evaluateAchievements(second, achievements).find(
        (p) => p.achievement.id === "home-player",
      )?.unlock,
    ).toBeNull();
    expect(
      evaluateAchievements(third, achievements).find(
        (p) => p.achievement.id === "home-player",
      ),
    ).toMatchObject({
      count: 3,
      unlock: { earnedSessionId: third.sessions[2].id },
    });
  });
  it("does not count omitted cost as zero or use estimated budget for zero-cost titles", () => {
    let state = finish(empty());
    for (let i = 0; i < 2; i++)
      state = finish(state, mission, "solo", {
        actualCost: 0,
        rating: null,
        wouldDoAgain: null,
        comment: "",
      });
    expect(
      evaluateAchievements(state, achievements).find(
        (p) => p.achievement.id === "zero-budget",
      ),
    ).toMatchObject({ count: 2, unlock: null });
    state = finish(state, mission, "solo", {
      actualCost: 0,
      rating: null,
      wouldDoAgain: null,
      comment: "",
    });
    expect(
      localProgression(state, achievements).unlocks.some(
        (u) => u.achievementId === "zero-budget",
      ),
    ).toBe(true);
  });
  it("counts actual companions, outdoor status and distinct categories", () => {
    let state = finish(
      empty(),
      { ...mission, outdoor: true, indoor: false, travelScope: "nearby" },
      "family",
    );
    state = finish(state, { ...mission, category: "date" }, "couple");
    for (const category of ["food", "game", "creative"] as const)
      state = finish(state, { ...mission, category }, "friend");
    const ids = localProgression(state, achievements).unlocks.map(
      (u) => u.achievementId,
    );
    expect(ids).toEqual(
      expect.arrayContaining([
        "out-the-door",
        "family-memory",
        "date-rescuer",
        "friend-adventurer",
        "curious-player",
      ]),
    );
    state = finish(state, { ...mission, category: "creative" });
    expect(
      evaluateAchievements(state, achievements).find(
        (p) => p.achievement.id === "curious-player",
      )?.count,
    ).toBe(5);
  });
  it("excludes unfinished and abandoned sessions and skips inactive rules", () => {
    const requested = transition(
      empty(),
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
      { now, id: randomUUID, random: () => 0, missions: [mission] },
    );
    const env = { now, id: randomUUID, random: () => 0, missions: [mission] };
    const started = transition(
      requested.state,
      { type: "start", sessionId: requested.sessionId! },
      env,
    );
    const abandoned = transition(
      started.state,
      { type: "abandon", sessionId: requested.sessionId! },
      env,
    ).state;
    for (const state of [requested.state, started.state, abandoned])
      expect(localProgression(state, achievements).unlocks).toHaveLength(0);
    expect(profileSummary(abandoned)).toMatchObject({
      completedCount: 0,
      exp: 0,
      level: 1,
    });
    expect(
      evaluateAchievements(finish(empty()), [
        { ...achievements[0], active: false },
      ]),
    ).toHaveLength(0);
  });
  it("uses stored DB unlocks instead of presenting client predictions as earned titles", () => {
    const progress = achievementProgress(finish(empty()), {
      achievements: [...achievements],
      unlocks: [],
    });
    expect(progress[0]).toMatchObject({ count: 1, unlock: null });
  });
  it("sorts recent history and respects explicit thumbs without inferring omitted votes", () => {
    let state = finish(empty(), mission, "solo", {
      actualCost: null,
      rating: 5,
      wouldDoAgain: null,
      comment: "neutral",
    });
    state = finish(state, mission, "solo", {
      actualCost: null,
      rating: 1,
      wouldDoAgain: true,
      comment: "like",
    });
    state = finish(state, mission, "solo", {
      actualCost: null,
      rating: 5,
      wouldDoAgain: false,
      comment: "dislike",
    });
    const summary = profileSummary(state);
    expect(summary.completed.map((s) => s.result!.comment)).toEqual([
      "dislike",
      "like",
      "neutral",
    ]);
    expect(summary.liked.map((s) => s.result!.comment)).toEqual(["like"]);
    expect(summary.disliked.map((s) => s.result!.comment)).toEqual(["dislike"]);
    expect(summary).toMatchObject({
      completedCount: 3,
      exp: 300,
      level: 2,
      levelExp: 0,
      nextLevelExp: 300,
    });
  });
  it("does not accept mismatched-owner or mismatched-mission preference feedback", () => {
    const state = finish(empty(), mission, "solo", {
      actualCost: null,
      rating: null,
      wouldDoAgain: true,
      comment: "",
    });
    state.feedback.push({
      ...state.feedback.at(-1)!,
      id: randomUUID(),
      anonymousId: randomUUID(),
      action: "disliked",
      createdAt: "2026-10-08T00:00:00.000Z",
    });
    expect(profileSummary(state).liked).toHaveLength(1);
    expect(profileSummary(state).disliked).toHaveLength(0);
  });
  it("validates an extensible catalog and rejects unsupported rules and filters", () => {
    expect(achievements).toHaveLength(9);
    for (const value of [
      { ...achievements[0], conditionType: "arbitrary_sql" },
      { ...achievements[0], conditionValue: { target: 0, filter: {} } },
      {
        ...achievements[0],
        conditionValue: { target: 1, filter: { zeroCost: "yes" } },
      },
      {
        ...achievements[0],
        conditionValue: { target: 1, filter: { unknown: true } },
      },
    ])
      expect(achievementSchema.safeParse(value).success).toBe(false);
  });
});
