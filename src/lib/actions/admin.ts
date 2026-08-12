"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reinAiUrl } from "@/lib/reinai/shared-secret";
import type { Profile, Report, Announcement } from "@/lib/supabase/database.types";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false as const };

  const { data: isAdmin } = await supabase.rpc("is_admin", { uid: user.id });
  return { supabase, user, isAdmin: Boolean(isAdmin) };
}

export async function checkIsAdmin(): Promise<boolean> {
  const { isAdmin } = await requireAdmin();
  return isAdmin;
}

export interface SystemStatus {
  totalUsers: number;
  suspendedUsers: number;
  totalConversations: number;
  totalMessages: number;
  openReports: number;
  activeCalls: number;
}

export async function getSystemStatus(): Promise<SystemStatus | { error: string }> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "権限がありません" };

  const admin = createAdminClient();
  const [users, suspended, conversations, messages, reports, calls] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_suspended", true),
    admin.from("conversations").select("id", { count: "exact", head: true }),
    admin.from("messages").select("id", { count: "exact", head: true }).is("deleted_at", null),
    admin.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    admin.from("calls").select("id", { count: "exact", head: true }).in("status", ["ringing", "active"]),
  ]);

  return {
    totalUsers: users.count ?? 0,
    suspendedUsers: suspended.count ?? 0,
    totalConversations: conversations.count ?? 0,
    totalMessages: messages.count ?? 0,
    openReports: reports.count ?? 0,
    activeCalls: calls.count ?? 0,
  };
}

export async function searchUsers(query: string): Promise<{ profiles: Profile[] } | { error: string }> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "権限がありません" };

  const trimmed = query.trim().replace(/^@/, "");
  if (!trimmed) return { profiles: [] };

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .or(`display_id.ilike.%${trimmed}%,display_name.ilike.%${trimmed}%`)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return { error: error.message };
  return { profiles: (data ?? []) as Profile[] };
}

export async function setUserSuspended(targetUserId: string, suspended: boolean, reason?: string) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "権限がありません" };

  const { error } = await supabase.rpc("admin_set_suspended", {
    target_user_id: targetUserId,
    suspended,
    reason: reason || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function listReports(): Promise<{ reports: Report[] } | { error: string }> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "権限がありません" };

  const { data, error } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) return { error: error.message };
  return { reports: (data ?? []) as Report[] };
}

export async function setReportStatus(reportId: string, status: "open" | "reviewed" | "dismissed") {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "権限がありません" };

  const { error } = await supabase.from("reports").update({ status }).eq("id", reportId);
  if (error) return { error: error.message };

  revalidatePath("/admin/reports");
  return { ok: true };
}

export async function listAnnouncements(): Promise<{ announcements: Announcement[] } | { error: string }> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "権限がありません" };

  const { data, error } = await supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) return { error: error.message };
  return { announcements: (data ?? []) as Announcement[] };
}

export async function createAnnouncement(message: string) {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!isAdmin || !user) return { error: "権限がありません" };

  const trimmed = message.trim();
  if (!trimmed) return { error: "メッセージを入力してください" };

  const { error } = await supabase.from("announcements").insert({ message: trimmed, created_by: user.id, active: true });
  if (error) return { error: error.message };

  relayAnnouncementToReinAi(trimmed);

  revalidatePath("/admin/announcements");
  return { ok: true };
}

// Fire-and-forget: also posts to ReinAI so its users see the same
// announcement in their own banner. Best-effort — a relay failure doesn't
// block the REINChat-side announcement from being created.
function relayAnnouncementToReinAi(message: string) {
  const secret = process.env.REINCHAT_SHARED_SECRET;
  if (!secret) return;

  fetch(`${reinAiUrl()}/api/reinchat/announcements`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-ReinChat-Secret": secret },
    body: JSON.stringify({ message }),
  }).catch(() => {});
}

export async function setAnnouncementActive(id: string, active: boolean) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "権限がありません" };

  const { error } = await supabase.from("announcements").update({ active }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/announcements");
  return { ok: true };
}

export async function deleteAnnouncement(id: string) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "権限がありません" };

  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/announcements");
  return { ok: true };
}
