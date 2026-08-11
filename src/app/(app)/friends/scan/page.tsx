"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<import("qr-scanner").default | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraAvailable, setCameraAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const QrScannerModule = (await import("qr-scanner")).default;
        const hasCamera = await QrScannerModule.hasCamera();
        if (cancelled) return;
        if (!hasCamera) {
          setCameraAvailable(false);
          return;
        }

        if (!videoRef.current) return;
        const scanner = new QrScannerModule(videoRef.current, (result) => handleDecoded(result.data), {
          highlightScanRegion: true,
          highlightCodeOutline: true,
        });
        scannerRef.current = scanner;
        await scanner.start();
      } catch {
        setCameraAvailable(false);
      }
    }

    start();
    return () => {
      cancelled = true;
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDecoded(data: string) {
    try {
      const url = new URL(data);
      const match = url.pathname.match(/\/add\/([^/]+)/);
      if (match) {
        router.push(`/add/${match[1]}`);
        return;
      }
    } catch {
      // Not a URL — fall through to treating it as a raw display ID below.
    }
    setError("REINChatのQRコードではないようです");
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const QrScannerModule = (await import("qr-scanner")).default;
      const result = await QrScannerModule.scanImage(file, { returnDetailedScanResult: true });
      handleDecoded(result.data);
    } catch {
      setError("QRコードを読み取れませんでした");
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
      <div className="flex w-full max-w-sm items-center justify-between">
        <h1 className="text-lg font-semibold">QRコードを読み取る</h1>
        <button onClick={() => router.back()}>
          <X size={20} />
        </button>
      </div>

      {cameraAvailable ? (
        <video ref={videoRef} className="aspect-square w-full max-w-sm rounded-2xl bg-black object-cover" muted playsInline />
      ) : (
        <p className="text-sm text-[var(--muted)]">カメラが利用できません。画像から読み取ってください。</p>
      )}

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
        <Upload size={16} /> 画像から読み取る
      </Button>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
    </div>
  );
}
