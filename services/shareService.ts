import type { MissionSession } from "@/types/game";
import type { ClientEventInput } from "@/types/analytics";

export interface SharePort {
  share?: (data: { title: string; text: string; url: string }) => Promise<void>;
  copy?: (text: string) => Promise<void>;
}
export function missionSharePayload(session: MissionSession, origin: string) {
  if (session.status !== "completed" || !session.result)
    throw new Error("완료한 미션만 공유할 수 있어요.");
  // Always link to the public landing page; never expose a private session URL.
  return {
    title: "NowWhat · 오늘의 작은 모험",
    text: `${session.mission.emoji} 「${session.mission.title}」 해냈다! EXP +${session.result.awardedExp}\n고르는 건 NowWhat이, 하는 건 내가.`,
    url: new URL("/", origin).toString(),
  };
}
export async function shareMission(
  session: MissionSession,
  origin: string,
  port: SharePort,
  track: (event: ClientEventInput) => void,
): Promise<"shared" | "copied" | "cancelled"> {
  const payload = missionSharePayload(session, origin);
  const channel = port.share ? "native" : "clipboard";
  if (!port.share && !port.copy)
    throw new Error("이 브라우저에서는 공유를 지원하지 않아요.");
  const event = (name: ClientEventInput["name"]) => {
    try {
      track({ name, sessionId: session.id, properties: { channel } });
    } catch {
      /* telemetry must not block sharing */
    }
  };
  event("mission_share_requested");
  try {
    if (port.share) await port.share(payload);
    else await port.copy!(`${payload.text}\n${payload.url}`);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      return "cancelled";
    throw new Error(
      "공유하지 못했어요. 브라우저 권한을 확인한 뒤 다시 시도해주세요.",
    );
  }
  event("mission_shared");
  return channel === "native" ? "shared" : "copied";
}
