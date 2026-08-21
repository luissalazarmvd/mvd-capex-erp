"use client";

import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Table } from "../ui/Table";
import { FastCellInput } from "./FastCellInput";

type DeprRow = {
  asset_code: string | null;
  asset_description: string | null;
  period_date: string | null;
  asset_base_value: number | string | null;
  depreciation_base_pen: number | string | null;
  applied_rate_pct: number | string | null;
  acquisition_var_pen: number | string | null;
  disposal_var_pen: number | string | null;
  reclass_var_pen: number | string | null;
  adjustment_var_pen: number | string | null;
  asset_final_value: number | string | null;
  reclass_depr_pen: number | string | null;
  adjustment_depr_pen: number | string | null;
  disposal_depr_pen: number | string | null;
  depreciation_amount_pen: number | string | null;
  depreciation_cum_amount_pen: number | string | null;
  asset_balance_pen: number | string | null;
  exc_rate: number | string | null;
};

const EDITABLE = [
  "applied_rate_pct", "acquisition_var_pen", "disposal_var_pen", "reclass_var_pen",
  "adjustment_var_pen", "reclass_depr_pen", "adjustment_depr_pen", "disposal_depr_pen",
  "depreciation_amount_pen", "exc_rate",
] as const satisfies readonly (keyof DeprRow)[];
type EditableKey = (typeof EDITABLE)[number];
type Draft = Record<EditableKey, string>;

const VAR_FIELDS = new Set<EditableKey>([
  "acquisition_var_pen", "disposal_var_pen", "reclass_var_pen", "adjustment_var_pen",
]);

const COLUMNS: Array<{ key: keyof DeprRow; label: string; width: number }> = [
  { key: "asset_code", label: "COD", width: 105 },
  { key: "asset_description", label: "Descripción activo", width: 260 },
  { key: "period_date", label: "Periodo", width: 115 },
  { key: "asset_base_value", label: "Valor base", width: 135 },
  { key: "depreciation_base_pen", label: "Deprec. base", width: 140 },
  { key: "applied_rate_pct", label: "Tasa aplicada", width: 125 },
  { key: "acquisition_var_pen", label: "Var. adquisición", width: 145 },
  { key: "disposal_var_pen", label: "Var. baja", width: 125 },
  { key: "reclass_var_pen", label: "Var. reclasificación", width: 155 },
  { key: "adjustment_var_pen", label: "Var. ajuste", width: 130 },
  { key: "asset_final_value", label: "Valor final", width: 135 },
  { key: "reclass_depr_pen", label: "Deprec. reclasif.", width: 150 },
  { key: "adjustment_depr_pen", label: "Deprec. ajuste", width: 145 },
  { key: "disposal_depr_pen", label: "Deprec. baja", width: 135 },
  { key: "depreciation_amount_pen", label: "Deprec. periodo", width: 150 },
  { key: "depreciation_cum_amount_pen", label: "Deprec. acumulada", width: 165 },
  { key: "asset_balance_pen", label: "Saldo activo", width: 140 },
  { key: "exc_rate", label: "T.C.", width: 110 },
];

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numericDraft(value: string) {
  return value.replace(",", ".").replace(/[^0-9.-]/g, "");
}

function validOptionalNumber(value: string) {
  const clean = value.trim();
  return !clean || (/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(clean) && Number.isFinite(Number(clean)));
}

function precise(value: number) {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(2);
}

