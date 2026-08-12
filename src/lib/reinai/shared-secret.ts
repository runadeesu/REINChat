// Shared-secret auth for server-to-server calls between REINChat and
// ReinAI (a separate app with its own Auth.js-based accounts).
export function checkReinAiSecret(request: Request): boolean {
  const secret = request.headers.get("X-ReinChat-Secret");
  return Boolean(secret) && secret === process.env.REINCHAT_SHARED_SECRET;
}

export function reinAiUrl(): string {
  return (process.env.REINAI_URL ?? "https://reinai-app.vercel.app").replace(/\/$/, "");
}
