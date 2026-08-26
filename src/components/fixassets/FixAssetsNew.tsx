"use client";

import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Table } from "../ui/Table";
import { FastCellInput } from "./FastCellInput";

type VetaRow = {
  account_code: string | null;
  account_description: string | null;
  comp_date: string | null;
  subjournal_code: string | null;
  voucher_number: string | null;
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

type CatalogueRow = {
  asset_code: string | null;
  asset_description?: string | null;
  asset_type?: string | null;
  location_name?: string | null;
  origin_account_code?: string | null;
  capex_code?: string | null;
  subjournal_code?: string | null;
  voucher_number?: string | null;
  annex_code?: string | null;
  document_number?: string | null;
  assigned_to?: string | null;
  area_name?: string | null;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  cost_center_code?: string | null;
  depreciation_method?: string | null;
  asset_comment?: string | null;
  asset_ini_cost_pen?: number | string | null;
};

type CecoRow = {
  cost_center_code: string | null;
  cost_center_description: string | null;
};

type Draft = {
  asset_code: string;
  line_description: string;
  capex_code: string;
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
type TableColumnKey = keyof VetaRow | "asset_code";

const COLUMNS: Array<{ key: TableColumnKey; label: string; width: number }> = [
  { key: "asset_code", label: "COD", width: 105 },
  { key: "account_code", label: "Cuenta", width: 120 },
  { key: "account_description", label: "Descripción cuenta", width: 230 },
  { key: "comp_date", label: "Fecha contable", width: 125 },
  { key: "subjournal_code", label: "Subdiario", width: 105 },
  { key: "voucher_number", label: "Comprobante", width: 125 },
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

function sourceIdentity(row: Pick<VetaRow | CatalogueRow, "subjournal_code" | "voucher_number" | "annex_code" | "document_number">) {
  const parts = [row.subjournal_code, row.voucher_number, row.annex_code, row.document_number].map((value) => text(value).trim());
  return parts.some(Boolean) ? parts.join("\u001f") : "";
}

function numericDraft(value: string) {
  return value.replace(",", ".").replace(/[^0-9.-]/g, "");
}

function validNumber(value: string, allowBlank = false) {
  const clean = value.trim();
  if (!clean) return allowBlank;
  return /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(clean) && Number.isFinite(Number(clean));
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
  ["location_name", "Ubicación"], ["assigned_to", "Asignado a"], ["area_name", "Área"],
  ["brand", "Marca"], ["model", "Modelo"], ["serial_number", "Serie"],
  ["cost_center_code", "Centro de costo"], ["depreciation_method", "Método de depreciación"],
  ["asset_comment", "Comentario"],
] as const satisfies ReadonlyArray<readonly [Exclude<keyof Draft, "asset_code" | "line_description" | "capex_code" | "pen_amount" | "exc_rate" | "asset_type" | "operation_date" | "asset_situation">, string]>;
type ExtraField = (typeof EXTRA_FIELDS)[number][0];

type NewRowsTableProps = {
  title: string;
  subtitle: string;
  items: IndexedRow[];
  drafts: Record<number, Draft>;
  states: Record<number, RowState>;
  loading: boolean;
  onCommit: (index: number, field: keyof Draft, value: string) => void;
  onCodeActivity: (index: number, value: string) => void;
  onFocusDetails: (index: number) => void;
  onOpenDetails: (index: number) => void;
  focusedDetailIndex: number | null;
  catalogueBySource: ReadonlyMap<string, CatalogueRow>;
};

const NewRowsTable = memo(function NewRowsTable({
  title,
  subtitle,
  items,
  drafts,
  states,
  loading,
  onCommit,
  onCodeActivity,
  onFocusDetails,
  onOpenDetails,
  focusedDetailIndex,
  catalogueBySource,
}: NewRowsTableProps) {
  return (
    <section className="fixassets-new-table" style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", gap: 6, minWidth: 0, minHeight: 0 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 17 }}>{title} <span className="muted">({items.length})</span></h2>
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{subtitle}</div>
      </div>
      <div className="panel-inner fixassets-new-table-grid" style={{ overflow: "auto", height: "100%", minHeight: 0, padding: 0, background: "#0b4d6b", borderColor: "rgba(147,211,230,.28)" }}>
        <div style={{ minWidth: "max-content" }}>
          <Table disableScrollWrapper>
            <colgroup>{COLUMNS.map((column) => <col key={column.key} style={{ width: column.width, minWidth: column.width }} />)}</colgroup>
            <thead><tr>{COLUMNS.map((column) => {
              const sticky = column.key === "asset_code";
              return <th key={column.key} className="capex-th" style={{ left: sticky ? 0 : undefined, zIndex: sticky ? 45 : undefined, boxShadow: sticky ? "2px 0 rgba(216,238,255,.16)" : undefined }}>{column.label}</th>;
            })}</tr></thead>
            <tbody>
              {items.map(({ row, index }) => {
                const draft = drafts[index] || draftFrom(row);
                const existing = catalogueBySource.get(sourceIdentity(row)) || null;
                const state = states[index] || "idle";
                const focused = !existing && focusedDetailIndex === index;
                const background = existing ? "rgba(2,35,52,.82)" : state === "invalid" ? "rgba(216,93,39,.32)" : focused ? "rgba(27,147,227,.34)" : state === "valid" ? "rgba(94,128,25,.32)" : undefined;
                return <tr key={index} className="capex-tr" onClick={() => { if (!existing) onFocusDetails(index); }} title={existing ? `Ya existe en catálogo como ${text(existing.asset_code)}` : undefined} style={{ cursor: existing ? "default" : "pointer" }}>
                  {COLUMNS.map((column) => {
                    const editable = !existing && (column.key === "asset_code" || column.key === "line_description" || column.key === "capex_code" || column.key === "pen_amount" || column.key === "exc_rate");
                    const field = column.key as keyof Draft;
                    const value = column.key === "asset_code" ? existing ? existing.asset_code : draft.asset_code : editable ? draft[field] : row[column.key as keyof VetaRow];
                    const numeric = column.key === "pen_amount" || column.key === "exc_rate";
                    const sticky = column.key === "asset_code";
                    return <td key={column.key} className="capex-td" style={{ padding: 5, background: sticky ? existing ? "#052b3d" : state === "invalid" ? "#79453b" : focused ? "#155a78" : stickyRowBackground(state) : background, position: sticky ? "sticky" : undefined, left: sticky ? 0 : undefined, zIndex: sticky ? 20 : undefined, boxShadow: sticky ? "2px 0 rgba(216,238,255,.12)" : undefined }}>
                      {editable ? <FastCellInput
                        className="input"
                        value={text(value)}
                        inputMode={column.key === "asset_code" ? "numeric" : numeric ? "decimal" : undefined}
                        maxLength={column.key === "asset_code" ? 7 : undefined}
                        sanitize={column.key === "asset_code" ? (next) => next.replace(/\D/g, "").slice(0, 7) : numeric ? numericDraft : undefined}
                        normalizeOnBlur={numeric ? (next) => validNumber(next, true) ? twoDecimals(next) : next : undefined}
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
                      /> : <span title={text(value)}>{column.key.endsWith("date") ? dateOnly(value) : column.key === "usd_amount" ? twoDecimals(value) : text(value)}</span>}
                    </td>;
                  })}
                </tr>;
              })}
              {!loading && !items.length ? <tr><td className="capex-td" colSpan={COLUMNS.length}>No hay registros para el periodo seleccionado.</td></tr> : null}
              {loading ? <tr><td className="capex-td" colSpan={COLUMNS.length}>Cargando activos...</td></tr> : null}
            </tbody>
          </Table>
        </div>
      </div>
    </section>
  );
});

export default function FixAssetsNew() {
  const initialPeriod = useMemo(currentPeriod, []);
  const [rows, setRows] = useState<VetaRow[]>([]);
  const [catalogueRows, setCatalogueRows] = useState<CatalogueRow[]>([]);
  const [cecoByCode, setCecoByCode] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [existingCodes, setExistingCodes] = useState<Set<string>>(new Set());
  const [year, setYear] = useState(initialPeriod.year);
  const [monthFrom, setMonthFrom] = useState(initialPeriod.month);
  const [monthTo, setMonthTo] = useState(initialPeriod.month);
  const [activeCodePrefix, setActiveCodePrefix] = useState("");
  const [activeCodeIndex, setActiveCodeIndex] = useState<number | null>(null);
  const [codeClass, setCodeClass] = useState("");
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [veta, catalogue, ceco] = await Promise.all([
        apiGet("/api/actfij/veta"),
        apiGet("/api/actfij/catalogue"),
        apiGet("/api/actfij/ceco"),
      ]);
      const nextRows = Array.isArray(veta?.rows) ? (veta.rows as VetaRow[]) : [];
      const nextCatalogue = Array.isArray(catalogue?.rows) ? catalogue.rows as CatalogueRow[] : [];
      const nextCecoByCode = (Array.isArray(ceco?.rows) ? ceco.rows as CecoRow[] : [])
        .reduce<Record<string, string>>((current, row) => {
          const code = costCenterCode(text(row.cost_center_code));
          if (code) current[code] = text(row.cost_center_description).trim();
          return current;
        }, {});
      const nextDrafts: Record<number, Draft> = {};
      nextRows.forEach((row, index) => { nextDrafts[index] = draftFrom(row); });
      setRows(nextRows);
      setCatalogueRows(nextCatalogue);
      setCecoByCode(nextCecoByCode);
      setDrafts(nextDrafts);
      setExistingCodes(new Set(nextCatalogue.map((row) => text(row.asset_code).trim()).filter(Boolean)));
      const now = currentPeriod();
      setYear(now.year);
      setMonthFrom(now.month);
      setMonthTo(now.month);
      setActiveCodePrefix("");
      setActiveCodeIndex(null);
      setDetailIndex(null);
      setIsError(false);
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "No se pudo cargar la información");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const years = useMemo(() => Array.from(new Set([
    initialPeriod.year,
    ...rows.map((row) => monthOf(row.comp_date)?.year).filter((value): value is string => Boolean(value)),
  ].filter((value): value is string => Boolean(value) && value <= initialPeriod.year))).sort().reverse(), [rows, initialPeriod.year]);

  const monthOptions = useMemo(() => MONTHS
    .map((label, index) => ({ value: String(index + 1).padStart(2, "0"), label }))
    .filter((option) => year < initialPeriod.year || (year === initialPeriod.year && option.value <= initialPeriod.month)),
  [year, initialPeriod.year, initialPeriod.month]);

  const codeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    Object.values(drafts).forEach((draft) => {
      const code = draft.asset_code.trim();
      if (code) counts.set(code, (counts.get(code) || 0) + 1);
    });
    return counts;
  }, [drafts]);

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

  const sequentialCodes = useMemo(() => {
    const suffixesByClass = new Map<string, Array<{ code: string; suffix: number }>>();
    Object.values(drafts).forEach((draft) => {
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
  }, [drafts, existingCodes, codeCounts, classMaxSuffix]);

  const states = useMemo(() => {
    const result: Record<number, RowState> = {};
    rows.forEach((_, index) => {
      const draft = drafts[index];
      if (!draft?.asset_code.trim()) result[index] = "idle";
      else {
        const code = draft.asset_code.trim();
        result[index] = !/^\d{7}$/.test(code)
          || existingCodes.has(code)
          || (codeCounts.get(code) || 0) > 1
          || !sequentialCodes.has(code)
          || !validNumber(draft.pen_amount)
          || !validNumber(draft.exc_rate, true)
          ? "invalid" : "valid";
      }
    });
    return result;
  }, [rows, drafts, existingCodes, codeCounts, sequentialCodes]);

  const filteredRows = useMemo(() => rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const value = monthOf(row.comp_date);
      return Boolean(value && value.year === year && value.month >= monthFrom && value.month <= monthTo);
    }), [rows, year, monthFrom, monthTo]);

  const normalRows = useMemo(() => filteredRows.filter(({ row }) => !text(row.capex_code).trim()), [filteredRows]);
  const capexRows = useMemo(() => filteredRows
    .filter(({ row }) => Boolean(text(row.capex_code).trim()))
    .sort((a, b) => text(a.row.capex_code).localeCompare(text(b.row.capex_code), undefined, { numeric: true, sensitivity: "base" })), [filteredRows]);
  const selectedIndexes = useMemo(() => rows.map((row, index) => ({ row, index })).filter(({ row, index }) => Boolean(drafts[index]?.asset_code.trim()) && !catalogueBySource.has(sourceIdentity(row))).map(({ index }) => index), [rows, drafts, catalogueBySource]);
  const invalidCount = selectedIndexes.filter((index) => states[index] === "invalid").length;
  const canSave = selectedIndexes.length > 0 && invalidCount === 0 && !loading && !saving;

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

  const assignNextCodes = useCallback(() => {
    const classCode = codeClass.replace(/\D/g, "").slice(0, 3);
    const emptyIndexes = filteredRows.map(({ row, index }) => ({ row, index })).filter(({ row, index }) => !catalogueBySource.has(sourceIdentity(row)) && !drafts[index]?.asset_code.trim()).map(({ index }) => index);
    if (!/^\d{3}$/.test(classCode)) {
      setIsError(true);
      setMessage("Indica una clase de 3 dígitos para generar los COD.");
      return;
    }
    if (!emptyIndexes.length) {
      setIsError(true);
      setMessage("No hay filas sin COD en el periodo seleccionado.");
      return;
    }
    setDrafts((current) => {
      const next = { ...current };
      emptyIndexes.forEach((index) => {
        const code = nextAvailableCode(classCode, classMaxSuffix, next, existingCodes, null);
        if (code) next[index] = { ...next[index], asset_code: code };
      });
      return next;
    });
    setIsError(false);
    setMessage(`${emptyIndexes.length} COD${emptyIndexes.length === 1 ? " fue asignado" : " fueron asignados"} en secuencia para la clase ${classCode}.`);
  }, [codeClass, filteredRows, drafts, classMaxSuffix, existingCodes, catalogueBySource]);

  const detailRow = detailIndex == null ? null : rows[detailIndex];
  const detailDraft = detailIndex == null ? null : drafts[detailIndex];
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

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setMessage("");
    setIsError(false);
    let saved = 0;
    try {
      for (const index of selectedIndexes) {
        const row = rows[index];
        const draft = drafts[index];
        await apiPost("/api/actfij/catalogue/insert", {
          asset_code: draft.asset_code.trim(), source_name: "WEB", location_name: upperOrNull(draft.location_name),
          origin_account_code: row.account_code, capex_code: upperOrNull(draft.capex_code),
          subjournal_code: row.subjournal_code, voucher_number: row.voucher_number,
          annex_code: row.annex_code, annex_description: row.annex_description,
          document_number: row.document_number, asset_description: upperOrNull(draft.line_description),
          assigned_to: upperOrNull(draft.assigned_to), area_name: upperOrNull(draft.area_name),
          brand: upperOrNull(draft.brand), model: upperOrNull(draft.model), serial_number: upperOrNull(draft.serial_number),
          color: null, cost_center_code: costCenterCode(draft.cost_center_code) || null,
          acquisition_date: dateOnly(row.comp_date) || null, operation_date: firstDayNextMonth(row.comp_date) || null, disposal_date: null,
          exc_rate: numberOrNull(draft.exc_rate), asset_ini_cost_pen: numberOrNull(draft.pen_amount),
          depreciation_method: upperOrNull(draft.depreciation_method), asset_situation: "OPERATIVO",
          asset_comment: upperOrNull(draft.asset_comment),
        });
        saved += 1;
      }
      const savedCodes = selectedIndexes.map((index) => drafts[index].asset_code.trim());
      setExistingCodes((current) => new Set([...current, ...savedCodes]));
      setCatalogueRows((current) => [
        ...current,
        ...selectedIndexes.map((index) => ({
          asset_code: drafts[index].asset_code.trim(),
          asset_description: drafts[index].line_description.trim() || null,
          origin_account_code: rows[index].account_code,
          capex_code: drafts[index].capex_code.trim() || null,
          subjournal_code: rows[index].subjournal_code,
          voucher_number: rows[index].voucher_number,
          annex_code: rows[index].annex_code,
          document_number: rows[index].document_number,
          location_name: drafts[index].location_name.trim() || null,
          assigned_to: drafts[index].assigned_to.trim() || null,
          area_name: drafts[index].area_name.trim() || null,
          brand: drafts[index].brand.trim() || null,
          model: drafts[index].model.trim() || null,
          serial_number: drafts[index].serial_number.trim() || null,
          cost_center_code: drafts[index].cost_center_code.trim() || null,
          depreciation_method: drafts[index].depreciation_method.trim() || null,
          asset_comment: drafts[index].asset_comment.trim() || null,
          asset_ini_cost_pen: numberOrNull(drafts[index].pen_amount),
        })),
      ]);
      setDrafts((current) => {
        const next = { ...current };
        selectedIndexes.forEach((index) => { next[index] = draftFrom(rows[index]); });
        return next;
      });
      setActiveCodePrefix("");
      setActiveCodeIndex(null);
      setDetailIndex(null);
      setMessage(`${saved} activo${saved === 1 ? "" : "s"} guardado${saved === 1 ? "" : "s"} correctamente.`);
    } catch (error) {
      setIsError(true);
      setMessage(`Se guardaron ${saved} de ${selectedIndexes.length} filas. ${error instanceof Error ? error.message : "Error al guardar"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixassets-new-shell" style={{ position: "relative", display: "grid", gap: 10, height: detailIndex == null ? "calc(100vh - 205px)" : "auto", minHeight: 0, overflow: detailIndex == null ? "hidden" : "visible" }}>
      <div className="fixassets-new-root" style={{ position: "relative", display: "grid", gridTemplateRows: "auto auto minmax(0, 1fr) auto auto", gap: 10, height: "calc(100vh - 205px)", minHeight: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Nuevos activos desde Veta</h1>
          <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>Asigna un COD único de 7 dígitos. El periodo inicia siempre en el mes actual.</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
          <Select label="Año" value={year} onChange={(event) => { const value = event.target.value; setYear(value); if (value === initialPeriod.year) { if (monthFrom > initialPeriod.month) setMonthFrom(initialPeriod.month); if (monthTo > initialPeriod.month) setMonthTo(initialPeriod.month); } }} options={years.map((value) => ({ value, label: value }))} placeholder="Todos" style={{ minWidth: 110 }} />
          <Select label="Mes desde" value={monthFrom} onChange={(event) => { const value = event.target.value; setMonthFrom(value); if (value > monthTo) setMonthTo(value); }} options={monthOptions} placeholder="" style={{ minWidth: 145 }} />
          <Select label="Mes hasta" value={monthTo} onChange={(event) => { const value = event.target.value; setMonthTo(value); if (value < monthFrom) setMonthFrom(value); }} options={monthOptions} placeholder="" style={{ minWidth: 145 }} />
          <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800 }}>
            Clase para COD
            <FastCellInput className="input" value={codeClass} onCommit={setCodeClass} onLiveChange={setCodeClass} sanitize={(next) => next.replace(/\D/g, "").slice(0, 3)} inputMode="numeric" maxLength={3} placeholder="Ej. 110" style={{ width: 105, height: 34, padding: "6px 10px" }} />
          </label>
          <Button size="sm" onClick={assignNextCodes} disabled={loading || saving}>Asignar siguientes</Button>
          <Button size="sm" onClick={() => void load()} disabled={loading || saving}>{loading ? "Cargando..." : "Refrescar"}</Button>
          <Button size="sm" variant="primary" onClick={() => void save()} disabled={!canSave}>{saving ? "Guardando..." : `Guardar (${selectedIndexes.length})`}</Button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 4 }}>
        {message ? <div className="panel-inner" style={{ padding: 8, borderColor: isError ? "rgba(216,93,39,.8)" : "rgba(94,128,25,.9)", background: isError ? "rgba(216,93,39,.18)" : "rgba(94,128,25,.22)", fontWeight: 700 }}>{message}</div> : null}
        {invalidCount ? <div style={{ color: "#ffd0bf", fontWeight: 700, fontSize: 12 }}>{invalidCount} fila(s) con COD existente/duplicado, correlativo saltado, formato inválido o monto incorrecto.</div> : null}
      </div>

      <div className="fixassets-new-tables" style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr) minmax(0, 1fr)", gap: 8, minHeight: 0 }}>
        <NewRowsTable title="Activos normales" subtitle="Haz clic o edita una fila para completar su ficha opcional." items={normalRows} drafts={drafts} states={states} loading={loading} onCommit={updateDraft} onCodeActivity={handleCodeActivity} onFocusDetails={focusDetails} onOpenDetails={openDetails} focusedDetailIndex={detailIndex} catalogueBySource={catalogueBySource} />
        <NewRowsTable title="Activos CAPEX" subtitle="Ordenados por Código CAPEX. Haz clic o edita una fila para completar su ficha opcional." items={capexRows} drafts={drafts} states={states} loading={loading} onCommit={updateDraft} onCodeActivity={handleCodeActivity} onFocusDetails={focusDetails} onOpenDetails={openDetails} focusedDetailIndex={detailIndex} catalogueBySource={catalogueBySource} />
      </div>

      <div className="muted" style={{ fontSize: 12 }}>Mostrando {filteredRows.length} de {rows.length} filas: {normalRows.length} normales y {capexRows.length} CAPEX.</div>

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
          .fixassets-new-table {
            min-height: 320px !important;
          }
        }
      `}</style>
      </div>

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
