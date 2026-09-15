// src/lib/vai.ts
//
// Contratos, catálogo, fechas, validación, motor, persistencia y exportación
// de V-Ai. La integración privada con OpenAI permanece en la ruta API.

import type { jsPDF } from "jspdf";
import { apiGet, apiPost } from "./apiClient";
import { kardexPeriodKey } from "./trjKardex";

export type VaiFocus = "auto" | "kpis" | "trends" | "comparisons" | "detail";
export type VaiChartPreference = "line" | "bar" | "kpi" | "table";

// ── CATALOG ─────────────────────────────────────────────────────────

//
// Catálogo controlado de fuentes analíticas para V-Ai. Solo contiene metadatos
// (identificadores, descripciones, campos, métricas permitidas y reglas); nunca
// datos reales. Es lo único que se comparte con el modelo y lo único que el
// renderer acepta como origen: cada `endpoint` es un GET de consulta ya
// existente en el backend y el modelo jamás lo escribe, solo elige un `id`.
//
// Cada fuente declara su granularidad y reglas de agregación. Un importe que
// pertenece a una cabecera y se repite por fila de detalle se expone como
// campo (para tablas) pero no como métrica sumable.

export type VaiArea =
  | "kardex"
  | "traceability"
  | "fixassets"
  | "planta"
  | "refinery"
  | "logistics"
  | "fleet";

export const VAI_AREAS: Array<{ id: VaiArea; label: string }> = [
  { id: "kardex", label: "Kardex TRJ" },
  { id: "traceability", label: "Trazabilidad" },
  { id: "fixassets", label: "Activos Fijos" },
  { id: "planta", label: "Planta" },
  { id: "refinery", label: "Refinería" },
  { id: "logistics", label: "Logística" },
  { id: "fleet", label: "Flota" },
];

export type VaiFieldType = "text" | "number" | "date" | "datetime";

/** Formato de presentación; decide decimales, sufijo y moneda. */
export type VaiFormat =
  | "integer"
  | "decimal"
  | "usd"
  | "pen"
  | "percent" // ya expresado en % (12.5 → 12,50 %)
  | "fraction" // 0..1 (0.125 → 12,50 %)
  | "tmh"
  | "tms"
  | "kg"
  | "oz"
  | "hours"
  | "days"
  | "km"
  | "gal"
  | "km_per_gal"
  | "l_100km"
  | "pen_per_km"
  | "pen_per_gal"
  | "usd_per_gal"
  | "grade_oztc"
  | "grade_gt"
  | "date"
  | "text";

/**
 * `dimension`: agrupable en gráficos y filtros de selección.
 * `date`: eje temporal y filtro de rango.
 * `measure`: numérico; solo se agrega mediante las métricas declaradas.
 * `attribute`: texto identificador o descriptivo, solo para tablas.
 */
export type VaiFieldRole = "dimension" | "date" | "measure" | "attribute";

export type VaiField = {
  id: string;
  label: string;
  type: VaiFieldType;
  role: VaiFieldRole;
  format?: VaiFormat;
  description: string;
  dateFilterKeywords?: string[];
};

export type VaiConditionOp =
  | "eq"
  | "ne"
  | "in"
  | "not_in"
  | "empty"
  | "not_empty"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "ends_with";

export type VaiCondition = {
  field: string;
  op: VaiConditionOp;
  value?: string | number | string[];
};

export type VaiAgg =
  | "sum"
  | "avg"
  | "count"
  | "count_distinct"
  | "min"
  | "max"
  | "sum_distinct" // suma `field` una vez por `distinctField`
  | "sum_per_distinct" // Σ field / cantidad distinta de `distinctField`
  | "count_per_distinct" // filas / cantidad distinta de `distinctField`
  | "sum_diff" // Σ field − Σ field2
  | "ratio" // Σ numerator / Σ denominator
  | "diff_pct" // (Σ numerator − Σ denominator) / Σ numerator × 100
  | "weighted_avg" // Σ(field × weight) / Σ weight
  | "avg_hours_diff" // promedio de horas entre `field` y `field2`
  | "avg_days_diff"; // promedio de días calendario entre `field` y `field2`

export type VaiMetric = {
  id: string;
  label: string;
  description: string;
  agg: VaiAgg;
  format: VaiFormat;
  field?: string;
  field2?: string;
  distinctField?: string;
  numerator?: string;
  denominator?: string;
  /** Factor constante aplicado después de una razón entre sumas. */
  multiplier?: number;
  weight?: string;
  /** Condiciones fijas que las filas deben cumplir antes de agregar. */
  where?: VaiCondition[];
  /** Al menos una de estas condiciones debe cumplirse. */
  whereAny?: VaiCondition[];
};

export type VaiRelation = {
  field: string;
  source: string;
  targetField: string;
  description: string;
};

export type VaiSource = {
  id: string;
  name: string;
  area: VaiArea;
  description: string;
  /** GET de consulta existente en el backend; único origen de datos aceptado. */
  endpoint: string;
  sqlView: string;
  /** Qué representa una fila. */
  grain: string;
  temporalMode?: "event" | "snapshot";
  /** Fecha usada cuando el usuario pide el flujo sin indicar período. */
  defaultDateField?: string;
  fields: VaiField[];
  metrics: VaiMetric[];
  /** Filtros fijos aplicados siempre antes de cualquier cálculo. */
  exclusions?: VaiCondition[];
  /** Reglas de negocio que el modelo debe respetar al diseñar. */
  rules: string[];
  /** Relaciones documentadas; V-Ai v1 no cruza fuentes, solo las informa. */
  relations?: VaiRelation[];
  /** Términos adicionales para la preselección local. */
  keywords: string[];
  /** Disponibilidad para V-Ai. */
  enabled: boolean;
  /** Solo entra al contexto detallado cuando el prompt menciona uno de sus términos propios. */
  explicitOnly?: boolean;
  /** Preparado para permisos: scopes de portal que podrán ver esta fuente. */
  access: { scopes: string[] };
};

const f = (
  id: string,
  label: string,
  role: VaiFieldRole,
  description: string,
  type: VaiFieldType = role === "date" ? "date" : role === "measure" ? "number" : "text",
  format?: VaiFormat,
  dateFilterKeywords?: string[],
): VaiField => ({
  id,
  label,
  role,
  type,
  description,
  format,
  ...(dateFilterKeywords?.length ? { dateFilterKeywords } : {}),
});

const m = (
  id: string,
  label: string,
  description: string,
  agg: VaiAgg,
  format: VaiFormat,
  extra: Partial<Omit<VaiMetric, "id" | "label" | "description" | "agg" | "format">> = {},
): VaiMetric => ({ id, label, description, agg, format, ...extra });

const OPERATIONAL_LOT: VaiCondition = { field: "lot_corr", op: "not_in", value: ["PERD", "EXCE"] };

const fleetFuelFields = (): VaiField[] => [
  f("operation_number", "Operación", "attribute", "Número de operación del vale."),
  f("item", "Ítem", "attribute", "Número de ítem del vale cuando la operación es numérica.", "number", "integer"),
  f("petro_plus_unique_number", "Identificador Petroperú", "attribute", "Identificador único entregado por la fuente Petroperú."),
  f("dispatch_note", "Nota de despacho", "attribute", "Nota de despacho del abastecimiento."),
  f("date_cons", "Fecha de abastecimiento", "date", "Fecha del vale de combustible.", "date", "date", ["abastecimiento", "consumo", "vale", "tanqueo"]),
  f("full_date_invoice", "Fecha y hora de abastecimiento", "attribute", "Marca de fecha y hora del vale.", "datetime", "text"),
  f("plate", "Placa", "dimension", "Placa normalizada sin guiones."),
  f("driver_name", "Conductor", "dimension", "Conductor informado en el vale."),
  f("dni", "DNI conductor", "attribute", "DNI informado para el conductor."),
  f("type_fuel", "Combustible", "dimension", "Producto abastecido."),
  f("unit", "Unidad", "dimension", "Unidad de medida informada por la fuente."),
  f("unit_price", "Precio unitario original", "measure", "Precio unitario en la moneda original del vale.", "number", "decimal"),
  f("qty", "Galones abastecidos", "measure", "Cantidad abastecida en galones.", "number", "gal"),
  f("price_usd", "Total original", "attribute", "Alias heredado de total; el nombre técnico no acredita moneda USD.", "number", "decimal"),
  f("currency_original", "Moneda original", "dimension", "Texto de moneda recibido de la fuente."),
  f("currency_code", "Moneda normalizada", "dimension", "PEN, USD o vacío cuando no se reconoce."),
  f("cost_pen", "Costo PEN", "measure", "Total del vale solo cuando la moneda se reconoce como PEN.", "number", "pen"),
  f("cost_usd", "Costo USD", "measure", "Total del vale solo cuando la moneda se reconoce como USD.", "number", "usd"),
  f("province", "Provincia", "dimension", "Provincia del abastecimiento."),
  f("gas_station", "Grifo", "dimension", "Estación de servicio."),
  f("cost_center", "Centro de costo", "dimension", "Centro de costo informado en el vale."),
  f("group_name", "Sede", "dimension", "Sede derivada del centro de costo; usa OTROS cuando queda vacía."),
  f("brand", "Marca", "dimension", "Marca de ficha técnica; GALONERA u OTROS para esas unidades especiales."),
  f("model", "Modelo", "dimension", "Modelo de ficha técnica; GALONERA u OTROS para esas unidades especiales."),
  f("tank_capacity", "Capacidad de tanque", "attribute", "Capacidad vigente de ficha técnica en galones; se repite por vale y no se suma.", "number", "gal"),
  f("autonomia_km", "Autonomía de ficha", "attribute", "Autonomía vigente de ficha técnica en kilómetros; se repite por vale.", "number", "km"),
  f("l_100km_ref", "Referencia l/100 km", "attribute", "Consumo de referencia vigente de ficha técnica; se repite por vale.", "number", "l_100km"),
  f("factor_eff", "Factor de eficiencia", "attribute", "Factor vigente de ficha técnica; no modifica la capacidad del tanque.", "number", "decimal"),
  f("is_tank_anomaly", "Tanqueo anómalo", "dimension", "Verdadero cuando un vale supera la capacidad aplicable."),
  f("excess_gal", "Exceso sobre tanque", "measure", "Galones por encima de la capacidad, calculados por vale.", "number", "gal"),
  f("excess_pen", "Exceso PEN", "measure", "Costo del exceso cuando la moneda del vale es PEN.", "number", "pen"),
  f("excess_usd", "Exceso USD", "measure", "Costo del exceso cuando la moneda del vale es USD.", "number", "usd"),
];

const fleetFuelMetrics = (): VaiMetric[] => [
  m("refuel_count", "Abastecimientos", "Número de vales de combustible.", "count", "integer"),
  m("vehicles_count", "Placas abastecidas", "Placas distintas con abastecimiento.", "count_distinct", "integer", { field: "plate" }),
  m("qty_total", "Galones abastecidos", "Suma de galones de los vales.", "sum", "gal", { field: "qty" }),
  m("cost_pen_known", "Costo identificado PEN", "Suma de vales reconocidos como PEN; no convierte otras monedas.", "sum", "pen", { field: "cost_pen" }),
  m("cost_usd_known", "Costo identificado USD", "Suma de vales reconocidos como USD; no convierte otras monedas.", "sum", "usd", { field: "cost_usd" }),
  m("avg_qty_per_vehicle", "Consumo promedio por vehículo", "Galones abastecidos divididos entre placas distintas, incluidas galoneras y otros.", "sum_per_distinct", "gal", { field: "qty", distinctField: "plate" }),
  m("avg_cost_pen_per_vehicle", "Costo PEN promedio por vehículo", "Costo PEN identificado dividido entre placas distintas con vales PEN.", "sum_per_distinct", "pen", { field: "cost_pen", distinctField: "plate", where: [{ field: "currency_code", op: "eq", value: "PEN" }] }),
  m("avg_cost_usd_per_vehicle", "Costo USD promedio por vehículo", "Costo USD identificado dividido entre placas distintas con vales USD.", "sum_per_distinct", "usd", { field: "cost_usd", distinctField: "plate", where: [{ field: "currency_code", op: "eq", value: "USD" }] }),
  m("avg_cost_pen_per_gal", "Costo promedio por galón PEN", "Σ costo PEN / Σ galones de vales PEN.", "ratio", "pen_per_gal", { numerator: "cost_pen", denominator: "qty", where: [{ field: "currency_code", op: "eq", value: "PEN" }] }),
  m("avg_cost_usd_per_gal", "Costo promedio por galón USD", "Σ costo USD / Σ galones de vales USD.", "ratio", "usd_per_gal", { numerator: "cost_usd", denominator: "qty", where: [{ field: "currency_code", op: "eq", value: "USD" }] }),
  m("anomaly_count", "Tanqueos anómalos", "Vales cuyo abastecimiento supera la capacidad aplicable.", "count", "integer", { where: [{ field: "excess_gal", op: "gt", value: 0 }] }),
  m("excess_gal_total", "Exceso sobre tanque", "Suma del exceso calculado por vale.", "sum", "gal", { field: "excess_gal" }),
  m("excess_pen_known", "Exceso identificado PEN", "Costo del exceso de vales reconocidos como PEN.", "sum", "pen", { field: "excess_pen" }),
  m("excess_usd_known", "Exceso identificado USD", "Costo del exceso de vales reconocidos como USD.", "sum", "usd", { field: "excess_usd" }),
];

const fleetFuelSummaryFields = (): VaiField[] => [
  f("period_start", "Inicio del período", "date", "Día del registro o primer día del mes, según la granularidad de la fuente.", "date", "date", ["período", "periodo", "día", "dia", "mes", "consumo", "recorrido", "abastecimiento"]),
  f("period_label", "Período", "dimension", "Período YYYY-MM entregado por el endpoint."),
  f("first_date", "Primera fecha", "attribute", "Primera fecha incluida en la fila agregada.", "date", "date"),
  f("last_date", "Última fecha", "attribute", "Última fecha incluida en la fila agregada.", "date", "date"),
  f("plate", "Placa", "dimension", "Placa normalizada sin guiones."),
  f("group_name", "Sede", "dimension", "Sede derivada de las fuentes de flota."),
  f("brand", "Marca", "dimension", "Marca de ficha técnica o clasificación de unidad especial."),
  f("model", "Modelo", "dimension", "Modelo de ficha técnica o clasificación de unidad especial."),
  f("is_vehicle", "Vehículo con ficha", "dimension", "Indica si la fila puede producir métricas de eficiencia."),
  f("tank_capacity", "Capacidad de tanque", "attribute", "Capacidad vigente en galones; no se suma entre períodos.", "number", "gal"),
  f("autonomia_km", "Autonomía de ficha", "attribute", "Autonomía vigente de ficha técnica.", "number", "km"),
  f("factor_eff", "Factor configurado", "attribute", "Factor vigente configurado para la unidad.", "number", "decimal"),
  f("factor_applied", "Factor aplicado", "attribute", "Uno cuando apply_factor=0; factor configurado cuando apply_factor=1.", "number", "decimal"),
  f("autonomia_reference_km", "Autonomía de referencia", "attribute", "Autonomía de ficha multiplicada por el factor aplicado; el valor de fila no se suma ni promedia directamente.", "number", "km"),
  f("autonomia_real_km", "Autonomía real", "attribute", "Autonomía calculada con recorrido, tanque y galones del período; se consolida solo mediante su métrica ponderada.", "number", "km"),
  f("days_with_data", "Días con datos", "measure", "Días incluidos en la fila.", "number", "integer"),
  f("days_with_gps", "Días con GPS", "measure", "Días con recorrido GPS positivo.", "number", "integer"),
  f("days_with_fuel", "Días con combustible", "measure", "Días con combustible positivo.", "number", "integer"),
  f("days_outside_ratio_scope", "Días fuera del cruce", "measure", "Días con combustible agregados fuera del alcance heredado de dist-cons-rat.", "number", "integer"),
  f("odometer_km", "Recorrido GPS", "measure", "Suma del recorrido diario GPS; no es un odómetro acumulado.", "number", "km"),
  f("km_per_active_day", "Kilómetros por día con GPS", "attribute", "Recorrido dividido entre días con GPS; se recalcula mediante su métrica.", "number", "km"),
  f("qty", "Galones abastecidos", "measure", "Galones agregados del período.", "number", "gal"),
  f("equivalent_tank_fills", "Tanques equivalentes", "attribute", "Galones divididos entre capacidad para vehículos con ficha; el valor de fila no se consolida.", "number", "decimal"),
  f("cost_pen", "Costo PEN completo", "measure", "Costo PEN solo cuando todos los vales de la fila son PEN y tienen total.", "number", "pen"),
  f("cost_pen_known", "Costo identificado PEN", "measure", "Subtotal de importes reconocidos como PEN.", "number", "pen"),
  f("cost_usd_known", "Costo identificado USD", "measure", "Subtotal de importes reconocidos como USD.", "number", "usd"),
  f("unit_price_pen", "Precio unitario PEN", "attribute", "Costo PEN completo dividido entre galones; el ratio de fila no se promedia.", "number", "pen_per_gal"),
  f("cost_per_km_pen", "Costo por km PEN", "attribute", "Costo PEN completo dividido entre recorrido GPS; se consolida mediante su métrica de razón entre sumas.", "number", "pen_per_km"),
  f("l_100km_real", "Consumo real", "attribute", "Litros consumidos por cada 100 km; se consolida mediante su métrica de razón entre sumas.", "number", "l_100km"),
  f("l_100km_reference", "Consumo de referencia", "attribute", "Referencia ponderada por kilómetros y ajustada por factor; se consolida mediante su métrica.", "number", "l_100km"),
  f("deviation_pct", "Desviación de consumo", "attribute", "Diferencia relativa entre consumo real y referencia; el ratio de fila no se suma ni promedia.", "number", "fraction"),
  f("reference_weight_km", "Km con referencia", "measure", "Kilómetros que cuentan para la referencia ponderada.", "number", "km"),
  f("reference_weighted_sum", "Suma ponderada de referencia", "measure", "Base técnica para recalcular l/100 km de referencia.", "number", "decimal"),
  f("theoretical_gal", "Galones teóricos", "measure", "Consumo teórico calculado desde recorrido, capacidad y autonomía de referencia.", "number", "gal"),
  f("theoretical_cost_pen", "Costo teórico PEN", "measure", "Costo teórico cuando existe precio PEN verificable.", "number", "pen"),
  f("savings_signed_pen", "Desviación estimada PEN", "measure", "Diferencia estimada contra ficha técnica; puede ser positiva o negativa.", "number", "pen"),
  f("potential_savings_pen", "Ahorro potencial PEN", "measure", "Parte positiva de la desviación estimada; no es ahorro realizado.", "number", "pen"),
  f("savings_pct", "Potencial estimado %", "attribute", "Diferencia relativa frente al consumo teórico; el ratio de fila no se suma ni promedia.", "number", "fraction"),
  f("refuel_count", "Abastecimientos", "measure", "Cantidad de vales incluidos.", "number", "integer"),
  f("anomaly_count", "Tanqueos anómalos", "measure", "Vales sobre capacidad incluidos.", "number", "integer"),
  f("excess_gal", "Exceso sobre tanque", "measure", "Exceso agregado, calculado primero por vale.", "number", "gal"),
  f("excess_pen", "Exceso PEN completo", "measure", "Costo del exceso cuando todos los excesos tienen precio PEN verificable.", "number", "pen"),
  f("non_pen_or_unpriced_count", "Vales fuera de total PEN", "measure", "Vales que impiden considerar completo el costo PEN.", "number", "integer"),
  f("unknown_currency_count", "Vales con moneda desconocida", "measure", "Vales cuya moneda no pudo normalizarse.", "number", "integer"),
  f("unpriced_anomaly_count", "Anomalías sin precio PEN", "measure", "Anomalías que impiden considerar completo el exceso PEN.", "number", "integer"),
  f("status_name", "Estado técnico no oficial", "attribute", "Clasificación técnica del endpoint basada en umbrales no oficializados; solo para detalle explícito."),
];

