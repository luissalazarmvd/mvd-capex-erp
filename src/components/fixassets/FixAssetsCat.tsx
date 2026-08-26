"use client";

import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
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

type CecoRow = {
  cost_center_code: string | null;
  cost_center_description: string | null;
};

type MappingRow = {
  origin_account_code: string | null;
  account_group: string | null;
  account_denom: string | null;
  deprec_acc_code_fir: string | null;
  deprec_acc_code_sec: string | null;
  deprec_rate_pct: number | string | null;
  asset_type: string | null;
};

type MappingDraft = { deprec_rate_pct: string };

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
const SUGGESTION_FIELDS = [
  "location_name", "assigned_to", "area_name", "brand", "model", "serial_number",
  "cost_center_code", "depreciation_method", "asset_comment",
] as const satisfies readonly EditableKey[];
type SuggestionKey = (typeof SUGGESTION_FIELDS)[number];
const SUGGESTION_FIELD_SET = new Set<EditableKey>(SUGGESTION_FIELDS);
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

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

const MAPPING_COLUMNS: Array<{ key: keyof MappingRow; label: string; width: number }> = [
  { key: "origin_account_code", label: "Cuenta origen", width: 135 },
  { key: "account_group", label: "Grupo", width: 110 },
  { key: "account_denom", label: "Denominación", width: 180 },
  { key: "deprec_acc_code_fir", label: "Cuenta deprec. 1", width: 145 },
  { key: "deprec_acc_code_sec", label: "Cuenta deprec. 2", width: 145 },
  { key: "deprec_rate_pct", label: "Tasa deprec.", width: 125 },
  { key: "asset_type", label: "Tipo activo", width: 115 },
];

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function dateOnly(value: unknown) {
  return text(value).slice(0, 10);
}

