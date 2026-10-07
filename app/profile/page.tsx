import type { Metadata } from "next";
import { ProfileScreen } from "@/features/profile/ProfileScreen";
export const metadata: Metadata = { title: "내 레벨과 칭호" };
export default function ProfilePage() {
  return <ProfileScreen />;
}
