"use client";

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Table } from "../ui/Table";
import { FastCellInput } from "./FastCellInput";
import FixAssetsAudit from "./FixAssetsAudit";

type VetaRow = {
  account_code: string | null;
  account_description: string | null;
  comp_date: string | null;
  subjournal_code: string | null;
  voucher_number: string | null;
  sequence_number: string | null;
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

type VetaVrStoredRow = {
  asset_code: string | null;
  map_type: string | null;
  account_code: string | null;
  subjournal_code: string | null;
  voucher_number: string | null;
  sequence_number: string | null;
  annex_code: string | null;
  document_number: string | null;
  line_description: string | null;
};

type CatalogueRow = {
  asset_code: string | null;
  source_name?: string | null;
  asset_description?: string | null;
  asset_type?: string | null;
  location_name?: string | null;
  origin_account_code?: string | null;
  origin_account_desc?: string | null;
  capex_code?: string | null;
  po_num?: string | null;
  subjournal_code?: string | null;
  voucher_number?: string | null;
  sequence_number?: string | null;
  annex_code?: string | null;
  document_number?: string | null;
  assigned_to?: string | null;
  area_name?: string | null;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  cost_center_code?: string | null;
  cost_center_desc?: string | null;
  comp_date?: string | null;
  acquisition_date?: string | null;
  operation_date?: string | null;
  disposal_date?: string | null;
  depreciation_method?: string | null;
  asset_situation?: string | null;
  asset_comment?: string | null;
  asset_ini_cost_pen?: number | string | null;
  asset_ini_cost_usd?: number | string | null;
  asset_final_value_pen?: number | string | null;
  asset_final_value_usd?: number | string | null;
  asset_balance_pen?: number | string | null;
  asset_balance_usd?: number | string | null;
};

type CecoRow = {
  cost_center_code: string | null;
  cost_center_description: string | null;
};

type MappingRow = {
  origin_account_code: string | null;
  correlative_start: string | null;
};

type SoftPoRow = {
  subjournal_code: string | null;
  voucher_number: string | null;
  sequence_number: string | null;
  annex_code: string | null;
  document_number: string | null;
  po_num: string | null;
};

type Draft = {
  asset_code: string;
  line_description: string;
  capex_code: string;
  po_num: string;
  usd_amount: string;
  pen_amount: string;
  exc_rate: string;
  location_name: string;
  asset_type: string;
  assigned_to: string;
  area_name: string;
  brand: string;
  model: string;
  serial_number: string;
  cost_center_code: string;
  operation_date: string;
  depreciation_method: string;
  asset_situation: string;
  asset_comment: string;
};

type RowState = "idle" | "valid" | "invalid";
type IndexedRow = { row: VetaRow; index: number };
type NewAssetItem = IndexedRow & {
  detailIndexes: number[];
  selectedDetailIndexes: number[];
  isVrGroup: boolean;
  isBaja: boolean;
  readOnly: boolean;
};
type TableColumnKey = keyof VetaRow | "asset_code";

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

const COLUMNS: Array<{ key: TableColumnKey; label: string; width: number }> = [
  { key: "asset_code", label: "COD", width: 105 },
  { key: "account_code", label: "Cuenta", width: 120 },
  { key: "account_description", label: "Descripción cuenta", width: 230 },
  { key: "comp_date", label: "Fecha contable", width: 125 },
  { key: "subjournal_code", label: "Subdiario", width: 105 },
  { key: "voucher_number", label: "Comprobante", width: 125 },
  { key: "sequence_number", label: "Secuencia", width: 95 },
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

const DETAIL_COLUMN_WIDTH = 88;

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

function firstDayNextMonth(value: unknown) {
  const match = dateOnly(value).match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

function sourceIdentity(row: Pick<VetaRow | CatalogueRow | SoftPoRow, "subjournal_code" | "voucher_number" | "sequence_number" | "annex_code" | "document_number">) {
  const parts = [
    row.subjournal_code,
    row.voucher_number,
    row.sequence_number,
    row.annex_code,
    row.document_number,
  ].map((value) => text(value).trim());

  return parts.some(Boolean) ? parts.join("\u001f") : "";
}

function vetaVrDetailIdentity(
  row: Pick<VetaRow | VetaVrStoredRow, "account_code" | "subjournal_code" | "voucher_number" | "sequence_number" | "annex_code" | "document_number" | "line_description">
) {
  return [
    row.account_code,
    row.subjournal_code,
    row.voucher_number,
    row.sequence_number,
    row.annex_code,
    row.document_number,
    row.line_description,
  ].map(identityPart).join("\u001f");
}

function vetaVrUpdateIdentity(
  row: Pick<VetaVrStoredRow, "asset_code" | "account_code" | "subjournal_code" | "voucher_number" | "sequence_number" | "annex_code" | "document_number" | "line_description">
) {
  return [
    row.asset_code,
    row.account_code,
    row.subjournal_code,
    row.voucher_number,
    row.sequence_number,
    row.annex_code,
    row.document_number,
    row.line_description,
  ].map(identityPart).join("\u001f");
}

function documentType(row: Pick<VetaRow, "document_type">) {
  return text(row.document_type).trim().toLocaleUpperCase("es");
}

function isNaDocument(row: Pick<VetaRow, "document_type">) {
  return documentType(row) === "NA";
}

function isVrDocument(row: Pick<VetaRow, "document_type">) {
  return documentType(row) === "VR";
}

function isBajaDescription(row: Pick<VetaRow, "line_description">) {
  return /\bBAJA\b/.test(identityPart(row.line_description));
}

function identityPart(value: unknown) {
  return text(value).trim().toLocaleUpperCase("es");
}

function vrGroupIdentityParts(
  accountCode: unknown,
  capexCode: unknown
) {
  const capex = identityPart(capexCode);
  return [
    identityPart(accountCode),
    capex ? `CAPEX:${capex}` : "NORMAL",
  ].join("\u001e");
}

function vrGroupIdentity(row: VetaRow) {
  return vrGroupIdentityParts(
    row.account_code,
    row.capex_code
  );
}

function catalogueVrGroupIdentity(row: CatalogueRow) {
  return vrGroupIdentityParts(
    row.origin_account_code,
    row.capex_code
  );
}

function finiteNumber(value: unknown) {
  const clean = text(value).trim().replace(",", ".");
  if (!clean) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function sumVetaAmount(items: IndexedRow[], field: "usd_amount" | "pen_amount") {
  return items.reduce((total, item) => total + (finiteNumber(item.row[field]) || 0), 0);
}

function buildNewAssetItems(
  items: IndexedRow[],
  excludedVrIndexes: ReadonlySet<number>
) {
  type Slot =
    | { kind: "single"; item: IndexedRow }
    | { kind: "vr"; members: IndexedRow[] };

  const slots: Slot[] = [];
  const vrSlotByKey = new Map<string, number>();

  items.forEach((item) => {
    if (!isVrDocument(item.row) || isBajaDescription(item.row)) {
      slots.push({ kind: "single", item });
      return;
    }

    const key = vrGroupIdentity(item.row);
    const slotIndex = vrSlotByKey.get(key);

    if (slotIndex == null) {
      vrSlotByKey.set(key, slots.length);
      slots.push({ kind: "vr", members: [item] });
      return;
    }

    const slot = slots[slotIndex];
    if (slot.kind === "vr") slot.members.push(item);
  });

  return slots.map<NewAssetItem>((slot) => {
    if (slot.kind === "single") {
      return {
        ...slot.item,
        detailIndexes: [slot.item.index],
        selectedDetailIndexes: [slot.item.index],
        isVrGroup: false,
        isBaja: isBajaDescription(slot.item.row),
        readOnly: isNaDocument(slot.item.row) || isBajaDescription(slot.item.row),
      };
    }

    const selectedMembers = slot.members.filter(
      ({ index }) => !excludedVrIndexes.has(index)
    );
    const representative = selectedMembers[0] || slot.members[0];

    return {
      row: {
        ...representative.row,
        usd_amount: sumVetaAmount(selectedMembers, "usd_amount"),
        pen_amount: sumVetaAmount(selectedMembers, "pen_amount"),
      },
      index: slot.members[0].index,
      detailIndexes: slot.members.map(({ index }) => index),
      selectedDetailIndexes: selectedMembers.map(({ index }) => index),
      isVrGroup: true,
      isBaja: false,
      readOnly: false,
    };
  });
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

function validNumber(value: string, maxIntegerDigits: number, allowBlank = false) {
  const clean = value.trim();
  if (!clean) return allowBlank;
  const pattern = new RegExp(`^-?(?:\\d{1,${maxIntegerDigits}}(?:\\.\\d{0,6})?|\\.\\d{1,6})$`);
  return pattern.test(clean) && Number.isFinite(Number(clean));
}

function twoDecimals(value: unknown, blankAllowed = true) {
  const clean = text(value).trim();
  if (!clean) return blankAllowed ? "" : "0.00";
  const parsed = Number(clean.replace(",", "."));
  return Number.isFinite(parsed) ? parsed.toFixed(2) : clean;
}

function numberOrNull(value: string) {
  return value.trim() ? Number(value) : null;
}

function upperOrNull(value: string) {
  const clean = value.trim();
  return clean ? clean.toLocaleUpperCase("es") : null;
}

function costCenterCode(value: string) {
  const raw = value.trim().split(/\s+-\s+/, 1)[0] || "";
  return raw.toLocaleUpperCase("es").replace(/[^0-9A-Z]/g, "").slice(0, 6);
}

function draftFrom(row: VetaRow): Draft {
  return {
    asset_code: "",
    line_description: text(row.line_description),
    capex_code: text(row.capex_code),
    po_num: "",
    usd_amount: twoDecimals(row.usd_amount),
    pen_amount: twoDecimals(row.pen_amount),
    exc_rate: twoDecimals(row.exc_rate),
    location_name: "",
    asset_type: "",
    assigned_to: "",
    area_name: "",
    brand: "",
    model: "",
    serial_number: "",
    cost_center_code: "",
    operation_date: "",
    depreciation_method: "",
    asset_situation: "OPERATIVO",
    asset_comment: "",
  };
}

function displayDraft(item: NewAssetItem, drafts: Record<number, Draft>) {
  const draft = drafts[item.index] || draftFrom(item.row);
  if (!item.isVrGroup) return draft;
  return {
    ...draft,
    usd_amount: twoDecimals(item.row.usd_amount, false),
    pen_amount: twoDecimals(item.row.pen_amount, false),
  };
}

function monthOf(value: unknown) {
  const match = dateOnly(value).match(/^(\d{4})-(\d{2})/);
  return match ? { year: match[1], month: match[2] } : null;
}

function currentPeriod() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return {
    year: parts.find((part) => part.type === "year")?.value || "",
    month: parts.find((part) => part.type === "month")?.value || "01",
  };
}

function stickyRowBackground(state: RowState) {
  if (state === "valid") return "#416f43";
  if (state === "invalid") return "#79453b";
  return "#0b4d6b";
}

const NEW_DATE_FILTER_FIELDS = new Set<TableColumnKey>([
  "comp_date",
  "document_date",
]);

const NEW_NUMBER_FILTER_FIELDS = new Set<TableColumnKey>([
  "usd_amount",
  "pen_amount",
  "exc_rate",
]);

const NEW_DRAFT_TABLE_FIELDS = new Set<TableColumnKey>([
  "line_description",
  "capex_code",
  "usd_amount",
  "pen_amount",
  "exc_rate",
]);

function newAssetsExcelFilterKind(key: TableColumnKey): ExcelFilterKind {
  if (NEW_DATE_FILTER_FIELDS.has(key)) return "date";
  if (NEW_NUMBER_FILTER_FIELDS.has(key)) return "number";
  return "text";
}

function newAssetsExcelFilterValue(
  row: VetaRow,
  draft: Draft,
  key: TableColumnKey,
  existing: CatalogueRow | null
) {
  if (key === "asset_code") {
    return existing ? existing.asset_code : draft.asset_code;
  }

  if (!existing && NEW_DRAFT_TABLE_FIELDS.has(key)) {
    return draft[key as keyof Draft];
  }

  return row[key as keyof VetaRow];
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

function excelFilterIsActive(filter: ExcelColumnFilter | undefined) {
  return Boolean(
    filter &&
    (
      filter.selected !== null ||
      filter.operator !== "none"
    )
  );
}

function excelFilterBucketValue(rawValue: unknown, kind: ExcelFilterKind) {
  const value = rawValue == null ? "" : String(rawValue).trim();

  if (kind !== "number" || !value) {
    return value;
  }

  const parsed = Number(value.replace(",", "."));

  if (!Number.isFinite(parsed)) {
    return value;
  }

  const rounded = Math.round(
    (parsed + Math.sign(parsed || 1) * Number.EPSILON) * 100
  ) / 100;

  return (Object.is(rounded, -0) ? 0 : rounded).toFixed(2);
}

function matchesExcelFilter(
  rawValue: unknown,
  filter: ExcelColumnFilter | undefined,
  kind: ExcelFilterKind
) {
  if (!filter) return true;

  const value = excelFilterBucketValue(rawValue, kind);

  if (
    filter.selected !== null &&
    !filter.selected.includes(value)
  ) {
    return false;
  }

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
    const a = Number(excelFilterBucketValue(first, "number"));
    const b = Number(excelFilterBucketValue(second, "number"));

    if (!Number.isFinite(current) || !Number.isFinite(a)) {
      return false;
    }

    if (filter.operator === "equals") return current === a;
    if (filter.operator === "not_equals") return current !== a;
    if (filter.operator === "greater") return current > a;
    if (filter.operator === "greater_equal") return current >= a;
    if (filter.operator === "less") return current < a;
    if (filter.operator === "less_equal") return current <= a;

    if (filter.operator === "between") {
      return (
        Number.isFinite(b) &&
        current >= Math.min(a, b) &&
        current <= Math.max(a, b)
      );
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
    return (
      Boolean(b) &&
      current >= (a < b ? a : b) &&
      current <= (a > b ? a : b)
    );
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
  const [popupPosition, setPopupPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

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
        !rootRef.current?.contains(target) &&
        !popupRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", close);

    return () => {
      document.removeEventListener("mousedown", close);
    };
  }, [open]);

  const updatePopupPosition = useCallback(() => {
    const anchor = rootRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 4;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const popupWidth = Math.min(
      285,
      Math.max(0, viewportWidth - viewportPadding * 2)
    );
    const maxPopupHeight = Math.max(
      240,
      viewportHeight - viewportPadding * 2
    );
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
      Math.max(
        viewportPadding,
        viewportWidth - popupWidth - viewportPadding
      )
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
        new Set(values.map((value) => excelFilterBucketValue(value, kind)))
      ).sort((a, b) => {
        if (a === "") return -1;
        if (b === "") return 1;

        if (kind === "number") {
          const aNum = Number(a.replace(",", "."));
          const bNum = Number(b.replace(",", "."));

          if (
            Number.isFinite(aNum) &&
            Number.isFinite(bNum)
          ) {
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
    const needle = search
      .trim()
      .toLocaleLowerCase("es");

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
    distinctValues.length > 0 &&
    distinctValues.every((value) => selectedSet.has(value));

  const active =
    excelFilterIsActive(filter) ||
    Boolean(sortDirection);

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
      onClick={(event) => event.stopPropagation()}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
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

      {open && popupPosition
        ? createPortal(
            <div
              ref={popupRef}
              onClick={(event) => event.stopPropagation()}
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
                    placeholder={kind === "text" ? "Valor..." : undefined}
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
          )
        : null}
    </div>
  );
}

function nextAvailableCode(
  classCode: string,
  classMaxSuffix: Map<string, number>,
  drafts: Record<number, Draft>,
  existingCodes: Set<string>,
  excludeIndex: number | null
) {
  if (!/^\d{3}$/.test(classCode)) return null;
  let nextSuffix = (classMaxSuffix.get(classCode) || 0) + 1;
  const pendingSuffixes = new Set<number>();

  Object.entries(drafts).forEach(([rawIndex, draft]) => {
    if (Number(rawIndex) === excludeIndex) return;
    const code = draft.asset_code.trim();
    if (!/^\d{7}$/.test(code) || code.slice(0, 3) !== classCode || existingCodes.has(code)) return;
    pendingSuffixes.add(Number(code.slice(3)));
  });

  while (pendingSuffixes.has(nextSuffix)) nextSuffix += 1;
  return nextSuffix <= 9999 ? `${classCode}${String(nextSuffix).padStart(4, "0")}` : null;
}

const EXTRA_FIELDS = [
  ["po_num", "O.S."], ["location_name", "Ubicación"], ["assigned_to", "Asignado a"], ["area_name", "Área"],
  ["brand", "Marca"], ["model", "Modelo"], ["serial_number", "Serie"],
  ["cost_center_code", "Centro de costo"], ["depreciation_method", "Método de depreciación"],
  ["asset_comment", "Comentario"],
] as const satisfies ReadonlyArray<readonly [Exclude<keyof Draft, "asset_code" | "line_description" | "capex_code" | "usd_amount" | "pen_amount" | "exc_rate" | "asset_type" | "operation_date" | "asset_situation">, string]>;
type ExtraField = (typeof EXTRA_FIELDS)[number][0];

type NewRowsTableProps = {
  title: string;
  subtitle: string;
  items: NewAssetItem[];
  drafts: Record<number, Draft>;
  states: Record<number, RowState>;
  loading: boolean;
  saving: boolean;
  individualSaveIndexes: ReadonlySet<number>;
  onSaveRow: (index: number) => void;
  onCommit: (index: number, field: keyof Draft, value: string) => void;
  onCodeActivity: (index: number, value: string) => void;
  onFocusDetails: (index: number) => void;
  onOpenDetails: (index: number) => void;
  onOpenVrDetails: (index: number) => void;
  focusedDetailIndex: number | null;
  existingByIndex: ReadonlyMap<number, CatalogueRow>;
  storedVrCountByIndex: ReadonlyMap<number, number>;
  collapsed: boolean;
  hideSaved: boolean;
  onToggleSaved: () => void;
};

const NewRowsTable = memo(function NewRowsTable({
  title,
  subtitle,
  items,
  drafts,
  states,
  loading,
  saving,
  individualSaveIndexes,
  onSaveRow,
  onCommit,
  onCodeActivity,
  onFocusDetails,
  onOpenDetails,
  onOpenVrDetails,
  focusedDetailIndex,
  existingByIndex,
  storedVrCountByIndex,
  collapsed,
  hideSaved,
  onToggleSaved,
}: NewRowsTableProps) {
  const [columnFilters, setColumnFilters] = useState<
    Partial<Record<TableColumnKey, ExcelColumnFilter>>
  >({});

  const [excelSort, setExcelSort] = useState<{
    key: TableColumnKey;
    direction: ExcelSortDirection;
  } | null>(null);

  useEffect(() => {
    setColumnFilters({});
    setExcelSort(null);
  }, [items]);

  const excelColumnValues = useMemo(() => {
    const result: Partial<Record<TableColumnKey, string[]>> = {};

    COLUMNS.forEach((column) => {
      result[column.key] = items.map((item) => {
        const { row, index, readOnly } = item;
        const draft = displayDraft(item, drafts);
        const existing = readOnly ? null : existingByIndex.get(index) || null;

        return text(
          newAssetsExcelFilterValue(
            row,
            draft,
            column.key,
            existing
          )
        ).trim();
      });
    });

    return result;
  }, [items, drafts, existingByIndex]);

  const visibleItems = useMemo(() => {
    const filtered = items.filter((item) => {
      const { row, index, readOnly } = item;
      const draft = displayDraft(item, drafts);
      const existing = readOnly ? null : existingByIndex.get(index) || null;

      if (hideSaved && existing) return false;

      return (
        Object.entries(columnFilters) as Array<
          [TableColumnKey, ExcelColumnFilter]
        >
      ).every(([key, filter]) =>
        matchesExcelFilter(
          newAssetsExcelFilterValue(
            row,
            draft,
            key,
            existing
          ),
          filter,
          newAssetsExcelFilterKind(key)
        )
      );
    });

    if (!excelSort) return filtered;

    return [...filtered].sort((a, b) => {
      const aDraft = displayDraft(a, drafts);
      const bDraft = displayDraft(b, drafts);

      const aExisting = a.readOnly ? null : existingByIndex.get(a.index) || null;

      const bExisting = b.readOnly ? null : existingByIndex.get(b.index) || null;

      const comparison = compareExcelValues(
        newAssetsExcelFilterValue(
          a.row,
          aDraft,
          excelSort.key,
          aExisting
        ),
        newAssetsExcelFilterValue(
          b.row,
          bDraft,
          excelSort.key,
          bExisting
        ),
        newAssetsExcelFilterKind(excelSort.key),
        excelSort.direction
      );

      return comparison || a.index - b.index;
    });
  }, [
    items,
    drafts,
    existingByIndex,
    columnFilters,
    excelSort,
    hideSaved,
  ]);

  const hasExcelFilters =
    Object.values(columnFilters).some(excelFilterIsActive) ||
    Boolean(excelSort);

  return (
    <section className="fixassets-new-table" style={{ display: "grid", gridTemplateRows: collapsed ? "auto 0px" : "auto minmax(0, 1fr)", gap: 6, minWidth: 0, minHeight: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "end",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 17 }}>
            {title}{" "}
            <span className="muted">
              ({visibleItems.length}
              {visibleItems.length !== items.length ? ` de ${items.length}` : ""})
            </span>
          </h2>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            {subtitle}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Button
            size="sm"
            onClick={onToggleSaved}
          >
            {hideSaved ? "Mostrar guardados" : "Ocultar guardados"}
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setColumnFilters({});
              setExcelSort(null);
            }}
            disabled={!hasExcelFilters}
          >
            Limpiar filtros
          </Button>
        </div>
      </div>
      <div className="panel-inner fixassets-new-table-grid" style={{ overflow: collapsed ? "hidden" : "auto", height: collapsed ? 0 : "100%", minHeight: 0, padding: 0, background: "#0b4d6b", borderColor: "rgba(147,211,230,.28)" }}>
        <div style={{ minWidth: "max-content" }}>
          <Table disableScrollWrapper>
            <colgroup>
              <col style={{ width: DETAIL_COLUMN_WIDTH, minWidth: DETAIL_COLUMN_WIDTH }} />
              {COLUMNS.map((column) => <col key={column.key} style={{ width: column.width, minWidth: column.width }} />)}
            </colgroup>
            <thead>
              <tr>
                <th
                  className="capex-th"
                  style={{
                    position: "sticky",
                    top: 0,
                    left: 0,
                    zIndex: 94,
                    background: "#163b49",
                    boxShadow: "2px 0 rgba(216,238,255,.16)",
                  }}
                >
                  Detalle
                </th>
                {COLUMNS.map((column) => {
                  const sticky = column.key === "asset_code";

                  return <th
                    key={column.key}
                    className="capex-th"
                    style={{
                      position: "sticky",
                      top: 0,
                      left: sticky ? DETAIL_COLUMN_WIDTH : undefined,
                      zIndex: sticky ? 93 : 79,
                      overflow: "visible",
                      background: "#163b49",
                      boxShadow: sticky
                        ? "2px 0 rgba(216,238,255,.16)"
                        : undefined,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 5,
                      }}
                    >
                      <span>{column.label}</span>

                      <ExcelHeaderFilter
                        label={column.label}
                        kind={newAssetsExcelFilterKind(column.key)}
                        values={excelColumnValues[column.key] || []}
                        filter={columnFilters[column.key]}
                        sortDirection={
                          excelSort?.key === column.key
                            ? excelSort.direction
                            : undefined
                        }
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
                })}
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => {
                const {
                  row,
                  index,
                  isVrGroup,
                  isBaja,
                  readOnly,
                  detailIndexes,
                  selectedDetailIndexes,
                } = item;
                const draft = displayDraft(item, drafts);
                const existing = readOnly ? null : existingByIndex.get(index) || null;
                const bajaMode = isBaja;
                const visibleSelectedCount = existing && storedVrCountByIndex.has(index)
                  ? storedVrCountByIndex.get(index) || 0
                  : selectedDetailIndexes.length;
                const locked = Boolean(existing) || readOnly;
                const state = locked ? "idle" : states[index] || "idle";
                const focused = !locked && focusedDetailIndex === index;
                const background = existing
                  ? "rgba(2,35,52,.82)"
                  : bajaMode
                    ? "rgba(123,79,31,.42)"
                    : readOnly
                      ? "rgba(67,78,86,.48)"
                      : state === "invalid"
                        ? "rgba(216,93,39,.32)"
                        : focused
                          ? "rgba(27,147,227,.34)"
                          : state === "valid"
                            ? "rgba(94,128,25,.32)"
                            : undefined;
                const title = existing
                  ? `Ya existe en catálogo como ${text(existing.asset_code)}`
                  : bajaMode
                    ? "Descripción activo contiene BAJA: fila informativa, sin COD y fuera del guardado."
                    : readOnly
                      ? "Tipo de documento NA: fila informativa, sin COD y fuera del guardado."
                      : isVrGroup
                        ? `Paquete VR: ${visibleSelectedCount} de ${detailIndexes.length} líneas seleccionadas.`
                        : undefined;

                return <tr
                  key={index}
                  className="capex-tr"
                  onClick={() => { if (!locked) onFocusDetails(index); }}
                  title={title}
                  style={{ cursor: locked ? "default" : "pointer" }}
                >
                  <td
                    className="capex-td"
                    style={{
                      padding: 5,
                      position: "sticky",
                      left: 0,
                      zIndex: 22,
                      background: existing
                        ? "#052b3d"
                        : bajaMode
                          ? "#6b491f"
                          : readOnly
                            ? "#394851"
                            : focused
                              ? "#155a78"
                              : "#0b4d6b",
                      boxShadow: "2px 0 rgba(216,238,255,.12)",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      {existing ? (
                        <strong style={{ color: "#b9d7e5", fontSize: 10 }}>Guardado</strong>
                      ) : bajaMode ? (
                        <strong style={{ color: "#ffe0a8", fontSize: 11 }}>BAJA</strong>
                      ) : readOnly ? (
                        <strong style={{ color: "#d7e0e5" }}>NA</strong>
                      ) : (
                        <>
                          {isVrGroup ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenVrDetails(index);
                              }}
                              style={{
                                minWidth: 58,
                                padding: "4px 5px",
                                borderRadius: 7,
                                border: "1px solid rgba(147,211,230,.38)",
                                background: "rgba(27,147,227,.22)",
                                color: "#eefaff",
                                fontSize: 11,
                                fontWeight: 900,
                                cursor: "pointer",
                              }}
                              aria-label={`Abrir detalle del paquete VR de la fila ${index + 1}`}
                            >
                              Ver {visibleSelectedCount}/{detailIndexes.length}
                            </button>
                          ) : null}

                          <button
                            type="button"
                            disabled={loading || saving || state !== "valid" || !individualSaveIndexes.has(index)}
                            onClick={(event) => {
                              event.stopPropagation();
                              onSaveRow(index);
                            }}
                            style={{
                              minWidth: 58,
                              padding: "4px 5px",
                              borderRadius: 7,
                              border: "1px solid rgba(147,178,92,.55)",
                              background: state === "valid"
                                ? "rgba(94,128,25,.34)"
                                : "rgba(255,255,255,.06)",
                              color: state === "valid" ? "#dff1bc" : "rgba(255,255,255,.45)",
                              fontSize: 10,
                              fontWeight: 900,
                              cursor: loading || saving || state !== "valid" || !individualSaveIndexes.has(index) ? "not-allowed" : "pointer",
                            }}
                            aria-label={`Guardar individualmente la fila ${index + 1}`}
                            title={
                              state !== "valid"
                                ? "Completa y corrige la fila antes de guardarla"
                                : individualSaveIndexes.has(index)
                                  ? "Guardar solo esta fila"
                                  : "Guarda primero el correlativo anterior de esta clase"
                            }
                          >
                            Guardar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                  {COLUMNS.map((column) => {
                    const isVrAmount = isVrGroup && (column.key === "usd_amount" || column.key === "pen_amount");
                    const editable = !locked && !isVrAmount && (
                      column.key === "asset_code"
                      || column.key === "line_description"
                      || column.key === "capex_code"
                      || column.key === "usd_amount"
                      || column.key === "pen_amount"
                      || column.key === "exc_rate"
                    );
                    const field = column.key as keyof Draft;
                    const value = column.key === "asset_code"
                      ? existing ? existing.asset_code : readOnly ? "" : draft.asset_code
                      : isVrAmount
                        ? row[column.key as keyof VetaRow]
                        : editable
                          ? draft[field]
                        : row[column.key as keyof VetaRow];
                    const numeric = column.key === "usd_amount" || column.key === "pen_amount" || column.key === "exc_rate";
                    const sticky = column.key === "asset_code";

                    return <td
                      key={column.key}
                      className="capex-td"
                      style={{
                        padding: 5,
                        background: sticky
                          ? existing
                            ? "#052b3d"
                            : readOnly
                              ? "#394851"
                              : state === "invalid"
                                ? "#79453b"
                                : focused
                                  ? "#155a78"
                                  : stickyRowBackground(state)
                          : background,
                        position: sticky ? "sticky" : undefined,
                        left: sticky ? DETAIL_COLUMN_WIDTH : undefined,
                        zIndex: sticky ? 21 : undefined,
                        boxShadow: sticky ? "2px 0 rgba(216,238,255,.12)" : undefined,
                      }}
                    >
                      {editable ? <FastCellInput
                        className="input"
                        value={text(value)}
                        inputMode={column.key === "asset_code" ? "numeric" : numeric ? "decimal" : undefined}
                        maxLength={column.key === "asset_code" ? 7 : undefined}
                        sanitize={column.key === "asset_code"
                          ? (next) => next.replace(/\D/g, "").slice(0, 7)
                          : column.key === "usd_amount" || column.key === "pen_amount"
                            ? (next) => decimalDraft(next, 14)
                            : column.key === "exc_rate"
                              ? (next) => decimalDraft(next, 12)
                              : undefined}
                        onFocus={() => {
                          onOpenDetails(index);
                          if (column.key === "asset_code") onCodeActivity(index, draft.asset_code);
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenDetails(index);
                          if (column.key === "asset_code") onCodeActivity(index, draft.asset_code);
                        }}
                        onLiveChange={column.key === "asset_code" ? (next) => onCodeActivity(index, next) : undefined}
                        onCommit={(next) => onCommit(index, field, next)}
                        style={{ minWidth: column.width - 10, padding: "4px 6px", height: 28, borderRadius: 7, background: "rgba(2,35,52,.42)", borderColor: state === "invalid" ? "#ebb086" : "rgba(147,211,230,.30)" }}
                        aria-label={`${column.label} fila ${index + 1}`}
                      /> : <span title={text(value)}>{
                        column.key.endsWith("date")
                          ? dateOnly(value)
                          : column.key === "usd_amount" || column.key === "pen_amount"
                            ? twoDecimals(value)
                            : text(value)
                      }</span>}
                    </td>;
                  })}
                </tr>;
              })}
              {!loading && !visibleItems.length ? <tr><td className="capex-td" colSpan={COLUMNS.length + 1}>{items.length ? "No hay registros que coincidan con los filtros." : "No hay registros para el periodo seleccionado."}</td></tr> : null}
              {loading ? <tr><td className="capex-td" colSpan={COLUMNS.length + 1}>Cargando activos...</td></tr> : null}
            </tbody>
          </Table>
        </div>
      </div>
    </section>
  );
});

type VrDetailPanelProps = {
  item: NewAssetItem;
  rows: VetaRow[];
  draft: Draft;
  excludedVrIndexes: ReadonlySet<number>;
  storedAssetCodeByDetail: ReadonlyMap<string, string>;
  existing: CatalogueRow | null;
  saving: boolean;
  onToggle: (index: number) => void;
  onClose: () => void;
};

const VrDetailPanel = memo(function VrDetailPanel({
  item,
  rows,
  draft,
  excludedVrIndexes,
  storedAssetCodeByDetail,
  existing,
  saving,
  onToggle,
  onClose,
}: VrDetailPanelProps) {
  const assetCode = text(existing?.asset_code || draft.asset_code).trim();
  const locked = Boolean(existing) || saving;
  const persistedSelectedIndexes = new Set(
    item.detailIndexes.filter((detailIndex) => {
      const row = rows[detailIndex];
      return Boolean(
        row
        && assetCode
        && storedAssetCodeByDetail.get(vetaVrDetailIdentity(row)) === assetCode
      );
    })
  );
  const usePersistedSelection = Boolean(existing && persistedSelectedIndexes.size);
  const isSelected = (detailIndex: number) => usePersistedSelection
    ? persistedSelectedIndexes.has(detailIndex)
    : !excludedVrIndexes.has(detailIndex);
  const selectedDetailItems = item.detailIndexes
    .filter(isSelected)
    .map((detailIndex) => ({ row: rows[detailIndex], index: detailIndex }))
    .filter((entry): entry is IndexedRow => Boolean(entry.row));
  const selectedCount = selectedDetailItems.length;
  const totalPen = twoDecimals(sumVetaAmount(selectedDetailItems, "pen_amount"), false);
  const totalUsd = twoDecimals(sumVetaAmount(selectedDetailItems, "usd_amount"), false);
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        panelRef.current
        && event.target instanceof Node
        && !panelRef.current.contains(event.target)
      ) {
        onClose();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose]);

  return (
    <section
      ref={panelRef}
      className="panel-inner fixassets-new-vr-detail"
      style={{
        position: "static",
        maxHeight: "min(68vh, 520px)",
        padding: 10,
        overflow: "hidden",
        background: "var(--panel2)",
        borderColor: "rgba(147,211,230,.52)",
        boxShadow: "0 10px 30px rgba(0,0,0,.24)",
        display: "grid",
        gridTemplateRows: "auto auto minmax(0, 1fr)",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <strong>Detalle del paquete VR</strong>
          <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
            COD {assetCode || "sin proponer"} · Cuenta {text(item.row.account_code) || "—"} · {selectedCount}/{item.detailIndexes.length} líneas
          </span>
        </div>
        <Button size="sm" onClick={onClose}>Cerrar detalle</Button>
      </div>

      <div
        className="panel-inner"
        style={{
          padding: "7px 9px",
          borderColor: "rgba(147,211,230,.34)",
          background: "rgba(2,35,52,.32)",
          fontSize: 12,
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <span><strong>Subdiario:</strong> {text(item.row.subjournal_code) || "—"}</span>
        <span><strong>Comprobante:</strong> {text(item.row.voucher_number) || "—"}</span>
        <span><strong>Secuencia:</strong> {text(item.row.sequence_number) || "—"}</span>
        <span><strong>Anexo:</strong> {text(item.row.annex_code) || "—"}</span>
        <span><strong>Total PEN:</strong> {totalPen}</span>
        <span><strong>Total USD:</strong> {totalUsd}</span>
        <span className="muted">
          {existing
            ? "El paquete ya existe en catálogo; la selección queda bloqueada."
            : "Desmarca una línea para excluirla del POST veta-vr; su COD se limpia inmediatamente y los totales master se recalculan."}
        </span>
      </div>

      <div style={{ overflow: "auto", minHeight: 0, border: "1px solid rgba(147,211,230,.22)", borderRadius: 9 }}>
        <div style={{ minWidth: "max-content" }}>
          <Table disableScrollWrapper>
            <colgroup>
              <col style={{ width: 74, minWidth: 74 }} />
              {COLUMNS.map((column) => <col key={column.key} style={{ width: column.width, minWidth: column.width }} />)}
            </colgroup>
            <thead>
              <tr>
                <th className="capex-th" style={{ position: "sticky", top: 0, left: 0, zIndex: 94, background: "#163b49" }}>
                  Incluir
                </th>
                {COLUMNS.map((column) => {
                  const sticky = column.key === "asset_code";
                  return <th
                    key={column.key}
                    className="capex-th"
                    style={{
                      position: "sticky",
                      top: 0,
                      left: sticky ? 74 : undefined,
                      zIndex: sticky ? 93 : 79,
                      background: "#163b49",
                    }}
                  >
                    {column.label}
                  </th>;
                })}
              </tr>
            </thead>
            <tbody>
              {item.detailIndexes.map((detailIndex) => {
                const row = rows[detailIndex];
                if (!row) return null;
                const selected = isSelected(detailIndex);

                return <tr
                  key={detailIndex}
                  className="capex-tr"
                  style={{
                    opacity: selected ? 1 : 0.58,
                    background: selected ? "rgba(94,128,25,.17)" : "rgba(67,78,86,.38)",
                  }}
                >
                  <td
                    className="capex-td"
                    style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 22,
                      textAlign: "center",
                      background: selected ? "#315b43" : "#394851",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={locked}
                      onChange={() => onToggle(detailIndex)}
                      aria-label={`${selected ? "Excluir" : "Incluir"} línea VR ${detailIndex + 1}`}
                      style={{ width: 16, height: 16, cursor: locked ? "not-allowed" : "pointer" }}
                    />
                  </td>
                  {COLUMNS.map((column) => {
                    const sticky = column.key === "asset_code";
                    const value = column.key === "asset_code"
                      ? selected ? assetCode : ""
                      : row[column.key as keyof VetaRow];

                    return <td
                      key={column.key}
                      className="capex-td"
                      style={{
                        position: sticky ? "sticky" : undefined,
                        left: sticky ? 74 : undefined,
                        zIndex: sticky ? 21 : undefined,
                        background: sticky
                          ? selected ? "#416f43" : "#394851"
                          : undefined,
                        boxShadow: sticky ? "2px 0 rgba(216,238,255,.12)" : undefined,
                      }}
                    >
                      <span title={text(value)}>{
                        column.key.endsWith("date")
                          ? dateOnly(value)
                          : column.key === "usd_amount" || column.key === "pen_amount"
                            ? twoDecimals(value)
                            : text(value)
                      }</span>
                    </td>;
                  })}
                </tr>;
              })}
            </tbody>
          </Table>
        </div>
      </div>
    </section>
  );
});

export default function FixAssetsNew() {
  const initialPeriod = useMemo(currentPeriod, []);
  const autoCodeIndexesRef = useRef<Set<number>>(new Set());
  const [rows, setRows] = useState<VetaRow[]>([]);
  const [vetaVrRows, setVetaVrRows] = useState<VetaVrStoredRow[]>([]);
  const [catalogueRows, setCatalogueRows] = useState<CatalogueRow[]>([]);
  const [cecoByCode, setCecoByCode] = useState<Record<string, string>>({});
  const [codePrefixByAccount, setCodePrefixByAccount] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [existingCodes, setExistingCodes] = useState<Set<string>>(new Set());
  const [year, setYear] = useState(initialPeriod.year);
  const [monthFrom, setMonthFrom] = useState(initialPeriod.month);
  const [monthTo, setMonthTo] = useState(initialPeriod.month);
  const [activeCodePrefix, setActiveCodePrefix] = useState("");
  const [activeCodeIndex, setActiveCodeIndex] = useState<number | null>(null);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [vrDetailIndex, setVrDetailIndex] = useState<number | null>(null);
  const [excludedVrIndexes, setExcludedVrIndexes] = useState<Set<number>>(new Set());
  const [skippedCodeIndexes, setSkippedCodeIndexes] = useState<Set<number>>(new Set());
  const [hideSavedNormalRows, setHideSavedNormalRows] = useState(false);
  const [hideSavedCapexRows, setHideSavedCapexRows] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [veta, vetaVr, catalogue, ceco, mapping, softPo] = await Promise.all([
        apiGet("/api/actfij/veta"),
        apiGet("/api/actfij/veta-vr"),
        apiGet("/api/actfij/catalogue"),
        apiGet("/api/actfij/ceco"),
        apiGet("/api/actfij/mapping"),
        apiGet("/api/actfij/soft-po"),
      ]);
      const nextRows = (Array.isArray(veta?.rows) ? (veta.rows as VetaRow[]) : [])
        .filter((row) => dateOnly(row.comp_date) >= "2026-01-01");
      const nextVetaVrRows = Array.isArray(vetaVr?.rows) ? (vetaVr.rows as VetaVrStoredRow[]) : [];
      const nextCatalogue = Array.isArray(catalogue?.rows) ? catalogue.rows as CatalogueRow[] : [];
      const nextSoftPoRows = Array.isArray(softPo?.rows) ? softPo.rows as SoftPoRow[] : [];
      const nextCecoByCode = (Array.isArray(ceco?.rows) ? ceco.rows as CecoRow[] : [])
        .reduce<Record<string, string>>((current, row) => {
          const code = costCenterCode(text(row.cost_center_code));
          if (code) current[code] = text(row.cost_center_description).trim();
          return current;
        }, {});
      const nextCodePrefixByAccount = (Array.isArray(mapping?.rows) ? mapping.rows as MappingRow[] : [])
        .reduce<Record<string, string>>((current, row) => {
          const accountCode = text(row.origin_account_code).trim();
          const prefix = text(row.correlative_start).trim();
          if (accountCode && /^\d{3}$/.test(prefix)) current[accountCode] = prefix;
          return current;
        }, {});
      const poBySource = new Map<string, string>();

      nextSoftPoRows.forEach((row) => {
        const key = sourceIdentity(row);
        const poNum = text(row.po_num).trim();

        if (key && poNum && !poBySource.has(key)) {
          poBySource.set(key, poNum);
        }
      });

      const nextDrafts: Record<number, Draft> = {};

      nextRows.forEach((row, index) => {
        const draft = draftFrom(row);
        draft.po_num = poBySource.get(sourceIdentity(row)) || "";
        nextDrafts[index] = draft;
      });

      autoCodeIndexesRef.current.clear();
      setRows(nextRows);
      setVetaVrRows(nextVetaVrRows);
      setCatalogueRows(nextCatalogue);
      setCecoByCode(nextCecoByCode);
      setCodePrefixByAccount(nextCodePrefixByAccount);
      setDrafts(nextDrafts);
      setExistingCodes(new Set(nextCatalogue.map((row) => text(row.asset_code).trim()).filter(Boolean)));
      const now = currentPeriod();
      setYear(now.year);
      setMonthFrom(now.month);
      setMonthTo(now.month);
      setActiveCodePrefix("");
      setActiveCodeIndex(null);
      setDetailIndex(null);
      setVrDetailIndex(null);
      setExcludedVrIndexes(new Set());
      setSkippedCodeIndexes(new Set());
      setIsError(false);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "No se pudo cargar la información");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const years = useMemo(() => Array.from(new Set<string>([
    initialPeriod.year,
    ...rows
      .map((row) => monthOf(row.comp_date)?.year)
      .filter((value): value is string => Boolean(value)),
  ]))
    .filter((value) => (
      value >= "2026"
      && value <= initialPeriod.year
    ))
    .sort()
    .reverse(),
  [rows, initialPeriod.year]);

  const monthOptions = useMemo(() => MONTHS
    .map((label, index) => ({
      value: String(index + 1).padStart(2, "0"),
      label,
    }))
    .filter((option) => {
      if (year === initialPeriod.year && option.value > initialPeriod.month) return false;
      return true;
    }),
  [year, initialPeriod.year, initialPeriod.month]);

  const classMaxSuffix = useMemo(() => {
    const result = new Map<string, number>();
    existingCodes.forEach((code) => {
      if (!/^\d{7}$/.test(code)) return;
      const classCode = code.slice(0, 3);
      const suffix = Number(code.slice(3));
      result.set(classCode, Math.max(result.get(classCode) || 0, suffix));
    });
    return result;
  }, [existingCodes]);

  const catalogueBySource = useMemo(() => {
    const result = new Map<string, CatalogueRow>();
    catalogueRows.forEach((row) => {
      const key = sourceIdentity(row);
      if (key) result.set(key, row);
    });
    return result;
  }, [catalogueRows]);

  const catalogueByVrGroup = useMemo(() => {
    const result = new Map<string, CatalogueRow>();
    catalogueRows.forEach((row) => {
      if (identityPart(row.source_name) !== "VR") return;
      const key = catalogueVrGroupIdentity(row);
      if (key) result.set(key, row);
    });
    return result;
  }, [catalogueRows]);

  const catalogueByCode = useMemo(() => {
    const result = new Map<string, CatalogueRow>();
    catalogueRows.forEach((row) => {
      const code = text(row.asset_code).trim();
      if (code) result.set(code, row);
    });
    return result;
  }, [catalogueRows]);

  const vetaVrAssetCodeByDetail = useMemo(() => {
    const result = new Map<string, string>();
    vetaVrRows.forEach((row) => {
      if (identityPart(row.map_type) !== "VR") return;
      const code = text(row.asset_code).trim();
      if (code) result.set(vetaVrDetailIdentity(row), code);
    });
    return result;
  }, [vetaVrRows]);

  const vetaVrStoredUpdateKeys = useMemo(() => {
    const result = new Set<string>();
    vetaVrRows.forEach((row) => {
      if (
        identityPart(row.map_type) === "VR"
        && text(row.asset_code).trim()
      ) {
        result.add(vetaVrUpdateIdentity(row));
      }
    });
    return result;
  }, [vetaVrRows]);

  const catalogueCecoCodes = useMemo(() => Array.from(new Set(
    catalogueRows
      .map((row) => costCenterCode(text(row.cost_center_code)))
      .filter((code) => Boolean(code) && Object.prototype.hasOwnProperty.call(cecoByCode, code))
  )).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [catalogueRows, cecoByCode]);

  const suggestionsByField = useMemo(() => {
    const sets = {} as Record<ExtraField, Set<string>>;
    EXTRA_FIELDS.forEach(([field]) => { sets[field] = new Set<string>(); });
    catalogueRows.forEach((row) => {
      EXTRA_FIELDS.forEach(([field]) => {
        const value = text(row[field as keyof CatalogueRow]).trim();
        if (value) sets[field].add(value);
      });
    });
    Object.values(drafts).forEach((draft) => {
      EXTRA_FIELDS.forEach(([field]) => {
        const value = draft[field].trim();
        if (value) sets[field].add(value);
      });
    });
    const result = {} as Record<ExtraField, string[]>;
    EXTRA_FIELDS.forEach(([field]) => {
      result[field] = Array.from(sets[field]).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
    });
    return result;
  }, [catalogueRows, drafts]);

  const filteredRows = useMemo(() => rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const value = monthOf(row.comp_date);

      if (
        !value
        || value.year !== year
        || value.month < monthFrom
        || value.month > monthTo
      ) {
        return false;
      }

      return true;
    }), [rows, year, monthFrom, monthTo]);

  const normalSourceRows = useMemo(
    () => filteredRows.filter(({ row }) => !text(row.capex_code).trim()),
    [filteredRows]
  );

  const capexSourceRows = useMemo(
    () => filteredRows
      .filter(({ row }) => Boolean(text(row.capex_code).trim()))
      .sort((a, b) => text(a.row.capex_code).localeCompare(
        text(b.row.capex_code),
        undefined,
        { numeric: true, sensitivity: "base" }
      )),
    [filteredRows]
  );

  const persistedExcludedVrIndexes = useMemo(() => {
    const result = new Set<number>();
    const unfilteredGroups = [
      ...buildNewAssetItems(normalSourceRows, new Set<number>()),
      ...buildNewAssetItems(capexSourceRows, new Set<number>()),
    ].filter((item) => item.isVrGroup);

    unfilteredGroups.forEach((item) => {
      const linkedCodes = item.detailIndexes
        .map((detailIndex) => rows[detailIndex])
        .filter((row): row is VetaRow => Boolean(row))
        .map((row) => vetaVrAssetCodeByDetail.get(vetaVrDetailIdentity(row)) || "")
        .filter((code) => Boolean(code && catalogueByCode.has(code)));

      const storedAssetCode = linkedCodes[0] || "";
      if (!storedAssetCode) return;

      item.detailIndexes.forEach((detailIndex) => {
        const row = rows[detailIndex];
        if (
          !row
          || vetaVrAssetCodeByDetail.get(vetaVrDetailIdentity(row)) !== storedAssetCode
        ) {
          result.add(detailIndex);
        }
      });
    });

    return result;
  }, [
    normalSourceRows,
    capexSourceRows,
    rows,
    vetaVrAssetCodeByDetail,
    catalogueByCode,
  ]);

  const effectiveExcludedVrIndexes = useMemo(() => new Set([
    ...persistedExcludedVrIndexes,
    ...excludedVrIndexes,
  ]), [persistedExcludedVrIndexes, excludedVrIndexes]);

  const normalRows = useMemo(
    () => buildNewAssetItems(normalSourceRows, effectiveExcludedVrIndexes),
    [normalSourceRows, effectiveExcludedVrIndexes]
  );

  const capexRows = useMemo(
    () => buildNewAssetItems(capexSourceRows, effectiveExcludedVrIndexes),
    [capexSourceRows, effectiveExcludedVrIndexes]
  );

  const displayedItems = useMemo(
    () => [...normalRows, ...capexRows],
    [normalRows, capexRows]
  );

  const itemByIndex = useMemo(() => {
    const result = new Map<number, NewAssetItem>();
    displayedItems.forEach((item) => result.set(item.index, item));
    return result;
  }, [displayedItems]);

  const existingByIndex = useMemo(() => {
    const result = new Map<number, CatalogueRow>();

    displayedItems.forEach((item) => {
      let existing: CatalogueRow | undefined;

      if (item.isVrGroup) {
        const linkedCode = item.detailIndexes
          .map((index) => rows[index])
          .filter((row): row is VetaRow => Boolean(row))
          .map((row) => vetaVrAssetCodeByDetail.get(vetaVrDetailIdentity(row)))
          .find((code): code is string => Boolean(code && catalogueByCode.has(code)));

        existing = linkedCode
          ? catalogueByCode.get(linkedCode)
          : catalogueByVrGroup.get(vrGroupIdentity(item.row));
      } else {
        existing = catalogueBySource.get(sourceIdentity(item.row));
      }

      if (existing) result.set(item.index, existing);
    });

    return result;
  }, [
    displayedItems,
    rows,
    catalogueBySource,
    catalogueByVrGroup,
    catalogueByCode,
    vetaVrAssetCodeByDetail,
  ]);

  const normalRowsCollapsed = useMemo(
    () => (
      hideSavedNormalRows
      && normalRows.length > 0
      && normalRows.every(
        (item) => !item.readOnly && existingByIndex.has(item.index)
      )
    ),
    [hideSavedNormalRows, normalRows, existingByIndex]
  );

  const capexRowsCollapsed = useMemo(
    () => (
      hideSavedCapexRows
      && capexRows.length > 0
      && capexRows.every(
        (item) => !item.readOnly && existingByIndex.has(item.index)
      )
    ),
    [hideSavedCapexRows, capexRows, existingByIndex]
  );

  const storedVrCountByIndex = useMemo(() => {
    const result = new Map<number, number>();

    displayedItems.forEach((item) => {
      if (!item.isVrGroup) return;
      const assetCode = text(existingByIndex.get(item.index)?.asset_code).trim();
      if (!assetCode) return;

      const count = item.detailIndexes.reduce((total, detailIndex) => {
        const row = rows[detailIndex];
        return total + Number(
          Boolean(
            row
            && vetaVrAssetCodeByDetail.get(vetaVrDetailIdentity(row)) === assetCode
          )
        );
      }, 0);

      if (count > 0) result.set(item.index, count);
    });

    return result;
  }, [displayedItems, existingByIndex, rows, vetaVrAssetCodeByDetail]);

  const codeValidationItems = useMemo(() => displayedItems.filter((item) => (
    !item.readOnly
    && !item.isBaja
    && !skippedCodeIndexes.has(item.index)
    && !existingByIndex.has(item.index)
    && (!item.isVrGroup || item.selectedDetailIndexes.length > 0)
  )), [displayedItems, skippedCodeIndexes, existingByIndex]);

  const codeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    codeValidationItems.forEach(({ index }) => {
      const code = drafts[index]?.asset_code.trim() || "";
      if (code) counts.set(code, (counts.get(code) || 0) + 1);
    });
    return counts;
  }, [codeValidationItems, drafts]);

  useEffect(() => {
    if (!displayedItems.length) return;

    const currentVrDetailIndexes = new Set<number>();
    const currentVrMasterIndexes = new Set<number>();

    displayedItems.forEach((item) => {
      if (!item.isVrGroup) return;
      currentVrMasterIndexes.add(item.index);
      item.detailIndexes.forEach((index) => currentVrDetailIndexes.add(index));
    });

    setDrafts((current) => {
      const next = { ...current };
      let changed = false;

      rows.forEach((row, index) => {
        const mustClearCode = isNaDocument(row)
          || isBajaDescription(row)
          || (currentVrDetailIndexes.has(index) && !currentVrMasterIndexes.has(index));

        if (mustClearCode && next[index]?.asset_code) {
          next[index] = { ...next[index], asset_code: "" };
          autoCodeIndexesRef.current.delete(index);
          changed = true;
        }
      });

      displayedItems.forEach((item) => {
        const itemMustClearCode = item.isBaja || item.readOnly;

        if (itemMustClearCode && next[item.index]?.asset_code) {
          next[item.index] = { ...next[item.index], asset_code: "" };
          autoCodeIndexesRef.current.delete(item.index);
          changed = true;
        }

        if (!item.isVrGroup) return;

        const draft = next[item.index] || draftFrom(item.row);
        const usdAmount = twoDecimals(item.row.usd_amount, false);
        const penAmount = twoDecimals(item.row.pen_amount, false);

        if (item.selectedDetailIndexes.length === 0 && draft.asset_code) {
          next[item.index] = { ...draft, asset_code: "" };
          autoCodeIndexesRef.current.delete(item.index);
          changed = true;
        }

        const amountDraft = next[item.index] || draft;

        if (amountDraft.usd_amount !== usdAmount || amountDraft.pen_amount !== penAmount) {
          next[item.index] = {
            ...amountDraft,
            usd_amount: usdAmount,
            pen_amount: penAmount,
          };
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [displayedItems, rows]);

  const codeCandidates = useMemo(() => displayedItems
    .filter((item) => (
      !item.readOnly
      && !item.isBaja
      && !skippedCodeIndexes.has(item.index)
      && !existingByIndex.has(item.index)
      && (!item.isVrGroup || item.selectedDetailIndexes.length > 0)
    ))
    .map((item) => ({
      item,
      prefix: codePrefixByAccount[text(item.row.account_code).trim()] || "",
    }))
    .filter(({ prefix }) => /^\d{3}$/.test(prefix))
    .sort((a, b) => {
      const prefixOrder = a.prefix.localeCompare(b.prefix, undefined, { numeric: true });
      if (prefixOrder) return prefixOrder;
      const dateOrder = (dateOnly(a.item.row.comp_date) || "9999-12-31")
        .localeCompare(dateOnly(b.item.row.comp_date) || "9999-12-31");
      if (dateOrder) return dateOrder;
      const glosaOrder = text(a.item.row.line_description).localeCompare(
        text(b.item.row.line_description),
        "es",
        { numeric: true, sensitivity: "base" }
      );
      return glosaOrder || a.item.index - b.item.index;
    }), [displayedItems, skippedCodeIndexes, existingByIndex, codePrefixByAccount]);

  useEffect(() => {
    if (loading) return;

    setDrafts((current) => {
      const previousAutoIndexes = autoCodeIndexesRef.current;
      const nextAutoIndexes = new Set<number>();
      const next = { ...current };
      let changed = false;

      previousAutoIndexes.forEach((index) => {
        const draft = next[index];
        if (draft?.asset_code) {
          next[index] = { ...draft, asset_code: "" };
          changed = true;
        }
      });

      codeCandidates.forEach(({ item, prefix }) => {
        const currentDraft = next[item.index] || draftFrom(item.row);
        const hadAutomaticCode = previousAutoIndexes.has(item.index);
        const manualCode = !hadAutomaticCode
          ? text(current[item.index]?.asset_code).trim()
          : "";

        if (manualCode) return;

        const code = nextAvailableCode(
          prefix,
          classMaxSuffix,
          next,
          existingCodes,
          null
        );

        if (!code) return;

        if (currentDraft.asset_code !== code) {
          next[item.index] = { ...currentDraft, asset_code: code };
          changed = true;
        }
        nextAutoIndexes.add(item.index);
      });

      autoCodeIndexesRef.current = nextAutoIndexes;
      return changed ? next : current;
    });
  }, [loading, codeCandidates, classMaxSuffix, existingCodes]);

  const sequentialCodes = useMemo(() => {
    const suffixesByClass = new Map<string, Array<{ code: string; suffix: number }>>();
    codeValidationItems.forEach(({ index }) => {
      const draft = drafts[index];
      if (!draft) return;
      const code = draft.asset_code.trim();
      if (!/^\d{7}$/.test(code) || existingCodes.has(code) || (codeCounts.get(code) || 0) > 1) return;
      const classCode = code.slice(0, 3);
      const entries = suffixesByClass.get(classCode) || [];
      entries.push({ code, suffix: Number(code.slice(3)) });
      suffixesByClass.set(classCode, entries);
    });
    const valid = new Set<string>();
    suffixesByClass.forEach((entries, classCode) => {
      let expected = (classMaxSuffix.get(classCode) || 0) + 1;
      entries.sort((a, b) => a.suffix - b.suffix).forEach((entry) => {
        if (entry.suffix === expected) {
          valid.add(entry.code);
          expected += 1;
        }
      });
    });
    return valid;
  }, [codeValidationItems, drafts, existingCodes, codeCounts, classMaxSuffix]);

  const states = useMemo(() => {
    const result: Record<number, RowState> = {};

    displayedItems.forEach((item) => {
      const { row, index } = item;
      const draft = drafts[index];

      if (
        item.readOnly
        || (item.isVrGroup && item.selectedDetailIndexes.length === 0)
        || !draft?.asset_code.trim()
      ) {
        result[index] = "idle";
        return;
      }

      const code = draft.asset_code.trim();
      const requiredPrefix = codePrefixByAccount[text(row.account_code).trim()] || "";
      const usdAmount = item.isVrGroup ? twoDecimals(row.usd_amount, false) : draft.usd_amount;
      const penAmount = item.isVrGroup ? twoDecimals(row.pen_amount, false) : draft.pen_amount;
      result[index] = !/^\d{7}$/.test(code)
        || !/^\d{3}$/.test(requiredPrefix)
        || code.slice(0, 3) !== requiredPrefix
        || existingCodes.has(code)
        || (codeCounts.get(code) || 0) > 1
        || !sequentialCodes.has(code)
        || !validNumber(usdAmount, 14)
        || !validNumber(penAmount, 14)
        || !validNumber(draft.exc_rate, 12, true)
        ? "invalid" : "valid";
    });

    return result;
  }, [displayedItems, drafts, existingCodes, codeCounts, sequentialCodes, codePrefixByAccount]);

  const selectedItems = useMemo(() => displayedItems.filter((item) => (
    !item.readOnly
    && !item.isBaja
    && !skippedCodeIndexes.has(item.index)
    && !existingByIndex.has(item.index)
    && Boolean(drafts[item.index]?.asset_code.trim())
    && (!item.isVrGroup || item.selectedDetailIndexes.length > 0)
  )), [displayedItems, skippedCodeIndexes, drafts, existingByIndex]);

  const selectedIndexes = useMemo(
    () => selectedItems.map(({ index }) => index),
    [selectedItems]
  );

  const invalidCount = selectedItems.filter(({ index }) => states[index] === "invalid").length;
  const canSave = selectedItems.length > 0 && invalidCount === 0 && !loading && !saving;

  const individualSaveIndexes = useMemo(() => {
    const result = new Set<number>();

    selectedItems.forEach(({ index }) => {
      if (states[index] === "valid") result.add(index);
    });

    return result;
  }, [selectedItems, states]);

  const catalogueLastMatch = useMemo(() => {
    const prefix = activeCodePrefix.trim();
    if (!prefix) return null;
    return catalogueRows.reduce<CatalogueRow | null>((latest, row) => {
      const code = text(row.asset_code);
      if (!code.startsWith(prefix)) return latest;
      if (!latest) return row;
      return code.localeCompare(text(latest.asset_code), undefined, { numeric: true }) > 0 ? row : latest;
    }, null);
  }, [catalogueRows, activeCodePrefix]);

  const activeRequiredCode = useMemo(() => {
    if (activeCodePrefix.length < 3) return null;
    return nextAvailableCode(
      activeCodePrefix.slice(0, 3),
      classMaxSuffix,
      drafts,
      existingCodes,
      activeCodeIndex
    );
  }, [activeCodePrefix, activeCodeIndex, classMaxSuffix, drafts, existingCodes]);

  const updateDraft = useCallback((index: number, field: keyof Draft, value: string) => {
    if (field === "asset_code") {
      autoCodeIndexesRef.current.delete(index);

      setSkippedCodeIndexes((current) => {
        const next = new Set(current);

        if (value.trim()) {
          next.delete(index);
        } else {
          next.add(index);
        }

        return next;
      });
    }

    setDrafts((current) => ({ ...current, [index]: { ...current[index], [field]: value } }));
    setMessage("");
  }, []);

  const commitCostCenter = useCallback((index: number, value: string) => {
    const code = costCenterCode(value);
    if (!code) {
      updateDraft(index, "cost_center_code", "");
      setIsError(false);
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(cecoByCode, code)) {
      setIsError(true);
      setMessage(`Centro de costo ${code} no existe.`);
      return;
    }
    updateDraft(index, "cost_center_code", code);
    setIsError(false);
  }, [cecoByCode, updateDraft]);

  const handleCodeActivity = useCallback((index: number, value: string) => {
    setActiveCodeIndex(index);
    setActiveCodePrefix(value.replace(/\D/g, "").slice(0, 7));
  }, []);

  const detailItem = detailIndex == null ? null : itemByIndex.get(detailIndex) || null;
  const detailRow = detailItem?.row || null;
  const detailDraft = detailIndex == null ? null : drafts[detailIndex];
  const vrDetailItem = vrDetailIndex == null ? null : itemByIndex.get(vrDetailIndex) || null;
  const vrDetailExisting = vrDetailIndex == null ? null : existingByIndex.get(vrDetailIndex) || null;

  useEffect(() => {
    if (detailIndex != null && !itemByIndex.has(detailIndex)) {
      setDetailIndex(null);
      setActiveCodeIndex(null);
      setActiveCodePrefix("");
    }
    if (vrDetailIndex != null && !itemByIndex.has(vrDetailIndex)) {
      setVrDetailIndex(null);
    }
  }, [detailIndex, vrDetailIndex, itemByIndex]);

  const openDetails = useCallback((index: number) => {
    setDetailIndex(index);
    setActiveCodeIndex(index);
    setActiveCodePrefix((drafts[index]?.asset_code || "").replace(/\D/g, "").slice(0, 7));
  }, [drafts]);
  const focusDetails = useCallback((index: number) => {
    if (detailIndex === index) {
      setDetailIndex(null);
      return;
    }
    openDetails(index);
  }, [detailIndex, openDetails]);

  const openVrDetails = useCallback((index: number) => {
    setVrDetailIndex(index);
  }, []);

  const toggleVrDetail = useCallback((index: number) => {
    setExcludedVrIndexes((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    setMessage("");
    setIsError(false);
  }, []);

  async function saveItems(
    itemsToSave: NewAssetItem[],
    draftSource: Record<number, Draft> = drafts
  ) {
    if (
      !itemsToSave.length
      || loading
      || saving
      || itemsToSave.some(({ index }) => states[index] !== "valid")
    ) {
      return;
    }

    const selectedItems = itemsToSave;

    setSaving(true);
    setMessage("");
    setIsError(false);
    let saved = 0;
    let savedVrDetails = 0;

    const vrDetailPayloads = selectedItems.flatMap((item) => {
      if (!item.isVrGroup) return [];
      const assetCode = draftSource[item.index].asset_code.trim();

      return item.selectedDetailIndexes
        .map((detailIndex) => {
          const row = rows[detailIndex];
          return {
            asset_code: assetCode,
            account_code: row.account_code,
            account_description: row.account_description,
            comp_date: dateOnly(row.comp_date) || null,
            subjournal_code: row.subjournal_code,
            voucher_number: row.voucher_number,
            sequence_number: row.sequence_number,
            annex_code: row.annex_code,
            annex_description: row.annex_description,
            document_type: row.document_type,
            document_number: row.document_number,
            document_date: dateOnly(row.document_date) || null,
            voucher_description: row.voucher_description,
            line_description: row.line_description,
            debit_credit: row.debit_credit,
            usd_amount: finiteNumber(row.usd_amount),
            pen_amount: finiteNumber(row.pen_amount),
          };
        })
        .filter((row) => !vetaVrStoredUpdateKeys.has(vetaVrUpdateIdentity(row)));
    });

    const cataloguePayloads = selectedItems.map((item) => {
      const { row, index } = item;
      const draft = draftSource[index];
      const assetIniCostPen = item.isVrGroup
        ? finiteNumber(row.pen_amount)
        : numberOrNull(draft.pen_amount);
      const assetIniCostUsd = item.isVrGroup
        ? finiteNumber(row.usd_amount)
        : numberOrNull(draft.usd_amount);
      return {
        asset_code: draft.asset_code.trim(),
        source_name: item.isVrGroup ? "VR" : "WEB",
        location_name: upperOrNull(draft.location_name),
        origin_account_code: row.account_code,
        capex_code: upperOrNull(draft.capex_code),
        po_num: upperOrNull(draft.po_num),
        subjournal_code: row.subjournal_code,
        voucher_number: row.voucher_number,
        sequence_number: row.sequence_number,
        annex_code: row.annex_code,
        annex_description: row.annex_description,
        document_number: row.document_number,
        asset_description: upperOrNull(draft.line_description),
        assigned_to: upperOrNull(draft.assigned_to),
        area_name: upperOrNull(draft.area_name),
        brand: upperOrNull(draft.brand),
        model: upperOrNull(draft.model),
        serial_number: upperOrNull(draft.serial_number),
        color: null,
        cost_center_code: costCenterCode(draft.cost_center_code) || null,
        comp_date: dateOnly(row.comp_date) || null,
        acquisition_date: dateOnly(row.comp_date) || null,
        operation_date: firstDayNextMonth(row.comp_date) || null,
        disposal_date: null,
        exc_rate: numberOrNull(draft.exc_rate),
        asset_ini_cost_pen: assetIniCostPen,
        asset_ini_cost_usd: assetIniCostUsd,
        depreciation_method: upperOrNull(draft.depreciation_method),
        asset_situation: "OPERATIVO",
        asset_comment: upperOrNull(draft.asset_comment),
      };
    });

    try {
      for (let start = 0; start < vrDetailPayloads.length; start += 100) {
        const chunk = vrDetailPayloads.slice(start, start + 100);
        await apiPost("/api/actfij/veta-vr/insert", { rows: chunk });
        savedVrDetails += chunk.length;
      }

      for (let start = 0; start < cataloguePayloads.length; start += 100) {
        const chunk = cataloguePayloads.slice(start, start + 100);
        await apiPost("/api/actfij/catalogue/insert", {
          rows: chunk,
          register_acquisition: true,
        });
        saved += chunk.length;
      }

      const savedCodes = selectedItems.map(({ index }) => draftSource[index].asset_code.trim());
      if (vrDetailPayloads.length) {
        setVetaVrRows((current) => [
          ...current,
          ...vrDetailPayloads.map((row) => ({
            asset_code: row.asset_code,
            map_type: "VR",
            account_code: row.account_code,
            subjournal_code: row.subjournal_code,
            voucher_number: row.voucher_number,
            sequence_number: row.sequence_number,
            annex_code: row.annex_code,
            document_number: row.document_number,
            line_description: row.line_description,
          })),
        ]);
      }
      setExistingCodes((current) => new Set([...current, ...savedCodes]));
      setCatalogueRows((current) => [
        ...current,
        ...selectedItems.map((item) => {
          const { row, index } = item;
          const draft = draftSource[index];
          const assetIniCostPen = item.isVrGroup
            ? finiteNumber(row.pen_amount)
            : numberOrNull(draft.pen_amount);
          const assetIniCostUsd = item.isVrGroup
            ? finiteNumber(row.usd_amount)
            : numberOrNull(draft.usd_amount);
          return {
            asset_code: draft.asset_code.trim(),
            asset_description: draft.line_description.trim() || null,
            origin_account_code: row.account_code,
            capex_code: draft.capex_code.trim() || null,
            po_num: draft.po_num.trim() || null,
            subjournal_code: row.subjournal_code,
            voucher_number: row.voucher_number,
            sequence_number: row.sequence_number,
            annex_code: row.annex_code,
            document_number: row.document_number,
            location_name: draft.location_name.trim() || null,
            assigned_to: draft.assigned_to.trim() || null,
            area_name: draft.area_name.trim() || null,
            brand: draft.brand.trim() || null,
            model: draft.model.trim() || null,
            serial_number: draft.serial_number.trim() || null,
            cost_center_code: draft.cost_center_code.trim() || null,
            comp_date: dateOnly(row.comp_date) || null,
            acquisition_date: dateOnly(row.comp_date) || null,
            operation_date: firstDayNextMonth(row.comp_date) || null,
            depreciation_method: draft.depreciation_method.trim() || null,
            asset_comment: draft.asset_comment.trim() || null,
            asset_ini_cost_pen: assetIniCostPen,
            asset_ini_cost_usd: assetIniCostUsd,
          };
        }),
      ]);
      setDrafts((current) => {
        const next = { ...current };
        selectedItems.forEach((item) => {
          next[item.index] = draftFrom(item.row);
          autoCodeIndexesRef.current.delete(item.index);
        });
        return next;
      });
      setActiveCodePrefix("");
      setActiveCodeIndex(null);
      setDetailIndex(null);
      setVrDetailIndex(null);
      setMessage(
        `${saved} activo${saved === 1 ? "" : "s"} guardado${saved === 1 ? "" : "s"} correctamente.`
        + (vrDetailPayloads.length
          ? ` ${savedVrDetails} línea${savedVrDetails === 1 ? "" : "s"} VR vinculada${savedVrDetails === 1 ? "" : "s"}.`
          : "")
      );
    } catch (error) {
      setIsError(true);
      const vrProgress = vrDetailPayloads.length
        ? ` Detalle VR: ${savedVrDetails} de ${vrDetailPayloads.length} líneas procesadas.`
        : "";
      setMessage(
        `Se guardaron ${saved} de ${selectedItems.length} activos.${vrProgress} `
        + (error instanceof Error ? error.message : "Error al guardar")
      );
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!canSave) return;
    await saveItems(selectedItems);
  }

  async function saveOne(index: number) {
    const item = selectedItems.find((candidate) => candidate.index === index);

    if (
      !item
      || states[index] !== "valid"
      || !individualSaveIndexes.has(index)
    ) {
      return;
    }

    const currentDraft = drafts[index];
    const classCode = currentDraft?.asset_code.trim().slice(0, 3) || "";
    const firstSuffix = (classMaxSuffix.get(classCode) || 0) + 1;

    const sameClassPending = codeCandidates.filter(({ item: candidate, prefix }) => (
      prefix === classCode
      && candidate.index !== index
    ));

    if (
      !/^\d{3}$/.test(classCode)
      || firstSuffix + sameClassPending.length > 9999
    ) {
      return;
    }

    const nextDrafts = { ...drafts };
    let nextSuffix = firstSuffix;

    const assignCode = (rowIndex: number) => {
      const rowDraft = nextDrafts[rowIndex] || draftFrom(rows[rowIndex]);

      nextDrafts[rowIndex] = {
        ...rowDraft,
        asset_code: `${classCode}${String(nextSuffix).padStart(4, "0")}`,
      };

      nextSuffix += 1;
    };

    assignCode(index);
    sameClassPending.forEach(({ item: candidate }) => {
      assignCode(candidate.index);
    });

    const nextAutoIndexes = new Set(autoCodeIndexesRef.current);
    nextAutoIndexes.add(index);

    sameClassPending.forEach(({ item: candidate }) => {
      nextAutoIndexes.add(candidate.index);
    });

    autoCodeIndexesRef.current = nextAutoIndexes;

    setDrafts(nextDrafts);
    await saveItems([item], nextDrafts);
  }

  const hasExpandedPanel = detailIndex != null || vrDetailIndex != null;

  return (
    <div className="fixassets-new-shell" style={{ position: "relative", display: "grid", gap: 10, height: hasExpandedPanel ? "auto" : "calc(100vh - 205px)", minHeight: 0, overflow: hasExpandedPanel ? "visible" : "hidden" }}>
      <div className="fixassets-new-root" style={{ position: "relative", display: "grid", gridTemplateRows: "auto auto minmax(0, 1fr) auto auto", gap: 10, height: "calc(100vh - 205px)", minHeight: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Nuevos activos desde Veta</h1>
          <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>El COD se propone por cuenta. Las VR se consolidan como paquetes y las NA quedan solo como referencia, sin guardarse.</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
          <Select label="Año" value={year} onChange={(event) => { const value = event.target.value; setYear(value); if (value === initialPeriod.year) { if (monthFrom > initialPeriod.month) setMonthFrom(initialPeriod.month); if (monthTo > initialPeriod.month) setMonthTo(initialPeriod.month); } }} options={years.map((value) => ({ value, label: value }))} placeholder="Todos" style={{ minWidth: 110 }} />
          <Select label="Mes desde" value={monthFrom} onChange={(event) => { const value = event.target.value; setMonthFrom(value); if (value > monthTo) setMonthTo(value); }} options={monthOptions} placeholder="" style={{ minWidth: 145 }} />
          <Select label="Mes hasta" value={monthTo} onChange={(event) => { const value = event.target.value; setMonthTo(value); if (value < monthFrom) setMonthFrom(value); }} options={monthOptions} placeholder="" style={{ minWidth: 145 }} />
          <FixAssetsAudit disabled={loading || saving} />
          <Button size="sm" onClick={() => void load()} disabled={loading || saving}>{loading ? "Cargando..." : "Refrescar"}</Button>
          <Button size="sm" variant="primary" onClick={() => void save()} disabled={!canSave}>{saving ? "Guardando..." : `Guardar (${selectedIndexes.length})`}</Button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 4 }}>
        {message ? <div className="panel-inner" style={{ padding: 8, borderColor: isError ? "rgba(216,93,39,.8)" : "rgba(94,128,25,.9)", background: isError ? "rgba(216,93,39,.18)" : "rgba(94,128,25,.22)", fontWeight: 700 }}>{message}</div> : null}
        {invalidCount ? <div style={{ color: "#ffd0bf", fontWeight: 700, fontSize: 12 }}>{invalidCount} fila(s) con COD fuera de la clase mapeada, existente/duplicado, correlativo saltado, formato inválido o monto incorrecto.</div> : null}
      </div>

      <div
        className="fixassets-new-tables"
        style={{
          display: "grid",
          gridTemplateRows:
            normalRowsCollapsed && capexRowsCollapsed
              ? "auto auto"
              : normalRowsCollapsed
                ? "auto minmax(0, 1fr)"
                : capexRowsCollapsed
                  ? "minmax(0, 1fr) auto"
                  : "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 8,
          minHeight: 0,
        }}
      >
        <NewRowsTable
          title="Activos normales"
          subtitle="Las VR sin BAJA aparecen agrupadas; usa Ver para revisar o excluir líneas del paquete. Las filas con BAJA en Descripción activo se muestran solo como referencia y no entran al guardado."
          items={normalRows}
          drafts={drafts}
          states={states}
          loading={loading}
          saving={saving}
          individualSaveIndexes={individualSaveIndexes}
          onSaveRow={saveOne}
          onCommit={updateDraft}
          onCodeActivity={handleCodeActivity}
          onFocusDetails={focusDetails}
          onOpenDetails={openDetails}
          onOpenVrDetails={openVrDetails}
          focusedDetailIndex={detailIndex}
          existingByIndex={existingByIndex}
          storedVrCountByIndex={storedVrCountByIndex}
          collapsed={normalRowsCollapsed}
          hideSaved={hideSavedNormalRows}
          onToggleSaved={() => setHideSavedNormalRows((current) => !current)}
        />
        <NewRowsTable
          title="Activos CAPEX"
          subtitle="Ordenados por Código CAPEX. Solo las VR sin BAJA se agrupan. Las filas con BAJA en Descripción activo se muestran individualmente y no entran al guardado."
          items={capexRows}
          drafts={drafts}
          states={states}
          loading={loading}
          saving={saving}
          individualSaveIndexes={individualSaveIndexes}
          onSaveRow={saveOne}
          onCommit={updateDraft}
          onCodeActivity={handleCodeActivity}
          onFocusDetails={focusDetails}
          onOpenDetails={openDetails}
          onOpenVrDetails={openVrDetails}
          focusedDetailIndex={detailIndex}
          existingByIndex={existingByIndex}
          storedVrCountByIndex={storedVrCountByIndex}
          collapsed={capexRowsCollapsed}
          hideSaved={hideSavedCapexRows}
          onToggleSaved={() => setHideSavedCapexRows((current) => !current)}
        />
      </div>

      <div className="muted" style={{ fontSize: 12 }}>
        Mostrando {displayedItems.length} filas master desde {filteredRows.length} de {rows.length} líneas fuente: {normalRows.length} normales y {capexRows.length} CAPEX.
      </div>

      {EXTRA_FIELDS.map(([field]) => <datalist key={field} id={`fixassets-new-${field}-options`}>
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

      <style jsx global>{`
        .fixassets-new-table-grid table {
          font-size: 11px !important;
        }
        .fixassets-new-table-grid .capex-th {
          padding: 6px !important;
          font-size: 11px !important;
          background: #163b49 !important;
          white-space: normal !important;
          line-height: 1.1;
        }
        .fixassets-new-table-grid .capex-td {
          padding: 4px 6px !important;
          line-height: 1.15;
          border-bottom-color: rgba(147,211,230,.14) !important;
        }
        .fixassets-new-vr-detail table {
          font-size: 11px !important;
        }
        .fixassets-new-vr-detail .capex-th,
        .fixassets-new-vr-detail .capex-td {
          padding: 5px 6px !important;
          font-size: 11px !important;
          line-height: 1.15;
        }
        @media (max-width: 1100px) {
          .fixassets-new-shell {
            height: auto !important;
            overflow: visible !important;
          }
          .fixassets-new-root {
            height: auto !important;
            overflow: visible !important;
          }
          .fixassets-new-preview {
            position: static !important;
            max-height: none !important;
          }
          .fixassets-new-vr-detail {
            max-height: none !important;
          }
          .fixassets-new-table {
            min-height: 320px !important;
          }
        }
      `}</style>
      </div>

      {vrDetailItem?.isVrGroup && vrDetailIndex != null ? <VrDetailPanel
        item={vrDetailItem}
        rows={rows}
        draft={drafts[vrDetailIndex] || draftFrom(vrDetailItem.row)}
        excludedVrIndexes={effectiveExcludedVrIndexes}
        storedAssetCodeByDetail={vetaVrAssetCodeByDetail}
        existing={vrDetailExisting}
        saving={saving}
        onToggle={toggleVrDetail}
        onClose={() => setVrDetailIndex(null)}
      /> : null}

      {detailRow && detailDraft && detailIndex != null ? <section className="panel-inner fixassets-new-preview" style={{ position: "static", maxHeight: "min(62vh, 370px)", padding: 10, overflow: "auto", background: "var(--panel2)", borderColor: "rgba(147,211,230,.52)", boxShadow: "0 10px 30px rgba(0,0,0,.24)", outline: "none" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
          <div><strong>Ficha complementaria</strong><span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{detailDraft.asset_code || "Sin COD"} · {detailDraft.line_description || text(detailRow.line_description) || "Sin descripción"}</span></div>
          <Button size="sm" onClick={() => setDetailIndex(null)}>Cerrar ficha</Button>
        </div>
        <div className="panel-inner" style={{ padding: "7px 9px", marginBottom: 10, borderColor: "rgba(147,211,230,.34)", background: "rgba(2,35,52,.32)", fontSize: 12 }}>
          <strong>Referencia COD de esta ficha: </strong>
          {!activeCodePrefix || activeCodeIndex !== detailIndex ? <span className="muted">ingresa o enfoca el COD de esta fila para consultar el último correlativo.</span>
            : catalogueLastMatch ? <><span className="muted">último usado con “{activeCodePrefix}”:</span> <strong style={{ color: "#dff1bc" }}>{text(catalogueLastMatch.asset_code)}</strong> — {text(catalogueLastMatch.asset_description) || "Sin descripción"}{activeRequiredCode ? <span style={{ marginLeft: 10, color: "#ffd882", fontWeight: 900 }}>Siguiente obligatorio: {activeRequiredCode}</span> : null}</>
            : <><span style={{ color: "#dff1bc", fontWeight: 800 }}>Sin COD previos con “{activeCodePrefix}”.</span>{activeRequiredCode ? <span style={{ marginLeft: 10, color: "#ffd882", fontWeight: 900 }}>Siguiente obligatorio: {activeRequiredCode}</span> : null}</>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
          {EXTRA_FIELDS.map(([field, label]) => <label key={field} style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 800 }}>
            {label}
            <FastCellInput
              className="input"
              type="text"
              list={`fixassets-new-${field}-options`}
              value={detailDraft[field]}
              sanitize={field === "cost_center_code" ? costCenterCode : undefined}
              onLiveChange={field === "cost_center_code" ? (next) => {
                const code = costCenterCode(next);
                if (!code || Object.prototype.hasOwnProperty.call(cecoByCode, code)) {
                  updateDraft(detailIndex, field, code);
                }
              } : undefined}
              onCommit={(next) => field === "cost_center_code"
                ? commitCostCenter(detailIndex, next)
                : updateDraft(detailIndex, field, next)}
              style={{ height: 32, padding: "5px 8px" }}
            />
            {field === "cost_center_code" && detailDraft.cost_center_code.trim() ? <span className="muted" style={{ minHeight: 15, fontSize: 11, fontWeight: 700 }}>
              {cecoByCode[costCenterCode(detailDraft.cost_center_code)] || "Centro de costo no existe"}
            </span> : null}
          </label>)}
        </div>
      </section> : null}
    </div>
  );
}
