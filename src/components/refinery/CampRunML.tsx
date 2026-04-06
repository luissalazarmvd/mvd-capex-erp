// src/components/refinery/CampRunML.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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

  return (
    <div style={{ display: "grid", gap: 4, justifyItems: "start" }}>
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