import { useId } from "react";

type Props = { size?: number; title?: string };

export default function VaiLogo({ size = 40, title = "VAi" }: Props) {
  const gradientId = useId();

  return (
    <svg
      width={size * 1.38}
      height={size}
      viewBox="0 0 88 64"
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

      <path d="M11 18 A9 9 0 0 1 29 18 Z" fill={`url(#${gradientId})`} />

      <path
        d="M8 25 L24 46 L40 25 L56 46"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M34.5 35.5 H45.5"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />

      <path
        d="M72 28.5 V46"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="5.5"
        strokeLinecap="round"
      />

      <circle cx="72" cy="21" r="3.8" fill={`url(#${gradientId})`} />
    </svg>
  );
}