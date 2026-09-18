import { NextResponse } from "next/server";
import { sessionWithScope } from "@/src/lib/auth/session";
import { VAI_AREAS, VAI_BREAKDOWN_CHART_LIMIT, VAI_BREAKDOWN_TABLE_LIMIT, VAI_BUCKETS, VAI_DATE_PRESETS, VAI_MAX_FILTERS, VAI_MAX_SOURCES, VAI_MAX_WIDGETS, VAI_PROMPT_MAX, VAI_SORT_MODES, VAI_SOURCES, VAI_STACK_MODES, VAI_SUMMARY_OPERATIONS, VAI_WIDGET_TYPES, VAI_VISUAL_CATALOG, detectVaiLanguage, filterKey, normalizeVaiPrompt, parseStoredSpec, resolveVisualRequests, coerceModelOutput, limaToday, promptRenderHints, validateModelOutput, validateWidgetEdit, type VaiArea, type VaiChartPreference, type VaiDashboardSpec, type VaiFocus, type VaiLanguage, type VaiModelOutput, type VaiRawWidget, type VaiSource, type VaiValidation, } from "@/src/lib/vai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const VAI_OPENAI_MODEL = process.env.VAI_OPENAI_MODEL?.trim() || "gpt-5.4";
const VAI_REASONING = ["low", "medium", "high"].includes(process.env.VAI_OPENAI_REASONING ?? "")
    ? process.env.VAI_OPENAI_REASONING! : "medium";
const OPENAI_URL = "https://api.openai.com/v1/responses";
const OPENAI_TIMEOUT_MS = 155000;
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
    return normalizeVaiPrompt(text)
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 2 &&
        !STOP.has(token));
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

    add(source.id.replace(/_/g, " "), 4);
    add(source.area, 3);
    add(source.name, 3);
    add(source.description, 2);
    add(source.keywords.join(" "), 3);
    add(source.grain, 1);

    for (const field of source.fields) {
        add(`${field.label} ${field.id.replace(/_/g, " ")}`, 1.5);
    }

    for (const metric of source.metrics) {
        add(`${metric.label} ${metric.description}`, 1.5);
    }

    let score = 0;

    for (const token of promptTokens) {
        score +=
            bag.get(stem(token)) ?? 0;
    }

    return score;
}

function selectCandidateSources(prompt: string, area: VaiArea | "auto") {
    const promptTokens = tokens(prompt);
    const promptTokenSet = new Set(promptTokens.map(stem));

    const explicitlyRequested = (source: VaiSource) => source.keywords.some((keyword) => {
        const required = tokens(keyword).map(stem);

        return (required.length > 0 &&
            required.every((token) => promptTokenSet.has(token)));
    });

    const enabled = VAI_SOURCES.filter((source) => source.enabled &&
        (!source.explicitOnly ||
            explicitlyRequested(source)));

    const pool = area === "auto"
        ? enabled
        : enabled.filter((source) => source.area === area);

    const scored = pool
        .map((source) => ({
        source,
        score: sourceScore(source, promptTokens),
    }))
        .sort((a, b) => b.score - a.score);

    const positive = scored.filter((item) => item.score > 0);

    const picked = (positive.length
        ? positive
        : scored)
        .slice(0, MAX_CANDIDATES)
        .map((item) => item.source);

    if (area !== "auto") {
        for (const source of pool) {
            if (!picked.includes(source) &&
                picked.length <
                    MAX_CANDIDATES) {
                picked.push(source);
            }
        }
    }

    return picked;
}

