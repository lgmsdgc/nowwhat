import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { missions } from "@/seed/missions";
import {
  createInitialState,
  transition,
  completionFromDraft,
  type GameCommand,
  type GameEnvironment,
} from "@/services/gameplayService";
import { isEligible, selectMission } from "@/services/recommendationService";
import { levelFor, totalExp } from "@/lib/progression/experience";
import { localStateSchema } from "@/lib/validation/models";
import type { OnboardingAnswers } from "@/types/recommendation";
import type { LocalState } from "@/types/game";

const answers: OnboardingAnswers = {
  relationship: "solo",
  durationMinutes: 15,
  budgetPerPerson: 0,
  travelScope: "home",
  energy: 1,
  intensity: "random",
};
const env = (): GameEnvironment => ({
  now: new Date(2026, 9, 6, 12),
  id: randomUUID,
  random: () => 0,
  missions,
});
function ready() {
  const state = createInitialState(randomUUID(), env().now);
  state.onboarding.answers = answers;
  return state;
}
function apply(state: LocalState, command: GameCommand, custom = env()) {
  return transition(state, command, custom);
}
function started() {
  const requested = apply(ready(), { type: "request" });
  const id = requested.sessionId!;
  const started = apply(requested.state, { type: "start", sessionId: id });
  return { state: started.state, id };
}
function checked() {
  const current = started();
  for (let i = 0; i < current.state.sessions[0].mission.steps.length; i++)
    current.state = apply(current.state, {
      type: "check",
      sessionId: current.id,
      index: i,
      checked: true,
    }).state;
  return current;
}
const input = {
  actualCost: null,
  rating: null,
  wouldDoAgain: null,
  comment: "",
};

