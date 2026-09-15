// src/lib/vai/generate.ts
//
// Solo servidor. Preselección determinística de fuentes del catálogo y llamada
// a OpenAI con metadatos únicamente (nunca filas, importes ni nombres reales).
// La API key vive en `API_OPEN_AI` y jamás sale de este módulo.

import { VAI_AREAS, VAI_SOURCES, type VaiArea, type VaiSource } from "./catalog";
import {
  VAI_BUCKETS,
  VAI_DATE_PRESETS,
  VAI_MAX_FILTERS,
  VAI_MAX_SOURCES,
  VAI_MAX_WIDGETS,
  VAI_WIDGET_TYPES,
  coerceModelOutput,
  type VaiModelOutput,
} from "./spec";

/** Modelo centralizado; cambiarlo aquí basta. */
export const VAI_OPENAI_MODEL = "gpt-5-mini";
const OPENAI_URL = "https://api.openai.com/v1/responses";
const OPENAI_TIMEOUT_MS = 150_000;
const MAX_CANDIDATES = 5;

export type VaiFocus = "auto" | "kpis" | "trends" | "comparisons" | "detail";
export type VaiChartPreference = "line" | "bar" | "kpi" | "table";

export type VaiGenerateOptions = {
  area: VaiArea | "auto";
  focus: VaiFocus;
  charts: VaiChartPreference[];
};

// ── Preselección local ─────────────────────────────────────────────────

const STOP = new Set(["de", "la", "el", "los", "las", "y", "o", "un", "una", "por", "para", "con", "del", "en", "que", "quiero", "ver", "dashboard", "me", "su", "sus", "al", "a", "se", "es", "como", "más", "mas", "mes", "mensual", "total", "totales", "evolución", "evolucion", "tendencia", "resumen", "cada"]);

function tokens(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOP.has(token));
}

function stem(token: string) {
  return token.replace(/(es|s)$/, "");
}

function sourceScore(source: VaiSource, promptTokens: string[]) {
  const bag = new Map<string, number>();
  const add = (text: string, weight: number) => {
    for (const token of tokens(text)) {
      const key = stem(token);
      bag.set(key, Math.max(bag.get(key) ?? 0, weight));
    }
  };
  add(source.name, 3);
  add(source.description, 2);
  add(source.keywords.join(" "), 3);
  add(source.grain, 1);
  for (const field of source.fields) add(`${field.label} ${field.id.replace(/_/g, " ")}`, 1.5);
  for (const metric of source.metrics) add(`${metric.label} ${metric.description}`, 1.5);
  let score = 0;
  for (const token of promptTokens) score += bag.get(stem(token)) ?? 0;
  return score;
}

/**
 * Reduce el catálogo a las fuentes candidatas antes de construir el contexto:
 * primero por área explícita, luego por coincidencia de términos del prompt
 * con nombre, descripción, palabras clave, campos y métricas.
 */
export function selectCandidateSources(prompt: string, area: VaiArea | "auto") {
  const enabled = VAI_SOURCES.filter((source) => source.enabled);
  const pool = area === "auto" ? enabled : enabled.filter((source) => source.area === area);
  const promptTokens = tokens(prompt);
  const scored = pool
    .map((source) => ({ source, score: sourceScore(source, promptTokens) }))
    .sort((a, b) => b.score - a.score);
  const positive = scored.filter((item) => item.score > 0);
  const picked = (positive.length ? positive : scored).slice(0, MAX_CANDIDATES).map((item) => item.source);
  // Un área explícita entra completa si es pequeña: evita que falte la fuente correcta.
  if (area !== "auto") for (const source of pool) if (!picked.includes(source) && picked.length < MAX_CANDIDATES) picked.push(source);
  return picked;
}

// ── Contexto para el modelo (solo metadatos) ───────────────────────────

function sourceContext(source: VaiSource) {
  return {
    id: source.id,
    name: source.name,
    area: VAI_AREAS.find((item) => item.id === source.area)?.label ?? source.area,
    description: source.description,
    grain: source.grain,
    rules: [...source.rules, ...(source.exclusions ?? []).map((c) => `Exclusión fija: ${c.field} ${c.op} ${JSON.stringify(c.value ?? "")}.`)],
    businessTerms: source.keywords,
    dateFields: source.fields.filter((field) => field.role === "date").map((field) => ({ id: field.id, label: field.label, description: field.description })),
    dimensions: source.fields.filter((field) => field.role === "dimension").map((field) => ({ id: field.id, label: field.label, description: field.description })),
    attributes: source.fields.filter((field) => field.role === "attribute" || field.role === "measure").map((field) => ({ id: field.id, label: field.label, format: field.format ?? "text", description: field.description, tableOnly: true })),
    metrics: source.metrics.map((metric) => ({
      id: metric.id,
      label: metric.label,
      description: metric.description,
      agg: metric.agg,
      format: metric.format,
      field: metric.field ?? null,
      field2: metric.field2 ?? null,
      numerator: metric.numerator ?? null,
      denominator: metric.denominator ?? null,
      weight: metric.weight ?? null,
      where: metric.where ?? [],
    })),
    relations: (source.relations ?? []).map((relation) => `${relation.field} → ${relation.source}.${relation.targetField}: ${relation.description} (V-Ai v1 no cruza fuentes).`),
  };
}

