import { redirect } from "next/navigation";
import Link from "next/link";
import { checkIsAdmin } from "@/lib/actions/admin";

const NAV = [
  { href: "/admin", label: "ダッシュボード" },
  { href: "/admin/users", label: "ユーザー管理" },
  { href: "/admin/reports", label: "通報" },
  { href: "/admin/announcements", label: "お知らせ" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) redirect("/chats");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 overflow-y-auto p-4 md:p-8">
      <div>
        <h1 className="text-lg font-semibold">管理パネル</h1>
        <nav className="mt-3 flex flex-wrap gap-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--surface-hover)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
