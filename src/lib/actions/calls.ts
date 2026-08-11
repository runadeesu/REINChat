"use server";

import { createClient } from "@/lib/supabase/server";
import { sendPushToUsers } from "@/lib/push/send-push";
import type { CallType } from "@/lib/supabase/database.types";

export async function getOrCreateActiveCall(conversationId: string, type: CallType) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "認証が必要です" };

  const { data: existing } = await supabase
    .from("calls")
    .select("*")
    .eq("conversation_id", conversationId)
    .in("status", ["ringing", "active"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let call = existing;
  if (!call) {
    const { data: created, error } = await supabase
      .from("calls")
      .insert({ conversation_id: conversationId, type, started_by: user.id, status: "ringing" })
      .select()
      .single();
    if (error || !created) return { error: error?.message ?? "通話を開始できませんでした" };
    call = created;

    const { data: myProfile } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
    const { data: otherMembers } = await supabase.from("conversation_members").select("user_id").eq("conversation_id", conversationId).neq("user_id", user.id);
    sendPushToUsers({
      recipientIds: (otherMembers ?? []).map((m) => m.user_id),
      excludeUserId: user.id,
      type: "calls",
      title: `${myProfile?.display_name ?? "誰か"} から着信`,
      body: type === "video" ? "ビデオ通話" : "音声通話",
      url: `/chats/${conversationId}/call?type=${type}`,
    }).catch(() => {});
  }

  const { data: existingParticipant } = await supabase
    .from("call_participants")
    .select("id")
    .eq("call_id", call.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingParticipant) {
    await supabase.from("call_participants").update({ joined_at: new Date().toISOString(), left_at: null }).eq("id", existingParticipant.id);
  } else {
    await supabase.from("call_participants").insert({ call_id: call.id, user_id: user.id, joined_at: new Date().toISOString() });
  }

  if (call.status === "ringing" && existing) {
    await supabase.from("calls").update({ status: "active" }).eq("id", call.id);
  }

  const { data: participants } = await supabase
    .from("call_participants")
    .select("user_id, profiles(id, display_name, avatar_url)")
    .eq("call_id", call.id)
    .is("left_at", null);

  return {
    call,
    participants: (participants ?? []).map((p) => {
      const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      return { userId: p.user_id, profile };
    }),
  };
}

export async function leaveCall(callId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "認証が必要です" };

  await supabase.from("call_participants").update({ left_at: new Date().toISOString() }).eq("call_id", callId).eq("user_id", user.id);

  const { data: remaining } = await supabase.from("call_participants").select("id").eq("call_id", callId).is("left_at", null);

  if (!remaining || remaining.length === 0) {
    await supabase.from("calls").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", callId);
  }

  return { ok: true };
}
