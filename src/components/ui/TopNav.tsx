// src/components/ui/TopNav.tsx
//
// Navegación secundaria de módulo: una píldora por ruta, con la activa atenuada.
// Cada módulo declara sus items y delega aquí el render.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type TopNavItem = { href: string; label: string };

export function TopNav({ items }: { items: TopNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          prefetch={false}
          className="nav-pill !text-white visited:!text-white text-lg font-extrabold"
          style={pathname === item.href ? { outline: "none", opacity: 0.72 } : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
