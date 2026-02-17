// src/components/planta/CarbonTable.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";
import { apiGet } from "../../lib/apiClient";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";

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
  d1: any;
  d2: any;
  d3: any;
  d4: any;
  d5: any;
  variation: any;
  total_gr: any;
};

function normalizeRow(r: TankSumRow, mode: Mode): NormRow {
  const campaign = r.campaign ?? r.campaign_id ?? null;
  const tank_comment = r.tank_comment ?? r.comment ?? null;

  const d1 = mode === "AU" ? r.au_d1 : r.ag_d1;
  const d2 = mode === "AU" ? r.au_d2 : r.ag_d2;
  const d3 = mode === "AU" ? r.au_d3 : r.ag_d3;
  const d4 = mode === "AU" ? r.au_d4 : r.ag_d4;
  const d5 = mode === "AU" ? r.au_d5 : r.ag_d5;

  return {
    tank: r.tank,
    entry_date: r.entry_date,
    campaign,
    carbon_kg: r.carbon_kg,
    eff_pct: r.eff_pct,
    cycles: r.cycles,
    tank_comment,
    d1,
    d2,
    d3,
    d4,
    d5,
    variation: r.variation,
    total_gr: r.total_gr,
  };
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

  const cellBase: React.CSSProperties = {
    padding: "5px 6px",
    fontSize: 12,
    lineHeight: "14px",
    whiteSpace: "nowrap",
  };

  const numCell: React.CSSProperties = { ...cellBase, textAlign: "right" };

  const upGreen = "#00965E";
  const downRed = "#b23934";

  const rawRows = tankMode === "AU" ? tankRowsAu : tankRowsAg;

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
      d2: map.get("D2") ?? "D2",
      d3: map.get("D3") ?? "D3",
      d4: map.get("D4") ?? "D4",
      d5: map.get("D5") ?? "D5",
    };
  }, [top5dRows]);

  const tankGroups = useMemo(() => {
    const src = Array.isArray(rawRows) ? rawRows : [];
    const rows = src.map((r) => normalizeRow(r, tankMode));

    rows.sort((a, b) => {
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

    const map = new Map<string, NormRow[]>();
    for (const r of rows) {
      const key = `${String(r.tank || "").toUpperCase()}|${pickIsoDateOnly(r.entry_date)}`;
      const arr = map.get(key);
      if (arr) arr.push(r);
      else map.set(key, [r]);
    }

    const out: { key: string; tank: string; entryIso: string; rows: NormRow[] }[] = [];
    for (const [key, arr] of map.entries()) {
      const [tank, entryIso] = key.split("|");
      out.push({ key, tank, entryIso, rows: arr });
    }

    out.sort((a, b) => {
      const ta = tankOrderKey(a.tank);
      const tb = tankOrderKey(b.tank);
      if (ta !== tb) return ta - tb;
      if (a.entryIso !== b.entryIso) return a.entryIso < b.entryIso ? 1 : -1;
      return a.key.localeCompare(b.key);
    });

    return out;
  }, [rawRows, tankMode]);

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

  function buildExportMatrixForTanks(args: {
  mode: Mode;
  labels: { d1: string; d2: string; d3: string; d4: string; d5: string };
  groups: { tank: string; entryIso: string; rows: NormRow[] }[];
}) {
  const { mode, labels, groups } = args;

  const headers = [
    "# Tanque",
    "Fecha de Ingreso",
    "Campaña",
    "Carbón (kg)",
    "Ef. %",
    "# Vueltas",
    labels.d1,
    labels.d2,
    labels.d3,
    labels.d4,
    labels.d5,
    "Variación (%)",
    "g Total",
    "Comentario",
  ];

  const rows: any[][] = [];

  for (const g of groups) {
    const span = Math.max(1, g.rows.length);
    const assayRow = g.rows.find((x) => isCampaignPresent(x.campaign)) ?? g.rows[0];

    const commentSpan = String(
      g.rows.find((x) => isCampaignPresent(x.campaign) && String(x.tank_comment ?? "").trim().length > 0)?.tank_comment ??
        g.rows.find((x) => String(x.tank_comment ?? "").trim().length > 0)?.tank_comment ??
        ""
    ).trim();

    for (let i = 0; i < span; i++) {
      const r = g.rows[i];
      const hasCampaign = isCampaignPresent(r.campaign);

      rows.push([
        i === 0 ? String(g.tank || "").toUpperCase() : "",
        i === 0 ? fmtDateAnyToDdMm(g.entryIso) : "",
        hasCampaign ? String(r.campaign || "").trim() : "",
        hasCampaign ? fmtFixed(r.carbon_kg, 2) : "",
        hasCampaign ? (toNum(r.eff_pct) === null ? "" : fmtFixed(toNum(r.eff_pct)! * 100, 1)) : "",
        hasCampaign ? fmtInt(r.cycles) : "",
        i === 0 && isCampaignPresent(assayRow.campaign) ? fmtFixed(assayRow.d1, 3) : "",
        i === 0 && isCampaignPresent(assayRow.campaign) ? fmtFixed(assayRow.d2, 3) : "",
        i === 0 && isCampaignPresent(assayRow.campaign) ? fmtFixed(assayRow.d3, 3) : "",
        i === 0 && isCampaignPresent(assayRow.campaign) ? fmtFixed(assayRow.d4, 3) : "",
        i === 0 && isCampaignPresent(assayRow.campaign) ? fmtFixed(assayRow.d5, 3) : "",
        i === 0 && isCampaignPresent(assayRow.campaign) ? fmtFixed(assayRow.variation ?? null, 3) : "",
        hasCampaign ? fmtFixed(r.total_gr ?? null, 2) : "",
        i === 0 ? commentSpan : "",
      ]);
    }
  }

  const title = `MVD_Planta_Tanques_${mode}_${(labels.d1 || "D1").replaceAll("/", "-")}`;
  return { headers, rows, title };
}

async function exportExcelTanks() {
  const { headers, rows, title } = buildExportMatrixForTanks({
    mode: tankMode,
    labels: tankDatesLabels,
    groups: tankGroups.map((g) => ({ tank: g.tank, entryIso: g.entryIso, rows: g.rows })),
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Tanques");

  ws.addRow([title.replaceAll("_", " ")]);
  ws.mergeCells(1, 1, 1, headers.length);
  ws.getRow(1).font = { bold: true, size: 14 };

  ws.addRow([]);

  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };

  for (const r of rows) ws.addRow(r);

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

function exportPdfTanks() {
  const { headers, rows, title } = buildExportMatrixForTanks({
    mode: tankMode,
    labels: tankDatesLabels,
    groups: tankGroups.map((g) => ({ tank: g.tank, entryIso: g.entryIso, rows: g.rows })),
  });

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  doc.setFontSize(11);
  doc.text(title.replaceAll("_", " "), 40, 30);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 45,
    styles: { fontSize: 7, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fontSize: 7, fontStyle: "bold" },
    margin: { left: 20, right: 20 },
    tableWidth: "auto",
  });

  doc.save(`${title}.pdf`);
}

  return (
    <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
      <div className="panel-inner" style={{ padding: "10px 12px", display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Resumen por tanques</div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 8 }}>
          <Button type="button" size="sm" variant={tankMode === "AU" ? "primary" : "ghost"} onClick={() => setTankMode("AU")} disabled={tankLoading}>
            Au
          </Button>
          <Button type="button" size="sm" variant={tankMode === "AG" ? "primary" : "ghost"} onClick={() => setTankMode("AG")} disabled={tankLoading}>
            Ag
          </Button>

          <Button type="button" size="sm" variant="default" onClick={() => onRefresh(tankMode)} disabled={tankLoading}>
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

      <div className="panel-inner" style={{ padding: 0, overflow: "hidden" }}>
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
                Carbón (kg)
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "8px 8px", fontSize: 12, minWidth: 90 }}>
                Ef. %
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "8px 8px", fontSize: 12, minWidth: 72 }}>
                # Vueltas
              </th>

              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "8px 8px", fontSize: 12, minWidth: 82 }}>
                {tankDatesLabels.d1}
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "8px 8px", fontSize: 12, minWidth: 82 }}>
                {tankDatesLabels.d2}
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "8px 8px", fontSize: 12, minWidth: 82 }}>
                {tankDatesLabels.d3}
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "8px 8px", fontSize: 12, minWidth: 82 }}>
                {tankDatesLabels.d4}
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "8px 8px", fontSize: 12, minWidth: 82 }}>
                {tankDatesLabels.d5}
              </th>

              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "8px 8px", fontSize: 12, minWidth: 92 }}>
                Variación (%)
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "8px 8px", fontSize: 12, minWidth: 110 }}>
                g Total
              </th>

              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "left", padding: "8px 8px", fontSize: 12, minWidth: 160 }}>
                Comentario
              </th>
            </tr>
          </thead>

          <tbody>
            {tankGroups.length ? (
              tankGroups.map((g) => {
                const rowBorder = "1px solid rgba(255,255,255,.06)";
                const rowBg = "rgba(0,0,0,.10)";
                const span = Math.max(1, g.rows.length);

                return (
                  <React.Fragment key={g.key}>
                    {g.rows.map((r, idx) => {
                      const hasCampaign = isCampaignPresent(r.campaign);
                      const campaignStr = hasCampaign ? String(r.campaign).trim() : "";
                      const commentSpan = String(
                        g.rows.find((x) => isCampaignPresent(x.campaign) && String(x.tank_comment ?? "").trim().length > 0)?.tank_comment ??
                          g.rows.find((x) => String(x.tank_comment ?? "").trim().length > 0)?.tank_comment ??
                          ""
                      ).trim();

                      const totalGr = hasCampaign ? (r.total_gr ?? null) : null;

                      return (
                        <tr key={`${g.key}-${idx}`} className="capex-tr">
                          {idx === 0 ? (
                            <>
                              <td className="capex-td capex-td-strong" rowSpan={span} style={{ ...cellBase, fontWeight: 900, borderBottom: rowBorder, background: rowBg, verticalAlign: "middle" }}>
                                {String(r.tank || "").toUpperCase()}
                              </td>

                              <td className="capex-td" rowSpan={span} style={{ ...cellBase, fontWeight: 900, borderBottom: rowBorder, background: rowBg, verticalAlign: "middle" }}>
                                {fmtDateAnyToDdMm(r.entry_date)}
                              </td>
                            </>
                          ) : null}

                          <td className="capex-td" style={{ ...cellBase, fontWeight: 900, borderBottom: rowBorder, background: rowBg }}>
                            {campaignStr}
                          </td>

                          <td className="capex-td" style={{ ...numCell, borderBottom: rowBorder, background: rowBg }}>
                            {hasCampaign ? fmtFixed(r.carbon_kg, 2) : ""}
                          </td>

                          <td className="capex-td" style={{ ...numCell, borderBottom: rowBorder, background: rowBg }}>
                            {hasCampaign ? (toNum(r.eff_pct) === null ? "" : fmtFixed(toNum(r.eff_pct)! * 100, 1)) : ""}
                          </td>

                          <td className="capex-td" style={{ ...numCell, borderBottom: rowBorder, background: rowBg }}>
                            {hasCampaign ? fmtInt(r.cycles) : ""}
                          </td>

                          {idx === 0 ? (
                            (() => {
                              const assayRow =
                                g.rows.find((x) => isCampaignPresent(x.campaign)) ?? g.rows[0];

                              return (
                                <>
                                  <td
                                    className="capex-td"
                                    rowSpan={span}
                                    style={{
                                      ...numCell,
                                      fontWeight: 900,
                                      borderBottom: rowBorder,
                                      background: rowBg,
                                      verticalAlign: "middle",
                                    }}
                                  >
                                    {isCampaignPresent(assayRow.campaign) ? fmtFixed(assayRow.d1, 3) : ""}
                                  </td>

                                  <td
                                    className="capex-td"
                                    rowSpan={span}
                                    style={{
                                      ...numCell,
                                      fontWeight: 900,
                                      borderBottom: rowBorder,
                                      background: rowBg,
                                      verticalAlign: "middle",
                                    }}
                                  >
                                    {isCampaignPresent(assayRow.campaign) ? fmtFixed(assayRow.d2, 3) : ""}
                                  </td>

                                  <td
                                    className="capex-td"
                                    rowSpan={span}
                                    style={{
                                      ...numCell,
                                      fontWeight: 900,
                                      borderBottom: rowBorder,
                                      background: rowBg,
                                      verticalAlign: "middle",
                                    }}
                                  >
                                    {isCampaignPresent(assayRow.campaign) ? fmtFixed(assayRow.d3, 3) : ""}
                                  </td>

                                  <td
                                    className="capex-td"
                                    rowSpan={span}
                                    style={{
                                      ...numCell,
                                      fontWeight: 900,
                                      borderBottom: rowBorder,
                                      background: rowBg,
                                      verticalAlign: "middle",
                                    }}
                                  >
                                    {isCampaignPresent(assayRow.campaign) ? fmtFixed(assayRow.d4, 3) : ""}
                                  </td>

                                  <td
                                    className="capex-td"
                                    rowSpan={span}
                                    style={{
                                      ...numCell,
                                      fontWeight: 900,
                                      borderBottom: rowBorder,
                                      background: rowBg,
                                      verticalAlign: "middle",
                                    }}
                                  >
                                    {isCampaignPresent(assayRow.campaign) ? fmtFixed(assayRow.d5, 3) : ""}
                                  </td>
                                </>
                              );
                            })()
                          ) : null}

                          {idx === 0 ? (
                            (() => {
                              const assayRow = g.rows.find((x) => isCampaignPresent(x.campaign)) ?? g.rows[0];
                              const varVal = isCampaignPresent(assayRow.campaign) ? (assayRow.variation ?? null) : null;

                              return (
                                <td
                                  className="capex-td"
                                  rowSpan={span}
                                  style={{
                                    ...numCell,
                                    borderBottom: rowBorder,
                                    ...(isCampaignPresent(assayRow.campaign) ? (totalGrStyle(varVal) as any) : {}),
                                    verticalAlign: "middle",
                                    fontWeight: 900,
                                  }}
                                >
                                  {isCampaignPresent(assayRow.campaign) ? fmtFixed(varVal, 3) : ""}
                                </td>
                              );
                            })()
                          ) : null}

                          <td className="capex-td" style={{ ...numCell, borderBottom: rowBorder, ...(hasCampaign ? (totalGrStyle(totalGr) as any) : {}) }}>
                            {hasCampaign ? fmtFixed(totalGr, 2) : ""}
                          </td>

                          {idx === 0 ? (
                            <td
                              className="capex-td"
                              rowSpan={span}
                              style={{
                                ...cellBase,
                                fontWeight: 900,
                                borderBottom: rowBorder,
                                background: rowBg,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: 260,
                                verticalAlign: "middle",
                              }}
                              title={commentSpan}
                            >
                              {commentSpan}
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
                <td className="capex-td" style={{ ...cellBase, fontWeight: 900 }} colSpan={14}>
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
