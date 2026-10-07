import type { Metadata } from "next";
import { OnboardingFlow } from "@/features/onboarding/OnboardingFlow";

export const metadata: Metadata = { title: "오늘의 상황" };

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
