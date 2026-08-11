import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConversationList } from "@/components/chat/conversation-list";

export default async function ChatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const conversations = await loadConversationSummaries(user.id);

  return (
    <div className="flex h-full">
      <div className="w-full border-r border-[var(--border)] md:w-80 md:shrink-0">
        <ConversationList currentUserId={user.id} initialConversations={conversations} />
      </div>
      <div className="hidden flex-1 items-center justify-center text-sm text-[var(--muted)] md:flex">
        チャットを選択してください
      </div>
    </div>
  );
}

export async function loadConversationSummaries(userId: string) {
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("conversation_members")
    .select("conversation_id, last_read_at, is_pinned, is_archived, conversations(id, type, name, avatar_url, updated_at)")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .order("conversations(updated_at)", { ascending: false });

  if (!memberships || memberships.length === 0) return [];

  const conversationIds = memberships.map((m) => m.conversation_id);

  const [{ data: lastMessages }, { data: otherMembers }] = await Promise.all([
    supabase
      .from("messages")
      .select("conversation_id, content, type, sender_id, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("conversation_members")
      .select("conversation_id, user_id, profiles(id, display_name, avatar_url)")
      .in("conversation_id", conversationIds)
      .neq("user_id", userId),
  ]);

  const lastMessageByConv = new Map<string, NonNullable<typeof lastMessages>[number]>();
  for (const m of lastMessages ?? []) {
    if (!lastMessageByConv.has(m.conversation_id)) lastMessageByConv.set(m.conversation_id, m);
  }

  const otherMemberByConv = new Map<string, { id: string; display_name: string; avatar_url: string | null }>();
  for (const row of otherMembers ?? []) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (profile && !otherMemberByConv.has(row.conversation_id)) {
      otherMemberByConv.set(row.conversation_id, profile);
    }
  }

  return memberships.map((m) => {
    const conv = Array.isArray(m.conversations) ? m.conversations[0] : m.conversations;
    const lastMessage = lastMessageByConv.get(m.conversation_id);
    const other = otherMemberByConv.get(m.conversation_id);
    const unread = lastMessage ? new Date(lastMessage.created_at) > new Date(m.last_read_at) && lastMessage.sender_id !== userId : false;

    return {
      id: m.conversation_id,
      type: conv?.type ?? "direct",
      name: conv?.type === "group" ? conv.name : other?.display_name ?? "不明なユーザー",
      avatarUrl: conv?.type === "group" ? conv.avatar_url : other?.avatar_url ?? null,
      lastMessagePreview: previewFor(lastMessage),
      updatedAt: lastMessage?.created_at ?? conv?.updated_at ?? new Date().toISOString(),
      isPinned: m.is_pinned,
      isUnread: unread,
    };
  });
}

function previewFor(message: { type: string; content: string | null } | undefined) {
  if (!message) return "";
  switch (message.type) {
    case "text":
      return message.content ?? "";
    case "image":
      return "📷 画像";
    case "video":
      return "🎬 動画";
    case "audio":
      return "🎤 ボイスメッセージ";
    case "file":
      return "📎 ファイル";
    case "sticker":
      return "スタンプ";
    default:
      return "";
  }
}
