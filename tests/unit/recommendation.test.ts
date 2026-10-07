import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { missions } from "@/seed/missions";
import { recommendationPolicy as policy } from "@/lib/recommendation/policy";
import { categoryPreferences } from "@/lib/recommendation/preferences";
import { createInitialState, transition } from "@/services/gameplayService";
import {
  buildRecommendationPool,
  isEligible,
  pickWeightedCandidate,
  selectMission,
  type WeightedCandidate,
} from "@/services/recommendationService";
import type { Feedback, Mission, MissionSession } from "@/types/game";
import type { OnboardingAnswers } from "@/types/recommendation";

const answers: OnboardingAnswers = {
  relationship: "solo",
  durationMinutes: 15,
  budgetPerPerson: 0,
  travelScope: "home",
  energy: 1,
  intensity: "random",
};
const anonymousId = randomUUID();
const template = (id: string, patch: Partial<Mission> = {}): Mission => ({
  ...missions[0],
  id,
  ...patch,
});
function session(
  mission: Mission,
  index = 0,
  patch: Partial<MissionSession> = {},
): MissionSession {
  return {
    id: randomUUID(),
    anonymousId,
    mission,
    answers,
    recommendationRunId: randomUUID(),
    rerollIndex: 0,
    status: "recommended",
    shownAt: new Date(2026, 9, 6, 12, 0, index).toISOString(),
    acceptedAt: null,
    startedAt: null,
    completedAt: null,
    abandonedAt: null,
    checkedSteps: [],
    completionDraft: {
      costText: "",
      rating: null,
      wouldDoAgain: null,
      comment: "",
    },
    result: null,
    ...patch,
  };
}
function completed(
  mission: Mission,
  vote: boolean | null,
  index = 0,
  rating: number | null = null,
): MissionSession {
  const snapshot = session(mission, index);
  return {
    ...snapshot,
    status: "completed",
    acceptedAt: snapshot.shownAt,
    startedAt: snapshot.shownAt,
    completedAt: snapshot.shownAt,
    checkedSteps: mission.steps.map((_, i) => i),
    result: {
      actualCost: null,
      rating,
      wouldDoAgain: vote,
      comment: "",
      actualDurationSeconds: 0,
      awardedExp: 100,
      expBefore: 0,
      expAfter: 100,
    },
  };
}
function feedbackFor(
  s: MissionSession,
  action: Feedback["action"],
  index = 0,
): Feedback {
  return {
    id: randomUUID(),
    anonymousId: s.anonymousId,
    sessionId: s.id,
    missionId: s.mission.id,
    action,
    reason: null,
    createdAt: new Date(2026, 9, 6, 12, 1, index).toISOString(),
  };
}
const weighted = (id: string, weight: number): WeightedCandidate => ({
  mission: template(id),
  weight,
  factors: { novelty: 1, category: 1, intensity: 1 },
});

describe("hard recommendation constraints", () => {
  it.each([
    { active: false },
    { minorSafe: false },
    { alcoholRelated: true },
    { requiresCar: true },
    { physicalRiskLevel: 1 },
    { soloSafe: false },
    { nightSafe: false },
    { maxBudget: 1 },
    { maxDuration: 16 },
    { energyLevel: 2 as const },
    { physicalIntensity: 2 as const },
    { minPeople: 2 },
    { travelScope: "nearby" as const },
    { indoor: false },
    { allowedRelationships: ["couple"] as Mission["allowedRelationships"] },
  ])("filters incompatible metadata %j even at YOLO intensity", (patch) => {
    expect(
      isEligible(
        template("unsafe", patch),
        { ...answers, intensity: "yolo" },
        23,
      ),
    ).toBe(false);
  });
  it("applies night safety at 23:00 and before 06:00, without relying on indoor", () => {
    const outing = template("day-only", { nightSafe: false });
    for (const hour of [23, 0, 5])
      expect(isEligible(outing, answers, hour)).toBe(false);
    for (const hour of [6, 12, 22])
      expect(isEligible(outing, answers, hour)).toBe(true);
  });
  it("validates inputs and fails closed when time is unknown", () => {
    for (const hour of [-1, 24, 1.5, NaN, Infinity])
      expect(isEligible(missions[0], answers, hour)).toBe(false);
    expect(
      isEligible(
        missions[0],
        { ...answers, energy: 0 } as unknown as OnboardingAnswers,
        12,
      ),
    ).toBe(false);
  });
  it("keeps family safety, group size and travel constraints", () => {
    const family = { ...answers, relationship: "family" as const };
    expect(
      isEligible(template("family-unsafe", { familySafe: false }), family, 12),
    ).toBe(false);
    expect(isEligible(template("two-only", { maxPeople: 2 }), family, 12)).toBe(
      false,
    );
    expect(
      isEligible(
        template("group", { minPeople: 2, maxPeople: null }),
        family,
        12,
      ),
    ).toBe(true);
    expect(
      isEligible(
        template("far", { travelScope: "far" }),
        { ...answers, travelScope: "nearby" },
        12,
      ),
    ).toBe(false);
    expect(
      isEligible(
        template("mild", { intensity: 2 }),
        { ...answers, intensity: "relaxed" },
        12,
      ),
    ).toBe(false);
  });
});