function monthOf(value: unknown) {
  const match = dateOnly(value).match(/^(\d{4})-(\d{2})/);
  return match ? { year: match[1], month: match[2] } : null;
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

function upperOrNull(value: string) {
  const clean = value.trim();
  return clean ? clean.toLocaleUpperCase("es") : null;
}

function costCenterCode(value: string) {
  const raw = value.trim().split(/\s+-\s+/, 1)[0] || "";
  return raw.toLocaleUpperCase("es").replace(/[^0-9A-Z]/g, "").slice(0, 6);
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
  return !validOptionalNumber(draft.exc_rate)
    || !validOptionalNumber(draft.asset_ini_cost_pen);
}

function toMappingDraft(row: MappingRow): MappingDraft {
  return { deprec_rate_pct: text(row.deprec_rate_pct) };
}

function mappingChanged(draft: MappingDraft, original: MappingDraft) {
  return draft.deprec_rate_pct !== original.deprec_rate_pct;
}

function validMappingRate(value: string) {
  const clean = value.trim();
  return /^\d{1,3}(?:\.\d{1,6})?$/.test(clean) && Number.isFinite(Number(clean));
}

export default function FixAssetsCat() {
  const [rows, setRows] = useState<CatalogueRow[]>([]);
  const [cecoByCode, setCecoByCode] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [originals, setOriginals] = useState<Record<string, Draft>>({});
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [acquisitionYear, setAcquisitionYear] = useState("");
  const [acquisitionMonthFrom, setAcquisitionMonthFrom] = useState("01");
  const [acquisitionMonthTo, setAcquisitionMonthTo] = useState("12");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, MappingDraft>>({});
  const [mappingOriginals, setMappingOriginals] = useState<Record<string, MappingDraft>>({});
  const [mappingLoading, setMappingLoading] = useState(false);
  const [mappingSaving, setMappingSaving] = useState(false);
  const [mappingMessage, setMappingMessage] = useState("");
  const [mappingError, setMappingError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [response, cecoResponse] = await Promise.all([
        apiGet("/api/actfij/catalogue"),
        apiGet("/api/actfij/ceco"),
      ]);
      const nextRows = Array.isArray(response?.rows) ? (response.rows as CatalogueRow[]) : [];
      const nextCecoByCode = (Array.isArray(cecoResponse?.rows) ? cecoResponse.rows as CecoRow[] : [])
        .reduce<Record<string, string>>((current, row) => {
          const code = costCenterCode(text(row.cost_center_code));
          if (code) current[code] = text(row.cost_center_description).trim();
          return current;
        }, {});
      const nextDrafts: Record<string, Draft> = {};
      nextRows.forEach((row) => { nextDrafts[text(row.asset_code)] = toDraft(row); });
      setRows(nextRows);
      setCecoByCode(nextCecoByCode);
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

  const acquisitionYears = useMemo(() => Array.from(new Set(
    rows.map((row) => monthOf(row.acquisition_date)?.year).filter((value): value is string => Boolean(value))
  )).sort().reverse(), [rows]);

  const catalogueCecoCodes = useMemo(() => Array.from(new Set(
    rows
      .map((row) => costCenterCode(text(row.cost_center_code)))
      .filter((code) => Boolean(code) && Object.prototype.hasOwnProperty.call(cecoByCode, code))
  )).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [rows, cecoByCode]);

  const suggestionsByField = useMemo(() => {
    const sets = {} as Record<SuggestionKey, Set<string>>;
    SUGGESTION_FIELDS.forEach((field) => { sets[field] = new Set<string>(); });
    rows.forEach((row) => {
      SUGGESTION_FIELDS.forEach((field) => {
        const value = text(row[field]).trim();
        if (value) sets[field].add(value);
      });
    });
    Object.values(drafts).forEach((draft) => {
      SUGGESTION_FIELDS.forEach((field) => {
        const value = draft[field].trim();
        if (value) sets[field].add(value);
      });
    });
    const result = {} as Record<SuggestionKey, string[]>;
    SUGGESTION_FIELDS.forEach((field) => {
      result[field] = Array.from(sets[field]).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
    });
    return result;
  }, [rows, drafts]);

  const visibleRows = useMemo(() => {
    const needle = deferredQuery.trim().toLocaleLowerCase("es");
    return rows.filter((row) => {
      const code = text(row.asset_code);
      const draft = drafts[code];
      const acquisition = monthOf(draft?.acquisition_date || row.acquisition_date);
      const matchesAcquisition = !acquisitionYear || Boolean(acquisition && acquisition.year === acquisitionYear && acquisition.month >= acquisitionMonthFrom && acquisition.month <= acquisitionMonthTo);
      if (!matchesAcquisition) return false;
      if (!needle) return true;
      return COLUMNS.some((column) => text(
        EDITABLE.includes(column.key as EditableKey) ? draft?.[column.key as EditableKey] : row[column.key]
      ).toLocaleLowerCase("es").includes(needle));
    });
  }, [rows, drafts, deferredQuery, acquisitionYear, acquisitionMonthFrom, acquisitionMonthTo]);

  function update(code: string, key: EditableKey, value: string) {
    setDrafts((current) => ({ ...current, [code]: { ...current[code], [key]: value } }));
    setMessage("");
  }

  function commitCostCenter(assetCode: string, value: string) {
    const code = costCenterCode(value);
    if (!code) {
      update(assetCode, "cost_center_code", "");
      setIsError(false);
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(cecoByCode, code)) {
      setIsError(true);
      setMessage(`Centro de costo ${code} no existe.`);
      return;
    }
    update(assetCode, "cost_center_code", code);
    setIsError(false);
  }

  async function openMappingPreview() {
    setMappingOpen(true);
    setMappingLoading(true);
    setMappingMessage("");
    try {
      const response = await apiGet("/api/actfij/mapping");
      const nextRows = Array.isArray(response?.rows) ? response.rows as MappingRow[] : [];
      const nextDrafts: Record<string, MappingDraft> = {};
      nextRows.forEach((row) => { nextDrafts[text(row.origin_account_code)] = toMappingDraft(row); });
      setMappingRows(nextRows);
      setMappingDrafts(nextDrafts);
      setMappingOriginals(nextDrafts);
      setMappingError(false);
    } catch (error) {
      setMappingRows([]);
      setMappingDrafts({});
      setMappingOriginals({});
      setMappingError(true);
      setMappingMessage(error instanceof Error ? error.message : "No se pudo cargar el mapping");
    } finally {
      setMappingLoading(false);
    }
  }

  const editedMappingCodes = useMemo(() => mappingRows
    .map((row) => text(row.origin_account_code))
    .filter((code) => {
      const row = mappingRows.find((item) => text(item.origin_account_code) === code);
      return Boolean(row && text(row.asset_type).trim().toLocaleLowerCase("es") !== "no deprecia" && mappingDrafts[code] && mappingOriginals[code] && mappingChanged(mappingDrafts[code], mappingOriginals[code]));
    }), [mappingRows, mappingDrafts, mappingOriginals]);
  const invalidMappingCodes = editedMappingCodes.filter((code) => !validMappingRate(mappingDrafts[code].deprec_rate_pct));
  const canSaveMapping = editedMappingCodes.length > 0 && invalidMappingCodes.length === 0 && !mappingLoading && !mappingSaving;

  function updateMappingRate(code: string, value: string) {
    setMappingDrafts((current) => ({ ...current, [code]: { deprec_rate_pct: value } }));
    setMappingMessage("");
  }

  async function saveMapping() {
    if (!canSaveMapping) return;
    setMappingSaving(true);
    setMappingMessage("");
    setMappingError(false);
    let saved = 0;
    try {
      for (const code of editedMappingCodes) {
        const row = mappingRows.find((item) => text(item.origin_account_code) === code);
        if (!row) continue;
        await apiPost("/api/actfij/mapping/insert", {
          origin_account_code: code,
          account_group: row.account_group,
          account_denom: row.account_denom,
          deprec_acc_code_fir: row.deprec_acc_code_fir,
          deprec_acc_code_sec: row.deprec_acc_code_sec,
          deprec_rate_pct: Number(mappingDrafts[code].deprec_rate_pct),
          asset_type: row.asset_type,
        });
        saved += 1;
      }
      setMappingOriginals((current) => {
        const next = { ...current };
        editedMappingCodes.forEach((code) => { next[code] = { ...mappingDrafts[code] }; });
        return next;
      });
      setMappingMessage(`${saved} tasa${saved === 1 ? "" : "s"} de depreciación actualizada${saved === 1 ? "" : "s"}.`);
    } catch (error) {
      setMappingError(true);
      setMappingMessage(`Se actualizaron ${saved} de ${editedMappingCodes.length} filas. ${error instanceof Error ? error.message : "Error al guardar"}`);
    } finally {
      setMappingSaving(false);
    }
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
          location_name: upperOrNull(draft.location_name),
          capex_code: upperOrNull(draft.capex_code),
          asset_description: upperOrNull(draft.asset_description),
          asset_type: draft.asset_type.trim() || null,
          assigned_to: upperOrNull(draft.assigned_to),
          area_name: upperOrNull(draft.area_name),
          brand: upperOrNull(draft.brand),
          model: upperOrNull(draft.model),
          serial_number: upperOrNull(draft.serial_number),
          color: upperOrNull(draft.color),
          cost_center_code: costCenterCode(draft.cost_center_code) || null,
          acquisition_date: draft.acquisition_date || null,
          operation_date: draft.operation_date || null,
          disposal_date: draft.disposal_date || null,
          exc_rate: draft.exc_rate.trim() ? Number(draft.exc_rate) : null,
          asset_ini_cost_pen: draft.asset_ini_cost_pen.trim() ? Number(draft.asset_ini_cost_pen) : null,
          depreciation_method: upperOrNull(draft.depreciation_method),
          asset_situation: upperOrNull(draft.asset_situation),
          asset_comment: upperOrNull(draft.asset_comment),
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
          <Select label="Año adquisición" value={acquisitionYear} onChange={(event) => setAcquisitionYear(event.target.value)} options={acquisitionYears.map((value) => ({ value, label: value }))} placeholder="Todos" style={{ minWidth: 135 }} />
          <Select label="Mes desde" value={acquisitionMonthFrom} onChange={(event) => { const value = event.target.value; setAcquisitionMonthFrom(value); if (value > acquisitionMonthTo) setAcquisitionMonthTo(value); }} options={MONTHS.map((label, index) => ({ value: String(index + 1).padStart(2, "0"), label }))} placeholder="" style={{ minWidth: 145 }} />
          <Select label="Mes hasta" value={acquisitionMonthTo} onChange={(event) => { const value = event.target.value; setAcquisitionMonthTo(value); if (value < acquisitionMonthFrom) setAcquisitionMonthFrom(value); }} options={MONTHS.map((label, index) => ({ value: String(index + 1).padStart(2, "0"), label }))} placeholder="" style={{ minWidth: 145 }} />
          <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800 }}>
            Buscar en toda la tabla
            <FastCellInput className="input" value={query} onCommit={setQuery} onLiveChange={setQuery} placeholder="COD, descripción, área..." style={{ width: 270, height: 34, padding: "6px 10px" }} />
          </label>
          <Button size="sm" onClick={() => void openMappingPreview()} disabled={loading || saving}>Actualizar mapping</Button>
          <Button size="sm" onClick={() => void load()} disabled={loading || saving}>{loading ? "Cargando..." : "Refrescar"}</Button>
          <Button size="sm" variant="primary" onClick={() => void save()} disabled={!canSave}>{saving ? "Guardando..." : `Guardar (${editedCodes.length})`}</Button>
        </div>
      </div>

      {message ? <div className="panel-inner" style={{ padding: 10, borderColor: isError ? "rgba(216,93,39,.8)" : "rgba(94,128,25,.9)", background: isError ? "rgba(216,93,39,.18)" : "rgba(94,128,25,.22)", fontWeight: 700 }}>{message}</div> : null}
      {invalidCodes.length ? <div style={{ color: "#ffd0bf", fontWeight: 700, fontSize: 13 }}>Corrige los campos numéricos de {invalidCodes.length} fila(s) antes de guardar.</div> : null}

      {SUGGESTION_FIELDS.map((field) => <datalist key={field} id={`fixassets-cat-${field}-options`}>
        {field === "cost_center_code"
          ? catalogueCecoCodes.map((code) => (
              <option
                key={code}
                value={code}
                label={`${code} - ${cecoByCode[code]}`}
              />
            ))
          : suggestionsByField[field].map((value) => <option key={value} value={value} />)}
      </datalist>)}

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
                    const editable = EDITABLE.includes(column.key as EditableKey) && column.key !== "asset_type";
                    const key = column.key as EditableKey;
                    const draftCostCenter = costCenterCode(draft.cost_center_code);
                    const mappedCostCenterDesc = draftCostCenter
                      ? cecoByCode[draftCostCenter] || "Centro de costo no existe"
                      : "";
                    const value = column.key === "cost_center_desc"
                      ? mappedCostCenterDesc
                      : column.key === "cost_center_code"
                        ? draftCostCenter
                        : editable
                          ? draft[key]
                          : row[column.key];
                    const sticky = column.key === "asset_code" || column.key === "asset_description";
                    const left = column.key === "asset_code" ? 0 : column.key === "asset_description" ? 105 : undefined;
                    const stickyBackground = bad ? "#79453b" : edited ? "#416f43" : "var(--panel2)";
                    return <td key={column.key} className="capex-td" style={{ padding: 5, background: sticky ? stickyBackground : background, position: sticky ? "sticky" : undefined, left, zIndex: sticky ? 20 : undefined, boxShadow: column.key === "asset_description" ? "2px 0 rgba(216,238,255,.12)" : undefined }}>
                      {editable ? key === "asset_situation" ? <select
                        className="input"
                        value={text(value)}
                        onChange={(event) => update(code, key, event.target.value)}
                        style={{ minWidth: column.width - 12, padding: "6px 7px" }}
                        aria-label={`${column.label} ${code}`}
                      >
                        <option value=""></option>
                        <option value="OPERATIVO">OPERATIVO</option>
                        <option value="DEPRECIADO">DEPRECIADO</option>
                      </select> : <FastCellInput
                        className="input"
                        type={DATE_FIELDS.has(key) ? "date" : "text"}
                        inputMode={NUMBER_FIELDS.has(key) ? "decimal" : undefined}
                        maxLength={undefined}
                        list={SUGGESTION_FIELD_SET.has(key) ? `fixassets-cat-${key}-options` : undefined}
                        value={text(value)}
                        sanitize={key === "cost_center_code" ? costCenterCode : NUMBER_FIELDS.has(key) ? numericDraft : undefined}
                        normalizeOnBlur={NUMBER_FIELDS.has(key) ? (next) => validOptionalNumber(next) ? twoDecimals(next) : next : undefined}
                        onLiveChange={key === "cost_center_code" ? (next) => {
                          const nextCode = costCenterCode(next);
                          if (!nextCode || Object.prototype.hasOwnProperty.call(cecoByCode, nextCode)) {
                            update(code, key, nextCode);
                          }
                        } : undefined}
                        onCommit={(next) => key === "cost_center_code"
                          ? commitCostCenter(code, next)
                          : update(code, key, next)}
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

      {mappingOpen ? <div role="dialog" aria-modal="true" aria-labelledby="mapping-preview-title" style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,.58)" }}>
        <section className="panel-inner" style={{ width: "min(1180px, 96vw)", height: "min(82vh, 760px)", padding: 14, display: "grid", gridTemplateRows: "auto auto minmax(0, 1fr) auto", gap: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 id="mapping-preview-title" style={{ margin: 0, fontSize: 19 }}>Mapping de depreciación</h2>
              <div className="muted" style={{ marginTop: 3, fontSize: 12 }}>Preview de `/api/actfij/mapping`. Solo la tasa de depreciación es editable.</div>
            </div>
            <Button size="sm" onClick={() => setMappingOpen(false)} disabled={mappingSaving}>Cerrar</Button>
          </div>

          {mappingMessage ? <div style={{ padding: 9, borderRadius: 9, border: mappingError ? "1px solid rgba(216,93,39,.75)" : "1px solid rgba(94,128,25,.85)", background: mappingError ? "rgba(216,93,39,.16)" : "rgba(94,128,25,.18)", fontWeight: 800, fontSize: 13 }}>{mappingMessage}</div> : invalidMappingCodes.length ? <div style={{ color: "#ffd0bf", fontWeight: 800, fontSize: 13 }}>Corrige la tasa de depreciación en {invalidMappingCodes.length} fila(s) antes de guardar.</div> : <div className="muted" style={{ fontSize: 12 }}>Las demás columnas son de referencia y no se pueden editar.</div>}

          <div style={{ minWidth: 0, minHeight: 0, overflow: "auto", border: "1px solid rgba(216,238,255,.14)" }}>
            <div style={{ minWidth: "max-content" }}>
              <Table disableScrollWrapper stickyHeader>
                <colgroup>{MAPPING_COLUMNS.map((column) => <col key={column.key} style={{ width: column.width, minWidth: column.width }} />)}</colgroup>
                <thead><tr>{MAPPING_COLUMNS.map((column) => <th key={column.key} className="capex-th" style={{ top: 0, zIndex: 20, padding: 8, fontSize: 12 }}>{column.label}</th>)}</tr></thead>
                <tbody>
                  {mappingRows.map((row) => {
                    const code = text(row.origin_account_code);
                    const draft = mappingDrafts[code] || toMappingDraft(row);
                    const edited = mappingOriginals[code] ? mappingChanged(draft, mappingOriginals[code]) : false;
                    const bad = edited && !validMappingRate(draft.deprec_rate_pct);
                    const noDepreciates = text(row.asset_type).trim().toLocaleLowerCase("es") === "no deprecia";
                    return <tr key={code} className="capex-tr">
                      {MAPPING_COLUMNS.map((column) => <td key={column.key} className="capex-td" style={{ padding: 5, background: bad ? "rgba(216,93,39,.25)" : edited ? "rgba(94,128,25,.25)" : undefined }}>
                        {column.key === "deprec_rate_pct" ? <FastCellInput className="input" inputMode="decimal" value={draft.deprec_rate_pct} sanitize={numericDraft} onCommit={(next) => updateMappingRate(code, next)} disabled={mappingLoading || mappingSaving || noDepreciates} aria-label={`Tasa de depreciación ${code}`} title={noDepreciates ? "No deprecia: la tasa no se puede modificar" : undefined} style={{ minWidth: column.width - 10, padding: "5px 7px", borderColor: bad ? "#ebb086" : undefined, opacity: noDepreciates ? 0.5 : 1, cursor: noDepreciates ? "not-allowed" : undefined }} /> : <span title={text(row[column.key])}>{text(row[column.key]) || "—"}</span>}
                      </td>)}
                    </tr>;
                  })}
                  {mappingLoading ? <tr><td className="capex-td" colSpan={MAPPING_COLUMNS.length}>Cargando mapping...</td></tr> : null}
                  {!mappingLoading && !mappingRows.length ? <tr><td className="capex-td" colSpan={MAPPING_COLUMNS.length}>No hay filas de mapping para mostrar.</td></tr> : null}
                </tbody>
              </Table>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span className="muted" style={{ fontSize: 12 }}>{mappingRows.length} cuentas · {editedMappingCodes.length} tasas modificadas.</span>
            <Button size="sm" variant="primary" onClick={() => void saveMapping()} disabled={!canSaveMapping}>{mappingSaving ? "Guardando..." : `Guardar tasas (${editedMappingCodes.length})`}</Button>
          </div>
        </section>
      </div> : null}
    </div>
  );
}
