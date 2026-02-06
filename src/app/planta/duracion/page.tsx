// src/app/planta/duracion/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "../../../lib/apiClient";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

type ShiftRow = {
  shift_id: string;
  shift_date: string;
  plant_shift: "A" | "B";
  plant_supervisor?: string | null;
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

function SearchableDropdown({
  label,
  placeholder,
  value,
  items,
  getKey,
  getLabel,
  onSelect,
  disabled,
}: {
  label: string;
  placeholder: string;
  value: string;
  items: any[];
  getKey: (x: any) => string;
  getLabel: (x: any) => string;
  onSelect: (x: any) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter((it) => {
      const a = getLabel(it).toLowerCase();
      const b = getKey(it).toLowerCase();
      return a.includes(qq) || b.includes(qq);
    });
  }, [q, items, getKey, getLabel]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as any)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={boxRef} style={{ display: "grid", gap: 6, position: "relative" }}>
      <div style={{ fontWeight: 900, fontSize: 13 }}>{label}</div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={open ? q : value}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => {
            if (disabled) return;
            setOpen(true);
            setQ("");
          }}
          onChange={(e) => {
            setOpen(true);
            setQ(e.target.value);
          }}
          style={{
            width: "100%",
            background: "rgba(0,0,0,.10)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            borderRadius: 10,
            padding: "10px 12px",
            outline: "none",
            fontWeight: 900,
            opacity: disabled ? 0.7 : 1,
          }}
        />

        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((s) => !s)}
          style={{
            width: 44,
            height: 42,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "rgba(0,0,0,.10)",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.7 : 1,
            fontWeight: 900,
            color: "var(--text)",
          }}
          aria-label="Abrir"
          title="Abrir"
        >
          ▾
        </button>
      </div>

      {open ? (
        <div
          style={{
            position: "absolute",
            top: 72,
            left: 0,
            right: 0,
            zIndex: 20,
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--panel)",
            boxShadow: "0 10px 24px rgba(0,0,0,.25)",
            maxHeight: 280,
            overflow: "auto",
          }}
        >
          {filtered.length ? (
            filtered.map((it) => {
              const k = getKey(it);
              const lbl = getLabel(it);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    onSelect(it);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "var(--text)",
                    fontWeight: 900,
                    borderBottom: "1px solid rgba(255,255,255,.06)",
                  }}
                >
                  {lbl}
                </button>
              );
            })
          ) : (
            <div className="muted" style={{ padding: 12, fontWeight: 800 }}>
              No hay resultados
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function PlantaDuracionPage() {
  const [msg, setMsg] = useState<string | null>(null);

  const [loadingShifts, setLoadingShifts] = useState(true);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [shiftId, setShiftId] = useState<string>("");

  const [durLocked, setDurLocked] = useState(false);

  const [opH, setOpH] = useState<string>("");
  const [opM, setOpM] = useState<string>("");
  const [stopH, setStopH] = useState<string>("");
  const [stopM, setStopM] = useState<string>("");

  const shiftsSorted = useMemo(() => {
    const list = Array.isArray(shifts) ? [...shifts] : [];
    list.sort((a, b) => {
      const ad = String(a.shift_date || "").replaceAll("-", "");
      const bd = String(b.shift_date || "").replaceAll("-", "");
      if (ad !== bd) return bd.localeCompare(ad);
      const ash = String(a.plant_shift || "");
      const bsh = String(b.plant_shift || "");
      if (ash !== bsh) return bsh.localeCompare(ash);
      return String(b.shift_id || "").localeCompare(String(a.shift_id || ""));
    });
    return list;
  }, [shifts]);

  const shiftLabel = (s: ShiftRow) => {
    const sup = s.plant_supervisor ? ` · ${s.plant_supervisor}` : "";
    return `${s.shift_id}${sup}`;
  };

  async function loadShifts() {
    setLoadingShifts(true);
    setMsg(null);
    try {
      const r = (await apiGet("/api/planta/shifts?top=500")) as ShiftsResp;
      const list = Array.isArray((r as any)?.shifts) ? ((r as any).shifts as ShiftRow[]) : [];
      setShifts(list);
      if (list[0]?.shift_id) setShiftId(String(list[0].shift_id || "").trim().toUpperCase());
    } catch (e: any) {
      setShifts([]);
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando guardias");
    } finally {
      setLoadingShifts(false);
    }
  }

  function clearFields() {
    setOpH("");
    setOpM("");
    setStopH("");
    setStopM("");
  }

  async function loadExistingForShift(sid: string) {
    const q = parseShiftIdToQuery(sid);
    if (!q) return;

    setLoadingExisting(true);
    setMsg(null);

    try {
      const r = (await apiGet(
        `/api/planta/guardia/get?date=${encodeURIComponent(q.date)}&shift=${encodeURIComponent(q.shift)}`
      )) as GuardiaGetResp;

      if (!(r as any)?.ok) throw new Error((r as any)?.error || "No se pudo cargar guardia");

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
      setDurLocked(false);
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando duración");
    } finally {
      setLoadingExisting(false);
    }
  }

  useEffect(() => {
    loadShifts();
  }, []);

  useEffect(() => {
    if (!shiftId) {
      clearFields();
      setDurLocked(false);
      return;
    }
    loadExistingForShift(shiftId);
  }, [shiftId]);

  const opMin = useMemo(() => {
    const h = clampInt(parseIntSafeNonNeg(opH), 0, 12);
    const m = clampInt(parseIntSafeNonNeg(opM), 0, 59);
    return clampInt(h * 60 + m, 0, 720);
  }, [opH, opM]);

  const stopMin = useMemo(() => {
    const h = clampInt(parseIntSafeNonNeg(stopH), 0, 12);
    const m = clampInt(parseIntSafeNonNeg(stopM), 0, 59);
    return clampInt(h * 60 + m, 0, 720);
  }, [stopH, stopM]);

  const total = opMin + stopMin;

  const canSave = useMemo(() => {
    if (saving) return false;
    const sid = String(shiftId || "").trim();
    if (!sid) return false;
    if (durLocked) return false;
    if (total !== 720) return false;
    return true;
  }, [shiftId, durLocked, total, saving]);

  async function onSave() {
    setMsg(null);

    if (!canSave) {
      setMsg("ERROR: Operación + Parada debe sumar 720 min y el turno no debe estar bloqueado.");
      return;
    }

    const sid = String(shiftId || "").trim().toUpperCase();

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

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Button type="button" size="sm" variant="primary" onClick={onSave} disabled={!canSave || loadingExisting}>
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
          <SearchableDropdown
            label="Guardia"
            placeholder={loadingShifts ? "Cargando guardias..." : "Busca: 20260205-A, supervisor..."}
            value={shiftId}
            items={shiftsSorted}
            getKey={(x: ShiftRow) => x.shift_id}
            getLabel={(x: ShiftRow) => shiftLabel(x)}
            onSelect={(x: ShiftRow) => setShiftId(String(x.shift_id || "").trim().toUpperCase())}
            disabled={saving}
          />

          {!shiftsSorted.length ? (
            <div style={{ display: "grid", gap: 6 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                Pega el shift_id manual (formato: YYYYMMDD-A o YYYYMMDD-B).
              </div>
              <Input
                placeholder="Ej: 20260205-A"
                value={shiftId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShiftId(e.target.value.trim().toUpperCase())}
                hint="shift_id"
              />
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 900, fontSize: 13 }}>Duración - Operación (h)</div>
              <Input
                value={opH}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOpH(e.target.value.replace(/[^\d]/g, ""))}
                hint=""
                disabled={durLocked || saving || loadingExisting || !shiftId}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 900, fontSize: 13 }}>Duración - Operación (min)</div>
              <Input
                value={opM}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOpM(e.target.value.replace(/[^\d]/g, ""))}
                hint=""
                disabled={durLocked || saving || loadingExisting || !shiftId}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 900, fontSize: 13 }}>Duración - Parada (h)</div>
              <Input
                value={stopH}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStopH(e.target.value.replace(/[^\d]/g, ""))}
                hint=""
                disabled={durLocked || saving || loadingExisting || !shiftId}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 900, fontSize: 13 }}>Duración - Parada (min)</div>
              <Input
                value={stopM}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStopM(e.target.value.replace(/[^\d]/g, ""))}
                hint=""
                disabled={durLocked || saving || loadingExisting || !shiftId}
              />
            </div>

            <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
              Total: {total} min (debe ser 720)
            </div>

            {loadingExisting ? (
              <div className="muted" style={{ fontWeight: 800 }}>
                Cargando datos existentes…
              </div>
            ) : durLocked && shiftId ? (
              <div className="muted" style={{ fontWeight: 800 }}>
                Este turno ya tiene duración registrada (bloqueado).
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
