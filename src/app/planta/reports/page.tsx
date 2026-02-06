// src/app/planta/reports/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet } from "../../../lib/apiClient";
import { Button } from "../../../components/ui/Button";
import { Table } from "../../../components/ui/Table";

const PBI_PLANTA_REPORTS_URL =
  "https://app.powerbi.com/view?r=eyJrIjoiOTVmMzI2NWQtZDgzNy00ZGI3LWE5MzMtZjllNDcxOWIyZWU2IiwidCI6IjYzNzhiZmNkLWRjYjktNDMwZi05Nzc4LWRiNTk3NGRjMmFkYyIsImMiOjR9";

type BalRow = {
  shift_id: string;
  tms: any;
  au_feed: any;
  au_feed_g: any;
  ag_feed: any;
  ag_feed_g: any;
  operation_hr: any;
  prod_ratio: any;
  density_of: any;
  pct_200: any;
  vol_solu_m3: any;

  au_solid_of: any;
  au_solid_of_g: any;
  au_solu_of: any;
  au_solu_of_g: any;
  au_soli_solu_of_g: any;
  au_solid_tail: any;
  au_solid_tail_g: any;
  au_solu_tail: any;
  au_solu_tail_g: any;
  au_soli_solu_tail: any;
  au_soli_solu_tail_g: any;

  ag_solid_of: any;
  ag_solid_of_g: any;
  ag_solu_of: any;
  ag_solu_of_g: any;
  ag_soli_solu_of_g: any;
  ag_solid_tail: any;
  ag_solid_tail_g: any;
  ag_solu_tail: any;
  ag_solu_tail_g: any;
  ag_soli_solu_tail: any;
  ag_soli_solu_tail_g: any;

  au_prod: any;
  au_recu: any;
  ag_prod: any;
  ag_recu: any;

  nacn_ratio: any;
  naoh_ratio: any;
  balls_ratio: any;
};

type BalResp = { ok: boolean; rows: BalRow[] };

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
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtInt(v: any) {
  const n = toNum(v);
  if (n === null) return "";
  return Math.round(n).toLocaleString("en-US");
}

