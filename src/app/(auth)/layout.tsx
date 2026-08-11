import { ReinChatLogo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--surface)] px-4 py-10">
      <div className="mb-8">
        <ReinChatLogo size={36} />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-sm">
        {children}
      </div>
    </div>
  );
}
