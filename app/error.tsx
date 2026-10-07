"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <section className="mx-auto max-w-lg px-5 py-20 text-center">
      <p className="text-4xl" aria-hidden="true">
        🫧
      </p>
      <h1 className="mt-5 text-2xl font-black tracking-tight">
        잠깐 꼬였어요.
      </h1>
      <p className="mt-3 text-sm leading-7 text-muted">
        화면을 불러오지 못했어요. 다시 시도해 주세요.
      </p>
      <Button onClick={retry} className="mt-7">
        다시 시도
      </Button>
      <Link
        href="/"
        className="mx-auto mt-4 flex min-h-11 w-fit items-center rounded-md text-sm font-semibold text-muted"
      >
        처음으로 돌아가기
      </Link>
    </section>
  );
}
