import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GroupInfoView } from "./group-info-view";
import { DirectInfoView } from "./direct-info-view";

export default async function ChatInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("conversation_members")
    .select("role, conversations(*)")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) notFound();
  const conversation = Array.isArray(membership.conversations) ? membership.conversations[0] : membership.conversations;

  const { data: members } = await supabase
    .from("conversation_members")
    .select("user_id, role, joined_at, profiles(id, display_id, display_name, avatar_url)")
    .eq("conversation_id", id);

  const memberList = (members ?? []).map((m) => {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return { userId: m.user_id, role: m.role, joinedAt: m.joined_at, profile };
  });

  if (conversation.type === "direct") {
    const other = memberList.find((m) => m.userId !== user.id);
    if (!other?.profile) notFound();
    return <DirectInfoView conversationId={id} profile={other.profile} />;
  }

  const memberIds = new Set(memberList.map((m) => m.userId));
  const { data: friendships } = await supabase.from("friendships").select("friend_id").eq("user_id", user.id);
  const candidateIds = (friendships ?? []).map((f) => f.friend_id).filter((fid) => !memberIds.has(fid));
  const { data: addableFriends } = candidateIds.length
    ? await supabase.from("profiles").select("id, display_id, display_name, avatar_url").in("id", candidateIds)
    : { data: [] };

  return (
    <GroupInfoView
      conversation={conversation}
      members={memberList}
      currentUserId={user.id}
      currentUserRole={membership.role}
      addableFriends={addableFriends ?? []}
    />
  );
}
