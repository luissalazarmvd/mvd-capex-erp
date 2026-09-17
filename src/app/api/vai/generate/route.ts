import { NextResponse } from "next/server";
import { sessionWithScope } from "@/src/lib/auth/session";
import {
  VAI_AREAS,
  VAI_BREAKDOWN_CHART_LIMIT,
  VAI_BREAKDOWN_TABLE_LIMIT,
  VAI_BUCKETS,
  VAI_DATE_PRESETS,
  VAI_MAX_FILTERS,
  VAI_MAX_SOURCES,
  VAI_MAX_WIDGETS,
  VAI_PROMPT_MAX,
  VAI_SORT_MODES,
  VAI_SOURCES,
  VAI_STACK_MODES,
  VAI_SUMMARY_OPERATIONS,
  VAI_WIDGET_TYPES,
  VAI_VISUAL_CATALOG,
  resolveVisualRequests,
  coerceModelOutput,
  limaToday,
  promptRenderHints,
  validateModelOutput,
  type VaiArea,
  type VaiChartPreference,
  type VaiFocus,
  type VaiModelOutput,
  type VaiSource,
  type VaiValidation,
} from "@/src/lib/vai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

// Configuración exclusivamente server-side; API_OPEN_AI no cambia.
const VAI_OPENAI_MODEL = process.env.VAI_OPENAI_MODEL?.trim() || "gpt-5.4";
const VAI_REASONING = ["low", "medium", "high"].includes(process.env.VAI_OPENAI_REASONING ?? "")
  ? process.env.VAI_OPENAI_REASONING! : "medium";
const OPENAI_URL = "https://api.openai.com/v1/responses";
const OPENAI_TIMEOUT_MS = 155_000;
const MAX_CANDIDATES = 6;

type VaiGenerateOptions = {
  area: VaiArea | "auto";
  focus: VaiFocus;
  charts: VaiChartPreference[];
};

const STOP = new Set([
  "de",
  "la",
  "el",
  "los",
  "las",
  "y",
  "o",
  "un",
  "una",
  "por",
  "para",
  "con",
  "del",
  "en",
  "que",
  "quiero",
  "ver",
  "dashboard",
  "me",
  "su",
  "sus",
  "al",
  "a",
  "se",
  "es",
  "como",
  "más",
  "mas",
  "mes",
  "mensual",
  "total",
  "totales",
  "evolución",
  "evolucion",
  "tendencia",
  "resumen",
  "cada",
]);

function tokens(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(
      (token) =>
        token.length > 2 &&
        !STOP.has(token),
    );
}

function stem(token: string) {
  return token.replace(/(es|s)$/, "");
}

function sourceScore(
  source: VaiSource,
  promptTokens: string[],
) {
  const bag =
    new Map<string, number>();

  const add = (
    text: string,
    weight: number,
  ) => {
    for (const token of tokens(text)) {
      const key = stem(token);

      bag.set(
        key,
        Math.max(
          bag.get(key) ?? 0,
          weight,
        ),
      );
    }
  };

  add(source.name, 3);
  add(source.description, 2);
  add(source.keywords.join(" "), 3);
  add(source.grain, 1);

  for (const field of source.fields) {
    add(
      `${field.label} ${field.id.replace(/_/g, " ")}`,
      1.5,
    );
  }

  for (const metric of source.metrics) {
    add(
      `${metric.label} ${metric.description}`,
      1.5,
    );
  }

  let score = 0;

  for (const token of promptTokens) {
    score +=
      bag.get(stem(token)) ?? 0;
  }

  return score;
}

function selectCandidateSources(
  prompt: string,
  area: VaiArea | "auto",
) {
  const promptTokens =
    tokens(prompt);

  const promptTokenSet =
    new Set(
      promptTokens.map(stem),
    );

  const explicitlyRequested = (
    source: VaiSource,
  ) =>
    source.keywords.some(
      (keyword) => {
        const required =
          tokens(keyword).map(stem);

        return (
          required.length > 0 &&
          required.every(
            (token) =>
              promptTokenSet.has(token),
          )
        );
      },
    );

  const enabled =
    VAI_SOURCES.filter(
      (source) =>
        source.enabled &&
        (
          !source.explicitOnly ||
          explicitlyRequested(source)
        ),
    );

  const pool =
    area === "auto"
      ? enabled
      : enabled.filter(
          (source) =>
            source.area === area,
        );

  const scored = pool
    .map((source) => ({
      source,
      score: sourceScore(
        source,
        promptTokens,
      ),
    }))
    .sort(
      (a, b) =>
        b.score - a.score,
    );

  const positive =
    scored.filter(
      (item) => item.score > 0,
    );

  const picked =
    (
      positive.length
        ? positive
        : scored
    )
      .slice(
        0,
        MAX_CANDIDATES,
      )
      .map(
        (item) => item.source,
      );

  if (area !== "auto") {
    for (const source of pool) {
      if (
        !picked.includes(source) &&
        picked.length <
          MAX_CANDIDATES
      ) {
        picked.push(source);
      }
    }
  }

  return picked;
}

