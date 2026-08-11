import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FriendsView } from "./friends-view";

export default async function FriendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: friendships }, { data: incoming }, { data: outgoing }, { data: blocks }] = await Promise.all([
    supabase.from("friendships").select("friend_id, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase
      .from("friend_requests")
      .select("id, sender_id, created_at")
      .eq("receiver_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("friend_requests")
      .select("id, receiver_id, created_at")
      .eq("sender_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id),
  ]);

  const friendIds = (friendships ?? []).map((f) => f.friend_id);
  const incomingIds = (incoming ?? []).map((r) => r.sender_id);
  const outgoingIds = (outgoing ?? []).map((r) => r.receiver_id);
  const blockedIds = (blocks ?? []).map((b) => b.blocked_id);

  const allIds = [...new Set([...friendIds, ...incomingIds, ...outgoingIds, ...blockedIds])];
  const { data: profiles } = allIds.length
    ? await supabase.from("profiles").select("id, display_id, display_name, avatar_url, status_message, last_online_at").in("id", allIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (
    <FriendsView
      currentUserId={user.id}
      friends={friendIds.map((id) => profileMap.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p))}
      incoming={(incoming ?? []).map((r) => ({ requestId: r.id, profile: profileMap.get(r.sender_id) }))}
      outgoing={(outgoing ?? []).map((r) => ({ requestId: r.id, profile: profileMap.get(r.receiver_id) }))}
      blocked={blockedIds.map((id) => profileMap.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p))}
    />
  );
}
