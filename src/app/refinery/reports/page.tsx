// src/app/refinery/reports/page.tsx
"use client";

import React from "react";

const PBI_REFINERY_REPORTS_URL =
  "https://app.powerbi.com/view?r=eyJrIjoiZTFlMjdjM2UtNTk0Yi00MTg3LThmN2UtYTYxYTM0NjJhMjFlIiwidCI6IjYzNzhiZmNkLWRjYjktNDMwZi05Nzc4LWRiNTk3NGRjMmFkYyIsImMiOjR9";

export default function RefineryReportsPage() {
  return (
    <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
      <div className="panel-inner" style={{ padding: "10px 12px" }}>
        <div style={{ fontWeight: 900 }}>Dashboard - Power BI</div>
      </div>

      <div className="panel-inner" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ position: "relative", width: "100%", height: "calc(100vh - 180px)" }}>
          <iframe
            title="MVD - Refinería - Reportes"
            src={PBI_REFINERY_REPORTS_URL}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}