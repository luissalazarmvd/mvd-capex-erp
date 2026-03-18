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
  "usd_tms",
  "au_usd",
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
  "usd_tms",
  "au_usd",
  "ag_usd",
];

const AUTO_GROW_KEYS: (keyof TraceabilityRow)[] = [
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
  "usd_tms",
  "au_usd",
  "ag_usd",
];

type SortKey =
  | "lot"
  | "entry_date"
  | "process_date"
  | "miner_name"
  | "ruc"
  | "doc_date"
  | "doc_number";

type SortDir = "asc" | "desc";

const SORTABLE_KEYS: SortKey[] = [
  "lot",
  "entry_date",
  "process_date",
  "miner_name",
  "ruc",
  "doc_date",
  "doc_number",
];

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
  { key: "tmh", label: "TMH", editable: true, kind: "number"},
  { key: "h2o", label: "H2O", editable: true, kind: "number"},
  { key: "tms", label: "TMS", editable: true, kind: "number"},
  { key: "au_grade_oztc", label: "Au Grade", editable: true, kind: "number"},
  { key: "ag_grade_oztc", label: "Ag Grade", editable: true, kind: "number"},
  { key: "cu_grade_pct", label: "Cu %", editable: true, kind: "number"},
  { key: "au_oz", label: "Au Oz", editable: true, kind: "number"},
  { key: "ag_oz", label: "Ag Oz", editable: true, kind: "number"},
  { key: "au_rec", label: "Au Rec", editable: true, kind: "number"},
  { key: "pio", label: "PIO", editable: true, kind: "number"},
  { key: "pio_disc", label: "PIO Desc.", editable: true, kind: "number"},
  { key: "maquila", label: "Maquila", editable: true, kind: "number"},
  { key: "nacn", label: "NaCN", editable: true, kind: "number"},
  { key: "escalador", label: "Escalador", editable: true, kind: "number"},
  { key: "usd_tms", label: "USD/TMS", editable: true, kind: "number"},
  { key: "au_usd", label: "Au USD", editable: true, kind: "number"},
  { key: "ag_usd", label: "Ag USD", editable: true, kind: "number"},
  { key: "pay_type", label: "Tipo Pago", editable: true, kind: "text", width: 110 },
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
  for (const c of COLUMNS) out[c.key] = toText(r[c.key]);
  return out;
}

