import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const { data: isAdmin } = await supabase.rpc("is_admin", { uid: user.id });

  if (profile?.is_suspended) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-lg font-semibold">アカウントが停止されています</h1>
        <p className="max-w-sm text-sm text-[var(--muted)]">
          {profile.suspended_reason || "詳細はサポートまでお問い合わせください。"}
        </p>
      </div>
    );
  }

  return (
    <AppShell profile={profile} isAdmin={Boolean(isAdmin)}>
      {children}
    </AppShell>
  );
}
