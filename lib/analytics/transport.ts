"use client";
import { z } from "zod";
import { accessToken } from "@/lib/supabase/browser";
import type { ClientEvent } from "@/types/analytics";

/** Replace this transport to add a provider later; domain event names stay unchanged. */
export interface AnalyticsTransport {
  send(anonymousId: string, events: readonly ClientEvent[]): Promise<void>;
}
export class HttpAnalyticsTransport implements AnalyticsTransport {
  constructor(
    private token = accessToken,
    private request: typeof fetch = fetch,
  ) {}
  async send(anonymousId: string, events: readonly ClientEvent[]) {
    const token = await this.token();
    const response = await this.request("/api/analytics", {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ anonymousId, events }),
    });
    if (!response.ok) throw new Error("Analytics delivery failed");
    z.strictObject({ accepted: z.number().int().min(0).max(20) }).parse(
      await response.json(),
    );
  }
}
