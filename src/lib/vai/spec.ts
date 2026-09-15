// src/lib/vai/spec.ts
//
// Especificación estructurada de dashboard V-Ai (schema v1) y su validación.
// El modelo solo produce esta estructura; el renderer es fijo. Todo lo que no
// exista en el catálogo se descarta aquí, server-side, antes de tocar datos.

import { VAI_SOURCE_MAP, vaiField, vaiMetric, type VaiSource } from "./catalog";

export const VAI_SPEC_VERSION = 1;
export const VAI_PROMPT_MAX = 1200;
export const VAI_MAX_SOURCES = 3;
export const VAI_MAX_WIDGETS = 10;
export const VAI_MAX_FILTERS = 6;
export const VAI_MAX_LIMIT = 50;

export const VAI_WIDGET_TYPES = ["kpi", "line", "bar", "rank", "donut", "table"] as const;
export type VaiWidgetType = (typeof VAI_WIDGET_TYPES)[number];

export const VAI_BUCKETS = ["day", "week", "month"] as const;
export type VaiBucket = (typeof VAI_BUCKETS)[number];

export type VaiFilterSpec =
  | { kind: "date_range"; source: string; field: string; label: string }
  | { kind: "select"; source: string; field: string; label: string };

export type VaiWidgetSpec = {
  type: VaiWidgetType;
  title: string;
  source: string;
  /** Ids de métricas del catálogo; KPI usa una, el resto hasta 3. */
  metrics: string[];
  /** Dimensión (bar/rank/donut/table) del catálogo. */
  dimension: string | null;
  /** Campo fecha (line, o tabla agrupada por período). */
  dateField: string | null;
  bucket: VaiBucket | null;
  /** Top N para bar/rank/donut/table. */
  limit: number | null;
  /** Columnas de detalle para `table` sin agrupación. */
  columns: string[] | null;
};

export type VaiDashboardSpec = {
  version: typeof VAI_SPEC_VERSION;
  title: string;
  description: string;
  sources: string[];
  filters: VaiFilterSpec[];
  widgets: VaiWidgetSpec[];
};

export type VaiRawFilter = { kind: string; source: string; field: string; label: string };
export type VaiRawWidget = {
  type: string;
  title: string;
  source: string;
  metrics: string[];
  dimension: string | null;
  dateField: string | null;
  bucket: string | null;
  limit: number | null;
  columns: string[] | null;
};

/** Salida completa del modelo antes de validar (ya parseada como JSON). */
export type VaiModelOutput = {
  status: "ok" | "partial" | "unavailable";
  message: string;
  unavailable: string[];
  dashboard: {
    title: string;
    description: string;
    filters: VaiRawFilter[];
    widgets: VaiRawWidget[];
  } | null;
};

export type VaiValidation = {
  spec: VaiDashboardSpec | null;
  /** Partes descartadas, en lenguaje de usuario. */
  notes: string[];
};

const clean = (value: unknown, max: number) =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringList(value: unknown, max: number) {
  return Array.isArray(value) ? value.map((item) => clean(item, 80)).filter(Boolean).slice(0, max) : [];
}

/** Estructura mínima de la respuesta del modelo; sin confiar en su contenido. */
export function coerceModelOutput(raw: unknown): VaiModelOutput | null {
  if (!isRecord(raw)) return null;
  const status = raw.status === "ok" || raw.status === "partial" || raw.status === "unavailable" ? raw.status : "ok";
  const dashboardRaw = isRecord(raw.dashboard) ? raw.dashboard : null;
  const dashboard = dashboardRaw
    ? {
        title: clean(dashboardRaw.title, 120),
        description: clean(dashboardRaw.description, 400),
        filters: Array.isArray(dashboardRaw.filters)
          ? dashboardRaw.filters.filter(isRecord).map((item) => ({
              kind: clean(item.kind, 20),
              source: clean(item.source, 60),
              field: clean(item.field, 60),
              label: clean(item.label, 60),
            }))
          : [],
        widgets: Array.isArray(dashboardRaw.widgets)
          ? dashboardRaw.widgets.filter(isRecord).map((item) => ({
              type: clean(item.type, 20),
              title: clean(item.title, 120),
              source: clean(item.source, 60),
              metrics: stringList(item.metrics, 5),
              dimension: item.dimension == null ? null : clean(item.dimension, 60),
              dateField: item.dateField == null ? null : clean(item.dateField, 60),
              bucket: item.bucket == null ? null : clean(item.bucket, 10),
              limit: item.limit == null ? null : Number(item.limit),
              columns: item.columns == null ? null : stringList(item.columns, 12),
            }))
          : [],
      }
    : null;
  return {
    status,
    message: clean(raw.message, 600),
    unavailable: stringList(raw.unavailable, 10),
    dashboard,
  };
}

