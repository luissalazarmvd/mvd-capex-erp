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

  periods: Period[];
  rows: Row[];

  // key: `${wbs_code}|${period_id}|${col}`
  latest: Record<string, string | null>;
  draft: Record<string, string>;

  // Budget
  budgetClass?: "ORIG" | "SOC";

  // Progress
  progressDouble?: boolean;

  onChangeDraft: (key: string, value: string) => void;
  onSave: (rows: { key: string; value: string }[]) => Promise<void>;
  onResetDraft?: () => void;
};

function keyOf(wbs: string, period_id: number, col: string) {
  return `${wbs}|${period_id}|${col}`;
}

export function WbsMatrix({
  mode,
  title,
  periods,
  rows,
  latest,
  draft,
  budgetClass,
  progressDouble,
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
      setLastSavedAt(new Date().toLocaleString());
    } catch (e: any) {
      setErr(e?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel-inner" style={{ padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 900 }}>{title}</div>
        <div className="muted" style={{ fontWeight: 800, marginLeft: "auto" }}>
          {rows.length} filas
        </div>
      </div>

      <div style={{ marginTop: 10, overflow: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            minWidth: 920,
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  position: "sticky",
                  left: 0,
                  zIndex: 3,
                  background: "rgba(0,0,0,.22)",
                  borderBottom: "1px solid var(--border)",
                  padding: "10px 10px",
                  textAlign: "left",
                  fontWeight: 900,
                  minWidth: 340,
                }}
              >
                Proyecto / WBS
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
                    minWidth: 140 * cols.length,
                  }}
                >
                  {p.label}
                </th>
              ))}
            </tr>

            {cols.length > 1 ? (
              <tr>
                <th
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 3,
                    background: "rgba(0,0,0,.18)",
                    borderBottom: "1px solid rgba(191,231,255,.12)",
                    padding: "8px 10px",
                    textAlign: "left",
                    fontWeight: 900,
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
                        minWidth: 140,
                      }}
                    >
                      {c === "EV_PCT" ? "EV%" : c}
                    </th>
                  ))
                )}
              </tr>
            ) : null}
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="muted"
                  style={{ padding: 12 }}
                  colSpan={1 + periods.length * cols.length}
                >
                  Selecciona un proyecto o WBS.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.wbs_code}>
                  <td
                    style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 2,
                      background: "rgba(0,0,0,.14)",
                      borderBottom: "1px solid rgba(191,231,255,.10)",
                      padding: "10px 10px",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>
                      {r.project_code} — {r.project_name}
                    </div>
                    <div className="muted" style={{ fontWeight: 800, marginTop: 2 }}>
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
                            minWidth: 140,
                          }}
                        >
                          <CellInput
                            mode={cellMode}
                            value={val}
                            hint={hint}
                            onChange={(v) => onChangeDraft(k, v)}
                          />
                        </td>
                      );
                    })
                  )}
                </tr>
              ))
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
