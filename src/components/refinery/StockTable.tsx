// src/components/refinery/StockTable.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

type StockRow = {
  reagent_name: string;
  entry_qty: any;
  consumption_qty: any;
  stock_available: any;
  [k: string]: any;
};

type StockResp = { ok: boolean; rows: StockRow[]; error?: string };

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

function colWidth(key: string) {
  if (key === "reagent_name") return 260;
  return 140;
}

export default function StockTable({
  autoLoad = true,
  refreshKey = 0,
}: {
  autoLoad?: boolean;
  refreshKey?: number;
}) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<StockRow[]>([]);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const r = (await apiGet("/api/refineria/stock")) as StockResp;
      const rr = Array.isArray(r?.rows) ? r.rows : [];
      setRows(rr);
      if (!rr.length) setMsg("Sin datos.");
    } catch (e: any) {
      setRows([]);
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!autoLoad) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, refreshKey]);

  const cols = useMemo(
    () => [
      { key: "reagent_name", label: "Insumo", w: colWidth("reagent_name"), fmt: (v: any) => String(v ?? "") },
      { key: "entry_qty", label: "Ingresos", w: colWidth("entry_qty"), fmt: (v: any) => fmtFixed(v, 2) },
      { key: "consumption_qty", label: "Consumos", w: colWidth("consumption_qty"), fmt: (v: any) => fmtFixed(v, 2) },
      { key: "stock_available", label: "Stock", w: colWidth("stock_available"), fmt: (v: any) => fmtFixed(v, 2) },
    ],
    []
  );

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

  const numCell: React.CSSProperties = { ...cellBase, textAlign: "right", whiteSpace: "nowrap" };
  const textCell: React.CSSProperties = {
    ...cellBase,
    textAlign: "left",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  return (
    <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
      <div className="panel-inner" style={{ padding: 12, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Stock de Insumos</div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Button type="button" size="sm" variant="ghost" onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Refrescar"}
          </Button>
        </div>
      </div>

      {msg ? (
        <div
          className="panel-inner"
          style={{
            padding: 10,
            border: msg.startsWith("ERROR") ? "1px solid rgba(255,80,80,.45)" : "1px solid rgba(255,255,255,.10)",
            background: msg.startsWith("ERROR") ? "rgba(255,80,80,.10)" : "rgba(255,255,255,.04)",
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
                  {cols.map((c) => (
                    <th
                      key={String(c.key)}
                      className="capex-th"
                      style={{
                        ...stickyHead,
                        width: c.w,
                        minWidth: c.w,
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
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((r, idx) => (
                  <tr key={`${String(r.reagent_name || idx)}-${idx}`} className="capex-tr">
                    {cols.map((c) => {
                      const v = (r as any)[c.key];
                      const txt = c.fmt ? c.fmt(v) : v ?? "";
                      const isText = c.key === "reagent_name";
                      return (
                        <td
                          key={`${idx}-${String(c.key)}`}
                          className="capex-td"
                          style={{
                            ...(isText ? textCell : numCell),
                            width: c.w,
                            minWidth: c.w,
                            padding: "6px 8px",
                            background: "rgba(0,0,0,.10)",
                            borderBottom: "1px solid rgba(255,255,255,.06)",
                            fontWeight: c.key === "stock_available" ? 900 : 800,
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
            {loading ? "Cargando…" : "Sin datos."}
          </div>
        )}
      </div>
    </div>
  );
}