function resolveSource(id: string, notes: string[], label: string) {
  const source = VAI_SOURCE_MAP.get(id);
  if (!source || !source.enabled) {
    notes.push(`${label}: la fuente «${id || "sin fuente"}» no existe o no está habilitada en V-Ai.`);
    return null;
  }
  return source;
}

function validateWidget(raw: VaiRawWidget, notes: string[]): VaiWidgetSpec | null {
  const label = `Widget «${raw.title || raw.type || "sin título"}»`;
  if (!VAI_WIDGET_TYPES.includes(raw.type as VaiWidgetType)) {
    notes.push(`${label}: el tipo «${raw.type}» no está soportado.`);
    return null;
  }
  const type = raw.type as VaiWidgetType;
  const source = resolveSource(raw.source, notes, label);
  if (!source) return null;

  const metrics: string[] = [];
  for (const id of raw.metrics) {
    if (vaiMetric(source, id)) {
      if (!metrics.includes(id)) metrics.push(id);
    } else notes.push(`${label}: la métrica «${id}» no existe en ${source.name}.`);
  }
  const maxMetrics = type === "kpi" ? 1 : 3;
  if (metrics.length > maxMetrics) metrics.splice(maxMetrics);

  let dimension: string | null = null;
  if (raw.dimension) {
    const field = vaiField(source, raw.dimension);
    if (field && field.role === "dimension") dimension = field.id;
    else notes.push(`${label}: «${raw.dimension}» no es una dimensión válida de ${source.name}.`);
  }

  let dateField: string | null = null;
  if (raw.dateField) {
    const field = vaiField(source, raw.dateField);
    if (field && field.role === "date") dateField = field.id;
    else notes.push(`${label}: «${raw.dateField}» no es un campo de fecha de ${source.name}.`);
  }
  const bucket = raw.bucket && VAI_BUCKETS.includes(raw.bucket as VaiBucket) ? (raw.bucket as VaiBucket) : null;

  let limit: number | null = null;
  if (raw.limit != null && Number.isFinite(raw.limit)) limit = Math.min(VAI_MAX_LIMIT, Math.max(1, Math.round(raw.limit)));

  let columns: string[] | null = null;
  if (raw.columns) {
    columns = raw.columns.filter((id) => {
      const ok = Boolean(vaiField(source, id));
      if (!ok) notes.push(`${label}: la columna «${id}» no existe en ${source.name}.`);
      return ok;
    });
    if (!columns.length) columns = null;
  }

  // Requisitos por tipo: si falta lo esencial, el widget se descarta.
  if (type === "kpi" && !metrics.length) {
    notes.push(`${label}: un KPI necesita una métrica válida.`);
    return null;
  }
  if (type === "line") {
    if (!dateField) {
      const fallback = source.fields.find((field) => field.role === "date");
      if (!fallback) {
        notes.push(`${label}: ${source.name} no tiene campos de fecha para una tendencia.`);
        return null;
      }
      dateField = fallback.id;
    }
    if (!metrics.length) {
      notes.push(`${label}: una tendencia necesita al menos una métrica válida.`);
      return null;
    }
  }
  if ((type === "bar" || type === "rank" || type === "donut") && !metrics.length) {
    notes.push(`${label}: necesita al menos una métrica válida.`);
    return null;
  }
  if ((type === "bar" || type === "rank" || type === "donut") && !dimension && !(type === "bar" && dateField)) {
    notes.push(`${label}: necesita una dimensión válida para comparar.`);
    return null;
  }
  if (type === "donut" && metrics.length > 1) metrics.splice(1);
  if (type === "table" && !columns && !dimension && !dateField) {
    columns = source.fields.slice(0, 8).map((field) => field.id);
  }
  if (type === "table" && (dimension || dateField) && !metrics.length) {
    notes.push(`${label}: una tabla agrupada necesita métricas.`);
    return null;
  }

  return {
    type,
    title: raw.title || source.name,
    source: source.id,
    metrics,
    dimension,
    dateField,
    bucket: dateField ? bucket ?? "month" : null,
    limit,
    columns: type === "table" && !dimension && !dateField ? columns : null,
  };
}

