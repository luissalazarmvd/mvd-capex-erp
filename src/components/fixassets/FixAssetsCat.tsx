"use client";

import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";
import { FastCellInput } from "./FastCellInput";

type CatalogueRow = {
  asset_code: string | null;
  location_name: string | null;
  origin_account_code: string | null;
  origin_account_desc: string | null;
  capex_code: string | null;
  subjournal_code: string | null;
  voucher_number: string | null;
  annex_code: string | null;
  annex_description: string | null;
  document_number: string | null;
  asset_description: string | null;
  asset_type: string | null;
  deprec_acc_code_fir: string | null;
  deprec_acc_desc_fir: string | null;
  deprec_acc_code_sec: string | null;
  deprec_acc_desc_sec: string | null;
  assigned_to: string | null;
  area_name: string | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  color: string | null;
  cost_center_code: string | null;
  cost_center_desc: string | null;
  acquisition_date: string | null;
  operation_date: string | null;
  disposal_date: string | null;
  deprec_rate_pct: number | string | null;
  exc_rate: number | string | null;
  asset_ini_cost_pen: number | string | null;
  depreciation_method: string | null;
  asset_situation: string | null;
  asset_comment: string | null;
};

const EDITABLE = [
  "location_name", "capex_code", "asset_description", "asset_type", "assigned_to",
  "area_name", "brand", "model", "serial_number", "color", "cost_center_code",
  "acquisition_date", "operation_date", "disposal_date", "exc_rate",
  "asset_ini_cost_pen", "depreciation_method", "asset_situation", "asset_comment",
] as const satisfies readonly (keyof CatalogueRow)[];
type EditableKey = (typeof EDITABLE)[number];
type Draft = Record<EditableKey, string>;

const DATE_FIELDS = new Set<EditableKey>(["acquisition_date", "operation_date", "disposal_date"]);
const NUMBER_FIELDS = new Set<EditableKey>(["exc_rate", "asset_ini_cost_pen"]);

