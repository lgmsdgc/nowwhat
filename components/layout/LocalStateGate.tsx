"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import {
  refreshGameState,
  recoverLocalState,
  useGameState,
} from "@/lib/storage/browserStore";
import { useGameAction } from "@/features/gameplay/useGameAction";
import type { LocalState } from "@/types/game";

export function LocalStateGate({
  children,
}: {
  children: (state: LocalState) => ReactNode;
}) {
  const snapshot = useGameState();
  const action = useGameAction();
  if (snapshot.status === "loading")
    return (
      <p role="status" className="px-5 py-20 text-center text-sm text-muted">
        잠깐, 너의 하루를 불러오는 중…
      </p>
    );
  if (snapshot.status === "error")
    return (
      <section className="mx-auto max-w-lg px-5 py-12 text-center">
        <h1 className="text-2xl font-black">기록을 확인하고 있어요.</h1>
        <p className="mt-4 text-sm leading-7 text-muted" role="alert">
          {snapshot.message}
        </p>
        <Button className="mt-6" onClick={() => void refreshGameState()}>
          다시 불러오기
        </Button>
        {snapshot.recoverable && (
          <div className="mt-6 rounded-2xl bg-purple-soft p-5">
            <p className="text-xs leading-6">
              기존 데이터의 복사본을 이 브라우저에 남기고 새 기록을 만들 수
              있어요. 이전 기록은 자동으로 합쳐지지 않아요.
            </p>
            <Button
              variant="secondary"
              className="mt-3"
              disabled={action.pending}
              onClick={() => void action.run(recoverLocalState)}
            >
              기존 기록 백업 후 새로 시작
            </Button>
          </div>
        )}
        {action.error && (
          <p role="alert" className="mt-4 text-sm text-red-800">
            {action.error}
          </p>
        )}
      </section>
    );
  return children(snapshot.data);
}
