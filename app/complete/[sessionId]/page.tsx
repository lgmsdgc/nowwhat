import type { Metadata } from "next";
import { CompleteScreen } from "@/features/gameplay/CompleteScreen";
export const metadata: Metadata = { title: "미션 완료!" };
export default async function CompletePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <CompleteScreen id={sessionId} />;
}
