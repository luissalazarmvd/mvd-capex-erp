// src/components/planta/PlantaTopNav.tsx
"use client";

import { TopNav } from "../ui/TopNav";

const NAV = [
  { href: "/planta/guardia", label: "Crear Guardia" },
  { href: "/planta/datos-guardia", label: "Datos de Guardia" },
  { href: "/planta/leyes", label: "Leyes" },
  { href: "/planta/carbon", label: "Carbones" },
  { href: "/planta/reports", label: "Reportes" },
];

export default function PlantaTopNav() {
  return <TopNav items={NAV} />;
}
