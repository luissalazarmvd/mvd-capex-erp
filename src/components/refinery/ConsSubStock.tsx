// src/components/refinery/ConsSubStock.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

type MapRow = { reagent_name: string; subprocess_name: string };
type MappingResp = { ok: boolean; rows: MapRow[] };

type ViewRow = {
  campaign_id: string;
  reagent_name: string;
  stock: any;
  [k: string]: any;
};

type ViewResp = { ok: boolean; rows: ViewRow[] };

const SUBPRO_COLS = [
  "Ablandador de Agua",
  "Agua Regia - Disolución",
  "Agua Regia - Neutralización",
  "Agua Regia - Precipitación",
  "Ataque de Lanillas",
  "Ataque Químico",
  "Desorción",
  "Filtrado - Au",
  "Filtrado - Ag",
  "Fundición",
  "Fundición - Au",
  "Fundición - Ag",
  "Guantes",
  "Mandiles",
  "Metalización - Ag",
  "Neutralización - Gases",
  "Neutralización de Pozas de Solución Barren - Solución",
  "Neutralización - Solución",
  "Otros",
  "Reactivación Química",
  "Regeneración Resinas Desionizador",
  "Torres de Neutralización - Gases",
] as const;

function toNum(v: any) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function fmtFixed(v: any, digits: number) {
  const n = toNum(v);
  if (n === null) return "";
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function uniqSorted(a: string[]) {
  return Array.from(new Set(a.filter((x) => !!String(x || "").trim()))).sort((x, y) => x.localeCompare(y));
}

export default function ConsSubStock({
  campaignId,
  reagentName,
  autoLoad = true,
}: {
  campaignId: string;
  reagentName: string;
  autoLoad?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [mapping, setMapping] = useState<MapRow[]>([]);
  const [row, setRow] = useState<ViewRow | null>(null);

  async function loadMapping() {
    const r = (await apiGet("/api/refineria/mapping")) as MappingResp;
    const rows = Array.isArray(r?.rows) ? r.rows : [];
    setMapping(rows);
  }

  async function loadRow(cId: string, rName: string) {
    const c = String(cId || "").trim().toUpperCase();
    const rn = String(rName || "").trim();

    if (!c || !rn) {
      setRow(null);
      setMsg(null);
      return;
    }

    setLoading(true);
    setMsg(null);
    try {
      const q = `?campaign_id=${encodeURIComponent(c)}&reagent_name=${encodeURIComponent(rn)}`;
      const r = (await apiGet(`/api/refineria/cons-stock-subpro${q}`)) as ViewResp;
      const rows = Array.isArray(r?.rows) ? r.rows : [];
      setRow(rows[0] ?? null);
      if (!rows.length) setMsg("Sin datos para esa campaña/insumo.");
    } catch (e: any) {
      setRow(null);
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // mapping se carga 1 vez
    loadMapping().catch(() => {});
  }, []);

  useEffect(() => {
    if (!autoLoad) return;
    loadRow(campaignId, reagentName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, reagentName, autoLoad]);

  const mappedSubpros = useMemo(() => {
    const r = String(reagentName || "").trim();
    const fromMap = mapping
      .filter((m) => String(m.reagent_name || "").trim() === r)
      .map((m) => String(m.subprocess_name || "").trim())
      .filter((s) => !!s);

    const colsInView = new Set<string>(SUBPRO_COLS as any);
    return uniqSorted(fromMap).filter((s) => colsInView.has(s));
  }, [mapping, reagentName]);

  const nonZeroSubpros = useMemo(() => {
    if (!row) return [];
    return (SUBPRO_COLS as any as string[]).filter((c) => {
      const n = toNum((row as any)[c]);
      return n !== null && n !== 0;
    });
  }, [row]);

  const visibleSubpros = useMemo(() => (mappedSubpros.length ? mappedSubpros : nonZeroSubpros), [mappedSubpros, nonZeroSubpros]);

  const cols = useMemo(() => {
    const base = [
      { key: "campaign_id", label: "Campaña", w: 110, fmt: (v: any) => String(v ?? "") },
      { key: "reagent_name", label: "Insumo", w: 220, fmt: (v: any) => String(v ?? "") },
      { key: "stock", label: "Stock", w: 110, fmt: (v: any) => fmtFixed(v, 3) },
    ];

    const subs = visibleSubpros.map((name) => ({
      key: name,
      label: name,
      w: 170,
      fmt: (v: any) => fmtFixed(v, 3),
    }));

    return [...base, ...subs];
  }, [visibleSubpros]);

  const cellBase: React.CSSProperties = {
    padding: "8px 10px",
    fontSize: 12,
    lineHeight: "16px",
    whiteSpace: "nowrap",
  };

  const headerBg = "rgb(6, 36, 58)";
  const headerBorder = "1px solid rgba(191, 231, 255, 0.26)";
  const headerShadow = "0 8px 18px rgba(0,0,0,.18)";

  const stickyHead: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 8,
    background: headerBg,
    boxShadow: headerShadow,
  };

  const numCell: React.CSSProperties = { ...cellBase, textAlign: "right" };
  const textCell: React.CSSProperties = { ...cellBase, textAlign: "left" };

  const canQuery = !!String(campaignId || "").trim() && !!String(reagentName || "").trim();

  return (
    <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
      <div className="panel-inner" style={{ padding: 12, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Consumo por Subproceso + Stock</div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => loadRow(campaignId, reagentName)}
            disabled={loading || !canQuery}
          >
            {loading ? "Cargando..." : "Refrescar"}
          </Button>
        </div>
      </div>

      {msg ? (
        <div
          className="panel-inner"
          style={{
            padding: 10,
            border: "1px solid rgba(255,80,80,.45)",
            background: "rgba(255,80,80,.10)",
            fontWeight: 800,
          }}
        >
          {msg}
        </div>
      ) : null}

      <div className="panel-inner" style={{ padding: 0, overflow: "hidden" }}>
        {row ? (
          <Table stickyHeader maxHeight={"calc(100vh - 260px)"}>
            <thead>
              <tr>
                {cols.map((c) => (
                  <th
                    key={String(c.key)}
                    className="capex-th"
                    style={{
                      ...stickyHead,
                      minWidth: c.w ?? 120,
                      maxWidth: c.w ?? 120,
                      border: headerBorder,
                      borderBottom: headerBorder,
                      textAlign: c.key === "reagent_name" ? "left" : "center",
                      padding: "10px 8px",
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                    title={c.label}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              <tr className="capex-tr">
                {cols.map((c) => {
                  const v = (row as any)[c.key];
                  const txt = c.fmt ? c.fmt(v) : v ?? "";
                  const isText = c.key === "campaign_id" || c.key === "reagent_name";
                  return (
                    <td
                      key={`r-${String(c.key)}`}
                      className="capex-td"
                      style={{
                        ...(isText ? textCell : numCell),
                        background: "rgba(0,0,0,.10)",
                        borderBottom: "1px solid rgba(255,255,255,.06)",
                        fontWeight: c.key === "stock" ? 900 : 800,
                      }}
                    >
                      {txt}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </Table>
        ) : (
          <div className="panel-inner" style={{ padding: 12, fontWeight: 800 }}>
            {loading ? "Cargando…" : canQuery ? "Sin datos." : "Selecciona campaña e insumo arriba."}
          </div>
        )}
      </div>

      {row && !visibleSubpros.length ? (
        <div className="panel-inner" style={{ padding: 12, fontWeight: 800, opacity: 0.9 }}>
          No hay subprocesos con consumo para este insumo en esa campaña (según mapping/valores).
        </div>
      ) : null}
    </div>
  );
}
