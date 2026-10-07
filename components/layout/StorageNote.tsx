"use client";
import { getDataConfig } from "@/lib/config/dataSource";

export function StorageNote({
  kind,
}: {
  kind: "onboarding" | "recommendation" | "complete" | "missing";
}) {
  const cloud = getDataConfig().mode === "supabase";
  if (kind === "missing")
    return cloud ? (
      <>현재 연결된 사용자의 기록에서 찾지 못했어요.</>
    ) : (
      <>
        기록은 미션을 시작한 브라우저에 있어요.
        <br />
        다른 브라우저에서 열었거나 기록이 지워졌을 수 있어요.
      </>
    );
  if (kind === "complete")
    return cloud ? (
      <>
        기록을 저장했어요.
        <br />
        익명 연결을 유지하려면 브라우저 데이터를 남겨주세요.
      </>
    ) : (
      <>
        이 브라우저에 기록했어요.
        <br />
        브라우저 데이터를 지우면 기록도 사라져요.
      </>
    );
  return cloud ? (
    <>선택과 기록이 자동 저장돼요.</>
  ) : (
    <>
      {kind === "onboarding" ? "선택과 기록" : "추천과 선택"}은 이 브라우저에
      저장돼요.
    </>
  );
}
