"use client";
import { accessToken } from "@/lib/supabase/browser";
import { progressionResponseSchema } from "@/lib/validation/progression";

export async function loadProgression(signal: AbortSignal) {
  try {
    const token = await accessToken();
    const response = await fetch("/api/profile", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
    });
    if (!response.ok) throw new Error("Profile request failed");
    return progressionResponseSchema.parse(await response.json());
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(
      "칭호를 불러오지 못했어요. 연결을 확인한 뒤 다시 시도해주세요.",
    );
  }
}
