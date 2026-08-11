"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { QrCode, Search, UserPlus, Check, X, Trash2, ShieldOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { searchByDisplayId, sendFriendRequest, respondFriendRequest, removeFriend, blockUser, unblockUser } from "@/lib/actions/friends";
import { startDirectConversation } from "@/lib/actions/chat";
import { isRecentlyOnline } from "@/lib/presence";

interface MiniProfile {
  id: string;
  display_id: string;
  display_name: string;
  avatar_url: string | null;
  status_message?: string | null;
  last_online_at?: string;
}

type Tab = "friends" | "requests" | "search" | "blocked";

export function FriendsView({
  currentUserId,
  friends,
  incoming,
  outgoing,
  blocked,
}: {
  currentUserId: string;
  friends: MiniProfile[];
  incoming: { requestId: string; profile?: MiniProfile }[];
  outgoing: { requestId: string; profile?: MiniProfile }[];
  blocked: MiniProfile[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("friends");
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<MiniProfile | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("friend-requests-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests", filter: `receiver_id=eq.${currentUserId}` },
        () => router.refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, router]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setSearchError(null);
    setSearchResult(null);
    const result = await searchByDisplayId(query);
    setSearching(false);
    if (result.error) setSearchError(result.error);
    else setSearchResult(result.profile ?? null);
  }

  function handleSendRequest(targetId: string) {
    startTransition(async () => {
      await sendFriendRequest(targetId);
      setSearchResult(null);
      setQuery("");
      router.refresh();
    });
  }

  function handleRespond(requestId: string, action: "accept" | "reject" | "cancel") {
    startTransition(async () => {
      await respondFriendRequest(requestId, action);
      router.refresh();
    });
  }

  function handleRemove(friendId: string) {
    if (!confirm("この友達を削除しますか?")) return;
    startTransition(async () => {
      await removeFriend(friendId);
      router.refresh();
    });
  }

  function handleBlock(userId: string) {
    if (!confirm("このユーザーをブロックしますか?友達関係も解除されます。")) return;
    startTransition(async () => {
      await blockUser(userId);
      router.refresh();
    });
  }

  function handleUnblock(userId: string) {
    startTransition(async () => {
      await unblockUser(userId);
      router.refresh();
    });
  }

  function handleChat(friendId: string) {
    startTransition(async () => {
      await startDirectConversation(friendId);
    });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h1 className="text-lg font-semibold">友達</h1>
        <Button size="sm" variant="secondary" onClick={() => router.push("/friends/scan")}>
          <QrCode size={14} /> QRで追加
        </Button>
      </div>

      <div className="flex gap-1 border-b border-[var(--border)] px-4">
        {(
          [
            ["friends", `友達 ${friends.length}`],
            ["requests", `申請 ${incoming.length}`],
            ["search", "検索"],
            ["blocked", `ブロック中 ${blocked.length}`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`border-b-2 px-3 py-2 text-sm ${tab === key ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--muted)]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "friends" && (
          <ul className="space-y-1">
            {friends.length === 0 && <p className="text-sm text-[var(--muted)]">まだ友達がいません。「検索」または「QRで追加」から友達を追加しましょう。</p>}
            {friends.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-[var(--surface-hover)]">
                <Avatar profile={f} />
                <button onClick={() => handleChat(f.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium">{f.display_name}</p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {isRecentlyOnline(f.last_online_at) ? "オンライン" : f.status_message || `@${f.display_id}`}
                  </p>
                </button>
                <button onClick={() => handleBlock(f.id)} className="rounded p-1.5 text-[var(--muted)] hover:bg-[var(--border)]" title="ブロック">
                  <ShieldOff size={14} />
                </button>
                <button onClick={() => handleRemove(f.id)} className="rounded p-1.5 text-[var(--muted)] hover:bg-[var(--border)]" title="削除">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {tab === "requests" && (
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-xs font-semibold text-[var(--muted)]">受け取った申請</p>
              <ul className="space-y-1">
                {incoming.length === 0 && <p className="text-sm text-[var(--muted)]">申請はありません</p>}
                {incoming.map(({ requestId, profile }) =>
                  profile ? (
                    <li key={requestId} className="flex items-center gap-3 rounded-xl p-2">
                      <Avatar profile={profile} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{profile.display_name}</p>
                        <p className="truncate text-xs text-[var(--muted)]">@{profile.display_id}</p>
                      </div>
                      <button onClick={() => handleRespond(requestId, "accept")} disabled={isPending} className="rounded-full bg-[var(--primary)] p-1.5 text-white">
                        <Check size={14} />
                      </button>
                      <button onClick={() => handleRespond(requestId, "reject")} disabled={isPending} className="rounded-full bg-[var(--surface-hover)] p-1.5">
                        <X size={14} />
                      </button>
                    </li>
                  ) : null
                )}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-[var(--muted)]">送信した申請</p>
              <ul className="space-y-1">
                {outgoing.length === 0 && <p className="text-sm text-[var(--muted)]">送信中の申請はありません</p>}
                {outgoing.map(({ requestId, profile }) =>
                  profile ? (
                    <li key={requestId} className="flex items-center gap-3 rounded-xl p-2">
                      <Avatar profile={profile} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{profile.display_name}</p>
                        <p className="text-xs text-[var(--muted)]">承認待ち</p>
                      </div>
                      <button onClick={() => handleRespond(requestId, "cancel")} disabled={isPending} className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs">
                        取消
                      </button>
                    </li>
                  ) : null
                )}
              </ul>
            </div>
          </div>
        )}

        {tab === "search" && (
          <div className="space-y-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="アカウントIDで検索 (例: rein_ab12cd34)" />
              <Button type="submit" disabled={searching}>
                <Search size={16} />
              </Button>
            </form>
            {searchError && <p className="text-sm text-[var(--danger)]">{searchError}</p>}
            {searchResult && (
              <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3">
                <Avatar profile={searchResult} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{searchResult.display_name}</p>
                  <p className="truncate text-xs text-[var(--muted)]">@{searchResult.display_id}</p>
                </div>
                <Button size="sm" onClick={() => handleSendRequest(searchResult.id)} disabled={isPending}>
                  <UserPlus size={14} /> 追加
                </Button>
              </div>
            )}
          </div>
        )}

        {tab === "blocked" && (
          <ul className="space-y-1">
            {blocked.length === 0 && <p className="text-sm text-[var(--muted)]">ブロック中のユーザーはいません</p>}
            {blocked.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-xl p-2">
                <Avatar profile={b} />
                <p className="min-w-0 flex-1 truncate text-sm">{b.display_name}</p>
                <button onClick={() => handleUnblock(b.id)} className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-xs">
                  <ShieldCheck size={12} /> 解除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Avatar({ profile }: { profile: MiniProfile }) {
  if (profile.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={profile.avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-semibold text-white">
      {profile.display_name[0]?.toUpperCase()}
    </div>
  );
}
