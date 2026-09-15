// src/components/vai/VaiLogo.tsx
//
// Isotipo de V-Ai, concepto «Batea»: el domo dorado del isotipo corporativo
// de Veta Dorada (degradado oro del manual) sobre una V de trazo redondeado,
// que es la batea afilada en letra. Rejilla de 64; solo colores del manual.

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
      <path d="M13 27 L32 53 L51 27" fill="none" stroke="var(--ink)" strokeWidth="5.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M22 20 A10 10 0 0 1 42 20 Z" fill={`url(#${gradientId})`} />
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
