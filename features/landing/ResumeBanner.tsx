"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useGameState } from "@/lib/storage/browserStore";
import { activeSession, sessionPath } from "@/services/gameplayService";
import { levelFor, totalExp } from "@/lib/progression/experience";

export function ResumeBanner() {
  const snapshot = useGameState();
  if (snapshot.status === "error")
    return (
      <Link
        href="/onboarding"
        className="mb-6 block rounded-2xl border border-line p-4 text-sm"
      >
        저장된 기록을 확인하지 못했어요. 복구 안내 보기 →
      </Link>
    );
  if (snapshot.status !== "ready") return null;
  const active = activeSession(snapshot.data);
  const last = snapshot.data.sessions.findLast((s) => s.status === "completed");
  if (!active && !last) return null;
  const exp = totalExp(snapshot.data);
  return (
    <Link
      href={sessionPath(active ?? last!)}
      className="mb-6 flex items-center gap-3 rounded-2xl border border-line bg-purple-soft/65 p-4 text-sm"
    >
      <span aria-hidden="true" className="text-2xl">
        {(active ?? last!).mission.emoji}
      </span>
      <span className="flex-1">
        <span className="block text-xs font-bold">
          {active
            ? active.status === "started"
              ? "진행 중인 미션 이어하기"
              : "골라둔 미션 보기"
            : `LV.${levelFor(exp)} · ${exp} EXP`}
        </span>
        <span className="mt-1 block text-xs text-muted">
          {active ? active.mission.title : "지난 미션 결과 다시 보기"}
        </span>
      </span>
      <ArrowRight aria-hidden="true" className="size-4" />
    </Link>
  );
}
