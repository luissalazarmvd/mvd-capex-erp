"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiGet, apiPost } from "../../lib/apiClient";
import {
  cmDateText as dateText,
  cmEntryDate2Error as entryDate2Error,
  parseCmIsoDate as parseIsoDate,
  todayInLima,
} from "../../lib/traceability/cmEntryDate";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

type NumericValue = number | string | null;

type CmEntryDateRow = {
  lot: string | null;
  entry_date: string | null;
  entry_date_2: string | null;
  sack_qty: NumericValue;
  miner_name: string | null;
  plate: string | null;
  ruc: string | null;
  concession_name: string | null;
  concession_code: string | null;
  district: string | null;
  province: string | null;
  department: string | null;
  sender_guide_number: string | null;
  transport_name: string | null;
  transport_guide_number: string | null;
  tmh: NumericValue;
  tms: NumericValue;
};

type RucConMapRow = {
  ruc: string | null;
  concession_code: string | null;
  office_name: string | null;
  zone_name: string | null;
  office_code: string | null;
};

type MappingDraft = {
  office_name: string;
  zone_name: string;
  office_code: string;
};

type GetResponse<T> = {
  ok: boolean;
  rows?: T[];
  error?: string;
};

type SaveResponse = {
  ok: boolean;
  error?: string;
};

type EntryColumn = {
  key: keyof CmEntryDateRow;
  label: string;
  kind: "text" | "date" | "number";
  width: number;
};

type MappingColumn = {
  key: keyof RucConMapRow;
  label: string;
  editable: boolean;
  width: number;
  maxLength?: number;
};

type SortDirection = "asc" | "desc";
type ExcelFilterKind = "text" | "number" | "date";
type ExcelFilterOperator =
  | "none"
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "greater"
  | "greater_equal"
  | "less"
  | "less_equal"
  | "between";

type ExcelColumnFilter = {
  selected: string[] | null;
  operator: ExcelFilterOperator;
  value1: string;
  value2: string;
};

type ExcelHeaderFilterProps = {
  label: string;
  kind: ExcelFilterKind;
  values: string[];
  filter?: ExcelColumnFilter;
  sortDirection?: SortDirection;
  onApply: (filter: ExcelColumnFilter) => void;
  onSort: (direction: SortDirection) => void;
};

const PAGE_SIZE = 100;
const SAVE_CONCURRENCY = 20;
const EMPTY_EXCEL_FILTER: ExcelColumnFilter = {
  selected: null,
  operator: "none",
  value1: "",
  value2: "",
};

const ENTRY_COLUMNS: EntryColumn[] = [
  { key: "lot", label: "Lote", kind: "text", width: 110 },
  { key: "entry_date", label: "F. ingreso", kind: "date", width: 112 },
  { key: "entry_date_2", label: "F. ingreso 2", kind: "date", width: 126 },
  { key: "sack_qty", label: "Sacos", kind: "number", width: 90 },
  { key: "miner_name", label: "Minero", kind: "text", width: 220 },
  { key: "plate", label: "Placa", kind: "text", width: 105 },
  { key: "ruc", label: "RUC", kind: "text", width: 125 },
  { key: "concession_name", label: "Concesión", kind: "text", width: 210 },
  { key: "concession_code", label: "Cód. concesión", kind: "text", width: 145 },
  { key: "district", label: "Distrito", kind: "text", width: 135 },
  { key: "province", label: "Provincia", kind: "text", width: 135 },
  { key: "department", label: "Departamento", kind: "text", width: 145 },
  { key: "sender_guide_number", label: "Guía remitente", kind: "text", width: 150 },
  { key: "transport_name", label: "Transportista", kind: "text", width: 210 },
  { key: "transport_guide_number", label: "Guía transportista", kind: "text", width: 165 },
  { key: "tmh", label: "TMH", kind: "number", width: 100 },
  { key: "tms", label: "TMS", kind: "number", width: 100 },
];

const MAPPING_COLUMNS: MappingColumn[] = [
  { key: "ruc", label: "RUC", editable: false, width: 135 },
  { key: "concession_code", label: "Cód. concesión", editable: false, width: 180 },
  { key: "office_name", label: "Oficina", editable: true, width: 210, maxLength: 50 },
  { key: "zone_name", label: "Zona", editable: true, width: 180, maxLength: 20 },
  { key: "office_code", label: "Cód. oficina", editable: true, width: 180, maxLength: 50 },
];

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
});

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function displayDate(value: unknown) {
  const parsed = parseIsoDate(value);
  if (!parsed) return dateText(value) || "—";
  const [year, month, day] = parsed.normalized.split("-");
  return `${day}/${month}/${year}`;
}

function displayValue(value: unknown, kind: EntryColumn["kind"]) {
  if (kind === "date") return displayDate(value);
  if (kind === "number") {
    if (value === null || value === undefined || text(value).trim() === "") return "—";
    const parsed = Number(value);
    return Number.isFinite(parsed) ? numberFormatter.format(parsed) : text(value);
  }
  return text(value).trim() || "—";
}

function excelFilterValue(value: unknown, kind: ExcelFilterKind) {
  const normalized = text(value).trim();
  if (!normalized) return "";
  if (kind === "date") return dateText(normalized);
  if (kind === "number") {
    const parsed = Number(normalized.replace(",", "."));
    if (!Number.isFinite(parsed)) return normalized;
    return (Math.abs(parsed) < 0.005 ? 0 : parsed).toFixed(2);
  }
  return normalized;
}

function excelFilterIsActive(filter: ExcelColumnFilter | undefined) {
  return Boolean(
    filter && (filter.selected !== null || filter.operator !== "none")
  );
}

function excelOperatorOptions(
  kind: ExcelFilterKind
): Array<{ value: ExcelFilterOperator; label: string }> {
  if (kind === "text") {
    return [
      { value: "none", label: "Sin filtro personalizado" },
      { value: "equals", label: "Es igual a" },
      { value: "not_equals", label: "No es igual a" },
      { value: "contains", label: "Contiene" },
      { value: "not_contains", label: "No contiene" },
      { value: "starts_with", label: "Comienza por" },
      { value: "ends_with", label: "Termina en" },
    ];
  }

  if (kind === "date") {
    return [
      { value: "none", label: "Sin filtro personalizado" },
      { value: "equals", label: "Es igual a" },
      { value: "not_equals", label: "No es igual a" },
      { value: "greater", label: "Después de" },
      { value: "greater_equal", label: "Después o igual a" },
      { value: "less", label: "Antes de" },
      { value: "less_equal", label: "Antes o igual a" },
      { value: "between", label: "Entre" },
    ];
  }

  return [
    { value: "none", label: "Sin filtro personalizado" },
    { value: "equals", label: "Es igual a" },
    { value: "not_equals", label: "No es igual a" },
    { value: "greater", label: "Mayor que" },
    { value: "greater_equal", label: "Mayor o igual que" },
    { value: "less", label: "Menor que" },
    { value: "less_equal", label: "Menor o igual que" },
    { value: "between", label: "Entre" },
  ];
}

