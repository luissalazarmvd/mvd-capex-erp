// src/components/fleet/FleetMgmForm.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

type FleetOffRow = {
  item_ord: number | string | null;
  req_num: string | null;
  req_date: string | null;
  mat_code: string | null;
  mat_desc: string | null;
  cost_center_desc: string | null;
  odometer_km: number | string | null;
  req_type: string | null;
  req_serv_status: string | null;
};

type GetResp = {
  ok: boolean;
  rows?: FleetOffRow[];
  error?: string;
};

type SaveResp = {
  ok: boolean;
  count?: number;
  error?: string;
};

type DraftRow = Partial<Record<keyof FleetOffRow, string>>;

const EDITABLE_FIELDS = ["odometer_km", "req_type"] as const;
type SortKey = keyof FleetOffRow;
type SortDir = "asc" | "desc";

const PAGE_SIZE = 50;

const REQ_TYPE_OPTIONS = ["Motor", "Llantas", "Transmisión", "Sist. Eléctrico", "Otros"];

const COLUMNS: {
  key: keyof FleetOffRow;
  label: string;
  editable: boolean;
  kind: "text" | "date" | "number" | "readonly" | "select";
  width?: number;
  sortable?: boolean;
}[] = [
  { key: "item_ord", label: "Item Ord", editable: false, kind: "number", width: 100, sortable: true },
  { key: "req_num", label: "RQ", editable: false, kind: "readonly", width: 120, sortable: true },
  { key: "req_date", label: "F. Req", editable: false, kind: "date", width: 110, sortable: true },
  { key: "mat_code", label: "Cod. Material", editable: false, kind: "readonly", width: 130, sortable: true },
  { key: "mat_desc", label: "Material", editable: false, kind: "readonly", width: 320, sortable: true },
  { key: "cost_center_desc", label: "Centro de Costo", editable: false, kind: "readonly", width: 260, sortable: true },
  { key: "odometer_km", label: "Odómetro Km", editable: true, kind: "number", width: 140, sortable: true },
  { key: "req_type", label: "Tipo Req", editable: true, kind: "select", width: 180, sortable: true },
];

const SORTABLE_KEYS = COLUMNS.filter((c) => c.sortable).map((c) => c.key);

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

function formatDateYyyyMmDd(value: unknown) {
  const v = String(value ?? "").trim();
  if (!v) return "";

  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v.slice(0, 10);

  return d.toISOString().slice(0, 10);
}

function formatDisplayValue(key: keyof FleetOffRow, value: unknown) {
  if (isBlank(value)) return "";

  if (key === "req_date") return formatDateYyyyMmDd(value);
  if (key === "item_ord") return formatNumber(value, 0);
  if (key === "odometer_km") return formatNumber(value, 2);

  return String(value ?? "");
}

function toDraftRow(r: FleetOffRow): DraftRow {
  const out: DraftRow = {};

  for (const c of COLUMNS) {
    out[c.key] = toText(r[c.key]);
  }

  return out;
}

