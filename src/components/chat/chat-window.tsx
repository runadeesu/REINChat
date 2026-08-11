"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Phone, Video, Info, Image as ImageIcon, Smile } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage, toggleReaction, markRead } from "@/lib/actions/messages-client";
import { MessageBubble } from "@/components/chat/message-bubble";
import { MediaPicker } from "@/components/chat/media-picker";
import { StickerPicker } from "@/components/chat/sticker-picker";
import { VoiceRecorder } from "@/components/chat/voice-recorder";
import type { Message, Attachment, MessageReaction } from "@/lib/supabase/database.types";

export interface ConversationHeader {
  id: string;
  type: "direct" | "group";
  name: string;
  avatarUrl: string | null;
  description: string | null;
  announcement: string | null;
}

export interface MemberInfo {
  userId: string;
  role: string;
  lastReadAt: string;
  profile: { id: string; display_name: string; avatar_url: string | null } | null;
}

export type MessageWithExtras = Message & { attachments: Attachment[]; message_reactions: MessageReaction[] };

export function ChatWindow({
  currentUserId,
  conversation,
  members,
  initialMessages,
}: {
  currentUserId: string;
  conversation: ConversationHeader;
  members: MemberInfo[];
  initialMessages: MessageWithExtras[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<MessageWithExtras[]>(initialMessages);
  const [memberState, setMemberState] = useState(members);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<MessageWithExtras | null>(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const otherMember = conversation.type === "direct" ? memberState.find((m) => m.userId !== currentUserId) : null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  useEffect(() => {
    const supabase = createClient();

    const messageChannel = supabase
      .channel(`messages:${conversation.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        async (payload) => {
          const newMessage = payload.new as Message;
          const { data: attachments } = await supabase.from("attachments").select("*").eq("message_id", newMessage.id);
          setMessages((prev) => [...prev, { ...newMessage, attachments: attachments ?? [], message_reactions: [] }]);
          if (newMessage.sender_id !== currentUserId) markRead(conversation.id, currentUserId);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        async () => {
          const { data } = await supabase
            .from("messages")
            .select("id, message_reactions(*)")
            .eq("conversation_id", conversation.id);
          if (!data) return;
          const reactionMap = new Map(data.map((d) => [d.id, d.message_reactions]));
          setMessages((prev) => prev.map((m) => ({ ...m, message_reactions: (reactionMap.get(m.id) as MessageReaction[]) ?? m.message_reactions })));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_members", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const updated = payload.new as { user_id: string; last_read_at: string };
          setMemberState((prev) => prev.map((m) => (m.userId === updated.user_id ? { ...m, lastReadAt: updated.last_read_at } : m)));
        }
      )
      .subscribe();

    const typingChannel = supabase
      .channel(`typing:${conversation.id}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          if (payload.isTyping) next.add(payload.userId);
          else next.delete(payload.userId);
          return next;
        });
      })
      .subscribe();
    typingChannelRef.current = typingChannel;

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(typingChannel);
    };
  }, [conversation.id, currentUserId]);

  const broadcastTyping = useCallback((isTyping: boolean) => {
    typingChannelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: currentUserId, isTyping } });
  }, [currentUserId]);

  function handleInputChange(value: string) {
    setInput(value);
    broadcastTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => broadcastTyping(false), 2000);
  }

  function notifyOthers(preview: string) {
    const recipientIds = memberState.filter((m) => m.userId !== currentUserId).map((m) => m.userId);
    if (recipientIds.length === 0) return;
    const senderName = memberState.find((m) => m.userId === currentUserId)?.profile?.display_name ?? conversation.name;
    fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientIds,
        type: "messages",
        title: conversation.type === "group" ? `${conversation.name}` : senderName,
        body: conversation.type === "group" ? `${senderName}: ${preview}` : preview,
        url: `/chats/${conversation.id}`,
      }),
    }).catch(() => {});
  }

  async function handleSend() {
    const content = input.trim();
    if (!content) return;
    setInput("");
    broadcastTyping(false);
    const replyToId = replyTo?.id ?? null;
    setReplyTo(null);
    const result = await sendMessage({ conversationId: conversation.id, senderId: currentUserId, type: "text", content, replyToId });
    if (result.message) {
      setMessages((prev) => (prev.some((m) => m.id === result.message!.id) ? prev : [...prev, { ...result.message!, attachments: [], message_reactions: [] }]));
      notifyOthers(content);
    }
  }

  const myLastMessageId = useMemo(() => {
    if (!otherMember) return null;
    const lastReadByOther = new Date(otherMember.lastReadAt);
    const mine = messages.filter((m) => m.sender_id === currentUserId && new Date(m.created_at) <= lastReadByOther);
    return mine.at(-1)?.id ?? null;
  }, [messages, otherMember, currentUserId]);

  const messageMap = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const profileMap = useMemo(() => new Map(memberState.map((m) => [m.userId, m.profile])), [memberState]);

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
        <button onClick={() => router.push("/chats")} className="md:hidden">
          <ArrowLeft size={20} />
        </button>
        {conversation.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={conversation.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-semibold text-white">
            {conversation.name[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{conversation.name}</p>
          {typingUsers.size > 0 && <p className="text-xs text-[var(--primary)]">入力中...</p>}
        </div>
        <Link href={`/chats/${conversation.id}/call?type=audio`} className="rounded-lg p-2 hover:bg-[var(--surface-hover)]" title="音声通話">
          <Phone size={18} />
        </Link>
        <Link href={`/chats/${conversation.id}/call?type=video`} className="rounded-lg p-2 hover:bg-[var(--surface-hover)]" title="ビデオ通話">
          <Video size={18} />
        </Link>
        <Link href={`/chats/${conversation.id}/info`} className="rounded-lg p-2 hover:bg-[var(--surface-hover)]" title="チャット情報">
          <Info size={18} />
        </Link>
      </div>

      {conversation.announcement && (
        <div className="border-b border-[var(--border)] bg-[var(--primary)]/10 px-4 py-2 text-xs">
          📢 {conversation.announcement}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto p-4">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            isMine={m.sender_id === currentUserId}
            senderProfile={profileMap.get(m.sender_id ?? "") ?? null}
            replyToMessage={m.reply_to_id ? messageMap.get(m.reply_to_id) ?? null : null}
            showReadReceipt={m.id === myLastMessageId}
            currentUserId={currentUserId}
            onReply={() => setReplyTo(m)}
            onReact={(emoji) => toggleReaction(m.id, currentUserId, emoji)}
          />
        ))}
      </div>

      {replyTo && (
        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs">
          <span className="truncate text-[var(--muted)]">返信: {replyTo.content?.slice(0, 60) || "(添付ファイル)"}</span>
          <button onClick={() => setReplyTo(null)} className="text-[var(--muted)]">
            ✕
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 border-t border-[var(--border)] p-3">
        <button onClick={() => setShowMediaPicker(true)} className="shrink-0 rounded-lg p-2 hover:bg-[var(--surface-hover)]" title="画像・ファイルを送信">
          <ImageIcon size={20} />
        </button>
        <button onClick={() => setShowStickerPicker((v) => !v)} className="shrink-0 rounded-lg p-2 hover:bg-[var(--surface-hover)]" title="スタンプ">
          <Smile size={20} />
        </button>
        <textarea
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
          placeholder="メッセージを入力"
          className="max-h-32 flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
        />
        {input.trim() ? (
          <button onClick={handleSend} className="shrink-0 rounded-xl bg-[var(--primary)] p-2.5 text-white">
            <Send size={18} />
          </button>
        ) : (
          <VoiceRecorder
            conversationId={conversation.id}
            senderId={currentUserId}
            onSent={(message) => {
              setMessages((prev) => [...prev, message]);
              notifyOthers("🎤 ボイスメッセージ");
            }}
          />
        )}
      </div>

      {showMediaPicker && (
        <MediaPicker
          conversationId={conversation.id}
          senderId={currentUserId}
          onClose={() => setShowMediaPicker(false)}
          onSent={(message) => {
            setMessages((prev) => [...prev, message]);
            notifyOthers(message.type === "image" ? "📷 画像" : message.type === "video" ? "🎬 動画" : "📎 ファイル");
          }}
        />
      )}
      {showStickerPicker && (
        <StickerPicker
          conversationId={conversation.id}
          senderId={currentUserId}
          onClose={() => setShowStickerPicker(false)}
          onSent={(message) => {
            setMessages((prev) => [...prev, message]);
            notifyOthers("スタンプ");
          }}
        />
      )}
    </div>
  );
}
