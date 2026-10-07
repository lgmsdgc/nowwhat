"use client";
import Link from "next/link";
import { useState } from "react";
import { useIdentity } from "@/features/account/useIdentity";

export function SaveRecordsPrompt({
  completedCount,
}: {
  completedCount: number;
}) {
  const identity = useIdentity();
  const [dismissed, setDismissed] = useState(false);
  if (
    completedCount < 2 ||
    dismissed ||
    identity === "member" ||
    identity === "loading" ||
    identity === "error"
  )
    return null;
  return (
    <aside className="mt-5 rounded-2xl border border-line bg-surface p-4 text-left">
      <h2 className="text-sm font-semibold">지금까지의 기록을 보관할까요?</h2>
      <Link
        href="/account"
        className="mt-3 inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4"
      >
        내 기록 저장하기 →
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-5 min-h-11 text-xs text-muted"
      >
        나중에
      </button>
    </aside>
  );
}
