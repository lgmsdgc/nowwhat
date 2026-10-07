"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Dice5 } from "lucide-react";
import { LocalStateGate } from "@/components/layout/LocalStateGate";
import { Button, buttonStyles } from "@/components/ui/Button";
import {
  answerLabels,
  onboardingStepLabels,
  questions,
} from "@/data/onboardingOptions";
import { dispatch } from "@/lib/storage/browserStore";
import { cn } from "@/lib/utils/cn";
import { activeSession, sessionPath } from "@/services/gameplayService";
import { useGameAction } from "@/features/gameplay/useGameAction";
import type { LocalState } from "@/types/game";

export function OnboardingFlow() {
  return (
    <LocalStateGate>{(state) => <Questions state={state} />}</LocalStateGate>
  );
}

function Questions({ state }: { state: LocalState }) {
  const router = useRouter();
  const action = useGameAction();
  const [generating, setGenerating] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const step = state.onboarding.step;
  const question = questions[step];
  const selected = state.onboarding.answers[question.key];
  const active = activeSession(state);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  async function next() {
    await action.run(async () => {
      if (step < 5) {
        await dispatch({ type: "step", step: step + 1 });
        return;
      }
      setGenerating(true);
      try {
        const [result] = await Promise.all([
          dispatch({ type: "request" }, "onboarding"),
          new Promise((resolve) =>
            setTimeout(
              resolve,
              window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? 0
                : 900,
            ),
          ),
        ]);
        const session = result.state.sessions.find(
          (s) => s.id === result.sessionId,
        );
        if (session) router.push(sessionPath(session));
      } finally {
        setGenerating(false);
      }
    });
  }

  if (generating)
    return (
      <section
        className="mx-auto max-w-lg px-5 py-24 text-center"
        role="status"
      >
        <Dice5
          aria-hidden="true"
          className="mx-auto size-12 rounded-2xl bg-lime/35 p-3"
        />
        <h1 className="mt-6 text-2xl font-bold tracking-tight">
          미션을 고르는 중
        </h1>
      </section>
    );
  if (active)
    return (
      <section className="mx-auto max-w-lg px-5 py-12 text-center">
        <span className="text-5xl" aria-hidden="true">
          {active.mission.emoji}
        </span>
        <h1 className="mt-6 text-2xl font-black">이어갈 미션이 있어요.</h1>
        <p className="mt-4 text-muted">{active.mission.title}</p>
        <Link
          href={sessionPath(active)}
          className={`${buttonStyles()} mt-7 w-full`}
        >
          미션으로 돌아가기 <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
        {active.status === "recommended" && (
          <Button
            variant="secondary"
            className="mt-3 w-full"
            disabled={action.pending}
            onClick={() =>
              void action.run(async () => {
                await dispatch({ type: "discard", sessionId: active.id });
              })
            }
          >
            추천을 내려놓고 조건 바꾸기
          </Button>
        )}
        {action.error && (
          <p role="alert" className="mt-4 text-sm text-red-800">
            {action.error}
          </p>
        )}
      </section>
    );

  return (
    <section
      className="animate-enter mx-auto max-w-lg px-5 pt-3 pb-6 sm:pt-8"
      aria-labelledby="question-title"
      aria-busy={action.pending}
    >
      <div className="flex items-center justify-between">
        {step === 0 ? (
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted"
          >
            <ArrowLeft aria-hidden="true" className="size-4" /> 돌아가기
          </Link>
        ) : (
          <button
            disabled={action.pending}
            onClick={() =>
              void action.run(async () => {
                await dispatch({ type: "step", step: step - 1 });
              })
            }
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted"
          >
            <ArrowLeft aria-hidden="true" className="size-4" /> 이전 질문
          </button>
        )}
        <span className="text-xs text-muted">{step + 1} / 6</span>
      </div>
      <div
        role="progressbar"
        aria-label="질문 진행"
        aria-valuemin={0}
        aria-valuemax={6}
        aria-valuenow={step + 1}
        aria-valuetext={`6개 질문 중 ${step + 1}번째`}
        className="mt-5 flex gap-1.5"
      >
        {onboardingStepLabels.map((label, i) => (
          <span
            key={label}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i <= step ? "bg-foreground" : "bg-line",
            )}
          />
        ))}
      </div>
      <h1
        ref={heading}
        tabIndex={-1}
        id="question-title"
        className="mt-7 text-[28px] leading-snug font-bold tracking-tight outline-none sm:text-3xl"
      >
        {question.title}
      </h1>
      {[1, 2, 5].includes(step) && (
        <p className="mt-3 text-sm leading-6 text-muted">
          {question.description}
        </p>
      )}
      <fieldset
        key={question.key}
        disabled={action.pending}
        className={cn(
          "mt-6 grid gap-3",
          question.options.length > 4 && "grid-cols-2",
        )}
      >
        <legend className="sr-only">{question.title}</legend>
        {question.options.map((option) => (
          <label
            key={String(option.value)}
            className="relative block cursor-pointer"
          >
            <input
              type="radio"
              name={question.key}
              value={String(option.value)}
              checked={selected === option.value}
              onChange={() =>
                void action.run(async () => {
                  await dispatch({
                    type: "answer",
                    key: question.key,
                    value: option.value,
                  });
                })
              }
              className="peer sr-only"
            />
            <span className="flex min-h-16 items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition-colors peer-checked:border-foreground peer-checked:bg-lime/25 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[#7251ae]">
              <span aria-hidden="true" className="text-2xl">
                {option.emoji}
              </span>
              <span>
                <span className="block text-sm font-bold">{option.label}</span>
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      {step === 5 && (
        <details className="mt-4 text-xs text-muted">
          <summary className="min-h-11 cursor-pointer py-3">
            선택한 조건
          </summary>
          <div
            className="flex flex-wrap gap-x-3 gap-y-2"
            aria-label="선택한 조건"
          >
            {answerLabels(state.onboarding.answers).map((label, index) => (
              <span key={`${index}-${label}`} className="text-xs">
                {label}
              </span>
            ))}
          </div>
        </details>
      )}
      {action.error && (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {action.error}
        </p>
      )}
      <div className="safe-bottom sticky bottom-0 mt-6 bg-background/95 pt-3 backdrop-blur-sm">
        <Button
          className="w-full"
          disabled={selected === undefined || action.pending}
          onClick={() => void next()}
        >
          {step === 5 ? (
            <>
              <Dice5 aria-hidden="true" className="size-5 text-lime" /> 뭐하지?
            </>
          ) : (
            <>
              다음 <ArrowRight aria-hidden="true" className="size-4" />
            </>
          )}
        </Button>
      </div>
    </section>
  );
}
