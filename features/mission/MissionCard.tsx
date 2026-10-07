import { Clock3, Wallet } from "lucide-react";
import { money } from "@/lib/utils/format";
import type { Mission } from "@/types/game";

export function MissionCard({ mission }: { mission: Mission }) {
  // Keep specific safety conditions visible; general encouragement stays in details.
  const safetyRules = mission.constraints.filter(
    (rule) =>
      ![
        "공개하거나 공유할 필요는 없어요",
        "불편하면 언제든 멈춰도 좋아요",
      ].includes(rule),
  );
  return (
    <article className="rounded-3xl border border-line bg-surface p-6 sm:p-7">
      <div className="flex items-center justify-between">
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-2xl bg-lime/35 text-3xl"
        >
          {mission.emoji}
        </span>
        <span className="text-xs font-semibold text-muted">
          +{mission.baseExp} EXP
        </span>
      </div>
      <h1 className="mt-5 text-[26px] leading-snug font-bold tracking-tight">
        {mission.title}
      </h1>
      <p className="mt-3 text-sm leading-7 text-muted">
        {mission.shortDescription}
      </p>
      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 text-sm">
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-muted">
            <Clock3 aria-hidden="true" className="size-3.5" /> 예상 시간
          </dt>
          <dd className="mt-2 font-semibold">
            {mission.minDuration}~{mission.maxDuration}분
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-muted">
            <Wallet aria-hidden="true" className="size-3.5" /> 1인 예산
          </dt>
          <dd className="mt-2 font-semibold">
            {mission.maxBudget ? `${money(mission.maxBudget)} 이내` : "0원"}
          </dd>
        </div>
      </dl>
      {safetyRules.length > 0 && (
        <ul
          aria-label="진행 조건"
          className="mt-5 space-y-1.5 border-t border-line pt-4 text-xs leading-6 text-muted"
        >
          {safetyRules.map((rule) => (
            <li key={rule}>· {rule}</li>
          ))}
        </ul>
      )}
      <details className="mt-4 text-xs text-muted">
        <summary className="min-h-11 cursor-pointer py-3 font-medium">
          하는 방법
        </summary>
        <p className="mb-3 text-sm leading-7">{mission.fullDescription}</p>
        <p className="leading-6">
          난이도 {mission.difficulty}/5 · 예상 재미 {mission.estimatedFun}/5
        </p>
        {safetyRules.length !== mission.constraints.length && (
          <ul className="mt-2 space-y-1 leading-6">
            {mission.constraints
              .filter((rule) => !safetyRules.includes(rule))
              .map((rule) => (
                <li key={rule}>· {rule}</li>
              ))}
          </ul>
        )}
      </details>
    </article>
  );
}
