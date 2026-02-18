// src/components/refinery/RefineryTopNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/refinery/campaign", label: "Crear Campaña" },
  { href: "/refinery/consumption", label: "Consumos" },
  { href: "/refinery/entries", label: "Entrada de Stock" },
  { href: "/refinery/production", label: "Producción" },
  { href: "/refinery/reports", label: "Reportes" },
];

export default function RefineryTopNav() {
  const pathname = usePathname();

  return (
    <nav style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {NAV.map((n) => {
        const active = pathname === n.href;
        return (
          <Link
            key={n.href}
            href={n.href}
            prefetch={false}
            className="nav-pill !text-white visited:!text-white text-lg font-extrabold"
            style={
              active
                ? {
                    outline: "none",
                    opacity: 0.72,
                  }
                : undefined
            }
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}