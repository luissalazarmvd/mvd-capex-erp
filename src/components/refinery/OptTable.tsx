// src/components/refinery/OptTable.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

type OptRow = {
  campaign_id: string | null;
  process_name: string | null;
  subprocess_name: string | null;
  reagent_name: string | null;
  consumption_qty: any;
  ml_consumption_qty: any;
  consumption_cost_us: any;
  ml_consumption_cost_us: any;
  desv_pct: any;
  [k: string]: any;
};

type OptResp = {
  ok: boolean;
  rows: OptRow[];
  error?: string;
};

type NodeKind = "campaign" | "process" | "subprocess" | "reagent";

type TreeNode = {
  key: string;
  kind: NodeKind;
  campaign_id: string;
  process_name: string;
  subprocess_name: string;
  reagent_name: string;
  consumption_qty: number | null;
  ml_consumption_qty: number | null;
  consumption_cost_us: number | null;
  ml_consumption_cost_us: number | null;
  desv_pct: number | null;
  children: TreeNode[];
};

function toNum(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function sumNullable(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0);
}

function calcDesv(realValue: number | null, optValue: number | null): number | null {
  if (realValue === null || optValue === null) return null;
  if (realValue === 0 || optValue === 0) return null;
  return (realValue - optValue) / optValue;
}

