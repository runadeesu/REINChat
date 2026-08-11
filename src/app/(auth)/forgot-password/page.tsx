"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { forgotPasswordSchema } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "入力内容を確認してください");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/auth/confirm?type=recovery`,
    });
    setLoading(false);
    // Always show success, regardless of whether the address exists — avoids
    // leaking which emails have accounts.
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="text-lg font-semibold">メールを送信しました</h1>
        <p className="text-sm text-[var(--muted)]">
          {email} 宛にパスワード再設定用のリンクを送信しました(該当するアカウントが存在する場合)。
        </p>
        <Link href="/login" className="inline-block text-sm text-[var(--primary)] hover:underline">
          ログイン画面に戻る
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-6 text-center text-lg font-semibold">パスワードをお忘れですか?</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted)]">メールアドレス</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "送信中..." : "再設定リンクを送信"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="text-[var(--muted)] hover:text-[var(--foreground)]">
          ログイン画面に戻る
        </Link>
      </p>
    </>
  );
}
