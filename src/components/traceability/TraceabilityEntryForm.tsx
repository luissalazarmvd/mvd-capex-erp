// src/components/traceability/TraceabilityEntryForm.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

type TraceabilityRow = {
  lot: string | null;
  entry_date: string | null;
  process_date: string | null;
  valuation_date: string | null;
  sack_qty: number | null;
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
  zone_1: string | null;
  zone_2: string | null;
  tmh: number | null;
  h2o: number | null;
  tms: number | null;
  au_grade_oztc: number | null;
  ag_grade_oztc: number | null;
  cu_grade_pct: number | null;
  au_oz: number | null;
  ag_oz: number | null;
  au_rec: number | null;
  ag_rec: number | null;
  pio: number | null;
  pip: number | null;
  pio_disc: number | null;
  maquila: number | null;
  nacn: number | null;
  escalador: number | null;
  usd_tms: number | null;
  au_usd: number | null;
  ag_usd: number | null;
  pay_type: string | null;
  monto_calc?: number | null;
  dif_rc?: number | null;
  lot_usd: number | null;
  doc_date: string | null;
  doc_number: string | null;
  payment_date: string | null;
  updated_at?: string | null;
};

type GetResp = {
  ok: boolean;
  rows?: TraceabilityRow[];
  error?: string;
};

type SaveResp = {
  ok: boolean;
  error?: string;
};

type DraftRow = Record<keyof TraceabilityRow, string>;

