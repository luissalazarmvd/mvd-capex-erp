"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";
import { FastCellInput } from "./FastCellInput";

type CatalogueRow = {
  asset_code: string | null;
  source_name: string | null;
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

  applied_rate_pct: number | string | null;

  asset_base_value_usd: number | string | null;
  asset_base_value_pen: number | string | null;

  acquisition_var_usd: number | string | null;
  disposal_var_usd: number | string | null;
  reclass_var_usd: number | string | null;
  adjustment_var_usd: number | string | null;

  acquisition_var_pen: number | string | null;
  disposal_var_pen: number | string | null;
  reclass_var_pen: number | string | null;
  adjustment_var_pen: number | string | null;

  asset_final_value_usd: number | string | null;
  asset_final_value_pen: number | string | null;

  depreciation_base_usd: number | string | null;
  depreciation_base_pen: number | string | null;

  reclass_depr_usd: number | string | null;
  adjustment_depr_usd: number | string | null;
  disposal_depr_usd: number | string | null;

  reclass_depr_pen: number | string | null;
  adjustment_depr_pen: number | string | null;
  disposal_depr_pen: number | string | null;

  depreciation_amount_usd: number | string | null;
  depreciation_amount_pen: number | string | null;

  depreciation_cum_amount_usd: number | string | null;
  depreciation_cum_amount_pen: number | string | null;

  asset_balance_usd: number | string | null;
  asset_balance_pen: number | string | null;

  deprec_rate_pct: number | string | null;
  exc_rate: number | string | null;
  asset_ini_cost_pen: number | string | null;
  asset_ini_cost_usd: number | string | null;
  depreciation_method: string | null;
  asset_situation: string | null;
  asset_comment: string | null;
};

type DeprRow = {
  asset_code: string | null;
  source_name: string | null;
  period_date: string | null;
  depreciation_amount_usd: number | string | null;
  depreciation_amount_pen: number | string | null;
};

type VetaVrRow = {
  asset_code: string | null;
  map_type: string | null;
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
  debit_credit: string | null;
  usd_amount: number | string | null;
  pen_amount: number | string | null;
};

type MonthlyDeprecCurrency = "usd" | "pen";
type MonthlyDeprecKey = `monthly_depr_${string}_${MonthlyDeprecCurrency}`;
type CatalogueColumnKey = keyof CatalogueRow | MonthlyDeprecKey;

type CatalogueDisplayRow = CatalogueRow &
  Partial<Record<MonthlyDeprecKey, number | string | null>>;

type CatalogueColumn = {
  key: CatalogueColumnKey;
  label: string;
  width: number;
};

type CecoRow = {
  cost_center_code: string | null;
  cost_center_description: string | null;
};

type AccountRow = {
  account_code: string | null;
  account_description: string | null;
};

type MappingRow = {
  origin_account_code: string | null;
  account_group: string | null;
  account_denom: string | null;
  deprec_acc_code_fir: string | null;
  deprec_acc_code_sec: string | null;
  deprec_rate_pct: number | string | null;
  asset_type: string | null;
  correlative_start: string | null;
};

type ReclassDraft = {
  origin_account_code: string;
  capex_code: string;
  asset_description: string;
  cost_center_code: string;
  acquisition_date: string;
  location_name: string;
  assigned_to: string;
  area_name: string;
  brand: string;
  model: string;
  serial_number: string;
  color: string;
  depreciation_method: string;
  asset_situation: string;
  asset_comment: string;
};

type MappingDraft = { deprec_rate_pct: string };

const EDITABLE = [
  "location_name", "capex_code", "asset_description", "asset_type", "assigned_to",
  "area_name", "brand", "model", "serial_number", "color", "cost_center_code",
  "acquisition_date", "operation_date", "disposal_date", "exc_rate",
  "asset_ini_cost_pen", "asset_ini_cost_usd", "depreciation_method", "asset_situation", "asset_comment",
] as const satisfies readonly (keyof CatalogueRow)[];
type EditableKey = (typeof EDITABLE)[number];
type Draft = Record<EditableKey, string>;

type ExcelFilterKind = "text" | "number" | "date";
type ExcelSortDirection = "asc" | "desc";
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

const EMPTY_EXCEL_FILTER: ExcelColumnFilter = {
  selected: null,
  operator: "none",
  value1: "",
  value2: "",
};

const DATE_FIELDS = new Set<EditableKey>(["acquisition_date", "operation_date", "disposal_date"]);
const NUMBER_FIELDS = new Set<EditableKey>(["exc_rate", "asset_ini_cost_pen", "asset_ini_cost_usd"]);
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

const PAGE_SIZE = 100;

const COLUMNS_BEFORE_MONTHLY: CatalogueColumn[] = [
  { key: "asset_code", label: "COD", width: 105 },
  { key: "source_name", label: "Origen", width: 90 },
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

  { key: "applied_rate_pct", label: "Tasa", width: 100 },

  { key: "asset_base_value_usd", label: "Valor base USD", width: 145 },
  { key: "asset_base_value_pen", label: "Valor base PEN", width: 145 },

  { key: "acquisition_var_usd", label: "Var. adquis. USD", width: 145 },
  { key: "disposal_var_usd", label: "Var. baja USD", width: 135 },
  { key: "reclass_var_usd", label: "Var. reclas. USD", width: 145 },
  { key: "adjustment_var_usd", label: "Var. ajuste USD", width: 145 },

  { key: "acquisition_var_pen", label: "Var. adquis. PEN", width: 145 },
  { key: "disposal_var_pen", label: "Var. baja PEN", width: 135 },
  { key: "reclass_var_pen", label: "Var. reclas. PEN", width: 145 },
  { key: "adjustment_var_pen", label: "Var. ajuste PEN", width: 145 },

  { key: "asset_final_value_usd", label: "Valor final USD", width: 145 },
  { key: "asset_final_value_pen", label: "Valor final PEN", width: 145 },

  { key: "depreciation_base_usd", label: "Deprec. base USD", width: 145 },
  { key: "depreciation_base_pen", label: "Deprec. base PEN", width: 145 },

  { key: "reclass_depr_usd", label: "Depr. reclas. USD", width: 145 },
  { key: "adjustment_depr_usd", label: "Depr. ajuste USD", width: 145 },
  { key: "disposal_depr_usd", label: "Depr. baja USD", width: 135 },

  { key: "reclass_depr_pen", label: "Depr. reclas. PEN", width: 145 },
  { key: "adjustment_depr_pen", label: "Depr. ajuste PEN", width: 145 },
  { key: "disposal_depr_pen", label: "Depr. baja PEN", width: 135 },
];

