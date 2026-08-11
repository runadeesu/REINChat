import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileEditor } from "./profile-editor";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-lg flex-1 overflow-y-auto p-4 md:p-8">
      <ProfileEditor profile={profile} email={user.email ?? ""} />
    </div>
  );
}