function fmtPctFromFrac(v: any, digits: number) {
  const n = toNum(v);
  if (n === null) return "";
  const p = n * 100;
  return `${p.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

function fmtPct200(v: any) {
  const n = toNum(v);
  if (n === null) return "";
  const p = n * 100;
  return `${p.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

const COL_W: React.CSSProperties = { minWidth: 86, maxWidth: 110 };

const HEADER_ROW1_H = 44;
const solidHeaderBg = "rgb(6, 36, 58)";
const solidHeaderBorder = "1px solid rgba(191, 231, 255, 0.26)";
const solidHeaderShadow = "0 8px 18px rgba(0,0,0,.18)";

const stickyRow1: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 8,
  background: solidHeaderBg,
  boxShadow: solidHeaderShadow,
};

const stickyRow2: React.CSSProperties = {
  position: "sticky",
  top: HEADER_ROW1_H,
  zIndex: 7,
  background: solidHeaderBg,
  boxShadow: solidHeaderShadow,
};

const stickyDayBg = "rgb(6, 36, 58)";

const groupBorder = "1px solid rgba(191, 231, 255, 0.22)";
const groupBg = "rgba(0,0,0,.08)";

type ColDef = {
  key: keyof BalRow | "__gap__";
  label: string;
  w?: number;
  fmt?: (v: any, row: BalRow) => string;
};

function buildColumns(mode: "AU" | "AG"): ColDef[] {
  const base: ColDef[] = [
    { key: "shift_id", label: "Guardia", w: 130, fmt: (v) => (v ?? "") as any },
    { key: "tms", label: "TMS", w: 80, fmt: (v) => fmtFixed(v, 1) },
    { key: "au_feed", label: "Au (g/t) - Feed", w: 140, fmt: (v) => fmtFixed(v, 2) },
    { key: "au_feed_g", label: "Au (g) - Feed", w: 130, fmt: (v) => fmtInt(v) },
    { key: "ag_feed", label: "Ag (g/t) - Feed", w: 140, fmt: (v) => fmtFixed(v, 2) },
    { key: "ag_feed_g", label: "Ag (g) - Feed", w: 130, fmt: (v) => fmtInt(v) },
    { key: "operation_hr", label: "Operación (h)", w: 130, fmt: (v) => fmtFixed(v, 1) },
    { key: "prod_ratio", label: "Ratio (t/h)", w: 110, fmt: (v) => fmtFixed(v, 1) },
    { key: "density_of", label: "Den (g/l)", w: 95, fmt: (v) => fmtInt(v) },
    { key: "pct_200", label: "%m-200", w: 95, fmt: (v) => fmtPct200(v) },
    { key: "vol_solu_m3", label: "Volumen (m³)", w: 130, fmt: (v) => fmtFixed(v, 2) },
  ];

  const auBlock: ColDef[] = [
    { key: "au_solid_of", label: "Au (g/t) - Solid OF", w: 150, fmt: (v) => fmtFixed(v, 2) },
    { key: "au_solid_of_g", label: "Au (g) - Solid OF", w: 150, fmt: (v) => fmtInt(v) },
    { key: "au_solu_of", label: "Au (g/t) - Solu OF", w: 150, fmt: (v) => fmtFixed(v, 2) },
    { key: "au_solu_of_g", label: "Au (g) - Solu OF", w: 150, fmt: (v) => fmtInt(v) },
    { key: "au_soli_solu_of_g", label: "Au (g) - Solid+Solu OF", w: 190, fmt: (v) => fmtInt(v) },

    { key: "au_solid_tail", label: "Au (g/t) - Solid Tail", w: 160, fmt: (v) => fmtFixed(v, 2) },
    { key: "au_solid_tail_g", label: "Au (g) - Solid Tail", w: 160, fmt: (v) => fmtInt(v) },
    { key: "au_solu_tail", label: "Au (g/t) - Solu Tail", w: 160, fmt: (v) => fmtFixed(v, 2) },
    { key: "au_solu_tail_g", label: "Au (g) - Solu Tail", w: 160, fmt: (v) => fmtInt(v) },
    { key: "au_soli_solu_tail", label: "Au (g/t) - Solid+Solu Tail", w: 200, fmt: (v) => fmtFixed(v, 2) },
    { key: "au_soli_solu_tail_g", label: "Au (g) - Solid+Solu Tail", w: 190, fmt: (v) => fmtInt(v) },
  ];

  const agBlock: ColDef[] = [
    { key: "ag_solid_of", label: "Ag (g/t) - Solid OF", w: 150, fmt: (v) => fmtFixed(v, 2) },
    { key: "ag_solid_of_g", label: "Ag (g) - Solid OF", w: 150, fmt: (v) => fmtInt(v) },
    { key: "ag_solu_of", label: "Ag (g/t) - Solu OF", w: 150, fmt: (v) => fmtFixed(v, 2) },
    { key: "ag_solu_of_g", label: "Ag (g) - Solu OF", w: 150, fmt: (v) => fmtInt(v) },
    { key: "ag_soli_solu_of_g", label: "Ag (g) - Solid+Solu OF", w: 190, fmt: (v) => fmtInt(v) },

    { key: "ag_solid_tail", label: "Ag (g/t) - Solid Tail", w: 160, fmt: (v) => fmtFixed(v, 2) },
    { key: "ag_solid_tail_g", label: "Ag (g) - Solid Tail", w: 160, fmt: (v) => fmtInt(v) },
    { key: "ag_solu_tail", label: "Ag (g/t) - Solu Tail", w: 160, fmt: (v) => fmtFixed(v, 2) },
    { key: "ag_solu_tail_g", label: "Ag (g) - Solu Tail", w: 160, fmt: (v) => fmtInt(v) },
    { key: "ag_soli_solu_tail", label: "Ag (g/t) - Solid+Solu Tail", w: 200, fmt: (v) => fmtFixed(v, 2) },
    { key: "ag_soli_solu_tail_g", label: "Ag (g) - Solid+Solu Tail", w: 190, fmt: (v) => fmtInt(v) },
  ];

  const end: ColDef[] = [
    { key: "au_prod", label: "Au Prod (g)", w: 120, fmt: (v) => fmtInt(v) },
    { key: "au_recu", label: "Au Rec (%)", w: 120, fmt: (v) => fmtPctFromFrac(v, 2) },
    { key: "ag_prod", label: "Ag Prod (g)", w: 120, fmt: (v) => fmtInt(v) },
    { key: "ag_recu", label: "Ag Rec (%)", w: 120, fmt: (v) => fmtPctFromFrac(v, 2) },
    { key: "nacn_ratio", label: "NaCN (kg/t)", w: 125, fmt: (v) => fmtFixed(v, 2) },
    { key: "naoh_ratio", label: "NaOH (kg/t)", w: 125, fmt: (v) => fmtFixed(v, 2) },
    { key: "balls_ratio", label: "Bolas (kg/t)", w: 125, fmt: (v) => fmtFixed(v, 2) },
  ];

  return [...base, ...(mode === "AU" ? auBlock : agBlock), ...end];
}

export default function PlantaReportsPage() {
  const [mode, setMode] = useState<"AU" | "AG">("AU");
  const [rows, setRows] = useState<BalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const cols = useMemo(() => buildColumns(mode), [mode]);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const r = (await apiGet(`/api/planta/balance?top=200`)) as BalResp;
      setRows(Array.isArray(r?.rows) ? r.rows : []);
    } catch (e: any) {
      setRows([]);
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando balance metalúrgico");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const GAP_W = 14;

  return (
    <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
      <div className="panel-inner" style={{ padding: 12, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Reportes</div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 8 }}>
          <Button
            type="button"
            size="sm"
            variant={mode === "AU" ? "primary" : "ghost"}
            onClick={() => setMode("AU")}
            disabled={loading}
          >
            Au
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "AG" ? "primary" : "ghost"}
            onClick={() => setMode("AG")}
            disabled={loading}
          >
            Ag
          </Button>

          <Button type="button" size="sm" variant="default" onClick={load} disabled={loading}>
            {loading ? "Cargando…" : "Refrescar"}
          </Button>
        </div>

        <div className="muted" style={{ fontWeight: 800, marginLeft: "auto" }}>
          Planta · Balance metalúrgico + Power BI
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
        {rows.length ? (
          <Table stickyHeader maxHeight={"calc(100vh - 520px)"}>
            <thead>
              <tr>
                <th
                  className="capex-th"
                  style={{
                    ...stickyRow1,
                    position: "sticky",
                    left: 0,
                    zIndex: 14,
                    minWidth: 130,
                    background: stickyDayBg,
                    borderRight: "1px solid rgba(255,255,255,.08)",
                  }}
                >
                  Guardia
                </th>

                {cols
                  .filter((c) => c.key !== "shift_id")
                  .map((c) => (
                    <th
                      key={String(c.key)}
                      className="capex-th"
                      style={{
                        ...stickyRow1,
                        ...(c.w ? { minWidth: c.w, maxWidth: c.w } : COL_W),
                        background: solidHeaderBg,
                        border: solidHeaderBorder,
                        borderBottom: solidHeaderBorder,
                        textAlign: "center",
                      }}
                    >
                      {c.label}
                    </th>
                  ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => (
                <tr key={String(r.shift_id || "")} className="capex-tr">
                  <td
                    className="capex-td capex-td-strong"
                    style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 2,
                      background: "rgba(0,0,0,.18)",
                      minWidth: 130,
                      padding: "6px 10px",
                      borderRight: "1px solid rgba(255,255,255,.08)",
                    }}
                  >
                    {r.shift_id}
                  </td>

                  {cols
                    .filter((c) => c.key !== "shift_id")
                    .map((c) => {
                      if (c.key === "__gap__") {
                        return (
                          <td
                            key={`gap-${Math.random()}`}
                            style={{
                              width: GAP_W,
                              minWidth: GAP_W,
                              maxWidth: GAP_W,
                              padding: 0,
                              background: "transparent",
                              borderBottom: "0",
                            }}
                          />
                        );
                      }

                      const v = (r as any)[c.key];
                      const text = c.fmt ? c.fmt(v, r) : v ?? "";
                      const isGroup = true;

                      return (
                        <td
                          key={String(c.key)}
                          className="capex-td"
                          style={{
                            padding: "6px 8px",
                            textAlign: "right",
                            background: isGroup ? groupBg : "transparent",
                            borderBottom: groupBorder,
                          }}
                        >
                          {text}
                        </td>
                      );
                    })}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="panel-inner" style={{ padding: 12, fontWeight: 800 }}>
            {loading ? "Cargando…" : "Sin datos."}
          </div>
        )}
      </div>

      <div className="panel-inner" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ position: "relative", width: "100%", height: "calc(100vh - 260px)" }}>
          <iframe
            title="MVD - Planta - Reportes"
            src={PBI_PLANTA_REPORTS_URL}
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
