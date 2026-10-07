export interface CallbackPort {
  exchange(code: string, flowId?: string): Promise<void>;
  isMember(): Promise<boolean>;
  finishMigration(): Promise<void>;
  refresh(): Promise<void>;
}
/** Coalesces double mounts and retries migration without consuming a PKCE code twice. */
export function createCallbackCompletion(
  input: { code: string | null; flowId?: string; cancelled: boolean },
  port: CallbackPort,
) {
  let exchange: Promise<void> | undefined;
  let inFlight: Promise<void> | undefined;
  const run = async () => {
    if (input.cancelled)
      throw new Error("연결이 취소되었어요. 가입 화면에서 다시 시작해주세요.");
    if (input.code) {
      exchange ??= port.exchange(input.code, input.flowId).catch((error) => {
        exchange = undefined;
        throw error;
      });
      await exchange;
    }
    // Reload after a successful exchange has no code, but the verified member
    // session and saved one-use migration proof allow safe recovery.
    if (!(await port.isMember()))
      throw new Error(
        "인증을 먼저 완료해주세요. 가입을 시작한 브라우저에서 다시 시도해주세요.",
      );
    await port.finishMigration();
    await port.refresh();
  };
  return () => {
    inFlight ??= run().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  };
}