const COLUMNS_AFTER_MONTHLY: CatalogueColumn[] = [
  { key: "depreciation_amount_usd", label: "Depr. año USD", width: 145 },
  { key: "depreciation_amount_pen", label: "Depr. año PEN", width: 145 },

  { key: "depreciation_cum_amount_usd", label: "Depr. acum. USD", width: 155 },
  { key: "depreciation_cum_amount_pen", label: "Depr. acum. PEN", width: 155 },

  { key: "asset_balance_usd", label: "Saldo USD", width: 135 },
  { key: "asset_balance_pen", label: "Saldo PEN", width: 135 },

  { key: "deprec_rate_pct", label: "Tasa deprec.", width: 120 },
  { key: "exc_rate", label: "T.C.", width: 110 },
  { key: "asset_ini_cost_pen", label: "Costo inicial PEN (S/)", width: 155 },
  { key: "asset_ini_cost_usd", label: "Costo inicial USD ($)", width: 155 },
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

function excelOperatorOptions(kind: ExcelFilterKind): Array<{ value: ExcelFilterOperator; label: string }> {
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

function excelFilterIsActive(filter: ExcelColumnFilter | undefined) {
  return Boolean(filter && (filter.selected !== null || filter.operator !== "none"));
}

function matchesExcelFilter(rawValue: unknown, filter: ExcelColumnFilter | undefined, kind: ExcelFilterKind) {
  if (!filter) return true;

  const value = rawValue == null ? "" : String(rawValue).trim();

  if (filter.selected !== null && !filter.selected.includes(value)) return false;
  if (filter.operator === "none") return true;

  const first = filter.value1.trim();
  const second = filter.value2.trim();

  if (!first && filter.operator !== "between") return true;

  if (kind === "text") {
    const current = value.toLocaleLowerCase("es");
    const a = first.toLocaleLowerCase("es");

    if (filter.operator === "equals") return current === a;
    if (filter.operator === "not_equals") return current !== a;
    if (filter.operator === "contains") return current.includes(a);
    if (filter.operator === "not_contains") return !current.includes(a);
    if (filter.operator === "starts_with") return current.startsWith(a);
    if (filter.operator === "ends_with") return current.endsWith(a);

    return true;
  }

  if (kind === "number") {
    const current = Number(value.replace(",", "."));
    const a = Number(first.replace(",", "."));
    const b = Number(second.replace(",", "."));

    if (!Number.isFinite(current) || !Number.isFinite(a)) return false;

    if (filter.operator === "equals") return current === a;
    if (filter.operator === "not_equals") return current !== a;
    if (filter.operator === "greater") return current > a;
    if (filter.operator === "greater_equal") return current >= a;
    if (filter.operator === "less") return current < a;
    if (filter.operator === "less_equal") return current <= a;

    if (filter.operator === "between") {
      return Number.isFinite(b)
        && current >= Math.min(a, b)
        && current <= Math.max(a, b);
    }

    return true;
  }

  const current = value.slice(0, 10);
  const a = first.slice(0, 10);
  const b = second.slice(0, 10);

  if (!current || !a) return false;

  if (filter.operator === "equals") return current === a;
  if (filter.operator === "not_equals") return current !== a;
  if (filter.operator === "greater") return current > a;
  if (filter.operator === "greater_equal") return current >= a;
  if (filter.operator === "less") return current < a;
  if (filter.operator === "less_equal") return current <= a;

  if (filter.operator === "between") {
    return Boolean(b)
      && current >= (a < b ? a : b)
      && current <= (a > b ? a : b);
  }

  return true;
}

function compareExcelValues(
  aRaw: unknown,
  bRaw: unknown,
  kind: ExcelFilterKind,
  direction: ExcelSortDirection
) {
  const factor = direction === "asc" ? 1 : -1;
  const a = aRaw == null ? "" : String(aRaw).trim();
  const b = bRaw == null ? "" : String(bRaw).trim();

  if (kind === "number") {
    const aNum = Number(a.replace(",", "."));
    const bNum = Number(b.replace(",", "."));

    if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
      return (aNum - bNum) * factor;
    }
  }

  return a.localeCompare(b, "es", {
    numeric: true,
    sensitivity: "base",
  }) * factor;
}

type ExcelHeaderFilterProps = {
  label: string;
  kind: ExcelFilterKind;
  values: string[];
  filter?: ExcelColumnFilter;
  sortDirection?: ExcelSortDirection;
  onApply: (filter: ExcelColumnFilter) => void;
  onSort: (direction: ExcelSortDirection) => void;
};

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
  const [draftFilter, setDraftFilter] = useState<ExcelColumnFilter>(
    () => filter || EMPTY_EXCEL_FILTER
  );

  useEffect(() => {
    if (!open) return;

    setSearch("");
    setDraftFilter(
      filter
        ? {
            ...filter,
            selected: filter.selected ? [...filter.selected] : null,
          }
        : { ...EMPTY_EXCEL_FILTER }
    );
  }, [open, filter]);

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target)
        && !popupRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const updatePopupPosition = useCallback(() => {
    const anchor = rootRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 4;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const popupWidth = Math.min(285, Math.max(0, viewportWidth - viewportPadding * 2));
    const maxPopupHeight = Math.max(240, viewportHeight - viewportPadding * 2);
    const preferredPopupHeight = Math.min(520, maxPopupHeight);

    const top = Math.max(
      viewportPadding,
      Math.min(
        rect.bottom + gap,
        viewportHeight - preferredPopupHeight - viewportPadding
      )
    );

    const left = Math.min(
      Math.max(viewportPadding, rect.right - popupWidth),
      Math.max(viewportPadding, viewportWidth - popupWidth - viewportPadding)
    );

    setPopupPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!open) {
      setPopupPosition(null);
      return;
    }

    updatePopupPosition();

    const reposition = () => updatePopupPosition();

    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, updatePopupPosition]);

  const distinctValues = useMemo(
    () =>
      Array.from(
        new Set(values.map((value) => value.trim()))
      ).sort((a, b) => {
        if (a === "") return -1;
        if (b === "") return 1;

        if (kind === "number") {
          const aNum = Number(a.replace(",", "."));
          const bNum = Number(b.replace(",", "."));

          if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
            return aNum - bNum;
          }
        }

        return a.localeCompare(b, "es", {
          numeric: true,
          sensitivity: "base",
        });
      }),
    [values, kind]
  );

  const searchedValues = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("es");

    if (!needle) return distinctValues;

    return distinctValues.filter((value) =>
      (value || "(Vacíos)")
        .toLocaleLowerCase("es")
        .includes(needle)
    );
  }, [distinctValues, search]);

  const selectedSet = useMemo(
    () =>
      new Set(
        draftFilter.selected === null
          ? distinctValues
          : draftFilter.selected
      ),
    [draftFilter.selected, distinctValues]
  );

  const allSelected =
    distinctValues.length > 0
    && distinctValues.every((value) => selectedSet.has(value));

  const active =
    excelFilterIsActive(filter)
    || Boolean(sortDirection);

  const firstInputType =
    kind === "date"
      ? "date"
      : kind === "number"
        ? "number"
        : "text";

  function toggleValue(value: string, checked: boolean) {
    const next = new Set(
      draftFilter.selected === null
        ? distinctValues
        : draftFilter.selected
    );

    if (checked) next.add(value);
    else next.delete(value);

    setDraftFilter((current) => ({
      ...current,
      selected:
        next.size === distinctValues.length
          ? null
          : Array.from(next),
    }));
  }

  function toggleAll(checked: boolean) {
    setDraftFilter((current) => ({
      ...current,
      selected: checked ? null : [],
    }));
  }

  return (
    <div
      ref={rootRef}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
        }}
        aria-label={`Filtrar ${label}`}
        title={`Filtrar ${label}`}
        style={{
          width: 20,
          height: 20,
          padding: 0,
          borderRadius: 5,
          border: active
            ? "1px solid rgba(147,211,230,.72)"
            : "1px solid rgba(147,211,230,.30)",
          background: active
            ? "rgba(27,147,227,.32)"
            : "rgba(2,35,52,.34)",
          color: "#eaf8ff",
          fontSize: 10,
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        {active ? "◆" : "▼"}
      </button>

      {open && popupPosition ? createPortal(
        <div
          ref={popupRef}
          style={{
            position: "fixed",
            top: popupPosition.top,
            left: popupPosition.left,
            zIndex: 10000,
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
          <div style={{ fontWeight: 900, marginBottom: 8 }}>
            {label}
          </div>

          <div
            style={{
              display: "grid",
              gap: 6,
              marginBottom: 8,
            }}
          >
            <button
              type="button"
              onClick={() => {
                onSort("asc");
                setOpen(false);
              }}
              style={{
                textAlign: "left",
                padding: "6px 8px",
                borderRadius: 7,
                border: "1px solid rgba(147,211,230,.24)",
                background:
                  sortDirection === "asc"
                    ? "rgba(27,147,227,.24)"
                    : "rgba(2,35,52,.38)",
                color: "#f4fbff",
                cursor: "pointer",
              }}
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
                setOpen(false);
              }}
              style={{
                textAlign: "left",
                padding: "6px 8px",
                borderRadius: 7,
                border: "1px solid rgba(147,211,230,.24)",
                background:
                  sortDirection === "desc"
                    ? "rgba(27,147,227,.24)"
                    : "rgba(2,35,52,.38)",
                color: "#f4fbff",
                cursor: "pointer",
              }}
            >
              {kind === "number"
                ? "Ordenar de mayor a menor"
                : kind === "date"
                  ? "Ordenar de más reciente a más antiguo"
                  : "Ordenar de Z a A"}
            </button>
          </div>

          <div
            style={{
              borderTop: "1px solid rgba(147,211,230,.18)",
              paddingTop: 8,
            }}
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar valores..."
              style={{
                width: "100%",
                height: 30,
                padding: "5px 8px",
                borderRadius: 7,
                border: "1px solid rgba(147,211,230,.30)",
                background: "rgba(2,35,52,.58)",
                color: "#f4fbff",
                outline: "none",
              }}
            />

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                marginTop: 8,
                fontWeight: 800,
              }}
            >
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => toggleAll(event.target.checked)}
              />
              Seleccionar todo
            </label>

            <div
              style={{
                maxHeight: 155,
                overflowY: "auto",
                marginTop: 5,
                paddingRight: 3,
              }}
            >
              {searchedValues.map((value) => (
                <label
                  key={value || "__EMPTY__"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "3px 0",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedSet.has(value)}
                    onChange={(event) =>
                      toggleValue(value, event.target.checked)
                    }
                  />

                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {value || "(Vacíos)"}
                  </span>
                </label>
              ))}

              {!searchedValues.length ? (
                <div style={{ padding: "8px 0", opacity: 0.72 }}>
                  Sin coincidencias
                </div>
              ) : null}
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid rgba(147,211,230,.18)",
              marginTop: 8,
              paddingTop: 8,
              display: "grid",
              gap: 6,
            }}
          >
            <select
              value={draftFilter.operator}
              onChange={(event) =>
                setDraftFilter((current) => ({
                  ...current,
                  operator: event.target.value as ExcelFilterOperator,
                }))
              }
              style={{
                width: "100%",
                height: 30,
                padding: "4px 7px",
                borderRadius: 7,
                border: "1px solid rgba(147,211,230,.30)",
                background: "#0b4d6b",
                color: "#f4fbff",
              }}
            >
              {excelOperatorOptions(kind).map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>

            {draftFilter.operator !== "none" ? (
              <input
                type={firstInputType}
                value={draftFilter.value1}
                step={kind === "number" ? "any" : undefined}
                onChange={(event) =>
                  setDraftFilter((current) => ({
                    ...current,
                    value1: event.target.value,
                  }))
                }
                placeholder={
                  kind === "text"
                    ? "Valor..."
                    : undefined
                }
                style={{
                  width: "100%",
                  height: 30,
                  padding: "5px 8px",
                  borderRadius: 7,
                  border: "1px solid rgba(147,211,230,.30)",
                  background: "rgba(2,35,52,.58)",
                  color: "#f4fbff",
                  outline: "none",
                }}
              />
            ) : null}

            {draftFilter.operator === "between" ? (
              <input
                type={firstInputType}
                value={draftFilter.value2}
                step={kind === "number" ? "any" : undefined}
                onChange={(event) =>
                  setDraftFilter((current) => ({
                    ...current,
                    value2: event.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  height: 30,
                  padding: "5px 8px",
                  borderRadius: 7,
                  border: "1px solid rgba(147,211,230,.30)",
                  background: "rgba(2,35,52,.58)",
                  color: "#f4fbff",
                  outline: "none",
                }}
              />
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 6,
              marginTop: 10,
            }}
          >
            <button
              type="button"
              onClick={() => {
                onApply({ ...EMPTY_EXCEL_FILTER });
                setOpen(false);
              }}
              style={{
                padding: "6px 8px",
                borderRadius: 7,
                border: "1px solid rgba(147,211,230,.24)",
                background: "transparent",
                color: "#d8eef8",
                cursor: "pointer",
              }}
            >
              Limpiar filtro
            </button>

            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  padding: "6px 8px",
                  borderRadius: 7,
                  border: "1px solid rgba(147,211,230,.24)",
                  background: "transparent",
                  color: "#d8eef8",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => {
                  onApply(draftFilter);
                  setOpen(false);
                }}
                style={{
                  padding: "6px 10px",
                  borderRadius: 7,
                  border: "1px solid rgba(147,211,230,.42)",
                  background: "rgba(27,147,227,.32)",
                  color: "#f4fbff",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}

function dateOnly(value: unknown) {
  return text(value).slice(0, 10);
}

function currentLimaAccountingPeriod() {
  const parts = new Intl.DateTimeFormat("en-CA", {
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

function currentLimaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  return year && month && day ? `${year}-${month}-${day}` : "";
}

function firstDayNextMonth(value: unknown) {
  const match = dateOnly(value).match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

function emptyReclassDraft(): ReclassDraft {
  return {
    origin_account_code: "",
    capex_code: "",
    asset_description: "",
    cost_center_code: "",
    acquisition_date: "",
    location_name: "",
    assigned_to: "",
    area_name: "",
    brand: "",
    model: "",
    serial_number: "",
    color: "",
    depreciation_method: "",
    asset_situation: "OPERATIVO",
    asset_comment: "",
  };
}

function decimalDraft(value: string, maxIntegerDigits: number, maxDecimals = 6) {
  const normalized = value.replace(",", ".").replace(/[^0-9.-]/g, "");
  const negative = normalized.startsWith("-");
  const unsigned = normalized.replace(/-/g, "");
  const dotIndex = unsigned.indexOf(".");
  const integerPart = (dotIndex >= 0 ? unsigned.slice(0, dotIndex) : unsigned).slice(0, maxIntegerDigits);
  const decimalPart = dotIndex >= 0
    ? unsigned.slice(dotIndex + 1).replace(/\./g, "").slice(0, maxDecimals)
    : "";
  return `${negative ? "-" : ""}${integerPart}${dotIndex >= 0 ? "." : ""}${decimalPart}`;
}

function validOptionalNumber(value: string, maxIntegerDigits: number) {
  const clean = value.trim();
  if (!clean) return true;
  const pattern = new RegExp(`^-?(?:\\d{1,${maxIntegerDigits}}(?:\\.\\d{0,6})?|\\.\\d{1,6})$`);
  return pattern.test(clean) && Number.isFinite(Number(clean));
}

function numericIntegerDigits(key: EditableKey) {
  return key === "exc_rate" ? 12 : 14;
}

function twoDecimals(value: unknown) {
  const clean = text(value).trim();
  if (!clean) return "";
  const parsed = Number(clean.replace(",", "."));
  return Number.isFinite(parsed) ? parsed.toFixed(2) : clean;
}

function isCurrencyAmountColumn(key: CatalogueColumnKey) {
  const normalized = String(key).toLowerCase();

  return (
    isMonthlyDeprecKey(key)
    || normalized.endsWith("_usd")
    || normalized.endsWith("_pen")
  );
}

function numericAmount(value: unknown) {
  const clean = text(value).trim().replace(/,/g, "");
  if (!clean) return 0;

  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAmountTotal(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function catalogueColumnBodyBackground(columnIndex: number) {
  return columnIndex % 2 === 0
    ? "#0b4d6b"
    : "#115b78";
}

function catalogueColumnHeaderBackground(columnIndex: number) {
  return columnIndex % 2 === 0
    ? "#163b49"
    : "#1c4d5e";
}

function upperOrNull(value: string) {
  const clean = value.trim();
  return clean ? clean.toLocaleUpperCase("es") : null;
}

function costCenterCode(value: string) {
  const raw = value.trim().split(/\s+-\s+/, 1)[0] || "";
  return raw.toLocaleUpperCase("es").replace(/[^0-9A-Z]/g, "").slice(0, 6);
}

const CATALOGUE_DATE_FILTER_FIELDS = new Set<CatalogueColumnKey>([
  "acquisition_date",
  "operation_date",
  "disposal_date",
]);

const CATALOGUE_NUMBER_FILTER_FIELDS = new Set<CatalogueColumnKey>([
  "applied_rate_pct",
  "asset_base_value_usd",
  "asset_base_value_pen",
  "acquisition_var_usd",
  "disposal_var_usd",
  "reclass_var_usd",
  "adjustment_var_usd",
  "acquisition_var_pen",
  "disposal_var_pen",
  "reclass_var_pen",
  "adjustment_var_pen",
  "asset_final_value_usd",
  "asset_final_value_pen",
  "depreciation_base_usd",
  "depreciation_base_pen",
  "reclass_depr_usd",
  "adjustment_depr_usd",
  "disposal_depr_usd",
  "reclass_depr_pen",
  "adjustment_depr_pen",
  "disposal_depr_pen",
  "depreciation_amount_usd",
  "depreciation_amount_pen",
  "depreciation_cum_amount_usd",
  "depreciation_cum_amount_pen",
  "asset_balance_usd",
  "asset_balance_pen",
  "deprec_rate_pct",
  "exc_rate",
  "asset_ini_cost_pen",
  "asset_ini_cost_usd",
]);

function isMonthlyDeprecKey(key: CatalogueColumnKey): key is MonthlyDeprecKey {
  return /^monthly_depr_\d{4}_\d{2}_(usd|pen)$/.test(String(key));
}

function catalogueExcelFilterKind(key: CatalogueColumnKey): ExcelFilterKind {
  if (isMonthlyDeprecKey(key)) {
    return "number";
  }

  if (CATALOGUE_DATE_FILTER_FIELDS.has(key)) {
    return "date";
  }

  if (CATALOGUE_NUMBER_FILTER_FIELDS.has(key)) {
    return "number";
  }

  return "text";
}

function catalogueExcelFilterValue(
  row: CatalogueDisplayRow,
  draft: Draft,
  key: CatalogueColumnKey,
  cecoByCode: Record<string, string>
) {
  if (key === "cost_center_code") {
    return costCenterCode(draft.cost_center_code);
  }

  if (key === "cost_center_desc") {
    const code = costCenterCode(
      draft.cost_center_code
    );

    return code
      ? cecoByCode[code] || ""
      : "";
  }

  if (EDITABLE.includes(key as EditableKey)) {
    return draft[key as EditableKey];
  }

  return (row as unknown as Record<string, unknown>)[String(key)];
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
  return !validOptionalNumber(draft.exc_rate, 12)
    || !validOptionalNumber(draft.asset_ini_cost_pen, 14)
    || !validOptionalNumber(draft.asset_ini_cost_usd, 14);
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
  const [rows, setRows] = useState<CatalogueDisplayRow[]>([]);
  const [vetaVrRows, setVetaVrRows] = useState<VetaVrRow[]>([]);
  const [vrDetailAssetCode, setVrDetailAssetCode] = useState<string | null>(null);
  const [deprecCurrentPeriod, setDeprecCurrentPeriod] = useState("");
  const [cecoByCode, setCecoByCode] = useState<Record<string, string>>({});
  const [accountRows, setAccountRows] = useState<AccountRow[]>([]);
  const [codePrefixByAccount, setCodePrefixByAccount] = useState<Record<string, string>>({});
  const [selectedReclassCodes, setSelectedReclassCodes] = useState<Set<string>>(new Set());
  const [reclassDraft, setReclassDraft] = useState<ReclassDraft>(emptyReclassDraft);
  const [reclassifying, setReclassifying] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [originals, setOriginals] = useState<Record<string, Draft>>({});
  const [page, setPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<Partial<Record<CatalogueColumnKey, ExcelColumnFilter>>>({});
  const [excelSort, setExcelSort] = useState<{ key: CatalogueColumnKey; direction: ExcelSortDirection } | null>(null);
  const [showDetail, setShowDetail] = useState(true);
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
      const [response, cecoResponse, deprecResponse, vetaVrResponse, accountResponse, mappingResponse] = await Promise.all([
        apiGet("/api/actfij/catalogue"),
        apiGet("/api/actfij/ceco"),
        apiGet("/api/actfij/deprec"),
        apiGet("/api/actfij/veta-vr"),
        apiGet("/api/actfij/account"),
        apiGet("/api/actfij/mapping"),
      ]);

      const nextCatalogueRows = Array.isArray(response?.rows)
        ? response.rows as CatalogueRow[]
        : [];

      const nextVetaVrRows = Array.isArray(vetaVrResponse?.rows)
        ? vetaVrResponse.rows as VetaVrRow[]
        : [];

      const nextAccountRows = Array.isArray(accountResponse?.rows)
        ? accountResponse.rows as AccountRow[]
        : [];

      const nextCodePrefixByAccount = (Array.isArray(mappingResponse?.rows) ? mappingResponse.rows as MappingRow[] : [])
        .reduce<Record<string, string>>((current, row) => {
          const accountCode = text(row.origin_account_code).trim();
          const prefix = text(row.correlative_start).trim();
          if (accountCode && /^\d{3}$/.test(prefix)) current[accountCode] = prefix;
          return current;
        }, {});

      const nextDeprecRows = Array.isArray(deprecResponse?.rows)
        ? deprecResponse.rows as DeprRow[]
        : [];

      const currentDeprecPeriod =
        currentLimaAccountingPeriod();

      const currentDeprecYear =
        currentDeprecPeriod.slice(0, 4);

      const monthlyByAsset: Record<
        string,
        Partial<Record<MonthlyDeprecKey, number | string | null>>
      > = {};

      nextDeprecRows.forEach((row) => {
        const code = text(row.asset_code).trim();
        const period = dateOnly(row.period_date).slice(0, 7);

        if (
          !code
          || !/^\d{4}-\d{2}$/.test(period)
          || period.slice(0, 4) !== currentDeprecYear
          || period > currentDeprecPeriod
        ) {
          return;
        }

        const monthToken = period.replace("-", "_");

        const usdKey =
          `monthly_depr_${monthToken}_usd` as MonthlyDeprecKey;

        const penKey =
          `monthly_depr_${monthToken}_pen` as MonthlyDeprecKey;

        const sourceName =
          text(row.source_name).trim().toUpperCase();

        const hideCurrentUsd =
          period === currentDeprecPeriod
          && (
            sourceName === "VIRTUAL"
            || sourceName === "WEB_PEN"
          );

        const hideCurrentPen =
          period === currentDeprecPeriod
          && (
            sourceName === "VIRTUAL"
            || sourceName === "WEB_USD"
          );

        monthlyByAsset[code] = {
          ...(monthlyByAsset[code] || {}),
          [usdKey]: hideCurrentUsd
            ? null
            : row.depreciation_amount_usd,
          [penKey]: hideCurrentPen
            ? null
            : row.depreciation_amount_pen,
        };
      });

      const nextRows: CatalogueDisplayRow[] =
        nextCatalogueRows.map((row) => ({
          ...row,
          ...(monthlyByAsset[text(row.asset_code).trim()] || {}),
        }));

      const nextCecoByCode = (Array.isArray(cecoResponse?.rows) ? cecoResponse.rows as CecoRow[] : [])
        .reduce<Record<string, string>>((current, row) => {
          const code = costCenterCode(text(row.cost_center_code));
          if (code) current[code] = text(row.cost_center_description).trim();
          return current;
        }, {});

      const nextDrafts: Record<string, Draft> = {};

      nextRows.forEach((row) => {
        nextDrafts[text(row.asset_code)] = toDraft(row);
      });

      setRows(nextRows);
      setVetaVrRows(nextVetaVrRows);
      setDeprecCurrentPeriod(currentDeprecPeriod);
      setCecoByCode(nextCecoByCode);
      setAccountRows(nextAccountRows);
      setCodePrefixByAccount(nextCodePrefixByAccount);
      setSelectedReclassCodes(new Set());
      setReclassDraft(emptyReclassDraft());
      setVrDetailAssetCode(null);
      setDrafts(nextDrafts);
      setOriginals(nextDrafts);
      setColumnFilters({});
      setExcelSort(null);
      setPage(1);
      setIsError(false);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el catálogo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const vrAssetCodes = useMemo(() => new Set(
    vetaVrRows
      .filter((row) => text(row.map_type).trim().toUpperCase() === "VR")
      .map((row) => text(row.asset_code).trim())
      .filter(Boolean)
  ), [vetaVrRows]);

  const vrDetailRows = useMemo(() => (
    vrDetailAssetCode
      ? vetaVrRows.filter((row) => (
          text(row.asset_code).trim() === vrDetailAssetCode
          && text(row.map_type).trim().toUpperCase() === "VR"
        ))
      : []
  ), [vetaVrRows, vrDetailAssetCode]);

  const editedCodes = useMemo(() => rows
    .map((row) => text(row.asset_code))
    .filter((code) => drafts[code] && originals[code] && changed(drafts[code], originals[code])), [rows, drafts, originals]);
  const invalidCodes = editedCodes.filter((code) => invalid(drafts[code]));
  const canSave = editedCodes.length > 0
    && invalidCodes.length === 0
    && selectedReclassCodes.size === 0
    && !loading
    && !saving
    && !reclassifying;

  const reclassSelectedRows = useMemo(() => rows.filter((row) => (
    selectedReclassCodes.has(text(row.asset_code).trim())
  )), [rows, selectedReclassCodes]);

  const reclassTotalPen = useMemo(() => reclassSelectedRows.reduce(
    (total, row) => total + numericAmount(row.asset_final_value_pen),
    0
  ), [reclassSelectedRows]);

  const reclassTotalUsd = useMemo(() => reclassSelectedRows.reduce(
    (total, row) => total + numericAmount(row.asset_final_value_usd),
    0
  ), [reclassSelectedRows]);

  const reclassCapexOptions = useMemo(() => Array.from(new Set(
    rows
      .map((row) => text(row.capex_code).trim())
      .filter((value): value is string => Boolean(value))
  )).sort((a, b) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" })), [rows]);

  const accountDescriptionByCode = useMemo(() => accountRows.reduce<Record<string, string>>((current, row) => {
    const code = text(row.account_code).trim();
    if (code) current[code] = text(row.account_description).trim();
    return current;
  }, {}), [accountRows]);

  const reclassAccountCodes = useMemo(() => Object.keys(codePrefixByAccount)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [codePrefixByAccount]);

  const reclassProposedCode = useMemo(() => {
    const prefix = codePrefixByAccount[reclassDraft.origin_account_code.trim()] || "";
    if (!/^\d{3}$/.test(prefix)) return "";

    let maxSuffix = 0;
    rows.forEach((row) => {
      const code = text(row.asset_code).trim();
      if (!/^\d{7}$/.test(code) || code.slice(0, 3) !== prefix) return;
      maxSuffix = Math.max(maxSuffix, Number(code.slice(3)));
    });

    const nextSuffix = maxSuffix + 1;
    return nextSuffix <= 9999
      ? `${prefix}${String(nextSuffix).padStart(4, "0")}`
      : "";
  }, [rows, codePrefixByAccount, reclassDraft.origin_account_code]);

  const reclassOperationDate = useMemo(
    () => firstDayNextMonth(reclassDraft.acquisition_date),
    [reclassDraft.acquisition_date]
  );

  const canReclassify = reclassSelectedRows.length > 0
    && editedCodes.length === 0
    && Boolean(reclassProposedCode)
    && Boolean(reclassDraft.origin_account_code.trim())
    && Boolean(reclassDraft.capex_code.trim())
    && Boolean(reclassDraft.acquisition_date)
    && Boolean(reclassOperationDate)
    && Boolean(costCenterCode(reclassDraft.cost_center_code))
    && Object.prototype.hasOwnProperty.call(cecoByCode, costCenterCode(reclassDraft.cost_center_code))
    && !loading
    && !saving
    && !reclassifying;

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

  const columns = useMemo<CatalogueColumn[]>(() => {
    const match = deprecCurrentPeriod.match(/^(\d{4})-(\d{2})$/);

    if (!match) {
      return [
        ...COLUMNS_BEFORE_MONTHLY,
        ...COLUMNS_AFTER_MONTHLY,
      ];
    }

    const year = match[1];
    const currentMonth = Number(match[2]);

    const monthlyColumns: CatalogueColumn[] = [];

    for (let month = 1; month <= currentMonth; month += 1) {
      const monthText = String(month).padStart(2, "0");

      monthlyColumns.push(
        {
          key: `monthly_depr_${year}_${monthText}_usd` as MonthlyDeprecKey,
          label: `${MONTHS[month - 1]} ${year} USD`,
          width: 145,
        },
        {
          key: `monthly_depr_${year}_${monthText}_pen` as MonthlyDeprecKey,
          label: `${MONTHS[month - 1]} ${year} PEN`,
          width: 145,
        }
      );
    }

    return [
      ...COLUMNS_BEFORE_MONTHLY,
      ...monthlyColumns,
      ...COLUMNS_AFTER_MONTHLY,
    ];
  }, [deprecCurrentPeriod]);

  const displayColumns = useMemo<CatalogueColumn[]>(() => {
    if (showDetail) {
      return columns;
    }

    return columns.filter(
      (column) =>
        column.key === "asset_code"
        || (
          EDITABLE.includes(column.key as EditableKey)
          && column.key !== "asset_type"
        )
    );
  }, [columns, showDetail]);

  const baseVisibleRows = rows;

  const excelColumnValues = useMemo(() => {
    const result: Partial<
      Record<CatalogueColumnKey, string[]>
    > = {};

    columns.forEach((column) => {
      result[column.key] = baseVisibleRows.map(
        (row) => {
          const draft =
            drafts[text(row.asset_code)]
            || toDraft(row);

          return text(
            catalogueExcelFilterValue(
              row,
              draft,
              column.key,
              cecoByCode
            )
          ).trim();
        }
      );
    });

    return result;
  }, [
    baseVisibleRows,
    drafts,
    cecoByCode,
    columns,
  ]);

  const visibleRows = useMemo(() => {
    const filtered = baseVisibleRows.filter(
      (row) => {
        const draft =
          drafts[text(row.asset_code)]
          || toDraft(row);

        return (
          Object.entries(columnFilters) as Array<
            [CatalogueColumnKey, ExcelColumnFilter]
          >
        ).every(([key, filter]) =>
          matchesExcelFilter(
            catalogueExcelFilterValue(
              row,
              draft,
              key,
              cecoByCode
            ),
            filter,
            catalogueExcelFilterKind(key)
          )
        );
      }
    );

    if (!excelSort) {
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      const aDraft =
        drafts[text(a.asset_code)]
        || toDraft(a);

      const bDraft =
        drafts[text(b.asset_code)]
        || toDraft(b);

      return compareExcelValues(
        catalogueExcelFilterValue(
          a,
          aDraft,
          excelSort.key,
          cecoByCode
        ),
        catalogueExcelFilterValue(
          b,
          bDraft,
          excelSort.key,
          cecoByCode
        ),
        catalogueExcelFilterKind(excelSort.key),
        excelSort.direction
      );
    });
  }, [
    baseVisibleRows,
    drafts,
    columnFilters,
    excelSort,
    cecoByCode,
  ]);

  const columnTotals = useMemo(() => {
    const result: Record<string, number> = {};

    columns.forEach((column) => {
      if (!isCurrencyAmountColumn(column.key)) {
        return;
      }

      result[String(column.key)] = visibleRows.reduce(
        (sum, row) => {
          const code = text(row.asset_code);
          const draft = drafts[code] || toDraft(row);

          const value = catalogueExcelFilterValue(
            row,
            draft,
            column.key,
            cecoByCode
          );

          return sum + numericAmount(value);
        },
        0
      );
    });

    return result;
  }, [
    columns,
    visibleRows,
    drafts,
    cecoByCode,
  ]);

  const pageCount = Math.max(
    1,
    Math.ceil(visibleRows.length / PAGE_SIZE)
  );

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;

    return visibleRows.slice(
      start,
      start + PAGE_SIZE
    );
  }, [
    visibleRows,
    page,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    columnFilters,
    excelSort,
  ]);

  useEffect(() => {
    setPage((current) =>
      Math.min(current, pageCount)
    );
  }, [pageCount]);

  function exportExcel() {
    if (!visibleRows.length || !displayColumns.length) {
      return;
    }

    const headers = displayColumns.map(
      (column) => column.label
    );

    const data = visibleRows.map((row) => {
      const code = text(row.asset_code);
      const draft = drafts[code] || toDraft(row);

      return displayColumns.map((column) => {
        const value = catalogueExcelFilterValue(
          row,
          draft,
          column.key,
          cecoByCode
        );

        if (String(column.key).endsWith("_date")) {
          return dateOnly(value);
        }

        if (catalogueExcelFilterKind(column.key) === "number") {
          const clean = text(value)
            .trim()
            .replace(/,/g, "");

          if (!clean) {
            return "";
          }

          const parsed = Number(clean);

          return Number.isFinite(parsed)
            ? parsed
            : text(value);
        }

        return text(value);
      });
    });

    const totalRow = displayColumns.map((column) => {
      if (column.key === "asset_code") {
        return "TOTAL";
      }

      if (isCurrencyAmountColumn(column.key)) {
        return columnTotals[String(column.key)] || 0;
      }

      return "";
    });

    const ws = XLSX.utils.aoa_to_sheet([
      headers,
      ...data,
      totalRow,
    ]);

    ws["!cols"] = displayColumns.map((column) => ({
      wch: Math.max(
        12,
        Math.round(column.width / 7)
      ),
    }));

    if (displayColumns.length && visibleRows.length) {
      ws["!autofilter"] = {
        ref: XLSX.utils.encode_range({
          s: {
            r: 0,
            c: 0,
          },
          e: {
            r: visibleRows.length,
            c: displayColumns.length - 1,
          },
        }),
      };
    }

    for (
      let rowIndex = 0;
      rowIndex <= visibleRows.length;
      rowIndex += 1
    ) {
      const excelRow = rowIndex + 2;

      displayColumns.forEach(
        (column, columnIndex) => {
          if (
            catalogueExcelFilterKind(column.key)
            !== "number"
          ) {
            return;
          }

          const cellRef = `${XLSX.utils.encode_col(
            columnIndex
          )}${excelRow}`;

          const cell = ws[cellRef];

          if (!cell || cell.t !== "n") {
            return;
          }

          cell.z = "0.00";
        }
      );
    }

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      ws,
      "Catálogo"
    );

    const dateParts = new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "America/Lima",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(new Date());

    const year = dateParts.find(
      (part) => part.type === "year"
    )?.value || "";

    const month = dateParts.find(
      (part) => part.type === "month"
    )?.value || "";

    const day = dateParts.find(
      (part) => part.type === "day"
    )?.value || "";

    XLSX.writeFile(
      wb,
      `catalogo_activos_${year}-${month}-${day}.xlsx`
    );
  }

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
      const payloads = editedMappingCodes.flatMap((code) => {
        const row = mappingRows.find((item) => text(item.origin_account_code) === code);
        if (!row) return [];
        return [{
          origin_account_code: code,
          account_group: row.account_group,
          account_denom: row.account_denom,
          deprec_acc_code_fir: row.deprec_acc_code_fir,
          deprec_acc_code_sec: row.deprec_acc_code_sec,
          deprec_rate_pct: Number(mappingDrafts[code].deprec_rate_pct),
          asset_type: row.asset_type,
        }];
      });

      for (let start = 0; start < payloads.length; start += 100) {
        const chunk = payloads.slice(start, start + 100);
        await apiPost("/api/actfij/mapping/insert", { rows: chunk });
        saved += chunk.length;
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

  function toggleReclassSelection(row: CatalogueDisplayRow) {
    const code = text(row.asset_code).trim();
    if (!code) return;

    setSelectedReclassCodes((current) => {
      const next = new Set(current);
      const adding = !next.has(code);

      if (adding) {
        next.add(code);

        if (current.size === 0) {
          setReclassDraft((draft) => ({
            ...draft,
            origin_account_code: text(row.origin_account_code).trim(),
          }));
        }
      } else {
        next.delete(code);

        if (next.size === 0) {
          setReclassDraft(emptyReclassDraft());
        }
      }

      return next;
    });

    setMessage("");
    setIsError(false);
  }

  async function executeReclassification() {
    if (!canReclassify) return;

    setReclassifying(true);
    setMessage("");
    setIsError(false);

    try {
      await apiPost("/api/actfij/catalogue/reclassify", {
        source_rows: reclassSelectedRows.map((row) => ({
          asset_code: text(row.asset_code).trim(),
          asset_final_value_pen: numericAmount(row.asset_final_value_pen),
          asset_final_value_usd: numericAmount(row.asset_final_value_usd),
        })),
        new_asset: {
          asset_code: reclassProposedCode,
          origin_account_code: reclassDraft.origin_account_code.trim(),
          capex_code: upperOrNull(reclassDraft.capex_code),
          asset_description: upperOrNull(reclassDraft.asset_description),
          cost_center_code: costCenterCode(reclassDraft.cost_center_code),
          acquisition_date: reclassDraft.acquisition_date,
          operation_date: reclassOperationDate,
          location_name: upperOrNull(reclassDraft.location_name),
          assigned_to: upperOrNull(reclassDraft.assigned_to),
          area_name: upperOrNull(reclassDraft.area_name),
          brand: upperOrNull(reclassDraft.brand),
          model: upperOrNull(reclassDraft.model),
          serial_number: upperOrNull(reclassDraft.serial_number),
          color: upperOrNull(reclassDraft.color),
          depreciation_method: upperOrNull(reclassDraft.depreciation_method),
          asset_situation: upperOrNull(reclassDraft.asset_situation) || "OPERATIVO",
          asset_comment: upperOrNull(reclassDraft.asset_comment),
        },
      });

      const moved = reclassSelectedRows.length;
      const newCode = reclassProposedCode;

      await load();

      setMessage(`${moved} activo${moved === 1 ? "" : "s"} reclasificado${moved === 1 ? "" : "s"} al COD ${newCode}.`);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "No se pudo completar la reclasificación");
    } finally {
      setReclassifying(false);
    }
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setMessage("");
    setIsError(false);
    let saved = 0;
    try {
      const payloads = editedCodes.map((code) => {
        const draft = drafts[code];
        return {
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
          asset_ini_cost_usd: draft.asset_ini_cost_usd.trim() ? Number(draft.asset_ini_cost_usd) : null,
          depreciation_method: upperOrNull(draft.depreciation_method),
          asset_situation: upperOrNull(draft.asset_situation),
          asset_comment: upperOrNull(draft.asset_comment),
        };
      });

      for (let start = 0; start < payloads.length; start += 100) {
        const chunk = payloads.slice(start, start + 100);
        await apiPost("/api/actfij/catalogue/insert", { rows: chunk });
        saved += chunk.length;
      }
      await load();
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
          <Button size="sm" onClick={() => void openMappingPreview()} disabled={loading || saving || reclassifying}>Actualizar mapping</Button>
          <Button size="sm" onClick={() => setShowDetail((current) => !current)} disabled={loading || saving || reclassifying}>{showDetail ? "Ocultar detalle" : "Mostrar detalle"}</Button>
          <Button size="sm" onClick={exportExcel} disabled={loading || saving || !visibleRows.length}>Exportar Excel ({visibleRows.length})</Button>
          <Button size="sm" onClick={() => { setColumnFilters({}); setExcelSort(null); setPage(1); }} disabled={loading || saving}>Limpiar filtros</Button>
          <Button size="sm" onClick={() => void load()} disabled={loading || saving || reclassifying}>{loading ? "Cargando..." : "Refrescar"}</Button>
          <Button size="sm" onClick={() => void executeReclassification()} disabled={!canReclassify}>
            {reclassifying ? "Reclasificando..." : `Reclasificar costos (${reclassSelectedRows.length})`}
          </Button>
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

      <datalist id="fixassets-cat-reclass-capex-options">
        {reclassCapexOptions.map((value) => <option key={value} value={value} />)}
      </datalist>

      <div className="panel-inner fixassets-cat-table" style={{ overflow: "auto", maxHeight: "calc(100vh - 260px)", minHeight: 0, padding: 0, background: "#0b4d6b", borderColor: "rgba(147,211,230,.28)" }}>
        <div style={{ minWidth: "max-content" }}>
          <Table disableScrollWrapper>
            <colgroup>
              <col style={{ width: 44, minWidth: 44 }} />
              {displayColumns.map((column) => <col key={column.key} style={{ width: column.width, minWidth: column.width }} />)}
            </colgroup>
            <thead><tr>
              <th className="capex-th" style={{ position: "sticky", top: 0, left: 0, zIndex: 95, width: 44, minWidth: 44, padding: 5, textAlign: "center", background: "#163b49" }}>Sel.</th>
              {displayColumns.map((column, columnIndex) => {
              const sticky = column.key === "asset_code" || column.key === "asset_description";
              const left = column.key === "asset_code" ? 44 : column.key === "asset_description" ? 149 : undefined;

              return <th key={column.key} className="capex-th" style={{ position: "sticky", top: 0, padding: "8px", fontSize: 12, left, zIndex: sticky ? 92 : 79, overflow: "visible", background: catalogueColumnHeaderBackground(columnIndex), boxShadow: column.key === "asset_description" ? "2px 0 rgba(216,238,255,.16)" : undefined }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 5 }}>
                  <span>{column.label}</span>

                  <ExcelHeaderFilter
                    label={column.label}
                    kind={catalogueExcelFilterKind(column.key)}
                    values={excelColumnValues[column.key] || []}
                    filter={columnFilters[column.key]}
                    sortDirection={excelSort?.key === column.key ? excelSort.direction : undefined}
                    onApply={(filter) =>
                      setColumnFilters((current) => ({
                        ...current,
                        [column.key]: filter,
                      }))
                    }
                    onSort={(direction) =>
                      setExcelSort({
                        key: column.key,
                        direction,
                      })
                    }
                  />
                </div>
              </th>;
            })}</tr></thead>
            <tbody>
              {paginatedRows.map((row) => {
                const code = text(row.asset_code);
                const draft = drafts[code] || toDraft(row);
                const edited = originals[code] ? changed(draft, originals[code]) : false;
                const bad = edited && invalid(draft);
                const hasVrDetail = vrAssetCodes.has(code);
                const vrFocused = vrDetailAssetCode === code;
                const reclassSelected = selectedReclassCodes.has(code);

                return <tr
                  key={code}
                  className="capex-tr"
                  onClick={(event) => {
                    if (!hasVrDetail) return;
                    if ((event.target as HTMLElement).closest("input, select, button")) return;
                    setVrDetailAssetCode((current) => current === code ? null : code);
                  }}
                  style={{ cursor: hasVrDetail ? "pointer" : undefined }}
                  title={hasVrDetail ? "Abrir detalle VR" : undefined}
                >
                  <td
                    className="capex-td"
                    style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 24,
                      padding: 5,
                      textAlign: "center",
                      background: reclassSelected ? "#665b22" : "#0b4d6b",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={reclassSelected}
                      disabled={loading || saving || reclassifying}
                      onChange={() => toggleReclassSelection(row)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Seleccionar ${code} para reclasificación`}
                    />
                  </td>
                  {displayColumns.map((column, columnIndex) => {
                    const editable = EDITABLE.includes(column.key as EditableKey) && column.key !== "asset_type";
                    const key = column.key as EditableKey;
                    const value = catalogueExcelFilterValue(
                      row,
                      draft,
                      column.key,
                      cecoByCode
                    );
                    const sticky = column.key === "asset_code" || column.key === "asset_description";
                    const left = column.key === "asset_code" ? 44 : column.key === "asset_description" ? 149 : undefined;

                    const cellBackground = bad
                      ? "#713f38"
                      : edited
                        ? "#3d6948"
                        : reclassSelected
                          ? "#665b22"
                          : vrFocused
                            ? "#155a78"
                            : catalogueColumnBodyBackground(columnIndex);

                    return <td key={column.key} className="capex-td" style={{ padding: 5, background: cellBackground, position: sticky ? "sticky" : undefined, left, zIndex: sticky ? 20 : undefined, boxShadow: column.key === "asset_description" ? "2px 0 rgba(216,238,255,.12)" : undefined }}>
                      {editable ? key === "asset_situation" ? <select
                        className="input"
                        value={text(value)}
                        onChange={(event) => update(code, key, event.target.value)}
                        style={{ minWidth: column.width - 10, padding: "4px 6px", height: 28, borderRadius: 7, background: cellBackground, borderColor: "rgba(147,211,230,.30)" }}
                        aria-label={`${column.label} ${code}`}
                      >
                        <option value="" style={{ background: "#0b4d6b", color: "#f4fbff" }}></option>
                        <option value="OPERATIVO" style={{ background: "#0b4d6b", color: "#f4fbff" }}>OPERATIVO</option>
                        <option value="DEPRECIADO" style={{ background: "#0b4d6b", color: "#f4fbff" }}>DEPRECIADO</option>
                      </select> : <FastCellInput
                        className="input"
                        type={DATE_FIELDS.has(key) ? "date" : "text"}
                        inputMode={NUMBER_FIELDS.has(key) ? "decimal" : undefined}
                        maxLength={undefined}
                        list={SUGGESTION_FIELD_SET.has(key) ? `fixassets-cat-${key}-options` : undefined}
                        value={text(value)}
                        sanitize={key === "cost_center_code"
                          ? costCenterCode
                          : NUMBER_FIELDS.has(key)
                            ? (next) => decimalDraft(next, numericIntegerDigits(key))
                            : undefined}
                        onLiveChange={key === "cost_center_code" ? (next) => {
                          const nextCode = costCenterCode(next);
                          if (!nextCode || Object.prototype.hasOwnProperty.call(cecoByCode, nextCode)) {
                            update(code, key, nextCode);
                          }
                        } : undefined}
                        onCommit={(next) => key === "cost_center_code"
                          ? commitCostCenter(code, next)
                          : update(code, key, next)}
                        style={{ minWidth: column.width - 10, padding: "4px 6px", height: 28, borderRadius: 7, background: cellBackground, borderColor: bad && NUMBER_FIELDS.has(key) && !validOptionalNumber(draft[key], numericIntegerDigits(key)) ? "#ebb086" : "rgba(147,211,230,.30)" }}
                        aria-label={`${column.label} ${code}`}
                      /> : <span title={text(value)}>{String(column.key).endsWith("_date") ? dateOnly(value) : catalogueExcelFilterKind(column.key) === "number" ? twoDecimals(value) : text(value)}</span>}
                    </td>;
                  })}
                </tr>;
              })}
              {!loading && !visibleRows.length ? <tr><td className="capex-td" colSpan={displayColumns.length + 1}>No hay activos que coincidan con la búsqueda.</td></tr> : null}
              {loading ? <tr><td className="capex-td" colSpan={displayColumns.length + 1}>Cargando catálogo...</td></tr> : null}
            </tbody>

            {!loading && visibleRows.length ? (
              <tfoot>
                <tr>
                  <td
                    className="capex-td"
                    style={{
                      position: "sticky",
                      bottom: 0,
                      left: 0,
                      zIndex: 95,
                      width: 44,
                      minWidth: 44,
                      padding: 5,
                      background: "#163b49",
                      borderTop: "2px solid rgba(216,238,255,.38)",
                    }}
                  />
                  {displayColumns.map((column, columnIndex) => {
                    const sticky = column.key === "asset_code" || column.key === "asset_description";
                    const left =
                      column.key === "asset_code"
                        ? 44
                        : column.key === "asset_description"
                          ? 149
                          : undefined;

                    const isAmount = isCurrencyAmountColumn(column.key);

                    return (
                      <td
                        key={column.key}
                        className="capex-td"
                        style={{
                          position: "sticky",
                          bottom: 0,
                          left,
                          zIndex: sticky ? 92 : 78,
                          padding: "7px 5px",
                          background: catalogueColumnHeaderBackground(columnIndex),
                          borderTop: "2px solid rgba(216,238,255,.38)",
                          boxShadow:
                            column.key === "asset_description"
                              ? "2px 0 rgba(216,238,255,.16)"
                              : undefined,
                          fontWeight: 900,
                          textAlign: isAmount ? "right" : "left",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {column.key === "asset_code"
                          ? "TOTAL"
                          : isAmount
                            ? formatAmountTotal(
                                columnTotals[String(column.key)] || 0
                              )
                            : ""}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            ) : null}
          </Table>
        </div>
      </div>

      {vrDetailAssetCode ? (
        <section
          className="panel-inner fixassets-cat-vr-detail"
          style={{
            position: "static",
            maxHeight: "min(62vh, 370px)",
            padding: 10,
            overflow: "hidden",
            background: "var(--panel2)",
            borderColor: "rgba(147,211,230,.52)",
            boxShadow: "0 10px 30px rgba(0,0,0,.24)",
            display: "grid",
            gridTemplateRows: "auto minmax(0, 1fr)",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <strong>Detalle VR · COD {vrDetailAssetCode}</strong>
              <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                {vrDetailRows.length} línea{vrDetailRows.length === 1 ? "" : "s"}
              </span>
            </div>
            <Button size="sm" onClick={() => setVrDetailAssetCode(null)}>Cerrar detalle</Button>
          </div>

          <div style={{ overflow: "auto", minHeight: 0, border: "1px solid rgba(147,211,230,.22)", borderRadius: 9 }}>
            <div style={{ minWidth: "max-content" }}>
              <Table disableScrollWrapper stickyHeader>
                <thead>
                  <tr>
                    {[
                      "COD",
                      "Cuenta",
                      "Descripción cuenta",
                      "Fecha contable",
                      "Subdiario",
                      "Comprobante",
                      "Código anexo",
                      "Descripción anexo",
                      "Tipo doc.",
                      "Nro. documento",
                      "Fecha documento",
                      "Descripción comprobante",
                      "Descripción línea",
                      "D/H",
                      "Monto USD",
                      "Monto PEN",
                    ].map((label) => (
                      <th key={label} className="capex-th" style={{ top: 0, zIndex: 20, padding: 8, fontSize: 12 }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vrDetailRows.map((detail, detailIndex) => (
                    <tr
                      key={`${text(detail.asset_code)}|${text(detail.account_code)}|${text(detail.subjournal_code)}|${text(detail.voucher_number)}|${text(detail.annex_code)}|${text(detail.document_number)}|${detailIndex}`}
                      className="capex-tr"
                    >
                      <td className="capex-td">{text(detail.asset_code)}</td>
                      <td className="capex-td">{text(detail.account_code)}</td>
                      <td className="capex-td">{text(detail.account_description)}</td>
                      <td className="capex-td">{dateOnly(detail.comp_date)}</td>
                      <td className="capex-td">{text(detail.subjournal_code)}</td>
                      <td className="capex-td">{text(detail.voucher_number)}</td>
                      <td className="capex-td">{text(detail.annex_code)}</td>
                      <td className="capex-td">{text(detail.annex_description)}</td>
                      <td className="capex-td">{text(detail.document_type)}</td>
                      <td className="capex-td">{text(detail.document_number)}</td>
                      <td className="capex-td">{dateOnly(detail.document_date)}</td>
                      <td className="capex-td">{text(detail.voucher_description)}</td>
                      <td className="capex-td">{text(detail.line_description)}</td>
                      <td className="capex-td">{text(detail.debit_credit)}</td>
                      <td className="capex-td" style={{ textAlign: "right" }}>{twoDecimals(detail.usd_amount)}</td>
                      <td className="capex-td" style={{ textAlign: "right" }}>{twoDecimals(detail.pen_amount)}</td>
                    </tr>
                  ))}
                  {!vrDetailRows.length ? (
                    <tr>
                      <td className="capex-td" colSpan={16}>No hay detalle VR para este COD.</td>
                    </tr>
                  ) : null}
                </tbody>
              </Table>
            </div>
          </div>
        </section>
      ) : null}

      {reclassSelectedRows.length ? (
        <section className="panel-inner" style={{ padding: 12, display: "grid", gap: 10, borderColor: "rgba(224,190,80,.58)", background: "rgba(102,91,34,.18)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <strong>Reclasificación de costos</strong>
              <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                {reclassSelectedRows.length} activo{reclassSelectedRows.length === 1 ? "" : "s"} · PEN {formatAmountTotal(reclassTotalPen)} · USD {formatAmountTotal(reclassTotalUsd)}
              </span>
            </div>

            <Button
              size="sm"
              onClick={() => {
                setSelectedReclassCodes(new Set());
                setReclassDraft(emptyReclassDraft());
              }}
              disabled={reclassifying}
            >
              Limpiar selección
            </Button>
          </div>

          <div className="muted" style={{ fontSize: 12 }}>
            Los COD seleccionados recibirán fecha de baja {currentLimaDate()} y una reclasificación negativa por su valor final. El nuevo COD recibirá la suma positiva en PEN y USD.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
            <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 800 }}>
              COD propuesto
              <input
                className="input"
                value={reclassProposedCode}
                readOnly
                style={{ height: 34, padding: "6px 8px" }}
              />
            </label>

            <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 800 }}>
              Cuenta origen *
              <select
                className="input"
                value={reclassDraft.origin_account_code}
                onChange={(event) => setReclassDraft((current) => ({
                  ...current,
                  origin_account_code: event.target.value,
                }))}
                style={{ height: 34, padding: "6px 8px" }}
              >
                <option value="">Seleccionar...</option>
                {reclassAccountCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}{accountDescriptionByCode[code] ? ` - ${accountDescriptionByCode[code]}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 800 }}>
              Código CAPEX *
              <input
                className="input"
                list="fixassets-cat-reclass-capex-options"
                value={reclassDraft.capex_code}
                onChange={(event) => setReclassDraft((current) => ({
                  ...current,
                  capex_code: event.target.value.toLocaleUpperCase("es"),
                }))}
                style={{ height: 34, padding: "6px 8px" }}
              />
            </label>

            <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 800 }}>
              Centro de costo *
              <input
                className="input"
                list="fixassets-cat-cost_center_code-options"
                value={reclassDraft.cost_center_code}
                onChange={(event) => setReclassDraft((current) => ({
                  ...current,
                  cost_center_code: costCenterCode(event.target.value),
                }))}
                style={{ height: 34, padding: "6px 8px" }}
              />
            </label>

            <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 800 }}>
              Fecha adquisición *
              <input
                className="input"
                type="date"
                value={reclassDraft.acquisition_date}
                onChange={(event) => setReclassDraft((current) => ({
                  ...current,
                  acquisition_date: event.target.value,
                }))}
                style={{ height: 34, padding: "6px 8px" }}
              />
            </label>

            <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 800 }}>
              Fecha operación
              <input
                className="input"
                type="date"
                value={reclassOperationDate}
                readOnly
                style={{ height: 34, padding: "6px 8px" }}
              />
            </label>

            <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 800 }}>
              Descripción activo
              <input
                className="input"
                value={reclassDraft.asset_description}
                onChange={(event) => setReclassDraft((current) => ({
                  ...current,
                  asset_description: event.target.value,
                }))}
                style={{ height: 34, padding: "6px 8px" }}
              />
            </label>

            {[
              ["location_name", "Ubicación"],
              ["assigned_to", "Asignado a"],
              ["area_name", "Área"],
              ["brand", "Marca"],
              ["model", "Modelo"],
              ["serial_number", "Serie"],
              ["color", "Color"],
              ["depreciation_method", "Método depreciación"],
              ["asset_comment", "Comentario"],
            ].map(([field, label]) => (
              <label key={field} style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 800 }}>
                {label}
                <input
                  className="input"
                  list={SUGGESTION_FIELD_SET.has(field as EditableKey) ? `fixassets-cat-${field}-options` : undefined}
                  value={reclassDraft[field as keyof ReclassDraft]}
                  onChange={(event) => setReclassDraft((current) => ({
                    ...current,
                    [field]: event.target.value,
                  }))}
                  style={{ height: 34, padding: "6px 8px" }}
                />
              </label>
            ))}

            <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 800 }}>
              Situación
              <select
                className="input"
                value={reclassDraft.asset_situation}
                onChange={(event) => setReclassDraft((current) => ({
                  ...current,
                  asset_situation: event.target.value,
                }))}
                style={{ height: 34, padding: "6px 8px" }}
              >
                <option value="OPERATIVO">OPERATIVO</option>
                <option value="DEPRECIADO">DEPRECIADO</option>
              </select>
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              size="sm"
              variant="primary"
              onClick={() => void executeReclassification()}
              disabled={!canReclassify}
            >
              {reclassifying
                ? "Reclasificando..."
                : `Confirmar reclasificación → ${reclassProposedCode || "sin COD"}`}
            </Button>
          </div>
        </section>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div className="muted" style={{ fontSize: 12 }}>
          Mostrando {visibleRows.length ? (page - 1) * PAGE_SIZE + 1 : 0}-{Math.min(page * PAGE_SIZE, visibleRows.length)} de {visibleRows.length} filtrados · {rows.length} activos totales · {editedCodes.length} modificados.
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button
            size="sm"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
          >
            Anterior
          </Button>

          <span style={{ fontSize: 12, fontWeight: 800 }}>
            Página {page} de {pageCount}
          </span>

          <Button
            size="sm"
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            disabled={page >= pageCount}
          >
            Siguiente
          </Button>
        </div>
      </div>

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
                        {column.key === "deprec_rate_pct" ? <FastCellInput className="input" inputMode="decimal" value={draft.deprec_rate_pct} sanitize={(next) => decimalDraft(next, 3)} onCommit={(next) => updateMappingRate(code, next)} disabled={mappingLoading || mappingSaving || noDepreciates} aria-label={`Tasa de depreciación ${code}`} title={noDepreciates ? "No deprecia: la tasa no se puede modificar" : undefined} style={{ minWidth: column.width - 10, padding: "5px 7px", borderColor: bad ? "#ebb086" : undefined, opacity: noDepreciates ? 0.5 : 1, cursor: noDepreciates ? "not-allowed" : undefined }} /> : <span title={text(row[column.key])}>{text(row[column.key]) || "—"}</span>}
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

      <style jsx global>{`
        .fixassets-cat-table table {
          font-size: 11px !important;
        }

        .fixassets-cat-table .capex-th {
          padding: 6px !important;
          font-size: 11px !important;
          background: #163b49 !important;
          white-space: normal !important;
          line-height: 1.1;
        }

        .fixassets-cat-table .capex-td {
          padding: 4px 6px !important;
          line-height: 1.15;
          border-bottom-color: rgba(147,211,230,.14) !important;
        }
      `}</style>
    </div>
  );
}
