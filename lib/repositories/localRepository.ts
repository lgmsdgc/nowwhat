import { localStateSchema } from "@/lib/validation/models";
import {
  createInitialState,
  transition,
  type GameCommand,
  type GameEnvironment,
} from "@/services/gameplayService";
import type { LocalState } from "@/types/game";
import {
  appendEvents,
  gameAnalytics,
  localClientEvent,
} from "@/services/analyticsService";
import type { ClientEvent } from "@/types/analytics";

export const STORAGE_KEY = "nowwhat:state:v1";
export class StorageFailure extends Error {
  constructor(
    message: string,
    public kind: "unavailable" | "corrupt" | "version",
  ) {
    super(message);
  }
}
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class LocalRepository {
  constructor(private storage: StoragePort) {}

  read(): LocalState | null {
    let raw: string | null;
    try {
      raw = this.storage.getItem(STORAGE_KEY);
    } catch {
      throw new StorageFailure(
        "브라우저에서 기록을 읽지 못했어요. 저장 공간 사용을 허용한 뒤 다시 시도해주세요.",
        "unavailable",
      );
    }
    if (raw === null) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new StorageFailure(
        "저장된 기록이 손상되어 읽을 수 없어요. 기존 기록은 지우지 않았어요.",
        "corrupt",
      );
    }
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      parsed.version !== 1
    )
      throw new StorageFailure(
        "다른 버전의 기록이에요. 앱을 새로고침해주세요. 기존 기록은 유지했어요.",
        "version",
      );
    const validated = localStateSchema.safeParse(parsed);
    if (!validated.success)
      throw new StorageFailure(
        "저장된 기록의 형식을 확인할 수 없어요. 기존 기록은 지우지 않았어요.",
        "corrupt",
      );
    return validated.data;
  }

  write(state: LocalState): LocalState {
    const safe = localStateSchema.parse(state);
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(safe));
    } catch {
      throw new StorageFailure(
        "저장하지 못했어요. 브라우저 저장 공간을 확인한 뒤 다시 시도해주세요. 이전 기록은 그대로예요.",
        "unavailable",
      );
    }
    return safe;
  }

  initialize(env: GameEnvironment): LocalState {
    return this.read() ?? this.write(createInitialState(env.id(), env.now));
  }

  execute(command: GameCommand, env: GameEnvironment) {
    const before = this.read();
    if (!before)
      throw new StorageFailure(
        "저장된 기록이 사라졌어요. 새로고침해서 다시 시작해주세요.",
        "unavailable",
      );
    const result = transition(before, command, env);
    if (env.analyticsContext) {
      try {
        result.state.analyticsEvents = appendEvents(
          before.analyticsEvents,
          gameAnalytics(before, result.state, env.analyticsContext, env.id),
        );
      } catch {
        // Optional telemetry must not invalidate a valid gameplay transition.
        result.state.analyticsEvents = before.analyticsEvents;
      }
    }
    try {
      return { ...result, state: this.write(result.state) };
    } catch (error) {
      if (
        !(error instanceof StorageFailure) ||
        error.kind !== "unavailable" ||
        !result.state.analyticsEvents.length
      )
        throw error;
      // If telemetry exhausted the quota, prioritize the game record. The
      // failed atomic write left the previous record intact; retry only once.
      return {
        ...result,
        state: this.write({ ...result.state, analyticsEvents: [] }),
      };
    }
  }

  appendAnalytics(anonymousId: string, events: readonly ClientEvent[]) {
    const state = this.read();
    if (!state || state.anonymousId !== anonymousId) return;
    state.analyticsEvents = appendEvents(
      state.analyticsEvents,
      events.map((event) => localClientEvent(state, event)),
    );
    this.write(state);
  }

  recover(env: GameEnvironment): LocalState {
    // Only malformed records may be reset, and a successful backup must come first.
    try {
      this.read();
      throw new Error("복구할 손상 기록이 없어요.");
    } catch (error) {
      if (!(error instanceof StorageFailure) || error.kind !== "corrupt")
        throw error;
    }
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw !== null)
        this.storage.setItem(`${STORAGE_KEY}:backup:${env.id()}`, raw);
    } catch {
      throw new StorageFailure(
        "기존 기록을 백업하지 못해 새 기록을 만들지 않았어요.",
        "unavailable",
      );
    }
    return this.write(createInitialState(env.id(), env.now));
  }
}
