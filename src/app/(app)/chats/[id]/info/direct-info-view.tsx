"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { blockUser } from "@/lib/actions/friends";

interface Profile {
  id: string;
  display_id: string;
  display_name: string;
  avatar_url: string | null;
}

export function DirectInfoView({ profile }: { conversationId: string; profile: Profile }) {
  const router = useRouter();

  async function handleBlock() {
    if (!confirm(`${profile.display_name} をブロックしますか?`)) return;
    await blockUser(profile.id);
    router.push("/chats");
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
        <button onClick={() => router.back()}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold">チャット情報</h1>
      </div>
      <div className="flex flex-col items-center gap-2 p-6">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt="" className="h-24 w-24 rounded-full object-cover" />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--primary)] text-2xl font-semibold text-white">
            {profile.display_name[0]?.toUpperCase()}
          </div>
        )}
        <p className="text-lg font-semibold">{profile.display_name}</p>
        <p className="text-sm text-[var(--muted)]">@{profile.display_id}</p>
      </div>
      <div className="p-4">
        <Button variant="danger" onClick={handleBlock} className="w-full">
          <UserX size={16} /> ブロックする
        </Button>
      </div>
    </div>
  );
}
