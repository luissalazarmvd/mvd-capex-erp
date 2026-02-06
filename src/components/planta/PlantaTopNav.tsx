// src/components/planta/PlantaTopNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/planta/guardia", label: "Crear Guardia" },
  { href: "/planta/reactivos", label: "Reactivos" },
  { href: "/planta/produccion", label: "Producción" },
  { href: "/planta/bolas", label: "Bolas" },
  { href: "/planta/relave", label: "Relave" },
  { href: "/planta/duracion", label: "Duración" },
  { href: "/planta/reports", label: "Reportes" },
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