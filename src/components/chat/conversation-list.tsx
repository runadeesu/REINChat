"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Pin, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { formatDistanceToNowStrict } from "date-fns";
import { ja } from "date-fns/locale";

export interface ConversationSummary {
  id: string;
  type: "direct" | "group";
  name: string;
  avatarUrl: string | null;
  lastMessagePreview: string;
  updatedAt: string;
  isPinned: boolean;
  isUnread: boolean;
}

export function ConversationList({
  currentUserId,
  initialConversations,
}: {
  currentUserId: string;
  initialConversations: ConversationSummary[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  // The realtime listener below triggers router.refresh(), which re-runs
  // the server component and hands back a fresh initialConversations prop
  // — no local mirrored state needed.
  const conversations = initialConversations;

  useEffect(() => {
    if (conversations.length === 0) return;
    const supabase = createClient();
    const ids = conversations.map((c) => c.id);

    const channel = supabase
      .channel("chat-list-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=in.(${ids.join(",")})` },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const sorted = [...conversations].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
        <h1 className="text-lg font-semibold">チャット</h1>
        <Link href="/chats/new-group" className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)]" title="グループを作成">
          <UserPlus size={18} />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && <p className="p-4 text-sm text-[var(--muted)]">チャットはまだありません。友達を追加してメッセージを送ってみましょう。</p>}
        {sorted.map((c) => (
          <Link
            key={c.id}
            href={`/chats/${c.id}`}
            className={cn(
              "flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-hover)]",
              pathname === `/chats/${c.id}` && "bg-[var(--surface-hover)]"
            )}
          >
            {c.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.avatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-lg font-semibold text-white">
                {c.name[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                {c.isPinned && <Pin size={11} className="shrink-0 fill-current text-[var(--muted)]" />}
                <p className={cn("truncate text-sm", c.isUnread ? "font-semibold" : "font-medium")}>{c.name}</p>
              </div>
              <p className={cn("truncate text-xs", c.isUnread ? "font-medium text-[var(--foreground)]" : "text-[var(--muted)]")}>
                {c.lastMessagePreview || "まだメッセージはありません"}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-[10px] text-[var(--muted)]">
                {formatDistanceToNowStrict(new Date(c.updatedAt), { addSuffix: false, locale: ja })}
              </span>
              {c.isUnread && <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
