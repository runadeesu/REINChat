"use server";

import { createClient } from "@/lib/supabase/server";
import { reinAiUrl } from "@/lib/reinai/shared-secret";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Called from /link-reinai/[code] once the user is logged into REINChat.
// Confirms the code (minted by ReinAI's /api/reinchat-link/start) back to
// ReinAI, authenticated with the shared secret since ReinAI has no session
// of its own for this REINChat user.
export async function confirmReinAiLink(code: string) {
  const user = await requireUser();
  if (!user) return { error: "認証が必要です" };

  const secret = process.env.REINCHAT_SHARED_SECRET;
  if (!secret) return { error: "連携が設定されていません" };

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("display_id").eq("id", user.id).single();
  if (!profile) return { error: "プロフィールが見つかりません" };

  const res = await fetch(`${reinAiUrl()}/api/reinchat-link/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-ReinChat-Secret": secret },
    body: JSON.stringify({
      code,
      reinchatUserId: user.id,
      reinchatEmail: user.email,
      reinchatDisplayId: profile.display_id,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { error: data.error ?? "連携に失敗しました" };
  }

  return { ok: true };
}

// Mints a one-time ReinAI login URL for the current REINChat user, if
// they've already linked a ReinAI account.
export async function getReinAiSsoUrl() {
  const user = await requireUser();
  if (!user) return { error: "認証が必要です" };

  const secret = process.env.REINCHAT_SHARED_SECRET;
  if (!secret) return { error: "連携が設定されていません" };

  const res = await fetch(`${reinAiUrl()}/api/reinchat-link/mint-sso`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-ReinChat-Secret": secret },
    body: JSON.stringify({ reinchatUserId: user.id }),
  });

  if (res.status === 404) return { error: "先にReinAI連携を行ってください" };
  if (!res.ok) return { error: "ReinAIへのログインに失敗しました" };

  const data = await res.json();
  return { url: data.url as string };
}