const fleetFuelSummaryMetrics = (): VaiMetric[] => [
  m("rows_count", "Unidad-período", "Número de filas agregadas por placa, sede y período.", "count", "integer"),
  m("vehicles_count", "Placas", "Placas distintas incluidas.", "count_distinct", "integer", { field: "plate" }),
  m("vehicle_days", "Vehículo-días con datos", "Suma de días con datos entre placas.", "sum", "integer", { field: "days_with_data" }),
  m("gps_vehicle_days", "Vehículo-días con GPS", "Suma de días con recorrido entre placas.", "sum", "integer", { field: "days_with_gps" }),
  m("fuel_vehicle_days", "Vehículo-días con combustible", "Suma de días con abastecimiento entre placas.", "sum", "integer", { field: "days_with_fuel" }),
  m("outside_scope_days", "Vehículo-días fuera del cruce", "Suma de días agregados fuera del cruce heredado.", "sum", "integer", { field: "days_outside_ratio_scope" }),
  m("distance_total", "Recorrido GPS", "Suma de recorrido diario GPS.", "sum", "km", { field: "odometer_km" }),
  m("qty_total", "Galones abastecidos", "Suma de galones.", "sum", "gal", { field: "qty" }),
  m("avg_qty_per_vehicle", "Consumo promedio por vehículo", "Galones divididos entre placas distintas; incluye galoneras y otros.", "sum_per_distinct", "gal", { field: "qty", distinctField: "plate" }),
  m("avg_cost_pen_per_vehicle", "Costo PEN promedio por vehículo", "Costo PEN completo dividido entre placas distintas con importe PEN.", "sum_per_distinct", "pen", { field: "cost_pen", distinctField: "plate", where: [{ field: "non_pen_or_unpriced_count", op: "eq", value: 0 }, { field: "cost_pen", op: "gt", value: 0 }] }),
  m("avg_cost_usd_per_vehicle", "Costo USD promedio por vehículo", "Costo USD identificado dividido entre placas distintas con importe USD.", "sum_per_distinct", "usd", { field: "cost_usd_known", distinctField: "plate", where: [{ field: "cost_usd_known", op: "gt", value: 0 }] }),
  m("refuel_count", "Abastecimientos", "Suma de vales incluidos.", "sum", "integer", { field: "refuel_count" }),
  m("anomaly_count", "Tanqueos anómalos", "Suma de anomalías calculadas por vale.", "sum", "integer", { field: "anomaly_count" }),
  m("excess_gal_total", "Exceso sobre tanque", "Suma del exceso calculado por vale.", "sum", "gal", { field: "excess_gal" }),
  m("cost_pen_known", "Costo identificado PEN", "Subtotal de importes reconocidos como PEN; revisar Vales fuera de total PEN antes de tratarlo como costo total.", "sum", "pen", { field: "cost_pen_known" }),
  m("cost_usd_known", "Costo identificado USD", "Subtotal de importes reconocidos como USD; no convierte monedas.", "sum", "usd", { field: "cost_usd_known" }),
  m("non_pen_or_unpriced_count", "Vales fuera de total PEN", "Suma de vales que impiden consolidar el costo PEN.", "sum", "integer", { field: "non_pen_or_unpriced_count" }),
  m("unknown_currency_count", "Vales con moneda desconocida", "Suma de vales con moneda no reconocida.", "sum", "integer", { field: "unknown_currency_count" }),
  m("unpriced_anomaly_count", "Anomalías sin precio PEN", "Suma de anomalías sin precio PEN verificable.", "sum", "integer", { field: "unpriced_anomaly_count" }),
  m("km_per_gps_day", "Km por día con GPS", "Recorrido total dividido entre vehículo-días con GPS.", "ratio", "km", { numerator: "odometer_km", denominator: "days_with_gps" }),
  m("km_per_gal", "Rendimiento km/gal", "Σ recorrido GPS / Σ galones, solo vehículos con recorrido y combustible.", "ratio", "km_per_gal", { numerator: "odometer_km", denominator: "qty", where: [{ field: "is_vehicle", op: "eq", value: "true" }, { field: "odometer_km", op: "gt", value: 0 }, { field: "qty", op: "gt", value: 0 }] }),
  m("avg_cost_pen_per_gal", "Costo promedio por galón PEN", "Σ costo PEN completo / Σ galones de filas con costo PEN completo.", "ratio", "pen_per_gal", { numerator: "cost_pen", denominator: "qty", where: [{ field: "non_pen_or_unpriced_count", op: "eq", value: 0 }, { field: "qty", op: "gt", value: 0 }] }),
  m("l_100km_real", "Consumo real", "Σ galones × 3.78541 × 100 / Σ km, solo vehículos con recorrido y combustible.", "ratio", "l_100km", { numerator: "qty", denominator: "odometer_km", multiplier: 378.541, where: [{ field: "is_vehicle", op: "eq", value: "true" }, { field: "odometer_km", op: "gt", value: 0 }, { field: "qty", op: "gt", value: 0 }] }),
  m("l_100km_reference", "Consumo de referencia", "Suma ponderada de referencia dividida entre sus kilómetros de peso.", "ratio", "l_100km", { numerator: "reference_weighted_sum", denominator: "reference_weight_km", where: [{ field: "reference_weight_km", op: "gt", value: 0 }] }),
  m("cost_per_km_pen", "Costo por km PEN", "Σ costo PEN completo / Σ km, usando solo filas sin vales fuera del total PEN.", "ratio", "pen_per_km", { numerator: "cost_pen", denominator: "odometer_km", where: [{ field: "is_vehicle", op: "eq", value: "true" }, { field: "non_pen_or_unpriced_count", op: "eq", value: 0 }, { field: "odometer_km", op: "gt", value: 0 }] }),
  m("autonomia_real", "Autonomía real", "Promedio de autonomía real ponderado por galones.", "weighted_avg", "km", { field: "autonomia_real_km", weight: "qty", where: [{ field: "is_vehicle", op: "eq", value: "true" }] }),
  m("theoretical_gal_total", "Galones teóricos", "Suma de galones teóricos para vehículos con ficha.", "sum", "gal", { field: "theoretical_gal", where: [{ field: "is_vehicle", op: "eq", value: "true" }] }),
  m("theoretical_cost_pen_total", "Costo teórico PEN", "Suma del costo teórico cuando existe precio PEN verificable.", "sum", "pen", { field: "theoretical_cost_pen", where: [{ field: "is_vehicle", op: "eq", value: "true" }] }),
  m("savings_signed_pen_total", "Desviación económica PEN", "Suma firmada de la desviación estimada frente a ficha técnica.", "sum", "pen", { field: "savings_signed_pen", where: [{ field: "is_vehicle", op: "eq", value: "true" }] }),
  m("potential_savings_pen_total", "Ahorro potencial PEN", "Suma de la parte positiva de la desviación estimada; no representa ahorro realizado.", "sum", "pen", { field: "potential_savings_pen", where: [{ field: "is_vehicle", op: "eq", value: "true" }] }),
];

const fleetFuelSummarySource = (grain: "day" | "month"): VaiSource => ({
  id: `fleet_fuel_summary_${grain}`,
  name: grain === "day" ? "Combustible y recorridos diarios" : "Combustible y recorridos mensuales",
  area: "fleet",
  description: grain === "day"
    ? "Resumen diario por placa y sede que combina recorrido GPS, abastecimientos, costos identificados, referencias técnicas, anomalías y estimaciones contra ficha."
    : "Resumen mensual por placa y sede que combina recorrido GPS, abastecimientos, costos identificados, referencias técnicas, anomalías y estimaciones contra ficha.",
  endpoint: `/api/logistics/flota/fuel-summary?${grain === "day" ? "grain=day&" : ""}apply_factor=1`,
  sqlView: "dw.v_logistics_flota_dist_cons_rat + stg.logistics_flota_fuel_cons + dw.v_logistics_flota_fuel_units",
  grain: `Una fila por placa, sede y ${grain === "day" ? "día" : "mes"}.`,
  defaultDateField: "period_start",
  fields: fleetFuelSummaryFields(),
  metrics: fleetFuelSummaryMetrics(),
  rules: [
    "Combina el alcance de dist-cons-rat con todos los vales fechados con placa; no inventa kilómetros cuando faltan.",
    "Los galones y costos se agregan antes del cruce con GPS para no multiplicarlos.",
    "Ratios y porcentajes se recalculan desde sus sumas base; no sumar ni promediar los campos de ratios.",
    "Galoneras y otros conservan consumo y costo, pero no generan métricas de eficiencia.",
    "Costo identificado PEN y USD son subtotales separados por moneda; los valores desconocidos se reportan aparte y nunca se convierten ni mezclan.",
    "Las estimaciones contra ficha técnica no son ahorro realizado ni prueba de uso indebido.",
    "El endpoint usa apply_factor=1 y vehicle_only=0: aplica el factor técnico e incluye vehículos, galoneras y otros. Las métricas de eficiencia filtran is_vehicle=1; consumo y costo conservan todo el universo.",
    "status_name usa umbrales técnicos no oficializados: no emplearlo en dashboards normales ni como conclusión de negocio salvo petición explícita.",
    "Para una tabla de eficiencia por placa, priorizar Placa, Sede, Rendimiento km/gal, galones, costo por moneda, costo por galón y recorrido total; si el renderer no puede reunirlos en una sola tabla, conservar las métricas sin inventar columnas.",
    grain === "day"
      ? "Usar esta fuente para fechas exactas, rangos menores a un mes y detalle diario."
      : "period_start es el primer día del mes; usar esta fuente para meses completos y tendencias mensuales.",
  ],
  keywords: grain === "day"
    ? ["combustible", "consumo", "recorrido", "kilómetros", "kilometros", "galones", "abastecimiento", "tanqueo", "anomalía", "anomalia", "eficiencia", "flota", "diario", "día", "gps", "costo por km", "litros por 100"]
    : ["combustible", "consumo", "recorrido", "kilómetros", "kilometros", "galones", "abastecimiento", "tanqueo", "anomalía", "anomalia", "eficiencia", "flota", "mensual", "mes", "gps", "costo por km", "litros por 100"],
  enabled: true,
  access: { scopes: ["fleet_mgmt"] },
});

