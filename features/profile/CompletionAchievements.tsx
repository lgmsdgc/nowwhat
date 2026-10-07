"use client";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useProgression } from "@/features/profile/useProgression";
import type { LocalState } from "@/types/game";

export function CompletionAchievements({
  state,
  sessionId,
}: {
  state: LocalState;
  sessionId: string;
}) {
  const { data, error, retry } = useProgression(state);
  const earned =
    data?.achievements.filter(
      (a) =>
        a.active &&
        data.unlocks.some(
          (u) => u.achievementId === a.id && u.earnedSessionId === sessionId,
        ),
    ) ?? [];
  return (
    <div className="mt-4 text-left">
      {earned.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="text-xs font-medium text-muted">새로운 칭호</h2>
          <ul className="mt-3 space-y-3">
            {earned.map((a) => (
              <li key={a.id} className="flex gap-3">
                <span aria-hidden="true" className="text-2xl">
                  {a.emoji}
                </span>
                <div>
                  <p className="text-sm font-black">{a.name}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!data && !error && (
        <p role="status" className="text-xs text-muted">
          이번에 얻은 칭호를 확인하는 중…
        </p>
      )}
      {error && (
        <div role="alert">
          <p className="text-xs leading-6 text-muted">{error}</p>
          <Button
            variant="secondary"
            className="mt-2 w-full text-sm"
            onClick={retry}
          >
            칭호 다시 확인
          </Button>
        </div>
      )}
      <Link
        href="/profile"
        className="mt-2 flex min-h-11 items-center justify-center rounded-xl text-xs font-bold text-[#7251ae]"
      >
        내 레벨과 칭호 보기 →
      </Link>
    </div>
  );
}