function sourceContext(source: VaiSource) {
    return {
        id: source.id,
        name: source.name,
        area: VAI_AREAS.find((item) => item.id === source.area)?.label ??
            source.area,
        description: source.description,
        grain: source.grain,
        temporalMode: source.temporalMode ??
            "event",
        defaultDateField: source.defaultDateField ??
            null,
        serverFilters: source.query
            ? {
                dateFields: source.query
                    .dateFields,
                dimensions: source.query
                    .dimensions,
                note: "from/to del date_range se resuelven en SQL sobre estos campos; el resto se calcula en el navegador.",
            }
            : null,
        rules: [
            ...source.rules,
            ...(source.exclusions ??
                []).map((c) => `Exclusión fija: ${c.field} ${c.op} ${JSON.stringify(c.value ?? "")}.`),
        ],
        businessTerms: source.keywords,
        dateFields: source.fields
            .filter((field) => field.role === "date")
            .map((field) => ({
            id: field.id,
            label: field.label,
            description: field.description,
            filterKeywords: field.dateFilterKeywords ??
                [],
        })),
        dimensions: source.fields
            .filter((field) => field.role ===
            "dimension")
            .map((field) => ({
            id: field.id,
            label: field.label,
            description: field.description,
        })),
        attributes: source.fields
            .filter((field) => field.role ===
            "attribute" ||
            field.role ===
                "measure")
            .map((field) => ({
            id: field.id,
            label: field.label,
            format: field.format ??
                "text",
            description: field.description,
            tableOnly: true,
        })),
        metrics: source.metrics.map((metric) => ({
            id: metric.id,
            label: metric.label,
            description: metric.description,
            agg: metric.agg,
            format: metric.format,
            field: metric.field ??
                null,
            field2: metric.field2 ??
                null,
            distinctField: metric.distinctField ??
                null,
            numerator: metric.numerator ??
                null,
            denominator: metric.denominator ??
                null,
            multiplier: metric.multiplier ??
                null,
            weight: metric.weight ??
                null,
            where: metric.where ?? [],
            whereAny: metric.whereAny ?? [],
        })),
        relations: (source.relations ??
            []).map((relation) => `${relation.field} → ${relation.source}.${relation.targetField}: ${relation.description} (V-Ai v1 no cruza fuentes).`),
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
  · matrix = matriz desplegable: UNA métrica de suma, columns como jerarquía ordenada de 1 a 5 campos en filas, matrixColumns como jerarquía ordenada de 0 a 3 dimensiones categóricas en columnas y dateField/bucket como dimensión temporal adicional de columnas cuando corresponda. No aplica el límite de series de los gráficos. No es una tabla plana.
- "breakdown" (segunda dimensión, opcional) divide las métricas en series por categoría: "una línea por sede", "barras agrupadas por período", "desglosado por conductor", "tabla de galones por sede y grifo". En line, area, bar, combo, heatmap y table usa una dimensión distinta de "dimension". Con una métrica genera una serie por categoría; con combo y varias métricas genera una serie por cada combinación métrica × categoría y conserva seriesTypes/seriesAxes de la métrica base. Se dibujan hasta ${VAI_BREAKDOWN_CHART_LIMIT} categorías de desglose (el resto sale como «Otros»); en tablas hasta ${VAI_BREAKDOWN_TABLE_LIMIT} columnas. En matrix usa matrixColumns, no breakdown, para definir columnas categóricas.
- "sort" ordena las categorías del eje X: ${VAI_SORT_MODES.join(", ")} (value_desc es el predeterminado; "de menor a mayor" = value_asc; "orden alfabético" = label_asc). "sortMetric" es el id de la métrica que manda cuando no es la primera. En ejes temporales ambos van en null.
- "cumulative": true acumula a lo largo del tiempo ("acumulado", "curva acumulada", "avance acumulado"); solo con dateField y métricas sumables; si no, null.
- "bucket": ${VAI_BUCKETS.join("/")} según pidan diario, semanal, mensual, trimestral o anual; month si no dicen nada; null sin dateField.
- Traducción obligatoria de instrucciones visuales del usuario cuando aparezcan en la petición:
  · "X en barras y Y en líneas", "barras de X con línea de Y" → type "combo", metrics [X, Y], seriesTypes ["bar", "line"]. Respeta también la combinación inversa (X línea, Y barra) y varias barras con una línea.
  · "eje secundario para Y" → seriesAxes asigna "right" a Y; no cambia su marca si pidió dos líneas o dos barras.
  · "apilado", "apiladas" → bar + stack "stack"; "apilado al 100 %", "porcentual", "participación apilada" → stack "percent".
  · "una línea/serie/barra por <dimensión>", "desglosado/segmentado/separado/dividido por <dimensión>", "por <eje> y <dimensión>" → breakdown = esa dimensión.
  · "acumulado" → cumulative true. "torta/pastel/anillo/pie" → donut. "ranking/top N/barras horizontales" → rank. "dispersión/correlación/scatter" → scatter. "gráfico de área" → area. Si pide una matriz indicando filas, columnas y valores, usa type=matrix, columns exactamente en el orden pedido para las filas, matrixColumns exactamente en el orden pedido para las columnas categóricas y metrics con la medida pedida; si una columna es temporal usa dateField/bucket en vez de inventar una dimensión.
  · "orden alfabético" → sort label_asc; "de menor a mayor" → value_asc; "de mayor a menor" → value_desc; "ordenado por <métrica>" → sortMetric.
  · "trimestral" → bucket quarter; "anual/por año" → year; "semanal" → week; "diario/por día" → day.
- El eje X categórico de un gráfico siempre se define mediante "dimension". Si el usuario pide explícitamente "eje X por placa", "eje X oficina", "por sede", "por proveedor", "por conductor", "por área", "por estado" o cualquier clasificación equivalente disponible en la fuente, usa ese id exacto como dimension. En ese caso dateField debe ser null salvo que el usuario haya pedido además explícitamente una evolución temporal separada.
- Las dimensiones del eje X son genéricas para todas las áreas. No limites esta capacidad a Flota: cualquier field role="dimension" de la fuente puede ser el eje categórico cuando tenga sentido.
- Si el usuario pide un gráfico por una clasificación no temporal, no sustituyas esa clasificación por una fecha solo porque la fuente tenga defaultDateField.
- En line, area, bar y combo, "seriesTypes" indica cómo se dibuja cada métrica, alineado 1 a 1 con "metrics", con valores "line" o "bar"; en los demás tipos va null.
- Resuelve la intención del usuario de forma semántica usando el nombre, descripción, reglas, campos y métricas de las fuentes. No exijas coincidencia literal entre las palabras del prompt y los ids o labels del catálogo: identifica qué medida representa el concepto pedido dentro del área, moneda, dimensiones y contexto disponibles antes de declarar que falta información.
- Combina métricas en un mismo gráfico solo cuando la lectura sea clara. Considera siempre el format/unidad de cada métrica: tonelaje, leyes, porcentajes, moneda, horas, conteos, etc. El renderer usa eje Y secundario cuando hay dos unidades incompatibles o escalas muy distintas. No combines más de dos familias de escala incompatibles en un mismo gráfico; si hacen falta más, sepáralas en widgets distintos.
- "seriesAxes": array alineado con metrics ("left", "right" o null), solo gráficos de series. Prioriza la asignación explícita de izquierda/derecha del usuario; si no indicó lados, agrupa por unidad. Nunca mezcles PEN con galones en un mismo eje.
- "includeOthers": null por defecto, false para rankings salvo petición expresa. "limit": null para mostrar todas las sedes/categorías/períodos de un eje; NO agregues Top 12, Top 50 u Otros por rutina. Solo fija limit si pide Top N o un ranking. "bins" solo para histogram.
- Respeta las negaciones: "no quiero tortas" NO solicita donut. Cada instrucción pertenece a su gráfico: no conviertas una tendencia mensual o un ranking adicional al combo del gráfico principal.
- Antes de devolver el JSON verifica internamente cada gráfico explícito contra type, dimension/dateField, metrics, seriesTypes, seriesAxes, breakdown y período. Un título que dice "barras y línea" NO satisface el pedido si type=donut o falta la línea. Las preferencias de botones y la variedad visual son secundarias al texto del usuario.
- No prometas capacidades no implementadas: bubble con tamaño, boxplot, treemap, Sankey, mapas geográficos, objetivos no catalogados y pronósticos sin datos/modelos NO se sustituyen silenciosamente por otro tipo. Informa la parte no disponible; no inventes funciones ni métricas.
- Un dashboard completo mezcla formas: KPIs para los totales, un gráfico principal que responda exactamente a la instrucción visual del usuario, una tendencia temporal cuando la fuente es de eventos, una comparación categórica (bar, rank, donut o combo) y, si aporta, una tabla agrupada o de detalle. No repitas la misma métrica con la misma dimensión en dos gráficos, salvo que el usuario haya pedido esas dos vistas explícitamente.
- Ejemplos de widgets bien formados (usa siempre ids reales de la fuente elegida):
  · Costos por Gerencia Lima, USD en barras y PEN en líneas, sin mezclar períodos → {"type":"combo","title":"Costo USD y PEN por Gerencia Lima y período","source":"finance_costs","metrics":["cost_total_usd","cost_total_pen"],"seriesTypes":["bar","line"],"seriesAxes":["right","left"],"dimension":"gerencia_lima","dateField":null,"bucket":null,"limit":null,"columns":null,"matrixColumns":null,"summaries":[],"breakdown":"period_label","stack":null,"sort":"value_desc","sortMetric":"cost_total_usd","cumulative":null}
  · Sedes en eje X, galones en barras y PEN en línea → {"type":"combo","title":"Galones y costo PEN por sede","source":"fleet_fuel_refuels","metrics":["qty_total","cost_pen_known"],"seriesTypes":["bar","line"],"dimension":"group_name","dateField":null,"bucket":null,"limit":null,"columns":null,"matrixColumns":null,"summaries":[],"breakdown":null,"stack":null,"sort":null,"sortMetric":null,"cumulative":null}
  · Galones mensuales apilados por tipo de combustible → {"type":"bar","title":"Galones por mes y tipo de combustible","source":"fleet_fuel_refuels","metrics":["qty_total"],"seriesTypes":null,"dimension":null,"dateField":"date_cons","bucket":"month","limit":null,"columns":null,"matrixColumns":null,"summaries":[],"breakdown":"type_fuel","stack":"stack","sort":null,"sortMetric":null,"cumulative":null}
  · Costo PEN acumulado con una línea por sede → {"type":"line","title":"Costo PEN acumulado por sede","source":"fleet_fuel_refuels","metrics":["cost_pen_known"],"seriesTypes":null,"dimension":null,"dateField":"date_cons","bucket":"month","limit":null,"columns":null,"matrixColumns":null,"summaries":[],"breakdown":"group_name","stack":null,"sort":null,"sortMetric":null,"cumulative":true}
  · Dispersión de recorrido vs galones por placa → {"type":"scatter","title":"Recorrido vs galones por placa","source":"fleet_performance","metrics":["distance_total","qty_total"],"seriesTypes":null,"dimension":"plate","dateField":null,"bucket":null,"limit":50,"columns":null,"matrixColumns":null,"summaries":[],"breakdown":null,"stack":null,"sort":null,"sortMetric":null,"cumulative":null}
  · Sedes en orden alfabético con galones y abastecimientos → {"type":"bar","title":"Galones y abastecimientos por sede","source":"fleet_fuel_refuels","metrics":["qty_total","refuel_count"],"seriesTypes":["bar","bar"],"dimension":"group_name","dateField":null,"bucket":null,"limit":null,"columns":null,"matrixColumns":null,"summaries":[],"breakdown":null,"stack":null,"sort":"label_asc","sortMetric":null,"cumulative":null}
- Hay dos formas distintas de usar "table". Tabla de detalle: usa "columns" únicamente con ids de fields existentes; NUNCA pongas ids de metrics dentro de columns. En detalle deja metrics=[], dimension=null, dateField=null y bucket=null. Tabla agrupada: usa dimension o dateField junto con al menos una métrica válida en metrics y deja columns=null. Si quieres una tabla "por placa/sede/proveedor" con totales o ratios, eso es tabla agrupada, no tabla de detalle.
- Para tablas usa limit=null por defecto para conservar todas las filas o categorías filtradas. Solo usa limit cuando el usuario pida explícitamente un Top N, primeras N filas o un límite concreto. Nunca uses 50 como límite automático de una tabla.
- En una tabla de detalle, dateField NO significa ordenar por fecha. Si el usuario pide "detalle", "lista", "recientes", "últimos" o filas individuales, usa una tabla de detalle con columns. No conviertas una petición de ordenamiento en una tabla agrupada.
- Nunca generes una tabla con dimension/dateField y metrics vacío. Si no existe una métrica necesaria para agrupar, construye una tabla de detalle con los campos disponibles en vez de declarar esa parte como no disponible.
- Filtros: "date_range" sobre un campo de fecha de una fuente usada; "select" únicamente sobre dimensiones de negocio reconocibles por el usuario. Además del período, agrega de forma contextual entre 2 y 4 filtros select útiles cuando la fuente disponga de dimensiones relevantes. Prioriza identificadores y categorías operativas como Placa, Conductor, Sede, Tipo de combustible, Grifo, Proveedor, Estado o Área según corresponda a la fuente. En combustible prioriza Placa, Conductor, Sede y Tipo de combustible; usa Grifo como alternativa cuando sea más relevante. Nunca generes filtros interactivos sobre dimensiones técnicas o booleanas, incluyendo ids que empiecen por is_ o has_, ni filtros cuyas opciones sean true/false. Evita filtros redundantes y no inventes campos que no existan en la fuente. Un filtro select incluye values=null por defecto y un array de valores solo cuando el usuario los solicita explícitamente y pertenecen al catálogo; en costos los meses y period_label pueden inicializarse así: cuando el usuario pregunta por un valor concreto de una dimensión (una gerencia, una sede, un proveedor, un lote, un CECO), agrupa por esa dimensión para que la categoría pedida aparezca en el widget (rank, bar o table), agrega el filtro select sobre ella y, si el catálogo ya declara una métrica filtrada para ese concepto, úsala.
- Si temporalMode="snapshot", la fuente representa el estado actual completo. NO le agregues date_range solo porque tenga campos de fecha. Solo puedes filtrar uno de esos campos cuando la petición mencione explícitamente ese evento o alguno de sus filterKeywords.
- En una fuente snapshot, palabras como "actual", "catálogo", "inventario", "saldo", "valor actual" o "YTD" no autorizan por sí solas a filtrar Fecha contable, adquisición, operación o baja.
- Si una fuente snapshot ya expone una métrica o campo YTD, úsalo directamente. YTD de una métrica no significa "filtrar todas las fuentes del dashboard desde enero".
- Prefiere una sola fuente cuando esa fuente ya contiene todos los conceptos pedidos. No agregues otra fuente solo porque existe una versión histórica/mensual del mismo concepto.
- Todo filtro date_range debe incluir preset. Usa null si el usuario no pidió un período relativo. Valores permitidos: ${VAI_DATE_PRESETS.join(", ")}.
- Los filtros financieros disponibles de lotes son entry_date, pay_date y valuation_date. Activa un rango solo para el evento pedido; los otros quedan sin límites y no excluyen nulos. Si el usuario no pide un evento, usa entry_date. No actives simultáneamente tres rangos por rutina.
- Si pide por períodos, meses, mensual o YY_MMM, usa dateField válido y bucket="month"; el motor conserva claves YYYY-MM para ordenar y muestra YY_MMM. El selector permite períodos múltiples, incluso no contiguos. No sustituyas una agrupación mensual por un listado de fechas diarias.
- finance_mineral_payments.doc_type (document_type de conta_payments) y payment_document_type son filtros locales de cada widget; el renderer los agrega automáticamente. Nunca los incluyas en dashboard.filters, nunca apliques esos filtros a los lotes ni a otros gráficos.
- Todo filtro incluye from y to (YYYY-MM-DD o null). Para períodos absolutos guarda sus límites inclusivos y preset=null: "setiembre de 2026" o "septiembre de 2026" es from="2026-09-01", to="2026-09-30". Nunca sustituyas un mes solicitado por todo el año ni lo dejes solo en el título. Usa currentDateLima como referencia para fechas relativas, nunca supongas la fecha actual.
- Si el usuario no indica período, usa desde 2026-01-01 hasta currentDateLima sobre defaultDateField de cada fuente de eventos. Si pide todo el histórico de forma explícita, no agregues rango. No apliques esta regla a fuentes snapshot. En finance_costs esta regla no aplica: utiliza month_label independiente del año, sin date_range predeterminado.
- serverFilters indica qué campos de fecha resuelve el backend en SQL: el date_range de una fuente debe usar preferentemente uno de esos dateFields para que la consulta descargue solo el período pedido.
- Cada widget incluye summaries: [] por defecto. Las tablas siempre calculan resúmenes apropiados desde el catálogo. Si el usuario pide un resumen específico, añade {column: id de campo/ métrica de la tabla, operation: auto|sum|avg|min|max|none}. avg significa promedio de las filas mostradas; auto recalcula la métrica sobre los registros originales y conserva ponderaciones. Nunca sumes tasas, porcentajes, promedios ni atributos de cabecera repetidos. Identificadores y fechas no llevan resumen numérico.
- En Flota, usa Vales de combustible (fleet_fuel_refuels) como fuente principal para peticiones de consumo de combustible, galones, costo PEN, precio PEN por galón, abastecimientos, placas, conductores, sedes, grifos, tipo de combustible y tendencias temporales de consumo o costo. Usa Recorridos GPS diarios (fleet_gps_distance) cuando la petición esté centrada en kilómetros, distancia o actividad GPS. Usa Rendimiento de flota (fleet_performance) únicamente cuando sea necesario cruzar recorrido con combustible: rendimiento, eficiencia, km/gal, l/100 km, autonomía, consumo vs referencia o costo PEN por km. No uses fleet_performance para consumo o costo simple solo porque la petición mencione combustible.
- Para un dashboard de combustible sin una petición explícita de rendimiento, construye los KPIs, gráficos, rankings y tablas con fleet_fuel_refuels. Prioriza galones abastecidos, costo PEN, costo promedio PEN por galón, consumo promedio por vehículo, cantidad de placas y tendencias temporales. En combustible de Flota no existe costo USD disponible para V-Ai: nunca generes widgets, métricas, ejes, títulos ni comparaciones de costo USD, precio USD por galón, exceso USD o costo USD por km. Ofrece filtros interactivos de negocio según los campos disponibles, priorizando Placa, Conductor, Sede y Tipo de combustible, y opcionalmente Grifo. Nunca uses Tiene combustible, Vehículo con ficha útil, has_fuel, has_gps, is_vehicle, is_tank_anomaly ni ninguna otra dimensión booleana como filtro interactivo.
- Para una petición simple de Kardex, toma como referencia los KPIs actuales de KardexSum: guías, TMH enviadas, lotes por guía, USD facturado, USD Concar y diferencia; acompáñalos cuando corresponda con merma, tiempo de tránsito, tarifa media y TMH por guía. El importe oficial facturado es amount_usd de facturas; Concar es solo contraste contable.
- En Trazabilidad, "ingresados", "procesados", "valorizados", "facturados" y "pagados" corresponden respectivamente a entry_date, process_date, valuation_date, doc_date y payment_date. Por lote, doc_date, doc_number, payment_date y lot_usd siguen la verdad CONCAR de dw.v_traceability_get: payment_date solo indica que el lote figura pagado y lot_usd es el monto facturado/valorizado, nunca el efectivo pagado. Para un dashboard típico prioriza lotes, proveedores, lotes sin valorización, lotes sin pago, USD/TMS promedio simple y leyes Au/Ag ponderadas por TMS. "Por sede/oficina" usa office_name (o zone_name para Sur/Norte/Sur Aqp); "programa" y "adicional" usan program_class. traceability_lots es la fuente operativa del lote; el pago efectivo está únicamente en finance_mineral_payments y no se atribuye por lote.
- En Finanzas, facturación, valorización y estado de pago por lote usan finance_mineral_purchases, con exactamente el universo de dw.v_traceability_get, sin lotes históricos adicionales ni exclusión de lotes sin factura. lot_usd_total suma lot_usd tal como sale de traceability_get, nunca otro importe ni una reconstrucción. La etiqueta visible de la referencia contable es CONCAR. Fecha principal entry_date; por pago de lotes usa pay_date (alias de payment_date de traceability_get) y por valorización valuation_date. invoice_reg_date e invoice_doc_date son atributos informativos, no filtros de fecha financieros. Para tablas por lote incluye siempre lot y entry_date juntos, una fila por lote, sin rows_count, __count ni métricas de conteo por lote. El pago efectivo usa exclusivamente finance_mineral_payments.payment_usd_total, con payment_date como fecha principal y su universo conta_payments intacto. Nunca unir estas fuentes por lot, RUC, documento u otra clave ni repartir el pago de un comprobante entre lotes. Puedes presentar tendencias por período en gráficos separados, sin saldo o conciliación cruzada. El renderer actual usa una fuente por widget; no inventes un widget con métricas mezcladas de fuentes distintas.
- En Finanzas, finance_costs es la fuente oficial de costos y gastos de toda la empresa. Por defecto usa únicamente USD; PEN solo si lo solicitan explícitamente. PPTO no tiene PEN, no lo conviertas ni lo muestres como cero.
- Estándar obligatorio de costos: filtros select period_label (REAL 2025, REAL 2026, PPTO 2026), month_label (01_ENE a 12_DIC) y gerencia_lima, además de los clasificadores solicitados. Enero-julio selecciona los mismos meses para cada period_label: no uses un date_range absoluto que elimine REAL 2025. Sin meses solicitados, conserva todos. Para valores pedidos explícitamente, usa values en el filtro select; en otro caso values=null.
- Costos: tarjetas cost_real_2026_usd, cost_ppto_2026_usd y cost_real_2025_usd con importe acumulado. No generes por defecto un gráfico cuyo único eje categórico sea period_label para comparar REAL/PPTO; esas cifras ya están en las tarjetas. No sumes los tres escenarios/ejercicios en una tarjeta. Las variaciones real/presupuesto se calculan solo entre REAL 2026 y PPTO 2026 con los mismos meses y clasificadores.
- En costos, por defecto agrega matrix con metrics=[cost_total_usd], columns=[account_label,supplier_label,gloss], matrixColumns=[period_label], dateField=posting_date y bucket=month. Si el usuario define explícitamente filas, columnas o valores de una matriz, respeta exactamente su orden y no agregues posting_date/meses ni otras columnas que no haya pedido. La matriz muestra expansión por fila y totales separados, sin sumar escenarios ni padres con hijos. Para PEN usa cost_total_pen y solo importes existentes.
- En costos, todo gráfico cuyo eje X sea un clasificador como gerencia, zona, sede, grupo, cuenta, CECO, proveedor u otra dimensión de negocio debe conservar period_label como breakdown cuando compara importes: cada categoría del eje X se segrega en REAL 2026, REAL 2025 y PPTO 2026 cuando existan; nunca mezcles esos períodos dentro de una sola barra. Para una sola moneda usa cost_total_usd o cost_total_pen. Si el usuario pide explícitamente USD y PEN en el mismo combo, usa metrics=[cost_total_usd,cost_total_pen], seriesTypes según lo pedido, breakdown=period_label y stack=null; así cada período USD conserva su barra y cada período PEN conserva su línea. PPTO 2026 no tiene PEN y debe quedar ausente, no en cero.
- Las tablas de costos incluyen period_label, cuenta completa, proveedor completo, glosa y monto de la moneda pedida. gerencia_lima corresponde al clasificador G_LIMA, no al macroproceso. Mantén los demás clasificadores: macro_process, site_group/site_type/site_name, zone_name, cost_nature, prod_admin, cost_group, dynacor_group/subgroup, fixed_variable, rrhh_nature/type, transversal, subledger y document_type. No inventes CAPEX o proyecto ni reconstruyas costos generales desde otras fuentes.
- En Planta, plant_shifts (una fila por guardia, fecha shift_date) es la fuente del balance metalúrgico: tonelaje (tms_total/tmh_total), leyes ponderadas por TMS (avg_au_feed, avg_ag_feed, avg_au_tail…), gramos alimentados/producidos/en relave, recuperación (au_recovery/ag_recovery = Σ producido / Σ alimentado), TMS por hora, disponibilidad y ratios kg/TMS de NaCN, soda y bolas; nunca uses avg sobre au_feed, au_recu, prod_ratio ni *_ratio: usa las métricas declaradas. "Balance por turno" = dimension plant_shift o breakdown plant_shift; "evolución del balance" = dateField shift_date con bucket day/week/month; comparar fechas = dateField shift_date sin bucket mensual. Los costos por cuenta/CECO y USD/TMS usan plant_costs; los insumos con precio por guardia (reactivos y bolas) usan plant_consumables; la conciliación planta vs Control de Mineral usa plant_cm_reconciliation.
- En Planta, plant_tanks (una fila por tanque de lixiviación TK1-TK11, fecha de ensayo y mineral Au/Ag) responde leyes de carbón por tanque: "evolución de leyes por tanque" o "varios tanques en líneas" = type line, metrics [avg_grade_au] (o avg_grade_ag para plata), dateField tank_date, bucket day, breakdown tank y filtro select tank (values solo si el usuario nombra tanques); comparar tanques = bar/rank por tank con la métrica del mineral pedido. La ley se promedia (simple) o se compara, nunca se suma; Au y Ag van en widgets separados (métricas *_au / *_ag), sin mezclar minerales en una misma serie.
- En Refinería, el período es campaign_month (mes codificado en campaign_id) y campaign_id es la dimensión para comparar campañas. refinery_campaigns (una fila por campaña) trae carbón húmedo/seco (kg), humedad, leyes del carbón ponderadas por carbón seco y producción Au/Ag/Cu en kg y ozt; no tiene costos. refinery_consumption (una fila por campaña + subproceso + insumo) es consumo físico: consumption_total solo con reagent_name filtrado o agrupado (o insumos de la misma unit_name); nunca un total físico de insumos con unidades distintas ni un KPI de "consumo total" sin insumo; para "consumo por campaña/proceso/subproceso" agrupa por esa dimensión con breakdown o filtro por reagent_name, y para "composición de una campaña" usa donut/bar por reagent_name o subprocess_name dentro de un insumo o de una unidad; la jerarquía es process_name → subprocess_name → reagent_name (matrix o table con esas columnas); consumo por kg de carbón o por kg/ozt de Au usa las métricas qty_per_* (valor de campaña contado una vez). No existen costos ni consumo óptimo ML en V-Ai para refinería: no inventes métricas USD ni desviaciones vs ML.
- En Logística, el stock actual (Chala, CEVA, pendiente de OC, cobertura y valor) usa logistics_stock; el consumo de almacén por centro de costo o familia usa logistics_consumption; requerimientos y OC usan logistics_requirements.
- En Kardex, trjkar_guides ya trae lotes por guía, horas de tránsito y PERD/EXCE por guía; trjkar_lots es el detalle por movimiento (movement_type OPERATIVO/PERD/EXCE); trjkar_invoices trae la diferencia contra Concar por factura.
- En Activos Fijos, "activos de <período>" usa acquisition_date. Una foto de valor actual por área no lleva filtro de fecha salvo que se pida explícitamente adquisición, operación o baja. Presenta PEN y USD en widgets separados.
- En Logística, requerimientos usa req_date; compras u órdenes de compra usa po_date; entregas usa delivery_date. En Flota de mantenimiento, el período predeterminado usa req_date.
- Los valores nulos de dimensiones se muestran como "Sin dato"; los nulos numéricos se excluyen de los cálculos. Si la ausencia cambia la interpretación, incluye el conteo o detalle correspondiente.
- Cuando una fuente ofrezca explícitamente métricas PEN y USD, usa gráficos separados por defecto. Si el usuario pide expresamente ambas monedas en el mismo gráfico, puedes usar combo con ejes Y separados y las marcas solicitadas para cada moneda. No inventes una moneda que no exista en el catálogo de la fuente. Las comparaciones por sede, área, proveedor, responsable, placa, conductor, oficina, estado o cualquier otra dimensión válida no tienen restricciones adicionales.
- Interpreta "última semana", "últimos 7 días" o equivalentes como last_7_days; "últimos 30 días" como last_30_days; "esta semana" como current_week; "semana pasada/anterior" como previous_week; "este mes/mes actual" como current_month; "mes pasado/anterior" como previous_month; "este año/año actual/YTD" como year_to_date. Aplica ese período solo a la fuente y al campo temporal que semánticamente corresponda a lo pedido.
- Respeta estrictamente grain, rules, businessTerms, exclusiones y definición de cada métrica. No sumes campos que el catálogo marca como no sumables y no reconstruyas una métrica manualmente si ya existe una métrica declarada para ese concepto.
- Un concepto de negocio puede estar representado por una métrica filtrada y no por una columna física. Revisa siempre field, where, numerator, denominator y las reglas de la fuente antes de concluir que falta un dato. No inventes nombres de campos a partir del lenguaje del usuario.
- Si el catálogo declara una métrica que representa el concepto pedido, ese concepto está disponible aunque el campo físico tenga otro nombre o el cálculo dependa de valores de una dimensión.
- Para cada widget, usa únicamente métricas y campos pertenecientes a la misma fuente del widget. Antes de devolver el JSON, verifica que todos los ids existan exactamente en esa fuente y que la combinación type/metrics/dimension/dateField/columns cumpla las reglas anteriores.
- Antes de agregar algo a "unavailable", comprueba todas las métricas, campos, reglas y businessTerms de las fuentes candidatas. Si puede resolverse mediante una métrica declarada o una tabla de detalle, constrúyelo.
- Si algo pedido puede construirse razonablemente con los campos o métricas existentes, constrúyelo y no lo pongas en "unavailable". Solo marca "partial" cuando realmente falta información en el catálogo. Si nada es posible, status "unavailable", dashboard null y explica en "message".
- Detecta si la petición del usuario está en español, inglés o francés. "message", dashboard.title, dashboard.description, filter.label y widget.title deben quedar en ese mismo idioma. Nunca traduzcas ids técnicos. Si la petición mezcla idiomas, usa el idioma dominante.
- "message" se muestra al usuario: breve, claro y sin jerga técnica. Sin datos inventados.
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
                    additionalProperties: false,
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
                                additionalProperties: false,
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
                                    values: {
                                        type: ["array", "null"],
                                        items: { type: "string" },
                                        description: "Valores iniciales explícitos de select; null significa todos. En costos month_label selecciona meses iguales de todos los ejercicios.",
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
                                        description: "Fecha inicial inclusiva YYYY-MM-DD para períodos absolutos; null para presets.",
                                    },
                                    to: {
                                        type: [
                                            "string",
                                            "null",
                                        ],
                                        description: "Fecha final inclusiva YYYY-MM-DD para períodos absolutos; null para presets.",
                                    },
                                },
                                required: [
                                    "kind",
                                    "source",
                                    "field",
                                    "label",
                                    "values",
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
                                additionalProperties: false,
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
                                        description: `Grano temporal cuando hay dateField: ${VAI_BUCKETS.join(", ")}`,
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
                                    matrixColumns: {
                                        type: [
                                            "array",
                                            "null",
                                        ],
                                        items: {
                                            type: "string",
                                        },
                                        maxItems: 3,
                                        description: "Solo matrix: dimensiones categóricas de columnas en el orden pedido; null fuera de matrix o cuando solo hay columnas temporales.",
                                    },
                                    summaries: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            additionalProperties: false,
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
                                        description: "Segunda dimensión que divide una o varias métricas en series por categoría (line, area, bar, combo, table); con varias métricas conserva seriesTypes y seriesAxes de cada métrica base; null si no se pide.",
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
                                        description: "Solo bar: stack = barras apiladas, percent = apiladas al 100 %; null = agrupadas.",
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
                                        description: "Orden de las categorías del eje X; null = de mayor a menor por la primera métrica.",
                                    },
                                    sortMetric: {
                                        type: [
                                            "string",
                                            "null",
                                        ],
                                        description: "Id de la métrica que decide el orden cuando no es la primera; null en caso contrario.",
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
                                        description: "true acumula la serie a lo largo del eje temporal; null en caso contrario.",
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
                                    "matrixColumns",
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

const TRANSLATION_SCHEMA = {
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
                properties: { key: { type: "string" }, label: { type: "string" } },
                required: ["key", "label"],
            },
        },
        widgets: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                properties: { index: { type: "integer" }, title: { type: "string" } },
                required: ["index", "title"],
            },
        },
        sources: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                properties: { id: { type: "string" }, label: { type: "string" }, description: { type: "string" }, grain: { type: "string" } },
                required: ["id", "label", "description", "grain"],
            },
        },
        fields: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                properties: { source: { type: "string" }, id: { type: "string" }, label: { type: "string" }, description: { type: "string" } },
                required: ["source", "id", "label", "description"],
            },
        },
        metrics: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                properties: { source: { type: "string" }, id: { type: "string" }, label: { type: "string" }, description: { type: "string" } },
                required: ["source", "id", "label", "description"],
            },
        },
    },
    required: ["title", "description", "filters", "widgets", "sources", "fields", "metrics"],
};

