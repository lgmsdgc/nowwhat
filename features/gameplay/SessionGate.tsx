"use client";

import { StorageNote } from "@/components/layout/StorageNote";

import type { ReactNode } from "react";
import Link from "next/link";
import { LocalStateGate } from "@/components/layout/LocalStateGate";
import { buttonStyles } from "@/components/ui/Button";
import { sessionPath } from "@/services/gameplayService";
import type { LocalState, MissionSession } from "@/types/game";

export function SessionGate({
  id,
  children,
}: {
  id: string;
  children: (session: MissionSession, state: LocalState) => ReactNode;
}) {
  return (
    <LocalStateGate>
      {(state) => {
        const session = state.sessions.find((s) => s.id === id);
        if (!session)
          return (
            <section className="mx-auto max-w-lg px-5 py-16 text-center">
              <h1 className="text-2xl font-black">이 미션을 찾지 못했어요.</h1>
              <p className="mt-4 text-sm leading-7 text-muted">
                <StorageNote kind="missing" />
              </p>
              <Link href="/" className={`${buttonStyles()} mt-7`}>
                홈으로 돌아가기
              </Link>
            </section>
          );
        return children(session, state);
      }}
    </LocalStateGate>
  );
}

export function SessionStatusNotice({
  session,
  state,
}: {
  session: MissionSession;
  state: LocalState;
}) {
  const next = state.sessions.find(
    (s) =>
      s.recommendationRunId === session.recommendationRunId &&
      s.rerollIndex === session.rerollIndex + 1,
  );
  const target =
    next ??
    (session.status === "started" ||
    session.status === "completed" ||
    session.status === "recommended"
      ? session
      : null);
  return (
    <section className="mx-auto max-w-lg px-5 py-16 text-center">
      <span aria-hidden="true" className="text-5xl">
        {session.status === "abandoned" ? "🌱" : session.mission.emoji}
      </span>
      <h1 className="mt-6 text-2xl font-black">
        {session.status === "abandoned"
          ? "괜찮아, 다음이 있으니까."
          : session.status === "rejected"
            ? "새로운 미션으로 넘어갔어요."
            : "미션의 현재 상태를 확인해요."}
      </h1>
      <p className="mt-3 text-sm text-muted">
        {session.status === "abandoned"
          ? "이번에는 여기까지. EXP는 지급되지 않았어요."
          : session.mission.title}
      </p>
      <Link
        href={target ? sessionPath(target) : "/onboarding"}
        className={`${buttonStyles()} mt-7 w-full`}
      >
        {target
          ? target.status === "completed"
            ? "완료 결과 보기"
            : "현재 미션 보기"
          : "다른 미션 찾아보기"}
      </Link>
      <Link
        href="/"
        className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-muted"
      >
        홈으로
      </Link>
    </section>
  );
}
