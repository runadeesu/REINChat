"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Attachment } from "@/lib/supabase/database.types";

// The `attachments` storage bucket is private (only conversation members
// can read, enforced by RLS), so a plain public URL won't render for
// anyone — attachments.url stores the storage *path*, and this resolves a
// short-lived signed URL client-side, scoped to whoever is actually viewing.
function useSignedUrl(path: string) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.storage
      .from("attachments")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled && data) setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return url;
}

export function AttachmentImage({ attachment }: { attachment: Attachment }) {
  const url = useSignedUrl(attachment.url);
  if (!url) return <div className="h-40 w-40 animate-pulse rounded-lg bg-[var(--surface-hover)]" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={attachment.filename ?? ""} className="max-w-full rounded-lg" />;
}

export function AttachmentVideo({ attachment }: { attachment: Attachment }) {
  const url = useSignedUrl(attachment.url);
  if (!url) return <div className="h-40 w-64 animate-pulse rounded-lg bg-[var(--surface-hover)]" />;
  return <video src={url} controls className="max-w-full rounded-lg" />;
}

export function AttachmentAudio({ attachment }: { attachment: Attachment }) {
  const url = useSignedUrl(attachment.url);
  if (!url) return <div className="h-8 w-48 animate-pulse rounded-full bg-[var(--surface-hover)]" />;
  return <audio src={url} controls />;
}

export function AttachmentFile({ attachment }: { attachment: Attachment }) {
  const url = useSignedUrl(attachment.url);
  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className={`block underline ${url ? "" : "pointer-events-none opacity-50"}`}
    >
      📎 {attachment.filename ?? "ファイル"}
    </a>
  );
}
