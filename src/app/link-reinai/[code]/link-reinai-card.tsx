"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmReinAiLink } from "@/lib/actions/reinai-link";

type Status = "ready" | "confirming" | "done" | "error";

export function LinkReinAiCard({ code }: { code: string }) {
  const [status, setStatus] = useState<Status>("ready");
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setStatus("confirming");
    const result = await confirmReinAiLink(code);
    if (result.ok) {
      setStatus("done");
    } else {
      setError(result.error ?? "連携に失敗しました");
      setStatus("error");
    }
  }

  if (status === "ready") {
    return (
      <>
        <h1 className="text-lg font-semibold">ReinAI連携</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">このREINChatアカウントをReinAIアカウントと連携しますか?</p>
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
        <p className="mt-1 text-sm text-[var(--muted)]">次回からはワンクリックでReinAIとREINChatを行き来できます。</p>
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
      <p className="mt-1 text-xs text-[var(--muted)]">ReinAIの設定画面からもう一度お試しください。</p>
    </>
  );
}
