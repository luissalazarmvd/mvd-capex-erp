// src/app/refinery/production/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "../../../lib/apiClient";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import ConsSubStock from "../../../components/refinery/ConsSubStock";

type CampaignRow = {
  campaign_id: string;
  campaign_au: any;
  campaign_ag: any;
  campaign_cu: any;
};
type CampaignsResp = { ok: boolean; rows: CampaignRow[] };
type LatestResp = { ok: boolean; campaign_id: string | null };

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

function toDecimalStrOrNullFrontAllow0(v: string, scale = 9) {
  const s0 = String(v ?? "").trim();
  if (s0 === "") return null;

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

function qtyOkGte0(v: string) {
  return toDecimalStrOrNullFrontAllow0(v, 9) !== null;
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

export default function RefineryProductionPage() {
  const [msg, setMsg] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [loadingExisting, setLoadingExisting] = useState<boolean>(false);

  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignId, setCampaignId] = useState<string>("");

  const [auKg, setAuKg] = useState<string>("");
  const [agKg, setAgKg] = useState<string>("");
  const [cuKg, setCuKg] = useState<string>("");

  const canSave = useMemo(() => {
    return !!campaignId && qtyOkGt0(auKg) && qtyOkGt0(agKg) && qtyOkGte0(cuKg) && !saving;
  }, [campaignId, auKg, agKg, cuKg, saving]);

  function numToStr(v: any) {
    if (v === null || v === undefined) return "";
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : "";
  }

  async function loadCampaigns(opts?: { keepMsg?: boolean }) {
    setLoading(true);
    if (!opts?.keepMsg) setMsg(null);

    try {
      const r = (await apiGet("/api/refineria/campaigns")) as CampaignsResp;
      const rows = Array.isArray(r.rows) ? r.rows : [];
      setCampaigns(rows);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando campañas");
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadLatestCampaignId() {
    try {
      const r = (await apiGet("/api/refineria/campaigns/latest")) as LatestResp;
      const latest = String(r?.campaign_id || "").trim().toUpperCase();
      if (latest) setCampaignId(latest);
    } catch {
    }
  }

  function findCampaign(cId: string) {
    const a = String(cId || "").trim().toUpperCase();
    if (!a) return null;
    return (campaigns || []).find((x) => String(x.campaign_id || "").trim().toUpperCase() === a) ?? null;
  }

  useEffect(() => {
    loadLatestCampaignId();
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (!campaignId) return;
    setLoadingExisting(true);

    const hit = findCampaign(campaignId);
    if (hit) {
      const sAu = numToStr(hit.campaign_au);
      const sAg = numToStr(hit.campaign_ag);
      const sCu = numToStr(hit.campaign_cu);

      setAuKg(sAu ? (sAu.includes("e") || sAu.includes("E") ? Number(hit.campaign_au).toFixed(9) : sAu) : "");
      setAgKg(sAg ? (sAg.includes("e") || sAg.includes("E") ? Number(hit.campaign_ag).toFixed(9) : sAg) : "");
      setCuKg(sCu ? (sCu.includes("e") || sCu.includes("E") ? Number(hit.campaign_cu).toFixed(9) : sCu) : "");
    } else {
      setAuKg("");
      setAgKg("");
      setCuKg("");
    }

    setLoadingExisting(false);
  }, [campaignId, campaigns]);

  async function onSave() {
    setSaving(true);
    setMsg(null);
    try {
      const au = toDecimalStrOrNullFront(auKg, 9);
      const ag = toDecimalStrOrNullFront(agKg, 9);
      const cu = toDecimalStrOrNullFrontAllow0(cuKg, 9);

      if (!canSave || au === null || ag === null || cu === null) {
        setMsg("ERROR: valida los campos");
        return;
      }

      const payload = {
        campaign_id: campaignId,
        campaign_au: au,
        campaign_ag: ag,
        campaign_cu: cu,
      };

      await apiPost("/api/refineria/campaign/upsert", payload);
      setMsg(`OK: guardado ${campaignId}`);
      await loadLatestCampaignId();
      await loadCampaigns({ keepMsg: true });
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando producción");
    } finally {
      setSaving(false);
    }
  }

  const campaignLabel = (x: CampaignRow) => String(x.campaign_id || "").trim().toUpperCase();

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 820 }}>
      <div className="panel-inner" style={{ padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Producción</div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Button type="button" size="sm" variant="ghost" onClick={() => loadCampaigns()} disabled={loading || saving}>
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

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>Producción Au (kg)</div>
            <Input
              placeholder="Cantidad"
              value={auKg}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAuKg(e.target.value)}
              hint="Cantidad > 0"
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>Producción Ag (kg)</div>
            <Input
              placeholder="Cantidad"
              value={agKg}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgKg(e.target.value)}
              hint="Cantidad > 0"
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>Producción Cu (kg)</div>
            <Input
              placeholder="Cantidad"
              value={cuKg}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCuKg(e.target.value)}
              hint="Cantidad ≥ 0"
            />
          </div>

          {loadingExisting ? (
            <div className="muted" style={{ fontWeight: 800 }}>
              Cargando datos existentes…
            </div>
          ) : null}

          <div style={{ height: 10 }} />

          <div className="panel-inner" style={{ padding: 0, overflow: "hidden" }}>
            <ConsSubStock />
          </div>
        </div>
      </div>
    </div>
  );
}
