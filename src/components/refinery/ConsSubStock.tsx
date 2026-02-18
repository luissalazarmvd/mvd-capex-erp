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

function colWidth(key: string) {
  if (key === "campaign_id") return 120;
  if (key === "reagent_name") return 220;
  if (key === "stock") return 110;
  if (key === "__total__") return 120;

  const s = String(key || "");
  return Math.max(150, Math.min(220, 90 + s.length * 4));
}

export default function ConsSubStock({
  campaignId,
  reagentName = "",
  autoLoad = true,
  refreshKey = 0,
}: {
  campaignId: string;
  reagentName?: string;
  autoLoad?: boolean;
  refreshKey?: number;
}) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [mapping, setMapping] = useState<MapRow[]>([]);
  const [rows, setRows] = useState<ViewRow[]>([]);

  async function loadMapping() {
    const r = (await apiGet("/api/refineria/mapping")) as MappingResp;
    const rr = Array.isArray(r?.rows) ? r.rows : [];
    setMapping(rr);
  }

  async function loadRows(cId: string, rName?: string) {
    const c = String(cId || "").trim().toUpperCase();
    const rn = String(rName || "").trim();

    if (!c) {
      setRows([]);
      setMsg(null);
      return;
    }

    setLoading(true);
    setMsg(null);
    try {
      const q = rn
        ? `?campaign_id=${encodeURIComponent(c)}&reagent_name=${encodeURIComponent(rn)}`
        : `?campaign_id=${encodeURIComponent(c)}`;

      const r = (await apiGet(`/api/refineria/cons-stock-subpro${q}`)) as ViewResp;
      const rr = Array.isArray(r?.rows) ? r.rows : [];
      setRows(rr);

      if (!rr.length) {
        setMsg(rn ? "Sin datos para esa campaña/insumo." : "Sin datos para esa campaña.");
      }
    } catch (e: any) {
      setRows([]);
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMapping().catch(() => {});
  }, []);

  useEffect(() => {
    if (!autoLoad) return;
    loadRows(campaignId, reagentName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, reagentName, autoLoad, refreshKey]);

  const modeAllReagents = !String(reagentName || "").trim();

  const mappedSubpros = useMemo(() => {
    const colsInView = new Set<string>(SUBPRO_COLS as any);

    if (modeAllReagents) {
      const reagentsInRows = new Set((rows || []).map((x) => String(x.reagent_name || "").trim()).filter((x) => !!x));

      const fromMap = mapping
        .filter((m) => reagentsInRows.has(String(m.reagent_name || "").trim()))
        .map((m) => String(m.subprocess_name || "").trim())
        .filter((s) => !!s);

      return uniqSorted(fromMap).filter((s) => colsInView.has(s));
    }

    const r = String(reagentName || "").trim();
    const fromMap = mapping
      .filter((m) => String(m.reagent_name || "").trim() === r)
      .map((m) => String(m.subprocess_name || "").trim())
      .filter((s) => !!s);

    return uniqSorted(fromMap).filter((s) => colsInView.has(s));
  }, [mapping, reagentName, rows, modeAllReagents]);

  const nonZeroSubpros = useMemo(() => {
    if (!rows.length) return [];
    return (SUBPRO_COLS as any as string[]).filter((c) =>
      (rows || []).some((r) => {
        const n = toNum((r as any)[c]);
        return n !== null && n !== 0;
      })
    );
  }, [rows]);

  const visibleSubpros = useMemo(() => (mappedSubpros.length ? mappedSubpros : nonZeroSubpros), [mappedSubpros, nonZeroSubpros]);

  const rowTotal = useMemo(() => {
    const keys = visibleSubpros || [];
    return (r: ViewRow) => {
      let sum = 0;
      let any = false;
      for (const k of keys) {
        const n = toNum((r as any)[k]);
        if (n !== null) {
          sum += n;
          any = true;
        }
      }
      return any ? sum : null;
    };
  }, [visibleSubpros]);

  const cols = useMemo(() => {
    const base = [
      { key: "campaign_id", label: "Campaña", w: colWidth("campaign_id"), fmt: (v: any) => String(v ?? "") },
      { key: "reagent_name", label: "Insumo", w: colWidth("reagent_name"), fmt: (v: any) => String(v ?? "") },
      { key: "stock", label: "Stock", w: colWidth("stock"), fmt: (v: any) => fmtFixed(v, 2) },
    ];

    const subs = visibleSubpros.map((name) => ({
      key: name,
      label: name,
      w: colWidth(name),
      fmt: (v: any) => fmtFixed(v, 2),
    }));

    const totalCol = {
      key: "__total__",
      label: "Total",
      w: colWidth("__total__"),
      fmt: (_: any, r?: ViewRow) => fmtFixed(r ? rowTotal(r) : null, 2),
    };

    return [...base, ...subs, totalCol];
  }, [visibleSubpros, rowTotal]);

  const cellBase: React.CSSProperties = {
    padding: "8px 10px",
    fontSize: 12,
    lineHeight: "16px",
    wordBreak: "normal",
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

  const stickyRightHead: React.CSSProperties = {
    ...stickyHead,
    right: 0,
    zIndex: 12,
  };

  const stickyRightCell: React.CSSProperties = {
    position: "sticky",
    right: 0,
    zIndex: 6,
    background: "rgb(5, 40, 63)",
    boxShadow: " -10px 0 18px rgba(0,0,0,.22)",
  };

  const numCell: React.CSSProperties = { ...cellBase, textAlign: "right", whiteSpace: "nowrap" };
  const textCell: React.CSSProperties = {
    ...cellBase,
    textAlign: "left",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const canQuery = !!String(campaignId || "").trim();

  return (
    <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
      <div className="panel-inner" style={{ padding: 12, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Consumo por Subproceso + Stock</div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Button type="button" size="sm" variant="ghost" onClick={() => loadRows(campaignId, reagentName)} disabled={loading || !canQuery}>
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

      <div
        className="panel-inner"
        style={{
          padding: 0,
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {rows.length ? (
          <div style={{ display: "inline-block", width: "max-content", maxWidth: "100%" }}>
            <Table stickyHeader maxHeight={"calc(100vh - 260px)"}>
              <thead>
                <tr>
                  {cols.map((c) => {
                    const isTotal = String(c.key) === "__total__";
                    return (
                      <th
                        key={String(c.key)}
                        className="capex-th"
                        style={{
                          ...(isTotal ? stickyRightHead : stickyHead),
                          width: c.w ?? 160,
                          minWidth: c.w ?? 160,
                          border: headerBorder,
                          borderBottom: headerBorder,
                          textAlign: "center",
                          padding: "6px 4px",
                          fontSize: 12,
                          fontWeight: 900,
                          whiteSpace: "normal",
                          lineHeight: "14px",
                          verticalAlign: "middle",
                          height: 42,
                        }}
                        title={c.label}
                      >
                        <div
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            margin: "0 auto",
                            padding: 0,
                            textAlign: "center",
                          }}
                        >
                          {c.label}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {rows.map((row, ridx) => (
                  <tr key={`${String(row.reagent_name || ridx)}-${ridx}`} className="capex-tr">
                    {cols.map((c) => {
                      const isText = c.key === "campaign_id" || c.key === "reagent_name";
                      const isTotal = String(c.key) === "__total__";

                      let txt = "";
                      if (isTotal) {
                        txt = (c as any).fmt?.(null, row) ?? fmtFixed(rowTotal(row), 2);
                      } else {
                        const v = (row as any)[c.key];
                        txt = c.fmt ? c.fmt(v) : v ?? "";
                      }

                      return (
                        <td
                          key={`${ridx}-${String(c.key)}`}
                          className="capex-td"
                          style={{
                            ...(isText ? textCell : numCell),
                            ...(isTotal ? stickyRightCell : null),
                            width: c.w ?? 160,
                            minWidth: c.w ?? 160,
                            padding: "6px 6px",
                            background: isTotal ? (stickyRightCell.background as any) : "rgba(0,0,0,.10)",
                            borderBottom: "1px solid rgba(255,255,255,.06)",
                            fontWeight: isTotal || c.key === "stock" ? 900 : 800,
                          }}
                          title={String(txt)}
                        >
                          {txt}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : (
          <div className="panel-inner" style={{ padding: 12, fontWeight: 800 }}>
            {loading ? "Cargando…" : canQuery ? "Sin datos." : "Selecciona una campaña arriba."}
          </div>
        )}
      </div>

      {rows.length && !visibleSubpros.length ? (
        <div className="panel-inner" style={{ padding: 12, fontWeight: 800, opacity: 0.9 }}>
          No hay subprocesos con consumo para esta campaña (según mapping/valores).
        </div>
      ) : null}
    </div>
  );
}
