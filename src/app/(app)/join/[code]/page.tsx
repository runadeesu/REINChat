import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { JoinGroupCard } from "./join-group-card";

export default async function JoinGroupPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, name, avatar_url, description")
    .eq("invite_code", code)
    .eq("type", "group")
    .maybeSingle();

  if (!conversation) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
        <p className="text-sm text-[var(--muted)]">招待リンクが無効です。</p>
        <Link href="/chats" className="text-sm text-[var(--primary)] hover:underline">
          チャット一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      <JoinGroupCard code={code} conversation={conversation} />
    </div>
  );
}
