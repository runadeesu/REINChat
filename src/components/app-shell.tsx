"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle, Users, User, LogOut, Sun, Moon } from "lucide-react";
import { ReinChatLogo } from "@/components/brand/logo";
import { useTheme } from "@/components/theme-provider";
import { PresenceHeartbeat } from "@/components/presence-heartbeat";
import { IncomingCallListener } from "@/components/incoming-call-listener";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import type { Profile } from "@/lib/supabase/database.types";

const NAV = [
  { href: "/chats", label: "チャット", icon: MessageCircle },
  { href: "/friends", label: "友達", icon: Users },
  { href: "/profile", label: "プロフィール", icon: User },
];

export function AppShell({ profile, children }: { profile: Profile | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {profile && <PresenceHeartbeat userId={profile.id} />}
      {profile && <IncomingCallListener userId={profile.id} />}

      {/* Desktop rail */}
      <aside className="hidden w-20 shrink-0 flex-col items-center border-r border-[var(--border)] bg-[var(--surface)] py-4 md:flex">
        <Link href="/chats" className="mb-6">
          <ReinChatLogo size={26} withWordmark={false} />
        </Link>
        <nav className="flex flex-1 flex-col items-center gap-2">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex w-16 flex-col items-center gap-1 rounded-xl py-2 text-[10px]",
                  active ? "bg-[var(--primary)]/10 text-[var(--primary)]" : "text-[var(--muted)] hover:bg-[var(--surface-hover)]"
                )}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button onClick={toggleTheme} className="mb-2 rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-hover)]" title="テーマ切替">
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button onClick={handleLogout} className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-hover)]" title="ログアウト">
          <LogOut size={18} />
        </button>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--border)] bg-[var(--surface)] md:hidden">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]",
                active ? "text-[var(--primary)]" : "text-[var(--muted)]"
              )}
            >
              <Icon size={20} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
