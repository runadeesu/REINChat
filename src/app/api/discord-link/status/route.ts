import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkDiscordBotSecret } from "@/lib/discord/shared-secret";

// The bot polls this to find newly-confirmed links it hasn't assigned the
// verified role for yet, then calls /ack once it has.
export async function GET(request: Request) {
  if (!checkDiscordBotSecret(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("discord_links")
    .select("discord_id, discord_username, linked_at")
    .is("notified_at", null)
    .order("linked_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ links: data ?? [] });
}
