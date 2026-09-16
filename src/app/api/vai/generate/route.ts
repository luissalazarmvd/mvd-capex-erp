// src/app/api/vai/generate/route.ts
//
// Única llamada a OpenAI de V-Ai. Protegida por la cookie de sesión con scope
// `vai`; recibe solo el prompt y metadatos del catálogo, y devuelve una
// especificación validada. Nunca envía filas ni credenciales al modelo.

import { NextResponse } from "next/server";
import { sessionWithScope } from "@/src/lib/auth/session";
import {
  VAI_AREAS,
  VAI_BUCKETS,
  VAI_DATE_PRESETS,
  VAI_MAX_FILTERS,
  VAI_MAX_SOURCES,
  VAI_MAX_WIDGETS,
  VAI_PROMPT_MAX,
  VAI_SOURCES,
  VAI_SUMMARY_OPERATIONS,
  VAI_WIDGET_TYPES,
  coerceModelOutput,
  limaToday,
  validateModelOutput,
  type VaiArea,
  type VaiChartPreference,
  type VaiFocus,
  type VaiModelOutput,
  type VaiSource,
} from "@/src/lib/vai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

/** Modelo centralizado; cambiarlo aquí basta. */
const VAI_OPENAI_MODEL = "gpt-5-mini";
const OPENAI_URL = "https://api.openai.com/v1/responses";
const OPENAI_TIMEOUT_MS = 150_000;
const MAX_CANDIDATES = 6;


type VaiGenerateOptions = {
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
function selectCandidateSources(prompt: string, area: VaiArea | "auto") {
  const promptTokens = tokens(prompt);
  const promptTokenSet = new Set(promptTokens.map(stem));
  const explicitlyRequested = (source: VaiSource) =>
    source.keywords.some((keyword) => {
      const required = tokens(keyword).map(stem);
      return required.length > 0 && required.every((token) => promptTokenSet.has(token));
    });
  const enabled = VAI_SOURCES.filter(
    (source) => source.enabled && (!source.explicitOnly || explicitlyRequested(source)),
  );
  const pool = area === "auto" ? enabled : enabled.filter((source) => source.area === area);
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
    temporalMode: source.temporalMode ?? "event",
    defaultDateField: source.defaultDateField ?? null,
    serverFilters: source.query
      ? { dateFields: source.query.dateFields, dimensions: source.query.dimensions, note: "from/to del date_range se resuelven en SQL sobre estos campos; el resto se calcula en el navegador." }
      : null,
    rules: [...source.rules, ...(source.exclusions ?? []).map((c) => `Exclusión fija: ${c.field} ${c.op} ${JSON.stringify(c.value ?? "")}.`)],
    businessTerms: source.keywords,
    dateFields: source.fields
      .filter((field) => field.role === "date")
      .map((field) => ({
        id: field.id,
        label: field.label,
        description: field.description,
        filterKeywords: field.dateFilterKeywords ?? [],
      })),
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
      distinctField: metric.distinctField ?? null,
      numerator: metric.numerator ?? null,
      denominator: metric.denominator ?? null,
      multiplier: metric.multiplier ?? null,
      weight: metric.weight ?? null,
      where: metric.where ?? [],
      whereAny: metric.whereAny ?? [],
    })),
    relations: (source.relations ?? []).map((relation) => `${relation.field} → ${relation.source}.${relation.targetField}: ${relation.description} (V-Ai v1 no cruza fuentes).`),
  };
}

