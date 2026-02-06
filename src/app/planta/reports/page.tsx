// src/app/planta/reports/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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

function isoTodayPe(): string {
  const now = new Date();
  const pe = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const y = pe.getUTCFullYear();
  const m = String(pe.getUTCMonth() + 1).padStart(2, "0");
  const d = String(pe.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseShiftId(shift_id: string): { dateIso: string; shift: string } {
  const s = String(shift_id || "").trim();
  const parts = s.split("-");
  const ymd = parts[0] || "";
  const shift = parts[1] || "";
  if (ymd.length === 8) {
    const y = ymd.slice(0, 4);
    const m = ymd.slice(4, 6);
    const d = ymd.slice(6, 8);
    return { dateIso: `${y}-${m}-${d}`, shift };
  }
  return { dateIso: "", shift };
}

function monthStartIso(iso: string) {
  if (!iso || iso.length !== 10) return iso;
  return `${iso.slice(0, 7)}-01`;
}

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

function fmtDateDdMm(iso: string) {
  if (!iso || iso.length !== 10) return iso || "";
  const dd = iso.slice(8, 10);
  const mm = iso.slice(5, 7);
  const yy = iso.slice(0, 4);
  return `${dd}/${mm}/${yy}`;
}

function DatePicker({
  label,
  valueIso,
  onChangeIso,
  disabled,
  min,
  max,
}: {
  label: string;
  valueIso: string;
  onChangeIso: (iso: string) => void;
  disabled?: boolean;
  min?: string;
  max?: string;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontWeight: 900, fontSize: 13 }}>{label}</div>
      <input
        type="date"
        value={valueIso}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChangeIso(e.target.value)}
        style={{
          width: "100%",
          background: "rgba(0,0,0,.10)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          borderRadius: 10,
          padding: "10px 12px",
          outline: "none",
          fontWeight: 900,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.7 : 1,
        }}
      />
    </div>
  );
}

type Agg = "sum" | "wavg_tms" | "avg";

type ColDef = {
  key: keyof BalRow;
  label: string;
  w?: number;
  agg: Agg;
  fmt?: (v: any) => string;
};

