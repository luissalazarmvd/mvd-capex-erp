// src/app/refinery/consumption/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "../../../lib/apiClient";
import { Button } from "../../../components/ui/Button";
import { Table } from "../../../components/ui/Table";
import ConsImpExp from "../../../components/refinery/ConsImpExp";

type CampaignRow = {
  campaign_id: string;
  campaign_date: string | null;
};
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

type ViewRow = {
  campaign_id: string;
  reagent_name: string;
  stock: any;
  [k: string]: any;
};
type ViewResp = { ok: boolean; rows: ViewRow[] };

const SUBPRO_COLS = [
  "Ablandador de Agua",
  "Agua Regia - Disolución",
  "Agua Regia - Neutralización",
  "Agua Regia - Precipitación",
  "Ataque de Lanillas",
  "Ataque Químico",
  "Desorción",
  "Filtrado - Au",
  "Filtrado - Ag",
  "Fundición",
  "Fundición - Au",
  "Fundición - Ag",
  "Guantes",
  "Mandiles",
  "Metalización - Ag",
  "Neutralización - Gases",
  "Neutralización de Pozas de Solución Barren - Solución",
  "Neutralización - Solución",
  "Otros",
  "Reactivación Química",
  "Regeneración Resinas Desionizador",
  "Torres de Neutralización - Gases",
] as const;

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

