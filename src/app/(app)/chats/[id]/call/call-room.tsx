"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getOrCreateActiveCall, leaveCall } from "@/lib/actions/calls";
import { useCall } from "@/lib/webrtc/use-call";
import { hasTurnConfigured } from "@/lib/webrtc/ice-config";

interface MemberInfo {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export function CallRoom({
  conversationId,
  conversationName,
  callType,
  currentUserId,
  members,
}: {
  conversationId: string;
  conversationName: string;
  callType: "audio" | "video";
  currentUserId: string;
  members: MemberInfo[];
}) {
  const router = useRouter();
  const [callId, setCallId] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const startedAtRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const memberMap = new Map(members.map((m) => [m.userId, m]));

  useEffect(() => {
    let cancelled = false;
    getOrCreateActiveCall(conversationId, callType).then((result) => {
      if (cancelled) return;
      if (result.error || !result.call) {
        setSetupError(result.error ?? "通話を開始できませんでした");
        return;
      }
      setCallId(result.call.id);
      setParticipantIds((result.participants ?? []).map((p) => p.userId).filter((id) => id !== currentUserId));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, callType]);

  const call = useCall({
    callId: callId ?? "",
    currentUserId,
    callType,
    initialParticipantIds: participantIds,
  });

  useEffect(() => {
    if (localVideoRef.current && call.localStream) {
      localVideoRef.current.srcObject = call.localStream;
    }
  }, [call.localStream]);

  useEffect(() => {
    if (!callId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`call-participants:${callId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "call_participants", filter: `call_id=eq.${callId}` },
        (payload) => {
          const row = payload.new as { user_id: string };
          if (row.user_id !== currentUserId) call.joinNewParticipant(row.user_id);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, currentUserId]);

  useEffect(() => {
    startedAtRef.current = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current!) / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleEnd() {
    if (callId) await leaveCall(callId);
    router.push(`/chats/${conversationId}`);
  }

  if (setupError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-white">
        <p>{setupError}</p>
        <button onClick={() => router.back()} className="text-sm underline">
          戻る
        </button>
      </div>
    );
  }

  if (call.mediaError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-white">
        <p>{call.mediaError}</p>
        <button onClick={() => router.back()} className="text-sm underline">
          戻る
        </button>
      </div>
    );
  }

  const remoteEntries = [...call.remoteStreams.entries()];
  const timeLabel = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="flex h-full flex-col bg-[#0c1210] text-white">
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm font-medium">{conversationName}</p>
          <p className="text-xs text-white/60">
            {remoteEntries.length === 0 ? "呼び出し中..." : `通話中 ${timeLabel}`}
            {!hasTurnConfigured() && " (STUNのみ — 環境によっては接続できない場合があります)"}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-wrap items-center justify-center gap-4 overflow-y-auto p-4">
        {callType === "video" && (
          <div className="relative aspect-video w-full max-w-xs overflow-hidden rounded-2xl bg-black">
            <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
            <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-xs">あなた</span>
          </div>
        )}

        {remoteEntries.map(([userId, stream]) => (
          <RemoteTile key={userId} userId={userId} stream={stream} callType={callType} member={memberMap.get(userId)} />
        ))}

        {callType === "audio" && (
          <div className="flex flex-col items-center gap-2">
            {avatarFor(memberMap.get(currentUserId) ?? { userId: currentUserId, displayName: "あなた", avatarUrl: null })}
            <p className="text-sm">あなた</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 p-6">
        <button onClick={call.toggleMic} className={`rounded-full p-4 ${call.micEnabled ? "bg-white/10" : "bg-red-500"}`}>
          {call.micEnabled ? <Mic size={22} /> : <MicOff size={22} />}
        </button>
        {callType === "video" && (
          <>
            <button onClick={call.toggleCamera} className={`rounded-full p-4 ${call.cameraEnabled ? "bg-white/10" : "bg-red-500"}`}>
              {call.cameraEnabled ? <VideoIcon size={22} /> : <VideoOff size={22} />}
            </button>
            <button onClick={call.switchCamera} className="rounded-full bg-white/10 p-4" title="カメラ切替">
              <RefreshCw size={22} />
            </button>
          </>
        )}
        <button onClick={handleEnd} className="rounded-full bg-red-600 p-4">
          <PhoneOff size={22} />
        </button>
      </div>
    </div>
  );
}

function RemoteTile({
  userId,
  stream,
  callType,
  member,
}: {
  userId: string;
  stream: MediaStream;
  callType: "audio" | "video";
  member?: MemberInfo;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (callType === "video" && videoRef.current) videoRef.current.srcObject = stream;
    if (callType === "audio" && audioRef.current) audioRef.current.srcObject = stream;
  }, [stream, callType]);

  if (callType === "audio") {
    return (
      <div className="flex flex-col items-center gap-2">
        {avatarFor(member ?? { userId, displayName: "参加者", avatarUrl: null })}
        <p className="text-sm">{member?.displayName ?? "参加者"}</p>
        <audio ref={audioRef} autoPlay />
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full max-w-xs overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
      <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-xs">{member?.displayName ?? "参加者"}</span>
    </div>
  );
}

function avatarFor(member: MemberInfo) {
  if (member.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={member.avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#0f9d78] text-2xl font-semibold">
      {member.displayName[0]?.toUpperCase()}
    </div>
  );
}
