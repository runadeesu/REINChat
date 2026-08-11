"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { registerSchema } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = registerSchema.safeParse({ email, password, displayName });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "入力内容を確認してください");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { display_name: parsed.data.displayName },
        emailRedirectTo: `${window.location.origin}/auth/confirm?type=email`,
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="text-lg font-semibold">確認メールを送信しました</h1>
        <p className="text-sm text-[var(--muted)]">
          {email} 宛にメールを送信しました。メール内のリンクをクリックしてアカウントを有効化してください。
        </p>
        <Link href="/login" className="inline-block text-sm text-[var(--primary)] hover:underline">
          ログイン画面に戻る
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-6 text-center text-lg font-semibold">新規登録</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted)]">表示名</label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="レイン" required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted)]">メールアドレス</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted)]">パスワード</label>
          <Input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "登録中..." : "登録する"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-[var(--muted)]">
        すでにアカウントをお持ちの方は{" "}
        <Link href="/login" className="text-[var(--primary)] hover:underline">
          ログイン
        </Link>
      </p>
    </>
  );
}
