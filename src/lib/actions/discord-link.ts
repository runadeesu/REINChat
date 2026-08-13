"use server";

import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function confirmDiscordLink(code: string) {
  const user = await requireUser();
  if (!user) return { error: "認証が必要です" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_discord_link", { code_input: code });
  if (error) {
    return { error: error.message === "code_expired" ? "リンクの有効期限が切れています" : "連携に失敗しました" };
  }

  return { ok: true, discordUsername: data as string };
}

export async function getDiscordLinkStatus() {
  const user = await requireUser();
  if (!user) return { error: "認証が必要です" };

  const supabase = await createClient();
  const { data } = await supabase.from("discord_links").select("discord_username, linked_at").eq("user_id", user.id).maybeSingle();

  return { linked: Boolean(data), discordUsername: data?.discord_username ?? null };
}

export async function unlinkDiscord() {
  const user = await requireUser();
  if (!user) return { error: "認証が必要です" };

  const supabase = await createClient();
  const { error } = await supabase.from("discord_links").delete().eq("user_id", user.id);
  if (error) return { error: error.message };

  return { ok: true };
}
