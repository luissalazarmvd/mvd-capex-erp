// src/app/logistics/downloads/page.tsx
import LogisticsMRATable from "../../../components/logistics/LogisticsMRATable";

const PBI_MRA_URL =
  "https://app.powerbi.com/view?r=eyJrIjoiY2Q2YmU3ZjktZThjMi00NjEwLTgyNzgtYjBjYzEyODM3ODhmIiwidCI6IjYzNzhiZmNkLWRjYjktNDMwZi05Nzc4LWRiNTk3NGRjMmFkYyIsImMiOjR9";

export default function LogisticsDownloadsPage() {
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

      <div style={{ height: 6 }} />

      <div className="panel-inner" style={{ padding: "10px 12px" }}>
        <div style={{ fontWeight: 900 }}>Dashboard - MRA</div>
      </div>

      <div className="panel-inner" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ position: "relative", width: "100%", height: "calc(100vh - 180px)" }}>
          <iframe
            title="Dashboard - MRA"
            src={PBI_MRA_URL}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}