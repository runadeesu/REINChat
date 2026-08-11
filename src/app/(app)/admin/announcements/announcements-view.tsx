"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createAnnouncement, deleteAnnouncement, setAnnouncementActive } from "@/lib/actions/admin";
import type { Announcement } from "@/lib/supabase/database.types";

export function AnnouncementsView({ initialAnnouncements }: { initialAnnouncements: Announcement[] }) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    const trimmed = message.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result = await createAnnouncement(trimmed);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setMessage("");
      setAnnouncements((prev) => [
        { id: crypto.randomUUID(), message: trimmed, active: true, created_by: null, created_at: new Date().toISOString() },
        ...prev,
      ]);
    });
  }

  function toggleActive(item: Announcement) {
    startTransition(async () => {
      const result = await setAnnouncementActive(item.id, !item.active);
      if (result.error) {
        setError(result.error);
        return;
      }
      setAnnouncements((prev) => prev.map((a) => (a.id === item.id ? { ...a, active: !item.active } : a)));
    });
  }

  function remove(item: Announcement) {
    if (!window.confirm("このお知らせを削除しますか？")) return;
    startTransition(async () => {
      const result = await deleteAnnouncement(item.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setAnnouncements((prev) => prev.filter((a) => a.id !== item.id));
    });
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex gap-2"
      >
        <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="全ユーザーに表示するお知らせを入力" />
        <Button type="submit" disabled={isPending || !message.trim()}>
          投稿
        </Button>
      </form>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <ul className="space-y-2">
        {announcements.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] p-3">
            <div className="min-w-0">
              <p className="text-sm">{item.message}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {format(new Date(item.created_at), "yyyy/MM/dd HH:mm", { locale: ja })} ・
                {item.active ? "公開中" : "非公開"}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="secondary" onClick={() => toggleActive(item)} disabled={isPending}>
                {item.active ? "非公開にする" : "公開する"}
              </Button>
              <Button size="sm" variant="danger" onClick={() => remove(item)} disabled={isPending}>
                <Trash2 size={14} />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
