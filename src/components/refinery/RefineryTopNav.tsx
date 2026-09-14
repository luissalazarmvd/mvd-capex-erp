// src/components/refinery/RefineryTopNav.tsx
"use client";

import { TopNav } from "../ui/TopNav";

const NAV = [
  { href: "/refinery/campaign", label: "Crear Campaña" },
  { href: "/refinery/consumption", label: "Consumos" },
  { href: "/refinery/entries", label: "Entrada de Stock" },
  { href: "/refinery/production", label: "Producción" },
  { href: "/refinery/reports", label: "Reportes" },
];

export default function RefineryTopNav() {
  return <TopNav items={NAV} />;
}
