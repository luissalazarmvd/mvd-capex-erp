// src/lib/vai/engine.ts
//
// Motor de cálculo de V-Ai: recibe las filas reales de un endpoint autorizado
// y una especificación ya validada, y produce los datos de cada widget.
// Corre en el navegador; los datos nunca pasan por el modelo. Toda agregación
// proviene de las métricas declaradas en el catálogo.

import { kardexPeriodKey } from "../trjKardex";
import { vaiField, vaiMetric, type VaiCondition, type VaiFormat, type VaiMetric, type VaiSource } from "./catalog";
import type { VaiBucket, VaiDashboardSpec, VaiFilterSpec, VaiSummaryOperation, VaiWidgetSpec } from "./spec";
import { presetRange } from "./dates";

export type VaiRow = Record<string, unknown>;

/** Estado de filtros del dashboard, clave = `${source}:${field}`. */
export type VaiFilterValue = { from?: string; to?: string; value?: string };
export type VaiFilterState = Record<string, VaiFilterValue>;

export const filterKey = (filter: Pick<VaiFilterSpec, "source" | "field">) => `${filter.source}:${filter.field}`;

export function defaultFilterValues(filters: VaiFilterSpec[], sources: ReadonlyMap<string, VaiSource>, data: Record<string, VaiRow[]>): VaiFilterState {
  const defaults: VaiFilterState = {};
  for (const filter of filters) {
    if (filter.kind !== "date_range") continue;
    if (filter.from || filter.to) {
      defaults[filterKey(filter)] = { from: filter.from ?? "", to: filter.to ?? "" };
    } else if (filter.preset) {
      defaults[filterKey(filter)] = presetRange(filter.preset);
    } else {
      const source = sources.get(filter.source);
      const dates = (source ? applyFilters(source, data[filter.source] ?? [], [], {}) : []).map((row) => toIsoDate(row[filter.field])).filter(Boolean).sort();
      defaults[filterKey(filter)] = { from: dates[0] ?? "", to: dates.at(-1) ?? "" };
    }
  }
  return defaults;
}

