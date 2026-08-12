import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReinChatLogo } from "@/components/brand/logo";
import { LinkReinAiCard } from "./link-reinai-card";

export default async function LinkReinAiPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/link-reinai/${code}`);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--surface)] px-4 py-10">
      <div className="mb-8">
        <ReinChatLogo size={36} />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6 text-center shadow-sm">
        <LinkReinAiCard code={code} />
      </div>
    </div>
  );
}