const COLUMNS: Array<{ key: keyof CatalogueRow; label: string; width: number }> = [
  { key: "asset_code", label: "COD", width: 105 },
  { key: "asset_description", label: "Descripción activo", width: 260 },
  { key: "location_name", label: "Ubicación", width: 150 },
  { key: "origin_account_code", label: "Cuenta origen", width: 125 },
  { key: "origin_account_desc", label: "Descripción cuenta", width: 220 },
  { key: "capex_code", label: "Código CAPEX", width: 135 },
  { key: "subjournal_code", label: "Subdiario", width: 105 },
  { key: "voucher_number", label: "Comprobante", width: 125 },
  { key: "annex_code", label: "Código anexo", width: 120 },
  { key: "annex_description", label: "Descripción anexo", width: 220 },
  { key: "document_number", label: "Nro. documento", width: 145 },
  { key: "asset_type", label: "Tipo activo", width: 145 },
  { key: "deprec_acc_code_fir", label: "Cuenta deprec. 1", width: 140 },
  { key: "deprec_acc_desc_fir", label: "Descripción deprec. 1", width: 220 },
  { key: "deprec_acc_code_sec", label: "Cuenta deprec. 2", width: 140 },
  { key: "deprec_acc_desc_sec", label: "Descripción deprec. 2", width: 220 },
  { key: "assigned_to", label: "Asignado a", width: 170 },
  { key: "area_name", label: "Área", width: 150 },
  { key: "brand", label: "Marca", width: 130 },
  { key: "model", label: "Modelo", width: 130 },
  { key: "serial_number", label: "Serie", width: 145 },
  { key: "color", label: "Color", width: 110 },
  { key: "cost_center_code", label: "Centro costo", width: 135 },
  { key: "cost_center_desc", label: "Descripción C.C.", width: 210 },
  { key: "acquisition_date", label: "Fecha adquisición", width: 145 },
  { key: "operation_date", label: "Fecha operación", width: 135 },
  { key: "disposal_date", label: "Fecha baja", width: 125 },
  { key: "deprec_rate_pct", label: "Tasa deprec.", width: 120 },
  { key: "exc_rate", label: "T.C.", width: 110 },
  { key: "asset_ini_cost_pen", label: "Costo inicial PEN", width: 155 },
  { key: "depreciation_method", label: "Método depreciación", width: 175 },
  { key: "asset_situation", label: "Situación", width: 145 },
  { key: "asset_comment", label: "Comentario", width: 260 },
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

function validOptionalNumber(value: string) {
  const clean = value.trim();
  return !clean || (/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(clean) && Number.isFinite(Number(clean)));
}

function twoDecimals(value: unknown) {
  const clean = text(value).trim();
  if (!clean) return "";
  const parsed = Number(clean.replace(",", "."));
  return Number.isFinite(parsed) ? parsed.toFixed(2) : clean;
}

function toDraft(row: CatalogueRow): Draft {
  const draft = {} as Draft;
  EDITABLE.forEach((key) => {
    draft[key] = DATE_FIELDS.has(key)
      ? dateOnly(row[key])
      : NUMBER_FIELDS.has(key)
      ? twoDecimals(row[key])
      : text(row[key]);
  });
  return draft;
}

function changed(draft: Draft, original: Draft) {
  return EDITABLE.some((key) => draft[key] !== original[key]);
}

function invalid(draft: Draft) {
  return !validOptionalNumber(draft.exc_rate) || !validOptionalNumber(draft.asset_ini_cost_pen);
}

export default function FixAssetsCat() {
  const [rows, setRows] = useState<CatalogueRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [originals, setOriginals] = useState<Record<string, Draft>>({});
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await apiGet("/api/actfij/catalogue");
      const nextRows = Array.isArray(response?.rows) ? (response.rows as CatalogueRow[]) : [];
      const nextDrafts: Record<string, Draft> = {};
      nextRows.forEach((row) => { nextDrafts[text(row.asset_code)] = toDraft(row); });
      setRows(nextRows);
      setDrafts(nextDrafts);
      setOriginals(nextDrafts);
      setIsError(false);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el catálogo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const editedCodes = useMemo(() => rows
    .map((row) => text(row.asset_code))
    .filter((code) => drafts[code] && originals[code] && changed(drafts[code], originals[code])), [rows, drafts, originals]);
  const invalidCodes = editedCodes.filter((code) => invalid(drafts[code]));
  const canSave = editedCodes.length > 0 && invalidCodes.length === 0 && !loading && !saving;

  const visibleRows = useMemo(() => {
    const needle = deferredQuery.trim().toLocaleLowerCase("es");
    if (!needle) return rows;
    return rows.filter((row) => {
      const code = text(row.asset_code);
      const draft = drafts[code];
      return COLUMNS.some((column) => text(
        EDITABLE.includes(column.key as EditableKey) ? draft?.[column.key as EditableKey] : row[column.key]
      ).toLocaleLowerCase("es").includes(needle));
    });
  }, [rows, drafts, deferredQuery]);

  function update(code: string, key: EditableKey, value: string) {
    setDrafts((current) => ({ ...current, [code]: { ...current[code], [key]: value } }));
    setMessage("");
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setMessage("");
    setIsError(false);
    let saved = 0;
    try {
      for (const code of editedCodes) {
        const draft = drafts[code];
        await apiPost("/api/actfij/catalogue/insert", {
          asset_code: code,
          source_name: "WEB",
          location_name: draft.location_name.trim() || null,
          capex_code: draft.capex_code.trim() || null,
          asset_description: draft.asset_description.trim() || null,
          asset_type: draft.asset_type.trim() || null,
          assigned_to: draft.assigned_to.trim() || null,
          area_name: draft.area_name.trim() || null,
          brand: draft.brand.trim() || null,
          model: draft.model.trim() || null,
          serial_number: draft.serial_number.trim() || null,
          color: draft.color.trim() || null,
          cost_center_code: draft.cost_center_code.trim() || null,
          acquisition_date: draft.acquisition_date || null,
          operation_date: draft.operation_date || null,
          disposal_date: draft.disposal_date || null,
          exc_rate: draft.exc_rate.trim() ? Number(draft.exc_rate) : null,
          asset_ini_cost_pen: draft.asset_ini_cost_pen.trim() ? Number(draft.asset_ini_cost_pen) : null,
          depreciation_method: draft.depreciation_method.trim() || null,
          asset_situation: draft.asset_situation.trim() || null,
          asset_comment: draft.asset_comment.trim() || null,
        });
        saved += 1;
      }
      setOriginals((current) => {
        const next = { ...current };
        editedCodes.forEach((code) => { next[code] = { ...drafts[code] }; });
        return next;
      });
      setMessage(`${saved} fila${saved === 1 ? "" : "s"} actualizada${saved === 1 ? "" : "s"} correctamente.`);
    } catch (error) {
      setIsError(true);
      setMessage(`Se guardaron ${saved} de ${editedCodes.length} filas. ${error instanceof Error ? error.message : "Error al guardar"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Catálogo de activos fijos</h1>
          <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>Edita los datos maestros; solo se enviarán las filas modificadas.</div>
        </div>
        <div style={{ display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800 }}>
            Buscar en toda la tabla
            <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="COD, descripción, área..." style={{ width: 270, height: 34, padding: "6px 10px" }} />
          </label>
          <Button size="sm" onClick={() => void load()} disabled={loading || saving}>{loading ? "Cargando..." : "Refrescar"}</Button>
          <Button size="sm" variant="primary" onClick={() => void save()} disabled={!canSave}>{saving ? "Guardando..." : `Guardar (${editedCodes.length})`}</Button>
        </div>
      </div>

      {message ? <div className="panel-inner" style={{ padding: 10, borderColor: isError ? "rgba(216,93,39,.8)" : "rgba(94,128,25,.9)", background: isError ? "rgba(216,93,39,.18)" : "rgba(94,128,25,.22)", fontWeight: 700 }}>{message}</div> : null}
      {invalidCodes.length ? <div style={{ color: "#ffd0bf", fontWeight: 700, fontSize: 13 }}>Corrige los campos numéricos de {invalidCodes.length} fila(s) antes de guardar.</div> : null}

      <div className="panel-inner" style={{ overflow: "auto", maxHeight: "calc(100vh - 260px)", padding: 0 }}>
        <div style={{ minWidth: "max-content" }}>
          <Table disableScrollWrapper>
            <colgroup>{COLUMNS.map((column) => <col key={column.key} style={{ width: column.width, minWidth: column.width }} />)}</colgroup>
            <thead><tr>{COLUMNS.map((column) => {
              const sticky = column.key === "asset_code" || column.key === "asset_description";
              const left = column.key === "asset_code" ? 0 : column.key === "asset_description" ? 105 : undefined;
              return <th key={column.key} className="capex-th" style={{ padding: "8px", fontSize: 12, left, zIndex: sticky ? 45 : undefined, boxShadow: column.key === "asset_description" ? "2px 0 rgba(216,238,255,.16)" : undefined }}>{column.label}</th>;
            })}</tr></thead>
            <tbody>
              {visibleRows.map((row) => {
                const code = text(row.asset_code);
                const draft = drafts[code] || toDraft(row);
                const edited = originals[code] ? changed(draft, originals[code]) : false;
                const bad = edited && invalid(draft);
                const background = bad ? "rgba(216,93,39,.32)" : edited ? "rgba(94,128,25,.32)" : undefined;
                return <tr key={code} className="capex-tr">
                  {COLUMNS.map((column) => {
                    const editable = EDITABLE.includes(column.key as EditableKey);
                    const key = column.key as EditableKey;
                    const value = editable ? draft[key] : row[column.key];
                    const sticky = column.key === "asset_code" || column.key === "asset_description";
                    const left = column.key === "asset_code" ? 0 : column.key === "asset_description" ? 105 : undefined;
                    const stickyBackground = bad ? "#79453b" : edited ? "#416f43" : "var(--panel2)";
                    return <td key={column.key} className="capex-td" style={{ padding: 5, background: sticky ? stickyBackground : background, position: sticky ? "sticky" : undefined, left, zIndex: sticky ? 20 : undefined, boxShadow: column.key === "asset_description" ? "2px 0 rgba(216,238,255,.12)" : undefined }}>
                      {editable ? <FastCellInput
                        className="input"
                        type={DATE_FIELDS.has(key) ? "date" : "text"}
                        inputMode={NUMBER_FIELDS.has(key) ? "decimal" : undefined}
                        value={text(value)}
                        sanitize={NUMBER_FIELDS.has(key) ? numericDraft : undefined}
                        normalizeOnBlur={NUMBER_FIELDS.has(key) ? (next) => validOptionalNumber(next) ? twoDecimals(next) : next : undefined}
                        onCommit={(next) => update(code, key, next)}
                        style={{ minWidth: column.width - 12, padding: "6px 7px", borderColor: bad && NUMBER_FIELDS.has(key) && !validOptionalNumber(draft[key]) ? "#ebb086" : undefined }}
                        aria-label={`${column.label} ${code}`}
                      /> : <span title={text(value)}>{column.key.endsWith("_date") ? dateOnly(value) : column.key === "deprec_rate_pct" ? twoDecimals(value) : text(value)}</span>}
                    </td>;
                  })}
                </tr>;
              })}
              {!loading && !visibleRows.length ? <tr><td className="capex-td" colSpan={COLUMNS.length}>No hay activos que coincidan con la búsqueda.</td></tr> : null}
              {loading ? <tr><td className="capex-td" colSpan={COLUMNS.length}>Cargando catálogo...</td></tr> : null}
            </tbody>
          </Table>
        </div>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>Mostrando {visibleRows.length} de {rows.length} activos · {editedCodes.length} modificados.</div>
    </div>
  );
}
