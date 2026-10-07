"use client";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useGameAction } from "@/features/gameplay/useGameAction";
import { shareMission } from "@/services/shareService";
import { recordClientEvent } from "@/services/analyticsClientService";
import type { MissionSession } from "@/types/game";

export function ShareMissionButton({ session }: { session: MissionSession }) {
  const action = useGameAction();
  const [notice, setNotice] = useState("");
  const share = (copyOnly = false) =>
    void action.run(async () => {
      setNotice("");
      // Invoke the browser API within this gesture; never await telemetry first.
      const result = await shareMission(
        session,
        window.location.origin,
        {
          share:
            !copyOnly && typeof navigator.share === "function"
              ? (payload) => navigator.share(payload)
              : undefined,
          copy: navigator.clipboard
            ? (text) => navigator.clipboard.writeText(text)
            : undefined,
        },
        (event) => {
          void recordClientEvent(session.anonymousId, event);
        },
      );
      setNotice(
        result === "copied"
          ? "공유 문구와 링크를 복사했어요. 원하는 곳에 붙여넣어 주세요!"
          : result === "shared"
            ? "오늘의 작은 모험을 자랑했어요!"
            : "",
      );
    });
  return (
    <div className="mt-4 grid grid-cols-2 items-center gap-x-3">
      <Button
        variant="secondary"
        className="min-h-11 w-full px-3"
        disabled={action.pending}
        onClick={() => share()}
      >
        <Share2 className="size-4" aria-hidden="true" />
        {action.pending ? "공유 준비 중…" : "미션 공유"}
      </Button>
      <button
        type="button"
        className="focus-ring min-h-11 rounded-xl text-xs text-muted underline underline-offset-4 disabled:opacity-50"
        disabled={action.pending}
        onClick={() => share(true)}
      >
        문구와 링크 복사
      </button>
      {notice && (
        <p
          role="status"
          className="col-span-2 mt-2 text-xs leading-6 text-muted"
        >
          {notice}
        </p>
      )}
      {action.error && (
        <p
          role="alert"
          className="col-span-2 mt-2 text-xs leading-6 text-red-800"
        >
          {action.error}
        </p>
      )}
    </div>
  );
}
