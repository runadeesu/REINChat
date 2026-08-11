"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { profileUpdateSchema } from "@/lib/validation/schemas";

export async function updateProfile(input: unknown) {
  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "認証が必要です" };

  const data: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.displayName !== undefined) data.display_name = parsed.data.displayName;
  if (parsed.data.displayId !== undefined) data.display_id = parsed.data.displayId;
  if (parsed.data.bio !== undefined) data.bio = parsed.data.bio;
  if (parsed.data.statusMessage !== undefined) data.status_message = parsed.data.statusMessage;

  const { error } = await supabase.from("profiles").update(data).eq("id", user.id);
  if (error) {
    return { error: error.code === "23505" ? "そのIDはすでに使用されています" : "更新に失敗しました" };
  }

  revalidatePath("/profile");
  return { ok: true };
}

export async function updateAvatar(url: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "認証が必要です" };

  await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  revalidatePath("/profile");
  return { ok: true };
}

export async function updateBackground(url: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "認証が必要です" };

  await supabase.from("profiles").update({ background_url: url }).eq("id", user.id);
  revalidatePath("/profile");
  return { ok: true };
}
