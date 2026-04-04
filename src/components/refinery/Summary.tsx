// src/components/refinery/Summary.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet } from "../../lib/apiClient";

type CampaignRow = {
  campaign_id: string;
  campaign_date: string | null; // yyyy-mm-dd
  campaign_wet_cr: any; // Carbón Húmedo (kg)
  campaign_moisture_pct: any; // decimal o % (se mostrará 1-100%)
  campaign_au_grade: any; // Ley Au
  campaign_ag_grade: any; // Ley Ag
  campaign_cr: any; // Carbón Seco (kg)
  campaign_au: any; // Producción Au (kg)
  campaign_ag: any; // Producción Ag (kg)
  campaign_cu: any; // Producción Cu (kg)
};

type CampaignsResp = { ok: boolean; rows: CampaignRow[]; error?: string };

function toNum(v: any) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmt2(v: any) {
  const n = toNum(v);
  if (n === null) return "0.00";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct100(v: any) {
  const n0 = toNum(v);
  if (n0 === null) return "0.00%";
  const n = n0 <= 1.5 ? n0 * 100 : n0; // si viene como 0-1 => pasar a 0-100
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function Stat({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 4,
        padding: "8px 10px",
        borderRadius: 12,
        border: danger ? "1px solid rgba(255,80,80,.45)" : "1px solid rgba(255,255,255,.08)",
        background: danger ? "rgba(255,80,80,.12)" : "rgba(0,0,0,.08)",
        minWidth: 150,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.9, color: danger ? "#ff9b9b" : undefined }}>
        {label}
      </div>
      <div style={{ fontWeight: 900, fontSize: 16, lineHeight: "18px", color: danger ? "#ffb3b3" : undefined }}>
        {value}
      </div>
    </div>
  );
}

export default function Summary({ campaignId }: { campaignId: string }) {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);

  async function loadCampaigns() {
    setLoading(true);
    setMsg(null);
    try {
      const c = (await apiGet("/api/refineria/campaigns")) as CampaignsResp;
      const rows = Array.isArray(c?.rows) ? c.rows : [];
      setCampaigns(rows);
      if (!rows.length) setMsg("Sin datos.");
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando");
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(() => {
    const id = String(campaignId || "").trim().toUpperCase();
    if (!id) return null;
    return campaigns.find((c) => String(c.campaign_id || "").trim().toUpperCase() === id) ?? null;
  }, [campaignId, campaigns]);

  const valueCampaignDate = selected?.campaign_date ? String(selected.campaign_date) : "—";
  const valueWet = fmt2(selected?.campaign_wet_cr);
  const valueMoist = fmtPct100(selected?.campaign_moisture_pct);
  const valueDry = fmt2(selected?.campaign_cr);
  const valueAuGrade = fmt2(selected?.campaign_au_grade);
  const valueAgGrade = fmt2(selected?.campaign_ag_grade);
  const valueAu = fmt2(selected?.campaign_au);
  const valueAg = fmt2(selected?.campaign_ag);
  const valueCu = fmt2(selected?.campaign_cu);

  const isBadDate = !selected?.campaign_date;
  const isBadWet = (toNum(selected?.campaign_wet_cr) ?? 0) === 0;
  const isBadMoist = (toNum(selected?.campaign_moisture_pct) ?? 0) === 0;
  const isBadDry = (toNum(selected?.campaign_cr) ?? 0) === 0;
  const isBadAuGrade = (toNum(selected?.campaign_au_grade) ?? 0) === 0;
  const isBadAgGrade = (toNum(selected?.campaign_ag_grade) ?? 0) === 0;
  const isBadAu = (toNum(selected?.campaign_au) ?? 0) === 0;
  const isBadAg = (toNum(selected?.campaign_ag) ?? 0) === 0;
  const isBadCu = (toNum(selected?.campaign_cu) ?? 0) === 0;

  return (
    <div className="panel-inner" style={{ padding: 12, width: "100%", overflow: "hidden" }}>
      {msg ? (
        <div
          style={{
            padding: 10,
            marginBottom: 10,
            border: msg.startsWith("ERROR") ? "1px solid rgba(255,80,80,.45)" : "1px solid rgba(255,255,255,.10)",
            background: msg.startsWith("ERROR") ? "rgba(255,80,80,.10)" : "rgba(255,255,255,.04)",
            fontWeight: 800,
            borderRadius: 12,
          }}
        >
          {msg}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "stretch",
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
          paddingBottom: 2,
        }}
      >
        <Stat label="Fecha de Campaña" value={valueCampaignDate} danger={isBadDate} />
        <Stat label="Carbón Húmedo (kg)" value={valueWet} danger={isBadWet} />
        <Stat label="% Humedad" value={valueMoist} danger={isBadMoist} />
        <Stat label="Carbón Seco (kg)" value={valueDry} danger={isBadDry} />
        <Stat label="Ley Au" value={valueAuGrade} danger={isBadAuGrade} />
        <Stat label="Ley Ag" value={valueAgGrade} danger={isBadAgGrade} />
        <Stat label="Producción Au (kg)" value={valueAu} danger={isBadAu} />
        <Stat label="Producción Ag (kg)" value={valueAg} danger={isBadAg} />
        <Stat label="Producción Cu (kg)" value={valueCu} danger={isBadCu} />
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <div className="muted" style={{ fontWeight: 800, opacity: 0.85 }}>
          {loading ? "Cargando…" : selected ? `Campaña: ${String(selected.campaign_id || "").trim().toUpperCase()}` : "Selecciona campaña"}
        </div>

        <button
          type="button"
          onClick={loadCampaigns}
          disabled={loading}
          style={{
            marginLeft: "auto",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "rgba(0,0,0,.10)",
            color: "var(--text)",
            padding: "8px 10px",
            fontWeight: 900,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Cargando..." : "Refrescar"}
        </button>
      </div>
    </div>
  );
}
