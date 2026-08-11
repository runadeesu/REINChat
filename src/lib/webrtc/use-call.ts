"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getIceServers } from "@/lib/webrtc/ice-config";

type SignalMessage =
  | { kind: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "ice-candidate"; from: string; to: string; candidate: RTCIceCandidateInit }
  | { kind: "bye"; from: string; to: string };

export interface CallParticipantProfile {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export type ConnectionState = "connecting" | "connected" | "disconnected" | "failed";

export function useCall(opts: {
  callId: string;
  currentUserId: string;
  callType: "audio" | "video";
  initialParticipantIds: string[];
}) {
  const { callId, currentUserId, callType } = opts;

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [connectionStates, setConnectionStates] = useState<Map<string, ConnectionState>>(new Map());
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(callType === "video");
  const [mediaError, setMediaError] = useState<string | null>(null);

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const knownParticipantsRef = useRef<Set<string>>(new Set(opts.initialParticipantIds));

  const send = useCallback((message: SignalMessage) => {
    channelRef.current?.send({ type: "broadcast", event: "signal", payload: message });
  }, []);

  const createPeerConnection = useCallback(
    (remoteId: string) => {
      const existing = peersRef.current.get(remoteId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      peersRef.current.set(remoteId, pc);

      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          send({ kind: "ice-candidate", from: currentUserId, to: remoteId, candidate: event.candidate.toJSON() });
        }
      };

      pc.ontrack = (event) => {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.set(remoteId, event.streams[0]);
          return next;
        });
      };

      pc.onconnectionstatechange = () => {
        setConnectionStates((prev) => {
          const next = new Map(prev);
          const state = pc.connectionState;
          next.set(
            remoteId,
            state === "connected" ? "connected" : state === "failed" ? "failed" : state === "disconnected" ? "disconnected" : "connecting"
          );
          return next;
        });
      };

      return pc;
    },
    [currentUserId, send]
  );

  const connectToParticipant = useCallback(
    async (remoteId: string) => {
      if (remoteId === currentUserId) return;
      const pc = createPeerConnection(remoteId);

      // Deterministic glare avoidance: the lexicographically smaller user id
      // always initiates the offer for a given pair.
      if (currentUserId < remoteId) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send({ kind: "offer", from: currentUserId, to: remoteId, sdp: offer });
      }
    },
    [currentUserId, createPeerConnection, send]
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === "video" ? { facingMode: "user" } : false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch {
        setMediaError("カメラ・マイクにアクセスできませんでした。ブラウザの権限設定を確認してください。");
        return;
      }

      const supabase = createClient();
      const channel = supabase
        .channel(`call-signal:${callId}`, { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "signal" }, async ({ payload }) => {
          const message = payload as SignalMessage;
          if (message.to !== currentUserId) return;

          if (message.kind === "offer") {
            const pc = createPeerConnection(message.from);
            await pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            send({ kind: "answer", from: currentUserId, to: message.from, sdp: answer });
          } else if (message.kind === "answer") {
            const pc = peersRef.current.get(message.from);
            await pc?.setRemoteDescription(new RTCSessionDescription(message.sdp));
          } else if (message.kind === "ice-candidate") {
            const pc = peersRef.current.get(message.from);
            await pc?.addIceCandidate(new RTCIceCandidate(message.candidate)).catch(() => {});
          } else if (message.kind === "bye") {
            peersRef.current.get(message.from)?.close();
            peersRef.current.delete(message.from);
            setRemoteStreams((prev) => {
              const next = new Map(prev);
              next.delete(message.from);
              return next;
            });
          }
        })
        .subscribe();

      channelRef.current = channel;

      // Connect to whoever was already in the call when we joined.
      for (const id of knownParticipantsRef.current) {
        if (id !== currentUserId) connectToParticipant(id);
      }

      // New joiners are picked up via realtime inserts on call_participants,
      // wired in by the call page (see joinNewParticipant below).
    }

    init();

    return () => {
      cancelled = true;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      // peersRef holds a plain Map we own (not a React-managed DOM ref), so
      // reading it in cleanup is safe — this isn't the stale-DOM-ref case
      // the lint rule is guarding against.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const peers = peersRef.current;
      for (const [remoteId, pc] of peers) {
        send({ kind: "bye", from: currentUserId, to: remoteId });
        pc.close();
      }
      peers.clear();
      if (channelRef.current) {
        createClient().removeChannel(channelRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, currentUserId, callType]);

  const joinNewParticipant = useCallback(
    (remoteId: string) => {
      if (knownParticipantsRef.current.has(remoteId)) return;
      knownParticipantsRef.current.add(remoteId);
      connectToParticipant(remoteId);
    },
    [connectToParticipant]
  );

  function toggleMic() {
    const next = !micEnabled;
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicEnabled(next);
  }

  function toggleCamera() {
    const next = !cameraEnabled;
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
    setCameraEnabled(next);
  }

  async function switchCamera() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    const currentFacing = videoTrack.getSettings().facingMode;
    const nextFacing = currentFacing === "user" ? "environment" : "user";

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: nextFacing }, audio: false });
      const newTrack = newStream.getVideoTracks()[0];
      for (const pc of peersRef.current.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        sender?.replaceTrack(newTrack);
      }
      stream.removeTrack(videoTrack);
      videoTrack.stop();
      stream.addTrack(newTrack);
      setLocalStream(new MediaStream(stream.getTracks()));
    } catch {
      // Device without a second camera, or permission denied — leave the
      // current camera active rather than failing the whole call.
    }
  }

  return {
    localStream,
    remoteStreams,
    connectionStates,
    micEnabled,
    cameraEnabled,
    mediaError,
    toggleMic,
    toggleCamera,
    switchCamera,
    joinNewParticipant,
  };
}
