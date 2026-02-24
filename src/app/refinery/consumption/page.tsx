// src/app/refinery/consumption/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "../../../lib/apiClient";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import ConsSubStock from "../../../components/refinery/ConsSubStock";

type CampaignRow = { campaign_id: string };
type CampaignsResp = { ok: boolean; rows: CampaignRow[] };
type LatestResp = { ok: boolean; campaign_id: string | null };

type MapRow = { reagent_name: string; subprocess_name: string };
type MappingResp = { ok: boolean; rows: MapRow[] };

type ReagentRow = {
  reagent_id: string;
  reagent_name: string | null;
  unit_name: string | null;
  reagent_type: string | null;
  balls_size: any;
  unit_weight: any;
  updated_at: any;
};
type ReagentsResp = { ok: boolean; rows: ReagentRow[] };

type ConsRow = {
  campaign_id: string;
  reagent_name: string;
  consumption_date: string | null;
  subprocess_name: string;
  consumption_qty: any;
};
type ConsumptionResp = { ok: boolean; rows: ConsRow[] };

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
              maxHeight: 6 * 44,
              overflowY: "auto",
              overscrollBehavior: "contain",
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
      <div style={{ fontWeight: 900, fontSize: 13 }}>Fecha de Consumo</div>
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

export default function RefineryConsumptionPage() {
  const [msg, setMsg] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [loadingExisting, setLoadingExisting] = useState<boolean>(false);

  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [mapping, setMapping] = useState<MapRow[]>([]);
  const [consRows, setConsRows] = useState<ConsRow[]>([]);

  const [reagents, setReagents] = useState<ReagentRow[]>([]);

  const [campaignId, setCampaignId] = useState<string>("");
  const [reagent, setReagent] = useState<string>("");
  const [subprocess, setSubprocess] = useState<string>("");
  const [consDate, setConsDate] = useState<string>(isoTodayPe());
  const [qty, setQty] = useState<string>("");
  const [subStockRefreshKey, setSubStockRefreshKey] = useState<number>(0);

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

  const subprocessOptions = useMemo(() => {
    const set = new Set<string>();
    const r0 = String(reagent || "").trim();
    for (const m of mapping || []) {
      if (String(m.reagent_name || "").trim() === r0) {
        const sp = String(m.subprocess_name || "").trim();
        if (sp) set.add(sp);
      }
    }
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((x) => ({ value: x, label: x }));
  }, [mapping, reagent]);

  const dateOk = useMemo(() => !!consDate && isIsoDate(consDate) && consDate <= isoTodayPe(), [consDate]);

  const canSave = useMemo(() => {
    return !!campaignId && !!reagent && !!subprocess && dateOk && qtyOkGt0(qty) && !saving;
  }, [campaignId, reagent, subprocess, dateOk, qty, saving]);

  const selectedUnit = useMemo(() => {
    const r = String(reagent || "").trim();
    if (!r) return null;

    const hit =
      (reagents || []).find((x) => String(x.reagent_name || "").trim() === r) ??
      (reagents || []).find((x) => String(x.reagent_name || "").trim().toLowerCase() === r.toLowerCase()) ??
      null;

    const u = String(hit?.unit_name || "").trim();
    return u ? u : null;
  }, [reagent, reagents]);

  const qtyLabel = useMemo(() => {
    return selectedUnit ? `Cantidad (${selectedUnit})` : "Cantidad";
  }, [selectedUnit]);

  async function loadLatestCampaignId() {
    try {
      const r = (await apiGet("/api/refineria/campaigns/latest")) as LatestResp;
      const latest = String(r?.campaign_id || "").trim().toUpperCase();
      if (latest) setCampaignId(latest);
    } catch {}
  }

  async function loadMeta(opts?: { keepMsg?: boolean }) {
    setLoading(true);
    if (!opts?.keepMsg) setMsg(null);

    try {
      const [c, m, r] = await Promise.all([
        apiGet("/api/refineria/campaigns") as Promise<CampaignsResp>,
        apiGet("/api/refineria/mapping") as Promise<MappingResp>,
        apiGet("/api/refineria/reagents") as Promise<ReagentsResp>,
      ]);

      const cRows = Array.isArray(c.rows) ? c.rows : [];
      const mRows = Array.isArray(m.rows) ? m.rows : [];
      const rRows = Array.isArray((r as any)?.rows) ? (r as any).rows : [];

      setCampaigns(cRows);
      setMapping(mRows);
      setReagents(rRows);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando datos");
    } finally {
      setLoading(false);
    }
  }

  async function loadConsumptionForCampaign(cId: string) {
    const id = String(cId || "").trim().toUpperCase();
    if (!id) {
      setConsRows([]);
      return;
    }
    try {
      const r = (await apiGet(`/api/refineria/consumption?campaign_id=${encodeURIComponent(id)}`)) as ConsumptionResp;
      setConsRows(Array.isArray(r.rows) ? r.rows : []);
    } catch {
      setConsRows([]);
    }
  }

  function findExisting(cId: string, r: string, sp: string) {
    const a = String(cId || "").trim().toUpperCase();
    const b = String(r || "").trim();
    const c = String(sp || "").trim();
    if (!a || !b || !c) return null;
    return (
      (consRows || []).find(
        (x) =>
          String(x.campaign_id || "").trim().toUpperCase() === a &&
          String(x.reagent_name || "").trim() === b &&
          String(x.subprocess_name || "").trim() === c
      ) ?? null
    );
  }

  function numToStr(v: any) {
    if (v === null || v === undefined) return "";
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : "";
  }

  useEffect(() => {
    loadLatestCampaignId();
    loadMeta();
  }, []);

  useEffect(() => {
    loadConsumptionForCampaign(campaignId);
  }, [campaignId]);

  useEffect(() => {
    const opts = new Set(subprocessOptions.map((x) => x.value));
    if (subprocess && !opts.has(subprocess)) setSubprocess("");
  }, [subprocessOptions]);

  useEffect(() => {
    if (!campaignId || !reagent || !subprocess) return;

    setLoadingExisting(true);
    setMsg(null);

    const hit = findExisting(campaignId, reagent, subprocess);
    if (hit) {
      const d = String(hit.consumption_date || "").trim();
      setConsDate(isIsoDate(d) ? d : isoTodayPe());

      const s = numToStr(hit.consumption_qty);
      setQty(s.includes("e") || s.includes("E") ? Number(hit.consumption_qty).toFixed(9) : s);

      setMsg(`OK: cargado ${campaignId} · ${reagent} · ${subprocess}`);
    } else {
      setConsDate(isoTodayPe());
      setQty("");
      setMsg(null);
    }

    setLoadingExisting(false);
  }, [campaignId, reagent, subprocess, consRows]);

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
        campaign_id: campaignId,
        reagent_name: reagent,
        subprocess_name: subprocess,
        consumption_date: consDate,
        consumption_qty: q,
      };

      await apiPost("/api/refineria/consumption/insert", payload);
      setMsg(`OK: guardado ${campaignId} · ${reagent} · ${subprocess}`);
      await loadLatestCampaignId();
      await loadMeta({ keepMsg: true });
      await loadConsumptionForCampaign(campaignId);
      setSubStockRefreshKey((k) => k + 1);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando consumo");
    } finally {
      setSaving(false);
    }
  }

  const campaignLabel = (x: CampaignRow) => String(x.campaign_id || "").trim().toUpperCase();

  return (
    <div style={{ display: "grid", gap: 12, width: "100%" }}>
      <div style={{ display: "grid", gap: 12, maxWidth: 820 }}>
        <div className="panel-inner" style={{ padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontWeight: 900 }}>Consumos</div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                loadLatestCampaignId();
                loadMeta();
              }}
              disabled={loading || saving}
            >
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
            <SearchableDropdown
              label="Campaña"
              placeholder={loading ? "Cargando campañas..." : "Find items"}
              value={campaignId}
              items={campaigns}
              getKey={(x: CampaignRow) => String(x.campaign_id || "").trim().toUpperCase()}
              getLabel={(x: CampaignRow) => campaignLabel(x)}
              onSelect={(x: CampaignRow) => setCampaignId(String(x.campaign_id || "").trim().toUpperCase())}
              disabled={saving}
            />

            <Select
              label="Insumo"
              value={reagent}
              onChange={(v) => setReagent(String(v || "").trim())}
              disabled={saving || !reagentOptions.length}
              options={[{ value: "", label: "— Selecciona —" }, ...reagentOptions]}
            />

            <Select
              label="Subproceso"
              value={subprocess}
              onChange={(v) => setSubprocess(String(v || "").trim())}
              disabled={saving || !reagent || !subprocessOptions.length}
              options={[
                { value: "", label: reagent ? "— Selecciona —" : "Selecciona un insumo primero" },
                ...subprocessOptions,
              ]}
            />

            <DatePicker valueIso={consDate} onChangeIso={setConsDate} disabled={saving} />

            {/* CAMBIO: título dinámico según unidad */}
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 900, fontSize: 13 }}>{qtyLabel}</div>
              <Input
                placeholder=""
                value={qty}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQty(e.target.value)}
                hint="Cantidad > 0"
              />
            </div>

            {loadingExisting ? (
              <div className="muted" style={{ fontWeight: 800 }}>
                Cargando datos existentes…
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="panel-inner" style={{ padding: 0, width: "100%", overflow: "hidden" }}>
        <ConsSubStock campaignId={campaignId} reagentName={reagent} refreshKey={subStockRefreshKey} />
      </div>
    </div>
  );
}
