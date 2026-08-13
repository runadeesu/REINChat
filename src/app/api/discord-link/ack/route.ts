import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkDiscordBotSecret } from "@/lib/discord/shared-secret";

export async function POST(request: Request) {
  if (!checkDiscordBotSecret(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const discordIds: string[] = Array.isArray(body.discordIds) ? body.discordIds.filter((id: unknown) => typeof id === "string") : [];
  if (discordIds.length === 0) {
    return NextResponse.json({ error: "discordIds is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("discord_links").update({ notified_at: new Date().toISOString() }).in("discord_id", discordIds);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
