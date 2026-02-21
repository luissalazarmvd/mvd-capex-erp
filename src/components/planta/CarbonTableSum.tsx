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

function isCampaignPresent(v: any) {
  return String(v ?? "").trim().length > 0;
}

function campaignKey(r: TankSumRow) {
  return String((r as any)?.campaign ?? (r as any)?.campaign_id ?? "")
    .trim()
    .toUpperCase();
}

function commentPick(r: TankSumRow) {
  return String((r as any)?.tank_comment ?? (r as any)?.comment ?? "").trim();
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

type Mode = "AU" | "AG";

type Group = {
  key: string;
  tank: string;
  entryIso: string;
  showRows: TankSumRow[];
  auAssay: TankSumRow | null;
  agAssay: TankSumRow | null;
  commentSpan: string;
  days_since: number | null;
};

export default function CarbonTableSum(props: {
  tankMode: Mode;
  setTankMode: (m: Mode) => void;
  tankLoading: boolean;
  onRefresh: (which: Mode) => void;
  tankMsg?: string | null;
  tankRowsAu: TankSumRow[];
  tankRowsAg: TankSumRow[];
}) {
  const { tankLoading, onRefresh, tankMsg, tankRowsAu, tankRowsAg, tankMode } = props;

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
      if (/^D[1-5]$/.test(key) && /^\d{4}-\d{2}-\d{2}$/.test(iso)) map.set(key, fmtDateDdMm(iso));
    }
    return {
      d1: map.get("D1") ?? "D1",
      d2: map.get("D2") ?? "D2",
      d3: map.get("D3") ?? "D3",
      d4: map.get("D4") ?? "D4",
      d5: map.get("D5") ?? "D5",
    };
  }, [top5dRows]);

  const tankGroups = useMemo(() => {
    const au = Array.isArray(tankRowsAu) ? tankRowsAu : [];
    const ag = Array.isArray(tankRowsAg) ? tankRowsAg : [];

    const auByKey = new Map<string, TankSumRow[]>();
    const agByKey = new Map<string, TankSumRow[]>();

    const put = (m: Map<string, TankSumRow[]>, r: TankSumRow) => {
      const tank = String(r?.tank || "").trim().toUpperCase();
      const entryIso = pickIsoDateOnly(r?.entry_date);
      if (!tank || !entryIso) return;
      const key = `${tank}|${entryIso}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
    };

    for (const r of au) put(auByKey, r);
    for (const r of ag) put(agByKey, r);

    const keys = new Set<string>([...auByKey.keys(), ...agByKey.keys()]);
    const out: Group[] = [];

    for (const key of keys) {
      const [tank, entryIso] = key.split("|");
      const auRows = auByKey.get(key) || [];
      const agRows = agByKey.get(key) || [];

      const auCampaignRows = auRows.filter((x) => isCampaignPresent((x as any).campaign ?? (x as any).campaign_id));
      const agCampaignRows = agRows.filter((x) => isCampaignPresent((x as any).campaign ?? (x as any).campaign_id));

      const baseRows = auCampaignRows.length
        ? auCampaignRows
        : agCampaignRows.length
        ? agCampaignRows
        : auRows.length
        ? [auRows[0]]
        : agRows.length
        ? [agRows[0]]
        : [];

      const showRows = baseRows.slice();
      showRows.sort((a, b) => campaignKey(a).localeCompare(campaignKey(b)));

      const auAssay = auRows.find((x) => isCampaignPresent((x as any).campaign ?? (x as any).campaign_id)) ?? auRows[0] ?? null;
      const agAssay = agRows.find((x) => isCampaignPresent((x as any).campaign ?? (x as any).campaign_id)) ?? agRows[0] ?? null;

      const commentSpan = String(
        auRows.find((x) => isCampaignPresent((x as any).campaign ?? (x as any).campaign_id) && commentPick(x))?.tank_comment ??
          auRows.find((x) => commentPick(x))?.tank_comment ??
          agRows.find((x) => isCampaignPresent((x as any).campaign ?? (x as any).campaign_id) && commentPick(x))?.tank_comment ??
          agRows.find((x) => commentPick(x))?.tank_comment ??
          ""
      ).trim();

      const days_since = /^\d{4}-\d{2}-\d{2}$/.test(entryIso) ? daysDiffFromTodayPe(entryIso) : null;

      out.push({ key, tank, entryIso, showRows, auAssay, agAssay, commentSpan, days_since });
    }

    out.sort((a, b) => {
      const ta = tankOrderKey(a.tank);
      const tb = tankOrderKey(b.tank);
      if (ta !== tb) return ta - tb;
      if (a.entryIso !== b.entryIso) return a.entryIso < b.entryIso ? 1 : -1;
      return a.key.localeCompare(b.key);
    });

    return out;
  }, [tankRowsAu, tankRowsAg]);

  function totalGrStyle(v: any): React.CSSProperties {
    const n = toNum(v);
    if (n === null) return {};
    if (n > 0) return { background: upGreen, color: "white", fontWeight: 900 };
    if (n < 0) return { background: downRed, color: "white", fontWeight: 900 };
    return {};
  }

  function varStyle(v: any): React.CSSProperties {
    const n = toNum(v);
    if (n === null) return {};
    if (n > 0) return { background: upGreen, color: "white", fontWeight: 900 };
    if (n < 0) return { background: downRed, color: "white", fontWeight: 900 };
    return {};
  }

  async function exportExcelTanks() {
    const title = `MVD_Planta_Tanques_SUM_${(tankDatesLabels.d1 || "D1").replaceAll("/", "-")}`;

    const headers = [
      "# Tanque",
      "Fecha de Ingreso",
      "Campaña",
      "Incremento Au",
      "Ley Au",
      "Incremento Ag",
      "Ley Ag",
      "Carbón (kg)",
      "Ef. %",
      "Días",
      "# Vueltas",
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
      cell.alignment = { vertical: "middle", horizontal: c <= 3 || c === 12 ? "left" : "right" };
      setFill(cell, "#06243A");
      setCellBorder(cell);
    }

    for (const g of tankGroups) {
      const showRows = g.showRows.length ? g.showRows : [g.auAssay ?? g.agAssay].filter(Boolean) as TankSumRow[];
      const span = showRows.length || 1;

      const startRow = ws.rowCount + 1;

      const incAu = g.auAssay ? g.auAssay.variation ?? null : null;
      const incAg = g.agAssay ? (g.agAssay as any).variation ?? (g.agAssay as any).variation_ag ?? null : null;

      const leyAu = g.auAssay ? (g.auAssay as any).au_d5 ?? null : null;
      const leyAg = g.agAssay ? (g.agAssay as any).ag_d5 ?? null : null;

      for (let i = 0; i < span; i++) {
        const r = showRows[i] ?? null;
        const camp = r ? String((r as any).campaign ?? (r as any).campaign_id ?? "").trim() : "";
        const hasCampaign = !!camp;

        const rowVals = [
          i === 0 ? String(g.tank || "").toUpperCase() : "",
          i === 0 ? fmtDateAnyToDdMm(g.entryIso) : "",
          hasCampaign ? camp : "",
          i === 0 ? toNum(incAu) ?? "" : "",
          i === 0 ? toNum(leyAu) ?? "" : "",
          i === 0 ? toNum(incAg) ?? "" : "",
          i === 0 ? toNum(leyAg) ?? "" : "",
          hasCampaign ? toNum((r as any)?.carbon_kg) ?? "" : "",
          hasCampaign ? (toNum((r as any)?.eff_pct) === null ? "" : toNum((r as any)?.eff_pct)! * 100) : "",
          i === 0 ? (toNum(g.days_since) ?? "") : "",
          hasCampaign ? toNum((r as any)?.cycles) ?? "" : "",
          i === 0 ? String(g.commentSpan || "").trim() : "",
        ];

        const rr = ws.addRow(rowVals);
        rr.height = 18;

        for (let c = 1; c <= headers.length; c++) {
          const cell = rr.getCell(c);

          cell.alignment = { vertical: "middle", horizontal: c <= 3 || c === 12 ? "left" : "right" };
          cell.font = { bold: c === 1 || c === 2 || c === 3 || c === 12, color: { argb: "FFFFFFFF" } };

          setFill(cell, "#0A2E48");
          setCellBorder(cell);

          if (c === 4 || c === 6) cell.numFmt = "0.000";
          if (c === 5 || c === 7) cell.numFmt = "0.000";
          if (c === 8) cell.numFmt = "#,##0.00";
          if (c === 9) cell.numFmt = "0.0";
          if (c === 10) cell.numFmt = "0";
          if (c === 11) cell.numFmt = "0";

          if (c === 4 && i === 0) {
            const n = toNum(incAu);
            if (n !== null) {
              setFill(cell, n >= 0 ? upGreen : downRed);
              cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
            }
          }

          if (c === 6 && i === 0) {
            const n = toNum(incAg);
            if (n !== null) {
              setFill(cell, n >= 0 ? upGreen : downRed);
              cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
            }
          }
        }
      }

      if (span > 1) {
        const endRow = startRow + span - 1;
        const mergeCols = [1, 2, 4, 5, 6, 7, 10, 12];
        for (const col of mergeCols) ws.mergeCells(startRow, col, endRow, col);
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

  async function onRefreshBoth() {
    await onRefresh("AU");
    await onRefresh("AG");
  }

  return (
    <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
      <div className="panel-inner" style={{ padding: "10px 12px", display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Resumen por tanques</div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 8 }}>
          <Button type="button" size="sm" variant="default" onClick={onRefreshBoth} disabled={tankLoading}>
            {tankLoading ? "Cargando…" : "Refrescar"}
          </Button>
          <div style={{ width: 10 }} />

          <Button type="button" size="sm" variant="ghost" onClick={exportExcelTanks} disabled={tankLoading || !tankGroups.length}>
            Exportar Excel
          </Button>

          <Button type="button" size="sm" variant="ghost" onClick={exportPdfTanks} disabled={tankLoading || !tankGroups.length}>
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
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "left", padding: "8px 8px", fontSize: 12, minWidth: 58 }}>
                # Tanque
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "left", padding: "8px 8px", fontSize: 12, minWidth: 108 }}>
                Fecha de Ingreso
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "left", padding: "8px 8px", fontSize: 12, minWidth: 92 }}>
                Campaña
              </th>

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

              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "left", padding: "8px 8px", fontSize: 12, minWidth: 160 }}>
                Comentario
              </th>
            </tr>
          </thead>

          <tbody>
            {tankGroups.length ? (
              tankGroups.map((g) => {
                const rowBorder = gridH;
                const rowBg = "rgba(0,0,0,.10)";

                const showRows = g.showRows.length ? g.showRows : ([g.auAssay ?? g.agAssay].filter(Boolean) as TankSumRow[]);
                const span = showRows.length || 1;

                const incAu = g.auAssay ? g.auAssay.variation ?? null : null;
                const incAg = g.agAssay ? (g.agAssay as any).variation ?? (g.agAssay as any).variation_ag ?? null : null;

                const leyAu = g.auAssay ? (g.auAssay as any).au_d5 ?? null : null;
                const leyAg = g.agAssay ? (g.agAssay as any).ag_d5 ?? null : null;

                return (
                  <React.Fragment key={g.key}>
                    {Array.from({ length: span }).map((_, idx) => {
                      const r = showRows[idx] ?? null;
                      const campaignStr = r ? String((r as any).campaign ?? (r as any).campaign_id ?? "").trim() : "";
                      const hasCampaign = !!campaignStr;

                      const totalGr = hasCampaign ? (r as any)?.total_gr ?? null : null;

                      return (
                        <tr key={`${g.key}-${idx}`} className="capex-tr">
                          {idx === 0 ? (
                            <>
                              <td className="capex-td capex-td-strong" rowSpan={span} style={{ ...cellBase, borderTop: rowBorder, fontWeight: 900, borderBottom: rowBorder, borderRight: gridV, background: rowBg, verticalAlign: "middle" }}>
                                {String(g.tank || "").toUpperCase()}
                              </td>

                              <td className="capex-td" rowSpan={span} style={{ ...cellBase, fontWeight: 900, borderTop: rowBorder, borderBottom: rowBorder, borderRight: gridV, background: rowBg, verticalAlign: "middle" }}>
                                {fmtDateAnyToDdMm(g.entryIso)}
                              </td>
                            </>
                          ) : null}

                          <td className="capex-td" style={{ ...cellBase, fontWeight: 900, borderTop: rowBorder, borderBottom: rowBorder, borderRight: gridV, background: rowBg }}>
                            {hasCampaign ? campaignStr : ""}
                          </td>

                          {idx === 0 ? (
                            <>
                              <td className="capex-td" rowSpan={span} style={{ ...numCell, borderTop: rowBorder, borderBottom: rowBorder, borderRight: gridV, ...(varStyle(incAu) as any), verticalAlign: "middle", fontWeight: 900 }}>
                                {fmtFixed(incAu, 3)}
                              </td>

                              <td className="capex-td" rowSpan={span} style={{ ...numCell, borderTop: rowBorder, borderBottom: rowBorder, borderRight: gridV, background: rowBg, verticalAlign: "middle", fontWeight: 900 }}>
                                {fmtFixed(leyAu, 3)}
                              </td>

                              <td className="capex-td" rowSpan={span} style={{ ...numCell, borderTop: rowBorder, borderBottom: rowBorder, borderRight: gridV, ...(varStyle(incAg) as any), verticalAlign: "middle", fontWeight: 900 }}>
                                {fmtFixed(incAg, 3)}
                              </td>

                              <td className="capex-td" rowSpan={span} style={{ ...numCell, borderTop: rowBorder, borderBottom: rowBorder, borderRight: gridV, background: rowBg, verticalAlign: "middle", fontWeight: 900 }}>
                                {fmtFixed(leyAg, 3)}
                              </td>
                            </>
                          ) : null}

                          <td className="capex-td" style={{ ...numCell, borderTop: rowBorder, borderBottom: rowBorder, borderRight: gridV, background: rowBg }}>
                            {hasCampaign ? fmtFixed((r as any)?.carbon_kg, 2) : ""}
                          </td>

                          <td className="capex-td" style={{ ...numCell, borderTop: rowBorder, borderBottom: rowBorder, borderRight: gridV, background: rowBg }}>
                            {hasCampaign ? (toNum((r as any)?.eff_pct) === null ? "" : fmtFixed(toNum((r as any)?.eff_pct)! * 100, 1)) : ""}
                          </td>

                          {idx === 0 ? (
                            <td className="capex-td" rowSpan={span} style={{ ...numCell, borderTop: rowBorder, borderBottom: rowBorder, borderRight: gridV, background: rowBg, verticalAlign: "middle", fontWeight: 900 }}>
                              {g.days_since === null ? "" : fmtInt(g.days_since)}
                            </td>
                          ) : null}

                          <td className="capex-td" style={{ ...numCell, borderTop: rowBorder, borderBottom: rowBorder, borderRight: gridV, background: rowBg }}>
                            {hasCampaign ? fmtInt((r as any)?.cycles) : ""}
                          </td>

                          {idx === 0 ? (
                            <td
                              className="capex-td"
                              rowSpan={span}
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
                                verticalAlign: "middle",
                              }}
                              title={g.commentSpan}
                            >
                              {g.commentSpan}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </React.Fragment>
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