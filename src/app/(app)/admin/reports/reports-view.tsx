"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { setReportStatus } from "@/lib/actions/admin";
import type { Report } from "@/lib/supabase/database.types";

const STATUS_LABEL: Record<string, string> = { open: "未対応", reviewed: "対応済み", dismissed: "却下" };

const TARGET_TYPE_LABEL: Record<string, string> = { user: "ユーザー", message: "メッセージ", conversation: "会話" };

export function ReportsView({ initialReports }: { initialReports: Report[] }) {
  const [reports, setReports] = useState(initialReports);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateStatus(report: Report, status: "reviewed" | "dismissed") {
    startTransition(async () => {
      const result = await setReportStatus(report.id, status);
      if (result.error) {
        setError(result.error);
        return;
      }
      setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, status } : r)));
    });
  }

  if (reports.length === 0) {
    return <p className="text-sm text-[var(--muted)]">通報はありません。</p>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <ul className="space-y-2">
        {reports.map((report) => (
          <li key={report.id} className="space-y-2 rounded-xl border border-[var(--border)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-xs">
                {TARGET_TYPE_LABEL[report.target_type] ?? report.target_type}
              </span>
              <span className="text-xs text-[var(--muted)]">
                {format(new Date(report.created_at), "yyyy/MM/dd HH:mm", { locale: ja })}
              </span>
            </div>
            <p className="text-sm">{report.reason}</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[var(--muted)]">状態：{STATUS_LABEL[report.status] ?? report.status}</span>
              {report.status === "open" && (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => updateStatus(report, "dismissed")} disabled={isPending}>
                    却下
                  </Button>
                  <Button size="sm" onClick={() => updateStatus(report, "reviewed")} disabled={isPending}>
                    対応済みにする
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