describe("recent exposure exclusion", () => {
  const candidates = Array.from({ length: 7 }, (_, index) =>
    template(`mission-${index}`),
  );
  it("excludes the five most recently shown distinct IDs, including equal timestamps", () => {
    const history = candidates.slice(0, 6).map((mission) => session(mission));
    const result = buildRecommendationPool(candidates, answers, history, 12);
    expect(result.candidates.map((entry) => entry.mission.id)).toEqual([
      "mission-0",
      "mission-6",
    ]);
    expect(result.recentExclusionsRelaxed).toBe(false);
  });
  it("uses shown time instead of caller order, and a repeated exposure remains recent", () => {
    const history = candidates
      .slice(0, 6)
      .map((mission, index) => session(mission, index));
    history.push(session(candidates[0], 10));
    const result = buildRecommendationPool(
      candidates,
      answers,
      history.toReversed(),
      12,
    );
    expect(result.candidates.map((entry) => entry.mission.id)).toEqual([
      "mission-1",
      "mission-6",
    ]);
  });
  it("releases only the oldest eligible recent exposure when every candidate was shown", () => {
    const history = candidates
      .slice(0, 5)
      .map((mission, index) => session(mission, index));
    const result = buildRecommendationPool(
      candidates.slice(0, 5),
      answers,
      history,
      12,
      { currentId: "mission-4" },
    );
    expect(result.candidates.map((entry) => entry.mission.id)).toEqual([
      "mission-0",
    ]);
    expect(result.recentExclusionsRelaxed).toBe(true);
  });
  it("never restores the current mission or an unsafe/over-budget candidate", () => {
    const current = template("current");
    const unsafe = template("unsafe", { nightSafe: false });
    const costly = template("costly", { maxBudget: 10000 });
    const result = buildRecommendationPool(
      [current, unsafe, costly],
      answers,
      [session(current), session(unsafe), session(costly)],
      23,
      { currentId: current.id },
    );
    expect(result.eligibleCount).toBe(0);
    expect(result.candidates).toEqual([]);
    expect(result.recentExclusionsRelaxed).toBe(false);
  });
});

