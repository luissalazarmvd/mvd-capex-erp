// src/components/planta/BalanceTable.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";

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
  shift_comment?: any;
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

function safeDiv(a: any, b: any) {
  const na = toNum(a);
  const nb = toNum(b);
  if (na === null || nb === null || nb === 0) return null;
  return na / nb;
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

type Agg = "sum" | "wavg_tms" | "avg" | "ratio_tms_op" | "ratio_au_recu" | "ratio_ag_recu" | "none";

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
    { key: "prod_ratio", label: "Ratio (t/h)", w: 96, agg: "ratio_tms_op", fmt: (v) => fmtFixed(v, 1) },

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
    { key: "au_recu", label: "Au Rec (%)", w: 96, agg: "ratio_au_recu", fmt: (v) => fmtPctFromFrac(v, 2) },
    { key: "ag_prod", label: "Ag Prod (g)", w: 104, agg: "sum", fmt: (v) => fmtInt(v) },
    { key: "ag_recu", label: "Ag Rec (%)", w: 96, agg: "ratio_ag_recu", fmt: (v) => fmtPctFromFrac(v, 2) },

    { key: "nacn_ratio", label: "NaCN (kg/t)", w: 110, agg: "wavg_tms", fmt: (v) => fmtFixed(v, 2) },
    { key: "naoh_ratio", label: "NaOH (kg/t)", w: 110, agg: "wavg_tms", fmt: (v) => fmtFixed(v, 2) },
    { key: "balls_ratio", label: "Bolas (kg/t)", w: 110, agg: "wavg_tms", fmt: (v) => fmtFixed(v, 2) },
    { key: "shift_comment", label: "Comentario", w: 260, agg: "none", fmt: (v) => String(v ?? "") },
  ];

  return [...base, ...(mode === "AU" ? auBlock : agBlock), ...end];
}

