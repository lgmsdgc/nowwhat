import type { Metadata } from "next";
import { AuthCallback } from "@/features/account/AuthCallback";
export const metadata: Metadata = {
  title: "기록 연결",
  referrer: "no-referrer",
};
export default function CallbackPage() {
  return <AuthCallback />;
}
