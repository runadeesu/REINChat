import { listReports } from "@/lib/actions/admin";
import { ReportsView } from "./reports-view";

export default async function AdminReportsPage() {
  const result = await listReports();
  if ("error" in result) {
    return <p className="text-sm text-[var(--danger)]">{result.error}</p>;
  }

  return <ReportsView initialReports={result.reports} />;
}