function aggValue(rows: BalRow[], key: keyof BalRow, agg: Agg) {
  if (!rows.length) return null;
  if (agg === "none") return null;

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

  if (agg === "wavg_tms") {
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

  if (agg === "ratio_tms_op") {
    const tms = rows.reduce((acc, r) => acc + (toNum(r.tms) ?? 0), 0);
    const op = rows.reduce((acc, r) => acc + (toNum(r.operation_hr) ?? 0), 0);
    if (!op) return null;
    return tms / op;
  }

  if (agg === "ratio_au_recu") {
    const prod = rows.reduce((acc, r) => acc + (toNum(r.au_prod) ?? 0), 0);
    const feed = rows.reduce((acc, r) => acc + (toNum(r.au_feed_g) ?? 0), 0);
    if (!feed) return null;
    return prod / feed;
  }

  if (agg === "ratio_ag_recu") {
    const prod = rows.reduce((acc, r) => acc + (toNum(r.ag_prod) ?? 0), 0);
    const feed = rows.reduce((acc, r) => acc + (toNum(r.ag_feed_g) ?? 0), 0);
    if (!feed) return null;
    return prod / feed;
  }

  return null;
}

type Group = {
  dateIso: string;
  rows: (BalRow & { _shift: string })[];
};

function buildExportMatrix(args: {
  groups: Group[];
  cols: ColDef[];
  mode: "AU" | "AG";
  dateFrom: string;
  dateTo: string;
  overallTotals: Record<string, any>;
}) {
  const { groups, cols, mode, dateFrom, dateTo, overallTotals } = args;

  const headers = ["Fecha", "Guardia", ...cols.map((c) => c.label)];
  const rows: any[][] = [];
  const totalRowIdxs: number[] = [];

  for (const g of groups) {
    const dayTotals: Record<string, any> = {};
    for (const c of cols) dayTotals[String(c.key)] = aggValue(g.rows as any, c.key, c.agg);

    totalRowIdxs.push(rows.length);
    rows.push([
      fmtDateDdMm(g.dateIso),
      "Total",
      ...cols.map((c) => {
        const v = dayTotals[String(c.key)];
        return c.fmt ? c.fmt(v) : v ?? "";
      }),
    ]);

    for (const r of g.rows) {
      rows.push([
        fmtDateDdMm(g.dateIso),
        String((r as any)._shift || "").toUpperCase(),
        ...cols.map((c) => {
          const v =
            c.key === "prod_ratio"
              ? safeDiv((r as any).tms, (r as any).operation_hr)
              : c.key === "au_recu"
              ? safeDiv((r as any).au_prod, (r as any).au_feed_g)
              : c.key === "ag_recu"
              ? safeDiv((r as any).ag_prod, (r as any).ag_feed_g)
              : (r as any)[c.key];

          return c.fmt ? c.fmt(v) : v ?? "";
        }),
      ]);
    }
  }

  totalRowIdxs.push(rows.length);
  rows.push([
    "Total",
    "—",
    ...cols.map((c) => {
      const v = overallTotals[String(c.key)];
      return c.fmt ? c.fmt(v) : v ?? "";
    }),
  ]);

  const fileTag = `${mode}_${dateFrom || "inicio"}_${dateTo || "fin"}`.replaceAll("/", "-");
  const title = `MVD_Planta_Balance_${fileTag}`;

  return { headers, rows, title, totalRowIdxs };
}

function clampPdfText(v: any, maxChars: number) {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (s.length <= maxChars) return s;
  return s.slice(0, Math.max(0, maxChars - 1)).trimEnd() + "…";
}

export default function BalanceTable() {
  const [balMode, setBalMode] = useState<"AU" | "AG">("AU");
  const [allRows, setAllRows] = useState<BalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const today = useMemo(() => isoTodayPe(), []);
  const cols = useMemo(() => buildColumns(balMode), [balMode]);

  const [dateFrom, setDateFrom] = useState<string>(() => monthStartIso(today));
  const [dateTo, setDateTo] = useState<string>(() => today);
  const [rangeInit, setRangeInit] = useState(false);

  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [dateOrder, setDateOrder] = useState<"desc" | "asc">("desc");

  async function load(forceDefault = false) {
    setLoading(true);
    setMsg(null);

    try {
      const r = (await apiGet(`/api/planta/balance?top=200`)) as BalResp;
      const rows = Array.isArray(r?.rows) ? r.rows : [];
      setAllRows(rows);

      if (forceDefault) {
        let maxIso = "";
        for (const rr of rows) {
          const { dateIso } = parseShiftId(rr.shift_id);
          if (!dateIso) continue;
          if (!maxIso || dateIso > maxIso) maxIso = dateIso;
        }

        const end = maxIso || today;
        const start = monthStartIso(end);

        setDateTo(end);
        setDateFrom(start);
        setOpenDays({});
        setRangeInit(true);
      }
    } catch (e: any) {
      setAllRows([]);
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando balance metalúrgico");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(true);
  }, []);

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
    setOpenDays({});
    setRangeInit(true);
  }, [allRows, rangeInit, today]);

  useEffect(() => {
    const max = today;
    let f = dateFrom ? dateFrom : max;
    let t = dateTo ? dateTo : max;

    if (t > max) t = max;
    if (f > max) f = max;
    if (f && t && f > t) f = t;

    if (f !== dateFrom) setDateFrom(f);
    if (t !== dateTo) setDateTo(t);
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

    const entries = Array.from(m.entries()).sort((a, b) => {
      if (dateOrder === "desc") return a[0] < b[0] ? 1 : -1;
      return a[0] > b[0] ? 1 : -1;
    });

    return entries.map(([dateIso, rows]) => ({
      dateIso,
      rows: rows.sort((a, b) => String(a._shift).localeCompare(String(b._shift))),
    }));
  }, [filtered, dateOrder]);

  const overallTotals = useMemo(() => {
    const base = filtered;
    const obj: Record<string, any> = {};
    for (const c of cols) obj[String(c.key)] = aggValue(base, c.key, c.agg);
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

  function displayValueForRow(r: any, key: keyof BalRow) {
    if (key === "prod_ratio") return safeDiv(r.tms, r.operation_hr);
    if (key === "au_recu") return safeDiv(r.au_prod, r.au_feed_g);
    if (key === "ag_recu") return safeDiv(r.ag_prod, r.ag_feed_g);
    return (r as any)[key];
  }

  async function exportExcel() {
    const { headers, rows, title, totalRowIdxs } = buildExportMatrix({
      groups,
      cols,
      mode: balMode,
      dateFrom,
      dateTo,
      overallTotals,
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Balance");

    ws.addRow([title.replaceAll("_", " ")]);
    ws.mergeCells(1, 1, 1, headers.length);
    ws.getRow(1).font = { bold: true, size: 14 };

    ws.addRow([]);

    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true };

    const firstDataRow = ws.rowCount + 1;
    for (const r of rows) ws.addRow(r);

    for (const idx of totalRowIdxs) {
      const excelRowNum = firstDataRow + idx;
      const rr = ws.getRow(excelRowNum);
      rr.font = { ...(rr.font ?? {}), bold: true };
    }

    ws.columns = headers.map((h, idx) => {
      const maxLen = Math.max(
        h.length,
        ...ws
          .getColumn(idx + 1)
          .values.filter((v) => typeof v === "string" || typeof v === "number")
          .map((v: any) => String(v).length)
      );
      return { width: Math.min(48, Math.max(10, maxLen + 2)) };
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    const fileTag = `${balMode}_${dateFrom || "inicio"}_${dateTo || "fin"}`.replaceAll("/", "-");
    const title = `MVD_Planta_Balance_${fileTag}`;

    const headers = ["Fecha", ...cols.map((c) => c.label)];
    const body: any[][] = [];

    const commentKey = String(cols.find((c) => c.key === "shift_comment")?.key ?? "shift_comment");

    for (const g of groups) {
      const dayTotals: Record<string, any> = {};
      for (const c of cols) dayTotals[String(c.key)] = aggValue(g.rows as any, c.key, c.agg);

      const commentParts: string[] = [];
      for (const rr of g.rows) {
        const sh = String((rr as any)._shift ?? "").toUpperCase();
        const cm = String((rr as any)[commentKey] ?? "").replace(/\s+/g, " ").trim();
        if (!cm) continue;
        commentParts.push(`${sh}: ${cm}`);
      }
      const dayComment = commentParts.join("\n");

      body.push([
        fmtDateDdMm(g.dateIso),
        ...cols.map((c) => {
          const v = c.key === "shift_comment" ? dayComment : dayTotals[String(c.key)];
          return c.fmt ? c.fmt(v) : v ?? "";
        }),
      ]);
    }

    const margin = 24;
    const isoRatio = 595.28 / 841.89;

    const fontScale = 1.67;

    const baseFont = Math.round(9 * fontScale);
    const headFont = Math.round(9 * fontScale);
    const titleFont = Math.round(12 * fontScale);

    const pad = Math.max(3, Math.round(4 * fontScale));
    const extraPxPerSide = Math.max(6, Math.round(8 * fontScale));

    const meas = new jsPDF({ orientation: "landscape", unit: "pt", format: [200, 200] });
    meas.setFont("helvetica", "normal");
    meas.setFontSize(headFont);

    const dateTextW = meas.getTextWidth("15/02/2026");

    const colWidths: number[] = headers.map((h, idx) => {
      const wText = meas.getTextWidth(String(h ?? ""));
      if (idx === 0) return Math.max(wText, dateTextW) + extraPxPerSide * 2;
      return Math.ceil(wText + extraPxPerSide * 2);
    });

    const commentColIdx = colWidths.length - 1;
    colWidths[commentColIdx] = Math.max(colWidths[commentColIdx], 260);

    const totalW = colWidths.reduce((a, b) => a + b, 0);
    const pageW = totalW + margin * 2;
    const pageH = Math.round(pageW * isoRatio);

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: [pageW, pageH] });

    doc.setFontSize(titleFont);
    doc.text(title.replaceAll("_", " "), margin, 18);

    const colStyles: Record<number, any> = {};
    for (let i = 0; i < colWidths.length; i++) colStyles[i] = { cellWidth: colWidths[i] };

    const commentCellW = Math.max(40, colWidths[commentColIdx] - pad * 2);

    autoTable(doc, {
      head: [headers],
      body,
      startY: 28,
      theme: "plain",
      tableWidth: totalW,
      margin: { left: margin, right: margin, top: margin, bottom: margin },
      styles: {
        fontSize: baseFont,
        cellPadding: pad,
        overflow: "linebreak",
        textColor: [0, 0, 0],
        fillColor: [255, 255, 255],
        lineWidth: 0.25,
        lineColor: [210, 210, 210],
        valign: "top",
      },
      headStyles: {
        fillColor: [0, 103, 172],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: headFont,
        halign: "center",
        lineWidth: 0.25,
        lineColor: [0, 103, 172],
      },
      columnStyles: colStyles,
      didParseCell: (data) => {
        if (data.section === "head") {
          data.cell.styles.halign = data.column.index === 0 ? "left" : "center";
          return;
        }

        if (data.section === "body") {
          if (data.column.index === 0) {
            data.cell.styles.halign = "left";
            data.cell.styles.overflow = "hidden";
            (data.cell.styles as any).whiteSpace = "nowrap";
          } else if (data.column.index === commentColIdx) {
            data.cell.styles.halign = "left";
          } else {
            data.cell.styles.halign = "right";
          }

          if (data.column.index === commentColIdx) {
            const raw = String((data.cell.raw ?? "") as any).replace(/\s+\n/g, "\n").trim();
            if (!raw) {
              data.cell.text = [""];
              return;
            }
            const lines = doc.splitTextToSize(raw, commentCellW);
            data.cell.text = Array.isArray(lines) ? lines : [String(lines)];
          }
        }
      },
    });

    doc.save(`${title}.pdf`);
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

  const commentCell: React.CSSProperties = {
    ...cellBase,
    textAlign: "left",
    verticalAlign: "top",
    whiteSpace: "normal",
  };

  const W_FECHA = 120;
  const W_GUARDIA = 80;

  const stickyLeftFechaHead: React.CSSProperties = {
    ...stickyHead,
    left: 0,
    zIndex: 12,
  };

  const stickyLeftGuardiaHead: React.CSSProperties = {
    ...stickyHead,
    left: W_FECHA,
    zIndex: 11,
  };

  const stickyLeftFechaCell = (bg: string, z = 5): React.CSSProperties => ({
    position: "sticky",
    left: 0,
    zIndex: z,
    background: bg,
  });

  const stickyLeftGuardiaCell = (bg: string, z = 5): React.CSSProperties => ({
    position: "sticky",
    left: W_FECHA,
    zIndex: z,
    background: bg,
    boxShadow: "10px 0 16px rgba(0,0,0,.25)",
  });

  const stickyLeftFechaFoot: React.CSSProperties = {
    ...stickyFoot,
    position: "sticky",
    left: 0,
    zIndex: 12,
  };

  const stickyLeftGuardiaFoot: React.CSSProperties = {
    ...stickyFoot,
    position: "sticky",
    left: W_FECHA,
    zIndex: 11,
  };

  const dateSortIcon = dateOrder === "desc" ? "↓" : "↑";

  return (
    <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
      <div className="panel-inner" style={{ padding: 12, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Reportes</div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 8 }}>
          <Button
            type="button"
            size="sm"
            variant={balMode === "AU" ? "primary" : "ghost"}
            onClick={() => setBalMode("AU")}
            disabled={loading}
          >
            Au
          </Button>
          <Button
            type="button"
            size="sm"
            variant={balMode === "AG" ? "primary" : "ghost"}
            onClick={() => setBalMode("AG")}
            disabled={loading}
          >
            Ag
          </Button>

          <Button type="button" size="sm" variant="default" onClick={() => load(true)} disabled={loading}>
            {loading ? "Cargando…" : "Refrescar"}
          </Button>

          <div style={{ width: 10 }} />

          <Button type="button" size="sm" variant="ghost" onClick={onExpandAll} disabled={loading || !groups.length}>
            Desglosar todo
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCollapseAll} disabled={loading || !groups.length}>
            Contraer todo
          </Button>

          <Button type="button" size="sm" variant="ghost" onClick={exportExcel} disabled={loading || !groups.length}>
            Exportar Excel
          </Button>

          <Button type="button" size="sm" variant="ghost" onClick={exportPdf} disabled={loading || !groups.length}>
            Exportar PDF
          </Button>
        </div>

        <div className="muted" style={{ fontWeight: 800, marginLeft: "auto" }}>
          Planta · Balance metalúrgico + Power BI
        </div>
      </div>

      <div className="panel-inner" style={{ padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "240px 240px", gap: 12, alignItems: "end" }}>
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
                    ...stickyLeftFechaHead,
                    minWidth: W_FECHA,
                    maxWidth: W_FECHA,
                    border: headerBorder,
                    borderBottom: headerBorder,
                    textAlign: "left",
                    padding: "10px 10px",
                    fontSize: 12,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setDateOrder((s) => (s === "desc" ? "asc" : "desc"))}
                    title="Cambiar orden (fecha)"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      border: "none",
                      background: "transparent",
                      color: "var(--text)",
                      cursor: "pointer",
                      fontWeight: 900,
                      padding: 0,
                    }}
                  >
                    <span>Fecha</span>
                    <span style={{ opacity: 0.9 }}>{dateSortIcon}</span>
                  </button>
                </th>

                <th
                  className="capex-th"
                  style={{
                    ...stickyLeftGuardiaHead,
                    minWidth: W_GUARDIA,
                    maxWidth: W_GUARDIA,
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
                      textAlign: c.key === "shift_comment" ? "left" : "center",
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

                const dayBg = "rgba(0,0,0,.22)";
                const dayStickyBg = "rgba(5, 25, 45, .96)";
                const rowStickyBg = "rgba(5, 25, 45, .92)";
                const rowBg = "rgba(0,0,0,.10)";
                const dayBorder = "1px solid rgba(191, 231, 255, 0.18)";
                const rowBorder = "1px solid rgba(255,255,255,.06)";

                return (
                  <React.Fragment key={g.dateIso}>
                    <tr className="capex-tr">
                      <td
                        className="capex-td capex-td-strong"
                        style={{
                          ...cellBase,
                          ...stickyLeftFechaCell(dayStickyBg, 7),
                          fontWeight: 900,
                          borderBottom: dayBorder,
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
                          ...stickyLeftGuardiaCell(dayStickyBg, 7),
                          fontWeight: 900,
                          opacity: 0.9,
                          borderBottom: dayBorder,
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
                              ...(c.key === "shift_comment" ? commentCell : numCell),
                              fontWeight: 900,
                              background: dayBg,
                              borderBottom: dayBorder,
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
                                ...stickyLeftFechaCell(rowStickyBg, 5),
                                borderBottom: rowBorder,
                              }}
                            />
                            <td
                              className="capex-td capex-td-strong"
                              style={{
                                ...cellBase,
                                ...stickyLeftGuardiaCell(rowStickyBg, 5),
                                fontWeight: 900,
                                borderBottom: rowBorder,
                              }}
                            >
                              {String((r as any)._shift || "").toUpperCase()}
                            </td>

                            {cols.map((c) => {
                              const v = displayValueForRow(r, c.key);
                              const text = c.fmt ? c.fmt(v) : v ?? "";
                              return (
                                <td
                                  key={`row-${String(r.shift_id)}-${String(c.key)}`}
                                  className="capex-td"
                                  style={{
                                    ...(c.key === "shift_comment" ? commentCell : numCell),
                                    background: rowBg,
                                    borderBottom: rowBorder,
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
                    ...stickyLeftFechaFoot,
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
                    ...stickyLeftGuardiaFoot,
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
    </div>
  );
}