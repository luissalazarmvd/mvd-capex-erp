// src/components/vai/VaiLogo.tsx
//
// Isotipo de V-Ai: la «V» de Veta en dos trazos (azul y dorado de marca) que
// convergen en un nodo luminoso; el nodo y sus dos satélites sugieren la red
// de inferencia sin recurrir a estética futurista. Solo colores del manual.

type Props = { size?: number; withWordmark?: boolean; title?: string };

export default function VaiLogo({ size = 40, withWordmark = false, title = "V-Ai" }: Props) {
  const mark = (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={title} style={{ display: "block", flex: "none" }}>
      <title>{title}</title>
      <path d="M8 10 L24 38" fill="none" stroke="var(--brand-blue-light)" strokeWidth="6" strokeLinecap="round" />
      <path d="M40 10 L24 38" fill="none" stroke="var(--brand-gold)" strokeWidth="6" strokeLinecap="round" />
      <path d="M8 10 L40 10" fill="none" stroke="var(--line-2)" strokeWidth="1.5" strokeDasharray="2 4" />
      <circle cx="24" cy="38" r="5.5" fill="var(--s-1)" stroke="var(--brand-gold-light)" strokeWidth="2.5" />
      <circle cx="24" cy="38" r="2" fill="var(--brand-gold-light)" />
      <circle cx="8" cy="10" r="3" fill="var(--brand-blue-light)" />
      <circle cx="40" cy="10" r="3" fill="var(--brand-gold)" />
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
