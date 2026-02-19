// src/app/planta/datos-guardia/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../../../lib/apiClient";
import ProduccionPanel from "../../../components/planta/ProduccionPanel";
import BolasPanel from "../../../components/planta/BolasPanel";
import ReactivosPanel from "../../../components/planta/ReactivosPanel";
import DuracionPanel from "../../../components/planta/DuracionPanel";
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

function Accordion({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="panel-inner"
      style={{
        border: "1px solid rgba(255,255,255,.10)",
        borderRadius: 14,
        background: "rgba(0,0,0,.06)",
        overflow: "visible", // ✅ antes: "hidden" (esto cortaba dropdowns)
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          border: "none",
          background: "rgba(0,0,0,.10)",
          cursor: "pointer",
          color: "var(--text)",
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
        }}
      >
        <div style={{ display: "grid", gap: 2 }}>
          <div style={{ fontWeight: 950 }}>{title}</div>
          {subtitle ? (
            <div className="muted" style={{ fontWeight: 800, fontSize: 12, opacity: 0.8 }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        <div style={{ marginLeft: "auto", fontWeight: 950, opacity: 0.85 }}>{open ? "—" : "+"}</div>
      </button>

      {open ? <div style={{ padding: 14 }}>{children}</div> : null}
    </div>
  );
}

export default function DatosGuardiaPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [loadingShifts, setLoadingShifts] = useState(true);
  const [shifts, setShifts] = useState<OpenShift[]>([]);
  const [shiftId, setShiftId] = useState<string>("");

  // Varias abiertas
  const [openProd, setOpenProd] = useState(true);
  const [openBolas, setOpenBolas] = useState(false);
  const [openReact, setOpenReact] = useState(false);
  const [openDur, setOpenDur] = useState(false);

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

  const shiftLabel = (s: OpenShift) => {
    const sup = s.plant_supervisor ? ` · ${s.plant_supervisor}` : "";
    return `${s.shift_id}${sup}`;
  };

  const shiftSub = useMemo(() => {
    const q = parseShiftIdToQuery(shiftId);
    if (!q) return "";
    return `${q.date} · Guardia ${q.shift}`;
  }, [shiftId]);

  async function loadShifts() {
    setLoadingShifts(true);
    setMsg(null);
    try {
      const r = (await apiGet("/api/planta/shifts?top=500")) as ShiftsResp;
      const list = Array.isArray(r?.shifts) ? r.shifts : [];
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
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando guardias");
    } finally {
      setLoadingShifts(false);
    }
  }

  useEffect(() => {
    loadShifts();
  }, []);

  // ✅ Al cambiar guardia: solo Producción abierta, el resto cerrado
  useEffect(() => {
    if (!shiftId) return;
    setOpenProd(true);
    setOpenBolas(false);
    setOpenReact(false);
    setOpenDur(false);
  }, [shiftId]);

  function expandAll() {
    setOpenProd(true);
    setOpenBolas(true);
    setOpenReact(true);
    setOpenDur(true);
  }

  function collapseAll() {
    setOpenProd(false);
    setOpenBolas(false);
    setOpenReact(false);
    setOpenDur(false);
  }

  const anyOpen = openProd || openBolas || openReact || openDur;

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: "100%" }}>
      <div className="panel-inner" style={{ padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Datos de Guardia</div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
        <Button type="button" size="sm" variant="ghost" onClick={loadShifts} disabled={loadingShifts}>
          {loadingShifts ? "Cargando..." : "Refrescar guardias"}
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

      {/* ✅ SIN sticky ni columna derecha. Todo a ancho completo. */}
      <div className="panel-inner" style={{ padding: 14 }}>
        <div style={{ display: "grid", gap: 12 }}>
          {/* selector + acciones al costado (misma altura) */}
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "1fr auto",
              alignItems: "end",
            }}
          >
            <SearchableDropdown
              label="Guardia"
              placeholder={loadingShifts ? "Cargando..." : "Busca: 20260205-A, supervisor..."}
              value={shiftId}
              items={shiftsSorted}
              getKey={(x: OpenShift) => x.shift_id}
              getLabel={(x: OpenShift) => shiftLabel(x)}
              onSelect={(x: OpenShift) => setShiftId(String(x.shift_id || "").trim().toUpperCase())}
              disabled={loadingShifts}
            />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Button type="button" size="sm" variant="primary" onClick={expandAll} disabled={!shiftId}>
                Expandir todo
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={collapseAll} disabled={!shiftId || !anyOpen}>
                Colapsar todo
              </Button>
            </div>
          </div>

          {/* acordeones a ancho natural */}
          <div style={{ display: "grid", gap: 10, overflow: "visible" }}>
            <Accordion title="Producción" subtitle={shiftId ? shiftSub : ""} open={openProd} onToggle={() => setOpenProd((s) => !s)}>
              <ProduccionPanel shiftId={shiftId} />
            </Accordion>

            <Accordion title="Bolas" subtitle={shiftId ? shiftSub : ""} open={openBolas} onToggle={() => setOpenBolas((s) => !s)}>
              <BolasPanel shiftId={shiftId} />
            </Accordion>

            <Accordion title="Reactivos" subtitle={shiftId ? shiftSub : ""} open={openReact} onToggle={() => setOpenReact((s) => !s)}>
              <ReactivosPanel shiftId={shiftId} />
            </Accordion>

            <Accordion title="Duración" subtitle={shiftId ? shiftSub : ""} open={openDur} onToggle={() => setOpenDur((s) => !s)}>
              <DuracionPanel shiftId={shiftId} />
            </Accordion>
          </div>
        </div>
      </div>
    </div>
  );
}
