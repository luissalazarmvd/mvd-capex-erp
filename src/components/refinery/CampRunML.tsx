// src/components/refinery/CampRunML.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";

type MlStatus = {
  isRunning: boolean;
  pid: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  lastError: string | null;
  logFileName: string | null;
  logFilePath: string | null;
};

type MlStatusResp = {
  ok: boolean;
  status?: Partial<MlStatus>;
  elapsed_seconds?: number;
  elapsed_mmss?: string;
  error?: string;
};

type MlRunResp = {
  ok: boolean;
  message?: string;
  status?: Partial<MlStatus>;
  error?: string;
};

type OptRow = {
  campaign_id: string | null;
  process_name: string | null;
  subprocess_name: string | null;
  reagent_name: string | null;
  unit_name: string | null;
  consumption_qty: any;
  ml_consumption_qty: any;
  consumption_cost_us: any;
  ml_consumption_cost_us: any;
  desv_pct: any;
  [k: string]: any;
};

type OptResp = {
  ok: boolean;
  rows: OptRow[];
  error?: string;
};

type Props = {
  disabled?: boolean;
  setMsgAction?: React.Dispatch<React.SetStateAction<string | null>>;
  onRunningChange?: (isRunning: boolean) => void;
};

const EMPTY_STATUS: MlStatus = {
  isRunning: false,
  pid: null,
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  lastError: null,
  logFileName: null,
  logFilePath: null,
};

function getFileStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${hh}${mi}`;
}

function normalizeStatus(status?: Partial<MlStatus> | null): MlStatus {
  return {
    isRunning: !!status?.isRunning,
    pid: status?.pid ?? null,
    startedAt: status?.startedAt ?? null,
    finishedAt: status?.finishedAt ?? null,
    exitCode: status?.exitCode ?? null,
    lastError: status?.lastError ?? null,
    logFileName: status?.logFileName ?? null,
    logFilePath: status?.logFilePath ?? null,
  };
}

export default function CampRunML({
  disabled = false,
  setMsgAction,
  onRunningChange,
}: Props) {
  const mountedRef = useRef(true);

  const [status, setStatus] = useState<MlStatus>(EMPTY_STATUS);
  const [runBusy, setRunBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [elapsedMmss, setElapsedMmss] = useState("00:00");

  const loadStatus = useCallback(
    async (silent = true) => {
      try {
        const r = (await apiGet("/api/refineria/ml/status")) as MlStatusResp;
        if (!mountedRef.current) return;

        if (r?.status) {
          const nextStatus = normalizeStatus(r.status);
          setStatus(nextStatus);
          setElapsedMmss(String(r.elapsed_mmss || "00:00"));
          onRunningChange?.(nextStatus.isRunning);
          return;
        }

        setStatus(EMPTY_STATUS);
        setElapsedMmss("00:00");
        onRunningChange?.(false);

        if (!silent && r?.error) {
          setMsgAction?.(`ERROR: ${String(r.error)}`);
        }
      } catch (e: any) {
        if (!mountedRef.current) return;
        if (!silent) {
          setMsgAction?.(
            `ERROR: ${String(e?.message || e || "No se pudo consultar el estado ML")}`
          );
        }
      }
    },
    [setMsgAction]
  );

  useEffect(() => {
    mountedRef.current = true;

    loadStatus(true);

    const timer = window.setInterval(() => {
      loadStatus(true);
    }, 1000);

    return () => {
      mountedRef.current = false;
      window.clearInterval(timer);
    };
  }, [loadStatus]);

  const handleExport = useCallback(async () => {
    if (disabled || exportBusy || runBusy || status.isRunning) return;

    setExportBusy(true);
    setMsgAction?.(null);

    try {
      const r = (await apiGet("/api/refineria/cons-ml-web")) as OptResp;
      if (!mountedRef.current) return;

      const rr = Array.isArray(r?.rows) ? r.rows : [];

      if (!rr.length) {
        setMsgAction?.("No hay datos para exportar.");
        return;
      }

      const exportRows = rr.map((x) => ({
        campaign_id: x.campaign_id ?? "",
        process_name: x.process_name ?? "",
        subprocess_name: x.subprocess_name ?? "",
        reagent_name: x.reagent_name ?? "",
        unit_name: x.unit_name ?? "",
        consumption_qty: x.consumption_qty ?? "",
        ml_consumption_qty: x.ml_consumption_qty ?? "",
        consumption_cost_us: x.consumption_cost_us ?? "",
        ml_consumption_cost_us: x.ml_consumption_cost_us ?? "",
        desv_pct: x.desv_pct ?? "",
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      ws["!cols"] = [
        { wch: 12 },
        { wch: 18 },
        { wch: 32 },
        { wch: 28 },
        { wch: 10 },
        { wch: 16 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
        { wch: 12 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "ML Table");
      XLSX.writeFile(wb, `refinery_ml_table_${getFileStamp()}.xlsx`);

      setMsgAction?.("OK: exportado Excel ML");
    } catch (e: any) {
      if (!mountedRef.current) return;
      setMsgAction?.(`ERROR: ${String(e?.message || e || "No se pudo exportar Excel ML")}`);
    } finally {
      if (mountedRef.current) {
        setExportBusy(false);
      }
    }
  }, [disabled, exportBusy, runBusy, status.isRunning, setMsgAction]);

  const handleRun = useCallback(async () => {
    if (disabled || runBusy || status.isRunning) return;

    setRunBusy(true);
    setMsgAction?.(null);

    try {
      const r = (await apiPost("/api/refineria/ml/run", {})) as MlRunResp;
      if (!mountedRef.current) return;

      if (r?.status) {
        const nextStatus = normalizeStatus(r.status);
        setStatus(nextStatus);
        setElapsedMmss("00:00");
        onRunningChange?.(nextStatus.isRunning);
      } else {
        await loadStatus(true);
      }

      if (!r?.ok) {
        setMsgAction?.(
          `ERROR: ${String(r?.error || "No se pudo iniciar el proceso ML")}`
        );
        return;
      }

      setMsgAction?.(r?.message ? `OK: ${r.message}` : "OK: proceso ML iniciado");
    } catch (e: any) {
      if (!mountedRef.current) return;

      const msg = String(e?.message || e || "No se pudo iniciar el proceso ML");

      await loadStatus(true);

      if (msg.includes("409") || /Ya hay una corrida ML en ejecución/i.test(msg)) {
        setMsgAction?.("Proceso ML ya en ejecución.");
      } else {
        setMsgAction?.(`ERROR: ${msg}`);
      }
    } finally {
      if (mountedRef.current) {
        setRunBusy(false);
      }
    }
  }, [disabled, runBusy, status.isRunning, loadStatus, setMsgAction, onRunningChange]);

  const mlBlocked = disabled || runBusy || status.isRunning;
  const exportBlocked = disabled || exportBusy || runBusy || status.isRunning;

  return (
    <div style={{ display: "grid", gap: 4, justifyItems: "start" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleExport}
          disabled={exportBlocked}
          title="Exportar ML"
        >
          {exportBusy ? "Exportando…" : "Exportar Excel"}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleRun}
          disabled={mlBlocked}
          title={
            status.isRunning
              ? `Corriendo${status.logFileName ? ` | ${status.logFileName}` : ""}`
              : "Calcular ML"
          }
        >
          {runBusy || status.isRunning ? "Calculando ML…" : "Calcular ML"}
        </Button>
      </div>

      <div
        className="muted"
        style={{
          fontSize: 12,
          fontWeight: 800,
          lineHeight: 1.1,
          minHeight: 14,
        }}
      >
        {status.isRunning || runBusy ? `T: ${elapsedMmss}` : ""}
      </div>
    </div>
  );
}