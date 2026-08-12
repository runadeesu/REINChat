interface LogoProps {
  size?: number;
  className?: string;
  withWordmark?: boolean;
}

// Shared Rein-family mark: same gradient speech-bubble icon as ReinAI, so
// REINChat reads as a sibling product under the same Rein brand. The
// wordmark mirrors ReinAI's treatment ("Rein" outlined, second word filled
// with the brand gradient) with "Chat" standing in for "AI".
export function ReinChatLogo({ size = 28, className, withWordmark = true }: LogoProps) {
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: size * 0.28 }}>
      <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="reinBubbleGrad" x1="0%" y1="0%" x2="100%" y2="70%">
            <stop offset="0%" stopColor="#1E90FF" />
            <stop offset="50%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#EC1CC4" />
          </linearGradient>
        </defs>
        <path
          d="M 30 18
             H 70
             A 26 26 0 0 1 96 44
             A 26 26 0 0 1 70 70
             C 58 70 48 71 40 76
             C 34 80 30 84 27 90
             C 26 92 24 92 24 90
             C 25 84 25 78 22 74
             C 12 70 4 58 4 44
             A 26 26 0 0 1 30 18 Z"
          fill="url(#reinBubbleGrad)"
        />
        <circle cx="38" cy="44" r="9" fill="#ffffff" />
        <circle cx="64" cy="44" r="9" fill="#ffffff" />
      </svg>
      {withWordmark && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            fontWeight: 800,
            fontSize: size * 0.62,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          <span
            style={{
              color: "var(--foreground)",
              WebkitTextStrokeWidth: "1.2px",
              WebkitTextStrokeColor: "var(--foreground)",
              WebkitTextFillColor: "transparent",
            }}
          >
            Rein
          </span>
          <span
            style={{
              marginLeft: "0.05em",
              backgroundImage: "linear-gradient(135deg, #1E90FF, #8B5CF6 55%, #EC1CC4)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              WebkitTextFillColor: "transparent",
            }}
          >
            Chat
          </span>
        </span>
      )}
    </span>
  );
}
