// src/components/trj-kardex/TRJKardexTopNav.tsx
"use client";

import { TopNav } from "../ui/TopNav";

const NAV = [
  { href: "/kardex/sum", label: "Resumen" },
  { href: "/kardex/guides", label: "Registrar Guías" },
  { href: "/kardex/quotes", label: "Valorización" },
];

export default function TRJKardexTopNav() {
  return <TopNav items={NAV} />;
}
