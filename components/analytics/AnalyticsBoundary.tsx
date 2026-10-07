"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useGameState } from "@/lib/storage/browserStore";
import { activeSession } from "@/services/gameplayService";
import {
  recordClientEvent,
  flushAnalytics,
} from "@/services/analyticsClientService";

export function AnalyticsBoundary() {
  const snapshot = useGameState();
  const path = usePathname();
  const owner = snapshot.status === "ready" ? snapshot.data.anonymousId : null;
  const playing = snapshot.status !== "ready" || !!activeSession(snapshot.data);
  useEffect(() => {
    if (!owner) return;
    const trackPage = () => {
      void recordClientEvent(owner, {
        name: "visit_started",
        sessionId: null,
        properties: {},
      });
      if (path === "/")
        void recordClientEvent(owner, {
          name: "landing_view",
          sessionId: null,
          properties: {},
        });
      if (path === "/onboarding" && !playing)
        void recordClientEvent(owner, {
          name: "onboarding_started",
          sessionId: null,
          properties: {},
        });
    };
    const online = () => void flushAnalytics(owner);
    trackPage();
    window.addEventListener("focus", trackPage);
    // Connectivity returning in a background tab is not a user visit.
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("focus", trackPage);
      window.removeEventListener("online", online);
    };
  }, [owner, path, playing]);
  return null;
}
