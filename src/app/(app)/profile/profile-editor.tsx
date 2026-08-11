"use client";

import { useRef, useState } from "react";
import QRCode from "qrcode";
import { Camera, QrCode, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { updateProfile, updateAvatar, updateBackground } from "@/lib/actions/profile";
import type { Profile } from "@/lib/supabase/database.types";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function ProfileEditor({ profile, email }: { profile: Profile; email: string }) {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [displayId, setDisplayId] = useState(profile.display_id);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [statusMessage, setStatusMessage] = useState(profile.status_message ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [backgroundUrl, setBackgroundUrl] = useState(profile.background_url);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  async function uploadImage(file: File, bucket: "avatars" | "backgrounds") {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setMessage("画像形式はJPEG/PNG/WEBP/GIFのみ対応しています");
      return null;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setMessage("ファイルサイズは5MB以下にしてください");
      return null;
    }

    const supabase = createClient();
    const path = `${profile.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) {
      setMessage(`アップロードに失敗しました: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file, "avatars");
    if (url) {
      setAvatarUrl(url);
      await updateAvatar(url);
      setMessage("アイコンを更新しました");
    }
  }

  async function handleBackgroundChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file, "backgrounds");
    if (url) {
      setBackgroundUrl(url);
      await updateBackground(url);
      setMessage("背景画像を更新しました");
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateProfile({ displayName, displayId, bio, statusMessage });
    setSaving(false);
    setMessage(result.error ?? "保存しました");
  }

  async function openQr() {
    const url = `${window.location.origin}/add/${profile.display_id}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 280, margin: 2, color: { dark: "#0f9d78", light: "#ffffff" } });
    setQrDataUrl(dataUrl);
    setShowQr(true);
  }

  return (
    <div className="space-y-6">
      <div className="relative h-32 overflow-hidden rounded-2xl bg-[var(--surface)]">
        {backgroundUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backgroundUrl} alt="" className="h-full w-full object-cover" />
        )}
        <button
          onClick={() => backgroundInputRef.current?.click()}
          className="absolute bottom-2 right-2 rounded-full bg-black/50 p-2 text-white"
          title="背景画像を変更"
        >
          <Camera size={16} />
        </button>
        <input ref={backgroundInputRef} type="file" accept="image/*" className="hidden" onChange={handleBackgroundChange} />
      </div>

      <div className="-mt-14 flex items-end gap-4 px-2">
        <div className="relative">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-24 w-24 rounded-full border-4 border-[var(--background)] object-cover" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-[var(--background)] bg-[var(--primary)] text-2xl font-semibold text-white">
              {displayName[0]?.toUpperCase()}
            </div>
          )}
          <button
            onClick={() => avatarInputRef.current?.click()}
            className="absolute bottom-0 right-0 rounded-full bg-[var(--primary)] p-1.5 text-white"
            title="アイコンを変更"
          >
            <Camera size={14} />
          </button>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>
        <Button variant="secondary" size="sm" onClick={openQr} className="mb-2">
          <QrCode size={14} /> マイQRコード
        </Button>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted)]">メールアドレス</label>
          <Input value={email} disabled />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted)]">表示名</label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted)]">アカウントID</label>
          <Input value={displayId} onChange={(e) => setDisplayId(e.target.value)} maxLength={30} />
          <p className="text-xs text-[var(--muted)]">半角英数字・アンダースコア・ピリオドのみ。友達検索・QRコードに使われます。</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted)]">ステータスメッセージ</label>
          <Input value={statusMessage} onChange={(e) => setStatusMessage(e.target.value)} maxLength={60} placeholder="いまどうしてる?" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--muted)]">自己紹介</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={200}
            className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          />
        </div>
        {message && <p className="text-sm text-[var(--muted)]">{message}</p>}
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "保存中..." : "保存"}
        </Button>
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
            <p className="mt-3 text-sm font-medium">@{displayId}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">このQRコードを友達に読み取ってもらうと、友達追加できます。</p>
          </div>
        </div>
      )}
    </div>
  );
}
