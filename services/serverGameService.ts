import { randomUUID } from "node:crypto";
import { gameCommandSchema, storedGameSchema } from "@/lib/validation/commands";
import { localStateSchema } from "@/lib/validation/models";
import { transition, type GameCommand } from "@/services/gameplayService";
import type { LocalState, Mission } from "@/types/game";
import type { AnalyticsContext } from "@/types/analytics";
import { analyticsContextSchema } from "@/lib/validation/analytics";

export class RevisionConflict extends Error {}
export interface GameDatabase {
  read(): Promise<unknown>;
  missions(): Promise<readonly Mission[]>;
  commit(
    revision: number,
    state: LocalState,
    analytics?: AnalyticsContext,
  ): Promise<void>;
}
export async function readGame(database: GameDatabase) {
  return storedGameSchema.parse(await database.read()).state;
}
export async function executeGame(
  database: GameDatabase,
  command: GameCommand,
  timeZone: string,
  now: () => Date = () => new Date(),
  analytics?: AnalyticsContext,
) {
  const safeCommand = gameCommandSchema.parse(command);
  const context = analytics
    ? analyticsContextSchema.parse(analytics)
    : undefined;
  const missions = await database.missions();
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = storedGameSchema.parse(await database.read());
    const timestamp = now();
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        hour: "numeric",
        hourCycle: "h23",
        timeZone,
      }).format(timestamp),
    );
    const result = transition(before.state, safeCommand, {
      now: timestamp,
      localHour: hour,
      id: randomUUID,
      random: Math.random,
      missions,
    });
    result.state = localStateSchema.parse(result.state);
    try {
      if (context)
        await database.commit(before.revision, result.state, context);
      else await database.commit(before.revision, result.state);
      return result;
    } catch (error) {
      if (!(error instanceof RevisionConflict)) throw error;
    }
  }
  throw new RevisionConflict(
    "다른 화면에서 기록이 바뀌었어요. 다시 시도해주세요.",
  );
}