function matchesExcelFilter(
  rawValue: unknown,
  filter: ExcelColumnFilter | undefined,
  kind: ExcelFilterKind
) {
  if (!filter) return true;
  const value = excelFilterValue(rawValue, kind);

  if (filter.selected !== null && !filter.selected.includes(value)) {
    return false;
  }

  if (filter.operator === "none") return true;
  const first = filter.value1.trim();
  const second = filter.value2.trim();
  if (!first || (filter.operator === "between" && !second)) return true;

  if (kind === "text") {
    const current = value.toLocaleLowerCase("es");
    const expected = first.toLocaleLowerCase("es");
    if (filter.operator === "equals") return current === expected;
    if (filter.operator === "not_equals") return current !== expected;
    if (filter.operator === "contains") return current.includes(expected);
    if (filter.operator === "not_contains") return !current.includes(expected);
    if (filter.operator === "starts_with") return current.startsWith(expected);
    if (filter.operator === "ends_with") return current.endsWith(expected);
    return true;
  }

  if (kind === "number") {
    const current = Number(value);
    const expected = Number(first.replace(",", "."));
    const upper = Number(second.replace(",", "."));
    if (!Number.isFinite(current) || !Number.isFinite(expected)) return false;
    if (filter.operator === "equals") return current === expected;
    if (filter.operator === "not_equals") return current !== expected;
    if (filter.operator === "greater") return current > expected;
    if (filter.operator === "greater_equal") return current >= expected;
    if (filter.operator === "less") return current < expected;
    if (filter.operator === "less_equal") return current <= expected;
    if (filter.operator === "between") {
      return (
        Number.isFinite(upper) &&
        current >= Math.min(expected, upper) &&
        current <= Math.max(expected, upper)
      );
    }
    return true;
  }

  const current = value.slice(0, 10);
  const expected = first.slice(0, 10);
  const upper = second.slice(0, 10);
  if (!current || !expected) return false;
  if (filter.operator === "equals") return current === expected;
  if (filter.operator === "not_equals") return current !== expected;
  if (filter.operator === "greater") return current > expected;
  if (filter.operator === "greater_equal") return current >= expected;
  if (filter.operator === "less") return current < expected;
  if (filter.operator === "less_equal") return current <= expected;
  if (filter.operator === "between") {
    return (
      Boolean(upper) &&
      current >= (expected < upper ? expected : upper) &&
      current <= (expected > upper ? expected : upper)
    );
  }
  return true;
}

function ExcelHeaderFilter({
  label,
  kind,
  values,
  filter,
  sortDirection,
  onApply,
  onSort,
}: ExcelHeaderFilterProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number } | null>(null);
  const [search, setSearch] = useState("");
  const [draftFilter, setDraftFilter] = useState<ExcelColumnFilter>(() => ({
    ...(filter ?? EMPTY_EXCEL_FILTER),
    selected: filter?.selected ? [...filter.selected] : null,
  }));

  const closeMenu = useCallback(() => {
    setOpen(false);
    setPopupPosition(null);
  }, []);

  function toggleMenu() {
    if (open) {
      closeMenu();
      return;
    }
    setSearch("");
    setDraftFilter({
      ...(filter ?? EMPTY_EXCEL_FILTER),
      selected: filter?.selected ? [...filter.selected] : null,
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) {
        closeMenu();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, closeMenu]);

  const updatePopupPosition = useCallback(() => {
    const anchor = rootRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 4;
    const popupWidth = Math.min(285, Math.max(0, window.innerWidth - viewportPadding * 2));
    const popupHeight = Math.min(520, Math.max(240, window.innerHeight - viewportPadding * 2));
    const top = Math.max(
      viewportPadding,
      Math.min(rect.bottom + gap, window.innerHeight - popupHeight - viewportPadding)
    );
    const left = Math.min(
      Math.max(viewportPadding, rect.right - popupWidth),
      Math.max(viewportPadding, window.innerWidth - popupWidth - viewportPadding)
    );
    setPopupPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePopupPosition();
    window.addEventListener("resize", updatePopupPosition);
    window.addEventListener("scroll", updatePopupPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopupPosition);
      window.removeEventListener("scroll", updatePopupPosition, true);
    };
  }, [open, updatePopupPosition]);

  const distinctValues = useMemo(
    () =>
      Array.from(new Set(values.map((value) => excelFilterValue(value, kind)))).sort(
        (left, right) => {
          if (left === "") return -1;
          if (right === "") return 1;
          if (kind === "number") return Number(left) - Number(right);
          return left.localeCompare(right, "es", { numeric: true, sensitivity: "base" });
        }
      ),
    [values, kind]
  );

  const searchedValues = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    if (!query) return distinctValues;
    return distinctValues.filter((value) =>
      (value || "(Vacíos)").toLocaleLowerCase("es").includes(query)
    );
  }, [distinctValues, search]);

  const selectedSet = useMemo(
    () => new Set(draftFilter.selected === null ? distinctValues : draftFilter.selected),
    [draftFilter.selected, distinctValues]
  );
  const allSelected =
    distinctValues.length > 0 && distinctValues.every((value) => selectedSet.has(value));
  const active = excelFilterIsActive(filter) || Boolean(sortDirection);
  const inputType = kind === "date" ? "date" : kind === "number" ? "number" : "text";

  function toggleValue(value: string, checked: boolean) {
    const next = new Set(
      draftFilter.selected === null ? distinctValues : draftFilter.selected
    );
    if (checked) next.add(value);
    else next.delete(value);
    setDraftFilter((current) => ({
      ...current,
      selected: next.size === distinctValues.length ? null : Array.from(next),
    }));
  }

  function menuButtonStyle(selected: boolean): React.CSSProperties {
    return {
      textAlign: "left",
      padding: "6px 8px",
      borderRadius: 7,
      border: "1px solid rgba(147,211,230,.24)",
      background: selected ? "rgba(27,147,227,.24)" : "rgba(2,35,52,.38)",
      color: "#f4fbff",
      cursor: "pointer",
    };
  }

  const menuInputStyle: React.CSSProperties = {
    width: "100%",
    height: 30,
    padding: "5px 8px",
    borderRadius: 7,
    border: "1px solid rgba(147,211,230,.30)",
    background: "rgba(2,35,52,.58)",
    color: "#f4fbff",
    outline: "none",
    colorScheme: "dark",
  };

  return (
    <div
      ref={rootRef}
      onClick={(event) => event.stopPropagation()}
      style={{ position: "relative", display: "inline-flex", alignItems: "center", flexShrink: 0 }}
    >
      <button
        type="button"
        onClick={toggleMenu}
        aria-label={`Filtrar ${label}`}
        title={`Filtrar ${label}`}
        aria-expanded={open}
        style={{
          width: 20,
          height: 20,
          padding: 0,
          borderRadius: 5,
          border: active
            ? "1px solid rgba(147,211,230,.72)"
            : "1px solid rgba(147,211,230,.30)",
          background: active ? "rgba(27,147,227,.32)" : "rgba(2,35,52,.34)",
          color: "#eaf8ff",
          fontSize: 10,
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        {active ? "◆" : "▼"}
      </button>

      {open && popupPosition
        ? createPortal(
            <div
              ref={popupRef}
              onClick={(event) => event.stopPropagation()}
              style={{
                position: "fixed",
                top: popupPosition.top,
                left: popupPosition.left,
                zIndex: 11000,
                width: "min(285px, calc(100vw - 16px))",
                maxHeight: "calc(100vh - 16px)",
                overflowY: "auto",
                padding: 10,
                border: "1px solid rgba(147,211,230,.42)",
                borderRadius: 10,
                background: "#07364d",
                boxShadow: "0 14px 32px rgba(0,0,0,.40)",
                color: "#f4fbff",
                textAlign: "left",
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 8 }}>{label}</div>
              <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    onSort("asc");
                    closeMenu();
                  }}
                  style={menuButtonStyle(sortDirection === "asc")}
                >
                  {kind === "number"
                    ? "Ordenar de menor a mayor"
                    : kind === "date"
                      ? "Ordenar de más antiguo a más reciente"
                      : "Ordenar de A a Z"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSort("desc");
                    closeMenu();
                  }}
                  style={menuButtonStyle(sortDirection === "desc")}
                >
                  {kind === "number"
                    ? "Ordenar de mayor a menor"
                    : kind === "date"
                      ? "Ordenar de más reciente a más antiguo"
                      : "Ordenar de Z a A"}
                </button>
              </div>

              <div style={{ borderTop: "1px solid rgba(147,211,230,.18)", paddingTop: 8 }}>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar valores..."
                  style={menuInputStyle}
                />
                <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, fontWeight: 800 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) =>
                      setDraftFilter((current) => ({
                        ...current,
                        selected: event.target.checked ? null : [],
                      }))
                    }
                  />
                  Seleccionar todo
                </label>
                <div style={{ maxHeight: 155, overflowY: "auto", marginTop: 5, paddingRight: 3 }}>
                  {searchedValues.map((value) => (
                    <label key={value || "__EMPTY__"} style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 0" }}>
                      <input
                        type="checkbox"
                        checked={selectedSet.has(value)}
                        onChange={(event) => toggleValue(value, event.target.checked)}
                      />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {value || "(Vacíos)"}
                      </span>
                    </label>
                  ))}
                  {!searchedValues.length ? <div style={{ padding: "8px 0", opacity: .72 }}>Sin coincidencias</div> : null}
                </div>
              </div>

              <div style={{ borderTop: "1px solid rgba(147,211,230,.18)", marginTop: 8, paddingTop: 8, display: "grid", gap: 6 }}>
                <select
                  value={draftFilter.operator}
                  onChange={(event) =>
                    setDraftFilter((current) => ({
                      ...current,
                      operator: event.target.value as ExcelFilterOperator,
                    }))
                  }
                  style={{ ...menuInputStyle, padding: "4px 7px", background: "#0b4d6b" }}
                >
                  {excelOperatorOptions(kind).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {draftFilter.operator !== "none" ? (
                  <input
                    type={inputType}
                    value={draftFilter.value1}
                    step={kind === "number" ? "any" : undefined}
                    onChange={(event) =>
                      setDraftFilter((current) => ({ ...current, value1: event.target.value }))
                    }
                    placeholder={kind === "text" ? "Valor..." : undefined}
                    style={menuInputStyle}
                  />
                ) : null}
                {draftFilter.operator === "between" ? (
                  <input
                    type={inputType}
                    value={draftFilter.value2}
                    step={kind === "number" ? "any" : undefined}
                    onChange={(event) =>
                      setDraftFilter((current) => ({ ...current, value2: event.target.value }))
                    }
                    style={menuInputStyle}
                  />
                ) : null}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    onApply({ ...EMPTY_EXCEL_FILTER });
                    closeMenu();
                  }}
                  style={{ ...menuButtonStyle(false), background: "transparent" }}
                >
                  Limpiar filtro
                </button>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={closeMenu} style={{ ...menuButtonStyle(false), background: "transparent" }}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onApply({
                        ...draftFilter,
                        selected: draftFilter.selected ? [...draftFilter.selected] : null,
                      });
                      closeMenu();
                    }}
                    style={{ ...menuButtonStyle(true), fontWeight: 900 }}
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function rowLot(row: CmEntryDateRow) {
  return text(row.lot).trim();
}

