import { getSystemStatus } from "@/lib/actions/admin";

export default async function AdminDashboardPage() {
  const status = await getSystemStatus();

  if ("error" in status) {
    return <p className="text-sm text-[var(--danger)]">{status.error}</p>;
  }

  const items = [
    { label: "総ユーザー数", value: status.totalUsers },
    { label: "停止中のユーザー", value: status.suspendedUsers },
    { label: "総会話数", value: status.totalConversations },
    { label: "総メッセージ数", value: status.totalMessages },
    { label: "未対応の通報", value: status.openReports },
    { label: "進行中の通話", value: status.activeCalls },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-[var(--border)] p-4">
          <p className="text-xs text-[var(--muted)]">{item.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{item.value.toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