function compareText(a: string, b: string) {
  return String(a || "").localeCompare(String(b || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function getSortValue(row: FleetOffRow, key: SortKey, draft?: DraftRow) {
  const value = draft?.[key] ?? row[key];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function compareByKey(
  a: FleetOffRow,
  b: FleetOffRow,
  key: SortKey,
  dir: SortDir,
  draftA?: DraftRow,
  draftB?: DraftRow
) {
  const av = getSortValue(a, key, draftA);
  const bv = getSortValue(b, key, draftB);

  const numericKeys: SortKey[] = ["item_ord", "odometer_km"];

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

  const result = compareText(av, bv);
  return dir === "asc" ? result : -result;
}

function inDateRange(reqDate: string | null, from: string, to: string) {
  const d = formatDateYyyyMmDd(reqDate);
  if (!d) return !from && !to;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function matchesGlobal(row: FleetOffRow, draft: DraftRow | undefined, filterValue: string) {
  const filter = String(filterValue || "").trim().toLowerCase();
  if (!filter) return true;

  const values = [
    row.req_num,
    row.mat_code,
    row.mat_desc,
    row.cost_center_desc,
    draft?.req_type ?? row.req_type,
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

function rowHasInvalidNumber(current: DraftRow | undefined) {
  if (!current) return false;
  const value = String(current.odometer_km ?? "").trim();
  if (!value) return false;
  return parseNum(value) === null;
}

function buildPayload(row: DraftRow) {
  return {
    item_ord: parseNum(row.item_ord) ?? null,
    odometer_km: parseNum(row.odometer_km),
    req_type: String(row.req_type ?? "").trim() || null,
  };
}

type RowItemProps = {
  row: FleetOffRow;
  draft: DraftRow;
  loading: boolean;
  saving: boolean;
  edited: boolean;
  invalid: boolean;
  registerInput: (
    key: string,
    field: keyof FleetOffRow,
    el: HTMLInputElement | HTMLSelectElement | null
  ) => void;
  onCellBlur: (key: string, field: keyof FleetOffRow, value: string) => void;
  onCellFocus: (key: string) => void;
  cellBase: React.CSSProperties;
  gridH: string;
  gridV: string;
  rowBg: string;
  editedRowBg: string;
  invalidRowBg: string;
  columnWidths: Partial<Record<keyof FleetOffRow, number>>;
};

function RowItem({
  row,
  draft,
  loading,
  saving,
  edited,
  invalid,
  registerInput,
  onCellBlur,
  onCellFocus,
  cellBase,
  gridH,
  gridV,
  rowBg,
  editedRowBg,
  invalidRowBg,
  columnWidths,
}: RowItemProps) {
  const key = String(row.item_ord ?? "").trim();
  const [openDropdown, setOpenDropdown] = useState<keyof FleetOffRow | null>(null);
  const currentRowBg = invalid ? invalidRowBg : edited ? editedRowBg : rowBg;

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
                color: invalid ? "rgb(255,190,190)" : "rgb(185,185,185)",
              }}
              title={show || "—"}
            >
              {show || "—"}
            </td>
          );
        }

        if (c.key === "odometer_km") {
          const currentValue = toText(draft[c.key]);

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
                boxSizing: "border-box",
              }}
            >
              <input
                ref={(el) => registerInput(key, c.key, el)}
                type="text"
                inputMode="decimal"
                value={currentValue}
                disabled={loading || saving}
                onFocus={() => onCellFocus(key)}
                onChange={(e) => onCellBlur(key, c.key, e.target.value)}
                style={{
                  width: "100%",
                  minWidth: 0,
                  background: "rgba(0,0,0,.10)",
                  border: invalid ? "1px solid rgba(255, 92, 92, 0.75)" : "1px solid var(--border)",
                  color: "var(--text)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  outline: "none",
                  fontWeight: 900,
                  textAlign: "right",
                  boxSizing: "border-box",
                }}
              />
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
              const options = [
                { value: "", label: "Selecciona..." },
                ...REQ_TYPE_OPTIONS.map((x) => ({ value: x, label: x })),
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
                      border: "1px solid var(--border)",
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
                        width: 230,
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

export default function FleetOffForm() {
  const [rows, setRows] = useState<FleetOffRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [globalFilter, setGlobalFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("item_ord");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editedTick, setEditedTick] = useState(0);
  const [page, setPage] = useState(1);
  const [, setActiveItem] = useState<string | null>(null);

  const draftsRef = useRef<Record<string, DraftRow>>({});
  const originalsRef = useRef<Record<string, DraftRow>>({});
  const inputsRef = useRef<
    Record<string, Partial<Record<keyof FleetOffRow, HTMLInputElement | HTMLSelectElement | null>>>
  >({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setMsg(null);

    try {
      const r = (await apiGet("/api/logistics/flota/req")) as GetResp;
      const data = Array.isArray(r?.rows) ? r.rows : [];

      const nextDrafts: Record<string, DraftRow> = {};
      const nextOriginals: Record<string, DraftRow> = {};

      for (const row of data) {
        const key = String(row.item_ord ?? "").trim();
        if (!key) continue;

        const draft = toDraftRow(row);
        nextDrafts[key] = { ...draft };
        nextOriginals[key] = { ...draft };
      }

      draftsRef.current = nextDrafts;
      originalsRef.current = nextOriginals;
      inputsRef.current = {};
      setRows(data);
      setEditedTick((v) => v + 1);
      setActiveItem(null);
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

  const reqDateBounds = useMemo(() => {
    const dates = rows
      .map((row) => formatDateYyyyMmDd(row.req_date))
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

    setDateFrom((prev) => prev || reqDateBounds.min);
    setDateTo((prev) => prev || reqDateBounds.max);
  }, [rows, reqDateBounds.min, reqDateBounds.max]);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, globalFilter, sortKey, sortDir]);

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

  const invalidMap = useMemo(() => {
    editedTick;
    const map: Record<string, boolean> = {};

    for (const key of Object.keys(draftsRef.current)) {
      map[key] = rowHasInvalidNumber(draftsRef.current[key]);
    }

    return map;
  }, [editedTick]);

  const invalidCount = useMemo(() => {
    return Object.values(invalidMap).filter(Boolean).length;
  }, [invalidMap]);

  const preparedRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      const key = String(row.item_ord ?? "").trim();
      const draft = draftsRef.current[key];

      if (!inDateRange(row.req_date, dateFrom, dateTo)) return false;
      if (!matchesGlobal(row, draft, globalFilter)) return false;

      return true;
    });

    return [...filtered].sort((a, b) => {
      const keyA = String(a.item_ord ?? "").trim();
      const keyB = String(b.item_ord ?? "").trim();

      const draftA = draftsRef.current[keyA];
      const draftB = draftsRef.current[keyB];

      const primary = compareByKey(a, b, sortKey, sortDir, draftA, draftB);
      if (primary !== 0) return primary;

      return compareByKey(a, b, "item_ord", "asc", draftA, draftB);
    });
  }, [rows, dateFrom, dateTo, globalFilter, sortKey, sortDir, editedTick]);

  const totalRows = preparedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const visibleRows = preparedRows.slice(pageStart, pageEnd);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const hasInvalidEditedRows = useMemo(() => {
    editedTick;

    return Object.keys(draftsRef.current).some((key) => {
      if (!isRowEdited(draftsRef.current[key], originalsRef.current[key])) return false;
      return rowHasInvalidNumber(draftsRef.current[key]);
    });
  }, [editedTick]);

  const dynamicColumnWidths = useMemo<Partial<Record<keyof FleetOffRow, number>>>(() => {
    editedTick;

    const values = rows.map((row) => {
      const rowKey = String(row.item_ord ?? "").trim();
      const draft = draftsRef.current[rowKey] ?? toDraftRow(row);
      return toText(draft.req_type) || "Selecciona...";
    });

    const maxLength = Math.max("Selecciona...".length, ...values.map((x) => x.length));

    return {
      req_type: Math.max(170, Math.min(260, maxLength * 9 + 64)),
    };
  }, [rows, editedTick]);

  const registerInput = useCallback(
    (
      key: string,
      field: keyof FleetOffRow,
      el: HTMLInputElement | HTMLSelectElement | null
    ) => {
      if (!inputsRef.current[key]) inputsRef.current[key] = {};
      inputsRef.current[key][field] = el;
    },
    []
  );

  const onCellFocus = useCallback((key: string) => {
    setActiveItem(key);
  }, []);

  const onCellBlur = useCallback((key: string, field: keyof FleetOffRow, value: string) => {
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

    const invalidEditedKeys = editedKeys.filter((key) => rowHasInvalidNumber(draftsRef.current[key]));
    if (invalidEditedKeys.length > 0) {
      setMsg("ERROR: el odómetro debe ser numérico.");
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      const payloadRows = editedKeys.map((key) => {
        const row = draftsRef.current[key];

        if (!String(row?.item_ord ?? "").trim()) {
          throw new Error("Hay una fila editada sin item_ord.");
        }

        return buildPayload(row);
      });

      const rr = (await apiPost("/api/logistics/flota/web", { rows: payloadRows })) as SaveResp;

      if (!rr?.ok) {
        throw new Error(rr?.error || "No se pudo guardar la información de flota.");
      }

      for (const key of editedKeys) {
        const current = draftsRef.current[key];

        if (current) {
          originalsRef.current[key] = { ...current };
        }
      }

      setEditedTick((v) => v + 1);
      setMsg(`OK: se guardaron ${payloadRows.length} fila(s).`);
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo guardar")}`);
    } finally {
      setSaving(false);
    }
  }

  function onExportExcel() {
    const exportRows = preparedRows.map((row) => {
      const key = String(row.item_ord ?? "").trim();
      const draft = draftsRef.current[key] ?? toDraftRow(row);

      return {
        "Item Ord": row.item_ord ?? "",
        RQ: row.req_num ?? "",
        "F. Req": formatDateYyyyMmDd(row.req_date),
        "Cod. Material": row.mat_code ?? "",
        Material: row.mat_desc ?? "",
        "Centro de Costo": row.cost_center_desc ?? "",
        "Odómetro Km": parseNum(draft.odometer_km) ?? "",
        "Tipo Req": draft.req_type ?? "",
      };
    });

    if (!exportRows.length) {
      setMsg("No hay filas para exportar con el filtro seleccionado.");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(exportRows);

    ws["!cols"] = [
      { wch: 12 },
      { wch: 16 },
      { wch: 12 },
      { wch: 16 },
      { wch: 42 },
      { wch: 34 },
      { wch: 16 },
      { wch: 20 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Flota Oficinas");

    const fromPart = dateFrom || "inicio";
    const toPart = dateTo || "fin";

    XLSX.writeFile(wb, `flota_oficinas_req_${fromPart}_${toPart}.xlsx`);
  }

  function onSortClick(key: keyof FleetOffRow) {
    if (!SORTABLE_KEYS.includes(key)) return;

    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDir(key === "item_ord" ? "asc" : "desc");
  }

  function getSortIndicator(key: keyof FleetOffRow) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  const headerBg = "rgb(6, 36, 58)";
  const headerBorder = "1px solid rgba(191, 231, 255, 0.26)";
  const gridV = "1px solid rgba(191, 231, 255, 0.10)";
  const gridH = "1px solid rgba(191, 231, 255, 0.08)";
  const rowBg = "rgba(0,0,0,.10)";
  const editedRowBg = "rgba(30, 110, 74, 0.28)";
  const invalidRowBg = "rgba(120, 24, 24, 0.34)";

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
        <div style={{ fontWeight: 900 }}>Flota · Oficinas</div>

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

        {invalidCount > 0 ? (
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255, 92, 92, 0.65)",
              background: "rgba(120, 24, 24, 0.28)",
              fontSize: 12,
              fontWeight: 900,
              color: "rgb(255, 170, 170)",
            }}
          >
            Inválidas: {invalidCount}
          </div>
        ) : null}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>Req Date desde</div>
            <input
              type="date"
              value={dateFrom}
              min={reqDateBounds.min || undefined}
              max={reqDateBounds.max || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ ...inputBase, minWidth: 150 }}
            />
          </div>

          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>Req Date hasta</div>
            <input
              type="date"
              value={dateTo}
              min={reqDateBounds.min || undefined}
              max={reqDateBounds.max || undefined}
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
              placeholder="Buscar RQ, código, material, centro de costo o tipo..."
              style={{ ...inputBase, minWidth: 340 }}
            />
          </div>

          <Button type="button" size="sm" variant="default" onClick={loadData} disabled={loading || saving}>
            {loading ? "Cargando…" : "Refrescar"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={onExportExcel}
            disabled={loading || saving || preparedRows.length === 0}
          >
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
          maxHeight: "calc(100vh - 300px)",
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
              {visibleRows.map((row, index) => {
                const rowKey = String(row.item_ord ?? "").trim();
                const safeKey = rowKey || `row-${index}`;
                const draft = draftsRef.current[rowKey] ?? toDraftRow(row);

                return (
                  <RowItem
                    key={safeKey}
                    row={row}
                    draft={draft}
                    loading={loading}
                    saving={saving}
                    edited={!!editedMap[rowKey]}
                    invalid={!!invalidMap[rowKey]}
                    registerInput={registerInput}
                    onCellBlur={onCellBlur}
                    onCellFocus={onCellFocus}
                    cellBase={cellBase}
                    gridH={gridH}
                    gridV={gridV}
                    rowBg={rowBg}
                    editedRowBg={editedRowBg}
                    invalidRowBg={invalidRowBg}
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
                    Cargando requerimientos de flota…
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