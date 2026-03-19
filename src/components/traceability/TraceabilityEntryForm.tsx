// src/components/traceability/TraceabilityEntryForm.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

type TraceabilityRow = {
  lot: string | null;
  entry_date: string | null;
  process_date: string | null;
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
  pio: number | null;
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

let draftsRefGlobal: Record<string, DraftRow> = {};

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
  "pio",
  "pio_disc",
  "maquila",
  "nacn",
  "escalador",
  "ag_usd",
];

const RANGE_0_100_FIELDS: EditableField[] = ["h2o", "cu_grade_pct"];

type SortKey =
  | "lot"
  | "entry_date"
  | "process_date"
  | "miner_name"
  | "ruc"
  | "doc_date"
  | "doc_number"
  | "dif_rc";

type SortDir = "asc" | "desc";

type ValuationFilter = "all" | "invalid" | "valid" | "pending";

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
  { key: "process_date", label: "F. Proceso", editable: true, kind: "date", width: 120, sortable: true },
  { key: "tmh", label: "TMH", editable: true, kind: "number", width: 88 },
  { key: "h2o", label: "H2O", editable: true, kind: "number", width: 88 },
  { key: "tms", label: "TMS", editable: true, kind: "number", width: 88 },
  { key: "au_grade_oztc", label: "Au (Oz/TC)", editable: true, kind: "number", width: 88 },
  { key: "ag_grade_oztc", label: "Ag (Oz/TC)", editable: true, kind: "number", width: 88 },
  { key: "cu_grade_pct", label: "Cu %", editable: true, kind: "number", width: 88 },
  { key: "au_oz", label: "Au Oz", editable: true, kind: "number", width: 88 },
  { key: "ag_oz", label: "Ag Oz", editable: true, kind: "number", width: 88 },
  { key: "au_rec", label: "Au Rec", editable: true, kind: "number", width: 88 },
  { key: "pio", label: "PIO", editable: true, kind: "number", width: 88 },
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
  { key: "transport_name", label: "Transporte", editable: true, kind: "text", width: 130 },
  { key: "transport_guide_number", label: "Guía Transporte", editable: true, kind: "text", width: 125 },
  { key: "zone_1", label: "Zona 1", editable: true, kind: "text", width: 90 },
  { key: "zone_2", label: "Zona 2", editable: true, kind: "text", width: 120 },
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
    "tms",
    "au_grade_oztc",
    "ag_grade_oztc",
    "cu_grade_pct",
  ];

  for (const c of COLUMNS) {
    if (c.key === "ag_oz" || c.key === "escalador") {
      out[c.key] = isBlank(r[c.key]) ? "0.00" : toText(r[c.key]);
      continue;
    }

    if (c.key === "tms") {
      if (!hasTms && tmh !== null && h2o !== null) {
        out[c.key] = (tmh * ((100 - h2o) / 100)).toFixed(3);
      } else if (!isBlank(r[c.key])) {
        out[c.key] = Number(r[c.key]).toFixed(3);
      } else {
        out[c.key] = toText(r[c.key]);
      }
      continue;
    }

    if (decimals3Keys.includes(c.key) && !isBlank(r[c.key])) {
      out[c.key] = Number(r[c.key]).toFixed(3);
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

function toNumOrNull(v: unknown) {
  const n = parseNum(String(v ?? ""));
  return n === null ? null : n;
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

  return ((auGrade * auRec*.01) * (pio - pioDisc) - maquila - nacn - escalador) * 1.1023;
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

  return round2(round2(usdTms) * Number(tms.toFixed(3)) + (agUsd ?? 0));
}

function isUsdValidationOk(draft: DraftRow) {
  const facturaCalc = calcFacturaCalculada(draft);
  const lotUsd = toNumOrNull(draft.lot_usd);

  if (facturaCalc === null || lotUsd === null) return true;

  return round2(facturaCalc) === round2(lotUsd);
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

function buildPayload(row: DraftRow) {
  const payload: Record<string, any> = {};
  payload.lot = String(row.lot ?? "").trim() || null;

  for (const f of EDITABLE_FIELDS) {
    const raw = String(row[f] ?? "").trim();

    if (NUMERIC_FIELDS.includes(f)) {
      const num = raw === "" ? null : parseNum(raw);
      const err = validateNumericRange(f, num);
      if (err) throw new Error(err);
      payload[f] = num;
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

function getSortValue(row: TraceabilityRow, key: SortKey) {
  if (key === "dif_rc") {
    const lotKey = String(row.lot || "").trim();
    const draft = draftsRefGlobal[lotKey];

    if (!draft) return "";

    const montoCalc = calcFacturaCalculada(draft);
    const facturaReal = toNumOrNull(draft.lot_usd);
    const difRc =
      facturaReal === null || montoCalc === null
        ? null
        : round2(facturaReal - montoCalc);

    return difRc === null ? "" : String(difRc);
  }

  const rowValue = row[key];
  if (rowValue === null || rowValue === undefined) return "";
  return String(rowValue).trim();
}

function compareByKey(a: TraceabilityRow, b: TraceabilityRow, key: SortKey, dir: SortDir) {
  const av = getSortValue(a, key);
  const bv = getSortValue(b, key);

  let result = 0;

  if (key === "lot") {
    result = compareLot(av, bv);
  } else if (key === "dif_rc") {
    const an = av === "" ? Number.POSITIVE_INFINITY : Number(av);
    const bn = bv === "" ? Number.POSITIVE_INFINITY : Number(bv);
    result = an - bn;
  } else {
    result = av.localeCompare(bv, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

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

  if (sortKey === "dif_rc") {
    return compareByKey(a, b, sortKey, sortDir);
  }

  const entryDateCmp = compareDateDesc(a.entry_date, b.entry_date);
  if (entryDateCmp !== 0) return entryDateCmp;

  return compareByKey(a, b, sortKey, sortDir);
}

function inDateRange(entryDate: string | null, from: string, to: string) {
  const d = String(entryDate || "").trim();
  if (!d) return !from && !to;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function matchesLot(rowLot: string | null, lotFilter: string) {
  const lot = String(rowLot || "").trim().toLowerCase();
  const filter = String(lotFilter || "").trim().toLowerCase();
  if (!filter) return true;
  return lot.includes(filter);
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
  onCellFocus: (key: string) => void;
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
                  ? "rgb(255,170,170)"
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
                onFocus={() => onCellFocus(key)}
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
                        border: "1px solid rgba(255, 92, 92, 0.75)",
                        background: "rgba(120, 30, 30, 0.22)",
                      }
                    : validUsdMatch
                    ? {
                        border: "1px solid rgba(92, 211, 158, 0.55)",
                        background: "rgba(38, 120, 88, 0.18)",
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
                defaultValue={toText(draft[c.key])}
                disabled={loading || saving}
                onFocus={() => onCellFocus(key)}
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
                        border: "1px solid rgba(255, 92, 92, 0.75)",
                        background: "rgba(120, 30, 30, 0.22)",
                      }
                    : validUsdMatch
                    ? {
                        border: "1px solid rgba(92, 211, 158, 0.55)",
                        background: "rgba(38, 120, 88, 0.18)",
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
  const [valuationFilter, setValuationFilter] = useState<ValuationFilter>("all");
  const [editedTick, setEditedTick] = useState(0);
  const [page, setPage] = useState(1);
  const [activeLot, setActiveLot] = useState<string | null>(null);

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
      const data = Array.isArray(r?.rows) ? r.rows : [];

      const nextDrafts: Record<string, DraftRow> = {};
      const nextOriginals: Record<string, DraftRow> = {};

      for (const row of data) {
        const key = String(row.lot || "").trim();
        const draft = toDraftRow(row);
        nextDrafts[key] = { ...draft };
        nextOriginals[key] = { ...draft };
      }

      draftsRef.current = nextDrafts;
      draftsRefGlobal = nextDrafts;
      originalsRef.current = nextOriginals;
      inputsRef.current = {};
      setRows(data);
      setEditedTick((v) => v + 1);
      setActiveLot(null);
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

  const lotOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const row of rows) {
      const lot = String(row.lot || "").trim();
      if (!lot) continue;
      if (seen.has(lot)) continue;
      seen.add(lot);
      list.push(lot);
    }
    return list.sort((a, b) => compareLot(a, b));
  }, [rows]);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, lotFilter, valuationFilter, sortKey, sortDir]);

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

    const preparedRows = useMemo(() => {
      const filtered = rows.filter((row) => {
        if (!inDateRange(row.entry_date, dateFrom, dateTo)) return false;
        if (!matchesLot(row.lot, lotFilter)) return false;

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

      return [...filtered].sort((a, b) =>
        compareRows(
          a,
          b,
          draftsRef.current[String(a.lot || "").trim()],
          draftsRef.current[String(b.lot || "").trim()],
          sortKey,
          sortDir
        )
      );
    }, [
      rows,
      dateFrom,
      dateTo,
      lotFilter,
      valuationFilter,
      sortKey,
      sortDir,
      editedTick,
      pendingValuationMap,
      invalidUsdMap,
      validUsdMap,
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

  const onCellFocus = useCallback((key: string) => {
    setActiveLot(key);
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
        const formattedTms = calcTms.toFixed(3);
        current.tms = formattedTms;

        const tmsInput = inputsRef.current[key]?.tms;
        if (tmsInput && tmsInput.value !== formattedTms) tmsInput.value = formattedTms;
      }

      draftsRefGlobal = { ...draftsRef.current };
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

      draftsRefGlobal = { ...draftsRef.current };
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
      "tms",
      "au_grade_oztc",
      "ag_grade_oztc",
      "cu_grade_pct",
    ];

    const formatted = decimals3Fields.includes(field as EditableField) ? n.toFixed(3) : n.toFixed(2);
    current[field] = formatted;

    const input = inputsRef.current[key]?.[field];
    if (input && input.value !== formatted) input.value = formatted;

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

    draftsRefGlobal = { ...draftsRef.current };
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
      const jobs = editedKeys.map(async (key) => {
        const row = draftsRef.current[key];
        const lot = String(row?.lot || "").trim();

        if (!lot) throw new Error("Hay una fila editada sin lote.");

        const payload = buildPayload(row);
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

  function onSortClick(key: keyof TraceabilityRow) {
    if (!SORTABLE_KEYS.includes(key as SortKey)) return;

    const nextKey = key as SortKey;

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

  const headerBg = "rgb(6, 36, 58)";
  const headerBorder = "1px solid rgba(191, 231, 255, 0.26)";
  const gridV = "1px solid rgba(191, 231, 255, 0.10)";
  const gridH = "1px solid rgba(191, 231, 255, 0.08)";
  const headerShadow = "none";
  const rowBg = "rgba(0,0,0,.10)";
  const editedRowBg = "rgba(30, 110, 74, 0.28)";
  const invalidRowBg = "rgba(120, 24, 24, 0.34)";

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
    border: "1px solid rgba(191,231,255,.18)",
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
            border: "1px solid rgba(92, 211, 158, 0.45)",
            background: editedCount > 0 ? "rgba(38, 120, 88, 0.24)" : "rgba(255,255,255,0.06)",
            fontSize: 12,
            fontWeight: 900,
            color: editedCount > 0 ? "rgb(160, 255, 214)" : "rgba(255,255,255,0.8)",
          }}
        >
          Filas editadas: {editedCount}
        </div>

        <button
          type="button"
          onClick={() => setValuationFilter((prev) => (prev === "invalid" ? "all" : "invalid"))}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border:
              valuationFilter === "invalid"
                ? "1px solid rgba(255, 92, 92, 0.95)"
                : invalidCount > 0
                ? "1px solid rgba(255, 92, 92, 0.65)"
                : "1px solid rgba(255,255,255,0.12)",
            background:
              valuationFilter === "invalid"
                ? "rgba(120, 24, 24, 0.45)"
                : invalidCount > 0
                ? "rgba(120, 24, 24, 0.28)"
                : "rgba(255,255,255,0.06)",
            fontSize: 12,
            fontWeight: 900,
            color: invalidCount > 0 ? "rgb(255, 170, 170)" : "rgba(255,255,255,0.8)",
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
                ? "1px solid rgba(92, 211, 158, 0.95)"
                : "1px solid rgba(92, 211, 158, 0.45)",
            background:
              valuationFilter === "valid"
                ? "rgba(38, 120, 88, 0.40)"
                : "rgba(38, 120, 88, 0.24)",
            fontSize: 12,
            fontWeight: 900,
            color: "rgb(160, 255, 214)",
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
          Pendientes valorización: {pendingValuationCount}
        </button>

        <button
          type="button"
          onClick={() => setValuationFilter("all")}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: valuationFilter === "all" ? "1px solid rgba(102,199,255,.55)" : "1px solid rgba(255,255,255,0.12)",
            background: valuationFilter === "all" ? "rgba(102,199,255,.16)" : "rgba(255,255,255,0.06)",
            fontSize: 12,
            fontWeight: 900,
            color: valuationFilter === "all" ? "rgb(170, 225, 255)" : "rgba(255,255,255,0.8)",
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

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>Entry Date desde</div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ ...inputBase, minWidth: 150 }}
            />
          </div>

          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>Entry Date hasta</div>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ ...inputBase, minWidth: 150 }}
            />
          </div>

          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>Lote</div>
            <input
              list="traceability-lot-options"
              type="text"
              value={lotFilter}
              onChange={(e) => setLotFilter(e.target.value)}
              placeholder="Buscar lote"
              style={{ ...inputBase, minWidth: 170 }}
            />
            <datalist id="traceability-lot-options">
              {lotOptions.map((lot) => (
                <option key={lot} value={lot} />
              ))}
            </datalist>
          </div>

          <Button type="button" size="sm" variant="default" onClick={loadData} disabled={loading || saving}>
            {loading ? "Cargando…" : "Refrescar"}
          </Button>

          <Button type="button" size="sm" variant="primary" onClick={onSaveAll} disabled={loading || saving || hasInvalidEditedRows}>
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
                ? "1px solid rgba(102,199,255,.45)"
                : "1px solid rgba(255,80,80,.45)",
            background:
              msg.startsWith("OK") || msg.startsWith("PARCIAL")
                ? "rgba(102,199,255,.10)"
                : "rgba(255,80,80,.10)",
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
                      onClick={sortable ? () => onSortClick(c.key) : undefined}
                      style={{
                        ...stickyHead,
                        border: headerBorder,
                        borderBottom: headerBorder,
                        textAlign: c.kind === "number" || c.key === "sack_qty" ? "right" : "left",
                        padding: c.kind === "number" ? "8px 4px" : "8px 8px",
                        fontSize: 12,
                        width: c.width || 110,
                        minWidth: c.width || 110,
                        maxWidth: c.width || 110,
                        cursor: sortable ? "pointer" : "default",
                        userSelect: "none",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        boxSizing: "border-box",
                      }}
                      title={c.label}
                    >
                      {c.label}
                      {sortable ? getSortIndicator(c.key) : ""}
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
              border: "1px solid rgba(191,231,255,.18)",
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