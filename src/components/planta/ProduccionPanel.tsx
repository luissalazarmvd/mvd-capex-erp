// src/components/planta/ProduccionPanel.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

type DetRow = {
  shift_id: string;
  var_code: string;
  sample_no: number;
  val: any;
  updated_at: any;
};

type DetResp = { ok: boolean; shift_id: string; var_code: string; rows: DetRow[]; error?: string };
type ReplaceResp = { ok: boolean; shift_id: string; var_code: string; inserted: number; error?: string };

const VARS = [
  { code: "density_of", label: "Densidad (g/l)", kind: "nonneg" as const },
  { code: "pct_200", label: "%-m-200 (1-100)", kind: "pct" as const },
  { code: "nacn_of", label: "NaCN OF (1-12)", kind: "pct" as const },
  { code: "nacn_ads", label: "NaCN TK1 (1-12)", kind: "pct" as const },
  { code: "nacn_tail", label: "NaCN TK11 (1-12)", kind: "pct" as const },
  { code: "ph_of", label: "pH OF", kind: "ph" as const },
  { code: "ph_ads", label: "pH TK1", kind: "ph" as const },
  { code: "ph_tail", label: "pH TK11", kind: "ph" as const },
] as const;

type VarCode = (typeof VARS)[number]["code"];
type Kind = (typeof VARS)[number]["kind"];

