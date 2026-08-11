"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { joinGroupByInvite } from "@/lib/actions/groups";

interface GroupPreview {
  id: string;
  name: string | null;
  avatar_url: string | null;
  description: string | null;
}

export function JoinGroupCard({ code, conversation }: { code: string; conversation: GroupPreview }) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setJoining(true);
    const result = await joinGroupByInvite(code);
    if (result?.error) {
      setError(result.error);
      setJoining(false);
    }
  }

  return (
    <div className="w-full max-w-xs rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6 text-center">
      {conversation.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={conversation.avatar_url} alt="" className="mx-auto h-20 w-20 rounded-full object-cover" />
      ) : (
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--primary)] text-white">
          <Users size={28} />
        </div>
      )}
      <p className="mt-3 font-semibold">{conversation.name}</p>
      {conversation.description && <p className="mt-1 text-sm text-[var(--muted)]">{conversation.description}</p>}
      <Button onClick={handleJoin} disabled={joining} className="mt-4 w-full">
        {joining ? "参加中..." : "グループに参加"}
      </Button>
      {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
      <button onClick={() => router.push("/chats")} className="mt-3 text-xs text-[var(--muted)] hover:underline">
        キャンセル
      </button>
    </div>
  );
}