function buildColumns(mode: "AU" | "AG"): ColDef[] {
  const base: ColDef[] = [
    { key: "tms", label: "TMS", w: 76, agg: "sum", fmt: (v) => fmtFixed(v, 1) },

    { key: "au_feed", label: "Au (g/t) Feed", w: 108, agg: "wavg_tms", fmt: (v) => fmtFixed(v, 2) },
    { key: "au_feed_g", label: "Au (g) Feed", w: 100, agg: "sum", fmt: (v) => fmtInt(v) },

    { key: "ag_feed", label: "Ag (g/t) Feed", w: 108, agg: "wavg_tms", fmt: (v) => fmtFixed(v, 2) },
    { key: "ag_feed_g", label: "Ag (g) Feed", w: 100, agg: "sum", fmt: (v) => fmtInt(v) },

    { key: "operation_hr", label: "Operación (h)", w: 102, agg: "sum", fmt: (v) => fmtFixed(v, 1) },
    { key: "prod_ratio", label: "Ratio (t/h)", w: 96, agg: "avg", fmt: (v) => fmtFixed(v, 1) },

    { key: "density_of", label: "Den (g/l)", w: 90, agg: "wavg_tms", fmt: (v) => fmtInt(v) },
    { key: "pct_200", label: "%m-200", w: 86, agg: "avg", fmt: (v) => fmtPct200(v) },
    { key: "vol_solu_m3", label: "Vol (m³)", w: 98, agg: "sum", fmt: (v) => fmtFixed(v, 2) },
  ];

  const auBlock: ColDef[] = [
    { key: "au_solid_of", label: "Au (g/t) OF Sol", w: 110, agg: "wavg_tms", fmt: (v) => fmtFixed(v, 2) },
    { key: "au_solid_of_g", label: "Au (g) OF Sol", w: 106, agg: "sum", fmt: (v) => fmtInt(v) },
    { key: "au_solu_of", label: "Au (g/t) OF Liq", w: 110, agg: "wavg_tms", fmt: (v) => fmtFixed(v, 2) },
    { key: "au_solu_of_g", label: "Au (g) OF Liq", w: 106, agg: "sum", fmt: (v) => fmtInt(v) },
    { key: "au_soli_solu_of_g", label: "Au (g) OF Tot", w: 112, agg: "sum", fmt: (v) => fmtInt(v) },

    { key: "au_solid_tail", label: "Au (g/t) Rel Sol", w: 116, agg: "wavg_tms", fmt: (v) => fmtFixed(v, 2) },
    { key: "au_solid_tail_g", label: "Au (g) Rel Sol", w: 112, agg: "sum", fmt: (v) => fmtInt(v) },
    { key: "au_solu_tail", label: "Au (g/t) Rel Liq", w: 116, agg: "wavg_tms", fmt: (v) => fmtFixed(v, 2) },
    { key: "au_solu_tail_g", label: "Au (g) Rel Liq", w: 112, agg: "sum", fmt: (v) => fmtInt(v) },
    { key: "au_soli_solu_tail", label: "Au (g/t) Rel Tot", w: 122, agg: "wavg_tms", fmt: (v) => fmtFixed(v, 2) },
    { key: "au_soli_solu_tail_g", label: "Au (g) Rel Tot", w: 112, agg: "sum", fmt: (v) => fmtInt(v) },
  ];

  const agBlock: ColDef[] = [
    { key: "ag_solid_of", label: "Ag (g/t) OF Sol", w: 110, agg: "wavg_tms", fmt: (v) => fmtFixed(v, 2) },
    { key: "ag_solid_of_g", label: "Ag (g) OF Sol", w: 106, agg: "sum", fmt: (v) => fmtInt(v) },
    { key: "ag_solu_of", label: "Ag (g/t) OF Liq", w: 110, agg: "wavg_tms", fmt: (v) => fmtFixed(v, 2) },
    { key: "ag_solu_of_g", label: "Ag (g) OF Liq", w: 106, agg: "sum", fmt: (v) => fmtInt(v) },
    { key: "ag_soli_solu_of_g", label: "Ag (g) OF Tot", w: 112, agg: "sum", fmt: (v) => fmtInt(v) },

    { key: "ag_solid_tail", label: "Ag (g/t) Rel Sol", w: 116, agg: "wavg_tms", fmt: (v) => fmtFixed(v, 2) },
    { key: "ag_solid_tail_g", label: "Ag (g) Rel Sol", w: 112, agg: "sum", fmt: (v) => fmtInt(v) },
    { key: "ag_solu_tail", label: "Ag (g/t) Rel Liq", w: 116, agg: "wavg_tms", fmt: (v) => fmtFixed(v, 2) },
    { key: "ag_solu_tail_g", label: "Ag (g) Rel Liq", w: 112, agg: "sum", fmt: (v) => fmtInt(v) },
    { key: "ag_soli_solu_tail", label: "Ag (g/t) Rel Tot", w: 122, agg: "wavg_tms", fmt: (v) => fmtFixed(v, 2) },
    { key: "ag_soli_solu_tail_g", label: "Ag (g) Rel Tot", w: 112, agg: "sum", fmt: (v) => fmtInt(v) },
  ];

  const end: ColDef[] = [
    { key: "au_prod", label: "Au Prod (g)", w: 104, agg: "sum", fmt: (v) => fmtInt(v) },
    { key: "au_recu", label: "Au Rec (%)", w: 96, agg: "avg", fmt: (v) => fmtPctFromFrac(v, 2) },
    { key: "ag_prod", label: "Ag Prod (g)", w: 104, agg: "sum", fmt: (v) => fmtInt(v) },
    { key: "ag_recu", label: "Ag Rec (%)", w: 96, agg: "avg", fmt: (v) => fmtPctFromFrac(v, 2) },

    { key: "nacn_ratio", label: "NaCN (kg/t)", w: 110, agg: "wavg_tms", fmt: (v) => fmtFixed(v, 2) },
    { key: "naoh_ratio", label: "NaOH (kg/t)", w: 110, agg: "wavg_tms", fmt: (v) => fmtFixed(v, 2) },
    { key: "balls_ratio", label: "Bolas (kg/t)", w: 110, agg: "wavg_tms", fmt: (v) => fmtFixed(v, 2) },
  ];

  return [...base, ...(mode === "AU" ? auBlock : agBlock), ...end];
}

