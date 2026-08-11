"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { MessageType } from "@/lib/supabase/database.types";
import type { MessageWithExtras } from "@/components/chat/chat-window";

const LIMITS: Record<string, { types: string[]; maxBytes: number; label: string }> = {
  image: { types: ["image/jpeg", "image/png", "image/webp", "image/gif"], maxBytes: 10 * 1024 * 1024, label: "画像" },
  video: { types: ["video/mp4", "video/webm", "video/quicktime"], maxBytes: 100 * 1024 * 1024, label: "動画" },
  file: {
    types: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
      "application/zip",
    ],
    maxBytes: 50 * 1024 * 1024,
    label: "ファイル",
  },
};

function classify(mime: string): MessageType | null {
  if (LIMITS.image.types.includes(mime)) return "image";
  if (LIMITS.video.types.includes(mime)) return "video";
  if (LIMITS.file.types.includes(mime)) return "file";
  return null;
}

function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}

export function MediaPicker({
  conversationId,
  senderId,
  onClose,
  onSent,
}: {
  conversationId: string;
  senderId: string;
  onClose: () => void;
  onSent: (message: MessageWithExtras) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const type = classify(file.type);
    if (!type) {
      setError("対応していないファイル形式です");
      return;
    }
    const limit = LIMITS[type];
    if (file.size > limit.maxBytes) {
      setError(`${limit.label}は${Math.floor(limit.maxBytes / 1024 / 1024)}MB以下にしてください`);
      return;
    }

    setUploading(true);
    setError(null);
    const supabase = createClient();

    const { data: messageRow, error: insertError } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: senderId, type })
      .select()
      .single();

    if (insertError || !messageRow) {
      setUploading(false);
      setError("送信に失敗しました");
      return;
    }

    const path = `${conversationId}/${messageRow.id}/${file.name}`;
    const { error: uploadError } = await supabase.storage.from("attachments").upload(path, file);
    if (uploadError) {
      setUploading(false);
      setError(`アップロードに失敗しました: ${uploadError.message}`);
      return;
    }

    const dimensions = type === "image" ? await readImageDimensions(file) : null;

    const { data: attachment } = await supabase
      .from("attachments")
      .insert({
        message_id: messageRow.id,
        url: path,
        mime_type: file.type,
        size_bytes: file.size,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        filename: file.name,
      })
      .select()
      .single();

    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);

    setUploading(false);
    onSent({ ...messageRow, attachments: attachment ? [attachment] : [], message_reactions: [] });
    onClose();
  }

  const acceptTypes = [...LIMITS.image.types, ...LIMITS.video.types, ...LIMITS.file.types].join(",");

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-2xl bg-[var(--background)] p-5 md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">ファイルを送信</h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="mb-3 text-xs text-[var(--muted)]">画像・動画・ドキュメントを送信できます。</p>
        {error && <p className="mb-2 text-sm text-[var(--danger)]">{error}</p>}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full rounded-xl border border-dashed border-[var(--border)] py-8 text-sm text-[var(--muted)]"
        >
          {uploading ? "アップロード中..." : "タップしてファイルを選択"}
        </button>
        <input ref={inputRef} type="file" accept={acceptTypes} className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}
