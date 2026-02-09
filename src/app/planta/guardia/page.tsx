// src/app/(planta)/guardia/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "../../../lib/apiClient";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

type LookupsResp = {
  ok: boolean;
  supervisors: string[];
};

type GuardiaGetResp = {
  ok: boolean;
  shift_id: string;
  header: any | null;
  consumables: any[];
  balls: any[];
  duration: any[];
};

const COMMENT_MAX = 255;

type Form = {
  shift_date: string;
  plant_shift: "A" | "B" | "";
  plant_supervisor: string;
  tmh: string;
  h2o_pct: string;
  au_feed: string;
  ag_feed: string;
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

function clampStrPct_1to100_OrNull(s: string) {
  const pct = toNumOrNull(s);
  if (pct === null) return null;
  if (pct < 1 || pct > 100) return null;
  return pct;
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

export default function GuardiaPage() {
  const [supervisors, setSupervisors] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const [loadingLookups, setLoadingLookups] = useState<boolean>(true);
  const [loadingExisting, setLoadingExisting] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const [form, setForm] = useState<Form>({
    shift_date: isoTodayPe(),
    plant_shift: "",
    plant_supervisor: "",
    tmh: "",
    h2o_pct: "",
    au_feed: "",
    ag_feed: "",
    shift_comment: "",
  });

  const shift_id = useMemo(() => buildShiftId(form.shift_date, form.plant_shift), [form.shift_date, form.plant_shift]);

  const metricsOk = useMemo(() => {
    const tmh = toNumOrNaN(form.tmh);
    const h2oPct = toNumOrNaN(form.h2o_pct);
    const au = toNumOrNaN(form.au_feed);
    const ag = toNumOrNaN(form.ag_feed);

    const okTmh = Number.isFinite(tmh) && tmh >= 0;
    const okH2o = Number.isFinite(h2oPct) && h2oPct >= 1 && h2oPct <= 100;
    const okAu = Number.isFinite(au) && au >= 0;
    const okAg = Number.isFinite(ag) && ag >= 0;

    return okTmh && okH2o && okAu && okAg;
  }, [form.ag_feed, form.au_feed, form.h2o_pct, form.tmh]);

  const dateOk = useMemo(() => {
    if (!form.shift_date) return false;
    return form.shift_date <= isoTodayPe();
  }, [form.shift_date]);

  const canSave = useMemo(() => {
    return (
      dateOk &&
      (form.plant_shift === "A" || form.plant_shift === "B") &&
      !!form.plant_supervisor.trim() &&
      metricsOk &&
      form.shift_comment.length <= COMMENT_MAX &&
      !saving
    );
  }, [dateOk, form.plant_shift, form.plant_supervisor, metricsOk, form.shift_comment, saving]);

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

  async function loadExistingIfAny(date: string, shift: "A" | "B" | "") {
    if (!date || (shift !== "A" && shift !== "B")) return;
    setLoadingExisting(true);
    setMsg(null);
    try {
      const r = (await apiGet(
        `/api/planta/guardia/get?date=${encodeURIComponent(date)}&shift=${encodeURIComponent(shift)}`
      )) as GuardiaGetResp;

      const h = r.header;

      if (h) {
        setForm((s) => ({
          ...s,
          plant_supervisor: (h.plant_supervisor ?? s.plant_supervisor) as string,
          tmh: h.tmh === null || h.tmh === undefined ? "" : String(h.tmh),
          h2o_pct: h.h2o_pct === null || h.h2o_pct === undefined ? "" : String(h.h2o_pct),
          au_feed: h.au_feed === null || h.au_feed === undefined ? "" : String(h.au_feed),
          ag_feed: h.ag_feed === null || h.ag_feed === undefined ? "" : String(h.ag_feed),
          shift_comment:
            h.shift_comment === null || h.shift_comment === undefined ? "" : String(h.shift_comment).slice(0, COMMENT_MAX),
        }));
        setMsg(`OK: cargado ${r.shift_id}`);
      } else {
        setForm((s) => ({
          ...s,
          tmh: "",
          h2o_pct: "",
          au_feed: "",
          ag_feed: "",
          shift_comment: "",
        }));
        setMsg(null);
      }
    } catch (e: any) {
      const m = String(e?.message || "");
      if (m.includes("400") || m.includes("404")) {
        setMsg(null);
      } else {
        setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando guardia");
      }
    } finally {
      setLoadingExisting(false);
    }
  }

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    loadExistingIfAny(form.shift_date, form.plant_shift);
  }, [form.shift_date, form.plant_shift]);

  async function onSave() {
    setMsg(null);
    setSaving(true);
    try {
      const payload = {
        shift_date: form.shift_date,
        plant_shift: form.plant_shift,
        plant_supervisor: form.plant_supervisor,
        tmh: toNumOrNull(form.tmh),
        h2o_pct: clampStrPct_1to100_OrNull(form.h2o_pct),
        au_feed: toNumOrNull(form.au_feed),
        ag_feed: toNumOrNull(form.ag_feed),
        shift_comment: String(form.shift_comment || "").slice(0, COMMENT_MAX),
      };

      const r: any = await apiPost("/api/planta/guardia/upsert", payload);
      setMsg(`OK: guardado ${String(r?.shift_id || shift_id)}`);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando guardia");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 820 }}>
      <div className="panel-inner" style={{ padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Crear Guardia</div>
        <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
          {shift_id ? `shift_id: ${shift_id}` : "Selecciona fecha y guardia"}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Button type="button" size="sm" variant="ghost" onClick={loadLookups} disabled={loadingLookups || saving}>
            {loadingLookups ? "Cargando..." : "Refrescar"}
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input
              placeholder=""
              value={form.tmh}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((s) => ({ ...s, tmh: e.target.value }))}
              hint="TMH"
            />
            <Input
              placeholder=""
              value={form.h2o_pct}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((s) => ({ ...s, h2o_pct: e.target.value }))}
              hint="%Humedad (1-100)"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input
              placeholder=""
              value={form.au_feed}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((s) => ({ ...s, au_feed: e.target.value }))}
              hint="Au Feed (g/t)"
            />
            <Input
              placeholder=""
              value={form.ag_feed}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((s) => ({ ...s, ag_feed: e.target.value }))}
              hint="Ag Feed (g/t)"
            />
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
