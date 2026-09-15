// src/components/vai/VaiLogo.tsx
//
// Isotipo de V-Ai, concepto «Batea»: el domo dorado del isotipo corporativo
// de Veta Dorada (degradado oro del manual) sobre una V de trazo redondeado,
// que es la batea afilada en letra. El brazo derecho de la V es el brazo
// izquierdo de la A, y cierra una «i» en oro. Rejilla de 96×64; solo
// colores del manual.

import { useId } from "react";

type Props = { size?: number; title?: string };

export default function VaiLogo({ size = 40, title = "V-Ai" }: Props) {
  const gradientId = useId();
  return (
    <svg width={size * 1.5} height={size} viewBox="0 0 96 64" role="img" aria-label={title} style={{ display: "block", flex: "none" }}>
      <title>{title}</title>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--brand-gold)" }} />
          <stop offset="1" style={{ stopColor: "var(--brand-gold-light)" }} />
        </linearGradient>
      </defs>
      {/* Domo dorado sobre la batea (la V). */}
      <path d="M21 19 A10 10 0 0 1 41 19 Z" fill={`url(#${gradientId})`} />
      {/* V y A en un solo trazo: comparten el brazo central. */}
      <path d="M12 26 L31 52 L50 26 L69 52" fill="none" stroke="var(--ink)" strokeWidth="5.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M39 43 H61" fill="none" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" />
      {/* i en oro. */}
      <path d="M82 37 V52" fill="none" stroke={`url(#${gradientId})`} strokeWidth="5.5" strokeLinecap="round" />
      <circle cx="82" cy="27.5" r="3.6" fill={`url(#${gradientId})`} />
    </svg>
  );
}
