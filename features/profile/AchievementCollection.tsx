import { LockKeyhole, Check } from "lucide-react";
import type { AchievementProgress } from "@/types/progression";

export function AchievementCollection({
  progress,
}: {
  progress: readonly AchievementProgress[];
}) {
  const earned = progress.filter((p) => p.unlock);
  return (
    <section className="mt-9" aria-labelledby="titles-heading">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="titles-heading" className="text-lg font-black">
          나의 칭호 컬렉션
        </h2>
        <span className="rounded-full bg-purple-soft px-3 py-1 font-mono text-xs font-bold">
          {earned.length} / {progress.length}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {progress.map(({ achievement: a, count, target, unlock }) => (
          <article
            key={a.id}
            className={`flex flex-col rounded-2xl border p-4 ${unlock ? "border-purple bg-purple-soft" : "border-line bg-surface"}`}
          >
            <div className="flex items-center justify-between">
              <span
                aria-hidden="true"
                className={`text-3xl ${unlock ? "" : "grayscale"}`}
              >
                {a.emoji}
              </span>
              {unlock ? (
                <Check aria-hidden="true" className="size-4" />
              ) : (
                <LockKeyhole
                  aria-hidden="true"
                  className="size-3.5 text-muted"
                />
              )}
            </div>
            <h3 className="mt-3 text-sm leading-5 font-black">{a.name}</h3>
            <p className="mt-2 text-[11px] leading-5 text-muted">
              {a.description}
            </p>
            <p className="mt-auto pt-3 font-mono text-[10px] font-bold">
              {unlock
                ? `획득 · ${new Date(unlock.unlockedAt).toLocaleDateString("ko-KR")}`
                : `${Math.min(count, target)} / ${target} · 도전 중`}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
