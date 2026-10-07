"use client";

import { useRef, useState } from "react";

export function useGameAction() {
  const active = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(task: () => Promise<void>) {
    if (active.current) return;
    active.current = true;
    setPending(true);
    setError(null);
    try {
      await task();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "처리하지 못했어요. 다시 시도해주세요.",
      );
    } finally {
      active.current = false;
      setPending(false);
    }
  }
  return { pending, error, run };
}
