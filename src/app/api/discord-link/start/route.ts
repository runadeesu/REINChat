import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkDiscordBotSecret } from "@/lib/discord/shared-secret";

const CODE_TTL_MS = 15 * 60 * 1000;

// Called by the Discord bot's /verify-reinchat command. Issues a
// short-lived code the member opens in a browser (while logged into
// REINChat) to confirm the link directly — independent of any ReinAI link.
export async function POST(request: Request) {
  if (!checkDiscordBotSecret(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const discordId = typeof body.discordId === "string" ? body.discordId : "";
  const discordUsername = typeof body.discordUsername === "string" ? body.discordUsername : "";
  if (!discordId || !discordUsername) {
    return NextResponse.json({ error: "discordId and discordUsername are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  await admin.from("discord_verification_codes").delete().eq("discord_id", discordId);

  const code = crypto.randomUUID().replace(/-/g, "");
  const { error } = await admin.from("discord_verification_codes").insert({
    code,
    discord_id: discordId,
    discord_username: discordUsername,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://reinchat.vercel.app").replace(/\/$/, "");
  return NextResponse.json({ code, url: `${baseUrl}/link-discord/${code}`, expiresInMinutes: 15 });
}
