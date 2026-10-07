"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { answerLabels } from "@/data/onboardingOptions";
import { dispatch } from "@/lib/storage/browserStore";
import {
  SessionGate,
  SessionStatusNotice,
} from "@/features/gameplay/SessionGate";
import { useGameAction } from "@/features/gameplay/useGameAction";
import { sessionPath } from "@/services/gameplayService";
import { MissionCard } from "@/features/mission/MissionCard";
import type { LocalState, MissionSession } from "@/types/game";

export function RecommendationScreen({ id }: { id: string }) {
  return (
    <SessionGate id={id}>
      {(session, state) => (
        <Recommendation key={id} session={session} state={state} />
      )}
    </SessionGate>
  );
}

function Recommendation({
  session,
  state,
}: {
  session: MissionSession;
  state: LocalState;
}) {
  const router = useRouter();
  const action = useGameAction();
  const [pendingAction, setPendingAction] = useState<"start" | "reroll" | null>(
    null,
  );
  if (session.status !== "recommended")
    return <SessionStatusNotice session={session} state={state} />;
  async function perform(type: "start" | "reroll") {
    await action.run(async () => {
      setPendingAction(type);
      try {
        const result = await dispatch(
          type === "start"
            ? { type, sessionId: session.id }
            : { type, sessionId: session.id, reason: null },
        );
        const next = result.state.sessions.find(
          (s) => s.id === result.sessionId,
        );
        if (next) router.replace(sessionPath(next));
      } finally {
        setPendingAction(null);
      }
    });
  }
  return (
    <section
      className="animate-enter mx-auto max-w-lg px-5 pt-4 pb-6"
      aria-busy={action.pending}
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-muted">오늘의 미션</p>
        <span className="text-xs text-muted">
          {session.rerollIndex > 0 ? `${session.rerollIndex}번 다시 고름` : ""}
        </span>
      </div>
      <MissionCard mission={session.mission} />
      <details className="mt-3 text-xs text-muted">
        <summary className="min-h-11 cursor-pointer py-3">내 조건</summary>
        <div
          className="flex flex-wrap gap-x-3 gap-y-2 pb-2"
          aria-label="추천 조건"
        >
          {answerLabels(session.answers).map((label, index) => (
            <span key={`${index}-${label}`} className="text-xs">
              {label}
            </span>
          ))}
        </div>
      </details>
      {action.error && (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-800"
        >
          {action.error}
        </p>
      )}
      <div className="safe-bottom sticky bottom-0 z-10 mt-2 grid grid-cols-2 gap-3 bg-background/95 pt-3 backdrop-blur-sm">
        <Button
          className="w-full whitespace-nowrap"
          disabled={action.pending}
          onClick={() => void perform("start")}
        >
          {pendingAction === "start" ? "시작 중…" : "이거 한다"}
          <ArrowRight aria-hidden="true" className="size-5 text-lime" />
        </Button>
        <Button
          variant="secondary"
          className="w-full whitespace-nowrap"
          disabled={action.pending}
          onClick={() => void perform("reroll")}
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          {pendingAction === "reroll" ? "고르는 중…" : "한 번만 다시"}
        </Button>
      </div>
      <div className="text-center">
        <button
          disabled={action.pending}
          onClick={() =>
            void action.run(async () => {
              await dispatch({ type: "discard", sessionId: session.id });
              router.push("/onboarding");
            })
          }
          className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-muted"
        >
          <SlidersHorizontal aria-hidden="true" className="size-3" /> 조건
          바꾸기
        </button>
      </div>
    </section>
  );
}
