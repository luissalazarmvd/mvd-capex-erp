// src/components/planta/DuracionPanel.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

type GuardiaGetResp = {
  ok: boolean;
  shift_id: string;
  header: any | null;
  consumables: any[];
  balls: any[];
  duration: { shift_id: string; op_type: string; shift_duration: number | null }[];
  error?: string;
};

type UpsertResp = { ok: boolean; error?: string };

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

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  const x = Math.trunc(n);
  return Math.max(min, Math.min(max, x));
}

function parseIntSafeNonNeg(s: string) {
  const t = String(s ?? "").trim();
  if (!t) return 0;
  const n = Number(t);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function fmtMinToHHMM(mins: number) {
  const m = clampInt(mins, 0, 24 * 60);
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function DuracionPanel({ shiftId }: { shiftId: string }) {
  const [msg, setMsg] = useState<string | null>(null);

  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);

  const sid = useMemo(() => String(shiftId || "").trim().toUpperCase(), [shiftId]);

  const [opH, setOpH] = useState<string>("");
  const [opM, setOpM] = useState<string>("");
  const [stopH, setStopH] = useState<string>("");
  const [stopM, setStopM] = useState<string>("");

  function clearFields() {
    setOpH("");
    setOpM("");
    setStopH("");
    setStopM("");
  }

  async function loadExistingForShift(nextSid: string) {
    const q = parseShiftIdToQuery(nextSid);
    if (!q) return;

    setLoadingExisting(true);
    // OJO: NO borres msg acá, si no se “come” el OK después de guardar.

    try {
      const r = (await apiGet(
        `/api/planta/guardia/get?date=${encodeURIComponent(q.date)}&shift=${encodeURIComponent(q.shift)}`
      )) as GuardiaGetResp;

      if (!(r as any)?.ok) throw new Error((r as any)?.error || "No se pudo cargar guardia");

      let opMinDb: number | null = null;
      let stopMinDb: number | null = null;

      for (const d of r.duration || []) {
        const t = String(d.op_type || "").toLowerCase();
        if (t.includes("oper")) opMinDb = d.shift_duration ?? null;
        if (t.includes("para")) stopMinDb = d.shift_duration ?? null;
      }

      if (opMinDb !== null && Number.isFinite(opMinDb)) {
        const v = clampInt(opMinDb, 0, 720);
        setOpH(String(Math.floor(v / 60)));
        setOpM(String(v % 60));
      } else {
        setOpH("");
        setOpM("");
      }

      if (stopMinDb !== null && Number.isFinite(stopMinDb)) {
        const v = clampInt(stopMinDb, 0, 720);
        setStopH(String(Math.floor(v / 60)));
        setStopM(String(v % 60));
      } else {
        setStopH("");
        setStopM("");
      }
    } catch (e: any) {
      clearFields();
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando duración");
    } finally {
      setLoadingExisting(false);
    }
  }

  // cuando cambia la guardia desde el page
  useEffect(() => {
    setMsg(null);
    if (!sid) {
      clearFields();
      return;
    }
    loadExistingForShift(sid);
  }, [sid]);

  const opMin = useMemo(() => {
    const h = parseIntSafeNonNeg(opH);
    const m = parseIntSafeNonNeg(opM);
    return h * 60 + m;
  }, [opH, opM]);

  const stopMin = useMemo(() => {
    const h = parseIntSafeNonNeg(stopH);
    const m = parseIntSafeNonNeg(stopM);
    return h * 60 + m;
  }, [stopH, stopM]);

  const total = opMin + stopMin;

  const canSave = useMemo(() => {
    if (saving) return false;
    if (!sid) return false;
    if (total !== 720) return false;
    return true;
  }, [sid, total, saving]);

  async function onSave() {
    setMsg(null);

    if (!canSave) {
      setMsg("ERROR: Operación + Parada debe sumar 720 min.");
      return;
    }

    setSaving(true);
    try {
      const r = (await apiPost("/api/planta/duracion/upsert", {
        shift_id: sid,
        op_min: opMin,
        stop_min: stopMin,
      })) as UpsertResp;

      if (!r?.ok) throw new Error(r?.error || "No se pudo guardar");

      setMsg(`OK: guardado ${sid} · Duración`);
      await loadExistingForShift(sid);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando duración");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 820 }}>
      <div className="panel-inner" style={{ padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Duración</div>

        <div className="muted" style={{ fontWeight: 800, marginLeft: 8 }}>
          Guardia: {sid || "—"}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Button type="button" size="sm" variant="primary" onClick={onSave} disabled={!canSave || loadingExisting || !sid}>
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
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 900, fontSize: 13 }}>Duración - Operación (h)</div>
              <Input
                value={opH}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOpH(e.target.value.replace(/[^\d]/g, ""))}
                hint=""
                disabled={saving || loadingExisting || !sid}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 900, fontSize: 13 }}>Duración - Operación (min)</div>
              <Input
                value={opM}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOpM(e.target.value.replace(/[^\d]/g, ""))}
                hint=""
                disabled={saving || loadingExisting || !sid}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 900, fontSize: 13 }}>Duración - Parada (h)</div>
              <Input
                value={stopH}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStopH(e.target.value.replace(/[^\d]/g, ""))}
                hint=""
                disabled={saving || loadingExisting || !sid}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 900, fontSize: 13 }}>Duración - Parada (min)</div>
              <Input
                value={stopM}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStopM(e.target.value.replace(/[^\d]/g, ""))}
                hint=""
                disabled={saving || loadingExisting || !sid}
              />
            </div>

            <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
              Total: {fmtMinToHHMM(total)} (debe ser {fmtMinToHHMM(720)})
            </div>

            {loadingExisting ? (
              <div className="muted" style={{ fontWeight: 800 }}>
                Cargando datos existentes…
              </div>
            ) : null}

            {!sid ? (
              <div className="muted" style={{ fontWeight: 800 }}>
                Selecciona una guardia en el page.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
