// src/components/planta/BolasPanel.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

type GuardiaGetResp = {
  ok: boolean;
  shift_id: string;
  header: any | null;
  consumables: { shift_id: string; reagent_name: string; qty: any }[];
  balls: { shift_id: string; mill: string; reagent_name: any; balls_weight: any }[];
  duration: any[];
};

const MILLS = ["M1", "M2", "M3"] as const;

const BALL_SIZES = [
  `Bola de Acero 1"`,
  `Bola de Acero 1.5"`,
  `Bola de Acero 2"`,
  `Bola de Acero 2.5"`,
  `Bola de Acero 3"`,
  `Bola de Acero 3.5"`,
  `Bola de Acero 4"`,
] as const;

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

function parseShiftIdToQuery(shift_id: string): { date: string; shift: "A" | "B" } | null {
  const s = String(shift_id || "").trim().toUpperCase();
  const m = s.match(/^(\d{8})-([AB])$/);
  if (!m) return null;
  const ymd = m[1];
  const shift = m[2] as "A" | "B";
  const date = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
  if (!isIsoDate(date)) return null;
  return { date, shift };
}

function toDecimalStrOrNullFront(v: string, scale = 18) {
  const s0 = String(v ?? "").trim();
  if (!s0) return null;

  let s = s0.replace(/\s+/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    const decSep = lastComma > lastDot ? "," : ".";
    const thouSep = decSep === "," ? "." : ",";
    s = s.split(thouSep).join("");
    if (decSep === ",") s = s.replace(",", ".");
  } else if (hasComma && !hasDot) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length === 3) s = parts.join("");
    else s = s.replace(",", ".");
  } else {
    const parts = s.split(".");
    if (parts.length > 2) s = parts.join("");
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  if (Math.abs(n) > 9e15) return null;

  const f = Math.pow(10, scale);
  const rounded = Math.round(n * f) / f;
  return rounded.toFixed(scale);
}

function qtyOkNonNeg(v: string) {
  const t = String(v ?? "").trim();
  if (!t) return false;
  const dec = toDecimalStrOrNullFront(t, 18);
  if (dec === null) return false;
  const n = Number(dec);
  return Number.isFinite(n) && n >= 0;
}

