// src/app/planta/reports/page.tsx
"use client";

import React from "react";

const PBI_PLANTA_REPORTS_URL =
  "https://app.powerbi.com/view?r=eyJrIjoiZDRlZjRlNzQtOGNkOS00NTM1LTg3ODUtNzFlMTdmMTBiZjU3IiwidCI6IjYzNzhiZmNkLWRjYjktNDMwZi05Nzc4LWRiNTk3NGRjMmFkYyIsImMiOjR9";

export default function PlantaReportsPage() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Header */}
      <div className="panel-inner" style={{ padding: 12, display: "flex", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>Reportes</div>
        <div className="muted" style={{ fontWeight: 800, marginLeft: "auto" }}>
          Planta · Power BI
        </div>
      </div>

      {/* Embed */}
      <div className="panel-inner" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ position: "relative", width: "100%", height: "calc(100vh - 210px)" }}>
          <iframe
            title="MVD - Planta - Reportes"
            src={PBI_PLANTA_REPORTS_URL}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: 0,
            }}
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
