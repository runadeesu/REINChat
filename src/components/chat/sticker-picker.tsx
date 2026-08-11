"use client";

import { useEffect, useState } from "react";
import { X, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Sticker, StickerPack } from "@/lib/supabase/database.types";
import type { MessageWithExtras } from "@/components/chat/chat-window";

export function StickerPicker({
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
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [stickersByPack, setStickersByPack] = useState<Map<string, Sticker[]>>(new Map());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [activePack, setActivePack] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const [{ data: packData }, { data: stickerData }, { data: favData }] = await Promise.all([
        supabase.from("sticker_packs").select("*").order("created_at"),
        supabase.from("stickers").select("*").order("sort_order"),
        supabase.from("sticker_favorites").select("sticker_id").eq("user_id", senderId),
      ]);

      setPacks(packData ?? []);
      const map = new Map<string, Sticker[]>();
      for (const s of stickerData ?? []) {
        const list = map.get(s.pack_id) ?? [];
        list.push(s);
        map.set(s.pack_id, list);
      }
      setStickersByPack(map);
      setFavorites(new Set((favData ?? []).map((f) => f.sticker_id)));
      setActivePack(packData?.[0]?.id ?? null);
      setLoading(false);
    }
    load();
  }, [senderId]);

  async function handleSend(sticker: Sticker) {
    const supabase = createClient();
    const { data: messageRow } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: senderId, type: "sticker", content: sticker.image_url, sticker_id: sticker.id })
      .select()
      .single();

    await supabase.from("sticker_recent").upsert({ user_id: senderId, sticker_id: sticker.id, used_at: new Date().toISOString() });
    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);

    if (messageRow) onSent({ ...messageRow, attachments: [], message_reactions: [] });
    onClose();
  }

  async function toggleFavorite(sticker: Sticker, e: React.MouseEvent) {
    e.stopPropagation();
    const supabase = createClient();
    if (favorites.has(sticker.id)) {
      await supabase.from("sticker_favorites").delete().eq("user_id", senderId).eq("sticker_id", sticker.id);
      setFavorites((prev) => {
        const next = new Set(prev);
        next.delete(sticker.id);
        return next;
      });
    } else {
      await supabase.from("sticker_favorites").insert({ user_id: senderId, sticker_id: sticker.id });
      setFavorites((prev) => new Set(prev).add(sticker.id));
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div className="flex h-96 w-full max-w-sm flex-col rounded-t-2xl bg-[var(--background)] p-4 md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">スタンプ</h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {loading && <p className="text-sm text-[var(--muted)]">読み込み中...</p>}
        {!loading && packs.length === 0 && <p className="flex-1 text-center text-sm text-[var(--muted)]">まだスタンプがありません。</p>}

        {!loading && packs.length > 0 && (
          <>
            <div className="mb-2 flex gap-2 overflow-x-auto">
              {packs.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActivePack(p.id)}
                  className={`shrink-0 rounded-lg px-2 py-1 text-xs ${activePack === p.id ? "bg-[var(--primary)] text-white" : "bg-[var(--surface)]"}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <div className="grid flex-1 grid-cols-4 gap-2 overflow-y-auto">
              {(stickersByPack.get(activePack ?? "") ?? []).map((s) => (
                <button key={s.id} onClick={() => handleSend(s)} className="relative rounded-lg p-1 hover:bg-[var(--surface-hover)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.image_url} alt={s.name} className="h-16 w-16 object-contain" />
                  <span onClick={(e) => toggleFavorite(s, e)} className="absolute right-0 top-0">
                    <Star size={12} className={favorites.has(s.id) ? "fill-current text-yellow-500" : "text-[var(--muted)]"} />
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
