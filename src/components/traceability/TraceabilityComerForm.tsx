// src/components/traceability/TraceabilityComerForm.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

type TraceabilityRow = {
  lot: string | null;
  entry_date: string | null;
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
  au_usd: number | null;
  ag_usd: number | null;
  usd_tms: number | null;
};

type SaveResp = {
  ok: boolean;
  error?: string;
};

type DraftRow = {
  lot: string;
  entry_date: string;
  tmh: string;
  h2o: string;
  tms: string;
  au_grade_oztc: string;
  ag_grade_oztc: string;
  cu_grade_pct: string;
  au_oz: string;
  ag_oz: string;
  au_rec: string;
  pio: string;
  pio_disc: string;
  maquila: string;
  nacn: string;
  escalador: string;
  ag_usd: string;
};

const EXPORT_COLUMNS = [
  { key: "lot", label: "Lote" },
  { key: "entry_date", label: "F. Ingreso" },
  { key: "tmh", label: "TMH" },
  { key: "h2o", label: "H2O" },
  { key: "tms", label: "TMS" },
  { key: "au_grade_oztc", label: "Au (Oz/TC)" },
  { key: "ag_grade_oztc", label: "Ag (Oz/TC)" },
  { key: "cu_grade_pct", label: "Cu %" },
  { key: "au_rec", label: "Au Rec" },
  { key: "pio", label: "PIO" },
  { key: "pio_disc", label: "PIO Desc." },
  { key: "maquila", label: "Maquila" },
  { key: "nacn", label: "NaCN" },
  { key: "escalador", label: "Escalador" },
  { key: "ag_usd", label: "Ag USD" },
] as const;