describe("core gameplay", () => {
  it("requires all six answers and accepts explicit zero/unlimited values", () => {
    expect(() =>
      apply(createInitialState(randomUUID(), env().now), { type: "request" }),
    ).toThrow("여섯");
    const state = ready();
    state.onboarding.answers = {
      ...answers,
      durationMinutes: null,
      budgetPerPerson: null,
    };
    expect(apply(state, { type: "request" }).state.sessions).toHaveLength(1);
  });
  it("does not mutate the source, snapshots the template, and logs shown once", () => {
    const source = ready();
    const result = apply(source, { type: "request" });
    expect(source.sessions).toHaveLength(0);
    expect(result.state.sessions[0].mission).not.toBe(missions[0]);
    const retry = apply(result.state, { type: "request" });
    expect(retry.sessionId).toBe(result.sessionId);
    expect(retry.state.feedback.map((f) => f.action)).toEqual(["shown"]);
    expect(localStateSchema.safeParse(retry.state).success).toBe(true);
  });
  it("rerolls atomically, records the optional reason, and deduplicates retry", () => {
    const first = apply(ready(), { type: "request" });
    const command = {
      type: "reroll",
      sessionId: first.sessionId!,
      reason: "not_fun",
    } as const;
    const next = apply(first.state, command);
    expect(next.state.sessions[0].status).toBe("rejected");
    expect(next.state.sessions[1].mission.id).not.toBe(
      next.state.sessions[0].mission.id,
    );
    expect(next.state.sessions[1].rerollIndex).toBe(1);
    expect(
      next.state.feedback.find((f) => f.action === "rejected")?.reason,
    ).toBe("not_fun");
    expect(apply(next.state, command).state.sessions).toHaveLength(2);
  });
  it("keeps the current recommendation when no other candidate exists", () => {
    const environment = { ...env(), missions: [missions[0]] };
    const first = apply(ready(), { type: "request" }, environment);
    expect(() =>
      apply(
        first.state,
        { type: "reroll", sessionId: first.sessionId!, reason: null },
        environment,
      ),
    ).toThrow("다른 미션");
    expect(first.state.sessions[0].status).toBe("recommended");
    expect(first.state.feedback).toHaveLength(1);
  });
  it("preserves the start time when start is retried", () => {
    const current = started();
    const later = { ...env(), now: new Date(2026, 9, 6, 13) };
    const retried = apply(
      current.state,
      { type: "start", sessionId: current.id },
      later,
    );
    expect(retried.state.sessions[0].startedAt).toBe(
      current.state.sessions[0].startedAt,
    );
    expect(
      retried.state.feedback.filter((f) => f.action === "accepted"),
    ).toHaveLength(1);
  });
  it("requires started state and all checklist steps for completion", () => {
    const requested = apply(ready(), { type: "request" });
    expect(() =>
      apply(requested.state, {
        type: "complete",
        sessionId: requested.sessionId!,
        input,
      }),
    ).toThrow("먼저");
    const current = started();
    expect(() =>
      apply(current.state, { type: "complete", sessionId: current.id, input }),
    ).toThrow("체크리스트");
    expect(() =>
      apply(current.state, {
        type: "check",
        sessionId: current.id,
        index: 99,
        checked: true,
      }),
    ).toThrow();
  });
  it("commits actual time, result and one reward; retries do not double EXP", () => {
    const current = checked();
    const later = { ...env(), now: new Date(2026, 9, 6, 12, 52) };
    const command = {
      type: "complete",
      sessionId: current.id,
      input: {
        ...input,
        actualCost: 0,
        rating: 5,
        wouldDoAgain: true,
        comment: " 생각보다 재밌었음 ",
      },
    } as const;
    const completed = apply(current.state, command, later);
    expect(completed.state.sessions[0].result).toMatchObject({
      actualCost: 0,
      actualDurationSeconds: 3120,
      awardedExp: 100,
      expBefore: 0,
      expAfter: 100,
      comment: "생각보다 재밌었음",
    });
    const retried = apply(completed.state, command, later);
    expect(totalExp(retried.state)).toBe(100);
    expect(
      retried.state.feedback.filter((f) => f.action === "completed"),
    ).toHaveLength(1);
    expect(
      retried.state.feedback.filter((f) => f.action === "liked"),
    ).toHaveLength(1);
    expect(localStateSchema.safeParse(completed.state).success).toBe(true);
  });
  it("allows skipped optional fields, records dislikes, and clamps reversed clock duration", () => {
    const current = checked();
    const completed = apply(
      current.state,
      {
        type: "complete",
        sessionId: current.id,
        input: { ...input, wouldDoAgain: false },
      },
      { ...env(), now: new Date(2026, 9, 6, 11) },
    );
    expect(completed.state.sessions[0].result).toMatchObject({
      actualCost: null,
      rating: null,
      actualDurationSeconds: 0,
    });
    expect(completed.state.feedback.at(-1)?.action).toBe("disliked");
  });
  it.each([-1, 0.5, 10000001, NaN])(
    "rejects invalid cost %s without completing",
    (cost) => {
      const current = checked();
      expect(() =>
        apply(current.state, {
          type: "complete",
          sessionId: current.id,
          input: { ...input, actualCost: cost },
        }),
      ).toThrow();
      expect(totalExp(current.state)).toBe(0);
    },
  );
  it("validates rating, comment and text amount without coercing nonsense to zero", () => {
    const current = checked();
    for (const patch of [{ rating: 6 }, { comment: "가".repeat(141) }])
      expect(() =>
        apply(current.state, {
          type: "complete",
          sessionId: current.id,
          input: { ...input, ...patch },
        }),
      ).toThrow();
    expect(
      completionFromDraft({
        costText: "",
        rating: null,
        wouldDoAgain: null,
        comment: "",
      }).actualCost,
    ).toBeNull();
    expect(
      completionFromDraft({
        costText: "0",
        rating: null,
        wouldDoAgain: null,
        comment: "",
      }).actualCost,
    ).toBe(0);
    for (const costText of ["-1", "1.5", "abc", "1e3", "1,000"])
      expect(() =>
        completionFromDraft({
          costText,
          rating: null,
          wouldDoAgain: null,
          comment: "",
        }),
      ).toThrow();
  });
  it("persists completion drafts and abandons without rewards", () => {
    const current = started();
    const draft = apply(current.state, {
      type: "completionDraft",
      sessionId: current.id,
      patch: { comment: "저장할 메모" },
    });
    expect(draft.state.sessions[0].completionDraft.comment).toBe("저장할 메모");
    const abandoned = apply(draft.state, {
      type: "abandon",
      sessionId: current.id,
    });
    expect(abandoned.state.sessions[0].status).toBe("abandoned");
    expect(totalExp(abandoned.state)).toBe(0);
    expect(() =>
      apply(abandoned.state, {
        type: "complete",
        sessionId: current.id,
        input,
      }),
    ).toThrow();
  });
  it("uses completed mission answers for another request and crosses the level boundary", () => {
    let current = checked();
    for (let i = 0; i < 3; i++) {
      current.state = apply(current.state, {
        type: "complete",
        sessionId: current.id,
        input,
      }).state;
      if (i === 2) break;
      const next = apply(current.state, { type: "request", answers });
      current = { state: next.state, id: next.sessionId! };
      current.state = apply(current.state, {
        type: "start",
        sessionId: current.id,
      }).state;
      for (
        let index = 0;
        index < current.state.sessions.at(-1)!.mission.steps.length;
        index++
      )
        current.state = apply(current.state, {
          type: "check",
          sessionId: current.id,
          index,
          checked: true,
        }).state;
    }
    expect(totalExp(current.state)).toBe(300);
    expect(levelFor(totalExp(current.state))).toBe(2);
    expect(current.state.sessions.at(-1)?.result).toMatchObject({
      expBefore: 200,
      expAfter: 300,
    });
  });
});

