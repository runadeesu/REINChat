"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getReinAiSsoUrl } from "@/lib/actions/reinai-link";

export function ReinAiLinkSection({ reinAiUrl }: { reinAiUrl: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    setLoading(true);
    const result = await getReinAiSsoUrl();
    setLoading(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    window.location.href = result.url!;
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">ReinAI連携</p>
        <div className="flex gap-2">
          <a href={`${reinAiUrl}/api/reinchat-link/start`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="secondary">
              連携する
            </Button>
          </a>
          <Button size="sm" onClick={handleOpen} disabled={loading}>
            ReinAIを開く
          </Button>
        </div>
      </div>
      {message && <p className="text-xs text-[var(--muted)]">{message}</p>}
      <p className="text-xs text-[var(--muted)]">
        ReinAIアカウントと連携すると、ワンクリックでReinAIとREINChatを行き来できるようになります。
      </p>
    </div>
  );
}