export const VAI_SOURCES: VaiSource[] = [
  // ── Kardex TRJ ────────────────────────────────────────────────────────
  {
    id: "trjkar_guides",
    name: "Guías de transporte TRJ",
    area: "kardex",
    description:
      "Guías de remisión del transporte de mineral desde TRJ hacia planta: transportista, fechas de salida/llegada, TMH enviadas y llegadas, tarifa, importe valorizado y vínculo con la factura del transportista.",
    endpoint: "/api/trjkar/guides",
    sqlView: "dw.v_finance_trjkar_guides_get",
    grain: "Una fila por guía de transporte.",
    fields: [
      f("guide_number", "Número de guía", "attribute", "Identificador de la guía (XX##-##########)."),
      f("guide_date", "Fecha de guía", "date", "Fecha de emisión de la guía; fecha predeterminada para consultas de guías por período.", "date", "date", ["guía", "guia", "guías", "guias", "emisión", "emision"]),
      f("departure_date", "Fecha de salida", "date", "Fecha y hora de salida del camión.", "datetime", "text", ["salida", "despacho"]),
      f("arrival_date", "Fecha de llegada", "date", "Fecha y hora de llegada a planta; vacía si aún no llega.", "datetime", "text", ["llegada", "recepción", "recepcion"]),
      f("transport_name", "Transportista", "dimension", "Razón social de la empresa de transporte."),
      f("transport_ruc", "RUC transportista", "attribute", "RUC de la empresa de transporte."),
      f("driver_name", "Conductor", "dimension", "Nombre del conductor."),
      f("plate_1", "Placa", "dimension", "Placa del vehículo."),
      f("destination_district", "Distrito destino", "dimension", "Distrito de destino."),
      f("status_name", "Estado", "dimension", "ABIERTO o CERRADO (cerrada tras conciliar la factura)."),
      f("document_number", "Factura vinculada", "attribute", "Número de factura del transportista; vacío si la guía está pendiente de facturación."),
      f("tmh_departure", "TMH enviadas", "measure", "Toneladas métricas húmedas despachadas (lotes operativos, sin PERD/EXCE).", "number", "tmh"),
      f("tmh_arrival", "TMH llegadas", "measure", "Toneladas métricas húmedas recibidas en planta; 0 si no hay llegada registrada.", "number", "tmh"),
      f("pu_transport_usd", "Tarifa USD/TMH", "measure", "Precio unitario pactado por tonelada.", "number", "usd"),
      f("amount_usd", "Importe USD guía", "measure", "Valorización de la guía (tarifa × TMH).", "number", "usd"),
      f("invoice_document_date", "Fecha factura", "date", "Fecha de la factura vinculada."),
      f("invoice_amount_usd_web", "Importe factura (cabecera)", "attribute", "Importe total de la factura; se repite en cada guía de la misma factura, no sumar.", "number", "usd"),
    ],
    metrics: [
      m("guides_count", "Guías", "Número de guías.", "count", "integer"),
      m("tmh_departure_total", "TMH enviadas", "Suma de TMH despachadas.", "sum", "tmh", { field: "tmh_departure" }),
      m("tmh_arrival_total", "TMH llegadas", "Suma de TMH recibidas (solo guías con llegada).", "sum", "tmh", { field: "tmh_arrival", where: [{ field: "tmh_arrival", op: "gt", value: 0 }] }),
      m("amount_usd_total", "USD valorizado", "Suma del importe de las guías.", "sum", "usd", { field: "amount_usd" }),
      m("avg_rate_usd_tmh", "Tarifa USD/TMH", "Tarifa ponderada: USD / TMH de guías con importe.", "ratio", "usd", { numerator: "amount_usd", denominator: "tmh_departure", where: [{ field: "amount_usd", op: "gt", value: 0 }, { field: "tmh_departure", op: "gt", value: 0 }] }),
      m("loss_pct", "Merma %", "(TMH enviadas − llegadas) / enviadas, solo guías con llegada.", "diff_pct", "percent", { numerator: "tmh_departure", denominator: "tmh_arrival", where: [{ field: "tmh_arrival", op: "gt", value: 0 }] }),
      m("avg_transit_hours", "Horas de tránsito", "Promedio de horas entre salida y llegada.", "avg_hours_diff", "hours", { field: "departure_date", field2: "arrival_date" }),
      m("tmh_per_guide", "TMH por guía", "TMH enviadas divididas entre guías distintas.", "sum_per_distinct", "tmh", { field: "tmh_departure", distinctField: "guide_number" }),
      m("pending_invoice_guides", "Guías pendientes de facturación", "Guías sin factura vinculada.", "count", "integer", { where: [{ field: "document_number", op: "empty" }] }),
      m("invoiced_guides", "Guías facturadas", "Guías con factura vinculada.", "count", "integer", { where: [{ field: "document_number", op: "not_empty" }] }),
      m("closed_guides", "Guías cerradas", "Guías en estado CERRADO.", "count", "integer", { where: [{ field: "status_name", op: "eq", value: "CERRADO" }] }),
      m("carriers_count", "Transportistas", "Transportistas distintos.", "count_distinct", "integer", { field: "transport_ruc" }),
    ],
    rules: [
      "Las TMH ya excluyen lotes PERD (pérdida) y EXCE (excedente).",
      "Los importes de factura son de cabecera y se repiten por guía: no se suman.",
      "Las semanas van de lunes a domingo.",
      "El origen es siempre TRJ; no agrupar por origen.",
      "Cuando se pide «guías de <período>» sin otro hito, filtrar guide_date. departure_date y arrival_date solo se usan cuando se pide salida o llegada.",
    ],
    defaultDateField: "guide_date",
    relations: [
      { field: "document_number", source: "trjkar_invoices", targetField: "document_number", description: "Guía → factura del transportista." },
      { field: "guide_number", source: "trjkar_lots", targetField: "guide_number", description: "Guía → lotes transportados." },
    ],
    keywords: ["guía", "guias", "transporte", "transportista", "camión", "tmh", "salida", "llegada", "merma", "tarifa", "facturación", "pendiente", "kardex", "trj", "conductor", "placa"],
    enabled: true,
    access: { scopes: ["trjkardex_sum", "trjkardex_guides"] },
  },
  {
    id: "trjkar_lots",
    name: "Lotes transportados TRJ",
    area: "kardex",
    description:
      "Detalle de movimientos de lotes dentro de cada guía TRJ. Los correlativos numéricos son despachos operativos; PERD y EXCE son filas de control del mismo lote y su cantidad se registra en tmh_departure.",
    endpoint: "/api/trjkar",
    sqlView: "dw.v_finance_trjkar_get",
    grain: "Una fila por movimiento lote-guía: correlativo numérico = salida operativa; PERD = pérdida y EXCE = excedente de control.",
    fields: [
      f("lot", "Lote", "dimension", "Código del lote de mineral."),
      f("lot_corr", "Correlativo", "dimension", "Correlativo del movimiento. Valores numéricos = salidas operativas; PERD = pérdida; EXCE = excedente. PERD/EXCE no son lotes enviados adicionales."),
      f("guide_number", "Número de guía", "dimension", "Guía a la que pertenece el movimiento; se puede usar para agrupar el resumen por guía."),
      f("transport_name", "Transportista", "dimension", "Empresa de transporte de la guía."),
      f("departure_date", "Fecha de salida", "date", "Salida de la guía.", "datetime"),
      f("status_name", "Estado de guía", "dimension", "ABIERTO o CERRADO."),
      f("destination_district", "Distrito destino", "dimension", "Destino de la guía."),
      f("tmh_departure", "TMH salida", "measure", "TMH del lote al salir.", "number", "tmh"),
      f("tmh_arrival", "TMH llegada", "measure", "TMH del lote al llegar.", "number", "tmh"),
      f("bags_tot", "Sacos totales", "measure", "Sacos del lote.", "number", "integer"),
      f("bags_used", "Sacos usados", "measure", "Sacos consumidos en la guía.", "number", "integer"),
      f("tmh_balance", "Saldo TMH SGM", "measure", "Saldo del lote según SGM.", "number", "tmh"),
      f("amount_usd", "Importe USD guía (cabecera)", "attribute", "Importe de la guía; se repite por lote, no sumar.", "number", "usd"),
    ],
    metrics: [
      m("lots_count", "Lotes", "Lotes distintos operativos (sin PERD/EXCE).", "count_distinct", "integer", { field: "lot", where: [OPERATIONAL_LOT] }),
      m("lot_rows", "Filas lote-guía", "Combinaciones lote-guía operativas.", "count", "integer", { where: [OPERATIONAL_LOT] }),
      m("tmh_departure_total", "TMH salida", "Suma de TMH operativas de salida.", "sum", "tmh", { field: "tmh_departure", where: [OPERATIONAL_LOT] }),
      m("tmh_arrival_total", "TMH llegada", "Suma de TMH operativas de llegada.", "sum", "tmh", { field: "tmh_arrival", where: [OPERATIONAL_LOT] }),
      m("bags_total", "Sacos", "Suma de sacos totales.", "sum", "integer", { field: "bags_tot", where: [OPERATIONAL_LOT] }),
      m("tmh_perd", "TMH pérdida (PERD)", "Suma de tmh_departure de las filas cuyo lot_corr es PERD.", "sum", "tmh", { field: "tmh_departure", where: [{ field: "lot_corr", op: "eq", value: "PERD" }] }),
      m("tmh_exce", "TMH exceso (EXCE)", "Suma de tmh_departure de las filas cuyo lot_corr es EXCE.", "sum", "tmh", { field: "tmh_departure", where: [{ field: "lot_corr", op: "eq", value: "EXCE" }] }),
      m("perd_rows", "Registros PERD", "Número de filas de control PERD.", "count", "integer", { where: [{ field: "lot_corr", op: "eq", value: "PERD" }] }),
      m("exce_rows", "Registros EXCE", "Número de filas de control EXCE.", "count", "integer", { where: [{ field: "lot_corr", op: "eq", value: "EXCE" }] }),
      m("tmh_cleanup", "TMH limpieza", "TMH de lotes LIMPIEZA (operativos, sin saldo SGM).", "sum", "tmh", { field: "tmh_departure", where: [OPERATIONAL_LOT, { field: "lot", op: "ends_with", value: "LIMPIEZA" }] }),
      m("lots_per_guide", "Lotes por guía", "Filas operativas de lote divididas entre guías distintas.", "count_per_distinct", "decimal", { distinctField: "guide_number", where: [OPERATIONAL_LOT] }),
    ],
    defaultDateField: "departure_date",
    rules: [
      "Los importes y datos de factura pertenecen a la guía (cabecera) y se repiten por lote: no sumarlos aquí; usar la fuente de guías.",
      "PERD y EXCE no son campos físicos tmh_perd/tmh_exce ni lotes adicionales: son filas del mismo detalle identificadas por lot_corr = PERD o EXCE.",
      "La cantidad de una pérdida o exceso está en tmh_departure de esa fila de control.",
      "Las métricas operativas de lotes y TMH excluyen PERD y EXCE. Para pérdidas usa tmh_perd; para excesos/excedentes usa tmh_exce.",
      "Cuando se pida un resumen por guía, agrupa por guide_number y usa métricas como lots_count, tmh_departure_total, tmh_perd y tmh_exce.",
    ],
    relations: [{ field: "guide_number", source: "trjkar_guides", targetField: "guide_number", description: "Lote → guía." }],
    keywords: ["lote", "lotes", "guía", "guia", "sacos", "perd", "pérdida", "perdida", "merma", "exce", "exceso", "excedente", "limpieza", "saldo", "sgm", "kardex", "trj"],
    enabled: true,
    access: { scopes: ["trjkardex_sum", "trjkardex_guides"] },
  },
  {
    id: "trjkar_lot_workflow",
    name: "Seguimiento de lotes del Kardex TRJ",
    area: "kardex",
    description:
      "Estado consolidado que ya usa KardexSum para seguir cada lote desde la valorización y el pago hasta el envío, tránsito y llegada.",
    endpoint: "/api/trjkar/lots-control/sum",
    sqlView: "dw.v_finance_trjkar_lots_control_sum",
    grain: "Una fila de seguimiento por lote y correlativo, con su guía cuando existe.",
    fields: [
      f("lot", "Lote", "dimension", "Código del lote."),
      f("lot_corr", "Correlativo", "attribute", "Correlativo del lote dentro de la guía."),
      f("lot_status", "Estado del lote", "dimension", "Sin valorización, Sin pago, No enviado, En ruta o Finalizado."),
      f("summary_status", "Grupo de estado", "dimension", "Sin pago, No enviado, En ruta o Finalizado."),
      f("payment_status", "Clasificación de valorización", "dimension", "Sin valorización o Con valorización dentro del grupo Sin pago."),
      f("aging_days", "Antigüedad", "measure", "Días transcurridos según la etapa vigente.", "number", "days"),
      f("entry_date", "Fecha de ingreso", "date", "Fecha de ingreso del lote.", "date", "date", ["ingreso", "ingresado"]),
      f("valuation_date", "Fecha de valorización", "date", "Fecha de valorización del lote.", "date", "date", ["valorización", "valorizacion", "valorizado"]),
      f("payment_date", "Fecha de pago", "date", "Fecha de pago del lote.", "date", "date", ["pago", "pagado"]),
      f("guide_date", "Fecha de guía", "date", "Fecha de la guía remitente; fecha predeterminada para consultas de guías por período.", "date", "date", ["guía", "guia", "guías", "guias"]),
      f("departure_date", "Fecha de salida", "date", "Fecha de salida del transporte.", "datetime", "text", ["salida", "despacho"]),
      f("arrival_date", "Fecha de llegada", "date", "Fecha de llegada del transporte.", "datetime", "text", ["llegada", "recepción", "recepcion"]),
      f("guide_number", "Guía remitente", "dimension", "Número de guía remitente."),
      f("trjkar_transport_guide_number", "Guía transportista", "attribute", "Número de guía del transportista."),
      f("trjkar_transport_name", "Transportista", "dimension", "Empresa transportista."),
      f("miner_name", "Proveedor", "dimension", "Proveedor del lote."),
      f("ruc", "RUC proveedor", "attribute", "RUC del proveedor."),
      f("summary_tmh", "TMH del lote", "measure", "TMH resumidas del lote.", "number", "tmh"),
      f("tmh_departure", "TMH salida", "measure", "TMH registradas a la salida.", "number", "tmh"),
      f("tmh_arrival", "TMH llegada", "measure", "TMH registradas a la llegada.", "number", "tmh"),
    ],
    metrics: [
      m("lots_count", "Lotes", "Lotes distintos en seguimiento.", "count_distinct", "integer", { field: "lot" }),
      m("without_valuation", "Lotes sin valorización", "Lotes distintos cuyo estado vigente es Sin valorización.", "count_distinct", "integer", { field: "lot", where: [{ field: "lot_status", op: "eq", value: "Sin valorización" }] }),
      m("without_payment", "Lotes sin pago", "Lotes distintos dentro del grupo Sin pago.", "count_distinct", "integer", { field: "lot", where: [{ field: "summary_status", op: "eq", value: "Sin pago" }] }),
      m("not_sent", "Lotes no enviados", "Lotes distintos en estado No enviado.", "count_distinct", "integer", { field: "lot", where: [{ field: "summary_status", op: "eq", value: "No enviado" }] }),
      m("in_transit", "Lotes en ruta", "Lotes distintos en estado En ruta.", "count_distinct", "integer", { field: "lot", where: [{ field: "summary_status", op: "eq", value: "En ruta" }] }),
      m("finalized", "Lotes finalizados", "Lotes distintos en estado Finalizado.", "count_distinct", "integer", { field: "lot", where: [{ field: "summary_status", op: "eq", value: "Finalizado" }] }),
      m("pending_arrival", "Lotes pendientes de llegada", "Lotes distintos que todavía no están en el estado Finalizado.", "count_distinct", "integer", { field: "lot", where: [{ field: "summary_status", op: "ne", value: "Finalizado" }] }),
      m("avg_aging_days", "Antigüedad promedio", "Promedio de días en la etapa vigente.", "avg", "days", { field: "aging_days" }),
    ],
    rules: [
      "Usar los estados oficiales ya calculados por KardexSum: Sin valorización, Sin pago, No enviado, En ruta y Finalizado; no reconstruirlos con reglas nuevas.",
      "Pendiente de llegada es todo lote cuyo summary_status todavía no es Finalizado.",
      "LIMPIEZA forma parte del tonelaje operativo. PERD y EXCE continúan fuera del tonelaje operativo y se consultan en la fuente de lotes.",
    ],
    defaultDateField: "guide_date",
    keywords: ["kardex", "seguimiento", "flujo", "estado", "sin pago", "sin valorización", "no enviado", "en ruta", "finalizado", "pendiente", "llegada", "lote"],
    enabled: true,
    access: { scopes: ["trjkardex_sum"] },
  },
  {
    id: "trjkar_invoices",
    name: "Facturas de transportistas TRJ",
    area: "kardex",
    description:
      "Facturas de los transportistas del Kardex TRJ: importe ingresado en la web, importe contabilizado en Concar, cruce contable y guías vinculadas.",
    endpoint: "/api/trjkar/invo",
    sqlView: "dw.v_finance_trjkar_invo_get",
    grain: "Una fila por factura (RUC + número de documento).",
    fields: [
      f("ruc", "RUC", "attribute", "RUC del transportista."),
      f("document_number", "Factura", "attribute", "Serie y correlativo de la factura."),
      f("document_date", "Fecha de factura", "date", "Fecha del documento.", "date", "date", ["factura", "facturas", "facturado", "facturación", "facturacion"]),
      f("transport_name", "Transportista", "dimension", "Nombre del transportista."),
      f("status_name", "Estado", "dimension", "CERRADO si sus guías fueron cerradas, si no ABIERTO."),
      f("amount_usd", "USD facturado", "measure", "Importe oficial de la factura registrado en la web; corresponde a la suma de sus guías.", "number", "usd"),
      f("amount_usd_con", "USD contabilizado", "measure", "Importe hallado en Concar (cuenta 631111 / subdiario 820); vacío sin cruce.", "number", "usd"),
      f("calculated_amount_usd", "USD de guías", "measure", "Suma de importes de las guías vinculadas.", "number", "usd"),
      f("guide_count", "Guías vinculadas", "measure", "Número de guías de la factura.", "number", "integer"),
      f("subledger_num", "Subdiario", "attribute", "Subdiario contable del cruce; vacío si no cruzó."),
    ],
    metrics: [
      m("invoices_count", "Facturas", "Número de facturas.", "count", "integer"),
      m("amount_usd_total", "USD facturado", "Suma del importe oficial de las facturas registradas.", "sum", "usd", { field: "amount_usd" }),
      m("amount_usd_con_total", "USD contabilizado", "Suma del importe contabilizado.", "sum", "usd", { field: "amount_usd_con" }),
      m("calculated_usd_total", "USD de guías", "Suma de la valorización de guías vinculadas.", "sum", "usd", { field: "calculated_amount_usd" }),
      m("guides_linked", "Guías vinculadas", "Total de guías vinculadas.", "sum", "integer", { field: "guide_count" }),
      m("unmatched_invoices", "Facturas sin cruce", "Facturas sin registro contable.", "count", "integer", { where: [{ field: "subledger_num", op: "empty" }] }),
      m("closed_invoices", "Facturas cerradas", "Facturas en estado CERRADO.", "count", "integer", { where: [{ field: "status_name", op: "eq", value: "CERRADO" }] }),
      m("entered_minus_concar", "Diferencia USD", "Importe facturado menos el importe hallado en Concar.", "sum_diff", "usd", { field: "amount_usd", field2: "amount_usd_con" }),
    ],
    rules: ["Cada factura se cuenta una sola vez por RUC/documento.", "amount_usd es el importe oficial facturado y debe coincidir con la suma de las guías; amount_usd_con es solo el cruce contable.", "El cruce contable es registro, no prueba de pago."],
    defaultDateField: "document_date",
    relations: [{ field: "document_number", source: "trjkar_guides", targetField: "document_number", description: "Factura → guías." }],
    keywords: ["factura", "facturas", "concar", "contabilizado", "cruce", "transportista", "kardex", "valorización", "usd"],
    enabled: true,
    access: { scopes: ["trjkardex_sum", "trjkardex_quotes"] },
  },

  // ── Trazabilidad ──────────────────────────────────────────────────────
  {
    id: "traceability_lots",
    name: "Ingresos de mineral (lotes)",
    area: "traceability",
    description:
      "Lotes de mineral comprados a mineros y proveedores desde 2026: tonelaje, leyes de oro y plata, onzas, valorización (PIO, maquila, USD/TMS), factura y pago.",
    endpoint: "/api/traceability",
    sqlView: "dw.v_traceability_get",
    grain: "Una fila por lote de mineral ingresado.",
    fields: [
      f("lot", "Lote", "attribute", "Código del lote."),
      f("entry_date", "Fecha de ingreso", "date", "Ingreso del lote a planta; fecha predeterminada de la fuente.", "date", "date", ["ingresado", "ingresados", "ingreso", "entrada"]),
      f("process_date", "Fecha de proceso", "date", "Fecha de procesamiento.", "date", "date", ["procesado", "procesados", "proceso"]),
      f("valuation_date", "Fecha de valorización", "date", "Fecha de valorización.", "date", "date", ["valorizado", "valorizados", "valorización", "valorizacion"]),
      f("doc_date", "Fecha de factura", "date", "Fecha de la factura del proveedor.", "date", "date", ["facturado", "facturados", "factura", "facturación", "facturacion"]),
      f("payment_date", "Fecha de pago", "date", "Fecha de pago al proveedor; vacía si no se ha pagado.", "date", "date", ["pagado", "pagados", "pago"]),
      f("miner_name", "Minero / proveedor", "dimension", "Proveedor del mineral."),
      f("ruc", "RUC", "attribute", "RUC del proveedor."),
      f("concession_name", "Concesión", "dimension", "Concesión minera de origen."),
      f("department", "Departamento", "dimension", "Departamento de origen."),
      f("province", "Provincia", "dimension", "Provincia de origen."),
      f("district", "Distrito", "dimension", "Distrito de origen."),
      f("transport_name", "Transportista", "dimension", "Transportista del lote."),
      f("zone_1", "Zona 1", "dimension", "Zona comercial."),
      f("zone_2", "Zona 2", "dimension", "Subzona comercial."),
      f("pay_type", "Tipo de pago", "dimension", "Modalidad de pago."),
      f("sack_qty", "Sacos", "measure", "Cantidad de sacos.", "number", "integer"),
      f("tmh", "TMH", "measure", "Toneladas húmedas.", "number", "tmh"),
      f("h2o", "Humedad %", "measure", "Porcentaje de humedad.", "number", "percent"),
      f("tms", "TMS", "measure", "Toneladas secas.", "number", "tms"),
      f("au_grade_oztc", "Ley Au (oz/TC)", "measure", "Ley de oro en onzas por tonelada corta.", "number", "grade_oztc"),
      f("ag_grade_oztc", "Ley Ag (oz/TC)", "measure", "Ley de plata.", "number", "grade_oztc"),
      f("cu_grade_pct", "Cu %", "measure", "Porcentaje de cobre.", "number", "percent"),
      f("au_oz", "Onzas Au", "measure", "Onzas de oro contenidas.", "number", "oz"),
      f("ag_oz", "Onzas Ag", "measure", "Onzas de plata contenidas.", "number", "oz"),
      f("au_rec", "Recuperación Au %", "measure", "Recuperación de oro.", "number", "percent"),
      f("ag_rec", "Recuperación Ag %", "measure", "Recuperación de plata.", "number", "percent"),
      f("pio", "PIO (USD/oz)", "measure", "Precio internacional del oro aplicado.", "number", "usd"),
      f("pip", "PIP (USD/oz)", "measure", "Precio internacional de la plata.", "number", "usd"),
      f("maquila", "Maquila", "measure", "Cargo de maquila USD/TMS.", "number", "usd"),
      f("usd_tms", "USD/TMS", "measure", "Valor por tonelada seca.", "number", "usd"),
      f("au_usd", "Au USD", "measure", "Valor del oro del lote.", "number", "usd"),
      f("ag_usd", "Ag USD", "measure", "Valor de la plata del lote.", "number", "usd"),
      f("lot_usd", "Monto valorizado USD", "measure", "Monto de valorización del lote.", "number", "usd"),
      f("doc_number", "Factura", "attribute", "Número de factura del proveedor; vacío si no está facturado."),
    ],
    metrics: [
      m("lots_count", "Lotes", "Número de lotes.", "count", "integer"),
      m("miners_count", "Proveedores", "Proveedores distintos.", "count_distinct", "integer", { field: "ruc" }),
      m("tmh_total", "TMH", "Suma de toneladas húmedas.", "sum", "tmh", { field: "tmh" }),
      m("tms_total", "TMS", "Suma de toneladas secas.", "sum", "tms", { field: "tms" }),
      m("sacks_total", "Sacos", "Suma de sacos.", "sum", "integer", { field: "sack_qty" }),
      m("au_oz_total", "Onzas Au", "Suma de onzas de oro.", "sum", "oz", { field: "au_oz" }),
      m("ag_oz_total", "Onzas Ag", "Suma de onzas de plata.", "sum", "oz", { field: "ag_oz" }),
      m("lot_usd_total", "Monto valorizado USD", "Suma de los montos de valorización.", "sum", "usd", { field: "lot_usd" }),
      m("avg_au_grade", "Ley Au promedio", "Ley de oro ponderada por TMS.", "weighted_avg", "grade_oztc", { field: "au_grade_oztc", weight: "tms" }),
      m("avg_ag_grade", "Ley Ag promedio", "Ley de plata ponderada por TMS.", "weighted_avg", "grade_oztc", { field: "ag_grade_oztc", weight: "tms" }),
      m("avg_h2o", "Humedad promedio", "Promedio simple de humedad.", "avg", "percent", { field: "h2o" }),
      m("avg_usd_tms", "USD/TMS promedio", "Promedio simple de USD/TMS.", "avg", "usd", { field: "usd_tms" }),
      m("avg_au_rec", "Recuperación Au promedio", "Promedio simple de recuperación Au.", "avg", "percent", { field: "au_rec" }),
      m("avg_pio", "PIO promedio", "Promedio del precio del oro aplicado.", "avg", "usd", { field: "pio" }),
      m("lots_without_valuation", "Lotes sin valorización", "Lotes sin fecha de valorización.", "count", "integer", { where: [{ field: "valuation_date", op: "empty" }] }),
      m("lots_pending_invoice", "Lotes sin factura", "Lotes sin número de factura.", "count", "integer", { where: [{ field: "doc_number", op: "empty" }] }),
      m("lots_pending_payment", "Lotes sin pago", "Lotes sin fecha de pago.", "count", "integer", { where: [{ field: "payment_date", op: "empty" }] }),
      m("lots_paid", "Lotes pagados", "Lotes con fecha de pago.", "count", "integer", { where: [{ field: "payment_date", op: "not_empty" }] }),
    ],
    rules: [
      "Solo incluye lotes con ingreso desde 2026-01-01.",
      "Las leyes Au y Ag se promedian ponderadas por TMS, nunca se suman; humedad y USD/TMS usan promedio simple.",
      "lot_usd es el monto de valorización del lote, no el importe de factura ni la prueba de pago.",
      "«Sin leyes» se interpreta como sin valorización y se identifica por valuation_date vacía, no por sumar o asumir leyes cero; sin payment_date significa sin pago.",
      "Los precios (PIO, PIP) y ratios (USD/TMS) no se suman.",
    ],
    defaultDateField: "entry_date",
    keywords: ["mineral", "lote", "lotes", "minero", "proveedor", "ley", "leyes", "oro", "plata", "au", "ag", "onzas", "tms", "tmh", "concesión", "trazabilidad", "ingreso", "compra", "factura", "pago", "pio", "maquila", "humedad"],
    enabled: true,
    access: { scopes: ["traceability"] },
  },
  {
    id: "traceability_status",
    name: "Estado de lotes por sede",
    area: "traceability",
    description:
      "Situación operativa de los lotes de mineral por sede y zona: situación y observación, tonelaje, leyes y valor estimado del lote.",
    endpoint: "/api/traceability/status",
    sqlView: "dw.v_traceability_status_get",
    grain: "Una fila por lote con su situación vigente.",
    fields: [
      f("lot", "Lote", "attribute", "Código del lote."),
      f("entry_date", "Fecha de ingreso", "date", "Ingreso del lote.", "date", "date", ["ingresado", "ingresados", "ingreso"]),
      f("zone_name", "Zona", "dimension", "Zona comercial (Sur, Norte, Sur Aqp)."),
      f("site_name", "Sede", "dimension", "Sede u oficina de acopio."),
      f("miner_name", "Proveedor", "dimension", "Proveedor del lote."),
      f("ruc", "RUC", "attribute", "RUC del proveedor."),
      f("situation_desc", "Situación", "dimension", "Situación vigente del lote."),
      f("observation_desc", "Observación", "dimension", "Observación registrada."),
      f("concession_name", "Concesión", "dimension", "Concesión de origen."),
      f("department", "Departamento", "dimension", "Departamento de origen."),
      f("transport_name", "Transportista", "dimension", "Transportista."),
      f("tmh", "TMH", "measure", "Toneladas húmedas.", "number", "tmh"),
      f("h2o", "Humedad %", "measure", "Humedad.", "number", "percent"),
      f("tms", "TMS", "measure", "Toneladas secas.", "number", "tms"),
      f("au_grade_oztc", "Ley Au (oz/TC)", "measure", "Ley de oro.", "number", "grade_oztc"),
      f("ag_grade_oztc", "Ley Ag (oz/TC)", "measure", "Ley de plata.", "number", "grade_oztc"),
      f("au_rec", "Recuperación Au %", "measure", "Recuperación de oro.", "number", "percent"),
      f("usd_tms", "USD/TMS", "measure", "Valor por tonelada seca.", "number", "usd"),
      f("usd_lot", "USD lote", "measure", "Valor estimado del lote.", "number", "usd"),
    ],
    metrics: [
      m("lots_count", "Lotes", "Número de lotes.", "count", "integer"),
      m("tmh_total", "TMH", "Suma de TMH.", "sum", "tmh", { field: "tmh" }),
      m("tms_total", "TMS", "Suma de TMS.", "sum", "tms", { field: "tms" }),
      m("usd_lot_total", "USD estimado", "Suma del valor estimado.", "sum", "usd", { field: "usd_lot" }),
      m("avg_au_grade", "Ley Au promedio", "Ley de oro ponderada por TMS.", "weighted_avg", "grade_oztc", { field: "au_grade_oztc", weight: "tms" }),
      m("avg_ag_grade", "Ley Ag promedio", "Ley de plata ponderada por TMS.", "weighted_avg", "grade_oztc", { field: "ag_grade_oztc", weight: "tms" }),
      m("avg_h2o", "Humedad promedio", "Promedio simple de humedad.", "avg", "percent", { field: "h2o" }),
      m("avg_usd_tms", "USD/TMS promedio", "Promedio simple de USD/TMS.", "avg", "usd", { field: "usd_tms" }),
    ],
    rules: ["Las leyes Au y Ag se promedian ponderadas por TMS; humedad y USD/TMS usan promedio simple."],
    defaultDateField: "entry_date",
    keywords: ["estado", "situación", "sede", "zona", "lote", "pendiente", "trazabilidad", "observación"],
    enabled: true,
    access: { scopes: ["traceability"] },
  },
  {
    id: "traceability_payments",
    name: "Pagos contables de lotes",
    area: "traceability",
    description:
      "Pagos a proveedores de mineral registrados en contabilidad: fecha de pago, oficina, factura, moneda e importe USD por lote.",
    endpoint: "/api/traceability/conta",
    sqlView: "dw.v_traceability_conta_get",
    grain: "Una fila por lote pagado (voucher de pago).",
    fields: [
      f("lot", "Lote", "attribute", "Código del lote."),
      f("payment_date", "Fecha de pago", "date", "Fecha del voucher de pago.", "date", "date", ["pagado", "pagados", "pago"]),
      f("invoice_doc_date", "Fecha de factura", "date", "Fecha del documento de la factura.", "date", "date", ["facturado", "facturados", "factura"]),
      f("entry_date", "Fecha de ingreso", "date", "Ingreso del lote.", "date", "date", ["ingresado", "ingresados", "ingreso"]),
      f("office_name", "Oficina", "dimension", "Oficina de acopio."),
      f("sede", "Sede", "dimension", "Sede contable."),
      f("supplier", "Proveedor", "dimension", "Proveedor pagado."),
      f("ruc", "RUC", "attribute", "RUC del proveedor."),
      f("currency", "Moneda", "dimension", "Moneda del pago."),
      f("doc_number", "Documento", "attribute", "Número de factura."),
      f("concession_name", "Concesión", "dimension", "Concesión de origen."),
      f("department", "Departamento", "dimension", "Departamento de origen."),
      f("tms", "TMS", "measure", "Toneladas secas del lote.", "number", "tms"),
      f("lot_usd", "USD pagado", "measure", "Importe USD del lote.", "number", "usd"),
      f("au_grade_oztc", "Ley Au (oz/TC)", "measure", "Ley de oro.", "number", "grade_oztc"),
    ],
    metrics: [
      m("payments_count", "Pagos", "Número de lotes pagados.", "count", "integer"),
      m("lot_usd_total", "USD pagado", "Suma de importes pagados.", "sum", "usd", { field: "lot_usd" }),
      m("tms_total", "TMS", "Suma de TMS pagadas.", "sum", "tms", { field: "tms" }),
      m("suppliers_count", "Proveedores", "Proveedores distintos.", "count_distinct", "integer", { field: "ruc" }),
    ],
    rules: ["Incluye lotes desde 2025.", "lot_usd representa el monto pagado en esta fuente contable."],
    defaultDateField: "payment_date",
    keywords: ["pago", "pagos", "contabilidad", "voucher", "oficina", "proveedor", "usd", "trazabilidad"],
    enabled: true,
    access: { scopes: ["traceability"] },
  },

  // ── Activos Fijos ─────────────────────────────────────────────────────
  {
    id: "fixassets_catalogue",
    name: "Catálogo de activos fijos",
    area: "fixassets",
    description:
      "Foto actual completa del catálogo de activos fijos: una fila por COD con clasificador de depreciación, ubicación, área, centro de costo, valor actual, depreciación YTD, depreciación acumulada y saldo en USD y PEN.",
    endpoint: "/api/actfij/catalogue",
    sqlView: "dw.v_finance_actfij_cat_get",
    grain: "Una fila por activo (COD). Incluye todo el catálogo actual, no solo activos adquiridos en el período vigente.",
    temporalMode: "snapshot",
    fields: [
      f("asset_code", "COD", "attribute", "Código del activo (7 dígitos)."),
      f("asset_description", "Descripción", "attribute", "Descripción del activo."),
      f("source_name", "Origen", "dimension", "WEB, VR, TRASLADO o HISTORIC."),
      f("location_name", "Ubicación", "dimension", "Ubicación física."),
      f("area_name", "Área", "dimension", "Área usuaria."),
      f("assigned_to", "Asignado a", "dimension", "Responsable asignado."),
      f("asset_type", "Clasificador de depreciación", "dimension", "Clasificación contable/depreciación del activo, por ejemplo LR, DUP o NO DEPRECIA."),
      f("origin_account_desc", "Cuenta origen", "dimension", "Descripción de la cuenta contable de origen."),
      f("cost_center_desc", "Centro de costo", "dimension", "Descripción del CECO."),
      f("capex_code", "Código CAPEX", "dimension", "Proyecto CAPEX asociado, si existe."),
      f("brand", "Marca", "dimension", "Marca."),
      f("asset_situation", "Situación", "dimension", "OPERATIVO, DEPRECIADO o vacío."),
      f("depreciation_method", "Método", "dimension", "Método de depreciación."),
      f("comp_date", "Fecha contable", "date", "Fecha contable original del activo; no representa la fecha del estado actual del catálogo.", "date", "date", ["fecha contable", "contable", "comp_date"]),
      f("acquisition_date", "Fecha de adquisición", "date", "Fecha de adquisición del activo.", "date", "date", ["fecha de adquisición", "fecha adquisicion", "adquisición", "adquisicion", "adquirido", "adquiridos", "alta", "altas"]),
      f("operation_date", "Fecha de operación", "date", "Inicio de operación o inicio de depreciación.", "date", "date", ["fecha de operación", "fecha de operacion", "inicio de operación", "inicio de operacion"]),
      f("disposal_date", "Fecha de baja", "date", "Fecha de baja; vacía si sigue activo.", "date", "date", ["fecha de baja", "baja", "bajas", "disposal"]),
      f("asset_ini_cost_usd", "Costo inicial USD", "measure", "Costo de adquisición en USD.", "number", "usd"),
      f("asset_ini_cost_pen", "Costo inicial PEN", "measure", "Costo de adquisición en PEN.", "number", "pen"),
      f("asset_final_value_usd", "Valor actual USD", "measure", "Valor contable actual del activo tras altas, bajas, reclasificaciones y ajustes.", "number", "usd"),
      f("asset_final_value_pen", "Valor actual PEN", "measure", "Valor contable actual del activo tras altas, bajas, reclasificaciones y ajustes.", "number", "pen"),
      f("depreciation_amount_usd", "Depreciación YTD USD", "measure", "Depreciación acumulada del año contable actual desde enero hasta el período contable vigente. Ya viene calculada por activo.", "number", "usd"),
      f("depreciation_amount_pen", "Depreciación YTD PEN", "measure", "Depreciación acumulada del año contable actual desde enero hasta el período contable vigente. Ya viene calculada por activo.", "number", "pen"),
      f("depreciation_cum_amount_usd", "Depreciación acumulada USD", "measure", "Depreciación histórica acumulada total hasta el período vigente.", "number", "usd"),
      f("depreciation_cum_amount_pen", "Depreciación acumulada PEN", "measure", "Depreciación histórica acumulada total hasta el período vigente.", "number", "pen"),
      f("asset_balance_usd", "Saldo USD", "measure", "Valor neto en libros USD.", "number", "usd"),
      f("asset_balance_pen", "Saldo PEN", "measure", "Valor neto en libros PEN.", "number", "pen"),
      f("deprec_rate_pct", "Tasa deprec. %", "measure", "Tasa anual de depreciación.", "number", "percent"),
    ],
    metrics: [
      m("assets_count", "Activos", "Número de activos.", "count", "integer"),
      m("active_assets", "Activos con saldo", "Activos con saldo de depreciación positivo en PEN o USD.", "count", "integer", { whereAny: [{ field: "asset_balance_pen", op: "gt", value: 0 }, { field: "asset_balance_usd", op: "gt", value: 0 }] }),
      m("disposed_assets", "Activos dados de baja", "Activos cuyo valor y saldo son cero en ambas monedas.", "count", "integer", { where: [{ field: "asset_final_value_pen", op: "eq", value: 0 }, { field: "asset_final_value_usd", op: "eq", value: 0 }, { field: "asset_balance_pen", op: "eq", value: 0 }, { field: "asset_balance_usd", op: "eq", value: 0 }] }),
      m("fully_depreciated_assets", "Activos totalmente depreciados", "Activos con saldo cero en ambas monedas; incluye los dados de baja cuando también tienen valor cero.", "count", "integer", { where: [{ field: "asset_balance_pen", op: "eq", value: 0 }, { field: "asset_balance_usd", op: "eq", value: 0 }] }),
      m("ini_cost_usd_total", "Costo inicial USD", "Suma del costo inicial USD.", "sum", "usd", { field: "asset_ini_cost_usd" }),
      m("ini_cost_pen_total", "Costo inicial PEN", "Suma del costo inicial PEN.", "sum", "pen", { field: "asset_ini_cost_pen" }),
      m("final_value_usd_total", "Valor actual USD", "Suma del valor contable actual USD de todos los activos del catálogo filtrado.", "sum", "usd", { field: "asset_final_value_usd" }),
      m("final_value_pen_total", "Valor actual PEN", "Suma del valor contable actual PEN de todos los activos del catálogo filtrado.", "sum", "pen", { field: "asset_final_value_pen" }),
      m("deprec_ytd_usd_total", "Depreciación YTD USD", "Suma de la depreciación del año contable actual hasta el período vigente para todos los activos.", "sum", "usd", { field: "depreciation_amount_usd" }),
      m("deprec_ytd_pen_total", "Depreciación YTD PEN", "Suma de la depreciación del año contable actual hasta el período vigente para todos los activos.", "sum", "pen", { field: "depreciation_amount_pen" }),
      m("deprec_cum_usd_total", "Depreciación acumulada USD", "Suma de depreciación histórica acumulada USD.", "sum", "usd", { field: "depreciation_cum_amount_usd" }),
      m("deprec_cum_pen_total", "Depreciación acumulada PEN", "Suma de depreciación histórica acumulada PEN.", "sum", "pen", { field: "depreciation_cum_amount_pen" }),
      m("balance_usd_total", "Saldo USD", "Suma del valor neto USD.", "sum", "usd", { field: "asset_balance_usd" }),
      m("balance_pen_total", "Saldo PEN", "Suma del valor neto PEN.", "sum", "pen", { field: "asset_balance_pen" }),
      m("avg_rate_pct", "Tasa promedio %", "Promedio simple de la tasa.", "avg", "percent", { field: "deprec_rate_pct" }),
    ],
    rules: [
      "Esta fuente es una foto actual de TODO el catálogo. No limites sus filas por Fecha contable, Fecha de adquisición, Fecha de operación o Fecha de baja salvo que el usuario pida explícitamente analizar una de esas fechas.",
      "Pedir estado actual, valor actual, saldo actual, catálogo, inventario o clasificador de depreciación NO implica filtrar el catálogo por el mes actual.",
      "depreciation_amount_pen y depreciation_amount_usd ya representan depreciación YTD por activo, desde enero hasta el período contable vigente. No necesitan un date_range sobre esta fuente.",
      "Para un catálogo con clasificador, valor actual, depreciación YTD y saldo usa esta fuente directamente: asset_type + asset_final_value_* + depreciation_amount_* + asset_balance_*.",
      "depreciation_cum_amount_* es depreciación histórica acumulada total y no debe confundirse con depreciation_amount_* que es YTD.",
      "Para evolución mensual de depreciación usa fixassets_depreciation.",
      "Cuando se pide «activos de <período>» sin otro hito, se entiende por acquisition_date.",
      "Presentar PEN y USD por separado. Para análisis mensual, fixassets_depreciation es la fuente principal; la relación por asset_code con el catálogo está documentada, pero V-Ai v1 no cruza fuentes.",
      "Activo significa saldo de depreciación mayor que cero; totalmente depreciado significa saldo cero; dado de baja exige además valor cero.",
      "La tasa es un porcentaje: se promedia, no se suma.",
    ],
    defaultDateField: "acquisition_date",
    relations: [{ field: "asset_code", source: "fixassets_depreciation", targetField: "asset_code", description: "Activo → depreciación mensual." }],
    keywords: ["activo", "activos", "fijos", "catálogo", "inventario", "clasificador", "clasificación", "tipo de depreciación", "depreciación ytd", "ytd", "valor actual", "ubicación", "área", "ceco", "centro de costo", "saldo", "valor", "costo", "baja", "capex", "marca", "tipo"],
    enabled: true,
    access: { scopes: ["fixassets"] },
  },
  {
    id: "fixassets_depreciation",
    name: "Depreciación mensual de activos",
    area: "fixassets",
    description:
      "Depreciación por activo y período mensual en PEN y USD: depreciación del período, acumulada, valor final y saldo, con tipo de activo y origen de carga.",
    endpoint: "/api/actfij/deprec",
    sqlView: "dw.v_finance_actfij_deprec_get",
    grain: "Una fila por activo y período mensual.",
    fields: [
      f("asset_code", "COD", "attribute", "Código del activo."),
      f("asset_description", "Descripción", "attribute", "Descripción del activo."),
      f("period_date", "Período", "date", "Mes contable de la depreciación.", "date", "date", ["depreciación", "depreciacion", "período", "periodo", "mes"]),
      f("asset_type", "Tipo de activo", "dimension", "LR, DUP, NO DEPRECIA, etc."),
      f("source_name", "Estado de carga", "dimension", "VIRTUAL (proyección), WEB, WEB_PEN, WEB_USD, lifecycle BAJA/RECLA."),
      f("applied_rate_pct", "Tasa aplicada %", "measure", "Tasa aplicada en el período.", "number", "percent"),
      f("depreciation_amount_pen", "Depreciación PEN", "measure", "Depreciación del período en PEN.", "number", "pen"),
      f("depreciation_amount_usd", "Depreciación USD", "measure", "Depreciación del período en USD.", "number", "usd"),
      f("depreciation_cum_amount_pen", "Acumulada PEN", "measure", "Depreciación acumulada al período.", "number", "pen"),
      f("depreciation_cum_amount_usd", "Acumulada USD", "measure", "Depreciación acumulada al período.", "number", "usd"),
      f("asset_final_value", "Valor final PEN", "measure", "Valor del activo al período.", "number", "pen"),
      f("asset_final_value_usd", "Valor final USD", "measure", "Valor del activo al período.", "number", "usd"),
      f("asset_balance_pen", "Saldo PEN", "measure", "Saldo neto al período.", "number", "pen"),
      f("asset_balance_usd", "Saldo USD", "measure", "Saldo neto al período.", "number", "usd"),
      f("exc_rate", "T.C.", "measure", "Tipo de cambio del período.", "number", "decimal"),
    ],
    metrics: [
      m("deprec_pen_total", "Depreciación PEN", "Suma de la depreciación del período.", "sum", "pen", { field: "depreciation_amount_pen" }),
      m("deprec_usd_total", "Depreciación USD", "Suma de la depreciación del período.", "sum", "usd", { field: "depreciation_amount_usd" }),
      m("balance_pen_total", "Saldo PEN", "Suma de saldos; solo tiene sentido dentro de un mismo período.", "sum", "pen", { field: "asset_balance_pen" }),
      m("balance_usd_total", "Saldo USD", "Suma de saldos; solo tiene sentido dentro de un mismo período.", "sum", "usd", { field: "asset_balance_usd" }),
      m("assets_count", "Activos", "Activos distintos con depreciación.", "count_distinct", "integer", { field: "asset_code" }),
      m("avg_rate_pct", "Tasa promedio %", "Promedio de la tasa aplicada.", "avg", "percent", { field: "applied_rate_pct" }),
    ],
    exclusions: [{ field: "source_name", op: "ne", value: "VIRTUAL" }],
    rules: [
      "Las filas VIRTUAL son proyección y se excluyen siempre.",
      "Saldos y valores finales son fotos por período: no sumarlos a través de varios meses; agrupar por período o tomar el último.",
      "Es la fuente principal para análisis mensual de depreciación. La relación con el catálogo es por asset_code, pero V-Ai v1 no cruza fuentes.",
    ],
    defaultDateField: "period_date",
    relations: [{ field: "asset_code", source: "fixassets_catalogue", targetField: "asset_code", description: "Depreciación → activo." }],
    keywords: ["depreciación", "depreciacion", "mensual", "período", "periodo", "provisión", "activo", "saldo", "tasa", "pen", "usd"],
    enabled: true,
    access: { scopes: ["fixassets"] },
  },

  // ── Planta ────────────────────────────────────────────────────────────
  {
    id: "plant_shifts",
    name: "Balance metalúrgico por guardia",
    area: "planta",
    description:
      "Balance de planta por guardia (A/B): tonelaje, leyes de cabeza, gramos alimentados y producidos de Au/Ag, recuperación, horas de operación y parada, consumo de NaCN, soda y bolas.",
    endpoint: "/api/planta/balance",
    sqlView: "dw.v_plant_shift",
    grain: "Una fila por guardia (fecha + turno A/B).",
    fields: [
      f("shift_id", "Guardia", "attribute", "Identificador YYYYMMDD-A/B."),
      f("shift_date", "Fecha", "date", "Fecha oficial de la guardia; el turno nocturno pertenece a la fecha en la que inicia durante la segunda mitad del día.", "date", "date", ["guardia", "balance", "producción", "produccion"]),
      f("plant_shift", "Turno", "dimension", "A o B."),
      f("plant_supervisor", "Supervisor", "dimension", "Supervisor de la guardia."),
      f("tmh", "TMH", "measure", "Toneladas húmedas tratadas.", "number", "tmh"),
      f("h2o_pct", "Humedad", "measure", "Humedad como fracción (0-1).", "number", "fraction"),
      f("tms", "TMS", "measure", "Toneladas secas tratadas.", "number", "tms"),
      f("au_feed", "Ley Au cabeza (g/t)", "measure", "Ley de oro de alimentación.", "number", "grade_gt"),
      f("ag_feed", "Ley Ag cabeza (g/t)", "measure", "Ley de plata de alimentación.", "number", "grade_gt"),
      f("au_feed_g", "Au alimentado (g)", "measure", "Gramos de oro alimentados.", "number", "decimal"),
      f("ag_feed_g", "Ag alimentado (g)", "measure", "Gramos de plata alimentados.", "number", "decimal"),
      f("au_prod", "Au producido (g)", "measure", "Gramos de oro producidos.", "number", "decimal"),
      f("ag_prod", "Ag producido (g)", "measure", "Gramos de plata producidos.", "number", "decimal"),
      f("au_recu", "Recuperación Au", "measure", "Recuperación de oro como fracción (0-1).", "number", "fraction"),
      f("ag_recu", "Recuperación Ag", "measure", "Recuperación de plata como fracción (0-1).", "number", "fraction"),
      f("prod_ratio", "TMS/hora", "measure", "Toneladas secas por hora de operación.", "number", "decimal"),
      f("operation_hr", "Horas de operación", "measure", "Horas efectivas.", "number", "hours"),
      f("shift_stop_hr", "Horas de parada", "measure", "Horas de parada.", "number", "hours"),
      f("nacn_qty_kg", "NaCN (kg)", "measure", "Cianuro consumido.", "number", "kg"),
      f("naoh_qty_kg", "Soda cáustica (kg)", "measure", "Soda consumida.", "number", "kg"),
      f("nacn_ratio", "NaCN kg/TMS", "measure", "Ratio de cianuro.", "number", "decimal"),
      f("balls_total_kg", "Bolas (kg)", "measure", "Bolas de molienda consumidas.", "number", "kg"),
      f("ph_of", "pH overflow", "measure", "pH en overflow.", "number", "decimal"),
    ],
    metrics: [
      m("shifts_count", "Guardias", "Número de guardias.", "count", "integer"),
      m("tmh_total", "TMH tratadas", "Suma de TMH.", "sum", "tmh", { field: "tmh" }),
      m("tms_total", "TMS tratadas", "Suma de TMS.", "sum", "tms", { field: "tms" }),
      m("au_feed_g_total", "Au alimentado (g)", "Suma de gramos alimentados.", "sum", "decimal", { field: "au_feed_g" }),
      m("au_prod_g_total", "Au producido (g)", "Suma de gramos producidos.", "sum", "decimal", { field: "au_prod" }),
      m("ag_prod_g_total", "Ag producido (g)", "Suma de gramos de plata producidos.", "sum", "decimal", { field: "ag_prod" }),
      m("avg_au_feed", "Ley Au cabeza promedio", "Ley de oro ponderada por TMS.", "weighted_avg", "grade_gt", { field: "au_feed", weight: "tms" }),
      m("avg_ag_feed", "Ley Ag cabeza promedio", "Ley de plata ponderada por TMS.", "weighted_avg", "grade_gt", { field: "ag_feed", weight: "tms" }),
      m("au_recovery", "Recuperación Au", "Au producido / Au alimentado.", "ratio", "fraction", { numerator: "au_prod", denominator: "au_feed_g" }),
      m("ag_recovery", "Recuperación Ag", "Ag producido / Ag alimentado.", "ratio", "fraction", { numerator: "ag_prod", denominator: "ag_feed_g" }),
      m("operation_hours", "Horas de operación", "Suma de horas efectivas.", "sum", "hours", { field: "operation_hr" }),
      m("stop_hours", "Horas de parada", "Suma de horas de parada.", "sum", "hours", { field: "shift_stop_hr" }),
      m("nacn_total", "NaCN (kg)", "Suma de cianuro consumido.", "sum", "kg", { field: "nacn_qty_kg" }),
      m("naoh_total", "Soda (kg)", "Suma de soda consumida.", "sum", "kg", { field: "naoh_qty_kg" }),
      m("balls_total", "Bolas (kg)", "Suma de bolas consumidas.", "sum", "kg", { field: "balls_total_kg" }),
      m("nacn_ratio", "NaCN kg/TMS", "Cianuro por tonelada seca.", "ratio", "decimal", { numerator: "nacn_qty_kg", denominator: "tms" }),
      m("avg_prod_ratio", "TMS/hora promedio", "Promedio simple del rendimiento horario.", "avg", "decimal", { field: "prod_ratio" }),
    ],
    rules: [
      "shift_date es la fecha oficial de todas las consultas de guardia; el turno nocturno pertenece a la fecha en que inicia.",
      "Usar los KPIs del balance: TMH, TMS, Au producido, recuperación, horas de operación, horas de parada y consumos de reactivos.",
      "Solo las recuperaciones y NaCN/TMS se recalculan desde sumas base; las leyes se ponderan por TMS.",
      "No hay exclusiones de guardias anuladas, incompletas o de prueba.",
      "Supervisor y turno son clasificadores; no atribuirles causalidad ni conclusiones de desempeño.",
      "Las recuperaciones vienen como fracción 0-1.",
    ],
    defaultDateField: "shift_date",
    keywords: ["planta", "guardia", "turno", "balance", "metalúrgico", "recuperación", "ley", "cabeza", "producción", "oro", "plata", "cianuro", "nacn", "soda", "bolas", "parada", "operación", "tms", "supervisor"],
    enabled: true,
    access: { scopes: ["planta"] },
  },

  // ── Refinería ─────────────────────────────────────────────────────────
  {
    id: "refinery_consumption",
    name: "Consumo de reactivos de refinería",
    area: "refinery",
    description: "Consumo de reactivos por campaña de refinería, fecha, reactivo y subproceso.",
    endpoint: "/api/refineria/consumption",
    sqlView: "dw.v_refinery_consumption",
    grain: "Una fila por campaña, reactivo y subproceso.",
    fields: [
      f("campaign_id", "Campaña", "dimension", "Identificador de la campaña."),
      f("consumption_date", "Fecha de consumo", "date", "Fecha en que se consumió el reactivo; referencia temporal del consumo.", "date", "date", ["consumo", "consumido", "reactivo"]),
      f("reagent_name", "Reactivo", "dimension", "Nombre del reactivo."),
      f("subprocess_name", "Subproceso", "dimension", "Subproceso de refinería."),
      f("consumption_qty", "Cantidad consumida", "measure", "Cantidad consumida en la unidad propia del reactivo.", "number", "decimal"),
    ],
    metrics: [
      m("consumption_total", "Consumo", "Suma de cantidad consumida.", "sum", "decimal", { field: "consumption_qty" }),
      m("campaigns_count", "Campañas", "Campañas distintas.", "count_distinct", "integer", { field: "campaign_id" }),
      m("reagents_count", "Reactivos", "Reactivos distintos.", "count_distinct", "integer", { field: "reagent_name" }),
    ],
    rules: ["Cada reactivo tiene su propia unidad: solo sumar filas del mismo reactivo y nunca consolidar reactivos distintos en un total común.", "consumption_date es la fecha efectiva del consumo y también su referencia temporal."],
    defaultDateField: "consumption_date",
    relations: [{ field: "campaign_id", source: "refinery_campaigns", targetField: "campaign_id", description: "Consumo → campaña." }],
    keywords: ["refinería", "refineria", "reactivo", "reactivos", "consumo", "campaña", "subproceso", "insumo"],
    enabled: true,
    access: { scopes: ["refinery"] },
  },
  {
    id: "refinery_entries",
    name: "Ingresos de reactivos de refinería",
    area: "refinery",
    description: "Entradas de reactivos al almacén de refinería por fecha y reactivo.",
    endpoint: "/api/refineria/entries",
    sqlView: "dw.v_refinery_entries",
    grain: "Una fila por ingreso (fecha + reactivo).",
    fields: [
      f("entry_date", "Fecha de ingreso", "date", "Fecha de la entrada.", "date", "date", ["ingreso", "entrada", "reactivo"]),
      f("reagent_name", "Reactivo", "dimension", "Nombre del reactivo."),
      f("entry_qty", "Cantidad ingresada", "measure", "Cantidad ingresada en la unidad del reactivo.", "number", "decimal"),
    ],
    metrics: [
      m("entries_total", "Ingresos", "Suma de cantidad ingresada.", "sum", "decimal", { field: "entry_qty" }),
      m("entries_count", "Registros", "Número de ingresos.", "count", "integer"),
    ],
    rules: ["Cada reactivo tiene su propia unidad; solo sumar ingresos del mismo reactivo."],
    defaultDateField: "entry_date",
    keywords: ["refinería", "reactivo", "ingreso", "entrada", "almacén", "stock"],
    enabled: true,
    access: { scopes: ["refinery"] },
  },
  {
    id: "refinery_stock",
    name: "Stock de reactivos de refinería",
    area: "refinery",
    description: "Stock total a la fecha por reactivo: total ingresado, total consumido y stock disponible.",
    endpoint: "/api/refineria/stock",
    sqlView: "dw.v_refinery_stock",
    grain: "Una fila por reactivo (estado actual, sin historia).",
    fields: [
      f("reagent_name", "Reactivo", "dimension", "Nombre del reactivo."),
      f("entry_qty", "Ingresado", "measure", "Total ingresado.", "number", "decimal"),
      f("consumption_qty", "Consumido", "measure", "Total consumido.", "number", "decimal"),
      f("stock_available", "Stock disponible", "measure", "Ingresado − consumido (GLP no lleva stock).", "number", "decimal"),
    ],
    metrics: [
      m("stock_total", "Stock", "Suma de stock disponible.", "sum", "decimal", { field: "stock_available" }),
      m("consumed_total", "Consumido", "Suma de consumo.", "sum", "decimal", { field: "consumption_qty" }),
      m("entered_total", "Ingresado", "Suma de ingresos.", "sum", "decimal", { field: "entry_qty" }),
    ],
    rules: ["Es el stock total vigente a la fecha y no un cierre diario ni un último movimiento.", "Sin fechas: no sirve para tendencias.", "Cada reactivo tiene su propia unidad; agrupar siempre por reactivo."],
    keywords: ["stock", "reactivo", "disponible", "refinería"],
    enabled: true,
    access: { scopes: ["refinery"] },
  },
  {
    id: "refinery_campaigns",
    name: "Campañas de refinería",
    area: "refinery",
    description: "Campañas de refinación: fecha, carbón húmedo y seco, humedad, leyes y contenido de Au, Ag y Cu.",
    endpoint: "/api/refineria/campaigns",
    sqlView: "dim.refinery_campaign",
    grain: "Una fila por campaña.",
    fields: [
      f("campaign_id", "Campaña", "dimension", "Identificador de la campaña."),
      f("campaign_date", "Inicio de campaña", "date", "Fecha referencial de inicio de la campaña y período al que pertenece.", "date", "date", ["campaña", "campana", "inicio"]),
      f("campaign_wet_cr", "Carbón húmedo (kg)", "measure", "Carbón rico húmedo.", "number", "kg"),
      f("campaign_moisture_pct", "Humedad %", "measure", "Humedad del carbón.", "number", "percent"),
      f("campaign_cr", "Carbón seco (kg)", "measure", "Carbón rico seco.", "number", "kg"),
      f("campaign_au_grade", "Ley Au", "measure", "Ley de oro del carbón.", "number", "decimal"),
      f("campaign_ag_grade", "Ley Ag", "measure", "Ley de plata del carbón.", "number", "decimal"),
      f("campaign_au", "Au (g)", "measure", "Gramos de oro de la campaña.", "number", "decimal"),
      f("campaign_ag", "Ag (g)", "measure", "Gramos de plata de la campaña.", "number", "decimal"),
      f("campaign_cu", "Cu", "measure", "Cobre de la campaña.", "number", "decimal"),
    ],
    metrics: [
      m("campaigns_count", "Campañas", "Número de campañas.", "count", "integer"),
      m("wet_cr_total", "Carbón húmedo (kg)", "Suma de carbón húmedo.", "sum", "kg", { field: "campaign_wet_cr" }),
      m("cr_total", "Carbón seco (kg)", "Suma de carbón seco.", "sum", "kg", { field: "campaign_cr" }),
      m("au_total", "Au (g)", "Suma de gramos de oro.", "sum", "decimal", { field: "campaign_au" }),
      m("ag_total", "Ag (g)", "Suma de gramos de plata.", "sum", "decimal", { field: "campaign_ag" }),
      m("avg_au_grade", "Ley Au promedio", "Ley de oro ponderada por carbón seco.", "weighted_avg", "decimal", { field: "campaign_au_grade", weight: "campaign_cr" }),
      m("avg_ag_grade", "Ley Ag promedio", "Ley de plata ponderada por carbón seco.", "weighted_avg", "decimal", { field: "campaign_ag_grade", weight: "campaign_cr" }),
      m("avg_wet_cr", "Carbón húmedo promedio", "Promedio simple de carbón húmedo por campaña.", "avg", "kg", { field: "campaign_wet_cr" }),
      m("avg_dry_cr", "Carbón seco promedio", "Promedio simple de carbón seco por campaña.", "avg", "kg", { field: "campaign_cr" }),
      m("avg_moisture", "Humedad promedio", "Promedio simple de humedad.", "avg", "percent", { field: "campaign_moisture_pct" }),
    ],
    rules: [
      "campaign_date es el inicio referencial y determina el período de la campaña.",
      "Las leyes Au y Ag se ponderan por carbón seco; humedad y carbón promedio se promedian, no se suman.",
      "Los GET disponibles no exponen costos de campaña. Si se pide costo por campaña o costo total, marcarlo como no disponible y no inferirlo desde consumos.",
    ],
    defaultDateField: "campaign_date",
    keywords: ["campaña", "campañas", "refinería", "carbón", "oro", "plata", "ley", "humedad"],
    enabled: true,
    access: { scopes: ["refinery"] },
  },

  // ── Logística ─────────────────────────────────────────────────────────
  {
    id: "logistics_requirements",
    name: "Requerimientos y órdenes de compra",
    area: "logistics",
    description:
      "Seguimiento de requerimientos de materiales: cantidades solicitadas, aprobadas, ordenadas y entregadas, estado del requerimiento y de la OC, proveedor, área solicitante, centro de costo y precio unitario.",
    endpoint: "/api/logistics/req-status",
    sqlView: "dw.logistics_req_status",
    grain: "Una fila por ítem de requerimiento (y su OC si existe).",
    fields: [
      f("req_num", "Requerimiento", "attribute", "Número de requerimiento."),
      f("req_date", "Fecha de requerimiento", "date", "Fecha de creación del requerimiento; fecha predeterminada para requerimientos.", "date", "date", ["requerimiento", "requerimientos", "solicitud"]),
      f("po_date", "Fecha de OC", "date", "Fecha de la orden de compra; usar cuando se piden compras u órdenes de compra.", "date", "date", ["compra", "compras", "orden de compra", "órdenes de compra", "ordenes de compra", "oc"]),
      f("po_est_delivery_date", "Entrega estimada", "date", "Fecha estimada de entrega.", "date", "date", ["entrega estimada", "fecha estimada"]),
      f("delivery_date", "Fecha de entrega", "date", "Fecha de entrega real; usar cuando se piden entregas.", "date", "date", ["entrega", "entregas", "envío", "envio"]),
      f("mat_code", "Código material", "dimension", "Identidad del material para consolidar cantidades."),
      f("mat_desc", "Material", "dimension", "Descripción del material."),
      f("mat_unit", "Unidad", "dimension", "Unidad de medida."),
      f("mat_group", "Grupo", "dimension", "Grupo de material."),
      f("mat_family", "Familia", "dimension", "Familia de material."),
      f("req_status", "Estado requerimiento", "dimension", "Estado del requerimiento."),
      f("po_status", "Estado OC", "dimension", "Estado de la orden de compra."),
      f("web_status", "Estado web", "dimension", "Estado de seguimiento registrado en la web."),
      f("priority_desc", "Prioridad", "dimension", "Prioridad asignada."),
      f("supplier_name", "Proveedor", "dimension", "Proveedor de la OC."),
      f("requester_desc", "Solicitante", "dimension", "Persona solicitante."),
      f("requester_area", "Área solicitante", "dimension", "Área que solicita."),
      f("cost_center_desc", "Centro de costo", "dimension", "CECO del requerimiento."),
      f("office_desc", "Oficina", "dimension", "Oficina."),
      f("warehouse_name", "Almacén", "dimension", "Almacén de destino."),
      f("po_num", "Orden de compra", "attribute", "Número de OC; vacío si no tiene."),
      f("qty_requested", "Cantidad solicitada", "measure", "Cantidad solicitada.", "number", "decimal"),
      f("qty_approved", "Cantidad aprobada", "measure", "Cantidad aprobada.", "number", "decimal"),
      f("qty_ordered", "Cantidad ordenada", "measure", "Cantidad en OC.", "number", "decimal"),
      f("qty_delivered", "Cantidad entregada", "measure", "Cantidad entregada.", "number", "decimal"),
      f("po_unit_price_us", "Precio unitario USD", "measure", "Precio unitario de la OC.", "number", "usd"),
    ],
    metrics: [
      m("items_count", "Ítems", "Número de ítems de requerimiento.", "count", "integer"),
      m("requirements_count", "Requerimientos", "Requerimientos distintos.", "count_distinct", "integer", { field: "req_num" }),
      m("items_without_po", "Ítems sin OC", "Ítems sin fecha de orden de compra.", "count", "integer", { where: [{ field: "po_date", op: "empty" }] }),
      m("items_with_po", "Ítems con OC", "Ítems con fecha de orden de compra.", "count", "integer", { where: [{ field: "po_date", op: "not_empty" }] }),
      m("items_without_delivery", "Ítems sin envío", "Ítems sin fecha de entrega.", "count", "integer", { where: [{ field: "delivery_date", op: "empty" }] }),
      m("qty_requested_total", "Cantidad solicitada", "Suma de cantidades solicitadas (unidades mixtas).", "sum", "decimal", { field: "qty_requested" }),
      m("qty_delivered_total", "Cantidad entregada", "Suma de cantidades entregadas (unidades mixtas).", "sum", "decimal", { field: "qty_delivered" }),
      m("delivery_pct", "% entregado", "Entregado / solicitado.", "ratio", "fraction", { numerator: "qty_delivered", denominator: "qty_requested" }),
      m("avg_unit_price", "Precio unitario promedio", "Precio unitario USD ponderado por cantidad ordenada.", "weighted_avg", "usd", { field: "po_unit_price_us", weight: "qty_ordered", where: [{ field: "po_unit_price_us", op: "gt", value: 0 }, { field: "qty_ordered", op: "gt", value: 0 }] }),
      m("avg_req_to_po_days", "Días requerimiento a OC", "Promedio de días calendario desde el requerimiento hasta la OC.", "avg_days_diff", "days", { field: "req_date", field2: "po_date" }),
      m("avg_po_to_est_delivery_days", "Días OC a entrega estimada", "Promedio de días calendario desde la OC hasta la entrega estimada.", "avg_days_diff", "days", { field: "po_date", field2: "po_est_delivery_date" }),
      m("avg_po_to_delivery_days", "Días OC a entrega real", "Promedio de días calendario desde la OC hasta la entrega real.", "avg_days_diff", "days", { field: "po_date", field2: "delivery_date" }),
      m("suppliers_count", "Proveedores", "Proveedores distintos.", "count_distinct", "integer", { field: "supplier_name" }),
    ],
    rules: [
      "La fuente contiene únicamente requerimientos activos.",
      "Sin po_date significa sin orden de compra; sin delivery_date significa sin envío.",
      "Las cantidades se consolidan cuando coincide el material: usar mat_code como identidad y mantener visible mat_unit para detectar inconsistencias de origen.",
      "El precio unitario USD se promedia ponderado por qty_ordered.",
      "No hay importe total de OC en esta fuente, solo precio unitario.",
    ],
    defaultDateField: "req_date",
    keywords: ["requerimiento", "requerimientos", "orden de compra", "oc", "compras", "proveedor", "material", "materiales", "logística", "entrega", "pendiente", "almacén", "solicitante", "prioridad"],
    enabled: true,
    access: { scopes: ["logistics"] },
  },

  // ── Flota ─────────────────────────────────────────────────────────────
  {
    id: "fleet_requirements",
    name: "Requerimientos de flota",
    area: "fleet",
    description:
      "Requerimientos de mantenimiento y repuestos por vehículo (placa): tipo, taller, fechas de ingreso y salida, odómetro, presupuesto aprobado y monto de OC.",
    endpoint: "/api/logistics/flota/req",
    sqlView: "dw.v_logistics_flota_req",
    grain: "Una fila por ítem de requerimiento de un vehículo.",
    fields: [
      f("req_num", "Requerimiento", "attribute", "Número de requerimiento."),
      f("plate", "Placa", "dimension", "Placa del vehículo."),
      f("req_date", "Fecha de requerimiento", "date", "Fecha predeterminada para consultas de mantenimiento.", "date", "date", ["mantenimiento", "requerimiento", "solicitud"]),
      f("entry_date", "Ingreso a taller", "date", "Fecha de ingreso al taller.", "date", "date", ["ingreso", "taller"]),
      f("exit_date", "Salida de taller", "date", "Fecha de salida del taller.", "date", "date", ["salida", "taller"]),
      f("po_date", "Fecha de OC", "date", "Fecha de la orden de compra.", "date", "date", ["orden de compra", "oc", "compra"]),
      f("po_num", "Orden de compra", "attribute", "Número de OC; identifica la cabecera cuyo importe puede repetirse entre ítems."),
      f("req_type", "Tipo", "dimension", "Tipo de requerimiento (mantenimiento, repuesto, etc.)."),
      f("repair_shop_name", "Taller", "dimension", "Taller o proveedor de servicio."),
      f("req_serv_status", "Estado de servicio", "dimension", "Estado del servicio de flota."),
      f("req_status", "Estado requerimiento", "dimension", "Estado del requerimiento."),
      f("po_status", "Estado OC", "dimension", "Estado de la OC."),
      f("mat_group", "Grupo", "dimension", "Grupo de material o servicio."),
      f("mat_desc", "Material / servicio", "dimension", "Descripción."),
      f("supplier_name", "Proveedor", "dimension", "Proveedor de la OC."),
      f("office_serv_desc", "Oficina de servicio", "dimension", "Oficina."),
      f("odometer_km", "Odómetro (km)", "measure", "Kilometraje al ingreso.", "number", "km"),
      f("po_amount_usd", "Monto OC USD", "attribute", "Importe de cabecera de la OC en USD; puede repetirse entre ítems y no se suma por fila.", "number", "usd"),
      f("app_budget_pen", "Presupuesto aprobado PEN", "measure", "Presupuesto aprobado en PEN.", "number", "pen"),
      f("qty_requested", "Cantidad solicitada", "measure", "Cantidad solicitada.", "number", "decimal"),
    ],
    metrics: [
      m("items_count", "Ítems", "Número de ítems.", "count", "integer"),
      m("vehicles_count", "Vehículos", "Placas distintas.", "count_distinct", "integer", { field: "plate" }),
      m("po_amount_usd_total", "Monto OC USD", "Suma cada importe de OC una sola vez por po_num.", "sum_distinct", "usd", { field: "po_amount_usd", distinctField: "po_num" }),
      m("budget_pen_total", "Presupuesto PEN", "Suma de presupuesto aprobado.", "sum", "pen", { field: "app_budget_pen" }),
      m("avg_odometer", "Odómetro promedio", "Promedio de kilometraje.", "avg", "km", { field: "odometer_km", where: [{ field: "odometer_km", op: "gt", value: 0 }] }),
      m("max_odometer", "Odómetro máximo", "Kilometraje máximo registrado.", "max", "km", { field: "odometer_km" }),
      m("avg_shop_days", "Días en taller", "Promedio de días calendario entre ingreso y salida.", "avg_days_diff", "days", { field: "entry_date", field2: "exit_date" }),
    ],
    rules: ["req_date es la fecha predeterminada para mantenimiento; ingreso, salida y OC solo se usan cuando el usuario pide ese hito.", "La placa es la identidad principal del vehículo.", "po_amount_usd puede repetirse entre ítems de la misma OC: sumar una sola vez por po_num.", "La permanencia en taller se expresa en días calendario.", "El presupuesto está en PEN y la OC en USD: no mezclarlos en un mismo total."],
    defaultDateField: "req_date",
    keywords: ["flota", "vehículo", "vehiculo", "placa", "taller", "mantenimiento", "repuesto", "odómetro", "kilometraje", "presupuesto", "oc"],
    enabled: true,
    access: { scopes: ["fleet_mgmt"] },
  },
  {
    id: "fleet_documents",
    name: "SOAT y revisión técnica de flota",
    area: "fleet",
    description: "Vencimientos de SOAT y revisión técnica vehicular por placa con su alerta.",
    endpoint: "/api/logistics/flota/soat-rtv",
    sqlView: "dw.v_logistics_flota_soat_rtv",
    grain: "Una fila por vehículo (placa).",
    fields: [
      f("plate", "Placa", "dimension", "Placa del vehículo."),
      f("soat_exp_date", "Vencimiento SOAT", "date", "Fecha de vencimiento del SOAT."),
      f("soat_alert", "Alerta SOAT", "dimension", "Estado de alerta del SOAT."),
      f("rtv_exp_date", "Vencimiento RTV", "date", "Fecha de vencimiento de la revisión técnica."),
      f("rtv_alert", "Alerta RTV", "dimension", "Estado de alerta de la revisión técnica."),
    ],
    metrics: [m("vehicles_count", "Vehículos", "Número de vehículos.", "count", "integer")],
    rules: ["La placa es la identidad principal.", "Rangos vigentes del módulo: Vencido; Por Renovar <15d; Por Renovar <30d; Activo por encima de 30 días; Sin Fecha cuando no existe vencimiento.", "Para semáforo: crítico hasta 15 días, advertencia de 16 a 30 días y vigente por encima de 30 días.", "Sin importes: solo conteos por alerta y fechas de vencimiento."],
    keywords: ["soat", "revisión técnica", "rtv", "vencimiento", "flota", "placa", "alerta"],
    enabled: true,
    access: { scopes: ["fleet_units"] },
  },
  {
    id: "fleet_units_gps",
    name: "Catálogo GPS de flota",
    area: "fleet",
    description: "Catálogo de unidades GPS con placa, identificador GPS, grupo, marca, modelo, color, serie y tipo de vehículo.",
    endpoint: "/api/logistics/flota/units",
    sqlView: "dw.v_logistics_flota_units",
    grain: "Una fila por vehicle_id.",
    temporalMode: "snapshot",
    fields: [
      f("vehicle_id", "ID de vehículo", "attribute", "Identificador de la unidad en el catálogo GPS."),
      f("vehicle_name", "Nombre de vehículo", "dimension", "Nombre de la unidad."),
      f("plate", "Placa normalizada", "dimension", "Placa en mayúsculas y sin guiones."),
      f("unit_plate", "Placa original", "attribute", "Placa tal como aparece en la vista."),
      f("gps_identifier", "Identificador GPS", "attribute", "Identificador del equipo GPS."),
      f("group_name", "Sede", "dimension", "Sede de la unidad."),
      f("brand", "Marca", "dimension", "Marca de la unidad."),
      f("model", "Modelo", "dimension", "Modelo de la unidad."),
      f("color", "Color", "dimension", "Color de la unidad."),
      f("serial_number", "Serie", "attribute", "Número de serie de la unidad."),
      f("vehicle_type", "Tipo de vehículo", "dimension", "Tipo de vehículo."),
    ],
    metrics: [
      m("units_count", "Unidades GPS", "Número de filas del catálogo GPS.", "count", "integer"),
      m("plates_count", "Placas", "Placas distintas no vacías.", "count_distinct", "integer", { field: "plate" }),
    ],
    rules: ["Es un catálogo actual sin fecha de análisis; no sirve para tendencias."],
    keywords: ["flota", "unidad", "unidades", "vehículo", "vehiculo", "placa", "gps", "marca", "modelo", "grupo", "catálogo"],
    enabled: true,
    access: { scopes: ["fleet_units"] },
  },
  {
    id: "fleet_fuel_units",
    name: "Ficha técnica de combustible",
    area: "fleet",
    description: "Ficha técnica actual por placa con capacidad de tanque, autonomía, referencia de consumo, factor y referencias ajustadas.",
    endpoint: "/api/logistics/flota/fuel-units",
    sqlView: "dw.v_logistics_flota_fuel_units",
    grain: "Una fila por placa.",
    temporalMode: "snapshot",
    fields: [
      f("plate", "Placa", "dimension", "Placa normalizada sin guiones."),
      f("vehicle_name", "Nombre de vehículo", "dimension", "Nombre de la unidad en la ficha técnica."),
      f("brand", "Marca", "dimension", "Marca de la unidad."),
      f("model", "Modelo", "dimension", "Modelo de la unidad."),
      f("tank_capacity", "Capacidad de tanque", "measure", "Capacidad actual en galones.", "number", "gal"),
      f("autonomia_km", "Autonomía", "measure", "Autonomía actual de ficha en kilómetros.", "number", "km"),
      f("l_100km_ref", "Referencia l/100 km", "measure", "Referencia actual de litros por 100 km.", "number", "l_100km"),
      f("factor_eff", "Factor de eficiencia", "measure", "Factor actual configurado; uno cuando no existe valor."),
      f("autonomia_adjusted_km", "Autonomía ajustada", "measure", "Autonomía multiplicada por el factor vigente.", "number", "km"),
      f("l_100km_adjusted", "Referencia ajustada l/100 km", "measure", "Referencia dividida entre el factor vigente.", "number", "l_100km"),
      f("updated_at", "Actualización", "attribute", "Fecha y hora de actualización de la ficha.", "datetime", "text"),
    ],
    metrics: [
      m("vehicles_count", "Placas con ficha", "Número de placas con ficha técnica.", "count", "integer"),
      m("avg_tank_capacity", "Capacidad promedio", "Promedio simple de capacidad por placa.", "avg", "gal", { field: "tank_capacity" }),
      m("avg_autonomia", "Autonomía promedio", "Promedio simple de autonomía por placa.", "avg", "km", { field: "autonomia_km" }),
      m("avg_l_100km_ref", "Referencia promedio", "Promedio simple de referencia l/100 km por placa.", "avg", "l_100km", { field: "l_100km_ref" }),
      m("avg_autonomia_adjusted", "Autonomía ajustada promedio", "Promedio simple de autonomía ajustada por placa.", "avg", "km", { field: "autonomia_adjusted_km" }),
      m("avg_l_100km_adjusted", "Referencia ajustada promedio", "Promedio simple de referencia ajustada por placa.", "avg", "l_100km", { field: "l_100km_adjusted" }),
    ],
    rules: [
      "Es una ficha técnica actual sin fecha de análisis; no sirve para tendencias históricas.",
      "El factor multiplica la autonomía y divide la referencia l/100 km; no modifica la capacidad del tanque.",
    ],
    keywords: ["flota", "ficha", "técnica", "tecnica", "combustible", "tanque", "capacidad", "autonomía", "autonomia", "litros por 100", "factor", "marca", "modelo"],
    enabled: true,
    access: { scopes: ["fleet_units"] },
  },
  {
    id: "fleet_fuel_refuels",
    name: "Vales de combustible",
    area: "fleet",
    description: "Todos los vales de abastecimiento, incluidas galoneras y unidades sin GPS, con cantidad, moneda, costo identificado, conductor, grifo y anomalía por capacidad.",
    endpoint: "/api/logistics/flota/fuel",
    sqlView: "stg.logistics_flota_fuel_cons + dw.v_logistics_flota_fuel_units",
    grain: "Una fila por vale individual.",
    defaultDateField: "date_cons",
    fields: fleetFuelFields(),
    metrics: fleetFuelMetrics(),
    rules: [
      "qty y tank_capacity están en galones.",
      "El exceso de tanque se calcula por vale; nunca como galones diarios menos capacidad.",
      "El cálculo de exceso excluye GAL*, MULTICAR y marcas GALONERA u OTROS.",
      "price_usd es un alias heredado del total original y no acredita moneda USD; usar cost_pen o cost_usd según currency_code.",
      "No convertir monedas ni sumar PEN y USD en un mismo total.",
      "La capacidad, autonomía, referencia y factor son atributos de ficha repetidos por vale; no se suman.",
    ],
    keywords: ["combustible", "vale", "vales", "abastecimiento", "tanqueo", "galones", "grifo", "conductor", "placa", "costo", "flota", "gasolina", "diésel", "diesel"],
    enabled: true,
    access: { scopes: ["fleet_mgmt"] },
  },
  {
    id: "fleet_fuel_alerts",
    name: "Tanqueos sobre capacidad",
    area: "fleet",
    description: "Detalle auditable de los vales cuyo abastecimiento supera la capacidad aplicable del tanque.",
    endpoint: "/api/logistics/flota/fuel-alerts",
    sqlView: "stg.logistics_flota_fuel_cons + dw.v_logistics_flota_fuel_units",
    grain: "Una fila por vale individual con exceso sobre capacidad.",
    defaultDateField: "date_cons",
    fields: fleetFuelFields(),
    metrics: fleetFuelMetrics(),
    rules: [
      "La fuente ya contiene únicamente vales con excess_gal mayor que cero.",
      "El exceso se calcula por vale y excluye GAL*, MULTICAR y marcas GALONERA u OTROS.",
      "price_usd no acredita moneda USD; usar excess_pen y excess_usd según la moneda normalizada, sin convertirlas ni mezclarlas.",
    ],
    keywords: ["combustible", "alerta", "anomalía", "anomalia", "exceso", "sobre capacidad", "tanqueo", "vale", "galones", "flota", "auditoría", "auditoria"],
    enabled: true,
    access: { scopes: ["fleet_mgmt"] },
  },
  {
    id: "fleet_gps_distance",
    name: "Recorridos GPS diarios",
    area: "fleet",
    description: "Recorrido diario válido por equipo GPS y placa, sin exigir que exista un abastecimiento de combustible ese día.",
    endpoint: "/api/logistics/flota/dist",
    sqlView: "dw.v_logistics_flota_dist",
    grain: "Una fila por gps_identifier y cal_date.",
    fields: [
      f("gps_identifier", "Identificador GPS", "attribute", "Identificador del equipo GPS."),
      f("cal_date", "Fecha de recorrido", "date", "Fecha operativa del recorrido.", "date", "date", ["recorrido", "distancia", "gps", "kilómetros", "kilometros"]),
      f("report_date", "Fecha de reporte", "attribute", "Fecha original del reporte GPS.", "date", "date"),
      f("report_time", "Hora de reporte", "attribute", "Hora original del reporte GPS."),
      f("report_datetime", "Fecha y hora de reporte", "attribute", "Marca temporal original del reporte GPS.", "datetime", "text"),
      f("plate", "Placa", "dimension", "Placa normalizada sin guiones."),
      f("unit_plate", "Placa original", "attribute", "Placa tal como aparece en la vista."),
      f("vehicle_name", "Vehículo", "dimension", "Nombre de la unidad."),
      f("group_name", "Sede", "dimension", "Sede de la unidad."),
      f("driver_name", "Conductor", "dimension", "Conductor informado por GPS."),
      f("odometer_meters", "Recorrido (m)", "measure", "Recorrido diario expresado en metros."),
      f("odometer_km", "Recorrido GPS", "measure", "Recorrido diario expresado en kilómetros; no es odómetro acumulado.", "number", "km"),
      f("gps_battery", "Batería GPS", "measure", "Valor de batería GPS informado por la vista."),
      f("vehicle_battery", "Batería del vehículo", "measure", "Valor de batería del vehículo informado por la vista."),
      f("address", "Dirección", "attribute", "Dirección asociada al reporte."),
    ],
    metrics: [
      m("gps_days_count", "Registros equipo-día", "Número de combinaciones equipo GPS y día.", "count", "integer"),
      m("gps_devices_count", "Equipos GPS", "Identificadores GPS distintos.", "count_distinct", "integer", { field: "gps_identifier" }),
      m("vehicles_count", "Placas con recorrido", "Placas distintas con recorrido.", "count_distinct", "integer", { field: "plate" }),
      m("distance_total", "Recorrido GPS", "Suma del recorrido diario válido.", "sum", "km", { field: "odometer_km" }),
    ],
    defaultDateField: "cal_date",
    rules: [
      "odometer_km es recorrido diario calculado por la vista; no es un odómetro acumulado.",
      "La fuente incluye recorridos válidos aunque el día no tenga combustible.",
      "gps_battery y vehicle_battery se muestran como valores de origen sin asumir unidad ni escala.",
    ],
    keywords: ["flota", "gps", "recorrido", "recorridos", "distancia", "kilómetros", "kilometros", "placa", "conductor", "batería", "bateria", "dirección"],
    enabled: true,
    access: { scopes: ["fleet_mgmt"] },
  },
  {
    id: "fleet_fuel_distance_legacy",
    name: "Cruce diario heredado de combustible y GPS",
    area: "fleet",
    description: "Cruce diario heredado entre recorrido y combustible para el universo de placas y sedes definido por la vista original.",
    endpoint: "/api/logistics/flota/dist-cons-rat",
    sqlView: "dw.v_logistics_flota_dist_cons_rat",
    grain: "Una fila por placa y cal_date.",
    fields: [
      f("plate", "Placa", "dimension", "Placa normalizada sin guiones."),
      f("cal_date", "Fecha", "date", "Fecha del cruce diario.", "date", "date", ["recorrido", "consumo", "combustible", "gps"]),
      f("odometer_km", "Recorrido GPS", "measure", "Recorrido diario; no es odómetro acumulado.", "number", "km"),
      f("qty", "Galones abastecidos", "measure", "Galones del día.", "number", "gal"),
      f("unit_price", "Precio unitario diario", "measure", "Promedio de precios de los vales del día; no reconstruye el costo real."),
      f("group_name", "Sede", "dimension", "Sede definida por la vista heredada."),
      f("brand", "Marca", "dimension", "Marca de ficha técnica."),
      f("model", "Modelo", "dimension", "Modelo de ficha técnica."),
      f("tank_capacity", "Capacidad de tanque", "attribute", "Capacidad de ficha en galones; no se suma.", "number", "gal"),
      f("autonomia_km", "Autonomía de ficha", "attribute", "Autonomía de ficha en kilómetros; no se suma.", "number", "km"),
      f("l_100km_ref", "Referencia l/100 km", "attribute", "Referencia de ficha; no se suma.", "number", "l_100km"),
      f("factor_eff", "Factor de eficiencia", "attribute", "Factor configurado en ficha; no se suma."),
      f("alerta_i", "Alerta heredada", "attribute", "Cálculo diario heredado de la vista."),
      f("alerta_i_pen", "Alerta heredada PEN", "attribute", "Cálculo diario heredado expresado en PEN."),
    ],
    metrics: [
      m("vehicle_days", "Vehículo-días", "Número de filas placa-día.", "count", "integer"),
      m("vehicles_count", "Placas", "Placas distintas.", "count_distinct", "integer", { field: "plate" }),
      m("distance_total", "Recorrido GPS", "Suma de recorrido diario.", "sum", "km", { field: "odometer_km" }),
      m("qty_total", "Galones abastecidos", "Suma de galones diarios.", "sum", "gal", { field: "qty" }),
    ],
    rules: [
      "Usar esta fuente solo cuando el usuario pida explícitamente el cruce heredado o dist-cons-rat; para consultas normales usar fuel-summary.",
      "No cambia el universo de placas y sedes definido por la vista original.",
      "unit_price es el promedio del precio de los vales del día; no usarlo para reconstruir costo real.",
      "alerta_i y alerta_i_pen son cálculos diarios heredados; para anomalías auditables por vale usar Tanqueos sobre capacidad.",
    ],
    defaultDateField: "cal_date",
    keywords: ["dist-cons-rat", "cruce heredado", "alerta heredada", "alerta_i", "alerta_i_pen"],
    explicitOnly: true,
    enabled: true,
    access: { scopes: ["fleet_mgmt"] },
  },
  fleetFuelSummarySource("month"),
  fleetFuelSummarySource("day"),
];

