// src/components/planta/CarbonTableSum.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";
import { apiGet } from "../../lib/apiClient";
import { jsPDF } from "jspdf";
import ExcelJS from "exceljs";
import html2canvas from "html2canvas";

type Top5DRow = { d: string; tank_date: string };

export type TankSumRow = {
  tank: string;
  entry_date: any;
  campaign?: any;
  campaign_id?: any;
  carbon_kg: any;
  eff_pct: any;
  cycles: any;
  comment?: any;
  tank_comment?: any;

  au_d1?: any;
  au_d2?: any;
  au_d3?: any;
  au_d4?: any;
  au_d5?: any;

  ag_d1?: any;
  ag_d2?: any;
  ag_d3?: any;
  ag_d4?: any;
  ag_d5?: any;

  variation?: any;
  total_gr?: any;
};

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

function fmtInt(v: any) {
  const n = toNum(v);
  if (n === null) return "";
  return Math.round(n).toLocaleString("en-US");
}

function fmtDateDdMm(iso: string) {
  if (!iso || iso.length !== 10) return iso || "";
  const dd = iso.slice(8, 10);
  const mm = iso.slice(5, 7);
  const yy = iso.slice(0, 4);
  return `${dd}/${mm}/${yy}`;
}

function pickIsoDateOnly(v: any): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m?.[1]) return m[1];
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function fmtDateAnyToDdMm(v: any) {
  const iso = pickIsoDateOnly(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return fmtDateDdMm(iso);
  return iso || "";
}

function tankOrderKey(t: string) {
  const m = String(t || "")
    .toUpperCase()
    .match(/^TK(\d{1,2})$/);
  const n = m ? Number(m[1]) : 999;
  return Number.isFinite(n) ? n : 999;
}

type Mode = "AU" | "AG";

type NormRow = {
  tank: string;
  entry_date: any;
  campaign: any;
  carbon_kg: any;
  eff_pct: any;
  cycles: any;
  tank_comment: any;

  au_last: any;
  ag_last: any;

  inc_au: any;
  inc_ag: any;

  days_since: any;
};

function ymdToDate(iso: string) {
  const m = String(iso || "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
  return new Date(y, mo - 1, d);
}

function daysDiffFromTodayPe(iso: string) {
  const dt = ymdToDate(iso);
  if (!dt) return null;

  const now = new Date();
  const peNow = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const pe0 = new Date(peNow.getFullYear(), peNow.getMonth(), peNow.getDate());
  const d0 = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());

  const ms = pe0.getTime() - d0.getTime();
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  return Number.isFinite(days) ? days : null;
}

function normalizeRow(r: TankSumRow): NormRow {
  const campaign = r.campaign ?? r.campaign_id ?? null;
  const tank_comment = r.tank_comment ?? r.comment ?? null;

  const au_last = r.au_d1;
  const ag_last = r.ag_d1;

  const inc_au = r.variation ?? null;
  const inc_ag = (r as any).variation_ag ?? null;

  const entryIso = pickIsoDateOnly(r.entry_date);
  const days_since = /^\d{4}-\d{2}-\d{2}$/.test(entryIso) ? daysDiffFromTodayPe(entryIso) : null;

  return {
    tank: r.tank,
    entry_date: r.entry_date,
    campaign,
    carbon_kg: r.carbon_kg,
    eff_pct: r.eff_pct,
    cycles: r.cycles,
    tank_comment,

    au_last,
    ag_last,
    inc_au,
    inc_ag,

    days_since,
  };
}

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function hexToARGB(hex: string) {
  const h = hex.replace("#", "").trim();
  if (h.length === 6) return ("FF" + h).toUpperCase();
  return h.toUpperCase();
}

function setCellBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin", color: { argb: "33BFE7FF" } },
    left: { style: "thin", color: { argb: "33BFE7FF" } },
    bottom: { style: "thin", color: { argb: "33BFE7FF" } },
    right: { style: "thin", color: { argb: "33BFE7FF" } },
  };
}

