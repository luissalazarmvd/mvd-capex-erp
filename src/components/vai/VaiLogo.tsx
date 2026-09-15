// src/components/vai/VaiLogo.tsx
//
// Isotipo de V-Ai: monograma «VA» (la V y la A comparten el brazo central)
// seguido de una «i» en oro cuyo punto es el domo dorado del isotipo de Veta
// Dorada. Rejilla de 64; solo colores del manual.

import { useId } from "react";

type Props = { size?: number; withWordmark?: boolean; title?: string };

export default function VaiLogo({ size = 40, withWordmark = false, title = "V-Ai" }: Props) {
  const gradientId = useId();
  const mark = (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title} style={{ display: "block", flex: "none" }}>
      <title>{title}</title>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--brand-gold)" }} />
          <stop offset="1" style={{ stopColor: "var(--brand-gold-light)" }} />
        </linearGradient>
      </defs>
      {/* V y A comparten el brazo central; la i lleva el domo dorado como punto. */}
      <path d="M7 16 L19 48 L31 16 L43 48" fill="none" stroke="var(--ink)" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M23.5 37 H38.5" fill="none" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
      <path d="M54 31 V48" fill="none" stroke={`url(#${gradientId})`} strokeWidth="5" strokeLinecap="round" />
      <path d="M48.5 22 A5.5 5.5 0 0 1 59.5 22 Z" fill={`url(#${gradientId})`} />
    </svg>
  );
  if (!withWordmark) return mark;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {mark}
      <span style={{ fontSize: size * 0.5, fontWeight: 500, letterSpacing: "-.01em", lineHeight: 1 }}>
        V-<span style={{ color: "var(--brand-gold-light)" }}>Ai</span>
      </span>
    </span>
  );
}
