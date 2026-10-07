"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { dispatch } from "@/lib/storage/browserStore";
import { completionFromDraft } from "@/services/gameplayService";
import { cn } from "@/lib/utils/cn";
import { useGameAction } from "@/features/gameplay/useGameAction";
import type { CompletionDraft, MissionSession } from "@/types/game";

export function CompletionForm({
  session,
  onCancel,
}: {
  session: MissionSession;
  onCancel: () => void;
}) {
  const router = useRouter();
  const action = useGameAction();
  const [draft, setDraft] = useState(session.completionDraft);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveSequence = useRef(0);
  function change(patch: Partial<CompletionDraft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    const sequence = ++saveSequence.current;
    void dispatch({
      type: "completionDraft",
      sessionId: session.id,
      patch: next,
    })
      .then(() => {
        if (sequence === saveSequence.current) setSaveError(null);
      })
      .catch((error: unknown) => {
        if (sequence === saveSequence.current)
          setSaveError(
            error instanceof Error
              ? error.message
              : "입력 내용을 저장하지 못했어요.",
          );
      });
  }
  return (
    <form
      className="mt-6 rounded-3xl border border-line bg-surface p-5 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        void action.run(async () => {
          const input = completionFromDraft(draft);
          await dispatch({ type: "complete", sessionId: session.id, input });
          router.replace(`/complete/${session.id}`);
        });
      }}
      aria-labelledby="completion-title"
      aria-busy={action.pending}
    >
      <h2 id="completion-title" className="text-xl font-black tracking-tight">
        어땠나요?
      </h2>
      <p className="mt-2 text-xs leading-6 text-muted">모두 선택 사항이에요.</p>
      <fieldset disabled={action.pending} className="mt-6 space-y-6">
        <div>
          <label htmlFor="actual-cost" className="block text-sm font-bold">
            사용한 금액{" "}
            <span className="font-normal text-muted">· 1인 기준</span>
          </label>
          <div className="relative mt-2">
            <input
              id="actual-cost"
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={draft.costText}
              onChange={(event) => change({ costText: event.target.value })}
              placeholder="미입력"
              className="min-h-12 w-full rounded-xl border border-line bg-background px-4 pr-10 text-base"
            />
            <span className="absolute top-3.5 right-4 text-sm text-muted">
              원
            </span>
          </div>
        </div>
        <fieldset>
          <legend className="text-sm font-bold">얼마나 재밌었나요?</legend>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <label key={value} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="fun-rating"
                  value={value}
                  checked={draft.rating === value}
                  onChange={() => change({ rating: value })}
                  className="peer sr-only"
                />
                <span className="flex size-11 items-center justify-center rounded-lg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
                  <Star
                    aria-hidden="true"
                    className={cn(
                      "size-8",
                      draft.rating !== null && value <= draft.rating
                        ? "fill-[#cfb2f3] text-[#7251ae]"
                        : "text-line",
                    )}
                  />
                </span>
                <span className="sr-only">재미 {value}점</span>
              </label>
            ))}
          </div>
          {draft.rating !== null && (
            <button
              type="button"
              onClick={() => change({ rating: null })}
              className="min-h-11 text-xs text-muted underline"
            >
              평가 지우기
            </button>
          )}
        </fieldset>
        <fieldset>
          <legend className="text-sm font-bold">다시 하고 싶은가요?</legend>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[
              { value: true, label: "또 할래", icon: ThumbsUp },
              { value: false, label: "한 번이면 됐어", icon: ThumbsDown },
            ].map(({ value, label, icon: Icon }) => (
              <label key={String(value)} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="would-repeat"
                  checked={draft.wouldDoAgain === value}
                  onChange={() => change({ wouldDoAgain: value })}
                  className="peer sr-only"
                />
                <span className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line px-2 text-xs font-semibold peer-checked:border-foreground peer-checked:bg-lime peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
                  <Icon aria-hidden="true" className="size-4" />
                  {label}
                </span>
              </label>
            ))}
          </div>
          {draft.wouldDoAgain !== null && (
            <button
              type="button"
              onClick={() => change({ wouldDoAgain: null })}
              className="min-h-11 text-xs text-muted underline"
            >
              선택 지우기
            </button>
          )}
        </fieldset>
        <div>
          <label htmlFor="comment" className="block text-sm font-bold">
            한 줄 남기기
          </label>
          <textarea
            id="comment"
            rows={3}
            maxLength={140}
            value={draft.comment}
            onChange={(event) => change({ comment: event.target.value })}
            placeholder="생각보다 재밌었음 :)"
            className="mt-2 w-full resize-y rounded-xl border border-line bg-background p-4 text-base"
          />
          <p className="mt-1 text-right text-[10px] text-muted">
            {draft.comment.length} / 140
          </p>
        </div>
      </fieldset>
      {(saveError || action.error) && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-800"
        >
          {action.error ?? saveError}
        </p>
      )}
      <Button type="submit" disabled={action.pending} className="mt-5 w-full">
        {action.pending
          ? "기록 저장 중…"
          : `완료하고 ${session.mission.baseExp} EXP 받기`}
      </Button>
      <button
        type="button"
        disabled={action.pending}
        onClick={onCancel}
        className="mt-2 min-h-11 w-full text-xs font-semibold text-muted"
      >
        체크리스트로 돌아가기
      </button>
    </form>
  );
}
