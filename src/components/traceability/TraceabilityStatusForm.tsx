// src/components/traceability/TraceabilityStatusForm.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

type TraceabilityRow = {
  lot: string | null;
  entry_date: string | null;
  zone_name: string | null;
  site_name: string | null;
  miner_name: string | null;
  observation_desc: string | null;
  situation_desc: string | null;
  tmh: number | null;
  h2o: number | null;
  tms: number | null;
  au_grade_oztc: number | null;
  ag_grade_oztc: number | null;
  cu_grade_oztc: number | null;
  au_rec: number | null;
  pio: number | null;
  pio_disc: number | null;
  consumption_disc: number | null;
  maquila_disc: number | null;
  usd_tms: number | null;
  usd_lot: number | null;
  report_date: string | null;
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

type DraftRow = Partial<Record<keyof TraceabilityRow, string>>;

const EDITABLE_FIELDS = ["observation_desc", "situation_desc"] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

type SortKey = keyof TraceabilityRow;
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "pending" | "mapped";

const PAGE_SIZE = 100;

const OBSERVATION_OPTIONS = [
  "Mineral por Retirar",
  "Ley Baja",
  "Pendiente Factura",
  "No Comercial",
  "Análisis de Testigo",
  "Pago en Trámite",
  "Pendiente PM",
  "Sin Conformidad del Proveedor",
  "Baja Recuperación",
];

const SITUATION_OPTIONS = [
  "Mineral Inmovilizado",
  "Pendiente PM",
  "No Comercial",
  "Deuda Sunat R/C",
  "En Conciliación de Leyes",
  "Con Factura",
  "Valorizado",
  "Pendiente Ley",
];

const COLUMNS: {
  key: keyof TraceabilityRow;
  label: string;
  editable: boolean;
  kind: "text" | "date" | "number" | "readonly" | "select";
  width?: number;
  sortable?: boolean;
}[] = [
  { key: "lot", label: "Lote", editable: false, kind: "readonly", width: 110, sortable: true },
  { key: "entry_date", label: "F. Ingreso", editable: false, kind: "readonly", width: 110, sortable: true },
  { key: "zone_name", label: "Zona", editable: false, kind: "readonly", width: 120, sortable: true },
  { key: "site_name", label: "Sede", editable: false, kind: "readonly", width: 120, sortable: true },
  { key: "miner_name", label: "Proveedor", editable: false, kind: "readonly", width: 190, sortable: true },
  { key: "observation_desc", label: "Observación", editable: true, kind: "select", width: 180, sortable: true },
  { key: "situation_desc", label: "Situación", editable: true, kind: "select", width: 180, sortable: true },
  { key: "tmh", label: "TMH", editable: false, kind: "number", width: 95, sortable: true },
  { key: "h2o", label: "%Humedad", editable: false, kind: "number", width: 105, sortable: true },
  { key: "tms", label: "TMS", editable: false, kind: "number", width: 95, sortable: true },
  { key: "au_grade_oztc", label: "Au (Oz/TC)", editable: false, kind: "number", width: 110, sortable: true },
  { key: "ag_grade_oztc", label: "Ag (Oz/TC)", editable: false, kind: "number", width: 110, sortable: true },
  { key: "cu_grade_oztc", label: "Cu %", editable: false, kind: "number", width: 95, sortable: true },
  { key: "au_rec", label: "Au Rec", editable: false, kind: "number", width: 95, sortable: true },
  { key: "pio", label: "PIO", editable: false, kind: "number", width: 105, sortable: true },
  { key: "pio_disc", label: "PIO Desc.", editable: false, kind: "number", width: 105, sortable: true },
  { key: "consumption_disc", label: "NaCN", editable: false, kind: "number", width: 105, sortable: true },
  { key: "maquila_disc", label: "Maquila", editable: false, kind: "number", width: 105, sortable: true },
  { key: "usd_tms", label: "USD/TMS", editable: false, kind: "number", width: 110, sortable: true },
  { key: "usd_lot", label: "USD/Lote", editable: false, kind: "number", width: 120, sortable: true },
];

const SORTABLE_KEYS = COLUMNS.filter((c) => c.sortable).map((c) => c.key);

const PERCENT_FIELDS: (keyof TraceabilityRow)[] = ["h2o", "cu_grade_oztc", "au_rec"];
const MONEY_FIELDS: (keyof TraceabilityRow)[] = [
  "pio",
  "pio_disc",
  "consumption_disc",
  "maquila_disc",
  "usd_tms",
  "usd_lot",
];
const DECIMAL_3_FIELDS: (keyof TraceabilityRow)[] = [
  "tmh",
  "tms",
  "au_grade_oztc",
  "ag_grade_oztc",
];

function isBlank(v: unknown) {
  return v === null || v === undefined || String(v).trim() === "";
}

function toText(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function parseNum(v: unknown) {
  const t = String(v ?? "").trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function formatNumber(value: unknown, decimals = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDisplayValue(key: keyof TraceabilityRow, value: unknown) {
  if (isBlank(value)) return "";

  if (PERCENT_FIELDS.includes(key)) return `${formatNumber(value, 2)}%`;
  if (MONEY_FIELDS.includes(key)) return `$${formatNumber(value, 2)}`;
  if (DECIMAL_3_FIELDS.includes(key)) return formatNumber(value, 3);
  if (typeof value === "number") return formatNumber(value, 2);

  return String(value ?? "");
}

function toDraftRow(r: TraceabilityRow): DraftRow {
  const out: DraftRow = {};

  for (const c of COLUMNS) {
    out[c.key] = toText(r[c.key]);
  }

  out.report_date = toText(r.report_date);
  return out;
}

function rowHasBothStatus(draft: DraftRow | undefined) {
  if (!draft) return false;
  return !isBlank(draft.observation_desc) && !isBlank(draft.situation_desc);
}

function rowIsPending(draft: DraftRow | undefined) {
  return !rowHasBothStatus(draft);
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

function formatDateTime2_3Peru() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";

  const yyyy = get("year");
  const mm = get("month");
  const dd = get("day");
  const hh = get("hour");
  const mi = get("minute");
  const ss = get("second");
  const ms = String(now.getMilliseconds()).padStart(3, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}.${ms}`;
}

function compareLot(a: string, b: string) {
  return String(a || "").localeCompare(String(b || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function getSortValue(row: TraceabilityRow, key: SortKey, draft?: DraftRow) {
  const value = draft?.[key] ?? row[key];
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

  if (key === "lot") {
    const result = compareLot(av, bv);
    return dir === "asc" ? result : -result;
  }

  const numericKeys: SortKey[] = [
    "tmh",
    "h2o",
    "tms",
    "au_grade_oztc",
    "ag_grade_oztc",
    "cu_grade_oztc",
    "au_rec",
    "pio",
    "pio_disc",
    "consumption_disc",
    "maquila_disc",
    "usd_tms",
    "usd_lot",
  ];

  if (numericKeys.includes(key)) {
    const an = parseNum(av);
    const bn = parseNum(bv);

    const aBlank = an === null;
    const bBlank = bn === null;

    if (aBlank && bBlank) return 0;
    if (aBlank) return 1;
    if (bBlank) return -1;

    return dir === "asc" ? an - bn : bn - an;
  }

  const result = av.localeCompare(bv, undefined, {
    numeric: true,
    sensitivity: "base",
  });

  return dir === "asc" ? result : -result;
}

function inDateRange(entryDate: string | null, from: string, to: string) {
  const d = String(entryDate || "").trim();
  if (!d) return !from && !to;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function matchesGlobal(row: TraceabilityRow, filterValue: string) {
  const filter = String(filterValue || "").trim().toLowerCase();
  if (!filter) return true;

  const values = [
    row.zone_name,
    row.site_name,
    row.miner_name,
    row.observation_desc,
    row.situation_desc,
  ];

  return values.some((value) =>
    String(value || "").trim().toLowerCase().includes(filter)
  );
}

function isRowEdited(current: DraftRow | undefined, original: DraftRow | undefined) {
  if (!current || !original) return false;

  return EDITABLE_FIELDS.some(
    (field) => String(current[field] ?? "") !== String(original[field] ?? "")
  );
}

function buildPayload(row: DraftRow, batchUpdatedAt: string) {
  return {
    lot: String(row.lot ?? "").trim() || null,
    observation_desc: String(row.observation_desc ?? "").trim() || null,
    situation_desc: String(row.situation_desc ?? "").trim() || null,
    updated_at: batchUpdatedAt,
  };
}

type RowItemProps = {
  row: TraceabilityRow;
  draft: DraftRow;
  loading: boolean;
  saving: boolean;
  edited: boolean;
  pending: boolean;
  registerInput: (
    key: string,
    field: keyof TraceabilityRow,
    el: HTMLInputElement | HTMLSelectElement | null
  ) => void;
  onCellBlur: (key: string, field: keyof TraceabilityRow, value: string) => void;
  onCellFocus: (key: string) => void;
  cellBase: React.CSSProperties;
  gridH: string;
  gridV: string;
  rowBg: string;
  editedRowBg: string;
  pendingRowBg: string;
  columnWidths: Partial<Record<keyof TraceabilityRow, number>>;
};

function RowItem({
  row,
  draft,
  loading,
  saving,
  edited,
  pending,
  registerInput,
  onCellBlur,
  onCellFocus,
  cellBase,
  gridH,
  gridV,
  rowBg,
  editedRowBg,
  pendingRowBg,
  columnWidths,
}: RowItemProps) {
  const key = String(row.lot || "").trim();
  const [openDropdown, setOpenDropdown] = useState<keyof TraceabilityRow | null>(null);
  const currentRowBg = pending ? pendingRowBg : edited ? editedRowBg : rowBg;

  return (
    <tr
      className="capex-tr"
      style={{
        position: "relative",
        zIndex: openDropdown ? 99999 : "auto",
      }}
    >
      {COLUMNS.map((c) => {
        const colWidth = columnWidths[c.key] ?? c.width ?? 110;

        if (!c.editable) {
          const isNumber = c.kind === "number";
          const raw = row[c.key];
          const show = formatDisplayValue(c.key, raw);

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
                width: colWidth,
                minWidth: colWidth,
                maxWidth: colWidth,
                padding: isNumber ? "6px 4px" : "6px 8px",
                color: pending ? "rgb(255,190,190)" : "rgb(185,185,185)",
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
              padding: "6px 8px",
              width: colWidth,
              minWidth: colWidth,
              maxWidth: colWidth,
              overflow: "visible",
              position: "relative",
              zIndex: openDropdown === c.key ? 9999 : "auto",
              boxSizing: "border-box",
            }}
          >
            {(() => {
              const options =
                c.key === "observation_desc"
                  ? [
                      { value: "", label: "Selecciona..." },
                      ...OBSERVATION_OPTIONS.map((x) => ({ value: x, label: x })),
                    ]
                  : [
                      { value: "", label: "Selecciona..." },
                      ...SITUATION_OPTIONS.map((x) => ({ value: x, label: x })),
                    ];

              const currentValue = toText(draft[c.key]);
              const currentLabel =
                options.find((o) => o.value === currentValue)?.label ??
                options.find((o) => o.value === "")?.label ??
                "";

              return (
                <div
                  style={{
                    display: "grid",
                    gap: 6,
                    overflow: "visible",
                    position: "relative",
                  }}
                >
                  <button
                    type="button"
                    disabled={loading || saving}
                    onFocus={() => onCellFocus(key)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (loading || saving) return;
                      setOpenDropdown((s) => (s === c.key ? null : c.key));
                    }}
                    style={{
                      width: "100%",
                      minWidth: 0,
                      textAlign: "left",
                      background: "rgba(0,0,0,.10)",
                      border: pending ? "1px solid rgba(255, 92, 92, 0.75)" : "1px solid var(--border)",
                      color: "var(--text)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      outline: "none",
                      fontWeight: 900,
                      cursor: loading || saving ? "not-allowed" : "pointer",
                      opacity: loading || saving ? 0.7 : 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <span
                      style={{
                        opacity: currentValue ? 1 : 0.6,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {currentLabel}
                    </span>
                    <span style={{ opacity: 0.8 }}>▾</span>
                  </button>

                  {openDropdown === c.key ? (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        left: 0,
                        zIndex: 99999,
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,.10)",
                        background: "rgba(5, 25, 45, .98)",
                        boxShadow: "0 10px 30px rgba(0,0,0,.45)",
                        overflowY: "auto",
                        overflowX: "hidden",
                        maxHeight: 280,
                        width: c.key === "observation_desc" ? 280 : 260,
                        minWidth: "100%",
                        whiteSpace: "normal",
                      }}
                    >
                      {options.map((o) => {
                        const active = o.value === currentValue;
                        const isEmpty = o.value === "";

                        return (
                          <button
                            key={o.value || "__empty__"}
                            type="button"
                            ref={(el) => {
                              if (active) registerInput(key, c.key, el as any);
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onCellBlur(key, c.key, o.value);
                              setOpenDropdown(null);
                            }}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: "10px 12px",
                              background: active ? "rgba(102,199,255,.18)" : "transparent",
                              color: isEmpty ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.92)",
                              border: "none",
                              cursor: "pointer",
                              fontWeight: 900,
                              whiteSpace: "normal",
                              lineHeight: "16px",
                              wordBreak: "normal",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = active
                                ? "rgba(102,199,255,.18)"
                                : "rgba(255,255,255,.06)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = active
                                ? "rgba(102,199,255,.18)"
                                : "transparent";
                            }}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </td>
        );
      })}
    </tr>
  );
}

export default function TraceabilityStatusForm() {
  const [rows, setRows] = useState<TraceabilityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("entry_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editedTick, setEditedTick] = useState(0);
  const [page, setPage] = useState(1);
  const [, setActiveLot] = useState<string | null>(null);

  const draftsRef = useRef<Record<string, DraftRow>>({});
  const originalsRef = useRef<Record<string, DraftRow>>({});
  const inputsRef = useRef<
    Record<string, Partial<Record<keyof TraceabilityRow, HTMLInputElement | HTMLSelectElement | null>>>
  >({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setMsg(null);

    try {
      const r = (await apiGet("/api/traceability/status")) as GetResp;
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

  const entryDateBounds = useMemo(() => {
    const dates = rows
      .map((row) => String(row.entry_date || "").trim())
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();

    if (!dates.length) return { min: "", max: "" };

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
  }, [dateFrom, dateTo, globalFilter, statusFilter, sortKey, sortDir]);

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

  const statusMap = useMemo(() => {
    editedTick;
    const map: Record<string, { pending: boolean; mapped: boolean }> = {};

    for (const row of rows) {
      const key = String(row.lot || "").trim();
      const draft = draftsRef.current[key] ?? toDraftRow(row);
      const mapped = rowHasBothStatus(draft);
      map[key] = { pending: !mapped, mapped };
    }

    return map;
  }, [rows, editedTick]);

  const rowsForStatusCounters = useMemo(() => {
    return rows.filter((row) => {
      if (!inDateRange(row.entry_date, dateFrom, dateTo)) return false;
      if (!matchesGlobal(row, globalFilter)) return false;
      return true;
    });
  }, [rows, dateFrom, dateTo, globalFilter]);

  const pendingCount = useMemo(() => {
    return rowsForStatusCounters.reduce((acc, row) => {
      const key = String(row.lot || "").trim();
      return acc + (statusMap[key]?.pending ? 1 : 0);
    }, 0);
  }, [rowsForStatusCounters, statusMap]);

  const mappedCount = useMemo(() => {
    return rowsForStatusCounters.reduce((acc, row) => {
      const key = String(row.lot || "").trim();
      return acc + (statusMap[key]?.mapped ? 1 : 0);
    }, 0);
  }, [rowsForStatusCounters, statusMap]);

  const preparedRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      if (!inDateRange(row.entry_date, dateFrom, dateTo)) return false;
      if (!matchesGlobal(row, globalFilter)) return false;

      const key = String(row.lot || "").trim();
      const status = statusMap[key];

      if (statusFilter === "pending") return !!status?.pending;
      if (statusFilter === "mapped") return !!status?.mapped;

      return true;
    });

    return [...filtered].sort((a, b) => {
      const keyA = String(a.lot || "").trim();
      const keyB = String(b.lot || "").trim();

      const draftA = draftsRef.current[keyA];
      const draftB = draftsRef.current[keyB];

      const primary = compareByKey(a, b, sortKey, sortDir, draftA, draftB);
      if (primary !== 0) return primary;

      return compareLot(String(a.lot || ""), String(b.lot || ""));
    });
  }, [rows, dateFrom, dateTo, globalFilter, statusFilter, sortKey, sortDir, editedTick, statusMap]);

  const totalRows = preparedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const visibleRows = preparedRows.slice(pageStart, pageEnd);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const totalUsdLot = useMemo(() => {
    return preparedRows.reduce((acc, row) => acc + (Number(row.usd_lot) || 0), 0);
  }, [preparedRows]);

  const latestReportDateLabel = useMemo(() => {
    const maxReportDate = rows.reduce<string | null>((acc, row) => {
      const current = String(row.report_date || "").trim();
      if (!current) return acc;
      if (!acc) return current;
      return current > acc ? current : acc;
    }, null);

    return maxReportDate ? formatDateDdMmYyyy(maxReportDate) : "—";
  }, [rows]);

  const hasInvalidEditedRows = useMemo(() => {
    editedTick;

    return Object.keys(draftsRef.current).some((key) => {
      if (!isRowEdited(draftsRef.current[key], originalsRef.current[key])) return false;
      return rowIsPending(draftsRef.current[key]);
    });
  }, [editedTick]);

  const dynamicColumnWidths = useMemo<Partial<Record<keyof TraceabilityRow, number>>>(() => {
    editedTick;

    const getTextWidth = (field: "observation_desc" | "situation_desc") => {
      const values = rows.map((row) => {
        const rowKey = String(row.lot || "").trim();
        const draft = draftsRef.current[rowKey] ?? toDraftRow(row);
        return toText(draft[field]) || "Selecciona...";
      });

      const maxLength = Math.max("Selecciona...".length, ...values.map((x) => x.length));

      return Math.max(170, Math.min(320, maxLength * 9 + 64));
    };

    return {
      observation_desc: getTextWidth("observation_desc"),
      situation_desc: getTextWidth("situation_desc"),
    };
  }, [rows, editedTick]);

  const registerInput = useCallback(
    (
      key: string,
      field: keyof TraceabilityRow,
      el: HTMLInputElement | HTMLSelectElement | null
    ) => {
      if (!inputsRef.current[key]) inputsRef.current[key] = {};
      inputsRef.current[key][field] = el;
    },
    []
  );

  const onCellFocus = useCallback((key: string) => {
    setActiveLot(key);
  }, []);

  const onCellBlur = useCallback((key: string, field: keyof TraceabilityRow, value: string) => {
    const current = draftsRef.current[key];
    if (!current) return;

    current[field] = value;
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

    const invalidEditedLots = editedKeys.filter((key) => rowIsPending(draftsRef.current[key]));
    if (invalidEditedLots.length > 0) {
      setMsg("ERROR: cada fila editada debe tener Observación y Situación seleccionadas.");
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      const batchUpdatedAt = formatDateTime2_3Peru();

      const jobs = editedKeys.map(async (key) => {
        const row = draftsRef.current[key];
        const lot = String(row?.lot || "").trim();

        if (!lot) throw new Error("Hay una fila editada sin lote.");

        const payload = buildPayload(row, batchUpdatedAt);
        const rr = (await apiPost("/api/traceability/status/web/insert", payload)) as SaveResp;

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
      const key = String(row.lot || "").trim();
      const draft = draftsRef.current[key] ?? toDraftRow(row);

      return {
        Lote: row.lot ?? "",
        "F. Ingreso": row.entry_date ?? "",
        Zona: row.zone_name ?? "",
        Sede: row.site_name ?? "",
        Proveedor: row.miner_name ?? "",
        Observación: draft.observation_desc ?? "",
        Situación: draft.situation_desc ?? "",
        TMH: formatDisplayValue("tmh", row.tmh),
        "%Humedad": formatDisplayValue("h2o", row.h2o),
        TMS: formatDisplayValue("tms", row.tms),
        "Au (Oz/TC)": formatDisplayValue("au_grade_oztc", row.au_grade_oztc),
        "Ag (Oz/TC)": formatDisplayValue("ag_grade_oztc", row.ag_grade_oztc),
        "Cu %": formatDisplayValue("cu_grade_oztc", row.cu_grade_oztc),
        "Au Rec": formatDisplayValue("au_rec", row.au_rec),
        PIO: formatDisplayValue("pio", row.pio),
        "PIO Desc.": formatDisplayValue("pio_disc", row.pio_disc),
        NaCN: formatDisplayValue("consumption_disc", row.consumption_disc),
        Maquila: formatDisplayValue("maquila_disc", row.maquila_disc),
        "USD/TMS": formatDisplayValue("usd_tms", row.usd_tms),
        "USD/Lote": formatDisplayValue("usd_lot", row.usd_lot),
      };
    });

    if (!exportRows.length) {
      setMsg("No hay filas para exportar con el filtro seleccionado.");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(exportRows);

    ws["!cols"] = [
      { wch: 14 },
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
      { wch: 28 },
      { wch: 28 },
      { wch: 26 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mineral No Disponible");

    const statusPart = statusFilter === "pending" ? "pendientes" : statusFilter === "mapped" ? "mapeados" : "todos";
    const fromPart = dateFrom || "inicio";
    const toPart = dateTo || "fin";

    XLSX.writeFile(wb, `mineral_no_disponible_${statusPart}_${fromPart}_${toPart}.xlsx`);
  }

  function onSortClick(key: keyof TraceabilityRow) {
    if (!SORTABLE_KEYS.includes(key)) return;

    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
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
  const rowBg = "rgba(0,0,0,.10)";
  const editedRowBg = "rgba(30, 110, 74, 0.28)";
  const pendingRowBg = "rgba(120, 24, 24, 0.34)";

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
          Trazabilidad · Mineral No Disponible
          {statusFilter !== "all" ? ` · Filtro: ${statusFilter === "pending" ? "Pendientes" : "Mapeados"}` : ""}
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
          Editadas: {editedCount}
        </div>

        <button
          type="button"
          onClick={() => setStatusFilter((prev) => (prev === "pending" ? "all" : "pending"))}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border:
              statusFilter === "pending"
                ? "1px solid rgba(255, 92, 92, 0.95)"
                : pendingCount > 0
                ? "1px solid rgba(255, 92, 92, 0.65)"
                : "1px solid rgba(255,255,255,0.12)",
            background:
              statusFilter === "pending"
                ? "rgba(120, 24, 24, 0.45)"
                : pendingCount > 0
                ? "rgba(120, 24, 24, 0.28)"
                : "rgba(255,255,255,0.06)",
            fontSize: 12,
            fontWeight: 900,
            color: pendingCount > 0 ? "rgb(255, 170, 170)" : "rgba(255,255,255,0.8)",
            cursor: "pointer",
          }}
        >
          Pendientes: {pendingCount}
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter((prev) => (prev === "mapped" ? "all" : "mapped"))}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border:
              statusFilter === "mapped"
                ? "1px solid rgba(92, 211, 158, 0.95)"
                : "1px solid rgba(92, 211, 158, 0.45)",
            background:
              statusFilter === "mapped"
                ? "rgba(38, 120, 88, 0.40)"
                : "rgba(38, 120, 88, 0.24)",
            fontSize: 12,
            fontWeight: 900,
            color: "rgb(160, 255, 214)",
            cursor: "pointer",
          }}
        >
          Mapeados: {mappedCount}
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: statusFilter === "all" ? "1px solid rgba(102,199,255,.55)" : "1px solid rgba(255,255,255,0.12)",
            background: statusFilter === "all" ? "rgba(102,199,255,.16)" : "rgba(255,255,255,0.06)",
            fontSize: 12,
            fontWeight: 900,
            color: statusFilter === "all" ? "rgb(170, 225, 255)" : "rgba(255,255,255,0.8)",
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
          Calc. USD: {formatDisplayValue("usd_lot", totalUsdLot)}
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
          Última Actualización: {latestReportDateLabel}
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
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Buscar zona, sede, proveedor, observación o situación..."
              style={{ ...inputBase, minWidth: 280 }}
            />
          </div>

          <Button type="button" size="sm" variant="default" onClick={loadData} disabled={loading || saving}>
            {loading ? "Cargando…" : "Refrescar"}
          </Button>

          <Button type="button" size="sm" variant="default" onClick={onExportExcel} disabled={loading || saving || preparedRows.length === 0}>
            Exportar Excel
          </Button>

          <Button type="button" size="sm" variant="primary" onClick={onSaveAll} disabled={loading || saving || editedCount === 0 || hasInvalidEditedRows}>
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
        <div style={{ minWidth: "max-content" }}>
          <Table stickyHeader disableScrollWrapper>
            <colgroup>
              {COLUMNS.map((c) => (
                <col
                  key={String(c.key)}
                  style={{
                    width: dynamicColumnWidths[c.key] ?? c.width ?? 110,
                    minWidth: dynamicColumnWidths[c.key] ?? c.width ?? 110,
                    maxWidth: dynamicColumnWidths[c.key] ?? c.width ?? 110,
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
                        textAlign: c.kind === "number" ? "right" : "left",
                        padding: c.kind === "number" ? "8px 4px" : "8px 8px",
                        fontSize: 12,
                        width: dynamicColumnWidths[c.key] ?? c.width ?? 110,
                        minWidth: dynamicColumnWidths[c.key] ?? c.width ?? 110,
                        maxWidth: dynamicColumnWidths[c.key] ?? c.width ?? 110,
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
                const draft = draftsRef.current[rowKey] ?? toDraftRow(row);

                return (
                  <RowItem
                    key={rowKey}
                    row={row}
                    draft={draft}
                    loading={loading}
                    saving={saving}
                    edited={!!editedMap[rowKey]}
                    pending={!!statusMap[rowKey]?.pending}
                    registerInput={registerInput}
                    onCellBlur={onCellBlur}
                    onCellFocus={onCellFocus}
                    cellBase={cellBase}
                    gridH={gridH}
                    gridV={gridV}
                    rowBg={rowBg}
                    editedRowBg={editedRowBg}
                    pendingRowBg={pendingRowBg}
                    columnWidths={dynamicColumnWidths}
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
                    Cargando mineral no disponible…
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
