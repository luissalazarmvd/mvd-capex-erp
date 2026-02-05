// src/app/(planta)/reactivos/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "../../../lib/apiClient";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

type ShiftRow = {
  shift_id: string; // "YYYYMMDD-A"
  shift_date?: string; // "YYYY-MM-DD"
  plant_shift?: "A" | "B";
  plant_supervisor?: string | null;
};

type ShiftsResp = {
  ok: boolean;
  shifts: ShiftRow[];
};

type GuardiaGetResp = {
  ok: boolean;
  shift_id: string;
  header: any | null;
  consumables: { shift_id: string; reagent_name: string; qty: any }[];
  balls: any[];
  duration: any[];
};

const INSUMOS = [
  { value: "NaCN", label: "NaCN" },
  { value: "Soda Cáustica", label: "Soda Cáustica" },
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

function toCleanQty(v: string) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s;
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

export default function ReactivosPage() {
  const [msg, setMsg] = useState<string | null>(null);

  const [loadingShifts, setLoadingShifts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [shiftId, setShiftId] = useState<string>("");

  const [insumo, setInsumo] = useState<(typeof INSUMOS)[number]["value"] | "">("");
  const [qty, setQty] = useState<string>("");

  const canSave = useMemo(() => !!shiftId && !!insumo && !saving, [shiftId, insumo, saving]);

  // asegura orden (por si el server cambia)
  const shiftsSorted = useMemo(() => {
    const list = Array.isArray(shifts) ? [...shifts] : [];
    list.sort((a, b) => {
      const ad = String(a.shift_date || "").replaceAll("-", "");
      const bd = String(b.shift_date || "").replaceAll("-", "");
      if (ad !== bd) return bd.localeCompare(ad); // desc
      const ash = String(a.plant_shift || "");
      const bsh = String(b.plant_shift || "");
      if (ash !== bsh) return bsh.localeCompare(ash); // B > A (desc)
      return String(b.shift_id || "").localeCompare(String(a.shift_id || "")); // desc
    });
    return list;
  }, [shifts]);

  async function loadShifts() {
    setLoadingShifts(true);
    setMsg(null);
    try {
      // NUEVO: guardias existentes (sin status)
      const r = (await apiGet("/api/planta/shifts?top=500")) as ShiftsResp;
      const list = Array.isArray(r.shifts) ? r.shifts : [];
      setShifts(list);
    } catch (e: any) {
      setShifts([]);
      setMsg("No pude cargar guardias. Puedes pegar el shift_id manual (YYYYMMDD-A/B).");
    } finally {
      setLoadingShifts(false);
    }
  }

  async function loadExistingForSelectedShift(sid: string) {
    const q = parseShiftIdToQuery(sid);
    if (!q) return;
    setLoadingExisting(true);
    setMsg(null);
    try {
      const r = (await apiGet(
        `/api/planta/guardia/get?date=${encodeURIComponent(q.date)}&shift=${encodeURIComponent(q.shift)}`
      )) as GuardiaGetResp;

      const cons = r.consumables || [];
      if (insumo) {
        const hit = cons.find((x) => String(x.reagent_name || "").trim() === insumo);
        if (hit && hit.qty !== null && hit.qty !== undefined) setQty(String(hit.qty));
      }
    } catch {
      // si no existe aún, normal
    } finally {
      setLoadingExisting(false);
    }
  }

  useEffect(() => {
    loadShifts();
  }, []);

  useEffect(() => {
    if (!shiftId) return;
    loadExistingForSelectedShift(shiftId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftId]);

  useEffect(() => {
    if (!shiftId || !insumo) return;
    loadExistingForSelectedShift(shiftId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insumo]);

  async function onSave() {
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        shift_id: shiftId,
        items: [
          {
            reagent_name: insumo,
            qty: toCleanQty(qty),
          },
        ],
      };

      await apiPost("/api/planta/reactivos/upsert", payload);
      setMsg(`OK: guardado ${shiftId} · ${insumo}`);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando reactivo");
    } finally {
      setSaving(false);
    }
  }

  const shiftLabel = (s: ShiftRow) => {
    const sup = s.plant_supervisor ? ` · ${s.plant_supervisor}` : "";
    const d = s.shift_date ? ` · ${s.shift_date}` : "";
    return `${s.shift_id}${d}${sup}`;
  };

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 820 }}>
      <div className="panel-inner" style={{ padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Reactivos</div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Button type="button" size="sm" variant="ghost" onClick={loadShifts} disabled={loadingShifts || saving}>
            {loadingShifts ? "Cargando..." : "Refrescar"}
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

          {/* fallback manual si no hay data */}
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

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>Insumo</div>
            <select
              value={insumo}
              disabled={saving}
              onChange={(e) => setInsumo((e.target.value as any) || "")}
              style={{
                width: "100%",
                background: "rgba(0,0,0,.10)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                borderRadius: 10,
                padding: "10px 12px",
                outline: "none",
                fontWeight: 900,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              <option value="">— Selecciona —</option>
              {INSUMOS.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
          </div>

          <Input
            placeholder=""
            value={qty}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQty(e.target.value)}
            hint="Cantidad (kg)"
          />

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