const SYSTEM_PROMPT = `Eres V-Ai, el diseñador de dashboards del ERP de Veta Dorada (minería aurífera, Perú). Recibes la petición de un usuario en lenguaje natural y un catálogo de fuentes de datos con sus campos, dimensiones, fechas y métricas permitidas. Diseñas un dashboard como especificación JSON; un renderer fijo lo dibuja y consulta los datos reales por su cuenta.

Reglas obligatorias:
- Usa exclusivamente ids de fuentes, campos, dimensiones y métricas que aparezcan en el catálogo, escritos exactamente igual. No inventes fuentes, campos ni métricas.
- Cada widget usa una sola fuente. No cruces fuentes. Máximo ${VAI_MAX_SOURCES} fuentes, ${VAI_MAX_WIDGETS} widgets y ${VAI_MAX_FILTERS} filtros por dashboard.
- Tipos de widget: ${VAI_WIDGET_TYPES.join(", ")}. "kpi" = exactamente 1 métrica válida. "line" = tendencia con una o más métricas válidas + dateField + bucket (${VAI_BUCKETS.join("/")}). "bar" = comparación con métricas + dimension, o métricas + dateField si es temporal. "rank" = top N con métricas + dimension. "donut" = distribución de exactamente 1 métrica por dimension.
- En line y bar puedes combinar métricas solo cuando la lectura sea clara. Considera siempre el format/unidad de cada métrica: tonelaje, leyes, porcentajes, moneda, horas, conteos, etc. El renderer usa eje Y secundario cuando hay dos unidades incompatibles o escalas muy distintas. No combines más de dos familias de escala incompatibles en un mismo gráfico; si hacen falta más, sepáralas en widgets distintos.
- Hay dos formas distintas de usar "table". Tabla de detalle: usa "columns" con campos existentes y SIEMPRE deja metrics=[], dimension=null, dateField=null y bucket=null. Tabla agrupada: usa dimension o dateField junto con al menos una métrica válida y deja columns=null.
- Para tablas usa limit=null por defecto para conservar todas las filas o categorías filtradas. Solo usa limit cuando el usuario pida explícitamente un Top N, primeras N filas o un límite concreto. Nunca uses 50 como límite automático de una tabla.
- En una tabla de detalle, dateField NO significa ordenar por fecha. Si el usuario pide "detalle", "lista", "recientes", "últimos" o filas individuales, usa una tabla de detalle con columns. No conviertas una petición de ordenamiento en una tabla agrupada.
- Nunca generes una tabla con dimension/dateField y metrics vacío. Si no existe una métrica necesaria para agrupar, construye una tabla de detalle con los campos disponibles en vez de declarar esa parte como no disponible.
- Filtros: "date_range" sobre un campo de fecha de una fuente usada; "select" sobre una dimension de una fuente usada. Solo incluye filtros útiles (normalmente un rango de fechas por fuente y 1-2 selects).
- Todo filtro date_range debe incluir preset. Usa null si el usuario no pidió un período relativo. Valores permitidos: ${VAI_DATE_PRESETS.join(", ")}.
- Interpreta "última semana", "últimos 7 días" o equivalentes como last_7_days; "últimos 30 días" como last_30_days; "esta semana" como current_week; "semana pasada/anterior" como previous_week; "este mes/mes actual" como current_month; "mes pasado/anterior" como previous_month; "este año/año actual/YTD" como year_to_date. No escribas un período relativo solamente en el título: debe quedar reflejado en el preset del filtro.
- Respeta estrictamente grain, rules, businessTerms, exclusiones y definición de cada métrica. No sumes campos que el catálogo marca como no sumables y no reconstruyas una métrica manualmente si ya existe una métrica declarada para ese concepto.
- Un concepto de negocio puede estar representado por una métrica filtrada y no por una columna física. Revisa siempre field, where, numerator, denominator y las reglas de la fuente antes de concluir que falta un dato. No inventes nombres de campos a partir del lenguaje del usuario.
- Si el catálogo declara una métrica que representa el concepto pedido, ese concepto está disponible aunque el campo físico tenga otro nombre o el cálculo dependa de valores de una dimensión.
- Para cada widget, usa únicamente métricas y campos pertenecientes a la misma fuente del widget. Antes de devolver el JSON, verifica que todos los ids existan exactamente en esa fuente y que la combinación type/metrics/dimension/dateField/columns cumpla las reglas anteriores.
- Antes de agregar algo a "unavailable", comprueba todas las métricas, campos, reglas y businessTerms de las fuentes candidatas. Si puede resolverse mediante una métrica declarada o una tabla de detalle, constrúyelo.
- Si algo pedido puede construirse razonablemente con los campos o métricas existentes, constrúyelo y no lo pongas en "unavailable". Solo marca "partial" cuando realmente falta información en el catálogo. Si nada es posible, status "unavailable", dashboard null y explica en "message".
- "message" se muestra al usuario: breve, en español, sin jerga técnica. Títulos en español, claros y cortos. Sin datos inventados.
- Devuelve solo JSON válido según el esquema.`;

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["ok", "partial", "unavailable"] },
    message: { type: "string" },
    unavailable: { type: "array", items: { type: "string" } },
    dashboard: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            filters: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  kind: { type: "string", enum: ["date_range", "select"] },
                  source: { type: "string" },
                  field: { type: "string" },
                  label: { type: "string" },
                  preset: { type: ["string", "null"], enum: [null, ...VAI_DATE_PRESETS] },
                },
                required: ["kind", "source", "field", "label", "preset"],
              },
            },
            widgets: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  type: { type: "string", enum: [...VAI_WIDGET_TYPES] },
                  title: { type: "string" },
                  source: { type: "string" },
                  metrics: { type: "array", items: { type: "string" } },
                  dimension: { type: ["string", "null"] },
                  dateField: { type: ["string", "null"] },
                  bucket: { type: ["string", "null"], description: `Uno de: ${VAI_BUCKETS.join(", ")}` },
                  limit: { type: ["integer", "null"] },
                  columns: { type: ["array", "null"], items: { type: "string" } },
                },
                required: ["type", "title", "source", "metrics", "dimension", "dateField", "bucket", "limit", "columns"],
              },
            },
          },
          required: ["title", "description", "filters", "widgets"],
        },
        { type: "null" },
      ],
    },
  },
  required: ["status", "message", "unavailable", "dashboard"],
};

