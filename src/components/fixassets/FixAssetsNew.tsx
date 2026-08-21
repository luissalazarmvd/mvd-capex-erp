"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Table } from "../ui/Table";

type VetaRow = {
  account_code: string | null;
  account_description: string | null;
  comp_date: string | null;
  subjournal_code: string | null;
  voucher_number: string | null;
  annex_code: string | null;
  annex_description: string | null;
  document_type: string | null;
  document_number: string | null;
  document_date: string | null;
  voucher_description: string | null;
  line_description: string | null;
  capex_code: string | null;
  debit_credit: string | null;
  usd_amount: number | string | null;
  pen_amount: number | string | null;
  exc_rate: number | string | null;
};

type Draft = {
  asset_code: string;
  line_description: string;
  capex_code: string;
  pen_amount: string;
  exc_rate: string;
};

const COLUMNS: Array<{ key: keyof VetaRow | "asset_code"; label: string; width: number }> = [
  { key: "asset_code", label: "COD", width: 105 },
  { key: "account_code", label: "Cuenta", width: 120 },
  { key: "account_description", label: "Descripción cuenta", width: 230 },
  { key: "comp_date", label: "Fecha contable", width: 125 },
  { key: "subjournal_code", label: "Subdiario", width: 105 },
  { key: "voucher_number", label: "Comprobante", width: 125 },
  { key: "annex_code", label: "Código anexo", width: 120 },
  { key: "annex_description", label: "Descripción anexo", width: 220 },
  { key: "document_type", label: "Tipo doc.", width: 105 },
  { key: "document_number", label: "Nro. documento", width: 145 },
  { key: "document_date", label: "Fecha documento", width: 135 },
  { key: "voucher_description", label: "Descripción comprobante", width: 250 },
  { key: "line_description", label: "Descripción activo", width: 270 },
  { key: "capex_code", label: "Código CAPEX", width: 135 },
  { key: "debit_credit", label: "D/H", width: 70 },
  { key: "usd_amount", label: "Monto USD", width: 130 },
  { key: "pen_amount", label: "Monto PEN", width: 130 },
  { key: "exc_rate", label: "T.C.", width: 110 },
];

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function dateOnly(value: unknown) {
  return text(value).slice(0, 10);
}

function numericDraft(value: string) {
  return value.replace(",", ".").replace(/[^0-9.-]/g, "");
}

function validNumber(value: string, allowBlank = false) {
  const clean = value.trim();
  if (!clean) return allowBlank;
  return /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(clean) && Number.isFinite(Number(clean));
}

function numberOrNull(value: string) {
  return value.trim() ? Number(value) : null;
}

function draftFrom(row: VetaRow): Draft {
  return {
    asset_code: "",
    line_description: text(row.line_description),
    capex_code: text(row.capex_code),
    pen_amount: text(row.pen_amount),
    exc_rate: text(row.exc_rate),
  };
}

function monthOf(value: unknown) {
  const match = dateOnly(value).match(/^(\d{4})-(\d{2})/);
  return match ? { year: match[1], month: match[2] } : null;
}

