// src/components/traceability/TraceabilityTopNav.tsx
"use client";

import { TopNav } from "../ui/TopNav";

const NAV = [
  { href: "/traceability/upload", label: "Datos Valorización" },
  { href: "/traceability/entries", label: "Validar Datos" },
  { href: "/traceability/status", label: "Mineral No Disponible" },
  { href: "/traceability/conta", label: "Lotes Pagados" },
  { href: "/traceability/cm-inputs", label: "CM Inputs" },
];

export default function TraceabilityTopNav() {
  return <TopNav items={NAV} />;
}