export function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function toText(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

/** Fecha ISO (YYYY-MM-DD) desde string, Date o datetime SQL. */
export function toIsoDate(value: unknown) {
  const text = toText(value);
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : "";
}

// ── Formato ────────────────────────────────────────────────────────────

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function num(value: number, digits: number) {
  return value.toLocaleString("es-PE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatDateLabel(iso: string, bucket: VaiBucket | "none" = "none") {
  if (!/^\d{4}-\d{2}/.test(iso)) return iso || "—";
  const [y, mo, d] = iso.split("-");
  if (bucket === "month" || !d) return `${MONTHS[Number(mo) - 1] ?? mo} ${y}`;
  if (bucket === "week") return `sem ${d}/${mo}/${y.slice(2)}`;
  return `${d}/${mo}/${y.slice(2)}`;
}

export function formatValue(value: unknown, format: VaiFormat | undefined) {
  if (format === "date") {
    const iso = toIsoDate(value);
    return iso ? formatDateLabel(iso) : "—";
  }
  if (format === "text" || format === undefined) {
    const text = toText(value);
    return text || "—";
  }
  const n = toNumber(value);
  if (n == null) return "—";
  switch (format) {
    case "integer":
      return num(n, 0);
    case "usd":
      return `USD ${num(n, 2)}`;
    case "pen":
      return `S/ ${num(n, 2)}`;
    case "percent":
      return `${num(n, 2)} %`;
    case "fraction":
      return `${num(n * 100, 2)} %`;
    case "tmh":
      return `${num(n, 2)} TMH`;
    case "tms":
      return `${num(n, 2)} TMS`;
    case "kg":
      return `${num(n, 2)} kg`;
    case "oz":
      return `${num(n, 2)} oz`;
    case "hours":
      return `${num(n, 1)} h`;
    case "km":
      return `${num(n, 0)} km`;
    case "grade_oztc":
      return `${num(n, 3)} oz/TC`;
    case "grade_gt":
      return `${num(n, 2)} g/t`;
    default:
      return num(n, 2);
  }
}

/** Decimales y sufijo para los gráficos, que formatean por su cuenta. */
export function chartFormat(format: VaiFormat): { digits: number; unit: string; scale: number } {
  switch (format) {
    case "integer":
    case "km":
      return { digits: 0, unit: "", scale: 1 };
    case "usd":
      return { digits: 0, unit: " USD", scale: 1 };
    case "pen":
      return { digits: 0, unit: " PEN", scale: 1 };
    case "percent":
      return { digits: 1, unit: " %", scale: 1 };
    case "fraction":
      return { digits: 1, unit: " %", scale: 100 };
    case "tmh":
      return { digits: 1, unit: " TMH", scale: 1 };
    case "tms":
      return { digits: 1, unit: " TMS", scale: 1 };
    case "kg":
      return { digits: 0, unit: " kg", scale: 1 };
    case "oz":
      return { digits: 1, unit: " oz", scale: 1 };
    case "hours":
      return { digits: 1, unit: " h", scale: 1 };
    case "grade_oztc":
      return { digits: 3, unit: " oz/TC", scale: 1 };
    case "grade_gt":
      return { digits: 2, unit: " g/t", scale: 1 };
    default:
      return { digits: 2, unit: "", scale: 1 };
  }
}

export function chartAxisGroup(format: VaiFormat) {
  switch (format) {
    case "tmh":
    case "tms":
      return "tonnage";
    case "percent":
    case "fraction":
      return "percent";
    case "usd":
      return "usd";
    case "pen":
      return "pen";
    case "kg":
      return "kg";
    case "oz":
      return "oz";
    case "hours":
      return "hours";
    case "km":
      return "km";
    case "grade_oztc":
      return "grade_oztc";
    case "grade_gt":
      return "grade_gt";
    case "integer":
    case "decimal":
      return "number";
    default:
      return format;
  }
}

// ── Condiciones y filtros ──────────────────────────────────────────────

function matches(row: VaiRow, condition: VaiCondition) {
  const raw = row[condition.field];
  const text = toText(raw).toUpperCase();
  switch (condition.op) {
    case "empty":
      return text === "";
    case "not_empty":
      return text !== "";
    case "eq":
      return text === String(condition.value ?? "").toUpperCase();
    case "ne":
      return text !== String(condition.value ?? "").toUpperCase();
    case "in":
      return Array.isArray(condition.value) && condition.value.some((v) => v.toUpperCase() === text);
    case "not_in":
      return !Array.isArray(condition.value) || !condition.value.some((v) => v.toUpperCase() === text);
    case "ends_with":
      return text.endsWith(String(condition.value ?? "").toUpperCase());
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const n = toNumber(raw);
      const target = toNumber(condition.value);
      if (n == null || target == null) return false;
      return condition.op === "gt" ? n > target : condition.op === "gte" ? n >= target : condition.op === "lt" ? n < target : n <= target;
    }
    default:
      return true;
  }
}

function passes(row: VaiRow, conditions: VaiCondition[] | undefined) {
  return !conditions || conditions.every((condition) => matches(row, condition));
}

/** Exclusiones fijas del catálogo + filtros elegidos por el usuario. */
export function applyFilters(source: VaiSource, rows: VaiRow[], filters: VaiFilterSpec[], state: VaiFilterState) {
  const active = filters
    .filter((filter) => filter.source === source.id)
    .map((filter) => ({ filter, value: state[filterKey(filter)] }))
    .filter(({ value }) => value && (value.from || value.to || value.value));
  return rows.filter((row) => {
    if (!passes(row, source.exclusions)) return false;
    for (const { filter, value } of active) {
      if (filter.kind === "date_range") {
        const iso = toIsoDate(row[filter.field]);
        if (!iso) return false;
        if (value.from && iso < value.from) return false;
        if (value.to && iso > value.to) return false;
      } else if (value.value && toText(row[filter.field]) !== value.value) return false;
    }
    return true;
  });
}

export function distinctValues(rows: VaiRow[], field: string, max = 200) {
  const values = new Set<string>();
  for (const row of rows) {
    const text = toText(row[field]);
    if (text) values.add(text);
    if (values.size > max) break;
  }
  return [...values].sort((a, b) => a.localeCompare(b, "es"));
}

// ── Agregación ─────────────────────────────────────────────────────────

function hoursBetween(a: unknown, b: unknown) {
  const start = Date.parse(toText(a));
  const end = Date.parse(toText(b));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return (end - start) / 3600000;
}

export function aggregate(metric: VaiMetric, rows: VaiRow[]): number | null {
  const subset = rows.filter((row) => passes(row, metric.where));
  const values = (field: string | undefined) =>
    field ? subset.map((row) => toNumber(row[field])).filter((v): v is number => v != null) : [];
  switch (metric.agg) {
    case "count":
      return subset.length;
    case "count_distinct":
      return new Set(subset.map((row) => toText(row[metric.field ?? ""])).filter(Boolean)).size;
    case "sum":
      return values(metric.field).reduce((sum, v) => sum + v, 0);
    case "avg": {
      const list = values(metric.field);
      return list.length ? list.reduce((sum, v) => sum + v, 0) / list.length : null;
    }
    case "min": {
      const list = values(metric.field);
      return list.length ? Math.min(...list) : null;
    }
    case "max": {
      const list = values(metric.field);
      return list.length ? Math.max(...list) : null;
    }
    case "ratio":
    case "diff_pct": {
      let numerator = 0;
      let denominator = 0;
      for (const row of subset) {
        const a = toNumber(row[metric.numerator ?? ""]);
        const b = toNumber(row[metric.denominator ?? ""]);
        if (a == null || b == null) continue;
        numerator += a;
        denominator += b;
      }
      if (metric.agg === "ratio") return denominator ? numerator / denominator : null;
      return numerator ? ((numerator - denominator) / numerator) * 100 : null;
    }
    case "weighted_avg": {
      let total = 0;
      let weight = 0;
      for (const row of subset) {
        const v = toNumber(row[metric.field ?? ""]);
        const w = toNumber(row[metric.weight ?? ""]);
        if (v == null || w == null || w <= 0) continue;
        total += v * w;
        weight += w;
      }
      return weight ? total / weight : null;
    }
    case "avg_hours_diff": {
      const list = subset.map((row) => hoursBetween(row[metric.field ?? ""], row[metric.field2 ?? ""])).filter((v): v is number => v != null);
      return list.length ? list.reduce((sum, v) => sum + v, 0) / list.length : null;
    }
    default:
      return null;
  }
}

// ── Datos por widget ───────────────────────────────────────────────────

export type VaiSeriesDef = { id: string; label: string; format: VaiFormat };
export type VaiGroupRow = { key: string; label: string; values: (number | null)[]; count: number };
export type VaiTableRow = (string | number | null)[];
export type VaiTableSummaryRule = { operation: VaiSummaryOperation; label: string; metric?: VaiMetric } | null;
export type VaiTableData = { kind: "table"; columns: VaiSeriesDef[]; rows: VaiTableRow[]; total: number; summaryRules: VaiTableSummaryRule[]; rowMembers: VaiRow[][] };
export type VaiTableSummary = { value: number | null; label: string } | null;

export type VaiWidgetData =
  | { kind: "kpi"; metric: VaiSeriesDef; value: number | null; rows: number }
  | { kind: "series"; series: VaiSeriesDef[]; rows: VaiGroupRow[]; temporal: boolean; table: VaiTableData }
  | VaiTableData;

function summaryRule(widget: VaiWidgetSpec, column: string, metric?: VaiMetric, fallback?: VaiSummaryOperation): VaiTableSummaryRule {
  const requested = widget.summaries?.find((item) => item.column === column)?.operation ?? "auto";
  const operation = requested === "auto" && !metric ? fallback : requested;
  if (!operation || (operation === "auto" && !metric)) return null;
  if (operation === "none") return null;
  const labels: Record<string, string> = { sum: "Suma", count: "Total", count_distinct: "Únicos", avg: "Promedio", min: "Mínimo", max: "Máximo", ratio: "Razón global", diff_pct: "Variación global", weighted_avg: "Promedio ponderado", avg_hours_diff: "Promedio" };
  return { operation, label: labels[operation === "auto" ? metric!.agg : operation] ?? "Resumen", metric };
}

/** Recalcula sobre todas las filas filtradas, antes de la paginación. */
export function summarizeTable(data: VaiTableData, visibleRows = data.rows): VaiTableSummary[] {
  const selected = new Set(visibleRows);
  const originals = data.rowMembers.flatMap((members, index) => selected.has(data.rows[index]) ? members : []);
  return data.summaryRules.map((rule, index) => {
    if (!rule) return null;
    if (rule.operation === "auto" && rule.metric) return { label: rule.label, value: aggregate(rule.metric, originals) };
    const values = visibleRows.map((row) => toNumber(row[index])).filter((v): v is number => v != null);
    const sum = values.reduce((total, v) => total + v, 0);
    const value = rule.operation === "avg" ? (values.length ? sum / values.length : null)
      : rule.operation === "min" ? (values.length ? values.reduce((a, b) => Math.min(a, b)) : null)
      : rule.operation === "max" ? (values.length ? values.reduce((a, b) => Math.max(a, b)) : null) : sum;
    return { label: rule.label, value };
  });
}

function groupRows(rows: VaiRow[], keyOf: (row: VaiRow) => string) {
  const groups = new Map<string, VaiRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  return groups;
}

export function computeWidget(widget: VaiWidgetSpec, source: VaiSource, rows: VaiRow[]): VaiWidgetData | null {
  const metrics = widget.metrics.map((id) => vaiMetric(source, id)).filter((metric): metric is VaiMetric => Boolean(metric));
  const series: VaiSeriesDef[] = metrics.map((metric) => ({ id: metric.id, label: metric.label, format: metric.format }));

  if (widget.type === "kpi") {
    if (!metrics.length) return null;
    return { kind: "kpi", metric: series[0], value: aggregate(metrics[0], rows), rows: rows.length };
  }

  if (widget.type === "table" && widget.columns) {
    const columns = widget.columns
      .map((id) => vaiField(source, id))
      .filter((field): field is NonNullable<typeof field> => Boolean(field))
      .map((field) => ({ id: field.id, label: field.label, format: field.format ?? (field.role === "date" ? "date" : "text") } as VaiSeriesDef));
    const visibleRows = widget.limit == null ? rows : rows.slice(0, widget.limit);
    return {
      kind: "table",
      columns,
      rows: visibleRows.map((row) => columns.map((column) => (column.format === "text" || column.format === "date" ? toText(row[column.id]) : toNumber(row[column.id])))),
      total: rows.length,
      summaryRules: columns.map((column) => {
        const field = vaiField(source, column.id);
        if (field?.role !== "measure") return null;
        const candidates = source.metrics.filter((metric) => metric.field === field.id && !metric.where?.length && ["sum", "avg", "min", "max", "weighted_avg"].includes(metric.agg));
        const metric = candidates.find((item) => item.agg === "avg" && ["percent", "fraction", "grade_oztc", "grade_gt"].includes(column.format)) ?? candidates.find((item) => item.agg === "sum") ?? candidates[0];
        return summaryRule(widget, column.id, metric, ["percent", "fraction", "grade_oztc", "grade_gt"].includes(column.format) ? "avg" : undefined);
      }),
      rowMembers: visibleRows.map((row) => [row]),
    };
  }

  const temporal = Boolean(widget.dateField) && (widget.type === "line" || !widget.dimension);
  const bucket = widget.bucket ?? "month";
  let groups: Map<string, VaiRow[]>;
  if (temporal && widget.dateField) {
    const dateField = widget.dateField;
    groups = groupRows(
      rows.filter((row) => toIsoDate(row[dateField])),
      (row) => kardexPeriodKey(toIsoDate(row[dateField]), bucket),
    );
  } else if (widget.dimension) {
    const dimension = widget.dimension;
    groups = groupRows(rows, (row) => toText(row[dimension]) || "Sin dato");
  } else return null;

  let grouped: (VaiGroupRow & { members: VaiRow[] })[] = [...groups.entries()].map(([key, subset]) => ({
    key,
    label: temporal ? formatDateLabel(key, bucket) : key,
    values: metrics.map((metric) => aggregate(metric, subset)),
    count: subset.length,
    members: subset,
  }));

  if (temporal) grouped.sort((a, b) => a.key.localeCompare(b.key));
  else grouped.sort((a, b) => (b.values[0] ?? -Infinity) - (a.values[0] ?? -Infinity));

  const groupedTotal = grouped.length;
  const limit = widget.limit ?? (widget.type === "table" ? grouped.length : temporal ? 60 : widget.type === "donut" ? 6 : 12);
  if (temporal && grouped.length > limit) grouped = grouped.slice(grouped.length - limit);
  else if (!temporal && grouped.length > limit) {
    // El resto se agrupa en «Otros» solo para métricas sumables; el resto se omite.
    const rest = grouped.slice(limit);
    grouped = grouped.slice(0, limit);
    const additive = metrics.every((metric) => metric.agg === "sum" || metric.agg === "count");
    if (additive && rest.length) {
      grouped.push({
        key: "Otros",
        label: `Otros (${rest.length})`,
        values: metrics.map((_, j) => rest.reduce((sum, row) => sum + (row.values[j] ?? 0), 0)),
        count: rest.reduce((sum, row) => sum + row.count, 0),
        members: rest.flatMap((row) => row.members),
      });
    }
  }

  const first: VaiSeriesDef = temporal
      ? { id: widget.dateField ?? "period", label: "Período", format: "text" }
      : { id: widget.dimension ?? "dimension", label: vaiField(source, widget.dimension ?? "")?.label ?? "Categoría", format: "text" };
  const table: VaiTableData = {
      kind: "table",
      columns: [first, ...series, { id: "__count", label: "Filas", format: "integer" }],
      rows: grouped.map((row) => [row.label, ...row.values, row.count]),
      total: groupedTotal,
      summaryRules: [null, ...metrics.map((metric) => summaryRule(widget, metric.id, metric)), { operation: "sum", label: "Total" }],
      rowMembers: grouped.map((row) => row.members),
    };
  if (widget.type === "table") return table;
  return { kind: "series", series, rows: grouped, temporal, table };
}

/** Filas filtradas por fuente para un dashboard completo. */
export function filteredRows(spec: VaiDashboardSpec, rowsBySource: Record<string, VaiRow[]>, state: VaiFilterState, sources: Map<string, VaiSource>) {
  const out: Record<string, VaiRow[]> = {};
  for (const id of spec.sources) {
    const source = sources.get(id);
    if (!source) continue;
    out[id] = applyFilters(source, rowsBySource[id] ?? [], spec.filters, state);
  }
  return out;
}
