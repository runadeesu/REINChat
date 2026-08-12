import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkReinAiSecret } from "@/lib/reinai/shared-secret";

// Called by ReinAI when an admin posts an announcement there, so it also
// reaches REINChat's users via the announcement banner. One-way relay on
// create only, mirroring the REINChat -> ReinAI direction in
// src/lib/actions/admin.ts's createAnnouncement.
export async function POST(request: Request) {
  if (!checkReinAiSecret(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 500) {
    return NextResponse.json({ error: "message must be 1-500 characters" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("announcements").insert({ message, active: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
