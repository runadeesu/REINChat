"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const HEARTBEAT_INTERVAL_MS = 25_000;

// Keeps profiles.last_online_at fresh while the app is open in a tab, so
// other users' "online"/"最終オンライン" status is real data, not a stub.
export function PresenceHeartbeat({ userId }: { userId: string }) {
  useEffect(() => {
    const supabase = createClient();

    async function beat() {
      await supabase.from("profiles").update({ is_online: true, last_online_at: new Date().toISOString() }).eq("id", userId);
    }

    beat();
    const interval = setInterval(beat, HEARTBEAT_INTERVAL_MS);

    function handleVisibility() {
      if (document.visibilityState === "visible") beat();
    }
    document.addEventListener("visibilitychange", handleVisibility);

    async function markOffline() {
      await supabase.from("profiles").update({ is_online: false }).eq("id", userId);
    }
    window.addEventListener("beforeunload", markOffline);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", markOffline);
    };
  }, [userId]);

  return null;
}
