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
    <main className="vd-portal">
      <div className="vd-portal-shell">
        <header className="vd-portal-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_mvd.png" alt="Veta Dorada" style={{ width: "auto", height: 52 }} />

          <div>
            <h1>Acceso MVD</h1>
            <p style={{ color: "var(--ink-3)" }}>
              <span className="vd-portal-dot" style={{ background: "var(--ink-3)" }} />
              Cargando…
            </p>
          </div>
        </header>
      </div>
    </main>
  );
}