function parseNum(v: string) {
  const t = String(v ?? "").trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function buildPayload(row: DraftRow) {
  const payload: Record<string, any> = {};
  payload.lot = String(row.lot ?? "").trim() || null;

  for (const f of EDITABLE_FIELDS) {
    const raw = String(row[f] ?? "").trim();

    if (NUMERIC_FIELDS.includes(f)) {
      payload[f] = raw === "" ? null : parseNum(raw);
      continue;
    }

    payload[f] = raw || null;
  }

  return payload;
}

function compareLot(a: string, b: string) {
  return String(a || "").localeCompare(String(b || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function getSortValue(row: TraceabilityRow, key: SortKey) {
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
  } else {
    result = av.localeCompare(bv, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

  return dir === "asc" ? result : -result;
}

function inDateRange(entryDate: string | null, from: string, to: string) {
  const d = String(entryDate || "").trim();
  if (!d) return !from && !to;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

type RowItemProps = {
  row: TraceabilityRow;
  loading: boolean;
  saving: boolean;
  registerInput: (key: string, field: keyof TraceabilityRow, el: HTMLInputElement | null) => void;
  onCellBlur: (key: string, field: keyof TraceabilityRow, value: string) => void;
  cellBase: React.CSSProperties;
  inputBase: React.CSSProperties;
  gridH: string;
  gridV: string;
  rowBg: string;
};

const RowItem = React.memo(function RowItem({
  row,
  loading,
  saving,
  registerInput,
  onCellBlur,
  cellBase,
  inputBase,
  gridH,
  gridV,
  rowBg,
}: RowItemProps) {
  const key = String(row.lot || "").trim();

  return (
    <tr className="capex-tr">
      {COLUMNS.map((c) => {
        if (!c.editable) {
          const isNumber = c.kind === "number" || c.key === "sack_qty";
          const raw = row[c.key];
          const show = isNumber && !isBlank(raw) ? Number(raw).toFixed(2) : String(raw ?? "");

          return (
            <td
              key={String(c.key)}
              className="capex-td"
              style={{
                ...cellBase,
                borderTop: gridH,
                borderBottom: gridH,
                borderRight: gridV,
                background: rowBg,
                textAlign: isNumber ? "right" : "left",
                fontWeight: 800,
                width: AUTO_GROW_KEYS.includes(c.key) ? "auto" : c.width || 110,
                minWidth: AUTO_GROW_KEYS.includes(c.key) ? 76 : c.width || 110,
                maxWidth: AUTO_GROW_KEYS.includes(c.key) ? undefined : c.width || 110,
                padding: isNumber ? "6px 4px" : "6px 8px",
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
              background: rowBg,
              padding: c.kind === "number" ? "4px 4px" : "6px 8px",
              width: AUTO_GROW_KEYS.includes(c.key) ? "auto" : c.width || 110,
              minWidth: AUTO_GROW_KEYS.includes(c.key) ? 76 : c.width || 110,
              maxWidth: AUTO_GROW_KEYS.includes(c.key) ? undefined : c.width || 110,
              overflow: "hidden",
              boxSizing: "border-box",
            }}
          >
            <input
              ref={(el) => registerInput(key, c.key, el)}
              type={c.kind === "date" ? "date" : "text"}
              defaultValue={toText(row[c.key])}
              disabled={loading || saving}
              onBlur={(e) => onCellBlur(key, c.key, e.target.value)}
              inputMode={c.kind === "number" ? "decimal" : "text"}
              style={{
                ...inputBase,
              width: AUTO_GROW_KEYS.includes(c.key) ? "100%" : c.kind === "number" ? "56px" : "100%",
              minWidth: AUTO_GROW_KEYS.includes(c.key) ? "76px" : c.kind === "number" ? "56px" : undefined,
              maxWidth: AUTO_GROW_KEYS.includes(c.key) ? undefined : c.kind === "number" ? "56px" : undefined,
                padding: c.kind === "number" ? "4px 6px" : "6px 8px",
                ...(c.kind === "number" ? { textAlign: "right" as const } : {}),
              }}
            />
          </td>
        );
      })}
    </tr>
  );
});

export default function TraceabilityEntryForm() {
  const [rows, setRows] = useState<TraceabilityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("lot");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const draftsRef = useRef<Record<string, DraftRow>>({});
  const originalsRef = useRef<Record<string, DraftRow>>({});
  const inputsRef = useRef<Record<string, Partial<Record<keyof TraceabilityRow, HTMLInputElement | null>>>>({});

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
      originalsRef.current = nextOriginals;
      inputsRef.current = {};
      setRows(data);
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo cargar")}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const preparedRows = useMemo(() => {
    const filtered = rows.filter((row) => inDateRange(row.entry_date, dateFrom, dateTo));
    return [...filtered].sort((a, b) => compareByKey(a, b, sortKey, sortDir));
  }, [rows, dateFrom, dateTo, sortKey, sortDir]);

  const registerInput = useCallback((key: string, field: keyof TraceabilityRow, el: HTMLInputElement | null) => {
    if (!inputsRef.current[key]) inputsRef.current[key] = {};
    inputsRef.current[key][field] = el;
  }, []);

  const onCellBlur = useCallback((key: string, field: keyof TraceabilityRow, value: string) => {
    const current = draftsRef.current[key];
    if (!current) return;

    current[field] = value;

    if (!NUMERIC_FIELDS.includes(field as EditableField)) return;

    const n = parseNum(value);
    if (n === null) return;

    const formatted = n.toFixed(2);
    current[field] = formatted;

    const input = inputsRef.current[key]?.[field];
    if (input && input.value !== formatted) input.value = formatted;
  }, []);

  async function onSaveAll() {
    const editedKeys = Object.keys(draftsRef.current).filter((key) => {
      const draft = draftsRef.current[key];
      const original = originalsRef.current[key];
      if (!draft || !original) return false;

      for (const c of COLUMNS) {
        if (String(draft[c.key] ?? "") !== String(original[c.key] ?? "")) return true;
      }
      return false;
    });

    if (editedKeys.length === 0) {
      setMsg("No hay filas editadas para guardar.");
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
    width: "100%",
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
        <div style={{ fontWeight: 900 }}>Trazabilidad · Ingresar Datos</div>

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

          <Button type="button" size="sm" variant="default" onClick={loadData} disabled={loading || saving}>
            {loading ? "Cargando…" : "Refrescar"}
          </Button>

          <Button type="button" size="sm" variant="primary" onClick={onSaveAll} disabled={loading || saving}>
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
            border: msg.startsWith("OK") ? "1px solid rgba(102,199,255,.45)" : "1px solid rgba(255,80,80,.45)",
            background: msg.startsWith("OK") ? "rgba(102,199,255,.10)" : "rgba(255,80,80,.10)",
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
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          style={{
            display: "inline-block",
            width: "max-content",
            maxWidth: "100%",
          }}
        >
          <Table stickyHeader maxHeight={"calc(100vh - 260px)"}>
            <colgroup>
              {COLUMNS.map((c) => (
                <col
                  key={String(c.key)}
                  style={
                    AUTO_GROW_KEYS.includes(c.key)
                      ? { width: "auto", minWidth: 76 }
                      : {
                          width: c.width || 110,
                          minWidth: c.width || 110,
                          maxWidth: c.width || 110,
                        }
                  }
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
                        width: AUTO_GROW_KEYS.includes(c.key) ? "auto" : c.width || 110,
                        minWidth: AUTO_GROW_KEYS.includes(c.key) ? 76 : c.width || 110,
                        maxWidth: AUTO_GROW_KEYS.includes(c.key) ? undefined : c.width || 110,
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
              {preparedRows.map((row) => (
                <RowItem
                  key={String(row.lot || "")}
                  row={row}
                  loading={loading}
                  saving={saving}
                  registerInput={registerInput}
                  onCellBlur={onCellBlur}
                  cellBase={cellBase}
                  inputBase={inputBase}
                  gridH={gridH}
                  gridV={gridV}
                  rowBg={rowBg}
                />
              ))}

              {!loading && preparedRows.length === 0 ? (
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
    </div>
  );
}