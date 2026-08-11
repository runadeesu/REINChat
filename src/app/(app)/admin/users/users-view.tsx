"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchUsers, setUserSuspended } from "@/lib/actions/admin";
import type { Profile } from "@/lib/supabase/database.types";

export function UsersView() {
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runSearch(q: string) {
    startTransition(async () => {
      const result = await searchUsers(q);
      setSearched(true);
      if ("error" in result) {
        setError(result.error);
        setProfiles([]);
      } else {
        setError(null);
        setProfiles(result.profiles);
      }
    });
  }

  function toggleSuspend(profile: Profile) {
    const reason = profile.is_suspended ? undefined : window.prompt("停止理由を入力してください（任意）") ?? undefined;
    startTransition(async () => {
      const result = await setUserSuspended(profile.id, !profile.is_suspended, reason);
      if (result.error) {
        setError(result.error);
        return;
      }
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === profile.id
            ? { ...p, is_suspended: !profile.is_suspended, suspended_reason: profile.is_suspended ? null : reason ?? null }
            : p
        )
      );
    });
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(query);
        }}
        className="flex gap-2"
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="表示名またはIDで検索"
          aria-label="ユーザー検索"
        />
        <Button type="submit" disabled={isPending}>
          <Search size={16} /> 検索
        </Button>
      </form>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {searched && profiles.length === 0 && !error && (
        <p className="text-sm text-[var(--muted)]">該当するユーザーが見つかりませんでした。</p>
      )}

      <ul className="space-y-2">
        {profiles.map((profile) => (
          <li key={profile.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{profile.display_name}</p>
              <p className="truncate text-xs text-[var(--muted)]">
                @{profile.display_id} ・登録日 {format(new Date(profile.created_at), "yyyy/MM/dd", { locale: ja })}
              </p>
              {profile.is_suspended && (
                <p className="mt-1 text-xs text-[var(--danger)]">停止中{profile.suspended_reason ? `：${profile.suspended_reason}` : ""}</p>
              )}
            </div>
            <Button
              size="sm"
              variant={profile.is_suspended ? "secondary" : "danger"}
              onClick={() => toggleSuspend(profile)}
              disabled={isPending}
            >
              {profile.is_suspended ? (
                <>
                  <ShieldCheck size={14} /> 解除
                </>
              ) : (
                <>
                  <ShieldAlert size={14} /> 停止
                </>
              )}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
