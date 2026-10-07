"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, buttonStyles } from "@/components/ui/Button";
import { getDataConfig } from "@/lib/config/dataSource";
import {
  exchangeCallback,
  finishAccountMigration,
  loadAccount,
} from "@/services/accountService";
import { refreshGameState } from "@/lib/storage/browserStore";
import { createCallbackCompletion } from "@/services/authCallbackService";

export function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [retry, setRetry] = useState(0);
  const completion = useRef<(() => Promise<void>) | null>(null);
  const [pending, setPending] = useState(true);
  useEffect(() => {
    let active = true;
    if (!completion.current) {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const flow = params.get("sb_flow_id") ?? undefined;
      window.history.replaceState(null, "", "/auth/callback");
      completion.current =
        getDataConfig().mode !== "supabase"
          ? async () => {
              throw new Error("계정 연결이 아직 열리지 않았어요.");
            }
          : createCallbackCompletion(
              { code, flowId: flow, cancelled: params.has("error") },
              {
                exchange: exchangeCallback,
                isMember: async () => !(await loadAccount()).user.anonymous,
                finishMigration: finishAccountMigration,
                refresh: refreshGameState,
              },
            );
    }
    void completion
      .current()
      .then(() => {
        if (active) {
          setError(null);
          setDone(true);
        }
      })
      .catch((e: unknown) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "기록을 연결하지 못했어요.",
          );
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  return (
    <section className="mx-auto max-w-lg px-5 py-16 text-center">
      <span aria-hidden="true" className="text-5xl">
        {done ? "🎉" : "🔖"}
      </span>
      <h1 className="mt-6 text-2xl font-black">
        {done ? "이제 기록을 기억할게." : "너의 기록을 연결하고 있어요."}
      </h1>
      {error ? (
        <>
          <p role="alert" className="mt-4 text-sm leading-7 text-red-800">
            {error}
          </p>
          <Button
            variant="secondary"
            className="mt-5"
            disabled={pending}
            onClick={() => {
              setPending(true);
              setError(null);
              setRetry((value) => value + 1);
            }}
          >
            기록 연결 다시 시도
          </Button>
        </>
      ) : !done ? (
        <p role="status" className="mt-4 text-sm text-muted">
          잠깐만 기다려주세요.
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted">
          다음에도 이 계정으로 이어서 만나요.
        </p>
      )}
      <Link href="/account" className={`${buttonStyles()} mt-6 w-full`}>
        {done ? "내 기록 보기" : "가입 화면으로 돌아가기"}
      </Link>
    </section>
  );
}
