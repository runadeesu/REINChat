"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createGroupSchema } from "@/lib/validation/schemas";

export async function createGroup(input: unknown) {
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group_conversation", {
    group_name: parsed.data.name,
    member_ids: parsed.data.memberIds,
  });

  if (error || !data) return { error: error?.message ?? "グループを作成できませんでした" };
  redirect(`/chats/${data}`);
}

export async function addGroupMembers(conversationId: string, memberIds: string[]) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_group_members", { conv_id: conversationId, member_ids: memberIds });
  if (error) return { error: error.message };
  revalidatePath(`/chats/${conversationId}/info`);
  return { ok: true };
}

export async function removeGroupMember(conversationId: string, targetUserId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_group_member", { conv_id: conversationId, target_user_id: targetUserId });
  if (error) return { error: error.message };
  revalidatePath(`/chats/${conversationId}/info`);
  return { ok: true };
}

export async function leaveGroup(conversationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "認証が必要です" };

  await supabase.from("conversation_members").delete().eq("conversation_id", conversationId).eq("user_id", user.id);
  redirect("/chats");
}

export async function updateGroupInfo(
  conversationId: string,
  data: { name?: string; description?: string | null; announcement?: string | null; avatarUrl?: string }
) {
  const supabase = await createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) update.name = data.name;
  if (data.description !== undefined) update.description = data.description;
  if (data.announcement !== undefined) update.announcement = data.announcement;
  if (data.avatarUrl !== undefined) update.avatar_url = data.avatarUrl;

  const { error } = await supabase.from("conversations").update(update).eq("id", conversationId);
  if (error) return { error: error.message };
  revalidatePath(`/chats/${conversationId}/info`);
  revalidatePath(`/chats/${conversationId}`);
  return { ok: true };
}

export async function setMemberRole(conversationId: string, targetUserId: string, role: "admin" | "member") {
  const supabase = await createClient();
  const { error } = await supabase
    .from("conversation_members")
    .update({ role })
    .eq("conversation_id", conversationId)
    .eq("user_id", targetUserId);
  if (error) return { error: error.message };
  revalidatePath(`/chats/${conversationId}/info`);
  return { ok: true };
}

export async function joinGroupByInvite(code: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_group_by_invite", { code });
  if (error || !data) return { error: error?.message ?? "参加できませんでした" };
  redirect(`/chats/${data}`);
}