describe("recommendation weights and preferences", () => {
  it("gives an uncompleted mission 1.8 times the novelty weight of a completed one", () => {
    const done = template("done");
    const fresh = template("fresh");
    const history = [
      completed(done, null),
      ...Array.from({ length: 5 }, (_, index) =>
        session(template(`other-${index}`), index + 1),
      ),
    ];
    const result = buildRecommendationPool([done, fresh], answers, history, 12);
    expect(result.candidates.map((entry) => entry.factors.novelty)).toEqual([
      1, 1.8,
    ]);
    expect(
      result.candidates[1].weight / result.candidates[0].weight,
    ).toBeCloseTo(1.8);
  });
  it("boosts liked categories and reduces disliked ones without excluding them", () => {
    const liked = completed(template("liked", { category: "food" }), true);
    const disliked = completed(
      template("disliked", { category: "walk" }),
      false,
    );
    const result = buildRecommendationPool(
      [
        template("new-food", { category: "food" }),
        template("new-walk", { category: "walk" }),
        template("neutral", { category: "game" }),
      ],
      answers,
      [liked, disliked],
      12,
    );
    expect(result.candidates.map((entry) => entry.factors.category)).toEqual([
      1.1, 0.9, 1,
    ]);
    expect(result.candidates.every((entry) => entry.weight > 0)).toBe(true);
  });
  it("counts duplicate feedback once and lets the latest explicit preference win over stars", () => {
    const rated = completed(
      template("rated", { category: "food" }),
      true,
      0,
      5,
    );
    const like = feedbackFor(rated, "liked");
    const dislike = feedbackFor(rated, "disliked", 1);
    expect(
      categoryPreferences([rated], [dislike, like, like, like]).get("food"),
    ).toBe(0.9);
    expect(categoryPreferences([rated, rated], [like, like]).get("food")).toBe(
      1.1,
    );
  });
  it("uses stars only without an explicit preference and ignores unrelated or unfinished feedback", () => {
    const high = completed(
      template("high", { category: "creative" }),
      null,
      0,
      4,
    );
    const low = completed(template("low", { category: "game" }), null, 0, 2);
    const neutral = completed(
      template("neutral", { category: "walk" }),
      null,
      0,
      3,
    );
    const pending = session(template("pending", { category: "food" }));
    const foreign = {
      ...feedbackFor(high, "disliked"),
      anonymousId: randomUUID(),
    };
    const unrelated = { ...feedbackFor(low, "liked"), missionId: "different" };
    const prefs = categoryPreferences(
      [high, low, neutral, pending],
      [foreign, unrelated, feedbackFor(pending, "liked")],
    );
    expect(prefs.get("creative")).toBe(1.1);
    expect(prefs.get("game")).toBe(0.9);
    expect(prefs.get("walk")).toBe(1);
    expect(prefs.has("food")).toBe(false);
  });
  it("bounds category influence and considers only the latest 40 completions", () => {
    const liked = Array.from({ length: 8 }, (_, i) =>
      completed(template(`liked-${i}`, { category: "food" }), true, i),
    );
    const disliked = Array.from({ length: 8 }, (_, i) =>
      completed(template(`disliked-${i}`, { category: "game" }), false, i),
    );
    expect(categoryPreferences([...liked, ...disliked], []).get("food")).toBe(
      policy.categoryMax,
    );
    expect(categoryPreferences([...liked, ...disliked], []).get("game")).toBe(
      policy.categoryMin,
    );
    const old = completed(template("old", { category: "photo" }), false);
    const recent = Array.from({ length: 40 }, (_, i) =>
      completed(template(`recent-${i}`, { category: "home" }), null, i + 1),
    );
    expect(categoryPreferences([old, ...recent], []).has("photo")).toBe(false);
  });
  it("prefers nearby intensity while retaining variety; random is neutral", () => {
    const pool = [1, 2, 3, 4].map((intensity, index) =>
      template(`intensity-${index}`, {
        intensity: intensity as Mission["intensity"],
      }),
    );
    const result = buildRecommendationPool(
      pool,
      { ...answers, intensity: "adventure" },
      [],
      12,
    );
    expect(result.candidates).toHaveLength(4);
    expect(result.candidates[2].factors.intensity).toBe(1.5);
    expect(result.candidates[0].factors.intensity).toBeLessThan(
      result.candidates[2].factors.intensity,
    );
    expect(
      buildRecommendationPool(pool, answers, [], 12).candidates.every(
        (entry) => entry.factors.intensity === 1,
      ),
    ).toBe(true);
  });
  it("uses persisted feedback for both a new request and a reroll", () => {
    const previous = completed(
      template("previous-food", { category: "food" }),
      null,
    );
    const food = template("food", { category: "food" });
    const home = template("home", { category: "home" });
    const current = template("current", { category: "creative" });
    const state = createInitialState(anonymousId, new Date(2026, 9, 6, 12));
    state.onboarding.answers = answers;
    state.sessions = [previous];
    state.feedback = [feedbackFor(previous, "disliked")];
    const env = {
      now: new Date(2026, 9, 6, 12, 5),
      id: randomUUID,
      random: () => 0.48,
      missions: [food, home],
    };
    expect(
      selectMission([food, home], answers, [previous], 12, env.random)?.id,
    ).toBe("food");
    expect(
      transition(state, { type: "request" }, env).state.sessions.at(-1)?.mission
        .id,
    ).toBe("home");
    const recommended = session(current, 10);
    state.sessions.push(recommended);
    const reroll = transition(
      state,
      { type: "reroll", sessionId: recommended.id, reason: null },
      { ...env, missions: [food, home, current] },
    );
    expect(reroll.state.sessions.at(-1)?.mission.id).toBe("home");
  });
});

describe("weighted random sampling", () => {
  const candidates = [weighted("a", 1), weighted("b", 2), weighted("c", 1)];
  it.each([
    [0, "a"],
    [0.249999, "a"],
    [0.25, "b"],
    [0.749999, "b"],
    [0.75, "c"],
    [1, "c"],
  ] as const)(
    "draws %s at the correct cumulative boundary",
    (sample, expected) => {
      expect(pickWeightedCandidate(candidates, () => sample)?.id).toBe(
        expected,
      );
    },
  );
  it("produces the 1:2:1 distribution across evenly spaced random samples", () => {
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 400; i++)
      counts[pickWeightedCandidate(candidates, () => (i + 0.5) / 400)!.id]++;
    expect(counts).toEqual({ a: 100, b: 200, c: 100 });
  });
  it("does not call random for an empty pool and rejects broken random/weight sources", () => {
    const random = vi.fn(() => 0);
    expect(pickWeightedCandidate([], random)).toBeUndefined();
    expect(random).not.toHaveBeenCalled();
    for (const sample of [-0.1, 1.1, NaN, Infinity])
      expect(() => pickWeightedCandidate(candidates, () => sample)).toThrow(
        RangeError,
      );
    for (const weight of [0, -1, NaN, Infinity])
      expect(() =>
        pickWeightedCandidate([weighted("bad", weight)], () => 0),
      ).toThrow(RangeError);
    expect(() =>
      pickWeightedCandidate(
        [weighted("large-a", 1e308), weighted("large-b", 1e308)],
        () => 0,
      ),
    ).toThrow(RangeError);
  });
});
