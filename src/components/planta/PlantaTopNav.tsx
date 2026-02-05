// src/components/planta/PlantaTopNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/guardia", label: "Crear Guardia" },
  { href: "/produccion", label: "Producción" },
  { href: "/relave", label: "Relave" },
  { href: "/reactivos", label: "Reactivos" },
  { href: "/bolas", label: "Bolas" },
  { href: "/duracion", label: "Duración" },
  { href: "/reports", label: "Reportes" },
];

export default function PlantaTopNav() {
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
                    outline: "2px solid rgba(255,255,255,.35)",
                    outlineOffset: 2,
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