const EDITABLE_FIELDS = [
  "process_date",
  "transport_name",
  "transport_guide_number",
  "zone_1",
  "zone_2",
  "tmh",
  "h2o",
  "tms",
  "au_grade_oztc",
  "ag_grade_oztc",
  "cu_grade_pct",
  "au_oz",
  "ag_oz",
  "au_rec",
  "ag_rec",
  "pio",
  "pio_disc",
  "maquila",
  "nacn",
  "escalador",
  "ag_usd",
  "pay_type",
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

const NUMERIC_FIELDS: EditableField[] = [
  "tmh",
  "h2o",
  "tms",
  "au_grade_oztc",
  "ag_grade_oztc",
  "cu_grade_pct",
  "au_oz",
  "ag_oz",
  "au_rec",
  "ag_rec",
  "pio",
  "pio_disc",
  "maquila",
  "nacn",
  "escalador",
  "ag_usd",
];

const RANGE_0_100_FIELDS: EditableField[] = ["h2o", "cu_grade_pct"];

type SortKey = keyof TraceabilityRow;

type SortDir = "asc" | "desc";

type ValuationFilter = "all" | "invalid" | "valid" | "pending";

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

const EMPTY_EXCEL_FILTER: ExcelColumnFilter = {
  selected: null,
  operator: "none",
  value1: "",
  value2: "",
};

const SORTABLE_KEYS: SortKey[] = [
  "lot",
  "entry_date",
  "process_date",
  "miner_name",
  "ruc",
  "doc_date",
  "doc_number",
  "dif_rc",
];

const PAGE_SIZE = 100;

const COLUMNS: {
  key: keyof TraceabilityRow;
  label: string;
  editable: boolean;
  kind: "text" | "date" | "number" | "readonly";
  width?: number;
  sortable?: boolean;
}[] = [
  { key: "lot", label: "Lote", editable: false, kind: "readonly", width: 110, sortable: true },
  { key: "entry_date", label: "F. Ingreso", editable: false, kind: "readonly", width: 110, sortable: true },
  { key: "tmh", label: "TMH", editable: true, kind: "number", width: 88 },
  { key: "h2o", label: "H2O", editable: true, kind: "number", width: 88 },
  { key: "tms", label: "TMS", editable: true, kind: "number", width: 88 },
  { key: "au_grade_oztc", label: "Au (Oz/TC)", editable: true, kind: "number", width: 88 },
  { key: "ag_grade_oztc", label: "Ag (Oz/TC)", editable: true, kind: "number", width: 88 },
  { key: "cu_grade_pct", label: "Cu %", editable: true, kind: "number", width: 88 },
  { key: "au_oz", label: "Au Oz", editable: true, kind: "number", width: 88 },
  { key: "ag_oz", label: "Ag Oz", editable: true, kind: "number", width: 88 },
  { key: "au_rec", label: "Au Rec", editable: true, kind: "number", width: 88 },
  { key: "ag_rec", label: "Ag Rec", editable: true, kind: "number", width: 88 },
  { key: "pio", label: "PIO", editable: true, kind: "number", width: 88 },
  { key: "pip", label: "PIP", editable: false, kind: "readonly", width: 88 },
  { key: "pio_disc", label: "PIO Desc.", editable: true, kind: "number", width: 88 },
  { key: "maquila", label: "Maquila", editable: true, kind: "number", width: 88 },
  { key: "nacn", label: "NaCN", editable: true, kind: "number", width: 88 },
  { key: "escalador", label: "Escalador", editable: true, kind: "number", width: 88 },
  { key: "au_usd", label: "Au USD", editable: false, kind: "readonly", width: 88 },
  { key: "ag_usd", label: "Ag USD", editable: true, kind: "number", width: 88 },
  { key: "usd_tms", label: "USD/TMS", editable: false, kind: "readonly", width: 88 },
  { key: "pay_type", label: "Tipo Pago", editable: true, kind: "text", width: 110 },
  { key: "dif_rc", label: "Dif (R-C)", editable: false, kind: "readonly", width: 110, sortable: true },
  { key: "monto_calc", label: "Monto Calc.", editable: false, kind: "readonly", width: 110 },
  { key: "lot_usd", label: "Factura (USD)", editable: false, kind: "readonly", width: 110 },
  { key: "doc_date", label: "F. Factura", editable: false, kind: "readonly", width: 105, sortable: true },
  { key: "doc_number", label: "Factura", editable: false, kind: "readonly", width: 110, sortable: true },
  { key: "payment_date", label: "F. Pago", editable: false, kind: "readonly", width: 105 },
  { key: "sack_qty", label: "Sacos", editable: false, kind: "readonly", width: 78 },
  { key: "miner_name", label: "Minero", editable: false, kind: "readonly", width: 96, sortable: true },
  { key: "plate", label: "Placa", editable: false, kind: "readonly", width: 92 },
  { key: "ruc", label: "RUC", editable: false, kind: "readonly", width: 118, sortable: true },
  { key: "concession_name", label: "Concesión", editable: false, kind: "readonly", width: 145 },
  { key: "concession_code", label: "Cod. Concesión", editable: false, kind: "readonly", width: 120 },
  { key: "district", label: "Distrito", editable: false, kind: "readonly", width: 100 },
  { key: "province", label: "Provincia", editable: false, kind: "readonly", width: 100 },
  { key: "department", label: "Departamento", editable: false, kind: "readonly", width: 120 },
  { key: "sender_guide_number", label: "Guía Remitente", editable: false, kind: "readonly", width: 125 },
  { key: "transport_guide_number", label: "Guía Transportista", editable: false, kind: "readonly", width: 125 },
  { key: "transport_name", label: "Transportista", editable: false, kind: "readonly", width: 125 },
];

function isBlank(v: unknown) {
  return v === null || v === undefined || String(v).trim() === "";
}

function toText(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function toDraftRow(r: TraceabilityRow): DraftRow {
  const out = {} as DraftRow;

  const tmh = r.tmh === null || r.tmh === undefined ? null : Number(r.tmh);
  const h2o = r.h2o === null || r.h2o === undefined ? null : Number(r.h2o);
  const hasTms = !(r.tms === null || r.tms === undefined || String(r.tms).trim() === "");

  const decimals3Keys: (keyof TraceabilityRow)[] = [
    "tmh",
    "cu_grade_pct",
  ];

  const decimals4Keys: (keyof TraceabilityRow)[] = [
    "au_grade_oztc",
    "ag_grade_oztc",
    "nacn",
  ];

  for (const c of COLUMNS) {
    if (c.key === "ag_oz" || c.key === "escalador") {
      out[c.key] = isBlank(r[c.key]) ? "0.00" : toText(r[c.key]);
      continue;
    }

    if (c.key === "tms") {
      if (!hasTms && tmh !== null && h2o !== null) {
        out[c.key] = formatTms6ForEdit(tmh * ((100 - h2o) / 100));
      } else if (!isBlank(r[c.key])) {
        out[c.key] = formatTms6ForEdit(r[c.key]);
      } else {
        out[c.key] = toText(r[c.key]);
      }
      continue;
    }

    if (decimals3Keys.includes(c.key) && !isBlank(r[c.key])) {
      out[c.key] = Number(r[c.key]).toFixed(3);
      continue;
    }

    if (decimals4Keys.includes(c.key) && !isBlank(r[c.key])) {
      out[c.key] = Number(r[c.key]).toFixed(4);
      continue;
    }

    if (c.key === "monto_calc" || c.key === "dif_rc") {
      out[c.key] = "";
      continue;
    }

    if (c.key === "pay_type") {
      out[c.key] = isBlank(r[c.key]) ? "Transferencia" : toText(r[c.key]);
      continue;
    }

    out[c.key] = toText(r[c.key]);
  }

  return out;
}

function parseNum(v: string) {
  const t = String(v ?? "").trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function round4(n: number) {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

function formatTms6ForEdit(value: unknown) {
  const n = parseNum(String(value ?? ""));
  if (n === null) return "";
  return Number(n.toFixed(6)).toString();
}

function formatTms3ForView(value: unknown) {
  const n = parseNum(String(value ?? ""));
  if (n === null) return "";
  return n.toFixed(3);
}

function formatDateTime2_3(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}.${ms}`;
}

function toNumOrNull(v: unknown) {
  const n = parseNum(String(v ?? ""));
  return n === null ? null : n;
}

function formatLotForExport(value: string | null | undefined) {
  const v = String(value || "").trim();
  if (!v) return "";

  const trjMatch = v.match(/^([A-Za-z]+)-\d{2}-(\d+)$/);
  if (trjMatch) {
    const prefix = trjMatch[1].toUpperCase();
    const numberPart = trjMatch[2].replace(/^0+/, "") || "0";
    return `${prefix}-${numberPart}`;
  }

  const normalMatch = v.match(/^\d{2}-(\d+)$/);
  if (normalMatch) {
    return normalMatch[1].replace(/^0+/, "") || "0";
  }

  return v;
}

function pctToDecimal4(value: unknown) {
  const n = toNumOrNull(value);
  if (n === null) return "";
  return Number((n / 100).toFixed(4));
}

function decimal4OrBlank(value: unknown) {
  const n = toNumOrNull(value);
  if (n === null) return "";
  return round4(n);
}

function formatDateDdMmYyyy(value: string | null | undefined) {
  const v = String(value || "").trim();
  if (!v) return "—";

  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;

  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();

  return `${dd}/${mm}/${yyyy}`;
}

function calcAuUsd(draft: DraftRow) {
  const auGrade = toNumOrNull(draft.au_grade_oztc);
  const auRec = toNumOrNull(draft.au_rec);
  const pio = toNumOrNull(draft.pio);
  const pioDisc = toNumOrNull(draft.pio_disc);
  const maquila = toNumOrNull(draft.maquila);
  const nacn = toNumOrNull(draft.nacn);
  const escalador = toNumOrNull(draft.escalador);

  if (
    auGrade === null ||
    auRec === null ||
    pio === null ||
    pioDisc === null ||
    maquila === null ||
    nacn === null ||
    escalador === null
  ) {
    return null;
  }
  return ((round4(auGrade) * auRec*.01) * (pio - pioDisc) - maquila - round4(nacn) - escalador) * 1.1023;
}

function calcUsdTms(draft: DraftRow) {
  const auUsd = calcAuUsd(draft);
  return auUsd === null ? null : auUsd;
}

function calcFacturaCalculada(draft: DraftRow) {
  const usdTms = calcUsdTms(draft);
  const tms = toNumOrNull(draft.tms);
  const agUsd = toNumOrNull(draft.ag_usd);

  if (usdTms === null || tms === null) return null;

  return round2(round2(usdTms) * tms + (agUsd ?? 0));
}

function isUsdValidationOk(draft: DraftRow) {
  const montoCalc = calcFacturaCalculada(draft);
  const lotUsd = toNumOrNull(draft.lot_usd);

  if (montoCalc === null || lotUsd === null) return true;

  const difRc = round2(lotUsd - montoCalc);

  return Math.abs(difRc) <= 0.02;
}

function hasValuationData(draft: DraftRow) {
  const usdTms = toNumOrNull(draft.usd_tms);
  const lotUsd = toNumOrNull(draft.lot_usd);
  return usdTms !== null && lotUsd !== null;
}

function validateNumericRange(field: EditableField, value: number | null) {
  if (value === null) return null;
  if (RANGE_0_100_FIELDS.includes(field) && (value < 0 || value > 100)) {
    if (field === "h2o") return "H2O debe estar entre 0 y 100.";
    if (field === "cu_grade_pct") return "Cu % debe estar entre 0 y 100.";
  }
  return null;
}

function buildPayload(row: DraftRow, batchUpdatedAt?: string) {
  const payload: Record<string, any> = {};
  payload.lot = String(row.lot ?? "").trim() || null;
  payload.source_name = "CM";
  payload.updated_at = batchUpdatedAt || null;

  const decimals4PayloadFields: EditableField[] = [
    "au_grade_oztc",
    "ag_grade_oztc",
    "nacn",
  ];

  for (const f of EDITABLE_FIELDS) {
    const raw = String(row[f] ?? "").trim();

    if (NUMERIC_FIELDS.includes(f)) {
      const num = raw === "" ? null : parseNum(raw);
      const err = validateNumericRange(f, num);
      if (err) throw new Error(err);
      payload[f] = num === null
        ? null
        : decimals4PayloadFields.includes(f)
        ? round4(num)
        : num;
      continue;
    }

    if (f === "pay_type") {
      payload[f] = raw || "Transferencia";
      continue;
    }

    payload[f] = raw || null;
  }

  const auUsd = calcAuUsd(row);
  payload.au_usd = auUsd === null ? null : round2(auUsd);

  const usdTms = calcUsdTms(row);
  payload.usd_tms = usdTms === null ? null : round2(usdTms);

  return payload;
}

function compareLot(a: string, b: string) {
  return String(a || "").localeCompare(String(b || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function getSortValue(row: TraceabilityRow, key: SortKey, draft?: DraftRow) {
  const currentDraft = draft ?? toDraftRow(row);
  const value = traceabilityExcelFilterValue(row, currentDraft, key);

  if (value === null || value === undefined) return "";

  return String(value).trim();
}

function compareByKey(
  a: TraceabilityRow,
  b: TraceabilityRow,
  key: SortKey,
  dir: SortDir,
  draftA?: DraftRow,
  draftB?: DraftRow
) {
  const av = getSortValue(a, key, draftA);
  const bv = getSortValue(b, key, draftB);

  let result = 0;

  if (key === "lot") {
    result = compareLot(av, bv);
    return dir === "asc" ? result : -result;
  }

  if (key === "dif_rc") {
    const aBlank = av === "";
    const bBlank = bv === "";

    if (aBlank && bBlank) return 0;
    if (aBlank) return 1;
    if (bBlank) return -1;

    const an = Number(av);
    const bn = Number(bv);

    return dir === "asc" ? an - bn : bn - an;
  }

  result = av.localeCompare(bv, undefined, {
    numeric: true,
    sensitivity: "base",
  });

  return dir === "asc" ? result : -result;
}

function isRowComplete(draft: DraftRow) {
  for (const f of EDITABLE_FIELDS) {
    if (isBlank(draft[f])) return false;
  }
  return isUsdValidationOk(draft);
}

function getLotPriority(lot: string | null) {
  const v = String(lot || "").trim().toUpperCase();
  if (v.startsWith("2")) return 0;
  if (v.startsWith("TRJ")) return 1;
  return 2;
}

function compareDateDesc(a: string | null, b: string | null) {
  const av = String(a || "").trim();
  const bv = String(b || "").trim();
  return bv.localeCompare(av, undefined, { numeric: true, sensitivity: "base" });
}

function compareRows(
  a: TraceabilityRow,
  b: TraceabilityRow,
  draftA: DraftRow | undefined,
  draftB: DraftRow | undefined,
  sortKey: SortKey,
  sortDir: SortDir
) {
  const primary = compareByKey(a, b, sortKey, sortDir, draftA, draftB);
  if (primary !== 0) return primary;

  const lotPriorityA = getLotPriority(a.lot);
  const lotPriorityB = getLotPriority(b.lot);
  if (lotPriorityA !== lotPriorityB) return lotPriorityA - lotPriorityB;

  const usdTmsA = !isBlank(a.usd_tms) ? Number(a.usd_tms) : draftA ? calcUsdTms(draftA) : null;
  const usdTmsB = !isBlank(b.usd_tms) ? Number(b.usd_tms) : draftB ? calcUsdTms(draftB) : null;

  const hasUsdTmsA = usdTmsA !== null;
  const hasUsdTmsB = usdTmsB !== null;
  if (hasUsdTmsA !== hasUsdTmsB) return hasUsdTmsA ? -1 : 1;

  const invalidA = draftA ? !isUsdValidationOk(draftA) : false;
  const invalidB = draftB ? !isUsdValidationOk(draftB) : false;
  if (invalidA !== invalidB) return invalidA ? -1 : 1;

  const completeA = draftA ? isRowComplete(draftA) : false;
  const completeB = draftB ? isRowComplete(draftB) : false;
  if (completeA !== completeB) return completeA ? 1 : -1;

  const entryDateCmp = compareDateDesc(a.entry_date, b.entry_date);
  if (entryDateCmp !== 0) return entryDateCmp;

  return compareLot(String(a.lot || ""), String(b.lot || ""));
}

function inDateRange(entryDate: string | null, from: string, to: string) {
  const d = String(entryDate || "").trim();
  if (!d) return !from && !to;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function matchesLot(row: TraceabilityRow, lotFilter: string) {
  const filter = String(lotFilter || "").trim().toLowerCase();
  if (!filter) return true;

  const values = [
    row.lot,
    row.doc_number,
    row.miner_name,
    row.plate,
    row.ruc,
    row.concession_name,
    row.concession_code,
    row.district,
    row.province,
    row.department,
    row.sender_guide_number,
  ];

  return values.some((value) =>
    String(value || "").trim().toLowerCase().includes(filter)
  );
}

function matchesValuationFilter(
  filter: ValuationFilter,
  pendingValuation: boolean,
  invalidUsdMatch: boolean,
  validUsdMatch: boolean
) {
  if (filter === "all") return true;
  if (filter === "pending") return pendingValuation;
  if (filter === "invalid") return invalidUsdMatch;
  if (filter === "valid") return validUsdMatch;
  return true;
}

const TRACEABILITY_DATE_FILTER_FIELDS = new Set<keyof TraceabilityRow>([
  "entry_date",
  "process_date",
  "valuation_date",
  "doc_date",
  "payment_date",
]);

const TRACEABILITY_NUMBER_FILTER_FIELDS = new Set<keyof TraceabilityRow>([
  "sack_qty",
  "tmh",
  "h2o",
  "tms",
  "au_grade_oztc",
  "ag_grade_oztc",
  "cu_grade_pct",
  "au_oz",
  "ag_oz",
  "au_rec",
  "ag_rec",
  "pio",
  "pip",
  "pio_disc",
  "maquila",
  "nacn",
  "escalador",
  "usd_tms",
  "au_usd",
  "ag_usd",
  "monto_calc",
  "dif_rc",
  "lot_usd",
]);

function traceabilityExcelFilterKind(key: keyof TraceabilityRow): ExcelFilterKind {
  if (TRACEABILITY_DATE_FILTER_FIELDS.has(key)) return "date";
  if (TRACEABILITY_NUMBER_FILTER_FIELDS.has(key)) return "number";
  return "text";
}

function traceabilityExcelFilterValue(
  row: TraceabilityRow,
  draft: DraftRow,
  key: keyof TraceabilityRow
) {
  if (key === "au_usd") {
    return !isBlank(row.au_usd) ? row.au_usd : calcAuUsd(draft);
  }

  if (key === "usd_tms") {
    return !isBlank(row.usd_tms) ? row.usd_tms : calcUsdTms(draft);
  }

  if (key === "monto_calc") {
    return calcFacturaCalculada(draft);
  }

  if (key === "dif_rc") {
    const montoCalc = calcFacturaCalculada(draft);
    const facturaReal = toNumOrNull(draft.lot_usd);

    return facturaReal === null || montoCalc === null
      ? ""
      : round2(facturaReal - montoCalc);
  }

  if (key === "pip") {
    return !isBlank(row.pip) ? row.pip : draft.pip;
  }

  return draft[key] ?? row[key];
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

function matchesExcelFilter(
  rawValue: unknown,
  filter: ExcelColumnFilter | undefined,
  kind: ExcelFilterKind
) {
  if (!filter) return true;

  const value =
    rawValue === null || rawValue === undefined
      ? ""
      : String(rawValue).trim();

  if (
    filter.selected !== null &&
    !filter.selected.includes(value)
  ) {
    return false;
  }

  if (filter.operator === "none") return true;

  const first = filter.value1.trim();
  const second = filter.value2.trim();

  if (!first && filter.operator !== "between") {
    return true;
  }

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

type ExcelHeaderFilterProps = {
  label: string;
  kind: ExcelFilterKind;
  values: string[];
  filter?: ExcelColumnFilter;
  sortDirection?: SortDir;
  onApply: (filter: ExcelColumnFilter) => void;
  onSort: (direction: SortDir) => void;
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

  const [draftFilter, setDraftFilter] =
    useState<ExcelColumnFilter>(
      () => filter || EMPTY_EXCEL_FILTER
    );

  useEffect(() => {
    if (!open) return;

    setSearch("");

    setDraftFilter(
      filter
        ? {
            ...filter,
            selected: filter.selected
              ? [...filter.selected]
              : null,
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

    return () =>
      document.removeEventListener("mousedown", close);
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
      Math.max(
        0,
        viewportWidth - viewportPadding * 2
      )
    );

    const maxPopupHeight = Math.max(
      240,
      viewportHeight - viewportPadding * 2
    );

    const preferredPopupHeight = Math.min(
      520,
      maxPopupHeight
    );

    const top = Math.max(
      viewportPadding,
      Math.min(
        rect.bottom + gap,
        viewportHeight -
          preferredPopupHeight -
          viewportPadding
      )
    );

    const left = Math.min(
      Math.max(
        viewportPadding,
        rect.right - popupWidth
      ),
      Math.max(
        viewportPadding,
        viewportWidth -
          popupWidth -
          viewportPadding
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

    const reposition = () =>
      updatePopupPosition();

    window.addEventListener(
      "resize",
      reposition
    );

    window.addEventListener(
      "scroll",
      reposition,
      true
    );

    return () => {
      window.removeEventListener(
        "resize",
        reposition
      );

      window.removeEventListener(
        "scroll",
        reposition,
        true
      );
    };
  }, [open, updatePopupPosition]);

  const distinctValues = useMemo(
    () =>
      Array.from(
        new Set(
          values.map((value) =>
            value.trim()
          )
        )
      ).sort((a, b) => {
        if (a === "") return -1;
        if (b === "") return 1;

        if (kind === "number") {
          const aNum = Number(
            a.replace(",", ".")
          );

          const bNum = Number(
            b.replace(",", ".")
          );

          if (
            Number.isFinite(aNum) &&
            Number.isFinite(bNum)
          ) {
            return aNum - bNum;
          }
        }

        return a.localeCompare(
          b,
          "es",
          {
            numeric: true,
            sensitivity: "base",
          }
        );
      }),
    [values, kind]
  );

  const searchedValues = useMemo(() => {
    const needle = search
      .trim()
      .toLocaleLowerCase("es");

    if (!needle) return distinctValues;

    return distinctValues.filter(
      (value) =>
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
    [
      draftFilter.selected,
      distinctValues,
    ]
  );

  const allSelected =
    distinctValues.length > 0 &&
    distinctValues.every((value) =>
      selectedSet.has(value)
    );

  const active =
    excelFilterIsActive(filter) ||
    Boolean(sortDirection);

  const firstInputType =
    kind === "date"
      ? "date"
      : kind === "number"
      ? "number"
      : "text";

  function toggleValue(
    value: string,
    checked: boolean
  ) {
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
      onClick={(event) =>
        event.stopPropagation()
      }
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={() =>
          setOpen((current) => !current)
        }
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
              onClick={(event) =>
                event.stopPropagation()
              }
              style={{
                position: "fixed",
                top: popupPosition.top,
                left: popupPosition.left,
                zIndex: 10000,
                width:
                  "min(285px, calc(100vw - 16px))",
                maxHeight:
                  "calc(100vh - 16px)",
                overflowY: "auto",
                padding: 10,
                border:
                  "1px solid rgba(147,211,230,.42)",
                borderRadius: 10,
                background: "#07364d",
                boxShadow:
                  "0 14px 32px rgba(0,0,0,.40)",
                color: "#f4fbff",
                textAlign: "left",
                fontSize: 12,
              }}
            >
              <div
                style={{
                  fontWeight: 900,
                  marginBottom: 8,
                }}
              >
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
                    border:
                      "1px solid rgba(147,211,230,.24)",
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
                    border:
                      "1px solid rgba(147,211,230,.24)",
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
                  borderTop:
                    "1px solid rgba(147,211,230,.18)",
                  paddingTop: 8,
                }}
              >
                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Buscar valores..."
                  style={{
                    width: "100%",
                    height: 30,
                    padding: "5px 8px",
                    borderRadius: 7,
                    border:
                      "1px solid rgba(147,211,230,.30)",
                    background:
                      "rgba(2,35,52,.58)",
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
                    onChange={(event) =>
                      toggleAll(
                        event.target.checked
                      )
                    }
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
                  {searchedValues.map(
                    (value) => (
                      <label
                        key={
                          value ||
                          "__EMPTY__"
                        }
                        style={{
                          display: "flex",
                          alignItems:
                            "center",
                          gap: 7,
                          padding:
                            "3px 0",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSet.has(
                            value
                          )}
                          onChange={(
                            event
                          ) =>
                            toggleValue(
                              value,
                              event.target
                                .checked
                            )
                          }
                        />

                        <span
                          style={{
                            overflow:
                              "hidden",
                            textOverflow:
                              "ellipsis",
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {value ||
                            "(Vacíos)"}
                        </span>
                      </label>
                    )
                  )}

                  {!searchedValues.length ? (
                    <div
                      style={{
                        padding:
                          "8px 0",
                        opacity: 0.72,
                      }}
                    >
                      Sin coincidencias
                    </div>
                  ) : null}
                </div>
              </div>

              <div
                style={{
                  borderTop:
                    "1px solid rgba(147,211,230,.18)",
                  marginTop: 8,
                  paddingTop: 8,
                  display: "grid",
                  gap: 6,
                }}
              >
                <select
                  value={
                    draftFilter.operator
                  }
                  onChange={(event) =>
                    setDraftFilter(
                      (current) => ({
                        ...current,
                        operator:
                          event.target
                            .value as ExcelFilterOperator,
                      })
                    )
                  }
                  style={{
                    width: "100%",
                    height: 30,
                    padding: "4px 7px",
                    borderRadius: 7,
                    border:
                      "1px solid rgba(147,211,230,.30)",
                    background:
                      "#0b4d6b",
                    color: "#f4fbff",
                  }}
                >
                  {excelOperatorOptions(
                    kind
                  ).map((option) => (
                    <option
                      key={option.value}
                      value={
                        option.value
                      }
                    >
                      {option.label}
                    </option>
                  ))}
                </select>

                {draftFilter.operator !==
                "none" ? (
                  <input
                    type={firstInputType}
                    value={
                      draftFilter.value1
                    }
                    step={
                      kind === "number"
                        ? "any"
                        : undefined
                    }
                    onChange={(event) =>
                      setDraftFilter(
                        (current) => ({
                          ...current,
                          value1:
                            event.target
                              .value,
                        })
                      )
                    }
                    placeholder={
                      kind === "text"
                        ? "Valor..."
                        : undefined
                    }
                    style={{
                      width: "100%",
                      height: 30,
                      padding:
                        "5px 8px",
                      borderRadius: 7,
                      border:
                        "1px solid rgba(147,211,230,.30)",
                      background:
                        "rgba(2,35,52,.58)",
                      color: "#f4fbff",
                      outline: "none",
                    }}
                  />
                ) : null}

                {draftFilter.operator ===
                "between" ? (
                  <input
                    type={firstInputType}
                    value={
                      draftFilter.value2
                    }
                    step={
                      kind === "number"
                        ? "any"
                        : undefined
                    }
                    onChange={(event) =>
                      setDraftFilter(
                        (current) => ({
                          ...current,
                          value2:
                            event.target
                              .value,
                        })
                      )
                    }
                    style={{
                      width: "100%",
                      height: 30,
                      padding:
                        "5px 8px",
                      borderRadius: 7,
                      border:
                        "1px solid rgba(147,211,230,.30)",
                      background:
                        "rgba(2,35,52,.58)",
                      color: "#f4fbff",
                      outline: "none",
                    }}
                  />
                ) : null}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: 6,
                  marginTop: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    onApply({
                      ...EMPTY_EXCEL_FILTER,
                    });
                    setOpen(false);
                  }}
                  style={{
                    padding:
                      "6px 8px",
                    borderRadius: 7,
                    border:
                      "1px solid rgba(147,211,230,.24)",
                    background:
                      "transparent",
                    color: "#d8eef8",
                    cursor: "pointer",
                  }}
                >
                  Limpiar filtro
                </button>

                <div
                  style={{
                    display: "flex",
                    gap: 6,
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpen(false)
                    }
                    style={{
                      padding:
                        "6px 8px",
                      borderRadius: 7,
                      border:
                        "1px solid rgba(147,211,230,.24)",
                      background:
                        "transparent",
                      color: "#d8eef8",
                      cursor:
                        "pointer",
                    }}
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onApply(
                        draftFilter
                      );
                      setOpen(false);
                    }}
                    style={{
                      padding:
                        "6px 10px",
                      borderRadius: 7,
                      border:
                        "1px solid rgba(147,211,230,.42)",
                      background:
                        "rgba(27,147,227,.32)",
                      color: "#f4fbff",
                      fontWeight: 900,
                      cursor:
                        "pointer",
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

function isRowEdited(current: DraftRow | undefined, original: DraftRow | undefined) {
  if (!current || !original) return false;
  for (const c of COLUMNS) {
    if (String(current[c.key] ?? "") !== String(original[c.key] ?? "")) return true;
  }
  return false;
}

type RowItemProps = {
  row: TraceabilityRow;
  draft: DraftRow;
  loading: boolean;
  saving: boolean;
  edited: boolean;
  invalidUsdMatch: boolean;
  validUsdMatch: boolean;
  pendingValuation: boolean;
  registerInput: (
    key: string,
    field: keyof TraceabilityRow,
    el: HTMLInputElement | HTMLSelectElement | null
  ) => void;
  onCellBlur: (key: string, field: keyof TraceabilityRow, value: string) => void;
  onCellFocus: (key: string, field?: keyof TraceabilityRow) => void;
  cellBase: React.CSSProperties;
  inputBase: React.CSSProperties;
  gridH: string;
  gridV: string;
  rowBg: string;
  editedRowBg: string;
  invalidRowBg: string;
};

function RowItem({
  row,
  draft,
  loading,
  saving,
  edited,
  invalidUsdMatch,
  validUsdMatch,
  pendingValuation,
  registerInput,
  onCellBlur,
  onCellFocus,
  cellBase,
  inputBase,
  gridH,
  gridV,
  rowBg,
  editedRowBg,
  invalidRowBg,
}: RowItemProps) {
  const key = String(row.lot || "").trim();
  const currentRowBg = pendingValuation
    ? rowBg
    : invalidUsdMatch
    ? invalidRowBg
    : validUsdMatch
    ? editedRowBg
    : rowBg;

  return (
    <tr className="capex-tr">
      {COLUMNS.map((c) => {
        if (!c.editable) {
          const isNumber =
            c.kind === "number" ||
            c.key === "sack_qty" ||
            c.key === "lot_usd" ||
            c.key === "usd_tms" ||
            c.key === "au_usd" ||
            c.key === "pip" ||
            c.key === "monto_calc" ||
            c.key === "dif_rc";

          const montoCalc = calcFacturaCalculada(draft);
          const facturaReal = toNumOrNull(draft.lot_usd);
          const difRc =
            facturaReal === null || montoCalc === null
              ? null
              : round2(facturaReal - montoCalc);

          const raw =
            c.key === "au_usd"
              ? (!isBlank(row.au_usd) ? row.au_usd : calcAuUsd(draft))
              : c.key === "usd_tms"
              ? (!isBlank(row.usd_tms) ? row.usd_tms : calcUsdTms(draft))
              : c.key === "monto_calc"
              ? montoCalc
              : c.key === "dif_rc"
              ? difRc
              : c.key === "pip"
              ? (!isBlank(row.pip) ? row.pip : draft.pip)
              : row[c.key];

          const decimals3Keys: (keyof TraceabilityRow)[] = [
            "tmh",
            "tms",
            "au_grade_oztc",
            "ag_grade_oztc",
            "cu_grade_pct",
          ];

          const decimals = decimals3Keys.includes(c.key) ? 3 : 2;

          const show =
            isNumber && !isBlank(raw)
              ? Number(raw).toLocaleString("en-US", {
                  minimumFractionDigits: decimals,
                  maximumFractionDigits: decimals,
                })
              : String(raw ?? "");

          return (
            <td
              key={String(c.key)}
              className="capex-td"
              style={{
                ...cellBase,
                borderTop: gridH,
                borderBottom: gridH,
                borderRight: gridV,
                background: currentRowBg,
                textAlign: isNumber ? "right" : "left",
                fontWeight: 400,
                width: c.width || 110,
                minWidth: c.width || 110,
                maxWidth: c.width || 110,
                padding: isNumber ? "6px 4px" : "6px 8px",
                color: invalidUsdMatch && (c.key === "usd_tms" || c.key === "lot_usd" || c.key === "tms")
                  ? "rgb(235,176,134)"
                  : "rgb(185,185,185)",
              }}
              title={show || "—"}
            >
              {show || "—"}
            </td>
          );
        }

        return (
          <td
            key={String(c.key)}
            className="capex-td"
            style={{
              ...cellBase,
              borderTop: gridH,
              borderBottom: gridH,
              borderRight: gridV,
              background: currentRowBg,
              padding: c.kind === "number" ? "4px" : "6px 8px",
              width: c.width || 110,
              minWidth: c.width || 110,
              maxWidth: c.width || 110,
              overflow: "hidden",
              boxSizing: "border-box",
            }}
          >
            {c.key === "pay_type" ? (
              <select
                ref={(el) => registerInput(key, c.key, el)}
                defaultValue={toText(draft[c.key]) || "Transferencia"}
                disabled={loading || saving}
                onFocus={() => onCellFocus(key, c.key)}
                onChange={(e) => onCellBlur(key, c.key, e.target.value)}
                onBlur={(e) => onCellBlur(key, c.key, e.target.value)}
                style={{
                  ...inputBase,
                  width: "100%",
                  minWidth: 0,
                  maxWidth: "100%",
                  padding: "6px 8px",
                  ...(pendingValuation
                    ? null
                    : invalidUsdMatch
                    ? {
                        border: "1px solid rgba(216, 93, 39, 0.75)",
                        background: "rgba(216, 93, 39, 0.22)",
                      }
                    : validUsdMatch
                    ? {
                        border: "1px solid rgba(147, 178, 92, 0.55)",
                        background: "rgba(94, 128, 25, 0.18)",
                      }
                    : null),
                }}
              >
                <option value="Transferencia">Transferencia</option>
              </select>
            ) : (
              <input
                ref={(el) => registerInput(key, c.key, el)}
                type={c.kind === "date" ? "date" : "text"}
                defaultValue={c.key === "tms" ? formatTms3ForView(draft[c.key]) : toText(draft[c.key])}
                disabled={loading || saving}
                onFocus={() => onCellFocus(key, c.key)}
                onBlur={(e) => onCellBlur(key, c.key, e.target.value)}
                inputMode={c.kind === "number" ? "decimal" : "text"}
                spellCheck={false}
                autoComplete="off"
                style={{
                  ...inputBase,
                  width: "100%",
                  minWidth: 0,
                  maxWidth: "100%",
                  padding: c.kind === "number" ? "4px 6px" : "6px 8px",
                  ...(c.kind === "number" ? { textAlign: "right" as const } : {}),
                  ...(pendingValuation
                    ? null
                    : invalidUsdMatch
                    ? {
                        border: "1px solid rgba(216, 93, 39, 0.75)",
                        background: "rgba(216, 93, 39, 0.22)",
                      }
                    : validUsdMatch
                    ? {
                        border: "1px solid rgba(147, 178, 92, 0.55)",
                        background: "rgba(94, 128, 25, 0.18)",
                      }
                    : null),
                }}
              />
            )}
          </td>
        );
      })}
    </tr>
  );
}

export default function TraceabilityEntryForm() {
  const [rows, setRows] = useState<TraceabilityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [lotFilter, setLotFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("entry_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [hasManualSort, setHasManualSort] = useState(false);
  const [valuationFilter, setValuationFilter] = useState<ValuationFilter>("all");
  const [editedTick, setEditedTick] = useState(0);
  const [page, setPage] = useState(1);
  const [activeLot, setActiveLot] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] = useState<
    Partial<Record<keyof TraceabilityRow, ExcelColumnFilter>>
  >({});

  const draftsRef = useRef<Record<string, DraftRow>>({});
  const originalsRef = useRef<Record<string, DraftRow>>({});
  const inputsRef = useRef<
    Record<string, Partial<Record<keyof TraceabilityRow, HTMLInputElement | HTMLSelectElement | null>>>
  >({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const r = (await apiGet("/api/traceability")) as GetResp;
      const data = (Array.isArray(r?.rows) ? r.rows : []).map((row: any) => ({
        ...row,
        pip: row.pip ?? row.PIP ?? row.Pip ?? null,
      }));

      const nextDrafts: Record<string, DraftRow> = {};
      const nextOriginals: Record<string, DraftRow> = {};

      for (const row of data) {
        const key = String(row.lot || "").trim();
        const draft = toDraftRow(row);
        nextDrafts[key] = { ...draft };
        nextOriginals[key] = { ...draft };
      }

      draftsRef.current = nextDrafts;
      originalsRef.current = nextOriginals;
      inputsRef.current = {};
      setRows(data);
      setEditedTick((v) => v + 1);
      setActiveLot(null);
      setColumnFilters({});
      setPage(1);
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo cargar")}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const entryDateBounds = useMemo(() => {
  const dates = rows
    .map((row) => String(row.entry_date || "").trim())
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();

  if (!dates.length) {
    return { min: "", max: "" };
  }

  return {
    min: dates[0],
    max: dates[dates.length - 1],
  };
}, [rows]);

useEffect(() => {
  if (!rows.length) return;

  setDateFrom((prev) => prev || entryDateBounds.min);
  setDateTo((prev) => prev || entryDateBounds.max);
}, [rows, entryDateBounds.min, entryDateBounds.max]);

  useEffect(() => {
    setPage(1);
  }, [
    dateFrom,
    dateTo,
    lotFilter,
    valuationFilter,
    sortKey,
    sortDir,
    columnFilters,
  ]);

  const editedCount = useMemo(() => {
    editedTick;
    let count = 0;
    for (const key of Object.keys(draftsRef.current)) {
      if (isRowEdited(draftsRef.current[key], originalsRef.current[key])) count++;
    }
    return count;
  }, [editedTick]);

  const editedMap = useMemo(() => {
    editedTick;
    const map: Record<string, boolean> = {};
    for (const key of Object.keys(draftsRef.current)) {
      map[key] = isRowEdited(draftsRef.current[key], originalsRef.current[key]);
    }
    return map;
  }, [editedTick]);

  const pendingValuationMap = useMemo(() => {
    const map: Record<string, boolean> = {};

    for (const row of rows) {
      const key = String(row.lot || "").trim();
      const draft = draftsRef.current[key] ?? toDraftRow(row);
      map[key] = !hasValuationData(draft);
    }

    return map;
  }, [rows, editedTick]);

  const invalidUsdMap = useMemo(() => {
    const map: Record<string, boolean> = {};

    for (const row of rows) {
      const key = String(row.lot || "").trim();
      const draft = draftsRef.current[key] ?? toDraftRow(row);
      map[key] = hasValuationData(draft) && !isUsdValidationOk(draft);
    }

    return map;
  }, [rows, editedTick]);

  const validUsdMap = useMemo(() => {
    const map: Record<string, boolean> = {};

    for (const row of rows) {
      const key = String(row.lot || "").trim();
      const draft = draftsRef.current[key] ?? toDraftRow(row);
      map[key] = hasValuationData(draft) && isUsdValidationOk(draft);
    }

    return map;
  }, [rows, editedTick]);

  const excelColumnValues = useMemo(() => {
    const baseRows = rows.filter((row) => {
      if (!inDateRange(row.entry_date, dateFrom, dateTo)) return false;
      if (!matchesLot(row, lotFilter)) return false;

      const key = String(row.lot || "").trim();
      const pendingValuation = !!pendingValuationMap[key];
      const invalidUsdMatch = !!invalidUsdMap[key];
      const validUsdMatch = !!validUsdMap[key];

      return matchesValuationFilter(
        valuationFilter,
        pendingValuation,
        invalidUsdMatch,
        validUsdMatch
      );
    });

    const result: Partial<
      Record<keyof TraceabilityRow, string[]>
    > = {};

    COLUMNS.forEach((column) => {
      result[column.key] = baseRows.map((row) => {
        const key = String(row.lot || "").trim();
        const draft =
          draftsRef.current[key] ??
          toDraftRow(row);

        const value =
          traceabilityExcelFilterValue(
            row,
            draft,
            column.key
          );

        return value === null || value === undefined
          ? ""
          : String(value).trim();
      });
    });

    return result;
  }, [
    rows,
    dateFrom,
    dateTo,
    lotFilter,
    valuationFilter,
    editedTick,
    pendingValuationMap,
    invalidUsdMap,
    validUsdMap,
  ]);

    const preparedRows = useMemo(() => {
      const filtered = rows.filter((row) => {
        if (!inDateRange(row.entry_date, dateFrom, dateTo)) return false;
        if (!matchesLot(row, lotFilter)) return false;

        const key = String(row.lot || "").trim();
        const pendingValuation = !!pendingValuationMap[key];
        const invalidUsdMatch = !!invalidUsdMap[key];
        const validUsdMatch = !!validUsdMap[key];

        if (
          !matchesValuationFilter(
            valuationFilter,
            pendingValuation,
            invalidUsdMatch,
            validUsdMatch
          )
        ) {
          return false;
        }

        const draft =
          draftsRef.current[key] ??
          toDraftRow(row);

        return (
          Object.entries(columnFilters) as Array<
            [
              keyof TraceabilityRow,
              ExcelColumnFilter
            ]
          >
        ).every(([columnKey, filter]) =>
          matchesExcelFilter(
            traceabilityExcelFilterValue(
              row,
              draft,
              columnKey
            ),
            filter,
            traceabilityExcelFilterKind(
              columnKey
            )
          )
        );
      });

      return [...filtered].sort((a, b) => {
        const draftA = originalsRef.current[String(a.lot || "").trim()];
        const draftB = originalsRef.current[String(b.lot || "").trim()];

        if (hasManualSort) {
          return compareRows(a, b, draftA, draftB, sortKey, sortDir);
        }

        const lotPriorityA = getLotPriority(a.lot);
        const lotPriorityB = getLotPriority(b.lot);
        if (lotPriorityA !== lotPriorityB) return lotPriorityA - lotPriorityB;

        const usdTmsA = !isBlank(a.usd_tms) ? Number(a.usd_tms) : draftA ? calcUsdTms(draftA) : null;
        const usdTmsB = !isBlank(b.usd_tms) ? Number(b.usd_tms) : draftB ? calcUsdTms(draftB) : null;

        const hasUsdTmsA = usdTmsA !== null;
        const hasUsdTmsB = usdTmsB !== null;
        if (hasUsdTmsA !== hasUsdTmsB) return hasUsdTmsA ? -1 : 1;

        const invalidA = draftA ? !isUsdValidationOk(draftA) : false;
        const invalidB = draftB ? !isUsdValidationOk(draftB) : false;
        if (invalidA !== invalidB) return invalidA ? -1 : 1;

        const completeA = draftA ? isRowComplete(draftA) : false;
        const completeB = draftB ? isRowComplete(draftB) : false;
        if (completeA !== completeB) return completeA ? 1 : -1;

        const entryDateCmp = compareDateDesc(a.entry_date, b.entry_date);
        if (entryDateCmp !== 0) return entryDateCmp;

        return compareLot(String(a.lot || ""), String(b.lot || ""));
      });
    }, [
      rows,
      dateFrom,
      dateTo,
      lotFilter,
      valuationFilter,
      sortKey,
      sortDir,
      hasManualSort,
      editedTick,
      pendingValuationMap,
      invalidUsdMap,
      validUsdMap,
      columnFilters,
    ]);

  const totalRows = preparedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const visibleRows = preparedRows.slice(pageStart, pageEnd);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const invalidCount = useMemo(() => {
    let count = 0;
    for (const row of rows) {
      const key = String(row.lot || "").trim();
      if (invalidUsdMap[key]) count++;
    }
    return count;
  }, [rows, invalidUsdMap]);

  const validCount = useMemo(() => {
    let count = 0;
    for (const row of rows) {
      const key = String(row.lot || "").trim();
      if (validUsdMap[key]) count++;
    }
    return count;
  }, [rows, validUsdMap]);

  const pendingValuationCount = useMemo(() => {
    let count = 0;
    for (const row of rows) {
      const key = String(row.lot || "").trim();
      if (pendingValuationMap[key]) count++;
    }
    return count;
  }, [rows, pendingValuationMap]);

  const latestUpdatedAtLabel = useMemo(() => {
    const maxUpdatedAt = rows.reduce<string | null>((acc, row) => {
      const current = String(row.updated_at || "").trim();
      if (!current) return acc;
      if (!acc) return current;
      return current > acc ? current : acc;
    }, null);

    return maxUpdatedAt ? formatDateDdMmYyyy(maxUpdatedAt) : "—";
  }, [rows]);

  const hasInvalidEditedRows = Object.keys(draftsRef.current).some((key) => editedMap[key] && invalidUsdMap[key]);

  const activeDraft = activeLot ? draftsRef.current[activeLot] : undefined;
  const activeFacturaCalculada = activeDraft ? calcFacturaCalculada(activeDraft) : null;
  const activeFacturaReal = activeDraft ? toNumOrNull(activeDraft.lot_usd) : null;

  const registerInput = useCallback((
    key: string,
    field: keyof TraceabilityRow,
    el: HTMLInputElement | HTMLSelectElement | null
  ) => {
    if (!inputsRef.current[key]) inputsRef.current[key] = {};
    inputsRef.current[key][field] = el;
  }, []);

  const onCellFocus = useCallback((key: string, field?: keyof TraceabilityRow) => {
    setActiveLot(key);

    if (field === "tms") {
      const current = draftsRef.current[key];
      const input = inputsRef.current[key]?.tms;
      const fullTms = formatTms6ForEdit(current?.tms);

      if (input && fullTms) input.value = fullTms;
    }
  }, []);

  const onCellBlur = useCallback((key: string, field: keyof TraceabilityRow, value: string) => {
    const current = draftsRef.current[key];
    if (!current) return;

    const previousValue = String(current[field] ?? "");
    const trimmed = value;

    if (!NUMERIC_FIELDS.includes(field as EditableField)) {
      current[field] = trimmed;

      const tmsBlank = String(current.tms ?? "").trim() === "";
      const tmh = parseNum(String(current.tmh ?? ""));
      const h2o = parseNum(String(current.h2o ?? ""));

      if (tmsBlank && tmh !== null && h2o !== null) {
        const calcTms = tmh * ((100 - h2o) / 100);
        const formattedTms = formatTms6ForEdit(calcTms);
        const viewTms = formatTms3ForView(calcTms);
        current.tms = formattedTms;

        const tmsInput = inputsRef.current[key]?.tms;
        if (tmsInput && tmsInput.value !== viewTms) tmsInput.value = viewTms;
      }

      setEditedTick((v) => v + 1);
      return;
    }

    if (String(trimmed).trim() === "") {
      current[field] = "";

      if (field === "tms" || field === "tmh" || field === "h2o") {
        const tmsBlank = String(current.tms ?? "").trim() === "";
        const tmh = parseNum(String(current.tmh ?? ""));
        const h2o = parseNum(String(current.h2o ?? ""));

        if (tmsBlank && tmh !== null && h2o !== null) {
          const calcTms = tmh * ((100 - h2o) / 100);
          const formattedTms = calcTms.toFixed(3);
          current.tms = formattedTms;

          const tmsInput = inputsRef.current[key]?.tms;
          if (tmsInput && tmsInput.value !== formattedTms) tmsInput.value = formattedTms;
        }
      }

      setEditedTick((v) => v + 1);
      return;
    }

    const n = parseNum(trimmed);
    if (n === null) {
      const input = inputsRef.current[key]?.[field];
      if (input) input.value = previousValue;
      setMsg("ERROR: valor numérico inválido.");
      return;
    }

    const err = validateNumericRange(field as EditableField, n);
    if (err) {
      const input = inputsRef.current[key]?.[field];
      if (input) input.value = previousValue;
      setMsg(`ERROR: ${err}`);
      return;
    }

    const decimals3Fields: EditableField[] = [
      "tmh",
      "cu_grade_pct",
    ];

    const decimals4Fields: EditableField[] = [
      "au_grade_oztc",
      "ag_grade_oztc",
      "nacn",
    ];

    const normalizedManualTms = String(trimmed).trim().replace(",", ".");

    if (field === "tms") {
      const tmsDecimals = normalizedManualTms.includes(".")
        ? normalizedManualTms.split(".")[1]?.length ?? 0
        : 0;

      if (tmsDecimals > 6) {
        const input = inputsRef.current[key]?.[field];
        if (input) input.value = previousValue;
        setMsg("ERROR: TMS permite máximo 6 decimales.");
        return;
      }
    }

    const formatted = field === "tms"
      ? formatTms6ForEdit(normalizedManualTms)
      : decimals4Fields.includes(field as EditableField)
      ? n.toFixed(4)
      : decimals3Fields.includes(field as EditableField)
      ? n.toFixed(3)
      : n.toFixed(2);
    current[field] = formatted;

    const inputFormatted = field === "tms" ? formatTms3ForView(formatted) : formatted;

    const input = inputsRef.current[key]?.[field];
    if (input && input.value !== inputFormatted) input.value = inputFormatted;

    const affectsAutoTms = field === "tmh" || field === "h2o";
    const tmsBlank = String(current.tms ?? "").trim() === "";

    if (affectsAutoTms && tmsBlank) {
      const tmh = parseNum(String(current.tmh ?? ""));
      const h2o = parseNum(String(current.h2o ?? ""));

      if (tmh !== null && h2o !== null) {
        const calcTms = tmh * ((100 - h2o) / 100);
        const formattedTms = calcTms.toFixed(3);
        current.tms = formattedTms;

        const tmsInput = inputsRef.current[key]?.tms;
        if (tmsInput && tmsInput.value !== formattedTms) tmsInput.value = formattedTms;
      }
    }

    setEditedTick((v) => v + 1);
  }, []);

  async function onSaveAll() {
    const editedKeys = Object.keys(draftsRef.current).filter((key) =>
      isRowEdited(draftsRef.current[key], originalsRef.current[key])
    );

    if (editedKeys.length === 0) {
      setMsg("No hay filas editadas para guardar.");
      return;
    }

    const invalidEditedLots = editedKeys.filter((key) => !isUsdValidationOk(draftsRef.current[key]));
    if (invalidEditedLots.length > 0) {
      setMsg("ERROR: hay filas con validación inválida. USD/TMS x TMS debe ser igual a Factura (USD).");
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      const batchUpdatedAt = formatDateTime2_3(new Date());

      const jobs = editedKeys.map(async (key) => {
        const row = draftsRef.current[key];
        const lot = String(row?.lot || "").trim();

        if (!lot) throw new Error("Hay una fila editada sin lote.");

        const payload = buildPayload(row, batchUpdatedAt);
        const rr = (await apiPost("/api/traceability/web/insert", payload)) as SaveResp;

        if (!rr?.ok) {
          throw new Error(rr?.error || `No se pudo guardar el lote ${lot}`);
        }

        return lot;
      });

      const results = await Promise.allSettled(jobs);

      const okLots: string[] = [];
      const failedMessages: string[] = [];

      results.forEach((result, index) => {
        const key = editedKeys[index];
        const lot = String(draftsRef.current[key]?.lot || "").trim() || `(fila ${index + 1})`;

        if (result.status === "fulfilled") {
          okLots.push(result.value);
        } else {
          failedMessages.push(`${lot}: ${String(result.reason?.message || result.reason || "Error al guardar")}`);
        }
      });

      if (!failedMessages.length) {
        setMsg(`OK: se guardaron ${okLots.length} fila(s).`);
      } else if (okLots.length) {
        setMsg(`PARCIAL: guardadas ${okLots.length} fila(s). ${failedMessages.join(" | ")}`);
      } else {
        setMsg(`ERROR: no se pudo guardar ninguna fila. ${failedMessages.join(" | ")}`);
      }

      await loadData();
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo guardar")}`);
    } finally {
      setSaving(false);
    }
  }

  function onExportExcel() {
    const exportRows = preparedRows.map((row) => {
      return {
        "F ingreso": row.entry_date ?? "",
        "F valorizacion": row.valuation_date ?? "",
        "F proceso": row.process_date ?? "",
        "Lote": formatLotForExport(row.lot),
        "Sacos": row.sack_qty ?? "",
        "Minero": row.miner_name ?? "",
        "Placa": row.plate ?? "",
        "RUC": row.ruc ?? "",
        "Concesion": row.concession_name ?? "",
        "Codigo concesion": row.concession_code ?? "",
        "Distrito": row.district ?? "",
        "Provincia": row.province ?? "",
        "Departamento": row.department ?? "",
        "Guia remision": row.sender_guide_number ?? "",
        "Transportista": row.transport_name ?? "",
        "Guia transportista": row.transport_guide_number ?? "",
        "Zona 1": row.zone_1 ?? "",
        "Zona 2": row.zone_2 ?? "",
        "TMH": row.tmh ?? "",
        "H2O": row.h2o ?? "",
        "TMS": row.tms ?? "",
        "Ley Au": decimal4OrBlank(row.au_grade_oztc),
        "Ley Ag": decimal4OrBlank(row.ag_grade_oztc),
        "Ley Cu": row.cu_grade_pct ?? "",
        "Au Oz": row.au_oz ?? "",
        "Ag Oz": row.ag_oz ?? "",
        "Rec Au": pctToDecimal4(row.au_rec),
        "Rec Ag": pctToDecimal4(row.ag_rec),
        "PIO": row.pio ?? "",
        "PIP": row.pip ?? "",
        "PIO Disc": row.pio_disc ?? "",
        "Maquila": row.maquila ?? "",
        "NaCN": decimal4OrBlank(row.nacn),
        "Escalador": row.escalador ?? "",
        "USD/TMS": row.usd_tms ?? "",
        "Au USD": row.au_usd ?? "",
        "Ag USD": row.ag_usd ?? "",
        "Fecha factura": row.doc_date ?? "",
        "# factura": row.doc_number ?? "",
        "Forma de pago": row.pay_type ?? "",
        "Monto Calc.": "",
        "Factura USD": row.lot_usd ?? "",
        "Fecha pago": row.payment_date ?? "",
      };
    });

    if (!exportRows.length) {
      setMsg("No hay filas para exportar con el filtro seleccionado.");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(exportRows);

    for (let i = 0; i < exportRows.length; i++) {
      const excelRow = i + 2;

      if (ws[`U${excelRow}`]) ws[`U${excelRow}`].z = "0.######";
      if (ws[`V${excelRow}`]) ws[`V${excelRow}`].z = "0.0000";
      if (ws[`W${excelRow}`]) ws[`W${excelRow}`].z = "0.0000";
      if (ws[`AG${excelRow}`]) ws[`AG${excelRow}`].z = "0.0000";

      if (ws[`AA${excelRow}`]) ws[`AA${excelRow}`].z = "0.0000";
      if (ws[`AB${excelRow}`]) ws[`AB${excelRow}`].z = "0.0000";

      ws[`AO${excelRow}`] = {
        t: "n",
        f: `ROUND(ROUND((((ROUND(V${excelRow},4)*AA${excelRow})*(AC${excelRow}-AE${excelRow})-AF${excelRow}-ROUND(AG${excelRow},4)-AH${excelRow})*1.1023),2)*U${excelRow}+IF(AK${excelRow}="",0,AK${excelRow}),2)`
      };
    }
    ws["!cols"] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 10 },
      { wch: 24 },
      { wch: 12 },
      { wch: 14 },
      { wch: 26 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 24 },
      { wch: 18 },
      { wch: 12 },
      { wch: 16 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Trazabilidad");

    const filterLabel =
      valuationFilter === "invalid"
        ? "invalidas"
        : valuationFilter === "valid"
        ? "correctas"
        : valuationFilter === "pending"
        ? "pendientes"
        : "todas";

    const fromPart = dateFrom || "inicio";
    const toPart = dateTo || "fin";

    XLSX.writeFile(wb, `trazabilidad_${filterLabel}_${fromPart}_${toPart}.xlsx`);
  }

  function onSortClick(key: keyof TraceabilityRow) {
    if (!SORTABLE_KEYS.includes(key as SortKey)) return;

    const nextKey = key as SortKey;

    setHasManualSort(true);

    if (sortKey === nextKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDir("desc");
  }

  function getSortIndicator(key: keyof TraceabilityRow) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  const headerBg = "rgb(6, 77, 121)";
  const headerBorder = "1px solid rgba(216, 238, 255, 0.26)";
  const gridV = "1px solid rgba(216, 238, 255, 0.10)";
  const gridH = "1px solid rgba(216, 238, 255, 0.08)";
  const headerShadow = "none";
  const rowBg = "rgba(0,0,0,.10)";
  const editedRowBg = "rgba(94, 128, 25, 0.28)";
  const invalidRowBg = "rgba(216, 93, 39, 0.34)";

  const stickyHead: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 20,
    background: headerBg,
    boxShadow: headerShadow,
  };

  const cellBase: React.CSSProperties = {
    padding: "6px 8px",
    fontSize: 12,
    lineHeight: "14px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    boxSizing: "border-box",
  };

  const inputBase: React.CSSProperties = {
    border: "1px solid rgba(216,238,255,.18)",
    background: "rgba(0,0,0,.10)",
    color: "white",
    fontWeight: 900,
    padding: "6px 8px",
    borderRadius: 8,
    outline: "none",
    fontSize: 12,
    lineHeight: "14px",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        minWidth: 0,
        minHeight: 0,
        width: "100%",
        height: "100%",
        maxWidth: "100%",
        overflow: "hidden",
      }}
    >
      <div
        className="panel-inner"
        style={{
          padding: "10px 12px",
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        <div style={{ fontWeight: 900 }}>
          Trazabilidad · Ingresar Datos
          {valuationFilter !== "all" ? ` · Filtro: ${
            valuationFilter === "invalid"
              ? "Inválidas"
              : valuationFilter === "valid"
              ? "Correctas"
              : "Pendientes"
          }` : ""}
        </div>

        <div
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(147, 178, 92, 0.45)",
            background: editedCount > 0 ? "rgba(94, 128, 25, 0.24)" : "rgba(255,255,255,0.06)",
            fontSize: 12,
            fontWeight: 900,
            color: editedCount > 0 ? "rgb(174, 202, 125)" : "rgba(255,255,255,0.8)",
          }}
        >
          Editadas: {editedCount}
        </div>

        <button
          type="button"
          onClick={() => setValuationFilter((prev) => (prev === "invalid" ? "all" : "invalid"))}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border:
              valuationFilter === "invalid"
                ? "1px solid rgba(216, 93, 39, 0.95)"
                : invalidCount > 0
                ? "1px solid rgba(216, 93, 39, 0.65)"
                : "1px solid rgba(255,255,255,0.12)",
            background:
              valuationFilter === "invalid"
                ? "rgba(216, 93, 39, 0.45)"
                : invalidCount > 0
                ? "rgba(216, 93, 39, 0.28)"
                : "rgba(255,255,255,0.06)",
            fontSize: 12,
            fontWeight: 900,
            color: invalidCount > 0 ? "rgb(235, 176, 134)" : "rgba(255,255,255,0.8)",
            cursor: "pointer",
          }}
        >
          Inválidas: {invalidCount}
        </button>

        <button
          type="button"
          onClick={() => setValuationFilter((prev) => (prev === "valid" ? "all" : "valid"))}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border:
              valuationFilter === "valid"
                ? "1px solid rgba(147, 178, 92, 0.95)"
                : "1px solid rgba(147, 178, 92, 0.45)",
            background:
              valuationFilter === "valid"
                ? "rgba(94, 128, 25, 0.40)"
                : "rgba(94, 128, 25, 0.24)",
            fontSize: 12,
            fontWeight: 900,
            color: "rgb(174, 202, 125)",
            cursor: "pointer",
          }}
        >
          Correctas: {validCount}
        </button>       

        <button
          type="button"
          onClick={() => setValuationFilter((prev) => (prev === "pending" ? "all" : "pending"))}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border:
              valuationFilter === "pending"
                ? "1px solid rgba(255,255,255,0.30)"
                : "1px solid rgba(255,255,255,0.12)",
            background:
              valuationFilter === "pending"
                ? "rgba(255,255,255,0.14)"
                : "rgba(255,255,255,0.06)",
            fontSize: 12,
            fontWeight: 900,
            color: "rgba(255,255,255,0.8)",
            cursor: "pointer",
          }}
        >
          Pendientes: {pendingValuationCount}
        </button>

        <button
          type="button"
          onClick={() => setValuationFilter("all")}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: valuationFilter === "all" ? "1px solid rgba(27,147,227,.55)" : "1px solid rgba(255,255,255,0.12)",
            background: valuationFilter === "all" ? "rgba(27,147,227,.16)" : "rgba(255,255,255,0.06)",
            fontSize: 12,
            fontWeight: 900,
            color: valuationFilter === "all" ? "rgb(216, 238, 255)" : "rgba(255,255,255,0.8)",
            cursor: "pointer",
          }}
        >
          Todos
        </button>

        <div
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            fontSize: 12,
            fontWeight: 900,
            color: "rgba(255,255,255,0.9)",
          }}
        >
          Calc. USD:{" "}
          {activeFacturaCalculada === null
            ? "—"
            : activeFacturaCalculada.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
          {activeFacturaReal !== null
            ? ` / Factura: ${activeFacturaReal.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : ""}
        </div>

        <div
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            fontSize: 12,
            fontWeight: 900,
            color: "rgba(255,255,255,0.9)",
          }}
        >
          Última Actualización: {latestUpdatedAtLabel}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>Entry Date desde</div>
            <input
              type="date"
              value={dateFrom}
              min={entryDateBounds.min || undefined}
              max={entryDateBounds.max || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ ...inputBase, minWidth: 150 }}
            />
          </div>

          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>Entry Date hasta</div>
            <input
              type="date"
              value={dateTo}
              min={entryDateBounds.min || undefined}
              max={entryDateBounds.max || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ ...inputBase, minWidth: 150 }}
            />
          </div>

          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>Buscador global</div>
            <input
              type="text"
              value={lotFilter}
              onChange={(e) => setLotFilter(e.target.value)}
              placeholder="Buscar lote, factura, minero, placa, RUC, concesión..."
              style={{ ...inputBase, minWidth: 170 }}
            />
          </div>

          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={() => {
              setColumnFilters({});
              setHasManualSort(false);
              setSortKey("entry_date");
              setSortDir("desc");
              setPage(1);
            }}
            disabled={loading || saving}
          >
            Limpiar filtros
          </Button>

          <Button type="button" size="sm" variant="default" onClick={loadData} disabled={loading || saving}>
            {loading ? "Cargando…" : "Refrescar"}
          </Button>

          <Button type="button" size="sm" variant="default" onClick={onExportExcel} disabled={loading || saving || preparedRows.length === 0}>
            Exportar Excel
          </Button>

          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={onSaveAll}
            disabled={loading || saving || editedCount === 0 || hasInvalidEditedRows}
          >
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      {msg ? (
        <div
          className="panel-inner"
          style={{
            padding: 10,
            flexShrink: 0,
            border:
              msg.startsWith("OK") || msg.startsWith("PARCIAL")
                ? "1px solid rgba(27,147,227,.45)"
                : "1px solid rgba(216,93,39,.45)",
            background:
              msg.startsWith("OK") || msg.startsWith("PARCIAL")
                ? "rgba(27,147,227,.10)"
                : "rgba(216,93,39,.10)",
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
          minWidth: 0,
          minHeight: 0,
          width: "100%",
          height: "100%",
          maxWidth: "100%",
          maxHeight: "calc(100vh - 315px)",
          overflow: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          style={{
            minWidth: "max-content",
          }}
        >
          <Table stickyHeader disableScrollWrapper>
            <colgroup>
              {COLUMNS.map((c) => (
                <col
                  key={String(c.key)}
                  style={{
                    width: c.width || 110,
                    minWidth: c.width || 110,
                    maxWidth: c.width || 110,
                  }}
                />
              ))}
            </colgroup>

            <thead>
              <tr>
                {COLUMNS.map((c) => {
                  const sortable = !!c.sortable;

                  return (
                    <th
                      key={String(c.key)}
                      className="capex-th"
                      onClick={
                        sortable
                          ? () => onSortClick(c.key)
                          : undefined
                      }
                      style={{
                        ...stickyHead,
                        border: headerBorder,
                        borderBottom: headerBorder,
                        textAlign:
                          c.kind === "number" ||
                          c.key === "sack_qty"
                            ? "right"
                            : "left",
                        padding:
                          c.kind === "number"
                            ? "8px 4px"
                            : "8px 8px",
                        fontSize: 12,
                        width: c.width || 110,
                        minWidth: c.width || 110,
                        maxWidth: c.width || 110,
                        cursor: sortable
                          ? "pointer"
                          : "default",
                        userSelect: "none",
                        overflow: "visible",
                        whiteSpace: "nowrap",
                        boxSizing: "border-box",
                      }}
                      title={c.label}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent:
                            "space-between",
                          gap: 5,
                        }}
                      >
                        <span
                          style={{
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow:
                              "ellipsis",
                          }}
                        >
                          {c.label}
                          {sortable
                            ? getSortIndicator(
                                c.key
                              )
                            : ""}
                        </span>

                        <ExcelHeaderFilter
                          label={c.label}
                          kind={traceabilityExcelFilterKind(
                            c.key
                          )}
                          values={
                            excelColumnValues[
                              c.key
                            ] || []
                          }
                          filter={
                            columnFilters[c.key]
                          }
                          sortDirection={
                            hasManualSort &&
                            sortKey === c.key
                              ? sortDir
                              : undefined
                          }
                          onApply={(filter) => {
                            setColumnFilters(
                              (current) => ({
                                ...current,
                                [c.key]:
                                  filter,
                              })
                            );
                            setPage(1);
                          }}
                          onSort={(
                            direction
                          ) => {
                            setHasManualSort(
                              true
                            );
                            setSortKey(c.key);
                            setSortDir(
                              direction
                            );
                            setPage(1);
                          }}
                        />
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {visibleRows.map((row) => {
                const rowKey = String(row.lot || "").trim();
                return (
                <RowItem
                  key={rowKey}
                  row={row}
                  draft={draftsRef.current[rowKey] ?? toDraftRow(row)}
                  loading={loading}
                  saving={saving}
                  edited={!!editedMap[rowKey]}
                  invalidUsdMatch={!!invalidUsdMap[rowKey]}
                  validUsdMatch={!!validUsdMap[rowKey]}
                  pendingValuation={!!pendingValuationMap[rowKey]}
                  registerInput={registerInput}
                    onCellBlur={onCellBlur}
                    onCellFocus={onCellFocus}
                    cellBase={cellBase}
                    inputBase={inputBase}
                    gridH={gridH}
                    gridV={gridV}
                    rowBg={rowBg}
                    editedRowBg={editedRowBg}
                    invalidRowBg={invalidRowBg}
                  />
                );
              })}

              {!loading && visibleRows.length === 0 ? (
                <tr className="capex-tr">
                  <td className="capex-td" style={{ ...cellBase, fontWeight: 900 }} colSpan={COLUMNS.length}>
                    No hay filas para el filtro seleccionado.
                  </td>
                </tr>
              ) : null}

              {loading ? (
                <tr className="capex-tr">
                  <td className="capex-td" style={{ ...cellBase, fontWeight: 900 }} colSpan={COLUMNS.length}>
                    Cargando trazabilidad…
                  </td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </div>

      <div
        className="panel-inner"
        style={{
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9 }}>
          Mostrando {totalRows === 0 ? 0 : pageStart + 1} - {Math.min(pageEnd, totalRows)} de {totalRows} filas
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={loading || saving || safePage <= 1}
          >
            ←
          </Button>

          <div
            style={{
              minWidth: 90,
              textAlign: "center",
              fontSize: 12,
              fontWeight: 900,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(216,238,255,.18)",
            }}
          >
            Página {safePage} / {totalPages}
          </div>

          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={loading || saving || safePage >= totalPages}
          >
            →
          </Button>
        </div>
      </div>
    </div>
  );
}