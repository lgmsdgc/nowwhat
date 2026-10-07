export type DataConfig =
  { mode: "local" } | { mode: "supabase"; url: string; publishableKey: string };

export function parseDataConfig(
  mode?: string,
  url?: string,
  key?: string,
): DataConfig {
  if (!mode || mode === "local") return { mode: "local" };
  if (mode !== "supabase") throw new Error("저장 방식 설정을 확인해주세요.");
  let validUrl = false;
  try {
    const parsed = new URL(url ?? "");
    validUrl =
      parsed.protocol === "https:" ||
      (parsed.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(parsed.hostname));
  } catch {
    /* Invalid configuration */
  }
  if (
    !validUrl ||
    !key ||
    !(key.startsWith("sb_publishable_") || key.split(".").length === 3)
  )
    throw new Error("Supabase URL과 공개 키 설정을 확인해주세요.");
  // Legacy JWT keys must be the anon key, never the service_role key.
  if (!key.startsWith("sb_publishable_")) {
    try {
      const payload: unknown = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("role" in payload) ||
        payload.role !== "anon"
      )
        throw new Error();
    } catch {
      throw new Error(
        "공개 환경 변수에는 publishable 또는 anon 키만 사용할 수 있어요.",
      );
    }
  }
  return { mode: "supabase", url: url!, publishableKey: key };
}
export function getDataConfig() {
  return parseDataConfig(
    process.env.NEXT_PUBLIC_DATA_MODE,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
