import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-lg px-5 py-20 text-center">
      <p className="font-mono text-sm tracking-widest text-muted">
        404 · WRONG TURN
      </p>
      <h1 className="mt-5 text-3xl font-black tracking-tight">
        앗, 이쪽 길은 아니에요.
      </h1>
      <p className="mt-4 text-sm leading-7 text-muted">
        페이지가 없거나 주소가 바뀌었어요.
        <br />
        처음으로 돌아가서 다시 시작해 볼까요?
      </p>
      <Link href="/" className={`${buttonStyles()} mt-8`}>
        <ArrowLeft aria-hidden="true" className="size-4" /> 처음으로
      </Link>
    </section>
  );
}
