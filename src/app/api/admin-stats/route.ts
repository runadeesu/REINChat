import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkReinAiSecret } from "@/lib/reinai/shared-secret";

// Called by reinai-admin's dashboard to show REINChat's stats alongside
// ReinAI's own, authenticated with the same shared secret used elsewhere
// in the ReinAI <-> REINChat integration.
export async function GET(request: Request) {
  if (!checkReinAiSecret(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const [users, conversations, messages, openReports] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("conversations").select("id", { count: "exact", head: true }),
    admin.from("messages").select("id", { count: "exact", head: true }).is("deleted_at", null),
    admin.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);

  return NextResponse.json({
    totalUsers: users.count ?? 0,
    totalConversations: conversations.count ?? 0,
    totalMessages: messages.count ?? 0,
    openReports: openReports.count ?? 0,
  });
}