const EDITABLE_FIELDS = [
  "tmh",
  "h2o",
  "tms",
  "au_grade_oztc",
  "ag_grade_oztc",
  "cu_grade_pct",
  "au_rec",
  "pio",
  "pio_disc",
  "maquila",
  "nacn",
  "escalador",
  "ag_usd",
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

const RANGE_0_100_FIELDS: EditableField[] = ["h2o", "cu_grade_pct", "au_rec"];

const DECIMALS_3_FIELDS: EditableField[] = [
  "tmh",
  "tms",
  "au_grade_oztc",
  "ag_grade_oztc",
  "cu_grade_pct",
];

type SortKey = "lot";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 100;

const COLUMNS: {
  key: "lot" | "entry_date" | EditableField | "au_oz" | "ag_oz" | "au_usd" | "usd_tms" | "monto_usd";
  label: string;
  editable: boolean;
  kind: "text" | "date" | "number" | "readonly";
  width?: number;
  sortable?: boolean;
}[] = [
  { key: "lot", label: "Lote", editable: false, kind: "readonly", width: 130, sortable: true },
  { key: "entry_date", label: "F. Ingreso", editable: false, kind: "readonly", width: 110 },
  { key: "tmh", label: "TMH", editable: true, kind: "number", width: 88 },
  { key: "h2o", label: "H2O", editable: true, kind: "number", width: 88 },
  { key: "tms", label: "TMS", editable: true, kind: "number", width: 88 },
  { key: "au_grade_oztc", label: "Au (Oz/TC)", editable: true, kind: "number", width: 96 },
  { key: "ag_grade_oztc", label: "Ag (Oz/TC)", editable: true, kind: "number", width: 96 },
  { key: "cu_grade_pct", label: "Cu %", editable: true, kind: "number", width: 88 },
  { key: "au_oz", label: "Au Oz", editable: false, kind: "readonly", width: 88 },
  { key: "ag_oz", label: "Ag Oz", editable: false, kind: "readonly", width: 88 },
  { key: "au_rec", label: "Au Rec", editable: true, kind: "number", width: 88 },
  { key: "pio", label: "PIO", editable: true, kind: "number", width: 88 },
  { key: "pio_disc", label: "PIO Desc.", editable: true, kind: "number", width: 96 },
  { key: "maquila", label: "Maquila", editable: true, kind: "number", width: 88 },
  { key: "nacn", label: "NaCN", editable: true, kind: "number", width: 88 },
  { key: "escalador", label: "Escalador", editable: true, kind: "number", width: 88 },
  { key: "au_usd", label: "Au USD", editable: false, kind: "readonly", width: 88 },
  { key: "ag_usd", label: "Ag USD", editable: true, kind: "number", width: 88 },
  { key: "usd_tms", label: "USD/TMS", editable: false, kind: "readonly", width: 88 },
  { key: "monto_usd", label: "Monto ($)", editable: false, kind: "readonly", width: 110 },
];

function isBlank(v: unknown) {
  return v === null || v === undefined || String(v).trim() === "";
}

function toText(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v);
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

function normalizeDateInput(v: unknown) {
  const raw = String(v ?? "").trim();
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const excelSerial = Number(raw.replace(",", "."));
  if (Number.isFinite(excelSerial) && excelSerial > 0) {
    const serial = Math.floor(excelSerial);
    const utcDays = serial - 25569;
    const utcValue = utcDays * 86400 * 1000;
    const excelDate = new Date(utcValue);

    if (!Number.isNaN(excelDate.getTime())) {
      const yyyy = excelDate.getUTCFullYear();
      const mm = String(excelDate.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(excelDate.getUTCDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  const dmyMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, "0");
    const mm = dmyMatch[2].padStart(2, "0");
    const yyyy = dmyMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const jsDate = new Date(raw);
  if (!Number.isNaN(jsDate.getTime())) {
    const yyyy = jsDate.getFullYear();
    const mm = String(jsDate.getMonth() + 1).padStart(2, "0");
    const dd = String(jsDate.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return raw;
}

function getYearYYFromEntryDate(entryDate: string) {
  const d = normalizeDateInput(entryDate);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d.slice(2, 4);
  return "";
}

function normalizeLot(rawLot: unknown, entryDateRaw: unknown) {
  const raw = String(rawLot ?? "").trim().toUpperCase();
  if (!raw) return "";

  const entryDate = normalizeDateInput(entryDateRaw);
  const yyFromDate = getYearYYFromEntryDate(entryDate);

  const cleaned = raw
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(/_/g, "-");

  if (/^\d{2}-\d{5}$/.test(cleaned)) {
    return cleaned;
  }

  if (/^TRJ-\d{2}-\d{5}$/.test(cleaned)) {
    return cleaned;
  }

  const yyLooseMatch = cleaned.match(/^(\d{2})-(\d+)$/);
  if (yyLooseMatch) {
    return `${yyLooseMatch[1]}-${String(Number(yyLooseMatch[2])).padStart(5, "0")}`;
  }

  const trjYearLooseMatch = cleaned.match(/^TRJ-(\d{2})-(\d+)$/);
  if (trjYearLooseMatch) {
    return `TRJ-${trjYearLooseMatch[1]}-${String(Number(trjYearLooseMatch[2])).padStart(5, "0")}`;
  }

  const trjYearLooseNoDashMatch = cleaned.match(/^TRJ(\d{2})-(\d+)$/);
  if (trjYearLooseNoDashMatch) {
    return `TRJ-${trjYearLooseNoDashMatch[1]}-${String(Number(trjYearLooseNoDashMatch[2])).padStart(5, "0")}`;
  }

  const trjCompactYearMatch = cleaned.match(/^TRJ(\d{2})(\d+)$/);
  if (trjCompactYearMatch) {
    return `TRJ-${trjCompactYearMatch[1]}-${String(Number(trjCompactYearMatch[2])).padStart(5, "0")}`;
  }

  if (/^\d+$/.test(cleaned)) {
    if (!yyFromDate) return cleaned;
    return `${yyFromDate}-${String(Number(cleaned)).padStart(5, "0")}`;
  }

  const trjMatch = cleaned.match(/^TRJ-(\d+)$/);
  if (trjMatch) {
    if (!yyFromDate) return cleaned;
    return `TRJ-${yyFromDate}-${String(Number(trjMatch[1])).padStart(5, "0")}`;
  }

  const trjLooseMatch = cleaned.match(/^TRJ(\d+)$/);
  if (trjLooseMatch) {
    if (!yyFromDate) return cleaned;
    return `TRJ-${yyFromDate}-${String(Number(trjLooseMatch[1])).padStart(5, "0")}`;
  }

  return cleaned;
}

function formatFieldValue(field: EditableField, value: unknown) {
  const n = toNumOrNull(value);
  if (n === null) return "";

    if (field === "au_rec") {
    return n.toFixed(2);
    }

  return DECIMALS_3_FIELDS.includes(field) ? n.toFixed(3) : n.toFixed(2);
}

function calcAuOzValue(tms: unknown, auGrade: unknown, auRec: unknown) {
  const tmsNum = toNumOrNull(tms);
  const auGradeNum = toNumOrNull(auGrade);
  const auRecNum = toNumOrNull(auRec);

  if (tmsNum === null || auGradeNum === null || auRecNum === null) return null;

  return tmsNum * auGradeNum * auRecNum * 1.1023;
}

function calcAuOz(draft: DraftRow) {
  return calcAuOzValue(draft.tms, draft.au_grade_oztc, draft.au_rec);
}

function calcAgOz() {
  return 0;
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

  return ((auGrade * auRec) * (pio - pioDisc) - maquila - nacn - escalador) * 1.1023;
}

function calcUsdTms(draft: DraftRow) {
  const auUsd = calcAuUsd(draft);
  return auUsd === null ? null : auUsd;
}

function calcMontoUsd(draft: DraftRow) {
  const usdTms = calcUsdTms(draft);
  const tms = toNumOrNull(draft.tms);
  const agUsd = toNumOrNull(draft.ag_usd);

  if (usdTms === null || tms === null) return null;

  const usdTmsRounded = round2(usdTms);
  const tmsRounded = Number(tms.toFixed(3));

  return round2((tmsRounded * usdTmsRounded) + (agUsd ?? 0));
}

function toDraftRow(r: TraceabilityRow): DraftRow {
  return {
    lot: toText(r.lot),
    entry_date: normalizeDateInput(r.entry_date),
    tmh: formatFieldValue("tmh", r.tmh),
    h2o: formatFieldValue("h2o", r.h2o),
    tms: formatFieldValue("tms", r.tms),
    au_grade_oztc: formatFieldValue("au_grade_oztc", r.au_grade_oztc),
    ag_grade_oztc: formatFieldValue("ag_grade_oztc", r.ag_grade_oztc),
    cu_grade_pct: formatFieldValue("cu_grade_pct", r.cu_grade_pct),
    au_oz: calcAuOzValue(r.tms, r.au_grade_oztc, r.au_rec)?.toFixed(2) ?? "",
    ag_oz: "0.00",
    au_rec: formatFieldValue("au_rec", r.au_rec),
    pio: formatFieldValue("pio", r.pio),
    pio_disc: formatFieldValue("pio_disc", r.pio_disc),
    maquila: formatFieldValue("maquila", r.maquila),
    nacn: formatFieldValue("nacn", r.nacn),
    escalador: formatFieldValue("escalador", r.escalador ?? 0),
    ag_usd: formatFieldValue("ag_usd", r.ag_usd),
  };
}

function validateNumericRange(field: EditableField, value: number | null) {
  if (value === null) return null;
  if (RANGE_0_100_FIELDS.includes(field) && (value < 0 || value > 100)) {
    if (field === "h2o") return "H2O debe estar entre 0 y 100.";
    if (field === "cu_grade_pct") return "Cu % debe estar entre 0 y 100.";
    if (field === "au_rec") return "Au Rec debe estar entre 0 y 100.";
  }
  return null;
}

function buildPayload(row: DraftRow, batchUpdatedAt?: string) {
  const payload: Record<string, any> = {
    lot: String(row.lot ?? "").trim() || null,
    pay_type: "Transferencia",
    source_name: "CO",
    updated_at: batchUpdatedAt || null,
    tmh: null,
    h2o: null,
    tms: null,
    au_grade_oztc: null,
    ag_grade_oztc: null,
    cu_grade_pct: null,
    au_oz: null,
    ag_oz: null,
    au_rec: null,
    pio: null,
    pio_disc: null,
    maquila: null,
    nacn: null,
    escalador: null,
    au_usd: null,
    ag_usd: null,
    usd_tms: null,
  };

  for (const f of EDITABLE_FIELDS) {
    const raw = String(row[f] ?? "").trim();
    const num = raw === "" ? null : parseNum(raw);
    const err = validateNumericRange(f, num);
    if (err) throw new Error(err);

    if (f === "au_rec") {
      payload[f] = num === null ? null : num * 100;
    } else {
      payload[f] = num;
    }
  }

  const auOz = calcAuOz(row);
  const auUsd = calcAuUsd(row);
  const usdTms = calcUsdTms(row);

  payload.au_oz = auOz === null ? null : round2(auOz);
  payload.ag_oz = 0;
  payload.au_usd = auUsd === null ? null : round2(auUsd);
  payload.usd_tms = usdTms === null ? null : round2(usdTms);

  return payload;
}

function compareLot(a: string, b: string) {
  return String(a || "").localeCompare(String(b || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function isRowEdited(current: DraftRow | undefined, original: DraftRow | undefined) {
  if (!current || !original) return false;
  for (const k of Object.keys(current) as (keyof DraftRow)[]) {
    if (String(current[k] ?? "") !== String(original[k] ?? "")) return true;
  }
  return false;
}

function hydrateRowsFromDrafts(sourceDrafts: Record<string, DraftRow>) {
  return Object.keys(sourceDrafts).map((key) => {
    const draft = sourceDrafts[key];
    return {
      lot: draft.lot || null,
      entry_date: draft.entry_date || null,
      tmh: toNumOrNull(draft.tmh),
      h2o: toNumOrNull(draft.h2o),
      tms: toNumOrNull(draft.tms),
      au_grade_oztc: toNumOrNull(draft.au_grade_oztc),
      ag_grade_oztc: toNumOrNull(draft.ag_grade_oztc),
      cu_grade_pct: toNumOrNull(draft.cu_grade_pct),
      au_oz: calcAuOz(draft),
      ag_oz: 0,
      au_rec: toNumOrNull(draft.au_rec),
      pio: toNumOrNull(draft.pio),
      pio_disc: toNumOrNull(draft.pio_disc),
      maquila: toNumOrNull(draft.maquila),
      nacn: toNumOrNull(draft.nacn),
      escalador: toNumOrNull(draft.escalador),
      au_usd: calcAuUsd(draft),
      ag_usd: toNumOrNull(draft.ag_usd),
      usd_tms: calcUsdTms(draft),
    } satisfies TraceabilityRow;
  });
}

type RowItemProps = {
  row: TraceabilityRow;
  draft: DraftRow;
  saving: boolean;
  edited: boolean;
  registerInput: (key: string, field: keyof DraftRow, el: HTMLInputElement | null) => void;
  onCellBlur: (key: string, field: keyof DraftRow, value: string) => void;
  cellBase: React.CSSProperties;
  inputBase: React.CSSProperties;
  gridH: string;
  gridV: string;
  rowBg: string;
  editedRowBg: string;
};

const RowItem = React.memo(function RowItem({
  row,
  draft,
  saving,
  edited,
  registerInput,
  onCellBlur,
  cellBase,
  inputBase,
  gridH,
  gridV,
  rowBg,
  editedRowBg,
}: RowItemProps) {
  const key = String(row.lot || "").trim();
  const currentRowBg = edited ? editedRowBg : rowBg;

  return (
    <tr className="capex-tr">
      {COLUMNS.map((c) => {
        if (!c.editable) {
          let raw: unknown = null;

          if (c.key === "lot") raw = draft.lot;
          if (c.key === "entry_date") raw = draft.entry_date;
          if (c.key === "au_oz") raw = calcAuOz(draft);
          if (c.key === "ag_oz") raw = calcAgOz();
          if (c.key === "au_usd") raw = calcAuUsd(draft);
          if (c.key === "usd_tms") raw = calcUsdTms(draft);
          if (c.key === "monto_usd") raw = calcMontoUsd(draft);

          const decimals = c.key === "lot" || c.key === "entry_date" ? 0 : 2;
          const isNumber = c.key !== "lot" && c.key !== "entry_date";
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
                fontWeight: c.key === "lot" ? 800 : 400,
                width: c.width || 110,
                minWidth: c.width || 110,
                maxWidth: c.width || 110,
                padding: isNumber ? "6px 4px" : "6px 8px",
                color: "rgb(185,185,185)",
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
              padding: "4px",
              width: c.width || 110,
              minWidth: c.width || 110,
              maxWidth: c.width || 110,
              overflow: "hidden",
              boxSizing: "border-box",
            }}
          >
            <input
              ref={(el) => registerInput(key, c.key as keyof DraftRow, el)}
              type="text"
              defaultValue={toText(draft[c.key as keyof DraftRow])}
              disabled={saving}
              onBlur={(e) => onCellBlur(key, c.key as keyof DraftRow, e.target.value)}
              inputMode="decimal"
              spellCheck={false}
              autoComplete="off"
              style={{
                ...inputBase,
                width: "100%",
                minWidth: 0,
                maxWidth: "100%",
                padding: "4px 6px",
                textAlign: "right",
                ...(edited
                  ? {
                      border: "1px solid rgba(92, 211, 158, 0.55)",
                      background: "rgba(38, 120, 88, 0.18)",
                    }
                  : null),
              }}
            />
          </td>
        );
      })}
    </tr>
  );
});

export default function TraceabilityComerForm() {
  const [rows, setRows] = useState<TraceabilityRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lotFilter, setLotFilter] = useState("");
  const [sortKey] = useState<SortKey>("lot");
  const [sortDir] = useState<SortDir>("asc");
  const [editedTick, setEditedTick] = useState(0);
  const [page, setPage] = useState(1);

  const draftsRef = useRef<Record<string, DraftRow>>({});
  const originalsRef = useRef<Record<string, DraftRow>>({});
  const inputsRef = useRef<Record<string, Partial<Record<keyof DraftRow, HTMLInputElement | null>>>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const lotOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const row of rows) {
      const lot = String(row.lot || "").trim();
      if (!lot || seen.has(lot)) continue;
      seen.add(lot);
      list.push(lot);
    }
    return list.sort((a, b) => compareLot(a, b));
  }, [rows]);

  const preparedRows = useMemo(() => {
    const filtered = rows.filter((row) =>
      String(row.lot || "").toLowerCase().includes(lotFilter.trim().toLowerCase())
    );

    return [...filtered].sort((a, b) =>
      sortDir === "asc"
        ? compareLot(String(a[sortKey] || ""), String(b[sortKey] || ""))
        : compareLot(String(b[sortKey] || ""), String(a[sortKey] || ""))
    );
  }, [rows, lotFilter, sortKey, sortDir, editedTick]);

  const totalRows = preparedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const visibleRows = preparedRows.slice(pageStart, pageEnd);

  useEffect(() => {
    setPage(1);
  }, [lotFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

    const editedCount = useMemo(() => {
    editedTick;
    return Object.keys(draftsRef.current).length;
    }, [editedTick]);

    const editedMap = useMemo(() => {
    editedTick;
    const map: Record<string, boolean> = {};
    for (const key of Object.keys(draftsRef.current)) {
        map[key] = true;
    }
    return map;
    }, [editedTick]);

  const registerInput = useCallback((key: string, field: keyof DraftRow, el: HTMLInputElement | null) => {
    if (!inputsRef.current[key]) inputsRef.current[key] = {};
    inputsRef.current[key][field] = el;
  }, []);

  const loadRowsFromImported = useCallback((importedRows: TraceabilityRow[]) => {
    const nextDrafts: Record<string, DraftRow> = {};
    const nextOriginals: Record<string, DraftRow> = {};

    for (const row of importedRows) {
      const normalizedEntryDate = normalizeDateInput(row.entry_date);
      const normalizedLot = normalizeLot(row.lot, normalizedEntryDate);
      const key = String(normalizedLot || "").trim();
      if (!key) continue;

      const rowNormalized: TraceabilityRow = {
        ...row,
        lot: normalizedLot,
        entry_date: normalizedEntryDate || null,
      };

      const draft = toDraftRow(rowNormalized);
      nextDrafts[key] = { ...draft };
      nextOriginals[key] = { ...draft };
    }

    draftsRef.current = nextDrafts;
    originalsRef.current = nextOriginals;
    inputsRef.current = {};
    setRows(hydrateRowsFromDrafts(nextDrafts));
    setEditedTick((v) => v + 1);
    setPage(1);
  }, []);

  const onExportFormat = useCallback(() => {
    const emptyRow: Record<string, string> = {};
    for (const col of EXPORT_COLUMNS) {
      emptyRow[col.label] = "";
    }

    const ws = XLSX.utils.json_to_sheet([emptyRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Formato");
    XLSX.writeFile(wb, "trazabilidad_datos_comercial_formato.xlsx");
  }, []);

  const onImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: "",
        raw: false,
      });

      if (!rawRows.length) {
        setMsg("ERROR: el Excel no tiene filas para importar.");
        return;
      }

      const deduped = new Map<string, TraceabilityRow>();

      for (const raw of rawRows) {
        const entryDate = normalizeDateInput(raw["F. Ingreso"]);
        const lotNormalized = normalizeLot(raw["Lote"], entryDate);
        if (!lotNormalized) continue;

        const row: TraceabilityRow = {
          lot: lotNormalized,
          entry_date: entryDate || null,
          tmh: toNumOrNull(raw["TMH"]),
          h2o: toNumOrNull(raw["H2O"]),
          tms: toNumOrNull(raw["TMS"]),
          au_grade_oztc: toNumOrNull(raw["Au (Oz/TC)"]),
          ag_grade_oztc: toNumOrNull(raw["Ag (Oz/TC)"]),
          cu_grade_pct: toNumOrNull(raw["Cu %"]),
          au_oz: calcAuOzValue(raw["TMS"], raw["Au (Oz/TC)"], raw["Au Rec"]),
          ag_oz: 0,
          au_rec: toNumOrNull(raw["Au Rec"]),
          pio: toNumOrNull(raw["PIO"]),
          pio_disc: toNumOrNull(raw["PIO Desc."]),
          maquila: toNumOrNull(raw["Maquila"]),
          nacn: toNumOrNull(raw["NaCN"]),
          escalador: toNumOrNull(raw["Escalador"]) ?? 0,
          au_usd: null,
          ag_usd: toNumOrNull(raw["Ag USD"]),
          usd_tms: null,
        };

        deduped.set(lotNormalized, row);
      }

      const importedRows = Array.from(deduped.values());

      if (!importedRows.length) {
        setMsg("ERROR: no se encontraron lotes válidos en el Excel.");
        return;
      }

      loadRowsFromImported(importedRows);
      setMsg(`OK: se importaron ${importedRows.length} lote(s) desde Excel.`);
    } catch (error: any) {
      setMsg(`ERROR: no se pudo importar el Excel. ${String(error?.message || error || "")}`);
    }
  }, [loadRowsFromImported]);

  const onCellBlur = useCallback((key: string, field: keyof DraftRow, value: string) => {
    const current = draftsRef.current[key];
    if (!current) return;
    if (field === "lot" || field === "entry_date") return;

    const previousValue = String(current[field] ?? "");
    const trimmed = String(value ?? "");
    const editableField = field as EditableField;
    const n = parseNum(trimmed);

    if (trimmed.trim() === "") {
      current[field] = "";
      setRows(hydrateRowsFromDrafts(draftsRef.current));
      setEditedTick((v) => v + 1);
      return;
    }

    if (n === null) {
      const input = inputsRef.current[key]?.[field];
      if (input) input.value = previousValue;
      setMsg("ERROR: valor numérico inválido.");
      return;
    }

    const err = validateNumericRange(editableField, n);
    if (err) {
      const input = inputsRef.current[key]?.[field];
      if (input) input.value = previousValue;
      setMsg(`ERROR: ${err}`);
      return;
    }

    let formatted = "";

    if (editableField === "au_rec") {
    formatted = n.toFixed(2);
    } else {
    formatted = DECIMALS_3_FIELDS.includes(editableField) ? n.toFixed(3) : n.toFixed(2);
    }

    current[field] = formatted;

    const input = inputsRef.current[key]?.[field];
    if (input && input.value !== formatted) {
    input.value = formatted;
    }

    setRows(hydrateRowsFromDrafts(draftsRef.current));
    setEditedTick((v) => v + 1);
  }, []);

  async function onSaveAll() {
    const editedKeys = Object.keys(draftsRef.current);

    if (editedKeys.length === 0) {
      setMsg("No hay filas cargadas para guardar.");
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
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo guardar")}`);
    } finally {
      setSaving(false);
    }
  }

  const headerBg = "rgb(6, 36, 58)";
  const headerBorder = "1px solid rgba(191, 231, 255, 0.26)";
  const gridV = "1px solid rgba(191, 231, 255, 0.10)";
  const gridH = "1px solid rgba(191, 231, 255, 0.08)";
  const rowBg = "rgba(0,0,0,.10)";
  const editedRowBg = "rgba(30, 110, 74, 0.28)";

  const stickyHead: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 20,
    background: headerBg,
    boxShadow: "none",
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
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={onImportFile}
      />

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
        <div style={{ fontWeight: 900 }}>Trazabilidad · Datos Comercial</div>

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
          Filas listas: {editedCount}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Button type="button" size="sm" variant="default" onClick={onExportFormat} disabled={saving}>
            Exportar formato
          </Button>

          <Button type="button" size="sm" variant="default" onClick={onImportClick} disabled={saving}>
            Importar Excel
          </Button>

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

          <Button type="button" size="sm" variant="primary" onClick={onSaveAll} disabled={saving}>
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
          maxHeight: "calc(100vh - 285px)",
          overflow: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ minWidth: "max-content" }}>
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
                {COLUMNS.map((c) => (
                  <th
                    key={String(c.key)}
                    className="capex-th"
                    style={{
                      ...stickyHead,
                      border: headerBorder,
                      borderBottom: headerBorder,
                      textAlign: c.kind === "number" ? "right" : "left",
                      padding: c.kind === "number" ? "8px 4px" : "8px 8px",
                      fontSize: 12,
                      width: c.width || 110,
                      minWidth: c.width || 110,
                      maxWidth: c.width || 110,
                      userSelect: "none",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      boxSizing: "border-box",
                    }}
                    title={c.label}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {visibleRows.map((row) => {
                const rowKey = String(row.lot || "").trim();
                return (
                  <RowItem
                    key={`${rowKey}-${editedTick}`}
                    row={row}
                    draft={draftsRef.current[rowKey] ?? toDraftRow(row)}
                    saving={saving}
                    edited={!!editedMap[rowKey]}
                    registerInput={registerInput}
                    onCellBlur={onCellBlur}
                    cellBase={cellBase}
                    inputBase={inputBase}
                    gridH={gridH}
                    gridV={gridV}
                    rowBg={rowBg}
                    editedRowBg={editedRowBg}
                  />
                );
              })}

              {visibleRows.length === 0 ? (
                <tr className="capex-tr">
                  <td className="capex-td" style={{ ...cellBase, fontWeight: 900 }} colSpan={COLUMNS.length}>
                    No hay datos cargados desde Excel.
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
            disabled={saving || safePage <= 1}
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
            disabled={saving || safePage >= totalPages}
          >
            →
          </Button>
        </div>
      </div>
    </div>
  );
}