function mappingKey(row: Pick<RucConMapRow, "ruc" | "concession_code">) {
  return `${text(row.ruc).trim()}\u001f${text(row.concession_code).trim()}`;
}

function toMappingDraft(row: RucConMapRow): MappingDraft {
  return {
    office_name: text(row.office_name),
    zone_name: text(row.zone_name),
    office_code: text(row.office_code),
  };
}

function entryColumnValue(
  row: CmEntryDateRow,
  key: keyof CmEntryDateRow,
  draftDates: Record<string, string>
) {
  return key === "entry_date_2" ? draftDates[rowLot(row)] : row[key];
}

function mappingColumnValue(
  row: RucConMapRow,
  key: keyof RucConMapRow,
  draft: MappingDraft
) {
  if (key === "office_name" || key === "zone_name" || key === "office_code") {
    return draft[key];
  }
  return row[key];
}

function sameMappingDraft(left: MappingDraft | undefined, right: MappingDraft | undefined) {
  if (!left || !right) return true;
  return (
    left.office_name === right.office_name &&
    left.zone_name === right.zone_name &&
    left.office_code === right.office_code
  );
}

function optionalText(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function entrySaveErrorMessage(error: unknown) {
  const message = errorMessage(error).trim();
  if (/fetch failed|failed to fetch|networkerror/i.test(message)) {
    return "No se pudo conectar con la API de trazabilidad; el lote no fue guardado.";
  }
  return message || "La API rechazó el guardado sin indicar el motivo.";
}

async function settleInChunks<T>(
  items: T[],
  task: (item: T) => Promise<string>
) {
  const fulfilled: string[] = [];
  const rejected: string[] = [];

  for (let start = 0; start < items.length; start += SAVE_CONCURRENCY) {
    const chunk = items.slice(start, start + SAVE_CONCURRENCY);
    const results = await Promise.allSettled(chunk.map(task));

    results.forEach((result) => {
      if (result.status === "fulfilled") fulfilled.push(result.value);
      else rejected.push(errorMessage(result.reason));
    });
  }

  return { fulfilled, rejected };
}

export default function TraceabilityCmInputsForm() {
  const [rows, setRows] = useState<CmEntryDateRow[]>([]);
  const [draftDates, setDraftDates] = useState<Record<string, string>>({});
  const [originalDates, setOriginalDates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [entrySaveErrors, setEntrySaveErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showEditedOnly, setShowEditedOnly] = useState(false);
  const [sortKey, setSortKey] = useState<keyof CmEntryDateRow>("lot");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [hasManualSort, setHasManualSort] = useState(false);
  const [columnFilters, setColumnFilters] = useState<
    Partial<Record<keyof CmEntryDateRow, ExcelColumnFilter>>
  >({});
  const [page, setPage] = useState(1);

  const [mappingOpen, setMappingOpen] = useState(false);
  const [mappingRows, setMappingRows] = useState<RucConMapRow[]>([]);
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, MappingDraft>>({});
  const [mappingOriginals, setMappingOriginals] = useState<Record<string, MappingDraft>>({});
  const [mappingLoading, setMappingLoading] = useState(false);
  const [mappingSaving, setMappingSaving] = useState(false);
  const [mappingMessage, setMappingMessage] = useState<string | null>(null);
  const [mappingSearch, setMappingSearch] = useState("");
  const [mappingSortKey, setMappingSortKey] = useState<keyof RucConMapRow>("ruc");
  const [mappingSortDirection, setMappingSortDirection] = useState<SortDirection>("asc");
  const [hasMappingManualSort, setHasMappingManualSort] = useState(false);
  const [mappingColumnFilters, setMappingColumnFilters] = useState<
    Partial<Record<keyof RucConMapRow, ExcelColumnFilter>>
  >({});
  const [mappingPage, setMappingPage] = useState(1);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = (await apiGet(
        "/api/traceability/cm/entrydate"
      )) as GetResponse<CmEntryDateRow>;
      const nextRows = Array.isArray(response.rows) ? response.rows : [];
      const nextDrafts: Record<string, string> = {};
      const nextOriginals: Record<string, string> = {};

      nextRows.forEach((row) => {
        const lot = rowLot(row);
        if (!lot) return;
        const value = dateText(row.entry_date_2);
        nextDrafts[lot] = value;
        nextOriginals[lot] = value;
      });

      setRows(nextRows);
      setDraftDates(nextDrafts);
      setOriginalDates(nextOriginals);
      setEntrySaveErrors({});
      setShowEditedOnly(false);
      setColumnFilters({});
      setHasManualSort(false);
      setSortKey("lot");
      setSortDirection("asc");
      setPage(1);
    } catch (error: unknown) {
      setRows([]);
      setDraftDates({});
      setOriginalDates({});
      setEntrySaveErrors({});
      setMessage(`ERROR: ${errorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMapping = useCallback(async () => {
    setMappingLoading(true);
    setMappingMessage(null);

    try {
      const response = (await apiGet(
        "/api/traceability/cm/ruccon-map"
      )) as GetResponse<RucConMapRow>;
      const nextRows = Array.isArray(response.rows) ? response.rows : [];
      const nextDrafts: Record<string, MappingDraft> = {};
      const nextOriginals: Record<string, MappingDraft> = {};

      nextRows.forEach((row) => {
        const key = mappingKey(row);
        const draft = toMappingDraft(row);
        nextDrafts[key] = { ...draft };
        nextOriginals[key] = { ...draft };
      });

      setMappingRows(nextRows);
      setMappingDrafts(nextDrafts);
      setMappingOriginals(nextOriginals);
      setMappingColumnFilters({});
      setHasMappingManualSort(false);
      setMappingSortKey("ruc");
      setMappingSortDirection("asc");
      setMappingPage(1);
    } catch (error: unknown) {
      setMappingRows([]);
      setMappingDrafts({});
      setMappingOriginals({});
      setMappingMessage(`ERROR: ${errorMessage(error)}`);
    } finally {
      setMappingLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    if (!mappingOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !mappingSaving) setMappingOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mappingOpen, mappingSaving]);

  const maximumEntryDate2 = useMemo(todayInLima, []);
  const entryRowsByLot = useMemo(
    () => new Map(rows.map((row) => [rowLot(row), row])),
    [rows]
  );

  const editedLots = useMemo(
    () =>
      rows
        .map(rowLot)
        .filter(
          (lot) => lot && dateText(draftDates[lot]) !== dateText(originalDates[lot])
        ),
    [rows, draftDates, originalDates]
  );

  const editedLotSet = useMemo(() => new Set(editedLots), [editedLots]);
  const entryDate2Errors = useMemo(() => {
    const errors = new Map<string, string>();
    rows.forEach((row) => {
      const lot = rowLot(row);
      if (!lot) return;
      const error = entryDate2Error(
        draftDates[lot],
        row.entry_date,
        maximumEntryDate2
      ) ?? entrySaveErrors[lot];
      if (error) errors.set(lot, error);
    });
    return errors;
  }, [draftDates, entrySaveErrors, maximumEntryDate2, rows]);
  const invalidEditedLots = useMemo(
    () => editedLots.filter((lot) => entryDate2Errors.has(lot)),
    [editedLots, entryDate2Errors]
  );

  const entryDateBounds = useMemo(() => {
    const dates = rows.map((row) => dateText(row.entry_date)).filter(Boolean).sort();
    return { min: dates[0] ?? "", max: dates[dates.length - 1] ?? "" };
  }, [rows]);

  useEffect(() => {
    if (!rows.length) return;
    setDateFrom((current) => current || entryDateBounds.min);
    setDateTo((current) => current || entryDateBounds.max);
  }, [rows, entryDateBounds.min, entryDateBounds.max]);

  const entryExcelColumnValues = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    const baseRows = rows.filter((row) => {
      const lot = rowLot(row);
      const entryDate = dateText(row.entry_date);
      if (dateFrom && entryDate < dateFrom) return false;
      if (dateTo && entryDate > dateTo) return false;
      if (showEditedOnly && !editedLotSet.has(lot)) return false;
      if (!query) return true;
      return ENTRY_COLUMNS.some((column) =>
        text(row[column.key])
          .toLocaleLowerCase("es")
          .includes(query)
      );
    });

    const values: Partial<Record<keyof CmEntryDateRow, string[]>> = {};
    ENTRY_COLUMNS.forEach((column) => {
      values[column.key] = baseRows.map((row) =>
        excelFilterValue(
          row[column.key],
          column.kind
        )
      );
    });
    return values;
  }, [rows, search, dateFrom, dateTo, showEditedOnly, editedLotSet]);

  useEffect(() => {
    setPage(1);
  }, [search, dateFrom, dateTo, showEditedOnly, sortKey, sortDirection, columnFilters]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    const matching = rows.filter((row) => {
      const lot = rowLot(row);
      const entryDate = dateText(row.entry_date);
      if (dateFrom && entryDate < dateFrom) return false;
      if (dateTo && entryDate > dateTo) return false;
      if (showEditedOnly && !editedLotSet.has(lot)) return false;
      if (
        query &&
        !ENTRY_COLUMNS.some((column) =>
          text(row[column.key])
            .toLocaleLowerCase("es")
            .includes(query)
        )
      ) {
        return false;
      }

      return (
        Object.entries(columnFilters) as Array<
          [keyof CmEntryDateRow, ExcelColumnFilter]
        >
      ).every(([columnKey, filter]) => {
        const column = ENTRY_COLUMNS.find((item) => item.key === columnKey);
        return matchesExcelFilter(
          row[columnKey],
          filter,
          column?.kind ?? "text"
        );
      });
    });

    const sortColumn =
      ENTRY_COLUMNS.find((item) => item.key === sortKey) ?? ENTRY_COLUMNS[0];
    return matching
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const leftLot = rowLot(left.row);
        const rightLot = rowLot(right.row);
        const leftEdited = editedLotSet.has(leftLot);
        const rightEdited = editedLotSet.has(rightLot);
        if (leftEdited !== rightEdited) return leftEdited ? -1 : 1;

        const leftValue = entryColumnValue(left.row, sortColumn.key, draftDates);
        const rightValue = entryColumnValue(right.row, sortColumn.key, draftDates);
        let result = 0;

        if (sortColumn.kind === "number") {
          const a = Number(leftValue);
          const b = Number(rightValue);
          const validA = Number.isFinite(a);
          const validB = Number.isFinite(b);
          result = validA && validB ? a - b : validA ? -1 : validB ? 1 : 0;
        } else {
          result = text(leftValue).localeCompare(text(rightValue), "es", {
            numeric: true,
            sensitivity: "base",
          });
        }

        if (result === 0) result = left.index - right.index;
        return sortDirection === "asc" ? result : -result;
      })
      .map(({ row }) => row);
  }, [
    rows,
    search,
    dateFrom,
    dateTo,
    showEditedOnly,
    editedLotSet,
    draftDates,
    sortKey,
    sortDirection,
    columnFilters,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const visibleRows = filteredRows.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const editedMappingKeys = useMemo(
    () =>
      mappingRows
        .map(mappingKey)
        .filter((key) => !sameMappingDraft(mappingDrafts[key], mappingOriginals[key])),
    [mappingRows, mappingDrafts, mappingOriginals]
  );

  const editedMappingSet = useMemo(
    () => new Set(editedMappingKeys),
    [editedMappingKeys]
  );

  const mappingExcelColumnValues = useMemo(() => {
    const query = mappingSearch.trim().toLocaleLowerCase("es");
    const baseRows = mappingRows.filter((row) => {
      if (!query) return true;
      const key = mappingKey(row);
      const draft = mappingDrafts[key] ?? toMappingDraft(row);
      return MAPPING_COLUMNS.some((column) =>
        text(mappingColumnValue(row, column.key, draft))
          .toLocaleLowerCase("es")
          .includes(query)
      );
    });

    const values: Partial<Record<keyof RucConMapRow, string[]>> = {};
    MAPPING_COLUMNS.forEach((column) => {
      values[column.key] = baseRows.map((row) => {
        const draft = mappingDrafts[mappingKey(row)] ?? toMappingDraft(row);
        return excelFilterValue(
          mappingColumnValue(row, column.key, draft),
          "text"
        );
      });
    });
    return values;
  }, [mappingRows, mappingSearch, mappingDrafts]);

  const filteredMappingRows = useMemo(() => {
    const query = mappingSearch.trim().toLocaleLowerCase("es");
    return mappingRows
      .filter((row) => {
        const key = mappingKey(row);
        const draft = mappingDrafts[key] ?? toMappingDraft(row);
        if (
          query &&
          !MAPPING_COLUMNS.some((column) =>
            text(mappingColumnValue(row, column.key, draft))
              .toLocaleLowerCase("es")
              .includes(query)
          )
        ) {
          return false;
        }

        return (
          Object.entries(mappingColumnFilters) as Array<
            [keyof RucConMapRow, ExcelColumnFilter]
          >
        ).every(([columnKey, filter]) =>
          matchesExcelFilter(
            mappingColumnValue(row, columnKey, draft),
            filter,
            "text"
          )
        );
      })
      .sort((left, right) => {
        const leftEdited = editedMappingSet.has(mappingKey(left));
        const rightEdited = editedMappingSet.has(mappingKey(right));
        if (leftEdited !== rightEdited) return leftEdited ? -1 : 1;
        const leftDraft = mappingDrafts[mappingKey(left)] ?? toMappingDraft(left);
        const rightDraft = mappingDrafts[mappingKey(right)] ?? toMappingDraft(right);
        const result = text(
          mappingColumnValue(left, mappingSortKey, leftDraft)
        ).localeCompare(
          text(mappingColumnValue(right, mappingSortKey, rightDraft)),
          "es",
          {
          numeric: true,
          sensitivity: "base",
          }
        );
        return mappingSortDirection === "asc" ? result : -result;
      });
  }, [
    mappingRows,
    mappingSearch,
    mappingDrafts,
    editedMappingSet,
    mappingColumnFilters,
    mappingSortKey,
    mappingSortDirection,
  ]);

  useEffect(() => {
    setMappingPage(1);
  }, [mappingSearch, mappingColumnFilters, mappingSortKey, mappingSortDirection]);

  const mappingTotalPages = Math.max(
    1,
    Math.ceil(filteredMappingRows.length / PAGE_SIZE)
  );
  const safeMappingPage = Math.min(mappingPage, mappingTotalPages);
  const mappingPageStart = (safeMappingPage - 1) * PAGE_SIZE;
  const visibleMappingRows = filteredMappingRows.slice(
    mappingPageStart,
    mappingPageStart + PAGE_SIZE
  );

  useEffect(() => {
    if (mappingPage > mappingTotalPages) setMappingPage(mappingTotalPages);
  }, [mappingPage, mappingTotalPages]);

  function onSort(column: EntryColumn) {
    setHasManualSort(true);
    if (sortKey === column.key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(column.key);
    setSortDirection("asc");
  }

  function applyColumnFilter(
    key: keyof CmEntryDateRow,
    filter: ExcelColumnFilter
  ) {
    setColumnFilters((current) => {
      const next = { ...current };
      if (excelFilterIsActive(filter)) next[key] = filter;
      else delete next[key];
      return next;
    });
    setPage(1);
  }

  function clearEntryFilters() {
    setColumnFilters({});
    setHasManualSort(false);
    setSortKey("lot");
    setSortDirection("asc");
    setShowEditedOnly(false);
    setPage(1);
  }

  function sortMapping(key: keyof RucConMapRow, direction: SortDirection) {
    setHasMappingManualSort(true);
    setMappingSortKey(key);
    setMappingSortDirection(direction);
    setMappingPage(1);
  }

  function applyMappingColumnFilter(
    key: keyof RucConMapRow,
    filter: ExcelColumnFilter
  ) {
    setMappingColumnFilters((current) => {
      const next = { ...current };
      if (excelFilterIsActive(filter)) next[key] = filter;
      else delete next[key];
      return next;
    });
    setMappingPage(1);
  }

  function clearMappingFilters() {
    setMappingColumnFilters({});
    setHasMappingManualSort(false);
    setMappingSortKey("ruc");
    setMappingSortDirection("asc");
    setMappingPage(1);
  }

  function updateEntryDate(lot: string, value: string) {
    setDraftDates((current) => ({ ...current, [lot]: value }));
    setEntrySaveErrors((current) => {
      if (!current[lot]) return current;
      const next = { ...current };
      delete next[lot];
      return next;
    });
    const error = entryDate2Error(
      value,
      entryRowsByLot.get(lot)?.entry_date,
      maximumEntryDate2
    );
    setMessage(error ? `ERROR: lote ${lot}: ${error}` : null);
  }

  async function saveEntries() {
    if (!editedLots.length || saving) return;

    const pendingPayloads = editedLots.map((lot) => {
      const row = entryRowsByLot.get(lot);
      const entryDate2 = dateText(draftDates[lot]) || null;
      const error = row
        ? entryDate2Error(entryDate2, row.entry_date, maximumEntryDate2)
        : "Lote no encontrado.";
      return { lot, entryDate2, entryDate: row?.entry_date, error };
    });
    const invalidPayloads = pendingPayloads.filter((payload) => payload.error);

    if (invalidPayloads.length) {
      const firstInvalid = invalidPayloads[0];
      setMessage(
        `ERROR: no se envió ningún dato. Corrige ${invalidPayloads.length} fila(s) inválida(s). Lote ${firstInvalid.lot}: ${firstInvalid.error}`
      );
      return;
    }
    setSaving(true);
    setMessage(null);
    const failedByLot: Record<string, string> = {};
    const { fulfilled, rejected } = await settleInChunks(
      pendingPayloads,
      async (payload) => {
        try {
          const response = (await apiPost(
            "/api/traceability/cm/entrydate/insert",
            {
              lot: payload.lot,
              entry_date_2: payload.entryDate2,
            }
          )) as SaveResponse;
          if (!response.ok) {
            throw new Error(response.error || "La API rechazó el guardado.");
          }
          return payload.lot;
        } catch (error) {
          const specificError = entrySaveErrorMessage(error);
          failedByLot[payload.lot] = specificError;
          throw new Error(`Lote ${payload.lot}: ${specificError}`);
        }
      }
    );

    setEntrySaveErrors((current) => {
      const next = { ...current };
      fulfilled.forEach((lot) => delete next[lot]);
      Object.entries(failedByLot).forEach(([lot, error]) => {
        next[lot] = error;
      });
      return next;
    });

    if (fulfilled.length) {
      const fulfilledSet = new Set(fulfilled);
      setOriginalDates((current) => {
        const next = { ...current };
        fulfilled.forEach((lot) => {
          next[lot] = dateText(draftDates[lot]);
        });
        return next;
      });
      setRows((current) =>
        current.map((row) => {
          const lot = rowLot(row);
          return fulfilledSet.has(lot)
            ? { ...row, entry_date_2: dateText(draftDates[lot]) || null }
            : row;
        })
      );
    }

    if (!rejected.length) {
      setMessage(`OK: se guardaron ${fulfilled.length} fila(s).`);
    } else if (fulfilled.length) {
      setMessage(
        `PARCIAL: guardadas ${fulfilled.length} fila(s). ${rejected.join(" | ")}`
      );
    } else {
      setMessage(`ERROR: no se pudo guardar ninguna fila. ${rejected.join(" | ")}`);
    }
    setSaving(false);
  }

  function openMapping() {
    setMappingOpen(true);
    setMappingSearch("");
    setMappingMessage(null);
    void loadMapping();
  }

  function updateMapping(key: string, field: keyof MappingDraft, value: string) {
    setMappingDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] ?? { office_name: "", zone_name: "", office_code: "" }), [field]: value },
    }));
    setMappingMessage(null);
  }

  async function saveMapping() {
    if (!editedMappingKeys.length || mappingSaving) return;
    setMappingSaving(true);
    setMappingMessage(null);

    const rowsByKey = new Map(mappingRows.map((row) => [mappingKey(row), row]));
    const { fulfilled, rejected } = await settleInChunks(
      editedMappingKeys,
      async (key) => {
        const row = rowsByKey.get(key);
        const draft = mappingDrafts[key];
        const ruc = text(row?.ruc).trim();
        const concessionCode = text(row?.concession_code).trim();
        if (!row || !draft || !ruc || !concessionCode) {
          throw new Error("Mapping sin RUC o código de concesión.");
        }

        const response = (await apiPost("/api/traceability/cm/ruccon-map/insert", {
          ruc,
          concession_code: concessionCode,
          office_name: optionalText(draft.office_name),
          zone_name: optionalText(draft.zone_name),
          office_code: optionalText(draft.office_code),
        })) as SaveResponse;
        if (!response.ok) {
          throw new Error(
            `${ruc} / ${concessionCode}: ${response.error || "no se pudo guardar"}`
          );
        }
        return key;
      }
    );

    if (fulfilled.length) {
      const fulfilledSet = new Set(fulfilled);
      setMappingOriginals((current) => {
        const next = { ...current };
        fulfilled.forEach((key) => {
          next[key] = { ...mappingDrafts[key] };
        });
        return next;
      });
      setMappingRows((current) =>
        current.map((row) => {
          const key = mappingKey(row);
          if (!fulfilledSet.has(key)) return row;
          const draft = mappingDrafts[key];
          return {
            ...row,
            office_name: optionalText(draft.office_name),
            zone_name: optionalText(draft.zone_name),
            office_code: optionalText(draft.office_code),
          };
        })
      );
    }

    if (!rejected.length) {
      setMappingMessage(`OK: se actualizaron ${fulfilled.length} mapping(s).`);
    } else if (fulfilled.length) {
      setMappingMessage(
        `PARCIAL: actualizados ${fulfilled.length} mapping(s). ${rejected.join(" | ")}`
      );
    } else {
      setMappingMessage(`ERROR: no se pudo actualizar ningún mapping. ${rejected.join(" | ")}`);
    }
    setMappingSaving(false);
  }

  const inputStyle: React.CSSProperties = {
    border: "1px solid rgba(216,238,255,.18)",
    background: "rgba(0,0,0,.10)",
    color: "white",
    fontWeight: 800,
    padding: "6px 8px",
    borderRadius: 8,
    outline: "none",
    fontSize: 12,
    lineHeight: "14px",
    boxSizing: "border-box",
    colorScheme: "dark",
  };

  const cellStyle: React.CSSProperties = {
    padding: "6px 8px",
    fontSize: 12,
    lineHeight: "16px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    boxSizing: "border-box",
    borderRight: "1px solid rgba(216,238,255,.10)",
    borderBottom: "1px solid rgba(216,238,255,.08)",
  };

  const messageSuccess = (value: string | null) =>
    Boolean(value?.startsWith("OK") || value?.startsWith("PARCIAL"));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "auto auto minmax(0, 1fr) auto",
        gap: 10,
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        className="panel-inner"
        style={{
          padding: "10px 12px",
          display: "flex",
          alignItems: "end",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ alignSelf: "center", fontWeight: 900 }}>Trazabilidad · CM Inputs</div>

        <button
          type="button"
          onClick={() => setShowEditedOnly((current) => !current)}
          style={{
            alignSelf: "center",
            padding: "6px 10px",
            borderRadius: 999,
            border: showEditedOnly
              ? "1px solid rgba(147,178,92,.90)"
              : "1px solid rgba(147,178,92,.45)",
            background: editedLots.length
              ? "rgba(94,128,25,.24)"
              : "rgba(255,255,255,.06)",
            color: editedLots.length ? "rgb(174,202,125)" : "rgba(255,255,255,.8)",
            fontSize: 12,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Editadas: {editedLots.length}
        </button>

        {invalidEditedLots.length ? (
          <div
            role="status"
            style={{
              alignSelf: "center",
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(216,93,39,.55)",
              background: "rgba(216,93,39,.18)",
              color: "rgb(255,178,143)",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            Inválidas: {invalidEditedLots.length}
          </div>
        ) : null}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800 }}>F. ingreso desde</span>
            <input
              type="date"
              value={dateFrom}
              min={entryDateBounds.min || undefined}
              max={dateTo || entryDateBounds.max || undefined}
              onChange={(event) => setDateFrom(event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800 }}>F. ingreso hasta</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || entryDateBounds.min || undefined}
              max={entryDateBounds.max || undefined}
              onChange={(event) => setDateTo(event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800 }}>Buscador global</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Lote, minero, RUC, concesión, placa..."
              style={{ ...inputStyle, minWidth: 270 }}
            />
          </label>

          <Button
            type="button"
            size="sm"
            onClick={clearEntryFilters}
            disabled={
              loading ||
              saving ||
              (!Object.keys(columnFilters).length && !hasManualSort && !showEditedOnly)
            }
          >
            Limpiar filtros
          </Button>
          <Button type="button" size="sm" onClick={() => void loadEntries()} disabled={loading || saving}>
            {loading ? "Cargando…" : "Refrescar"}
          </Button>
          <Button type="button" size="sm" onClick={openMapping} disabled={mappingSaving}>
            Actualizar mapeo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => void saveEntries()}
            disabled={
              loading || saving || editedLots.length === 0 || invalidEditedLots.length > 0
            }
            title={
              invalidEditedLots.length
                ? "Corrige las fechas inválidas antes de guardar."
                : undefined
            }
          >
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      {message ? (
        <div
          role={messageSuccess(message) ? "status" : "alert"}
          className="panel-inner"
          style={{
            padding: 10,
            border: messageSuccess(message)
              ? "1px solid rgba(62,180,137,.45)"
              : "1px solid rgba(216,93,39,.45)",
            background: messageSuccess(message)
              ? "rgba(62,180,137,.10)"
              : "rgba(216,93,39,.10)",
            fontWeight: 800,
          }}
        >
          {message}
        </div>
      ) : (
        <div style={{ display: "none" }} />
      )}

      <div
        className="panel-inner"
        style={{ minWidth: 0, minHeight: 0, overflow: "auto", padding: 0 }}
      >
        <div style={{ minWidth: "max-content" }}>
          <Table stickyHeader disableScrollWrapper>
            <colgroup>
              {ENTRY_COLUMNS.map((column) => (
                <col key={column.key} style={{ width: column.width, minWidth: column.width, maxWidth: column.width }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {ENTRY_COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    className="capex-th"
                    tabIndex={0}
                    aria-sort={hasManualSort && sortKey === column.key ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    onClick={() => onSort(column)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSort(column);
                      }
                    }}
                    style={{
                      padding: "8px",
                      width: column.width,
                      minWidth: column.width,
                      maxWidth: column.width,
                      background: "rgb(6,77,121)",
                      borderRight: "1px solid rgba(216,238,255,.14)",
                      textAlign: column.kind === "number" ? "right" : "left",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 5 }}>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {column.label}
                        {hasManualSort && sortKey === column.key
                          ? sortDirection === "asc"
                            ? " ↑"
                            : " ↓"
                          : ""}
                      </span>
                      <ExcelHeaderFilter
                        label={column.label}
                        kind={column.kind}
                        values={entryExcelColumnValues[column.key] ?? []}
                        filter={columnFilters[column.key]}
                        sortDirection={
                          hasManualSort && sortKey === column.key
                            ? sortDirection
                            : undefined
                        }
                        onApply={(filter) => applyColumnFilter(column.key, filter)}
                        onSort={(direction) => {
                          setHasManualSort(true);
                          setSortKey(column.key);
                          setSortDirection(direction);
                          setPage(1);
                        }}
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const lot = rowLot(row);
                const edited = editedLotSet.has(lot);
                const dateError = entryDate2Errors.get(lot);
                return (
                  <tr key={lot} className="capex-tr">
                    {ENTRY_COLUMNS.map((column) => (
                      <td
                        key={column.key}
                        className={`capex-td${column.key === "lot" ? " capex-td-strong" : ""}`}
                        title={column.key === "entry_date_2" ? undefined : text(row[column.key])}
                        style={{
                          ...cellStyle,
                          background: dateError
                            ? "rgba(216,93,39,.25)"
                            : edited
                              ? "rgba(94,128,25,.28)"
                              : "rgba(0,0,0,.10)",
                          textAlign: column.kind === "number" ? "right" : "left",
                        }}
                      >
                        {column.key === "entry_date_2" ? (
                          <input
                            type="date"
                            value={draftDates[lot] ?? ""}
                            min={dateText(row.entry_date) || undefined}
                            max={maximumEntryDate2}
                            onChange={(event) => updateEntryDate(lot, event.target.value)}
                            disabled={loading || saving || !lot}
                            aria-label={`Fecha de ingreso 2 del lote ${lot}`}
                            aria-invalid={Boolean(dateError)}
                            title={
                              dateError ??
                              `Rango permitido: ${displayDate(row.entry_date)} a ${displayDate(maximumEntryDate2)}`
                            }
                            style={{
                              ...inputStyle,
                              width: "100%",
                              minWidth: 0,
                              borderColor: dateError ? "rgba(216,93,39,.90)" : undefined,
                              background: dateError ? "rgba(216,93,39,.12)" : undefined,
                            }}
                          />
                        ) : (
                          displayValue(row[column.key], column.kind)
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}

              {!loading && visibleRows.length === 0 ? (
                <tr className="capex-tr">
                  <td className="capex-td" colSpan={ENTRY_COLUMNS.length} style={{ ...cellStyle, fontWeight: 900 }}>
                    No hay filas para el filtro seleccionado.
                  </td>
                </tr>
              ) : null}

              {loading ? (
                <tr className="capex-tr">
                  <td className="capex-td" colSpan={ENTRY_COLUMNS.length} style={{ ...cellStyle, fontWeight: 900 }}>
                    Cargando CM Inputs…
                  </td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </div>

      <div
        className="panel-inner"
        style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}
      >
        <div style={{ fontSize: 12, fontWeight: 800 }}>
          Mostrando {filteredRows.length ? pageStart + 1 : 0} - {Math.min(pageStart + PAGE_SIZE, filteredRows.length)} de {filteredRows.length} filas
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button type="button" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || safePage <= 1}>←</Button>
          <div style={{ minWidth: 90, textAlign: "center", fontSize: 12, fontWeight: 900, padding: "6px 10px", borderRadius: 999, background: "rgba(255,255,255,.06)", border: "1px solid rgba(216,238,255,.18)" }}>
            Página {safePage} / {totalPages}
          </div>
          <Button type="button" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={loading || safePage >= totalPages}>→</Button>
        </div>
      </div>

      {mappingOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cm-mapping-title"
          style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,.58)" }}
        >
          <div
            className="panel-inner"
            style={{ width: "min(1050px, 96vw)", height: "min(86vh, 820px)", display: "grid", gridTemplateRows: "auto auto auto minmax(0, 1fr) auto", gap: 12, padding: 14, overflow: "hidden" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div id="cm-mapping-title" style={{ fontSize: 18, fontWeight: 900 }}>Actualizar mapeo CM</div>
                <div style={{ fontSize: 12, opacity: .82 }}>RUC y código de concesión identifican el registro; oficina, zona y código de oficina son editables.</div>
              </div>
              <Button type="button" size="sm" onClick={() => setMappingOpen(false)} disabled={mappingSaving}>Cerrar</Button>
            </div>

            <div style={{ display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap" }}>
              <label style={{ display: "grid", gap: 4, flex: "1 1 320px" }}>
                <span style={{ fontSize: 11, fontWeight: 800 }}>Buscador global</span>
                <input type="search" value={mappingSearch} onChange={(event) => setMappingSearch(event.target.value)} placeholder="RUC, concesión, oficina, zona..." style={{ ...inputStyle, width: "100%" }} />
              </label>
              <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(147,178,92,.45)", background: editedMappingKeys.length ? "rgba(94,128,25,.24)" : "rgba(255,255,255,.06)", color: editedMappingKeys.length ? "rgb(174,202,125)" : "rgba(255,255,255,.8)", fontSize: 12, fontWeight: 900 }}>
                Editadas: {editedMappingKeys.length}
              </div>
              <Button
                type="button"
                size="sm"
                onClick={clearMappingFilters}
                disabled={
                  mappingLoading ||
                  mappingSaving ||
                  (!Object.keys(mappingColumnFilters).length && !hasMappingManualSort)
                }
              >
                Limpiar filtros
              </Button>
              <Button type="button" size="sm" onClick={() => void loadMapping()} disabled={mappingLoading || mappingSaving}>{mappingLoading ? "Cargando…" : "Refrescar"}</Button>
            </div>

            {mappingMessage ? (
              <div role={messageSuccess(mappingMessage) ? "status" : "alert"} style={{ padding: 10, borderRadius: 10, border: messageSuccess(mappingMessage) ? "1px solid rgba(62,180,137,.45)" : "1px solid rgba(216,93,39,.45)", background: messageSuccess(mappingMessage) ? "rgba(62,180,137,.10)" : "rgba(216,93,39,.10)", fontWeight: 800 }}>
                {mappingMessage}
              </div>
            ) : (
              <div style={{ fontSize: 12, fontWeight: 800, opacity: .82 }}>Solo se enviarán las filas modificadas.</div>
            )}

            <div style={{ minWidth: 0, minHeight: 0, overflow: "auto", border: "1px solid rgba(216,238,255,.12)", borderRadius: 12 }}>
              <Table stickyHeader disableScrollWrapper>
                <colgroup>
                  {MAPPING_COLUMNS.map((column) => <col key={column.key} style={{ width: column.width, minWidth: column.width, maxWidth: column.width }} />)}
                </colgroup>
                <thead>
                  <tr>
                    {MAPPING_COLUMNS.map((column) => (
                      <th
                        key={column.key}
                        className="capex-th"
                        aria-sort={
                          hasMappingManualSort && mappingSortKey === column.key
                            ? mappingSortDirection === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        style={{ top: 0, zIndex: 20, width: column.width, background: "rgb(6,77,121)", padding: 9, borderRight: "1px solid rgba(216,238,255,.14)" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 5 }}>
                          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {column.label}
                            {hasMappingManualSort && mappingSortKey === column.key
                              ? mappingSortDirection === "asc"
                                ? " ↑"
                                : " ↓"
                              : ""}
                          </span>
                          <ExcelHeaderFilter
                            label={column.label}
                            kind="text"
                            values={mappingExcelColumnValues[column.key] ?? []}
                            filter={mappingColumnFilters[column.key]}
                            sortDirection={
                              hasMappingManualSort && mappingSortKey === column.key
                                ? mappingSortDirection
                                : undefined
                            }
                            onApply={(filter) => applyMappingColumnFilter(column.key, filter)}
                            onSort={(direction) => sortMapping(column.key, direction)}
                          />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleMappingRows.map((row) => {
                    const key = mappingKey(row);
                    const draft = mappingDrafts[key] ?? toMappingDraft(row);
                    const edited = editedMappingSet.has(key);
                    return (
                      <tr key={key} className="capex-tr">
                        {MAPPING_COLUMNS.map((column) => (
                          <td key={column.key} className={`capex-td${!column.editable ? " capex-td-strong" : ""}`} style={{ ...cellStyle, background: edited ? "rgba(94,128,25,.28)" : "rgba(0,0,0,.10)" }}>
                            {column.editable ? (
                              <input
                                type="text"
                                value={draft[column.key as keyof MappingDraft]}
                                maxLength={column.maxLength}
                                onChange={(event) => updateMapping(key, column.key as keyof MappingDraft, event.target.value)}
                                disabled={mappingLoading || mappingSaving}
                                aria-label={`${column.label} para ${text(row.ruc)} / ${text(row.concession_code)}`}
                                style={{ ...inputStyle, width: "100%", minWidth: 0 }}
                              />
                            ) : (
                              <span title={text(row[column.key])}>{text(row[column.key]).trim() || "—"}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}

                  {!mappingLoading && visibleMappingRows.length === 0 ? (
                    <tr className="capex-tr"><td className="capex-td" colSpan={MAPPING_COLUMNS.length} style={{ ...cellStyle, fontWeight: 900 }}>No hay mappings para el filtro seleccionado.</td></tr>
                  ) : null}
                  {mappingLoading ? (
                    <tr className="capex-tr"><td className="capex-td" colSpan={MAPPING_COLUMNS.length} style={{ ...cellStyle, fontWeight: 900 }}>Cargando mapping…</td></tr>
                  ) : null}
                </tbody>
              </Table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800 }}>Mostrando {filteredMappingRows.length ? mappingPageStart + 1 : 0} - {Math.min(mappingPageStart + PAGE_SIZE, filteredMappingRows.length)} de {filteredMappingRows.length}</span>
                <Button type="button" size="sm" onClick={() => setMappingPage((current) => Math.max(1, current - 1))} disabled={mappingLoading || safeMappingPage <= 1}>←</Button>
                <span style={{ fontSize: 12, fontWeight: 900 }}>Página {safeMappingPage} / {mappingTotalPages}</span>
                <Button type="button" size="sm" onClick={() => setMappingPage((current) => Math.min(mappingTotalPages, current + 1))} disabled={mappingLoading || safeMappingPage >= mappingTotalPages}>→</Button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button type="button" size="sm" onClick={() => setMappingOpen(false)} disabled={mappingSaving}>Cancelar</Button>
                <Button type="button" size="sm" variant="primary" onClick={() => void saveMapping()} disabled={mappingLoading || mappingSaving || editedMappingKeys.length === 0}>{mappingSaving ? "Guardando…" : "Guardar"}</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
