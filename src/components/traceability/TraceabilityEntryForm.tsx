"use client";

import React, { useEffect, useMemo, useState } from "react";
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

const DATE_FIELDS: EditableField[] = ["process_date"];

const TEXT_FIELDS: EditableField[] = [
  "transport_name",
  "transport_guide_number",
  "zone_1",
  "zone_2",
  "pay_type",
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
  { key: "tmh", label: "TMH", editable: true, kind: "number", width: 78 },
  { key: "h2o", label: "H2O", editable: true, kind: "number", width: 78 },
  { key: "tms", label: "TMS", editable: true, kind: "number", width: 78 },
  { key: "au_grade_oztc", label: "Au Grade", editable: true, kind: "number", width: 78 },
  { key: "ag_grade_oztc", label: "Ag Grade", editable: true, kind: "number", width: 78 },
  { key: "cu_grade_pct", label: "Cu %", editable: true, kind: "number", width: 78 },
  { key: "au_oz", label: "Au Oz", editable: true, kind: "number", width: 78 },
  { key: "ag_oz", label: "Ag Oz", editable: true, kind: "number", width: 78 },
  { key: "au_rec", label: "Au Rec", editable: true, kind: "number", width: 78 },
  { key: "pio", label: "PIO", editable: true, kind: "number", width: 78 },
  { key: "pio_disc", label: "PIO Desc.", editable: true, kind: "number", width: 78 },
  { key: "maquila", label: "Maquila", editable: true, kind: "number", width: 78 },
  { key: "nacn", label: "NaCN", editable: true, kind: "number", width: 78 },
  { key: "escalador", label: "Escalador", editable: true, kind: "number", width: 78 },
  { key: "usd_tms", label: "USD/TMS", editable: true, kind: "number", width: 78 },
  { key: "au_usd", label: "Au USD", editable: true, kind: "number", width: 78 },
  { key: "ag_usd", label: "Ag USD", editable: true, kind: "number", width: 78 },
  { key: "pay_type", label: "Tipo Pago", editable: true, kind: "text", width: 110 },
  { key: "doc_date", label: "F. Doc", editable: false, kind: "readonly", width: 105, sortable: true },
  { key: "doc_number", label: "Nro Doc", editable: false, kind: "readonly", width: 110, sortable: true },
];

function isBlank(v: unknown) {
  return v === null || v === undefined || String(v).trim() === "";
}

function toText(v: unknown, numeric2 = false) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" && Number.isFinite(v)) {
    return numeric2 ? v.toFixed(2) : String(v);
  }
  return String(v);
}

function toDraftRow(r: TraceabilityRow): DraftRow {
  const out = {} as DraftRow;
  for (const c of COLUMNS) {
    const numeric2 = NUMERIC_FIELDS.includes(c.key as EditableField);
    out[c.key] = toText(r[c.key], numeric2);
  }
  return out;
}

function parseNum(v: string) {
  const t = String(v ?? "").trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function isValidDateText(v: string) {
  if (!String(v ?? "").trim()) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim());
}

function isValidText(field: EditableField, v: string) {
  const t = String(v ?? "").trim();
  if (!t) return true;

  if (field === "zone_1") return /^[A-Za-z0-9_\-./ ]+$/.test(t);
  if (field === "transport_guide_number") return /^[A-Za-z0-9_\-./ ]+$/.test(t);
  if (field === "pay_type") return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_\-./() ]+$/.test(t);
  if (field === "transport_name" || field === "zone_2") {
    return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_\-./()&, ]+$/.test(t);
  }

  return true;
}

function isValidField(field: EditableField, value: string) {
  if (NUMERIC_FIELDS.includes(field)) {
    const n = parseNum(value);
    if (n === null) return true;
    if (Number.isNaN(n)) return false;
    return n >= 0;
  }

  if (DATE_FIELDS.includes(field)) return isValidDateText(value);
  if (TEXT_FIELDS.includes(field)) return isValidText(field, value);

  return true;
}

function rowHasAnyInvalid(row: DraftRow) {
  return EDITABLE_FIELDS.some((f) => !isValidField(f, row[f]));
}

function isRowComplete(row: TraceabilityRow) {
  return COLUMNS.every((c) => !isBlank(row[c.key]));
}

