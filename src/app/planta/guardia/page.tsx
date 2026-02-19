// src/app/(planta)/guardia/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "../../../lib/apiClient";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

type LookupsResp = { ok: boolean; supervisors: string[] };

type GuardiaGetResp = {
  ok: boolean;
  shift_id: string;
  header: any | null;
  consumables: any[];
  balls: any[];
  duration: any[];
};

type PilesGetResp = {
  ok: boolean;
  rows: Array<{
    shift_id: string;
    pile_id: string;
    i_tmh: any;
    f_tmh: any;
    h2o_pct: any;
    au_feed: any;
    ag_feed: any;
    tmh: any;
    tms: any;
  }>;
};

const COMMENT_MAX = 255;

type PileItem = {
  pile_num: string;
  i_tmh: string;
  f_tmh: string;
  h2o_pct: string;
  au_feed: string;
  ag_feed: string;
};

type Form = {
  shift_date: string;
  plant_shift: "A" | "B" | "";
  plant_supervisor: string;
  shift_comment: string;
};

function isoTodayPe(): string {
  const now = new Date();
  const pe = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const y = pe.getUTCFullYear();
  const m = String(pe.getUTCMonth() + 1).padStart(2, "0");
  const d = String(pe.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildShiftId(shift_date: string, plant_shift: "A" | "B" | "") {
  if (!shift_date || (plant_shift !== "A" && plant_shift !== "B")) return "";
  const ymd = shift_date.replaceAll("-", "");
  return `${ymd}-${plant_shift}`;
}

function toNumOrNaN(s: any) {
  if (s === null || s === undefined) return NaN;
  const t = String(s).trim().replace(",", ".");
  if (!t) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function toNumOrNull(s: any) {
  const n = toNumOrNaN(s);
  return Number.isFinite(n) ? n : null;
}

function clampStrPct_1to100_OrNull(s: any) {
  const pct = toNumOrNull(s);
  if (pct === null) return null;
  if (pct < 1 || pct > 100) return null;
  return pct;
}

function pad2(v: string) {
  const n = String(v ?? "").replace(/\D/g, "");
  if (!n) return "";
  const nn = Math.max(0, Math.min(99, Number(n)));
  return String(nn).padStart(2, "0");
}

function isPileNum00to99(v: string) {
  return /^[0-9]{2}$/.test(v) && Number(v) >= 0 && Number(v) <= 99;
}

function pileIdFromNum(pile_num: string) {
  if (!isPileNum00to99(pile_num)) return "";
  return `P-${pile_num}`;
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
    options.find((o) => o.value === value)?.label ??
    options.find((o) => o.value === "")?.label ??
    "";

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
                    (e.currentTarget as any).style.background = active
                      ? "rgba(102,199,255,.18)"
                      : "transparent";
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
      <div style={{ fontWeight: 900, fontSize: 13 }}>Fecha</div>
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

function StatCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div
      className="panel-inner"
      style={{
        padding: 12,
        border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(0,0,0,.08)",
        borderRadius: 12,
        display: "grid",
        gap: 4,
      }}
    >
      <div className="muted" style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>
        {title}
      </div>
      <div style={{ fontSize: 18, fontWeight: 950 }}>{value}</div>
      {sub ? (
        <div className="muted" style={{ fontSize: 12, fontWeight: 800, opacity: 0.75 }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

export default function GuardiaPage() {
  const [supervisors, setSupervisors] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const [loadingLookups, setLoadingLookups] = useState<boolean>(true);
  const [loadingExisting, setLoadingExisting] = useState<boolean>(false);
  const [loadingPiles, setLoadingPiles] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const [headerExisting, setHeaderExisting] = useState<any | null>(null);

  const [form, setForm] = useState<Form>({
    shift_date: isoTodayPe(),
    plant_shift: "",
    plant_supervisor: "",
    shift_comment: "",
  });

  const [items, setItems] = useState<PileItem[]>([
    { pile_num: "", i_tmh: "", f_tmh: "", h2o_pct: "", au_feed: "", ag_feed: "" },
  ]);

  const shift_id = useMemo(
    () => buildShiftId(form.shift_date, form.plant_shift),
    [form.shift_date, form.plant_shift]
  );

  const dateOk = useMemo(() => {
    if (!form.shift_date) return false;
    return form.shift_date <= isoTodayPe();
  }, [form.shift_date]);

  const headerOk = useMemo(() => {
    return (
      dateOk &&
      (form.plant_shift === "A" || form.plant_shift === "B") &&
      !!form.plant_supervisor.trim() &&
      form.shift_comment.length <= COMMENT_MAX
    );
  }, [dateOk, form.plant_shift, form.plant_supervisor, form.shift_comment]);

  const validation = useMemo(() => {
    const seen = new Set<string>();
    let dup = false;
    let badDelta = false;
    let badNums = false;

    for (const it of items) {
      const pile_id = pileIdFromNum(it.pile_num);
      if (!pile_id) continue;

      if (seen.has(pile_id)) dup = true;
      seen.add(pile_id);

      const i = toNumOrNull(it.i_tmh);
      const f = toNumOrNull(it.f_tmh);
      const h2o = clampStrPct_1to100_OrNull(it.h2o_pct);
      const au = toNumOrNull(it.au_feed);
      const ag = toNumOrNull(it.ag_feed);

      const okNums = i !== null && f !== null && h2o !== null && au !== null && ag !== null;
      if (!okNums) {
        badNums = true;
        continue;
      }

      if (i < 0 || f < 0 || au < 0 || ag < 0) badNums = true;
      if (!(f > i)) badDelta = true;
    }

    return { ok: !dup && !badDelta && !badNums, dup, badDelta, badNums };
  }, [items]);

  const computedLive = useMemo(() => {
    let tmh_sum = 0;
    let tms_sum = 0;
    let w_h2o_tmh = 0;
    let w_au = 0;
    let w_ag = 0;

    for (const it of items) {
      const pile_id = pileIdFromNum(it.pile_num);
      if (!pile_id) continue;

      const i = toNumOrNaN(it.i_tmh);
      const f = toNumOrNaN(it.f_tmh);
      const h2o = toNumOrNaN(it.h2o_pct);
      const au = toNumOrNaN(it.au_feed);
      const ag = toNumOrNaN(it.ag_feed);

      if (!Number.isFinite(i) || !Number.isFinite(f) || !Number.isFinite(h2o)) continue;

      const tmh = f - i;
      if (!Number.isFinite(tmh) || tmh <= 0) continue;

      const tms = tmh * (1 - h2o / 100);
      if (!Number.isFinite(tms) || tms < 0) continue;

      tmh_sum += tmh;
      tms_sum += tms;
      w_h2o_tmh += h2o * tmh;

      if (Number.isFinite(au)) w_au += au * tms;
      if (Number.isFinite(ag)) w_ag += ag * tms;
    }

    const h2o_w = tmh_sum > 0 ? w_h2o_tmh / tmh_sum : NaN;
    const au_w = tms_sum > 0 ? w_au / tms_sum : NaN;
    const ag_w = tms_sum > 0 ? w_ag / tms_sum : NaN;

    return {
      tmh_sum,
      tms_sum,
      h2o_w,
      au_w,
      ag_w,
      has: tms_sum > 0 || tmh_sum > 0,
    };
  }, [items]);

  const displayAgg = useMemo(() => {
    if (computedLive.has) return computedLive;

    const h = headerExisting || {};
    const tmh = toNumOrNaN(h.tmh);
    const tms = toNumOrNaN(h.tms);
    const h2o = toNumOrNaN(h.h2o_pct);
    const au = toNumOrNaN(h.au_feed);
    const ag = toNumOrNaN(h.ag_feed);

    const hasAny =
      Number.isFinite(tmh) ||
      Number.isFinite(tms) ||
      Number.isFinite(h2o) ||
      Number.isFinite(au) ||
      Number.isFinite(ag);

    return {
      tmh_sum: tmh,
      tms_sum: tms,
      h2o_w: h2o,
      au_w: au,
      ag_w: ag,
      has: !!hasAny,
    };
  }, [computedLive, headerExisting]);

  function fmt(v: number, d: number) {
    if (!Number.isFinite(v)) return "—";
    return v.toFixed(d);
  }

  const canSave = useMemo(() => {
    return headerOk && validation.ok && !!shift_id && !saving;
  }, [headerOk, validation.ok, shift_id, saving]);

  const payloadItemsLive = useMemo(() => {
    return items
      .map((it) => {
        const pile_id = pileIdFromNum(it.pile_num);
        if (!pile_id) return null;

        const i = toNumOrNull(it.i_tmh);
        const f = toNumOrNull(it.f_tmh);
        const h2o = clampStrPct_1to100_OrNull(it.h2o_pct);
        const au = toNumOrNull(it.au_feed);
        const ag = toNumOrNull(it.ag_feed);

        return { pile_id, i_tmh: i, f_tmh: f, h2o_pct: h2o, au_feed: au, ag_feed: ag };
      })
      .filter(Boolean) as Array<{
      pile_id: string;
      i_tmh: number | null;
      f_tmh: number | null;
      h2o_pct: number | null;
      au_feed: number | null;
      ag_feed: number | null;
    }>;
  }, [items]);

  async function loadLookups() {
    setLoadingLookups(true);
    setMsg(null);
    try {
      const r = (await apiGet("/api/planta/lookups")) as LookupsResp;
      setSupervisors((r.supervisors ?? []).filter((x) => String(x || "").trim().length > 0));
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando supervisores");
    } finally {
      setLoadingLookups(false);
    }
  }

  async function loadHeaderIfAny(date: string, shift: "A" | "B" | "") {
    if (!date || (shift !== "A" && shift !== "B")) return;
    setLoadingExisting(true);
    setMsg(null);
    try {
      const r = (await apiGet(
        `/api/planta/guardia/get?date=${encodeURIComponent(date)}&shift=${encodeURIComponent(shift)}`
      )) as GuardiaGetResp;

      const h = r.header;
      setHeaderExisting(h || null);

      if (h) {
        setForm((s) => ({
          ...s,
          plant_supervisor: (h.plant_supervisor ?? s.plant_supervisor) as string,
          shift_comment:
            h.shift_comment === null || h.shift_comment === undefined
              ? ""
              : String(h.shift_comment).slice(0, COMMENT_MAX),
        }));
        setMsg(`OK: cargado ${r.shift_id}`);
      } else {
        setForm((s) => ({ ...s, shift_comment: "" }));
        setMsg(null);
      }
    } catch (e: any) {
      setHeaderExisting(null);
      const m = String(e?.message || "");
      if (m.includes("400") || m.includes("404")) setMsg(null);
      else setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando guardia");
    } finally {
      setLoadingExisting(false);
    }
  }

  async function loadPiles(shift_id: string) {
    if (!shift_id) return;
    setLoadingPiles(true);
    try {
      const r = (await apiGet(`/api/planta/pilas?shift_id=${encodeURIComponent(shift_id)}`)) as PilesGetResp;
      const rows = r.rows || [];

      const mapped: PileItem[] = rows.map((x) => {
        const p = String(x.pile_id || "").toUpperCase().trim();
        const num = p.startsWith("P-") ? pad2(p.slice(2)) : "";
        return {
          pile_num: num,
          i_tmh: x.i_tmh === null || x.i_tmh === undefined ? "" : String(x.i_tmh),
          f_tmh: x.f_tmh === null || x.f_tmh === undefined ? "" : String(x.f_tmh),
          h2o_pct: x.h2o_pct === null || x.h2o_pct === undefined ? "" : String(x.h2o_pct),
          au_feed: x.au_feed === null || x.au_feed === undefined ? "" : String(x.au_feed),
          ag_feed: x.ag_feed === null || x.ag_feed === undefined ? "" : String(x.ag_feed),
        };
      });

      setItems(
        mapped.length
          ? mapped
          : [{ pile_num: "", i_tmh: "", f_tmh: "", h2o_pct: "", au_feed: "", ag_feed: "" }]
      );
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando pilas");
      setItems([{ pile_num: "", i_tmh: "", f_tmh: "", h2o_pct: "", au_feed: "", ag_feed: "" }]);
    } finally {
      setLoadingPiles(false);
    }
  }

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    if (!form.shift_date || (form.plant_shift !== "A" && form.plant_shift !== "B")) {
      setHeaderExisting(null);
      setItems([{ pile_num: "", i_tmh: "", f_tmh: "", h2o_pct: "", au_feed: "", ag_feed: "" }]);
      return;
    }
    loadHeaderIfAny(form.shift_date, form.plant_shift);
    const sid = buildShiftId(form.shift_date, form.plant_shift);
    if (sid) loadPiles(sid);
  }, [form.shift_date, form.plant_shift]);

  function addRow() {
    setItems((s) => [...s, { pile_num: "", i_tmh: "", f_tmh: "", h2o_pct: "", au_feed: "", ag_feed: "" }]);
  }

  function removeRow(idx: number) {
    setItems((s) => {
      const next = s.filter((_, i) => i !== idx);
      return next.length
        ? next
        : [{ pile_num: "", i_tmh: "", f_tmh: "", h2o_pct: "", au_feed: "", ag_feed: "" }];
    });
  }

  async function onSave() {
    if (!shift_id) return;

    setMsg(null);
    setSaving(true);

    try {
      const hasAnyPiles = payloadItemsLive.length > 0;

      if (hasAnyPiles) {
        await apiPost("/api/planta/pilas/replace", { shift_id, items: payloadItemsLive });
      }

      const baseBody: any = {
        shift_date: form.shift_date,
        plant_shift: form.plant_shift,
        plant_supervisor: form.plant_supervisor,
        shift_comment: String(form.shift_comment || "").slice(0, COMMENT_MAX),
      };

      const body = hasAnyPiles
        ? {
            ...baseBody,
            tmh: Number.isFinite(computedLive.tmh_sum) ? computedLive.tmh_sum : null,
            h2o_pct: Number.isFinite(computedLive.h2o_w) ? computedLive.h2o_w : null,
            au_feed: Number.isFinite(computedLive.au_w) ? computedLive.au_w : null,
            ag_feed: Number.isFinite(computedLive.ag_w) ? computedLive.ag_w : null,
          }
        : baseBody;

      await apiPost("/api/planta/guardia/upsert", body);

      setMsg(`OK: guardado ${shift_id}`);

      await loadHeaderIfAny(form.shift_date, form.plant_shift);
      await loadPiles(shift_id);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando guardia/pilas");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 980 }}>
      <div className="panel-inner" style={{ padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Crear Guardia</div>
        <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
          {shift_id ? `shift_id: ${shift_id}` : "Selecciona fecha y guardia"}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              loadLookups();
              if (form.shift_date && (form.plant_shift === "A" || form.plant_shift === "B")) {
                loadHeaderIfAny(form.shift_date, form.plant_shift);
              }
              if (shift_id) loadPiles(shift_id);
            }}
            disabled={loadingLookups || loadingPiles || loadingExisting || saving}
          >
            {loadingLookups || loadingPiles || loadingExisting ? "Cargando..." : "Refrescar"}
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
          <div style={{ display: "grid", gridTemplateColumns: "260px 200px 1fr", gap: 12, alignItems: "end" }}>
            <DatePicker
              valueIso={form.shift_date}
              onChangeIso={(iso) => setForm((s) => ({ ...s, shift_date: iso }))}
              disabled={saving}
            />

            <Select
              label="Guardia"
              value={form.plant_shift}
              onChange={(v) => setForm((s) => ({ ...s, plant_shift: (v as any) || "" }))}
              disabled={saving}
              options={[
                { value: "", label: "— Selecciona —" },
                { value: "A", label: "A" },
                { value: "B", label: "B" },
              ]}
            />

            <Select
              label="Supervisor"
              value={form.plant_supervisor}
              onChange={(v) => setForm((s) => ({ ...s, plant_supervisor: v }))}
              disabled={loadingLookups || saving}
              options={[
                { value: "", label: "— Selecciona —" },
                ...supervisors.map((x) => ({ value: x, label: x })),
              ]}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
            <StatCard title="TMH" value={displayAgg.has ? fmt(displayAgg.tmh_sum, 3) : "—"} />
            <StatCard title="% Humedad" value={displayAgg.has ? fmt(displayAgg.h2o_w, 3) : "—"} />
            <StatCard title="TMS" value={displayAgg.has ? fmt(displayAgg.tms_sum, 3) : "—"} />
            <StatCard title="Ley de Au" value={displayAgg.has ? fmt(displayAgg.au_w, 4) : "—"} sub="g/t" />
            <StatCard title="Ley de Ag" value={displayAgg.has ? fmt(displayAgg.ag_w, 4) : "—"} sub="g/t" />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 950 }}>Pilas</div>

              <div style={{ marginLeft: "auto" }}>
                <Button type="button" size="sm" variant="ghost" onClick={addRow} disabled={!shift_id || saving}>
                  + Agregar fila
                </Button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th style={th}>Pila</th>
                    <th style={th}>Peso Inicial (TMH)</th>
                    <th style={th}>Peso Final (TMH)</th>
                    <th style={th}>%H2O (1-100)</th>
                    <th style={th}>Ley Au (g/t)</th>
                    <th style={th}>Ley Ag (g/t)</th>
                    <th style={{ ...th, width: 46 }} />
                  </tr>
                </thead>

                <tbody>
                  {items.map((it, idx) => {
                    const pile_id = pileIdFromNum(it.pile_num);
                    const showInvalid = it.pile_num && !pile_id;

                    return (
                      <tr key={idx}>
                        <td style={td}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ fontWeight: 950, opacity: 0.9 }}>P-</div>
                            <input
                              value={it.pile_num}
                              disabled={saving}
                              inputMode="numeric"
                              placeholder="00"
                              onChange={(e) => {
                                const v = pad2(e.target.value);
                                setItems((s) => s.map((x, i) => (i === idx ? { ...x, pile_num: v } : x)));
                              }}
                              style={{
                                width: 60,
                                background: "rgba(0,0,0,.10)",
                                border: showInvalid ? "1px solid rgba(255,80,80,.60)" : "1px solid var(--border)",
                                color: "var(--text)",
                                borderRadius: 10,
                                padding: "10px 10px",
                                outline: "none",
                                fontWeight: 900,
                              }}
                            />
                            <div className="muted" style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
                              {pile_id || "—"}
                            </div>
                          </div>
                        </td>

                        <td style={td}>
                          <Input
                            value={it.i_tmh}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setItems((s) => s.map((x, i) => (i === idx ? { ...x, i_tmh: e.target.value } : x)))
                            }
                            hint=""
                            placeholder=""
                          />
                        </td>

                        <td style={td}>
                          <Input
                            value={it.f_tmh}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setItems((s) => s.map((x, i) => (i === idx ? { ...x, f_tmh: e.target.value } : x)))
                            }
                            hint=""
                            placeholder=""
                          />
                        </td>

                        <td style={td}>
                          <Input
                            value={it.h2o_pct}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setItems((s) => s.map((x, i) => (i === idx ? { ...x, h2o_pct: e.target.value } : x)))
                            }
                            hint=""
                            placeholder=""
                          />
                        </td>

                        <td style={td}>
                          <Input
                            value={it.au_feed}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setItems((s) => s.map((x, i) => (i === idx ? { ...x, au_feed: e.target.value } : x)))
                            }
                            hint=""
                            placeholder=""
                          />
                        </td>

                        <td style={td}>
                          <Input
                            value={it.ag_feed}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setItems((s) => s.map((x, i) => (i === idx ? { ...x, ag_feed: e.target.value } : x)))
                            }
                            hint=""
                            placeholder=""
                          />
                        </td>

                        <td style={{ ...td, textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            disabled={saving}
                            title="Eliminar fila"
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              border: "1px solid rgba(255,255,255,.12)",
                              background: "rgba(255,80,80,.10)",
                              color: "rgba(255,255,255,.90)",
                              fontWeight: 950,
                              cursor: saving ? "not-allowed" : "pointer",
                              opacity: saving ? 0.6 : 1,
                            }}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr>
                    <td style={tfLabel}>Totales</td>
                    <td style={tf}></td>
                    <td style={tf}>
                      <div style={{ fontWeight: 950 }}>TMH: {computedLive.has ? fmt(computedLive.tmh_sum, 3) : "—"}</div>
                      <div className="muted" style={{ fontWeight: 900, fontSize: 12, opacity: 0.8 }}>
                        TMS: {computedLive.has ? fmt(computedLive.tms_sum, 3) : "—"}
                      </div>
                    </td>
                    <td style={tf}>
                      <div style={{ fontWeight: 950 }}>{computedLive.has ? fmt(computedLive.h2o_w, 3) : "—"}</div>
                      <div className="muted" style={{ fontWeight: 900, fontSize: 12, opacity: 0.8 }}>
                        %H2O pond.
                      </div>
                    </td>
                    <td style={tf}>
                      <div style={{ fontWeight: 950 }}>{computedLive.has ? fmt(computedLive.au_w, 4) : "—"}</div>
                      <div className="muted" style={{ fontWeight: 900, fontSize: 12, opacity: 0.8 }}>
                        Ley Au pond.
                      </div>
                    </td>
                    <td style={tf}>
                      <div style={{ fontWeight: 950 }}>{computedLive.has ? fmt(computedLive.ag_w, 4) : "—"}</div>
                      <div className="muted" style={{ fontWeight: 900, fontSize: 12, opacity: 0.8 }}>
                        Ley Ag pond.
                      </div>
                    </td>
                    <td style={tf}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {!validation.ok ? (
              <div
                className="panel-inner"
                style={{
                  padding: 10,
                  border: "1px solid rgba(255,80,80,.45)",
                  background: "rgba(255,80,80,.10)",
                  fontWeight: 850,
                }}
              >
                {validation.dup ? <div>No se permite repetir la misma pila (P-xx) en la misma guardia.</div> : null}
                {validation.badDelta ? <div>En cada fila válida, el Peso Final debe ser mayor que el Peso Inicial.</div> : null}
                {validation.badNums ? (
                  <div>En filas con P-xx válido, todos los campos deben ser números (≥0) y %H2O debe estar en 1–100.</div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>Comentario</div>

            <textarea
              value={form.shift_comment}
              disabled={saving}
              onChange={(e) =>
                setForm((s) => ({
                  ...s,
                  shift_comment: String(e.target.value || "").slice(0, COMMENT_MAX),
                }))
              }
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }}
              style={{
                width: "100%",
                background: "rgba(0,0,0,.10)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                borderRadius: 10,
                padding: "10px 12px",
                outline: "none",
                fontWeight: 400,
                opacity: saving ? 0.7 : 1,
                resize: "none",
                overflow: "hidden",
                minHeight: 44,
              }}
              placeholder="(opcional)"
              maxLength={COMMENT_MAX}
            />

            <div className="muted" style={{ fontWeight: 900, fontSize: 11, textAlign: "right", opacity: 0.8 }}>
              {String(form.shift_comment || "").length}/{COMMENT_MAX}
            </div>
          </div>

          {loadingExisting || loadingPiles ? (
            <div className="muted" style={{ fontWeight: 800 }}>
              Cargando datos existentes…
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 10px",
  fontWeight: 950,
  fontSize: 12,
  opacity: 0.85,
  borderBottom: "1px solid rgba(255,255,255,.10)",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "10px 10px",
  borderBottom: "1px solid rgba(255,255,255,.06)",
  verticalAlign: "top",
};

const tfLabel: React.CSSProperties = {
  padding: "12px 10px",
  borderTop: "1px solid rgba(255,255,255,.10)",
  fontWeight: 950,
  opacity: 0.9,
};

const tf: React.CSSProperties = {
  padding: "12px 10px",
  borderTop: "1px solid rgba(255,255,255,.10)",
  verticalAlign: "top",
};
