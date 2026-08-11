"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { enablePush, disablePush, getPushPermissionState } from "@/lib/push/subscribe-client";
import type { UserSettings } from "@/lib/supabase/database.types";

const DEFAULT_PREFS: UserSettings["notification_prefs"] = { messages: true, friend_requests: true, calls: true };

export function NotificationSettings({ userId }: { userId: string }) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | null>(null);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getPushPermissionState().then(setPermission);
    const supabase = createClient();
    supabase
      .from("user_settings")
      .select("notification_prefs")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.notification_prefs) setPrefs(data.notification_prefs);
      });
  }, [userId]);

  async function handleEnable() {
    setLoading(true);
    const result = await enablePush(userId);
    setLoading(false);
    if (result.ok) {
      setPermission("granted");
      setMessage("通知を有効にしました");
    } else {
      setMessage(result.error ?? "通知を有効にできませんでした");
    }
  }

  async function handleDisable() {
    setLoading(true);
    await disablePush(userId);
    setLoading(false);
    setPermission("default");
    setMessage("通知を無効にしました");
  }

  async function updatePref(key: keyof typeof prefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const supabase = createClient();
    await supabase.from("user_settings").upsert({ user_id: userId, notification_prefs: next, updated_at: new Date().toISOString() });
  }

  if (permission === "unsupported") {
    return <p className="text-xs text-[var(--muted)]">このブラウザはプッシュ通知に対応していません。</p>;
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">プッシュ通知</p>
        {permission === "granted" ? (
          <Button size="sm" variant="secondary" onClick={handleDisable} disabled={loading}>
            <BellOff size={14} /> オフにする
          </Button>
        ) : (
          <Button size="sm" onClick={handleEnable} disabled={loading}>
            <Bell size={14} /> 有効にする
          </Button>
        )}
      </div>

      {permission === "granted" && (
        <div className="space-y-2 pt-1">
          <ToggleRow label="新着メッセージ" checked={prefs.messages} onChange={(v) => updatePref("messages", v)} />
          <ToggleRow label="友達申請" checked={prefs.friend_requests} onChange={(v) => updatePref("friend_requests", v)} />
          <ToggleRow label="着信" checked={prefs.calls} onChange={(v) => updatePref("calls", v)} />
        </div>
      )}
      {message && <p className="text-xs text-[var(--muted)]">{message}</p>}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between text-sm">
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
    </label>
  );
}