export const VAI_SOURCE_MAP: ReadonlyMap<string, VaiSource> = new Map(
  VAI_SOURCES.map((source) => [source.id, source]),
);

export function vaiSource(id: string) {
  const source = VAI_SOURCE_MAP.get(id);
  return source && source.enabled ? source : null;
}

export function vaiField(source: VaiSource, id: string) {
  return source.fields.find((field) => field.id === id) ?? null;
}

export function vaiMetric(source: VaiSource, id: string) {
  return source.metrics.find((metric) => metric.id === id) ?? null;
}

export function vaiAreaLabel(area: VaiArea) {
  return VAI_AREAS.find((item) => item.id === area)?.label ?? area;
}

// ── DATES ─────────────────────────────────────────────────────────

export type VaiDateRange = { from: string; to: string };

export function validIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

/** Recupera un único mes explícito; no interpreta comparaciones ni rangos ambiguos. */
export function requestedMonth(text: string): VaiDateRange | null {
  const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const hits = [...normalized.matchAll(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)\b/g)];
  const years = [...normalized.matchAll(/\b(20\d{2})\b/g)];
  if (hits.length !== 1 || years.length !== 1 || /\b(?:desde|hasta|entre)\b/.test(normalized)) return null;
  const month = months.indexOf(hits[0][1].replace("setiembre", "septiembre")) + 1;
  const year = Number(years[0][1]);
  return { from: `${year}-${String(month).padStart(2, "0")}-01`, to: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) };
}

