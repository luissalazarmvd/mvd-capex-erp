// src/components/planta/CarbonTable.tsx
"use client";

import React, { useMemo } from "react";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

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
  tankDatesAu: string[];
  tankDatesAg: string[];
}) {
  const {
    tankMode,
    setTankMode,
    tankLoading,
    onRefresh,
    tankMsg,
    tankRowsAu,
    tankRowsAg,
    tankDatesAu,
    tankDatesAg,
  } = props;

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
    padding: "6px 8px",
    fontSize: 12,
    lineHeight: "16px",
    whiteSpace: "nowrap",
  };

  const numCell: React.CSSProperties = { ...cellBase, textAlign: "right" };

  const upGreen = "#00965E";
  const downRed = "#b23934";

  const rawRows = tankMode === "AU" ? tankRowsAu : tankRowsAg;
  const tankDates = tankMode === "AU" ? tankDatesAu : tankDatesAg;

  const tankDatesLabels = useMemo(() => {
    const d = (Array.isArray(tankDates) ? tankDates : [])
      .map((x) => pickIsoDateOnly(x))
      .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x));

    const d5 = d[0] ? fmtDateDdMm(d[0]) : "D5";
    const d4 = d[1] ? fmtDateDdMm(d[1]) : "D4";
    const d3 = d[2] ? fmtDateDdMm(d[2]) : "D3";
    const d2 = d[3] ? fmtDateDdMm(d[3]) : "D2";
    const d1 = d[4] ? fmtDateDdMm(d[4]) : "D1";
    return { d1, d2, d3, d4, d5 };
  }, [tankDates]);

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

  function renderVariation(v: any) {
    const n = toNum(v);
    if (n === null) return "";
    const txt = fmtFixed(n, 3);
    if (n > 0)
      return (
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center", justifyContent: "flex-end", width: "100%" }}>
          <span>{txt}</span>
          <span style={{ color: upGreen, fontWeight: 900, lineHeight: "12px" }}>↗</span>
        </span>
      );
    if (n < 0)
      return (
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center", justifyContent: "flex-end", width: "100%" }}>
          <span>{txt}</span>
          <span style={{ color: downRed, fontWeight: 900, lineHeight: "12px" }}>↘</span>
        </span>
      );
    return txt;
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

  return (
    <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
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
        </div>

        <div className="muted" style={{ fontWeight: 800, marginLeft: "auto" }}>
          {tankMode === "AU" ? "Au" : "Ag"} · dw.v_tank_summary_{tankMode === "AU" ? "au" : "ag"}
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
        <Table stickyHeader maxHeight={"calc(100vh - 320px)"}>
          <thead>
            <tr>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "left", padding: "10px 10px", fontSize: 12, minWidth: 80 }}>
                Tanque
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "left", padding: "10px 10px", fontSize: 12, minWidth: 140 }}>
                Fecha de ingreso
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "left", padding: "10px 10px", fontSize: 12, minWidth: 110 }}>
                Campaña
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "10px 10px", fontSize: 12, minWidth: 130 }}>
                Carbón (kg)
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "10px 10px", fontSize: 12, minWidth: 120 }}>
                Eficiencia (%)
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "10px 10px", fontSize: 12, minWidth: 95 }}>
                # Vueltas
              </th>

              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "10px 10px", fontSize: 12, minWidth: 105 }}>
                {tankDatesLabels.d1}
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "10px 10px", fontSize: 12, minWidth: 105 }}>
                {tankDatesLabels.d2}
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "10px 10px", fontSize: 12, minWidth: 105 }}>
                {tankDatesLabels.d3}
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "10px 10px", fontSize: 12, minWidth: 105 }}>
                {tankDatesLabels.d4}
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "10px 10px", fontSize: 12, minWidth: 105 }}>
                {tankDatesLabels.d5}
              </th>

              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "10px 10px", fontSize: 12, minWidth: 120 }}>
                Variación
              </th>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "right", padding: "10px 10px", fontSize: 12, minWidth: 150 }}>
                g Totales
              </th>

              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "left", padding: "10px 10px", fontSize: 12, minWidth: 260 }}>
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
                      const comment = hasCampaign ? String(r.tank_comment ?? "") : "";
                      const totalGr = hasCampaign ? (r.total_gr ?? null) : null;

                      return (
                        <tr key={`${g.key}-${idx}`} className="capex-tr">
                          {idx === 0 ? (
                            <>
                              <td
                                className="capex-td capex-td-strong"
                                rowSpan={span}
                                style={{ ...cellBase, fontWeight: 900, borderBottom: rowBorder, background: rowBg, verticalAlign: "top" }}
                              >
                                {String(r.tank || "").toUpperCase()}
                              </td>

                              <td className="capex-td" rowSpan={span} style={{ ...cellBase, fontWeight: 900, borderBottom: rowBorder, background: rowBg, verticalAlign: "top" }}>
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
                            {hasCampaign ? fmtFixed(r.eff_pct, 1) : ""}
                          </td>

                          <td className="capex-td" style={{ ...numCell, borderBottom: rowBorder, background: rowBg }}>
                            {hasCampaign ? fmtInt(r.cycles) : ""}
                          </td>

                          <td className="capex-td" style={{ ...numCell, fontWeight: 900, borderBottom: rowBorder, background: rowBg }}>
                            {hasCampaign ? fmtFixed(r.d1, 3) : ""}
                          </td>
                          <td className="capex-td" style={{ ...numCell, fontWeight: 900, borderBottom: rowBorder, background: rowBg }}>
                            {hasCampaign ? fmtFixed(r.d2, 3) : ""}
                          </td>
                          <td className="capex-td" style={{ ...numCell, fontWeight: 900, borderBottom: rowBorder, background: rowBg }}>
                            {hasCampaign ? fmtFixed(r.d3, 3) : ""}
                          </td>
                          <td className="capex-td" style={{ ...numCell, fontWeight: 900, borderBottom: rowBorder, background: rowBg }}>
                            {hasCampaign ? fmtFixed(r.d4, 3) : ""}
                          </td>
                          <td className="capex-td" style={{ ...numCell, fontWeight: 900, borderBottom: rowBorder, background: rowBg }}>
                            {hasCampaign ? fmtFixed(r.d5, 3) : ""}
                          </td>

                          <td className="capex-td" style={{ ...numCell, fontWeight: 900, borderBottom: rowBorder, background: rowBg }}>
                            {hasCampaign ? renderVariation(r.variation) : ""}
                          </td>

                          <td className="capex-td" style={{ ...numCell, borderBottom: rowBorder, ...(hasCampaign ? (totalGrStyle(totalGr) as any) : {}) }}>
                            {hasCampaign ? fmtFixed(totalGr, 2) : ""}
                          </td>

                          <td
                            className="capex-td"
                            style={{
                              ...cellBase,
                              fontWeight: 900,
                              borderBottom: rowBorder,
                              background: rowBg,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: 420,
                            }}
                            title={comment}
                          >
                            {comment}
                          </td>
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
