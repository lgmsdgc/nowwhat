import { describe, expect, it, vi } from "vitest";
import {
  createCallbackCompletion,
  type CallbackPort,
} from "@/services/authCallbackService";

function port(): CallbackPort {
  return {
    exchange: vi.fn(async () => {}),
    isMember: vi.fn(async () => true),
    finishMigration: vi.fn(async () => {}),
    refresh: vi.fn(async () => {}),
  };
}
describe("recoverable Auth callback", () => {
  it("coalesces concurrent effects and consumes a PKCE code once", async () => {
    const service = port();
    const complete = createCallbackCompletion(
      { code: "one-use", flowId: "flow", cancelled: false },
      service,
    );
    await Promise.all([complete(), complete()]);
    expect(service.exchange).toHaveBeenCalledOnce();
    expect(service.finishMigration).toHaveBeenCalledOnce();
    expect(service.exchange).toHaveBeenCalledWith("one-use", "flow");
  });
  it("retries failed migration without exchanging an already consumed code", async () => {
    const service = port();
    vi.mocked(service.finishMigration).mockRejectedValueOnce(
      new Error("temporary failure"),
    );
    const complete = createCallbackCompletion(
      { code: "one-use", cancelled: false },
      service,
    );
    await expect(complete()).rejects.toThrow("temporary failure");
    await complete();
    expect(service.exchange).toHaveBeenCalledOnce();
    expect(service.finishMigration).toHaveBeenCalledTimes(2);
    expect(service.refresh).toHaveBeenCalledOnce();
  });
  it("retries a failed exchange while retaining callback input in memory", async () => {
    const service = port();
    vi.mocked(service.exchange).mockRejectedValueOnce(new Error("offline"));
    const complete = createCallbackCompletion(
      { code: "retained", cancelled: false },
      service,
    );
    await expect(complete()).rejects.toThrow("offline");
    await complete();
    expect(service.exchange).toHaveBeenCalledTimes(2);
    expect(service.finishMigration).toHaveBeenCalledOnce();
  });
  it("recovers a reload for an authenticated member and refuses guests or cancelled logins", async () => {
    const service = port();
    await createCallbackCompletion({ code: null, cancelled: false }, service)();
    expect(service.exchange).not.toHaveBeenCalled();
    expect(service.finishMigration).toHaveBeenCalledOnce();
    const guest = port();
    vi.mocked(guest.isMember).mockResolvedValue(false);
    await expect(
      createCallbackCompletion({ code: null, cancelled: false }, guest)(),
    ).rejects.toThrow("인증");
    expect(guest.finishMigration).not.toHaveBeenCalled();
    await expect(
      createCallbackCompletion({ code: "unused", cancelled: true }, guest)(),
    ).rejects.toThrow("취소");
    expect(guest.exchange).not.toHaveBeenCalled();
  });
});
