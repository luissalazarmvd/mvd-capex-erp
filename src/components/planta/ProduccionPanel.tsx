// src/components/planta/ProduccionPanel.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";

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
  { code: "DENSITY_OF", label: "Densidad (g/l)", kind: "nonneg" as const },
  { code: "PCT_200", label: "%-m-200 (1–100)", kind: "pct" as const },
  { code: "NACN_OF", label: "%NaCN OF (1–100)", kind: "pct" as const },
  { code: "NACN_ADS", label: "%NaCN TK1 (1–100)", kind: "pct" as const },
  { code: "NACN_TAIL", label: "%NaCN TK11 (1–100)", kind: "pct" as const },
  { code: "PH_OF", label: "pH OF (1–14)", kind: "ph" as const },
  { code: "PH_ADS", label: "pH TK1 (1–14)", kind: "ph" as const },
  { code: "PH_TAIL", label: "pH TK11 (1–14)", kind: "ph" as const },
] as const;

type VarCode = (typeof VARS)[number]["code"];

function toNumOrNaN(s: string) {
  if (s === null || s === undefined) return NaN;
  const t = String(s).trim().replace(",", ".");
  if (!t) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function fmt(v: number | null, digits = 3) {
  if (v === null || !Number.isFinite(v)) return "—";
  const p = Math.pow(10, digits);
  return String(Math.round(v * p) / p);
}

function isShiftId(s: string) {
  return /^\d{8}-[AB]$/.test(String(s || "").trim().toUpperCase());
}

// 12 filas (1..12)
function blank12() {
  return Array.from({ length: 12 }, () => "");
}

function cellIsEmptyOrZero(s: string) {
  const t = String(s ?? "").trim();
  if (!t) return true;
  const n = toNumOrNaN(t);
  return !Number.isFinite(n) || n === 0;
}

function validateCell(kind: "nonneg" | "pct" | "ph", s: string): boolean {
  const t = String(s ?? "").trim();
  if (!t) return true; // vacío permitido
  const n = toNumOrNaN(t);
  if (!Number.isFinite(n)) return false;
  if (n === 0) return true; // 0 = no se manda (lo tratamos como "vacío")
  if (kind === "nonneg") return n >= 0;
  if (kind === "pct") return n >= 1 && n <= 100;
  if (kind === "ph") return n >= 1 && n <= 14;
  return false;
}

// Regla secuencial: no puedes llenar fila i si la anterior está vacía/0
function validateSequentialColumn(kind: "nonneg" | "pct" | "ph", arr: string[]) {
  let seenEmpty = false;
  for (let i = 0; i < 12; i++) {
    const s = String(arr[i] ?? "");
    const emptyOrZero = cellIsEmptyOrZero(s);

    // Validación rango/formato
    if (!validateCell(kind, s)) {
      return { ok: false, firstGapAt: null as number | null, firstInvalidAt: i + 1 };
    }

    if (emptyOrZero) {
      seenEmpty = true;
      continue;
    }

    // si esta fila tiene valor y ya vimos un vacío/0 antes => gap
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
    if (!s) break; // secuencial: al primer vacío cortamos
    const n = toNumOrNaN(s);
    if (!Number.isFinite(n) || n === 0) break; // 0 = no se manda => corta
    vals.push(n);
  }
  if (!vals.length) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  return sum / vals.length;
}

export default function ProduccionPanel({ shiftId }: { shiftId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);

  const sid = useMemo(() => String(shiftId || "").trim().toUpperCase(), [shiftId]);

  // matriz: var_code -> 12 strings
  const [mat, setMat] = useState<Record<VarCode, string[]>>(() => {
    const o: any = {};
    for (const v of VARS) o[v.code] = blank12();
    return o;
  });

  // promedios (display)
  const avgs = useMemo(() => {
    const o: Record<VarCode, number | null> = {} as any;
    for (const v of VARS) o[v.code] = computeAvgFromColumn(mat[v.code] || []);
    return o;
  }, [mat]);

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

            // Guardamos como string tal cual (sin forzar decimales)
            next[v.code][k - 1] = String(n);
          }
        } catch {
          // si un var falla, igual cargamos lo demás
        }
      }

      setMat(next);
    } catch {
      // silencioso como venías manejando
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

  // validación global: rangos + secuencial por columna
  const colStatus = useMemo(() => {
    const o: Record<VarCode, { ok: boolean; firstGapAt: number | null; firstInvalidAt: number | null }> = {} as any;
    for (const v of VARS) o[v.code] = validateSequentialColumn(v.kind, mat[v.code] || []);
    return o;
  }, [mat]);

  const allValid = useMemo(() => {
    if (!sid || !isShiftId(sid)) return false;
    return VARS.every((v) => colStatus[v.code]?.ok);
  }, [sid, colStatus]);

  const canSave = useMemo(() => allValid && !saving, [allValid, saving]);

  function buildItems(varCode: VarCode) {
    const arr = mat[varCode] || blank12();
    const items: { sample_no: number; val: number }[] = [];

    // Por regla secuencial, mandamos desde 1 hasta el primer vacío/0
    for (let i = 0; i < 12; i++) {
      const s = String(arr[i] ?? "").trim();
      if (!s) break;
      const n = toNumOrNaN(s);
      if (!Number.isFinite(n) || n === 0) break;
      items.push({ sample_no: i + 1, val: n });
    }

    return items;
  }

  function pctToDecimalOrNull(avg: number | null) {
    if (avg === null) return null;
    if (!Number.isFinite(avg)) return null;
    if (avg < 1 || avg > 100) return null;
    return avg / 100;
  }

  async function onSave() {
    if (!sid || !isShiftId(sid)) {
      setMsg("ERROR: shift_id inválido");
      return;
    }

    // refuerzo: no guardes si hay gaps/invalids
    if (!allValid) {
      setMsg("ERROR: corrige celdas inválidas o saltos de fila (debe ser secuencial).");
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      // 1) replace por variable
      for (const v of VARS) {
        const items = buildItems(v.code);
        const payload = { shift_id: sid, var_code: v.code, items };

        const rr = (await apiPost("/api/planta/production/replace", payload)) as ReplaceResp;
        if (!rr?.ok) throw new Error(rr?.error || `Error guardando ${v.code}`);
      }

      // 2) upsert de promedios (stg.plant_facts) usando tu endpoint existente
      const payloadFacts = {
        shift_id: sid,
        density_of: avgs.DENSITY_OF,
        pct_200: pctToDecimalOrNull(avgs.PCT_200),
        nacn_of: pctToDecimalOrNull(avgs.NACN_OF),
        nacn_ads: pctToDecimalOrNull(avgs.NACN_ADS),
        nacn_tail: pctToDecimalOrNull(avgs.NACN_TAIL),
        ph_of: avgs.PH_OF,
        ph_ads: avgs.PH_ADS,
        ph_tail: avgs.PH_TAIL,
      };

      await apiPost("/api/planta/produccion/upsert", payloadFacts);

      setMsg(`OK: guardado ${sid} · Producción (matriz + promedios)`);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando producción");
    } finally {
      setSaving(false);
    }
  }

  // estilos simples tipo matriz (no “Inputs con hint”)
  const cellStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 10,
    background: "rgba(255,255,255,.04)",
    outline: "none",
    fontWeight: 800,
  };

  const headerCell: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.9,
    padding: "6px 6px 10px 6px",
  };

  const subNote: React.CSSProperties = { fontSize: 11, fontWeight: 800, opacity: 0.75 };

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 1180 }}>
      <div className="panel-inner" style={{ padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Producción</div>

        <div className="muted" style={{ fontWeight: 800, marginLeft: 8 }}>
          Guardia: {sid || "—"}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => sid && loadExisting(sid)}
            disabled={!sid || loadingExisting || saving}
          >
            {loadingExisting ? "Cargando..." : "Refrescar"}
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
            padding: 12,
            border: msg.startsWith("OK") ? "1px solid rgba(102,199,255,.45)" : "1px solid rgba(255,80,80,.45)",
            background: msg.startsWith("OK") ? "rgba(102,199,255,.10)" : "rgba(255,80,80,.10)",
            fontWeight: 800,
          }}
        >
          {msg}
        </div>
      ) : null}

      <div className="panel-inner" style={{ padding: 14 }}>
        {!sid ? (
          <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
            Selecciona una guardia en el page.
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 10 }}>
          {/* encabezados */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `70px repeat(${VARS.length}, minmax(140px, 1fr))`,
              gap: 10,
              alignItems: "end",
            }}
          >
            <div style={headerCell}>#</div>
            {VARS.map((v) => {
              const st = colStatus[v.code];
              const hasErr = sid && !st.ok;
              const errText = hasErr
                ? st.firstInvalidAt
                  ? `Inválido en fila ${st.firstInvalidAt}`
                  : st.firstGapAt
                  ? `Salto en fila ${st.firstGapAt}`
                  : "Revisa valores"
                : " ";

              return (
                <div key={v.code} style={{ ...headerCell }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                    <div>{v.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.9 }}>Prom: {fmt(avgs[v.code], 3)}</div>
                  </div>
                  <div style={{ ...subNote, color: hasErr ? "rgba(255,120,120,.95)" : "rgba(255,255,255,.55)" }}>
                    {hasErr ? errText : "Secuencial (sin saltos) · 0/vacío = no se manda"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* filas 1..12 */}
          {Array.from({ length: 12 }).map((_, rIdx) => (
            <div
              key={rIdx}
              style={{
                display: "grid",
                gridTemplateColumns: `70px repeat(${VARS.length}, minmax(140px, 1fr))`,
                gap: 10,
                alignItems: "center",
              }}
            >
              <div className="muted" style={{ fontWeight: 900, textAlign: "center" }}>
                {rIdx + 1}
              </div>

              {VARS.map((v) => {
                const value = mat[v.code]?.[rIdx] ?? "";
                const st = colStatus[v.code];
                const invalidCell = !validateCell(v.kind, value);

                // bloqueo suave: si hay gap, no dejes editar filas posteriores al gap (para guiar al usuario)
                // (igual la validación ya evita guardar)
                let disabled = !sid || saving || loadingExisting;
                if (sid && st && !st.ok && st.firstGapAt && rIdx + 1 >= st.firstGapAt) {
                  // deja editar la fila del gap para corregir, pero bloquea después
                  disabled = disabled || (rIdx + 1 > st.firstGapAt);
                }

                return (
                  <input
                    key={v.code}
                    value={value}
                    disabled={disabled}
                    onChange={(e) => setCell(v.code, rIdx, e.target.value)}
                    inputMode="decimal"
                    placeholder=""
                    style={{
                      ...cellStyle,
                      border: invalidCell
                        ? "1px solid rgba(255,80,80,.55)"
                        : "1px solid rgba(255,255,255,.10)",
                      background: invalidCell ? "rgba(255,80,80,.08)" : "rgba(255,255,255,.04)",
                    }}
                  />
                );
              })}
            </div>
          ))}

          {loadingExisting ? (
            <div className="muted" style={{ fontWeight: 800 }}>
              Cargando datos existentes…
            </div>
          ) : null}

          {/* feedback promedios (extra) */}
          <div
            className="muted"
            style={{
              marginTop: 6,
              fontSize: 12,
              fontWeight: 800,
              opacity: 0.9,
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ fontWeight: 900 }}>Promedios actuales (lo que se manda a stg.plant_facts):</div>
            <div style={{ display: "grid", gap: 4 }}>
              <div>
                Densidad: <span style={{ fontWeight: 900 }}>{fmt(avgs.DENSITY_OF, 3)}</span>
              </div>
              <div>
                %-m-200: <span style={{ fontWeight: 900 }}>{fmt(avgs.PCT_200, 3)}</span> (se guarda como{" "}
                <span style={{ fontWeight: 900 }}>{fmt(pctToDecimalOrNull(avgs.PCT_200) as any, 6)}</span>)
              </div>
              <div>
                NaCN OF/TK1/TK11:{" "}
                <span style={{ fontWeight: 900 }}>
                  {fmt(avgs.NACN_OF, 3)} / {fmt(avgs.NACN_ADS, 3)} / {fmt(avgs.NACN_TAIL, 3)}
                </span>{" "}
                (se guarda como decimales 0–1)
              </div>
              <div>
                pH OF/TK1/TK11:{" "}
                <span style={{ fontWeight: 900 }}>
                  {fmt(avgs.PH_OF, 3)} / {fmt(avgs.PH_ADS, 3)} / {fmt(avgs.PH_TAIL, 3)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
