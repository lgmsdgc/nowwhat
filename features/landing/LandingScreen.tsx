import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MissionPreview } from "@/features/landing/MissionPreview";
import { HowItWorks } from "@/features/landing/HowItWorks";
import { ResumeBanner } from "@/features/landing/ResumeBanner";

export function LandingScreen() {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-6 sm:px-8 sm:pt-12 lg:px-10">
      <ResumeBanner />
      <section
        aria-labelledby="hero-title"
        className="grid items-center gap-10 lg:grid-cols-2 lg:gap-20"
      >
        <div className="animate-enter py-3">
          <h1
            id="hero-title"
            className="text-[clamp(2.5rem,6vw,4rem)] leading-[1.2] font-bold tracking-tight"
          >
            지금, 뭐하지?
          </h1>
          <p className="mt-5 text-base leading-7 text-muted">
            고르는 건 우리가 할게.
            <br />넌 하기만 해.
          </p>
          <Link
            href="/onboarding"
            className="mt-8 flex min-h-14 w-full max-w-sm items-center justify-between rounded-xl bg-foreground px-5 py-4 text-base font-semibold text-white hover:bg-[#3c4037]"
          >
            뭐하지? 시작하기{" "}
            <ArrowRight aria-hidden="true" className="size-4 text-lime" />
          </Link>
          <p className="mt-3 max-w-sm text-center text-xs text-muted">
            로그인 없이 바로 시작
          </p>
        </div>
        <MissionPreview />
      </section>
      <HowItWorks />
    </div>
  );
}
