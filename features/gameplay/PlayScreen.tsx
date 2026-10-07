"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock3, Flag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { dispatch } from "@/lib/storage/browserStore";
import { elapsedLabel } from "@/lib/utils/format";
import {
  SessionGate,
  SessionStatusNotice,
} from "@/features/gameplay/SessionGate";
import { CompletionForm } from "@/features/gameplay/CompletionForm";
import { useGameAction } from "@/features/gameplay/useGameAction";
import type { MissionSession } from "@/types/game";

export function PlayScreen({ id }: { id: string }) {
  return (
    <SessionGate id={id}>
      {(session, state) =>
        session.status !== "started" ? (
          <SessionStatusNotice session={session} state={state} />
        ) : (
          <ActivePlay key={id} session={session} />
        )
      }
    </SessionGate>
  );
}
function ActivePlay({ session }: { session: MissionSession }) {
  const router = useRouter();
  const action = useGameAction();
  const [now, setNow] = useState(() => Date.now());
  const [finishing, setFinishing] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = Math.max(
    0,
    Math.floor((now - Date.parse(session.startedAt!)) / 1000),
  );
  const allChecked =
    session.checkedSteps.length === session.mission.steps.length;
  return (
    <section className="animate-enter mx-auto max-w-lg px-5 pt-4 pb-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">내 미션</p>
        <span className="inline-flex items-center gap-2 text-xs font-medium">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-foreground"
          />{" "}
          진행 중
        </span>
      </div>
      <div className="mt-6">
        <span aria-hidden="true" className="text-3xl">
          {session.mission.emoji}
        </span>
        <h1 className="mt-3 text-[26px] leading-snug font-bold tracking-tight">
          {session.mission.title}
        </h1>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-5 text-xs">
        <span className="flex items-center gap-2">
          <Clock3 aria-hidden="true" className="size-4" /> 진행 시간 ·{" "}
          {elapsedLabel(elapsed)}
        </span>
        <span className="text-muted">
          예상 {session.mission.minDuration}~{session.mission.maxDuration}분
        </span>
      </div>
      {!finishing ? (
        <>
          <fieldset disabled={action.pending} className="mt-7">
            <legend className="mb-4 flex w-full items-center justify-between text-sm font-bold">
              <span>체크리스트</span>
              <span className="font-mono text-xs text-muted">
                {session.checkedSteps.length} / {session.mission.steps.length}
              </span>
            </legend>
            <div className="space-y-3">
              {session.mission.steps.map((step, index) => (
                <label key={step} className="relative block cursor-pointer">
                  <input
                    type="checkbox"
                    checked={session.checkedSteps.includes(index)}
                    onChange={(event) =>
                      void action.run(async () => {
                        await dispatch({
                          type: "check",
                          sessionId: session.id,
                          index,
                          checked: event.target.checked,
                        });
                      })
                    }
                    className="peer sr-only"
                  />
                  <span className="flex min-h-16 items-center gap-3 rounded-xl border border-line bg-surface p-4 text-sm leading-6 peer-checked:border-[#a7bd61] peer-checked:bg-lime/20 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[#7251ae]">
                    <span
                      aria-hidden="true"
                      className="flex size-6 shrink-0 items-center justify-center rounded-lg border border-line bg-white"
                    >
                      {session.checkedSteps.includes(index) && (
                        <Check className="size-4" />
                      )}
                    </span>
                    {step}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <details className="mt-5 rounded-xl border border-line p-4 text-xs">
            <summary className="cursor-pointer font-semibold">
              설명과 진행 조건
            </summary>
            <p className="mt-3 leading-6 text-muted">
              {session.mission.fullDescription}
            </p>
            <ul className="mt-3 space-y-2 text-muted">
              {session.mission.constraints.map((rule) => (
                <li key={rule}>· {rule}</li>
              ))}
            </ul>
          </details>
          {action.error && (
            <p role="alert" className="mt-4 text-sm text-red-800">
              {action.error}
            </p>
          )}
          <div className="safe-bottom sticky bottom-0 mt-6 bg-background/95 pt-3 backdrop-blur-sm">
            <Button
              className="w-full"
              disabled={!allChecked || action.pending}
              onClick={() => setFinishing(true)}
            >
              <Flag aria-hidden="true" className="size-4 text-lime" /> 미션 완료
            </Button>
            {!allChecked && (
              <p className="mt-2 text-center text-[10px] text-muted">
                체크를 모두 마치면 완료할 수 있어요.
              </p>
            )}
          </div>
          {!abandoning ? (
            <button
              className="mx-auto block min-h-11 text-xs font-semibold text-muted"
              onClick={() => setAbandoning(true)}
            >
              이번 미션은 그만할래
            </button>
          ) : (
            <div className="mt-3 rounded-2xl border border-line bg-surface p-5">
              <p className="text-sm font-bold">이번에는 여기까지 할까요?</p>
              <p className="mt-2 text-xs text-muted">
                그만둔 기록은 남고 EXP는 지급되지 않아요.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={action.pending}
                  onClick={() => setAbandoning(false)}
                >
                  계속 할래
                </Button>
                <Button
                  disabled={action.pending}
                  onClick={() =>
                    void action.run(async () => {
                      await dispatch({
                        type: "abandon",
                        sessionId: session.id,
                      });
                      router.refresh();
                    })
                  }
                >
                  그만하기
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <CompletionForm
          session={session}
          onCancel={() => setFinishing(false)}
        />
      )}
    </section>
  );
}
