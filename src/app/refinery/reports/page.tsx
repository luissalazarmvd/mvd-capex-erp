// src/app/refinery/reports/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../../../lib/apiClient";
import Summary from "../../../components/refinery/Summary";
import ConsSubStock from "../../../components/refinery/ConsSubStock";

const PBI_REFINERY_REPORTS_URL =
  "https://app.powerbi.com/view?r=eyJrIjoiZTFlMjdjM2UtNTk0Yi00MTg3LThmN2UtYTYxYTM0NjJhMjFlIiwidCI6IjYzNzhiZmNkLWRjYjktNDMwZi05Nzc4LWRiNTk3NGRjMmFkYyIsImMiOjR9";

type CampaignRow = { campaign_id: string };
type CampaignsResp = { ok: boolean; rows: CampaignRow[]; error?: string };
type LatestResp = { ok: boolean; campaign_id: string | null; error?: string };

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
            zIndex: 50,
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--panel)",
            boxShadow: "0 10px 24px rgba(0,0,0,.25)",
            maxHeight: 280,
            overflow: "auto",
            overscrollBehavior: "contain",
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

export default function RefineryReportsPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignId, setCampaignId] = useState<string>("");

  const [refreshKey, setRefreshKey] = useState<number>(0);

  async function loadCampaignsAndPickLatest(opts?: { keepSelected?: boolean }) {
    setLoading(true);
    setMsg(null);
    try {
      const [c, latest] = await Promise.all([
        apiGet("/api/refineria/campaigns") as Promise<CampaignsResp>,
        apiGet("/api/refineria/campaigns/latest") as Promise<LatestResp>,
      ]);

      const rows = Array.isArray(c?.rows) ? c.rows : [];
      setCampaigns(rows);

      const latestId = String(latest?.campaign_id || "").trim().toUpperCase();
      const firstId = String(rows?.[0]?.campaign_id || "").trim().toUpperCase();

      const current = String(campaignId || "").trim().toUpperCase();
      const keep = opts?.keepSelected && current;

      const pick = keep ? current : latestId || firstId;
      if (pick) setCampaignId(pick);

      if (!rows.length) setMsg("Sin campañas.");
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando campañas");
      setCampaigns([]);
      setCampaignId("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCampaignsAndPickLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const campaignLabel = (x: CampaignRow) => String(x.campaign_id || "").trim().toUpperCase();

  return (
    <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
      {/* FILA 1: dropdown */}
      <div className="panel-inner" style={{ padding: 12 }}>
        <div style={{ display: "grid", gap: 10, maxWidth: 720 }}>
          <SearchableDropdown
            label="Campaña"
            placeholder={loading ? "Cargando campañas..." : "Buscar..."}
            value={campaignId}
            items={campaigns}
            getKey={(x: CampaignRow) => String(x.campaign_id || "").trim().toUpperCase()}
            getLabel={(x: CampaignRow) => campaignLabel(x)}
            onSelect={(x: CampaignRow) => {
              const id = String(x.campaign_id || "").trim().toUpperCase();
              setCampaignId(id);
              setRefreshKey((k) => k + 1);
            }}
            disabled={loading}
          />

          {msg ? (
            <div
              style={{
                padding: 10,
                border: msg.startsWith("ERROR")
                  ? "1px solid rgba(255,80,80,.45)"
                  : "1px solid rgba(255,255,255,.10)",
                background: msg.startsWith("ERROR") ? "rgba(255,80,80,.10)" : "rgba(255,255,255,.04)",
                fontWeight: 800,
                borderRadius: 12,
              }}
            >
              {msg}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => loadCampaignsAndPickLatest({ keepSelected: true })}
            disabled={loading}
            style={{
              width: "fit-content",
              justifySelf: "start",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "rgba(0,0,0,.10)",
              color: "var(--text)",
              padding: "8px 10px",
              fontWeight: 900,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>
      </div>

      {/* FILA 2: summary */}
      <Summary campaignId={campaignId} />

      {/* FILA 3: ConsSubStock full width */}
      <div className="panel-inner" style={{ padding: 0, width: "100%", overflow: "hidden" }}>
        <ConsSubStock campaignId={campaignId} reagentName={""} refreshKey={refreshKey} />
      </div>

      {/* FILA 4: titulo dashboard */}
      <div className="panel-inner" style={{ padding: "10px 12px" }}>
        <div style={{ fontWeight: 900 }}>Dashboard - Power BI</div>
      </div>

      {/* FILA 5: PBI */}
      <div className="panel-inner" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ position: "relative", width: "100%", height: "calc(100vh - 120px)" }}>
          <iframe
            title="MVD - Refinería - Reportes"
            src={PBI_REFINERY_REPORTS_URL}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
