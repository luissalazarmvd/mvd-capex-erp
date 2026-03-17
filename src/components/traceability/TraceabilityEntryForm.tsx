// src/components/traceability/TraceabilityEntryForm.tsx
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
  "lot",
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
  "lot",
  "transport_name",
  "transport_guide_number",
  "zone_1",
  "zone_2",
  "pay_type",
];

const COLUMNS: {
  key: keyof TraceabilityRow;
  label: string;
  editable: boolean;
  kind: "text" | "date" | "number" | "readonly";
  width?: number;
}[] = [
  { key: "lot", label: "Lote", editable: true, kind: "text", width: 110 },
  { key: "entry_date", label: "F. Ingreso", editable: false, kind: "readonly", width: 110 },
  { key: "process_date", label: "F. Proceso", editable: true, kind: "date", width: 120 },
  { key: "sack_qty", label: "Sacos", editable: false, kind: "readonly", width: 90 },
  { key: "miner_name", label: "Minero", editable: false, kind: "readonly", width: 160 },
  { key: "plate", label: "Placa", editable: false, kind: "readonly", width: 110 },
  { key: "ruc", label: "RUC", editable: false, kind: "readonly", width: 130 },
  { key: "concession_name", label: "Concesión", editable: false, kind: "readonly", width: 160 },
  { key: "concession_code", label: "Cod. Concesión", editable: false, kind: "readonly", width: 130 },
  { key: "district", label: "Distrito", editable: false, kind: "readonly", width: 120 },
  { key: "province", label: "Provincia", editable: false, kind: "readonly", width: 120 },
  { key: "department", label: "Departamento", editable: false, kind: "readonly", width: 130 },
  { key: "sender_guide_number", label: "Guía Remitente", editable: false, kind: "readonly", width: 140 },
  { key: "transport_name", label: "Transporte", editable: true, kind: "text", width: 150 },
  { key: "transport_guide_number", label: "Guía Transporte", editable: true, kind: "text", width: 150 },
  { key: "zone_1", label: "Zona 1", editable: true, kind: "text", width: 100 },
  { key: "zone_2", label: "Zona 2", editable: true, kind: "text", width: 150 },
  { key: "tmh", label: "TMH", editable: true, kind: "number", width: 110 },
  { key: "h2o", label: "H2O", editable: true, kind: "number", width: 110 },
  { key: "tms", label: "TMS", editable: true, kind: "number", width: 110 },
  { key: "au_grade_oztc", label: "Au Grade", editable: true, kind: "number", width: 110 },
  { key: "ag_grade_oztc", label: "Ag Grade", editable: true, kind: "number", width: 110 },
  { key: "cu_grade_pct", label: "Cu %", editable: true, kind: "number", width: 110 },
  { key: "au_oz", label: "Au Oz", editable: true, kind: "number", width: 110 },
  { key: "ag_oz", label: "Ag Oz", editable: true, kind: "number", width: 110 },
  { key: "au_rec", label: "Au Rec", editable: true, kind: "number", width: 110 },
  { key: "pio", label: "PIO", editable: true, kind: "number", width: 110 },
  { key: "pio_disc", label: "PIO Desc.", editable: true, kind: "number", width: 110 },
  { key: "maquila", label: "Maquila", editable: true, kind: "number", width: 110 },
  { key: "nacn", label: "NaCN", editable: true, kind: "number", width: 110 },
  { key: "escalador", label: "Escalador", editable: true, kind: "number", width: 110 },
  { key: "usd_tms", label: "USD/TMS", editable: true, kind: "number", width: 110 },
  { key: "au_usd", label: "Au USD", editable: true, kind: "number", width: 110 },
  { key: "ag_usd", label: "Ag USD", editable: true, kind: "number", width: 110 },
  { key: "pay_type", label: "Tipo Pago", editable: true, kind: "text", width: 120 },
  { key: "doc_date", label: "F. Doc", editable: false, kind: "readonly", width: 110 },
  { key: "doc_number", label: "Nro Doc", editable: false, kind: "readonly", width: 120 },
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

function format2(v: string) {
  const n = parseNum(v);
  if (n === null || Number.isNaN(n)) return v;
  return n.toFixed(2);
}

function isValidDateText(v: string) {
  if (!String(v ?? "").trim()) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim());
}

