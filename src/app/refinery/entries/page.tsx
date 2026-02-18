// src/app/refinery/entries/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "../../../lib/apiClient";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

type MapRow = { reagent_name: string; subprocess_name: string };
type MappingResp = { ok: boolean; rows: MapRow[] };

type EntryRow = {
  entry_date: string; // yyyy-mm-dd
  reagent_name: string;
  entry_qty: any;
};
type EntriesResp = { ok: boolean; rows: EntryRow[] };

function isoTodayPe(): string {
  const now = new Date();
  const pe = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const y = pe.getUTCFullYear();
  const m = String(pe.getUTCMonth() + 1).padStart(2, "0");
  const d = String(pe.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

function toDecimalStrOrNullFront(v: string, scale = 9) {
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
  if (n <= 0) return null;
  if (Math.abs(n) > 9e15) return null;

  const f = Math.pow(10, scale);
  const rounded = Math.round(n * f) / f;
  return rounded.toFixed(scale);
}

function qtyOkGt0(v: string) {
  return toDecimalStrOrNullFront(v, 9) !== null;
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

function DatePicker({
  valueIso,
  onChangeIso,
  disabled,
}: {
  valueIso: string;
  onChangeIso: (iso: string) => void;
  disabled?: boolean;
}) {
  const max = useMemo(() => isoTodayPe(), []);
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontWeight: 900, fontSize: 13 }}>Fecha de Ingreso</div>
      <input
        type="date"
        value={valueIso}
        max={max}
        disabled={disabled}
        onChange={(e) => onChangeIso(e.target.value)}
        style={{
          width: "100%",
          background: "rgba(0,0,0,.10)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          borderRadius: 10,
          padding: "10px 12px",
          outline: "none",
          fontWeight: 900,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.7 : 1,
        }}
      />
    </div>
  );
}

export default function RefineryEntriesPage() {
  const [msg, setMsg] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [loadingExisting, setLoadingExisting] = useState<boolean>(false);

  const [mapping, setMapping] = useState<MapRow[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);

  const [entryDate, setEntryDate] = useState<string>(isoTodayPe());
  const [reagent, setReagent] = useState<string>("");
  const [qty, setQty] = useState<string>("");

  const reagentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of mapping || []) {
      const k = String(r.reagent_name || "").trim();
      if (k) set.add(k);
    }
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((x) => ({ value: x, label: x }));
  }, [mapping]);

  const dateOk = useMemo(() => !!entryDate && isIsoDate(entryDate) && entryDate <= isoTodayPe(), [entryDate]);

  const canSave = useMemo(() => {
    return dateOk && !!reagent && qtyOkGt0(qty) && !saving;
  }, [dateOk, reagent, qty, saving]);

    async function loadAll() {
    setLoading(true);
    try {
      const [m, e] = await Promise.all([
        apiGet("/api/refineria/mapping") as Promise<MappingResp>,
        apiGet("/api/refineria/entries") as Promise<EntriesResp>,
      ]);

      const mRows = Array.isArray(m.rows) ? m.rows : [];
      const eRows = Array.isArray(e.rows) ? e.rows : [];

      setMapping(mRows);
      setEntries(eRows);

      if (!reagent) {
        const first = Array.from(
          new Set(mRows.map((x) => String(x.reagent_name || "").trim()).filter((x) => !!x))
        ).sort((a, b) => a.localeCompare(b))[0];
        if (first) setReagent(first);
      }
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando datos");
    } finally {
      setLoading(false);
    }
  }

  function findExisting(d: string, r: string) {
    const dd = String(d || "").trim();
    const rr = String(r || "").trim();
    if (!dd || !rr) return null;
    return (entries || []).find((x) => String(x.entry_date || "").trim() === dd && String(x.reagent_name || "").trim() === rr) ?? null;
  }

  function numToStr(v: any) {
    if (v === null || v === undefined) return "";
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : "";
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!entryDate || !reagent) return;

    setLoadingExisting(true);
    setMsg(null);

    const hit = findExisting(entryDate, reagent);
    if (hit) {
      const s = numToStr(hit.entry_qty);
      setQty(s.includes("e") || s.includes("E") ? Number(hit.entry_qty).toFixed(9) : s);
      setMsg(`OK: cargado ${entryDate} · ${reagent}`);
    } else {
      setQty("");
      setMsg(null);
    }

    setLoadingExisting(false);
  }, [entryDate, reagent]);

  async function onSave() {
    setSaving(true);
    setMsg(null);
    try {
      const q = toDecimalStrOrNullFront(qty, 9);
      if (!canSave || q === null) {
        setMsg("ERROR: valida los campos");
        return;
      }

      const payload = {
        entry_date: entryDate,
        reagent_name: reagent,
        entry_qty: q,
      };

      await apiPost("/api/refineria/entries/insert", payload);
      setMsg(`OK: guardado ${entryDate} · ${reagent}`);
      await loadAll();
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando ingreso");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 820 }}>
      <div className="panel-inner" style={{ padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Entrada de Stock</div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Button type="button" size="sm" variant="ghost" onClick={loadAll} disabled={loading || saving}>
            {loading ? "Cargando..." : "Refrescar"}
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
          <DatePicker valueIso={entryDate} onChangeIso={setEntryDate} disabled={saving} />

          <Select
            label="Insumo"
            value={reagent}
            onChange={(v) => setReagent(String(v || "").trim())}
            disabled={saving || !reagentOptions.length}
            options={[{ value: "", label: "— Selecciona —" }, ...reagentOptions]}
          />

          <Input
            placeholder="Cantidad"
            value={qty}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQty(e.target.value)}
            hint="Cantidad > 0"
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