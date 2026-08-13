"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmDiscordLink } from "@/lib/actions/discord-link";

type Status = "ready" | "confirming" | "done" | "error";

export function LinkDiscordCard({ code }: { code: string }) {
  const [status, setStatus] = useState<Status>("ready");
  const [error, setError] = useState<string | null>(null);
  const [discordUsername, setDiscordUsername] = useState("");

  async function handleConfirm() {
    setStatus("confirming");
    const result = await confirmDiscordLink(code);
    if (result.ok) {
      setDiscordUsername(result.discordUsername ?? "");
      setStatus("done");
    } else {
      setError(result.error ?? "連携に失敗しました");
      setStatus("error");
    }
  }

  if (status === "ready") {
    return (
      <>
        <h1 className="text-lg font-semibold">Discord連携</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">このREINChatアカウントをDiscordアカウントと連携しますか?</p>
        <Button className="mt-5 w-full" onClick={handleConfirm}>
          連携する
        </Button>
      </>
    );
  }

  if (status === "confirming") {
    return <p className="text-sm text-[var(--muted)]">連携中...</p>;
  }

  if (status === "done") {
    return (
      <>
        <CheckCircle2 size={36} className="mx-auto text-green-500" />
        <h1 className="mt-3 text-lg font-semibold">連携が完了しました</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          @{discordUsername} との連携が完了しました。Discordサーバーに戻って認証済みロールが付与されるのをお待ちください。
        </p>
        <Link href="/chats" className="mt-5 inline-block">
          <Button variant="secondary">REINChatに戻る</Button>
        </Link>
      </>
    );
  }

  return (
    <>
      <XCircle size={36} className="mx-auto text-[var(--danger)]" />
      <h1 className="mt-3 text-lg font-semibold">連携できませんでした</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">{error}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">Discordでもう一度 /verify-reinchat を実行して、新しいリンクから試してください。</p>
    </>
  );
}