function sourceContext(
  source: VaiSource,
) {
  return {
    id: source.id,
    name: source.name,
    area:
      VAI_AREAS.find(
        (item) =>
          item.id === source.area,
      )?.label ??
      source.area,
    description:
      source.description,
    grain: source.grain,
    temporalMode:
      source.temporalMode ??
      "event",
    defaultDateField:
      source.defaultDateField ??
      null,
    serverFilters:
      source.query
        ? {
            dateFields:
              source.query
                .dateFields,
            dimensions:
              source.query
                .dimensions,
            note:
              "from/to del date_range se resuelven en SQL sobre estos campos; el resto se calcula en el navegador.",
          }
        : null,
    rules: [
      ...source.rules,
      ...(
        source.exclusions ??
        []
      ).map(
        (c) =>
          `Exclusión fija: ${c.field} ${c.op} ${JSON.stringify(c.value ?? "")}.`,
      ),
    ],
    businessTerms:
      source.keywords,
    dateFields:
      source.fields
        .filter(
          (field) =>
            field.role === "date",
        )
        .map((field) => ({
          id: field.id,
          label: field.label,
          description:
            field.description,
          filterKeywords:
            field.dateFilterKeywords ??
            [],
        })),
    dimensions:
      source.fields
        .filter(
          (field) =>
            field.role ===
            "dimension",
        )
        .map((field) => ({
          id: field.id,
          label: field.label,
          description:
            field.description,
        })),
    attributes:
      source.fields
        .filter(
          (field) =>
            field.role ===
              "attribute" ||
            field.role ===
              "measure",
        )
        .map((field) => ({
          id: field.id,
          label: field.label,
          format:
            field.format ??
            "text",
          description:
            field.description,
          tableOnly: true,
        })),
    metrics:
      source.metrics.map(
        (metric) => ({
          id: metric.id,
          label: metric.label,
          description:
            metric.description,
          agg: metric.agg,
          format:
            metric.format,
          field:
            metric.field ??
            null,
          field2:
            metric.field2 ??
            null,
          distinctField:
            metric.distinctField ??
            null,
          numerator:
            metric.numerator ??
            null,
          denominator:
            metric.denominator ??
            null,
          multiplier:
            metric.multiplier ??
            null,
          weight:
            metric.weight ??
            null,
          where:
            metric.where ?? [],
          whereAny:
            metric.whereAny ?? [],
        }),
      ),
    relations:
      (
        source.relations ??
        []
      ).map(
        (relation) =>
          `${relation.field} → ${relation.source}.${relation.targetField}: ${relation.description} (V-Ai v1 no cruza fuentes).`,
      ),
  };
}

