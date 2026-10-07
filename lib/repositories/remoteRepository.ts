import { gameResponseSchema } from "@/lib/validation/commands";
import type { GameCommand } from "@/services/gameplayService";
import type { AnalyticsContext } from "@/types/analytics";

export class RemoteRepository {
  constructor(
    private token: () => Promise<string>,
    private request: typeof fetch = fetch,
    private context?: () => AnalyticsContext,
  ) {}
  private async send(command?: GameCommand) {
    const token = await this.token();
    let response: Response;
    try {
      response = await this.request("/api/game", {
        method: command ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(command ? { "Content-Type": "application/json" } : {}),
        },
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
        ...(command
          ? {
              body: JSON.stringify({
                command,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                ...(this.context ? { analytics: this.context() } : {}),
              }),
            }
          : {}),
      });
    } catch {
      throw new Error(
        "기록을 서버에 연결하지 못했어요. 연결을 확인한 뒤 다시 시도해주세요.",
      );
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error("서버 응답을 읽지 못했어요. 다시 시도해주세요.");
    }
    if (!response.ok) {
      const message =
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
          ? body.error
          : "기록을 저장하지 못했어요. 다시 시도해주세요.";
      throw new Error(message);
    }
    return gameResponseSchema.parse(body);
  }
  async initialize() {
    return (await this.send()).state;
  }
  execute(command: GameCommand) {
    return this.send(command);
  }
}
