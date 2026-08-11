"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Reply, Pin } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { togglePin, editMessage, deleteMessage } from "@/lib/actions/messages-client";
import { AttachmentImage, AttachmentVideo, AttachmentAudio, AttachmentFile } from "@/components/chat/attachment-view";
import type { MessageWithExtras } from "@/components/chat/chat-window";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export function MessageBubble({
  message,
  isMine,
  senderProfile,
  replyToMessage,
  showReadReceipt,
  currentUserId,
  onReply,
  onReact,
}: {
  message: MessageWithExtras;
  isMine: boolean;
  senderProfile: { display_name: string; avatar_url: string | null } | null;
  replyToMessage: MessageWithExtras | null | undefined;
  showReadReceipt: boolean;
  currentUserId: string;
  onReply: () => void;
  onReact: (emoji: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content ?? "");

  if (message.deleted_at) {
    return (
      <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
        <p className="my-1 rounded-2xl bg-[var(--surface)] px-3 py-1.5 text-xs italic text-[var(--muted)]">メッセージは削除されました</p>
      </div>
    );
  }

  const reactionCounts = new Map<string, number>();
  for (const r of message.message_reactions) {
    reactionCounts.set(r.emoji, (reactionCounts.get(r.emoji) ?? 0) + 1);
  }

  async function handleSaveEdit() {
    if (editValue.trim() && editValue !== message.content) {
      await editMessage(message.id, editValue.trim());
    }
    setEditing(false);
  }

  return (
    <div className={cn("group flex gap-2", isMine ? "flex-row-reverse" : "flex-row")} onMouseLeave={() => setShowActions(false)}>
      {!isMine && (
        <div className="mt-auto shrink-0">
          {senderProfile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={senderProfile.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] font-semibold text-white">
              {senderProfile?.display_name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
        </div>
      )}

      <div className={cn("flex max-w-[75%] flex-col", isMine ? "items-end" : "items-start")}>
        {!isMine && senderProfile && <p className="mb-0.5 px-1 text-[10px] text-[var(--muted)]">{senderProfile.display_name}</p>}

        <div className="flex items-end gap-1.5" onMouseEnter={() => setShowActions(true)}>
          {isMine && (
            <div className="flex flex-col items-end gap-0.5 text-[10px] text-[var(--muted)]">
              {showReadReceipt && <span className="text-[var(--primary)]">既読</span>}
              <span>{format(new Date(message.created_at), "HH:mm")}</span>
            </div>
          )}

          <div className="relative">
            {message.is_pinned && <Pin size={10} className="absolute -top-1.5 -right-1.5 fill-current text-[var(--primary)]" />}

            {editing ? (
              <div className="flex flex-col gap-1">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-64 resize-none rounded-2xl border border-[var(--primary)] bg-[var(--background)] px-3 py-2 text-sm outline-none"
                  rows={2}
                  autoFocus
                />
                <div className="flex justify-end gap-2 text-xs">
                  <button onClick={() => setEditing(false)} className="text-[var(--muted)]">キャンセル</button>
                  <button onClick={handleSaveEdit} className="text-[var(--primary)]">保存</button>
                </div>
              </div>
            ) : (
              <div
                className="rounded-2xl px-3 py-2 text-sm"
                style={{ background: isMine ? "var(--bubble-mine)" : "var(--bubble-theirs)", border: isMine ? "none" : "1px solid var(--border)" }}
              >
                {replyToMessage && (
                  <div className="mb-1 rounded-lg bg-black/5 px-2 py-1 text-xs text-[var(--muted)]">
                    {replyToMessage.deleted_at ? "削除されたメッセージ" : replyToMessage.content?.slice(0, 60) || "(添付ファイル)"}
                  </div>
                )}
                {message.type === "text" && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
                {message.type === "image" && message.attachments.map((a) => <AttachmentImage key={a.id} attachment={a} />)}
                {message.type === "video" && message.attachments.map((a) => <AttachmentVideo key={a.id} attachment={a} />)}
                {message.type === "audio" && message.attachments.map((a) => <AttachmentAudio key={a.id} attachment={a} />)}
                {message.type === "file" && message.attachments.map((a) => <AttachmentFile key={a.id} attachment={a} />)}
                {message.type === "sticker" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={message.content ?? ""} alt="sticker" className="h-24 w-24" />
                )}
                {message.edited_at && <span className="ml-1 text-[10px] text-[var(--muted)]">(編集済み)</span>}
              </div>
            )}

            {showActions && !editing && (
              <div className={cn("absolute top-0 flex -translate-y-full gap-1 rounded-lg bg-[var(--background)] p-1 shadow", isMine ? "right-0" : "left-0")}>
                {QUICK_REACTIONS.map((emoji) => (
                  <button key={emoji} onClick={() => onReact(emoji)} className="text-sm hover:scale-125">
                    {emoji}
                  </button>
                ))}
                <button onClick={onReply} className="rounded p-0.5 hover:bg-[var(--surface-hover)]">
                  <Reply size={13} />
                </button>
                {isMine && message.type === "text" && (
                  <button onClick={() => setEditing(true)} className="px-1 text-[11px] text-[var(--muted)]">
                    編集
                  </button>
                )}
                {isMine && (
                  <button onClick={() => deleteMessage(message.id)} className="px-1 text-[11px] text-[var(--danger)]">
                    削除
                  </button>
                )}
                <button onClick={() => togglePin(message.id, !message.is_pinned)} className="px-1 text-[11px] text-[var(--muted)]">
                  {message.is_pinned ? "ピン解除" : "ピン"}
                </button>
              </div>
            )}
          </div>

          {!isMine && <span className="text-[10px] text-[var(--muted)]">{format(new Date(message.created_at), "HH:mm", { locale: ja })}</span>}
        </div>

        {reactionCounts.size > 0 && (
          <div className="mt-0.5 flex gap-1">
            {[...reactionCounts.entries()].map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className={cn(
                  "rounded-full border px-1.5 text-xs",
                  message.message_reactions.some((r) => r.emoji === emoji && r.user_id === currentUserId)
                    ? "border-[var(--primary)] bg-[var(--primary)]/10"
                    : "border-[var(--border)]"
                )}
              >
                {emoji} {count}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
