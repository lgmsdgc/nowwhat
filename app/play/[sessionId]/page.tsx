import type { Metadata } from "next";
import { PlayScreen } from "@/features/gameplay/PlayScreen";
export const metadata: Metadata = { title: "미션 진행 중" };
export default async function PlayPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <PlayScreen id={sessionId} />;
}