const FOCUS_TEXT: Record<VaiFocus, string> = {
    auto: "Automático: elige la mezcla de widgets más útil.",
    kpis: "Prioriza KPIs y un resumen compacto (varios kpi y pocos gráficos).",
    trends: "Prioriza tendencias temporales (line con bucket adecuado).",
    comparisons: "Prioriza comparaciones por dimensión (bar, combo, rank, donut, scatter o line categórico cuando el usuario lo pida).",
    detail: "Prioriza tablas de detalle o resumen (table).",
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
    matrix: "matrix configurable (jerarquía de filas, jerarquía de columnas y una medida sumable)",
};

function visualInstructions(prompt: string) {
    const hints = promptRenderHints(prompt);
    const items: string[] = [];

    for (const hint of hints.renders) {
        items.push(`«${hint.term.join(" ")}» debe dibujarse como ${hint.render === "bar" ? "barras" : "línea"}`);
    }

    if (hints.mentionsBars &&
        hints.mentionsLines &&
        !hints.renders.length) {
        items.push("mezcla barras y líneas en un mismo gráfico (combo con seriesTypes)");
    }

    for (const family of hints.families) {
        if (family === "donut" ||
            family === "rank" ||
            family === "scatter" ||
            family === "area") {
            items.push(`pide un gráfico de tipo ${family}`);
        }
    }

    for (const item of hints.stack) {
        items.push(item.value === "percent"
            ? `barras apiladas al 100 % (stack percent) en el gráfico de «${item.context.join(" ")}»`
            : `barras apiladas (stack) en el gráfico de «${item.context.join(" ")}»`);
    }

    for (const item of hints.cumulative) {
        items.push(`valores acumulados en el tiempo (cumulative true) en el gráfico de «${item.context.join(" ")}»`);
    }

    for (const item of hints.sort) {
        items.push(`orden ${item.value} en el gráfico de «${item.context.join(" ")}»`);
    }

    for (const item of hints.bucket) {
        items.push(`grano temporal ${item.value} en el gráfico de «${item.context.join(" ")}»`);
    }

    for (const item of hints.breakdown) {
        items.push(`una serie por «${item.value.join(" ")}» (breakdown con esa dimensión) en el gráfico de «${item.context.join(" ")}»`);
    }

    return items.length
        ? items
        : "ninguna instrucción visual explícita; elige la mezcla más útil";
}

