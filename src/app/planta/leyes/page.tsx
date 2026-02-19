// src/app/planta/leyes/page.tsx
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

type GuardiaHeader = {
  au_solid_of?: any;
  au_solu_of?: any;
  ag_solid_of?: any;
  ag_solu_of?: any;
  au_solid_tail?: any;
  au_solu_tail?: any;
  ag_solid_tail?: any;
  ag_solu_tail?: any;
};

type GuardiaResp = {
  ok: boolean;
  shift_id: string;
  header: GuardiaHeader | null;
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

function toTextNum(v: any) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? String(n) : "";
}

function parseNullableNumberNonNeg(s: string) {
  const t = String(s ?? "").trim();
  if (!t) return null;
  const normalized = t.replace(/\s+/g, "").replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return NaN;
  if (n < 0) return NaN;
  return n;
}

function shiftIdToParts(sid: string): { shift_date: string; plant_shift: "A" | "B" } | null {
  const q = parseShiftIdToQuery(sid);
  if (!q) return null;
  return { shift_date: q.date, plant_shift: q.shift };
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

export default function LeyesPage() {
  const [msg, setMsg] = useState<string | null>(null);

  const [loadingShifts, setLoadingShifts] = useState(true);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [shiftId, setShiftId] = useState<string>("");

  const [auSolidOf, setAuSolidOf] = useState<string>("");
  const [auSoluOf, setAuSoluOf] = useState<string>("");
  const [agSolidOf, setAgSolidOf] = useState<string>("");
  const [agSoluOf, setAgSoluOf] = useState<string>("");

  const [auSolid, setAuSolid] = useState<string>("");
  const [auSolu, setAuSolu] = useState<string>("");
  const [agSolid, setAgSolid] = useState<string>("");
  const [agSolu, setAgSolu] = useState<string>("");

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

  const canSave = useMemo(() => {
    if (saving) return false;
    const sid = String(shiftId || "").trim();
    if (!sid) return false;

    const of1 = parseNullableNumberNonNeg(auSolidOf);
    const of2 = parseNullableNumberNonNeg(auSoluOf);
    const of3 = parseNullableNumberNonNeg(agSolidOf);
    const of4 = parseNullableNumberNonNeg(agSoluOf);

    const values = [of1, of2, of3, of4];
    const raw = [auSolidOf, auSoluOf, agSolidOf, agSoluOf];

    const anyFilled = raw.some((x) => String(x || "").trim() !== "");
    if (!anyFilled) return false;

    for (const v of values) {
      if (v === null) continue;
      if (!Number.isFinite(v) || v <= 0) return false;
    }

    return true;
  }, [shiftId, auSolidOf, auSoluOf, agSolidOf, agSoluOf, saving]);

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

  function clearEntryFields() {
    setAuSolidOf("");
    setAuSoluOf("");
    setAgSolidOf("");
    setAgSoluOf("");
    setAuSolid("");
    setAuSolu("");
    setAgSolid("");
    setAgSolu("");
  }

  async function loadExistingForShift(sid: string) {
    const q = parseShiftIdToQuery(sid);
    if (!q) return;

    setLoadingExisting(true);

    try {
      const r = (await apiGet(
        `/api/planta/guardia/get?date=${encodeURIComponent(q.date)}&shift=${encodeURIComponent(q.shift)}`
      )) as any;

      const h: GuardiaHeader = (r?.header as any) || {};

      setAuSolidOf(toTextNum(h.au_solid_of));
      setAuSoluOf(toTextNum(h.au_solu_of));
      setAgSolidOf(toTextNum(h.ag_solid_of));
      setAgSoluOf(toTextNum(h.ag_solu_of));

      setAuSolid(toTextNum(h.au_solid_tail));
      setAuSolu(toTextNum(h.au_solu_tail));
      setAgSolid(toTextNum(h.ag_solid_tail));
      setAgSolu(toTextNum(h.ag_solu_tail));
    } catch (e: any) {
      clearEntryFields();
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando leyes");
    } finally {
      setLoadingExisting(false);
    }
  }

  useEffect(() => {
    loadShifts();
  }, []);

  useEffect(() => {
    setMsg(null);

    if (!shiftId) {
      clearEntryFields();
      return;
    }
    loadExistingForShift(shiftId);
  }, [shiftId]);

  async function onSave() {
    setMsg(null);

    const sid = String(shiftId || "").trim().toUpperCase();
    const parts = shiftIdToParts(sid);
    if (!sid || !parts) {
      setMsg("ERROR: Selecciona un turno (shift_id).");
      return;
    }

    const of1 = parseNullableNumberNonNeg(auSolidOf);
    const of2 = parseNullableNumberNonNeg(auSoluOf);
    const of3 = parseNullableNumberNonNeg(agSolidOf);
    const of4 = parseNullableNumberNonNeg(agSoluOf);

    const values = [of1, of2, of3, of4];
    const raw = [auSolidOf, auSoluOf, agSolidOf, agSoluOf];

    const anyFilled = raw.some((x) => String(x || "").trim() !== "");
    if (!anyFilled) {
      setMsg("ERROR: Ingresa al menos un valor.");
      return;
    }

    for (const v of values) {
      if (v === null) continue;
      if (!Number.isFinite(v) || v <= 0) {
        setMsg("ERROR: Si llenas un valor, debe ser numérico y mayor a 0.");
        return;
      }
    }

    const sup = shiftsSorted.find((x) => String(x.shift_id || "").trim().toUpperCase() === sid)?.plant_supervisor || "";
    const plant_supervisor = String(sup || "").trim();

    if (!plant_supervisor) {
      setMsg("ERROR: No se encontró plant_supervisor para este shift_id.");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        shift_date: parts.shift_date,
        plant_shift: parts.plant_shift,
        plant_supervisor,
        au_solid_of: of1 === null ? null : of1,
        au_solu_of: of2 === null ? null : of2,
        ag_solid_of: of3 === null ? null : of3,
        ag_solu_of: of4 === null ? null : of4,
      };

      const r = (await apiPost(`/api/planta/guardia/upsert`, payload)) as any;
      if (!r?.ok) throw new Error(r?.error || "No se pudo guardar");

      setMsg(`OK: guardado ${sid} · Leyes (OF)`);
      await loadExistingForShift(sid);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando leyes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 980 }}>
      <div className="panel-inner" style={{ padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Leyes</div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Button type="button" size="sm" variant="ghost" onClick={loadShifts} disabled={loadingShifts || saving}>
            {loadingShifts ? "Cargando..." : "Refrescar"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={onSave}
            disabled={!canSave || loadingExisting}
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

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
            <Input
              placeholder="vacío o > 0"
              value={auSolidOf}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuSolidOf(e.target.value)}
              hint="Au Sólido OF (g/t)"
            />
            <Input
              placeholder="vacío o > 0"
              value={auSoluOf}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuSoluOf(e.target.value)}
              hint="Au Solución OF (g/m³)"
            />
            <Input
              placeholder="vacío o > 0"
              value={agSolidOf}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgSolidOf(e.target.value)}
              hint="Ag Sólido OF (g/t)"
            />
            <Input
              placeholder="vacío o > 0"
              value={agSoluOf}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgSoluOf(e.target.value)}
              hint="Ag Solución OF (g/m³)"
            />
          </div>

          <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
            Guardado por turno (shift_id). Si dejas campos vacíos, no se actualizan.
          </div>

          {loadingExisting ? (
            <div className="muted" style={{ fontWeight: 800 }}>
              Cargando datos existentes…
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
