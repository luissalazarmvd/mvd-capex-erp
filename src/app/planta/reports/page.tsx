// src/app/planta/reports/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { apiGet } from "../../../lib/apiClient";
import BalanceTable from "../../../components/planta/BalanceTable";
import CarbonTable, { TankSumRow } from "../../../components/planta/CarbonTable";
import CarbonTableSum from "../../../components/planta/CarbonTableSum";
import { Button } from "../../../components/ui/Button";

const PBI_PLANTA_REPORTS_URL =
  "https://app.powerbi.com/view?r=eyJrIjoiOTVmMzI2NWQtZDgzNy00ZGI3LWE5MzMtZjllNDcxOWIyZWU2IiwidCI6IjYzNzhiZmNkLWRjYjktNDMwZi05Nzc4LWRiNTk3NGRjMmFkYyIsImMiOjR9&pageName=367da76411dcb491358d";

type TankSumResp = { ok: boolean; rows: TankSumRow[] };

export default function PlantaReportsPage() {
  const [tankMode, setTankMode] = useState<"AU" | "AG">("AU");
  const [tankRowsAu, setTankRowsAu] = useState<TankSumRow[]>([]);
  const [tankRowsAg, setTankRowsAg] = useState<TankSumRow[]>([]);
  const [tankDatesAu, setTankDatesAu] = useState<string[]>([]);
  const [tankDatesAg, setTankDatesAg] = useState<string[]>([]);
  const [tankLoading, setTankLoading] = useState(false);
  const [tankMsg, setTankMsg] = useState<string | null>(null);

  const [showFull, setShowFull] = useState(false);
  const [carbonesFullScreen, setCarbonesFullScreen] = useState(false);

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

  function scrollToTopHard() {
    try {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch {}
  }

  async function toggleCarbonesFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      scrollToTopHard();
      requestAnimationFrame(() => scrollToTopHard());
      setTimeout(scrollToTopHard, 0);
      setTimeout(scrollToTopHard, 50);
      setTimeout(scrollToTopHard, 150);

      await document.documentElement.requestFullscreen();
    } catch {}
  }

  useEffect(() => {
    function onFsChange() {
      const isFs = !!document.fullscreenElement;
      setCarbonesFullScreen(isFs);

      if (isFs) {
        scrollToTopHard();
        requestAnimationFrame(() => scrollToTopHard());
        setTimeout(scrollToTopHard, 0);
        setTimeout(scrollToTopHard, 50);
        setTimeout(scrollToTopHard, 150);
      }
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const tanquesBlock = (
    <>
      <div style={{ height: 6 }} />

      <div className="panel-inner" style={{ padding: "10px 12px", display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Tanques</div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <Button type="button" size="sm" variant="ghost" onClick={toggleCarbonesFullscreen} disabled={tankLoading}>
            {carbonesFullScreen ? "Salir de pantalla completa" : "Pantalla completa"}
          </Button>

          <Button type="button" size="sm" variant="ghost" onClick={() => setShowFull((s) => !s)} disabled={tankLoading}>
            {showFull ? "Ver resumen" : "Ver detalle"}
          </Button>
        </div>
      </div>

      {showFull ? (
        <CarbonTable
          tankMode={tankMode}
          setTankMode={setTankMode}
          tankLoading={tankLoading}
          onRefresh={loadTankSummary}
          tankMsg={tankMsg}
          tankRowsAu={tankRowsAu}
          tankRowsAg={tankRowsAg}
        />
      ) : (
        <CarbonTableSum
          tankMode={tankMode}
          setTankMode={setTankMode}
          tankLoading={tankLoading}
          onRefresh={loadTankSummary}
          tankMsg={tankMsg}
          tankRowsAu={tankRowsAu}
          tankRowsAg={tankRowsAg}
        />
      )}
    </>
  );

  const pbiBlock = (
    <>
      <div style={{ height: 6 }} />

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
    </>
  );

  return (
    <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
      {!carbonesFullScreen ? (
        <>
          <BalanceTable />
          {tanquesBlock}
          {pbiBlock}
        </>
      ) : (
        <>
          {tanquesBlock}
          {pbiBlock}
        </>
      )}
    </div>
  );
}