"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { ArrowLeft, Camera, Crown, ShieldCheck, UserMinus, UserPlus, LogOut, Trash2, QrCode, Link as LinkIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { updateGroupInfo, removeGroupMember, setMemberRole, leaveGroup, addGroupMembers } from "@/lib/actions/groups";
import type { Conversation, MemberRole } from "@/lib/supabase/database.types";

interface FriendProfile {
  id: string;
  display_id: string;
  display_name: string;
  avatar_url: string | null;
}

interface MemberRow {
  userId: string;
  role: MemberRole;
  joinedAt: string;
  profile: { id: string; display_id: string; display_name: string; avatar_url: string | null } | null;
}

export function GroupInfoView({
  conversation,
  members,
  currentUserId,
  currentUserRole,
  addableFriends,
}: {
  conversation: Conversation;
  members: MemberRow[];
  currentUserId: string;
  currentUserRole: MemberRole;
  addableFriends: FriendProfile[];
}) {
  const router = useRouter();
  const [name, setName] = useState(conversation.name ?? "");
  const [description, setDescription] = useState(conversation.description ?? "");
  const [announcement, setAnnouncement] = useState(conversation.announcement ?? "");
  const [avatarUrl, setAvatarUrl] = useState(conversation.avatar_url);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";
  const isOwner = currentUserRole === "owner";

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const supabase = createClient();
    const path = `${conversation.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("backgrounds").upload(path, file, { upsert: true });
    if (error) {
      setMessage("アップロードに失敗しました");
      return;
    }
    const { data } = supabase.storage.from("backgrounds").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    await updateGroupInfo(conversation.id, { avatarUrl: data.publicUrl });
    setMessage("グループ画像を更新しました");
  }

  async function handleSave() {
    setSaving(true);
    const result = await updateGroupInfo(conversation.id, { name, description, announcement });
    setSaving(false);
    setMessage(result.error ?? "保存しました");
  }

  async function handleRemove(userId: string, name: string) {
    if (!confirm(`${name} をグループから削除しますか?`)) return;
    await removeGroupMember(conversation.id, userId);
    router.refresh();
  }

  async function handleRoleChange(userId: string, role: "admin" | "member") {
    await setMemberRole(conversation.id, userId, role);
    router.refresh();
  }

  async function handleAddMember(userId: string) {
    await addGroupMembers(conversation.id, [userId]);
    setShowAddMembers(false);
    router.refresh();
  }

  async function handleLeave() {
    if (!confirm("このグループを退出しますか?")) return;
    await leaveGroup(conversation.id);
  }

  async function handleDelete() {
    if (!confirm("このグループを削除しますか?すべてのメッセージが失われ、取り消せません。")) return;
    const supabase = createClient();
    await supabase.from("conversations").delete().eq("id", conversation.id);
    router.push("/chats");
  }

  async function openQr() {
    const url = `${window.location.origin}/join/${conversation.invite_code}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 280, margin: 2, color: { dark: "#0f9d78", light: "#ffffff" } });
    setQrDataUrl(dataUrl);
    setShowQr(true);
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(`${window.location.origin}/join/${conversation.invite_code}`);
    setMessage("招待リンクをコピーしました");
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-y-auto">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
        <button onClick={() => router.back()}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold">グループ情報</h1>
      </div>

      <div className="flex flex-col items-center gap-2 p-6">
        <div className="relative">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-24 w-24 rounded-full object-cover" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--primary)] text-2xl font-semibold text-white">
              {name[0]?.toUpperCase()}
            </div>
          )}
          {canManage && (
            <button onClick={() => avatarInputRef.current?.click()} className="absolute bottom-0 right-0 rounded-full bg-[var(--primary)] p-1.5 text-white">
              <Camera size={14} />
            </button>
          )}
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={openQr}>
            <QrCode size={14} /> QR
          </Button>
          <Button size="sm" variant="secondary" onClick={copyInviteLink}>
            <LinkIcon size={14} /> 招待リンク
          </Button>
        </div>
      </div>

      <div className="space-y-3 px-4 pb-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted)]">グループ名</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} maxLength={60} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted)]">説明</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canManage}
            rows={2}
            className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] disabled:opacity-60"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted)]">アナウンス</label>
          <textarea
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            disabled={!canManage}
            rows={2}
            placeholder="メンバー全員に伝えたいこと"
            className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] disabled:opacity-60"
          />
        </div>
        {canManage && (
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        )}
        {message && <p className="text-sm text-[var(--muted)]">{message}</p>}
      </div>

      <div className="border-t border-[var(--border)] p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-[var(--muted)]">メンバー ({members.length}人)</p>
          {canManage && addableFriends.length > 0 && (
            <button onClick={() => setShowAddMembers(true)} className="flex items-center gap-1 text-xs text-[var(--primary)]">
              <UserPlus size={13} /> 追加
            </button>
          )}
        </div>
        <ul className="space-y-1">
          {members.map((m) =>
            m.profile ? (
              <li key={m.userId} className="flex items-center gap-3 rounded-xl p-2 hover:bg-[var(--surface-hover)]">
                {m.profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.profile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-semibold text-white">
                    {m.profile.display_name[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-sm">
                    {m.profile.display_name}
                    {m.role === "owner" && <Crown size={12} className="text-yellow-500" />}
                    {m.role === "admin" && <ShieldCheck size={12} className="text-[var(--primary)]" />}
                  </p>
                </div>
                {isOwner && m.userId !== currentUserId && m.role !== "owner" && (
                  <>
                    <button
                      onClick={() => handleRoleChange(m.userId, m.role === "admin" ? "member" : "admin")}
                      className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs"
                    >
                      {m.role === "admin" ? "管理者解除" : "管理者にする"}
                    </button>
                    <button onClick={() => handleRemove(m.userId, m.profile!.display_name)} className="rounded p-1.5 text-[var(--muted)] hover:bg-[var(--border)]">
                      <UserMinus size={14} />
                    </button>
                  </>
                )}
              </li>
            ) : null
          )}
        </ul>
      </div>

      <div className="space-y-2 border-t border-[var(--border)] p-4">
        <Button variant="secondary" onClick={handleLeave} className="w-full">
          <LogOut size={16} /> グループを退出
        </Button>
        {isOwner && (
          <Button variant="danger" onClick={handleDelete} className="w-full">
            <Trash2 size={16} /> グループを削除
          </Button>
        )}
      </div>

      {showQr && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowQr(false)}>
          <div className="w-full max-w-xs rounded-2xl bg-[var(--background)] p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex justify-end">
              <button onClick={() => setShowQr(false)}>
                <X size={18} />
              </button>
            </div>
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="QR code" className="mx-auto rounded-xl" />
            )}
            <p className="mt-3 text-sm font-medium">{name}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">このQRコードでグループに参加できます。</p>
          </div>
        </div>
      )}

      {showAddMembers && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center" onClick={() => setShowAddMembers(false)}>
          <div className="max-h-96 w-full max-w-xs overflow-y-auto rounded-t-2xl bg-[var(--background)] p-4 md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">友達を追加</h2>
              <button onClick={() => setShowAddMembers(false)}>
                <X size={18} />
              </button>
            </div>
            <ul className="space-y-1">
              {addableFriends.map((f) => (
                <li key={f.id}>
                  <button onClick={() => handleAddMember(f.id)} className="flex w-full items-center gap-3 rounded-xl p-2 hover:bg-[var(--surface-hover)]">
                    {f.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-semibold text-white">
                        {f.display_name[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className="truncate text-sm">{f.display_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