class VaiGenerationError extends Error {
    constructor(message: string, readonly detail?: string) {
        super(message);
    }
}

async function generateDashboardSpec(prompt: string, options: VaiGenerateOptions): Promise<{
    output: VaiModelOutput;
    candidates: string[];
    model: string;
    validation: VaiValidation;
}> {
    const apiKey = process.env.API_OPEN_AI?.trim();

    if (!apiKey)
        throw new VaiGenerationError("V-Ai no está configurado en este entorno.", "missing API_OPEN_AI");

    const candidates = selectCandidateSources(prompt, options.area);
    const ids = candidates.map((source) => source.id);
    const compactGeneration = candidates.length <= 3 &&
        prompt.length <= 600 &&
        options.charts.length <= 2;
    const maxOutputTokens = compactGeneration ? 10000 : 20000;

    const context = {
        currentDateLima: limaToday(),
        defaultHistoryStart: "2026-01-01",
        catalogIndex: VAI_SOURCES.filter((source) => source.enabled && (options.area === "auto" || source.area === options.area))
            .map((source) => ({
            id: source.id,
            name: source.name,
            area: source.area,
            description: source.description,
            explicitOnly: source.explicitOnly ?? false,
            detailed: candidates.includes(source),
        })),
        sources: candidates.map(sourceContext),
        visualCatalog: VAI_VISUAL_CATALOG,
        visualInstructions: visualInstructions(prompt),
        explicitVisualRequests: resolveVisualRequests(prompt, ids),
        preferences: {
            focus: FOCUS_TEXT[options.focus],
            preferredWidgets: options.charts.map((chart) => CHART_PREFERENCE_TEXT[chart]),
            areaRestriction: options.area,
            generationMode: compactGeneration ? "compacto: prioriza 4 a 6 widgets útiles y evita redundancias" : "normal",
        },
        request: prompt,
    };

    const deadline = Date.now() + OPENAI_TIMEOUT_MS;
    let feedback: string[] = [];
    let previous: VaiModelOutput | null = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
        const remaining = deadline - Date.now();

        if (remaining < 8000)
            break;

        const reasoningEffort = compactGeneration && attempt === 0 ? "low" : VAI_REASONING;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Math.min(remaining, attempt === 0 ? 100000 : remaining));
        let payload: unknown;

        try {
            const response = await fetch(OPENAI_URL, {
                method: "POST",
                cache: "no-store",
                signal: controller.signal,
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: VAI_OPENAI_MODEL,
                    store: false,
                    max_output_tokens: maxOutputTokens,
                    ...(/^(?:gpt-[56]|o[134])/.test(VAI_OPENAI_MODEL) ? { reasoning: { effort: reasoningEffort } } : {}),
                    input: [
                        {
                            role: "system",
                            content: [
                                {
                                    type: "input_text",
                                    text: SYSTEM_PROMPT,
                                },
                            ],
                        },
                        {
                            role: "user",
                            content: [
                                {
                                    type: "input_text",
                                    text: JSON.stringify({
                                        ...context,
                                        ...(attempt
                                            ? {
                                                repair: {
                                                    instruction: "Repara el diseño completo. No basta cambiar títulos; corrige ids, tipos de serie y ejes. Solo datos del catálogo.",
                                                    problems: feedback,
                                                    previousSpecification: previous,
                                                },
                                            }
                                            : {}),
                                    }),
                                },
                            ],
                        },
                    ],
                    text: {
                        format: {
                            type: "json_schema",
                            name: "vai_dashboard",
                            strict: true,
                            schema: OUTPUT_SCHEMA,
                        },
                    },
                }),
            });

            const bodyText = await response.text();

            if (!response.ok) {
                const message = response.status === 401 || response.status === 403
                    ? "La API de IA rechazó las credenciales o el acceso al modelo. Revisa la configuración de V-Ai."
                    : response.status === 429
                        ? "La API de IA alcanzó su límite de uso. Inténtalo nuevamente en unos minutos."
                        : response.status === 404
                            ? "El modelo configurado no está disponible para esta API. Revisa VAI_OPENAI_MODEL."
                            : "El servicio de IA devolvió un error. Inténtalo nuevamente.";

                throw new VaiGenerationError(message, `openai status=${response.status} model=${VAI_OPENAI_MODEL}`);
            }

            try {
                payload = JSON.parse(bodyText);
            }
            catch {
                throw new VaiGenerationError("La API de IA devolvió una respuesta que no es JSON.");
            }
        }
        catch (error) {
            if (error instanceof VaiGenerationError)
                throw error;

            const aborted = controller.signal.aborted;

            if (aborted && attempt === 0 && deadline - Date.now() > 15000) {
                feedback = ["La primera generación agotó su tiempo. Devuelve un diseño más compacto sin omitir el gráfico principal."];
                continue;
            }

            throw new VaiGenerationError(aborted
                ? "La generación agotó su tiempo. No se guardó un diseño incompleto."
                : "No se pudo contactar al servicio de IA.");
        }
        finally {
            clearTimeout(timer);
        }

        const record = payload as {
            status?: string;
            incomplete_details?: {
                reason?: string;
            };
            output?: unknown[];
        };

        if (record.status === "incomplete" || record.status === "failed") {
            feedback = [`Respuesta ${record.status}: ${record.incomplete_details?.reason ?? "sin diseño completo"}. Devuelve un diseño compacto válido.`];
            continue;
        }

        const text = extractOutputText(payload);
        let parsed: unknown = null;

        try {
            parsed = JSON.parse(text);
        }
        catch { }

        const output = coerceModelOutput(parsed);

        if (!output) {
            feedback = ["Falta una respuesta JSON completa conforme al esquema."];
            continue;
        }

        previous = output;

        const validation = validateModelOutput(output, prompt, ids);

        if (validation.issues?.length) {
            feedback = validation.issues;
            continue;
        }

        return {
            output,
            candidates: ids,
            model: VAI_OPENAI_MODEL,
            validation,
        };
    }

    throw new VaiGenerationError(
        `No se pudo construir un diseño que respete la solicitud. ${feedback.slice(0, 2).join(" ")}`,
        `visual contract not satisfied model=${VAI_OPENAI_MODEL}`,
    );
}

