// src/app/(planta)/reactivos/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "../../../lib/apiClient";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

type ShiftRow = {
  shift_id: string;
  shift_date?: string;
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

function qtyOk(v: string) {
  return toDecimalStrOrNullFront(v, 18) !== null;
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

  const canSave = useMemo(() => !!shiftId && !!insumo && qtyOk(qty) && !saving, [shiftId, insumo, qty, saving]);

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

  async function loadShifts() {
    setLoadingShifts(true);
    setMsg(null);
    try {
      const r = (await apiGet("/api/planta/shifts?top=500")) as ShiftsResp;
      const list = Array.isArray(r.shifts) ? r.shifts : [];
      setShifts(list);

      const sorted = [...list];
      sorted.sort((a, b) => {
        const ad = String(a.shift_date || "").replaceAll("-", "");
        const bd = String(b.shift_date || "").replaceAll("-", "");
        if (ad !== bd) return bd.localeCompare(ad);
        const ash = String(a.plant_shift || "");
        const bsh = String(b.plant_shift || "");
        if (ash !== bsh) return bsh.localeCompare(ash);
        return String(b.shift_id || "").localeCompare(String(a.shift_id || ""));
      });

      if (sorted[0]?.shift_id) setShiftId(String(sorted[0].shift_id || "").trim().toUpperCase());
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
        if (hit && hit.qty !== null && hit.qty !== undefined) {
          const s = String(hit.qty);
          setQty(s.includes("e") || s.includes("E") ? Number(hit.qty).toFixed(18) : s);
        } else {
          setQty("");
        }
      }
    } catch {
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
  }, [shiftId]);

  useEffect(() => {
    if (!shiftId || !insumo) return;
    loadExistingForSelectedShift(shiftId);
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
            qty: qty.trim(),
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
    return `${s.shift_id}${sup}`;
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

          <Select
            label="Insumo"
            value={insumo}
            onChange={(v) => setInsumo((v as any) || "")}
            disabled={saving}
            options={[{ value: "", label: "— Selecciona —" }, ...INSUMOS.map((x) => ({ value: x.value, label: x.label }))]}
          />

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
