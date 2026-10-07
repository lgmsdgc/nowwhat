import { Clock3, Wallet } from "lucide-react";

export function MissionPreview() {
  return (
    <article
      aria-label="미션 예시: 처음 보는 메뉴 먹기"
      className="mx-auto w-full max-w-md rounded-3xl border border-line bg-surface p-6 sm:p-8"
    >
      <div className="flex items-center justify-between">
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-2xl bg-lime/35 text-3xl"
        >
          🍜
        </span>
        <span className="text-xs text-muted">미션 예시</span>
      </div>
      <h2 className="mt-5 text-2xl font-bold tracking-tight">
        처음 보는 메뉴 먹기
      </h2>
      <p className="mt-3 text-sm leading-7 text-muted">
        늘 먹던 메뉴 대신, 오늘은 새로운 한 가지.
      </p>
      <div className="mt-6 flex flex-wrap gap-5 border-t border-line pt-5 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 aria-hidden="true" className="size-3.5" /> 약 45분
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Wallet aria-hidden="true" className="size-3.5" /> 15,000원 이내
        </span>
      </div>
    </article>
  );
}
