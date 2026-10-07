"use client";
import { useEffect, useState } from "react";
import { getDataConfig } from "@/lib/config/dataSource";
import { achievements } from "@/seed/achievements";
import { localProgression } from "@/services/progressionService";
import { loadProgression } from "@/services/profileClientService";
import type { LocalState } from "@/types/game";
import type { Progression } from "@/types/progression";

export function useProgression(state: LocalState) {
  const local = getDataConfig().mode === "local";
  const [attempt, setAttempt] = useState(0);
  const [remote, setRemote] = useState<{
    key: string;
    data?: Progression;
    error?: string;
  } | null>(null);
  const key = JSON.stringify([
    state.anonymousId,
    state.sessions
      .filter((s) => s.status === "completed")
      .map((s) => [s.id, s.completedAt]),
  ]);
  useEffect(() => {
    if (local) return;
    const controller = new AbortController();
    void loadProgression(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setRemote({ key, data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setRemote({
            key,
            error:
              error instanceof Error ? error.message : "칭호를 읽지 못했어요.",
          });
      });
    return () => controller.abort();
  }, [local, key, attempt]);
  useEffect(() => {
    if (local) return;
    const refresh = () => setAttempt((value) => value + 1);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [local]);
  const retry = () => {
    setRemote(null);
    setAttempt((value) => value + 1);
  };
  return local
    ? { data: localProgression(state, achievements), error: undefined, retry }
    : {
        data: remote?.key === key ? remote.data : undefined,
        error: remote?.key === key ? remote.error : undefined,
        retry,
      };
}
