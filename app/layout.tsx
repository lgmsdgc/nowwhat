import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { AnalyticsBoundary } from "@/components/analytics/AnalyticsBoundary";
import "./globals.css";

const roundedFont = localFont({
  src: [
    {
      path: "./fonts/NanumSquareRoundOTFR.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/NanumSquareRoundOTFB.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/NanumSquareRoundOTFEB.otf",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--font-rounded",
  display: "swap",
  fallback: ["Arial", "Apple SD Gothic Neo", "Malgun Gothic"],
});

export const metadata: Metadata = {
  title: {
    default: "NowWhat — 생각하기 귀찮을 때, 뭐하지?",
    template: "%s | NowWhat",
  },
  description:
    "고르는 건 우리가 할게. 넌 하기만 해. 지금 상황에 맞는 작은 미션 하나로 오늘을 조금 더 재밌게.",
  applicationName: "NowWhat",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f7ef",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${roundedFont.variable} antialiased`}
      data-scroll-behavior="smooth"
    >
      <body>
        <AnalyticsBoundary />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
