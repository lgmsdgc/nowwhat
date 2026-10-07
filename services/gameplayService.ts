import { z } from "zod";
import {
  completionDraftSchema,
  completionInputSchema,
  onboardingSchema,
  rejectionReasonSchema,
} from "@/lib/validation/models";
import { totalExp } from "@/lib/progression/experience";
import { isEligible, selectMission } from "@/services/recommendationService";
import type {
  CompletionDraft,
  Feedback,
  LocalState,
  Mission,
  MissionSession,
  RejectionReason,
} from "@/types/game";
import type { OnboardingAnswers } from "@/types/recommendation";
import type { AnalyticsContext } from "@/types/analytics";

export class GameError extends Error {}
export const emptyCompletionDraft: CompletionDraft = {
  costText: "",
  rating: null,
  wouldDoAgain: null,
  comment: "",
};

export interface GameEnvironment {
  now: Date;
  id: () => string;
  random: () => number;
  missions: readonly Mission[];
  localHour?: number;
  analyticsContext?: AnalyticsContext;
}
export type GameCommand =
  | { type: "answer"; key: keyof OnboardingAnswers; value: unknown }
  | { type: "step"; step: number }
  | { type: "request"; answers?: OnboardingAnswers }
  | { type: "reroll"; sessionId: string; reason: RejectionReason | null }
  | { type: "discard"; sessionId: string }
  | { type: "start"; sessionId: string }
  | { type: "check"; sessionId: string; index: number; checked: boolean }
  | {
      type: "completionDraft";
      sessionId: string;
      patch: Partial<CompletionDraft>;
    }
  | { type: "complete"; sessionId: string; input: unknown }
  | { type: "abandon"; sessionId: string };

export function activeSession(state: LocalState) {
  return state.sessions.find(
    (s) => s.status === "recommended" || s.status === "started",
  );
}
export function sessionPath(session: MissionSession): string {
  const route =
    session.status === "completed"
      ? "complete"
      : session.status === "started"
        ? "play"
        : "mission";
  return `/${route}/${session.id}`;
}
export function createInitialState(id: string, now: Date): LocalState {
  return {
    version: 1,
    anonymousId: id,
    createdAt: now.toISOString(),
    onboarding: { answers: {}, step: 0 },
    sessions: [],
    feedback: [],
    analyticsEvents: [],
  };
}