function Select({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const currentLabel =
    options.find((o) => o.value === value)?.label ?? options.find((o) => o.value === "")?.label ?? "";

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as any)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  return (
    <div style={{ display: "grid", gap: 6 }} ref={wrapRef}>
      <div style={{ fontWeight: 900, fontSize: 13 }}>{label}</div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((s) => !s)}
        style={{
          width: "100%",
          textAlign: "left",
          background: "rgba(0,0,0,.10)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          borderRadius: 10,
          padding: "10px 12px",
          outline: "none",
          fontWeight: 900,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.7 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span style={{ opacity: value ? 1 : 0.6 }}>{currentLabel}</span>
        <span style={{ opacity: 0.8 }}>▾</span>
      </button>

      {open ? (
        <div style={{ position: "relative", zIndex: 50 }}>
          <div
            style={{
              position: "absolute",
              top: 6,
              left: 0,
              right: 0,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.10)",
              background: "rgba(5, 25, 45, .98)",
              boxShadow: "0 10px 30px rgba(0,0,0,.45)",
              overflow: "hidden",
            }}
          >
            {options.map((o) => {
              const active = o.value === value;
              const isEmpty = o.value === "";
              return (
                <button
                  key={o.value || "__empty__"}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    background: active ? "rgba(102,199,255,.18)" : "transparent",
                    color: isEmpty ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.92)",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as any).style.background = active
                      ? "rgba(102,199,255,.18)"
                      : "rgba(255,255,255,.06)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as any).style.background = active ? "rgba(102,199,255,.18)" : "transparent";
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function BolasPanel({ shiftId }: { shiftId: string }) {
  const [msg, setMsg] = useState<string | null>(null);

  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);

  const sid = useMemo(() => String(shiftId || "").trim().toUpperCase(), [shiftId]);

  const [mill, setMill] = useState<string>("");
  const [size, setSize] = useState<string>("");
  const [weight, setWeight] = useState<string>("");

  const [existingBalls, setExistingBalls] = useState<GuardiaGetResp["balls"]>([]);
  const [isEditingExisting, setIsEditingExisting] = useState(false);

  const canSave = useMemo(() => {
    const m = String(mill || "").trim();
    const sz = String(size || "").trim();
    const okW = qtyOkNonNeg(weight);
    return !!sid && !!m && !!sz && okW && !saving;
  }, [sid, mill, size, weight, saving]);

  const existingMap = useMemo(() => {
    const map = new Map<string, { mill: string; size: string; qty: number }>();
    for (const b of existingBalls || []) {
      const mm = String(b?.mill || "").trim().toUpperCase();
      const sz = b?.reagent_name === null || b?.reagent_name === undefined ? "" : String(b.reagent_name).trim();
      if (!mm || !sz) continue;
      const qtyNum = b?.balls_weight === null || b?.balls_weight === undefined ? NaN : Number(b.balls_weight);
      if (!Number.isFinite(qtyNum)) continue;
      map.set(`${mm}|${sz}`, { mill: mm, size: sz, qty: qtyNum });
    }
    return map;
  }, [existingBalls]);

  const feedbackSizes = useMemo(() => {
    const set = new Set<string>();
    for (const v of existingMap.values()) set.add(v.size);
    const raw = Array.from(set.values());
    raw.sort((a, b) => String(a).localeCompare(String(b)));
    return raw;
  }, [existingMap]);

  function clearEntryFields() {
    setSize("");
    setWeight("");
    setIsEditingExisting(false);
  }

  async function loadExistingForShift(nextSid: string) {
    const q = parseShiftIdToQuery(nextSid);
    if (!q) {
      setExistingBalls([]);
      return;
    }

    setLoadingExisting(true);
    setMsg(null);

    try {
      const r = (await apiGet(
        `/api/planta/guardia/get?date=${encodeURIComponent(q.date)}&shift=${encodeURIComponent(q.shift)}`
      )) as GuardiaGetResp;

      setExistingBalls(Array.isArray(r?.balls) ? r.balls : []);
    } catch {
      setExistingBalls([]);
    } finally {
      setLoadingExisting(false);
    }
  }

  function syncWeightFromSelection(nextSid: string, nextMill: string, nextSize: string) {
    const mm = String(nextMill || "").trim().toUpperCase();
    const sz = String(nextSize || "").trim();
    if (!nextSid || !mm || !sz) {
      setIsEditingExisting(false);
      return;
    }

    const hit = existingMap.get(`${mm}|${sz}`);
    if (hit) {
      const s = String(hit.qty);
      setWeight(s.includes("e") || s.includes("E") ? Number(hit.qty).toFixed(18) : s);
      setIsEditingExisting(true);
    } else {
      setWeight("");
      setIsEditingExisting(false);
    }
  }

  // cuando cambia la guardia desde el page
  useEffect(() => {
    setMsg(null);
    clearEntryFields();
    setMill("");
    setExistingBalls([]);
    if (sid) loadExistingForShift(sid);
  }, [sid]);

  useEffect(() => {
    clearEntryFields();
  }, [mill]);

  useEffect(() => {
    syncWeightFromSelection(sid, mill, size);
  }, [size, sid, mill, existingMap]);

  async function onSave() {
    setMsg(null);
    if (!canSave) return;

    const m = String(mill || "").trim().toUpperCase();
    const sz = String(size || "").trim();
    const wStr = toDecimalStrOrNullFront(weight, 18);
    const w = wStr !== null ? Number(wStr) : NaN;

    setSaving(true);
    try {
      const r: any = await apiPost("/api/planta/bolas/upsert", {
        shift_id: sid,
        mill: m,
        reagent_name: sz,
        balls_weight: w,
      });

      if (!r?.ok) throw new Error(r?.error || "No se pudo guardar");

      setMsg(`OK: guardado ${sid} · Bolas`);
      await loadExistingForShift(sid);
      syncWeightFromSelection(sid, m, sz);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando bolas");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 1100 }}>
      <div className="panel-inner" style={{ padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Bolas</div>

        <div className="muted" style={{ fontWeight: 800, marginLeft: 8 }}>
          Guardia: {sid || "—"}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => sid && loadExistingForShift(sid)}
            disabled={!sid || loadingExisting || saving}
          >
            {loadingExisting ? "Cargando..." : "Refrescar"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={onSave}
            disabled={!canSave || loadingExisting || !sid}
            title={loadingExisting ? "Cargando datos existentes..." : ""}
          >
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
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ flex: "0 0 520px", display: "grid", gap: 12 }}>
            <Select
              label="Molino"
              value={mill}
              onChange={(v) => setMill((v as any) || "")}
              disabled={saving || !sid}
              options={[{ value: "", label: "Selecciona..." }, ...MILLS.map((x) => ({ value: x, label: x }))]}
            />

            <Select
              label="Tamaño de Bolas (Pulgadas)"
              value={size}
              onChange={(v) => setSize((v as any) || "")}
              disabled={saving || loadingExisting || !sid || !mill}
              options={[{ value: "", label: "Selecciona..." }, ...BALL_SIZES.map((x) => ({ value: x, label: x }))]}
            />

            <Input
              placeholder=""
              value={weight}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWeight(e.target.value)}
              hint="Cantidad (kg)"
            />

            {loadingExisting ? (
              <div className="muted" style={{ fontWeight: 800 }}>
                Cargando datos existentes…
              </div>
            ) : isEditingExisting && sid && mill && size ? (
              <div className="muted" style={{ fontWeight: 800 }}>
                Editando registro existente para {sid} · {String(mill).trim().toUpperCase()} · {String(size).trim()}
              </div>
            ) : null}
          </div>

          <div style={{ flex: "1 1 auto" }}>
            <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 8 }}>Datos cargados</div>

            <div
              style={{
                border: "1px solid rgba(255,255,255,.10)",
                borderRadius: 12,
                overflow: "hidden",
                background: "rgba(0,0,0,.06)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px 120px 120px",
                  gap: 0,
                  borderBottom: "1px solid rgba(255,255,255,.08)",
                  background: "rgba(0,0,0,.10)",
                }}
              >
                <div style={{ padding: "10px 12px", fontWeight: 900, opacity: 0.85 }}>Tamaño</div>
                <div style={{ padding: "10px 12px", fontWeight: 900, textAlign: "right" }}>M1</div>
                <div style={{ padding: "10px 12px", fontWeight: 900, textAlign: "right" }}>M2</div>
                <div style={{ padding: "10px 12px", fontWeight: 900, textAlign: "right" }}>M3</div>
              </div>

              {feedbackSizes.length ? (
                feedbackSizes.map((sz) => {
                  const v1 = existingMap.get(`M1|${sz}`)?.qty ?? null;
                  const v2 = existingMap.get(`M2|${sz}`)?.qty ?? null;
                  const v3 = existingMap.get(`M3|${sz}`)?.qty ?? null;

                  const fmt = (x: number | null) => {
                    if (x === null) return "";
                    const s = String(x);
                    return s.includes("e") || s.includes("E") ? Number(x).toFixed(6) : s;
                  };

                  return (
                    <div
                      key={sz}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 120px 120px 120px",
                        borderBottom: "1px solid rgba(255,255,255,.06)",
                      }}
                    >
                      <div style={{ padding: "10px 12px", fontWeight: 900 }}>{sz}</div>
                      <div style={{ padding: "10px 12px", fontWeight: 900, textAlign: "right", opacity: v1 === null ? 0.45 : 1 }}>
                        {fmt(v1)}
                      </div>
                      <div style={{ padding: "10px 12px", fontWeight: 900, textAlign: "right", opacity: v2 === null ? 0.45 : 1 }}>
                        {fmt(v2)}
                      </div>
                      <div style={{ padding: "10px 12px", fontWeight: 900, textAlign: "right", opacity: v3 === null ? 0.45 : 1 }}>
                        {fmt(v3)}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="muted" style={{ padding: 12, fontWeight: 800 }}>
                  {sid ? "No hay bolas registradas para esta guardia." : "Selecciona una guardia en el page."}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
