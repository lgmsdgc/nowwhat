"use client";

import { useSyncExternalStore } from "react";
import {
  LocalRepository,
  STORAGE_KEY,
  StorageFailure,
} from "@/lib/repositories/localRepository";
import { missions } from "@/seed/missions";
import type { GameCommand } from "@/services/gameplayService";
import type { LocalState } from "@/types/game";
import { getDataConfig } from "@/lib/config/dataSource";
import { accessToken, getBrowserSupabase } from "@/lib/supabase/browser";
import { RemoteRepository } from "@/lib/repositories/remoteRepository";
import { visitContext } from "@/lib/analytics/visit";
import { recordClientEvent } from "@/services/analyticsClientService";
import { activeSession } from "@/services/gameplayService";
import { onboardingSchema } from "@/lib/validation/models";

type Snapshot =
  | { status: "loading" }
  | { status: "ready"; data: LocalState }
  | { status: "error"; message: string; recoverable: boolean };
const initialSnapshot: Snapshot = { status: "loading" };
let snapshot: Snapshot = initialSnapshot;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | undefined;
let stopAuthListener: (() => void) | undefined;
let identityEpoch = 0;
const remote = () => new RemoteRepository(accessToken, fetch, visitContext);
const publish = (next: Snapshot) => {
  snapshot = next;
  listeners.forEach((fn) => fn());
};
const environment = () => ({
  now: new Date(),
  id: () => crypto.randomUUID(),
  random: Math.random,
  missions,
  analyticsContext: visitContext(),
});

function repository() {
  try {
    return new LocalRepository(window.localStorage);
  } catch {
    throw new StorageFailure(
      "브라우저가 저장 공간 사용을 막고 있어요. 설정을 확인한 뒤 다시 시도해주세요.",
      "unavailable",
    );
  }
}
async function locked<T>(operation: () => T | Promise<T>): Promise<T> {
  if (!navigator.locks)
    throw new StorageFailure(
      "기록을 안전하게 저장하려면 최신 브라우저의 HTTPS 환경에서 열어주세요.",
      "unavailable",
    );
  return navigator.locks.request(STORAGE_KEY, operation);
}
export async function refreshGameState() {
  const epoch = identityEpoch;
  try {
    await locked(async () => {
      const data =
        getDataConfig().mode === "local"
          ? repository().initialize(environment())
          : await remote().initialize();
      if (epoch === identityEpoch) publish({ status: "ready", data });
    });
  } catch (error) {
    if (epoch !== identityEpoch) return;
    publish({
      status: "error",
      message: error instanceof Error ? error.message : "기록을 읽지 못했어요.",
      recoverable: error instanceof StorageFailure && error.kind === "corrupt",
    });
  }
}
export async function recoverLocalState() {
  if (getDataConfig().mode !== "local")
    throw new Error("서버 기록은 브라우저에서 초기화할 수 없어요.");
  const data = await locked(() => repository().recover(environment()));
  publish({ status: "ready", data });
}
export async function dispatch(
  command: GameCommand,
  origin: "onboarding" | "repeat" = "repeat",
) {
  const epoch = identityEpoch;
  if (snapshot.status === "ready") {
    const state = snapshot.data;
    void recordClientEvent(state.anonymousId, {
      name: "visit_started",
      sessionId: null,
      properties: {},
    });
    if (
      (command.type === "request" && !activeSession(state)) ||
      command.type === "reroll"
    ) {
      if (
        command.type === "request" &&
        origin === "onboarding" &&
        onboardingSchema.safeParse(command.answers ?? state.onboarding.answers)
          .success
      )
        void recordClientEvent(state.anonymousId, {
          name: "onboarding_completed",
          sessionId: null,
          properties: {},
        });
      void recordClientEvent(state.anonymousId, {
        name: "mission_requested",
        sessionId: command.type === "reroll" ? command.sessionId : null,
        properties: {
          requestKind: command.type === "reroll" ? "reroll" : origin,
        },
      });
    }
  }
  return locked(async () => {
    if (epoch !== identityEpoch)
      throw new Error(
        "연결된 계정이 바뀌었어요. 현재 기록을 확인한 뒤 다시 시도해주세요.",
      );
    const result =
      getDataConfig().mode === "local"
        ? repository().execute(command, environment())
        : await remote().execute(command);
    if (epoch !== identityEpoch)
      throw new Error(
        "연결된 계정이 바뀌었어요. 현재 기록을 다시 불러와주세요.",
      );
    publish({ status: "ready", data: result.state });
    channel?.postMessage("refresh");
    return result;
  });
}
function onStorage(event: StorageEvent) {
  if (event.key === STORAGE_KEY || event.key === null) void refreshGameState();
}
function onFocus() {
  void refreshGameState();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("storage", onStorage);
    try {
      if (getDataConfig().mode === "supabase") {
        if (typeof BroadcastChannel !== "undefined") {
          channel = new BroadcastChannel("nowwhat:server-state");
          channel.onmessage = () => void refreshGameState();
        }
        window.addEventListener("focus", onFocus);
        let owner: string | undefined;
        const { data } = getBrowserSupabase().auth.onAuthStateChange(
          (event, session) => {
            const next = session?.user.id;
            if (event === "SIGNED_OUT" || (owner && next && owner !== next)) {
              identityEpoch++;
              publish(initialSnapshot);
              // Never call an async Auth method inside its locked callback.
              setTimeout(() => void refreshGameState(), 0);
            }
            owner = next;
          },
        );
        stopAuthListener = () => data.subscription.unsubscribe();
      }
    } catch {
      /* refreshGameState publishes configuration failures */
    }
    void refreshGameState();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      identityEpoch++;
      snapshot = initialSnapshot;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      channel?.close();
      channel = undefined;
      stopAuthListener?.();
      stopAuthListener = undefined;
    }
  };
}
export function useGameState() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => initialSnapshot,
  );
}
