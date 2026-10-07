import type { Metadata } from "next";
import { AccountScreen } from "@/features/account/AccountScreen";
export const metadata: Metadata = { title: "내 기록" };
export default function AccountPage() {
  return <AccountScreen />;
}
