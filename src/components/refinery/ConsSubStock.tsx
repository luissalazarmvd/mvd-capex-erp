// src/components/refinery/ConsSubStock.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

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
  [k: string]: any; // subpro cols
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
  if (key === "campaign_id") return 120;
  if (key === "reagent_name") return 220;
  if (key === "stock") return 110;
  if (key === "__total__") return 140;

  const s = String(key || "");
  return Math.max(150, Math.min(220, 90 + s.length * 4));
}

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

/**
 * Igual que tu page: parsea "1,234.56" / "1.234,56" / etc.
 * Retorna string decimal con scale fijo, o null si inválido.
 *
 * NOTA: acá permitimos > 0 (mismo criterio que tu page actual).
 */
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

function cellKey(reagent_name: string, subprocess_name: string) {
  return `${reagent_name}||${subprocess_name}`;
}

export default function ConsSubStock({
  campaignId,
  reagentName = "",
  consumptionDateIso,
  autoLoad = true,
  refreshKey = 0,
  onSaved,
}: {
  campaignId: string;
  reagentName?: string;
  consumptionDateIso: string; // <- viene del page
  autoLoad?: boolean;
  refreshKey?: number;
  onSaved?: () => void; // opcional: para que el page refresque otras cosas
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [mapping, setMapping] = useState<MapRow[]>([]);
  const [reagents, setReagents] = useState<ReagentRow[]>([]);
  const [rows, setRows] = useState<ViewRow[]>([]);

  // valores originales (número) por celda para detectar "dirty"
  const [orig, setOrig] = useState<Record<string, number | null>>({});
  // valores editables (string) por celda
  const [edit, setEdit] = useState<Record<string, string>>({});
  // dirty flag
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  const modeAllReagents = !String(reagentName || "").trim();

  async function loadMapping() {
    const r = (await apiGet("/api/refineria/mapping")) as MappingResp;
    const rr = Array.isArray(r?.rows) ? r.rows : [];
    setMapping(rr);
  }

  async function loadReagents() {
    const r = (await apiGet("/api/refineria/reagents")) as ReagentsResp;
    const rr = Array.isArray((r as any)?.rows) ? (r as any).rows : [];
    setReagents(rr);
  }

  async function loadRows(cId: string, rName?: string) {
    const c = String(cId || "").trim().toUpperCase();
    const rn = String(rName || "").trim();

    if (!c) {
      setRows([]);
      setMsg(null);
      return;
    }

    setLoading(true);
    setMsg(null);
    try {
      const q = rn
        ? `?campaign_id=${encodeURIComponent(c)}&reagent_name=${encodeURIComponent(rn)}`
        : `?campaign_id=${encodeURIComponent(c)}`;

      const r = (await apiGet(`/api/refineria/cons-stock-subpro${q}`)) as ViewResp;
      const rr = Array.isArray(r?.rows) ? r.rows : [];
      setRows(rr);

      if (!rr.length) {
        setMsg(rn ? "Sin datos para esa campaña/insumo." : "Sin datos para esa campaña.");
      }
    } catch (e: any) {
      setRows([]);
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMapping().catch(() => {});
    loadReagents().catch(() => {});
  }, []);

  useEffect(() => {
    if (!autoLoad) return;
    loadRows(campaignId, reagentName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, reagentName, autoLoad, refreshKey]);

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

  // subprocesos visibles:
  // - sin insumo seleccionado: mostrar TODOS los subprocesos (requisito)
  // - con insumo seleccionado: igual que ahora (mapping -> fallback noZero)
  const mappedSubpros = useMemo(() => {
    const colsInView = new Set<string>(SUBPRO_COLS as any);

    if (modeAllReagents) return []; // no se usa en ese modo

    const r = String(reagentName || "").trim();
    const fromMap = mapping
      .filter((m) => String(m.reagent_name || "").trim() === r)
      .map((m) => String(m.subprocess_name || "").trim())
      .filter((s) => !!s);

    return uniqSorted(fromMap).filter((s) => colsInView.has(s));
  }, [mapping, reagentName, modeAllReagents]);

  const nonZeroSubpros = useMemo(() => {
    if (!rows.length) return [];
    return (SUBPRO_COLS as any as string[]).filter((c) =>
      (rows || []).some((r) => {
        const n = toNum((r as any)[c]);
        return n !== null && n !== 0;
      })
    );
  }, [rows]);

  const visibleSubpros = useMemo(() => {
    if (modeAllReagents) return SUBPRO_COLS as any as string[];
    return mappedSubpros.length ? mappedSubpros : nonZeroSubpros;
  }, [modeAllReagents, mappedSubpros, nonZeroSubpros]);

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

  const cols = useMemo(() => {
    const base = [
      { key: "campaign_id", label: "Campaña", w: colWidth("campaign_id"), kind: "text" as const },
      { key: "reagent_name", label: "Insumo", w: colWidth("reagent_name"), kind: "text" as const },
      { key: "stock", label: "Stock", w: colWidth("stock"), kind: "ro-num" as const },
    ];

    const subs = visibleSubpros.map((name) => ({
      key: name,
      label: name,
      w: colWidth(name),
      kind: "edit-num" as const,
    }));

    const totalCol = {
      key: "__total__",
      label: "Total",
      w: colWidth("__total__"),
      kind: "ro-total" as const,
    };

    return [...base, ...subs, totalCol];
  }, [visibleSubpros]);

  // Inicializa maps (orig/edit) cuando cambian rows o columnas visibles
  useEffect(() => {
    const o: Record<string, number | null> = {};
    const e: Record<string, string> = {};
    const d: Record<string, boolean> = {};

    for (const r of rows || []) {
      const rn = String(r.reagent_name || "").trim();
      if (!rn) continue;
      for (const sp of visibleSubpros || []) {
        const key = cellKey(rn, sp);
        const n = toNum((r as any)[sp]);
        o[key] = n;
        e[key] = n === null ? "" : String(n);
        d[key] = false;
      }
    }

    setOrig(o);
    setEdit(e);
    setDirty(d);
  }, [rows, visibleSubpros]);

  const dirtyCount = useMemo(() => Object.values(dirty || {}).filter(Boolean).length, [dirty]);

  const canQuery = !!String(campaignId || "").trim();
  const dateOk = useMemo(() => !!consumptionDateIso && isIsoDate(consumptionDateIso), [consumptionDateIso]);
  const canSave = canQuery && dateOk && dirtyCount > 0 && !saving;

  function onChangeCell(reagent: string, sp: string, v: string) {
    const k = cellKey(reagent, sp);
    setEdit((m) => ({ ...m, [k]: v }));
    setDirty((m) => {
      // dirty = (parsed new) != (orig) OR raw empty vs orig null, etc.
      const newRaw = String(v ?? "");
      const newNum = toNum(newRaw); // ojo: esto interpreta "" => null
      const o = orig[k] ?? null;

      // si el usuario escribió algo no parseable, lo marcamos dirty igual (para no perder)
      const trimmed = newRaw.trim();
      const parseable = trimmed === "" ? true : toDecimalStrOrNullFront(trimmed, 9) !== null;

      const isDirty = !parseable ? true : (newNum ?? null) !== (o ?? null) || (trimmed === "" && (o ?? null) !== null);

      return { ...m, [k]: isDirty };
    });
  }

  async function onSaveAll() {
    if (!canSave) return;

    setSaving(true);
    setMsg(null);

    try {
      // Validación rápida de fecha
      const iso = String(consumptionDateIso || "").trim();
      if (!isIsoDate(iso)) {
        setMsg("ERROR: fecha de consumo inválida");
        return;
      }

      // arma payloads por celda dirty
      const payloads: any[] = [];
      for (const r of rows || []) {
        const rn = String(r.reagent_name || "").trim();
        if (!rn) continue;
        for (const sp of visibleSubpros || []) {
          const k = cellKey(rn, sp);
          if (!dirty[k]) continue;

          const raw = String(edit[k] ?? "").trim();
          // si está vacío: no guardamos (no se solicitó borrar)
          if (!raw) continue;

          const q = toDecimalStrOrNullFront(raw, 9);
          if (q === null) {
            setMsg(`ERROR: valor inválido en "${rn}" · "${sp}" (debe ser > 0)`);
            return;
          }

          payloads.push({
            campaign_id: String(campaignId || "").trim().toUpperCase(),
            reagent_name: rn,
            subprocess_name: sp,
            consumption_date: iso,
            consumption_qty: q,
          });
        }
      }

      if (!payloads.length) {
        setMsg("Nada que guardar (no se guardan celdas vacías).");
        return;
      }

      // inserta / upsert por celda (igual que tu page actual)
      // si luego quieres batch en backend, se cambia acá a un solo POST
      for (const p of payloads) {
        await apiPost("/api/refineria/consumption/insert", p);
      }

      setMsg(`OK: guardado (${payloads.length} celdas) · Fecha ${consumptionDateIso}`);
      await loadRows(campaignId, reagentName);

      if (onSaved) onSaved();
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando");
    } finally {
      setSaving(false);
    }
  }

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

  function renderCell(row: ViewRow, c: (typeof cols)[number], ridx: number) {
    const key = String(c.key);
    const isTotal = key === "__total__";
    const isText = key === "campaign_id" || key === "reagent_name";

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
            width: (c as any).w ?? 160,
            minWidth: (c as any).w ?? 160,
            padding: "6px 6px",
            background: stickyRightCell.background as any,
            borderBottom: "1px solid rgba(255,255,255,.06)",
            fontWeight: 900,
          }}
          title={String(txt)}
        >
          {txt}
        </td>
      );
    }

    if (isText) {
      const txt = String((row as any)[key] ?? "");
      return (
        <td
          key={`${ridx}-${key}`}
          className="capex-td"
          style={{
            ...textCell,
            width: (c as any).w ?? 160,
            minWidth: (c as any).w ?? 160,
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

    if (key === "stock") {
      const txt = fmtFixed((row as any)[key], 2);
      return (
        <td
          key={`${ridx}-${key}`}
          className="capex-td"
          style={{
            ...numCell,
            width: (c as any).w ?? 160,
            minWidth: (c as any).w ?? 160,
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

    // editable cell (subpro)
    const rn = String(row.reagent_name || "").trim();
    const sp = key;
    const k = cellKey(rn, sp);
    const v = String(edit[k] ?? "");
    const isDirty = !!dirty[k];

    return (
      <td
        key={`${ridx}-${key}`}
        className="capex-td"
        style={{
          ...numCell,
          width: (c as any).w ?? 160,
          minWidth: (c as any).w ?? 160,
          padding: "6px 6px",
          background: isDirty ? "rgba(102,199,255,.08)" : "rgba(0,0,0,.10)",
          borderBottom: "1px solid rgba(255,255,255,.06)",
          fontWeight: 800,
        }}
        title={v}
      >
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
      </td>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
      <div className="panel-inner" style={{ padding: 12, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>
          Consumo por Subproceso + Stock
          {dateOk ? (
            <span style={{ opacity: 0.85, fontWeight: 900 }}> · Fecha: {consumptionDateIso}</span>
          ) : (
            <span style={{ opacity: 0.75, fontWeight: 900 }}> · Fecha inválida</span>
          )}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontWeight: 900, opacity: 0.85 }}>{dirtyCount ? `${dirtyCount} cambios` : "Sin cambios"}</div>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => loadRows(campaignId, reagentName)}
            disabled={loading || saving || !canQuery}
          >
            {loading ? "Cargando..." : "Refrescar"}
          </Button>

          <Button type="button" size="sm" variant="primary" onClick={onSaveAll} disabled={!canSave}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      {msg ? (
        <div
          className="panel-inner"
          style={{
            padding: 10,
            border: msg.startsWith("OK") ? "1px solid rgba(102,199,255,.45)" : "1px solid rgba(255,80,80,.45)",
            background: msg.startsWith("OK") ? "rgba(102,199,255,.10)" : "rgba(255,80,80,.10)",
            fontWeight: 800,
          }}
        >
          {msg}
        </div>
      ) : null}

      <div
        className="panel-inner"
        style={{
          padding: 0,
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
                    const isTotal = String(c.key) === "__total__";
                    return (
                      <th
                        key={String(c.key)}
                        className="capex-th"
                        style={{
                          ...(isTotal ? stickyRightHead : stickyHead),
                          width: (c as any).w ?? 160,
                          minWidth: (c as any).w ?? 160,
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
                    {cols.map((c) => renderCell(row, c as any, ridx))}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : (
          <div className="panel-inner" style={{ padding: 12, fontWeight: 800 }}>
            {loading ? "Cargando…" : canQuery ? "Sin datos." : "Selecciona una campaña arriba."}
          </div>
        )}
      </div>

      {rows.length && !visibleSubpros.length ? (
        <div className="panel-inner" style={{ padding: 12, fontWeight: 800, opacity: 0.9 }}>
          No hay subprocesos visibles para esta campaña (según mapping/valores).
        </div>
      ) : null}
    </div>
  );
}