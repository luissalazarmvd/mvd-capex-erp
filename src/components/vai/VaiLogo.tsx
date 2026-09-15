import { useId, type CSSProperties } from "react";

type Props = { size?: number; title?: string };

// Coordenadas relativas al punto de la i; el vuelo nace dentro del domo.
const STAR_FLIGHT = "M-74 -20 C-54 -42 -17 -38 0 0";
const GOLD_DUST = [
  { x: 0, to: 0, size: 1.1, delay: 0 },
  { x: -2.4, to: -1.3, size: .7, delay: .04 },
  { x: 2.8, to: 1.4, size: .8, delay: .07 },
  { x: -4, to: -.6, size: .55, delay: .11 },
  { x: 1.2, to: .5, size: .65, delay: .15 },
  { x: 3.6, to: 1.6, size: .5, delay: .19 },
  { x: -1.5, to: -.9, size: .85, delay: .23 },
  { x: 2.1, to: .3, size: .6, delay: .28 },
];

export default function VaiLogo({ size = 40, title = "V-Ai" }: Props) {
  const goldId = useId();
  const stemClipId = useId();

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
        <clipPath id={stemClipId} clipPathUnits="userSpaceOnUse">
          {/* El borde inferior de la máscara desciende junto a la escarcha. */}
          <rect className="vai-logo-stem-reveal" x="113" y="-12" width="8" height="60" />
        </clipPath>
      </defs>

      <g className="vai-logo-foundation">
        <path d="M29 29 A14 14 0 0 1 57 29 Z" fill={`url(#${goldId})`} />
        {/* El brazo derecho de la V ya es el izquierdo de la futura A. */}
        <path
          d="M14 39 L43 80 L72 39"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      <path
        className="vai-logo-a-leg"
        d="M72 39 L101 80"
        pathLength="100"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        className="vai-logo-a-bar"
        d="M53.6 65 H90.4"
        pathLength="100"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      <rect x="114.25" y="55.25" width="5.5" height="27.5" rx="2.75" fill={`url(#${goldId})`} clipPath={`url(#${stemClipId})`} />

      <g transform="translate(117 48)" aria-hidden="true">
        {GOLD_DUST.map((grain, index) => (
          <circle
            key={index}
            className="vai-logo-dust"
            r={grain.size}
            style={{
              "--vai-dust-x": `${grain.x}px`,
              "--vai-dust-to-x": `${grain.to}px`,
              "--vai-dust-delay": `${grain.delay}s`,
            } as CSSProperties}
          />
        ))}
      </g>

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
