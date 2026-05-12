// src/app/logistics/downloads/page.tsx
"use client";

import LogisticsMreqStatusTable from "../../../components/logistics/LogisticsReqStatusTable";
import LogisticsMRATable from "../../../components/logistics/LogisticsMRATable";

const PBI_LOGISTICS_URL =
  "https://app.powerbi.com/view?r=eyJrIjoiYjUzZWY1ZTMtZWQyYi00MmIzLWE1YmMtN2Q2MTFjNzNkMmFmIiwidCI6IjYzNzhiZmNkLWRjYjktNDMwZi05Nzc4LWRiNTk3NGRjMmFkYyIsImMiOjR9";

export default function LogisticsDownloadsPage() {
  return (
    <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          height: "calc(100vh - 140px)",
          minHeight: 0,
          overflow: "auto",
        }}
      >
        <LogisticsMreqStatusTable />
      </div>

      <div style={{ height: 6 }} />

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
        <div style={{ fontWeight: 900 }}>Dashboard - Logística</div>
      </div>

      <div className="panel-inner" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "calc(100vh - 140px)",
          }}
        >
          <iframe
            title="Dashboard - Logística"
            src={PBI_LOGISTICS_URL}
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