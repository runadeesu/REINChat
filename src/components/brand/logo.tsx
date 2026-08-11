interface LogoProps {
  size?: number;
  className?: string;
  withWordmark?: boolean;
}

// Original mark: two overlapping rounded-square bubbles (a "conversation"
// motif distinct from a single teardrop bubble), in the mint/teal accent.
export function ReinChatLogo({ size = 28, className, withWordmark = true }: LogoProps) {
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: size * 0.28 }}>
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="6" width="26" height="20" rx="8" fill="var(--primary)" opacity="0.35" />
        <rect x="12" y="14" width="26" height="20" rx="8" fill="var(--primary)" />
        <circle cx="20" cy="24" r="2.2" fill="var(--primary-foreground)" />
        <circle cx="27" cy="24" r="2.2" fill="var(--primary-foreground)" />
        <circle cx="34" cy="24" r="2.2" fill="var(--primary-foreground)" />
      </svg>
      {withWordmark && (
        <span style={{ fontWeight: 800, fontSize: size * 0.62, letterSpacing: "-0.02em", color: "var(--foreground)" }}>
          REIN<span style={{ color: "var(--primary)" }}>Chat</span>
        </span>
      )}
    </span>
  );
}