function displayNumber(value: unknown) {
  if (value == null || value === "") return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return text(value);
  return parsed.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function twoDecimals(value: unknown) {
  const clean = text(value).trim();
  if (!clean) return "";
  const parsed = Number(clean.replace(",", "."));
  return Number.isFinite(parsed) ? parsed.toFixed(2) : clean;
}

function toDraft(row: DeprRow): Draft {
  const draft = {} as Draft;
  EDITABLE.forEach((key) => { draft[key] = twoDecimals(row[key]); });
  return draft;
}

function changed(draft: Draft, original: Draft) {
  return EDITABLE.some((key) => draft[key] !== original[key]);
}

function invalid(draft: Draft) {
  return EDITABLE.some((key) => !validOptionalNumber(draft[key]));
}

function derived(row: DeprRow, draft: Draft) {
  const finalValue = num(row.asset_base_value)
    + num(draft.acquisition_var_pen) + num(draft.disposal_var_pen)
    + num(draft.reclass_var_pen) + num(draft.adjustment_var_pen);
  const cumulative = num(row.depreciation_base_pen)
    + num(draft.reclass_depr_pen) + num(draft.adjustment_depr_pen)
    + num(draft.disposal_depr_pen) + num(draft.depreciation_amount_pen);
  return {
    asset_final_value: finalValue,
    depreciation_cum_amount_pen: cumulative,
    asset_balance_pen: finalValue - cumulative,
  };
}

function period(value: unknown) {
  const match = text(value).match(/^(\d{4})-(\d{2})/);
  return match ? { year: match[1], month: match[2] } : null;
}

export default function FixAssetsDepr() {
  const [rows, setRows] = useState<DeprRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [originals, setOriginals] = useState<Record<string, Draft>>({});
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  function rowKey(row: DeprRow) {
    return `${text(row.asset_code)}|${text(row.period_date).slice(0, 10)}`;
  }

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await apiGet("/api/actfij/deprec");
      const nextRows = (Array.isArray(response?.rows) ? response.rows as DeprRow[] : [])
        .sort((a, b) => text(a.asset_code).localeCompare(text(b.asset_code), undefined, { numeric: true }));
      const nextDrafts: Record<string, Draft> = {};
      nextRows.forEach((row) => { nextDrafts[rowKey(row)] = toDraft(row); });
      setRows(nextRows);
      setDrafts(nextDrafts);
      setOriginals(nextDrafts);
      setSelectedKeys(new Set());
      const latest = nextRows.map((row) => text(row.period_date).slice(0, 7)).filter(Boolean).sort().at(-1) || "";
      if (latest) {
        setYear(latest.slice(0, 4));
        setMonth(latest.slice(5, 7));
      }
      setIsError(false);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "No se pudo cargar la depreciación");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const years = useMemo(() => Array.from(new Set(
    rows.map((row) => period(row.period_date)?.year).filter((value): value is string => Boolean(value))
  )).sort().reverse(), [rows]);

  const monthsForYear = useMemo(() => Array.from(new Set(
    rows.map((row) => period(row.period_date)).filter((value) => value?.year === year).map((value) => value!.month)
  )).sort(), [rows, year]);

  useEffect(() => {
    if (monthsForYear.length && !monthsForYear.includes(month)) setMonth(monthsForYear.at(-1) || "");
  }, [monthsForYear, month]);

  const visibleRows = useMemo(() => {
    const needle = deferredQuery.trim().toLocaleLowerCase("es");
    return rows.filter((row) => {
      const value = period(row.period_date);
      const matchesPeriod = value?.year === year && value.month === month;
      const matchesQuery = !needle || text(row.asset_code).toLocaleLowerCase("es").includes(needle)
        || text(row.asset_description).toLocaleLowerCase("es").includes(needle);
      return matchesPeriod && matchesQuery;
    }).sort((a, b) => text(a.asset_code).localeCompare(text(b.asset_code), undefined, { numeric: true }));
  }, [rows, year, month, deferredQuery]);

  const editedKeys = useMemo(() => rows
    .map(rowKey)
    .filter((key) => drafts[key] && originals[key] && changed(drafts[key], originals[key])), [rows, drafts, originals]);
  const selectedIds = useMemo(() => Array.from(selectedKeys), [selectedKeys]);
  const invalidKeys = selectedIds.filter((key) => !drafts[key] || invalid(drafts[key]));
  const canSave = selectedIds.length > 0 && invalidKeys.length === 0 && !loading && !saving;
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedKeys.has(rowKey(row)));

  function toggleSelected(id: string, checked: boolean) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
    setMessage("");
  }

  function clearSelectionAndSetPeriod(nextYear: string, nextMonth: string) {
    setSelectedKeys(new Set());
    setYear(nextYear);
    setMonth(nextMonth);
  }

  function toggleAllVisible(checked: boolean) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      visibleRows.forEach((row) => {
        const id = rowKey(row);
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
    setMessage("");
  }

  function update(row: DeprRow, key: EditableKey, raw: string) {
    const id = rowKey(row);
    const value = numericDraft(raw);
    setSelectedKeys((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      return next;
    });
    setDrafts((current) => {
      const next = { ...current[id], [key]: value };
      if (key === "applied_rate_pct" || VAR_FIELDS.has(key)) {
        const rate = next.applied_rate_pct;
        if (!rate.trim() || !validOptionalNumber(rate)) {
          if (key === "applied_rate_pct" && !rate.trim()) next.depreciation_amount_pen = "";
        } else {
          const finalValue = derived(row, next).asset_final_value;
          const availableBeforePeriod = Math.max(
            0,
            finalValue - num(row.depreciation_base_pen)
              - num(next.reclass_depr_pen)
              - num(next.adjustment_depr_pen)
              - num(next.disposal_depr_pen)
          );
          const calculated = finalValue * (Number(rate) / 12);
          next.depreciation_amount_pen = precise(Math.min(calculated, availableBeforePeriod));
        }
      }
      if (key === "depreciation_amount_pen") {
        if (!value.trim() || !validOptionalNumber(value)) {
          next.applied_rate_pct = value.trim() ? next.applied_rate_pct : "";
        } else {
          const finalValue = derived(row, next).asset_final_value;
          next.applied_rate_pct = finalValue ? precise((Number(value) * 12) / finalValue) : "0.00";
        }
      }
      return { ...current, [id]: next };
    });
    setMessage("");
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setMessage("");
    setIsError(false);
    let saved = 0;
    try {
      for (const id of selectedIds) {
        const row = rows.find((candidate) => rowKey(candidate) === id);
        if (!row) continue;
        const draft = drafts[id];
        const calculated = derived(row, draft);
        const payload = {
          asset_code: text(row.asset_code).trim(),
          asset_description: row.asset_description,
          source_name: "WEB",
          period_date: text(row.period_date).slice(0, 10),
          asset_base_value: row.asset_base_value,
          depreciation_base_pen: row.depreciation_base_pen,
          applied_rate_pct: draft.applied_rate_pct.trim() ? Number(draft.applied_rate_pct) : null,
          acquisition_var_pen: draft.acquisition_var_pen.trim() ? Number(draft.acquisition_var_pen) : null,
          disposal_var_pen: draft.disposal_var_pen.trim() ? Number(draft.disposal_var_pen) : null,
          reclass_var_pen: draft.reclass_var_pen.trim() ? Number(draft.reclass_var_pen) : null,
          adjustment_var_pen: draft.adjustment_var_pen.trim() ? Number(draft.adjustment_var_pen) : null,
          reclass_depr_pen: draft.reclass_depr_pen.trim() ? Number(draft.reclass_depr_pen) : null,
          adjustment_depr_pen: draft.adjustment_depr_pen.trim() ? Number(draft.adjustment_depr_pen) : null,
          disposal_depr_pen: draft.disposal_depr_pen.trim() ? Number(draft.disposal_depr_pen) : null,
          depreciation_amount_pen: draft.depreciation_amount_pen.trim() ? Number(draft.depreciation_amount_pen) : null,
          asset_final_value: calculated.asset_final_value,
          depreciation_cum_amount_pen: calculated.depreciation_cum_amount_pen,
          asset_balance_pen: calculated.asset_balance_pen,
          exc_rate: draft.exc_rate.trim() ? Number(draft.exc_rate) : null,
        };
        await apiPost("/api/actfij/deprec/insert", payload);
        if (draft.exc_rate !== originals[id].exc_rate) {
          await apiPost("/api/actfij/catalogue/insert", {
            asset_code: text(row.asset_code).trim(),
            source_name: "WEB",
            exc_rate: draft.exc_rate.trim() ? Number(draft.exc_rate) : null,
          });
        }
        saved += 1;
      }
      setOriginals((current) => {
        const next = { ...current };
        selectedIds.forEach((id) => { next[id] = { ...drafts[id] }; });
        return next;
      });
      setRows((current) => current.map((row) => {
        const id = rowKey(row);
        if (!selectedKeys.has(id)) return row;
        const draft = drafts[id];
        return { ...row, ...draft, ...derived(row, draft) };
      }));
      setSelectedKeys(new Set());
      setMessage(`${saved} fila${saved === 1 ? "" : "s"} de depreciación guardada${saved === 1 ? "" : "s"} correctamente.`);
    } catch (error) {
      setIsError(true);
      setMessage(`Se guardaron ${saved} de ${selectedIds.length} filas. ${error instanceof Error ? error.message : "Error al guardar"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Depreciación de activos</h1>
          <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>Selecciona con el check las filas que se enviarán completas. La tasa, depreciación y saldos se recalculan en el preview.</div>
        </div>
        <div style={{ display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800 }}>
            Buscar COD o descripción
            <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ej. 110 o equipo" style={{ width: 230, height: 34, padding: "6px 10px" }} />
          </label>
          <Select label="Año" value={year} onChange={(event) => clearSelectionAndSetPeriod(event.target.value, month)} options={years.map((value) => ({ value, label: value }))} placeholder="Selecciona" style={{ minWidth: 110 }} />
          <Select label="Mes" value={month} onChange={(event) => clearSelectionAndSetPeriod(year, event.target.value)} options={monthsForYear.map((value) => ({ value, label: MONTHS[Number(value) - 1] }))} placeholder="Selecciona" style={{ minWidth: 150 }} />
          <Button size="sm" onClick={() => void load()} disabled={loading || saving}>{loading ? "Cargando..." : "Refrescar"}</Button>
          <Button size="sm" variant="primary" onClick={() => void save()} disabled={!canSave}>{saving ? "Guardando..." : `Guardar (${selectedIds.length})`}</Button>
        </div>
      </div>

      {message ? <div className="panel-inner" style={{ padding: 10, borderColor: isError ? "rgba(216,93,39,.8)" : "rgba(94,128,25,.9)", background: isError ? "rgba(216,93,39,.18)" : "rgba(94,128,25,.22)", fontWeight: 700 }}>{message}</div> : null}
      {invalidKeys.length ? <div style={{ color: "#ffd0bf", fontWeight: 700, fontSize: 13 }}>Corrige los valores numéricos de {invalidKeys.length} fila(s) antes de guardar.</div> : null}

      <div className="panel-inner" style={{ overflow: "auto", maxHeight: "calc(100vh - 260px)", padding: 0 }}>
        <div style={{ minWidth: "max-content" }}>
          <Table disableScrollWrapper>
            <colgroup><col style={{ width: 72, minWidth: 72 }} />{COLUMNS.map((column) => <col key={column.key} style={{ width: column.width, minWidth: column.width }} />)}</colgroup>
            <thead><tr><th className="capex-th" style={{ padding: "8px", fontSize: 12, textAlign: "center", left: 0, zIndex: 48 }}><input type="checkbox" checked={allVisibleSelected} disabled={!visibleRows.length || loading || saving} onChange={(event) => toggleAllVisible(event.target.checked)} aria-label="Seleccionar todas las filas visibles" title="Seleccionar todas las filas visibles" style={{ width: 18, height: 18, accentColor: "var(--brand-success)" }} /></th>{COLUMNS.map((column) => {
              const sticky = column.key === "asset_code" || column.key === "asset_description";
              const left = column.key === "asset_code" ? 72 : column.key === "asset_description" ? 177 : undefined;
              return <th key={column.key} className="capex-th" style={{ padding: "8px", fontSize: 12, left, zIndex: sticky ? 47 : undefined, boxShadow: column.key === "asset_description" ? "2px 0 rgba(216,238,255,.16)" : undefined }}>{column.label}</th>;
            })}</tr></thead>
            <tbody>
              {visibleRows.map((row) => {
                const id = rowKey(row);
                const draft = drafts[id] || toDraft(row);
                const selected = selectedKeys.has(id);
                const bad = selected && invalid(draft);
                const calculated = derived(row, draft);
                const background = bad ? "rgba(216,93,39,.32)" : selected ? "rgba(94,128,25,.32)" : undefined;
                return <tr key={id} className="capex-tr">
                  <td className="capex-td" style={{ padding: 5, textAlign: "center", background: bad ? "#79453b" : selected ? "#416f43" : "var(--panel2)", position: "sticky", left: 0, zIndex: 22 }}>
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={loading || saving}
                      onChange={(event) => toggleSelected(id, event.target.checked)}
                      aria-label={`Enviar depreciación de ${text(row.asset_code)}`}
                      style={{ width: 18, height: 18, accentColor: "var(--brand-success)", cursor: saving ? "not-allowed" : "pointer" }}
                    />
                  </td>
                  {COLUMNS.map((column) => {
                    const editable = EDITABLE.includes(column.key as EditableKey);
                    const key = column.key as EditableKey;
                    const derivedValue = column.key === "asset_final_value" || column.key === "depreciation_cum_amount_pen" || column.key === "asset_balance_pen"
                      ? calculated[column.key]
                      : row[column.key];
                    const sticky = column.key === "asset_code" || column.key === "asset_description";
                    const left = column.key === "asset_code" ? 72 : column.key === "asset_description" ? 177 : undefined;
                    const stickyBackground = bad ? "#79453b" : selected ? "#416f43" : "var(--panel2)";
                    return <td key={column.key} className="capex-td" style={{ padding: 5, background: sticky ? stickyBackground : background, position: sticky ? "sticky" : undefined, left, zIndex: sticky ? 21 : undefined, boxShadow: column.key === "asset_description" ? "2px 0 rgba(216,238,255,.12)" : undefined }}>
                      {editable ? <FastCellInput
                        className="input"
                        inputMode="decimal"
                        value={draft[key]}
                        sanitize={numericDraft}
                        normalizeOnBlur={(next) => validOptionalNumber(next) ? twoDecimals(next) : next}
                        onCommit={(next) => update(row, key, next)}
                        style={{ minWidth: column.width - 12, padding: "6px 7px", borderColor: bad && !validOptionalNumber(draft[key]) ? "#ebb086" : undefined }}
                        aria-label={`${column.label} ${text(row.asset_code)}`}
                      /> : <span title={text(derivedValue)}>{column.key === "period_date" ? text(derivedValue).slice(0, 10) : column.key === "asset_code" || column.key === "asset_description" ? text(derivedValue) : displayNumber(derivedValue)}</span>}
                    </td>;
                  })}
                </tr>;
              })}
              {!loading && !visibleRows.length ? <tr><td className="capex-td" colSpan={COLUMNS.length + 1}>No hay depreciaciones para el periodo seleccionado.</td></tr> : null}
              {loading ? <tr><td className="capex-td" colSpan={COLUMNS.length + 1}>Cargando depreciación...</td></tr> : null}
            </tbody>
          </Table>
        </div>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>Periodo {year && month ? `${MONTHS[Number(month) - 1]} ${year}` : "sin seleccionar"} · {visibleRows.length} activos · {selectedIds.length} seleccionados · {editedKeys.length} modificados.</div>
    </div>
  );
}