export default function FixAssetsNew() {
  const [rows, setRows] = useState<VetaRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [existingCodes, setExistingCodes] = useState<Set<string>>(new Set());
  const [year, setYear] = useState("");
  const [monthFrom, setMonthFrom] = useState("01");
  const [monthTo, setMonthTo] = useState("12");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [veta, catalogue] = await Promise.all([
        apiGet("/api/actfij/veta"),
        apiGet("/api/actfij/catalogue"),
      ]);
      const nextRows = Array.isArray(veta?.rows) ? (veta.rows as VetaRow[]) : [];
      const nextDrafts: Record<number, Draft> = {};
      nextRows.forEach((row, index) => { nextDrafts[index] = draftFrom(row); });
      setRows(nextRows);
      setDrafts(nextDrafts);
      setExistingCodes(new Set(
        (Array.isArray(catalogue?.rows) ? catalogue.rows : [])
          .map((row: { asset_code?: unknown }) => text(row.asset_code).trim())
          .filter(Boolean)
      ));
      const newestYear = nextRows
        .map((row) => monthOf(row.comp_date)?.year || "")
        .filter(Boolean)
        .sort()
        .at(-1) || "";
      setYear((current) => current || newestYear);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "No se pudo cargar la información");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const years = useMemo(() => Array.from(new Set(
    rows.map((row) => monthOf(row.comp_date)?.year).filter((value): value is string => Boolean(value))
  )).sort().reverse(), [rows]);

  const codeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    Object.values(drafts).forEach((draft) => {
      const code = draft.asset_code.trim();
      if (code) counts.set(code, (counts.get(code) || 0) + 1);
    });
    return counts;
  }, [drafts]);

  function rowState(index: number) {
    const draft = drafts[index];
    if (!draft?.asset_code.trim()) return "idle" as const;
    const code = draft.asset_code.trim();
    const invalid = !/^\d{7}$/.test(code)
      || existingCodes.has(code)
      || (codeCounts.get(code) || 0) > 1
      || !validNumber(draft.pen_amount)
      || !validNumber(draft.exc_rate, true);
    return invalid ? "invalid" as const : "valid" as const;
  }

  const visibleRows = useMemo(() => rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const period = monthOf(row.comp_date);
      if (!period) return false;
      return (!year || period.year === year)
        && period.month >= monthFrom
        && period.month <= monthTo;
    }), [rows, year, monthFrom, monthTo]);

  const selectedIndexes = useMemo(() => rows
    .map((_, index) => index)
    .filter((index) => Boolean(drafts[index]?.asset_code.trim())), [rows, drafts]);
  const invalidCount = selectedIndexes.filter((index) => rowState(index) === "invalid").length;
  const canSave = selectedIndexes.length > 0 && invalidCount === 0 && !loading && !saving;

  function updateDraft(index: number, field: keyof Draft, value: string) {
    setDrafts((current) => ({
      ...current,
      [index]: { ...current[index], [field]: value },
    }));
    setMessage("");
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setMessage("");
    setIsError(false);
    let saved = 0;
    try {
      for (const index of selectedIndexes) {
        const row = rows[index];
        const draft = drafts[index];
        await apiPost("/api/actfij/catalogue/insert", {
          asset_code: draft.asset_code.trim(),
          source_name: "WEB",
          location_name: null,
          origin_account_code: row.account_code,
          capex_code: draft.capex_code.trim() || null,
          subjournal_code: row.subjournal_code,
          voucher_number: row.voucher_number,
          annex_code: row.annex_code,
          annex_description: row.annex_description,
          document_number: row.document_number,
          asset_description: draft.line_description.trim() || null,
          asset_type: null,
          assigned_to: null,
          area_name: null,
          brand: null,
          model: null,
          serial_number: null,
          color: null,
          cost_center_code: null,
          acquisition_date: dateOnly(row.document_date) || null,
          operation_date: null,
          disposal_date: null,
          exc_rate: numberOrNull(draft.exc_rate),
          asset_ini_cost_pen: numberOrNull(draft.pen_amount),
          depreciation_method: null,
          asset_situation: null,
          asset_comment: null,
        });
        saved += 1;
      }
      setExistingCodes((current) => new Set([...current, ...selectedIndexes.map((i) => drafts[i].asset_code.trim())]));
      setDrafts((current) => {
        const next = { ...current };
        selectedIndexes.forEach((index) => { next[index] = { ...next[index], asset_code: "" }; });
        return next;
      });
      setMessage(`${saved} activo${saved === 1 ? "" : "s"} guardado${saved === 1 ? "" : "s"} correctamente.`);
    } catch (error) {
      setIsError(true);
      setMessage(`Se guardaron ${saved} de ${selectedIndexes.length} filas. ${error instanceof Error ? error.message : "Error al guardar"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Nuevos activos desde Veta</h1>
          <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
            Asigna un COD único de 7 dígitos. Las filas verdes están listas para guardar.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
          <Select label="Año" value={year} onChange={(event) => setYear(event.target.value)} options={years.map((value) => ({ value, label: value }))} placeholder="Todos" style={{ minWidth: 110 }} />
          <Select label="Mes desde" value={monthFrom} onChange={(event) => {
            const value = event.target.value; setMonthFrom(value); if (value > monthTo) setMonthTo(value);
          }} options={MONTHS.map((label, i) => ({ value: String(i + 1).padStart(2, "0"), label }))} placeholder="" style={{ minWidth: 145 }} />
          <Select label="Mes hasta" value={monthTo} onChange={(event) => {
            const value = event.target.value; setMonthTo(value); if (value < monthFrom) setMonthFrom(value);
          }} options={MONTHS.map((label, i) => ({ value: String(i + 1).padStart(2, "0"), label }))} placeholder="" style={{ minWidth: 145 }} />
          <Button size="sm" onClick={() => void load()} disabled={loading || saving}>{loading ? "Cargando..." : "Refrescar"}</Button>
          <Button size="sm" variant="primary" onClick={() => void save()} disabled={!canSave}>{saving ? "Guardando..." : `Guardar (${selectedIndexes.length})`}</Button>
        </div>
      </div>

      {message ? <div className="panel-inner" style={{ padding: 10, borderColor: isError ? "rgba(216,93,39,.8)" : "rgba(94,128,25,.9)", background: isError ? "rgba(216,93,39,.18)" : "rgba(94,128,25,.22)", fontWeight: 700 }}>{message}</div> : null}
      {invalidCount > 0 ? <div style={{ color: "#ffd0bf", fontWeight: 700, fontSize: 13 }}>{invalidCount} fila(s) con COD duplicado/existente, formato inválido o monto incorrecto.</div> : null}

      <div className="panel-inner" style={{ overflow: "auto", maxHeight: "calc(100vh - 270px)", padding: 0 }}>
        <div style={{ minWidth: "max-content" }}>
          <Table disableScrollWrapper>
            <colgroup>{COLUMNS.map((column) => <col key={column.key} style={{ width: column.width, minWidth: column.width }} />)}</colgroup>
            <thead><tr>{COLUMNS.map((column) => <th key={column.key} className="capex-th" style={{ padding: "8px", fontSize: 12 }}>{column.label}</th>)}</tr></thead>
            <tbody>
              {visibleRows.map(({ row, index }) => {
                const draft = drafts[index] || draftFrom(row);
                const state = rowState(index);
                const background = state === "valid" ? "rgba(94,128,25,.32)" : state === "invalid" ? "rgba(216,93,39,.32)" : undefined;
                return <tr key={index} className="capex-tr">
                  {COLUMNS.map((column) => {
                    const editable = column.key === "asset_code" || column.key === "line_description" || column.key === "capex_code" || column.key === "pen_amount" || column.key === "exc_rate";
                    const value = column.key === "asset_code" ? draft.asset_code : editable ? draft[column.key as keyof Draft] : row[column.key as keyof VetaRow];
                    return <td key={column.key} className="capex-td" style={{ padding: 5, background }}>
                      {editable ? <input
                        className="input"
                        value={text(value)}
                        inputMode={column.key === "asset_code" ? "numeric" : column.key === "pen_amount" || column.key === "exc_rate" ? "decimal" : undefined}
                        maxLength={column.key === "asset_code" ? 7 : undefined}
                        onChange={(event) => {
                          let next = event.target.value;
                          if (column.key === "asset_code") next = next.replace(/\D/g, "").slice(0, 7);
                          if (column.key === "pen_amount" || column.key === "exc_rate") next = numericDraft(next);
                          updateDraft(index, column.key as keyof Draft, next);
                        }}
                        style={{ minWidth: column.width - 12, padding: "6px 7px", borderColor: state === "invalid" ? "#ebb086" : undefined }}
                        aria-label={`${column.label} fila ${index + 1}`}
                      /> : <span title={text(value)}>{column.key.endsWith("date") ? dateOnly(value) : text(value)}</span>}
                    </td>;
                  })}
                </tr>;
              })}
              {!loading && visibleRows.length === 0 ? <tr><td className="capex-td" colSpan={COLUMNS.length}>No hay registros para el periodo seleccionado.</td></tr> : null}
              {loading ? <tr><td className="capex-td" colSpan={COLUMNS.length}>Cargando activos...</td></tr> : null}
            </tbody>
          </Table>
        </div>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>Mostrando {visibleRows.length} de {rows.length} filas.</div>
    </div>
  );
}
