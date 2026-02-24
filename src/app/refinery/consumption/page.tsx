// src/app/refinery/consumption/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../../../lib/apiClient";
import { Button } from "../../../components/ui/Button";
import ConsSubStock from "../../../components/refinery/ConsSubStock";

type CampaignRow = { campaign_id: string };
type CampaignsResp = { ok: boolean; rows: CampaignRow[] };
type LatestResp = { ok: boolean; campaign_id: string | null };

type MapRow = { reagent_name: string; subprocess_name: string };
type MappingResp = { ok: boolean; rows: MapRow[] };

function isoTodayPe(): string {
  const now = new Date();
  const pe = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const y = pe.getUTCFullYear();
  const m = String(pe.getUTCMonth() + 1).padStart(2, "0");
  const d = String(pe.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [mapping, setMapping] = useState<MapRow[]>([]);

  const [campaignId, setCampaignId] = useState<string>("");
  const [reagent, setReagent] = useState<string>(""); // opcional: vacío = todos

  const [consDate, setConsDate] = useState<string>(isoTodayPe());
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
      const [c, m] = await Promise.all([
        apiGet("/api/refineria/campaigns") as Promise<CampaignsResp>,
        apiGet("/api/refineria/mapping") as Promise<MappingResp>,
      ]);

      const cRows = Array.isArray(c.rows) ? c.rows : [];
      const mRows = Array.isArray(m.rows) ? m.rows : [];

      setCampaigns(cRows);
      setMapping(mRows);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLatestCampaignId();
    loadMeta();
  }, []);

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
                setSubStockRefreshKey((k) => k + 1);
              }}
              disabled={loading}
            >
              {loading ? "Cargando..." : "Refrescar"}
            </Button>
          </div>
        </div>

        {msg ? (
          <div
            className="panel-inner"
            style={{
              padding: 12,
              border: "1px solid rgba(255,80,80,.45)",
              background: "rgba(255,80,80,.10)",
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
              onSelect={(x: CampaignRow) => {
                setCampaignId(String(x.campaign_id || "").trim().toUpperCase());
                setSubStockRefreshKey((k) => k + 1);
              }}
              disabled={loading}
            />

            <Select
              label="Insumo (opcional)"
              value={reagent}
              onChange={(v) => {
                setReagent(String(v || "").trim());
                setSubStockRefreshKey((k) => k + 1);
              }}
              disabled={loading || !reagentOptions.length}
              options={[{ value: "", label: "— Todos —" }, ...reagentOptions]}
            />

            <DatePicker valueIso={consDate} onChangeIso={setConsDate} disabled={loading} />
          </div>
        </div>
      </div>

      <div className="panel-inner" style={{ padding: 0, width: "100%", overflow: "hidden" }}>
        <ConsSubStock
          campaignId={campaignId}
          reagentName={reagent}
          consumptionDateIso={consDate}
          refreshKey={subStockRefreshKey}
          onSaved={() => {
            // si quieres, el componente puede pedir refrescar meta/campañas, etc.
            // acá solo refrescamos la tabla:
            setSubStockRefreshKey((k) => k + 1);
          }}
        />
      </div>
    </div>
  );
}