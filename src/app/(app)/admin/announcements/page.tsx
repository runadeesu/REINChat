import { listAnnouncements } from "@/lib/actions/admin";
import { AnnouncementsView } from "./announcements-view";

export default async function AdminAnnouncementsPage() {
  const result = await listAnnouncements();
  if ("error" in result) {
    return <p className="text-sm text-[var(--danger)]">{result.error}</p>;
  }

  return <AnnouncementsView initialAnnouncements={result.announcements} />;
}
