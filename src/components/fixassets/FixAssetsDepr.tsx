"use client";

import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Table } from "../ui/Table";
import { FastCellInput } from "./FastCellInput";

type DeprRow = {
  asset_code: string | null;
  source_name: string | null;
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
  asset_type: string | null;
};

type MappingRow = {
  origin_account_code: string | null;
  account_group: string | null;
  account_denom: string | null;
  asset_type: string | null;
};

type CatalogueReferenceRow = {
  asset_code: string | null;
  origin_account_code: string | null;
  asset_situation: string | null;
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

const ADJUSTMENT_COLUMNS = new Set<keyof DeprRow>([
  "acquisition_var_pen", "disposal_var_pen", "reclass_var_pen", "adjustment_var_pen",
  "reclass_depr_pen", "adjustment_depr_pen", "disposal_depr_pen",
]);

const TOTAL_COLUMN_KEYS = [
  "asset_base_value", "depreciation_base_pen", "acquisition_var_pen", "disposal_var_pen",
  "reclass_var_pen", "adjustment_var_pen", "asset_final_value", "reclass_depr_pen",
  "adjustment_depr_pen", "disposal_depr_pen", "depreciation_amount_pen",
  "depreciation_cum_amount_pen", "asset_balance_pen",
] as const satisfies readonly (keyof DeprRow)[];
type TotalColumnKey = (typeof TOTAL_COLUMN_KEYS)[number];
const TOTAL_COLUMN_KEY_SET = new Set<keyof DeprRow>(TOTAL_COLUMN_KEYS);

const COLUMNS: Array<{ key: keyof DeprRow; label: string; width: number }> = [
  { key: "asset_code", label: "COD", width: 90 },
  { key: "asset_description", label: "Descripción activo", width: 220 },
  { key: "period_date", label: "Periodo", width: 90 },
  { key: "asset_base_value", label: "Valor base", width: 105 },
  { key: "depreciation_base_pen", label: "Deprec. base", width: 110 },
  { key: "applied_rate_pct", label: "Tasa", width: 90 },
  { key: "acquisition_var_pen", label: "Var. adquis.", width: 100 },
  { key: "disposal_var_pen", label: "Var. baja", width: 92 },
  { key: "reclass_var_pen", label: "Var. reclas.", width: 100 },
  { key: "adjustment_var_pen", label: "Var. ajuste", width: 96 },
  { key: "asset_final_value", label: "Valor final", width: 105 },
  { key: "reclass_depr_pen", label: "Depr. reclas.", width: 100 },
  { key: "adjustment_depr_pen", label: "Depr. ajuste", width: 100 },
  { key: "disposal_depr_pen", label: "Depr. baja", width: 96 },
  { key: "depreciation_amount_pen", label: "Depr. periodo", width: 105 },
  { key: "depreciation_cum_amount_pen", label: "Depr. acum.", width: 115 },
  { key: "asset_balance_pen", label: "Saldo", width: 110 },
  { key: "exc_rate", label: "T.C.", width: 74 },
];

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const ASSET_TYPES = ["LR", "DUP", "No deprecia"] as const;
type AssetType = (typeof ASSET_TYPES)[number];
const SITUATIONS = ["OPERATIVO", "DEPRECIADO"] as const;
type StatusFilter = "all" | "loaded" | "pending" | "invalid" | "ready";

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function canonicalAssetType(value: unknown): AssetType | null {
  const normalized = text(value).trim().toLocaleLowerCase("es");
  return ASSET_TYPES.find((item) => item.toLocaleLowerCase("es") === normalized) || null;
}

function selectionMatches<T extends string>(selection: ReadonlySet<T> | null, value: T) {
  return selection === null || selection.has(value);
}

function facetSelectionMatches<T extends string>(selection: ReadonlySet<T> | null, value: T) {
  return selection === null || selection.size === 0 || selection.has(value);
}

function syncSelection<T extends string>(current: Set<T> | null, options: readonly T[]) {
  if (options.length === 0 || current === null || current.size === 0) return current;
  const allowed = new Set(options);
  const next = new Set(Array.from(current).filter((value) => allowed.has(value)));
  if (next.size === current.size) return current;
  return next.size ? next : new Set(options);
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

function currentAccountingPeriod() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  let year = Number(parts.find((part) => part.type === "year")?.value || "0");
  let month = Number(parts.find((part) => part.type === "month")?.value || "1");
  const day = Number(parts.find((part) => part.type === "day")?.value || "1");

  if (day <= 10) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }

  return `${year}-${String(month).padStart(2, "0")}`;
}

function hasViewDepreciation(row: DeprRow) {
  return num(row.applied_rate_pct) !== 0 || num(row.depreciation_amount_pen) !== 0;
}

type MultiSelectFilterProps<T extends string> = {
  label: string;
  options: readonly T[];
  selected: ReadonlySet<T> | null;
  onToggle: (value: T) => void;
  onToggleAll: (selectAll: boolean) => void;
  disabled?: boolean;
  minWidth?: number;
};

