export const money = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;
export function elapsedLabel(seconds: number) {
  if (seconds < 60) return "1분 미만";
  const minutes = Math.floor(seconds / 60);
  return minutes < 60
    ? `${minutes}분`
    : `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
}
