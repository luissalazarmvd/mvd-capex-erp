// src/app/compliance/downloads/page.tsx
"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../../../lib/apiClient";
import ComplianceProveeminExp from "../../../components/compliance/ComplianceProveeminExp";
import ComplianceROCExp from "../../../components/compliance/ComplianceROCExp";
import ComplianceTraceabilityExp from "../../../components/compliance/ComplianceTraceabilityExp";

type ComplianceProvRow = any;

type ComplianceProvResp = {
  ok: boolean;
  rows?: ComplianceProvRow[];
  count?: number;
  error?: string;
};

export default function ComplianceDownloadsPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [provRows, setProvRows] = useState<ComplianceProvRow[]>([]);

  async function loadComplianceProvRows(clearMsg = true) {
    if (clearMsg) setMsg(null);

    try {
      const data = (await apiGet("/api/compliance/format-proveemin")) as ComplianceProvResp;

      if (!data?.ok) {
        throw new Error(data?.error || "No se pudo consultar format proveemin");
      }

      setProvRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (e: any) {
      setMsg(String(e?.message || "No se pudo consultar format proveemin"));
      setProvRows([]);
    }
  }

  useEffect(() => {
    loadComplianceProvRows(false);
  }, []);

  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>
        Descargas
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <ComplianceROCExp setMsgAction={setMsg} />

        <ComplianceTraceabilityExp setMsgAction={setMsg} />
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>
          ROC - PROVEEMIN
        </div>

        <ComplianceProveeminExp
          rows={provRows}
          setMsgAction={setMsg}
          loadRowsAction={loadComplianceProvRows}
        />
      </div>

      {msg ? (
        <div
          className="panel-inner"
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 12,
            border: String(msg).startsWith("OK:")
              ? "1px solid rgba(191, 231, 255, 0.22)"
              : "1px solid rgba(255, 107, 107, 0.28)",
            background: String(msg).startsWith("OK:")
              ? "rgba(255, 255, 255, 0.04)"
              : "rgba(255, 107, 107, 0.10)",
            color: "var(--text)",
            fontWeight: 800,
            fontSize: 13,
            lineHeight: 1.35,
          }}
        >
          {msg}
        </div>
      ) : null}
    </div>
  );
}