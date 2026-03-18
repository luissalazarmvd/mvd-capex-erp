// src/components/traceability/TraceabilityTopNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/traceability/upload", label: "Datos Valorización" },
  { href: "/traceability/entries", label: "Validar Datos" },
  { href: "/traceability/summary", label: "Resumen" },
];

export default function TraceabilityTopNav() {
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