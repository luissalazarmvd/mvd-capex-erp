// src/app/(portal)/page.tsx
import React, { Suspense } from "react";
import PortalClient from "./PortalClient";

export default function PortalPage() {
  return (
    <Suspense fallback={<PortalFallback />}>
      <PortalClient />
    </Suspense>
  );
}

function PortalFallback() {
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
          opacity: 0.9,
        }}
      >
        <img src="/logo_mvd.png" alt="Veta Dorada" style={{ height: 58, marginBottom: 18 }} />
        <h2 style={{ margin: "0 0 10px 0", fontWeight: 800 }}>Acceso MVD</h2>
        <div style={{ color: "#D8EEFF", fontWeight: 700 }}>Cargando…</div>
      </div>
    </main>
  );
}
