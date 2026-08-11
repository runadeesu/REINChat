// Client-side (browser Supabase client) helpers for message operations.
// RLS enforces authorization; there's no need to round-trip through a
// server action for these, and doing it client-side keeps send-to-realtime
// latency as low as possible for a chat app.
import { createClient } from "@/lib/supabase/client";
import type { MessageType } from "@/lib/supabase/database.types";

export async function sendMessage(opts: {
  conversationId: string;
  senderId: string;
  type: MessageType;
  content?: string | null;
  replyToId?: string | null;
  stickerId?: string | null;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: opts.conversationId,
      sender_id: opts.senderId,
      type: opts.type,
      content: opts.content ?? null,
      reply_to_id: opts.replyToId ?? null,
      sticker_id: opts.stickerId ?? null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", opts.conversationId);
  return { message: data };
}

export async function editMessage(messageId: string, content: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("messages")
    .update({ content, edited_at: new Date().toISOString() })
    .eq("id", messageId);
  return { error: error?.message };
}

export async function deleteMessage(messageId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("messages").update({ deleted_at: new Date().toISOString() }).eq("id", messageId);
  return { error: error?.message };
}

export async function togglePin(messageId: string, pinned: boolean) {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_message_pinned", { msg_id: messageId, pinned });
  return { error: error?.message };
}

export async function toggleReaction(messageId: string, userId: string, emoji: string) {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("message_reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    await supabase.from("message_reactions").delete().eq("id", existing.id);
  } else {
    await supabase.from("message_reactions").insert({ message_id: messageId, user_id: userId, emoji });
  }
}

export async function markRead(conversationId: string, userId: string) {
  const supabase = createClient();
  await supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", conversationId).eq("user_id", userId);
}