export function limaToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)?.value).join("-");
}

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export function presetRange(preset: VaiDatePreset, today = limaToday()): VaiDateRange {
  if (preset === "last_7_days") return { from: addDays(today, -6), to: today };
  if (preset === "last_30_days") return { from: addDays(today, -29), to: today };
  if (preset === "year_to_date") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  if (preset === "current_month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (preset === "previous_month") {
    const to = addDays(`${today.slice(0, 7)}-01`, -1);
    return { from: `${to.slice(0, 7)}-01`, to };
  }
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const from = addDays(today, -weekday - (preset === "previous_week" ? 7 : 0));
  return { from, to: preset === "previous_week" ? addDays(from, 6) : today };
}

// ── SPEC ─────────────────────────────────────────────────────────

//
// Especificación estructurada de dashboard V-Ai (schema v1) y su validación.
// El modelo solo produce esta estructura; el renderer es fijo. Todo lo que no
// exista en el catálogo se descarta aquí, server-side, antes de tocar datos.


export const VAI_SPEC_VERSION = 1;
export const VAI_PROMPT_MAX = 1200;
export const VAI_MAX_SOURCES = 3;
export const VAI_MAX_WIDGETS = 10;
export const VAI_MAX_FILTERS = 6;
export const VAI_MAX_LIMIT = 50;
export const VAI_MAX_TABLE_LIMIT = 50000;