function extractOutputText(payload: unknown) {
    if (typeof payload !==
        "object" ||
        payload === null) {
        return "";
    }

    const record = payload as {
        output_text?: unknown;
        output?: unknown;
    };

    if (typeof record.output_text ===
        "string") {
        return record.output_text;
    }

    if (!Array.isArray(record.output)) {
        return "";
    }

    for (const block of record.output) {
        const content = (block as {
            content?: unknown;
        }).content;

        if (!Array.isArray(content)) {
            continue;
        }

        for (const part of content) {
            const item = part as {
                type?: unknown;
                text?: unknown;
            };

            if (item.type ===
                "output_text" &&
                typeof item.text ===
                    "string") {
                return item.text;
            }
        }
    }

    return "";
}

type VaiTranslationOutput = {
    title: string;
    description: string;
    filters: Array<{ key: string; label: string }>;
    widgets: Array<{ index: number; title: string }>;
    sources: Array<{ id: string; label: string; description: string; grain: string }>;
    fields: Array<{ source: string; id: string; label: string; description: string }>;
    metrics: Array<{ source: string; id: string; label: string; description: string }>;
};

function modeText(value: unknown, max: number) {
    return String(value ?? "")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max);
}

async function callStructuredJson(name: string, schema: unknown, systemPrompt: string, input: unknown, maxOutputTokens = 12000) {
    const apiKey = process.env.API_OPEN_AI?.trim();
    if (!apiKey)
        throw new VaiGenerationError("V-Ai no está configurado en este entorno.", "missing API_OPEN_AI");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    try {
        const response = await fetch(OPENAI_URL, {
            method: "POST",
            cache: "no-store",
            signal: controller.signal,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: VAI_OPENAI_MODEL,
                store: false,
                max_output_tokens: maxOutputTokens,
                ...(/^(?:gpt-[56]|o[134])/.test(VAI_OPENAI_MODEL) ? { reasoning: { effort: VAI_REASONING } } : {}),
                input: [
                    { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
                    { role: "user", content: [{ type: "input_text", text: JSON.stringify(input) }] },
                ],
                text: {
                    format: {
                        type: "json_schema",
                        name,
                        strict: true,
                        schema,
                    },
                },
            }),
        });

        const bodyText = await response.text();
        if (!response.ok) {
            const message = response.status === 401 || response.status === 403
                ? "La API de IA rechazó las credenciales o el acceso al modelo. Revisa la configuración de V-Ai."
                : response.status === 429
                    ? "La API de IA alcanzó su límite de uso. Inténtalo nuevamente en unos minutos."
                    : response.status === 404
                        ? "El modelo configurado no está disponible para esta API. Revisa VAI_OPENAI_MODEL."
                        : "El servicio de IA devolvió un error. Inténtalo nuevamente.";
            throw new VaiGenerationError(message, `openai status=${response.status} model=${VAI_OPENAI_MODEL}`);
        }

        let payload: unknown;
        try {
            payload = JSON.parse(bodyText);
        }
        catch {
            throw new VaiGenerationError("La API de IA devolvió una respuesta que no es JSON.");
        }

        const text = extractOutputText(payload);
        try {
            return JSON.parse(text) as unknown;
        }
        catch {
            throw new VaiGenerationError("La API de IA devolvió una especificación incompleta.");
        }
    }
    catch (error) {
        if (error instanceof VaiGenerationError)
            throw error;
        throw new VaiGenerationError(controller.signal.aborted
            ? "La operación de V-Ai agotó su tiempo. Inténtalo nuevamente."
            : "No se pudo contactar al servicio de IA.");
    }
    finally {
        clearTimeout(timer);
    }
}