function toNumOrNaN(s: string) {
  if (s === null || s === undefined) return NaN;
  const t = String(s).trim().replace(",", ".");
  if (!t) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function isShiftId(s: string) {
  return /^\d{8}-[AB]$/.test(String(s || "").trim().toUpperCase());
}

function blank12() {
  return Array.from({ length: 12 }, () => "");
}

function cellIsEmptyOrZero(s: string) {
  const t = String(s ?? "").trim();
  if (!t) return true;
  const n = toNumOrNaN(t);
  return !Number.isFinite(n) || n === 0;
}

function validateCell(kind: Kind, s: string): boolean {
  const t = String(s ?? "").trim();
  if (!t) return true;
  const n = toNumOrNaN(t);
  if (!Number.isFinite(n)) return false;
  if (n === 0) return true;
  if (kind === "nonneg") return n >= 0;
  if (kind === "pct") return n >= 1 && n <= 100;
  if (kind === "ph") return n >= 1 && n <= 14;
  return false;
}

function validateSequentialColumn(kind: Kind, arr: string[]) {
  let seenEmpty = false;
  for (let i = 0; i < 12; i++) {
    const s = String(arr[i] ?? "");
    const emptyOrZero = cellIsEmptyOrZero(s);

    if (!validateCell(kind, s)) {
      return { ok: false, firstGapAt: null as number | null, firstInvalidAt: i + 1 };
    }

    if (emptyOrZero) {
      seenEmpty = true;
      continue;
    }

    if (seenEmpty) {
      return { ok: false, firstGapAt: i + 1, firstInvalidAt: null as number | null };
    }
  }
  return { ok: true, firstGapAt: null as number | null, firstInvalidAt: null as number | null };
}

function computeAvgFromColumn(arr: string[]) {
  const vals: number[] = [];
  for (let i = 0; i < 12; i++) {
    const s = String(arr[i] ?? "").trim();
    if (!s) break;
    const n = toNumOrNaN(s);
    if (!Number.isFinite(n) || n === 0) break;
    vals.push(n);
  }
  if (!vals.length) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  return sum / vals.length;
}

function fmtAvg(v: number | null, digits = 2) {
  if (v === null || !Number.isFinite(v)) return "";
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function pctToDecimalOrNull(avg: number | null) {
  if (avg === null) return null;
  if (!Number.isFinite(avg)) return null;
  if (avg < 1 || avg > 100) return null;
  return avg / 100;
}

function nacnAvgToUi(avg: number | null) {
  if (avg === null || !Number.isFinite(avg)) return null;
  return avg * 100;
}

function nacnUiToDbOrNull(avgUi: number | null) {
  if (avgUi === null || !Number.isFinite(avgUi)) return null;
  if (avgUi < 1 || avgUi > 100) return null;
  return avgUi / 100;
}

type FactsHeader = Partial<Record<VarCode, any>>;

function numOrNull(v: any): number | null {
  const n = typeof v === "number" ? v : toNumOrNaN(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
}

export default function ProduccionPanel({ shiftId, facts }: { shiftId: string; facts?: FactsHeader | null }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);

  const sid = useMemo(() => String(shiftId || "").trim().toUpperCase(), [shiftId]);

  const [mat, setMat] = useState<Record<VarCode, string[]>>(() => {
    const o: any = {};
    for (const v of VARS) o[v.code] = blank12();
    return o;
  });

  const avgsRaw = useMemo(() => {
    const o: Record<VarCode, number | null> = {} as any;
    for (const v of VARS) o[v.code] = computeAvgFromColumn(mat[v.code] || []);
    return o;
  }, [mat]);

  const avgsUi = useMemo(() => {
    const o: Record<VarCode, number | null> = {} as any;
    for (const v of VARS) {
      const raw = avgsRaw[v.code];
      if (v.code === "nacn_of" || v.code === "nacn_ads" || v.code === "nacn_tail") o[v.code] = nacnAvgToUi(raw);
      else o[v.code] = raw;
    }
    return o;
  }, [avgsRaw]);

  const avgsDisplay = useMemo(() => {
    const o: Record<VarCode, number | null> = {} as any;

    for (const v of VARS) {
      const fromDet = avgsUi[v.code];
      if (fromDet !== null && Number.isFinite(fromDet as any)) {
        o[v.code] = fromDet;
        continue;
      }

      const fv = numOrNull((facts as any)?.[v.code]);
      if (fv === null) {
        o[v.code] = null;
        continue;
      }

      if (v.code === "pct_200" || v.code === "nacn_of" || v.code === "nacn_ads" || v.code === "nacn_tail") {
        o[v.code] = fv * 100;
      } else {
        o[v.code] = fv;
      }
    }

    return o;
  }, [avgsUi, facts]);

  const hasAnyData = useMemo(() => {
    for (const v of VARS) {
      const arr = mat[v.code] || [];
      for (let i = 0; i < arr.length; i++) {
        const s = String(arr[i] ?? "").trim();
        if (!s) continue;
        const n = toNumOrNaN(s);
        if (Number.isFinite(n) && n !== 0) return true;
      }
    }
    return false;
  }, [mat]);

  const colStatus = useMemo(() => {
    const o: Record<VarCode, { ok: boolean; firstGapAt: number | null; firstInvalidAt: number | null }> = {} as any;
    for (const v of VARS) o[v.code] = validateSequentialColumn(v.kind, mat[v.code] || []);
    return o;
  }, [mat]);

  const allValid = useMemo(() => {
    if (!sid || !isShiftId(sid)) return false;
    if (!hasAnyData) return false;
    return VARS.every((v) => colStatus[v.code]?.ok);
  }, [sid, colStatus, hasAnyData]);

  const canSave = useMemo(() => allValid && !saving, [allValid, saving]);

  function clearAll() {
    setMat(() => {
      const o: any = {};
      for (const v of VARS) o[v.code] = blank12();
      return o;
    });
  }

  function setCell(varCode: VarCode, idx: number, value: string) {
    setMat((prev) => {
      const next = { ...prev };
      const arr = [...(next[varCode] || blank12())];
      arr[idx] = value;
      next[varCode] = arr;
      return next;
    });
  }

  async function loadExisting(nextSid: string) {
    if (!nextSid || !isShiftId(nextSid)) {
      clearAll();
      return;
    }

    setLoadingExisting(true);
    setMsg(null);

    try {
      const next: Record<VarCode, string[]> = {} as any;

      for (const v of VARS) {
        next[v.code] = blank12();

        try {
          const r = (await apiGet(
            `/api/planta/production/det?shift_id=${encodeURIComponent(nextSid)}&var_code=${encodeURIComponent(v.code)}`
          )) as DetResp;

          const rows = Array.isArray(r.rows) ? r.rows : [];
          for (const row of rows) {
            const k = Number(row.sample_no);
            if (!Number.isInteger(k) || k < 1 || k > 12) continue;

            const raw = row.val;
            const n = typeof raw === "number" ? raw : toNumOrNaN(String(raw));
            if (!Number.isFinite(n)) continue;

            if (v.code === "nacn_of" || v.code === "nacn_ads" || v.code === "nacn_tail") {
              next[v.code][k - 1] = String(n * 100);
            } else {
              next[v.code][k - 1] = String(n);
            }
          }
        } catch {}
      }

      setMat(next);
    } finally {
      setLoadingExisting(false);
    }
  }

  useEffect(() => {
    if (!sid) {
      clearAll();
      setMsg(null);
      return;
    }
    loadExisting(sid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid]);

  function buildItems(varCode: VarCode) {
    const arr = mat[varCode] || blank12();
    const items: { sample_no: number; val: number }[] = [];

    const isNacn = varCode === "nacn_of" || varCode === "nacn_ads" || varCode === "nacn_tail";

    for (let i = 0; i < 12; i++) {
      const s = String(arr[i] ?? "").trim();
      if (!s) break;

      const nUi = toNumOrNaN(s);
      if (!Number.isFinite(nUi) || nUi === 0) break;

      const nDb = isNacn ? nUi / 100 : nUi;
      items.push({ sample_no: i + 1, val: nDb });
    }

    return items;
  }

  async function onSave() {
    if (!sid || !isShiftId(sid)) {
      setMsg("ERROR: shift_id inválido");
      return;
    }

    if (!allValid) {
      setMsg("ERROR: corrige celdas inválidas o saltos de fila.");
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      for (const v of VARS) {
        const payload = { shift_id: sid, var_code: v.code, items: buildItems(v.code) };
        const rr = (await apiPost("/api/planta/production/replace", payload)) as ReplaceResp;
        if (!rr?.ok) throw new Error(rr?.error || `Error guardando ${v.code}`);
      }

      const payloadFacts = {
        shift_id: sid,
        density_of: avgsUi.density_of,
        pct_200: pctToDecimalOrNull(avgsUi.pct_200),
        nacn_of: nacnUiToDbOrNull(avgsUi.nacn_of),
        nacn_ads: nacnUiToDbOrNull(avgsUi.nacn_ads),
        nacn_tail: nacnUiToDbOrNull(avgsUi.nacn_tail),
        ph_of: avgsUi.ph_of,
        ph_ads: avgsUi.ph_ads,
        ph_tail: avgsUi.ph_tail,
      };

      await apiPost("/api/planta/produccion/upsert", payloadFacts);

      setMsg(`OK: guardado ${sid} · Producción`);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando producción");
    } finally {
      setSaving(false);
    }
  }

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
    padding: "6px 8px",
    fontSize: 12,
    lineHeight: "14px",
    whiteSpace: "nowrap",
  };

  const numCell: React.CSSProperties = { ...cellBase, textAlign: "right" };

  const inputCell: React.CSSProperties = {
    width: "100%",
    border: "1px solid rgba(191,231,255,.18)",
    background: "rgba(0,0,0,.10)",
    color: "white",
    fontWeight: 900,
    padding: "6px 8px",
    borderRadius: 8,
    outline: "none",
    textAlign: "right",
    fontSize: 12,
    lineHeight: "14px",
  };

  const errInput: React.CSSProperties = {
    border: "1px solid rgba(255,80,80,.55)",
    background: "rgba(255,80,80,.10)",
  };

  const rowBg = "rgba(0,0,0,.10)";

  return (
    <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
      <div className="panel-inner" style={{ padding: "10px 12px", display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Producción</div>

        <div className="muted" style={{ fontWeight: 800, marginLeft: 8 }}>
          Guardia: {sid || "—"}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <Button type="button" size="sm" variant="default" onClick={() => sid && loadExisting(sid)} disabled={!sid || loadingExisting || saving}>
            {loadingExisting ? "Cargando…" : "Refrescar"}
          </Button>
          <Button type="button" size="sm" variant="primary" onClick={onSave} disabled={!canSave}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      {msg ? (
        <div
          className="panel-inner"
          style={{
            padding: 10,
            border: msg.startsWith("OK") ? "1px solid rgba(102,199,255,.45)" : "1px solid rgba(255,80,80,.45)",
            background: msg.startsWith("OK") ? "rgba(102,199,255,.10)" : "rgba(255,80,80,.10)",
            fontWeight: 800,
          }}
        >
          {msg}
        </div>
      ) : null}

      <div className="panel-inner" style={{ padding: 0, overflow: "visible" }}>
        <Table stickyHeader>
          <thead>
            <tr>
              <th className="capex-th" style={{ ...stickyHead, border: headerBorder, borderBottom: headerBorder, textAlign: "center", padding: "8px 8px", fontSize: 12, minWidth: 52 }}>
                #
              </th>

              {VARS.map((v) => {
                const st = colStatus[v.code];
                const hasErr = !!sid && !st.ok;
                const title = hasErr
                  ? st.firstInvalidAt
                    ? `Inválido en fila ${st.firstInvalidAt}`
                    : st.firstGapAt
                    ? `Salto en fila ${st.firstGapAt}`
                    : "Revisa"
                  : "";

                return (
                  <th
                    key={v.code}
                    className="capex-th"
                    style={{
                      ...stickyHead,
                      border: headerBorder,
                      borderBottom: headerBorder,
                      textAlign: "left",
                      padding: "8px 8px",
                      fontSize: 12,
                      minWidth: 140,
                    }}
                    title={title}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                      <div style={{ fontWeight: 900 }}>{v.label}</div>
                      <div style={{ fontWeight: 900, opacity: 0.95 }}>{fmtAvg(avgsDisplay[v.code], 2)}</div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {Array.from({ length: 12 }).map((_, rIdx) => {
              const rowBorder = gridH;

              return (
                <tr key={rIdx} className="capex-tr">
                  <td className="capex-td capex-td-strong" style={{ ...cellBase, borderTop: rowBorder, borderBottom: rowBorder, borderRight: gridV, background: rowBg, textAlign: "center", fontWeight: 900 }}>
                    {rIdx + 1}
                  </td>

                  {VARS.map((v) => {
                    const value = mat[v.code]?.[rIdx] ?? "";
                    const st = colStatus[v.code];
                    const invalidCell = !validateCell(v.kind, value);

                    let disabled = !sid || saving || loadingExisting;
                    if (sid && st && !st.ok && st.firstGapAt && rIdx + 1 >= st.firstGapAt) {
                      disabled = disabled || (rIdx + 1 > st.firstGapAt);
                    }

                    return (
                      <td key={v.code} className="capex-td" style={{ ...numCell, borderTop: rowBorder, borderBottom: rowBorder, borderRight: gridV, background: rowBg, padding: "6px 8px" }}>
                        <input
                          value={value}
                          disabled={disabled}
                          onChange={(e) => setCell(v.code, rIdx, (e.target as any).value)}
                          inputMode="decimal"
                          style={{ ...inputCell, ...(invalidCell ? errInput : {}) }}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {!sid ? (
              <tr className="capex-tr">
                <td className="capex-td" style={{ ...cellBase, fontWeight: 900 }} colSpan={1 + VARS.length}>
                  Selecciona una guardia en el page.
                </td>
              </tr>
            ) : null}

            {sid && !loadingExisting && !allValid ? (
              <tr className="capex-tr">
                <td className="capex-td" style={{ ...cellBase, fontWeight: 900, color: "rgba(255,120,120,.95)" }} colSpan={1 + VARS.length}>
                  Corrige columnas con error (valores inválidos o saltos).
                </td>
              </tr>
            ) : null}

            {loadingExisting ? (
              <tr className="capex-tr">
                <td className="capex-td" style={{ ...cellBase, fontWeight: 900 }} colSpan={1 + VARS.length}>
                  Cargando datos existentes…
                </td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </div>
    </div>
  );
}