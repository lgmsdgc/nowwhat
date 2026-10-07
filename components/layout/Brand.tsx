import Link from "next/link";
import { Hash } from "lucide-react";

export function Brand() {
  return (
    <Link
      href="/"
      aria-label="NowWhat 홈"
      className="inline-flex items-center gap-2.5 rounded-md"
    >
      <span className="flex size-10 rotate-[-7deg] items-center justify-center rounded-xl bg-lime">
        <Hash aria-hidden="true" className="size-7" strokeWidth={2.8} />
      </span>
      <span className="text-[27px] font-extrabold tracking-[-0.04em]">
        nowwhat<span className="text-[#7b609f]">.</span>
      </span>
    </Link>
  );
}
