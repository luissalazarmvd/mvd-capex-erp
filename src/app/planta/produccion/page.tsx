// src/app/planta/produccion/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "../../../lib/apiClient";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

type OpenShift = {
  shift_id: string;
  shift_date?: string;
  plant_shift?: "A" | "B";
  plant_supervisor?: string | null;
};

type ShiftsResp = {
  ok: boolean;
  shifts: OpenShift[];
};

type GuardiaGetResp = {
  ok: boolean;
  shift_id: string;
  header: any | null;
  consumables: { shift_id: string; reagent_name: string; qty: any }[];
  balls: any[];
  duration: any[];
};

function toNumOrNaN(s: string) {
  if (!s) return NaN;
  const t = String(s).trim().replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function toNumOrNull(s: string) {
  const n = toNumOrNaN(s);
  return Number.isFinite(n) ? n : null;
}

function okNonNegOrEmpty(s: string) {
  const t = String(s ?? "").trim();
  if (!t) return true;
  const n = toNumOrNaN(t);
  return Number.isFinite(n) && n >= 0;
}

function okPct1to100OrEmpty(s: string) {
  const t = String(s ?? "").trim();
  if (!t) return true;
  const n = toNumOrNaN(t);
  return Number.isFinite(n) && n >= 1 && n <= 100;
}

function okPh1to14OrEmpty(s: string) {
  const t = String(s ?? "").trim();
  if (!t) return true;
  const n = toNumOrNaN(t);
  return Number.isFinite(n) && n >= 1 && n <= 14;
}

function pctStrToDecimalOrNull(s: string) {
  const t = String(s ?? "").trim();
  if (!t) return null;
  const n = toNumOrNaN(t);
  if (!Number.isFinite(n) || n < 1 || n > 100) return null;
  return n / 100;
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
    return items.filter((it) => getLabel(it).toLowerCase().includes(qq) || getKey(it).toLowerCase().includes(qq));
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

export default function ProduccionPage() {
  const [msg, setMsg] = useState<string | null>(null);

  const [loadingShifts, setLoadingShifts] = useState(true);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [shifts, setShifts] = useState<OpenShift[]>([]);
  const [shiftId, setShiftId] = useState<string>("");

  const [densityOf, setDensityOf] = useState("");
  const [pct200, setPct200] = useState("");

  const [auSolidOf, setAuSolidOf] = useState("");
  const [auSoluOf, setAuSoluOf] = useState("");

  const [agSolidOf, setAgSolidOf] = useState("");
  const [agSoluOf, setAgSoluOf] = useState("");

  const [nacnOf, setNacnOf] = useState("");
  const [nacnAds, setNacnAds] = useState("");
  const [nacnTail, setNacnTail] = useState("");

  const [phOf, setPhOf] = useState("");
  const [phAds, setPhAds] = useState("");
  const [phTail, setPhTail] = useState("");

  const shiftLabel = (s: OpenShift) => {
    const sup = s.plant_supervisor ? ` · ${s.plant_supervisor}` : "";
    return `${s.shift_id}${sup}`;
  };

  const validNonNeg =
    okNonNegOrEmpty(densityOf) &&
    okNonNegOrEmpty(auSolidOf) &&
    okNonNegOrEmpty(auSoluOf) &&
    okNonNegOrEmpty(agSolidOf) &&
    okNonNegOrEmpty(agSoluOf);

  const validPct = okPct1to100OrEmpty(pct200) && okPct1to100OrEmpty(nacnOf) && okPct1to100OrEmpty(nacnAds) && okPct1to100OrEmpty(nacnTail);

  const validPh = okPh1to14OrEmpty(phOf) && okPh1to14OrEmpty(phAds) && okPh1to14OrEmpty(phTail);

  const canSave = useMemo(() => !!shiftId && validNonNeg && validPct && validPh && !saving, [shiftId, validNonNeg, validPct, validPh, saving]);

  async function loadShifts() {
    setLoadingShifts(true);
    setMsg(null);
    try {
      const r = (await apiGet("/api/planta/shifts?top=400")) as ShiftsResp;
      const list = Array.isArray(r.shifts) ? r.shifts : [];
      setShifts(list);
    } catch (e: any) {
      setShifts([]);
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando guardias");
    } finally {
      setLoadingShifts(false);
    }
  }

  function clearFields() {
    setDensityOf("");
    setPct200("");
    setAuSolidOf("");
    setAuSoluOf("");
    setAgSolidOf("");
    setAgSoluOf("");
    setNacnOf("");
    setNacnAds("");
    setNacnTail("");
    setPhOf("");
    setPhAds("");
    setPhTail("");
  }

  async function loadExisting(sid: string) {
    if (!sid) return;
    setLoadingExisting(true);
    setMsg(null);
    try {
      const q = sid.trim().toUpperCase();
      const m = q.match(/^(\d{4})(\d{2})(\d{2})-([AB])$/);
      if (!m) return;

      const date = `${m[1]}-${m[2]}-${m[3]}`;
      const shift = m[4];

      const r = (await apiGet(
        `/api/planta/guardia/get?date=${encodeURIComponent(date)}&shift=${encodeURIComponent(shift)}`
      )) as GuardiaGetResp;

      const h = r.header || null;

      clearFields();

      if (h) {
        if (h.density_of !== null && h.density_of !== undefined) setDensityOf(String(h.density_of));

        if (h.pct_200 !== null && h.pct_200 !== undefined) {
          const v = Number(h.pct_200);
          setPct200(Number.isFinite(v) ? String(Math.round(v * 100 * 1000) / 1000) : String(h.pct_200));
        }

        if (h.au_solid_of !== null && h.au_solid_of !== undefined) setAuSolidOf(String(h.au_solid_of));
        if (h.au_solu_of !== null && h.au_solu_of !== undefined) setAuSoluOf(String(h.au_solu_of));

        if (h.ag_solid_of !== null && h.ag_solid_of !== undefined) setAgSolidOf(String(h.ag_solid_of));
        if (h.ag_solu_of !== null && h.ag_solu_of !== undefined) setAgSoluOf(String(h.ag_solu_of));

        if (h.nacn_of !== null && h.nacn_of !== undefined) {
          const v = Number(h.nacn_of);
          setNacnOf(Number.isFinite(v) ? String(Math.round(v * 100 * 1000) / 1000) : String(h.nacn_of));
        }
        if (h.nacn_ads !== null && h.nacn_ads !== undefined) {
          const v = Number(h.nacn_ads);
          setNacnAds(Number.isFinite(v) ? String(Math.round(v * 100 * 1000) / 1000) : String(h.nacn_ads));
        }
        if (h.nacn_tail !== null && h.nacn_tail !== undefined) {
          const v = Number(h.nacn_tail);
          setNacnTail(Number.isFinite(v) ? String(Math.round(v * 100 * 1000) / 1000) : String(h.nacn_tail));
        }

        if (h.ph_of !== null && h.ph_of !== undefined) setPhOf(String(h.ph_of));
        if (h.ph_ads !== null && h.ph_ads !== undefined) setPhAds(String(h.ph_ads));
        if (h.ph_tail !== null && h.ph_tail !== undefined) setPhTail(String(h.ph_tail));
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
    loadExisting(shiftId);
  }, [shiftId]);

  async function onSave() {
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        shift_id: shiftId.trim().toUpperCase(),
        density_of: toNumOrNull(densityOf),
        pct_200: pctStrToDecimalOrNull(pct200),
        au_solid_of: toNumOrNull(auSolidOf),
        au_solu_of: toNumOrNull(auSoluOf),
        ag_solid_of: toNumOrNull(agSolidOf),
        ag_solu_of: toNumOrNull(agSoluOf),
        nacn_of: pctStrToDecimalOrNull(nacnOf),
        nacn_ads: pctStrToDecimalOrNull(nacnAds),
        nacn_tail: pctStrToDecimalOrNull(nacnTail),
        ph_of: toNumOrNull(phOf),
        ph_ads: toNumOrNull(phAds),
        ph_tail: toNumOrNull(phTail),
      };

      await apiPost("/api/planta/produccion/upsert", payload);
      setMsg(`OK: guardado ${payload.shift_id} · Producción`);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando producción");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 980 }}>
      <div className="panel-inner" style={{ padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Producción</div>

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
            items={shifts}
            getKey={(x: OpenShift) => x.shift_id}
            getLabel={(x: OpenShift) => shiftLabel(x)}
            onSelect={(x: OpenShift) => setShiftId(String(x.shift_id || "").trim().toUpperCase())}
            disabled={saving}
          />

          {!shifts.length ? (
            <div style={{ display: "grid", gap: 6 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                Si no ves guardias aquí, pega el shift_id manual (formato: YYYYMMDD-A o YYYYMMDD-B).
              </div>
              <Input
                placeholder="Ej: 20260205-A"
                value={shiftId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShiftId(e.target.value.trim().toUpperCase())}
                hint="shift_id"
              />
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr", alignItems: "start" }}>
            <Input value={densityOf} onChange={(e: any) => setDensityOf(e.target.value)} hint="Densidad (g/l)" />
            <Input value={pct200} onChange={(e: any) => setPct200(e.target.value)} hint="%-m-200 (1-100)" />
            <div />

            <Input value={auSolidOf} onChange={(e: any) => setAuSolidOf(e.target.value)} hint="Au Sólido OF (g/t)" />
            <Input value={auSoluOf} onChange={(e: any) => setAuSoluOf(e.target.value)} hint="Au Solución OF (g/m³)" />
            <Input value={agSolidOf} onChange={(e: any) => setAgSolidOf(e.target.value)} hint="Ag Sólido OF (g/t)" />

            <Input value={agSoluOf} onChange={(e: any) => setAgSoluOf(e.target.value)} hint="Ag Solución OF (g/m³)" />
            <Input value={nacnOf} onChange={(e: any) => setNacnOf(e.target.value)} hint="%NaCN OF (1-100)" />
            <Input value={nacnAds} onChange={(e: any) => setNacnAds(e.target.value)} hint="%NaCN TK1 (1-100)" />

            <Input value={nacnTail} onChange={(e: any) => setNacnTail(e.target.value)} hint="%NaCN TK11 (1-100)" />
            <Input value={phOf} onChange={(e: any) => setPhOf(e.target.value)} hint="PH OF (1-14)" />
            <Input value={phAds} onChange={(e: any) => setPhAds(e.target.value)} hint="PH TK1 (1-14)" />

            <Input value={phTail} onChange={(e: any) => setPhTail(e.target.value)} hint="PH TK11 (1-14)" />
            <div />
            <div />
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
