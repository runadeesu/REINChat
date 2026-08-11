"use client";

import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Announcement } from "@/lib/supabase/database.types";

const DISMISSED_KEY = "reinchat-dismissed-announcements";

function readDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("announcements")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setAnnouncements(data as Announcement[]);
      });

    const channel = supabase
      .channel("announcements-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
        supabase
          .from("announcements")
          .select("*")
          .eq("active", true)
          .order("created_at", { ascending: false })
          .then(({ data }) => {
            if (data) setAnnouncements(data as Announcement[]);
          });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  function dismiss(id: string) {
    const next = [...dismissed, id];
    setDismissed(next);
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  }

  const visible = announcements.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 border-b border-[var(--border)] bg-[var(--primary)]/5 px-4 py-2">
      {visible.map((item) => (
        <div key={item.id} className="flex items-start gap-2 text-sm">
          <Megaphone size={16} className="mt-0.5 shrink-0 text-[var(--primary)]" />
          <p className="min-w-0 flex-1 break-words">{item.message}</p>
          <button onClick={() => dismiss(item.id)} className="shrink-0 text-[var(--muted)] hover:text-[var(--foreground)]" aria-label="閉じる">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