function aggValue(rows: BalRow[], key: keyof BalRow, agg: Agg) {
  if (!rows.length) return null;

  const tmsList = rows.map((r) => toNum(r.tms)).filter((x): x is number => x !== null);
  const tmsSum = tmsList.reduce((a, b) => a + b, 0);

  if (agg === "sum") {
    let s = 0;
    let has = false;
    for (const r of rows) {
      const v = toNum((r as any)[key]);
      if (v === null) continue;
      s += v;
      has = true;
    }
    return has ? s : null;
  }

  if (agg === "avg") {
    let s = 0;
    let c = 0;
    for (const r of rows) {
      const v = toNum((r as any)[key]);
      if (v === null) continue;
      s += v;
      c += 1;
    }
    return c ? s / c : null;
  }

  // wavg_tms
  if (tmsSum <= 0) return null;
  let num = 0;
  let used = false;
  for (const r of rows) {
    const w = toNum(r.tms);
    const v = toNum((r as any)[key]);
    if (w === null || v === null) continue;
    num += v * w;
    used = true;
  }
  return used ? num / tmsSum : null;
}

type Group = {
  dateIso: string;
  rows: (BalRow & { _shift: string })[];
};

export default function PlantaReportsPage() {
  const [mode, setMode] = useState<"AU" | "AG">("AU");
  const [allRows, setAllRows] = useState<BalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const today = useMemo(() => isoTodayPe(), []);
  const cols = useMemo(() => buildColumns(mode), [mode]);

  // rango por defecto (se setea cuando llega data)
  const [dateFrom, setDateFrom] = useState<string>(() => monthStartIso(today));
  const [dateTo, setDateTo] = useState<string>(() => today);
  const [rangeInit, setRangeInit] = useState(false);

  // expand/collapse por día
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const r = (await apiGet(`/api/planta/balance?top=200`)) as BalResp;
      setAllRows(Array.isArray(r?.rows) ? r.rows : []);
    } catch (e: any) {
      setAllRows([]);
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando balance metalúrgico");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // set defaults según última fecha disponible en la data (una sola vez)
  useEffect(() => {
    if (rangeInit) return;
    if (!allRows.length) return;

    let maxIso = "";
    for (const r of allRows) {
      const { dateIso } = parseShiftId(r.shift_id);
      if (!dateIso) continue;
      if (!maxIso || dateIso > maxIso) maxIso = dateIso;
    }
    const end = maxIso || today;
    const start = monthStartIso(end);

    setDateTo(end);
    setDateFrom(start);

    // por defecto: contraído, solo el día más reciente abierto
    setOpenDays({ [end]: true });
    setRangeInit(true);
  }, [allRows, rangeInit, today]);

  // normaliza rango (from <= to) + clamp a hoy
  useEffect(() => {
    const max = today;
    let f = dateFrom ? dateFrom : max;
    let t = dateTo ? dateTo : max;

    if (t > max) t = max;
    if (f > max) f = max;
    if (f && t && f > t) f = t;

    if (f !== dateFrom) setDateFrom(f);
    if (t !== dateTo) setDateTo(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, today]);

  const filtered = useMemo(() => {
    const f = dateFrom || "0000-01-01";
    const t = dateTo || "9999-12-31";
    return allRows.filter((r) => {
      const { dateIso } = parseShiftId(r.shift_id);
      if (!dateIso) return false;
      return dateIso >= f && dateIso <= t;
    });
  }, [allRows, dateFrom, dateTo]);

  const groups = useMemo<Group[]>(() => {
    const m = new Map<string, (BalRow & { _shift: string })[]>();
    for (const r of filtered) {
      const { dateIso, shift } = parseShiftId(r.shift_id);
      if (!dateIso) continue;
      const arr = m.get(dateIso) ?? [];
      arr.push({ ...r, _shift: shift });
      m.set(dateIso, arr);
    }
    return Array.from(m.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // desc
      .map(([dateIso, rows]) => ({
        dateIso,
        rows: rows.sort((a, b) => String(a._shift).localeCompare(String(b._shift))),
      }));
  }, [filtered]);

  const overallTotals = useMemo(() => {
    const base = filtered;
    const obj: Record<string, any> = {};
    for (const c of cols) {
      obj[String(c.key)] = aggValue(base, c.key, c.agg);
    }
    return obj;
  }, [filtered, cols]);

  function onExpandAll() {
    const next: Record<string, boolean> = {};
    for (const g of groups) next[g.dateIso] = true;
    setOpenDays(next);
  }

  function onCollapseAll() {
    setOpenDays({});
  }

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

  const stickyFoot: React.CSSProperties = {
    position: "sticky",
    bottom: 0,
    zIndex: 6,
    background: "rgba(5, 25, 45, .98)",
    boxShadow: "0 -10px 25px rgba(0,0,0,.35)",
  };

  const cellBase: React.CSSProperties = {
    padding: "6px 8px",
    fontSize: 12,
    lineHeight: "16px",
    whiteSpace: "nowrap",
  };

  const numCell: React.CSSProperties = { ...cellBase, textAlign: "right" };

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

          <div style={{ width: 10 }} />

          <Button type="button" size="sm" variant="ghost" onClick={onExpandAll} disabled={loading || !groups.length}>
            Desglosar todo
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCollapseAll} disabled={loading || !groups.length}>
            Contraer todo
          </Button>
        </div>

        <div className="muted" style={{ fontWeight: 800, marginLeft: "auto" }}>
          Planta · Balance metalúrgico + Power BI
        </div>
      </div>

      <div className="panel-inner" style={{ padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "240px 240px 1fr", gap: 12, alignItems: "end" }}>
          <DatePicker
            label="Fecha inicio"
            valueIso={dateFrom}
            onChangeIso={(iso) => setDateFrom(iso)}
            disabled={loading}
            max={today}
          />
          <DatePicker
            label="Fecha fin"
            valueIso={dateTo}
            onChangeIso={(iso) => setDateTo(iso)}
            disabled={loading}
            max={today}
            min={dateFrom || undefined}
          />
          <div className="muted" style={{ fontWeight: 900, fontSize: 12, alignSelf: "center" }}>
            Regla:
            <span style={{ opacity: 0.9 }}>
              {" "}
              (g/t, g/l) ponderado por TMS · (g, m³, l, TMS) suma · (%) promedio simple
            </span>
          </div>
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
        {groups.length ? (
          <Table stickyHeader maxHeight={"calc(100vh - 240px)"}>
            <thead>
              <tr>
                <th
                  className="capex-th"
                  style={{
                    ...stickyHead,
                    minWidth: 120,
                    maxWidth: 120,
                    border: headerBorder,
                    borderBottom: headerBorder,
                    textAlign: "left",
                    padding: "10px 10px",
                    fontSize: 12,
                  }}
                >
                  Fecha
                </th>
                <th
                  className="capex-th"
                  style={{
                    ...stickyHead,
                    minWidth: 80,
                    maxWidth: 80,
                    border: headerBorder,
                    borderBottom: headerBorder,
                    textAlign: "left",
                    padding: "10px 10px",
                    fontSize: 12,
                  }}
                >
                  Guardia
                </th>

                {cols.map((c) => (
                  <th
                    key={String(c.key)}
                    className="capex-th"
                    style={{
                      ...stickyHead,
                      minWidth: c.w ?? 90,
                      maxWidth: c.w ?? 90,
                      border: headerBorder,
                      borderBottom: headerBorder,
                      textAlign: "center",
                      padding: "10px 6px",
                      fontSize: 12,
                    }}
                    title={c.label}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {groups.map((g) => {
                const dayOpen = !!openDays[g.dateIso];
                const dayTotals: Record<string, any> = {};
                for (const c of cols) dayTotals[String(c.key)] = aggValue(g.rows as any, c.key, c.agg);

                return (
                  <React.Fragment key={g.dateIso}>
                    <tr className="capex-tr">
                      <td
                        className="capex-td capex-td-strong"
                        style={{
                          ...cellBase,
                          fontWeight: 900,
                          background: "rgba(0,0,0,.22)",
                          borderBottom: "1px solid rgba(191, 231, 255, 0.18)",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setOpenDays((s) => ({ ...s, [g.dateIso]: !dayOpen }))}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "var(--text)",
                            cursor: "pointer",
                            fontWeight: 900,
                            padding: 0,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span style={{ opacity: 0.9 }}>{dayOpen ? "▾" : "▸"}</span>
                          <span>{fmtDateDdMm(g.dateIso)}</span>
                        </button>
                      </td>

                      <td
                        className="capex-td"
                        style={{
                          ...cellBase,
                          fontWeight: 900,
                          opacity: 0.9,
                          background: "rgba(0,0,0,.22)",
                          borderBottom: "1px solid rgba(191, 231, 255, 0.18)",
                        }}
                      >
                        Total
                      </td>

                      {cols.map((c) => {
                        const v = dayTotals[String(c.key)];
                        const text = c.fmt ? c.fmt(v) : v ?? "";
                        return (
                          <td
                            key={`day-${g.dateIso}-${String(c.key)}`}
                            className="capex-td"
                            style={{
                              ...numCell,
                              fontWeight: 900,
                              background: "rgba(0,0,0,.22)",
                              borderBottom: "1px solid rgba(191, 231, 255, 0.18)",
                            }}
                          >
                            {text}
                          </td>
                        );
                      })}
                    </tr>

                    {dayOpen
                      ? g.rows.map((r) => (
                          <tr key={String(r.shift_id || "")} className="capex-tr">
                            <td
                              className="capex-td"
                              style={{
                                ...cellBase,
                                background: "rgba(0,0,0,.10)",
                                borderBottom: "1px solid rgba(255,255,255,.06)",
                              }}
                            />
                            <td
                              className="capex-td capex-td-strong"
                              style={{
                                ...cellBase,
                                fontWeight: 900,
                                background: "rgba(0,0,0,.10)",
                                borderBottom: "1px solid rgba(255,255,255,.06)",
                              }}
                            >
                              {String((r as any)._shift || "").toUpperCase()}
                            </td>

                            {cols.map((c) => {
                              const v = (r as any)[c.key];
                              const text = c.fmt ? c.fmt(v) : v ?? "";
                              return (
                                <td
                                  key={`row-${String(r.shift_id)}-${String(c.key)}`}
                                  className="capex-td"
                                  style={{
                                    ...numCell,
                                    background: "rgba(0,0,0,.10)",
                                    borderBottom: "1px solid rgba(255,255,255,.06)",
                                  }}
                                >
                                  {text}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      : null}
                  </React.Fragment>
                );
              })}
            </tbody>

            <tfoot>
              <tr>
                <td
                  className="capex-td capex-td-strong"
                  style={{
                    ...stickyFoot,
                    ...cellBase,
                    fontWeight: 900,
                    borderTop: "1px solid rgba(191, 231, 255, 0.20)",
                  }}
                >
                  Total
                </td>
                <td
                  className="capex-td"
                  style={{
                    ...stickyFoot,
                    ...cellBase,
                    fontWeight: 900,
                    opacity: 0.9,
                    borderTop: "1px solid rgba(191, 231, 255, 0.20)",
                  }}
                >
                  —
                </td>

                {cols.map((c) => {
                  const v = overallTotals[String(c.key)];
                  const text = c.fmt ? c.fmt(v) : v ?? "";
                  return (
                    <td
                      key={`tot-${String(c.key)}`}
                      className="capex-td"
                      style={{
                        ...stickyFoot,
                        ...numCell,
                        fontWeight: 900,
                        borderTop: "1px solid rgba(191, 231, 255, 0.20)",
                      }}
                    >
                      {text}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </Table>
        ) : (
          <div className="panel-inner" style={{ padding: 12, fontWeight: 800 }}>
            {loading ? "Cargando…" : "Sin datos en el rango."}
          </div>
        )}
      </div>

      <div style={{ height: 6 }} />

      <div className="panel-inner" style={{ padding: "10px 12px" }}>
        <div style={{ fontWeight: 900 }}>Dashboard - Power BI</div>
      </div>

      <div className="panel-inner" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ position: "relative", width: "100%", height: "calc(100vh - 180px)" }}>
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
