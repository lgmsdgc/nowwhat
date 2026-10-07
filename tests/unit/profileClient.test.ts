import { afterEach, describe, expect, it, vi } from "vitest";
import { achievements } from "@/seed/achievements";
const token = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/browser", () => ({ accessToken: token }));
import { loadProgression } from "@/services/profileClientService";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
describe("private progression requests", () => {
  it("sends a verified session token, disables caching and validates the response", async () => {
    token.mockResolvedValue("verified-token");
    const request = vi.fn<typeof fetch>(async () =>
      Response.json({ achievements, unlocks: [] }),
    );
    vi.stubGlobal("fetch", request);
    const data = await loadProgression(new AbortController().signal);
    expect(data.achievements).toHaveLength(9);
    expect(request.mock.calls[0]).toMatchObject([
      "/api/profile",
      {
        headers: { Authorization: "Bearer verified-token" },
        cache: "no-store",
      },
    ]);
  });
  it("does not replace a failed DB response with offline predicted titles", async () => {
    token.mockResolvedValue("verified-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "private SQL details" }, { status: 503 }),
      ),
    );
    await expect(loadProgression(new AbortController().signal)).rejects.toThrow(
      "칭호를 불러오지 못했어요",
    );
  });
  it("rejects unsupported server rules instead of rendering incomplete awards", async () => {
    token.mockResolvedValue("verified-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          achievements: [{ ...achievements[0], conditionType: "unknown" }],
          unlocks: [],
        }),
      ),
    );
    await expect(loadProgression(new AbortController().signal)).rejects.toThrow(
      "칭호를 불러오지 못했어요",
    );
  });
  it("cancels an obsolete request after ownership changes", async () => {
    token.mockResolvedValue("verified-token");
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, options) => {
        options?.signal?.throwIfAborted();
        return Response.json({});
      }),
    );
    await expect(loadProgression(controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
