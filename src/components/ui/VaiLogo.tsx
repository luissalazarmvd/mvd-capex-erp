"use client";
import { useId, type CSSProperties } from "react";

type VaiLogoProps = {
    size?: number;
    title?: string;
};
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
// Marca interna VAi. La secuencia vive en globals.css (.vai-logo-*): la V se
// dibuja como un check, el domo amanece sobre su horizonte, la estrella vuela
// y dibuja la A, y la escarcha cae formando la i. En reposo el sol conserva un
// resplandor que respira y la estrella emite anillos y se sacude a ratos.
export function VaiLogo({ size = 40, title = "VAi" }: VaiLogoProps) {
    const goldId = useId();
    const glowId = useId();
    const stemClipId = useId();
    const dawnClipId = useId();
    return (<svg className="vai-logo" width={size * (132 / 92)} height={size} viewBox="0 0 132 92" role="img" aria-label={title} focusable="false">
      <title>{title}</title>

      <defs>
        <linearGradient id={goldId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--brand-gold)"/>
          <stop offset="1" stopColor="var(--brand-gold-light)"/>
        </linearGradient>
        <radialGradient id={glowId}>
          <stop offset="0" stopColor="var(--brand-gold-light)" stopOpacity=".6"/>
          <stop offset=".45" stopColor="var(--brand-gold)" stopOpacity=".22"/>
          <stop offset="1" stopColor="var(--brand-gold)" stopOpacity="0"/>
        </radialGradient>
        <clipPath id={stemClipId} clipPathUnits="userSpaceOnUse">
          <rect className="vai-logo-stem-reveal" x="113" y="-12" width="8" height="60"/>
        </clipPath>
        {/* Horizonte del amanecer: solo existe lo que asoma por encima de y=29. */}
        <clipPath id={dawnClipId} clipPathUnits="userSpaceOnUse">
          <rect x="19" y="3" width="48" height="26"/>
        </clipPath>
      </defs>

      <path className="vai-logo-v" d="M14 39 L43 80 L72 39" pathLength="100" fill="none" stroke="var(--ink)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>

      <g clipPath={`url(#${dawnClipId})`}>
        <g className="vai-logo-sun-glow-rise">
          <circle className="vai-logo-sun-glow" cx="43" cy="29" r="24" fill={`url(#${glowId})`}/>
        </g>
        <circle className="vai-logo-dawn" cx="43" cy="29" r="20"/>
        <path className="vai-logo-sun" d="M29 29 A14 14 0 0 1 57 29 Z" fill={`url(#${goldId})`}/>
      </g>

      <path className="vai-logo-a-leg" d="M72 39 L101 80" pathLength="100" fill="none" stroke="var(--ink)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>

      <path className="vai-logo-a-bar" d="M53.6 65 H90.4" pathLength="100" fill="none" stroke="var(--ink)" strokeWidth="4.5" strokeLinecap="round"/>

      <rect x="114.25" y="55.25" width="5.5" height="27.5" rx="2.75" fill={`url(#${goldId})`} clipPath={`url(#${stemClipId})`}/>

      <g transform="translate(117 48)" aria-hidden="true">
        {GOLD_DUST.map((grain, index) => (<circle key={index} className="vai-logo-dust" r={grain.size} style={{
                "--vai-dust-x": `${grain.x}px`,
                "--vai-dust-to-x": `${grain.to}px`,
                "--vai-dust-delay": `${grain.delay}s`,
            } as CSSProperties}/>))}
      </g>

      <circle className="vai-logo-launch" cx="43" cy="21" r="8"/>

      <g transform="translate(117 41)">
        <path className="vai-logo-trail vai-logo-trail-glow" d={STAR_FLIGHT} pathLength="100"/>
        <path className="vai-logo-trail" d={STAR_FLIGHT} pathLength="100"/>
        <g className="vai-logo-star" style={{ offsetPath: `path('${STAR_FLIGHT}')` }}>
          <circle className="vai-logo-pulse" r="7"/>
          <g className="vai-logo-drift">
            <path className="vai-logo-spark" d="M0 -7 C1.2 -2.4 2.4 -1.2 7 0 C2.4 1.2 1.2 2.4 0 7 C-1.2 2.4 -2.4 1.2 -7 0 C-2.4 -1.2 -1.2 -2.4 0 -7 Z" fill={`url(#${goldId})`}/>
          </g>
        </g>
      </g>
    </svg>);
}
