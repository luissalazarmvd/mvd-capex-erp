// src/components/capex/WbsMatrix.tsx
"use client";

import React, { useMemo, useState } from "react";
import { CellInput } from "./CellInput";
import { SaveBar } from "./SaveBar";

export type Period = { period_id: number; label: string };

export type Row = {
  project_code: string;
  project_name: string;
  wbs_code: string;
  wbs_name: string;
};

type Props = {
  mode: "budget" | "forecast" | "progress";
  title: string;
  projectLabel?: string;

  periods: Period[];
  rows: Row[];

  rowsForTotals?: Row[];

  latest: Record<string, string | null>;
  draft: Record<string, string>;

  budgetClass?: "ORIG" | "SOC";
  progressDouble?: boolean;

  budgetLatest?: Record<string, string | null>;

  onChangeDraft: (key: string, value: string) => void;
  onSave: (rows: { key: string; value: string }[]) => Promise<void>;
  onResetDraft?: () => void;
};

function keyOf(wbs: string, period_id: number, col: string) {
  return `${wbs}|${period_id}|${col}`;
}

function parseNum(x: string | null | undefined): number {
  const s = String(x ?? "").trim();
  if (!s) return 0;
  const cleaned = s.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return (
    "$" +
    v.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function fmtPct(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function WbsMatrix({
  mode,
  title,
  projectLabel,
  periods,
  rows,
  rowsForTotals,
  latest,
  draft,
  budgetClass,
  progressDouble,
  budgetLatest,
  onChangeDraft,
  onSave,
  onResetDraft,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const cols = useMemo<string[]>(() => {
    if (mode === "budget") return [budgetClass || "ORIG"];
    if (mode === "forecast") return ["AMOUNT"];
    return progressDouble ? ["EV_PCT", "AC"] : ["EV_PCT"];
  }, [mode, budgetClass, progressDouble]);

  const pending = useMemo(() => {
    const out: { key: string; value: string }[] = [];
    for (const r of rows) {
      for (const p of periods) {
        for (const c of cols) {
          const k = keyOf(r.wbs_code, p.period_id, c);
          if (Object.prototype.hasOwnProperty.call(draft, k)) {
            out.push({ key: k, value: draft[k] });
          }
        }
      }
    }
    return out;
  }, [rows, periods, cols, draft]);

  async function handleSave() {
    setErr(null);
    if (!pending.length) return;

    setSaving(true);
    try {
      await onSave(pending);
      setLastSavedAt(
        new Date().toLocaleString("es-PE", {
          timeZone: "America/Lima",
          hour12: false,
        })
      );
    } catch (e: any) {
      setErr(e?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  const CELL_W = 110;
  const TOTAL_W = 140;
  const EVLAST_W = 120;
  const ACTOTAL_W = 150;

  const LEFT_W = useMemo(() => {
    const maxLen = rows.reduce((m, r) => {
      const s = `${r.wbs_code} — ${r.wbs_name}`;
      return Math.max(m, s.length);
    }, 0);

    const px = 110 + maxLen * 6;
    return Math.max(180, Math.min(px, 280));
  }, [rows]);

  function effectiveValue(wbs: string, period_id: number, col: string): number {
    const k = keyOf(wbs, period_id, col);
    if (Object.prototype.hasOwnProperty.call(draft, k)) return parseNum(draft[k]);
    return parseNum(latest[k]);
  }

  function effectiveRaw(wbs: string, period_id: number, col: string): string | null {
    const k = keyOf(wbs, period_id, col);
    if (Object.prototype.hasOwnProperty.call(draft, k)) return String(draft[k] ?? "");
    const v = latest[k];
    return v == null ? null : String(v);
  }

  function budgetValue(wbs: string, period_id: number, col: "ORIG" | "SOC"): number {
    if (!budgetLatest) return 0;
    const k = keyOf(wbs, period_id, col);
    return parseNum(budgetLatest[k]);
  }

  function lastNonEmptyPct(wbs: string): number {
    for (let i = periods.length - 1; i >= 0; i--) {
      const p = periods[i];
      const raw = effectiveRaw(wbs, p.period_id, "EV_PCT");
      const s = String(raw ?? "").trim();
      if (s !== "") return parseNum(s);
    }
    return 0;
  }

  function sumAc(wbs: string): number {
    let s = 0;
    for (const p of periods) s += effectiveValue(wbs, p.period_id, "AC");
    return s;
  }

  const showRowTotal = mode === "budget" || mode === "forecast";
  const showProjectTotals = mode === "budget" || mode === "forecast";
  const showProgressTotals = mode === "progress" && !!progressDouble;

  const baseRowsForTotals = rowsForTotals ?? rows;

  const totalsTop = useMemo(() => {
    if (!showProjectTotals) return { orig: 0, soc: 0, both: 0 };

    if (mode === "forecast") {
      let total = 0;
      for (const r of baseRowsForTotals) {
        for (const p of periods) {
          total += effectiveValue(r.wbs_code, p.period_id, "AMOUNT");
        }
      }
      return { orig: total, soc: 0, both: total };
    }

    let orig = 0;
    let soc = 0;

    for (const r of baseRowsForTotals) {
      for (const p of periods) {
        orig += effectiveValue(r.wbs_code, p.period_id, "ORIG");
        soc += effectiveValue(r.wbs_code, p.period_id, "SOC");
      }
    }
    return { orig, soc, both: orig + soc };
  }, [showProjectTotals, mode, baseRowsForTotals, periods, latest, draft]);

  const progressTop = useMemo(() => {
    if (!showProgressTotals) return { evPct: 0, ac: 0 };

    let ac = 0;

    let totalBudget = 0;
    let weightedEv = 0;

    let sumEv = 0;
    let cntEv = 0;

    for (const r of baseRowsForTotals) {
      const wbs = r.wbs_code;

      const ev = lastNonEmptyPct(wbs);
      const acW = sumAc(wbs);
      ac += acW;

      let b = 0;
      for (const p of periods) {
        b += budgetValue(wbs, p.period_id, "ORIG") + budgetValue(wbs, p.period_id, "SOC");
      }

      if (b > 0) {
        totalBudget += b;
        weightedEv += ev * b;
      } else {
        sumEv += ev;
        cntEv += 1;
      }
    }

    const evPct = totalBudget > 0 ? weightedEv / totalBudget : cntEv > 0 ? sumEv / cntEv : 0;

    return { evPct, ac };
  }, [showProgressTotals, baseRowsForTotals, periods, latest, draft, budgetLatest]);

  function rowTotal(r: Row): number {
    const c = mode === "forecast" ? "AMOUNT" : budgetClass || "ORIG";
    let s = 0;
    for (const p of periods) s += effectiveValue(r.wbs_code, p.period_id, c);
    return s;
  }

  return (
    <div className="panel-inner" style={{ padding: 12, overflow: "hidden", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>{title}</div>
        <div className="muted" style={{ fontWeight: 800, marginLeft: "auto" }}>
          {rows.length} filas
        </div>
      </div>

      {projectLabel ? (
        <div className="muted" style={{ marginTop: 6, fontWeight: 900, opacity: 0.95 }}>
          {projectLabel}
        </div>
      ) : null}

      {showProjectTotals ? (
        <div style={{ marginTop: 10, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {mode === "budget" ? (
            <>
              <div className="panel-inner" style={{ padding: "8px 10px" }}>
                <span className="muted" style={{ fontWeight: 900, marginRight: 8 }}>
                  Total ORIG:
                </span>
                <span style={{ fontWeight: 900 }}>{fmtMoney(totalsTop.orig)}</span>
              </div>

              <div className="panel-inner" style={{ padding: "8px 10px" }}>
                <span className="muted" style={{ fontWeight: 900, marginRight: 8 }}>
                  Total SOC:
                </span>
                <span style={{ fontWeight: 900 }}>{fmtMoney(totalsTop.soc)}</span>
              </div>

              <div className="panel-inner" style={{ padding: "8px 10px" }}>
                <span className="muted" style={{ fontWeight: 900, marginRight: 8 }}>
                  Total Proyecto:
                </span>
                <span style={{ fontWeight: 900 }}>{fmtMoney(totalsTop.both)}</span>
              </div>
            </>
          ) : (
            <div className="panel-inner" style={{ padding: "8px 10px" }}>
              <span className="muted" style={{ fontWeight: 900, marginRight: 8 }}>
                Total Proyecto:
              </span>
              <span style={{ fontWeight: 900 }}>{fmtMoney(totalsTop.both)}</span>
            </div>
          )}
        </div>
      ) : null}

      {showProgressTotals ? (
        <div style={{ marginTop: 10, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="panel-inner" style={{ padding: "8px 10px" }}>
            <span className="muted" style={{ fontWeight: 900, marginRight: 8 }}>
              EV% Proyecto:
            </span>
            <span style={{ fontWeight: 900 }}>{fmtPct(progressTop.evPct)}%</span>
          </div>

          <div className="panel-inner" style={{ padding: "8px 10px" }}>
            <span className="muted" style={{ fontWeight: 900, marginRight: 8 }}>
              AC Proyecto:
            </span>
            <span style={{ fontWeight: 900 }}>{fmtMoney(progressTop.ac)}</span>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 10, maxWidth: "100%", overflowX: "auto", overflowY: "hidden", paddingBottom: 8 }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "max-content" }}>
          <thead>
            <tr>
              <th
                style={{
                  position: "sticky",
                  left: 0,
                  zIndex: 3,
                  background: "var(--panel2)",
                  borderBottom: "1px solid var(--border)",
                  padding: "10px 10px",
                  textAlign: "left",
                  fontWeight: 900,
                  width: LEFT_W,
                  minWidth: LEFT_W,
                }}
              >
                WBS
              </th>

              {periods.map((p) => (
                <th
                  key={p.period_id}
                  colSpan={cols.length}
                  style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                    background: "rgba(0,0,0,.22)",
                    borderBottom: "1px solid var(--border)",
                    padding: "10px 10px",
                    textAlign: "center",
                    fontWeight: 900,
                    width: CELL_W * cols.length,
                    minWidth: CELL_W * cols.length,
                  }}
                >
                  {p.label}
                </th>
              ))}

              {showRowTotal ? (
                <th
                  style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                    background: "rgba(0,0,0,.22)",
                    borderBottom: "1px solid var(--border)",
                    padding: "10px 10px",
                    textAlign: "center",
                    fontWeight: 900,
                    width: TOTAL_W,
                    minWidth: TOTAL_W,
                  }}
                >
                  TOTAL
                </th>
              ) : null}

              {showProgressTotals ? (
                <>
                  <th
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      background: "rgba(0,0,0,.22)",
                      borderBottom: "1px solid var(--border)",
                      padding: "10px 10px",
                      textAlign: "center",
                      fontWeight: 900,
                      width: EVLAST_W,
                      minWidth: EVLAST_W,
                    }}
                  >
                    EV% (último)
                  </th>
                  <th
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                      background: "rgba(0,0,0,.22)",
                      borderBottom: "1px solid var(--border)",
                      padding: "10px 10px",
                      textAlign: "center",
                      fontWeight: 900,
                      width: ACTOTAL_W,
                      minWidth: ACTOTAL_W,
                    }}
                  >
                    AC (total)
                  </th>
                </>
              ) : null}
            </tr>

            {cols.length > 1 ? (
              <tr>
                <th
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 3,
                    background: "var(--panel2)",
                    borderBottom: "1px solid rgba(191,231,255,.12)",
                    padding: "8px 10px",
                    textAlign: "left",
                    fontWeight: 900,
                    width: LEFT_W,
                    minWidth: LEFT_W,
                  }}
                >
                  &nbsp;
                </th>

                {periods.map((p) =>
                  cols.map((c) => (
                    <th
                      key={`${p.period_id}-${c}`}
                      style={{
                        background: "rgba(0,0,0,.18)",
                        borderBottom: "1px solid rgba(191,231,255,.12)",
                        padding: "8px 10px",
                        textAlign: "center",
                        fontWeight: 900,
                        width: CELL_W,
                        minWidth: CELL_W,
                      }}
                    >
                      {c === "EV_PCT" ? "EV%" : c}
                    </th>
                  ))
                )}

                {showRowTotal ? (
                  <th
                    style={{
                      background: "rgba(0,0,0,.18)",
                      borderBottom: "1px solid rgba(191,231,255,.12)",
                      padding: "8px 10px",
                      textAlign: "center",
                      fontWeight: 900,
                      width: TOTAL_W,
                      minWidth: TOTAL_W,
                    }}
                  >
                    &nbsp;
                  </th>
                ) : null}

                {showProgressTotals ? (
                  <>
                    <th
                      style={{
                        background: "rgba(0,0,0,.18)",
                        borderBottom: "1px solid rgba(191,231,255,.12)",
                        padding: "8px 10px",
                        textAlign: "center",
                        fontWeight: 900,
                        width: EVLAST_W,
                        minWidth: EVLAST_W,
                      }}
                    >
                      &nbsp;
                    </th>
                    <th
                      style={{
                        background: "rgba(0,0,0,.18)",
                        borderBottom: "1px solid rgba(191,231,255,.12)",
                        padding: "8px 10px",
                        textAlign: "center",
                        fontWeight: 900,
                        width: ACTOTAL_W,
                        minWidth: ACTOTAL_W,
                      }}
                    >
                      &nbsp;
                    </th>
                  </>
                ) : null}
              </tr>
            ) : null}
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="muted"
                  style={{ padding: 12 }}
                  colSpan={1 + periods.length * cols.length + (showRowTotal ? 1 : 0) + (showProgressTotals ? 2 : 0)}
                >
                  Selecciona un proyecto o WBS.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const rt = showRowTotal ? rowTotal(r) : 0;
                const evLast = showProgressTotals ? lastNonEmptyPct(r.wbs_code) : 0;
                const acTot = showProgressTotals ? sumAc(r.wbs_code) : 0;

                return (
                  <tr key={r.wbs_code}>
                    <td
                      style={{
                        position: "sticky",
                        left: 0,
                        zIndex: 2,
                        background: "var(--panel2)",
                        borderBottom: "1px solid rgba(191,231,255,.10)",
                        padding: "10px 10px",
                        width: LEFT_W,
                        minWidth: LEFT_W,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 900,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={`${r.wbs_code} — ${r.wbs_name}`}
                      >
                        {r.wbs_code} — {r.wbs_name}
                      </div>
                    </td>

                    {periods.map((p) =>
                      cols.map((c) => {
                        const k = keyOf(r.wbs_code, p.period_id, c);
                        const hint = latest[k] ?? null;
                        const val = Object.prototype.hasOwnProperty.call(draft, k) ? draft[k] : "";
                        const cellMode = c === "EV_PCT" ? "pct" : "money";

                        return (
                          <td
                            key={k}
                            style={{
                              borderBottom: "1px solid rgba(191,231,255,.10)",
                              padding: 6,
                              width: CELL_W,
                              minWidth: CELL_W,
                            }}
                          >
                            <CellInput mode={cellMode} value={val} hint={hint} onChange={(v) => onChangeDraft(k, v)} />
                          </td>
                        );
                      })
                    )}

                    {showRowTotal ? (
                      <td
                        style={{
                          borderBottom: "1px solid rgba(191,231,255,.10)",
                          padding: "6px 10px",
                          width: TOTAL_W,
                          minWidth: TOTAL_W,
                          textAlign: "right",
                          fontWeight: 900,
                          whiteSpace: "nowrap",
                        }}
                        title={String(rt)}
                      >
                        {fmtMoney(rt)}
                      </td>
                    ) : null}

                    {showProgressTotals ? (
                      <>
                        <td
                          style={{
                            borderBottom: "1px solid rgba(191,231,255,.10)",
                            padding: "6px 10px",
                            width: EVLAST_W,
                            minWidth: EVLAST_W,
                            textAlign: "right",
                            fontWeight: 900,
                            whiteSpace: "nowrap",
                          }}
                          title={String(evLast)}
                        >
                          {fmtPct(evLast)}%
                        </td>
                        <td
                          style={{
                            borderBottom: "1px solid rgba(191,231,255,.10)",
                            padding: "6px 10px",
                            width: ACTOTAL_W,
                            minWidth: ACTOTAL_W,
                            textAlign: "right",
                            fontWeight: 900,
                            whiteSpace: "nowrap",
                          }}
                          title={String(acTot)}
                        >
                          {fmtMoney(acTot)}
                        </td>
                      </>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <SaveBar
        dirtyCount={pending.length}
        isSaving={saving}
        lastSavedAt={lastSavedAt}
        error={err}
        onSave={handleSave}
        onReset={onResetDraft}
      />
    </div>
  );
}
