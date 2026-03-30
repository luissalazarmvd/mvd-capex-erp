// src/app/logistics/downloads/page.tsx
"use client";

import { useState } from "react";
import LogisticsMRATable from "../../../components/logistics/LogisticsMRATable";
import LogisticsStockTable from "../../../components/logistics/LogisticsStockTable";

const PBI_MRA_URL =
  "https://app.powerbi.com/view?r=eyJrIjoiY2Q2YmU3ZjktZThjMi00NjEwLTgyNzgtYjBjYzEyODM3ODhmIiwidCI6IjYzNzhiZmNkLWRjYjktNDMwZi05Nzc4LWRiNTk3NGRjMmFkYyIsImMiOjR9";

const PBI_STOCK_URL =
  "https://app.powerbi.com/view?r=eyJrIjoiNjFmZTQ5ODUtMTY3Ny00NDRmLWFkNjUtOGY0ZDQyYTVlMWZiIiwidCI6IjYzNzhiZmNkLWRjYjktNDMwZi05Nzc4LWRiNTk3NGRjMmFkYyIsImMiOjR9";

export default function LogisticsDownloadsPage() {
  const [activeDashboard, setActiveDashboard] = useState<"MRA" | "Stock">("MRA");

  const currentDashboardUrl =
    activeDashboard === "MRA" ? PBI_MRA_URL : PBI_STOCK_URL;

  return (
    <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          height: "calc(100vh - 140px)",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <LogisticsMRATable />
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          height: "calc(100vh - 140px)",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <LogisticsStockTable />
      </div>

      <div style={{ height: 6 }} />

      <div
        className="panel-inner"
        style={{
          padding: "10px 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 900 }}>
          Dashboard - {activeDashboard}
        </div>

        <button
          type="button"
          onClick={() =>
            setActiveDashboard((prev) => (prev === "MRA" ? "Stock" : "MRA"))
          }
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.9)",
            fontSize: 12,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Ver {activeDashboard === "MRA" ? "Stock" : "MRA"}
        </button>
      </div>

      <div className="panel-inner" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ position: "relative", width: "100%", height: "calc(100vh - 180px)" }}>
          <iframe
            title={`Dashboard - ${activeDashboard}`}
            src={currentDashboardUrl}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}