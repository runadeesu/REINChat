"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "入力内容を確認してください");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);

    if (signInError) {
      setError(
        signInError.message.includes("Email not confirmed")
          ? "メールアドレスの確認が完了していません。受信箱をご確認ください。"
          : "メールアドレスまたはパスワードが正しくありません"
      );
      return;
    }

    router.push(searchParams.get("next") ?? "/chats");
    router.refresh();
  }

  return (
    <>
      <h1 className="mb-6 text-center text-lg font-semibold">ログイン</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted)]">メールアドレス</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted)]">パスワード</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "ログイン中..." : "ログイン"}
        </Button>
      </form>
      <div className="mt-4 flex flex-col items-center gap-2 text-sm">
        <Link href="/forgot-password" className="text-[var(--muted)] hover:text-[var(--foreground)]">
          パスワードをお忘れですか?
        </Link>
        <p className="text-[var(--muted)]">
          アカウントをお持ちでない方は{" "}
          <Link href="/register" className="text-[var(--primary)] hover:underline">
            新規登録
          </Link>
        </p>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
