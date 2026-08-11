"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function startDirectConversation(otherUserId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_direct_conversation", { other_user_id: otherUserId });
  if (error || !data) return { error: error?.message ?? "会話を開始できませんでした" };

  redirect(`/chats/${data}`);
}
