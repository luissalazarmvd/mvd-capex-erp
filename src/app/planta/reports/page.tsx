// src/app/planta/reports/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { apiGet } from "../../../lib/apiClient";
import BalanceTable from "../../../components/planta/BalanceTable";
import CarbonTable, { TankSumRow } from "../../../components/planta/CarbonTable";

const PBI_PLANTA_REPORTS_URL =
  "https://app.powerbi.com/view?r=eyJrIjoiOTVmMzI2NWQtZDgzNy00ZGI3LWE5MzMtZjllNDcxOWIyZWU2IiwidCI6IjYzNzhiZmNkLWRjYjktNDMwZi05Nzc4LWRiNTk3NGRjMmFkYyIsImMiOjR9";

type TankSumResp = { ok: boolean; rows: TankSumRow[] };

export default function PlantaReportsPage() {
  // Tanques
  const [tankMode, setTankMode] = useState<"AU" | "AG">("AU");
  const [tankRowsAu, setTankRowsAu] = useState<TankSumRow[]>([]);
  const [tankRowsAg, setTankRowsAg] = useState<TankSumRow[]>([]);
  const [tankDatesAu, setTankDatesAu] = useState<string[]>([]);
  const [tankDatesAg, setTankDatesAg] = useState<string[]>([]);
  const [tankLoading, setTankLoading] = useState(false);
  const [tankMsg, setTankMsg] = useState<string | null>(null);

  async function loadTankSummary(which: "AU" | "AG") {
    setTankLoading(true);
    setTankMsg(null);

    try {
      const r = (await apiGet(`/api/planta/tanks/summary/${which.toLowerCase()}?top=400`)) as TankSumResp;
      const rows = Array.isArray(r?.rows) ? r.rows : [];

      if (which === "AU") setTankRowsAu(rows);
      else setTankRowsAg(rows);

      try {
        const d = (await apiGet(`/api/planta/carbones/assays/last5?metal=${which}`)) as any;
        const dates = Array.isArray(d?.dates) ? d.dates.map((x: any) => String(x)) : [];
        if (which === "AU") setTankDatesAu(dates);
        else setTankDatesAg(dates);
      } catch {
        if (which === "AU") setTankDatesAu([]);
        else setTankDatesAg([]);
      }
    } catch (e: any) {
      if (which === "AU") setTankRowsAu([]);
      else setTankRowsAg([]);
      setTankMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando resumen por tanque");
    } finally {
      setTankLoading(false);
    }
  }

  useEffect(() => {
    loadTankSummary("AU");
    loadTankSummary("AG");
  }, []);

  return (
    <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
      {/* BALANCE: export Excel/PDF y todo lo demás vive dentro del componente */}
      <BalanceTable />

      <div style={{ height: 6 }} />

      {/* TANQUES: UI vive dentro del componente */}
      <CarbonTable
        tankMode={tankMode}
        setTankMode={setTankMode}
        tankLoading={tankLoading}
        onRefresh={loadTankSummary}
        tankMsg={tankMsg}
        tankRowsAu={tankRowsAu}
        tankRowsAg={tankRowsAg}
        tankDatesAu={tankDatesAu}
        tankDatesAg={tankDatesAg}
      />

      <div style={{ height: 6 }} />

      {/* POWER BI */}
      <div className="panel-inner" style={{ padding: "10px 12px" }}>
        <div style={{ fontWeight: 900 }}>Dashboard - Power BI</div>
      </div>

      <div className="panel-inner" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ position: "relative", width: "100%", height: "calc(100vh - 180px)" }}>
          <iframe
            title="MVD - Planta - Reportes"
            src={PBI_PLANTA_REPORTS_URL}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