function modeSpec(raw: unknown): VaiDashboardSpec {
    const parsed = parseStoredSpec(raw, "");
    if (!parsed.spec)
        throw new VaiGenerationError("La configuración actual del dashboard no es válida.", parsed.notes.join(" "));
    return parsed.spec;
}

async function translateDashboardSpec(spec: VaiDashboardSpec, targetLanguage: VaiLanguage) {
    const sourceSet = new Set(spec.sources);
    const sources = VAI_SOURCES.filter((source) => sourceSet.has(source.id));
    const languageName = targetLanguage === "en" ? "English" : targetLanguage === "fr" ? "French" : "Spanish";
    const systemPrompt = `Translate V-Ai dashboard presentation text to ${languageName}. Keep every technical id exactly unchanged. Never translate ids, SQL names, codes, acronyms, currencies, chemical symbols, asset codes, lot codes, guide numbers or proper brand names. Translate only human-readable labels, titles, descriptions and grain text. Preserve mining, accounting and BI meaning. Return every filter, widget, source, field and metric supplied exactly once; do not omit or add catalog items. Return only JSON matching the schema.`;
    const payload = await callStructuredJson("vai_translation", TRANSLATION_SCHEMA, systemPrompt, {
        target_language: targetLanguage,
        dashboard: {
            title: spec.title,
            description: spec.description,
            filters: spec.filters.map((filter) => ({ key: filterKey(filter), label: filter.label })),
            widgets: spec.widgets.map((widget, index) => ({ index, title: widget.title })),
        },
        catalog: sources.map((source) => ({
            id: source.id,
            label: source.name,
            description: source.description,
            grain: source.grain,
            fields: source.fields.map((field) => ({ id: field.id, label: field.label, description: field.description })),
            metrics: source.metrics.map((metric) => ({ id: metric.id, label: metric.label, description: metric.description })),
        })),
    }, 16000) as VaiTranslationOutput;

    const filterLabels = new Map((payload.filters ?? []).map((item) => [modeText(item.key, 160), modeText(item.label, 160)]));
    const widgetTitles = new Map((payload.widgets ?? []).map((item) => [Number(item.index), modeText(item.title, 160)]));
    const allowedSources = new Set(sources.map((source) => source.id));
    const sourceLabels: Record<string, string> = {};
    const sourceDescriptions: Record<string, string> = {};
    const sourceGrains: Record<string, string> = {};
    const fieldLabels: Record<string, string> = {};
    const fieldDescriptions: Record<string, string> = {};
    const metricLabels: Record<string, string> = {};
    const metricDescriptions: Record<string, string> = {};

    for (const item of payload.sources ?? []) {
        const id = modeText(item.id, 80);
        if (!allowedSources.has(id))
            continue;
        sourceLabels[id] = modeText(item.label, 160);
        sourceDescriptions[id] = modeText(item.description, 1200);
        sourceGrains[id] = modeText(item.grain, 300);
    }

    for (const item of payload.fields ?? []) {
        const source = sources.find((candidate) => candidate.id === modeText(item.source, 80));
        const id = modeText(item.id, 80);
        if (!source?.fields.some((field) => field.id === id))
            continue;
        const key = `${source.id}:${id}`;
        fieldLabels[key] = modeText(item.label, 160);
        fieldDescriptions[key] = modeText(item.description, 1200);
    }

    for (const item of payload.metrics ?? []) {
        const source = sources.find((candidate) => candidate.id === modeText(item.source, 80));
        const id = modeText(item.id, 80);
        if (!source?.metrics.some((metric) => metric.id === id))
            continue;
        const key = `${source.id}:${id}`;
        metricLabels[key] = modeText(item.label, 160);
        metricDescriptions[key] = modeText(item.description, 1200);
    }

    return {
        ...spec,
        language: targetLanguage,
        locale: targetLanguage === "es" ? null : {
            sourceLabels,
            sourceDescriptions,
            sourceGrains,
            fieldLabels,
            fieldDescriptions,
            metricLabels,
            metricDescriptions,
        },
        title: modeText(payload.title, 120) || spec.title,
        description: modeText(payload.description, 1200) || spec.description,
        filters: spec.filters.map((filter) => ({ ...filter, label: filterLabels.get(filterKey(filter)) || filter.label })),
        widgets: spec.widgets.map((widget, index) => ({ ...widget, title: widgetTitles.get(index) || widget.title })),
    } satisfies VaiDashboardSpec;
}

