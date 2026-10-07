"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bookmark, Mail, ShieldCheck, ArrowRight } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { LocalStateGate } from "@/components/layout/LocalStateGate";
import { getDataConfig } from "@/lib/config/dataSource";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { refreshGameState } from "@/lib/storage/browserStore";
import { useIdentity } from "@/features/account/useIdentity";
import { useGameAction } from "@/features/gameplay/useGameAction";
import {
  finishAccountMigration,
  importLocalHistory,
  loadAccount,
  sendEmail,
  startGoogle,
  verifyEmail,
  type Account,
} from "@/services/accountService";
import { LocalRepository } from "@/lib/repositories/localRepository";
import { totalExp, levelFor } from "@/lib/progression/experience";
import { sessionPath } from "@/services/gameplayService";
import type { LocalState } from "@/types/game";

export function AccountScreen() {
  return (
    <LocalStateGate>
      {(state) => <AccountContent state={state} />}
    </LocalStateGate>
  );
}
function AccountContent({ state }: { state: LocalState }) {
  const action = useGameAction();
  const identity = useIdentity();
  const [account, setAccount] = useState<Account | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [existing, setExisting] = useState(false);
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [sentExisting, setSentExisting] = useState(false);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [importCount, setImportCount] = useState(0);
  const local = getDataConfig().mode === "local";
  const completed = state.sessions.filter((s) => s.status === "completed");
  const member = account?.user.anonymous === false;
  useEffect(() => {
    if (local) return;
    let active = true;
    void loadAccount()
      .then((value) => {
        if (active) {
          setAccount(value);
          setAccountError(null);
          try {
            setImportCount(
              new LocalRepository(window.localStorage)
                .read()
                ?.sessions.filter((s) => s.status === "completed").length ?? 0,
            );
          } catch {
            setAccountError(
              "기기 기록을 읽지 못했어요. 원본은 그대로 남아 있어요.",
            );
          }
        }
      })
      .catch(() => {
        if (active)
          setAccountError("계정 상태를 읽지 못했어요. 다시 불러와주세요.");
      });
    return () => {
      active = false;
    };
  }, [local, identity]);
  async function finish() {
    await finishAccountMigration();
    await refreshGameState();
    setAccount(await loadAccount());
    setNotice("기록을 연결했어요. 다음에도 이어서 만나요!");
  }
  return (
    <section className="mx-auto max-w-lg px-5 pt-5 pb-10">
      <span className="inline-flex items-center gap-2 rounded-full bg-purple-soft px-4 py-2 text-xs font-bold">
        <Bookmark className="size-4" aria-hidden="true" /> MY LITTLE ADVENTURES
      </span>
      <h1 className="mt-6 text-3xl font-black tracking-tight">
        작은 미션도,
        <br />
        쌓이면 내 이야기.
      </h1>
      <p className="mt-3 text-sm leading-7 text-muted">
        {member
          ? `${account.user.email ?? "연결된 계정"} · 기록을 보관하고 있어요.`
          : "가입은 선택이에요. 하고 싶을 때 기록을 연결해요."}
      </p>
      <div className="mt-6 grid grid-cols-3 gap-2 rounded-3xl bg-lime p-5">
        {[
          { label: "완료한 미션", value: `${completed.length}개` },
          { label: "총 EXP", value: String(totalExp(state)) },
          { label: "현재 레벨", value: `LV.${levelFor(totalExp(state))}` },
        ].map((item) => (
          <div key={item.label}>
            <p className="text-[10px] text-muted">{item.label}</p>
            <p className="mt-2 text-xl font-black">{item.value}</p>
          </div>
        ))}
      </div>
      <Link
        href="/profile"
        className="mt-4 inline-flex min-h-11 items-center gap-2 text-xs font-bold text-[#7251ae]"
      >
        내 레벨과 칭호 보기 <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
      {local && (
        <p className="mt-5 rounded-2xl border border-line bg-surface p-4 text-xs leading-6 text-muted">
          지금은 이 기기에 기록하고 있어요. 계정 연결이 열리면 Google이나
          이메일로 보관할 수 있어요. 미션은 계속 즐길 수 있어요.
        </p>
      )}
      {!local && !account && (
        <p role="status" className="mt-5 text-sm text-muted">
          계정 연결을 확인하는 중…
        </p>
      )}
      {!member && (
        <div className="mt-5 rounded-3xl border border-line bg-surface p-5">
          <h2 className="text-lg font-black">다음에도 기억해둘게.</h2>
          <div className="mt-4 flex gap-2" aria-label="계정 연결 방법">
            <button
              type="button"
              disabled={action.pending || !!sentEmail}
              aria-pressed={!existing}
              onClick={() => setExisting(false)}
              className={`min-h-11 flex-1 rounded-xl px-2 text-xs font-bold ${!existing ? "bg-purple-soft" : "bg-background"}`}
            >
              처음 저장해요
            </button>
            <button
              type="button"
              disabled={action.pending || !!sentEmail}
              aria-pressed={existing}
              onClick={() => setExisting(true)}
              className={`min-h-11 flex-1 rounded-xl px-2 text-xs font-bold ${existing ? "bg-purple-soft" : "bg-background"}`}
            >
              이미 가입했어요
            </button>
          </div>
          {existing && (
            <p className="mt-3 text-xs leading-6 text-muted">
              로그인하면 지금의 익명 기록도 함께 연결해요. 계정에 진행 중인
              미션이 있으면 현재 익명 미션은 기록에 남기고 종료해요.
            </p>
          )}
          <Button
            variant="secondary"
            className="mt-4 w-full"
            disabled={local || !account || action.pending || !!sentEmail}
            onClick={() => void action.run(() => startGoogle(existing))}
          >
            <span aria-hidden="true" className="font-black">
              G
            </span>
            Google로 {existing ? "로그인" : "기록 저장"}
          </Button>
          <p className="my-4 text-center text-[10px] text-muted">또는 이메일</p>
          {!sentEmail ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void action.run(async () => {
                  await sendEmail(email, existing);
                  setSentEmail(email.trim());
                  setSentExisting(existing);
                  setNotice(
                    "이메일의 링크를 이 브라우저에서 열거나 인증 코드를 입력해주세요.",
                  );
                });
              }}
            >
              <label htmlFor="account-email" className="text-xs font-bold">
                이메일 주소
              </label>
              <input
                id="account-email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={local || action.pending || !account}
                placeholder="you@example.com"
                className="mt-2 min-h-12 w-full rounded-xl border border-line bg-background px-4 text-base"
              />
              <Button
                type="submit"
                className="mt-3 w-full"
                disabled={local || !account || action.pending}
              >
                <Mail className="size-4" aria-hidden="true" />
                {action.pending ? "연결 준비 중…" : "이메일로 계속하기"}
              </Button>
            </form>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void action.run(async () => {
                  await verifyEmail(sentEmail, code, sentExisting);
                  await finish();
                });
              }}
            >
              <label htmlFor="account-code" className="text-xs font-bold">
                이메일 인증 코드
              </label>
              <input
                id="account-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,10}"
                required
                minLength={6}
                maxLength={10}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-xl border border-line bg-background px-4 text-base"
              />
              <Button
                type="submit"
                disabled={action.pending}
                className="mt-3 w-full"
              >
                확인하고 기록 연결
              </Button>
              <button
                type="button"
                disabled={action.pending}
                className="mt-2 min-h-11 text-xs underline"
                onClick={() => {
                  setSentEmail(null);
                  setCode("");
                }}
              >
                다른 이메일 / 다시 보내기
              </button>
            </form>
          )}
          <p className="mt-4 flex items-center gap-2 text-[10px] leading-5 text-muted">
            <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
            가입 없이도 추천과 완료는 계속 사용할 수 있어요.
          </p>
        </div>
      )}
      {member && (
        <div className="mt-5 rounded-3xl border border-line bg-surface p-5">
          <h2 className="text-lg font-black">기록 연결</h2>
          <Button
            variant="secondary"
            disabled={action.pending}
            className="mt-3 w-full"
            onClick={() => void action.run(finish)}
          >
            익명 기록 연결 다시 확인
          </Button>
          {importCount > 0 && (
            <>
              <p className="mt-4 text-xs leading-6 text-muted">
                이 기기의 완료 기록 {importCount}개를 보관할 수 있어요.
                비용·평가·코멘트도 옮겨요. 기기 기록은 별도로 표시하며 EXP를
                추가하지 않아요.
              </p>
              <Button
                disabled={action.pending}
                className="mt-3 w-full"
                onClick={() =>
                  void action.run(async () => {
                    const result = await importLocalHistory();
                    setAccount(await loadAccount());
                    setNotice(
                      `${result.imported}개 기록을 새로 보관했어요. 이미 옮긴 기록은 중복 저장하지 않아요.`,
                    );
                  })
                }
              >
                기기 기록 보관하기
              </Button>
            </>
          )}
          <Button
            variant="secondary"
            disabled={action.pending}
            className="mt-4 w-full"
            onClick={() =>
              void action.run(async () => {
                const { error } = await getBrowserSupabase().auth.signOut({
                  scope: "local",
                });
                if (error) throw new Error("로그아웃하지 못했어요.");
                setAccount(null);
                setNotice("로그아웃했어요. 계정 기록은 그대로 보관돼요.");
                await refreshGameState();
                setAccount(await loadAccount());
              })
            }
          >
            이 기기에서 로그아웃
          </Button>
        </div>
      )}
      {(action.error || accountError) && (
        <div
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-4 text-xs leading-6 text-red-800"
        >
          {action.error ?? accountError}
          {accountError && !local && (
            <button
              type="button"
              className="ml-2 underline"
              onClick={() =>
                void action.run(async () => {
                  setAccount(await loadAccount());
                  setAccountError(null);
                })
              }
            >
              다시 불러오기
            </button>
          )}
        </div>
      )}
      {notice && (
        <p
          role="status"
          className="mt-4 rounded-xl bg-purple-soft p-4 text-xs leading-6"
        >
          {notice}
        </p>
      )}
      <h2 className="mt-8 text-lg font-black">최근 해낸 것들</h2>
      {completed.length === 0 && (
        <p className="mt-3 text-sm text-muted">
          아직 비어 있어요. 첫 미션부터 시작해볼까요?
        </p>
      )}
      <ul className="mt-3 space-y-2">
        {completed
          .slice(-5)
          .reverse()
          .map((s) => (
            <li key={s.id}>
              <Link
                href={sessionPath(s)}
                className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-semibold"
              >
                <span>
                  {s.mission.emoji} {s.mission.title}
                </span>
                <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
              </Link>
            </li>
          ))}
      </ul>
      {!!account?.imports.length && (
        <>
          <h2 className="mt-6 text-sm font-black">
            옮겨온 기기 기록 · {account.imports.length}개
          </h2>
          <ul className="mt-3 space-y-2">
            {account.imports.slice(0, 5).map((record) => (
              <li
                key={record.id}
                className="rounded-2xl border border-line bg-surface p-4"
              >
                <p className="text-sm font-semibold">{record.title}</p>
                <p className="mt-1 text-[10px] text-muted">
                  기기에서 기록한 미션 · EXP 추가 없음
                </p>
                {record.comment && (
                  <p className="mt-2 whitespace-pre-wrap text-xs text-muted">
                    {record.comment}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <Link href="/onboarding" className={`${buttonStyles()} mt-7 w-full`}>
        그럼, 또 뭐하지?
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </section>
  );
}
