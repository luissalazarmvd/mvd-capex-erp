// src/app/refinery/campaign/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../../lib/apiClient";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

type CampaignRow = {
  campaign_id: string;
  campaign_date: string | null;
  campaign_wet_cr: any;
  campaign_moisture_pct: any;
  campaign_au_grade: any;
  campaign_ag_grade: any;
  campaign_cr: any;
  campaign_au: any;
  campaign_ag: any;
  campaign_cu: any;
};

type CampaignsResp = {
  ok: boolean;
  rows: CampaignRow[];
};

type Form = {
  campaign_no: string;
  campaign_date: string;
  campaign_wet_cr: string;
  campaign_moisture_pct: string;
  campaign_au_grade: string;
  campaign_ag_grade: string;
};

function isoTodayPe(): string {
  const now = new Date();
  const pe = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const y = pe.getUTCFullYear();
  const m = String(pe.getUTCMonth() + 1).padStart(2, "0");
  const d = String(pe.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toNumOrNaN(s: string) {
  if (s === null || s === undefined) return NaN;
  const t = String(s).trim().replace(",", ".");
  if (!t) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function clampInt_1to99_OrNull(s: string) {
  const n = toNumOrNaN(s);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (String(i) !== String(n) && String(n).includes(".")) return null;
  if (i < 1 || i > 99) return null;
  return i;
}

function clampPct_1to100_OrNull(s: string) {
  const n = toNumOrNaN(s);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 100) return null;
  return n;
}

function gt0_OrNull(s: string) {
  const n = toNumOrNaN(s);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return n;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function buildCampaignId(campaign_date: string, campaign_no: string) {
  const no = clampInt_1to99_OrNull(campaign_no);
  if (!campaign_date || no === null) return "";
  const dt = new Date(`${campaign_date}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return "";
  const y = String(dt.getFullYear()).slice(-2);
  const m = pad2(dt.getMonth() + 1);
  const n2 = pad2(no);
  return `${y}-C${m}-${n2}`;
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
      <div style={{ fontWeight: 900, fontSize: 13 }}>Fecha de Campaña</div>
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

export default function RefineryCampaignPage() {
  const [msg, setMsg] = useState<string | null>(null);

  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [loadingExisting, setLoadingExisting] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [existingDateIso, setExistingDateIso] = useState<string | null>(null);

  const [form, setForm] = useState<Form>({
    campaign_no: "",
    campaign_date: isoTodayPe(),
    campaign_wet_cr: "",
    campaign_moisture_pct: "",
    campaign_au_grade: "",
    campaign_ag_grade: "",
  });

  const campaign_id = useMemo(
    () => buildCampaignId(form.campaign_date, form.campaign_no),
    [form.campaign_date, form.campaign_no]
  );

  const dateOk = useMemo(() => {
    if (!form.campaign_date) return false;
    return form.campaign_date <= isoTodayPe();
  }, [form.campaign_date]);

  const inputsOk = useMemo(() => {
    const no = clampInt_1to99_OrNull(form.campaign_no);
    const wet = gt0_OrNull(form.campaign_wet_cr);
    const moist = clampPct_1to100_OrNull(form.campaign_moisture_pct);
    const au = gt0_OrNull(form.campaign_au_grade);
    const ag = gt0_OrNull(form.campaign_ag_grade);
    return dateOk && no !== null && wet !== null && moist !== null && au !== null && ag !== null;
  }, [
    dateOk,
    form.campaign_no,
    form.campaign_wet_cr,
    form.campaign_moisture_pct,
    form.campaign_au_grade,
    form.campaign_ag_grade,
  ]);

  const canSave = useMemo(() => inputsOk && !!campaign_id && !saving, [inputsOk, campaign_id, saving]);

  async function loadCampaigns() {
    setLoadingList(true);
    setMsg(null);
    try {
      const r = (await apiGet("/api/refineria/campaigns")) as CampaignsResp;
      setRows(Array.isArray(r.rows) ? r.rows : []);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando campañas");
    } finally {
      setLoadingList(false);
    }
  }

  function numToStr(v: any) {
    if (v === null || v === undefined) return "";
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : "";
  }

  async function loadExistingIfAny() {
        if (!campaign_id) {
      setExistingDateIso(null);
      setForm((s) => ({
        ...s,
        campaign_wet_cr: "",
        campaign_moisture_pct: "",
        campaign_au_grade: "",
        campaign_ag_grade: "",
      }));
      return;
    }

    setLoadingExisting(true);
    setMsg(null);
    try {
      const list = rows.length
        ? rows
        : ((await apiGet("/api/refineria/campaigns")) as CampaignsResp).rows || [];

      if (!rows.length) setRows(Array.isArray(list) ? list : []);

      const ex =
        (Array.isArray(list) ? list : []).find(
          (x) => String(x.campaign_id || "").trim().toUpperCase() === campaign_id.toUpperCase()
        ) ?? null;

      if (ex) {
        setExistingDateIso(ex.campaign_date ? String(ex.campaign_date).slice(0, 10) : null);
        setForm((s) => ({
          ...s,
          campaign_date: (ex.campaign_date ?? s.campaign_date) as string,
          campaign_wet_cr: numToStr(ex.campaign_wet_cr),
          campaign_moisture_pct:
            ex.campaign_moisture_pct === null || ex.campaign_moisture_pct === undefined
              ? ""
              : String(Number(ex.campaign_moisture_pct) * 100),
          campaign_au_grade: numToStr(ex.campaign_au_grade),
          campaign_ag_grade: numToStr(ex.campaign_ag_grade),
        }));
        setMsg(`OK: cargado ${campaign_id}`);
      } else {
        setExistingDateIso(null);

        // si no existe la campaña, limpiar campos dependientes
        setForm((s) => ({
          ...s,
          campaign_wet_cr: "",
          campaign_moisture_pct: "",
          campaign_au_grade: "",
          campaign_ag_grade: "",
        }));

        setMsg(null);
      }

    } catch (e: any) {
      const m = String(e?.message || "");
      if (m.includes("400") || m.includes("404")) setMsg(null);
      else setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando campaña");
    } finally {
      setLoadingExisting(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    setExistingDateIso(null);
    loadExistingIfAny();
  }, [campaign_id]);

  async function onSave() {
    setMsg(null);
    setSaving(true);
    try {
      const no = clampInt_1to99_OrNull(form.campaign_no);
      const wet = gt0_OrNull(form.campaign_wet_cr);
      const moistPct = clampPct_1to100_OrNull(form.campaign_moisture_pct);
      const au = gt0_OrNull(form.campaign_au_grade);
      const ag = gt0_OrNull(form.campaign_ag_grade);

      if (!campaign_id || no === null || wet === null || moistPct === null || au === null || ag === null || !dateOk) {
        setMsg("ERROR: valida los campos");
        return;
      }

      const moistDec = moistPct / 100;
      const campaign_cr = wet * (1 - moistDec);

      const payload = {
        campaign_id,
        campaign_date: form.campaign_date,
        campaign_wet_cr: wet,
        campaign_moisture_pct: moistDec,
        campaign_au_grade: au,
        campaign_ag_grade: ag,
        campaign_cr,
      };

      await apiPost("/api/refineria/campaign/upsert", payload);
      setMsg(`OK: guardado ${campaign_id}`);
      await loadCampaigns();
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando campaña");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 820 }}>
      <div className="panel-inner" style={{ padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Crear Campaña</div>
        <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
          {campaign_id
            ? `campaign_id: ${campaign_id}${existingDateIso ? `  |  fecha: ${existingDateIso}` : ""}`
            : "Completa # campaña y fecha"}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Button type="button" size="sm" variant="ghost" onClick={loadCampaigns} disabled={loadingList || saving}>
            {loadingList ? "Cargando..." : "Refrescar"}
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
          <div style={{ display: "grid", gridTemplateColumns: "260px 260px 1fr", gap: 12, alignItems: "end" }}>
            {/* # CAMPAÑA */}
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 900, fontSize: 13 }}># de Campaña en el Mes</div>
              <input
                value={form.campaign_no}
                disabled={saving}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    campaign_no: String(e.target.value || "").replace(/[^\d]/g, "").slice(0, 2),
                  }))
                }
                placeholder=""
                inputMode="numeric"
                style={{
                  width: "100%",
                  background: "rgba(0,0,0,.10)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  outline: "none",
                  fontWeight: 900,
                  opacity: saving ? 0.7 : 1,
                }}
              />
            </div>

            {/* FECHA */}
            <DatePicker
              valueIso={form.campaign_date}
              onChangeIso={(iso) => setForm((s) => ({ ...s, campaign_date: iso }))}
              disabled={saving}
            />

            <div className="muted" style={{ fontWeight: 900, fontSize: 12, alignSelf: "center", opacity: 0.9 }}>
              {loadingExisting ? "Cargando existente…" : campaign_id ? "Si existe, se autocompleta" : ""}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input
              placeholder=""
              value={form.campaign_wet_cr}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((s) => ({ ...s, campaign_wet_cr: e.target.value }))
              }
              hint="Carbón Húmedo (kg) > 0"
            />
            <Input
              placeholder=""
              value={form.campaign_moisture_pct}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((s) => ({ ...s, campaign_moisture_pct: e.target.value }))
              }
              hint="# de Humedad (1-100)"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input
              placeholder=""
              value={form.campaign_au_grade}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((s) => ({ ...s, campaign_au_grade: e.target.value }))
              }
              hint="Ley Au > 0"
            />
            <Input
              placeholder=""
              value={form.campaign_ag_grade}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((s) => ({ ...s, campaign_ag_grade: e.target.value }))
              }
              hint="Ley Ag > 0"
            />
          </div>

          {!inputsOk ? (
            <div className="muted" style={{ fontWeight: 900, fontSize: 12, color: "rgba(255,255,255,.70)" }}>
              Completa todos los campos y respeta rangos: # campaña 1-99, humedad 1-100, kg y leyes &gt; 0.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
