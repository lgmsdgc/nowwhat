import type { ReactNode } from "react";
import Link from "next/link";
import { Brand } from "@/components/layout/Brand";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="fixed top-3 left-3 z-50 -translate-y-24 rounded-xl bg-foreground px-5 py-3 text-white focus:translate-y-0"
      >
        본문으로 건너뛰기
      </a>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8 sm:py-5 lg:px-10">
        <Brand />
        <nav aria-label="주 메뉴">
          <Link
            href="/profile"
            className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-muted hover:text-foreground"
          >
            내 기록
          </Link>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <footer className="safe-bottom mx-auto mt-8 w-full max-w-6xl px-5 pt-4 text-center text-xs text-muted">
        nowwhat.
      </footer>
    </div>
  );
}
