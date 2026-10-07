"use client";
import Link from "next/link";
import { Trophy, ArrowRight } from "lucide-react";
import { LocalStateGate } from "@/components/layout/LocalStateGate";
import { StorageNote } from "@/components/layout/StorageNote";
import { Button } from "@/components/ui/Button";
import { SaveRecordsPrompt } from "@/features/account/SaveRecordsPrompt";
import { useProgression } from "@/features/profile/useProgression";
import { LevelProgress } from "@/features/profile/LevelProgress";
import { AchievementCollection } from "@/features/profile/AchievementCollection";
import { MissionHistory } from "@/features/profile/MissionHistory";
import { achievementProgress } from "@/services/progressionService";
import { profileSummary } from "@/services/profileService";
import type { LocalState } from "@/types/game";

export function ProfileScreen() {
  return (
    <LocalStateGate>
      {(state) => <ProfileContent key={state.anonymousId} state={state} />}
    </LocalStateGate>
  );
}
function ProfileContent({ state }: { state: LocalState }) {
  const progression = useProgression(state);
  return (
    <section className="animate-enter mx-auto max-w-lg px-5 pt-5 pb-10">
      <span className="inline-flex items-center gap-2 rounded-full bg-purple-soft px-4 py-2 font-mono text-xs font-bold">
        <Trophy className="size-4" aria-hidden="true" /> MY PLAYER CARD
      </span>
      <h1 className="mt-6 text-3xl leading-tight font-black tracking-tight">
        오늘도 경험치가
        <br />
        쌓이는 중.
      </h1>
      <p className="mt-3 text-sm leading-7 text-muted">
        큰 계획 없이 해낸, 나의 작은 모험들.
      </p>
      <LevelProgress state={state} />
      <Link
        href="/account"
        className="mt-5 flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-xs font-bold"
      >
        계정 연결 · 기록 보관
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
      {progression.data ? (
        <AchievementCollection
          progress={achievementProgress(state, progression.data)}
        />
      ) : progression.error ? (
        <div role="alert" className="mt-7 rounded-2xl border border-line p-5">
          <p className="text-sm leading-6">{progression.error}</p>
          <Button
            variant="secondary"
            className="mt-3 w-full text-sm"
            onClick={progression.retry}
          >
            칭호 다시 불러오기
          </Button>
        </div>
      ) : (
        <p role="status" className="mt-7 text-sm text-muted">
          칭호를 불러오는 중…
        </p>
      )}
      <MissionHistory state={state} />
      <SaveRecordsPrompt
        completedCount={profileSummary(state).completedCount}
      />
      <p className="mt-7 text-[10px] leading-5 text-muted">
        <StorageNote kind="complete" />
      </p>
    </section>
  );
}