/** Returns a new complete document; the repository commits it with one setItem. */
export function transition(
  current: LocalState,
  command: GameCommand,
  env: GameEnvironment,
): { state: LocalState; sessionId?: string } {
  const state = structuredClone(current);
  const timestamp = env.now.toISOString();
  const feedback = (
    session: MissionSession,
    action: Feedback["action"],
    reason: RejectionReason | null = null,
  ) => {
    state.feedback.push({
      id: env.id(),
      anonymousId: state.anonymousId,
      sessionId: session.id,
      missionId: session.mission.id,
      action,
      reason,
      createdAt: timestamp,
    });
  };
  const createSession = (
    mission: Mission,
    answers: OnboardingAnswers,
    runId: string,
    rerollIndex: number,
  ) => {
    const session: MissionSession = {
      id: env.id(),
      anonymousId: state.anonymousId,
      mission: structuredClone(mission),
      answers,
      recommendationRunId: runId,
      rerollIndex,
      status: "recommended",
      shownAt: timestamp,
      acceptedAt: null,
      startedAt: null,
      completedAt: null,
      abandonedAt: null,
      checkedSteps: [],
      completionDraft: { ...emptyCompletionDraft },
      result: null,
    };
    state.sessions.push(session);
    feedback(session, "shown");
    return { state, sessionId: session.id };
  };

  if (command.type === "answer") {
    const patch = onboardingSchema
      .partial()
      .parse({ [command.key]: command.value });
    state.onboarding.answers = { ...state.onboarding.answers, ...patch };
    return { state };
  }
  if (command.type === "step") {
    state.onboarding.step = z.number().int().min(0).max(5).parse(command.step);
    return { state };
  }
  if (command.type === "request") {
    const active = activeSession(state);
    if (active) return { state, sessionId: active.id };
    const parsed = onboardingSchema.safeParse(
      command.answers ?? state.onboarding.answers,
    );
    if (!parsed.success)
      throw new GameError("여섯 가지 질문에 모두 답해주세요.");
    const mission = selectMission(
      env.missions,
      parsed.data,
      state.sessions,
      env.localHour ?? env.now.getHours(),
      env.random,
      { feedback: state.feedback },
    );
    if (!mission)
      throw new GameError(
        "지금 조건에 맞는 미션이 없어요. 조건을 조금 바꿔볼까요?",
      );
    state.onboarding.answers = parsed.data;
    return createSession(mission, parsed.data, env.id(), 0);
  }

  const session = state.sessions.find((s) => s.id === command.sessionId);
  if (!session)
    throw new GameError("이 브라우저에서 해당 미션 기록을 찾지 못했어요.");
  if (command.type === "reroll") {
    // A retry of the same rejection returns its successor instead of adding another reroll.
    if (session.status === "rejected") {
      const next = state.sessions.find(
        (s) =>
          s.recommendationRunId === session.recommendationRunId &&
          s.rerollIndex === session.rerollIndex + 1,
      );
      if (next) return { state, sessionId: next.id };
    }
    if (session.status !== "recommended")
      throw new GameError("현재 미션 상태를 확인한 뒤 다시 시도해주세요.");
    const reason = rejectionReasonSchema.nullable().parse(command.reason);
    const next = selectMission(
      env.missions,
      session.answers,
      state.sessions,
      env.localHour ?? env.now.getHours(),
      env.random,
      { currentId: session.mission.id, feedback: state.feedback },
    );
    if (!next)
      throw new GameError(
        "같은 조건으로 다른 미션이 없어요. 현재 미션을 하거나 조건을 바꿔주세요.",
      );
    session.status = "rejected";
    feedback(session, "rejected", reason);
    return createSession(
      next,
      session.answers,
      session.recommendationRunId,
      session.rerollIndex + 1,
    );
  }
  if (command.type === "discard") {
    if (session.status !== "recommended")
      throw new GameError("진행 중인 미션은 플레이 화면에서 마무리해주세요.");
    session.status = "rejected";
    feedback(session, "rejected");
    state.onboarding.step = 0;
  } else if (command.type === "start") {
    if (session.status === "started" || session.status === "completed")
      return { state, sessionId: session.id };
    if (session.status !== "recommended")
      throw new GameError("종료된 미션은 다시 시작할 수 없어요.");
    const liveTemplate = env.missions.find((m) => m.id === session.mission.id);
    if (
      !liveTemplate ||
      !isEligible(
        liveTemplate,
        session.answers,
        env.localHour ?? env.now.getHours(),
      )
    )
      throw new GameError(
        "시간대나 미션 조건이 바뀌었어요. 다른 미션을 골라주세요.",
      );
    session.status = "started";
    session.acceptedAt = timestamp;
    session.startedAt = timestamp;
    feedback(session, "accepted");
  } else if (command.type === "check") {
    if (session.status !== "started")
      throw new GameError("진행 중인 미션에서만 체크할 수 있어요.");
    const index = z
      .number()
      .int()
      .min(0)
      .max(session.mission.steps.length - 1)
      .parse(command.index);
    session.checkedSteps = command.checked
      ? [...new Set([...session.checkedSteps, index])]
      : session.checkedSteps.filter((i) => i !== index);
  } else if (command.type === "completionDraft") {
    if (session.status !== "started")
      throw new GameError("이미 종료된 미션이에요. 결과를 확인해주세요.");
    const patch = completionDraftSchema.partial().parse(command.patch);
    session.completionDraft = { ...session.completionDraft, ...patch };
  } else if (command.type === "complete") {
    if (session.status === "completed") return { state, sessionId: session.id };
    if (session.status !== "started" || !session.startedAt)
      throw new GameError("먼저 미션을 시작해주세요.");
    const parsed = completionInputSchema.safeParse(command.input);
    if (!parsed.success)
      throw new GameError(
        "금액은 0~10,000,000원의 정수, 평가는 1~5점, 코멘트는 140자 이내로 적어주세요.",
      );
    if (session.checkedSteps.length !== session.mission.steps.length)
      throw new GameError("미션 체크리스트를 모두 확인해주세요.");
    const expBefore = totalExp(state);
    session.result = {
      ...parsed.data,
      actualDurationSeconds: Math.max(
        0,
        Math.floor((env.now.getTime() - Date.parse(session.startedAt)) / 1000),
      ),
      awardedExp: session.mission.baseExp,
      expBefore,
      expAfter: expBefore + session.mission.baseExp,
    };
    session.status = "completed";
    session.completedAt = timestamp;
    feedback(session, "completed");
    if (parsed.data.wouldDoAgain !== null)
      feedback(session, parsed.data.wouldDoAgain ? "liked" : "disliked");
  } else if (command.type === "abandon") {
    if (session.status === "abandoned") return { state, sessionId: session.id };
    if (session.status !== "started")
      throw new GameError("진행 중인 미션만 그만둘 수 있어요.");
    session.status = "abandoned";
    session.abandonedAt = timestamp;
    feedback(session, "abandoned");
  }
  return { state, sessionId: session.id };
}

export function completionFromDraft(draft: CompletionDraft) {
  const trimmed = draft.costText.trim();
  if (trimmed && !/^\d+$/.test(trimmed))
    throw new GameError(
      "사용한 금액은 숫자로만 입력해주세요. 미입력과 0원은 따로 기록돼요.",
    );
  const parsed = completionInputSchema.safeParse({
    actualCost: trimmed === "" ? null : Number(trimmed),
    rating: draft.rating,
    wouldDoAgain: draft.wouldDoAgain,
    comment: draft.comment,
  });
  if (!parsed.success)
    throw new GameError(
      "금액은 0~10,000,000원, 코멘트는 140자 이내로 적어주세요.",
    );
  return parsed.data;
}