const FOCUS_TEXT: Record<VaiFocus, string> = {
  auto: "Automático: elige la mezcla de widgets más útil.",
  kpis: "Prioriza KPIs y un resumen compacto (varios kpi y pocos gráficos).",
  trends: "Prioriza tendencias temporales (line con bucket adecuado).",
  comparisons: "Prioriza comparaciones por dimensión (bar, rank, donut).",
  detail: "Prioriza tablas de detalle o resumen (table).",
};

export class VaiGenerationError extends Error {
  constructor(message: string, readonly detail?: string) {
    super(message);
  }
}

/**
 * Envía a OpenAI únicamente: índice compacto de todas las fuentes habilitadas,
 * metadatos completos de las candidatas, preferencias y el prompt del usuario.
 */
export async function generateDashboardSpec(prompt: string, options: VaiGenerateOptions): Promise<{ output: VaiModelOutput; candidates: string[] }> {
  const apiKey = process.env.API_OPEN_AI?.trim();
  if (!apiKey) throw new VaiGenerationError("V-Ai no está configurado en este entorno.", "missing API_OPEN_AI");

  const candidates = selectCandidateSources(prompt, options.area);
  const context = {
    catalogIndex: VAI_SOURCES.filter((source) => source.enabled).map((source) => ({
      id: source.id,
      name: source.name,
      area: VAI_AREAS.find((item) => item.id === source.area)?.label ?? source.area,
      description: source.description,
      detailed: candidates.includes(source),
    })),
    sources: candidates.map(sourceContext),
    preferences: {
      focus: FOCUS_TEXT[options.focus],
      preferredWidgets: options.charts.length ? options.charts : "sin preferencia",
      areaRestriction: options.area === "auto" ? "ninguna" : VAI_AREAS.find((item) => item.id === options.area)?.label,
    },
    request: prompt,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        model: VAI_OPENAI_MODEL,
        reasoning: { effort: "low" },
        input: [
          { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT }] },
          { role: "user", content: [{ type: "input_text", text: JSON.stringify(context) }] },
        ],
        text: { format: { type: "json_schema", name: "vai_dashboard", strict: true, schema: OUTPUT_SCHEMA } },
      }),
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new VaiGenerationError(
      aborted ? "El servicio de IA tardó demasiado en responder. Inténtalo de nuevo." : "No se pudo contactar al servicio de IA.",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new VaiGenerationError("El servicio de IA devolvió un error. Inténtalo de nuevo en unos minutos.", `openai ${response.status}: ${detail.slice(0, 500)}`);
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  const text = extractOutputText(payload);
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  const output = coerceModelOutput(parsed);
  if (!output) throw new VaiGenerationError("La respuesta de la IA no tiene el formato esperado.", `unparseable output: ${String(text).slice(0, 300)}`);
  return { output, candidates: candidates.map((source) => source.id) };
}

function extractOutputText(payload: unknown) {
  if (typeof payload !== "object" || payload === null) return "";
  const record = payload as { output_text?: unknown; output?: unknown };
  if (typeof record.output_text === "string") return record.output_text;
  if (!Array.isArray(record.output)) return "";
  for (const block of record.output) {
    const content = (block as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const item = part as { type?: unknown; text?: unknown };
      if (item.type === "output_text" && typeof item.text === "string") return item.text;
    }
  }
  return "";
}
