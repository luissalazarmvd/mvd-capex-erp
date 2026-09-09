"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/kardex/guides", label: "Registrar Guías" },
  { href: "/kardex/quotes", label: "Valorización" },
];

export default function TRJKardexTopNav() {
  const pathname = usePathname();

  return (
    <nav style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {NAV.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className="nav-pill !text-white visited:!text-white text-lg font-extrabold"
            style={active ? { outline: "none", opacity: 0.72 } : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
