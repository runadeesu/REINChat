import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatWindow } from "@/components/chat/chat-window";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("conversation_members")
    .select("*, conversations(*)")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) notFound();

  const conversation = Array.isArray(membership.conversations) ? membership.conversations[0] : membership.conversations;

  const [{ data: members }, { data: messages }] = await Promise.all([
    supabase
      .from("conversation_members")
      .select("user_id, role, last_read_at, profiles(id, display_name, avatar_url)")
      .eq("conversation_id", id),
    supabase
      .from("messages")
      .select("*, attachments(*), message_reactions(*)")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(100),
  ]);

  await supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", id).eq("user_id", user.id);

  const memberProfiles = (members ?? []).map((m) => {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return { userId: m.user_id, role: m.role, lastReadAt: m.last_read_at, profile };
  });

  const other = conversation.type === "direct" ? memberProfiles.find((m) => m.userId !== user.id) : null;

  return (
    <ChatWindow
      currentUserId={user.id}
      conversation={{
        id: conversation.id,
        type: conversation.type,
        name: conversation.type === "group" ? conversation.name : (other?.profile?.display_name ?? "不明なユーザー"),
        avatarUrl: conversation.type === "group" ? conversation.avatar_url : (other?.profile?.avatar_url ?? null),
        description: conversation.description,
        announcement: conversation.announcement,
      }}
      members={memberProfiles}
      initialMessages={messages ?? []}
    />
  );
}
