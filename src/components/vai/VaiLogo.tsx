import { useId } from "react";

type Props = { size?: number; title?: string };

export default function VaiLogo({ size = 40, title = "VAi" }: Props) {
  const gradientId = useId();

  return (
    <svg
      width={size * 1.72}
      height={size}
      viewBox="0 0 110 64"
      role="img"
      aria-label={title}
      style={{ display: "block", flex: "none" }}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--brand-gold)" />
          <stop offset="1" stopColor="var(--brand-gold-light)" />
        </linearGradient>
      </defs>

      <path d="M17 18 A9 9 0 0 1 35 18 Z" fill={`url(#${gradientId})`} />

      <path
        d="M10 25 L26 47 L42 25 L58 47"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="5.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      <path
        d="M34 38 H50"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="5"
        strokeLinecap="round"
      />

      <path
        d="M74 31 V47"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="5.5"
        strokeLinecap="round"
      />

      <circle cx="74" cy="23.5" r="3.6" fill={`url(#${gradientId})`} />
    </svg>
  );
}