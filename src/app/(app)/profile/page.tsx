import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileEditor } from "./profile-editor";
import { NotificationSettings } from "./notification-settings";
import { ReinAiLinkSection } from "./reinai-link-section";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-lg flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
      <ProfileEditor profile={profile} email={user.email ?? ""} />
      <NotificationSettings userId={user.id} />
      <ReinAiLinkSection reinAiUrl={process.env.NEXT_PUBLIC_REINAI_URL ?? "https://reinai-app.vercel.app"} />
    </div>
  );
}
