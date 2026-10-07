"use client";
import { useEffect, useState } from "react";
import { getDataConfig } from "@/lib/config/dataSource";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export function useIdentity() {
  const local = getDataConfig().mode === "local";
  const [identity, setIdentity] = useState<
    "loading" | "local" | "guest" | "member" | "error"
  >(local ? "local" : "loading");
  useEffect(() => {
    let active = true;
    if (local) return;
    const auth = getBrowserSupabase().auth;
    const { data } = auth.onAuthStateChange((_event, session) => {
      if (active)
        setIdentity(session?.user.is_anonymous === false ? "member" : "guest");
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [local]);
  return identity;
}
