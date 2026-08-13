import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReinChatLogo } from "@/components/brand/logo";
import { LinkDiscordCard } from "./link-discord-card";

export default async function LinkDiscordPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/link-discord/${code}`);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--surface)] px-4 py-10">
      <div className="mb-8">
        <ReinChatLogo size={36} />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6 text-center shadow-sm">
        <LinkDiscordCard code={code} />
      </div>
    </div>
  );
}
