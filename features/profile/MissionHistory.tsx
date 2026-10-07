"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { profileSummary } from "@/services/profileService";
import { elapsedLabel } from "@/lib/utils/format";
import type { LocalState } from "@/types/game";

const tabs = [
  { id: "completed", label: "최근 미션" },
  { id: "liked", label: "👍 좋아한 미션" },
  { id: "disliked", label: "👎 아쉬운 미션" },
] as const;
type Filter = (typeof tabs)[number]["id"];
export function MissionHistory({ state }: { state: LocalState }) {
  const [filter, setFilter] = useState<Filter>("completed");
  const [visible, setVisible] = useState(10);
  const profile = profileSummary(state);
  const sessions = profile[filter];
  return (
    <section className="mt-9" aria-labelledby="history-heading">
      <h2 id="history-heading" className="text-lg font-black">
        내가 해본 작은 일들
      </h2>
      <div
        className="mt-4 grid grid-cols-3 gap-1 rounded-2xl bg-purple-soft p-1"
        role="group"
        aria-label="미션 기록 필터"
      >
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            aria-pressed={filter === tab.id}
            onClick={() => {
              setFilter(tab.id);
              setVisible(10);
            }}
            className={`min-h-11 rounded-xl px-1 text-[11px] font-bold ${filter === tab.id ? "bg-surface shadow-sm" : "text-muted hover:text-foreground"}`}
          >
            {tab.label}
            <span className="ml-1 font-mono">{profile[tab.id].length}</span>
          </button>
        ))}
      </div>
      {sessions.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed border-line p-7 text-center">
          <p className="text-sm font-bold">
            {filter === "completed"
              ? "아직 첫 페이지가 비어 있어요."
              : "아직 여기에 남긴 미션은 없어요."}
          </p>
          <p className="mt-2 text-xs leading-6 text-muted">
            {filter === "completed"
              ? "작은 미션 하나면 오늘의 이야기가 시작돼요."
              : "미션 완료 후 다시 하고 싶은지 골라주면 여기에 모아둘게요."}
          </p>
          {filter === "completed" && (
            <Link
              href="/onboarding"
              className={`${buttonStyles()} mt-5 w-full`}
            >
              첫 미션 골라줘
            </Link>
          )}
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {sessions.slice(0, visible).map((session) => (
            <li key={session.id}>
              <Link
                href={`/complete/${session.id}`}
                className="flex min-h-20 items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-purple"
              >
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-background text-2xl"
                >
                  {session.mission.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm leading-5 font-bold">
                    {session.mission.title}
                  </h3>
                  <p className="mt-1 text-[10px] leading-5 text-muted">
                    {new Date(session.completedAt!).toLocaleDateString("ko-KR")}{" "}
                    · {elapsedLabel(session.result!.actualDurationSeconds)} · +
                    {session.result!.awardedExp} EXP
                  </p>
                  {session.result!.comment && (
                    <p className="mt-1 truncate text-xs text-muted">
                      “{session.result!.comment}”
                    </p>
                  )}
                </div>
                <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {sessions.length > visible && (
        <Button
          variant="secondary"
          className="mt-4 w-full text-sm"
          onClick={() => setVisible((value) => value + 10)}
        >
          기록 더 보기
        </Button>
      )}
    </section>
  );
}