export const VAI_WIDGET_TYPES = ["kpi", "line", "bar", "rank", "donut", "table"] as const;
export type VaiWidgetType = (typeof VAI_WIDGET_TYPES)[number];

export const VAI_BUCKETS = ["day", "week", "month"] as const;
export type VaiBucket = (typeof VAI_BUCKETS)[number];

export const VAI_DATE_PRESETS = [
  "last_7_days",
  "last_30_days",
  "current_week",
  "previous_week",
  "current_month",
  "previous_month",
  "year_to_date",
] as const;
export type VaiDatePreset = (typeof VAI_DATE_PRESETS)[number];

export type VaiFilterSpec =
  | { kind: "date_range"; source: string; field: string; label: string; preset: VaiDatePreset | null; from?: string | null; to?: string | null }
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
  summaries?: VaiSummarySpec[];
};

export const VAI_SUMMARY_OPERATIONS = ["auto", "sum", "avg", "min", "max", "none"] as const;
export type VaiSummaryOperation = (typeof VAI_SUMMARY_OPERATIONS)[number];
export type VaiSummarySpec = { column: string; operation: VaiSummaryOperation };

export type VaiDashboardSpec = {
  version: typeof VAI_SPEC_VERSION;
  title: string;
  description: string;
  sources: string[];
  filters: VaiFilterSpec[];
  widgets: VaiWidgetSpec[];
};

