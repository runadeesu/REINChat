"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { MessageWithExtras } from "@/components/chat/chat-window";

const MAX_DURATION_MS = 5 * 60 * 1000;

export function VoiceRecorder({
  conversationId,
  senderId,
  onSent,
}: {
  conversationId: string;
  senderId: string;
  onSent: (message: MessageWithExtras) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (tickRef.current) clearInterval(tickRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setPreviewBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setRecording(true);
      setElapsedMs(0);
      tickRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAtRef.current;
        setElapsedMs(elapsed);
        if (elapsed >= MAX_DURATION_MS) stopRecording();
      }, 200);
    } catch {
      setError("マイクにアクセスできませんでした。ブラウザの権限設定を確認してください。");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
    if (tickRef.current) clearInterval(tickRef.current);
  }

  function discard() {
    setPreviewBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setElapsedMs(0);
  }

  async function send() {
    if (!previewBlob) return;
    setUploading(true);
    const supabase = createClient();

    const { data: messageRow, error: insertError } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: senderId, type: "audio" })
      .select()
      .single();

    if (insertError || !messageRow) {
      setUploading(false);
      setError("送信に失敗しました");
      return;
    }

    const ext = previewBlob.type.includes("webm") ? "webm" : "m4a";
    const path = `${conversationId}/${messageRow.id}/voice.${ext}`;
    const { error: uploadError } = await supabase.storage.from("attachments").upload(path, previewBlob);
    if (uploadError) {
      setUploading(false);
      setError("アップロードに失敗しました");
      return;
    }

    const { data: attachment } = await supabase
      .from("attachments")
      .insert({
        message_id: messageRow.id,
        url: path,
        mime_type: previewBlob.type,
        size_bytes: previewBlob.size,
        duration_seconds: Math.round(elapsedMs / 1000),
        filename: `voice.${ext}`,
      })
      .select()
      .single();

    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);

    setUploading(false);
    discard();
    onSent({ ...messageRow, attachments: attachment ? [attachment] : [], message_reactions: [] });
  }

  const seconds = Math.floor(elapsedMs / 1000);
  const timeLabel = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  if (previewBlob && previewUrl) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <audio src={previewUrl} controls className="h-8 flex-1" />
        <span className="text-xs text-[var(--muted)]">{timeLabel}</span>
        <button onClick={discard} className="rounded p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)]" title="削除">
          <Trash2 size={16} />
        </button>
        <button onClick={send} disabled={uploading} className="rounded-full bg-[var(--primary)] p-1.5 text-white" title="送信">
          <Send size={16} />
        </button>
        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={recording ? stopRecording : startRecording}
        className={`shrink-0 rounded-lg p-2 ${recording ? "bg-[var(--danger)] text-white" : "hover:bg-[var(--surface-hover)]"}`}
        title={recording ? "録音停止" : "ボイスメッセージを録音"}
      >
        {recording ? <Square size={20} /> : <Mic size={20} />}
      </button>
      {recording && <span className="text-xs text-[var(--danger)]">録音中... {timeLabel}</span>}
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