function toNum(v: any) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function fmtFixed(v: any, digits: number) {
  const n = toNum(v);
  if (n === null) return "";
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function uniqSorted(a: string[]) {
  return Array.from(new Set(a.filter((x) => !!String(x || "").trim()))).sort((x, y) => x.localeCompare(y));
}

function colWidth(key: string) {
  if (key === "reagent_name") return 220;
  if (key === "stock") return 110;
  if (key === "__total__") return 140;
  const s = String(key || "");
  return Math.max(150, Math.min(220, 90 + s.length * 4));
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
  if (n < 0) return null;
  if (Math.abs(n) > 9e15) return null;

  const f = Math.pow(10, scale);
  const rounded = Math.round(n * f) / f;
  return rounded.toFixed(scale);
}

function cellKey(reagent_name: string, subprocess_name: string) {
  return `${reagent_name}||${subprocess_name}`;
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

export default function RefineryConsumptionPage() {
  const [msg, setMsg] = useState<string | null>(null);

  const [loadingMeta, setLoadingMeta] = useState<boolean>(true);
  const [loadingTable, setLoadingTable] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [mlRunning, setMlRunning] = useState<boolean>(false);

  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [mapping, setMapping] = useState<MapRow[]>([]);
  const [reagents, setReagents] = useState<ReagentRow[]>([]);
  const [rows, setRows] = useState<ViewRow[]>([]);

  const [campaignId, setCampaignId] = useState<string>("");
    const [reagent, setReagent] = useState<string>("");

    const campaignDateById = useMemo(
      () =>
        new Map<string, string>(
          (campaigns || [])
            .map((x) => [String(x.campaign_id || "").trim().toUpperCase(), String(x.campaign_date || "").trim()] as const)
            .filter(([campaign_id]) => !!campaign_id)
        ),
      [campaigns]
    );

    const consDate = useMemo(() => campaignDateById.get(campaignId) || "", [campaignDateById, campaignId]);

  const [orig, setOrig] = useState<Record<string, number | null>>({});
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  const modeAllReagents = !String(reagent || "").trim();

  const unitByReagent = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of reagents || []) {
      const name = String(r.reagent_name || "").trim();
      const unit = String(r.unit_name || "").trim();
      if (name && unit) m.set(name, unit);
    }
    return m;
  }, [reagents]);

  function unitForReagentName(name: any) {
    const key = String(name || "").trim();
    if (!key) return "";
    return unitByReagent.get(key) || unitByReagent.get(key.toLowerCase()) || "";
  }

  function fmtWithUnit(v: any, digits: number, unit?: string | null) {
    const s = fmtFixed(v, digits);
    const u = String(unit || "").trim();
    if (!s) return "";
    return u ? `${s} ${u}` : s;
  }

  async function loadLatestCampaignId() {
    try {
      const r = (await apiGet("/api/refineria/campaigns/latest")) as LatestResp;
      const latest = String(r?.campaign_id || "").trim().toUpperCase();
      if (latest) setCampaignId(latest);
    } catch {}
  }

  async function loadMeta() {
    setLoadingMeta(true);
    setMsg(null);
    try {
      const [c, m, rr] = await Promise.all([
        apiGet("/api/refineria/campaigns") as Promise<CampaignsResp>,
        apiGet("/api/refineria/mapping") as Promise<MappingResp>,
        apiGet("/api/refineria/reagents") as Promise<ReagentsResp>,
      ]);

      setCampaigns(Array.isArray(c.rows) ? c.rows : []);
      setMapping(Array.isArray(m.rows) ? m.rows : []);
      setReagents(Array.isArray((rr as any)?.rows) ? (rr as any).rows : []);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando meta");
    } finally {
      setLoadingMeta(false);
    }
  }

  async function loadRows(cId: string, rName?: string, clearMsg: boolean = true) {
    const c = String(cId || "").trim().toUpperCase();
    const rn = String(rName || "").trim();

    if (!c) {
      setRows([]);
      if (clearMsg) setMsg(null);
      return;
    }

    setLoadingTable(true);
    if (clearMsg) setMsg(null);
    try {
      const q = rn
        ? `?campaign_id=${encodeURIComponent(c)}&reagent_name=${encodeURIComponent(rn)}`
        : `?campaign_id=${encodeURIComponent(c)}`;

      const r = (await apiGet(`/api/refineria/cons-stock-subpro${q}`)) as ViewResp;
      const rr = Array.isArray(r?.rows) ? r.rows : [];
      setRows(rr);

      if (!rr.length && clearMsg) {
        setMsg(rn ? "Sin datos para esa campaña/insumo." : "Sin datos para esa campaña.");
      }
    } catch (e: any) {
      setRows([]);
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando");
    } finally {
      setLoadingTable(false);
    }
  }

  useEffect(() => {
    loadLatestCampaignId();
    loadMeta();
  }, []);

  useEffect(() => {
    loadRows(campaignId, reagent);
  }, [campaignId, reagent]);

  useEffect(() => {
    let alive = true;

    async function loadMlStatus() {
      try {
        const r = await apiGet("/api/refineria/ml/status");
        if (!alive) return;
        setMlRunning(!!(r as any)?.status?.isRunning);
      } catch {
        if (!alive) return;
        setMlRunning(false);
      }
    }

    loadMlStatus();

    const timer = window.setInterval(() => {
      loadMlStatus();
    }, 4000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

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

  const mappedCellSet = useMemo(() => {
    const set = new Set<string>();
    for (const m of mapping || []) {
      const rn = String(m.reagent_name || "").trim();
      const sp = String(m.subprocess_name || "").trim();
      if (rn && sp) set.add(cellKey(rn, sp));
    }
    return set;
  }, [mapping]);

  const mappedSubpros = useMemo(() => {
    const colsInView = new Set<string>(SUBPRO_COLS as any);

    if (modeAllReagents) {
      const reagentsInRows = new Set((rows || []).map((x) => String(x.reagent_name || "").trim()).filter((x) => !!x));

      const fromMap = mapping
        .filter((m) => reagentsInRows.has(String(m.reagent_name || "").trim()))
        .map((m) => String(m.subprocess_name || "").trim())
        .filter((s) => !!s);

      return uniqSorted(fromMap).filter((s) => colsInView.has(s));
    }

    const r0 = String(reagent || "").trim();
    const fromMap = mapping
      .filter((m) => String(m.reagent_name || "").trim() === r0)
      .map((m) => String(m.subprocess_name || "").trim())
      .filter((s) => !!s);

    return uniqSorted(fromMap).filter((s) => colsInView.has(s));
  }, [mapping, reagent, rows, modeAllReagents]);

  const nonZeroSubpros = useMemo(() => {
    if (!rows.length) return [];
    return (SUBPRO_COLS as any as string[]).filter((c) =>
      (rows || []).some((r) => {
        const n = toNum((r as any)[c]);
        return n !== null && n !== 0;
      })
    );
  }, [rows]);

  const visibleSubpros = useMemo(
    () => (mappedSubpros.length ? mappedSubpros : nonZeroSubpros),
    [mappedSubpros, nonZeroSubpros]
  );

  const rowTotal = useMemo(() => {
    const keys = visibleSubpros || [];
    return (r: ViewRow) => {
      let sum = 0;
      let any = false;
      for (const k of keys) {
        const n = toNum((r as any)[k]);
        if (n !== null) {
          sum += n;
          any = true;
        }
      }
      return any ? sum : null;
    };
  }, [visibleSubpros]);

  useEffect(() => {
    const o: Record<string, number | null> = {};
    const e: Record<string, string> = {};
    const d: Record<string, boolean> = {};

    for (const r of rows || []) {
      const rn = String(r.reagent_name || "").trim();
      if (!rn) continue;

      for (const sp of visibleSubpros || []) {
        const k = cellKey(rn, sp);
        if (!mappedCellSet.has(k)) continue;

        const raw = toNum((r as any)[sp]);
        const n = raw === 0 ? null : raw;

        o[k] = n;
        e[k] = n === null ? "" : String(n);
        d[k] = false;
      }
    }

    setOrig(o);
    setEdit(e);
    setDirty(d);
  }, [rows, visibleSubpros, mappedCellSet]);

  const dirtyCount = useMemo(() => {
    let n = 0;

    for (const r of rows || []) {
      const rn = String(r.reagent_name || "").trim();
      if (!rn) continue;

      for (const sp of visibleSubpros || []) {
        const k = cellKey(rn, sp);
        if (!mappedCellSet.has(k)) continue;
        if (!dirty[k]) continue;

        const raw = String(edit[k] ?? "").trim();
        if (!raw) continue;

        const q = toDecimalStrOrNullFront(raw, 9);
        if (q === null) continue;

        n += 1;
      }
    }

    return n;
  }, [dirty, edit, rows, visibleSubpros, mappedCellSet]);

  function onChangeCell(reagent_name: string, sp: string, v: string) {
    const k = cellKey(reagent_name, sp);
    if (!mappedCellSet.has(k)) return;

    setEdit((m) => ({ ...m, [k]: v }));
    setDirty((m) => {
      const raw = String(v ?? "");
      const trimmed = raw.trim();
      const parseable = trimmed === "" ? true : toDecimalStrOrNullFront(trimmed, 9) !== null;

      const newNum = toNum(raw);
      const oldNum = orig[k] ?? null;

      const isDirty =
        !parseable ? true : (newNum ?? null) !== (oldNum ?? null) || (trimmed === "" && (oldNum ?? null) !== null);

      return { ...m, [k]: isDirty };
    });
  }

  async function onSaveAll() {
    if (saving) return;

    if (mlRunning) {
      setMsg("ERROR: no se puede guardar mientras el modelo ML está corriendo.");
      return;
    }

    const cId = String(campaignId || "").trim().toUpperCase();
    if (!cId) {
      setMsg("ERROR: selecciona campaña");
      return;
    }
    if (!consDate || !isIsoDate(consDate)) {
      setMsg("ERROR: fecha inválida");
      return;
    }
    if (!dirtyCount) {
      setMsg("Nada que guardar.");
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      const payloads: any[] = [];

      for (const r of rows || []) {
        const rn = String(r.reagent_name || "").trim();
        if (!rn) continue;

        for (const sp of visibleSubpros || []) {
          const k = cellKey(rn, sp);
          if (!dirty[k]) continue;

          const raw = String(edit[k] ?? "").trim();
          if (!raw) continue;

          const q = toDecimalStrOrNullFront(raw, 9);
          if (q === null) {
            setMsg(`ERROR: valor inválido en "${rn}" · "${sp}" (debe ser >= 0)`);
            return;
          }

          payloads.push({
            campaign_id: cId,
            reagent_name: rn,
            subprocess_name: sp,
            consumption_date: consDate,
            consumption_qty: q,
          });
        }
      }

      if (!payloads.length) {
        setMsg("Nada que guardar (no se guardan celdas vacías).");
        return;
      }

      for (const p of payloads) {
        await apiPost("/api/refineria/consumption/insert", p);
      }

      await loadRows(campaignId, reagent, false);
      setMsg(`OK: guardado (${payloads.length} celdas) · Fecha ${consDate}`);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando");
    } finally {
      setSaving(false);
    }
  }

  const cols = useMemo(() => {
    const base = [
      { key: "reagent_name", label: "Insumo", w: colWidth("reagent_name") },
      { key: "stock", label: "Stock", w: colWidth("stock") },
    ];

    const subs = visibleSubpros.map((name) => ({
      key: name,
      label: name,
      w: colWidth(name),
    }));

    const totalCol = { key: "__total__", label: "Total", w: colWidth("__total__") };
    return [...base, ...subs, totalCol];
  }, [visibleSubpros]);

  const cellBase: React.CSSProperties = {
    padding: "8px 10px",
    fontSize: 12,
    lineHeight: "16px",
    wordBreak: "normal",
  };

  const headerBg = "rgb(6, 36, 58)";
  const headerBorder = "1px solid rgba(191, 231, 255, 0.26)";
  const headerShadow = "0 8px 18px rgba(0,0,0,.18)";

  const stickyHead: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 8,
    background: headerBg,
    boxShadow: headerShadow,
  };

  const stickyLeftHead: React.CSSProperties = {
    ...stickyHead,
    left: 0,
    zIndex: 13,
  };

  const stickyRightHead: React.CSSProperties = {
    ...stickyHead,
    right: 0,
    zIndex: 12,
  };

  const stickyRightCell: React.CSSProperties = {
    position: "sticky",
    right: 0,
    zIndex: 6,
    background: "rgb(5, 40, 63)",
    boxShadow: " -10px 0 18px rgba(0,0,0,.22)",
  };

  const stickyLeftCell: React.CSSProperties = {
    position: "sticky",
    left: 0,
    zIndex: 7,
    background: "rgb(5, 40, 63)",
    boxShadow: " 10px 0 18px rgba(0,0,0,.22)",
  };

  const numCell: React.CSSProperties = { ...cellBase, textAlign: "right", whiteSpace: "nowrap" };
  const textCell: React.CSSProperties = {
    ...cellBase,
    textAlign: "left",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    textAlign: "right",
    background: "rgba(0,0,0,.10)",
    border: "1px solid rgba(255,255,255,.10)",
    color: "var(--text)",
    borderRadius: 8,
    padding: "6px 8px",
    outline: "none",
    fontWeight: 900,
    fontSize: 12,
  };

  const campaignLabel = (x: CampaignRow) => String(x.campaign_id || "").trim().toUpperCase();
  const canQuery = !!String(campaignId || "").trim();

  return (
    <div style={{ display: "grid", gap: 12, width: "100%" }}>
      <div
        className="panel-inner"
        style={{ padding: 10, display: "flex", gap: 10, alignItems: "center", width: "100%" }}
      >
        <div style={{ fontWeight: 900 }}>Consumos</div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <ConsImpExp
            setMsgAction={setMsg}
            afterImportAction={async () => {
              await loadRows(campaignId, reagent);
            }}
            disabled={loadingMeta || loadingTable || saving || mlRunning}
          />

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              loadLatestCampaignId();
              loadMeta();
              loadRows(campaignId, reagent);
            }}
            disabled={loadingMeta || loadingTable || saving}
          >
            {loadingMeta || loadingTable ? "Cargando..." : "Refrescar"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={onSaveAll}
            disabled={saving || !canQuery || mlRunning}
          >
            {saving ? "Guardando…" : `Guardar${dirtyCount ? ` (${dirtyCount})` : ""}`}
          </Button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, maxWidth: 820 }}>
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
              placeholder={loadingMeta ? "Cargando campañas..." : "Find items"}
              value={campaignId}
              items={campaigns}
              getKey={(x: CampaignRow) => String(x.campaign_id || "").trim().toUpperCase()}
              getLabel={(x: CampaignRow) => campaignLabel(x)}
              onSelect={(x: CampaignRow) => setCampaignId(String(x.campaign_id || "").trim().toUpperCase())}
              disabled={loadingMeta || saving}
            />

            <Select
              label="Insumo (opcional)"
              value={reagent}
              onChange={(v) => setReagent(String(v || "").trim())}
              disabled={loadingMeta || saving || !reagentOptions.length}
              options={[{ value: "", label: "— Todos —" }, ...reagentOptions]}
            />
          </div>
        </div>
      </div>

      <div
        className="panel-inner"
        style={{
          padding: 0,
          width: "100%",
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {rows.length ? (
          <div style={{ display: "inline-block", width: "max-content", maxWidth: "100%" }}>
            <Table stickyHeader maxHeight={"calc(100vh - 260px)"}>
              <thead>
                <tr>
                  {cols.map((c) => {
                    const k = String(c.key);
                    const isTotal = k === "__total__";
                    const isReagent = k === "reagent_name";
                    return (
                      <th
                        key={k}
                        className="capex-th"
                        style={{
                          ...(isTotal ? stickyRightHead : isReagent ? stickyLeftHead : stickyHead),
                          width: c.w ?? 160,
                          minWidth: c.w ?? 160,
                          border: headerBorder,
                          borderBottom: headerBorder,
                          textAlign: "center",
                          padding: "6px 4px",
                          fontSize: 12,
                          fontWeight: 900,
                          whiteSpace: "normal",
                          lineHeight: "14px",
                          verticalAlign: "middle",
                          height: 42,
                        }}
                        title={c.label}
                      >
                        <div
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            margin: "0 auto",
                            padding: 0,
                            textAlign: "center",
                          }}
                        >
                          {c.label}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {rows.map((row, ridx) => (
                  <tr key={`${String(row.reagent_name || ridx)}-${ridx}`} className="capex-tr">
                    {cols.map((c) => {
                      const key = String(c.key);
                      const isReagent = key === "reagent_name";
                      const isTotal = key === "__total__";

                      if (isTotal) {
                        const total = rowTotal(row);
                        const unit = unitForReagentName(row.reagent_name);
                        const txt = fmtWithUnit(total, 2, unit);

                        return (
                          <td
                            key={`${ridx}-${key}`}
                            className="capex-td"
                            style={{
                              ...numCell,
                              ...stickyRightCell,
                              width: c.w ?? 160,
                              minWidth: c.w ?? 160,
                              padding: "6px 6px",
                              background: stickyRightCell.background as any,
                              borderBottom: "1px solid rgba(255,255,255,.06)",
                              fontWeight: 900,
                            }}
                            title={txt}
                          >
                            {txt}
                          </td>
                        );
                      }

                      if (isReagent) {
                        const txt = String((row as any)[key] ?? "");
                        return (
                          <td
                            key={`${ridx}-${key}`}
                            className="capex-td"
                            style={{
                              ...textCell,
                              ...stickyLeftCell,
                              width: c.w ?? 160,
                              minWidth: c.w ?? 160,
                              padding: "6px 6px",
                              background: stickyLeftCell.background as any,
                              borderBottom: "1px solid rgba(255,255,255,.06)",
                              fontWeight: 900,
                            }}
                            title={txt}
                          >
                            {txt}
                          </td>
                        );
                      }

                      if (key === "stock") {
                        const txt = fmtFixed((row as any)[key], 2);
                        return (
                          <td
                            key={`${ridx}-${key}`}
                            className="capex-td"
                            style={{
                              ...numCell,
                              width: c.w ?? 160,
                              minWidth: c.w ?? 160,
                              padding: "6px 6px",
                              background: "rgba(0,0,0,.10)",
                              borderBottom: "1px solid rgba(255,255,255,.06)",
                              fontWeight: 900,
                            }}
                            title={txt}
                          >
                            {txt}
                          </td>
                        );
                      }

                      const rn = String(row.reagent_name || "").trim();
                      const sp = key;
                      const k = cellKey(rn, sp);
                      const isMapped = mappedCellSet.has(k);
                      const v = isMapped ? String(edit[k] ?? "") : "";
                      const isDirty = isMapped ? !!dirty[k] : false;

                      return (
                        <td
                          key={`${ridx}-${key}`}
                          className="capex-td"
                          style={{
                            ...numCell,
                            width: c.w ?? 160,
                            minWidth: c.w ?? 160,
                            padding: "6px 6px",
                            background: !isMapped
                              ? "rgba(255,255,255,.03)"
                              : isDirty
                              ? "rgba(102,199,255,.08)"
                              : "rgba(0,0,0,.10)",
                            borderBottom: "1px solid rgba(255,255,255,.06)",
                            fontWeight: 800,
                            opacity: !isMapped ? 0.7 : 1,
                            cursor: !isMapped ? "not-allowed" : "default",
                          }}
                          title={isMapped ? v : ""}
                        >
                          {isMapped ? (
                            <input
                              value={v}
                              disabled={saving}
                              placeholder=""
                              onChange={(e) => onChangeCell(rn, sp, e.target.value)}
                              style={{
                                ...inputStyle,
                                border: isDirty ? "1px solid rgba(102,199,255,.55)" : inputStyle.border,
                                opacity: saving ? 0.7 : 1,
                                cursor: saving ? "not-allowed" : "text",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                ...inputStyle,
                                opacity: 0.32,
                                cursor: "not-allowed",
                                pointerEvents: "none",
                                userSelect: "none",
                                border: "1px solid rgba(255,255,255,.08)",
                                background: "rgba(0,0,0,.14)",
                              }}
                            >
                              &nbsp;
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : (
          <div className="panel-inner" style={{ padding: 12, fontWeight: 800 }}>
            {loadingTable ? "Cargando…" : canQuery ? "Sin datos." : "Selecciona una campaña arriba."}
          </div>
        )}
      </div>

      {rows.length && !visibleSubpros.length ? (
        <div className="panel-inner" style={{ padding: 12, fontWeight: 800, opacity: 0.9 }}>
          No hay subprocesos con consumo para esta campaña (según mapping/valores).
        </div>
      ) : null}
    </div>
  );
}