export type VaiRawFilter = { kind: string; source: string; field: string; label: string; preset: string | null; from?: string | null; to?: string | null };
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
  summaries?: { column: string; operation: string }[];
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

function normalizePromptText(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function requestedPresetFromPrompt(userPrompt: string): VaiDatePreset | null {
  const prompt = normalizePromptText(userPrompt);
  if (/\b(ultimos? 7 dias|ultima semana)\b/.test(prompt)) return "last_7_days";
  if (/\bultimos? 30 dias\b/.test(prompt)) return "last_30_days";
  if (/\b(esta semana|semana actual)\b/.test(prompt)) return "current_week";
  if (/\b(semana pasada|semana anterior)\b/.test(prompt)) return "previous_week";
  if (/\b(este mes|mes actual)\b/.test(prompt)) return "current_month";
  if (/\b(mes pasado|mes anterior)\b/.test(prompt)) return "previous_month";
  if (/\b(este ano|ano actual|ytd)\b/.test(prompt)) return "year_to_date";
  return null;
}

function requestsAllHistory(userPrompt: string) {
  const prompt = normalizePromptText(userPrompt);
  return /\b(todo el historico|todo historico|historico completo|sin limite de fecha|sin filtro de fecha)\b/.test(prompt);
}

function dateFieldForPrompt(source: VaiSource, userPrompt: string) {
  const prompt = normalizePromptText(userPrompt);
  let selected = source.defaultDateField ? vaiField(source, source.defaultDateField) : null;
  let bestLength = 0;
  for (const field of source.fields) {
    if (field.role !== "date") continue;
    for (const keyword of field.dateFilterKeywords ?? []) {
      const term = normalizePromptText(keyword);
      if (term && term.length > bestLength && prompt.includes(term)) {
        selected = field;
        bestLength = term.length;
      }
    }
  }
  if (
    source.id === "fixassets_catalogue" &&
    selected?.id === "acquisition_date" &&
    requestedMonth(userPrompt) &&
    /\bactivos? de\b/.test(prompt)
  ) {
    bestLength = Math.max(bestLength, 1);
  }
  return { field: selected, explicit: bestLength > 0 };
}

function snapshotDateWasExplicitlyRequested(
  source: VaiSource,
  field: ReturnType<typeof vaiField>,
  userPrompt: string,
) {
  if (source.temporalMode !== "snapshot" || !userPrompt.trim() || !field) {
    return true;
  }

  const prompt = normalizePromptText(userPrompt);
  if (
    source.id === "fixassets_catalogue" &&
    field.id === "acquisition_date" &&
    requestedMonth(userPrompt) &&
    /\bactivos? de\b/.test(prompt)
  ) {
    return true;
  }
  const terms = [
    field.label,
    field.id.replace(/_/g, " "),
    ...(field.dateFilterKeywords ?? []),
  ]
    .map(normalizePromptText)
    .filter(Boolean);

  return terms.some((term) => prompt.includes(term));
}

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
              preset: item.preset == null ? null : clean(item.preset, 30),
              from: item.from == null ? null : clean(item.from, 30),
              to: item.to == null ? null : clean(item.to, 30),
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
              summaries: Array.isArray(item.summaries) ? item.summaries.filter(isRecord).slice(0, 12).map((summary) => ({ column: clean(summary.column, 80), operation: clean(summary.operation, 20) })) : [],
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
  const maxMetrics = type === "kpi" ? 1 : type === "table" ? 6 : 3;
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
  if (raw.limit != null && Number.isFinite(raw.limit)) {
    const maxLimit = type === "table" ? VAI_MAX_TABLE_LIMIT : VAI_MAX_LIMIT;
    limit = Math.min(maxLimit, Math.max(1, Math.round(raw.limit)));
  }

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

  if (type === "table") {
    if (columns?.length) {
      dimension = null;
      dateField = null;
      limit = null;
      metrics.splice(0);
    } else if ((dimension || dateField) && metrics.length) {
      columns = null;
    } else {
      const preferred = [
        source.fields[0]?.id,
        dateField,
        dimension,
        ...source.fields
          .filter((field) => field.role === "measure")
          .map((field) => field.id),
        ...source.fields
          .filter((field) => field.role === "date")
          .map((field) => field.id),
        ...source.fields
          .filter((field) => field.role === "dimension")
          .map((field) => field.id),
        ...source.fields
          .filter((field) => field.role === "attribute")
          .map((field) => field.id),
      ].filter((id): id is string => Boolean(id));

      columns = [...new Set(preferred)].slice(0, 10);
      dimension = null;
      dateField = null;
      metrics.splice(0);
    }
  }

  const summaries: VaiSummarySpec[] = [];
  for (const summary of raw.summaries ?? []) {
    const field = columns?.includes(summary.column) ? vaiField(source, summary.column) : null;
    const metric = metrics.includes(summary.column) ? vaiMetric(source, summary.column) : null;
    const numeric = field?.role === "measure" && field.type === "number";
    const sumAllowed = metric ? ["sum", "count"].includes(metric.agg) : source.metrics.some((item) => item.field === summary.column && item.agg === "sum" && !item.where?.length);
    if ((!numeric && !metric) || !VAI_SUMMARY_OPERATIONS.includes(summary.operation as VaiSummaryOperation) || (summary.operation === "sum" && !sumAllowed)) {
      notes.push(`${label}: no se aplica ${summary.operation} a «${summary.column}»; se conserva el resumen del catálogo.`);
      continue;
    }
    if (!summaries.some((item) => item.column === summary.column)) summaries.push({ column: summary.column, operation: summary.operation as VaiSummaryOperation });
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
    summaries,
  };
}

function validateFilter(
  raw: VaiRawFilter,
  sources: Set<string>,
  notes: string[],
  userPrompt: string,
): VaiFilterSpec | null {
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

  if (
    raw.kind === "date_range" &&
    source.temporalMode === "snapshot" &&
    userPrompt.trim() &&
    !snapshotDateWasExplicitlyRequested(source, field, userPrompt)
  ) {
    return null;
  }

  if (raw.kind === "select" && field.role !== "dimension") {
    notes.push(`${label}: «${field.label}» no es una dimensión filtrable.`);
    return null;
  }

  if (raw.kind === "date_range") {
    const preset =
      raw.preset && VAI_DATE_PRESETS.includes(raw.preset as VaiDatePreset)
        ? (raw.preset as VaiDatePreset)
        : null;

    let from = raw.from ? validIsoDate(raw.from) : null;
    let to = raw.to ? validIsoDate(raw.to) : null;
    if ((raw.from && !from) || (raw.to && !to) || (from && to && from > to)) {
      notes.push(`${label}: el rango de fechas no es válido.`);
      return null;
    }
    if (!from && !to) {
      const requested = requestedMonth(raw.label) ?? requestedMonth(userPrompt);
      if (requested) ({ from, to } = requested);
    }
    return {
      kind: "date_range",
      source: source.id,
      field: field.id,
      label: raw.label || field.label,
      preset: from || to ? null : preset,
      from,
      to,
    };
  }

  return {
    kind: "select",
    source: source.id,
    field: field.id,
    label: raw.label || field.label,
  };
}

/**
 * Valida la salida del modelo contra el catálogo. Descarta de forma controlada
 * cada parte inválida y la reporta en `notes`; devuelve `spec: null` si no
 * queda ningún widget utilizable.
 */
