"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendFriendRequest } from "@/lib/actions/friends";

interface TargetProfile {
  id: string;
  display_id: string;
  display_name: string;
  avatar_url: string | null;
  status_message: string | null;
}

export function AddFriendCard({ target }: { target: TargetProfile }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setStatus("sending");
    const result = await sendFriendRequest(target.id);
    if (result.error) {
      setError(result.error);
      setStatus("error");
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="w-full max-w-xs rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6 text-center">
      {target.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={target.avatar_url} alt="" className="mx-auto h-20 w-20 rounded-full object-cover" />
      ) : (
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--primary)] text-2xl font-semibold text-white">
          {target.display_name[0]?.toUpperCase()}
        </div>
      )}
      <p className="mt-3 font-semibold">{target.display_name}</p>
      <p className="text-xs text-[var(--muted)]">@{target.display_id}</p>
      {target.status_message && <p className="mt-2 text-sm text-[var(--muted)]">{target.status_message}</p>}

      {status === "sent" ? (
        <p className="mt-4 text-sm text-[var(--primary)]">友達申請を送りました</p>
      ) : (
        <Button onClick={handleAdd} disabled={status === "sending"} className="mt-4 w-full">
          <UserPlus size={16} /> {status === "sending" ? "送信中..." : "友達追加"}
        </Button>
      )}
      {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
      <button onClick={() => router.push("/friends")} className="mt-3 text-xs text-[var(--muted)] hover:underline">
        友達一覧に戻る
      </button>
    </div>
  );
}