const SYSTEM_PROMPT = `Eres V-Ai, el diseñador de dashboards del ERP de Veta Dorada (minería aurífera, Perú). Recibes la petición de un usuario en lenguaje natural y un catálogo de fuentes de datos con sus campos, dimensiones, fechas y métricas permitidas. Diseñas un dashboard como especificación JSON; un renderer fijo lo dibuja y consulta los datos reales por su cuenta.

Reglas obligatorias:
- Usa exclusivamente ids de fuentes, campos, dimensiones y métricas que aparezcan en el catálogo, escritos exactamente igual. No inventes fuentes, campos ni métricas.
- Cada widget usa una sola fuente. No cruces fuentes. Máximo ${VAI_MAX_SOURCES} fuentes, ${VAI_MAX_WIDGETS} widgets y ${VAI_MAX_FILTERS} filtros por dashboard.
- Catálogo visual, campo "type": ${VAI_WIDGET_TYPES.join(", ")}.
  · kpi = exactamente 1 métrica válida.
  · line = tendencia temporal (metrics + dateField + bucket) o comparación categórica (metrics + dimension, dateField=null).
  · area = igual que line, con relleno bajo cada serie; úsalo cuando pidan "gráfico de área".
  · bar = barras agrupadas por dimension (categórico) o por dateField (temporal). Con "stack": "stack" se apilan y con "percent" se apilan al 100 %; solo para métricas sumables de la misma unidad o con breakdown.
  · combo = barras + líneas en un mismo gráfico: 2 o 3 métricas y "seriesTypes" alineado 1 a 1 con "metrics" (valores "bar"/"line"); eje X categórico (dimension) o temporal (dateField). Es obligatorio cuando el usuario mezcla barras y líneas. Dos unidades o un eje secundario por sí solos NO autorizan cambiar las marcas que pidió el usuario: dos líneas siguen siendo line y dos barras siguen siendo bar. El renderer asigna el eje Y derecho automáticamente a la unidad distinta.
  · rank = Top N horizontal de 1 métrica por dimension (una 2.ª métrica se muestra como nota); también para "barras horizontales".
  · donut = distribución de exactamente 1 métrica sumable por dimension ("torta", "pastel", "anillo", "pie").
  · scatter = dispersión o correlación: exactamente 2 métricas por dimension (eje X = primera métrica, eje Y = segunda); un punto por categoría, con recta de tendencia.
  · pareto = una métrica aditiva por dimension: barras descendentes y línea % acumulado calculada localmente. metrics contiene SOLO la métrica base; no inventes un id de porcentaje acumulado.
  · heatmap = una métrica por dimension O dateField (filas) y breakdown (columnas). Usa etiquetas reales del catálogo; por ejemplo fecha mensual + sede.
  · histogram = frecuencia por intervalos sobre el campo numérico directo de una métrica simple (sum/avg/min/max). metrics contiene UNA métrica con field numérico; dimension/dateField/breakdown null, bins 3 a 40 o null (automático). No es una suma por sede ni una distribución de ratios agregados.
  · waterfall = cascada de aportes positivos/negativos de UNA métrica aditiva por dimension/dateField. Parte de cero y añade total neto; no inventa saldo inicial, saldo final ni variaciones entre métricas.
  · table = detalle (columns) o agrupada (dimension o dateField + metrics); con breakdown es una tabla dinámica (pivot).
- "breakdown" (segunda dimensión, opcional) divide la PRIMERA métrica en una serie por categoría: "una línea por sede", "barras apiladas por tipo de combustible", "desglosado por conductor", "tabla de galones por sede y grifo". Solo en line, area, bar, heatmap y table; con breakdown usa una sola métrica y una dimensión distinta de "dimension". Se dibujan hasta ${VAI_BREAKDOWN_CHART_LIMIT} series (el resto sale como «Otros»); en tablas hasta ${VAI_BREAKDOWN_TABLE_LIMIT} columnas.
- "sort" ordena las categorías del eje X: ${VAI_SORT_MODES.join(", ")} (value_desc es el predeterminado; "de menor a mayor" = value_asc; "orden alfabético" = label_asc). "sortMetric" es el id de la métrica que manda cuando no es la primera. En ejes temporales ambos van en null.
- "cumulative": true acumula a lo largo del tiempo ("acumulado", "curva acumulada", "avance acumulado"); solo con dateField y métricas sumables; si no, null.
- "bucket": ${VAI_BUCKETS.join("/")} según pidan diario, semanal, mensual, trimestral o anual; month si no dicen nada; null sin dateField.
- Traducción obligatoria de instrucciones visuales del usuario cuando aparezcan en la petición:
  · "X en barras y Y en líneas", "barras de X con línea de Y" → type "combo", metrics [X, Y], seriesTypes ["bar", "line"]. Respeta también la combinación inversa (X línea, Y barra) y varias barras con una línea.
  · "eje secundario para Y" → seriesAxes asigna "right" a Y; no cambia su marca si pidió dos líneas o dos barras.
  · "apilado", "apiladas" → bar + stack "stack"; "apilado al 100 %", "porcentual", "participación apilada" → stack "percent".
  · "una línea/serie/barra por <dimensión>", "desglosado/segmentado/separado/dividido por <dimensión>", "por <eje> y <dimensión>" → breakdown = esa dimensión.
  · "acumulado" → cumulative true. "torta/pastel/anillo/pie" → donut. "ranking/top N/barras horizontales" → rank. "dispersión/correlación/scatter" → scatter. "gráfico de área" → area. "tabla dinámica/pivot/matriz" → table + dimension + breakdown.
  · "orden alfabético" → sort label_asc; "de menor a mayor" → value_asc; "de mayor a menor" → value_desc; "ordenado por <métrica>" → sortMetric.
  · "trimestral" → bucket quarter; "anual/por año" → year; "semanal" → week; "diario/por día" → day.
- El eje X categórico de un gráfico siempre se define mediante "dimension". Si el usuario pide explícitamente "eje X por placa", "eje X oficina", "por sede", "por proveedor", "por conductor", "por área", "por estado" o cualquier clasificación equivalente disponible en la fuente, usa ese id exacto como dimension. En ese caso dateField debe ser null salvo que el usuario haya pedido además explícitamente una evolución temporal separada.
- Las dimensiones del eje X son genéricas para todas las áreas. No limites esta capacidad a Flota: cualquier field role="dimension" de la fuente puede ser el eje categórico cuando tenga sentido.
- Si el usuario pide un gráfico por una clasificación no temporal, no sustituyas esa clasificación por una fecha solo porque la fuente tenga defaultDateField.
- En line, area, bar y combo, "seriesTypes" indica cómo se dibuja cada métrica, alineado 1 a 1 con "metrics", con valores "line" o "bar"; en los demás tipos va null.
- Combina métricas en un mismo gráfico solo cuando la lectura sea clara. Considera siempre el format/unidad de cada métrica: tonelaje, leyes, porcentajes, moneda, horas, conteos, etc. El renderer usa eje Y secundario cuando hay dos unidades incompatibles o escalas muy distintas. No combines más de dos familias de escala incompatibles en un mismo gráfico; si hacen falta más, sepáralas en widgets distintos.
- "seriesAxes": array alineado con metrics ("left", "right" o null), solo gráficos de series. Prioriza la asignación explícita de izquierda/derecha del usuario; si no indicó lados, agrupa por unidad. Nunca mezcles PEN con galones en un mismo eje.
- "includeOthers": null por defecto, false para rankings salvo petición expresa. "limit": null para mostrar todas las sedes/categorías/períodos de un eje; NO agregues Top 12, Top 50 u Otros por rutina. Solo fija limit si pide Top N o un ranking. "bins" solo para histogram.
- Respeta las negaciones: "no quiero tortas" NO solicita donut. Cada instrucción pertenece a su gráfico: no conviertas una tendencia mensual o un ranking adicional al combo del gráfico principal.
- Antes de devolver el JSON verifica internamente cada gráfico explícito contra type, dimension/dateField, metrics, seriesTypes, seriesAxes, breakdown y período. Un título que dice "barras y línea" NO satisface el pedido si type=donut o falta la línea. Las preferencias de botones y la variedad visual son secundarias al texto del usuario.
- No prometas capacidades no implementadas: bubble con tamaño, boxplot, treemap, Sankey, mapas geográficos, objetivos no catalogados y pronósticos sin datos/modelos NO se sustituyen silenciosamente por otro tipo. Informa la parte no disponible; no inventes funciones ni métricas.
- Un dashboard completo mezcla formas: KPIs para los totales, un gráfico principal que responda exactamente a la instrucción visual del usuario, una tendencia temporal cuando la fuente es de eventos, una comparación categórica (bar, rank, donut o combo) y, si aporta, una tabla agrupada o de detalle. No repitas la misma métrica con la misma dimensión en dos gráficos, salvo que el usuario haya pedido esas dos vistas explícitamente.
- Ejemplos de widgets bien formados (ids ilustrativos de Vales de combustible; usa siempre los ids de la fuente elegida):
  · Sedes en eje X, galones en barras y PEN en línea → {"type":"combo","title":"Galones y costo PEN por sede","source":"fleet_fuel_refuels","metrics":["qty_total","cost_pen_known"],"seriesTypes":["bar","line"],"dimension":"group_name","dateField":null,"bucket":null,"limit":null,"columns":null,"summaries":[],"breakdown":null,"stack":null,"sort":null,"sortMetric":null,"cumulative":null}
  · Galones mensuales apilados por tipo de combustible → {"type":"bar","title":"Galones por mes y tipo de combustible","source":"fleet_fuel_refuels","metrics":["qty_total"],"seriesTypes":null,"dimension":null,"dateField":"date_cons","bucket":"month","limit":null,"columns":null,"summaries":[],"breakdown":"type_fuel","stack":"stack","sort":null,"sortMetric":null,"cumulative":null}
  · Costo PEN acumulado con una línea por sede → {"type":"line","title":"Costo PEN acumulado por sede","source":"fleet_fuel_refuels","metrics":["cost_pen_known"],"seriesTypes":null,"dimension":null,"dateField":"date_cons","bucket":"month","limit":null,"columns":null,"summaries":[],"breakdown":"group_name","stack":null,"sort":null,"sortMetric":null,"cumulative":true}
  · Dispersión de recorrido vs galones por placa → {"type":"scatter","title":"Recorrido vs galones por placa","source":"fleet_performance","metrics":["distance_total","qty_total"],"seriesTypes":null,"dimension":"plate","dateField":null,"bucket":null,"limit":50,"columns":null,"summaries":[],"breakdown":null,"stack":null,"sort":null,"sortMetric":null,"cumulative":null}
  · Sedes en orden alfabético con galones y abastecimientos → {"type":"bar","title":"Galones y abastecimientos por sede","source":"fleet_fuel_refuels","metrics":["qty_total","refuel_count"],"seriesTypes":["bar","bar"],"dimension":"group_name","dateField":null,"bucket":null,"limit":null,"columns":null,"summaries":[],"breakdown":null,"stack":null,"sort":"label_asc","sortMetric":null,"cumulative":null}
- Hay dos formas distintas de usar "table". Tabla de detalle: usa "columns" únicamente con ids de fields existentes; NUNCA pongas ids de metrics dentro de columns. En detalle deja metrics=[], dimension=null, dateField=null y bucket=null. Tabla agrupada: usa dimension o dateField junto con al menos una métrica válida en metrics y deja columns=null. Si quieres una tabla "por placa/sede/proveedor" con totales o ratios, eso es tabla agrupada, no tabla de detalle.
- Para tablas usa limit=null por defecto para conservar todas las filas o categorías filtradas. Solo usa limit cuando el usuario pida explícitamente un Top N, primeras N filas o un límite concreto. Nunca uses 50 como límite automático de una tabla.
- En una tabla de detalle, dateField NO significa ordenar por fecha. Si el usuario pide "detalle", "lista", "recientes", "últimos" o filas individuales, usa una tabla de detalle con columns. No conviertas una petición de ordenamiento en una tabla agrupada.
- Nunca generes una tabla con dimension/dateField y metrics vacío. Si no existe una métrica necesaria para agrupar, construye una tabla de detalle con los campos disponibles en vez de declarar esa parte como no disponible.
- Filtros: "date_range" sobre un campo de fecha de una fuente usada; "select" únicamente sobre dimensiones de negocio reconocibles por el usuario. Además del período, agrega de forma contextual entre 2 y 4 filtros select útiles cuando la fuente disponga de dimensiones relevantes. Prioriza identificadores y categorías operativas como Placa, Conductor, Sede, Tipo de combustible, Grifo, Proveedor, Estado o Área según corresponda a la fuente. En combustible prioriza Placa, Conductor, Sede y Tipo de combustible; usa Grifo como alternativa cuando sea más relevante. Nunca generes filtros interactivos sobre dimensiones técnicas o booleanas, incluyendo ids que empiecen por is_ o has_, ni filtros cuyas opciones sean true/false. Evita filtros redundantes y no inventes campos que no existan en la fuente. Un filtro select no lleva valor inicial: cuando el usuario pregunta por un valor concreto de una dimensión (una gerencia, una sede, un proveedor, un lote, un CECO), agrupa por esa dimensión para que la categoría pedida aparezca en el widget (rank, bar o table), agrega el filtro select sobre ella y, si el catálogo ya declara una métrica filtrada para ese concepto, úsala.
- Si temporalMode="snapshot", la fuente representa el estado actual completo. NO le agregues date_range solo porque tenga campos de fecha. Solo puedes filtrar uno de esos campos cuando la petición mencione explícitamente ese evento o alguno de sus filterKeywords.
- En una fuente snapshot, palabras como "actual", "catálogo", "inventario", "saldo", "valor actual" o "YTD" no autorizan por sí solas a filtrar Fecha contable, adquisición, operación o baja.
- Si una fuente snapshot ya expone una métrica o campo YTD, úsalo directamente. YTD de una métrica no significa "filtrar todas las fuentes del dashboard desde enero".
- Prefiere una sola fuente cuando esa fuente ya contiene todos los conceptos pedidos. No agregues otra fuente solo porque existe una versión histórica/mensual del mismo concepto.
- Todo filtro date_range debe incluir preset. Usa null si el usuario no pidió un período relativo. Valores permitidos: ${VAI_DATE_PRESETS.join(", ")}.
- Todo filtro incluye from y to (YYYY-MM-DD o null). Para períodos absolutos guarda sus límites inclusivos y preset=null: "setiembre de 2026" o "septiembre de 2026" es from="2026-09-01", to="2026-09-30". Nunca sustituyas un mes solicitado por todo el año ni lo dejes solo en el título. Usa currentDateLima como referencia para fechas relativas, nunca supongas la fecha actual.
- Si el usuario no indica período, usa desde 2026-01-01 hasta currentDateLima sobre defaultDateField de cada fuente de eventos. Si pide todo el histórico de forma explícita, no agregues rango. No apliques esta regla a fuentes snapshot.
- serverFilters indica qué campos de fecha resuelve el backend en SQL: el date_range de una fuente debe usar preferentemente uno de esos dateFields para que la consulta descargue solo el período pedido.
- Cada widget incluye summaries: [] por defecto. Las tablas siempre calculan resúmenes apropiados desde el catálogo. Si el usuario pide un resumen específico, añade {column: id de campo/ métrica de la tabla, operation: auto|sum|avg|min|max|none}. avg significa promedio de las filas mostradas; auto recalcula la métrica sobre los registros originales y conserva ponderaciones. Nunca sumes tasas, porcentajes, promedios ni atributos de cabecera repetidos. Identificadores y fechas no llevan resumen numérico.
- En Flota, usa Vales de combustible (fleet_fuel_refuels) como fuente principal para peticiones de consumo de combustible, galones, costo PEN, precio PEN por galón, abastecimientos, placas, conductores, sedes, grifos, tipo de combustible y tendencias temporales de consumo o costo. Usa Recorridos GPS diarios (fleet_gps_distance) cuando la petición esté centrada en kilómetros, distancia o actividad GPS. Usa Rendimiento de flota (fleet_performance) únicamente cuando sea necesario cruzar recorrido con combustible: rendimiento, eficiencia, km/gal, l/100 km, autonomía, consumo vs referencia o costo PEN por km. No uses fleet_performance para consumo o costo simple solo porque la petición mencione combustible.
- Para un dashboard de combustible sin una petición explícita de rendimiento, construye los KPIs, gráficos, rankings y tablas con fleet_fuel_refuels. Prioriza galones abastecidos, costo PEN, costo promedio PEN por galón, consumo promedio por vehículo, cantidad de placas y tendencias temporales. En combustible de Flota no existe costo USD disponible para V-Ai: nunca generes widgets, métricas, ejes, títulos ni comparaciones de costo USD, precio USD por galón, exceso USD o costo USD por km. Ofrece filtros interactivos de negocio según los campos disponibles, priorizando Placa, Conductor, Sede y Tipo de combustible, y opcionalmente Grifo. Nunca uses Tiene combustible, Vehículo con ficha útil, has_fuel, has_gps, is_vehicle, is_tank_anomaly ni ninguna otra dimensión booleana como filtro interactivo.
- Para una petición simple de Kardex, toma como referencia los KPIs actuales de KardexSum: guías, TMH enviadas, lotes por guía, USD facturado, USD Concar y diferencia; acompáñalos cuando corresponda con merma, tiempo de tránsito, tarifa media y TMH por guía. El importe oficial facturado es amount_usd de facturas; Concar es solo contraste contable.
- En Trazabilidad, "ingresados", "procesados", "valorizados", "facturados" y "pagados" corresponden respectivamente a entry_date, process_date, valuation_date, doc_date y payment_date. Para un dashboard típico prioriza lotes, proveedores, lotes sin valorización, lotes sin pago, USD/TMS promedio simple, leyes Au/Ag ponderadas por TMS, monto valorizado y monto pagado. "Por sede/oficina" usa office_name (o zone_name para Sur/Norte/Sur Aqp); "programa" y "adicional" usan program_class. traceability_lots es la fuente operativa del lote; el stock de mineral en cancha está en traceability_stock.
- En Finanzas, la compra de mineral según contabilidad es finance_mineral_purchases (una fila por lote y documento; fecha principal invoice_reg_date = fecha contable de la compra; "facturado" invoice_doc_date, "valorizado" valuation_date, "pagado" payment_date; importe de compra lot_usd_total en USD; TMS contables tms_conta_total y USD/TMS solo con usd_per_tms_conta; programa/adicional con program_class; "por lote" agrupa o filtra por lot; toda fila tiene pago: si piden facturas o documentos pendientes de pago, dilo en message y ofrece los lotes sin registro contable de traceability_lots). El cumplimiento de metas por oficina se muestra con traceability_targets y finance_mineral_purchases en widgets separados (no se cruzan fuentes). "Cuánto hemos pagado por mineral" es finance_mineral_payments: pagos por asiento contable (provisión + pago), siempre USD (payment_usd_total), netos de detracciones y en paquetes de uno o más lotes; no es por lote ni se concilia con lot_usd de finance_mineral_purchases (provisionado con provision_usd_total / provision_pen_total según su moneda, contado una vez por documento).
- En Finanzas, finance_costs es la fuente de costos y gastos de toda la empresa (contabilidad COS-001): cada fila lleva period_label (REAL 2025, REAL 2026 o PPTO 2026) y scenario (REAL/PPTO); nunca sumes escenarios distintos. Costo real = real_cost_usd / real_cost_pen (widgets separados por moneda); presupuesto = budget_cost_usd; real vs presupuesto = variance_usd, variance_pct o budget_execution_pct sobre el mismo recorte, o real y presupuesto lado a lado; amount_usd/amount_pen solo con period_label o scenario filtrado o desglosado por period_label. Las dimensiones disponibles (macro_process, lima_area, site_group/site_type/site_name, zone_name, cost_nature, prod_admin, cost_group, dynacor_group, fixed_variable, rrhh_nature/rrhh_type, transversal, account_desc, cost_center_desc, supplier_name, subledger, document_type, period_label) son equivalentes: usa la que nombre el usuario, sin preferir ninguna. "Costos de <un valor concreto>" = rank, bar o table por esa dimensión + filtro select sobre ella. Los importes ya tienen signo contable (sumar directo); no existe proyecto ni CAPEX; los datos empiezan en 2025-01-01, así que comparar años o meses usa posting_date con bucket year/month y un date_range que cubra ambos. real_cost_*_ex_mineral excluye el consumo de mineral. Usa plant_costs solo para USD/TMS de planta; no reconstruyas costos generales desde fuentes de otras áreas.
- En Planta, plant_shifts es la fuente principal del balance; los costos por cuenta/CECO y USD/TMS usan plant_costs; los costos e insumos por guardia (reactivos y bolas) usan plant_consumables; las leyes de carbón en tanques usan plant_carbon_tanks; la conciliación planta vs Control de Mineral usa plant_cm_reconciliation. Los ratios kg/TMS y USD/TMS se calculan con las métricas declaradas (TMS contada una vez por guardia o mes), nunca sumando atributos repetidos.
- En Refinería, el período es campaign_month; el costo por campaña, por gramo de Au o por kg de carbón está disponible en refinery_campaigns y por insumo/subproceso en refinery_consumption (real vs óptimo ML). Cada insumo conserva su unidad: cantidades y desviaciones de cantidad solo con un insumo filtrado o agrupado; los costos USD sí se consolidan.
- En Logística, el stock actual (Chala, CEVA, pendiente de OC, cobertura y valor) usa logistics_stock; el consumo de almacén por centro de costo o familia usa logistics_consumption; requerimientos y OC usan logistics_requirements.
- En Kardex, trjkar_guides ya trae lotes por guía, horas de tránsito y PERD/EXCE por guía; trjkar_lots es el detalle por movimiento (movement_type OPERATIVO/PERD/EXCE); trjkar_invoices trae la diferencia contra Concar por factura.
- En Activos Fijos, "activos de <período>" usa acquisition_date. Una foto de valor actual por área no lleva filtro de fecha salvo que se pida explícitamente adquisición, operación o baja. Presenta PEN y USD en widgets separados.
- En Logística, requerimientos usa req_date; compras u órdenes de compra usa po_date; entregas usa delivery_date. En Flota de mantenimiento, el período predeterminado usa req_date.
- Los valores nulos de dimensiones se muestran como "Sin dato"; los nulos numéricos se excluyen de los cálculos. Si la ausencia cambia la interpretación, incluye el conteo o detalle correspondiente.
- Cuando una fuente ofrezca explícitamente métricas PEN y USD, ambas monedas siempre van en gráficos separados. No inventes una moneda que no exista en el catálogo de la fuente. Las comparaciones por sede, área, proveedor, responsable, placa, conductor, oficina, estado o cualquier otra dimensión válida no tienen restricciones adicionales.
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
    status: {
      type: "string",
      enum: [
        "ok",
        "partial",
        "unavailable",
      ],
    },
    message: {
      type: "string",
    },
    unavailable: {
      type: "array",
      items: {
        type: "string",
      },
    },
    dashboard: {
      anyOf: [
        {
          type: "object",
          additionalProperties:
            false,
          properties: {
            title: {
              type: "string",
            },
            description: {
              type: "string",
            },
            filters: {
              type: "array",
              items: {
                type: "object",
                additionalProperties:
                  false,
                properties: {
                  kind: {
                    type: "string",
                    enum: [
                      "date_range",
                      "select",
                    ],
                  },
                  source: {
                    type: "string",
                  },
                  field: {
                    type: "string",
                  },
                  label: {
                    type: "string",
                  },
                  preset: {
                    type: [
                      "string",
                      "null",
                    ],
                    enum: [
                      null,
                      ...VAI_DATE_PRESETS,
                    ],
                  },
                  from: {
                    type: [
                      "string",
                      "null",
                    ],
                    description:
                      "Fecha inicial inclusiva YYYY-MM-DD para períodos absolutos; null para presets.",
                  },
                  to: {
                    type: [
                      "string",
                      "null",
                    ],
                    description:
                      "Fecha final inclusiva YYYY-MM-DD para períodos absolutos; null para presets.",
                  },
                },
                required: [
                  "kind",
                  "source",
                  "field",
                  "label",
                  "preset",
                  "from",
                  "to",
                ],
              },
            },
            widgets: {
              type: "array",
              items: {
                type: "object",
                additionalProperties:
                  false,
                properties: {
                  type: {
                    type: "string",
                    enum: [
                      ...VAI_WIDGET_TYPES,
                    ],
                  },
                  title: {
                    type: "string",
                  },
                  source: {
                    type: "string",
                  },
                  metrics: {
                    type: "array",
                    items: {
                      type: "string",
                    },
                  },
                  seriesTypes: {
                    type: [
                      "array",
                      "null",
                    ],
                    items: {
                      type: "string",
                      enum: [
                        "line",
                        "bar",
                      ],
                    },
                  },
                  dimension: {
                    type: [
                      "string",
                      "null",
                    ],
                  },
                  dateField: {
                    type: [
                      "string",
                      "null",
                    ],
                  },
                  bucket: {
                    type: [
                      "string",
                      "null",
                    ],
                    enum: [
                      null,
                      ...VAI_BUCKETS,
                    ],
                    description:
                      `Grano temporal cuando hay dateField: ${VAI_BUCKETS.join(", ")}`,
                  },
                  limit: {
                    type: [
                      "integer",
                      "null",
                    ],
                  },
                  columns: {
                    type: [
                      "array",
                      "null",
                    ],
                    items: {
                      type: "string",
                    },
                  },
                  summaries: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties:
                        false,
                      properties: {
                        column: {
                          type: "string",
                        },
                        operation: {
                          type: "string",
                          enum: [
                            ...VAI_SUMMARY_OPERATIONS,
                          ],
                        },
                      },
                      required: [
                        "column",
                        "operation",
                      ],
                    },
                  },
                  breakdown: {
                    type: [
                      "string",
                      "null",
                    ],
                    description:
                      "Segunda dimensión que divide la primera métrica en una serie por categoría (line, area, bar, table); null si no se pide.",
                  },
                  stack: {
                    type: [
                      "string",
                      "null",
                    ],
                    enum: [
                      null,
                      ...VAI_STACK_MODES,
                    ],
                    description:
                      "Solo bar: stack = barras apiladas, percent = apiladas al 100 %; null = agrupadas.",
                  },
                  sort: {
                    type: [
                      "string",
                      "null",
                    ],
                    enum: [
                      null,
                      ...VAI_SORT_MODES,
                    ],
                    description:
                      "Orden de las categorías del eje X; null = de mayor a menor por la primera métrica.",
                  },
                  sortMetric: {
                    type: [
                      "string",
                      "null",
                    ],
                    description:
                      "Id de la métrica que decide el orden cuando no es la primera; null en caso contrario.",
                  },
                  seriesAxes: {
                    type: ["array", "null"],
                    items: { type: ["string", "null"], enum: [null, "left", "right"] },
                    description: "Lados Y alineados con metrics; null = automático por unidad.",
                  },
                  includeOthers: {
                    type: ["boolean", "null"],
                    description: "Añadir Otros al Top N solo si se solicita; null = solo anillo por defecto.",
                  },
                  bins: {
                    type: ["integer", "null"],
                    description: "Solo histogram: entre 3 y 40 intervalos de igual ancho, null = automático.",
                  },
                  cumulative: {
                    type: [
                      "boolean",
                      "null",
                    ],
                    description:
                      "true acumula la serie a lo largo del eje temporal; null en caso contrario.",
                  },
                },
                required: [
                  "type",
                  "title",
                  "source",
                  "metrics",
                  "seriesTypes",
                  "seriesAxes",
                  "includeOthers",
                  "bins",
                  "dimension",
                  "dateField",
                  "bucket",
                  "limit",
                  "columns",
                  "summaries",
                  "breakdown",
                  "stack",
                  "sort",
                  "sortMetric",
                  "cumulative",
                ],
              },
            },
          },
          required: [
            "title",
            "description",
            "filters",
            "widgets",
          ],
        },
        {
          type: "null",
        },
      ],
    },
  },
  required: [
    "status",
    "message",
    "unavailable",
    "dashboard",
  ],
};

const FOCUS_TEXT: Record<
  VaiFocus,
  string
> = {
  auto:
    "Automático: elige la mezcla de widgets más útil.",
  kpis:
    "Prioriza KPIs y un resumen compacto (varios kpi y pocos gráficos).",
  trends:
    "Prioriza tendencias temporales (line con bucket adecuado).",
  comparisons:
    "Prioriza comparaciones por dimensión (bar, combo, rank, donut, scatter o line categórico cuando el usuario lo pida).",
  detail:
    "Prioriza tablas de detalle o resumen (table).",
};

const CHART_PREFERENCE_TEXT: Record<VaiChartPreference, string> = {
  kpi: "kpi",
  line: "line (tendencias)",
  area: "area (línea con relleno)",
  bar: "bar (barras agrupadas o apiladas)",
  combo: "combo (barras + líneas en un gráfico)",
  rank: "rank (Top N horizontal)",
  donut: "donut (distribución)",
  scatter: "scatter (dispersión de dos métricas)",
  pareto: "pareto (barras + porcentaje acumulado)",
  heatmap: "heatmap (mapa de calor)",
  histogram: "histogram (frecuencia por intervalos de registros)",
  waterfall: "waterfall (cascada de aportes y total neto)",
  table: "table",
};

/** Resumen legible de lo que el usuario pidió visualmente, para el contexto del modelo. */
function visualInstructions(
  prompt: string,
) {
  const hints =
    promptRenderHints(prompt);

  const items: string[] = [];

  for (const hint of hints.renders) {
    items.push(
      `«${hint.term.join(" ")}» debe dibujarse como ${hint.render === "bar" ? "barras" : "línea"}`,
    );
  }

  if (
    hints.mentionsBars &&
    hints.mentionsLines &&
    !hints.renders.length
  ) {
    items.push(
      "mezcla barras y líneas en un mismo gráfico (combo con seriesTypes)",
    );
  }

  for (const family of hints.families) {
    if (
      family === "donut" ||
      family === "rank" ||
      family === "scatter" ||
      family === "area"
    ) {
      items.push(
        `pide un gráfico de tipo ${family}`,
      );
    }
  }

  for (const item of hints.stack) {
    items.push(
      item.value === "percent"
        ? `barras apiladas al 100 % (stack percent) en el gráfico de «${item.context.join(" ")}»`
        : `barras apiladas (stack) en el gráfico de «${item.context.join(" ")}»`,
    );
  }

  for (const item of hints.cumulative) {
    items.push(
      `valores acumulados en el tiempo (cumulative true) en el gráfico de «${item.context.join(" ")}»`,
    );
  }

  for (const item of hints.sort) {
    items.push(
      `orden ${item.value} en el gráfico de «${item.context.join(" ")}»`,
    );
  }

  for (const item of hints.bucket) {
    items.push(
      `grano temporal ${item.value} en el gráfico de «${item.context.join(" ")}»`,
    );
  }

  for (const item of hints.breakdown) {
    items.push(
      `una serie por «${item.value.join(" ")}» (breakdown con esa dimensión) en el gráfico de «${item.context.join(" ")}»`,
    );
  }

  return items.length
    ? items
    : "ninguna instrucción visual explícita; elige la mezcla más útil";
}

class VaiGenerationError extends Error {
  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message);
  }
}

async function generateDashboardSpec(
  prompt: string,
  options: VaiGenerateOptions,
): Promise<{ output: VaiModelOutput; candidates: string[]; model: string; validation: VaiValidation }> {
  const apiKey = process.env.API_OPEN_AI?.trim();
  if (!apiKey) throw new VaiGenerationError("V-Ai no está configurado en este entorno.", "missing API_OPEN_AI");
  const candidates = selectCandidateSources(prompt, options.area);
  const ids = candidates.map((source) => source.id);
  const context = {
    currentDateLima: limaToday(), defaultHistoryStart: "2026-01-01",
    catalogIndex: VAI_SOURCES.filter((source) => source.enabled && (options.area === "auto" || source.area === options.area))
      .map((source) => ({ id: source.id, name: source.name, area: source.area,
        description: source.description, explicitOnly: source.explicitOnly ?? false, detailed: candidates.includes(source) })),
    sources: candidates.map(sourceContext),
    visualCatalog: VAI_VISUAL_CATALOG,
    visualInstructions: visualInstructions(prompt),
    explicitVisualRequests: resolveVisualRequests(prompt, ids),
    preferences: { focus: FOCUS_TEXT[options.focus], preferredWidgets: options.charts.map((chart) => CHART_PREFERENCE_TEXT[chart]),
      areaRestriction: options.area },
    request: prompt,
  };
  const deadline = Date.now() + OPENAI_TIMEOUT_MS;
  let feedback: string[] = [];
  let previous: VaiModelOutput | null = null;
  // A lo sumo dos llamadas. La segunda solo repara un contrato incumplido.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining < 8_000) break;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(remaining, attempt === 0 ? 100_000 : remaining));
    let payload: unknown;
    try {
      const response = await fetch(OPENAI_URL, {
        method: "POST", cache: "no-store", signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: VAI_OPENAI_MODEL, store: false, max_output_tokens: 20000,
          ...(/^(?:gpt-[56]|o[134])/.test(VAI_OPENAI_MODEL) ? { reasoning: { effort: VAI_REASONING } } : {}),
          input: [
            { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT }] },
            { role: "user", content: [{ type: "input_text", text: JSON.stringify({ ...context,
              ...(attempt ? { repair: { instruction: "Repara el diseño completo. No basta cambiar títulos; corrige ids, tipos de serie y ejes. Solo datos del catálogo.",
                problems: feedback, previousSpecification: previous } } : {}) }) }] },
          ],
          text: { format: { type: "json_schema", name: "vai_dashboard", strict: true, schema: OUTPUT_SCHEMA } },
        }),
      });
      // El timeout cubre también la descarga y el parseo, no solo las cabeceras.
      const bodyText = await response.text();
      if (!response.ok) {
        const message = response.status === 401 || response.status === 403
          ? "La API de IA rechazó las credenciales o el acceso al modelo. Revisa la configuración de V-Ai."
          : response.status === 429 ? "La API de IA alcanzó su límite de uso. Inténtalo nuevamente en unos minutos."
          : response.status === 404 ? "El modelo configurado no está disponible para esta API. Revisa VAI_OPENAI_MODEL."
          : "El servicio de IA devolvió un error. Inténtalo nuevamente.";
        throw new VaiGenerationError(message, `openai status=${response.status} model=${VAI_OPENAI_MODEL}`);
      }
      try { payload = JSON.parse(bodyText); }
      catch { throw new VaiGenerationError("La API de IA devolvió una respuesta que no es JSON."); }
    } catch (error) {
      if (error instanceof VaiGenerationError) throw error;
      const aborted = controller.signal.aborted;
      if (aborted && attempt === 0 && deadline - Date.now() > 15_000) {
        feedback = ["La primera generación agotó su tiempo. Devuelve un diseño más compacto sin omitir el gráfico principal."];
        continue;
      }
      throw new VaiGenerationError(aborted ? "La generación agotó su tiempo. No se guardó un diseño incompleto."
        : "No se pudo contactar al servicio de IA.");
    } finally { clearTimeout(timer); }
    const record = payload as { status?: string; incomplete_details?: { reason?: string }; output?: unknown[] };
    if (record.status === "incomplete" || record.status === "failed") {
      feedback = [`Respuesta ${record.status}: ${record.incomplete_details?.reason ?? "sin diseño completo"}. Devuelve un diseño compacto válido.`];
      continue;
    }
    const text = extractOutputText(payload);
    let parsed: unknown = null;
    try { parsed = JSON.parse(text); } catch { /* se repara una sola vez */ }
    const output = coerceModelOutput(parsed);
    if (!output) { feedback = ["Falta una respuesta JSON completa conforme al esquema."]; continue; }
    previous = output;
    const validation = validateModelOutput(output, prompt, ids);
    if (validation.issues?.length) { feedback = validation.issues; continue; }
    return { output, candidates: ids, model: VAI_OPENAI_MODEL, validation };
  }
  throw new VaiGenerationError(
    `No se pudo construir un diseño que respete la solicitud. ${feedback.slice(0, 2).join(" ")}`,
    `visual contract not satisfied model=${VAI_OPENAI_MODEL}`,
  );
}

function extractOutputText(
  payload: unknown,
) {
  if (
    typeof payload !==
      "object" ||
    payload === null
  ) {
    return "";
  }

  const record =
    payload as {
      output_text?: unknown;
      output?: unknown;
    };

  if (
    typeof record.output_text ===
    "string"
  ) {
    return record.output_text;
  }

  if (
    !Array.isArray(
      record.output,
    )
  ) {
    return "";
  }

  for (
    const block of
    record.output
  ) {
    const content =
      (
        block as {
          content?: unknown;
        }
      ).content;

    if (
      !Array.isArray(
        content,
      )
    ) {
      continue;
    }

    for (
      const part of content
    ) {
      const item =
        part as {
          type?: unknown;
          text?: unknown;
        };

      if (
        item.type ===
          "output_text" &&
        typeof item.text ===
          "string"
      ) {
        return item.text;
      }
    }
  }

  return "";
}

const FOCUS: VaiFocus[] = [
  "auto",
  "kpis",
  "trends",
  "comparisons",
  "detail",
];

const CHARTS: readonly VaiChartPreference[] = VAI_WIDGET_TYPES;

export async function POST(
  req: Request,
) {
  const session =
    await sessionWithScope(
      req,
      "vai",
    );

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No autorizado",
      },
      {
        status: 401,
      },
    );
  }

  const body =
    (
      await req
        .json()
        .catch(
          () => ({}),
        )
    ) as {
      prompt?: unknown;
      area?: unknown;
      focus?: unknown;
      charts?: unknown;
    };

  const prompt =
    String(
      body.prompt ?? "",
    )
      .replace(/[ \t]+/g, " ")
      .trim();

  if (
    prompt.length < 8
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Describe con más detalle el dashboard que quieres.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    prompt.length >
    VAI_PROMPT_MAX
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          `El prompt supera los ${VAI_PROMPT_MAX} caracteres.`,
      },
      {
        status: 400,
      },
    );
  }

  const areaRaw =
    String(
      body.area ??
        "auto",
    );

  const area:
    VaiArea | "auto" =
      VAI_AREAS.some(
        (item) =>
          item.id === areaRaw,
      )
        ? (
            areaRaw as VaiArea
          )
        : "auto";

  const focusRaw =
    String(
      body.focus ??
        "auto",
    ) as VaiFocus;

  const focus =
    FOCUS.includes(
      focusRaw,
    )
      ? focusRaw
      : "auto";

  const charts =
    Array.isArray(
      body.charts,
    )
      ? body.charts
          .map(String)
          .filter(
            (
              c,
            ): c is VaiChartPreference =>
              CHARTS.includes(
                c as VaiChartPreference,
              ),
          )
      : [];

  try {
    const {
      output,
      candidates,
      model,
      validation,
    } =
      await generateDashboardSpec(
        prompt,
        {
          area,
          focus,
          charts,
        },
      );

    const {
      spec,
      notes,
    } =
      validation;

    if (!spec) {
      const unavailable =
        [
          ...new Set([
            ...output.unavailable,
            ...notes,
          ]),
        ];

      return NextResponse.json({
        ok: true,
        status:
          "unavailable",
        message:
          output.message ||
          "Actualmente no existe información disponible en V-Ai para construir ese dashboard.",
        unavailable,
        spec: null,
        candidates,
      });
    }

    const unavailable =
      [
        ...new Set(
          notes,
        ),
      ];

    const status =
      unavailable.length
        ? "partial"
        : "ok";

    return NextResponse.json({
      ok: true,
      status,
      message:
        unavailable.length
          ? output.message
          : "",
      unavailable,
      spec,
      candidates,
      model,
    });
  } catch (error) {
    if (
      error instanceof
      VaiGenerationError
    ) {
      console.error(
        "V-Ai generate:",
        error.detail ??
          error.message,
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            error.message,
        },
        {
          status: 502,
        },
      );
    }

    console.error(
      "V-Ai generate:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "No se pudo generar el dashboard. Inténtalo de nuevo.",
      },
      {
        status: 500,
      },
    );
  }
}