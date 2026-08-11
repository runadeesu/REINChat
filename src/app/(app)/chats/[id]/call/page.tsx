import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CallRoom } from "./call-room";

export default async function CallPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type } = await searchParams;
  const callType = type === "video" ? "video" : "audio";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("conversation_members")
    .select("conversation_id, conversations(name, type)")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) notFound();
  const conversation = Array.isArray(membership.conversations) ? membership.conversations[0] : membership.conversations;

  const { data: members } = await supabase
    .from("conversation_members")
    .select("user_id, profiles(id, display_name, avatar_url)")
    .eq("conversation_id", id);

  const memberProfiles = (members ?? []).map((m) => {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return { userId: m.user_id, displayName: profile?.display_name ?? "不明なユーザー", avatarUrl: profile?.avatar_url ?? null };
  });

  return (
    <CallRoom
      conversationId={id}
      conversationName={conversation?.name ?? "通話"}
      callType={callType}
      currentUserId={user.id}
      members={memberProfiles}
    />
  );
}