function setFill(cell: ExcelJS.Cell, cssColor: string) {
  let hex = "#0A2E48";
  const s = String(cssColor || "").trim();

  if (s.startsWith("#")) {
    hex = s;
  } else {
    const m = s.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    if (m) hex = rgbToHex(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  const argb = hexToARGB(hex);
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

export default function CarbonTable(props: {
  tankMode: Mode;
  setTankMode: (m: Mode) => void;
  tankLoading: boolean;
  onRefresh: (which: Mode) => void;
  tankMsg?: string | null;

  tankRowsAu: TankSumRow[];
  tankRowsAg: TankSumRow[];
}) {
  const { tankMode, setTankMode, tankLoading, onRefresh, tankMsg, tankRowsAu, tankRowsAg } = props;
  const tableWrapRef = React.useRef<HTMLDivElement | null>(null);

  const headerBg = "rgb(6, 36, 58)";
  const headerBorder = "1px solid rgba(191, 231, 255, 0.26)";
  const gridV = "2px solid rgba(191, 231, 255, 0.16)";
  const gridH = "2px solid rgba(191, 231, 255, 0.10)";
  const headerShadow = "0 8px 18px rgba(0,0,0,.18)";

  const stickyHead: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 8,
    background: headerBg,
    boxShadow: headerShadow,
  };

  const cellBase: React.CSSProperties = {
    padding: "5px 6px",
    fontSize: 12,
    lineHeight: "14px",
    whiteSpace: "nowrap",
  };

  const numCell: React.CSSProperties = { ...cellBase, textAlign: "right" };

  const upGreen = "#00965E";
  const downRed = "#b23934";

  const [top5dRows, setTop5dRows] = useState<Top5DRow[]>([]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const r = await apiGet("/api/planta/carbones/top5d");
        const rows = Array.isArray(r?.rows) ? (r.rows as Top5DRow[]) : [];
        if (mounted) setTop5dRows(rows);
      } catch {
        if (mounted) setTop5dRows([]);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const tankDatesLabels = useMemo(() => {
    const map = new Map<string, string>();

    for (const r of Array.isArray(top5dRows) ? top5dRows : []) {
      const key = String(r?.d || "").trim().toUpperCase();
      const iso = pickIsoDateOnly(r?.tank_date);
      if (/^D[1-5]$/.test(key) && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        map.set(key, fmtDateDdMm(iso));
      }
    }

    return {
      d1: map.get("D1") ?? "D1",
    };
  }, [top5dRows]);

  const mergedRows = useMemo(() => {
    const au = Array.isArray(tankRowsAu) ? tankRowsAu : [];
    const ag = Array.isArray(tankRowsAg) ? tankRowsAg : [];

    const byKey = new Map<string, { au?: TankSumRow; ag?: TankSumRow }>();

    const put = (arr: TankSumRow[], which: "au" | "ag") => {
      for (const r of arr) {
        const tank = String(r?.tank || "").trim().toUpperCase();
        const entryIso = pickIsoDateOnly(r?.entry_date);
        if (!tank || !entryIso) continue;
        const key = `${tank}|${entryIso}`;
        if (!byKey.has(key)) byKey.set(key, {});
        (byKey.get(key) as any)[which] = r;
      }
    };

    put(au, "au");
    put(ag, "ag");

    const out: NormRow[] = [];
    for (const [key, v] of byKey.entries()) {
      const base = v.au ?? v.ag;
      if (!base) continue;

      const n = normalizeRow(base);

      const auLast = v.au ? v.au.au_d1 : null;
      const agLast = v.ag ? v.ag.ag_d1 : null;

      const incAu = v.au ? v.au.variation ?? null : null;
      const incAg = (v.ag as any)?.variation ?? (v.ag as any)?.variation_ag ?? null;

      out.push({
        ...n,
        au_last: auLast,
        ag_last: agLast,
        inc_au: incAu,
        inc_ag: incAg,
      });
    }

    out.sort((a, b) => {
      const ta = tankOrderKey(String(a.tank || ""));
      const tb = tankOrderKey(String(b.tank || ""));
      if (ta !== tb) return ta - tb;

      const ea = pickIsoDateOnly(a.entry_date);
      const eb = pickIsoDateOnly(b.entry_date);
      if (ea !== eb) return ea < eb ? 1 : -1;

      const aHas = String(a.campaign ?? "").trim().length > 0 ? 1 : 0;
      const bHas = String(b.campaign ?? "").trim().length > 0 ? 1 : 0;
      if (aHas !== bHas) return aHas - bHas;

      const ca = String(a.campaign ?? "");
      const cb = String(b.campaign ?? "");
      return ca.localeCompare(cb);
    });

    return out;
  }, [tankRowsAu, tankRowsAg]);

  function varStyle(v: any): React.CSSProperties {
    const n = toNum(v);
    if (n === null) return {};
    if (n > 0) return { background: upGreen, color: "white", fontWeight: 900 };
    if (n < 0) return { background: downRed, color: "white", fontWeight: 900 };
    return {};
  }

  function totalGrStyle(v: any): React.CSSProperties {
    const n = toNum(v);
    if (n === null) return {};
    if (n > 0) return { background: upGreen, color: "white", fontWeight: 900 };
    if (n < 0) return { background: downRed, color: "white", fontWeight: 900 };
    return {};
  }

  function isCampaignPresent(v: any) {
    return String(v ?? "").trim().length > 0;
  }

  async function exportExcelTanks() {
    const title = `MVD_Planta_Tanques_SUM_${(tankDatesLabels.d1 || "D1").replaceAll("/", "-")}`;

    const headers = [
      "Incremento Au",
      "Ley Au",
      "Incremento Ag",
      "Ley Ag",
      "Campaña",
      "Carbón (kg)",
      "Ef. %",
      "Días",
      "# Vueltas",
      "# Tanque",
      "Fecha de Ingreso",
      "Comentario",
    ];

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Tanques");

    ws.addRow([title.replaceAll("_", " ")]);
    ws.mergeCells(1, 1, 1, headers.length);
    ws.getRow(1).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).alignment = { vertical: "middle", horizontal: "left" };
    ws.getRow(1).height = 22;
    setFill(ws.getCell(1, 1), "#06243A");

    ws.addRow([]);

    const headerRow = ws.addRow(headers);
    headerRow.height = 20;

    for (let c = 1; c <= headers.length; c++) {
      const cell = headerRow.getCell(c);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", horizontal: c === 5 || c === 10 || c === 11 || c === 12 ? "left" : "right" };
      setFill(cell, "#06243A");
      setCellBorder(cell);
    }

    for (const r of mergedRows) {
      const rowVals = [
        toNum(r.inc_au) ?? "",
        toNum(r.au_last) ?? "",
        toNum(r.inc_ag) ?? "",
        toNum(r.ag_last) ?? "",
        isCampaignPresent(r.campaign) ? String(r.campaign || "").trim() : "",
        isCampaignPresent(r.campaign) ? toNum(r.carbon_kg) ?? "" : "",
        isCampaignPresent(r.campaign) ? (toNum(r.eff_pct) === null ? "" : toNum(r.eff_pct)! * 100) : "",
        toNum(r.days_since) ?? "",
        isCampaignPresent(r.campaign) ? toNum(r.cycles) ?? "" : "",
        String(r.tank || "").toUpperCase(),
        fmtDateAnyToDdMm(r.entry_date),
        String(r.tank_comment ?? "").trim(),
      ];

      const rr = ws.addRow(rowVals);
      rr.height = 18;

      for (let c = 1; c <= headers.length; c++) {
        const cell = rr.getCell(c);
        cell.alignment = { vertical: "middle", horizontal: c === 5 || c === 10 || c === 11 || c === 12 ? "left" : "right" };
        cell.font = { bold: c === 10 || c === 11 || c === 5 || c === 12, color: { argb: "FFFFFFFF" } };
        setFill(cell, "#0A2E48");
        setCellBorder(cell);

        if (c === 1 || c === 3) cell.numFmt = "0.000";
        if (c === 2 || c === 4) cell.numFmt = "0.000";
        if (c === 6) cell.numFmt = "#,##0.00";
        if (c === 7) cell.numFmt = "0.0";
        if (c === 8) cell.numFmt = "0";
        if (c === 9) cell.numFmt = "0";

        if (c === 1) {
          const n = toNum(r.inc_au);
          if (n !== null) {
            setFill(cell, n >= 0 ? upGreen : downRed);
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
          }
        }

        if (c === 3) {
          const n = toNum(r.inc_ag);
          if (n !== null) {
            setFill(cell, n >= 0 ? upGreen : downRed);
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
          }
        }
      }
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
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportPdfTanks() {
    if (!tableWrapRef.current) return;

    const src = tableWrapRef.current;

    const clone = src.cloneNode(true) as HTMLElement;
    clone.style.maxHeight = "none";
    clone.style.overflow = "visible";
    clone.style.width = `${src.scrollWidth}px`;

    const wrappers = clone.querySelectorAll<HTMLElement>("[style*='max-height'],[style*='overflow']");
    wrappers.forEach((el) => {
      if (String(el.style.maxHeight || "").length) el.style.maxHeight = "none";
      if (String(el.style.overflow || "").length) el.style.overflow = "visible";
    });

    const holder = document.createElement("div");
    holder.style.position = "fixed";
    holder.style.left = "-100000px";
    holder.style.top = "0";
    holder.style.background = "#06243A";
    holder.appendChild(clone);
    document.body.appendChild(holder);

    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#06243A",
      windowWidth: clone.scrollWidth,
      windowHeight: clone.scrollHeight,
    });

    document.body.removeChild(holder);

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 18;

    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;

    const scale = usableW / canvas.width;
    const pageCanvasPxH = Math.floor(usableH / scale);

    let yPx = 0;
    let page = 0;

    while (yPx < canvas.height) {
      page++;

      const sliceH = Math.min(pageCanvasPxH, canvas.height - yPx);

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceH;

      const ctx = pageCanvas.getContext("2d");
      if (!ctx) break;

      ctx.drawImage(canvas, 0, yPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

      const imgData = pageCanvas.toDataURL("image/png");

      if (page > 1) doc.addPage();
      doc.addImage(imgData, "PNG", margin, margin, usableW, sliceH * scale);

      yPx += sliceH;
    }

    const title = `MVD_Planta_Tanques_SUM_${(tankDatesLabels.d1 || "D1").replaceAll("/", "-")}`;
    doc.save(`${title}.pdf`);
  }

  return (
    <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
      <div className="panel-inner" style={{ padding: "10px 12px", display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Resumen por tanques</div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 8 }}>
          <Button
            type="button"
            size="sm"
            variant={tankMode === "AU" ? "primary" : "ghost"}
            onClick={() => setTankMode("AU")}
            disabled={tankLoading}
          >
            Au
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tankMode === "AG" ? "primary" : "ghost"}
            onClick={() => setTankMode("AG")}
            disabled={tankLoading}
          >
            Ag
          </Button>

          <Button type="button" size="sm" variant="default" onClick={() => onRefresh(tankMode)} disabled={tankLoading}>
            {tankLoading ? "Cargando…" : "Refrescar"}
          </Button>
          <div style={{ width: 10 }} />

          <Button type="button" size="sm" variant="ghost" onClick={exportExcelTanks} disabled={tankLoading || !mergedRows.length}>
            Exportar Excel
          </Button>

          <Button type="button" size="sm" variant="ghost" onClick={exportPdfTanks} disabled={tankLoading || !mergedRows.length}>
            Exportar PDF
          </Button>
        </div>
      </div>

      {tankMsg ? (
        <div
          className="panel-inner"
          style={{
            padding: 10,
            border: "1px solid rgba(255,80,80,.45)",
            background: "rgba(255,80,80,.10)",
            fontWeight: 800,
          }}
        >
          {tankMsg}
        </div>
      ) : null}

      <div ref={tableWrapRef} className="panel-inner" style={{ padding: 0, overflow: "hidden" }}>
        <Table stickyHeader maxHeight={"calc(100vh - 260px)"}>
          <thead>
            <tr>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "8px 8px", fontSize: 12, minWidth: 110 }}>
                Incremento Au
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "8px 8px", fontSize: 12, minWidth: 82 }}>
                Ley Au
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "8px 8px", fontSize: 12, minWidth: 110 }}>
                Incremento Ag
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "8px 8px", fontSize: 12, minWidth: 82 }}>
                Ley Ag
              </th>

              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "left", padding: "8px 8px", fontSize: 12, minWidth: 92 }}>
                Campaña
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "8px 8px", fontSize: 12, minWidth: 110 }}>
                Carbón (kg)
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "8px 8px", fontSize: 12, minWidth: 90 }}>
                Ef. %
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "8px 8px", fontSize: 12, minWidth: 88 }}>
                Días
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "8px 8px", fontSize: 12, minWidth: 72 }}>
                # Vueltas
              </th>

              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "left", padding: "8px 8px", fontSize: 12, minWidth: 58 }}>
                # Tanque
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "left", padding: "8px 8px", fontSize: 12, minWidth: 108 }}>
                Fecha de Ingreso
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "left", padding: "8px 8px", fontSize: 12, minWidth: 160 }}>
                Comentario
              </th>
            </tr>
          </thead>

          <tbody>
            {mergedRows.length ? (
              mergedRows.map((r, idx) => {
                const rowBorder = gridH;
                const rowBg = "rgba(0,0,0,.10)";
                const hasCampaign = isCampaignPresent(r.campaign);
                const comment = String(r.tank_comment ?? "").trim();

                return (
                  <tr key={`${String(r.tank || "").toUpperCase()}|${pickIsoDateOnly(r.entry_date)}|${idx}`} className="capex-tr">
                    <td className="capex-td" style={{ ...numCell, borderTop: rowBorder, borderBottom: rowBorder, borderRight: gridV, ...(varStyle(r.inc_au) as any) }}>
                      {fmtFixed(r.inc_au, 3)}
                    </td>
                    <td className="capex-td" style={{ ...numCell, borderTop: rowBorder, borderBottom: rowBorder, borderRight: gridV, background: rowBg, fontWeight: 900 }}>
                      {fmtFixed(r.au_last, 3)}
                    </td>
                    <td className="capex-td" style={{ ...numCell, borderTop: rowBorder, borderBottom: rowBorder, borderRight: gridV, ...(varStyle(r.inc_ag) as any) }}>
                      {fmtFixed(r.inc_ag, 3)}
                    </td>
                    <td className="capex-td" style={{ ...numCell, borderTop: rowBorder, borderBottom: rowBorder, borderRight: gridV, background: rowBg, fontWeight: 900 }}>
                      {fmtFixed(r.ag_last, 3)}
                    </td>

                    <td className="capex-td" style={{ ...cellBase, fontWeight: 900, borderTop: rowBorder, borderBottom: rowBorder, borderRight: gridV, background: rowBg }}>
                      {hasCampaign ? String(r.campaign || "").trim() : ""}
                    </td>

                    <td className="capex-td" style={{ ...numCell, borderTop: rowBorder, borderBottom: rowBorder, borderRight: gridV, background: rowBg }}>
                      {hasCampaign ? fmtFixed(r.carbon_kg, 2) : ""}
                    </td>

                    <td className="capex-td" style={{ ...numCell, borderTop: rowBorder, borderBottom: rowBorder, borderRight: gridV, background: rowBg }}>
                      {hasCampaign ? (toNum(r.eff_pct) === null ? "" : fmtFixed(toNum(r.eff_pct)! * 100, 1)) : ""}
                    </td>

                    <td className="capex-td" style={{ ...numCell, borderTop: rowBorder, borderBottom: rowBorder, borderRight: gridV, background: rowBg, fontWeight: 900 }}>
                      {r.days_since === null ? "" : fmtInt(r.days_since)}
                    </td>

                    <td className="capex-td" style={{ ...numCell, borderTop: rowBorder, borderBottom: rowBorder, borderRight: gridV, background: rowBg }}>
                      {hasCampaign ? fmtInt(r.cycles) : ""}
                    </td>

                    <td className="capex-td capex-td-strong" style={{ ...cellBase, borderTop: rowBorder, fontWeight: 900, borderBottom: rowBorder, borderRight: gridV, background: rowBg }}>
                      {String(r.tank || "").toUpperCase()}
                    </td>

                    <td className="capex-td" style={{ ...cellBase, fontWeight: 900, borderTop: rowBorder, borderBottom: rowBorder, borderRight: gridV, background: rowBg }}>
                      {fmtDateAnyToDdMm(r.entry_date)}
                    </td>

                    <td
                      className="capex-td"
                      style={{
                        ...cellBase,
                        fontWeight: 900,
                        borderTop: rowBorder,
                        borderBottom: rowBorder,
                        borderRight: gridV,
                        background: rowBg,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 320,
                      }}
                      title={comment}
                    >
                      {comment}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr className="capex-tr">
                <td className="capex-td" style={{ ...cellBase, fontWeight: 900 }} colSpan={12}>
                  {tankLoading ? "Cargando…" : "Sin datos."}
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
}