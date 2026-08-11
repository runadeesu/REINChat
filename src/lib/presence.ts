// A profile is considered "online" if its last_online_at heartbeat landed
// within this window — more reliable than trusting a stored is_online
// boolean, since unload/network-drop events aren't guaranteed to fire.
const ONLINE_WINDOW_MS = 45_000;

export function isRecentlyOnline(lastOnlineAt: string | null | undefined): boolean {
  if (!lastOnlineAt) return false;
  return Date.now() - new Date(lastOnlineAt).getTime() < ONLINE_WINDOW_MS;
}
