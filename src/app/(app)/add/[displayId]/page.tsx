import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AddFriendCard } from "./add-friend-card";

export default async function AddFriendPage({ params }: { params: Promise<{ displayId: string }> }) {
  const { displayId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, display_id, display_name, avatar_url, status_message")
    .eq("display_id", displayId)
    .maybeSingle();

  if (!target) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
        <p className="text-sm text-[var(--muted)]">ユーザーが見つかりませんでした。</p>
        <Link href="/friends" className="text-sm text-[var(--primary)] hover:underline">
          友達一覧に戻る
        </Link>
      </div>
    );
  }

  if (user && target.id === user.id) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
        <p className="text-sm text-[var(--muted)]">これはあなた自身のQRコードです。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      <AddFriendCard target={target} />
    </div>
  );
}
