"use client";

import { SaveRecordsPrompt } from "@/features/account/SaveRecordsPrompt";
import { CompletionAchievements } from "@/features/profile/CompletionAchievements";
import { ShareMissionButton } from "@/features/gameplay/ShareMissionButton";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  levelFor,
  totalExp,
  EXP_PER_LEVEL,
} from "@/lib/progression/experience";
import { elapsedLabel, money } from "@/lib/utils/format";
import { dispatch } from "@/lib/storage/browserStore";
import { activeSession, sessionPath } from "@/services/gameplayService";
import {
  SessionGate,
  SessionStatusNotice,
} from "@/features/gameplay/SessionGate";
import { useGameAction } from "@/features/gameplay/useGameAction";
import type { LocalState, MissionSession } from "@/types/game";

export function CompleteScreen({ id }: { id: string }) {
  return (
    <SessionGate id={id}>
      {(session, state) =>
        session.status !== "completed" || !session.result ? (
          <SessionStatusNotice session={session} state={state} />
        ) : (
          <Result key={id} session={session} state={state} />
        )
      }
    </SessionGate>
  );
}

function Result({
  session,
  state,
}: {
  session: MissionSession;
  state: LocalState;
}) {
  const router = useRouter();
  const action = useGameAction();
  const result = session.result!;
  const exp = totalExp(state);
  const level = levelFor(exp);
  const active = activeSession(state);
  const completedCount = state.sessions.filter(
    (s) => s.status === "completed",
  ).length;
  return (
    <section className="animate-enter mx-auto max-w-lg px-5 pt-4 pb-8 text-center">
      <span aria-hidden="true" className="text-4xl">
        {session.mission.emoji}
      </span>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">미션 완료</h1>
      <p className="mt-2 text-sm text-muted">{session.mission.title}</p>
      <div className="mt-6 rounded-3xl border border-line bg-surface p-6 text-left">
        <div className="flex items-center justify-between gap-3">
          <strong className="text-2xl font-bold tracking-tight">
            EXP +{result.awardedExp}
          </strong>
          {levelFor(result.expAfter) > levelFor(result.expBefore) && (
            <span className="text-xs font-semibold">
              LV.{levelFor(result.expBefore)} → LV.{levelFor(result.expAfter)}
            </span>
          )}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-5 border-t border-line pt-5">
          <div>
            <dt className="text-xs text-muted">소요시간</dt>
            <dd className="mt-1.5 text-base font-semibold">
              {elapsedLabel(result.actualDurationSeconds)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">사용한 금액 · 1인</dt>
            <dd className="mt-1.5 text-base font-semibold">
              {result.actualCost === null ? "—" : money(result.actualCost)}
            </dd>
          </div>
          {result.rating !== null && (
            <div>
              <dt className="text-xs text-muted">재미</dt>
              <dd
                className="mt-1.5 text-sm"
                aria-label={`5점 중 ${result.rating}점`}
              >
                {"★".repeat(result.rating)}
              </dd>
            </div>
          )}
          {result.wouldDoAgain !== null && (
            <div>
              <dt className="text-xs text-muted">다시 하고 싶은가?</dt>
              <dd className="mt-1.5 text-sm">
                {result.wouldDoAgain ? "👍 또 할래" : "👎 한 번이면 됐어"}
              </dd>
            </div>
          )}
        </dl>
        {result.comment && (
          <blockquote className="mt-5 border-t border-line pt-4 text-sm leading-6 whitespace-pre-wrap text-muted">
            “{result.comment}”
          </blockquote>
        )}
      </div>
      <div className="mt-5 text-left">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold">LV.{level}</span>
          <span className="text-muted">{exp} EXP</span>
        </div>
        <div
          role="progressbar"
          aria-label="다음 레벨까지 경험치"
          aria-valuemin={0}
          aria-valuemax={EXP_PER_LEVEL}
          aria-valuenow={exp % EXP_PER_LEVEL}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"
        >
          <div
            className="h-full rounded-full bg-foreground"
            style={{
              width: `${((exp % EXP_PER_LEVEL) / EXP_PER_LEVEL) * 100}%`,
            }}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          완료 {completedCount}개 · 다음 레벨까지{" "}
          {EXP_PER_LEVEL - (exp % EXP_PER_LEVEL)} EXP
        </p>
      </div>
      <CompletionAchievements state={state} sessionId={session.id} />
      {action.error && (
        <p role="alert" className="mt-4 text-sm text-red-800">
          {action.error}
        </p>
      )}
      <Button
        disabled={action.pending}
        className="mt-5 w-full"
        onClick={() =>
          void action.run(async () => {
            const next = await dispatch({
              type: "request",
              answers: session.answers,
            });
            const nextSession = next.state.sessions.find(
              (s) => s.id === next.sessionId,
            );
            if (nextSession) router.push(sessionPath(nextSession));
          })
        }
      >
        {action.pending
          ? "고르는 중…"
          : active
            ? "이어갈 미션 보기"
            : "또 뭐하지?"}
        <ArrowRight aria-hidden="true" className="size-4 text-lime" />
      </Button>
      <div className="mt-1 flex justify-center gap-6">
        <button
          className="min-h-11 rounded-lg text-xs text-muted"
          disabled={action.pending}
          onClick={() =>
            void action.run(async () => {
              await dispatch({ type: "step", step: 0 });
              router.push("/onboarding");
            })
          }
        >
          조건 바꾸기
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-lg text-xs text-muted"
        >
          홈으로
        </Link>
      </div>
      <ShareMissionButton session={session} />
      <SaveRecordsPrompt completedCount={completedCount} />
    </section>
  );
}
