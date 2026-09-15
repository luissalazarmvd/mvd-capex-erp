import { useId } from "react";

type Props = { size?: number; title?: string };

// Relative to the dot of the i: the flight starts inside the golden dome.
const STAR_FLIGHT = "M-74 -20 C-54 -42 -17 -38 0 0";

export default function VaiLogo({ size = 40, title = "V-Ai" }: Props) {
  const goldId = useId();

  return (
    <svg
      className="vai-logo"
      width={size * (132 / 92)}
      height={size}
      viewBox="0 0 132 92"
      role="img"
      aria-label={title}
      focusable="false"
    >
      <title>{title}</title>

      <defs>
        <linearGradient id={goldId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--brand-gold)" />
          <stop offset="1" stopColor="var(--brand-gold-light)" />
        </linearGradient>
      </defs>

      <path d="M29 29 A14 14 0 0 1 57 29 Z" fill={`url(#${goldId})`} />

      {/* One continuous stroke: the V's right arm is also the A's left arm. */}
      <path
        d="M14 39 L43 80 L72 39 L101 80"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M53.6 65 H90.4"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      <rect x="114.25" y="55.25" width="5.5" height="27.5" rx="2.75" fill={`url(#${goldId})`} />

      <circle className="vai-logo-launch" cx="43" cy="21" r="8" />

      <g transform="translate(117 41)">
        <path className="vai-logo-trail vai-logo-trail-glow" d={STAR_FLIGHT} pathLength="100" />
        <path className="vai-logo-trail" d={STAR_FLIGHT} pathLength="100" />
        <g className="vai-logo-star" style={{ offsetPath: `path('${STAR_FLIGHT}')` }}>
          <path
            className="vai-logo-spark"
            d="M0 -7 C1.2 -2.4 2.4 -1.2 7 0 C2.4 1.2 1.2 2.4 0 7 C-1.2 2.4 -2.4 1.2 -7 0 C-2.4 -1.2 -1.2 -2.4 0 -7 Z"
            fill={`url(#${goldId})`}
          />
        </g>
      </g>
    </svg>
  );
}
