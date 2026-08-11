import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewGroupForm } from "./new-group-form";

export default async function NewGroupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: friendships } = await supabase.from("friendships").select("friend_id").eq("user_id", user.id);
  const friendIds = (friendships ?? []).map((f) => f.friend_id);

  const { data: friends } = friendIds.length
    ? await supabase.from("profiles").select("id, display_id, display_name, avatar_url").in("id", friendIds)
    : { data: [] };

  return <NewGroupForm friends={friends ?? []} />;
}
