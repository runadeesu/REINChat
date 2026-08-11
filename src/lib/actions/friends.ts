"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function searchByDisplayId(displayId: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "認証が必要です" };

  const trimmed = displayId.trim().replace(/^@/, "");
  if (!trimmed) return { error: "IDを入力してください" };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_id, display_name, avatar_url, status_message")
    .eq("display_id", trimmed)
    .maybeSingle();

  if (error || !data) return { error: "ユーザーが見つかりません" };
  if (data.id === user.id) return { error: "自分自身は追加できません" };

  return { profile: data };
}

export async function sendFriendRequest(receiverId: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "認証が必要です" };

  const { error } = await supabase.from("friend_requests").insert({ sender_id: user.id, receiver_id: receiverId });
  if (error) {
    return { error: error.code === "23505" ? "すでに申請済みです" : error.message };
  }

  revalidatePath("/friends");
  return { ok: true };
}

export async function respondFriendRequest(requestId: string, action: "accept" | "reject" | "cancel") {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "認証が必要です" };

  if (action === "accept") {
    const { error } = await supabase.rpc("accept_friend_request", { request_id: requestId });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("friend_requests")
      .update({ status: action === "reject" ? "rejected" : "cancelled", updated_at: new Date().toISOString() })
      .eq("id", requestId);
    if (error) return { error: error.message };
  }

  revalidatePath("/friends");
  return { ok: true };
}

export async function removeFriend(friendId: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "認証が必要です" };

  await supabase.from("friendships").delete().eq("user_id", user.id).eq("friend_id", friendId);
  await supabase.from("friendships").delete().eq("user_id", friendId).eq("friend_id", user.id);

  revalidatePath("/friends");
  return { ok: true };
}

export async function blockUser(targetId: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "認証が必要です" };

  await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: targetId });
  await supabase.from("friendships").delete().eq("user_id", user.id).eq("friend_id", targetId);
  await supabase.from("friendships").delete().eq("user_id", targetId).eq("friend_id", user.id);

  revalidatePath("/friends");
  return { ok: true };
}

export async function unblockUser(targetId: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "認証が必要です" };

  await supabase.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", targetId);
  revalidatePath("/friends");
  return { ok: true };
}