function MultiSelectFilter<T extends string>({
  label,
  options,
  selected,
  onToggle,
  onToggleAll,
  disabled = false,
  minWidth = 180,
}: MultiSelectFilterProps<T>) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const allSelected = options.length > 0 && (selected === null || options.every((value) => selected.has(value)));
  const selectedCount = selected === null ? options.length : selected.size;
  const summary = allSelected ? "Todos" : selectedCount ? `${selectedCount} seleccionados` : "Ninguno";

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      const details = detailsRef.current;
      if (details && !details.contains(event.target as Node)) details.open = false;
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800 }}>
      <span>{label}</span>
      <details ref={detailsRef} style={{ position: "relative", minWidth, zIndex: 80 }}>
        <summary
          className="input"
          onClick={(event) => { if (disabled) event.preventDefault(); }}
          style={{ height: 34, padding: "6px 10px", cursor: disabled ? "not-allowed" : "pointer", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, userSelect: "none" }}
        >
          <span>{summary}</span>
          <span aria-hidden="true">▾</span>
        </summary>
        <div className="panel-inner" style={{ position: "absolute", top: 38, left: 0, minWidth: "100%", width: "max-content", maxWidth: 360, maxHeight: 280, overflow: "auto", zIndex: 90, padding: 8, background: "#0b4d6b", borderColor: "rgba(147,211,230,.52)", boxShadow: "0 10px 28px rgba(0,0,0,.38)" }}>
          <button
            type="button"
            className="input"
            onClick={(event) => { event.preventDefault(); onToggleAll(!allSelected); }}
            disabled={disabled || !options.length}
            style={{ width: "100%", height: 30, padding: "4px 8px", marginBottom: 6, cursor: disabled ? "not-allowed" : "pointer", fontWeight: 800 }}
          >
            {allSelected ? "Deseleccionar todos" : "Seleccionar todos"}
          </button>
          <div style={{ display: "grid", gap: 4 }}>
            {options.map((value) => (
              <label key={value} style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 3px", cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                <input
                  type="checkbox"
                  checked={selected === null || selected.has(value)}
                  onChange={() => onToggle(value)}
                  disabled={disabled}
                />
                {value}
              </label>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}

export default function FixAssetsDepr() {
  const editablePeriod = useMemo(currentAccountingPeriod, []);
  const [rows, setRows] = useState<DeprRow[]>([]);
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
  const [assetOrigins, setAssetOrigins] = useState<Record<string, string>>({});
  const [assetSituations, setAssetSituations] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [originals, setOriginals] = useState<Record<string, Draft>>({});
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [assetTypes, setAssetTypes] = useState<Set<AssetType> | null>(() => new Set<AssetType>(["LR"]));
  const [mappingGroupsSelected, setMappingGroupsSelected] = useState<Set<string> | null>(null);
  const [mappingDenomsSelected, setMappingDenomsSelected] = useState<Set<string> | null>(null);
  const [situationsSelected, setSituationsSelected] = useState<Set<string> | null>(() => new Set<string>(["OPERATIVO"]));
  const [historyAssetCode, setHistoryAssetCode] = useState<string | null>(null);
  const [historyRowId, setHistoryRowId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
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
      const [response, mappingResponse, catalogueResponse] = await Promise.all([
        apiGet("/api/actfij/deprec"),
        apiGet("/api/actfij/mapping"),
        apiGet("/api/actfij/catalogue"),
      ]);
      const nextRows = (Array.isArray(response?.rows) ? response.rows as DeprRow[] : [])
        .sort((a, b) => text(a.asset_code).localeCompare(text(b.asset_code), undefined, { numeric: true }));
      const nextMappingRows = Array.isArray(mappingResponse?.rows) ? mappingResponse.rows as MappingRow[] : [];
      const catalogueRows = Array.isArray(catalogueResponse?.rows) ? catalogueResponse.rows as CatalogueReferenceRow[] : [];
      const nextAssetOrigins = catalogueRows.reduce<Record<string, string>>((current, row) => {
        const assetCode = text(row.asset_code).trim();
        const originAccount = text(row.origin_account_code).trim();
        if (assetCode && originAccount) current[assetCode] = originAccount;
        return current;
      }, {});
      const nextAssetSituations = catalogueRows.reduce<Record<string, string>>((current, row) => {
        const assetCode = text(row.asset_code).trim();
        if (assetCode) current[assetCode] = text(row.asset_situation).trim().toUpperCase();
        return current;
      }, {});
      const nextDrafts: Record<string, Draft> = {};
      nextRows.forEach((row) => { nextDrafts[rowKey(row)] = toDraft(row); });
      setRows(nextRows);
      setMappingRows(nextMappingRows);
      setAssetOrigins(nextAssetOrigins);
      setAssetSituations(nextAssetSituations);
      setDrafts(nextDrafts);
      setOriginals(nextDrafts);
      setSelectedKeys(new Set());
      setHistoryAssetCode(null);
      setHistoryRowId(null);
      setStatusFilter("all");
      const currentPeriod = currentAccountingPeriod();
      const latest = nextRows
        .map((row) => text(row.period_date).slice(0, 7))
        .filter((value) => Boolean(value) && value <= currentPeriod)
        .sort()
        .at(-1) || "";
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
    rows
      .map((row) => period(row.period_date))
      .filter((value) => value?.year === year && `${value.year}-${value.month}` <= editablePeriod)
      .map((value) => value!.month)
  )).sort(), [rows, year, editablePeriod]);

  useEffect(() => {
    if (monthsForYear.length && !monthsForYear.includes(month)) setMonth(monthsForYear.at(-1) || "");
  }, [monthsForYear, month]);

  const mappingByOrigin = useMemo(() => new Map(
    mappingRows.map((row) => [text(row.origin_account_code).trim(), row] as const).filter(([code]) => Boolean(code))
  ), [mappingRows]);

  const filterBaseRows = useMemo(() => {
    const needle = deferredQuery.trim().toLocaleLowerCase("es");
    return rows.filter((row) => {
      const value = period(row.period_date);
      const assetCode = text(row.asset_code).trim();
      const matchesPeriod = value?.year === year && value.month === month;
      const matchesQuery = !needle || assetCode.toLocaleLowerCase("es").includes(needle)
        || text(row.asset_description).toLocaleLowerCase("es").includes(needle);
      return matchesPeriod && matchesQuery;
    });
  }, [rows, year, month, deferredQuery]);

  const availableAssetTypes = useMemo(() => {
    const values = new Set<AssetType>();
    filterBaseRows.forEach((row) => {
      const assetCode = text(row.asset_code).trim();
      const mapping = mappingByOrigin.get(assetOrigins[assetCode]);
      const rowGroup = text(mapping?.account_group).trim();
      const rowDenom = text(mapping?.account_denom).trim();
      const rowSituation = assetSituations[assetCode] || "";
      const rowAssetType = canonicalAssetType(row.asset_type);
      if (
        rowAssetType
        && facetSelectionMatches(mappingGroupsSelected, rowGroup)
        && facetSelectionMatches(mappingDenomsSelected, rowDenom)
        && facetSelectionMatches(situationsSelected, rowSituation)
      ) values.add(rowAssetType);
    });
    return ASSET_TYPES.filter((value) => values.has(value));
  }, [filterBaseRows, mappingByOrigin, assetOrigins, assetSituations, mappingGroupsSelected, mappingDenomsSelected, situationsSelected]);

  const mappingGroups = useMemo(() => {
    const values = new Set<string>();
    filterBaseRows.forEach((row) => {
      const assetCode = text(row.asset_code).trim();
      const mapping = mappingByOrigin.get(assetOrigins[assetCode]);
      const rowAssetType = canonicalAssetType(row.asset_type);
      const rowDenom = text(mapping?.account_denom).trim();
      const rowSituation = assetSituations[assetCode] || "";
      const rowGroup = text(mapping?.account_group).trim();
      if (
        rowAssetType
        && rowGroup
        && facetSelectionMatches(assetTypes, rowAssetType)
        && facetSelectionMatches(mappingDenomsSelected, rowDenom)
        && facetSelectionMatches(situationsSelected, rowSituation)
      ) values.add(rowGroup);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, "es"));
  }, [filterBaseRows, mappingByOrigin, assetOrigins, assetSituations, assetTypes, mappingDenomsSelected, situationsSelected]);

  const mappingDenoms = useMemo(() => {
    const values = new Set<string>();
    filterBaseRows.forEach((row) => {
      const assetCode = text(row.asset_code).trim();
      const mapping = mappingByOrigin.get(assetOrigins[assetCode]);
      const rowAssetType = canonicalAssetType(row.asset_type);
      const rowGroup = text(mapping?.account_group).trim();
      const rowSituation = assetSituations[assetCode] || "";
      const rowDenom = text(mapping?.account_denom).trim();
      if (
        rowAssetType
        && rowDenom
        && facetSelectionMatches(assetTypes, rowAssetType)
        && facetSelectionMatches(mappingGroupsSelected, rowGroup)
        && facetSelectionMatches(situationsSelected, rowSituation)
      ) values.add(rowDenom);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, "es"));
  }, [filterBaseRows, mappingByOrigin, assetOrigins, assetSituations, assetTypes, mappingGroupsSelected, situationsSelected]);

  const availableSituations = useMemo(() => {
    const values = new Set<string>();
    filterBaseRows.forEach((row) => {
      const assetCode = text(row.asset_code).trim();
      const mapping = mappingByOrigin.get(assetOrigins[assetCode]);
      const rowAssetType = canonicalAssetType(row.asset_type);
      const rowGroup = text(mapping?.account_group).trim();
      const rowDenom = text(mapping?.account_denom).trim();
      const rowSituation = assetSituations[assetCode] || "";
      if (
        rowAssetType
        && rowSituation
        && facetSelectionMatches(assetTypes, rowAssetType)
        && facetSelectionMatches(mappingGroupsSelected, rowGroup)
        && facetSelectionMatches(mappingDenomsSelected, rowDenom)
      ) values.add(rowSituation);
    });
    return SITUATIONS.filter((value) => values.has(value));
  }, [filterBaseRows, mappingByOrigin, assetOrigins, assetSituations, assetTypes, mappingGroupsSelected, mappingDenomsSelected]);

  useEffect(() => {
    setAssetTypes((current) => syncSelection(current, availableAssetTypes));
  }, [availableAssetTypes]);

  useEffect(() => {
    setMappingGroupsSelected((current) => syncSelection(current, mappingGroups));
  }, [mappingGroups]);

  useEffect(() => {
    setMappingDenomsSelected((current) => syncSelection(current, mappingDenoms));
  }, [mappingDenoms]);

  useEffect(() => {
    setSituationsSelected((current) => syncSelection(current, availableSituations));
  }, [availableSituations]);

  const facetRows = useMemo(() => filterBaseRows.filter((row) => {
    const assetCode = text(row.asset_code).trim();
    const mapping = mappingByOrigin.get(assetOrigins[assetCode]);
    const rowAssetType = canonicalAssetType(row.asset_type);
    if (!rowAssetType) return false;
    const rowGroup = text(mapping?.account_group).trim();
    const rowDenom = text(mapping?.account_denom).trim();
    const rowSituation = assetSituations[assetCode] || "";
    return selectionMatches(assetTypes, rowAssetType)
      && selectionMatches(mappingGroupsSelected, rowGroup)
      && selectionMatches(mappingDenomsSelected, rowDenom)
      && selectionMatches(situationsSelected, rowSituation);
  }).sort((a, b) => text(a.asset_code).localeCompare(text(b.asset_code), undefined, { numeric: true })),
  [filterBaseRows, mappingByOrigin, assetOrigins, assetSituations, assetTypes, mappingGroupsSelected, mappingDenomsSelected, situationsSelected]);

  const statusCounts = useMemo(() => {
    let loaded = 0;
    let pending = 0;
    let invalidCount = 0;
    let ready = 0;
    facetRows.forEach((row) => {
      const id = rowKey(row);
      const sourceWeb = text(row.source_name).trim().toUpperCase() === "WEB";
      if (sourceWeb) loaded += 1;
      else pending += 1;
      if (!selectedKeys.has(id)) return;
      const draft = drafts[id] || toDraft(row);
      if (invalid(draft)) invalidCount += 1;
      else ready += 1;
    });
    return { loaded, pending, invalid: invalidCount, ready };
  }, [facetRows, selectedKeys, drafts]);

  const visibleRows = useMemo(() => facetRows.filter((row) => {
    if (statusFilter === "all") return true;
    const id = rowKey(row);
    const sourceWeb = text(row.source_name).trim().toUpperCase() === "WEB";
    if (statusFilter === "loaded") return sourceWeb;
    if (statusFilter === "pending") return !sourceWeb;
    if (!selectedKeys.has(id)) return false;
    const draft = drafts[id] || toDraft(row);
    return statusFilter === "invalid" ? invalid(draft) : !invalid(draft);
  }), [facetRows, statusFilter, selectedKeys, drafts]);

  const tableTotals = useMemo(() => {
    const totals: Record<TotalColumnKey, number> = {
      asset_base_value: 0,
      depreciation_base_pen: 0,
      acquisition_var_pen: 0,
      disposal_var_pen: 0,
      reclass_var_pen: 0,
      adjustment_var_pen: 0,
      asset_final_value: 0,
      reclass_depr_pen: 0,
      adjustment_depr_pen: 0,
      disposal_depr_pen: 0,
      depreciation_amount_pen: 0,
      depreciation_cum_amount_pen: 0,
      asset_balance_pen: 0,
    };
    visibleRows.forEach((row) => {
      const draft = drafts[rowKey(row)] || toDraft(row);
      const calculated = derived(row, draft);
      totals.asset_base_value += num(row.asset_base_value);
      totals.depreciation_base_pen += num(row.depreciation_base_pen);
      totals.acquisition_var_pen += num(draft.acquisition_var_pen);
      totals.disposal_var_pen += num(draft.disposal_var_pen);
      totals.reclass_var_pen += num(draft.reclass_var_pen);
      totals.adjustment_var_pen += num(draft.adjustment_var_pen);
      totals.asset_final_value += calculated.asset_final_value;
      totals.reclass_depr_pen += num(draft.reclass_depr_pen);
      totals.adjustment_depr_pen += num(draft.adjustment_depr_pen);
      totals.disposal_depr_pen += num(draft.disposal_depr_pen);
      totals.depreciation_amount_pen += num(draft.depreciation_amount_pen);
      totals.depreciation_cum_amount_pen += calculated.depreciation_cum_amount_pen;
      totals.asset_balance_pen += calculated.asset_balance_pen;
    });
    return totals;
  }, [visibleRows, drafts]);

  const editableVisibleRows = useMemo(
    () => visibleRows.filter(
      (row) =>
        text(row.period_date).slice(0, 7) === editablePeriod
        && text(row.asset_type).trim().toLocaleLowerCase("es") !== "no deprecia"
    ),
    [visibleRows, editablePeriod]
  );

  const historyRows = useMemo(() => {
    if (!historyAssetCode || !year || !month) return [];
    const selectedPeriod = `${year}-${month}`;
    return rows.filter((row) => text(row.asset_code).trim() === historyAssetCode && text(row.period_date).slice(0, 7) < selectedPeriod)
      .sort((a, b) => text(a.period_date).localeCompare(text(b.period_date)));
  }, [rows, historyAssetCode, year, month]);

  const editedKeys = useMemo(() => rows
    .map(rowKey)
    .filter((key) => drafts[key] && originals[key] && changed(drafts[key], originals[key])), [rows, drafts, originals]);
  const editableRowIds = useMemo(
    () => new Set(
      rows
        .filter(
          (row) =>
            text(row.period_date).slice(0, 7) === editablePeriod
            && text(row.asset_type).trim().toLocaleLowerCase("es") !== "no deprecia"
        )
        .map(rowKey)
    ),
    [rows, editablePeriod]
  );
  const selectedIds = useMemo(() => Array.from(selectedKeys).filter((id) => editableRowIds.has(id)), [selectedKeys, editableRowIds]);
  const invalidKeys = selectedIds.filter((key) => !drafts[key] || invalid(drafts[key]));
  const canSave = selectedIds.length > 0 && invalidKeys.length === 0 && !loading && !saving;
  const allVisibleSelected = editableVisibleRows.length > 0 && editableVisibleRows.every((row) => selectedKeys.has(rowKey(row)));
  const displayColumns = useMemo(
    () => showAdjustments ? COLUMNS : COLUMNS.filter((column) => !ADJUSTMENT_COLUMNS.has(column.key)),
    [showAdjustments]
  );
  const suggestedVisibleRows = useMemo(() => editableVisibleRows.filter(hasViewDepreciation), [editableVisibleRows]);
  const editedVisibleRows = useMemo(() => editableVisibleRows.filter((row) => {
    const id = rowKey(row);
    return drafts[id] && originals[id] && changed(drafts[id], originals[id]);
  }), [editableVisibleRows, drafts, originals]);
  const manualSelectedCount = useMemo(() => selectedIds.filter((id) => {
    const row = rows.find((candidate) => rowKey(candidate) === id);
    return Boolean(row && drafts[id] && originals[id] && changed(drafts[id], originals[id]));
  }).length, [selectedIds, rows, drafts, originals]);

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
    setHistoryAssetCode(null);
    setHistoryRowId(null);
    setYear(nextYear);
    setMonth(nextMonth);
  }

  function clearFilterContext() {
    setSelectedKeys(new Set());
    setHistoryAssetCode(null);
    setHistoryRowId(null);
    setMessage("");
  }

  function toggleAssetType(nextAssetType: AssetType) {
    clearFilterContext();
    setAssetTypes((current) => {
      const next = current === null ? new Set<AssetType>(availableAssetTypes) : new Set(current);
      if (next.has(nextAssetType)) next.delete(nextAssetType);
      else next.add(nextAssetType);
      return availableAssetTypes.length > 0 && availableAssetTypes.every((value) => next.has(value)) ? null : next;
    });
  }

  function toggleAllAssetTypes(selectAll: boolean) {
    clearFilterContext();
    setAssetTypes(selectAll ? null : new Set<AssetType>());
  }

  function toggleMappingGroup(value: string) {
    clearFilterContext();
    setMappingGroupsSelected((current) => {
      const next = current === null ? new Set(mappingGroups) : new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return mappingGroups.length > 0 && mappingGroups.every((item) => next.has(item)) ? null : next;
    });
  }

  function toggleAllMappingGroups(selectAll: boolean) {
    clearFilterContext();
    setMappingGroupsSelected(selectAll ? null : new Set<string>());
  }

  function toggleMappingDenom(value: string) {
    clearFilterContext();
    setMappingDenomsSelected((current) => {
      const next = current === null ? new Set(mappingDenoms) : new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return mappingDenoms.length > 0 && mappingDenoms.every((item) => next.has(item)) ? null : next;
    });
  }

  function toggleAllMappingDenoms(selectAll: boolean) {
    clearFilterContext();
    setMappingDenomsSelected(selectAll ? null : new Set<string>());
  }

  function toggleSituation(value: string) {
    clearFilterContext();
    setSituationsSelected((current) => {
      const next = current === null ? new Set<string>(availableSituations) : new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return availableSituations.length > 0 && availableSituations.every((item) => next.has(item)) ? null : next;
    });
  }

  function toggleAllSituations(selectAll: boolean) {
    clearFilterContext();
    setSituationsSelected(selectAll ? null : new Set<string>());
  }

  function toggleAllVisible(checked: boolean) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      editableVisibleRows.forEach((row) => {
        const id = rowKey(row);
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
    setMessage("");
  }

  function selectRows(nextRows: DeprRow[]) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      nextRows.forEach((row) => next.add(rowKey(row)));
      return next;
    });
    setMessage("");
  }

  function openHistory(row: DeprRow) {
    const id = rowKey(row);
    if (historyRowId === id) {
      setHistoryAssetCode(null);
      setHistoryRowId(null);
      return;
    }
    setHistoryAssetCode(text(row.asset_code).trim() || null);
    setHistoryRowId(id);
  }

  function focusHistory(row: DeprRow) {
    setHistoryAssetCode(text(row.asset_code).trim() || null);
    setHistoryRowId(rowKey(row));
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
    const savedIds: string[] = [];
    const catalogueRateErrors: string[] = [];
    const applySavedRows = () => {
      if (!savedIds.length) return;
      const savedSet = new Set(savedIds);
      setOriginals((current) => {
        const next = { ...current };
        savedIds.forEach((id) => { next[id] = { ...drafts[id] }; });
        return next;
      });
      setRows((current) => current.map((row) => {
        const id = rowKey(row);
        if (!savedSet.has(id)) return row;
        const draft = drafts[id];
        return { ...row, source_name: "WEB", ...draft, ...derived(row, draft) };
      }));
      setSelectedKeys((current) => new Set([...current].filter((id) => !savedSet.has(id))));
    };
    try {
      for (const id of selectedIds) {
        const row = rows.find((candidate) => rowKey(candidate) === id);
        if (!row || text(row.asset_type).trim().toLocaleLowerCase("es") === "no deprecia") continue;
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
        savedIds.push(id);
        if (draft.exc_rate !== originals[id].exc_rate) {
          try {
            await apiPost("/api/actfij/catalogue/insert", {
              asset_code: text(row.asset_code).trim(),
              source_name: "WEB",
              exc_rate: draft.exc_rate.trim() ? Number(draft.exc_rate) : null,
            });
          } catch {
            catalogueRateErrors.push(text(row.asset_code).trim());
          }
        }
      }
      applySavedRows();
      if (catalogueRateErrors.length) {
        setIsError(true);
        setMessage(`${savedIds.length} fila(s) de depreciación guardada(s). No se pudo sincronizar el T.C. en Catálogo para: ${catalogueRateErrors.join(", ")}.`);
      } else {
        setMessage(`${savedIds.length} fila${savedIds.length === 1 ? "" : "s"} de depreciación guardada${savedIds.length === 1 ? "" : "s"} correctamente.`);
      }
    } catch (error) {
      applySavedRows();
      setIsError(true);
      setMessage(`Se guardaron ${savedIds.length} de ${selectedIds.length} filas. ${error instanceof Error ? error.message : "Error al guardar"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixassets-depr-root" style={{ position: "relative", display: "grid", gridTemplateRows: historyAssetCode ? "auto auto auto minmax(420px, 62vh) auto auto" : "auto auto auto minmax(0, 1fr) auto", gap: 12, height: historyAssetCode ? "auto" : "calc(100vh - 205px)", minHeight: 0, overflow: historyAssetCode ? "visible" : "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Depreciación de activos</h1>
          <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>Selecciona con el check las filas que se enviarán completas. La tasa, depreciación y saldos se recalculan en el preview.</div>
        </div>
        <div style={{ display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800 }}>
            Buscar COD o descripción
            <FastCellInput className="input" value={query} onCommit={setQuery} onLiveChange={setQuery} placeholder="Ej. 110 o equipo" style={{ width: 230, height: 34, padding: "6px 10px" }} />
          </label>
          <Select label="Año" value={year} onChange={(event) => clearSelectionAndSetPeriod(event.target.value, month)} options={years.map((value) => ({ value, label: value }))} placeholder="Selecciona" style={{ minWidth: 110 }} />
          <Select label="Mes" value={month} onChange={(event) => clearSelectionAndSetPeriod(year, event.target.value)} options={monthsForYear.map((value) => ({ value, label: MONTHS[Number(value) - 1] }))} placeholder="Selecciona" style={{ minWidth: 150 }} />
          <MultiSelectFilter
            label="Tipo de activo"
            options={availableAssetTypes}
            selected={assetTypes}
            onToggle={toggleAssetType}
            onToggleAll={toggleAllAssetTypes}
            disabled={loading || saving}
            minWidth={180}
          />
          <MultiSelectFilter
            label="Grupo"
            options={mappingGroups}
            selected={mappingGroupsSelected}
            onToggle={toggleMappingGroup}
            onToggleAll={toggleAllMappingGroups}
            disabled={loading || saving}
            minWidth={190}
          />
          <MultiSelectFilter
            label="Denominación"
            options={mappingDenoms}
            selected={mappingDenomsSelected}
            onToggle={toggleMappingDenom}
            onToggleAll={toggleAllMappingDenoms}
            disabled={loading || saving}
            minWidth={220}
          />
          <MultiSelectFilter
            label="Situación"
            options={availableSituations}
            selected={situationsSelected}
            onToggle={toggleSituation}
            onToggleAll={toggleAllSituations}
            disabled={loading || saving}
            minWidth={170}
          />
          <Button size="sm" onClick={() => selectRows(suggestedVisibleRows)} disabled={!suggestedVisibleRows.length || loading || saving}>Usar datos de vista ({suggestedVisibleRows.length})</Button>
          <Button size="sm" onClick={() => selectRows(editedVisibleRows)} disabled={!editedVisibleRows.length || loading || saving}>Seleccionar manuales ({editedVisibleRows.length})</Button>
          <Button size="sm" onClick={() => setSelectedKeys(new Set())} disabled={!selectedIds.length || loading || saving}>Limpiar selección</Button>
          <Button size="sm" onClick={() => setShowAdjustments((current) => !current)} disabled={loading || saving}>{showAdjustments ? "Ocultar ajustes" : "Mostrar ajustes"}</Button>
          <Button size="sm" onClick={() => void load()} disabled={loading || saving}>{loading ? "Cargando..." : "Refrescar"}</Button>
          <Button size="sm" variant="primary" onClick={() => void save()} disabled={!canSave}>{saving ? "Guardando..." : `Guardar (${selectedIds.length})`}</Button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 4 }}>
        {message ? <div className="panel-inner" style={{ padding: 10, borderColor: isError ? "rgba(216,93,39,.8)" : "rgba(94,128,25,.9)", background: isError ? "rgba(216,93,39,.18)" : "rgba(94,128,25,.22)", fontWeight: 700 }}>{message}</div> : null}
        {invalidKeys.length ? <div style={{ color: "#ffd0bf", fontWeight: 700, fontSize: 13 }}>Corrige los valores numéricos de {invalidKeys.length} fila(s) antes de guardar.</div> : null}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setStatusFilter((current) => current === "loaded" ? "all" : "loaded")}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: statusFilter === "loaded"
              ? "1px solid rgba(147, 211, 230, 0.95)"
              : "1px solid rgba(147, 211, 230, 0.45)",
            background: statusFilter === "loaded"
              ? "rgba(27, 147, 227, 0.34)"
              : "rgba(27, 147, 227, 0.16)",
            fontSize: 12,
            fontWeight: 900,
            color: "rgb(180, 225, 245)",
            cursor: "pointer",
          }}
        >
          Cargadas: {statusCounts.loaded}
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter((current) => current === "pending" ? "all" : "pending")}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: statusFilter === "pending"
              ? "1px solid rgba(255,255,255,0.30)"
              : "1px solid rgba(255,255,255,0.12)",
            background: statusFilter === "pending"
              ? "rgba(255,255,255,0.14)"
              : "rgba(255,255,255,0.06)",
            fontSize: 12,
            fontWeight: 900,
            color: "rgba(255,255,255,0.8)",
            cursor: "pointer",
          }}
        >
          Pendientes: {statusCounts.pending}
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter((current) => current === "invalid" ? "all" : "invalid")}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: statusFilter === "invalid"
              ? "1px solid rgba(216, 93, 39, 0.95)"
              : statusCounts.invalid > 0
                ? "1px solid rgba(216, 93, 39, 0.65)"
                : "1px solid rgba(255,255,255,0.12)",
            background: statusFilter === "invalid"
              ? "rgba(216, 93, 39, 0.45)"
              : statusCounts.invalid > 0
                ? "rgba(216, 93, 39, 0.28)"
                : "rgba(255,255,255,0.06)",
            fontSize: 12,
            fontWeight: 900,
            color: statusCounts.invalid > 0 ? "rgb(235, 176, 134)" : "rgba(255,255,255,0.8)",
            cursor: "pointer",
          }}
        >
          Inválidas: {statusCounts.invalid}
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter((current) => current === "ready" ? "all" : "ready")}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: statusFilter === "ready"
              ? "1px solid rgba(147, 178, 92, 0.95)"
              : "1px solid rgba(147, 178, 92, 0.45)",
            background: statusFilter === "ready"
              ? "rgba(94, 128, 25, 0.40)"
              : "rgba(94, 128, 25, 0.24)",
            fontSize: 12,
            fontWeight: 900,
            color: "rgb(174, 202, 125)",
            cursor: "pointer",
          }}
        >
          Correctas para enviar: {statusCounts.ready}
        </button>
      </div>

      <div className="panel-inner fixassets-depr-table" style={{ overflow: "auto", height: historyAssetCode ? "min(62vh, 620px)" : "100%", minHeight: 0, padding: 0, background: "#0b4d6b", borderColor: "rgba(147,211,230,.28)" }}>
        <div style={{ minWidth: "max-content" }}>
          <Table disableScrollWrapper>
            <colgroup><col style={{ width: 52, minWidth: 52 }} />{displayColumns.map((column) => <col key={column.key} style={{ width: column.width, minWidth: column.width }} />)}</colgroup>
            <thead><tr><th className="capex-th" style={{ padding: "8px", fontSize: 12, textAlign: "center", left: 0, zIndex: 48 }}><input type="checkbox" checked={allVisibleSelected} disabled={!editableVisibleRows.length || loading || saving} onChange={(event) => toggleAllVisible(event.target.checked)} aria-label="Seleccionar todas las filas editables" title="Seleccionar todas las filas editables" style={{ width: 18, height: 18, accentColor: "var(--brand-success)" }} /></th>{displayColumns.map((column) => {
              const sticky = column.key === "asset_code" || column.key === "asset_description";
              const left = column.key === "asset_code" ? 52 : column.key === "asset_description" ? 142 : undefined;
              return <th key={column.key} className="capex-th" style={{ padding: "8px", fontSize: 12, left, zIndex: sticky ? 47 : undefined, boxShadow: column.key === "asset_description" ? "2px 0 rgba(216,238,255,.16)" : undefined }}>{column.label}</th>;
            })}</tr></thead>
            <tbody>
              {visibleRows.map((row) => {
                const id = rowKey(row);
                const draft = drafts[id] || toDraft(row);
                const currentPeriodRow = text(row.period_date).slice(0, 7) === editablePeriod;
                const viewOnly = text(row.asset_type).trim().toLocaleLowerCase("es") === "no deprecia";
                const sourceWeb = text(row.source_name).trim().toUpperCase() === "WEB";
                const selectableRow = currentPeriodRow && !viewOnly;
                const selected = selectableRow && selectedKeys.has(id);
                const focused = historyRowId === id;
                const bad = selected && invalid(draft);
                const calculated = derived(row, draft);
                const background = bad
                  ? "rgba(216,93,39,.32)"
                  : focused
                    ? "rgba(27,147,227,.34)"
                    : selected
                      ? "rgba(94,128,25,.32)"
                      : sourceWeb
                        ? "rgba(2,35,52,.72)"
                        : undefined;
                return <tr key={id} className="capex-tr" onClick={() => openHistory(row)} style={{ cursor: "pointer" }}>
                  <td className="capex-td" style={{ padding: 5, textAlign: "center", background: bad ? "#713f38" : focused ? "#155a78" : selected ? "#3d6948" : sourceWeb ? "#062f43" : "#0b4d6b", position: "sticky", left: 0, zIndex: 22 }}>
                    {viewOnly ? null : <input
                      type="checkbox"
                      checked={selected}
                      disabled={!selectableRow || loading || saving}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => toggleSelected(id, event.target.checked)}
                      aria-label={`Enviar depreciación de ${text(row.asset_code)}`}
                      style={{ width: 18, height: 18, accentColor: "var(--brand-success)", cursor: saving ? "not-allowed" : "pointer" }}
                    />}
                  </td>
                  {displayColumns.map((column) => {
                    const editable = selectableRow
                      && EDITABLE.includes(column.key as EditableKey)
                      && column.key !== "depreciation_amount_pen"
                      && column.key !== "exc_rate";
                    const key = column.key as EditableKey;
                    const derivedValue = column.key === "asset_final_value" || column.key === "depreciation_cum_amount_pen" || column.key === "asset_balance_pen"
                      ? calculated[column.key]
                      : column.key === "depreciation_amount_pen"
                        ? draft.depreciation_amount_pen
                        : row[column.key];
                    const sticky = column.key === "asset_code" || column.key === "asset_description";
                    const left = column.key === "asset_code" ? 52 : column.key === "asset_description" ? 142 : undefined;
                    const stickyBackground = bad ? "#713f38" : focused ? "#155a78" : selected ? "#3d6948" : sourceWeb ? "#062f43" : "#0b4d6b";
                    return <td key={column.key} className="capex-td" style={{ padding: 5, background: sticky ? stickyBackground : background, position: sticky ? "sticky" : undefined, left, zIndex: sticky ? 21 : undefined, boxShadow: column.key === "asset_description" ? "2px 0 rgba(216,238,255,.12)" : undefined }}>
                      {editable ? <FastCellInput
                        className="input"
                        inputMode="decimal"
                        value={draft[key]}
                        sanitize={numericDraft}
                        normalizeOnBlur={(next) => validOptionalNumber(next) ? twoDecimals(next) : next}
                        onFocus={() => focusHistory(row)}
                        onClick={(event) => {
                          event.stopPropagation();
                          focusHistory(row);
                        }}
                        onCommit={(next) => update(row, key, next)}
                        style={{ minWidth: column.width - 10, padding: "4px 6px", height: 28, borderRadius: 7, background: "rgba(2,35,52,.42)", borderColor: bad && !validOptionalNumber(draft[key]) ? "#ebb086" : "rgba(147,211,230,.30)" }}
                        aria-label={`${column.label} ${text(row.asset_code)}`}
                      /> : <span title={text(derivedValue)}>{column.key === "period_date" ? text(derivedValue).slice(0, 10) : column.key === "asset_code" || column.key === "asset_description" ? text(derivedValue) : displayNumber(derivedValue)}</span>}
                    </td>;
                  })}
                </tr>;
              })}
              {!loading && !visibleRows.length ? <tr><td className="capex-td" colSpan={displayColumns.length + 1}>No hay depreciaciones para el periodo seleccionado.</td></tr> : null}
              {loading ? <tr><td className="capex-td" colSpan={displayColumns.length + 1}>Cargando depreciación...</td></tr> : null}
            </tbody>
            {!loading && visibleRows.length ? <tfoot>
              <tr>
                <td className="capex-td" style={{ position: "sticky", left: 0, bottom: 0, zIndex: 24, background: "#163b49", color: "#e4f7ff", fontWeight: 900, textAlign: "center", borderTop: "1px solid rgba(147,211,230,.45)" }}>Σ</td>
                {displayColumns.map((column) => {
                  const sticky = column.key === "asset_code" || column.key === "asset_description";
                  const left = column.key === "asset_code" ? 52 : column.key === "asset_description" ? 142 : undefined;
                  const total = TOTAL_COLUMN_KEY_SET.has(column.key) ? tableTotals[column.key as TotalColumnKey] : null;
                  return <td key={column.key} className="capex-td" style={{ position: "sticky", bottom: 0, left, zIndex: sticky ? 23 : 4, background: "#163b49", color: "#e4f7ff", fontWeight: 900, textAlign: total == null ? "left" : "right", borderTop: "1px solid rgba(147,211,230,.45)", boxShadow: column.key === "asset_description" ? "2px 0 rgba(216,238,255,.16)" : undefined }}>
                    {column.key === "asset_code" ? "Totales" : total == null ? "" : displayNumber(total)}
                  </td>;
                })}
              </tr>
            </tfoot> : null}
          </Table>
        </div>
      </div>
      {historyAssetCode ? <section className="panel-inner fixassets-depr-table fixassets-depr-history" style={{ position: "static", maxHeight: 320, padding: 10, display: "grid", gap: 8, overflow: "hidden", background: "#0b4d6b", borderColor: "rgba(147,211,230,.52)", boxShadow: "0 10px 30px rgba(0,0,0,.24)", outline: "none" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div><strong>Histórico de depreciación · {historyAssetCode}</strong><span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>Periodos anteriores a {month && year ? `${MONTHS[Number(month) - 1]} ${year}` : "la selección"}</span></div>
          <Button size="sm" onClick={() => { setHistoryAssetCode(null); setHistoryRowId(null); }}>Cerrar histórico</Button>
        </div>
        {historyRows.length ? <div style={{ overflow: "auto", maxHeight: 260 }}>
          <Table disableScrollWrapper stickyHeader>
            <thead><tr>{["Periodo", "Tasa", "Var. adquis.", "Var. baja", "Var. reclas.", "Var. ajuste", "Valor final", "Depr. reclas.", "Depr. ajuste", "Depr. baja", "Depr. periodo", "Depr. acum.", "Saldo", "T.C."].map((label) => <th key={label} className="capex-th" style={{ top: 0, zIndex: 20, padding: 7, fontSize: 12 }}>{label}</th>)}</tr></thead>
            <tbody>{historyRows.map((historyRow) => {
              const historyDraft = drafts[rowKey(historyRow)] || toDraft(historyRow);
              const calculated = derived(historyRow, historyDraft);
              return <tr key={rowKey(historyRow)} className="capex-tr"><td className="capex-td">{text(historyRow.period_date).slice(0, 10)}</td><td className="capex-td">{displayNumber(historyDraft.applied_rate_pct)}</td><td className="capex-td">{displayNumber(historyDraft.acquisition_var_pen)}</td><td className="capex-td">{displayNumber(historyDraft.disposal_var_pen)}</td><td className="capex-td">{displayNumber(historyDraft.reclass_var_pen)}</td><td className="capex-td">{displayNumber(historyDraft.adjustment_var_pen)}</td><td className="capex-td">{displayNumber(calculated.asset_final_value)}</td><td className="capex-td">{displayNumber(historyDraft.reclass_depr_pen)}</td><td className="capex-td">{displayNumber(historyDraft.adjustment_depr_pen)}</td><td className="capex-td">{displayNumber(historyDraft.disposal_depr_pen)}</td><td className="capex-td">{displayNumber(historyDraft.depreciation_amount_pen)}</td><td className="capex-td">{displayNumber(calculated.depreciation_cum_amount_pen)}</td><td className="capex-td">{displayNumber(calculated.asset_balance_pen)}</td><td className="capex-td">{displayNumber(historyDraft.exc_rate)}</td></tr>;
            })}</tbody>
          </Table>
        </div> : <div className="muted" style={{ fontSize: 13 }}>No hay periodos de depreciación anteriores para este COD.</div>}
      </section> : null}
      <div className="muted" style={{ fontSize: 12 }}>Periodo {year && month ? `${MONTHS[Number(month) - 1]} ${year}` : "sin seleccionar"} · Tipo {assetTypes === null ? "Todos" : Array.from(assetTypes).join(", ") || "ninguno"} · {visibleRows.length} activos · {suggestedVisibleRows.length} con tasa/monto de vista · {selectedIds.length} seleccionados · {manualSelectedCount} con cálculo manual · {editedKeys.length} modificados. {`${year}-${month}` === editablePeriod ? "Edición habilitada para este periodo." : `Modo consulta: solo se puede editar ${editablePeriod}.`}</div>
      <style jsx global>{`
        .fixassets-depr-table table {
          font-size: 11px !important;
        }
        .fixassets-depr-table .capex-th {
          padding: 6px !important;
          font-size: 11px !important;
          background: #163b49 !important;
          white-space: normal !important;
          line-height: 1.1;
        }
        .fixassets-depr-table .capex-td {
          padding: 4px 6px !important;
          line-height: 1.15;
          border-bottom-color: rgba(147,211,230,.14) !important;
        }
        @media (max-width: 1100px) {
          .fixassets-depr-root {
            height: auto !important;
            overflow: visible !important;
          }
          .fixassets-depr-history {
            position: static !important;
            max-height: 320px !important;
          }
        }
      `}</style>
    </div>
  );
}