describe("mock mission feasibility", () => {
  it("keeps a safe alternative for the strictest constraints for all relationships", () => {
    for (const relationship of [
      "solo",
      "friend",
      "couple",
      "family",
    ] as const) {
      for (const intensity of [
        "relaxed",
        "random",
        "adventure",
        "yolo",
      ] as const) {
        const selected = selectMission(
          missions,
          { ...answers, relationship, intensity },
          [],
          23,
          () => 0,
        );
        expect(selected).toBeDefined();
        expect(selected!.maxBudget).toBe(0);
        expect(selected!.maxDuration).toBeLessThanOrEqual(15);
        expect(selected!.travelScope).toBe("home");
        expect(selected!.energyLevel).toBe(1);
        expect(selected!.nightSafe && selected!.minorSafe).toBe(true);
      }
    }
  });
  it("never relaxes safety, energy, budget or duration", () => {
    for (const patch of [
      { requiresCar: true },
      { alcoholRelated: true },
      { physicalRiskLevel: 1 },
      { minorSafe: false },
      { soloSafe: false },
      { nightSafe: false },
      { maxBudget: 1 },
      { maxDuration: 16 },
      { energyLevel: 2 as const },
      { minPeople: 2 },
    ]) {
      expect(isEligible({ ...missions[0], ...patch }, answers, 23)).toBe(false);
    }
    expect(
      isEligible(
        { ...missions[0], intensity: 4 },
        { ...answers, intensity: "relaxed" },
        12,
      ),
    ).toBe(false);
  });
  it("distinguishes home from an indoor outing and rechecks safety at start", () => {
    expect(
      isEligible({ ...missions[0], travelScope: "nearby" }, answers, 12),
    ).toBe(false);
    const walk = missions.find((m) => m.id === "nearby-walk")!;
    const environment = { ...env(), missions: [walk] };
    const state = ready();
    state.onboarding.answers = {
      ...answers,
      travelScope: "nearby",
      durationMinutes: 30,
      energy: 2,
    };
    const requested = apply(state, { type: "request" }, environment);
    expect(() =>
      apply(
        requested.state,
        { type: "start", sessionId: requested.sessionId! },
        { ...environment, now: new Date(2026, 9, 6, 23) },
      ),
    ).toThrow("시간대");
  });
});