function compareLot(a: string, b: string) {
  return String(a || "").localeCompare(String(b || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function sameDraft(a: DraftRow, b: DraftRow) {
  for (const c of COLUMNS) {
    if (String(a[c.key] ?? "") !== String(b[c.key] ?? "")) return false;
  }
  return true;
}

function inDateRange(entryDate: string | null, from: string, to: string) {
  const d = String(entryDate || "").trim();
  if (!d) return !from && !to;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function buildPayload(row: DraftRow) {
  const payload: Record<string, any> = {};

  payload.lot = String(row.lot ?? "").trim() || null;

  for (const f of EDITABLE_FIELDS) {
    const raw = String(row[f] ?? "").trim();

    if (NUMERIC_FIELDS.includes(f)) {
      const n = parseNum(raw);
      payload[f] = raw === "" || n === null ? null : n;
      continue;
    }

    if (DATE_FIELDS.includes(f)) {
      payload[f] = raw || null;
      continue;
    }

    payload[f] = raw || null;
  }

  return payload;
}

function getSortValue(
  row: TraceabilityRow,
  draft: DraftRow | undefined,
  key: SortKey
) {
  const draftValue = draft?.[key];

  if (draftValue !== undefined) {
    return String(draftValue).trim();
  }

  const rowValue = row[key];
  if (rowValue === null || rowValue === undefined) return "";
  return String(rowValue).trim();
}

function compareByKey(
  a: TraceabilityRow,
  b: TraceabilityRow,
  aDraft: DraftRow | undefined,
  bDraft: DraftRow | undefined,
  key: SortKey,
  dir: SortDir
) {
  const av = getSortValue(a, aDraft, key);
  const bv = getSortValue(b, bDraft, key);

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

export default function TraceabilityEntryForm() {
  const [rows, setRows] = useState<TraceabilityRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [originals, setOriginals] = useState<Record<string, DraftRow>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("lot");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  async function loadData() {
    setLoading(true);
    setMsg(null);
    try {
      const r = (await apiGet("/api/traceability")) as GetResp;
      const data = Array.isArray(r?.rows) ? r.rows : [];

      const nextDrafts: Record<string, DraftRow> = {};
      const nextOriginals: Record<string, DraftRow> = {};

      data.forEach((row, idx) => {
        const key = String(row.lot || "").trim();
        const d = toDraftRow(row);
        nextDrafts[key] = d;
        nextOriginals[key] = { ...d };
      });

      setRows(data);
      setDrafts(nextDrafts);
      setOriginals(nextOriginals);
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo cargar")}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const preparedRows = useMemo(() => {
    const filtered = rows
      .map((row, idx) => {
        const key = String(row.lot || "").trim();
        const complete = isRowComplete(row);
        const draft = drafts[key] || toDraftRow(row);
        const changed = !sameDraft(draft, originals[key] || toDraftRow(row));

        return {
          row,
          idx,
          key,
          complete,
          changed,
        };
      })
      .filter((x) => inDateRange(x.row.entry_date, dateFrom, dateTo));

    const incompletes = filtered
      .filter((x) => !x.complete)
      .sort((a, b) => compareByKey(a.row, b.row, drafts[a.key], drafts[b.key], sortKey, sortDir));

    const completes = filtered
      .filter((x) => x.complete)
      .sort((a, b) => compareByKey(a.row, b.row, drafts[a.key], drafts[b.key], sortKey, sortDir));

    return [...incompletes, ...completes];
  }, [rows, drafts, originals, dateFrom, dateTo, sortKey, sortDir]);

  const editedRowKeys = useMemo(() => {
    return Object.keys(drafts).filter((key) => {
      const original = originals[key];
      const current = drafts[key];
      if (!original || !current) return false;
      return !sameDraft(current, original);
    });
  }, [drafts, originals]);

  const editedCount = editedRowKeys.length;

  const hasInvalidEditedRows = useMemo(() => {
    return editedRowKeys.some((key) => {
      const row = drafts[key];
      return row ? rowHasAnyInvalid(row) : false;
    });
  }, [editedRowKeys, drafts]);

  function setCell(key: string, field: keyof TraceabilityRow, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || ({} as DraftRow)),
        [field]: value,
      },
    }));
  }

  function onBlurFormat(key: string, field: keyof TraceabilityRow) {
    if (!NUMERIC_FIELDS.includes(field as EditableField)) return;

    setDrafts((prev) => {
      const current = prev[key];
      if (!current) return prev;

      const raw = current[field];
      const n = parseNum(raw);
      if (n === null || Number.isNaN(n)) return prev;

      return {
        ...prev,
        [key]: {
          ...current,
          [field]: n.toFixed(2),
        },
      };
    });
  }

  async function onSaveAll() {
    if (editedRowKeys.length === 0) {
      setMsg("No hay filas editadas para guardar.");
      return;
    }

    const invalidKey = editedRowKeys.find((key) => {
      const row = drafts[key];
      return row ? rowHasAnyInvalid(row) : false;
    });

    if (invalidKey) {
      const lot = String(drafts[invalidKey]?.lot || "").trim();
      setMsg(`ERROR: corrige valores inválidos en el lote ${lot}.`);
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      const jobs = editedRowKeys.map(async (key) => {
        const row = drafts[key];
        const lot = String(row?.lot || "").trim();

        if (!lot) {
          throw new Error("Hay una fila editada sin lote.");
        }

        const payload = buildPayload(row);
        const rr = (await apiPost("/api/traceability/web/insert", payload)) as SaveResp;

        if (!rr?.ok) {
          throw new Error(rr?.error || `No se pudo guardar el lote ${lot}`);
        }

        return { key, lot };
      });

      const results = await Promise.allSettled(jobs);

      const okLots: string[] = [];
      const failedLots: string[] = [];
      const failedMessages: string[] = [];

      results.forEach((result, index) => {
        const key = editedRowKeys[index];
        const lot = String(drafts[key]?.lot || "").trim() || `(fila ${index + 1})`;

        if (result.status === "fulfilled") {
          okLots.push(result.value.lot);
        } else {
          failedLots.push(lot);
          failedMessages.push(`${lot}: ${String(result.reason?.message || result.reason || "Error al guardar")}`);
        }
      });

      if (failedLots.length === 0) {
        setMsg(`OK: se guardaron ${okLots.length} fila(s).`);
        await loadData();
        return;
      }

      if (okLots.length > 0) {
        setMsg(
          `PARCIAL: guardadas ${okLots.length} fila(s). Fallaron ${failedLots.length}: ${failedMessages.join(" | ")}`
        );
        await loadData();
        return;
      }

      setMsg(`ERROR: no se pudo guardar ninguna fila. ${failedMessages.join(" | ")}`);
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
  const gridV = "2px solid rgba(191, 231, 255, 0.16)";
  const gridH = "2px solid rgba(191, 231, 255, 0.10)";
  const headerShadow = "0 8px 18px rgba(0,0,0,.18)";
  const rowBg = "rgba(0,0,0,.10)";
  const editedRowBg = "rgba(72, 201, 120, .16)";
  const editedRowBgComplete = "rgba(72, 201, 120, .12)";

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

  const inputErr: React.CSSProperties = {
    border: "1px solid rgba(255,80,80,.55)",
    background: "rgba(255,80,80,.10)",
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

        <div className="muted" style={{ fontWeight: 800, marginLeft: 8 }}>
          Se priorizan lotes incompletos
        </div>

        <div
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            background: editedCount > 0 ? "rgba(72, 201, 120, .16)" : "rgba(255,255,255,.06)",
            border: editedCount > 0 ? "1px solid rgba(72, 201, 120, .38)" : "1px solid rgba(255,255,255,.10)",
            fontWeight: 900,
          }}
        >
          Filas en edición: {editedCount}
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

          <Button type="button" size="sm" variant="default" onClick={loadData} disabled={loading || saving}>
            {loading ? "Cargando…" : "Refrescar"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={onSaveAll}
            disabled={loading || saving || editedCount === 0 || hasInvalidEditedRows}
          >
            {saving ? "Guardando…" : `Guardar${editedCount > 0 ? ` (${editedCount})` : ""}`}
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
          overflow: "auto",
        }}
      >
        <div
          style={{
            minWidth: "max-content",
            width: "max-content",
          }}
        >
          <Table stickyHeader>
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
                        padding: "8px 8px",
                        fontSize: 12,
                        minWidth: c.width || 110,
                        cursor: sortable ? "pointer" : "default",
                        userSelect: "none",
                      }}
                    >
                      {c.label}
                      {sortable ? getSortIndicator(c.key) : ""}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {preparedRows.map(({ row, key, complete, changed }) => {
                const draft = drafts[key] || toDraftRow(row);
                const rowChanged = changed;

                return (
                  <tr key={key} className="capex-tr">
                    {COLUMNS.map((c) => {
                      const value = draft[c.key] ?? "";
                      const invalid = c.editable ? !isValidField(c.key as EditableField, value) : false;
                      const bg = rowChanged
                        ? complete
                          ? editedRowBgComplete
                          : editedRowBg
                        : complete
                        ? "rgba(255,255,255,.05)"
                        : rowBg;

                      if (!c.editable) {
                        const isNumber = c.kind === "number" || c.key === "sack_qty";
                        const show =
                          isNumber && !isBlank(row[c.key])
                            ? Number(row[c.key]).toFixed(2)
                            : String(row[c.key] ?? "");

                        return (
                          <td
                            key={String(c.key)}
                            className="capex-td"
                            style={{
                              ...cellBase,
                              borderTop: gridH,
                              borderBottom: gridH,
                              borderRight: gridV,
                              background: bg,
                              textAlign: isNumber ? "right" : "left",
                              fontWeight: 800,
                              opacity: complete ? 0.82 : 1,
                            }}
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
                            background: bg,
                            padding: "6px 8px",
                          }}
                        >
                          <input
                            type={c.kind === "date" ? "date" : "text"}
                            value={value}
                            disabled={loading || saving}
                            onChange={(e) => setCell(key, c.key, e.target.value)}
                            onBlur={() => onBlurFormat(key, c.key)}
                            inputMode={c.kind === "number" ? "decimal" : "text"}
                            style={{
                              ...inputBase,
                              ...(c.kind === "number" ? { textAlign: "right" as const } : {}),
                              ...(invalid ? inputErr : {}),
                              ...(complete ? { opacity: 0.9 } : {}),
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

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