async function editDashboardWidget(spec: VaiDashboardSpec, widgetIndex: number, instruction: string, language: VaiLanguage) {
    const current = spec.widgets[widgetIndex];
    if (!current)
        throw new VaiGenerationError("El gráfico que intentas editar ya no existe.");

    const currentSources = spec.sources
        .map((id) => VAI_SOURCES.find((source) => source.id === id))
        .filter((source): source is VaiSource => Boolean(source));
    const inferred = selectCandidateSources(`${instruction} ${current.title}`, "auto");
    const candidates = [...new Map([...currentSources, ...inferred].map((source) => [source.id, source])).values()].slice(0, MAX_CANDIDATES);
    const ids = candidates.map((source) => source.id);
    const languageName = language === "en" ? "English" : language === "fr" ? "French" : "Spanish";
    const systemPrompt = `${SYSTEM_PROMPT}\n\nEDIT MODE: modify exactly one visual. Return dashboard.filters as an empty array and dashboard.widgets with exactly one widget: the replacement for current_widget. Follow the user's edit_instruction even when it changes chart type, metrics, dimension, breakdown or source, but use only the supplied catalog. Do not modify any other dashboard element. Keep the widget title in ${languageName}.`;
    const payload = await callStructuredJson("vai_widget_edit", OUTPUT_SCHEMA, systemPrompt, {
        edit_instruction: instruction,
        language,
        current_widget: current,
        current_dashboard: {
            title: spec.title,
            description: spec.description,
            sources: spec.sources,
        },
        visual_catalog: VAI_VISUAL_CATALOG,
        catalog: candidates.map(sourceContext),
    }, 9000);
    const output = coerceModelOutput(payload);
    const raw = output?.dashboard?.widgets?.[0] as VaiRawWidget | undefined;
    if (!raw)
        throw new VaiGenerationError(output?.message || "No se pudo interpretar el cambio solicitado para ese gráfico.");

    const validation = validateWidgetEdit(raw, instruction, ids);
    if (!validation.widget || validation.issues.length)
        throw new VaiGenerationError(
            `No se pudo aplicar el cambio sin romper el contrato del gráfico. ${validation.issues.slice(0, 2).join(" ")}`,
            validation.notes.join(" "),
        );

    const widgets = spec.widgets.map((widget, index) => index === widgetIndex ? validation.widget! : widget);
    const sources = [...new Set(widgets.map((widget) => widget.source))];
    if (sources.length > VAI_MAX_SOURCES)
        throw new VaiGenerationError(`Ese cambio llevaría el dashboard a más de ${VAI_MAX_SOURCES} fuentes. Cambia primero otro gráfico o usa una fuente ya presente.`);

    return {
        spec: {
            ...spec,
            language,
            widgets,
            sources,
            filters: spec.filters.filter((filter) => sources.includes(filter.source)),
        } satisfies VaiDashboardSpec,
        notes: validation.notes,
    };
}

const FOCUS: VaiFocus[] = [
    "auto",
    "kpis",
    "trends",
    "comparisons",
    "detail",
];

const CHARTS: readonly VaiChartPreference[] = VAI_WIDGET_TYPES;