export function validateModelOutput(output: VaiModelOutput, userPrompt = ""): VaiValidation {
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
    const filter = validateFilter(raw, sourceSet, notes, userPrompt);
    if (filter && !filters.some((item) => item.kind === filter.kind && item.source === filter.source && item.field === filter.field)) {
      filters.push(filter);
    }
  }

  // Toda fuente de eventos recibe un período explícito. Si el modelo omitió el
  // filtro, se recupera el mes solicitado o se aplica el inicio operativo 2026.
  if (!requestsAllHistory(userPrompt)) {
    const month = requestedMonth(userPrompt);
    const preset = requestedPresetFromPrompt(userPrompt);
    for (const sourceId of sources) {
      if (filters.length >= VAI_MAX_FILTERS) break;
      const source = VAI_SOURCE_MAP.get(sourceId);
      const selected = source ? dateFieldForPrompt(source, userPrompt) : null;
      const field = selected?.field;
      if (!source || (source.temporalMode === "snapshot" && !selected?.explicit) || !field || field.role !== "date") continue;
      if (filters.some((filter) => filter.kind === "date_range" && filter.source === sourceId)) continue;
      filters.push({
        kind: "date_range",
        source: sourceId,
        field: field.id,
        label: field.label,
        preset: month ? null : preset,
        from: month?.from ?? (preset ? null : "2026-01-01"),
        to: month?.to ?? (preset ? null : limaToday()),
      });
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
export function parseStoredSpec(raw: unknown, userPrompt = ""): VaiValidation {
  if (!isRecord(raw)) return { spec: null, notes: ["La configuración guardada no es válida."] };
  const output: VaiModelOutput = {
    status: "ok",
    message: "",
    unavailable: [],
    dashboard: coerceModelOutput({ dashboard: raw })?.dashboard ?? null,
  };
  return validateModelOutput(output, userPrompt);
}

export function specSources(spec: VaiDashboardSpec): VaiSource[] {
  return spec.sources.map((id) => VAI_SOURCE_MAP.get(id)).filter((source): source is VaiSource => Boolean(source));
}

// ── ENGINE ─────────────────────────────────────────────────────────

//
// Motor de cálculo de V-Ai: recibe las filas reales de un endpoint autorizado
// y una especificación ya validada, y produce los datos de cada widget.
// Corre en el navegador; los datos nunca pasan por el modelo. Toda agregación
// proviene de las métricas declaradas en el catálogo.


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
    case "days":
      return `${num(n, 1)} días`;
    case "km":
      return `${num(n, 0)} km`;
    case "gal":
      return `${num(n, 2)} gal`;
    case "km_per_gal":
      return `${num(n, 2)} km/gal`;
    case "l_100km":
      return `${num(n, 2)} l/100 km`;
    case "pen_per_km":
      return `S/ ${num(n, 2)}/km`;
    case "pen_per_gal":
      return `S/ ${num(n, 2)}/gal`;
    case "usd_per_gal":
      return `USD ${num(n, 2)}/gal`;
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
    case "gal":
      return { digits: 2, unit: " gal", scale: 1 };
    case "km_per_gal":
      return { digits: 2, unit: " km/gal", scale: 1 };
    case "l_100km":
      return { digits: 2, unit: " l/100 km", scale: 1 };
    case "pen_per_km":
      return { digits: 2, unit: " PEN/km", scale: 1 };
    case "pen_per_gal":
      return { digits: 2, unit: " PEN/gal", scale: 1 };
    case "usd_per_gal":
      return { digits: 2, unit: " USD/gal", scale: 1 };
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
    case "days":
      return { digits: 1, unit: " días", scale: 1 };
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
    case "days":
      return "days";
    case "km":
      return "km";
    case "gal":
      return "gal";
    case "km_per_gal":
      return "km_per_gal";
    case "l_100km":
      return "l_100km";
    case "pen_per_km":
      return "pen_per_km";
    case "pen_per_gal":
      return "pen_per_gal";
    case "usd_per_gal":
      return "usd_per_gal";
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
    case "eq": {
      const numeric = typeof condition.value === "number" ? toNumber(raw) : null;
      return numeric == null ? text === String(condition.value ?? "").toUpperCase() : numeric === condition.value;
    }
    case "ne": {
      const numeric = typeof condition.value === "number" ? toNumber(raw) : null;
      return numeric == null ? text !== String(condition.value ?? "").toUpperCase() : numeric !== condition.value;
    }
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
  const subset = rows.filter(
    (row) =>
      passes(row, metric.where) &&
      (!metric.whereAny?.length || metric.whereAny.some((condition) => matches(row, condition))),
  );
  const values = (field: string | undefined) =>
    field ? subset.map((row) => toNumber(row[field])).filter((v): v is number => v != null) : [];
  switch (metric.agg) {
    case "count":
      return subset.length;
    case "count_distinct":
      return new Set(subset.map((row) => toText(row[metric.field ?? ""])).filter(Boolean)).size;
    case "sum":
      return values(metric.field).reduce((sum, v) => sum + v, 0);
    case "sum_distinct": {
      const unique = new Map<string, number>();
      for (const row of subset) {
        const key = toText(row[metric.distinctField ?? ""]);
        const value = toNumber(row[metric.field ?? ""]);
        if (key && value != null && !unique.has(key)) unique.set(key, value);
      }
      return [...unique.values()].reduce((sum, value) => sum + value, 0);
    }
    case "sum_per_distinct": {
      const keys = new Set(subset.map((row) => toText(row[metric.distinctField ?? ""])).filter(Boolean));
      if (!keys.size) return null;
      return values(metric.field).reduce((sum, value) => sum + value, 0) / keys.size;
    }
    case "count_per_distinct": {
      const keys = new Set(subset.map((row) => toText(row[metric.distinctField ?? ""])).filter(Boolean));
      return keys.size ? subset.length / keys.size : null;
    }
    case "sum_diff":
      return (
        values(metric.field).reduce((sum, value) => sum + value, 0) -
        values(metric.field2).reduce((sum, value) => sum + value, 0)
      );
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
      if (metric.agg === "ratio") return denominator ? (numerator / denominator) * (metric.multiplier ?? 1) : null;
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
    case "avg_days_diff": {
      const list = subset.map((row) => hoursBetween(row[metric.field ?? ""], row[metric.field2 ?? ""])).filter((v): v is number => v != null);
      return list.length ? list.reduce((sum, v) => sum + v / 24, 0) / list.length : null;
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
        const candidates = source.metrics.filter((metric) => metric.field === field.id && !metric.where?.length && !metric.whereAny?.length && ["sum", "sum_distinct", "avg", "min", "max", "weighted_avg"].includes(metric.agg));
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

// ── STORE ─────────────────────────────────────────────────────────

//
// Persistencia de dashboards V-Ai contra el backend (`/api/vai/dashboards*`,
// tabla stg.vai_dashboards_web). Solo se guarda la definición; los datos se
// vuelven a consultar al abrir. Ninguna de estas operaciones llama a OpenAI.


export type VaiDashboardRecord = {
  dashboard_id: number;
  dashboard_name: string;
  dashboard_desc: string | null;
  prompt_text: string;
  schema_version: number;
  model_name: string | null;
  source_ids: string | null;
  owner_key: string | null;
  visibility: string;
  created_at: string;
  updated_at: string;
};

export type VaiDashboardDetail = VaiDashboardRecord & { spec_json: string };

export async function listDashboards(): Promise<VaiDashboardRecord[]> {
  const out = await apiGet("/api/vai/dashboards");
  return Array.isArray(out?.rows) ? (out.rows as VaiDashboardRecord[]) : [];
}

export async function getDashboard(id: number): Promise<VaiDashboardDetail | null> {
  const out = await apiGet(`/api/vai/dashboards/${encodeURIComponent(String(id))}`);
  return (out?.row as VaiDashboardDetail | undefined) ?? null;
}

export async function saveDashboard(input: {
  dashboard_id?: number | null;
  name: string;
  description: string;
  prompt: string;
  spec: VaiDashboardSpec;
  model: string | null;
}): Promise<number> {
  const out = await apiPost("/api/vai/dashboards/insert", {
    dashboard_id: input.dashboard_id ?? null,
    dashboard_name: input.name,
    dashboard_desc: input.description,
    prompt_text: input.prompt,
    spec_json: JSON.stringify(input.spec),
    schema_version: VAI_SPEC_VERSION,
    model_name: input.model,
    source_ids: input.spec.sources.join(","),
  });
  return Number(out?.dashboard_id);
}

export async function deleteDashboard(id: number) {
  await apiPost("/api/vai/dashboards/delete", { dashboard_id: id });
}

// ── EXPORT ─────────────────────────────────────────────────────────

export type VaiExportTable = { data: VaiTableData; rows: VaiTableRow[] };
export type VaiExportBlock = { title: string; kind: "kpi" | "chart" | "table"; element: HTMLElement | null; table?: VaiExportTable };

function fileName(title: string) {
  return title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ").trim().slice(0, 120) || "V-Ai";
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function excelFormat(format: VaiFormat) {
  const numeric = "#,##0.00";
  if (format === "usd") return `"USD "${numeric}`;
  if (format === "pen") return `"S/ "${numeric}`;
  if (format === "percent" || format === "fraction") return "0.00%";
  if (format === "integer") return "#,##0";
  if (format === "km") return '#,##0" km"';
  if (format === "gal") return '#,##0.00" gal"';
  if (format === "km_per_gal") return '#,##0.00" km/gal"';
  if (format === "l_100km") return '#,##0.00" l/100 km"';
  if (format === "pen_per_km") return '"S/ "#,##0.00"/km"';
  if (format === "pen_per_gal") return '"S/ "#,##0.00"/gal"';
  if (format === "usd_per_gal") return '"USD "#,##0.00"/gal"';
  if (format === "hours") return '#,##0.0" h"';
  if (format === "days") return '#,##0.0" días"';
  if (format === "grade_oztc") return '#,##0.000" oz/TC"';
  if (format === "grade_gt") return `${numeric}" g/t"`;
  if (["tmh", "tms", "kg", "oz"].includes(format)) return `${numeric}" ${format === "tmh" || format === "tms" ? format.toUpperCase() : format}"`;
  if (format === "date") return "dd/mm/yyyy";
  return format === "text" ? "@" : numeric;
}

export async function createTableWorkbook(title: string, table: VaiExportTable) {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  workbook.creator = "V-Ai · Veta Dorada";
  const sheet = workbook.addWorksheet("Datos", { views: [{ state: "frozen", ySplit: 4 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const { data, rows } = table;
  sheet.mergeCells(1, 1, 1, Math.max(1, data.columns.length));
  sheet.getCell(1, 1).value = title;
  sheet.getCell(1, 1).font = { name: "Arial", size: 18, bold: true, color: { argb: "FF0067AC" } };
  sheet.getRow(1).height = 32;
  sheet.getCell(2, 1).value = `${rows.length.toLocaleString("es-PE")} filas filtradas · todas las páginas`;
  sheet.getCell(2, 1).font = { name: "Arial", size: 10, color: { argb: "FF757679" } };
  sheet.getRow(4).values = data.columns.map((column) => column.label);
  rows.forEach((row) => sheet.addRow(row.map((value, index) => {
    const format = data.columns[index].format;
    if (format === "date") {
      const iso = toIsoDate(value);
      return iso ? new Date(`${iso}T00:00:00Z`) : null;
    }
    return format === "percent" && typeof value === "number" ? value / 100 : value;
  })));
  const end = 4 + rows.length;
  const summaries = summarizeTable(data, rows);
  const labelRow = sheet.getRow(end + 2);
  const totalRow = sheet.getRow(end + 3);
  summaries.forEach((summary, index) => {
    labelRow.getCell(index + 1).value = summary?.label ?? (index === 0 ? "Resumen" : null);
    if (!summary) return;
    const rule = data.summaryRules[index];
    const agg = rule?.operation === "auto" ? rule.metric?.agg : rule?.operation;
    const formulas: Record<string, string> = { sum: "SUM", min: "MIN", max: "MAX", avg: "AVERAGE" };
    const canFormula = agg && formulas[agg] && (rule?.operation !== "auto" || data.rowMembers.every((members) => members.length === 1) || agg === "sum");
    const value = data.columns[index].format === "percent" && summary.value != null ? summary.value / 100 : summary.value;
    const column = sheet.getColumn(index + 1).letter;
    totalRow.getCell(index + 1).value = canFormula && rows.length && value != null ? { formula: `${formulas[agg!]}(${column}5:${column}${end})`, result: value } : value;
  });
  data.columns.forEach((column, index) => {
    const col = sheet.getColumn(index + 1);
    col.numFmt = excelFormat(column.format);
    col.width = Math.min(50, Math.max(18, column.label.length + 3, ...rows.slice(0, 100).map((row) => String(row[index] ?? "").length + 2)));
    col.alignment = { vertical: "middle", horizontal: ["text", "date"].includes(column.format) ? "left" : "right" };
  });
  sheet.eachRow((row, number) => {
    if (number < 4) return;
    row.height = number === 4 ? 30 : 23;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: "Arial", size: 10, bold: number === 4 || number > end, color: { argb: number === 4 ? "FFFFFFFF" : "FF272727" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: number === 4 ? "FF0067AC" : number > end ? "FFFFEBC0" : number % 2 ? "FFF0F5F8" : "FFFFFFFF" } };
      if (number === 4) cell.alignment = { vertical: "middle", wrapText: true };
    });
  });
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(4, end), column: data.columns.length } };
  workbook.calcProperties.fullCalcOnLoad = true;
  return workbook;
}

export async function downloadTableExcel(title: string, table: VaiExportTable) {
  const workbook = await createTableWorkbook(title, table);
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());
  downloadBlob(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${fileName(title)}.xlsx`);
}

/** PDF propio: fondo hasta el borde, tablas completas y sin chrome de impresión. */
export async function createDashboardPdf(title: string, blocks: VaiExportBlock[], context: string[] = []): Promise<jsPDF> {
  const [{ jsPDF: Pdf }, { default: autoTable }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("jspdf-autotable"), import("html2canvas")]);
  await document.fonts.ready;
  const pdf = new Pdf({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  pdf.setProperties({ title, author: "Veta Dorada", creator: "V-Ai" });
  const css = getComputedStyle(document.documentElement);
  const theme = { canvas: css.getPropertyValue("--s-canvas").trim(), panel: css.getPropertyValue("--s-1").trim(), alternate: css.getPropertyValue("--s-2").trim(), ink: css.getPropertyValue("--ink").trim(), muted: css.getPropertyValue("--ink-2").trim(), blue: css.getPropertyValue("--brand-blue").trim(), gold: css.getPropertyValue("--brand-gold").trim() };
  const pad = 12, gap = 5, width = 297 - pad * 2;
  let started = false, x = pad, y = 0, rowHeight = 0;
  let previousKind: VaiExportBlock["kind"] | null = null;
  const heading = (headingTitle: string, paint = true) => {
    const headingWidth = pdf.internal.pageSize.getWidth() - pad * 2;
    if (paint) {
      pdf.setFillColor(theme.canvas);
      pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), "F");
      pdf.setFillColor(theme.gold);
      pdf.rect(pad, 10, 10, 1, "F");
    }
    pdf.setTextColor(theme.ink);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(17);
    const lines = pdf.splitTextToSize(headingTitle, headingWidth);
    if (paint) pdf.text(lines, pad, 21);
    let bottom = 23 + (lines.length - 1) * 7;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(theme.muted);
    pdf.setFontSize(8);
    for (const line of context) {
      const wrapped = pdf.splitTextToSize(line, headingWidth);
      if (paint) pdf.text(wrapped, pad, bottom + 4);
      bottom += wrapped.length * 4;
    }
    return bottom + 8;
  };
  const newPage = (pageTitle: string, pageWidth = 297, height = 210, paint = true) => {
    if (started || pageWidth !== 297 || height !== 210) {
      pdf.addPage([pageWidth, height], height > pageWidth ? "portrait" : "landscape");
      if (!started) pdf.deletePage(1);
    }
    started = true;
    x = pad; rowHeight = 0; y = heading(pageTitle, paint);
  };
  for (const block of blocks) {
    if (block.kind === "table" && block.table) {
      const { data, rows } = block.table;
      const summaries = summarizeTable(data, rows);
      const body = rows.map((row) => row.map((cell, index) => formatValue(cell, data.columns[index].format)));
      body.push(summaries.map((summary, index) => summary ? `${summary.label}\n${formatValue(summary.value, data.columns[index].format)}` : index === 0 ? `Resumen\n${rows.length.toLocaleString("es-PE")} filas` : ""));
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
      const columnWidths = data.columns.map((column, index) => {
        const contentWidth = body.reduce((max, row) => Math.max(max, ...row[index].split("\n").map((line) => pdf.getTextWidth(line) + 6)), 0);
        return Math.max(24, Math.min(column.format === "text" ? 60 : 40, Math.max(contentWidth, pdf.getTextWidth(column.label) + 6)));
      });
      // Formato apaisado según el ancho real: todas las columnas permanecen juntas.
      const totalWidth = columnWidths.reduce((sum, column) => sum + column, 0);
      const pageWidth = Math.max(297, totalWidth + pad * 2);
      newPage(block.title, pageWidth, Math.max(210, pageWidth * 210 / 297), false);
      autoTable(pdf, {
        head: [data.columns.map((column) => column.label)], body, startY: y,
        margin: { top: y, left: pad, right: pad, bottom: pad },
        styles: { font: "helvetica", fontSize: 9, cellPadding: 2.5, textColor: theme.ink, fillColor: theme.panel, lineWidth: 0, overflow: "linebreak" },
        headStyles: { fillColor: theme.blue, textColor: theme.ink, fontStyle: "bold" },
        alternateRowStyles: { fillColor: theme.alternate },
        columnStyles: Object.fromEntries(data.columns.map((column, index) => [index, { cellWidth: columnWidths[index] * (pageWidth - pad * 2) / totalWidth, halign: ["text", "date"].includes(column.format) ? "left" : "right" }])),
        rowPageBreak: "avoid",
        willDrawPage: () => { heading(block.title); },
        didParseCell: (hook) => { if (hook.section === "body" && hook.row.index === body.length - 1) { hook.cell.styles.fillColor = theme.blue; hook.cell.styles.fontStyle = "bold"; } },
      });
      // La siguiente gráfica comienza en una página nueva, sin cortar la tabla.
      y = 210; x = pad; rowHeight = 0;
      previousKind = "table";
      continue;
    }
    if (!block.element) continue;
    if (previousKind === "table") newPage(title);
    else if (previousKind && previousKind !== block.kind && x !== pad) { x = pad; y += rowHeight + gap; rowHeight = 0; }
    previousKind = block.kind;
    const kpiCount = blocks.filter((item) => item.kind === "kpi").length;
    const tileWidth = block.kind === "kpi" ? (width - gap * (Math.min(4, kpiCount) - 1)) / Math.min(4, kpiCount) : blocks.length === 1 ? width : (width - gap) / 2;
    if (block.kind === "kpi") {
      const label = block.element.querySelector(".vai-kpi > span")?.textContent ?? block.title;
      const value = block.element.querySelector(".vai-kpi > strong")?.textContent ?? "";
      const detail = block.element.querySelector(".vai-kpi > small")?.textContent ?? "";
      const inset = 4;
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
      const labels = pdf.splitTextToSize(label, tileWidth - inset * 2);
      pdf.setFontSize(7);
      const details = pdf.splitTextToSize(detail, tileWidth - inset * 2);
      const tileHeight = 22 + labels.length * 4 + details.length * 3;
      if (!started) newPage(title);
      if (x + tileWidth > 297 - pad + .1) { x = pad; y += rowHeight + gap; rowHeight = 0; }
      if (y + tileHeight > pdf.internal.pageSize.getHeight() - pad) newPage(title);
      pdf.setFillColor(theme.panel); pdf.roundedRect(x, y, tileWidth, tileHeight, 2, 2, "F");
      pdf.setFillColor(theme.gold); pdf.rect(x + inset, y, tileWidth - inset * 2, .6, "F");
      pdf.setTextColor(theme.muted); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
      pdf.text(labels, x + inset, y + 7);
      pdf.setTextColor(theme.ink); pdf.setFont("helvetica", "bold"); pdf.setFontSize(17);
      const valueSize = Math.min(17, 17 * (tileWidth - inset * 2) / Math.max(1, pdf.getTextWidth(value)));
      pdf.setFontSize(valueSize); pdf.text(value, x + inset, y + 15 + (labels.length - 1) * 4);
      pdf.setTextColor(theme.muted); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
      pdf.text(details, x + inset, y + 23 + (labels.length - 1) * 4);
      x += tileWidth + gap; rowHeight = Math.max(rowHeight, tileHeight);
      continue;
    }
    const canvas = await html2canvas(block.element, { scale: 2, backgroundColor: theme.canvas, logging: false, useCORS: true,
      ignoreElements: (element) => element.hasAttribute("data-vai-export-ignore") || element.classList.contains("trjk-chart-data"),
    });
    const tileHeight = (canvas.height / canvas.width) * tileWidth;
    if (!started) newPage(title, 297, Math.max(210, tileHeight + 70));
    if (x + tileWidth > 297 - pad + .1) { x = pad; y += rowHeight + gap; rowHeight = 0; }
    if (y + tileHeight > pdf.internal.pageSize.getHeight() - pad) newPage(title, 297, Math.max(210, tileHeight + 70));
    pdf.addImage(canvas, "PNG", x, y, tileWidth, tileHeight);
    x += tileWidth + gap;
    rowHeight = Math.max(rowHeight, tileHeight);
  }
  if (!started) newPage(title);
  return pdf;
}

export async function downloadDashboardPdf(title: string, blocks: VaiExportBlock[], context: string[] = []) {
  const pdf = await createDashboardPdf(title, blocks, context);
  pdf.save(`${fileName(title)}.pdf`);
}


