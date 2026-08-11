"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createGroup } from "@/lib/actions/groups";

interface FriendProfile {
  id: string;
  display_id: string;
  display_name: string;
  avatar_url: string | null;
}

export function NewGroupForm({ friends }: { friends: FriendProfile[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    setError(null);
    setCreating(true);
    const result = await createGroup({ name, memberIds: [...selected] });
    setCreating(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
        <button onClick={() => router.back()}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold">グループを作成</h1>
      </div>

      <div className="border-b border-[var(--border)] p-4">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="グループ名" maxLength={60} />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <p className="mb-2 text-xs font-semibold text-[var(--muted)]">メンバーを選択({selected.size}人)</p>
        {friends.length === 0 && <p className="text-sm text-[var(--muted)]">友達がいません。まず友達を追加してください。</p>}
        <ul className="space-y-1">
          {friends.map((f) => (
            <li key={f.id}>
              <button onClick={() => toggle(f.id)} className="flex w-full items-center gap-3 rounded-xl p-2 hover:bg-[var(--surface-hover)]">
                {f.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-semibold text-white">
                    {f.display_name[0]?.toUpperCase()}
                  </div>
                )}
                <span className="flex-1 truncate text-left text-sm">{f.display_name}</span>
                {selected.has(f.id) && <Check size={16} className="text-[var(--primary)]" />}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {error && <p className="px-4 pb-2 text-sm text-[var(--danger)]">{error}</p>}
      <div className="border-t border-[var(--border)] p-4">
        <Button onClick={handleCreate} disabled={creating || !name.trim() || selected.size === 0} className="w-full">
          {creating ? "作成中..." : "グループを作成"}
        </Button>
      </div>
    </div>
  );
}
