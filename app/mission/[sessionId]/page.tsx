import type { Metadata } from "next";
import { RecommendationScreen } from "@/features/mission/RecommendationScreen";
export const metadata: Metadata = { title: "오늘의 미션" };
export default async function MissionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <RecommendationScreen id={sessionId} />;
}
