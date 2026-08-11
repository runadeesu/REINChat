"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, PhoneOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface IncomingCall {
  callId: string;
  conversationId: string;
  callType: "audio" | "video";
  callerName: string;
}

export function IncomingCallListener({ userId }: { userId: string }) {
  const router = useRouter();
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function setup() {
      const { data: memberships } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", userId);
      const conversationIds = (memberships ?? []).map((m) => m.conversation_id);
      if (conversationIds.length === 0) return;

      channel = supabase
        .channel("incoming-calls")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "calls", filter: `conversation_id=in.(${conversationIds.join(",")})` },
          async (payload) => {
            const call = payload.new as { id: string; conversation_id: string; type: "audio" | "video"; started_by: string };
            if (call.started_by === userId) return;

            const { data: caller } = await supabase.from("profiles").select("display_name").eq("id", call.started_by).single();
            setIncoming({
              callId: call.id,
              conversationId: call.conversation_id,
              callType: call.type,
              callerName: caller?.display_name ?? "不明なユーザー",
            });
          }
        )
        .subscribe();
    }

    setup();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId]);

  if (!incoming) return null;

  function handleAnswer() {
    if (!incoming) return;
    router.push(`/chats/${incoming.conversationId}/call?type=${incoming.callType}`);
    setIncoming(null);
  }

  return (
    <div className="fixed bottom-20 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 shadow-lg md:bottom-4">
      <p className="text-sm font-medium">{incoming.callerName} から着信</p>
      <p className="text-xs text-[var(--muted)]">{incoming.callType === "video" ? "ビデオ通話" : "音声通話"}</p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => setIncoming(null)} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-[var(--danger)] py-2 text-sm text-white">
          <PhoneOff size={16} /> 拒否
        </button>
        <button onClick={handleAnswer} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-[var(--primary)] py-2 text-sm text-white">
          <Phone size={16} /> 応答
        </button>
      </div>
    </div>
  );
}