function isValidText(field: EditableField, v: string) {
  const t = String(v ?? "").trim();
  if (!t) return true;

  if (field === "lot") return /^[A-Za-z0-9_\-./ ]+$/.test(t);
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
  return String(a || "").localeCompare(String(b || ""), undefined, { numeric: true, sensitivity: "base" });
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

export default function TraceabilityEntryForm() {
  const [rows, setRows] = useState<TraceabilityRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [originals, setOriginals] = useState<Record<string, DraftRow>>({});
  const [loading, setLoading] = useState(false);
  const [savingLot, setSavingLot] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function loadData() {
    setLoading(true);
    setMsg(null);
    try {
      const r = (await apiGet("/api/traceability")) as GetResp;
      const data = Array.isArray(r?.rows) ? r.rows : [];

      const nextDrafts: Record<string, DraftRow> = {};
      const nextOriginals: Record<string, DraftRow> = {};

      data.forEach((row, idx) => {
        const key = `${String(row.lot || "").trim()}__${idx}`;
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
      .map((row, idx) => ({
        row,
        idx,
        key: `${String(row.lot || "").trim()}__${idx}`,
        complete: isRowComplete(row),
      }))
      .filter((x) => inDateRange(x.row.entry_date, dateFrom, dateTo));

    const incompletes = filtered
      .filter((x) => !x.complete)
      .sort((a, b) => compareLot(String(a.row.lot || ""), String(b.row.lot || "")));

    const completes = filtered
      .filter((x) => x.complete)
      .sort((a, b) => compareLot(String(a.row.lot || ""), String(b.row.lot || "")));

    return [...incompletes, ...completes];
  }, [rows, dateFrom, dateTo]);

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

  async function onSaveRow(key: string) {
    const row = drafts[key];
    if (!row) return;

    const lot = String(row.lot || "").trim();
    if (!lot) {
      setMsg("ERROR: el lote es obligatorio.");
      return;
    }

    if (rowHasAnyInvalid(row)) {
      setMsg(`ERROR: corrige valores inválidos en el lote ${lot}.`);
      return;
    }

    setSavingLot(key);
    setMsg(null);

    try {
      const payload = buildPayload(row);
      const rr = (await apiPost("/api/traceability/web/insert", payload)) as SaveResp;
      if (!rr?.ok) throw new Error(rr?.error || "No se pudo guardar");

      setOriginals((prev) => ({ ...prev, [key]: { ...row } }));
      setMsg(`OK: guardado ${lot}`);
      await loadData();
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo guardar")}`);
    } finally {
      setSavingLot(null);
    }
  }

  const headerBg = "rgb(6, 36, 58)";
  const headerBorder = "1px solid rgba(191, 231, 255, 0.26)";
  const gridV = "2px solid rgba(191, 231, 255, 0.16)";
  const gridH = "2px solid rgba(191, 231, 255, 0.10)";
  const headerShadow = "0 8px 18px rgba(0,0,0,.18)";
  const rowBg = "rgba(0,0,0,.10)";

  const stickyHead: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 8,
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
  };

  const inputErr: React.CSSProperties = {
    border: "1px solid rgba(255,80,80,.55)",
    background: "rgba(255,80,80,.10)",
  };

  return (
    <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
      <div
        className="panel-inner"
        style={{ padding: "10px 12px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
      >
        <div style={{ fontWeight: 900 }}>Trazabilidad · Ingresar Datos</div>

        <div className="muted" style={{ fontWeight: 800, marginLeft: 8 }}>
          Se priorizan lotes incompletos
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

          <Button type="button" size="sm" variant="default" onClick={loadData} disabled={loading || !!savingLot}>
            {loading ? "Cargando…" : "Refrescar"}
          </Button>
        </div>
      </div>

      {msg ? (
        <div
          className="panel-inner"
          style={{
            padding: 10,
            border: msg.startsWith("OK") ? "1px solid rgba(102,199,255,.45)" : "1px solid rgba(255,80,80,.45)",
            background: msg.startsWith("OK") ? "rgba(102,199,255,.10)" : "rgba(255,80,80,.10)",
            fontWeight: 800,
          }}
        >
          {msg}
        </div>
      ) : null}

      <div className="panel-inner" style={{ padding: 0, overflow: "visible" }}>
        <Table stickyHeader>
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
                    textAlign: c.kind === "number" || c.key === "sack_qty" ? "right" : "left",
                    padding: "8px 8px",
                    fontSize: 12,
                    minWidth: c.width || 110,
                  }}
                >
                  {c.label}
                </th>
              ))}

              <th
                className="capex-th"
                style={{
                  ...stickyHead,
                  border: headerBorder,
                  borderBottom: headerBorder,
                  textAlign: "center",
                  padding: "8px 8px",
                  fontSize: 12,
                  minWidth: 120,
                }}
              >
                Acción
              </th>
            </tr>
          </thead>

          <tbody>
            {preparedRows.map(({ row, key, complete }) => {
              const draft = drafts[key] || toDraftRow(row);
              const changed = !sameDraft(draft, originals[key] || toDraftRow(row));
              const hasInvalid = rowHasAnyInvalid(draft);
              const canSave = changed && !hasInvalid && !loading && savingLot !== key;

              return (
                <tr key={key} className="capex-tr">
                  {COLUMNS.map((c) => {
                    const value = draft[c.key] ?? "";
                    const invalid = c.editable ? !isValidField(c.key as EditableField, value) : false;

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
                            background: complete ? "rgba(255,255,255,.05)" : rowBg,
                            textAlign: isNumber ? "right" : "left",
                            fontWeight: 800,
                            opacity: complete ? 0.78 : 1,
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
                          background: complete ? "rgba(255,255,255,.05)" : rowBg,
                          padding: "6px 8px",
                        }}
                      >
                        <input
                          type={c.kind === "date" ? "date" : "text"}
                          value={value}
                          disabled={loading || !!savingLot}
                          onChange={(e) => setCell(key, c.key, e.target.value)}
                          onBlur={() => onBlurFormat(key, c.key)}
                          inputMode={c.kind === "number" ? "decimal" : "text"}
                          style={{
                            ...inputBase,
                            ...(c.kind === "number" ? { textAlign: "right" as const } : {}),
                            ...(invalid ? inputErr : {}),
                            ...(complete ? { opacity: 0.88 } : {}),
                          }}
                        />
                      </td>
                    );
                  })}

                  <td
                    className="capex-td"
                    style={{
                      ...cellBase,
                      borderTop: gridH,
                      borderBottom: gridH,
                      borderRight: gridV,
                      background: complete ? "rgba(255,255,255,.05)" : rowBg,
                      textAlign: "center",
                    }}
                  >
                    <Button type="button" size="sm" variant="primary" onClick={() => onSaveRow(key)} disabled={!canSave}>
                      {savingLot === key ? "Guardando…" : "Guardar"}
                    </Button>
                  </td>
                </tr>
              );
            })}

            {!loading && preparedRows.length === 0 ? (
              <tr className="capex-tr">
                <td className="capex-td" style={{ ...cellBase, fontWeight: 900 }} colSpan={COLUMNS.length + 1}>
                  No hay filas para el filtro seleccionado.
                </td>
              </tr>
            ) : null}

            {loading ? (
              <tr className="capex-tr">
                <td className="capex-td" style={{ ...cellBase, fontWeight: 900 }} colSpan={COLUMNS.length + 1}>
                  Cargando trazabilidad…
                </td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </div>
    </div>
  );
}