"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getDiscordLinkStatus, unlinkDiscord } from "@/lib/actions/discord-link";

export function DiscordLinkSection() {
  const [status, setStatus] = useState<{ linked: boolean; discordUsername: string | null } | null>(null);

  function load() {
    getDiscordLinkStatus().then((r) => {
      if (!r.error) setStatus({ linked: Boolean(r.linked), discordUsername: r.discordUsername ?? null });
    });
  }

  useEffect(load, []);

  async function handleUnlink() {
    if (!confirm("Discord連携を解除しますか?")) return;
    await unlinkDiscord();
    load();
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Discord連携</p>
        {status?.linked ? (
          <Button size="sm" variant="secondary" onClick={handleUnlink}>
            連携を解除
          </Button>
        ) : (
          <span className="text-xs text-[var(--muted)]">未連携</span>
        )}
      </div>
      {status?.linked && <p className="text-xs text-[var(--muted)]">連携済み(@{status.discordUsername})</p>}
      <p className="text-xs text-[var(--muted)]">
        Discordサーバーで <code className="rounded bg-[var(--surface)] px-1">/verify-reinchat</code> を実行すると連携できます。
      </p>
    </div>
  );
}
