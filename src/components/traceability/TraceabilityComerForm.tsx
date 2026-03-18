// src/components/traceability/TraceabilityComerForm.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

type TraceabilityRow = {
  lot: string | null;
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

type GetResp = {
  ok: boolean;
  rows?: TraceabilityRow[];
  error?: string;
};

type SaveResp = {
  ok: boolean;
  error?: string;
};

type DraftRow = {
  lot: string;
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
  au_usd: string;
  ag_usd: string;
  usd_tms: string;
};

const EDITABLE_FIELDS = [
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
  "au_usd",
  "ag_usd",
  "usd_tms",
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

const NUMERIC_FIELDS: EditableField[] = [...EDITABLE_FIELDS];

const RANGE_0_100_FIELDS: EditableField[] = ["h2o", "cu_grade_pct", "au_rec"];

type SortKey = "lot";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 100;

const COLUMNS: {
  key: "lot" | EditableField | "monto_usd";
  label: string;
  editable: boolean;
  kind: "text" | "number" | "readonly";
  width?: number;
  sortable?: boolean;
}[] = [
  { key: "lot", label: "Lote", editable: false, kind: "readonly", width: 120, sortable: true },
  { key: "tmh", label: "TMH", editable: true, kind: "number", width: 88 },
  { key: "h2o", label: "H2O", editable: true, kind: "number", width: 88 },
  { key: "tms", label: "TMS", editable: true, kind: "number", width: 88 },
  { key: "au_grade_oztc", label: "Au (Oz/TC)", editable: true, kind: "number", width: 96 },
  { key: "ag_grade_oztc", label: "Ag (Oz/TC)", editable: true, kind: "number", width: 96 },
  { key: "cu_grade_pct", label: "Cu %", editable: true, kind: "number", width: 88 },
  { key: "au_oz", label: "Au Oz", editable: true, kind: "number", width: 88 },
  { key: "ag_oz", label: "Ag Oz", editable: true, kind: "number", width: 88 },
  { key: "au_rec", label: "Au Rec", editable: true, kind: "number", width: 88 },
  { key: "pio", label: "PIO", editable: true, kind: "number", width: 88 },
  { key: "pio_disc", label: "PIO Desc.", editable: true, kind: "number", width: 96 },
  { key: "maquila", label: "Maquila", editable: true, kind: "number", width: 88 },
  { key: "nacn", label: "NaCN", editable: true, kind: "number", width: 88 },
  { key: "escalador", label: "Escalador", editable: true, kind: "number", width: 88 },
  { key: "au_usd", label: "Au USD", editable: true, kind: "number", width: 88 },
  { key: "ag_usd", label: "Ag USD", editable: true, kind: "number", width: 88 },
  { key: "usd_tms", label: "USD/TMS", editable: true, kind: "number", width: 88 },
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

function toNumOrNull(v: unknown) {
  const n = parseNum(String(v ?? ""));
  return n === null ? null : n;
}

function toDraftRow(r: TraceabilityRow): DraftRow {
  return {
    lot: toText(r.lot),
    tmh: isBlank(r.tmh) ? "" : Number(r.tmh).toFixed(3),
    h2o: isBlank(r.h2o) ? "" : Number(r.h2o).toFixed(2),
    tms: isBlank(r.tms) ? "" : Number(r.tms).toFixed(3),
    au_grade_oztc: isBlank(r.au_grade_oztc) ? "" : Number(r.au_grade_oztc).toFixed(3),
    ag_grade_oztc: isBlank(r.ag_grade_oztc) ? "" : Number(r.ag_grade_oztc).toFixed(3),
    cu_grade_pct: isBlank(r.cu_grade_pct) ? "" : Number(r.cu_grade_pct).toFixed(3),
    au_oz: isBlank(r.au_oz) ? "" : Number(r.au_oz).toFixed(2),
    ag_oz: isBlank(r.ag_oz) ? "" : Number(r.ag_oz).toFixed(2),
    au_rec: isBlank(r.au_rec) ? "" : Number(r.au_rec).toFixed(2),
    pio: isBlank(r.pio) ? "" : Number(r.pio).toFixed(2),
    pio_disc: isBlank(r.pio_disc) ? "" : Number(r.pio_disc).toFixed(2),
    maquila: isBlank(r.maquila) ? "" : Number(r.maquila).toFixed(2),
    nacn: isBlank(r.nacn) ? "" : Number(r.nacn).toFixed(2),
    escalador: isBlank(r.escalador) ? "" : Number(r.escalador).toFixed(2),
    au_usd: isBlank(r.au_usd) ? "" : Number(r.au_usd).toFixed(2),
    ag_usd: isBlank(r.ag_usd) ? "" : Number(r.ag_usd).toFixed(2),
    usd_tms: isBlank(r.usd_tms) ? "" : Number(r.usd_tms).toFixed(2),
  };
}

function calcMontoUsd(draft: DraftRow) {
  const usdTms = toNumOrNull(draft.usd_tms);
  const tms = toNumOrNull(draft.tms);
  if (usdTms === null || tms === null) return null;
  return round2(usdTms * tms);
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

function buildPayload(row: DraftRow) {
  const payload: Record<string, any> = {};
  payload.lot = String(row.lot ?? "").trim() || null;

  for (const f of EDITABLE_FIELDS) {
    const raw = String(row[f] ?? "").trim();
    const num = raw === "" ? null : parseNum(raw);
    const err = validateNumericRange(f, num);
    if (err) throw new Error(err);
    payload[f] = num;
  }

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

type RowItemProps = {
  row: TraceabilityRow;
  draft: DraftRow;
  loading: boolean;
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
  loading,
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
          if (c.key === "monto_usd") raw = calcMontoUsd(draft);

          const decimals3Keys = ["tmh", "tms", "au_grade_oztc", "ag_grade_oztc", "cu_grade_pct"];
          const decimals = decimals3Keys.includes(String(c.key)) ? 3 : 2;

          const isNumber = c.key === "monto_usd";
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
              disabled={loading || saving}
              onBlur={(e) => onCellBlur(key, c.key as keyof DraftRow, e.target.value)}
              inputMode={c.kind === "number" ? "decimal" : "text"}
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
  const [loading, setLoading] = useState(false);
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
      setEditedTick((v) => v + 1);
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

  const registerInput = useCallback((key: string, field: keyof DraftRow, el: HTMLInputElement | null) => {
    if (!inputsRef.current[key]) inputsRef.current[key] = {};
    inputsRef.current[key][field] = el;
  }, []);

  const onCellBlur = useCallback((key: string, field: keyof DraftRow, value: string) => {
    const current = draftsRef.current[key];
    if (!current) return;
    if (field === "lot") return;

    const previousValue = String(current[field] ?? "");
    const trimmed = String(value ?? "");

    const editableField = field as EditableField;
    const n = parseNum(trimmed);

    if (trimmed.trim() === "") {
      current[field] = "";
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

    const decimals3Fields: EditableField[] = [
      "tmh",
      "tms",
      "au_grade_oztc",
      "ag_grade_oztc",
      "cu_grade_pct",
    ];

    const formatted = decimals3Fields.includes(editableField) ? n.toFixed(3) : n.toFixed(2);
    current[field] = formatted;

    const input = inputsRef.current[key]?.[field];
    if (input && input.value !== formatted) input.value = formatted;

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
          Filas editadas: {editedCount}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
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
                    key={rowKey}
                    row={row}
                    draft={draftsRef.current[rowKey] ?? toDraftRow(row)}
                    loading={loading}
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