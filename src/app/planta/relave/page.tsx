// src/app/planta/relave/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../../lib/apiClient";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

type ShiftRow = {
  shift_id: string; // YYYYMMDD-A/B
  shift_date: string; // YYYY-MM-DD
  plant_shift: "A" | "B";
  plant_supervisor?: string | null;
};

type GuardiaHeader = {
  au_solid_tail?: any;
  au_solu_tail?: any;
  ag_solid_tail?: any;
  ag_solu_tail?: any;
};

type ShiftsResp = {
  ok: boolean;
  shifts: ShiftRow[];
  error?: string;
};

type GuardiaResp = {
  ok: boolean;
  shift_id: string;
  header: GuardiaHeader | null;
  error?: string;
};

type UpsertResp = { ok: boolean; error?: string };

function shiftIdToQuery(shift_id: string) {
  const s = String(shift_id || "").trim().toUpperCase();
  const [ymd, sh] = s.split("-");
  if (!ymd || !sh) return null;
  if (!/^\d{8}$/.test(ymd)) return null;
  if (!(sh === "A" || sh === "B")) return null;
  const date = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
  return { date, shift: sh as "A" | "B" };
}

function toTextNum(v: any) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? String(n) : "";
}

// null si vacío; número si válido; NaN si inválido
function parseNullableNumber(s: string) {
  const t = String(s ?? "").trim();
  if (!t) return null;

  // soporta coma decimal
  const normalized = t.replace(/\s+/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

export default function RelavePage() {
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [shiftId, setShiftId] = useState<string>("");

  const [auSolid, setAuSolid] = useState<string>("");
  const [auSolu, setAuSolu] = useState<string>("");
  const [agSolid, setAgSolid] = useState<string>("");
  const [agSolu, setAgSolu] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const selectedShift = useMemo(
    () => shifts.find((x) => x.shift_id === shiftId) || null,
    [shifts, shiftId]
  );

  async function loadShifts() {
    setLoading(true);
    setMsg(null);
    try {
      const r = (await apiGet("/api/planta/shifts?top=400")) as ShiftsResp;

      if (!r?.ok) throw new Error(r?.error || "No se pudo cargar turnos");
      const list = Array.isArray(r.shifts) ? r.shifts : [];
      setShifts(list);
      if (!shiftId && list.length) setShiftId(list[0].shift_id);
    } catch (e: any) {
      setMsg({ type: "err", text: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  }

  async function loadTailForShift(sid: string) {
    const q = shiftIdToQuery(sid);
    if (!q) return;

    setLoading(true);
    setMsg(null);
    try {
      const r = (await apiGet(`/api/planta/guardia/get?date=${q.date}&shift=${q.shift}`)) as GuardiaResp;

      if (!r?.ok) throw new Error(r?.error || "No se pudo cargar datos del turno");
      const h = r.header || {};
      setAuSolid(toTextNum(h.au_solid_tail));
      setAuSolu(toTextNum(h.au_solu_tail));
      setAgSolid(toTextNum(h.ag_solid_tail));
      setAgSolu(toTextNum(h.ag_solu_tail));
    } catch (e: any) {
      setMsg({ type: "err", text: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (shiftId) loadTailForShift(shiftId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftId]);

  async function onSave() {
    setMsg(null);

    if (!shiftId) {
      setMsg({ type: "err", text: "Selecciona un turno (shift_id)." });
      return;
    }

    const a1 = parseNullableNumber(auSolid);
    const a2 = parseNullableNumber(auSolu);
    const g1 = parseNullableNumber(agSolid);
    const g2 = parseNullableNumber(agSolu);

    const values = [a1, a2, g1, g2];

    // si el usuario llenó algo: debe ser número y > 0
    for (const v of values) {
      if (v === null) continue; // vacío permitido
      if (!Number.isFinite(v) || v <= 0) {
        setMsg({ type: "err", text: "Si llenas un valor, debe ser numérico y mayor a 0." });
        return;
      }
    }

    setSaving(true);
    try {
      const payload: any = { shift_id: shiftId };

      // si está vacío, mandamos null para que el API NO toque nada (COALESCE)
      payload.au_solid_tail = a1 === null ? null : a1;
      payload.au_solu_tail = a2 === null ? null : a2;
      payload.ag_solid_tail = g1 === null ? null : g1;
      payload.ag_solu_tail = g2 === null ? null : g2;

      const r = (await apiPost(`/api/planta/relave/upsert`, payload)) as UpsertResp;
      if (!r?.ok) throw new Error(r?.error || "No se pudo guardar");

      setMsg({ type: "ok", text: "Relave guardado." });
      await loadTailForShift(shiftId);
    } catch (e: any) {
      setMsg({ type: "err", text: String(e?.message || e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Relave</h1>
          <p className="text-sm text-muted-foreground">Registro de Au/Ag en colas por turno</p>
        </div>

        <div className="flex gap-2">
          <Button onClick={loadShifts} disabled={loading || saving}>
            Recargar
          </Button>
          <Button onClick={onSave} disabled={saving || loading || !shiftId}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>

      {msg && (
        <div
          className={`mt-4 rounded-md border p-3 text-sm ${
            msg.type === "ok" ? "border-green-600" : "border-red-600"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="mt-6 rounded-xl border p-4">
        <div className="grid gap-3">
          <label className="text-sm font-medium">Turno (shift_id)</label>
          <select
            className="w-full rounded-md border px-3 py-2"
            value={shiftId}
            onChange={(e) => setShiftId(e.target.value)}
            disabled={loading || saving}
          >
            {!shifts.length && <option value="">(Sin turnos)</option>}
            {shifts.map((s) => (
              <option key={s.shift_id} value={s.shift_id}>
                {s.shift_id} — {s.shift_date} — {s.plant_shift}
                {s.plant_supervisor ? ` — ${s.plant_supervisor}` : ""}
              </option>
            ))}
          </select>

          {selectedShift && (
            <div className="text-xs text-muted-foreground">
              Seleccionado: {selectedShift.shift_id} ({selectedShift.shift_date} / {selectedShift.plant_shift})
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Au Sólido Relave (g/t)</label>
            <Input
              className="mt-1"
              value={auSolid}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuSolid(e.target.value)}
              inputMode="decimal"
              disabled={loading || saving}
              placeholder="vacío o > 0"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Au Solución Relave (g/m³)</label>
            <Input
              className="mt-1"
              value={auSolu}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuSolu(e.target.value)}
              inputMode="decimal"
              disabled={loading || saving}
              placeholder="vacío o > 0"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Ag Sólido Relave (g/t)</label>
            <Input
              className="mt-1"
              value={agSolid}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgSolid(e.target.value)}
              inputMode="decimal"
              disabled={loading || saving}
              placeholder="vacío o > 0"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Ag Solución Relave (g/m³)</label>
            <Input
              className="mt-1"
              value={agSolu}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgSolu(e.target.value)}
              inputMode="decimal"
              disabled={loading || saving}
              placeholder="vacío o > 0"
            />
          </div>
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          Guardado por turno (shift_id). Si dejas campos vacíos, no se actualizan.
        </div>
      </div>
    </div>
  );
}