function validateFilter(raw: VaiRawFilter, sources: Set<string>, notes: string[]): VaiFilterSpec | null {
  const label = `Filtro «${raw.label || raw.field}»`;
  if (raw.kind !== "date_range" && raw.kind !== "select") {
    notes.push(`${label}: el tipo de filtro «${raw.kind}» no está soportado.`);
    return null;
  }
  const source = resolveSource(raw.source, notes, label);
  if (!source) return null;
  if (!sources.has(source.id)) {
    notes.push(`${label}: filtra una fuente que ningún widget utiliza.`);
    return null;
  }
  const field = vaiField(source, raw.field);
  if (!field) {
    notes.push(`${label}: el campo «${raw.field}» no existe en ${source.name}.`);
    return null;
  }
  if (raw.kind === "date_range" && field.role !== "date") {
    notes.push(`${label}: «${field.label}» no es un campo de fecha.`);
    return null;
  }
  if (raw.kind === "select" && field.role !== "dimension") {
    notes.push(`${label}: «${field.label}» no es una dimensión filtrable.`);
    return null;
  }
  return { kind: raw.kind, source: source.id, field: field.id, label: raw.label || field.label };
}

/**
 * Valida la salida del modelo contra el catálogo. Descarta de forma controlada
 * cada parte inválida y la reporta en `notes`; devuelve `spec: null` si no
 * queda ningún widget utilizable.
 */
export function validateModelOutput(output: VaiModelOutput): VaiValidation {
  const notes: string[] = [];
  if (!output.dashboard) return { spec: null, notes };

  const widgets: VaiWidgetSpec[] = [];
  for (const raw of output.dashboard.widgets.slice(0, VAI_MAX_WIDGETS)) {
    const widget = validateWidget(raw, notes);
    if (widget) widgets.push(widget);
  }
  if (output.dashboard.widgets.length > VAI_MAX_WIDGETS) notes.push(`Se limitó el dashboard a ${VAI_MAX_WIDGETS} widgets.`);

  // Fuentes en orden de aparición, con tope; los widgets de fuentes sobrantes se descartan.
  const sources: string[] = [];
  for (const widget of widgets) if (!sources.includes(widget.source)) sources.push(widget.source);
  if (sources.length > VAI_MAX_SOURCES) {
    const dropped = sources.splice(VAI_MAX_SOURCES);
    notes.push(`Se limitó el dashboard a ${VAI_MAX_SOURCES} fuentes; se omitió ${dropped.map((id) => VAI_SOURCE_MAP.get(id)?.name ?? id).join(", ")}.`);
  }
  const kept = widgets.filter((widget) => sources.includes(widget.source));
  if (!kept.length) return { spec: null, notes };

  const sourceSet = new Set(sources);
  const filters: VaiFilterSpec[] = [];
  for (const raw of output.dashboard.filters.slice(0, VAI_MAX_FILTERS)) {
    const filter = validateFilter(raw, sourceSet, notes);
    if (filter && !filters.some((item) => item.kind === filter.kind && item.source === filter.source && item.field === filter.field)) {
      filters.push(filter);
    }
  }

  return {
    spec: {
      version: VAI_SPEC_VERSION,
      title: output.dashboard.title || "Dashboard V-Ai",
      description: output.dashboard.description,
      sources,
      filters,
      widgets: kept,
    },
    notes,
  };
}

/**
 * Revalida una especificación persistida (por ejemplo al abrir un dashboard
 * guardado): garantiza que siga apuntando a fuentes, campos y métricas vigentes.
 */
export function parseStoredSpec(raw: unknown): VaiValidation {
  if (!isRecord(raw)) return { spec: null, notes: ["La configuración guardada no es válida."] };
  const output: VaiModelOutput = {
    status: "ok",
    message: "",
    unavailable: [],
    dashboard: coerceModelOutput({ dashboard: raw })?.dashboard ?? null,
  };
  return validateModelOutput(output);
}

export function specSources(spec: VaiDashboardSpec): VaiSource[] {
  return spec.sources.map((id) => VAI_SOURCE_MAP.get(id)).filter((source): source is VaiSource => Boolean(source));
}