function fmtFixed(v: any, digits: number) {
  const n = toNum(v);
  if (n === null) return "";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtMoney(v: any) {
  const n = toNum(v);
  if (n === null) return "";
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function fmtPct(v: any) {
  const n = toNum(v);
  if (n === null) return "";
  return `${(n * 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} %`;
}

function buildTree(rows: OptRow[]): TreeNode[] {
  type TempSub = {
    node: TreeNode;
  };

  type TempProc = {
    node: TreeNode;
    subs: Map<string, TempSub>;
  };

  type TempCamp = {
    node: TreeNode;
    procs: Map<string, TempProc>;
  };

  const campaigns = new Map<string, TempCamp>();

  for (const raw of rows || []) {
    const campaign_id = String(raw.campaign_id || "").trim() || "(Sin campaña)";
    const process_name = String(raw.process_name || "").trim() || "(Sin proceso)";
    const subprocess_name = String(raw.subprocess_name || "").trim() || "(Sin subproceso)";
    const reagent_name = String(raw.reagent_name || "").trim() || "(Sin insumo)";

    let camp = campaigns.get(campaign_id);
    if (!camp) {
      camp = {
        node: {
          key: `campaign|${campaign_id}`,
          kind: "campaign",
          campaign_id,
          process_name: "",
          subprocess_name: "",
          reagent_name: "",
          consumption_qty: null,
          ml_consumption_qty: null,
          consumption_cost_us: null,
          ml_consumption_cost_us: null,
          desv_pct: null,
          children: [],
        },
        procs: new Map<string, TempProc>(),
      };
      campaigns.set(campaign_id, camp);
    }

    let proc = camp.procs.get(process_name);
    if (!proc) {
      const procNode: TreeNode = {
        key: `process|${campaign_id}|${process_name}`,
        kind: "process",
        campaign_id,
        process_name,
        subprocess_name: "",
        reagent_name: "",
        consumption_qty: null,
        ml_consumption_qty: null,
        consumption_cost_us: null,
        ml_consumption_cost_us: null,
        desv_pct: null,
        children: [],
      };
      proc = { node: procNode, subs: new Map<string, TempSub>() };
      camp.procs.set(process_name, proc);
      camp.node.children.push(procNode);
    }

    let sub = proc.subs.get(subprocess_name);
    if (!sub) {
      const subNode: TreeNode = {
        key: `subprocess|${campaign_id}|${process_name}|${subprocess_name}`,
        kind: "subprocess",
        campaign_id,
        process_name,
        subprocess_name,
        reagent_name: "",
        consumption_qty: null,
        ml_consumption_qty: null,
        consumption_cost_us: null,
        ml_consumption_cost_us: null,
        desv_pct: null,
        children: [],
      };
      sub = { node: subNode };
      proc.subs.set(subprocess_name, sub);
      proc.node.children.push(subNode);
    }

    sub.node.children.push({
      key: `reagent|${campaign_id}|${process_name}|${subprocess_name}|${reagent_name}`,
      kind: "reagent",
      campaign_id,
      process_name,
      subprocess_name,
      reagent_name,
      consumption_qty: toNum(raw.consumption_qty),
      ml_consumption_qty: toNum(raw.ml_consumption_qty),
      consumption_cost_us: toNum(raw.consumption_cost_us),
      ml_consumption_cost_us: toNum(raw.ml_consumption_cost_us),
      desv_pct:
        toNum(raw.desv_pct) !== null
          ? toNum(raw.desv_pct)
          : calcDesv(toNum(raw.consumption_qty), toNum(raw.ml_consumption_qty)),
      children: [],
    });
  }

  function finalize(node: TreeNode): TreeNode {
    if (!node.children.length) return node;

    const children = node.children.map(finalize);

    const consumption_qty = sumNullable(children.map((c) => c.consumption_qty));
    const ml_consumption_qty = sumNullable(children.map((c) => c.ml_consumption_qty));
    const consumption_cost_us = sumNullable(children.map((c) => c.consumption_cost_us));
    const ml_consumption_cost_us = sumNullable(children.map((c) => c.ml_consumption_cost_us));
    const desv_pct = calcDesv(consumption_qty, ml_consumption_qty);

    return {
      ...node,
      children,
      consumption_qty,
      ml_consumption_qty,
      consumption_cost_us,
      ml_consumption_cost_us,
      desv_pct,
    };
  }

  return Array.from(campaigns.values()).map((x) => finalize(x.node));
}

function colWidth(key: string) {
  if (key === "campaign") return 320;
  if (key === "ml_consumption_qty") return 105;
  if (key === "consumption_qty") return 105;
  if (key === "ml_consumption_cost_us") return 125;
  if (key === "consumption_cost_us") return 115;
  if (key === "desv_pct") return 85;
  return 100;
}

export default function OptTable({
  autoLoad = true,
  refreshKey = 0,
}: {
  autoLoad?: boolean;
  refreshKey?: number;
}) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<OptRow[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const r = (await apiGet("/api/refineria/cons-ml-web")) as OptResp;
      const rr = Array.isArray(r?.rows) ? r.rows : [];
      setRows(rr);

      const nextExpanded = new Set<string>();
      for (const x of rr) {
        const campaign_id = String(x.campaign_id || "").trim() || "(Sin campaña)";
        const process_name = String(x.process_name || "").trim() || "(Sin proceso)";
        const subprocess_name = String(x.subprocess_name || "").trim() || "(Sin subproceso)";
        nextExpanded.add(`campaign|${campaign_id}`);
        nextExpanded.add(`process|${campaign_id}|${process_name}`);
        nextExpanded.add(`subprocess|${campaign_id}|${process_name}|${subprocess_name}`);
      }
      setExpanded(nextExpanded);

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

  const tree = useMemo(() => buildTree(rows), [rows]);

  const flatRows = useMemo(() => {
    const out: Array<{ node: TreeNode }> = [];

    function walk(node: TreeNode) {
      out.push({ node });
      if (node.children.length && expanded.has(node.key)) {
        for (const ch of node.children) walk(ch);
      }
    }

    for (const root of tree) walk(root);
    return out;
  }, [tree, expanded]);

  function toggleNode(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

    const cols = useMemo(
    () => [
        { key: "campaign", label: "Campaña", w: colWidth("campaign"), align: "left" as const },
        { key: "ml_consumption_qty", label: "Cons. Óptimo", w: colWidth("ml_consumption_qty"), align: "right" as const },
        { key: "consumption_qty", label: "Cons. Real", w: colWidth("consumption_qty"), align: "right" as const },
        { key: "ml_consumption_cost_us", label: "Costo Óptimo $", w: colWidth("ml_consumption_cost_us"), align: "right" as const },
        { key: "consumption_cost_us", label: "Costo Real $", w: colWidth("consumption_cost_us"), align: "right" as const },
        { key: "desv_pct", label: "Desv. %", w: colWidth("desv_pct"), align: "right" as const },
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

  function rowBg(kind: NodeKind) {
    if (kind === "campaign") return "rgba(255,255,255,.08)";
    if (kind === "process") return "rgba(255,255,255,.06)";
    if (kind === "subprocess") return "rgba(255,255,255,.04)";
    return "rgba(0,0,0,.10)";
  }

  function rowWeight(kind: NodeKind) {
    if (kind === "campaign") return 900;
    if (kind === "process") return 900;
    if (kind === "subprocess") return 800;
    return 700;
  }

    function labelForNode(node: TreeNode, _key: string) {
    if (node.kind === "campaign") return node.campaign_id;
    if (node.kind === "process") return node.process_name;
    if (node.kind === "subprocess") return node.subprocess_name;
    if (node.kind === "reagent") return node.reagent_name;
    return "";
    }

    function renderTextCell(node: TreeNode, key: string) {
    const txt = labelForNode(node, key);
    if (!txt) return "";

    const showToggle = node.children.length > 0;

    const indent =
        node.kind === "campaign" ? 0 :
        node.kind === "process" ? 18 :
        node.kind === "subprocess" ? 36 :
        54;

    return (
        <div
        style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            paddingLeft: indent,
            minHeight: 20,
        }}
        >
        {showToggle ? (
            <button
            type="button"
            onClick={() => toggleNode(node.key)}
            title={expanded.has(node.key) ? "Contraer" : "Expandir"}
            style={{
                width: 16,
                height: 16,
                minWidth: 16,
                borderRadius: 3,
                border: "1px solid rgba(255,255,255,.22)",
                background: "rgba(255,255,255,.06)",
                color: "inherit",
                cursor: "pointer",
                padding: 0,
                lineHeight: "14px",
                fontSize: 12,
                fontWeight: 900,
                marginTop: 1,
            }}
            >
            {expanded.has(node.key) ? "−" : "+"}
            </button>
        ) : (
            <span style={{ width: 16, minWidth: 16, display: "inline-block" }} />
        )}

        <span
            style={{
            whiteSpace: "normal",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
            lineHeight: "14px",
            }}
        >
            {txt}
        </span>
        </div>
    );
    }

  function renderNumericCell(node: TreeNode, key: string) {
    if (key === "ml_consumption_qty") return fmtFixed(node.ml_consumption_qty, 2);
    if (key === "consumption_qty") return fmtFixed(node.consumption_qty, 2);
    if (key === "ml_consumption_cost_us") return fmtMoney(node.ml_consumption_cost_us);
    if (key === "consumption_cost_us") return fmtMoney(node.consumption_cost_us);
    if (key === "desv_pct") return fmtPct(node.desv_pct);
    return "";
  }

  function desvColor(v: number | null) {
    if (v === null) return "inherit";
    if (v < 0) return "#00c26f";
    if (v > 0) return "#ff6b57";
    return "inherit";
  }

    return (
    <div style={{ display: "grid", gap: 12, minWidth: 0, width: "100%" }}>
      <div className="panel-inner" style={{ padding: 12, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Consumo Óptimo vs Real</div>

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
        {flatRows.length ? (
        <div style={{ minWidth: 0, width: "100%" }}>
            <Table stickyHeader maxHeight={"calc(100vh - 260px)"}>
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th
                      key={c.key}
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
                {flatRows.map(({ node }, idx) => (
                  <tr key={`${node.key}-${idx}`} className="capex-tr">
                    {cols.map((c) => {
                      const isText = c.align === "left";
                      const txt = isText ? null : renderNumericCell(node, c.key);
                        const baseStyle: React.CSSProperties = {
                        ...cellBase,
                        width: c.w,
                        minWidth: c.w,
                        padding: "6px 6px",
                        background: rowBg(node.kind),
                        borderBottom: "1px solid rgba(255,255,255,.06)",
                        fontWeight: rowWeight(node.kind),
                        textAlign: c.align,
                        whiteSpace: isText ? "normal" : "nowrap",
                        overflow: "hidden",
                        textOverflow: isText ? "clip" : "ellipsis",
                        overflowWrap: isText ? "anywhere" : "normal",
                        wordBreak: isText ? "break-word" : "normal",
                        lineHeight: isText ? "14px" : "16px",
                        };

                      const extraStyle: React.CSSProperties =
                        c.key === "desv_pct"
                          ? { color: desvColor(node.desv_pct) }
                          : {};

                      return (
                        <td
                          key={`${node.key}-${c.key}`}
                          className="capex-td"
                          style={{ ...baseStyle, ...extraStyle }}
                          title={isText ? labelForNode(node, c.key) : String(txt || "")}
                        >
                          {isText ? renderTextCell(node, c.key) : txt}
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