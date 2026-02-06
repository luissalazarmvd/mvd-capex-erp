// src/app/(portal)/page.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../components/ui/Button";

export default function PortalPage() {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#0067AC",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Arial, sans-serif",
        color: "white",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#004F86",
          padding: 32,
          borderRadius: 8,
          width: 380,
          textAlign: "center",
        }}
      >
        <img src="/logo_mvd.png" alt="Veta Dorada" style={{ height: 58, marginBottom: 18 }} />

        <h2 style={{ margin: "0 0 18px 0", fontWeight: 800 }}>Acceso MVD</h2>

        <div style={{ display: "grid", gap: 12 }}>
          <Button type="button" size="lg" variant="primary" onClick={() => router.push("/projects")}>
            Proyectos CAPEX
          </Button>

          <Button type="button" size="lg" variant="primary" onClick={() => router.push("/planta/guardia")}>
            Planta
          </Button>
        </div>
      </div>
    </main>
  );
}
