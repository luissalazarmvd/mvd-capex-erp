import { useId } from "react";

type Props = { size?: number; title?: string };

export default function VaiLogo({ size = 40, title = "VAi" }: Props) {
  const goldId = useId();

  return (
    <svg
      width={size * 1.7}
      height={size}
      viewBox="0 0 118 64"
      role="img"
      aria-label={title}
      style={{ display: "block", flex: "none", overflow: "visible" }}
    >
      <title>{title}</title>

      <defs>
        <linearGradient id={goldId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--brand-gold)" />
          <stop offset="1" stopColor="var(--brand-gold-light)" />
        </linearGradient>
      </defs>

      <path d="M11 17 A9 9 0 0 1 29 17 Z" fill={`url(#${goldId})`} />

      <path
        d="M8 25.5 L24 46 L40 25.5 L56 46"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M34.5 36 H46.5"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="2.8"
        strokeLinecap="round"
      />

      <path
        d="M28 15.5 C38 14.5 47 15 57 17 C67 19 76 20 87 17.5"
        fill="none"
        stroke={`url(#${goldId})`}
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.95"
      />

      <path
        d="M79 28 V46"
        fill="none"
        stroke={`url(#${goldId})`}
        strokeWidth="5.2"
        strokeLinecap="round"
      />

      <path
        d="M90 14.5 L90.9 17.1 L93.5 18 L90.9 18.9 L90 21.5 L89.1 18.9 L86.5 18 L89.1 17.1 Z"
        fill={`url(#${goldId})`}
      />
    </svg>
  );
}