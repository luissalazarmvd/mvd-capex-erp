// src/app/planta/duracion/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../../lib/apiClient";
import { Button } from "../../../components/ui/Button";

type ShiftRow = {
  shift_id: string; // YYYYMMDD-A/B
  shift_date: string; // YYYY-MM-DD
  plant_shift: "A" | "B";
  plant_supervisor: string;
};

type ShiftsResp = {
  ok: boolean;
  shifts: ShiftRow[];
  error?: string;
};

type GuardiaGetResp = {
  ok: boolean;
  shift_id: string;
  header: any | null;
  consumables: any[];
  balls: any[];
  duration: { shift_id: string; op_type: string; shift_duration: number | null }[];
  error?: string;
};

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  const x = Math.trunc(n);
  return Math.max(min, Math.min(max, x));
}

function parseIntSafe(s: string) {
  const t = String(s ?? "").trim();
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export default function PlantaDuracionPage() {
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);

  const [shiftId, setShiftId] = useState<string>("");

  const [durLocked, setDurLocked] = useState(false);

  const [opH, setOpH] = useState<string>("");
  const [opM, setOpM] = useState<string>("");
  const [stopH, setStopH] = useState<string>("");
  const [stopM, setStopM] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const selectedShift = useMemo(() => shifts.find((s) => s.shift_id === shiftId) || null, [shifts, shiftId]);

  useEffect(() => {
    (async () => {
      try {
        setLoadingShifts(true);
        setMsg(null);
        const r = (await apiGet("/api/planta/shifts?top=400")) as ShiftsResp;
        if (!r?.ok) throw new Error(r?.error || "No se pudo cargar turnos");
        setShifts(r.shifts || []);
      } catch (e: any) {
        setMsg({ type: "err", text: String(e?.message || e) });
      } finally {
        setLoadingShifts(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!shiftId) {
      setDurLocked(false);
      setOpH("");
      setOpM("");
      setStopH("");
      setStopM("");
      return;
    }

    (async () => {
      try {
        setMsg(null);

        const [ymd, sh] = shiftId.split("-");
        const date = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
        const r = (await apiGet(`/api/planta/guardia/get?date=${date}&shift=${sh}`)) as GuardiaGetResp;

        if (!r?.ok) throw new Error(r?.error || "No se pudo cargar guardia");

        const hasAny = (r.duration || []).some((d) => d.shift_duration !== null && d.shift_duration !== undefined);
        setDurLocked(hasAny);

        let opMinDb: number | null = null;
        let stopMinDb: number | null = null;

        for (const d of r.duration || []) {
          const t = String(d.op_type || "").toLowerCase();
          if (t.includes("oper")) opMinDb = d.shift_duration ?? null;
          if (t.includes("para")) stopMinDb = d.shift_duration ?? null;
        }

        if (opMinDb !== null && Number.isFinite(opMinDb)) {
          const h = Math.floor(clampInt(opMinDb, 0, 720) / 60);
          const m = clampInt(opMinDb, 0, 720) % 60;
          setOpH(String(h));
          setOpM(String(m));
        } else {
          setOpH("");
          setOpM("");
        }

        if (stopMinDb !== null && Number.isFinite(stopMinDb)) {
          const h = Math.floor(clampInt(stopMinDb, 0, 720) / 60);
          const m = clampInt(stopMinDb, 0, 720) % 60;
          setStopH(String(h));
          setStopM(String(m));
        } else {
          setStopH("");
          setStopM("");
        }
      } catch (e: any) {
        setMsg({ type: "err", text: String(e?.message || e) });
        setDurLocked(false);
      }
    })();
  }, [shiftId]);

  const opMin = useMemo(() => {
    const h = clampInt(parseIntSafe(opH), 0, 12);
    const m = clampInt(parseIntSafe(opM), 0, 720);
    return clampInt(h * 60 + m, 0, 720);
  }, [opH, opM]);

  const stopMin = useMemo(() => {
    const h = clampInt(parseIntSafe(stopH), 0, 12);
    const m = clampInt(parseIntSafe(stopM), 0, 720);
    return clampInt(h * 60 + m, 0, 720);
  }, [stopH, stopM]);

  const total = opMin + stopMin;

  const canSave = !!shiftId && !durLocked && total === 720 && !saving;

  async function onSave() {
    setMsg(null);

    if (!canSave || !selectedShift) {
      setMsg({ type: "err", text: "No se puede guardar. Operación + Parada debe sumar 720 min y el turno no debe estar bloqueado." });
      return;
    }

    try {
      setSaving(true);

      await apiPost("/api/planta/duracion/upsert", {
        shift_id: selectedShift.shift_id,
        op_min: opMin,
        stop_min: stopMin,
      });

      setMsg({ type: "ok", text: "Duración guardada." });

      const [ymd, sh] = selectedShift.shift_id.split("-");
      const date = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
      const r = (await apiGet(`/api/planta/guardia/get?date=${date}&shift=${sh}`)) as GuardiaGetResp;
      const hasAny = (r.duration || []).some((d) => d.shift_duration !== null && d.shift_duration !== undefined);
      setDurLocked(hasAny);
    } catch (e: any) {
      setMsg({ type: "err", text: String(e?.message || e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 420 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, marginBottom: 6 }}>Guardia</div>
        <select
          value={shiftId}
          onChange={(e) => setShiftId(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", outline: "none" }}
        >
          <option value="">{loadingShifts ? "Cargando…" : "Selecciona…"}</option>
          {shifts.map((s) => (
            <option key={s.shift_id} value={s.shift_id}>
              {s.shift_id}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <label style={{ fontSize: 12 }}>
          Duración - Operación (h)
          <input
            disabled={durLocked}
            value={opH}
            inputMode="numeric"
            onChange={(e) => setOpH(e.target.value.replace(/[^\d-]/g, ""))}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", marginTop: 6 }}
          />
        </label>

        <label style={{ fontSize: 12 }}>
          Duración - Operación (min)
          <input
            disabled={durLocked}
            value={opM}
            inputMode="numeric"
            onChange={(e) => setOpM(e.target.value.replace(/[^\d-]/g, ""))}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", marginTop: 6 }}
          />
        </label>

        <label style={{ fontSize: 12 }}>
          Duración - Parada (h)
          <input
            disabled={durLocked}
            value={stopH}
            inputMode="numeric"
            onChange={(e) => setStopH(e.target.value.replace(/[^\d-]/g, ""))}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", marginTop: 6 }}
          />
        </label>

        <label style={{ fontSize: 12 }}>
          Duración - Parada (min)
          <input
            disabled={durLocked}
            value={stopM}
            inputMode="numeric"
            onChange={(e) => setStopM(e.target.value.replace(/[^\d-]/g, ""))}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", marginTop: 6 }}
          />
        </label>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
        Total: {total} min (debe ser 720)
        {durLocked ? <div style={{ marginTop: 6 }}>Este turno ya tiene duración registrada (bloqueado).</div> : null}
      </div>

      {msg ? (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 10,
            border: `1px solid ${msg.type === "ok" ? "#cfe9d6" : "#f2c9c9"}`,
            background: msg.type === "ok" ? "#f3fbf5" : "#fff5f5",
            fontSize: 12,
          }}
        >
          {msg.text}
        </div>
      ) : null}

      <div style={{ marginTop: 12 }}>
        <Button onClick={onSave} disabled={!canSave}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