export async function POST(req: Request) {
    const session = await sessionWithScope(req, "vai");

    if (!session) {
        return NextResponse.json({
            ok: false,
            error: "No autorizado",
        }, {
            status: 401,
        });
    }

    const body = (await req
        .json()
        .catch(() => ({}))) as {
        mode?: unknown;
        prompt?: unknown;
        area?: unknown;
        focus?: unknown;
        charts?: unknown;
        spec?: unknown;
        widget_index?: unknown;
        instruction?: unknown;
        target_language?: unknown;
        language?: unknown;
    };

    const mode = String(body.mode ?? "generate").trim().toLowerCase();

    if (mode === "translate" || mode === "edit_widget") {
        try {
            const currentSpec = modeSpec(body.spec);

            if (mode === "translate") {
                const target = String(body.target_language ?? "").trim().toLowerCase() as VaiLanguage;
                if (!["es", "en", "fr"].includes(target)) {
                    return NextResponse.json({ ok: false, error: "target_language debe ser es, en o fr." }, { status: 400 });
                }
                const spec = await translateDashboardSpec(currentSpec, target);
                return NextResponse.json({ ok: true, mode, spec, language: target, model: VAI_OPENAI_MODEL });
            }

            const widgetIndex = Number(body.widget_index);
            const instruction = String(body.instruction ?? "").replace(/[ \t]+/g, " ").trim();
            const language = ["es", "en", "fr"].includes(String(body.language ?? "").trim().toLowerCase())
                ? String(body.language).trim().toLowerCase() as VaiLanguage
                : currentSpec.language;

            if (!Number.isInteger(widgetIndex) || widgetIndex < 0 || widgetIndex >= currentSpec.widgets.length) {
                return NextResponse.json({ ok: false, error: "widget_index inválido." }, { status: 400 });
            }

            if (instruction.length < 3 || instruction.length > VAI_PROMPT_MAX) {
                return NextResponse.json({ ok: false, error: `La instrucción del gráfico debe tener entre 3 y ${VAI_PROMPT_MAX} caracteres.` }, { status: 400 });
            }

            const edited = await editDashboardWidget(currentSpec, widgetIndex, instruction, language);

            return NextResponse.json({
                ok: true,
                mode,
                spec: edited.spec,
                notes: edited.notes,
                language,
                model: VAI_OPENAI_MODEL,
            });
        }
        catch (error) {
            if (error instanceof VaiGenerationError) {
                console.error(`V-Ai ${mode}:`, error.detail ?? error.message);
                return NextResponse.json({
                    ok: false,
                    error: error.message,
                }, {
                    status: 502,
                });
            }

            console.error(`V-Ai ${mode}:`, error);

            return NextResponse.json({
                ok: false,
                error: "No se pudo completar el cambio solicitado.",
            }, {
                status: 500,
            });
        }
    }

    if (mode !== "generate") {
        return NextResponse.json({
            ok: false,
            error: "mode inválido.",
        }, {
            status: 400,
        });
    }

    const prompt = String(body.prompt ?? "")
        .replace(/[ \t]+/g, " ")
        .trim();

    if (prompt.length < 8) {
        return NextResponse.json({
            ok: false,
            error: "Describe con más detalle el dashboard que quieres.",
        }, {
            status: 400,
        });
    }

    if (prompt.length > VAI_PROMPT_MAX) {
        return NextResponse.json({
            ok: false,
            error: `El prompt supera los ${VAI_PROMPT_MAX} caracteres.`,
        }, {
            status: 400,
        });
    }

    const areaRaw = String(body.area ?? "auto");

    const area: VaiArea | "auto" = VAI_AREAS.some((item) => item.id === areaRaw)
        ? areaRaw as VaiArea
        : "auto";

    const focusRaw = String(body.focus ?? "auto") as VaiFocus;

    const focus = FOCUS.includes(focusRaw)
        ? focusRaw
        : "auto";

    const charts = Array.isArray(body.charts)
        ? body.charts
            .map(String)
            .filter((c): c is VaiChartPreference => CHARTS.includes(c as VaiChartPreference))
        : [];

    const promptIntent = normalizeVaiPrompt(prompt);

    const mineralContext =
        /\b(?:mineral|minero|mineros|lote|lotes|acopio)\b/.test(promptIntent);

    const pendingMineralFlow =
        mineralContext &&
        /\b(?:sin|pendiente|pendientes|falta|faltan|no)\s+(?:de\s+)?(?:pago|pagos|pagar|pagado|pagados|factura|facturas|facturado|facturados|valorizacion|valorizar|valorizado|valorizados)\b/.test(promptIntent);

    const mineralFinanceIntent =
        mineralContext &&
        /\b(?:pago|pagos|pagado|pagados|desembolso|desembolsos|factura|facturas|facturado|facturados|compra|compras|comprado|comprados|contable|contabilidad|contabilizado|contabilizados|provision|provisiones|proveedor|proveedores|usd|tms)\b/.test(promptIntent);

    const domainSpecificCostIntent =
        /\b(?:combustible|combustibles|galon|galones|flota|vehiculo|vehiculos|refineria|reactivo|reactivos|planta|kardex|trjkar|logistica|almacen|stock|activo|activos|depreciacion)\b/.test(promptIntent);

    const corporateFinanceIntent =
        !domainSpecificCostIntent &&
        (
            /\b(?:costo|costos|gasto|gastos|presupuesto|ppto|opex|macroproceso|macroprocesos|ceco|cecos|dynacor|contabilidad|contable|finanzas)\b/.test(promptIntent) ||
            /\bcentros? de costo\b/.test(promptIntent) ||
            /\b(?:real|reales)\b.*\b(?:presupuesto|ppto)\b|\b(?:presupuesto|ppto)\b.*\b(?:real|reales)\b/.test(promptIntent)
        );

    const generationArea: VaiArea | "auto" =
        area !== "auto"
            ? area
            : pendingMineralFlow
                ? "traceability"
                : mineralFinanceIntent || corporateFinanceIntent
                    ? "finance"
                    : "auto";

    const comparisonIntent =
        /\b(?:vs|versus|contra|comparar|compara|comparacion|diferencia|diferencias)\b/.test(promptIntent);

    const generationFocus: VaiFocus =
        focus === "auto" && comparisonIntent
            ? "comparisons"
            : focus;

    const mineralPaymentByLotComparison =
        mineralContext &&
        /\b(?:pago|pagos|pagado|pagados|desembolso|desembolsos)\b/.test(promptIntent) &&
        /\b(?:lote|lotes)\b/.test(promptIntent);

    const generationPrompt = mineralPaymentByLotComparison
        ? `${prompt}\n\nReglas: por lote usa finance_mineral_purchases con el universo exacto de traceability_get y lot_usd sin recalcular. Referencia visible CONCAR. lot siempre junto a entry_date, sin contador de filas. entry_date es fecha principal; pay_date identifica pago del lote y valuation_date su valorización. Pago efectivo: finance_mineral_payments.payment_usd_total de conta_payments, con payment_date como fecha principal. Son universos separados, sin cruce por lote. doc_type y payment_document_type son filtros locales por widget de pagos.`
        : prompt;

    try {
        const {
            output,
            candidates,
            model,
            validation,
        } = await generateDashboardSpec(generationPrompt, {
            area: generationArea,
            focus: generationFocus,
            charts,
        });

        const {
            spec,
            notes,
        } = validation;

        if (!spec) {
            const unavailable = [
                ...new Set([
                    ...output.unavailable,
                    ...notes,
                ]),
            ];

            return NextResponse.json({
                ok: true,
                status: "unavailable",
                message:
                    output.message ||
                    "Actualmente no existe información disponible en V-Ai para construir ese dashboard.",
                unavailable,
                spec: null,
                candidates,
            });
        }

        const unavailable = [...new Set(notes)];

        const status = unavailable.length
            ? "partial"
            : "ok";

        return NextResponse.json({
            ok: true,
            status,
            message: unavailable.length
                ? output.message
                : "",
            unavailable,
            spec: {
                ...spec,
                language: detectVaiLanguage(prompt),
                locale: null,
            },
            language: detectVaiLanguage(prompt),
            candidates,
            model,
        });
    }
    catch (error) {
        if (error instanceof VaiGenerationError) {
            console.error(
                "V-Ai generate:",
                error.detail ?? error.message
            );

            return NextResponse.json({
                ok: false,
                error: error.message,
            }, {
                status: 502,
            });
        }

        console.error("V-Ai generate:", error);

        return NextResponse.json({
            ok: false,
            error: "No se pudo generar el dashboard. Inténtalo de nuevo.",
        }, {
            status: 500,
        });
    }
}