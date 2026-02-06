// src/app/planta/bolas/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../../lib/apiClient";

type ShiftRow = {
  shift_id: string;
  shift_date: string;
  plant_shift: string;
  plant_supervisor?: string | null;
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
];

export default function BolasPage() {
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [shiftId, setShiftId] = useState<string>("");
  const [mill, setMill] = useState<string>("");
  const [size, setSize] = useState<string>("");
  const [weight, setWeight] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const r = await apiGet("/api/planta/shifts?top=250");
        const list = Array.isArray(r?.shifts) ? (r.shifts as ShiftRow[]) : [];
        setShifts(list);
        if (list[0]?.shift_id) setShiftId(list[0].shift_id);
      } catch (e: any) {
        setMsg(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const shiftLabel = useMemo(() => {
    const s = shifts.find((x) => x.shift_id === shiftId);
    if (!s) return "";
    return `${s.shift_date} - ${s.plant_shift} (${s.shift_id})`;
  }, [shifts, shiftId]);

  async function onSave() {
    setMsg(null);

    const sid = String(shiftId || "").trim().toUpperCase();
    const m = String(mill || "").trim().toUpperCase();
    const sz = String(size || "").trim();
    const w = Number(String(weight || "").trim().replace(",", "."));

    if (!sid || !m || !sz || !Number.isFinite(w) || w <= 0) {
      setMsg("Revisa los datos ingresados.");
      return;
    }

    setSaving(true);
    try {
      const r = await apiPost("/api/planta/bolas/upsert", {
        shift_id: sid,
        mill: m,
        reagent_name: sz,
        balls_weight: w,
      });

      if (!r?.ok) throw new Error(r?.error || "No se pudo guardar");
      setMsg("Registro de bolas guardado correctamente.");
      setWeight("");
      setMill("");
      setSize("");
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 18 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>Bolas</h1>

      {loading ? (
        <div>Cargando...</div>
      ) : (
        <div style={{ display: "grid", gap: 14, maxWidth: 520 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 700 }}>Guardia</div>
            <select
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,.2)", background: "transparent" }}
            >
              {shifts.map((s) => (
                <option key={s.shift_id} value={s.shift_id}>
                  {s.shift_date} - {s.plant_shift} ({s.shift_id})
                </option>
              ))}
            </select>
            {shiftLabel ? <div style={{ opacity: 0.8, fontSize: 13 }}>{shiftLabel}</div> : null}
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 700 }}>Molino</div>
            <select
              value={mill}
              onChange={(e) => setMill(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,.2)", background: "transparent" }}
            >
              <option value="">Selecciona...</option>
              {MILLS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 700 }}>Tamaño de Bolas (Pulgadas)</div>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,.2)", background: "transparent" }}
            >
              <option value="">Selecciona...</option>
              {BALL_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 700 }}>Cantidad (kg)</div>
            <input
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Peso (kg)"
              inputMode="decimal"
              style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,.2)", background: "transparent" }}
            />
          </div>

          <button
            onClick={onSave}
            disabled={saving}
            className="nav-pill !text-white visited:!text-white text-lg font-extrabold"
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.25)",
              background: "rgba(255,255,255,.06)",
              cursor: saving ? "not-allowed" : "pointer",
              width: "fit-content",
            }}
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>

          {msg ? <div style={{ marginTop: 6, opacity: 0.9 }}>{msg}</div> : null}
        </div>
      )}
    </div>
  );
}
