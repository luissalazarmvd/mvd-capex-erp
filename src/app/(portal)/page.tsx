// src/app/(portal)/page.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../components/ui/Button";

export default function PortalPage() {
  const router = useRouter();

  return (
    <div
      className="panel-inner"
      style={{
        padding: 18,
        minHeight: "calc(100vh - 120px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ display: "flex", gap: 14 }}>
        <Button type="button" size="lg" variant="primary" onClick={() => router.push("/projects")}>
          Proyectos CAPEX
        </Button>
        <Button type="button" size="lg" variant="ghost" onClick={() => router.push("/guardia")}>
          Planta
        </Button>
      </div>
    </div>
  );
}