const SYSTEM_PROMPT = `Eres V-Ai, el diseñador de dashboards del ERP de Veta Dorada (minería aurífera, Perú). Recibes la petición de un usuario en lenguaje natural y un catálogo de fuentes de datos con sus campos, dimensiones, fechas y métricas permitidas. Diseñas un dashboard como especificación JSON; un renderer fijo lo dibuja y consulta los datos reales por su cuenta.

Reglas obligatorias:
- Usa exclusivamente ids de fuentes, campos, dimensiones y métricas que aparezcan en el catálogo, escritos exactamente igual. No inventes fuentes, campos ni métricas.
- Cada widget usa una sola fuente. No cruces fuentes. Máximo ${VAI_MAX_SOURCES} fuentes, ${VAI_MAX_WIDGETS} widgets y ${VAI_MAX_FILTERS} filtros por dashboard.
- Tipos de widget: ${VAI_WIDGET_TYPES.join(", ")}. "kpi" = exactamente 1 métrica válida. "line" = tendencia con una o más métricas válidas + dateField + bucket (${VAI_BUCKETS.join("/")}). "bar" = comparación con métricas + dimension, o métricas + dateField si es temporal. "rank" = top N con métricas + dimension. "donut" = distribución de exactamente 1 métrica por dimension. En widgets "line" y "bar" puedes usar además "seriesTypes" para indicar cómo se dibuja cada métrica, alineado 1 a 1 con "metrics", con valores "line" o "bar".
- En line y bar puedes combinar métricas solo cuando la lectura sea clara. Considera siempre el format/unidad de cada métrica: tonelaje, leyes, porcentajes, moneda, horas, conteos, etc. El renderer usa eje Y secundario cuando hay dos unidades incompatibles o escalas muy distintas. No combines más de dos familias de escala incompatibles en un mismo gráfico; si hacen falta más, sepáralas en widgets distintos.
- Si el usuario pide explícitamente una combinación como "X en barras y Y en líneas", "barras para X y línea para Y" o equivalente, constrúyela en un solo widget temporal con dateField, colocando ambas métricas en "metrics" y especificando "seriesTypes" en el mismo orden. Si no lo pide explícitamente, deja "seriesTypes" en null.
- Hay dos formas distintas de usar "table". Tabla de detalle: usa "columns" únicamente con ids de fields existentes; NUNCA pongas ids de metrics dentro de columns. En detalle deja metrics=[], dimension=null, dateField=null y bucket=null. Tabla agrupada: usa dimension o dateField junto con al menos una métrica válida en metrics y deja columns=null. Si quieres una tabla "por placa/sede/proveedor" con totales o ratios, eso es tabla agrupada, no tabla de detalle.
- Para tablas usa limit=null por defecto para conservar todas las filas o categorías filtradas. Solo usa limit cuando el usuario pida explícitamente un Top N, primeras N filas o un límite concreto. Nunca uses 50 como límite automático de una tabla.
- En una tabla de detalle, dateField NO significa ordenar por fecha. Si el usuario pide "detalle", "lista", "recientes", "últimos" o filas individuales, usa una tabla de detalle con columns. No conviertas una petición de ordenamiento en una tabla agrupada.
- Nunca generes una tabla con dimension/dateField y metrics vacío. Si no existe una métrica necesaria para agrupar, construye una tabla de detalle con los campos disponibles en vez de declarar esa parte como no disponible.
- Filtros: "date_range" sobre un campo de fecha de una fuente usada; "select" únicamente sobre dimensiones de negocio reconocibles por el usuario. Además del período, agrega de forma contextual entre 2 y 4 filtros select útiles cuando la fuente disponga de dimensiones relevantes. Prioriza identificadores y categorías operativas como Placa, Conductor, Sede, Tipo de combustible, Grifo, Proveedor, Estado o Área según corresponda a la fuente. En combustible prioriza Placa, Conductor, Sede y Tipo de combustible; usa Grifo como alternativa cuando sea más relevante. Nunca generes filtros interactivos sobre dimensiones técnicas o booleanas, incluyendo ids que empiecen por is_ o has_, ni filtros cuyas opciones sean true/false. Evita filtros redundantes y no inventes campos que no existan en la fuente.
- Si temporalMode="snapshot", la fuente representa el estado actual completo. NO le agregues date_range solo porque tenga campos de fecha. Solo puedes filtrar uno de esos campos cuando la petición mencione explícitamente ese evento o alguno de sus filterKeywords.
- En una fuente snapshot, palabras como "actual", "catálogo", "inventario", "saldo", "valor actual" o "YTD" no autorizan por sí solas a filtrar Fecha contable, adquisición, operación o baja.
- Si una fuente snapshot ya expone una métrica o campo YTD, úsalo directamente. YTD de una métrica no significa "filtrar todas las fuentes del dashboard desde enero".
- Prefiere una sola fuente cuando esa fuente ya contiene todos los conceptos pedidos. No agregues otra fuente solo porque existe una versión histórica/mensual del mismo concepto.
- Todo filtro date_range debe incluir preset. Usa null si el usuario no pidió un período relativo. Valores permitidos: ${VAI_DATE_PRESETS.join(", ")}.
- Todo filtro incluye from y to (YYYY-MM-DD o null). Para períodos absolutos guarda sus límites inclusivos y preset=null: "setiembre de 2026" o "septiembre de 2026" es from="2026-09-01", to="2026-09-30". Nunca sustituyas un mes solicitado por todo el año ni lo dejes solo en el título. Usa currentDateLima como referencia para fechas relativas, nunca supongas la fecha actual.
- Si el usuario no indica período, usa desde 2026-01-01 hasta currentDateLima sobre defaultDateField de cada fuente de eventos. Si pide todo el histórico de forma explícita, no agregues rango. No apliques esta regla a fuentes snapshot.
- serverFilters indica qué campos de fecha resuelve el backend en SQL: el date_range de una fuente debe usar preferentemente uno de esos dateFields para que la consulta descargue solo el período pedido.
- Cada widget incluye summaries: [] por defecto. Las tablas siempre calculan resúmenes apropiados desde el catálogo. Si el usuario pide un resumen específico, añade {column: id de campo/ métrica de la tabla, operation: auto|sum|avg|min|max|none}. avg significa promedio de las filas mostradas; auto recalcula la métrica sobre los registros originales y conserva ponderaciones. Nunca sumes tasas, porcentajes, promedios ni atributos de cabecera repetidos. Identificadores y fechas no llevan resumen numérico.
- En Flota, usa Vales de combustible (fleet_fuel_refuels) como fuente principal para peticiones de consumo de combustible, galones, costos PEN/USD, precio por galón, abastecimientos, placas, conductores, sedes, grifos, tipo de combustible y tendencias temporales de consumo o costo. Usa Recorridos GPS diarios (fleet_gps_distance) cuando la petición esté centrada en kilómetros, distancia o actividad GPS. Usa Rendimiento de flota (fleet_performance) únicamente cuando sea necesario cruzar recorrido con combustible: rendimiento, eficiencia, km/gal, l/100 km, autonomía, consumo vs referencia o costo por km. No uses fleet_performance para consumo o costo simple solo porque la petición mencione combustible.
- Para un dashboard de combustible sin una petición explícita de rendimiento, construye los KPIs, gráficos, rankings y tablas con fleet_fuel_refuels. Prioriza galones abastecidos, costo PEN y USD separados, costo promedio por galón, consumo promedio por vehículo, cantidad de placas y tendencias temporales. Ofrece filtros interactivos de negocio según los campos disponibles, priorizando Placa, Conductor, Sede y Tipo de combustible, y opcionalmente Grifo. Nunca uses Tiene combustible, Vehículo con ficha útil, has_fuel, has_gps, is_vehicle, is_tank_anomaly ni ninguna otra dimensión booleana como filtro interactivo.
- Para una petición simple de Kardex, toma como referencia los KPIs actuales de KardexSum: guías, TMH enviadas, lotes por guía, USD facturado, USD Concar y diferencia; acompáñalos cuando corresponda con merma, tiempo de tránsito, tarifa media y TMH por guía. El importe oficial facturado es amount_usd de facturas; Concar es solo contraste contable.
- En Trazabilidad, "ingresados", "procesados", "valorizados", "facturados" y "pagados" corresponden respectivamente a entry_date, process_date, valuation_date, doc_date y payment_date. Para un dashboard típico prioriza lotes, proveedores, lotes sin valorización, lotes sin pago, USD/TMS promedio simple, leyes Au/Ag ponderadas por TMS, monto valorizado y monto pagado. "Por sede/oficina" usa office_name (o zone_name para Sur/Norte/Sur Aqp); "programa" y "adicional" usan program_class. El cumplimiento de metas por oficina se muestra con traceability_targets y traceability_payments en widgets separados (no se cruzan fuentes). Los pagos efectivos por comprobante están en traceability_payment_vouchers y el stock de mineral en cancha en traceability_stock.
- En Planta, plant_shifts es la fuente principal del balance; los costos por cuenta/CECO y USD/TMS usan plant_costs; los costos e insumos por guardia (reactivos y bolas) usan plant_consumables; las leyes de carbón en tanques usan plant_carbon_tanks; la conciliación planta vs Control de Mineral usa plant_cm_reconciliation. Los ratios kg/TMS y USD/TMS se calculan con las métricas declaradas (TMS contada una vez por guardia o mes), nunca sumando atributos repetidos.
- En Refinería, el período es campaign_month; el costo por campaña, por gramo de Au o por kg de carbón está disponible en refinery_campaigns y por insumo/subproceso en refinery_consumption (real vs óptimo ML). Cada insumo conserva su unidad: cantidades y desviaciones de cantidad solo con un insumo filtrado o agrupado; los costos USD sí se consolidan.
- En Logística, el stock actual (Chala, CEVA, pendiente de OC, cobertura y valor) usa logistics_stock; el consumo de almacén por centro de costo o familia usa logistics_consumption; requerimientos y OC usan logistics_requirements.
- En Kardex, trjkar_guides ya trae lotes por guía, horas de tránsito y PERD/EXCE por guía; trjkar_lots es el detalle por movimiento (movement_type OPERATIVO/PERD/EXCE); trjkar_invoices trae la diferencia contra Concar por factura.
- En Activos Fijos, "activos de <período>" usa acquisition_date. Una foto de valor actual por área no lleva filtro de fecha salvo que se pida explícitamente adquisición, operación o baja. Presenta PEN y USD en widgets separados.
- En Logística, requerimientos usa req_date; compras u órdenes de compra usa po_date; entregas usa delivery_date. En Flota de mantenimiento, el período predeterminado usa req_date.
- Los valores nulos de dimensiones se muestran como "Sin dato"; los nulos numéricos se excluyen de los cálculos. Si la ausencia cambia la interpretación, incluye el conteo o detalle correspondiente.
- PEN y USD siempre van en gráficos separados. Las comparaciones por sede, área, proveedor o responsable no tienen restricciones adicionales.
- Interpreta "última semana", "últimos 7 días" o equivalentes como last_7_days; "últimos 30 días" como last_30_days; "esta semana" como current_week; "semana pasada/anterior" como previous_week; "este mes/mes actual" como current_month; "mes pasado/anterior" como previous_month; "este año/año actual/YTD" como year_to_date. Aplica ese período solo a la fuente y al campo temporal que semánticamente corresponda a lo pedido.
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
                  from: { type: ["string", "null"], description: "Fecha inicial inclusiva YYYY-MM-DD para períodos absolutos; null para presets." },
                  to: { type: ["string", "null"], description: "Fecha final inclusiva YYYY-MM-DD para períodos absolutos; null para presets." },
                },
                required: ["kind", "source", "field", "label", "preset", "from", "to"],
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
                  seriesTypes: { type: ["array", "null"], items: { type: "string", enum: ["line", "bar"] } },
                  dimension: { type: ["string", "null"] },
                  dateField: { type: ["string", "null"] },
                  bucket: { type: ["string", "null"], description: `Uno de: ${VAI_BUCKETS.join(", ")}` },
                  limit: { type: ["integer", "null"] },
                  columns: { type: ["array", "null"], items: { type: "string" } },
                  summaries: { type: "array", items: { type: "object", additionalProperties: false, properties: { column: { type: "string" }, operation: { type: "string", enum: [...VAI_SUMMARY_OPERATIONS] } }, required: ["column", "operation"] } },
                },
                required: ["type", "title", "source", "metrics", "seriesTypes", "dimension", "dateField", "bucket", "limit", "columns", "summaries"],
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

class VaiGenerationError extends Error {
  constructor(message: string, readonly detail?: string) {
    super(message);
  }
}

/**
 * Envía a OpenAI únicamente: índice compacto de todas las fuentes habilitadas,
 * metadatos completos de las candidatas, preferencias y el prompt del usuario.
 */
async function generateDashboardSpec(prompt: string, options: VaiGenerateOptions): Promise<{ output: VaiModelOutput; candidates: string[] }> {
  const apiKey = process.env.API_OPEN_AI?.trim();
  if (!apiKey) throw new VaiGenerationError("V-Ai no está configurado en este entorno.", "missing API_OPEN_AI");

  const candidates = selectCandidateSources(prompt, options.area);
  const context = {
    currentDateLima: limaToday(),
    defaultHistoryStart: "2026-01-01",
    catalogIndex: VAI_SOURCES.filter((source) => source.enabled).map((source) => ({
      id: source.id,
      name: source.name,
      area: VAI_AREAS.find((item) => item.id === source.area)?.label ?? source.area,
      description: source.description,
      explicitOnly: source.explicitOnly ?? false,
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

// ── Route handler ─────────────────────────────────────────────────────

const FOCUS: VaiFocus[] = ["auto", "kpis", "trends", "comparisons", "detail"];
const CHARTS: VaiChartPreference[] = ["line", "bar", "kpi", "table"];

export async function POST(req: Request) {
  const session = await sessionWithScope(req, "vai");
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { prompt?: unknown; area?: unknown; focus?: unknown; charts?: unknown };
  const prompt = String(body.prompt ?? "").replace(/\s+/g, " ").trim();
  if (prompt.length < 8) return NextResponse.json({ ok: false, error: "Describe con más detalle el dashboard que quieres." }, { status: 400 });
  if (prompt.length > VAI_PROMPT_MAX) return NextResponse.json({ ok: false, error: `El prompt supera los ${VAI_PROMPT_MAX} caracteres.` }, { status: 400 });

  const areaRaw = String(body.area ?? "auto");
  const area: VaiArea | "auto" = VAI_AREAS.some((item) => item.id === areaRaw) ? (areaRaw as VaiArea) : "auto";
  const focusRaw = String(body.focus ?? "auto") as VaiFocus;
  const focus = FOCUS.includes(focusRaw) ? focusRaw : "auto";
  const charts = Array.isArray(body.charts) ? body.charts.map(String).filter((c): c is VaiChartPreference => CHARTS.includes(c as VaiChartPreference)) : [];

  try {
    const { output, candidates } = await generateDashboardSpec(prompt, { area, focus, charts });
    const { spec, notes } = validateModelOutput(output, prompt);

    if (!spec) {
      const unavailable = [...new Set([...output.unavailable, ...notes])];

      return NextResponse.json({
        ok: true,
        status: "unavailable",
        message: output.message || "Actualmente no existe información disponible en V-Ai para construir ese dashboard.",
        unavailable,
        spec: null,
        candidates,
      });
    }

    const unavailable = [...new Set(notes)];
    const status = unavailable.length ? "partial" : "ok";

    return NextResponse.json({
      ok: true,
      status,
      message: unavailable.length ? output.message : "",
      unavailable,
      spec,
      candidates,
    });
  } catch (error) {
    // Detalle técnico solo en el servidor; el usuario recibe un mensaje entendible.
    if (error instanceof VaiGenerationError) {
      console.error("V-Ai generate:", error.detail ?? error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    }
    console.error("V-Ai generate:", error);
    return NextResponse.json({ ok: false, error: "No se pudo generar el dashboard. Inténtalo de nuevo." }, { status: 500 });
  }
}
