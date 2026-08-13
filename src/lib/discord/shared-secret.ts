// Shared-secret auth for the Discord bot's server-to-server calls into
// REINChat, mirroring the same X-Bot-Secret pattern the bot already uses
// against ReinAI.
export function checkDiscordBotSecret(request: Request): boolean {
  const secret = request.headers.get("X-Bot-Secret");
  return Boolean(secret) && secret === process.env.DISCORD_BOT_SECRET;
}
