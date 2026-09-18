import type { jsPDF } from "jspdf";
import { apiGet, apiPost } from "./apiClient";
import { kardexPeriodKey } from "./trjKardex";
export type VaiFocus = "auto" | "kpis" | "trends" | "comparisons" | "detail";
export type VaiChartPreference = VaiWidgetType;
export type VaiArea = "kardex" | "traceability" | "fixassets" | "planta" | "refinery" | "logistics" | "fleet" | "finance";
export const VAI_AREAS: Array<{
    id: VaiArea;
    label: string;
}> = [
    { id: "kardex", label: "Kardex TRJ" },
    { id: "traceability", label: "Trazabilidad" },
    { id: "finance", label: "Finanzas" },
    { id: "fixassets", label: "Activos Fijos" },
    { id: "planta", label: "Planta" },
    { id: "refinery", label: "Refinería" },
    { id: "logistics", label: "Logística" },
    { id: "fleet", label: "Flota" },
];
export type VaiFieldType = "text" | "number" | "date" | "datetime";
export type VaiFormat = "integer" | "decimal" | "usd" | "pen" | "percent" | "fraction" | "tmh" | "tms" | "kg" | "oz" | "hours" | "days" | "months" | "km" | "gal" | "km_per_gal" | "l_100km" | "pen_per_km" | "usd_per_km" | "pen_per_gal" | "usd_per_gal" | "grade_oztc" | "grade_gt" | "g" | "m3" | "g_m3" | "kg_per_tms" | "date" | "text";
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
export type VaiConditionOp = "eq" | "ne" | "in" | "not_in" | "empty" | "not_empty" | "gt" | "gte" | "lt" | "lte" | "ends_with";
export type VaiCondition = {
    field: string;
    op: VaiConditionOp;
    value?: string | number | string[];
};
export type VaiAgg = "sum" | "avg" | "count" | "count_distinct" | "min" | "max" | "sum_distinct" | "sum_per_distinct" | "count_per_distinct" | "sum_diff" | "ratio" | "diff_pct" | "pct_change" | "weighted_avg" | "avg_hours_diff" | "avg_days_diff";
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
    multiplier?: number;
    weight?: string;
    where?: VaiCondition[];
    whereAny?: VaiCondition[];
};
export type VaiRelation = {
    field: string;
    source: string;
    targetField: string;
    description: string;
};
export type VaiQuery = {
    dateFields: string[];
    dimensions: string[];
};
export type VaiSource = {
    id: string;
    name: string;
    area: VaiArea;
    description: string;
    endpoint: string;
    sqlView: string;
    grain: string;
    temporalMode?: "event" | "snapshot";
    defaultDateField?: string;
    query?: VaiQuery;
    fields: VaiField[];
    metrics: VaiMetric[];
    exclusions?: VaiCondition[];
    rules: string[];
    relations?: VaiRelation[];
    keywords: string[];
    enabled: boolean;
    explicitOnly?: boolean;
    access: {
        scopes: string[];
    };
};
const f = (id: string, label: string, role: VaiFieldRole, description: string, type: VaiFieldType = role === "date" ? "date" : role === "measure" ? "number" : "text", format?: VaiFormat, dateFilterKeywords?: string[]): VaiField => ({
    id,
    label,
    role,
    type,
    description,
    format,
    ...(dateFilterKeywords?.length ? { dateFilterKeywords } : {}),
});
const m = (id: string, label: string, description: string, agg: VaiAgg, format: VaiFormat, extra: Partial<Omit<VaiMetric, "id" | "label" | "description" | "agg" | "format">> = {}): VaiMetric => ({ id, label, description, agg, format, ...extra });
const q = (dateFields: string[], dimensions: string[] = []): VaiQuery => ({ dateFields, dimensions });
const OPERATIONAL_MOVE: VaiCondition = { field: "movement_type", op: "eq", value: "OPERATIVO" };
const fleetFuelFields = (): VaiField[] => [
    f("operation_number", "Operación", "attribute", "Número de operación del vale."),
    f("item", "Ítem", "attribute", "Número de ítem del vale cuando la operación es numérica.", "number", "integer"),
    f("petro_plus_unique_number", "Identificador Petroperú", "attribute", "Identificador único entregado por la fuente Petroperú."),
    f("dispatch_note", "Nota de despacho", "attribute", "Nota de despacho del abastecimiento."),
    f("date_cons", "Fecha de abastecimiento", "date", "Fecha del vale de combustible.", "date", "date", ["abastecimiento", "consumo", "vale", "tanqueo"]),
    f("full_date_invoice", "Fecha y hora de abastecimiento", "attribute", "Marca de fecha y hora del vale.", "datetime", "text"),
    f("plate", "Placa", "dimension", "Placa normalizada sin guiones ni espacios."),
    f("plate_original", "Placa original", "attribute", "Placa tal como llegó desde la fuente de combustible."),
    f("vehicle_name", "Vehículo", "dimension", "Nombre de la unidad en la ficha técnica cuando existe."),
    f("driver_name", "Conductor", "dimension", "Conductor informado en el vale."),
    f("dni", "DNI conductor", "attribute", "DNI informado para el conductor."),
    f("type_fuel", "Combustible", "dimension", "Producto abastecido."),
    f("unit", "Unidad", "dimension", "Unidad de medida informada por la fuente."),
    f("unit_price", "Precio unitario original", "measure", "Precio unitario en la moneda original del vale.", "number", "decimal"),
    f("qty", "Galones abastecidos", "measure", "Cantidad abastecida usada por la operación de flota.", "number", "gal"),
    f("total_original", "Total original", "measure", "Importe original del vale antes de separar la moneda.", "number", "decimal"),
    f("currency_original", "Moneda original", "dimension", "Texto de moneda recibido de la fuente."),
    f("currency_code", "Moneda normalizada", "dimension", "PEN o vacío cuando no se reconoce."),
    f("cost_pen", "Costo PEN", "measure", "Total del vale solo cuando la moneda se reconoce como PEN.", "number", "pen"),
    f("province", "Provincia", "dimension", "Provincia del abastecimiento."),
    f("gas_station", "Grifo", "dimension", "Estación de servicio."),
    f("cost_center", "Centro de costo", "dimension", "Centro de costo original del vale."),
    f("group_name", "Sede", "dimension", "Sede normalizada desde el centro de costo, retirando marcas DONACION y GAL."),
    f("brand", "Marca", "dimension", "Marca de ficha técnica o clasificación especial."),
    f("model", "Modelo", "dimension", "Modelo de ficha técnica o clasificación especial."),
    f("tank_capacity", "Capacidad de tanque", "attribute", "Capacidad vigente en galones; se repite por vale y no se suma.", "number", "gal"),
    f("autonomia_km", "Autonomía de ficha", "attribute", "Autonomía vigente de ficha técnica.", "number", "km"),
    f("l_100km_ref", "Referencia l/100 km", "attribute", "Consumo de referencia vigente de ficha técnica.", "number", "l_100km"),
    f("factor_eff", "Factor de eficiencia", "attribute", "Factor técnico vigente; multiplica autonomía y divide l/100 km de referencia.", "number", "decimal"),
    f("is_vehicle", "Vehículo con ficha útil", "dimension", "Verdadero cuando la unidad puede participar en métricas de eficiencia."),
    f("is_tank_anomaly", "Tanqueo anómalo", "dimension", "Verdadero cuando un vale individual supera la capacidad aplicable."),
    f("excess_gal", "Exceso sobre tanque", "measure", "Galones por encima de la capacidad calculados por vale individual.", "number", "gal"),
    f("excess_pen", "Exceso PEN", "measure", "Costo del exceso cuando la moneda del vale es PEN.", "number", "pen"),
    f("updated_at", "Actualizado", "attribute", "Última actualización del registro de combustible.", "datetime", "text"),
];
const fleetFuelMetrics = (): VaiMetric[] => [
    m("refuel_count", "Abastecimientos", "Número de vales de combustible.", "count", "integer"),
    m("vehicles_count", "Placas abastecidas", "Placas distintas con abastecimiento.", "count_distinct", "integer", { field: "plate" }),
    m("qty_total", "Galones abastecidos", "Suma de galones de los vales.", "sum", "gal", { field: "qty" }),
    m("cost_pen_known", "Costo identificado PEN", "Suma de vales reconocidos como PEN; no convierte otras monedas.", "sum", "pen", { field: "cost_pen" }),
    m("avg_qty_per_vehicle", "Consumo promedio por vehículo", "Galones abastecidos divididos entre placas distintas.", "sum_per_distinct", "gal", { field: "qty", distinctField: "plate" }),
    m("avg_cost_pen_per_vehicle", "Costo PEN promedio por vehículo", "Costo PEN identificado dividido entre placas distintas con vales PEN.", "sum_per_distinct", "pen", { field: "cost_pen", distinctField: "plate", where: [{ field: "currency_code", op: "eq", value: "PEN" }] }),
    m("avg_cost_pen_per_gal", "Costo promedio por galón PEN", "Σ costo PEN / Σ galones de vales PEN.", "ratio", "pen_per_gal", { numerator: "cost_pen", denominator: "qty", where: [{ field: "currency_code", op: "eq", value: "PEN" }] }),
    m("anomaly_count", "Tanqueos anómalos", "Vales cuyo abastecimiento individual supera la capacidad aplicable.", "count", "integer", { where: [{ field: "excess_gal", op: "gt", value: 0 }] }),
    m("excess_gal_total", "Exceso sobre tanque", "Suma del exceso calculado por vale.", "sum", "gal", { field: "excess_gal" }),
    m("excess_pen_known", "Exceso identificado PEN", "Costo del exceso de vales reconocidos como PEN.", "sum", "pen", { field: "excess_pen" }),
];
const FLEET_FUEL_QUERY = q(["date_cons"], ["plate", "group_name", "brand", "model", "cost_center", "type_fuel", "gas_station", "driver_name", "currency_code"]);
const fleetDistanceFields = (): VaiField[] => [
    f("cal_date", "Fecha de recorrido", "date", "Fecha operativa del recorrido GPS.", "date", "date", ["recorrido", "distancia", "gps", "kilómetros", "kilometros"]),
    f("plate", "Placa", "dimension", "Placa normalizada sin guiones ni espacios."),
    f("unit_plate", "Placa original", "attribute", "Placa mostrada por la fuente GPS."),
    f("vehicle_name", "Vehículo", "dimension", "Nombre de la unidad."),
    f("group_name", "Sede", "dimension", "Última sede válida asociada al GPS para el día."),
    f("driver_name", "Conductor", "dimension", "Conductor del último reporte válido del día."),
    f("gps_devices_count", "Equipos GPS", "measure", "Cantidad de equipos GPS consolidados dentro de la placa-día.", "number", "integer"),
    f("gps_report_count", "Reportes GPS", "measure", "Cantidad de reportes GPS que participaron en el cálculo diario.", "number", "integer"),
    f("first_report_datetime", "Primer reporte", "attribute", "Primer reporte GPS del día.", "datetime", "text"),
    f("last_report_datetime", "Último reporte", "attribute", "Último reporte GPS del día.", "datetime", "text"),
    f("odometer_meters", "Recorrido (m)", "measure", "Recorrido diario válido expresado en metros.", "number", "decimal"),
    f("odometer_km", "Recorrido GPS", "measure", "Recorrido diario válido expresado en kilómetros; no es odómetro acumulado.", "number", "km"),
    f("gps_battery", "Batería GPS", "attribute", "Valor del último reporte GPS del día."),
    f("vehicle_battery", "Batería del vehículo", "attribute", "Valor del último reporte del vehículo del día."),
    f("address", "Dirección", "attribute", "Dirección del último reporte válido del día."),
    f("brand", "Marca", "dimension", "Marca de ficha técnica cuando existe."),
    f("model", "Modelo", "dimension", "Modelo de ficha técnica cuando existe."),
    f("tank_capacity", "Capacidad de tanque", "attribute", "Capacidad vigente en galones; no se suma.", "number", "gal"),
    f("autonomia_km", "Autonomía de ficha", "attribute", "Autonomía vigente en kilómetros.", "number", "km"),
    f("l_100km_ref", "Referencia l/100 km", "attribute", "Consumo de referencia vigente.", "number", "l_100km"),
    f("factor_eff", "Factor de eficiencia", "attribute", "Factor técnico vigente.", "number", "decimal"),
    f("is_vehicle", "Vehículo con ficha útil", "dimension", "Verdadero cuando la unidad puede participar en métricas de eficiencia."),
];
const fleetDistanceMetrics = (): VaiMetric[] => [
    m("vehicle_days", "Placa-días con recorrido", "Número de filas placa-día con recorrido válido.", "count", "integer"),
    m("vehicles_count", "Placas con recorrido", "Placas distintas con recorrido válido.", "count_distinct", "integer", { field: "plate" }),
    m("gps_device_days", "Equipo-días GPS", "Suma de equipos GPS observados por placa-día.", "sum", "integer", { field: "gps_devices_count" }),
    m("gps_reports", "Reportes GPS", "Suma de reportes GPS incluidos.", "sum", "integer", { field: "gps_report_count" }),
    m("distance_total", "Recorrido GPS", "Suma del recorrido diario válido.", "sum", "km", { field: "odometer_km" }),
    m("km_per_vehicle", "Recorrido promedio por placa", "Recorrido total dividido entre placas distintas.", "sum_per_distinct", "km", { field: "odometer_km", distinctField: "plate" }),
];
const fleetPerformanceFields = (): VaiField[] => [
    f("cal_date", "Fecha", "date", "Fecha base del cruce placa-día.", "date", "date", ["rendimiento", "eficiencia", "recorrido", "combustible", "consumo", "día", "dia", "mes"]),
    f("plate", "Placa", "dimension", "Placa normalizada usada para amarrar GPS y combustible."),
    f("group_name", "Sede", "dimension", "Sede GPS cuando existe ese día; en su defecto sede normalizada de combustible."),
    f("brand", "Marca", "dimension", "Marca de ficha técnica o clasificación especial."),
    f("model", "Modelo", "dimension", "Modelo de ficha técnica o clasificación especial."),
    f("has_gps", "Tiene GPS", "dimension", "Verdadero cuando existe recorrido GPS para la placa-día."),
    f("has_fuel", "Tiene combustible", "dimension", "Verdadero cuando existe al menos un vale para la placa-día."),
    f("is_vehicle", "Vehículo con ficha útil", "dimension", "Verdadero cuando la placa tiene ficha suficiente para eficiencia."),
    f("gps_devices_count", "Equipos GPS", "measure", "Equipos GPS consolidados en la placa-día.", "number", "integer"),
    f("gps_report_count", "Reportes GPS", "measure", "Reportes GPS consolidados en la placa-día.", "number", "integer"),
    f("odometer_km", "Recorrido GPS", "measure", "Kilómetros del día; cero cuando el día solo tiene combustible.", "number", "km"),
    f("refuel_count", "Abastecimientos", "measure", "Vales de combustible del día.", "number", "integer"),
    f("qty", "Galones abastecidos", "measure", "Galones del día; cero cuando el día solo tiene GPS.", "number", "gal"),
    f("qty_pen", "Galones con costo PEN", "measure", "Galones de vales reconocidos como PEN.", "number", "gal"),
    f("qty_unknown_currency", "Galones con moneda desconocida", "measure", "Galones cuya moneda no se pudo normalizar.", "number", "gal"),
    f("actual_liters", "Litros reales equivalentes", "measure", "Galones abastecidos × 3.78541; base para comparar contra referencia.", "number", "decimal"),
    f("cost_pen_known", "Costo identificado PEN", "measure", "Subtotal diario de importes reconocidos como PEN.", "number", "pen"),
    f("non_pen_or_unpriced_count", "Vales fuera de total PEN", "measure", "Vales que no son PEN con importe conocido.", "number", "integer"),
    f("unknown_currency_count", "Vales con moneda desconocida", "measure", "Vales cuya moneda no se reconoce.", "number", "integer"),
    f("anomaly_count", "Tanqueos anómalos", "measure", "Cantidad de vales del día que superan capacidad individual.", "number", "integer"),
    f("excess_gal", "Exceso sobre tanque", "measure", "Suma diaria del exceso calculado por vale individual.", "number", "gal"),
    f("excess_pen_known", "Exceso identificado PEN", "measure", "Costo identificado PEN del exceso.", "number", "pen"),
    f("unpriced_anomaly_count", "Anomalías sin valorización", "measure", "Anomalías cuyo exceso no pudo valorizarse en PEN.", "number", "integer"),
    f("tank_capacity", "Capacidad de tanque", "attribute", "Capacidad vigente en galones; no se suma.", "number", "gal"),
    f("autonomia_km", "Autonomía de ficha", "attribute", "Autonomía base de ficha.", "number", "km"),
    f("factor_eff", "Factor de eficiencia", "attribute", "Factor técnico vigente aplicado a la referencia.", "number", "decimal"),
    f("autonomia_reference_km", "Autonomía de referencia", "attribute", "Autonomía de ficha × factor técnico.", "number", "km"),
    f("l_100km_reference", "Consumo de referencia", "attribute", "l/100 km de referencia ajustado por factor; si falta, se deriva de tanque y autonomía.", "number", "l_100km"),
    f("km_per_gal", "Rendimiento diario", "attribute", "Km/gal de la placa-día solo cuando ese mismo día tiene GPS y combustible; para períodos usar la métrica Rendimiento km/gal.", "number", "km_per_gal"),
    f("l_100km_real", "Consumo real diario", "attribute", "l/100 km de la placa-día cuando ese mismo día tiene GPS y combustible; para períodos usar la métrica Consumo real.", "number", "l_100km"),
    f("autonomia_real_km", "Autonomía real diaria", "attribute", "Autonomía estimada de la placa-día; no consolidar directamente entre placas o períodos.", "number", "km"),
    f("theoretical_gal", "Galones teóricos", "measure", "Galones equivalentes que corresponderían al recorrido según la referencia técnica.", "number", "gal"),
    f("theoretical_liters", "Litros teóricos", "measure", "Litros equivalentes que corresponderían al recorrido según la referencia técnica.", "number", "decimal"),
    f("deviation_fraction", "Desviación diaria", "attribute", "Desviación diaria real vs referencia como fracción; para períodos usar la métrica Desviación vs referencia.", "number", "fraction"),
    f("unit_price_pen_known", "Precio PEN por galón", "attribute", "Costo PEN identificado / galones PEN del día; para consolidar usar la métrica correspondiente.", "number", "pen_per_gal"),
    f("cost_per_km_pen_known", "Costo PEN por km", "attribute", "Costo PEN identificado / km del día; para períodos usar la métrica correspondiente.", "number", "pen_per_km"),
];
const fleetPerformanceMetrics = (): VaiMetric[] => [
    m("vehicle_days", "Placa-días con datos", "Número de filas placa-día con GPS, combustible o ambos.", "count", "integer"),
    m("vehicles_count", "Placas", "Placas distintas incluidas.", "count_distinct", "integer", { field: "plate" }),
    m("gps_vehicle_days", "Placa-días con GPS", "Filas que contienen recorrido GPS.", "count", "integer", { where: [{ field: "has_gps", op: "eq", value: "true" }] }),
    m("fuel_vehicle_days", "Placa-días con combustible", "Filas que contienen abastecimientos.", "count", "integer", { where: [{ field: "has_fuel", op: "eq", value: "true" }] }),
    m("matched_vehicle_days", "Placa-días con GPS y combustible", "Filas que tienen ambas fuentes el mismo día; no limita los ratios de período.", "count", "integer", { where: [{ field: "has_gps", op: "eq", value: "true" }, { field: "has_fuel", op: "eq", value: "true" }] }),
    m("distance_total", "Recorrido GPS", "Suma de kilómetros GPS del período.", "sum", "km", { field: "odometer_km" }),
    m("qty_total", "Galones abastecidos", "Suma de galones del período.", "sum", "gal", { field: "qty" }),
    m("avg_qty_per_vehicle", "Consumo promedio por vehículo", "Galones divididos entre placas distintas.", "sum_per_distinct", "gal", { field: "qty", distinctField: "plate" }),
    m("refuel_count", "Abastecimientos", "Suma de vales incluidos.", "sum", "integer", { field: "refuel_count" }),
    m("cost_pen_known", "Costo identificado PEN", "Suma de importes reconocidos como PEN.", "sum", "pen", { field: "cost_pen_known" }),
    m("avg_cost_pen_per_gal", "Costo promedio por galón PEN", "Σ costo PEN identificado / Σ galones de vales PEN.", "ratio", "pen_per_gal", { numerator: "cost_pen_known", denominator: "qty_pen" }),
    m("cost_per_km_pen", "Costo PEN por km", "Σ costo PEN identificado / Σ km para vehículos con ficha útil.", "ratio", "pen_per_km", { numerator: "cost_pen_known", denominator: "odometer_km", where: [{ field: "is_vehicle", op: "eq", value: "true" }] }),
    m("unknown_currency_count", "Vales con moneda desconocida", "Suma de vales con moneda no reconocida.", "sum", "integer", { field: "unknown_currency_count" }),
    m("non_pen_or_unpriced_count", "Vales fuera de total PEN", "Suma de vales que no son PEN con importe conocido.", "sum", "integer", { field: "non_pen_or_unpriced_count" }),
    m("anomaly_count", "Tanqueos anómalos", "Suma de anomalías calculadas por vale individual.", "sum", "integer", { field: "anomaly_count" }),
    m("excess_gal_total", "Exceso sobre tanque", "Suma del exceso calculado por vale individual.", "sum", "gal", { field: "excess_gal" }),
    m("excess_pen_known", "Exceso identificado PEN", "Costo PEN identificado del exceso.", "sum", "pen", { field: "excess_pen_known" }),
    m("km_per_gal", "Rendimiento km/gal", "Σ km GPS / Σ galones para vehículos con ficha útil; incluye días GPS-only y fuel-only del período.", "ratio", "km_per_gal", { numerator: "odometer_km", denominator: "qty", where: [{ field: "is_vehicle", op: "eq", value: "true" }] }),
    m("l_100km_real", "Consumo real", "Σ galones × 3.78541 × 100 / Σ km para vehículos con ficha útil.", "ratio", "l_100km", { numerator: "qty", denominator: "odometer_km", multiplier: 378.541, where: [{ field: "is_vehicle", op: "eq", value: "true" }] }),
    m("l_100km_reference", "Consumo de referencia", "Promedio de referencia ponderado por kilómetros GPS.", "weighted_avg", "l_100km", { field: "l_100km_reference", weight: "odometer_km", where: [{ field: "is_vehicle", op: "eq", value: "true" }] }),
    m("fuel_vs_reference_pct", "Desviación vs referencia", "(Σ litros reales − Σ litros teóricos) / Σ litros teóricos × 100 para filas con referencia técnica.", "pct_change", "percent", { numerator: "actual_liters", denominator: "theoretical_liters", where: [{ field: "is_vehicle", op: "eq", value: "true" }] }),
    m("theoretical_gal_total", "Galones teóricos", "Suma de galones equivalentes según referencia técnica.", "sum", "gal", { field: "theoretical_gal", where: [{ field: "is_vehicle", op: "eq", value: "true" }] }),
];
const FLEET_PERFORMANCE_QUERY = q(["cal_date"], ["plate", "group_name", "brand", "model"]);
const fleetPerformanceSource = (): VaiSource => ({
    id: "fleet_performance",
    name: "Rendimiento de flota",
    area: "fleet",
    description: "Cruce diario por placa entre GPS y combustible, preparado para recalcular correctamente rendimiento, consumo y costos PEN en cualquier período.",
    endpoint: "/api/vai/fleet/performance",
    sqlView: "dw.v_dti_vai_flota_rendimiento",
    grain: "Una fila por placa y día con GPS, combustible o ambos.",
    defaultDateField: "cal_date",
    query: FLEET_PERFORMANCE_QUERY,
    fields: fleetPerformanceFields(),
    metrics: fleetPerformanceMetrics(),
    rules: [
        "GPS y combustible se agregan por separado a placa + día antes del cruce; nunca se multiplican vales por reportes GPS.",
        "El FULL OUTER JOIN conserva días solo-GPS y solo-combustible. Por eso los ratios de semana, mes o año usan todos los km y todos los galones del período aunque no ocurran el mismo día.",
        "Para rendimiento, consumo real, costo por km y desviación vs referencia usar siempre las métricas declaradas; no promediar km_per_gal, l_100km_real ni deviation_fraction de las filas.",
        "Las métricas de eficiencia filtran is_vehicle=true. Galoneras, MULTICAR y unidades sin ficha técnica útil conservan consumo y costo, pero no contaminan eficiencia.",
        "El factor técnico multiplica autonomía y divide l/100 km de referencia; no modifica capacidad de tanque.",
        "Los costos de combustible disponibles para V-Ai están expresados únicamente en PEN; no existe costo USD de combustible.",
        "Las anomalías de tanque siguen calculándose por vale individual en la vista de combustible y aquí solo se agregan.",
        "group_name se presenta como Sede.",
    ],
    keywords: ["flota", "rendimiento", "eficiencia", "km por galón", "km/gal", "litros por 100", "l/100", "combustible", "consumo", "recorrido", "gps", "kilómetros", "kilometros", "galones", "costo por km", "mensual", "diario", "mes", "día"],
    enabled: true,
    access: { scopes: ["fleet_mgmt"] },
});
const traceabilityGradeMetrics = (): VaiMetric[] => [
    m("avg_au_grade", "Ley Au promedio", "Ley de oro ponderada por TMS.", "weighted_avg", "grade_oztc", { field: "au_grade_oztc", weight: "tms" }),
    m("avg_ag_grade", "Ley Ag promedio", "Ley de plata ponderada por TMS.", "weighted_avg", "grade_oztc", { field: "ag_grade_oztc", weight: "tms" }),
    m("avg_h2o", "Humedad promedio", "Promedio simple de humedad.", "avg", "percent", { field: "h2o" }),
];
export const VAI_SOURCES: VaiSource[] = [
    {
        id: "trjkar_guides",
        name: "Guías de transporte TRJ",
        area: "kardex",
        description: "Guías de remisión del transporte de mineral desde TRJ hacia planta: transportista, fechas de salida/llegada, TMH enviadas y llegadas, horas de tránsito, lotes por guía, pérdidas/excedentes de control, tarifa, importe valorizado y vínculo con la factura del transportista.",
        endpoint: "/api/vai/trjkar/guides",
        sqlView: "dw.v_finance_trjkar_guides_get + stg.finance_trjkar_lots_web",
        grain: "Una fila por guía de transporte.",
        query: q(["guide_date", "departure_date", "arrival_date", "invoice_document_date"], ["transport_ruc", "transport_name", "status_name", "driver_name", "plate_1", "destination_district"]),
        fields: [
            f("guide_number", "Número de guía", "attribute", "Identificador de la guía (XX##-##########)."),
            f("guide_date", "Fecha de guía", "date", "Fecha de emisión de la guía; fecha predeterminada para consultas de guías por período.", "date", "date", ["guía", "guia", "guías", "guias", "emisión", "emision"]),
            f("transport_guide_number", "Guía transportista", "attribute", "Número de guía del transportista."),
            f("departure_date", "Fecha de salida", "date", "Fecha y hora de salida del camión.", "datetime", "text", ["salida", "despacho"]),
            f("arrival_date", "Fecha de llegada", "date", "Fecha y hora de llegada a planta; vacía si aún no llega.", "datetime", "text", ["llegada", "recepción", "recepcion"]),
            f("transit_hours", "Horas de tránsito", "measure", "Horas entre salida y llegada; vacío sin llegada.", "number", "hours"),
            f("transport_name", "Transportista", "dimension", "Razón social de la empresa de transporte."),
            f("transport_ruc", "RUC transportista", "attribute", "RUC de la empresa de transporte."),
            f("driver_name", "Conductor", "dimension", "Nombre del conductor."),
            f("plate_1", "Placa", "dimension", "Placa del vehículo."),
            f("destination_district", "Distrito destino", "dimension", "Distrito de destino."),
            f("destination_province", "Provincia destino", "dimension", "Provincia de destino."),
            f("status_name", "Estado", "dimension", "ABIERTO o CERRADO (cerrada tras conciliar la factura)."),
            f("document_number", "Factura vinculada", "attribute", "Número de factura del transportista; vacío si la guía está pendiente de facturación."),
            f("lots_count", "Lotes de la guía", "measure", "Lotes distintos operativos transportados en la guía (sin PERD/EXCE).", "number", "integer"),
            f("lot_rows", "Movimientos operativos", "measure", "Filas lote-correlativo operativas de la guía.", "number", "integer"),
            f("tmh_departure", "TMH enviadas", "measure", "Toneladas métricas húmedas despachadas (lotes operativos, sin PERD/EXCE).", "number", "tmh"),
            f("tmh_arrival", "TMH llegadas", "measure", "Toneladas métricas húmedas recibidas en planta; 0 si no hay llegada registrada.", "number", "tmh"),
            f("tmh_perd", "TMH pérdida (PERD)", "measure", "Tonelaje de control PERD registrado en la guía.", "number", "tmh"),
            f("tmh_exce", "TMH excedente (EXCE)", "measure", "Tonelaje de control EXCE registrado en la guía.", "number", "tmh"),
            f("tmh_cleanup", "TMH limpieza", "measure", "TMH de lotes LIMPIEZA incluidas en las enviadas.", "number", "tmh"),
            f("pu_transport_usd", "Tarifa USD/TMH", "measure", "Precio unitario pactado por tonelada; no se suma.", "number", "usd"),
            f("amount_usd", "Importe USD guía", "measure", "Valorización de la guía (tarifa × TMH).", "number", "usd"),
            f("invoice_document_date", "Fecha factura", "date", "Fecha de la factura vinculada.", "date", "date", ["factura", "facturas", "facturado", "facturación", "facturacion"]),
            f("invoice_amount_usd_web", "Importe factura (cabecera)", "attribute", "Importe total de la factura; se repite en cada guía de la misma factura, no sumar.", "number", "usd"),
            f("invoice_amount_usd_con", "Importe Concar (cabecera)", "attribute", "Importe contabilizado de la factura; se repite por guía, no sumar.", "number", "usd"),
        ],
        metrics: [
            m("guides_count", "Guías", "Número de guías.", "count", "integer"),
            m("tmh_departure_total", "TMH enviadas", "Suma de TMH despachadas.", "sum", "tmh", { field: "tmh_departure" }),
            m("tmh_arrival_total", "TMH llegadas", "Suma de TMH recibidas (solo guías con llegada).", "sum", "tmh", { field: "tmh_arrival", where: [{ field: "tmh_arrival", op: "gt", value: 0 }] }),
            m("amount_usd_total", "USD valorizado", "Suma del importe de las guías.", "sum", "usd", { field: "amount_usd" }),
            m("avg_rate_usd_tmh", "Tarifa USD/TMH", "Tarifa ponderada: USD / TMH de guías con importe.", "ratio", "usd", { numerator: "amount_usd", denominator: "tmh_departure", where: [{ field: "amount_usd", op: "gt", value: 0 }, { field: "tmh_departure", op: "gt", value: 0 }] }),
            m("loss_pct", "Merma %", "(TMH enviadas − llegadas) / enviadas, solo guías con llegada.", "diff_pct", "percent", { numerator: "tmh_departure", denominator: "tmh_arrival", where: [{ field: "tmh_arrival", op: "gt", value: 0 }] }),
            m("loss_tmh", "Merma TMH", "TMH enviadas menos llegadas, solo guías con llegada.", "sum_diff", "tmh", { field: "tmh_departure", field2: "tmh_arrival", where: [{ field: "tmh_arrival", op: "gt", value: 0 }] }),
            m("avg_transit_hours", "Horas de tránsito", "Promedio de horas entre salida y llegada.", "avg", "hours", { field: "transit_hours" }),
            m("tmh_per_guide", "TMH por guía", "TMH enviadas divididas entre guías distintas.", "sum_per_distinct", "tmh", { field: "tmh_departure", distinctField: "guide_number" }),
            m("lots_total", "Lotes transportados", "Suma de lotes distintos por guía.", "sum", "integer", { field: "lots_count" }),
            m("lots_per_guide", "Lotes por guía", "Lotes divididos entre guías distintas.", "sum_per_distinct", "decimal", { field: "lots_count", distinctField: "guide_number" }),
            m("tmh_perd_total", "TMH pérdida (PERD)", "Suma del tonelaje de control PERD.", "sum", "tmh", { field: "tmh_perd" }),
            m("tmh_exce_total", "TMH excedente (EXCE)", "Suma del tonelaje de control EXCE.", "sum", "tmh", { field: "tmh_exce" }),
            m("tmh_cleanup_total", "TMH limpieza", "Suma de TMH de lotes LIMPIEZA.", "sum", "tmh", { field: "tmh_cleanup" }),
            m("pending_invoice_guides", "Guías pendientes de facturación", "Guías sin factura vinculada.", "count", "integer", { where: [{ field: "document_number", op: "empty" }] }),
            m("invoiced_guides", "Guías facturadas", "Guías con factura vinculada.", "count", "integer", { where: [{ field: "document_number", op: "not_empty" }] }),
            m("closed_guides", "Guías cerradas", "Guías en estado CERRADO.", "count", "integer", { where: [{ field: "status_name", op: "eq", value: "CERRADO" }] }),
            m("pending_arrival_guides", "Guías sin llegada", "Guías sin fecha de llegada registrada.", "count", "integer", { where: [{ field: "arrival_date", op: "empty" }] }),
            m("carriers_count", "Transportistas", "Transportistas distintos.", "count_distinct", "integer", { field: "transport_ruc" }),
            m("vehicles_count", "Placas", "Placas distintas.", "count_distinct", "integer", { field: "plate_1" }),
        ],
        rules: [
            "Las TMH ya excluyen lotes PERD (pérdida) y EXCE (excedente); sus tonelajes de control están en tmh_perd y tmh_exce.",
            "Los importes de factura son de cabecera y se repiten por guía: no se suman; la suma oficial facturada está en la fuente de facturas.",
            "Las semanas van de lunes a domingo.",
            "El origen es siempre TRJ; no agrupar por origen.",
            "Cuando se pide «guías de <período>» sin otro hito, filtrar guide_date. departure_date y arrival_date solo se usan cuando se pide salida o llegada.",
        ],
        defaultDateField: "guide_date",
        relations: [
            { field: "document_number", source: "trjkar_invoices", targetField: "document_number", description: "Guía → factura del transportista." },
            { field: "guide_number", source: "trjkar_lots", targetField: "guide_number", description: "Guía → movimientos de lotes." },
        ],
        keywords: ["guía", "guias", "transporte", "transportista", "camión", "tmh", "salida", "llegada", "merma", "tarifa", "facturación", "pendiente", "kardex", "trj", "conductor", "placa", "tránsito", "transito"],
        enabled: true,
        access: { scopes: ["trjkardex_sum", "trjkardex_guides"] },
    },
    {
        id: "trjkar_lots",
        name: "Movimientos de lotes TRJ",
        area: "kardex",
        description: "Detalle de movimientos de lotes dentro de cada guía TRJ. movement_type OPERATIVO son despachos reales; PERD y EXCE son filas de control del mismo lote cuya cantidad se registra en tmh_departure.",
        endpoint: "/api/vai/trjkar/movements",
        sqlView: "dw.v_finance_trjkar_get",
        grain: "Una fila por movimiento lote + correlativo + guía: OPERATIVO = salida real; PERD = pérdida y EXCE = excedente de control.",
        query: q(["departure_date", "guide_date", "arrival_date"], ["lot", "guide_number", "movement_type", "transport_ruc", "transport_name", "status_name"]),
        fields: [
            f("lot", "Lote", "dimension", "Código del lote de mineral."),
            f("lot_corr", "Correlativo", "dimension", "Correlativo del movimiento. Numérico = salida operativa; PERD = pérdida; EXCE = excedente."),
            f("movement_type", "Tipo de movimiento", "dimension", "OPERATIVO, PERD o EXCE."),
            f("is_cleanup", "Lote LIMPIEZA", "attribute", "1 cuando el lote es de limpieza (operativo, sin saldo SGM).", "number", "integer"),
            f("guide_number", "Número de guía", "dimension", "Guía a la que pertenece el movimiento; se puede usar para agrupar el resumen por guía."),
            f("guide_date", "Fecha de guía", "date", "Fecha de emisión de la guía.", "date", "date", ["guía", "guia", "guías", "guias"]),
            f("transport_name", "Transportista", "dimension", "Empresa de transporte de la guía."),
            f("transport_ruc", "RUC transportista", "attribute", "RUC de la empresa de transporte."),
            f("driver_name", "Conductor", "dimension", "Conductor de la guía."),
            f("plate_1", "Placa", "dimension", "Placa del vehículo."),
            f("destination_district", "Distrito destino", "dimension", "Destino de la guía."),
            f("departure_date", "Fecha de salida", "date", "Salida de la guía.", "datetime", "text", ["salida", "despacho"]),
            f("arrival_date", "Fecha de llegada", "date", "Llegada de la guía a planta.", "datetime", "text", ["llegada", "recepción", "recepcion"]),
            f("status_name", "Estado de guía", "dimension", "ABIERTO o CERRADO."),
            f("document_number", "Factura vinculada", "attribute", "Factura del transportista de la guía; vacío si no está facturada."),
            f("tmh_departure", "TMH salida", "measure", "TMH del movimiento al salir; en PERD/EXCE es la cantidad de control.", "number", "tmh"),
            f("tmh_arrival", "TMH llegada", "measure", "TMH del lote al llegar.", "number", "tmh"),
            f("bags_tot", "Sacos totales", "measure", "Sacos del lote.", "number", "integer"),
            f("bags_used", "Sacos usados", "measure", "Sacos consumidos en la guía.", "number", "integer"),
            f("tmh_balance", "Saldo TMH SGM", "measure", "Saldo del lote según SGM; 0 cuando el lote tiene PERD.", "number", "tmh"),
            f("balance_obs", "Observación de saldo", "attribute", "Observación registrada al cerrar saldo."),
            f("pu_transport_usd", "Tarifa USD/TMH (cabecera)", "attribute", "Tarifa de la guía; se repite por movimiento.", "number", "usd"),
            f("amount_usd", "Importe USD guía (cabecera)", "attribute", "Importe de la guía; se repite por lote, no sumar.", "number", "usd"),
        ],
        metrics: [
            m("lots_count", "Lotes", "Lotes distintos operativos (sin PERD/EXCE).", "count_distinct", "integer", { field: "lot", where: [OPERATIONAL_MOVE] }),
            m("lot_rows", "Movimientos operativos", "Combinaciones lote-guía operativas.", "count", "integer", { where: [OPERATIONAL_MOVE] }),
            m("guides_count", "Guías", "Guías distintas con movimientos operativos.", "count_distinct", "integer", { field: "guide_number", where: [OPERATIONAL_MOVE] }),
            m("tmh_departure_total", "TMH salida", "Suma de TMH operativas de salida.", "sum", "tmh", { field: "tmh_departure", where: [OPERATIONAL_MOVE] }),
            m("tmh_arrival_total", "TMH llegada", "Suma de TMH operativas de llegada.", "sum", "tmh", { field: "tmh_arrival", where: [OPERATIONAL_MOVE] }),
            m("bags_total", "Sacos", "Suma de sacos totales operativos.", "sum", "integer", { field: "bags_tot", where: [OPERATIONAL_MOVE] }),
            m("tmh_perd", "TMH pérdida (PERD)", "Suma de tmh_departure de las filas PERD.", "sum", "tmh", { field: "tmh_departure", where: [{ field: "movement_type", op: "eq", value: "PERD" }] }),
            m("tmh_exce", "TMH exceso (EXCE)", "Suma de tmh_departure de las filas EXCE.", "sum", "tmh", { field: "tmh_departure", where: [{ field: "movement_type", op: "eq", value: "EXCE" }] }),
            m("perd_rows", "Registros PERD", "Número de filas de control PERD.", "count", "integer", { where: [{ field: "movement_type", op: "eq", value: "PERD" }] }),
            m("exce_rows", "Registros EXCE", "Número de filas de control EXCE.", "count", "integer", { where: [{ field: "movement_type", op: "eq", value: "EXCE" }] }),
            m("tmh_cleanup", "TMH limpieza", "TMH de lotes LIMPIEZA (operativos, sin saldo SGM).", "sum", "tmh", { field: "tmh_departure", where: [OPERATIONAL_MOVE, { field: "is_cleanup", op: "eq", value: 1 }] }),
            m("lots_per_guide", "Lotes por guía", "Filas operativas de lote divididas entre guías distintas.", "count_per_distinct", "decimal", { distinctField: "guide_number", where: [OPERATIONAL_MOVE] }),
            m("balance_tmh_total", "Saldo TMH SGM", "Suma del saldo SGM contado una vez por lote.", "sum_distinct", "tmh", { field: "tmh_balance", distinctField: "lot" }),
        ],
        defaultDateField: "departure_date",
        rules: [
            "Los importes y datos de factura pertenecen a la guía (cabecera) y se repiten por lote: no sumarlos aquí; usar la fuente de guías.",
            "PERD y EXCE no son campos físicos ni lotes adicionales: son filas del mismo detalle identificadas por movement_type; su cantidad está en tmh_departure de esa fila.",
            "Las métricas operativas de lotes y TMH excluyen PERD y EXCE. Para pérdidas usa tmh_perd; para excesos/excedentes usa tmh_exce.",
            "Cuando se pida un resumen por guía, agrupa por guide_number y usa métricas como lots_count, tmh_departure_total, tmh_perd y tmh_exce.",
            "tmh_balance se repite por movimiento del mismo lote: consolidarlo solo mediante balance_tmh_total.",
        ],
        relations: [{ field: "guide_number", source: "trjkar_guides", targetField: "guide_number", description: "Movimiento → guía." }],
        keywords: ["lote", "lotes", "guía", "guia", "sacos", "perd", "pérdida", "perdida", "merma", "exce", "exceso", "excedente", "limpieza", "saldo", "sgm", "kardex", "trj", "movimiento", "correlativo"],
        enabled: true,
        access: { scopes: ["trjkardex_sum", "trjkardex_guides"] },
    },
    {
        id: "trjkar_lot_workflow",
        name: "Seguimiento de lotes del Kardex TRJ",
        area: "kardex",
        description: "Estado consolidado que ya usa KardexSum para seguir cada lote TRJ desde el ingreso, la valorización y el pago hasta el envío, tránsito y llegada, con proveedor, leyes y monto valorizado.",
        endpoint: "/api/vai/trjkar/lots-workflow",
        sqlView: "dw.v_finance_trjkar_lots_control_sum",
        grain: "Una fila de seguimiento por lote y correlativo, con su guía cuando existe.",
        query: q(["entry_date", "guide_date", "departure_date", "arrival_date", "valuation_date", "payment_date"], ["lot", "lot_status", "summary_status", "payment_status", "miner_name", "ruc", "trjkar_transport_name", "guide_number"]),
        fields: [
            f("lot", "Lote", "dimension", "Código del lote."),
            f("lot_corr", "Correlativo", "attribute", "Correlativo del lote dentro de la guía."),
            f("lot_status", "Estado del lote", "dimension", "Sin valorización, Sin pago, No enviado, En ruta o Finalizado."),
            f("summary_status", "Grupo de estado", "dimension", "Sin pago, No enviado, En ruta o Finalizado."),
            f("payment_status", "Clasificación de valorización", "dimension", "Sin valorización o Con valorización dentro del grupo Sin pago."),
            f("aging_days", "Antigüedad", "measure", "Días transcurridos en la etapa vigente hasta hoy.", "number", "days"),
            f("entry_date", "Fecha de ingreso", "date", "Fecha de ingreso del lote a TRJ.", "date", "date", ["ingreso", "ingresado"]),
            f("process_date", "Fecha de proceso", "date", "Fecha de procesamiento.", "date", "date", ["proceso", "procesado"]),
            f("valuation_date", "Fecha de valorización", "date", "Fecha de valorización del lote.", "date", "date", ["valorización", "valorizacion", "valorizado"]),
            f("doc_date", "Fecha de factura", "date", "Fecha de la factura del proveedor.", "date", "date", ["factura", "facturado"]),
            f("doc_number", "Factura proveedor", "attribute", "Número de factura del proveedor; vacío sin pago."),
            f("payment_date", "Fecha de pago", "date", "Fecha de pago del lote.", "date", "date", ["pago", "pagado"]),
            f("guide_date", "Fecha de guía", "date", "Fecha de la guía remitente.", "date", "date", ["guía", "guia", "guías", "guias"]),
            f("departure_date", "Fecha de salida", "date", "Fecha de salida del transporte.", "datetime", "text", ["salida", "despacho"]),
            f("arrival_date", "Fecha de llegada", "date", "Fecha de llegada del transporte.", "datetime", "text", ["llegada", "recepción", "recepcion"]),
            f("guide_number", "Guía remitente", "dimension", "Número de guía remitente."),
            f("trjkar_transport_guide_number", "Guía transportista", "attribute", "Número de guía del transportista."),
            f("trjkar_transport_name", "Transportista", "dimension", "Empresa transportista."),
            f("transport_ruc", "RUC transportista", "attribute", "RUC del transportista."),
            f("guide_status_name", "Estado de guía", "dimension", "ABIERTO o CERRADO de la guía."),
            f("miner_name", "Proveedor", "dimension", "Proveedor del lote."),
            f("ruc", "RUC proveedor", "attribute", "RUC del proveedor."),
            f("concession_name", "Concesión", "dimension", "Concesión de origen."),
            f("department", "Departamento", "dimension", "Departamento de origen."),
            f("province", "Provincia", "dimension", "Provincia de origen."),
            f("district", "Distrito", "dimension", "Distrito de origen."),
            f("zone_1", "Zona 1", "dimension", "Zona comercial de la valorización."),
            f("zone_2", "Zona 2", "dimension", "Subzona comercial."),
            f("summary_tmh", "TMH del lote", "measure", "Tonelaje operativo del lote (LIMPIEZA incluida; PERD y EXCE fuera).", "number", "tmh"),
            f("tmh", "TMH ingreso", "measure", "TMH del lote al ingreso.", "number", "tmh"),
            f("tms", "TMS", "measure", "Toneladas secas valorizadas.", "number", "tms"),
            f("au_grade_oztc", "Ley Au (oz/TC)", "measure", "Ley de oro valorizada.", "number", "grade_oztc"),
            f("ag_grade_oztc", "Ley Ag (oz/TC)", "measure", "Ley de plata valorizada.", "number", "grade_oztc"),
            f("lot_usd", "Monto valorizado USD", "measure", "Monto contable del lote.", "number", "usd"),
            f("tmh_departure", "TMH salida", "measure", "TMH registradas a la salida.", "number", "tmh"),
            f("tmh_arrival", "TMH llegada", "measure", "TMH registradas a la llegada.", "number", "tmh"),
            f("tmh_balance", "Saldo TMH SGM", "measure", "Saldo del lote en SGM.", "number", "tmh"),
            f("control_status_desc", "Estado de control", "dimension", "Último estado manual registrado en el control de lotes."),
            f("control_comment_count", "Comentarios de control", "measure", "Cantidad de comentarios de control del lote.", "number", "integer"),
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
            m("tmh_total", "TMH en seguimiento", "Suma del tonelaje operativo de los lotes.", "sum", "tmh", { field: "summary_tmh" }),
            m("tms_total", "TMS valorizadas", "Suma de TMS de lotes valorizados.", "sum", "tms", { field: "tms" }),
            m("lot_usd_total", "Monto valorizado USD", "Suma del monto contable de los lotes.", "sum", "usd", { field: "lot_usd" }),
            m("avg_au_grade", "Ley Au promedio", "Ley de oro ponderada por TMS.", "weighted_avg", "grade_oztc", { field: "au_grade_oztc", weight: "tms" }),
            m("suppliers_count", "Proveedores", "Proveedores distintos.", "count_distinct", "integer", { field: "ruc" }),
            m("avg_days_entry_to_departure", "Días ingreso → salida", "Promedio de días calendario entre ingreso y salida del transporte.", "avg_days_diff", "days", { field: "entry_date", field2: "departure_date" }),
        ],
        rules: [
            "Usar los estados oficiales ya calculados por KardexSum: Sin valorización, Sin pago, No enviado, En ruta y Finalizado; no reconstruirlos con reglas nuevas.",
            "Pendiente de llegada es todo lote cuyo summary_status todavía no es Finalizado.",
            "LIMPIEZA forma parte del tonelaje operativo. PERD y EXCE continúan fuera del tonelaje operativo y se consultan en la fuente de movimientos.",
            "Un lote con varias guías aparece en varias filas: contar lotes con métricas de lotes distintos.",
        ],
        defaultDateField: "entry_date",
        keywords: ["kardex", "seguimiento", "flujo", "estado", "sin pago", "sin valorización", "no enviado", "en ruta", "finalizado", "pendiente", "llegada", "lote", "antigüedad", "antiguedad"],
        enabled: true,
        access: { scopes: ["trjkardex_sum"] },
    },
    {
        id: "trjkar_invoices",
        name: "Facturas de transportistas TRJ",
        area: "kardex",
        description: "Facturas de los transportistas del Kardex TRJ: importe ingresado en la web, importe contabilizado en Concar, diferencia, guías vinculadas y TMH transportadas por factura.",
        endpoint: "/api/vai/trjkar/invoices",
        sqlView: "dw.v_finance_trjkar_invo_get + stg.finance_trjkar_guides_web",
        grain: "Una fila por factura (RUC + número de documento).",
        query: q(["document_date"], ["ruc", "transport_name"]),
        fields: [
            f("ruc", "RUC", "attribute", "RUC del transportista."),
            f("document_number", "Factura", "attribute", "Serie y correlativo de la factura."),
            f("document_date", "Fecha de factura", "date", "Fecha del documento.", "date", "date", ["factura", "facturas", "facturado", "facturación", "facturacion"]),
            f("transport_name", "Transportista", "dimension", "Nombre del transportista."),
            f("status_name", "Estado", "dimension", "CERRADO si sus guías fueron cerradas, si no ABIERTO."),
            f("amount_usd", "USD facturado", "measure", "Importe oficial de la factura registrado en la web; corresponde a la suma de sus guías.", "number", "usd"),
            f("amount_usd_con", "USD contabilizado", "measure", "Importe hallado en Concar (cuenta 631111 / subdiario 820); vacío sin cruce.", "number", "usd"),
            f("difference_usd", "Diferencia USD", "measure", "Facturado menos contabilizado; vacío sin cruce.", "number", "usd"),
            f("calculated_amount_usd", "USD de guías", "measure", "Suma de importes de las guías vinculadas.", "number", "usd"),
            f("guide_count", "Guías vinculadas", "measure", "Número de guías de la factura.", "number", "integer"),
            f("tmh_departure", "TMH facturadas", "measure", "TMH operativas de las guías vinculadas.", "number", "tmh"),
            f("subledger_num", "Subdiario", "attribute", "Subdiario contable del cruce; vacío si no cruzó."),
        ],
        metrics: [
            m("invoices_count", "Facturas", "Número de facturas.", "count", "integer"),
            m("amount_usd_total", "USD facturado", "Suma del importe oficial de las facturas registradas.", "sum", "usd", { field: "amount_usd" }),
            m("amount_usd_con_total", "USD contabilizado", "Suma del importe contabilizado.", "sum", "usd", { field: "amount_usd_con" }),
            m("calculated_usd_total", "USD de guías", "Suma de la valorización de guías vinculadas.", "sum", "usd", { field: "calculated_amount_usd" }),
            m("guides_linked", "Guías vinculadas", "Total de guías vinculadas.", "sum", "integer", { field: "guide_count" }),
            m("tmh_invoiced", "TMH facturadas", "Suma de TMH de las guías vinculadas.", "sum", "tmh", { field: "tmh_departure" }),
            m("avg_rate_usd_tmh", "Tarifa USD/TMH facturada", "USD facturado / TMH de facturas con tonelaje.", "ratio", "usd", { numerator: "amount_usd", denominator: "tmh_departure", where: [{ field: "tmh_departure", op: "gt", value: 0 }] }),
            m("unmatched_invoices", "Facturas sin cruce", "Facturas sin registro contable.", "count", "integer", { where: [{ field: "subledger_num", op: "empty" }] }),
            m("closed_invoices", "Facturas cerradas", "Facturas en estado CERRADO.", "count", "integer", { where: [{ field: "status_name", op: "eq", value: "CERRADO" }] }),
            m("entered_minus_concar", "Diferencia USD", "Importe facturado menos el importe hallado en Concar.", "sum_diff", "usd", { field: "amount_usd", field2: "amount_usd_con" }),
            m("carriers_count", "Transportistas", "Transportistas distintos.", "count_distinct", "integer", { field: "ruc" }),
        ],
        rules: ["Cada factura se cuenta una sola vez por RUC/documento.", "amount_usd es el importe oficial facturado y debe coincidir con la suma de las guías; amount_usd_con es solo el cruce contable.", "El cruce contable es registro, no prueba de pago."],
        defaultDateField: "document_date",
        relations: [{ field: "document_number", source: "trjkar_guides", targetField: "document_number", description: "Factura → guías." }],
        keywords: ["factura", "facturas", "concar", "contabilizado", "cruce", "transportista", "kardex", "valorización", "usd"],
        enabled: true,
        access: { scopes: ["trjkardex_sum", "trjkardex_quotes"] },
    },
    {
        id: "traceability_lots",
        name: "Ingresos de mineral (lotes)",
        area: "traceability",
        description: "Fuente operativa de los lotes de mineral ingresados desde 2026: oficina y zona de acopio, tonelaje, leyes de oro y plata, onzas, valorización web (PIO, maquila, USD/TMS), clasificación programa/adicional y avance de factura y pago. Los importes contabilizados, documentos, pagos y TMS contables por lote están en Finanzas (finance_mineral_purchases).",
        endpoint: "/api/vai/traceability/lots",
        sqlView: "dw.v_traceability_get + dw.v_traceability_lots_cm_entrydate_get + stg.traceability_lots_cm",
        grain: "Una fila por lote de mineral ingresado.",
        query: q(["entry_date", "plant_entry_date", "process_date", "valuation_date", "doc_date", "payment_date"], ["office_name", "zone_name", "ruc", "miner_name", "concession_name", "department", "program_class", "zone_validator", "pay_type"]),
        fields: [
            f("lot", "Lote", "attribute", "Código del lote."),
            f("entry_date", "Fecha de ingreso", "date", "Ingreso del lote (a TRJ para lotes TRJ); fecha predeterminada de la fuente.", "date", "date", ["ingresado", "ingresados", "ingreso", "entrada"]),
            f("plant_entry_date", "Fecha de llegada a planta", "date", "Fecha real de ingreso a planta: igual a entry_date para lotes no TRJ; para lotes TRJ es la registrada en CM Inputs y puede estar vacía.", "date", "date", ["llegada a planta", "ingreso a planta", "llegaron a planta"]),
            f("process_date", "Fecha de proceso", "date", "Fecha de procesamiento.", "date", "date", ["procesado", "procesados", "proceso"]),
            f("valuation_date", "Fecha de valorización", "date", "Fecha de valorización.", "date", "date", ["valorizado", "valorizados", "valorización", "valorizacion"]),
            f("doc_date", "Fecha de factura", "date", "Fecha de la factura del proveedor.", "date", "date", ["facturado", "facturados", "factura", "facturación", "facturacion"]),
            f("payment_date", "Fecha de pago", "date", "Fecha de pago al proveedor; vacía si no se ha pagado.", "date", "date", ["pagado", "pagados", "pago"]),
            f("office_name", "Oficina", "dimension", "Oficina/sede de acopio según el mapeo RUC-concesión."),
            f("zone_name", "Zona", "dimension", "Zona de la oficina: Sur, Norte o Sur Aqp."),
            f("office_code", "Código de oficina", "dimension", "Código corto de la oficina (C, L, P, S, T)."),
            f("zone_validator", "Tipo de proveedor", "dimension", "RECPO (empresas de acopio propias) o PROVEEDOR."),
            f("plant_name", "Planta", "dimension", "Planta de destino informada en el ingreso."),
            f("program_class", "Programa / adicional", "dimension", "PROGRAMA o ADICIONAL según Control de Mineral o ley Au ≤ 0.2 oz/TC; vacío sin ley."),
            f("miner_name", "Minero / proveedor", "dimension", "Proveedor del mineral."),
            f("ruc", "RUC", "attribute", "RUC del proveedor."),
            f("concession_name", "Concesión", "dimension", "Concesión minera de origen."),
            f("concession_code", "Código de concesión", "attribute", "Código de la concesión."),
            f("department", "Departamento", "dimension", "Departamento de origen."),
            f("province", "Provincia", "dimension", "Provincia de origen."),
            f("district", "Distrito", "dimension", "Distrito de origen."),
            f("transport_name", "Transportista", "dimension", "Transportista del lote."),
            f("plate", "Placa", "attribute", "Placa del vehículo de ingreso."),
            f("zone_1", "Zona comercial 1", "dimension", "Zona comercial de la valorización."),
            f("zone_2", "Zona comercial 2", "dimension", "Subzona comercial de la valorización."),
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
            f("pio_disc", "Descuento PIO", "measure", "Descuento aplicado al PIO (USD/oz).", "number", "usd"),
            f("maquila", "Maquila", "measure", "Cargo de maquila USD/TMS.", "number", "usd"),
            f("escalador", "Escalador", "measure", "Escalador aplicado en la valorización.", "number", "decimal"),
            f("usd_tms", "USD/TMS", "measure", "Valor por tonelada seca.", "number", "usd"),
            f("au_usd", "Au USD", "measure", "Valor del oro del lote.", "number", "usd"),
            f("ag_usd", "Ag USD", "measure", "Valor de la plata del lote.", "number", "usd"),
            f("lot_usd", "Monto valorizado USD", "measure", "Monto de valorización del lote.", "number", "usd"),
            f("doc_number", "Factura", "attribute", "Número de factura del proveedor; vacío si no está facturado."),
        ],
        metrics: [
            m("lots_count", "Lotes", "Número de lotes.", "count", "integer"),
            m("miners_count", "Proveedores", "Proveedores distintos.", "count_distinct", "integer", { field: "ruc" }),
            m("offices_count", "Oficinas", "Oficinas distintas.", "count_distinct", "integer", { field: "office_name" }),
            m("tmh_total", "TMH", "Suma de toneladas húmedas.", "sum", "tmh", { field: "tmh" }),
            m("tms_total", "TMS", "Suma de toneladas secas.", "sum", "tms", { field: "tms" }),
            m("sacks_total", "Sacos", "Suma de sacos.", "sum", "integer", { field: "sack_qty" }),
            m("au_oz_total", "Onzas Au", "Suma de onzas de oro.", "sum", "oz", { field: "au_oz" }),
            m("ag_oz_total", "Onzas Ag", "Suma de onzas de plata.", "sum", "oz", { field: "ag_oz" }),
            m("lot_usd_total", "Monto valorizado USD", "Suma de los montos de valorización.", "sum", "usd", { field: "lot_usd" }),
            m("au_usd_total", "Au USD", "Suma del valor del oro.", "sum", "usd", { field: "au_usd" }),
            m("ag_usd_total", "Ag USD", "Suma del valor de la plata.", "sum", "usd", { field: "ag_usd" }),
            ...traceabilityGradeMetrics(),
            m("avg_usd_tms", "USD/TMS promedio", "Promedio simple de USD/TMS.", "avg", "usd", { field: "usd_tms" }),
            m("usd_per_tms", "USD/TMS ponderado", "Monto valorizado dividido entre TMS de lotes valorizados.", "ratio", "usd", { numerator: "lot_usd", denominator: "tms", where: [{ field: "lot_usd", op: "gt", value: 0 }, { field: "tms", op: "gt", value: 0 }] }),
            m("avg_au_rec", "Recuperación Au promedio", "Promedio simple de recuperación Au.", "avg", "percent", { field: "au_rec" }),
            m("avg_pio", "PIO promedio", "Promedio del precio del oro aplicado.", "avg", "usd", { field: "pio" }),
            m("lots_program", "Lotes programa", "Lotes clasificados PROGRAMA.", "count", "integer", { where: [{ field: "program_class", op: "eq", value: "PROGRAMA" }] }),
            m("lots_additional", "Lotes adicionales", "Lotes clasificados ADICIONAL.", "count", "integer", { where: [{ field: "program_class", op: "eq", value: "ADICIONAL" }] }),
            m("tms_program", "TMS programa", "TMS de lotes PROGRAMA.", "sum", "tms", { field: "tms", where: [{ field: "program_class", op: "eq", value: "PROGRAMA" }] }),
            m("tms_additional", "TMS adicionales", "TMS de lotes ADICIONAL.", "sum", "tms", { field: "tms", where: [{ field: "program_class", op: "eq", value: "ADICIONAL" }] }),
            m("lots_without_valuation", "Lotes sin valorización", "Lotes sin fecha de valorización.", "count", "integer", { where: [{ field: "valuation_date", op: "empty" }] }),
            m("lots_pending_invoice", "Lotes sin factura", "Lotes sin número de factura.", "count", "integer", { where: [{ field: "doc_number", op: "empty" }] }),
            m("lots_pending_payment", "Lotes sin pago", "Lotes sin fecha de pago.", "count", "integer", { where: [{ field: "payment_date", op: "empty" }] }),
            m("lots_paid", "Lotes pagados", "Lotes con fecha de pago.", "count", "integer", { where: [{ field: "payment_date", op: "not_empty" }] }),
            m("lot_usd_paid", "Facturado USD de lotes pagados", "Monto facturado/valorizado de los lotes que tienen payment_date. No es el pago efectivo transferido al proveedor.", "sum", "usd", { field: "lot_usd", where: [{ field: "payment_date", op: "not_empty" }] }),
            m("avg_days_entry_to_valuation", "Días ingreso → valorización", "Promedio de días calendario entre ingreso y valorización.", "avg_days_diff", "days", { field: "entry_date", field2: "valuation_date" }),
            m("avg_days_valuation_to_payment", "Días valorización → pago", "Promedio de días calendario entre valorización y pago.", "avg_days_diff", "days", { field: "valuation_date", field2: "payment_date" }),
            m("avg_days_entry_to_payment", "Días ingreso → pago", "Promedio de días calendario entre ingreso y pago.", "avg_days_diff", "days", { field: "entry_date", field2: "payment_date" }),
        ],
        rules: [
            "Solo incluye lotes con ingreso desde 2026-01-01.",
            "Las leyes Au y Ag se promedian ponderadas por TMS, nunca se suman; humedad y USD/TMS usan promedio simple (usd_per_tms ofrece la versión ponderada).",
            "lot_usd es el monto facturado/valorizado exactamente como sale de dw.v_traceability_get. No recalcularlo con TMS, USD/TMS, Au o Ag. No es un desembolso efectivo.",
            "«Sin leyes» se interpreta como sin valorización y se identifica por valuation_date vacía, no por sumar o asumir leyes cero; sin payment_date significa sin pago.",
            "Los precios (PIO, PIP), descuentos, maquila y ratios (USD/TMS) no se suman.",
            "Por sede u oficina agrupar por office_name (zone_name para Sur/Norte/Sur Aqp); zone_1/zone_2 son la clasificación comercial de la valorización.",
            "Para ingreso real a planta de lotes TRJ usar plant_entry_date; entry_date es el ingreso a TRJ.",
            "doc_date, doc_number, payment_date y lot_usd son la referencia CONCAR por lote. payment_date solo identifica que el lote figura pagado; lot_usd sigue siendo el monto facturado/valorizado del lote y nunca el pago efectivo. El pago efectivo en USD solo se toma de finance_mineral_payments y no se atribuye a lotes.",
        ],
        defaultDateField: "entry_date",
        relations: [
            { field: "office_name", source: "traceability_targets", targetField: "office_name", description: "Lotes → metas mensuales por oficina." },
            { field: "lot", source: "finance_mineral_purchases", targetField: "lot", description: "Lote → documento contable de compra y pago." },
        ],
        keywords: ["mineral", "lote", "lotes", "minero", "proveedor", "ley", "leyes", "oro", "plata", "au", "ag", "onzas", "tms", "tmh", "concesión", "trazabilidad", "ingreso", "compra", "pio", "maquila", "humedad", "oficina", "sede", "zona", "programa", "adicional", "acopio"],
        enabled: true,
        access: { scopes: ["traceability"] },
    },
    {
        id: "traceability_status",
        name: "Lotes pendientes en Control de Mineral",
        area: "traceability",
        description: "Situación operativa de los lotes de mineral que aún no llegan a contabilidad, por sede y zona: situación y observación, tonelaje, leyes y valor estimado del lote con PIO y descuentos por sede.",
        endpoint: "/api/vai/traceability/status",
        sqlView: "dw.v_traceability_status_get",
        grain: "Una fila por lote pendiente con su situación vigente.",
        query: q(["entry_date"], ["site_name", "zone_name", "situation_desc", "observation_desc", "ruc", "miner_name"]),
        fields: [
            f("lot", "Lote", "attribute", "Código del lote."),
            f("entry_date", "Fecha de ingreso", "date", "Ingreso del lote.", "date", "date", ["ingresado", "ingresados", "ingreso"]),
            f("zone_name", "Zona", "dimension", "Zona comercial (Sur, Norte, Sur Aqp)."),
            f("site_name", "Sede", "dimension", "Sede u oficina de acopio (TRJ se reporta como CHANCADO)."),
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
            f("pio", "PIO (USD/oz)", "measure", "Precio del oro del día de ingreso.", "number", "usd"),
            f("pio_disc", "Descuento PIO", "attribute", "Descuento por sede sobre el PIO.", "number", "usd"),
            f("maquila_disc", "Maquila", "attribute", "Maquila por sede según ley.", "number", "usd"),
            f("usd_tms", "USD/TMS estimado", "measure", "Valor estimado por tonelada seca.", "number", "usd"),
            f("usd_lot", "USD lote estimado", "measure", "Valor estimado del lote.", "number", "usd"),
        ],
        metrics: [
            m("lots_count", "Lotes", "Número de lotes.", "count", "integer"),
            m("tmh_total", "TMH", "Suma de TMH.", "sum", "tmh", { field: "tmh" }),
            m("tms_total", "TMS", "Suma de TMS.", "sum", "tms", { field: "tms" }),
            m("usd_lot_total", "USD estimado", "Suma del valor estimado.", "sum", "usd", { field: "usd_lot" }),
            ...traceabilityGradeMetrics(),
            m("avg_usd_tms", "USD/TMS promedio", "Promedio simple de USD/TMS.", "avg", "usd", { field: "usd_tms" }),
            m("suppliers_count", "Proveedores", "Proveedores distintos.", "count_distinct", "integer", { field: "ruc" }),
        ],
        rules: [
            "Es una foto de lotes pendientes, no un histórico: sin filtro de fecha muestra todo lo pendiente.",
            "Las leyes Au y Ag se promedian ponderadas por TMS; humedad y USD/TMS usan promedio simple.",
            "usd_lot es una estimación (PIO menos descuentos y maquila por sede), no una valorización definitiva.",
        ],
        temporalMode: "snapshot",
        defaultDateField: "entry_date",
        keywords: ["estado", "situación", "sede", "zona", "lote", "pendiente", "trazabilidad", "observación", "control de mineral", "cm"],
        enabled: true,
        access: { scopes: ["traceability"] },
    },
    {
        id: "traceability_targets",
        name: "Metas mensuales de compra por oficina",
        area: "traceability",
        description: "Metas mensuales de TMS y USD de compra de mineral por oficina, separadas en programa y adicional.",
        endpoint: "/api/vai/traceability/targets",
        sqlView: "dw.v_traceability_conta_target_get",
        grain: "Una fila por oficina y mes de meta.",
        query: q(["target_period"], ["office_name"]),
        fields: [
            f("office_name", "Oficina", "dimension", "Oficina de acopio."),
            f("target_period", "Mes de meta", "date", "Último día del mes al que corresponde la meta.", "date", "date", ["meta", "metas", "objetivo", "presupuesto de compra"]),
            f("target_tms_pro", "Meta TMS programa", "measure", "TMS meta del programa.", "number", "tms"),
            f("target_lot_usd_pro", "Meta USD programa", "measure", "USD meta del programa.", "number", "usd"),
            f("target_tms_add", "Meta TMS adicional", "measure", "TMS meta adicional.", "number", "tms"),
            f("target_lot_usd_add", "Meta USD adicional", "measure", "USD meta adicional.", "number", "usd"),
            f("target_tms", "Meta TMS total", "measure", "Programa + adicional.", "number", "tms"),
            f("target_lot_usd", "Meta USD total", "measure", "Programa + adicional.", "number", "usd"),
        ],
        metrics: [
            m("target_tms_total", "Meta TMS", "Suma de metas TMS.", "sum", "tms", { field: "target_tms" }),
            m("target_usd_total", "Meta USD", "Suma de metas USD.", "sum", "usd", { field: "target_lot_usd" }),
            m("target_tms_program", "Meta TMS programa", "Suma de metas TMS programa.", "sum", "tms", { field: "target_tms_pro" }),
            m("target_usd_program", "Meta USD programa", "Suma de metas USD programa.", "sum", "usd", { field: "target_lot_usd_pro" }),
            m("target_tms_additional", "Meta TMS adicional", "Suma de metas TMS adicional.", "sum", "tms", { field: "target_tms_add" }),
            m("target_usd_additional", "Meta USD adicional", "Suma de metas USD adicional.", "sum", "usd", { field: "target_lot_usd_add" }),
            m("offices_count", "Oficinas con meta", "Oficinas distintas.", "count_distinct", "integer", { field: "office_name" }),
        ],
        rules: [
            "Las metas se comparan contra finance_mineral_purchases (lot_usd_total y tms_conta_total por office_name y mes de entry_date, o pay_date si se pide por pago); V-Ai v1 no cruza fuentes: mostrar ambas en widgets separados.",
            "Sin filtro de período devuelve todos los meses con meta.",
        ],
        defaultDateField: "target_period",
        relations: [{ field: "office_name", source: "finance_mineral_purchases", targetField: "office_name", description: "Meta → compra contable de mineral de la oficina." }],
        keywords: ["meta", "metas", "objetivo", "cumplimiento", "oficina", "programa", "adicional", "tms", "compra"],
        enabled: true,
        access: { scopes: ["traceability"] },
    },
    {
        id: "traceability_stock",
        name: "Stock diario de mineral en cancha",
        area: "traceability",
        description: "Balance de stock de mineral de Control de Mineral por fecha: stock inicial, ingresos por Trujillo y Chala, procesado, rechazado y stock final, con el esperado y su desvío.",
        endpoint: "/api/vai/traceability/stock",
        sqlView: "dw.v_traceability_lots_cm_stock_daily_monthly",
        grain: "Una fila por tipo de stock y fecha.",
        query: q(["stock_date"], ["stock_type"]),
        fields: [
            f("stock_type", "Tipo de stock", "dimension", "Serie diaria o mensual del balance; usar una sola."),
            f("stock_date", "Fecha", "date", "Fecha del balance.", "date", "date", ["stock", "cancha", "inventario de mineral"]),
            f("initial_stock_tn", "Stock inicial", "measure", "Toneladas al inicio; saldo, no sumar entre fechas.", "number", "tmh"),
            f("trujillo_inbound_tmh", "Ingreso Trujillo", "measure", "TMH ingresadas por Trujillo.", "number", "tmh"),
            f("chala_inbound_tmh", "Ingreso Chala", "measure", "TMH ingresadas por Chala.", "number", "tmh"),
            f("total_inbound_tmh", "Ingreso total", "measure", "TMH ingresadas en total.", "number", "tmh"),
            f("processed_tmh", "Procesado", "measure", "TMH procesadas.", "number", "tmh"),
            f("rejected_tmh", "Rechazado", "measure", "TMH rechazadas.", "number", "tmh"),
            f("final_stock_tn", "Stock final", "measure", "Toneladas al cierre; saldo, no sumar entre fechas.", "number", "tmh"),
            f("expected_stock_tn", "Stock esperado", "measure", "Stock final esperado.", "number", "tmh"),
            f("stock_delta", "Desvío de stock", "measure", "Diferencia entre stock final y esperado.", "number", "tmh"),
            f("purchased", "Comprado", "measure", "Toneladas compradas.", "number", "tmh"),
            f("not_purchased", "No comprado", "measure", "Toneladas no compradas.", "number", "tmh"),
        ],
        metrics: [
            m("days_count", "Registros", "Número de fechas.", "count", "integer"),
            m("inbound_total", "Ingreso total", "Suma de TMH ingresadas.", "sum", "tmh", { field: "total_inbound_tmh" }),
            m("inbound_trujillo", "Ingreso Trujillo", "Suma de TMH por Trujillo.", "sum", "tmh", { field: "trujillo_inbound_tmh" }),
            m("inbound_chala", "Ingreso Chala", "Suma de TMH por Chala.", "sum", "tmh", { field: "chala_inbound_tmh" }),
            m("processed_total", "Procesado", "Suma de TMH procesadas.", "sum", "tmh", { field: "processed_tmh" }),
            m("rejected_total", "Rechazado", "Suma de TMH rechazadas.", "sum", "tmh", { field: "rejected_tmh" }),
            m("purchased_total", "Comprado", "Suma de toneladas compradas.", "sum", "tmh", { field: "purchased" }),
            m("final_stock_avg", "Stock final promedio", "Promedio del stock final del período.", "avg", "tmh", { field: "final_stock_tn" }),
            m("final_stock_max", "Stock final máximo", "Máximo stock final del período.", "max", "tmh", { field: "final_stock_tn" }),
            m("final_stock_min", "Stock final mínimo", "Mínimo stock final del período.", "min", "tmh", { field: "final_stock_tn" }),
        ],
        rules: [
            "Filtrar un solo stock_type: las filas mensuales consolidan las diarias y no deben mezclarse.",
            "Stock inicial y final son saldos: tendencia diaria en línea o valor de una fecha concreta; nunca sumarlos entre fechas.",
            "Ingresos, procesado, rechazado y comprado sí se suman dentro del período.",
        ],
        defaultDateField: "stock_date",
        keywords: ["stock", "cancha", "inventario", "mineral", "control de mineral", "procesado", "rechazado", "ingreso diario", "trujillo", "chala"],
        enabled: true,
        access: { scopes: ["traceability"] },
    },
    {
        id: "finance_mineral_purchases",
        name: "Facturación y estado de pago por lote (CONCAR)",
        area: "finance",
        description: "Facturación, valorización y estado de pago con el universo exacto de dw.v_traceability_get, incluyendo lotes aún sin factura. Una fila por lote y su entry_date. lot_usd es el valor original de traceability_get; no se recalcula. pay_date identifica el estado pagado. El pago efectivo usa conta_payments, otro universo sin relación por lote.",
        endpoint: "/api/vai/finance/mineral-purchases",
        sqlView: "dw.v_dti_vai_finanzas_compra_mineral",
        grain: "Una fila por lote.",
        query: q(["entry_date", "pay_date", "valuation_date"], ["office_name", "sede", "ruc", "supplier", "doc_type", "program_class", "lot"]),
        fields: [
            f("lot", "Lote", "dimension", "Código del lote (normalizado como en Trazabilidad). Es una dimensión de alta cardinalidad: úsala para filtros y tablas de detalle/agrupadas, no como eje X de gráficos."),
            f("entry_date", "Fecha de ingreso", "date", "entry_date original de traceability_get; siempre acompaña al lote y es la fecha principal de esta fuente.", "date", "date", ["ingreso", "ingresados", "entrada", "facturado", "facturación", "facturacion"]),
            f("doc_type", "Tipo de documento", "dimension", "FT factura, VR vale, NC nota de crédito, ND nota de débito, RL recibo/liquidación."),
            f("doc_number", "Documento", "attribute", "Número del documento del proveedor."),
            f("supplier", "Proveedor", "dimension", "Proveedor del mineral según CONCAR."),
            f("ruc", "RUC", "attribute", "RUC del proveedor según CONCAR."),
            f("office_name", "Oficina", "dimension", "Oficina de acopio del lote; usa el mapeo operativo cuando existe y la sede CONCAR como respaldo."),
            f("sede", "Sede CONCAR", "dimension", "Sede informada en CONCAR para el lote."),
            f("invoice_subledger", "Subdiario CONCAR", "attribute", "Subdiario registrado en CONCAR para el documento del lote."),
            f("invoice_voucher_number", "Comprobante CONCAR", "attribute", "Comprobante registrado en CONCAR para el documento del lote."),
            f("invoice_reg_date", "Fecha de registro CONCAR", "attribute", "Fecha informativa del documento; los filtros financieros usan entry_date, pay_date y valuation_date.", "date", "date"),
            f("invoice_doc_date", "Fecha de factura", "attribute", "doc_date original de traceability_get, informativa; la fecha principal es entry_date.", "date", "date"),
            f("valuation_date", "Fecha de valorización", "date", "Fecha de valorización del lote con la misma lógica de traceability_get.", "date", "date", ["valorizado", "valorizados", "valorizada", "valorizadas", "valorización", "valorizacion"]),
            f("pay_date", "Fecha de pago del lote", "date", "Fecha de pago informada por CONCAR. Identifica el estado pagado del lote, pero no representa ni permite atribuir el importe efectivo del pago.", "date", "date", ["pagado", "pagados", "pagada", "pagadas", "pago", "pagos", "desembolso"]),
            f("program_class", "Programa / adicional", "dimension", "PROGRAMA o ADICIONAL según Control de Mineral o ley Au ≤ 0.2 oz/TC; vacío sin ley."),
            f("tms_conta", "TMS", "measure", "TMS del lote con la misma prioridad de traceability_get: TMS web y, si falta, TMS de CONCAR. El id se conserva por compatibilidad y no proviene de conta_get.", "number", "tms"),
            f("lot_usd", "Facturado/valorizado USD", "measure", "Monto facturado/valorizado del lote según CONCAR/traceability_get. No es el pago efectivo.", "number", "usd"),
        ],
        metrics: [
            m("lots_count", "Lotes", "Lotes distintos del universo exacto de traceability_get, con o sin factura.", "count_distinct", "integer", { field: "lot" }),
            m("documents_count", "Documentos", "Documentos distintos informados por CONCAR.", "count_distinct", "integer", { field: "doc_number" }),
            m("suppliers_count", "Proveedores", "Proveedores distintos.", "count_distinct", "integer", { field: "ruc" }),
            m("offices_count", "Oficinas", "Oficinas distintas.", "count_distinct", "integer", { field: "office_name" }),
            m("lot_usd_total", "Facturado/valorizado USD", "Suma del monto facturado/valorizado por lote según CONCAR/traceability_get.", "sum", "usd", { field: "lot_usd" }),
            m("tms_conta_total", "TMS", "Suma de TMS de los lotes con la misma lógica de traceability_get.", "sum", "tms", { field: "tms_conta" }),
            m("tms_conta_purchase_docs", "TMS facturados", "Alias compatible de tms_conta_total; la fuente ya tiene una sola fila por lote y no vuelve a filtrar por tipo de documento.", "sum", "tms", { field: "tms_conta" }),
            m("usd_per_tms_conta", "USD/TMS", "Σ facturado/valorizado USD / Σ TMS de filas con ambos valores positivos.", "ratio", "usd", { numerator: "lot_usd", denominator: "tms_conta", where: [{ field: "lot_usd", op: "gt", value: 0 }, { field: "tms_conta", op: "gt", value: 0 }] }),
            m("avg_lot_usd", "Facturado promedio por lote", "Promedio simple del monto facturado/valorizado por lote.", "avg", "usd", { field: "lot_usd" }),
            m("lot_usd_invoices", "Facturado USD en FT", "Monto facturado/valorizado de los lotes cuyo registro CONCAR vigente es FT.", "sum", "usd", { field: "lot_usd", where: [{ field: "doc_type", op: "eq", value: "FT" }] }),
            m("lot_usd_purchase_docs", "Facturado/valorizado USD", "Alias compatible de lot_usd_total; la fuente ya está consolidada a una fila por lote.", "sum", "usd", { field: "lot_usd" }),
            m("lot_usd_program", "Facturado USD programa", "Monto facturado/valorizado de lotes PROGRAMA.", "sum", "usd", { field: "lot_usd", where: [{ field: "program_class", op: "eq", value: "PROGRAMA" }] }),
            m("lot_usd_additional", "Facturado USD adicional", "Monto facturado/valorizado de lotes ADICIONAL.", "sum", "usd", { field: "lot_usd", where: [{ field: "program_class", op: "eq", value: "ADICIONAL" }] }),
            m("tms_conta_program", "TMS programa", "TMS de lotes PROGRAMA.", "sum", "tms", { field: "tms_conta", where: [{ field: "program_class", op: "eq", value: "PROGRAMA" }] }),
            m("tms_conta_additional", "TMS adicional", "TMS de lotes ADICIONAL.", "sum", "tms", { field: "tms_conta", where: [{ field: "program_class", op: "eq", value: "ADICIONAL" }] }),
            m("rows_without_tms", "Lotes sin TMS", "Lotes cuya fuente CONCAR/traceability no trae TMS.", "count", "integer", { where: [{ field: "tms_conta", op: "empty" }] }),
            m("lots_paid", "Lotes pagados", "Lotes con pay_date informada por CONCAR.", "count", "integer", { where: [{ field: "pay_date", op: "not_empty" }] }),
            m("lots_pending_payment", "Lotes pendientes de pago", "Lotes sin pay_date en CONCAR.", "count", "integer", { where: [{ field: "pay_date", op: "empty" }] }),
            m("lot_usd_paid", "Facturado USD de lotes pagados", "Suma del monto facturado/valorizado de lotes con pay_date. No es el pago efectivo.", "sum", "usd", { field: "lot_usd", where: [{ field: "pay_date", op: "not_empty" }] }),
            m("avg_days_document_to_payment", "Días factura → pago", "Promedio de días calendario entre fecha de factura y pay_date CONCAR.", "avg_days_diff", "days", { field: "invoice_doc_date", field2: "pay_date" }),
            m("avg_days_registration_to_payment", "Días registro → pago", "Promedio de días calendario entre registro CONCAR y pay_date CONCAR.", "avg_days_diff", "days", { field: "invoice_reg_date", field2: "pay_date" }),
            m("avg_days_valuation_to_payment", "Días valorización → pago", "Promedio de días calendario entre valorización y pay_date CONCAR.", "avg_days_diff", "days", { field: "valuation_date", field2: "pay_date" }),
        ],
        rules: [
            "Fuente única de verdad por lote para factura y estado de pago: CONCAR con la misma lógica de dw.v_traceability_get. No usa stg.traceability_veta_conta ni dw.v_traceability_conta_get para construir estos valores.",
            "Universo exactamente igual a dw.v_traceability_get; no añadir lotes 2025, no exigir documento ni importe para conservar filas.",
            "La fuente está consolidada a una fila por lote, igual que la salida CONCAR usada por traceability_get; no vuelvas a sumar documentos del mismo lote.",
            "lot_usd es el monto facturado/valorizado del lote según CONCAR. Nunca representa el efectivo pagado al proveedor.",
            "pay_date solo identifica que el lote figura pagado en CONCAR. lot_usd_paid es el facturado/valorizado de esos lotes, no el pago real.",
            "El único importe de pago efectivo es finance_mineral_payments.payment_usd_total, proveniente de conta_payments; no se atribuye ni se concilia por lote.",
            "tms_conta conserva el id por compatibilidad, pero usa la misma TMS de traceability_get: TMS web y, si falta, TMS de CONCAR. No proviene de conta_get.",
            "lot_usd_purchase_docs y tms_conta_purchase_docs se conservan como alias compatibles de lot_usd_total y tms_conta_total; no aplican un segundo filtro FT/VR porque la vista ya está consolidada por lote.",
            "lot es una dimensión de alta cardinalidad: si el usuario pide información por lote, usa una tabla agrupada o de detalle. Nunca uses lot como eje X de bar, line, area, combo, scatter, donut, pareto, rank o waterfall.",
            "Fechas financieras permitidas: entry_date, pay_date y valuation_date. Fecha principal entry_date; por pago usar pay_date y por valorización valuation_date. pay_date es un alias de payment_date de traceability_get.",
            "Toda tabla por lotes incluye lot seguido de entry_date. No agregar columnas de conteo de filas ni conteos por lote: cada lote es único.",
            "USD/TMS solo con usd_per_tms_conta (Σ lot_usd / Σ TMS de filas con ambos valores positivos); nunca promediar cocientes por fila.",
            "«Lotes pendientes de pago» se identifican por pay_date vacía. «Lotes pagados» se identifican por pay_date informada. En ambos casos lot_usd sigue siendo facturado/valorizado.",
            "Por oficina agrupar por office_name; las metas mensuales están en traceability_targets y se muestran en widgets separados (v1 no cruza fuentes).",
        ],
        defaultDateField: "entry_date",
        relations: [
            { field: "lot", source: "traceability_lots", targetField: "lot", description: "Documento contable → datos operativos del lote." },
            { field: "office_name", source: "traceability_targets", targetField: "office_name", description: "Compra contable → metas mensuales por oficina." },
        ],
        keywords: ["compra de mineral", "compras de mineral", "compra", "compras", "mineral", "lote", "lotes", "factura", "facturas", "facturado", "documento", "documentos", "valorización", "valorizacion", "valorizado", "importe", "importes", "contabilizado", "contable", "contabilidad", "pago", "pagos", "pagado", "proveedor", "minero", "oficina", "sede", "tms", "usd", "programa", "adicional", "meta", "cumplimiento", "finanzas"],
        enabled: true,
        access: { scopes: ["traceability"] },
    },
    {
        id: "finance_mineral_payments",
        name: "Pagos de mineral por asiento contable",
        area: "finance",
        description: "Cuánto se ha pagado a proveedores de mineral según contabilidad, por asiento (provisión del documento + comprobante de pago que la cancela), oficina y proveedor. Los pagos se hacen en paquetes que cubren uno o más lotes y son netos de detracciones y otros descuentos: no es por lote ni se concilia con lo facturado por lote.",
        endpoint: "/api/vai/finance/mineral-payments",
        sqlView: "dw.v_dti_vai_finanzas_pagos_mineral",
        grain: "Una fila por provisión de documento y comprobante de pago que la cancela (asiento contable, no lote).",
        query: q(["payment_date", "provision_date", "document_date"], ["office_name", "sede", "ruc", "supplier", "doc_type", "payment_document_type", "provision_currency_code", "account_code"]),
        fields: [
            f("source_year", "Ejercicio", "dimension", "Ejercicio contable de origen del comprobante."),
            f("provision_key", "Clave de provisión", "attribute", "Identificador del documento provisionado (ejercicio, comprobante, tipo, número y RUC); se repite en cada pago parcial."),
            f("provision_subledger", "Subdiario de provisión", "attribute", "Subdiario del comprobante de provisión."),
            f("provision_voucher_number", "Comprobante de provisión", "attribute", "Número del comprobante de provisión."),
            f("provision_date", "Fecha de provisión", "date", "Fecha del comprobante de provisión (registro contable del documento).", "date", "date", ["provisión", "provision", "provisionado", "provisionados", "provisionada", "provisionadas", "registrado"]),
            f("office_name", "Oficina", "dimension", "Oficina normalizada desde la sede contable (JULIACA se reporta como PEDREGAL)."),
            f("sede", "Sede contable", "dimension", "Sede derivada del subdiario de provisión."),
            f("doc_type", "Tipo de documento", "dimension", "Tipo del documento provisionado (FT, VR, NC, ND, RL, NA, RC, PA, RH)."),
            f("document_number", "Documento", "attribute", "Número del documento provisionado."),
            f("document_date", "Fecha de documento", "date", "Fecha del documento del proveedor.", "date", "date", ["factura", "facturas", "documento", "emitido"]),
            f("supplier", "Proveedor", "dimension", "Proveedor pagado."),
            f("ruc", "RUC", "attribute", "RUC del proveedor."),
            f("account_code", "Cuenta por pagar", "dimension", "Cuenta 42x provisionada."),
            f("description", "Glosa", "attribute", "Glosa de la línea provisionada."),
            f("provision_currency", "Moneda de provisión (Concar)", "attribute", "Código Concar (MN, US)."),
            f("provision_currency_code", "Moneda de provisión", "dimension", "PEN o USD; vacío si no se reconoce."),
            f("provision_amount", "Importe provisionado", "attribute", "Importe del documento en su moneda; se repite por pago parcial, no sumar por fila.", "number", "decimal"),
            f("provision_amount_usd", "Importe provisionado USD", "attribute", "Importe provisionado cuando la provisión está en USD; se repite por pago parcial.", "number", "usd"),
            f("provision_amount_pen", "Importe provisionado PEN", "attribute", "Importe provisionado cuando la provisión está en PEN; se repite por pago parcial.", "number", "pen"),
            f("payment_subledger", "Subdiario de pago", "attribute", "Subdiario del comprobante de pago (203 bancos)."),
            f("payment_voucher_number", "Comprobante de pago", "attribute", "Número del comprobante de pago."),
            f("payment_date", "Fecha de pago", "date", "Fecha del comprobante de pago; fecha predeterminada.", "date", "date", ["pago", "pagos", "pagado", "pagados", "pagada", "pagadas", "desembolso", "desembolsos"]),
            f("payment_document_type", "Tipo de pago", "dimension", "Tipo del documento de pago (cheque, transferencia, nota de abono NA)."),
            f("payment_document_number", "Documento de pago", "attribute", "Número del documento de pago."),
            f("payment_currency", "Moneda de pago (Concar)", "attribute", "Código Concar del comprobante de pago; informativo, los pagos de mineral son siempre en USD."),
            f("payment_amount_usd", "Pago USD", "measure", "Importe pagado en USD, neto de detracciones y otros descuentos; puede cubrir uno o más lotes.", "number", "usd"),
        ],
        metrics: [
            m("payment_lines_count", "Líneas de pago", "Número de filas provisión-pago.", "count", "integer"),
            m("payment_vouchers_count", "Comprobantes de pago", "Comprobantes de pago distintos.", "count_distinct", "integer", { field: "payment_voucher_number" }),
            m("documents_count", "Documentos pagados", "Documentos provisionados distintos.", "count_distinct", "integer", { field: "provision_key" }),
            m("suppliers_count", "Proveedores", "Proveedores distintos.", "count_distinct", "integer", { field: "ruc" }),
            m("payment_usd_total", "Pago USD", "Suma de pagos netos en USD.", "sum", "usd", { field: "payment_amount_usd" }),
            m("provision_usd_total", "Provisionado USD", "Importe provisionado en USD contado una sola vez por documento.", "sum_distinct", "usd", { field: "provision_amount_usd", distinctField: "provision_key" }),
            m("provision_pen_total", "Provisionado PEN", "Importe provisionado en PEN contado una sola vez por documento.", "sum_distinct", "pen", { field: "provision_amount_pen", distinctField: "provision_key" }),
            m("avg_days_provision_to_payment", "Días provisión → pago", "Promedio de días calendario entre provisión y pago.", "avg_days_diff", "days", { field: "provision_date", field2: "payment_date" }),
            m("avg_days_document_to_payment", "Días documento → pago", "Promedio de días calendario entre fecha de documento y pago.", "avg_days_diff", "days", { field: "document_date", field2: "payment_date" }),
        ],
        rules: [
            "Fuente contable Concar (stg.traceability_veta_conta_payments): provisiones en cuentas 42x de los subdiarios de acopio canceladas por comprobantes del subdiario 203. Solo existen pagos ya registrados.",
            "Es por asiento contable, no por lote: un pago cubre uno o más lotes (paquetes) y no puede atribuirse a un lote. Responde «cuánto hemos pagado por mineral» por período, oficina, proveedor o documento.",
            "payment_amount_usd es neto de detracciones y otros descuentos, por eso no cuadra con lo facturado/contabilizado por lote (lot_usd de finance_mineral_purchases): solo comparar tendencias por período en gráficos independientes. No unir filas, conciliar, calcular saldos cruzados ni atribuir importes por lote.",
            "Los pagos a proveedores de mineral se registran siempre en USD. El importe provisionado conserva su moneda Concar (provision_currency_code PEN/USD): usar provision_usd_total / provision_pen_total en widgets separados y sin conversión.",
            "provision_amount* es un importe de cabecera repetido por pago parcial: usar provision_usd_total / provision_pen_total (una vez por provision_key); nunca sumarlo por fila.",
            "Las notas de abono (NA) tienen signo negativo y reducen los totales.",
            "Fecha principal payment_date; no sustituirla por entry_date ni por fechas de traceability. provision_date y document_date describen otros eventos de este mismo universo.",
            "doc_type (document_type en la vista base) y payment_document_type deben estar disponibles como filtros locales dentro de cada widget de esta fuente, nunca en los filtros generales.",
            "Esta fuente no tiene lot ni entry_date de lote. Nunca inventarlos ni enlazarlos a traceability.",
        ],
        defaultDateField: "payment_date",
        keywords: ["pago", "pagos", "pagado", "cuánto hemos pagado", "cuanto hemos pagado", "comprobante", "comprobantes", "provisión", "provision", "provisionado", "asiento", "asientos", "proveedor", "proveedores", "mineral", "oficina", "tesorería", "tesoreria", "desembolso", "desembolsos", "caja", "cuenta por pagar", "detracción", "detraccion", "finanzas"],
        enabled: true,
        access: { scopes: ["traceability"] },
    },
    {
        id: "finance_costs",
        name: "Costos y gastos (real y presupuesto)",
        area: "finance",
        description: "Costos y gastos de toda la empresa según contabilidad, clasificados por escenario (period_label: REAL 2025, REAL 2026, PPTO 2026): cada línea con fecha, subdiario, comprobante, cuenta y su grupo de costos, fijo/variable, clasificación Dynacor y RRHH, proveedor o concepto, centro de costo con macroproceso, ubicación/sede, zona, naturaleza (costo de producción / gasto), producción/admin, área de Lima e importes PEN y USD con signo contable.",
        endpoint: "/api/vai/finance/costs",
        sqlView: "dw.v_dti_vai_finanzas_costos",
        grain: "Una fila por línea de dw.v_costs_main: asiento contable REAL (subdiario + comprobante + línea) o línea mensual del presupuesto PPTO.",
        query: q(["posting_date", "document_date"], ["month_label", "gerencia_lima", "account_label", "supplier_label", "cost_center_label", "period_label", "scenario", "account_code", "account_group", "cost_group", "fixed_variable", "dynacor_group", "transversal", "cost_center_code", "macro_process", "site_group", "site_type", "site_name", "zone_name", "cost_nature", "prod_admin", "lima_area", "supplier_name", "annex_code", "subledger", "document_type", "debit_credit"]),
        fields: [
            f("month_number", "Número de mes", "attribute", "Mes de posting_date, de 1 a 12, independiente del ejercicio.", "number", "integer"),
            f("month_label", "Meses comparables", "dimension", "01_ENE, 02_FEB, 03_MAR, 04_ABR, 05_MAY, 06_JUN, 07_JUL, 08_AGO, 09_SEP, 10_OCT, 11_NOV y 12_DIC. Seleccionar enero-julio aplica esos mismos meses a cada period_label, sin excluir 2025."),
            f("gerencia_lima", "Gerencia Lima", "dimension", "Clasificador G_LIMA de dw.v_costs_main; es la misma clasificación publicada como lima_area, no el macroproceso."),
            f("account_label", "Cuenta y descripción", "dimension", "Código de cuenta concatenado con su descripción. Usar en filtros, tablas y jerarquías."),
            f("supplier_label", "RUC / anexo y proveedor", "dimension", "Código de anexo concatenado con el proveedor o concepto. No todos los anexos son RUC."),
            f("cost_center_label", "CECO y descripción", "dimension", "Centro de costo concatenado con su descripción."),
            f("gloss", "Glosa", "attribute", "Glosa de línea; cuando falta, glosa del comprobante. Conserva además line_gloss y voucher_gloss para auditoría."),
            f("posting_date", "Fecha contable", "date", "Fecha original del comprobante; para comparar años, filtrar meses con month_label y escenarios con period_label.", "date", "date"),
            f("document_date", "Fecha de documento", "date", "Fecha del documento del proveedor; puede faltar y no existe en PPTO.", "date", "date", ["fecha de documento", "fecha del documento", "emitido"]),
            f("fiscal_year", "Ejercicio", "dimension", "Año de la fecha contable (2025, 2026)."),
            f("period_label", "Período (escenario)", "dimension", "Clasificador de la fila: REAL 2025, REAL 2026 o PPTO 2026 (presupuesto). Escenarios distintos nunca se suman."),
            f("scenario", "Escenario", "dimension", "REAL (asientos contables) o PPTO (presupuesto)."),
            f("subledger", "Subdiario", "dimension", "Subdiario contable del comprobante; vacío en PPTO."),
            f("voucher_number", "Comprobante", "attribute", "Número de comprobante dentro del subdiario; vacío en PPTO."),
            f("voucher_key", "Clave de comprobante", "attribute", "Subdiario + comprobante; identifica el asiento REAL."),
            f("document_type", "Tipo de documento", "dimension", "Tipo del documento del proveedor (FT, RH, NC, etc.); vacío en PPTO."),
            f("document_number", "Documento", "attribute", "Número del documento del proveedor."),
            f("account_code", "Cuenta", "attribute", "Código de la cuenta contable de costo o gasto."),
            f("account_desc", "Descripción de cuenta", "dimension", "Nombre de la cuenta contable."),
            f("account_group", "Grupo de cuenta", "dimension", "Dos primeros dígitos de la cuenta (61 consumo, 62 personal, 63 servicios, 64 tributos, 65 cargas diversas, 67 financieros, 68 provisiones/depreciación, 88 impuesto a la renta)."),
            f("cost_group", "Grupo de costos", "dimension", "Grupo de costos del mapa de cuentas (GASTOS DE PERSONAL, CONSUMIBLES, SERVICIOS DE TERCEROS, CONSUMO DE MINERAL, DEPRECIACIÓN Y AMORTIZACIÓN, GASTOS FINANCIEROS, TRIBUTOS, etc.)."),
            f("fixed_variable", "Fijo / variable", "dimension", "CF costo fijo o CV costo variable según el mapa de cuentas."),
            f("rrhh_nature", "Naturaleza RRHH", "dimension", "Solo cuentas de personal: Estructural, Variable recurrente o No recurrente."),
            f("rrhh_type", "Tipo RRHH", "dimension", "Solo cuentas de personal: remuneración base, beneficios, bonos, liquidaciones, etc."),
            f("dynacor_group", "Grupo Dynacor", "dimension", "Grupo de reporte Dynacor de la cuenta; la numeración difiere entre producción y administración (ver prod_admin)."),
            f("dynacor_subgroup", "Subgrupo Dynacor", "dimension", "Subgrupo de reporte Dynacor de la cuenta."),
            f("transversal", "Área transversal", "dimension", "Área transversal de la cuenta (RRHH, ADMIN GENERAL, CONSULTORIA, TI, SOSTENIBILIDAD, COMUNICACIONES); vacío si no aplica."),
            f("annex_code", "Código de anexo", "attribute", "RUC o código del anexo (proveedor, trabajador, entidad); vacío en PPTO."),
            f("supplier_name", "Proveedor / concepto", "dimension", "Nombre del anexo o concepto normalizado por la vista de costos (PERSONAL, PROVEEDOR MINERO, DIF DE CAMBIO, GASTO FINANCIERO, OEFA, IR, ITF, CONSUMIBLES DIVERSOS…)."),
            f("cost_center_code", "CECO", "attribute", "Código del centro de costo (los CECO financieros de Lima se consolidan en 971004)."),
            f("cost_center_desc", "Centro de costo", "dimension", "Nombre del centro de costo."),
            f("macro_process", "Macroproceso", "dimension", "Macroproceso o área funcional del CECO según el mapa de CECO; valores del tipo GEST. <área> (operaciones, financiera, TI, legal, RRHH, logística, administrativa…) y procesos como ACOPIO MINERAL, CHANCADO, MOLIENDA, CIANURACIÓN / ADSORCIÓN, SSOMA o CONCESIÓN."),
            f("site_group", "Ubicación general", "dimension", "Primer nivel de ubicación: PLANTA PROCESADORA Y CHANCADORA, SEDES DE ACOPIO Y NAZCA, SEDE LIMA, CONCESIÓN, OTROS PRODUCCIÓN."),
            f("site_type", "Tipo de sede", "dimension", "Segundo nivel: PLANTA PROCESADORA, PLANTA CHANCADO, ACOPIO, ADMINISTRACIÓN, CONCESIÓN, RECPO, OTROS PRODUCCIÓN."),
            f("site_name", "Sede", "dimension", "Tercer nivel: PLANTA CHALA (planta procesadora), PLANTA TRUJILLO (chancado), LIMA (administración), y las oficinas de acopio NAZCA, CHALA, PEDREGAL, CHIMBOTE, TRUJILLO, SECOCHA, HUANCA, JULIACA, ISPACAS, CARHUAMAYO, LAS LOMAS, COLQUEMARCA, ABANCAY, MISKY, ALTO MOLINO; además CONCESIÓN, RECPO y OTROS PRODUCCIÓN. CHALA y PLANTA CHALA (igual que TRUJILLO y PLANTA TRUJILLO) son sedes distintas."),
            f("zone_name", "Zona", "dimension", "ZONA PLANTA, ZONA LIMA, ZONA SUR, ZONA NORTE, CONCESIÓN, RECPO, OTROS PRODUCCIÓN."),
            f("cost_nature", "Naturaleza", "dimension", "COSTO DE PRODUCCIÓN, GASTO o CONCESIÓN."),
            f("prod_admin", "Producción / admin", "dimension", "PRODUCCIÓN, ADMIN, GTO FINANCIERO, DIF DE CAMBIO, IR o CONCESIÓN."),
            f("lima_area", "Área de Lima", "dimension", "Área administrativa de Lima por CECO (FINANZAS, LEGAL, TI, RRHH, LOGÍSTICA, SOSTENIBILIDAD, GG, ADMIN GENERAL, COMUNICACIONES, CUMPLIMIENTO, A. CORPORATIVOS); vacío fuera de Lima."),
            f("voucher_gloss", "Glosa del comprobante", "attribute", "Glosa de cabecera del asiento."),
            f("line_gloss", "Glosa de la línea", "attribute", "Glosa de la línea contable."),
            f("work_type", "Tipo de trabajo", "attribute", "Tipo de trabajo de carguío (solo cuenta 659207)."),
            f("debit_credit", "Debe / haber", "dimension", "D o H; vacío en PPTO."),
            f("amount_usd", "Importe USD", "measure", "Importe de la fila en USD con signo contable, sea REAL o PPTO: usar solo con period_label o scenario filtrado.", "number", "usd"),
            f("amount_pen", "Importe PEN", "measure", "Importe de la fila en PEN con signo contable; solo existe en REAL.", "number", "pen"),
            f("real_usd", "Real USD", "measure", "Importe USD de las filas REAL (0 en PPTO).", "number", "usd"),
            f("real_pen", "Real PEN", "measure", "Importe PEN de las filas REAL (0 en PPTO).", "number", "pen"),
            f("budget_usd", "Presupuesto USD", "measure", "Importe USD de las filas PPTO (0 en REAL).", "number", "usd"),
        ],
        metrics: [
            ...costPeriodMetrics(),
            m("lines_count", "Líneas", "Número de filas (asientos REAL o líneas PPTO según el filtro).", "count", "integer"),
            m("vouchers_count", "Comprobantes", "Asientos REAL distintos (subdiario + comprobante).", "count_distinct", "integer", { field: "voucher_key" }),
            m("real_cost_usd", "Costo real USD", "Suma neta de importes USD de las filas REAL.", "sum", "usd", { field: "real_usd" }),
            m("real_cost_pen", "Costo real PEN", "Suma neta de importes PEN de las filas REAL.", "sum", "pen", { field: "real_pen" }),
            m("budget_cost_usd", "Presupuesto USD", "Suma de importes USD de las filas PPTO.", "sum", "usd", { field: "budget_usd" }),
            m("variance_usd", "Variación real − presupuesto USD", "REAL 2026 − PPTO 2026 de los mismos meses y clasificadores.", "sum_diff", "usd", { field: "real_usd", field2: "budget_usd", where: [{ field: "fiscal_year", op: "eq", value: 2026 }] }),
            m("variance_pct", "Variación % vs presupuesto", "(Σ real USD − Σ presupuesto USD) / Σ presupuesto USD × 100.", "pct_change", "percent", { numerator: "real_usd", denominator: "budget_usd", where: [{ field: "fiscal_year", op: "eq", value: 2026 }] }),
            m("budget_execution_pct", "Avance % del presupuesto", "Σ real USD / Σ presupuesto USD × 100.", "ratio", "percent", { numerator: "real_usd", denominator: "budget_usd", where: [{ field: "fiscal_year", op: "eq", value: 2026 }], multiplier: 100 }),
            m("real_cost_usd_ex_mineral", "Costo real USD sin mineral", "Costo real USD excluyendo el consumo de mineral (cost_group CONSUMO DE MINERAL), que se compra por lote en finance_mineral_purchases.", "sum", "usd", { field: "real_usd", where: [{ field: "cost_group", op: "ne", value: "CONSUMO DE MINERAL" }] }),
            m("real_cost_pen_ex_mineral", "Costo real PEN sin mineral", "Costo real PEN excluyendo el consumo de mineral (cost_group CONSUMO DE MINERAL).", "sum", "pen", { field: "real_pen", where: [{ field: "cost_group", op: "ne", value: "CONSUMO DE MINERAL" }] }),
            m("avg_real_cost_usd_per_voucher", "USD real promedio por comprobante", "Σ real USD / asientos REAL distintos.", "sum_per_distinct", "usd", { field: "real_usd", distinctField: "voucher_key" }),
            m("accounts_count", "Cuentas", "Cuentas contables distintas.", "count_distinct", "integer", { field: "account_code" }),
            m("cost_centers_count", "Centros de costo", "CECO distintos.", "count_distinct", "integer", { field: "cost_center_code" }),
            m("suppliers_count", "Proveedores / anexos", "Anexos distintos (solo REAL).", "count_distinct", "integer", { field: "annex_code" }),
        ],
        rules: [
            "Fuente oficial de costos y gastos de dw.v_costs_main. Mantener su universo, clasificadores, signos, nulos y glosas. No reconstruir costos desde compras de lotes, pagos, planta u otras fuentes.",
            "USD por defecto. PEN solo cuando lo pide explícitamente el usuario; en widgets separados cuando solicita ambas monedas. PPTO no tiene PEN: no convertirlo ni presentarlo como cero.",
            "period_label es un filtro obligatorio: REAL 2025, REAL 2026 y PPTO 2026 son series distintas. Nunca mostrar un total que sume esos períodos entre sí.",
            "month_label es el filtro de meses comparables independiente del año. Enero-julio significa ENE-JUL en cada period_label. No usar un rango absoluto 2026-01-01 a 2026-07-31 que elimine REAL 2025. Sin período solicitado se mantienen todos los meses.",
            "Cabecera estándar: tarjetas REAL 2026, PPTO 2026 y REAL 2025 con importe acumulado y explicación, más una matriz desplegable. No agregar por defecto un gráfico cuyo único eje categórico sea period_label. En PEN solo existen las tarjetas REAL.",
            "Usar cost_total_usd/cost_total_pen únicamente con period_label en el agrupador o desglose. Para un KPI usar cost_real_2026_usd, cost_real_2025_usd o cost_ppto_2026_usd; no sumar varios años REAL en una sola tarjeta.",
            "variance_usd, variance_pct y budget_execution_pct comparan exclusivamente REAL 2026 y PPTO 2026 de los mismos meses y clasificadores. No comparar REAL 2025 contra el presupuesto 2026 ni sumar 2025+2026 contra PPTO 2026.",
            "Matriz: por defecto type=matrix, una métrica de suma, columns como jerarquía de filas [account_label, supplier_label, gloss], matrixColumns=[period_label], dateField=posting_date y bucket=month. Si el usuario define explícitamente filas o columnas, respeta exactamente ese layout y no agregues columnas temporales que no haya pedido. Sus totales se separan por escenario/ejercicio; no suman subtotales y descendientes.",
            "En tablas y filtros mostrar cuenta con descripción y RUC/código de anexo con proveedor. Incluir gloss, y permitir revisar line_gloss, voucher_gloss, comprobante, documento y CECO en el detalle.",
            "Filtros de clasificación: gerencia_lima (G_LIMA, alias de lima_area), zone_name, site_name, cost_group, account_label, cost_center_label, supplier_label y subledger, además de macro_process, cost_nature, prod_admin, dynacor_group/subgroup, fixed_variable, rrhh_nature/type y transversal cuando correspondan.",
            "Para tendencias comparables, month_label en X y period_label como desglose. Para gráficos de barras por cualquier clasificador, usar cost_total_usd o cost_total_pen como única métrica y period_label como breakdown con barras agrupadas, nunca apiladas, de modo que cada categoría tenga columnas separadas por REAL 2026, REAL 2025 y PPTO 2026 cuando existan. Evitar gráficos que solo comparen period_label sin otro clasificador. La matriz muestra meses y permite bajar por la jerarquía solicitada.",
            "Los importes ya tienen signo contable: sumar directamente, incluyendo negativos. No convertir USD/PEN. No inventar CAPEX o proyecto. El consumo de mineral pertenece al universo y solo se excluye cuando lo pide el usuario.",
        ],
        defaultDateField: "posting_date",
        relations: [{ field: "cost_center_code", source: "plant_costs", targetField: "cost_center_code", description: "Costos generales → detalle de planta con TMS del mes." }],
        keywords: ["costo", "costos", "gasto", "gastos", "presupuesto", "ppto", "real", "reales", "real vs presupuesto", "variación", "variacion", "avance", "cuenta", "cuentas", "ceco", "centro de costo", "centros de costo", "gerencia", "gerencias", "macroproceso", "área", "area", "áreas", "areas", "sede", "sedes", "zona", "proveedor", "proveedores", "anexo", "clasificación", "clasificacion", "grupo de costos", "fijo", "variable", "dynacor", "rrhh", "personal", "planilla", "servicios", "consumibles", "depreciación", "depreciacion", "financiero", "financieros", "operaciones", "administración", "administracion", "lima", "planta", "acopio", "concesión", "concesion", "subdiario", "comprobante", "contable", "contabilidad", "finanzas", "opex", "composición", "composicion", "estructura de costos", "usd", "pen", "soles", "dólares", "dolares"],
        enabled: true,
        access: { scopes: ["vai"] },
    },
    {
        id: "fixassets_catalogue",
        name: "Catálogo de activos fijos",
        area: "fixassets",
        description: "Foto actual completa del catálogo de activos fijos: una fila por COD con clasificador de depreciación, grupo y denominación contable, ubicación, área, centro de costo, CAPEX, valor actual, depreciación YTD, depreciación acumulada y saldo en USD y PEN.",
        endpoint: "/api/vai/fixed-assets/assets",
        sqlView: "dw.v_finance_actfij_cat_get + stg.finance_actfij_mapping",
        grain: "Una fila por activo (COD). Incluye todo el catálogo actual, no solo activos adquiridos en el período vigente.",
        temporalMode: "snapshot",
        query: q(["acquisition_date", "operation_date", "disposal_date", "comp_date"], ["asset_type", "account_group", "account_denom", "location_name", "area_name", "cost_center_code", "capex_code", "asset_situation", "source_name", "balance_status"]),
        fields: [
            f("asset_code", "COD", "attribute", "Código del activo (7 dígitos)."),
            f("asset_description", "Descripción", "attribute", "Descripción del activo."),
            f("source_name", "Origen", "dimension", "WEB, VR, TRASLADO o HISTORIC."),
            f("location_name", "Ubicación", "dimension", "Ubicación física."),
            f("area_name", "Área", "dimension", "Área usuaria."),
            f("assigned_to", "Asignado a", "dimension", "Responsable asignado."),
            f("asset_type", "Clasificador de depreciación", "dimension", "Clasificación contable/depreciación del activo, por ejemplo LR, DUP o NO DEPRECIA."),
            f("account_group", "Grupo contable", "dimension", "Grupo de la cuenta de activo según el mapping."),
            f("account_denom", "Denominación", "dimension", "Denominación de la cuenta de activo según el mapping."),
            f("origin_account_desc", "Cuenta origen", "dimension", "Descripción de la cuenta contable de origen."),
            f("cost_center_code", "CECO", "attribute", "Código del centro de costo."),
            f("cost_center_desc", "Centro de costo", "dimension", "Descripción del CECO."),
            f("capex_code", "Código CAPEX", "dimension", "Proyecto CAPEX asociado, si existe."),
            f("po_num", "Orden de servicio", "attribute", "OS/OC de origen cuando se conoce."),
            f("brand", "Marca", "dimension", "Marca."),
            f("model", "Modelo", "attribute", "Modelo."),
            f("serial_number", "Serie", "attribute", "Número de serie."),
            f("asset_situation", "Situación", "dimension", "OPERATIVO, DEPRECIADO o vacío."),
            f("balance_status", "Estado de saldo", "dimension", "ACTIVO (saldo > 0), DEPRECIADO (saldo 0 con valor) o BAJA (saldo y valor 0)."),
            f("depreciation_method", "Método", "dimension", "Método de depreciación."),
            f("comp_date", "Fecha contable", "date", "Fecha contable original del activo; no representa la fecha del estado actual del catálogo.", "date", "date", ["fecha contable", "contable", "comp_date"]),
            f("acquisition_date", "Fecha de adquisición", "date", "Fecha de adquisición del activo.", "date", "date", ["fecha de adquisición", "fecha adquisicion", "adquisición", "adquisicion", "adquirido", "adquiridos", "alta", "altas"]),
            f("operation_date", "Fecha de operación", "date", "Inicio de operación o inicio de depreciación.", "date", "date", ["fecha de operación", "fecha de operacion", "inicio de operación", "inicio de operacion"]),
            f("disposal_date", "Fecha de baja", "date", "Fecha de baja; vacía si sigue activo.", "date", "date", ["fecha de baja", "baja", "bajas", "disposal"]),
            f("exc_rate", "T.C.", "attribute", "Tipo de cambio de adquisición.", "number", "decimal"),
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
            f("deprec_rate_pct", "Tasa deprec. %", "measure", "Tasa anual de depreciación del mapping.", "number", "percent"),
            f("applied_rate_pct", "Tasa aplicada %", "measure", "Última tasa realmente aplicada al activo.", "number", "percent"),
        ],
        metrics: [
            m("assets_count", "Activos", "Número de activos.", "count", "integer"),
            m("active_assets", "Activos con saldo", "Activos con saldo de depreciación positivo en PEN o USD.", "count", "integer", { where: [{ field: "balance_status", op: "eq", value: "ACTIVO" }] }),
            m("disposed_assets", "Activos dados de baja", "Activos cuyo valor y saldo son cero en ambas monedas.", "count", "integer", { where: [{ field: "balance_status", op: "eq", value: "BAJA" }] }),
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
            m("avg_rate_pct", "Tasa promedio %", "Promedio simple de la tasa del mapping.", "avg", "percent", { field: "deprec_rate_pct" }),
            m("depreciated_pct_pen", "% depreciado PEN", "Depreciación acumulada PEN dividida entre valor actual PEN.", "ratio", "fraction", { numerator: "depreciation_cum_amount_pen", denominator: "asset_final_value_pen", where: [{ field: "asset_final_value_pen", op: "gt", value: 0 }] }),
            m("depreciated_pct_usd", "% depreciado USD", "Depreciación acumulada USD dividida entre valor actual USD.", "ratio", "fraction", { numerator: "depreciation_cum_amount_usd", denominator: "asset_final_value_usd", where: [{ field: "asset_final_value_usd", op: "gt", value: 0 }] }),
        ],
        rules: [
            "Esta fuente es una foto actual de TODO el catálogo. No limites sus filas por Fecha contable, Fecha de adquisición, Fecha de operación o Fecha de baja salvo que el usuario pida explícitamente analizar una de esas fechas.",
            "Pedir estado actual, valor actual, saldo actual, catálogo, inventario o clasificador de depreciación NO implica filtrar el catálogo por el mes actual.",
            "depreciation_amount_pen y depreciation_amount_usd ya representan depreciación YTD por activo, desde enero hasta el período contable vigente. No necesitan un date_range sobre esta fuente.",
            "Para un catálogo con clasificador, valor actual, depreciación YTD y saldo usa esta fuente directamente: asset_type + asset_final_value_* + depreciation_amount_* + asset_balance_*.",
            "depreciation_cum_amount_* es depreciación histórica acumulada total y no debe confundirse con depreciation_amount_* que es YTD.",
            "Para evolución mensual de depreciación usa fixassets_depreciation.",
            "Cuando se pide «activos de <período>» sin otro hito, se entiende por acquisition_date.",
            "Presentar PEN y USD por separado.",
            "Activo significa saldo de depreciación mayor que cero; totalmente depreciado significa saldo cero; dado de baja exige además valor cero (balance_status ya lo clasifica).",
            "La tasa es un porcentaje: se promedia, no se suma.",
        ],
        defaultDateField: "acquisition_date",
        relations: [{ field: "asset_code", source: "fixassets_depreciation", targetField: "asset_code", description: "Activo → depreciación mensual." }],
        keywords: ["activo", "activos", "fijos", "catálogo", "inventario", "clasificador", "clasificación", "tipo de depreciación", "depreciación ytd", "ytd", "valor actual", "ubicación", "área", "ceco", "centro de costo", "saldo", "valor", "costo", "baja", "capex", "marca", "tipo", "grupo", "denominación"],
        enabled: true,
        access: { scopes: ["fixassets"] },
    },
    {
        id: "fixassets_depreciation",
        name: "Depreciación mensual de activos",
        area: "fixassets",
        description: "Depreciación por activo y período mensual en PEN y USD: depreciación del período, acumulada, valor final, saldo y movimientos (altas, bajas, reclasificaciones, ajustes), con tipo de activo, grupo, área, ubicación y centro de costo del catálogo.",
        endpoint: "/api/vai/fixed-assets/depreciation",
        sqlView: "dw.v_finance_actfij_deprec_get + stg.finance_actfij_catalogue + stg.finance_actfij_mapping",
        grain: "Una fila por activo y período mensual.",
        query: q(["period_date"], ["asset_type", "source_name", "account_group", "account_denom", "location_name", "area_name", "cost_center_code", "capex_code", "asset_situation", "asset_code"]),
        fields: [
            f("asset_code", "COD", "attribute", "Código del activo."),
            f("asset_description", "Descripción", "attribute", "Descripción del activo."),
            f("period_date", "Período", "date", "Mes contable de la depreciación.", "date", "date", ["depreciación", "depreciacion", "período", "periodo", "mes"]),
            f("asset_type", "Tipo de activo", "dimension", "LR, DUP, NO DEPRECIA, etc."),
            f("source_name", "Estado de carga", "dimension", "WEB, WEB_PEN, WEB_USD o lifecycle BAJA/RECLA; VIRTUAL ya está excluido."),
            f("account_group", "Grupo contable", "dimension", "Grupo de la cuenta de activo."),
            f("account_denom", "Denominación", "dimension", "Denominación de la cuenta de activo."),
            f("location_name", "Ubicación", "dimension", "Ubicación actual del activo en el catálogo."),
            f("area_name", "Área", "dimension", "Área actual del activo en el catálogo."),
            f("cost_center_code", "CECO", "attribute", "Código del centro de costo actual."),
            f("cost_center_desc", "Centro de costo", "dimension", "Descripción del centro de costo actual."),
            f("capex_code", "Código CAPEX", "dimension", "Proyecto CAPEX asociado, si existe."),
            f("asset_situation", "Situación", "dimension", "Situación actual del activo."),
            f("applied_rate_pct", "Tasa aplicada %", "measure", "Tasa aplicada en el período.", "number", "percent"),
            f("exc_rate", "T.C.", "attribute", "Tipo de cambio del período.", "number", "decimal"),
            f("depreciation_amount_pen", "Depreciación PEN", "measure", "Depreciación del período en PEN.", "number", "pen"),
            f("depreciation_amount_usd", "Depreciación USD", "measure", "Depreciación del período en USD.", "number", "usd"),
            f("depreciation_cum_amount_pen", "Acumulada PEN", "measure", "Depreciación acumulada al período.", "number", "pen"),
            f("depreciation_cum_amount_usd", "Acumulada USD", "measure", "Depreciación acumulada al período.", "number", "usd"),
            f("asset_final_value_pen", "Valor final PEN", "measure", "Valor del activo al período.", "number", "pen"),
            f("asset_final_value_usd", "Valor final USD", "measure", "Valor del activo al período.", "number", "usd"),
            f("asset_balance_pen", "Saldo PEN", "measure", "Saldo neto al período.", "number", "pen"),
            f("asset_balance_usd", "Saldo USD", "measure", "Saldo neto al período.", "number", "usd"),
            f("acquisition_var_pen", "Altas PEN", "measure", "Adquisiciones del período en PEN.", "number", "pen"),
            f("acquisition_var_usd", "Altas USD", "measure", "Adquisiciones del período en USD.", "number", "usd"),
            f("disposal_var_pen", "Bajas PEN", "measure", "Bajas del período en PEN (negativas).", "number", "pen"),
            f("disposal_var_usd", "Bajas USD", "measure", "Bajas del período en USD (negativas).", "number", "usd"),
            f("reclass_var_pen", "Reclasificación PEN", "measure", "Reclasificaciones del período en PEN.", "number", "pen"),
            f("reclass_var_usd", "Reclasificación USD", "measure", "Reclasificaciones del período en USD.", "number", "usd"),
            f("adjustment_var_pen", "Ajuste PEN", "measure", "Ajustes del período en PEN.", "number", "pen"),
            f("adjustment_var_usd", "Ajuste USD", "measure", "Ajustes del período en USD.", "number", "usd"),
        ],
        metrics: [
            m("deprec_pen_total", "Depreciación PEN", "Suma de la depreciación del período.", "sum", "pen", { field: "depreciation_amount_pen" }),
            m("deprec_usd_total", "Depreciación USD", "Suma de la depreciación del período.", "sum", "usd", { field: "depreciation_amount_usd" }),
            m("balance_pen_total", "Saldo PEN", "Suma de saldos; solo tiene sentido dentro de un mismo período.", "sum", "pen", { field: "asset_balance_pen" }),
            m("balance_usd_total", "Saldo USD", "Suma de saldos; solo tiene sentido dentro de un mismo período.", "sum", "usd", { field: "asset_balance_usd" }),
            m("final_value_pen_total", "Valor final PEN", "Suma de valores finales; solo dentro de un mismo período.", "sum", "pen", { field: "asset_final_value_pen" }),
            m("final_value_usd_total", "Valor final USD", "Suma de valores finales; solo dentro de un mismo período.", "sum", "usd", { field: "asset_final_value_usd" }),
            m("acquisitions_pen_total", "Altas PEN", "Suma de adquisiciones del período.", "sum", "pen", { field: "acquisition_var_pen" }),
            m("acquisitions_usd_total", "Altas USD", "Suma de adquisiciones del período.", "sum", "usd", { field: "acquisition_var_usd" }),
            m("disposals_pen_total", "Bajas PEN", "Suma de bajas del período.", "sum", "pen", { field: "disposal_var_pen" }),
            m("disposals_usd_total", "Bajas USD", "Suma de bajas del período.", "sum", "usd", { field: "disposal_var_usd" }),
            m("assets_count", "Activos", "Activos distintos con depreciación.", "count_distinct", "integer", { field: "asset_code" }),
            m("periods_count", "Períodos", "Meses distintos incluidos.", "count_distinct", "integer", { field: "period_date" }),
            m("avg_rate_pct", "Tasa promedio %", "Promedio de la tasa aplicada.", "avg", "percent", { field: "applied_rate_pct" }),
        ],
        exclusions: [{ field: "source_name", op: "ne", value: "VIRTUAL" }],
        rules: [
            "Las filas VIRTUAL son proyección y se excluyen siempre (ya no llegan del endpoint).",
            "Saldos y valores finales son fotos por período: no sumarlos a través de varios meses; agrupar por período o tomar el último.",
            "Es la fuente principal para análisis mensual de depreciación por área, ubicación, CECO, grupo o tipo; los clasificadores son los actuales del catálogo.",
            "Presentar PEN y USD por separado.",
        ],
        defaultDateField: "period_date",
        relations: [{ field: "asset_code", source: "fixassets_catalogue", targetField: "asset_code", description: "Depreciación → activo." }],
        keywords: ["depreciación", "depreciacion", "mensual", "período", "periodo", "provisión", "activo", "saldo", "tasa", "pen", "usd", "altas", "bajas", "reclasificación", "área", "ceco"],
        enabled: true,
        access: { scopes: ["fixassets"] },
    },
    {
        id: "plant_shifts",
        name: "Balance metalúrgico por guardia",
        area: "planta",
        description: "Balance metalúrgico de planta por guardia (turno A/B): tonelaje húmedo y seco, humedad, leyes de cabeza, gramos de Au/Ag alimentados, en overflow, en relave y producidos, recuperación, horas de operación y parada, densidad, malla −200, volumen de solución, NaCN y pH del circuito, consumo de NaCN, soda y bolas por molino con sus ratios kg/TMS y el costo mensual prorrateado por guardia.",
        endpoint: "/api/vai/plant/shifts",
        sqlView: "dw.v_dti_vai_planta_guardias (misma lógica y universo que dw.v_plant_shift)",
        grain: "Una fila por guardia (shift_date + turno A/B).",
        query: q(["shift_date"], ["plant_shift", "plant_supervisor", "shift_id"]),
        fields: [
            f("shift_id", "Guardia", "attribute", "Identificador YYYYMMDD-A/B."),
            f("shift_date", "Fecha", "date", "Fecha oficial de la guardia; el turno nocturno pertenece a la fecha en la que inicia.", "date", "date", ["guardia", "balance", "producción", "produccion", "turno", "tratado", "tratamiento"]),
            f("plant_shift", "Turno", "dimension", "A o B."),
            f("plant_supervisor", "Supervisor", "dimension", "Supervisor de la guardia."),
            f("tmh", "TMH", "measure", "Toneladas húmedas tratadas.", "number", "tmh"),
            f("h2o_frac", "Humedad", "measure", "Humedad del mineral como fracción 0-1; se pondera por TMH.", "number", "fraction"),
            f("tms", "TMS", "measure", "Toneladas secas tratadas = TMH × (1 − humedad). Es el ponderador de las leyes.", "number", "tms"),
            f("operation_hr", "Horas de operación", "measure", "Horas efectivas de operación de la guardia.", "number", "hours"),
            f("shift_stop_hr", "Horas de parada", "measure", "Horas de parada de la guardia.", "number", "hours"),
            f("shift_total_duration", "Horas totales", "measure", "Operación + parada.", "number", "hours"),
            f("prod_ratio", "TMS/h de la guardia", "attribute", "Toneladas secas por hora de operación de esa guardia; para períodos usar la métrica TMS por hora.", "number", "decimal"),
            f("au_feed", "Ley Au cabeza (g/t)", "measure", "Ley de oro de alimentación; se pondera por TMS.", "number", "grade_gt"),
            f("ag_feed", "Ley Ag cabeza (g/t)", "measure", "Ley de plata de alimentación; se pondera por TMS.", "number", "grade_gt"),
            f("au_feed_g", "Au alimentado (g)", "measure", "Gramos de oro alimentados = ley cabeza × TMS.", "number", "g"),
            f("ag_feed_g", "Ag alimentado (g)", "measure", "Gramos de plata alimentados = ley cabeza × TMS.", "number", "g"),
            f("density_of", "Densidad OF (g/l)", "measure", "Densidad de la pulpa del overflow; se pondera por TMS.", "number", "decimal"),
            f("mesh200_frac", "Malla −200", "measure", "Fracción pasante malla 200 (0-1); promedio simple.", "number", "fraction"),
            f("vol_solu_m3", "Volumen de solución (m³)", "measure", "Volumen de solución calculado desde TMS y densidad del overflow.", "number", "m3"),
            f("au_solid_of", "Au sólido OF (g/t)", "measure", "Ley de oro en el sólido del overflow; se pondera por TMS.", "number", "grade_gt"),
            f("au_solid_of_g", "Au sólido OF (g)", "measure", "Gramos de oro en el sólido del overflow.", "number", "g"),
            f("au_solu_of", "Au solución OF (g/m³)", "measure", "Oro en la solución del overflow (g/m³ = mg/l); se pondera por TMS.", "number", "g_m3"),
            f("au_solu_of_g", "Au solución OF (g)", "measure", "Gramos de oro en la solución del overflow.", "number", "g"),
            f("au_soli_solu_of_g", "Au OF total (g)", "measure", "Gramos de oro en sólido + solución del overflow.", "number", "g"),
            f("ag_solid_of", "Ag sólido OF (g/t)", "measure", "Ley de plata en el sólido del overflow; se pondera por TMS.", "number", "grade_gt"),
            f("ag_solid_of_g", "Ag sólido OF (g)", "measure", "Gramos de plata en el sólido del overflow.", "number", "g"),
            f("ag_solu_of", "Ag solución OF (g/m³)", "measure", "Plata en la solución del overflow (g/m³ = mg/l); se pondera por TMS.", "number", "g_m3"),
            f("ag_solu_of_g", "Ag solución OF (g)", "measure", "Gramos de plata en la solución del overflow.", "number", "g"),
            f("ag_soli_solu_of_g", "Ag OF total (g)", "measure", "Gramos de plata en sólido + solución del overflow.", "number", "g"),
            f("au_solid_tail", "Au sólido relave (g/t)", "measure", "Ley de oro en el sólido del relave; se pondera por TMS.", "number", "grade_gt"),
            f("au_solid_tail_g", "Au sólido relave (g)", "measure", "Gramos de oro en el sólido del relave.", "number", "g"),
            f("au_solu_tail", "Au solución relave (g/m³)", "measure", "Oro en la solución del relave (g/m³ = mg/l); se pondera por TMS.", "number", "g_m3"),
            f("au_solu_tail_g", "Au solución relave (g)", "measure", "Gramos de oro en la solución del relave.", "number", "g"),
            f("au_soli_solu_tail", "Au relave total (g/t)", "measure", "Ley equivalente del relave (sólido + solución) por TMS; se pondera por TMS.", "number", "grade_gt"),
            f("au_soli_solu_tail_g", "Au relave total (g)", "measure", "Gramos de oro perdidos en relave (sólido + solución).", "number", "g"),
            f("ag_solid_tail", "Ag sólido relave (g/t)", "measure", "Ley de plata en el sólido del relave; se pondera por TMS.", "number", "grade_gt"),
            f("ag_solid_tail_g", "Ag sólido relave (g)", "measure", "Gramos de plata en el sólido del relave.", "number", "g"),
            f("ag_solu_tail", "Ag solución relave (g/m³)", "measure", "Plata en la solución del relave (g/m³ = mg/l); se pondera por TMS.", "number", "g_m3"),
            f("ag_solu_tail_g", "Ag solución relave (g)", "measure", "Gramos de plata en la solución del relave.", "number", "g"),
            f("ag_soli_solu_tail", "Ag relave total (g/t)", "measure", "Ley equivalente del relave de plata (sólido + solución) por TMS; se pondera por TMS.", "number", "grade_gt"),
            f("ag_soli_solu_tail_g", "Ag relave total (g)", "measure", "Gramos de plata perdidos en relave (sólido + solución).", "number", "g"),
            f("au_prod", "Au producido (g)", "measure", "Gramos de oro producidos = alimentado − relave total.", "number", "g"),
            f("ag_prod", "Ag producido (g)", "measure", "Gramos de plata producidos = alimentado − relave total.", "number", "g"),
            f("au_recu", "Recuperación Au de la guardia", "attribute", "Au producido / Au alimentado de esa guardia (fracción 0-1); para períodos usar la métrica Recuperación Au.", "number", "fraction"),
            f("ag_recu", "Recuperación Ag de la guardia", "attribute", "Ag producido / Ag alimentado de esa guardia (fracción 0-1); para períodos usar la métrica Recuperación Ag.", "number", "fraction"),
            f("nacn_of", "NaCN overflow", "measure", "Concentración de cianuro en el overflow; se pondera por TMS.", "number", "decimal"),
            f("nacn_ads", "NaCN adsorción", "measure", "Concentración de cianuro en adsorción; se pondera por TMS.", "number", "decimal"),
            f("nacn_tail", "NaCN relave", "measure", "Concentración de cianuro en el relave; se pondera por TMS.", "number", "decimal"),
            f("ph_of", "pH overflow", "measure", "pH en el overflow; promedio simple.", "number", "decimal"),
            f("ph_ads", "pH adsorción", "measure", "pH en adsorción; promedio simple.", "number", "decimal"),
            f("ph_tail", "pH relave", "measure", "pH en el relave; promedio simple.", "number", "decimal"),
            f("nacn_qty_kg", "NaCN (kg)", "measure", "Cianuro de sodio consumido en la guardia.", "number", "kg"),
            f("nacn_ratio", "NaCN kg/TMS de la guardia", "attribute", "Ratio de cianuro de esa guardia; para períodos usar la métrica NaCN kg/TMS.", "number", "kg_per_tms"),
            f("naoh_qty_kg", "Soda cáustica (kg)", "measure", "Soda cáustica consumida en la guardia.", "number", "kg"),
            f("naoh_ratio", "Soda kg/TMS de la guardia", "attribute", "Ratio de soda de esa guardia; para períodos usar la métrica Soda kg/TMS.", "number", "kg_per_tms"),
            f("balls_total_kg", "Bolas (kg)", "measure", "Bolas de molienda consumidas en la guardia (todos los molinos).", "number", "kg"),
            f("balls_ratio", "Bolas kg/TMS de la guardia", "attribute", "Ratio de bolas de esa guardia; para períodos usar la métrica Bolas kg/TMS.", "number", "kg_per_tms"),
            f("m1_balls_kg", "Bolas molino 1 (kg)", "measure", "Bolas consumidas en el molino 1.", "number", "kg"),
            f("m2_balls_kg", "Bolas molino 2 (kg)", "measure", "Bolas consumidas en el molino 2.", "number", "kg"),
            f("m3_balls_kg", "Bolas molino 3 (kg)", "measure", "Bolas consumidas en el molino 3.", "number", "kg"),
            f("shift_cost_usd", "Costo por guardia USD", "measure", "Costo mensual contable de planta prorrateado por guardia.", "number", "usd"),
            f("shift_comment", "Comentario", "attribute", "Comentario de la guardia."),
        ],
        metrics: [
            m("shifts_count", "Guardias", "Número de guardias.", "count", "integer"),
            m("tmh_total", "TMH tratadas", "Suma de toneladas húmedas.", "sum", "tmh", { field: "tmh" }),
            m("tms_total", "TMS tratadas", "Suma de toneladas secas.", "sum", "tms", { field: "tms" }),
            m("avg_h2o", "Humedad promedio", "Humedad ponderada por TMH.", "weighted_avg", "fraction", { field: "h2o_frac", weight: "tmh" }),
            m("avg_au_feed", "Ley Au cabeza", "Ley de oro de cabeza ponderada por TMS.", "weighted_avg", "grade_gt", { field: "au_feed", weight: "tms" }),
            m("avg_ag_feed", "Ley Ag cabeza", "Ley de plata de cabeza ponderada por TMS.", "weighted_avg", "grade_gt", { field: "ag_feed", weight: "tms" }),
            m("au_feed_g_total", "Au alimentado (g)", "Suma de gramos de oro alimentados.", "sum", "g", { field: "au_feed_g" }),
            m("ag_feed_g_total", "Ag alimentado (g)", "Suma de gramos de plata alimentados.", "sum", "g", { field: "ag_feed_g" }),
            m("au_prod_g_total", "Au producido (g)", "Suma de gramos de oro producidos.", "sum", "g", { field: "au_prod" }),
            m("ag_prod_g_total", "Ag producido (g)", "Suma de gramos de plata producidos.", "sum", "g", { field: "ag_prod" }),
            m("au_tail_g_total", "Au en relave (g)", "Suma de gramos de oro perdidos en relave (sólido + solución).", "sum", "g", { field: "au_soli_solu_tail_g" }),
            m("ag_tail_g_total", "Ag en relave (g)", "Suma de gramos de plata perdidos en relave (sólido + solución).", "sum", "g", { field: "ag_soli_solu_tail_g" }),
            m("au_of_g_total", "Au en overflow (g)", "Suma de gramos de oro en el overflow (sólido + solución).", "sum", "g", { field: "au_soli_solu_of_g" }),
            m("ag_of_g_total", "Ag en overflow (g)", "Suma de gramos de plata en el overflow (sólido + solución).", "sum", "g", { field: "ag_soli_solu_of_g" }),
            m("au_recovery", "Recuperación Au", "Σ Au producido / Σ Au alimentado.", "ratio", "fraction", { numerator: "au_prod", denominator: "au_feed_g" }),
            m("ag_recovery", "Recuperación Ag", "Σ Ag producido / Σ Ag alimentado.", "ratio", "fraction", { numerator: "ag_prod", denominator: "ag_feed_g" }),
            m("avg_au_solid_of", "Ley Au sólido OF", "Ley de oro en sólido del overflow ponderada por TMS.", "weighted_avg", "grade_gt", { field: "au_solid_of", weight: "tms" }),
            m("avg_au_solu_of", "Au solución OF", "Oro en solución del overflow ponderado por TMS.", "weighted_avg", "g_m3", { field: "au_solu_of", weight: "tms" }),
            m("avg_au_solid_tail", "Ley Au sólido relave", "Ley de oro en sólido del relave ponderada por TMS.", "weighted_avg", "grade_gt", { field: "au_solid_tail", weight: "tms" }),
            m("avg_au_solu_tail", "Au solución relave", "Oro en solución del relave ponderado por TMS.", "weighted_avg", "g_m3", { field: "au_solu_tail", weight: "tms" }),
            m("avg_au_tail", "Ley Au relave total", "Ley equivalente de relave (sólido + solución) ponderada por TMS.", "weighted_avg", "grade_gt", { field: "au_soli_solu_tail", weight: "tms" }),
            m("avg_ag_solid_of", "Ley Ag sólido OF", "Ley de plata en sólido del overflow ponderada por TMS.", "weighted_avg", "grade_gt", { field: "ag_solid_of", weight: "tms" }),
            m("avg_ag_solu_of", "Ag solución OF", "Plata en solución del overflow ponderada por TMS.", "weighted_avg", "g_m3", { field: "ag_solu_of", weight: "tms" }),
            m("avg_ag_solid_tail", "Ley Ag sólido relave", "Ley de plata en sólido del relave ponderada por TMS.", "weighted_avg", "grade_gt", { field: "ag_solid_tail", weight: "tms" }),
            m("avg_ag_solu_tail", "Ag solución relave", "Plata en solución del relave ponderada por TMS.", "weighted_avg", "g_m3", { field: "ag_solu_tail", weight: "tms" }),
            m("avg_ag_tail", "Ley Ag relave total", "Ley equivalente de relave de plata (sólido + solución) ponderada por TMS.", "weighted_avg", "grade_gt", { field: "ag_soli_solu_tail", weight: "tms" }),
            m("avg_density_of", "Densidad OF", "Densidad del overflow ponderada por TMS.", "weighted_avg", "decimal", { field: "density_of", weight: "tms" }),
            m("avg_mesh200", "Malla −200 promedio", "Promedio simple de la fracción pasante malla 200.", "avg", "fraction", { field: "mesh200_frac" }),
            m("vol_solu_total", "Volumen de solución (m³)", "Suma del volumen de solución.", "sum", "m3", { field: "vol_solu_m3" }),
            m("operation_hours", "Horas de operación", "Suma de horas efectivas.", "sum", "hours", { field: "operation_hr" }),
            m("stop_hours", "Horas de parada", "Suma de horas de parada.", "sum", "hours", { field: "shift_stop_hr" }),
            m("total_hours", "Horas totales", "Suma de horas de operación + parada.", "sum", "hours", { field: "shift_total_duration" }),
            m("availability", "Disponibilidad", "Σ horas de operación / Σ horas totales.", "ratio", "fraction", { numerator: "operation_hr", denominator: "shift_total_duration" }),
            m("throughput", "TMS por hora", "Σ TMS / Σ horas de operación.", "ratio", "decimal", { numerator: "tms", denominator: "operation_hr" }),
            m("tms_per_shift", "TMS por guardia", "Σ TMS dividida entre guardias distintas.", "sum_per_distinct", "tms", { field: "tms", distinctField: "shift_id" }),
            m("avg_nacn_of", "NaCN overflow", "Concentración de cianuro en overflow ponderada por TMS.", "weighted_avg", "decimal", { field: "nacn_of", weight: "tms" }),
            m("avg_nacn_ads", "NaCN adsorción", "Concentración de cianuro en adsorción ponderada por TMS.", "weighted_avg", "decimal", { field: "nacn_ads", weight: "tms" }),
            m("avg_nacn_tail", "NaCN relave", "Concentración de cianuro en relave ponderada por TMS.", "weighted_avg", "decimal", { field: "nacn_tail", weight: "tms" }),
            m("avg_ph_of", "pH overflow", "Promedio simple de pH en overflow.", "avg", "decimal", { field: "ph_of" }),
            m("avg_ph_ads", "pH adsorción", "Promedio simple de pH en adsorción.", "avg", "decimal", { field: "ph_ads" }),
            m("avg_ph_tail", "pH relave", "Promedio simple de pH en relave.", "avg", "decimal", { field: "ph_tail" }),
            m("nacn_total", "NaCN (kg)", "Suma de cianuro consumido.", "sum", "kg", { field: "nacn_qty_kg" }),
            m("naoh_total", "Soda (kg)", "Suma de soda cáustica consumida.", "sum", "kg", { field: "naoh_qty_kg" }),
            m("balls_total", "Bolas (kg)", "Suma de bolas consumidas.", "sum", "kg", { field: "balls_total_kg" }),
            m("m1_balls_total", "Bolas molino 1 (kg)", "Suma de bolas del molino 1.", "sum", "kg", { field: "m1_balls_kg" }),
            m("m2_balls_total", "Bolas molino 2 (kg)", "Suma de bolas del molino 2.", "sum", "kg", { field: "m2_balls_kg" }),
            m("m3_balls_total", "Bolas molino 3 (kg)", "Suma de bolas del molino 3.", "sum", "kg", { field: "m3_balls_kg" }),
            m("nacn_ratio", "NaCN kg/TMS", "Σ kg de cianuro / Σ TMS.", "ratio", "kg_per_tms", { numerator: "nacn_qty_kg", denominator: "tms" }),
            m("naoh_ratio", "Soda kg/TMS", "Σ kg de soda / Σ TMS.", "ratio", "kg_per_tms", { numerator: "naoh_qty_kg", denominator: "tms" }),
            m("balls_ratio", "Bolas kg/TMS", "Σ kg de bolas / Σ TMS.", "ratio", "kg_per_tms", { numerator: "balls_total_kg", denominator: "tms" }),
            m("shift_cost_total", "Costo USD", "Suma del costo prorrateado por guardia.", "sum", "usd", { field: "shift_cost_usd" }),
            m("cost_per_tms", "USD/TMS", "Σ costo prorrateado / Σ TMS.", "ratio", "usd", { numerator: "shift_cost_usd", denominator: "tms" }),
        ],
        rules: [
            "shift_date es la fecha oficial de todas las consultas de guardia; el turno nocturno pertenece a la fecha en que inicia. Un día tiene dos guardias (A y B).",
            "Toda ley en g/t (cabeza, overflow, relave), toda concentración en g/m³, la densidad y las concentraciones de NaCN se consolidan ponderadas por TMS con sus métricas; la humedad se pondera por TMH; malla −200 y pH usan promedio simple. Nunca promedio simple de leyes.",
            "Recuperaciones, TMS/h, disponibilidad y ratios kg/TMS se recalculan desde sumas base (Σ producido / Σ alimentado, Σ TMS / Σ horas, Σ kg / Σ TMS); prod_ratio, au_recu, ag_recu y *_ratio son valores de la guardia y no se promedian ni se suman.",
            "Los gramos (*_g, au_prod, ag_prod) y los tonelajes, horas y kg de insumos son aditivos. El balance por período: Σ Au alimentado − Σ Au relave total = Σ Au producido.",
            "h2o_frac, mesh200_frac, au_recu y ag_recu son fracciones 0-1; los formatos las presentan como porcentaje.",
            "Comparar turnos (plant_shift) o fechas es agrupar por esa dimensión o por shift_date; supervisor y turno son clasificadores, sin causalidad.",
            "No hay exclusiones de guardias anuladas, incompletas o de prueba.",
            "shift_cost_usd es un prorrateo del costo mensual contable de planta: usarlo solo para meses completos; el detalle por cuenta y CECO está en plant_costs.",
        ],
        defaultDateField: "shift_date",
        relations: [
            { field: "shift_id", source: "plant_consumables", targetField: "shift_id", description: "Guardia → insumos con precio." },
        ],
        keywords: ["planta", "guardia", "guardias", "turno", "balance", "metalúrgico", "metalurgico", "recuperación", "recuperacion", "ley", "leyes", "cabeza", "relave", "overflow", "producción", "produccion", "oro", "plata", "au", "ag", "cianuro", "nacn", "soda", "bolas", "molino", "parada", "operación", "operacion", "tms", "tmh", "tonelaje", "humedad", "supervisor", "disponibilidad", "densidad", "ph", "malla"],
        enabled: true,
        access: { scopes: ["planta"] },
    },
    {
        id: "plant_consumables",
        name: "Insumos de planta por guardia",
        area: "planta",
        description: "Consumo de reactivos (NaCN, soda cáustica, etc.) y bolas de molienda por guardia, con unidad, precio unitario vigente de logística y costo USD por guardia e insumo.",
        endpoint: "/api/vai/plant/consumables",
        sqlView: "dw.v_plant_consumables + dw.v_plant_balls + dim.reagent + dw.v_dti_vai_planta_guardias",
        grain: "Una fila por guardia e insumo (y molino cuando son bolas).",
        query: q(["shift_date"], ["consumable_type", "reagent_name", "reagent_type", "mill", "plant_shift", "plant_supervisor"]),
        fields: [
            f("shift_id", "Guardia", "attribute", "Identificador YYYYMMDD-A/B."),
            f("shift_date", "Fecha", "date", "Fecha oficial de la guardia.", "date", "date", ["guardia", "insumo", "insumos", "reactivo", "reactivos", "bolas"]),
            f("plant_shift", "Turno", "dimension", "A o B."),
            f("plant_supervisor", "Supervisor", "dimension", "Supervisor de la guardia."),
            f("consumable_type", "Tipo de insumo", "dimension", "REACTIVO o BOLAS."),
            f("reagent_name", "Insumo", "dimension", "Nombre del reactivo o tamaño de bola."),
            f("reagent_type", "Familia", "dimension", "Tipo de insumo según el maestro de reactivos."),
            f("unit_name", "Unidad", "dimension", "Unidad de medida del insumo."),
            f("mill", "Molino", "dimension", "Molino (M1/M2/M3) para bolas; vacío para reactivos."),
            f("balls_size", "Tamaño de bola", "attribute", "Tamaño de bola en pulgadas.", "number", "decimal"),
            f("qty", "Cantidad", "measure", "Cantidad consumida en la unidad del insumo.", "number", "decimal"),
            f("unit_cost_usd", "Precio unitario USD", "attribute", "Último precio unitario logístico vigente al cierre del mes; se repite, no se suma.", "number", "usd"),
            f("cost_usd", "Costo USD", "measure", "Cantidad × precio unitario.", "number", "usd"),
            f("shift_tms", "TMS de la guardia", "attribute", "TMS tratadas en la guardia; se repite por insumo de la misma guardia.", "number", "tms"),
        ],
        metrics: [
            m("rows_count", "Registros", "Filas guardia-insumo.", "count", "integer"),
            m("shifts_count", "Guardias", "Guardias distintas con consumo.", "count_distinct", "integer", { field: "shift_id" }),
            m("qty_total", "Cantidad consumida", "Suma de cantidades; válida solo dentro de un mismo insumo.", "sum", "decimal", { field: "qty" }),
            m("cost_usd_total", "Costo USD", "Suma del costo de insumos.", "sum", "usd", { field: "cost_usd" }),
            m("reagents_cost_usd", "Costo reactivos USD", "Costo de reactivos (sin bolas).", "sum", "usd", { field: "cost_usd", where: [{ field: "consumable_type", op: "eq", value: "REACTIVO" }] }),
            m("balls_cost_usd", "Costo bolas USD", "Costo de bolas de molienda.", "sum", "usd", { field: "cost_usd", where: [{ field: "consumable_type", op: "eq", value: "BOLAS" }] }),
            m("qty_per_tms", "Consumo por TMS", "Σ cantidad (unidad del insumo) / TMS contada una vez por guardia; válido solo con un insumo filtrado.", "ratio", "decimal", { numerator: "qty", denominator: "shift_tms", distinctField: "shift_id" }),
            m("cost_per_tms", "USD de insumos por TMS", "Σ costo / TMS contada una vez por guardia.", "ratio", "usd", { numerator: "cost_usd", denominator: "shift_tms", distinctField: "shift_id" }),
            m("avg_unit_cost", "Precio unitario promedio", "Precio unitario ponderado por cantidad; válido dentro de un mismo insumo.", "weighted_avg", "usd", { field: "unit_cost_usd", weight: "qty" }),
            m("tms_covered", "TMS de las guardias", "TMS contadas una sola vez por guardia.", "sum_distinct", "tms", { field: "shift_tms", distinctField: "shift_id" }),
        ],
        rules: [
            "Cada insumo tiene su unidad: sumar cantidades o calcular consumo por TMS solo con reagent_name filtrado o agrupado; los costos USD sí se consolidan.",
            "shift_tms y unit_cost_usd se repiten por fila de la misma guardia: usar tms_covered, qty_per_tms y cost_per_tms, que cuentan la TMS una vez por shift_id.",
            "Sin precio logístico el costo queda vacío; no imputar precios.",
            "Para los ratios oficiales NaCN/TMS, soda/TMS y bolas/TMS del balance usar plant_shifts; esta fuente sirve para costos y detalle por insumo o molino.",
        ],
        defaultDateField: "shift_date",
        relations: [{ field: "shift_id", source: "plant_shifts", targetField: "shift_id", description: "Insumo → guardia." }],
        keywords: ["insumo", "insumos", "reactivo", "reactivos", "bolas", "molino", "cianuro", "nacn", "soda", "costo de insumos", "planta", "precio unitario", "consumo"],
        enabled: true,
        access: { scopes: ["planta"] },
    },
    {
        id: "plant_costs",
        name: "Costos contables de planta",
        area: "planta",
        description: "Líneas contables de costo de los centros de costo de planta: fecha, cuenta, clase de cuenta, CECO, proveedor (anexo), documento, glosa e importes en PEN y USD, con la TMS del mes para calcular USD/TMS.",
        endpoint: "/api/vai/plant/costs",
        sqlView: "dw.v_plant_costs + Σ tms mensual de dw.v_dti_vai_planta_guardias",
        grain: "Una fila por línea contable (subdiario + comprobante + secuencia).",
        query: q(["posting_date"], ["account_code", "account_class", "cost_center_code", "currency_code", "document_type", "annex_code"]),
        fields: [
            f("posting_date", "Fecha contable", "date", "Fecha de registro del asiento.", "date", "date", ["costo", "costos", "gasto", "contable", "asiento"]),
            f("period_month", "Mes contable", "date", "Primer día del mes contable.", "date", "date", ["mes contable"]),
            f("subledger_code", "Subdiario", "attribute", "Subdiario contable."),
            f("voucher_no", "Comprobante", "attribute", "Número de comprobante."),
            f("account_code", "Cuenta", "attribute", "Código de cuenta contable."),
            f("account_desc", "Descripción de cuenta", "dimension", "Nombre de la cuenta."),
            f("account_class", "Clase de cuenta", "dimension", "Clase o rubro de la cuenta (energía, insumos, servicios, etc.)."),
            f("account_full", "Cuenta completa", "dimension", "Código + descripción de la cuenta."),
            f("annex_code", "Código de anexo", "attribute", "RUC o código del proveedor/anexo."),
            f("annex_desc", "Proveedor / anexo", "dimension", "Nombre del proveedor o anexo."),
            f("cost_center_code", "CECO", "attribute", "Código del centro de costo."),
            f("cost_center_desc", "Centro de costo", "dimension", "Nombre del centro de costo."),
            f("cost_center_full", "CECO completo", "dimension", "Código + nombre del centro de costo."),
            f("debit_credit_flag", "Debe / haber", "dimension", "D o H."),
            f("currency_code", "Moneda original", "dimension", "Moneda del documento."),
            f("amount", "Importe original", "attribute", "Importe en la moneda original; no mezclar monedas.", "number", "decimal"),
            f("amount_local", "Importe PEN", "measure", "Importe en soles.", "number", "pen"),
            f("amount_usd", "Importe USD", "measure", "Importe en dólares.", "number", "usd"),
            f("document_type", "Tipo de documento", "dimension", "Tipo de comprobante."),
            f("document_no", "Documento", "attribute", "Número de documento."),
            f("desc_glosa", "Glosa", "attribute", "Descripción del asiento."),
            f("period_tms", "TMS del mes", "attribute", "TMS tratadas en el mes contable (Σ TMS de las guardias del mes); se repite por línea.", "number", "tms"),
        ],
        metrics: [
            m("lines_count", "Líneas", "Número de líneas contables.", "count", "integer"),
            m("vouchers_count", "Comprobantes", "Comprobantes distintos.", "count_distinct", "integer", { field: "voucher_no" }),
            m("amount_usd_total", "Costo USD", "Suma de importes en USD.", "sum", "usd", { field: "amount_usd" }),
            m("amount_pen_total", "Costo PEN", "Suma de importes en PEN.", "sum", "pen", { field: "amount_local" }),
            m("cost_per_tms", "USD/TMS", "Σ USD / TMS del mes contada una sola vez por mes.", "ratio", "usd", { numerator: "amount_usd", denominator: "period_tms", distinctField: "period_month" }),
            m("tms_covered", "TMS de los meses", "TMS contadas una sola vez por mes contable.", "sum_distinct", "tms", { field: "period_tms", distinctField: "period_month" }),
            m("suppliers_count", "Proveedores", "Anexos distintos.", "count_distinct", "integer", { field: "annex_code" }),
        ],
        rules: [
            "Universo: los centros de costo de planta definidos en dw.v_plant_costs (sin refinería ni desorción).",
            "Los importes ya vienen con signo contable: sumar amount_usd o amount_local directamente, como hace el dashboard de planta.",
            "period_tms se repite por línea: USD/TMS solo con cost_per_tms, que cuenta la TMS una vez por mes.",
            "PEN y USD en widgets separados; amount es la moneda original y no se consolida.",
        ],
        defaultDateField: "posting_date",
        keywords: ["costo", "costos", "gasto", "gastos", "cuenta", "ceco", "centro de costo", "energía", "energia", "servicios", "planta", "usd por tms", "contable", "proveedor"],
        enabled: true,
        access: { scopes: ["planta"] },
    },
    {
        id: "plant_tanks",
        name: "Leyes de carbón por tanque de lixiviación",
        area: "planta",
        description: "Ensayos diarios de la ley Au/Ag del carbón en cada tanque de lixiviación (CIL) TK1-TK11 de planta, en formato largo (una lectura por tanque, día y mineral) para series de tiempo por tanque, comparación entre tanques y selección de uno o varios tanques.",
        endpoint: "/api/vai/plant/tanks",
        sqlView: "dw.v_dti_vai_planta_tanques (stg.plant_carbon_tank_assays + dim.v_tank)",
        grain: "Una fila por tanque, fecha de ensayo y mineral (Au/Ag).",
        query: q(["tank_date"], ["tank", "mineral", "tank_name"]),
        fields: [
            f("tank_date", "Fecha de ensayo", "date", "Día del ensayo del carbón; eje temporal de las series por tanque.", "date", "date", ["carbón", "carbon", "tanque", "tanques", "ensayo", "lixiviación", "lixiviacion", "cil"]),
            f("tank", "Tanque", "dimension", "Identificador TK1-TK11; una línea por tanque en gráficos de líneas y filtro para elegir tanques."),
            f("tank_name", "Nombre de tanque", "dimension", "Nombre del tanque (Tanque 1 … Tanque 11)."),
            f("tank_order", "Orden en el circuito", "attribute", "Posición del tanque en el circuito de lixiviación.", "number", "integer"),
            f("mineral", "Mineral", "dimension", "Au o Ag; siempre en widgets separados."),
            f("grade_gt", "Ley del carbón (g/t)", "measure", "Ley del carbón del tanque en el ensayo, en g/t.", "number", "grade_gt"),
            f("grade_unit", "Unidad de la ley", "attribute", "Unidad de grade_gt (g/t)."),
        ],
        metrics: [
            m("readings_count", "Ensayos", "Número de lecturas.", "count", "integer"),
            m("avg_grade", "Ley promedio", "Promedio simple de las lecturas (no hay tonelaje de carbón por tanque en la fuente); usar con filtro o widget de un solo mineral.", "avg", "grade_gt", { field: "grade_gt" }),
            m("avg_grade_au", "Ley Au promedio", "Promedio simple de las lecturas de oro (mineral = Au).", "avg", "grade_gt", { field: "grade_gt", where: [{ field: "mineral", op: "eq", value: "Au" }] }),
            m("avg_grade_ag", "Ley Ag promedio", "Promedio simple de las lecturas de plata (mineral = Ag).", "avg", "grade_gt", { field: "grade_gt", where: [{ field: "mineral", op: "eq", value: "Ag" }] }),
            m("max_grade", "Ley máxima", "Lectura máxima; usar con un solo mineral.", "max", "grade_gt", { field: "grade_gt" }),
            m("min_grade", "Ley mínima", "Lectura mínima; usar con un solo mineral.", "min", "grade_gt", { field: "grade_gt" }),
            m("max_grade_au", "Ley Au máxima", "Lectura máxima de oro.", "max", "grade_gt", { field: "grade_gt", where: [{ field: "mineral", op: "eq", value: "Au" }] }),
            m("min_grade_au", "Ley Au mínima", "Lectura mínima de oro.", "min", "grade_gt", { field: "grade_gt", where: [{ field: "mineral", op: "eq", value: "Au" }] }),
            m("tanks_count", "Tanques", "Tanques distintos con lectura.", "count_distinct", "integer", { field: "tank" }),
            m("days_count", "Días con ensayo", "Fechas distintas con lectura.", "count_distinct", "integer", { field: "tank_date" }),
        ],
        rules: [
            "La ley es una lectura puntual de ensayo: promediar, tomar la última o comparar; nunca sumar.",
            "Separar Au y Ag (mineral) en widgets distintos: usar avg_grade_au / avg_grade_ag o un filtro select sobre mineral; no mezclar minerales en una serie.",
            "Evolución por tanque = line con dateField tank_date (bucket day) y breakdown tank (una línea por tanque); comparar tanques = bar/rank por tank; elegir tanques = filtro select sobre tank.",
            "El promedio entre tanques o fechas es simple porque la fuente no trae la masa de carbón de cada tanque; no existe ponderador.",
        ],
        defaultDateField: "tank_date",
        keywords: ["carbón", "carbon", "tanque", "tanques", "ley de carbón", "tk", "lixiviación", "lixiviacion", "cil", "adsorción", "adsorcion", "ensayo", "ensayos"],
        enabled: true,
        access: { scopes: ["planta"] },
    },
    {
        id: "plant_cm_reconciliation",
        name: "Conciliación Planta vs Control de Mineral",
        area: "planta",
        description: "Comparación diaria del tonelaje y las leyes de cabeza tratadas en planta contra las pilas alimentadas según Control de Mineral, con oro alimentado y producido del día.",
        endpoint: "/api/vai/plant/cm-reconciliation",
        sqlView: "dw.v_plant_cm_piles",
        grain: "Una fila por día con pilas de Control de Mineral.",
        query: q(["cal_date"]),
        fields: [
            f("cal_date", "Fecha", "date", "Día de tratamiento.", "date", "date", ["conciliación", "conciliacion", "pilas", "control de mineral"]),
            f("tms_plant", "TMS planta", "measure", "TMS tratadas según balance de planta.", "number", "tms"),
            f("tms_cm", "TMS CM", "measure", "TMS de las pilas según Control de Mineral.", "number", "tms"),
            f("au_gtc_plant", "Ley Au planta (g/t)", "measure", "Ley de cabeza de planta ponderada por TMS del día.", "number", "grade_gt"),
            f("au_gtc_cm", "Ley Au CM (g/t)", "measure", "Ley de las pilas CM ponderada por TMS del día.", "number", "grade_gt"),
            f("ag_gtc_plant", "Ley Ag planta (g/t)", "measure", "Ley de plata de planta del día.", "number", "grade_gt"),
            f("ag_gtc_cm", "Ley Ag CM (g/t)", "measure", "Ley de plata de las pilas CM del día.", "number", "grade_gt"),
            f("au_feed_plant", "Au alimentado planta (g)", "measure", "Gramos de oro alimentados en planta.", "number", "g"),
            f("au_prod_plant", "Au producido planta (g)", "measure", "Gramos de oro producidos en planta.", "number", "g"),
        ],
        metrics: [
            m("days_count", "Días", "Días comparados.", "count", "integer"),
            m("tms_plant_total", "TMS planta", "Suma de TMS de planta.", "sum", "tms", { field: "tms_plant" }),
            m("tms_cm_total", "TMS CM", "Suma de TMS de Control de Mineral.", "sum", "tms", { field: "tms_cm" }),
            m("tms_diff_pct", "Diferencia TMS %", "(Σ TMS CM − Σ TMS planta) / Σ TMS planta × 100.", "pct_change", "percent", { numerator: "tms_cm", denominator: "tms_plant" }),
            m("avg_au_plant", "Ley Au planta", "Ley de planta ponderada por TMS planta.", "weighted_avg", "grade_gt", { field: "au_gtc_plant", weight: "tms_plant" }),
            m("avg_au_cm", "Ley Au CM", "Ley CM ponderada por TMS CM.", "weighted_avg", "grade_gt", { field: "au_gtc_cm", weight: "tms_cm" }),
            m("avg_ag_plant", "Ley Ag planta", "Ley de plata de planta ponderada por TMS planta.", "weighted_avg", "grade_gt", { field: "ag_gtc_plant", weight: "tms_plant" }),
            m("avg_ag_cm", "Ley Ag CM", "Ley de plata CM ponderada por TMS CM.", "weighted_avg", "grade_gt", { field: "ag_gtc_cm", weight: "tms_cm" }),
            m("au_recovery_plant", "Recuperación Au planta", "Au producido / Au alimentado.", "ratio", "fraction", { numerator: "au_prod_plant", denominator: "au_feed_plant" }),
            m("au_feed_total", "Au alimentado (g)", "Suma de gramos alimentados.", "sum", "g", { field: "au_feed_plant" }),
            m("au_prod_total", "Au producido (g)", "Suma de gramos producidos.", "sum", "g", { field: "au_prod_plant" }),
        ],
        rules: [
            "Solo meses cerrados (anteriores al mes actual).",
            "Las leyes se ponderan por su propia TMS (planta o CM); la diferencia de leyes se muestra comparando ambas métricas, no restando filas.",
            "La diferencia de tonelaje se calcula desde sumas con tms_diff_pct.",
        ],
        defaultDateField: "cal_date",
        keywords: ["conciliación", "conciliacion", "control de mineral", "cm", "pilas", "planta vs cm", "diferencia de tms", "diferencia de ley"],
        enabled: true,
        access: { scopes: ["planta"] },
    },
    {
        id: "refinery_campaigns",
        name: "Campañas de refinería",
        area: "refinery",
        description: "Campañas de refinación: mes y fecha de inicio, carbón rico húmedo y seco, humedad, leyes del carbón y producción de Au, Ag y Cu (kg y onzas troy), con la cobertura de consumos registrados por campaña.",
        endpoint: "/api/vai/refinery/campaigns",
        sqlView: "dw.v_dti_vai_refineria_campanas (dim.refinery_campaign + dw.v_refinery_consumption)",
        grain: "Una fila por campaña.",
        query: q(["campaign_month", "campaign_date"], ["campaign_id"]),
        fields: [
            f("campaign_id", "Campaña", "dimension", "Identificador de la campaña (YY-CMM-NN: año, mes y correlativo del mes)."),
            f("campaign_month", "Mes de campaña", "date", "Primer día del mes codificado en el identificador; período que usan los reportes de refinería.", "date", "date", ["mes de campaña", "periodo de campaña", "campaña", "campañas", "campana"]),
            f("campaign_date", "Inicio de campaña", "date", "Fecha referencial de inicio de la campaña.", "date", "date", ["inicio"]),
            f("campaign_seq", "Correlativo", "attribute", "Número de campaña dentro del mes.", "number", "integer"),
            f("campaign_wet_cr", "Carbón húmedo (kg)", "measure", "Carbón rico húmedo tratado.", "number", "kg"),
            f("campaign_moisture_pct", "Humedad %", "measure", "Humedad del carbón en porcentaje 0-100; se pondera por carbón húmedo.", "number", "percent"),
            f("campaign_cr", "Carbón seco (kg)", "measure", "Carbón rico seco = húmedo × (1 − humedad).", "number", "kg"),
            f("campaign_au_grade", "Ley Au del carbón", "measure", "Ley de oro del carbón rico ingresada en la web (sin unidad declarada en la fuente); se pondera por carbón seco.", "number", "decimal"),
            f("campaign_ag_grade", "Ley Ag del carbón", "measure", "Ley de plata del carbón rico ingresada en la web (sin unidad declarada en la fuente); se pondera por carbón seco.", "number", "decimal"),
            f("campaign_au", "Au producido (kg)", "measure", "Producción de oro de la campaña en kg.", "number", "kg"),
            f("campaign_ag", "Ag producido (kg)", "measure", "Producción de plata de la campaña en kg.", "number", "kg"),
            f("campaign_cu", "Cu producido (kg)", "measure", "Producción de cobre de la campaña en kg.", "number", "kg"),
            f("campaign_au_ozt", "Au producido (ozt)", "measure", "Producción de oro en onzas troy (kg × 32.1507).", "number", "oz"),
            f("campaign_ag_ozt", "Ag producido (ozt)", "measure", "Producción de plata en onzas troy (kg × 32.1507).", "number", "oz"),
            f("consumption_rows", "Registros de consumo", "attribute", "Filas de consumo (subproceso + insumo) registradas para la campaña.", "number", "integer"),
            f("consumption_reagents", "Insumos consumidos", "attribute", "Insumos distintos con consumo registrado en la campaña.", "number", "integer"),
            f("consumption_subprocesses", "Subprocesos con consumo", "attribute", "Subprocesos distintos con consumo registrado en la campaña.", "number", "integer"),
        ],
        metrics: [
            m("campaigns_count", "Campañas", "Número de campañas.", "count", "integer"),
            m("campaigns_without_consumption", "Campañas sin consumo registrado", "Campañas sin filas de consumo.", "count", "integer", { where: [{ field: "consumption_rows", op: "eq", value: 0 }] }),
            m("wet_cr_total", "Carbón húmedo (kg)", "Suma de carbón húmedo.", "sum", "kg", { field: "campaign_wet_cr" }),
            m("cr_total", "Carbón seco (kg)", "Suma de carbón seco.", "sum", "kg", { field: "campaign_cr" }),
            m("au_total", "Au producido (kg)", "Suma de kg de oro.", "sum", "kg", { field: "campaign_au" }),
            m("ag_total", "Ag producido (kg)", "Suma de kg de plata.", "sum", "kg", { field: "campaign_ag" }),
            m("cu_total", "Cu producido (kg)", "Suma de kg de cobre.", "sum", "kg", { field: "campaign_cu" }),
            m("au_total_ozt", "Au producido (ozt)", "Suma de onzas troy de oro.", "sum", "oz", { field: "campaign_au_ozt" }),
            m("ag_total_ozt", "Ag producido (ozt)", "Suma de onzas troy de plata.", "sum", "oz", { field: "campaign_ag_ozt" }),
            m("avg_au_grade", "Ley Au del carbón", "Ley de oro ponderada por carbón seco.", "weighted_avg", "decimal", { field: "campaign_au_grade", weight: "campaign_cr" }),
            m("avg_ag_grade", "Ley Ag del carbón", "Ley de plata ponderada por carbón seco.", "weighted_avg", "decimal", { field: "campaign_ag_grade", weight: "campaign_cr" }),
            m("avg_moisture", "Humedad promedio", "Humedad ponderada por carbón húmedo.", "weighted_avg", "percent", { field: "campaign_moisture_pct", weight: "campaign_wet_cr" }),
            m("dry_yield", "Rendimiento seco", "Σ carbón seco / Σ carbón húmedo.", "ratio", "fraction", { numerator: "campaign_cr", denominator: "campaign_wet_cr" }),
            m("au_per_cr", "kg Au por kg de carbón seco", "Σ Au / Σ carbón seco.", "ratio", "decimal", { numerator: "campaign_au", denominator: "campaign_cr" }),
            m("avg_wet_cr", "Carbón húmedo promedio por campaña", "Σ carbón húmedo dividido entre campañas.", "sum_per_distinct", "kg", { field: "campaign_wet_cr", distinctField: "campaign_id" }),
            m("avg_dry_cr", "Carbón seco promedio por campaña", "Σ carbón seco dividido entre campañas.", "sum_per_distinct", "kg", { field: "campaign_cr", distinctField: "campaign_id" }),
            m("avg_au_per_campaign", "Au promedio por campaña (kg)", "Σ Au dividido entre campañas.", "sum_per_distinct", "kg", { field: "campaign_au", distinctField: "campaign_id" }),
            m("avg_ag_per_campaign", "Ag promedio por campaña (kg)", "Σ Ag dividido entre campañas.", "sum_per_distinct", "kg", { field: "campaign_ag", distinctField: "campaign_id" }),
        ],
        rules: [
            "campaign_month es el período mensual de la campaña y el predeterminado para agrupar; campaign_date es solo el inicio referencial.",
            "Carbón (kg) y producción Au/Ag/Cu (kg u ozt) se suman; las leyes del carbón se ponderan por carbón seco y la humedad por carbón húmedo; los rendimientos y ratios salen de sumas.",
            "No mezclar kg de carbón con kg de metal en una misma serie; usar au_per_cr para relacionarlos.",
            "Esta fuente no tiene costos; el consumo físico por insumo, proceso y subproceso está en refinery_consumption.",
        ],
        defaultDateField: "campaign_month",
        relations: [{ field: "campaign_id", source: "refinery_consumption", targetField: "campaign_id", description: "Campaña → consumos por insumo." }],
        keywords: ["campaña", "campañas", "campana", "refinería", "refineria", "carbón", "carbon", "oro", "plata", "cobre", "ley", "humedad", "producción", "produccion", "onzas", "ozt", "kg", "rendimiento"],
        enabled: true,
        access: { scopes: ["refinery"] },
    },
    {
        id: "refinery_consumption",
        name: "Consumo de insumos de refinería",
        area: "refinery",
        description: "Consumo físico de insumos y reactivos de refinería por campaña, proceso, subproceso e insumo: cantidad consumida en la unidad de cada insumo, con el carbón seco y la producción de Au/Ag de la campaña para ratios por kg de carbón o por kg/ozt de oro.",
        endpoint: "/api/vai/refinery/consumption",
        sqlView: "dw.v_dti_vai_refineria_consumos (dw.v_refinery_consumption + dim.subprocess + dim.reagent + dim.refinery_campaign)",
        grain: "Una fila por campaña, subproceso e insumo.",
        query: q(["campaign_month", "campaign_date", "consumption_date"], ["campaign_id", "process_name", "subprocess_name", "reagent_name", "reagent_type", "unit_name"]),
        fields: [
            f("campaign_id", "Campaña", "dimension", "Identificador de la campaña (YY-CMM-NN)."),
            f("campaign_month", "Mes de campaña", "date", "Primer día del mes codificado en el identificador; período de los reportes de refinería.", "date", "date", ["mes de campaña", "mensual", "campaña", "campañas", "campana"]),
            f("campaign_date", "Inicio de campaña", "date", "Fecha referencial de inicio de la campaña.", "date", "date", ["inicio"]),
            f("campaign_seq", "Correlativo", "attribute", "Número de campaña dentro del mes.", "number", "integer"),
            f("consumption_date", "Fecha de consumo", "date", "Fecha registrada al grabar el consumo (la web guarda la fecha de la campaña).", "date", "date", ["consumo", "consumido", "consumos"]),
            f("process_name", "Proceso", "dimension", "Proceso de refinería que contiene al subproceso (nivel superior de la jerarquía)."),
            f("subprocess_name", "Subproceso", "dimension", "Subproceso de refinería donde se consume el insumo."),
            f("reagent_name", "Insumo", "dimension", "Nombre estándar del insumo o reactivo (maestro dim.reagent)."),
            f("reagent_type", "Familia de insumo", "dimension", "Tipo de insumo según el maestro de reactivos."),
            f("unit_name", "Unidad", "dimension", "Unidad de medida del insumo (kg, l, unidades, etc.); define qué cantidades pueden sumarse."),
            f("mat_code", "Código logístico", "attribute", "Código del material en el catálogo logístico."),
            f("consumption_qty", "Cantidad consumida", "measure", "Cantidad física consumida en la unidad del insumo.", "number", "decimal"),
            f("campaign_cr", "Carbón seco de la campaña (kg)", "attribute", "Se repite por fila de la misma campaña; no sumar.", "number", "kg"),
            f("campaign_au", "Au de la campaña (kg)", "attribute", "Producción de oro de la campaña en kg; se repite por fila, no sumar.", "number", "kg"),
            f("campaign_ag", "Ag de la campaña (kg)", "attribute", "Producción de plata de la campaña en kg; se repite por fila, no sumar.", "number", "kg"),
            f("campaign_au_ozt", "Au de la campaña (ozt)", "attribute", "Producción de oro en onzas troy; se repite por fila, no sumar.", "number", "oz"),
            f("campaign_ag_ozt", "Ag de la campaña (ozt)", "attribute", "Producción de plata en onzas troy; se repite por fila, no sumar.", "number", "oz"),
        ],
        metrics: [
            m("rows_count", "Registros", "Filas campaña-subproceso-insumo.", "count", "integer"),
            m("consumption_total", "Consumo", "Suma de cantidad consumida; válida solo dentro de un mismo insumo o de insumos con la misma unidad.", "sum", "decimal", { field: "consumption_qty" }),
            m("campaigns_count", "Campañas", "Campañas distintas con consumo.", "count_distinct", "integer", { field: "campaign_id" }),
            m("reagents_count", "Insumos", "Insumos distintos.", "count_distinct", "integer", { field: "reagent_name" }),
            m("subprocesses_count", "Subprocesos", "Subprocesos distintos.", "count_distinct", "integer", { field: "subprocess_name" }),
            m("processes_count", "Procesos", "Procesos distintos.", "count_distinct", "integer", { field: "process_name" }),
            m("avg_qty_per_campaign", "Consumo promedio por campaña", "Σ cantidad dividida entre campañas distintas; válido dentro de un mismo insumo.", "sum_per_distinct", "decimal", { field: "consumption_qty", distinctField: "campaign_id" }),
            m("qty_per_cr_kg", "Consumo por kg de carbón seco", "Σ cantidad / carbón seco contado una vez por campaña; válido dentro de un mismo insumo.", "ratio", "decimal", { numerator: "consumption_qty", denominator: "campaign_cr", distinctField: "campaign_id" }),
            m("qty_per_au_kg", "Consumo por kg de Au", "Σ cantidad / kg de Au contados una vez por campaña; válido dentro de un mismo insumo.", "ratio", "decimal", { numerator: "consumption_qty", denominator: "campaign_au", distinctField: "campaign_id" }),
            m("qty_per_au_ozt", "Consumo por ozt de Au", "Σ cantidad / onzas troy de Au contadas una vez por campaña; válido dentro de un mismo insumo.", "ratio", "decimal", { numerator: "consumption_qty", denominator: "campaign_au_ozt", distinctField: "campaign_id" }),
            m("qty_per_ag_ozt", "Consumo por ozt de Ag", "Σ cantidad / onzas troy de Ag contadas una vez por campaña; válido dentro de un mismo insumo.", "ratio", "decimal", { numerator: "consumption_qty", denominator: "campaign_ag_ozt", distinctField: "campaign_id" }),
            m("cr_covered", "Carbón seco de las campañas (kg)", "Carbón seco contado una sola vez por campaña.", "sum_distinct", "kg", { field: "campaign_cr", distinctField: "campaign_id" }),
            m("au_covered", "Au de las campañas (kg)", "Oro contado una sola vez por campaña.", "sum_distinct", "kg", { field: "campaign_au", distinctField: "campaign_id" }),
        ],
        rules: [
            "Consumo físico: cada insumo conserva su unidad (unit_name). Sumar consumption_qty solo con reagent_name filtrado o agrupado, o entre insumos que compartan la misma unidad; nunca un total físico que mezcle kg, litros, unidades u otras unidades incompatibles. No existe medida económica en esta fuente para consolidar insumos distintos.",
            "Jerarquía de análisis: process_name → subprocess_name → reagent_name, y campaign_id → process_name → subprocess_name → reagent_name; composición de una campaña = donut/bar por reagent_name o subprocess_name con un solo insumo o una sola unidad.",
            "campaign_month es el período para evolución y comparación entre campañas; consumption_date es la fecha del registro y puede diferir.",
            "campaign_cr, campaign_au, campaign_ag y *_ozt se repiten por fila: los ratios por kg de carbón o por kg/ozt de metal cuentan el valor una vez por campaña (métricas declaradas), nunca sumando el atributo.",
            "Sin costos ni consumo óptimo ML: el análisis económico consolidado de insumos requiere una medida en USD propia y no se construye desde cantidades físicas.",
        ],
        defaultDateField: "campaign_month",
        relations: [{ field: "campaign_id", source: "refinery_campaigns", targetField: "campaign_id", description: "Consumo → campaña." }],
        keywords: ["refinería", "refineria", "reactivo", "reactivos", "insumo", "insumos", "material", "materiales", "consumo", "consumos", "campaña", "campañas", "campana", "subproceso", "subprocesos", "proceso", "procesos", "unidad", "kg", "litros", "composición", "composicion", "evolución", "evolucion"],
        enabled: true,
        access: { scopes: ["refinery"] },
    },
    {
        id: "refinery_entries",
        name: "Ingresos de insumos de refinería",
        area: "refinery",
        description: "Entradas de insumos al almacén de refinería por fecha e insumo.",
        endpoint: "/api/vai/refinery/entries",
        sqlView: "dw.v_refinery_entries + dim.reagent",
        grain: "Una fila por ingreso (fecha + insumo).",
        query: q(["entry_date"], ["reagent_name", "reagent_type"]),
        fields: [
            f("entry_date", "Fecha de ingreso", "date", "Fecha de la entrada.", "date", "date", ["ingreso", "entrada", "reactivo"]),
            f("reagent_name", "Insumo", "dimension", "Nombre del insumo."),
            f("reagent_type", "Familia", "dimension", "Tipo de insumo según el maestro."),
            f("unit_name", "Unidad", "dimension", "Unidad del insumo."),
            f("entry_qty", "Cantidad ingresada", "measure", "Cantidad ingresada en la unidad del insumo.", "number", "decimal"),
        ],
        metrics: [
            m("entries_total", "Ingresos", "Suma de cantidad ingresada; válida dentro de un mismo insumo.", "sum", "decimal", { field: "entry_qty" }),
            m("entries_count", "Registros", "Número de ingresos.", "count", "integer"),
            m("reagents_count", "Insumos", "Insumos distintos.", "count_distinct", "integer", { field: "reagent_name" }),
        ],
        rules: ["Cada insumo tiene su propia unidad; solo sumar ingresos del mismo insumo."],
        defaultDateField: "entry_date",
        keywords: ["refinería", "reactivo", "insumo", "ingreso", "entrada", "almacén", "stock"],
        enabled: true,
        access: { scopes: ["refinery"] },
    },
    {
        id: "refinery_stock",
        name: "Stock de insumos de refinería",
        area: "refinery",
        description: "Stock total a la fecha por insumo: total ingresado, total consumido, stock disponible y su valor al último precio unitario.",
        endpoint: "/api/vai/refinery/stock",
        sqlView: "dw.v_refinery_stock + dim.reagent + stg.logistics_mat_catalogue",
        grain: "Una fila por insumo (estado actual, sin historia).",
        temporalMode: "snapshot",
        query: q([], ["reagent_name", "reagent_type"]),
        fields: [
            f("reagent_name", "Insumo", "dimension", "Nombre del insumo."),
            f("reagent_type", "Familia", "dimension", "Tipo de insumo según el maestro."),
            f("unit_name", "Unidad", "dimension", "Unidad del insumo."),
            f("entry_qty", "Ingresado", "measure", "Total ingresado.", "number", "decimal"),
            f("consumption_qty", "Consumido", "measure", "Total consumido.", "number", "decimal"),
            f("stock_available", "Stock disponible", "measure", "Ingresado − consumido (GLP no lleva stock).", "number", "decimal"),
            f("unit_cost_usd", "Precio unitario USD", "attribute", "Último precio unitario logístico.", "number", "usd"),
            f("unit_cost_date", "Fecha del precio", "attribute", "Fecha del último precio.", "date", "date"),
            f("stock_value_usd", "Valor de stock USD", "measure", "Stock disponible × precio unitario.", "number", "usd"),
        ],
        metrics: [
            m("stock_total", "Stock", "Suma de stock disponible; válida dentro de un mismo insumo.", "sum", "decimal", { field: "stock_available" }),
            m("consumed_total", "Consumido", "Suma de consumo; válida dentro de un mismo insumo.", "sum", "decimal", { field: "consumption_qty" }),
            m("entered_total", "Ingresado", "Suma de ingresos; válida dentro de un mismo insumo.", "sum", "decimal", { field: "entry_qty" }),
            m("stock_value_total", "Valor de stock USD", "Suma del valor de stock de todos los insumos.", "sum", "usd", { field: "stock_value_usd" }),
            m("reagents_count", "Insumos", "Insumos distintos.", "count", "integer"),
        ],
        rules: ["Es el stock total vigente a la fecha y no un cierre diario ni un último movimiento.", "Sin fechas: no sirve para tendencias.", "Cada insumo tiene su propia unidad; agrupar siempre por insumo salvo para el valor USD."],
        keywords: ["stock", "reactivo", "insumo", "disponible", "refinería", "valor de stock"],
        enabled: true,
        access: { scopes: ["refinery"] },
    },
    {
        id: "logistics_requirements",
        name: "Requerimientos y órdenes de compra",
        area: "logistics",
        description: "Seguimiento de requerimientos de materiales: cantidades solicitadas, aprobadas, ordenadas y entregadas, estado del requerimiento, de la OC y web, proveedor, área solicitante, responsable, familia, centro de costo, precio unitario e importe estimado de línea.",
        endpoint: "/api/vai/logistics/requirements",
        sqlView: "dw.logistics_req_status",
        grain: "Una fila por ítem de requerimiento (y su OC si existe).",
        query: q(["req_date", "po_date", "po_est_delivery_date", "delivery_date"], ["req_num", "req_status", "po_status", "web_status", "supplier_name", "requester_area", "requester_desc", "cost_center_code", "mat_family", "mat_group", "responsible", "priority_desc", "warehouse_name"]),
        fields: [
            f("req_num", "Requerimiento", "attribute", "Número de requerimiento."),
            f("req_date", "Fecha de requerimiento", "date", "Fecha de creación del requerimiento; fecha predeterminada para requerimientos.", "date", "date", ["requerimiento", "requerimientos", "solicitud"]),
            f("assign_date", "Fecha de asignación", "date", "Fecha de asignación del requerimiento.", "date", "date", ["asignación", "asignacion"]),
            f("po_date", "Fecha de OC", "date", "Fecha de la orden de compra; usar cuando se piden compras u órdenes de compra.", "date", "date", ["compra", "compras", "orden de compra", "órdenes de compra", "ordenes de compra", "oc"]),
            f("po_est_delivery_date", "Entrega estimada", "date", "Fecha estimada de entrega.", "date", "date", ["entrega estimada", "fecha estimada"]),
            f("delivery_date", "Fecha de entrega", "date", "Fecha de entrega real; usar cuando se piden entregas.", "date", "date", ["entrega", "entregas", "envío", "envio"]),
            f("mat_code", "Código material", "dimension", "Identidad del material para consolidar cantidades."),
            f("mat_desc", "Material", "dimension", "Descripción del material."),
            f("mat_unit", "Unidad", "dimension", "Unidad de medida."),
            f("mat_group", "Grupo", "dimension", "Grupo de material."),
            f("mat_family", "Familia", "dimension", "Familia de material según el mapping por SKU."),
            f("responsible", "Responsable", "dimension", "Responsable logístico de la familia."),
            f("req_status", "Estado requerimiento", "dimension", "Estado del requerimiento."),
            f("po_status", "Estado OC", "dimension", "Estado de la orden de compra."),
            f("web_status", "Estado web", "dimension", "Estado de seguimiento registrado en la web."),
            f("priority_desc", "Prioridad", "dimension", "Prioridad asignada."),
            f("supplier_name", "Proveedor", "dimension", "Proveedor de la OC."),
            f("requester_desc", "Solicitante", "dimension", "Persona solicitante."),
            f("requester_area", "Área solicitante", "dimension", "Área que solicita."),
            f("cost_center_code", "CECO", "attribute", "Código del centro de costo."),
            f("cost_center_desc", "Centro de costo", "dimension", "CECO del requerimiento."),
            f("office_desc", "Oficina", "dimension", "Oficina."),
            f("warehouse_name", "Almacén", "dimension", "Almacén de destino."),
            f("po_num", "Orden de compra", "attribute", "Número de OC; vacío si no tiene."),
            f("qty_requested", "Cantidad solicitada", "measure", "Cantidad solicitada.", "number", "decimal"),
            f("qty_approved", "Cantidad aprobada", "measure", "Cantidad aprobada.", "number", "decimal"),
            f("qty_ordered", "Cantidad ordenada", "measure", "Cantidad en OC.", "number", "decimal"),
            f("qty_delivered", "Cantidad entregada", "measure", "Cantidad entregada.", "number", "decimal"),
            f("partial_recep_qty", "Recepción parcial", "measure", "Cantidad recibida parcialmente.", "number", "decimal"),
            f("po_unit_price_us", "Precio unitario USD", "measure", "Precio unitario de la OC.", "number", "usd"),
            f("po_line_amount_usd", "Importe de línea USD", "measure", "Cantidad ordenada × precio unitario; estimación de línea.", "number", "usd"),
        ],
        metrics: [
            m("items_count", "Ítems", "Número de ítems de requerimiento.", "count", "integer"),
            m("requirements_count", "Requerimientos", "Requerimientos distintos.", "count_distinct", "integer", { field: "req_num" }),
            m("po_count", "Órdenes de compra", "OC distintas.", "count_distinct", "integer", { field: "po_num" }),
            m("items_without_po", "Ítems sin OC", "Ítems sin fecha de orden de compra.", "count", "integer", { where: [{ field: "po_date", op: "empty" }] }),
            m("items_with_po", "Ítems con OC", "Ítems con fecha de orden de compra.", "count", "integer", { where: [{ field: "po_date", op: "not_empty" }] }),
            m("items_without_delivery", "Ítems sin envío", "Ítems sin fecha de entrega.", "count", "integer", { where: [{ field: "delivery_date", op: "empty" }] }),
            m("items_po_without_delivery", "OC sin recepción", "Ítems con OC y sin fecha de entrega.", "count", "integer", { where: [{ field: "po_date", op: "not_empty" }, { field: "delivery_date", op: "empty" }] }),
            m("qty_requested_total", "Cantidad solicitada", "Suma de cantidades solicitadas (unidades mixtas).", "sum", "decimal", { field: "qty_requested" }),
            m("qty_ordered_total", "Cantidad ordenada", "Suma de cantidades ordenadas (unidades mixtas).", "sum", "decimal", { field: "qty_ordered" }),
            m("qty_delivered_total", "Cantidad entregada", "Suma de cantidades entregadas (unidades mixtas).", "sum", "decimal", { field: "qty_delivered" }),
            m("delivery_pct", "% entregado", "Entregado / solicitado.", "ratio", "fraction", { numerator: "qty_delivered", denominator: "qty_requested" }),
            m("po_amount_total", "Importe OC USD", "Suma del importe estimado de línea (cantidad ordenada × precio unitario).", "sum", "usd", { field: "po_line_amount_usd" }),
            m("po_amount_pending_delivery", "Importe pendiente de recepción USD", "Importe de línea de ítems con OC y sin entrega.", "sum", "usd", { field: "po_line_amount_usd", where: [{ field: "delivery_date", op: "empty" }] }),
            m("avg_unit_price", "Precio unitario promedio", "Precio unitario USD ponderado por cantidad ordenada.", "weighted_avg", "usd", { field: "po_unit_price_us", weight: "qty_ordered", where: [{ field: "po_unit_price_us", op: "gt", value: 0 }, { field: "qty_ordered", op: "gt", value: 0 }] }),
            m("avg_req_to_po_days", "Días requerimiento a OC", "Promedio de días calendario desde el requerimiento hasta la OC.", "avg_days_diff", "days", { field: "req_date", field2: "po_date" }),
            m("avg_po_to_est_delivery_days", "Días OC a entrega estimada", "Promedio de días calendario desde la OC hasta la entrega estimada.", "avg_days_diff", "days", { field: "po_date", field2: "po_est_delivery_date" }),
            m("avg_po_to_delivery_days", "Días OC a entrega real", "Promedio de días calendario desde la OC hasta la entrega real.", "avg_days_diff", "days", { field: "po_date", field2: "delivery_date" }),
            m("avg_req_to_delivery_days", "Días requerimiento a entrega", "Promedio de días calendario desde el requerimiento hasta la entrega real.", "avg_days_diff", "days", { field: "req_date", field2: "delivery_date" }),
            m("suppliers_count", "Proveedores", "Proveedores distintos.", "count_distinct", "integer", { field: "supplier_name" }),
        ],
        rules: [
            "La fuente contiene únicamente requerimientos activos.",
            "Sin po_date significa sin orden de compra; sin delivery_date significa sin envío.",
            "Las cantidades se consolidan cuando coincide el material: usar mat_code como identidad y mantener visible mat_unit para detectar inconsistencias de origen.",
            "El precio unitario USD se promedia ponderado por qty_ordered.",
            "po_line_amount_usd es cantidad ordenada × precio unitario (misma regla que Flota); no existe importe total oficial de OC en esta fuente.",
        ],
        defaultDateField: "req_date",
        keywords: ["requerimiento", "requerimientos", "orden de compra", "oc", "compras", "proveedor", "material", "materiales", "logística", "entrega", "pendiente", "almacén", "solicitante", "prioridad", "recepción", "recepcion"],
        enabled: true,
        access: { scopes: ["logistics"] },
    },
    {
        id: "logistics_consumption",
        name: "Consumo de materiales de almacén",
        area: "logistics",
        description: "Salidas de almacén por consumo (vales del ERP) de los últimos 24 meses: material, familia, categoría, centro de costo, solicitante, cantidad y costo en PEN y USD.",
        endpoint: "/api/vai/logistics/consumption",
        sqlView: "stg.logistics_mat_cons + stg.logistics_mat_mapping + dim.logistics_mra_mat",
        grain: "Una fila por línea de vale de salida (documento + material).",
        query: q(["doc_date"], ["mat_code", "mat_family", "mat_category", "responsible", "cost_center_desc", "requester_desc"]),
        fields: [
            f("doc_num", "Vale", "attribute", "Número del vale de salida."),
            f("doc_date", "Fecha de consumo", "date", "Fecha del vale.", "date", "date", ["consumo", "consumos", "salida", "salidas", "vale", "vales"]),
            f("mat_code", "Código material", "dimension", "Código del material."),
            f("mat_desc", "Material", "dimension", "Descripción del material."),
            f("mat_unit", "Unidad", "dimension", "Unidad de medida."),
            f("sku", "SKU", "attribute", "Familia SKU (primeros cinco caracteres del código)."),
            f("mat_family", "Familia", "dimension", "Familia de material según el mapping por SKU."),
            f("mat_category", "Categoría", "dimension", "Categoría MRA del material."),
            f("responsible", "Responsable", "dimension", "Responsable logístico de la familia."),
            f("cost_center_desc", "Centro de costo", "dimension", "Centro de costo que consume."),
            f("requester_desc", "Solicitante", "dimension", "Persona que solicita la salida."),
            f("glosa", "Glosa", "attribute", "Glosa del vale (lleva el código CAPEX cuando aplica)."),
            f("qty", "Cantidad", "measure", "Cantidad consumida en la unidad del material.", "number", "decimal"),
            f("cost_unit_mn", "Costo unitario PEN", "attribute", "Precio promedio del mes en PEN; no se suma.", "number", "pen"),
            f("total_mn", "Costo PEN", "measure", "Cantidad × costo unitario PEN.", "number", "pen"),
            f("cost_unit_us", "Costo unitario USD", "attribute", "Precio promedio del mes en USD; no se suma.", "number", "usd"),
            f("total_us", "Costo USD", "measure", "Cantidad × costo unitario USD.", "number", "usd"),
            f("exch_rate", "T.C.", "attribute", "Tipo de cambio del vale.", "number", "decimal"),
        ],
        metrics: [
            m("lines_count", "Líneas", "Número de líneas de vale.", "count", "integer"),
            m("docs_count", "Vales", "Vales distintos.", "count_distinct", "integer", { field: "doc_num" }),
            m("materials_count", "Materiales", "Materiales distintos.", "count_distinct", "integer", { field: "mat_code" }),
            m("qty_total", "Cantidad", "Suma de cantidades; válida dentro de un mismo material.", "sum", "decimal", { field: "qty" }),
            m("total_us_total", "Costo USD", "Suma del costo en USD.", "sum", "usd", { field: "total_us" }),
            m("total_mn_total", "Costo PEN", "Suma del costo en PEN.", "sum", "pen", { field: "total_mn" }),
            m("avg_unit_cost_us", "Costo unitario promedio USD", "Costo unitario ponderado por cantidad; válido dentro de un mismo material.", "weighted_avg", "usd", { field: "cost_unit_us", weight: "qty" }),
            m("cost_centers_count", "Centros de costo", "Centros de costo distintos.", "count_distinct", "integer", { field: "cost_center_desc" }),
        ],
        rules: [
            "Universo: salidas por consumo del almacén Chala (010) de los últimos 24 meses.",
            "Cantidades solo se suman dentro de un mismo material; los costos se consolidan por moneda y se presentan PEN y USD por separado.",
            "Los costos unitarios son promedios mensuales del ERP y no se suman.",
        ],
        defaultDateField: "doc_date",
        keywords: ["consumo de materiales", "consumo de almacén", "salida de almacén", "vale", "vales", "material", "materiales", "centro de costo", "familia", "categoría", "costo de materiales", "almacén"],
        enabled: true,
        access: { scopes: ["logistics"] },
    },
    {
        id: "logistics_stock",
        name: "Stock de materiales",
        area: "logistics",
        description: "Foto actual del stock por material: almacén Chala, CEVA, pendiente de OC, stock total, consumo promedio mensual, frecuencia, último consumo, cobertura en meses y valor del stock al último precio.",
        endpoint: "/api/vai/logistics/stock",
        sqlView: "RSFACCAR152.dbo.mat_stock_vis_bi + dim.logistics_mra_mat + stg.logistics_his_cons",
        grain: "Una fila por material (estado actual).",
        temporalMode: "snapshot",
        query: q([], ["mat_code", "mat_category", "mat_family", "responsible"]),
        fields: [
            f("mat_code", "Código material", "attribute", "Código del material."),
            f("mat_desc", "Material", "attribute", "Descripción del material."),
            f("mat_unit", "Unidad", "dimension", "Unidad de medida."),
            f("sku", "SKU", "attribute", "Familia SKU (primeros cinco caracteres)."),
            f("mat_category", "Categoría", "dimension", "Categoría MRA del material."),
            f("mat_family", "Familia", "dimension", "Familia según el mapping por SKU."),
            f("responsible", "Responsable", "dimension", "Responsable logístico de la familia."),
            f("frequency_act", "Meses con consumo", "measure", "Meses con consumo en los últimos 12.", "number", "integer"),
            f("avg_act", "Consumo promedio mensual", "measure", "Consumo promedio de los últimos 12 meses en la unidad del material.", "number", "decimal"),
            f("last_cons_date", "Último consumo", "attribute", "Fecha del último vale de consumo.", "date", "date"),
            f("last_cons_qty", "Cantidad último consumo", "attribute", "Cantidad del último consumo.", "number", "decimal"),
            f("po_num", "OC vigentes", "attribute", "Órdenes de compra pendientes del material."),
            f("rq_act", "Requerido (RQ)", "measure", "Cantidad aprobada en requerimientos sin OC.", "number", "decimal"),
            f("po_act", "Pendiente de OC", "measure", "Cantidad ordenada pendiente de recepción.", "number", "decimal"),
            f("stock_qty", "Stock Chala (010)", "measure", "Stock en el almacén Chala.", "number", "decimal"),
            f("ceva_act", "Stock CEVA (035)", "measure", "Stock en el almacén CEVA.", "number", "decimal"),
            f("stock_tot", "Stock total", "measure", "Chala + CEVA + pendiente de OC.", "number", "decimal"),
            f("coverage_months", "Cobertura (meses)", "attribute", "Stock Chala dividido entre consumo promedio mensual.", "number", "months"),
            f("unit_cost_usd", "Precio unitario USD", "attribute", "Último precio unitario conocido.", "number", "usd"),
            f("stock_value_usd", "Valor stock Chala USD", "measure", "Stock Chala × precio unitario.", "number", "usd"),
            f("stock_total_value_usd", "Valor stock total USD", "measure", "Stock total × precio unitario.", "number", "usd"),
        ],
        metrics: [
            m("materials_count", "Materiales", "Número de materiales.", "count", "integer"),
            m("stock_value_total", "Valor stock Chala USD", "Suma del valor del stock Chala.", "sum", "usd", { field: "stock_value_usd" }),
            m("stock_total_value_total", "Valor stock total USD", "Suma del valor del stock total.", "sum", "usd", { field: "stock_total_value_usd" }),
            m("materials_without_stock", "Materiales sin stock", "Materiales con stock Chala cero.", "count", "integer", { where: [{ field: "stock_qty", op: "lte", value: 0 }] }),
            m("materials_with_po", "Materiales con OC pendiente", "Materiales con cantidad pendiente de OC.", "count", "integer", { where: [{ field: "po_act", op: "gt", value: 0 }] }),
            m("materials_with_consumption", "Materiales con consumo", "Materiales con consumo en los últimos 12 meses.", "count", "integer", { where: [{ field: "frequency_act", op: "gt", value: 0 }] }),
            m("avg_coverage_months", "Cobertura promedio (meses)", "Promedio simple de cobertura de materiales con consumo.", "avg", "months", { field: "coverage_months" }),
        ],
        rules: [
            "Foto actual sin fecha de análisis: no sirve para tendencias.",
            "Las cantidades tienen unidades mixtas: comparar materiales solo por valor USD o por conteos; cantidades solo dentro de un mismo material.",
            "Cobertura = stock Chala ÷ consumo promedio mensual; vacía sin consumo. No existen semáforos ni mínimos/máximos en esta fuente.",
        ],
        keywords: ["stock", "inventario", "almacén", "almacen", "materiales", "material", "cobertura", "ceva", "pendiente de oc", "consumo promedio", "valor de stock"],
        enabled: true,
        access: { scopes: ["logistics"] },
    },
    {
        id: "fleet_requirements",
        name: "Requerimientos de flota",
        area: "fleet",
        description: "Requerimientos de mantenimiento y repuestos por vehículo (placa): tipo, taller, fechas de ingreso y salida, odómetro, presupuesto aprobado e importe de línea de OC.",
        endpoint: "/api/vai/fleet/requirements",
        sqlView: "dw.v_logistics_flota_req",
        grain: "Una fila por ítem de requerimiento de un vehículo.",
        query: q(["req_date", "entry_date", "exit_date", "po_date"], ["plate", "req_type", "repair_shop_name", "req_serv_status", "req_status", "po_status", "supplier_name", "mat_family"]),
        fields: [
            f("req_num", "Requerimiento", "attribute", "Número de requerimiento."),
            f("plate", "Placa", "dimension", "Placa del vehículo."),
            f("req_date", "Fecha de requerimiento", "date", "Fecha predeterminada para consultas de mantenimiento.", "date", "date", ["mantenimiento", "requerimiento", "solicitud"]),
            f("entry_date", "Ingreso a taller", "date", "Fecha de ingreso al taller.", "date", "date", ["ingreso", "taller"]),
            f("exit_date", "Salida de taller", "date", "Fecha de salida del taller.", "date", "date", ["salida", "taller"]),
            f("po_date", "Fecha de OC", "date", "Fecha de la orden de compra.", "date", "date", ["orden de compra", "oc", "compra"]),
            f("po_num", "Orden de compra", "attribute", "Número de OC."),
            f("req_type", "Tipo", "dimension", "Tipo de requerimiento (mantenimiento, repuesto, etc.)."),
            f("repair_shop_name", "Taller", "dimension", "Taller o proveedor de servicio."),
            f("req_serv_status", "Estado de servicio", "dimension", "Abierto (sin salida de taller) o Cerrado."),
            f("req_status", "Estado requerimiento", "dimension", "Estado del requerimiento."),
            f("po_status", "Estado OC", "dimension", "Estado de la OC."),
            f("mat_group", "Grupo", "dimension", "Grupo de material o servicio."),
            f("mat_family", "Familia", "dimension", "Familia de material según el mapping."),
            f("mat_desc", "Material / servicio", "dimension", "Descripción."),
            f("supplier_name", "Proveedor", "dimension", "Proveedor de la OC."),
            f("office_serv_desc", "Oficina de servicio", "dimension", "Oficina."),
            f("odometer_km", "Odómetro (km)", "measure", "Kilometraje al ingreso.", "number", "km"),
            f("po_unit_price_us", "Precio unitario USD", "measure", "Precio unitario de la OC.", "number", "usd"),
            f("po_amount_usd", "Importe de línea OC USD", "measure", "Cantidad ordenada × precio unitario de la línea.", "number", "usd"),
            f("app_budget_pen", "Presupuesto aprobado PEN", "measure", "Presupuesto aprobado en PEN.", "number", "pen"),
            f("qty_requested", "Cantidad solicitada", "measure", "Cantidad solicitada.", "number", "decimal"),
            f("qty_ordered", "Cantidad ordenada", "measure", "Cantidad en OC.", "number", "decimal"),
        ],
        metrics: [
            m("items_count", "Ítems", "Número de ítems.", "count", "integer"),
            m("requirements_count", "Requerimientos", "Requerimientos distintos.", "count_distinct", "integer", { field: "req_num" }),
            m("vehicles_count", "Vehículos", "Placas distintas.", "count_distinct", "integer", { field: "plate" }),
            m("po_amount_usd_total", "Importe OC USD", "Suma de los importes de línea de OC.", "sum", "usd", { field: "po_amount_usd" }),
            m("budget_pen_total", "Presupuesto PEN", "Suma de presupuesto aprobado.", "sum", "pen", { field: "app_budget_pen" }),
            m("avg_odometer", "Odómetro promedio", "Promedio de kilometraje.", "avg", "km", { field: "odometer_km", where: [{ field: "odometer_km", op: "gt", value: 0 }] }),
            m("max_odometer", "Odómetro máximo", "Kilometraje máximo registrado.", "max", "km", { field: "odometer_km" }),
            m("avg_shop_days", "Días en taller", "Promedio de días calendario entre ingreso y salida.", "avg_days_diff", "days", { field: "entry_date", field2: "exit_date" }),
            m("open_services", "Servicios abiertos", "Ítems sin salida de taller.", "count", "integer", { where: [{ field: "req_serv_status", op: "eq", value: "Abierto" }] }),
            m("items_without_po", "Ítems sin OC", "Ítems sin fecha de orden de compra.", "count", "integer", { where: [{ field: "po_date", op: "empty" }] }),
        ],
        rules: [
            "req_date es la fecha predeterminada para mantenimiento; ingreso, salida y OC solo se usan cuando el usuario pide ese hito.",
            "La placa es la identidad principal del vehículo.",
            "po_amount_usd es el importe de cada línea (cantidad ordenada × precio unitario) y se suma por fila.",
            "La permanencia en taller se expresa en días calendario.",
            "El presupuesto está en PEN y la OC en USD: no mezclarlos en un mismo total.",
            "Universo: requerimientos desde 2026 cuyo centro de costo es una placa y cuyo material está en el mapa de materiales de flota.",
        ],
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
        endpoint: "/api/vai/fleet/soat-rtv",
        sqlView: "dw.v_logistics_flota_soat_rtv",
        grain: "Una fila por vehículo (placa).",
        temporalMode: "snapshot",
        fields: [
            f("plate", "Placa", "dimension", "Placa del vehículo."),
            f("soat_exp_date", "Vencimiento SOAT", "date", "Fecha de vencimiento del SOAT.", "date", "date", ["soat"]),
            f("soat_alert", "Alerta SOAT", "dimension", "Estado de alerta del SOAT."),
            f("rtv_exp_date", "Vencimiento RTV", "date", "Fecha de vencimiento de la revisión técnica.", "date", "date", ["revisión técnica", "rtv"]),
            f("rtv_alert", "Alerta RTV", "dimension", "Estado de alerta de la revisión técnica."),
        ],
        metrics: [
            m("vehicles_count", "Vehículos", "Número de vehículos.", "count", "integer"),
            m("soat_expired", "SOAT vencidos", "Vehículos con SOAT vencido.", "count", "integer", { where: [{ field: "soat_alert", op: "eq", value: "Vencido" }] }),
            m("rtv_expired", "RTV vencidas", "Vehículos con revisión técnica vencida.", "count", "integer", { where: [{ field: "rtv_alert", op: "eq", value: "Vencido" }] }),
        ],
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
        endpoint: "/api/vai/fleet/units",
        sqlView: "dw.v_logistics_flota_units",
        grain: "Una fila por vehicle_id.",
        temporalMode: "snapshot",
        query: q([], ["plate", "group_name", "brand", "model"]),
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
        endpoint: "/api/vai/fleet/fuel-units",
        sqlView: "dw.v_logistics_flota_fuel_units",
        grain: "Una fila por placa.",
        temporalMode: "snapshot",
        query: q([], ["plate", "brand", "model"]),
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
        description: "Detalle auditable de todos los vales de abastecimiento con placa normalizada, sede, costo PEN, ficha técnica y exceso por capacidad calculado por vale.",
        endpoint: "/api/vai/fleet/fuel",
        sqlView: "dw.v_dti_vai_flota_combustible",
        grain: "Una fila por vale individual.",
        defaultDateField: "date_cons",
        query: FLEET_FUEL_QUERY,
        fields: fleetFuelFields(),
        metrics: fleetFuelMetrics(),
        rules: [
            "qty y tank_capacity se interpretan en galones según la operación actual de flota.",
            "El exceso de tanque se calcula por vale individual; nunca como suma diaria menos capacidad.",
            "GAL*, MULTICAR y unidades sin ficha técnica útil no generan anomalía ni métricas de eficiencia.",
            "total_original conserva el importe original del vale. El costo valorizado disponible para V-Ai es únicamente PEN mediante cost_pen; no existe costo USD de combustible.",
            "group_name es la sede normalizada desde centro de costo, retirando DONACION y GAL.",
            "Capacidad, autonomía, referencia y factor son atributos repetidos por vale; no se suman.",
        ],
        keywords: ["combustible", "vale", "vales", "abastecimiento", "tanqueo", "galones", "grifo", "conductor", "placa", "costo", "flota", "gasolina", "diésel", "diesel"],
        enabled: true,
        access: { scopes: ["fleet_mgmt"] },
    },
    {
        id: "fleet_fuel_alerts",
        name: "Tanqueos sobre capacidad",
        area: "fleet",
        description: "Detalle auditable de los vales cuyo abastecimiento individual supera la capacidad técnica aplicable.",
        endpoint: "/api/vai/fleet/fuel-alerts",
        sqlView: "dw.v_dti_vai_flota_combustible",
        grain: "Una fila por vale individual con exceso sobre capacidad.",
        defaultDateField: "date_cons",
        query: FLEET_FUEL_QUERY,
        fields: fleetFuelFields(),
        metrics: fleetFuelMetrics(),
        rules: [
            "La fuente ya contiene únicamente vales con excess_gal mayor que cero.",
            "El exceso se calcula por vale individual, no por consumo diario agregado.",
            "El exceso valorizado disponible para V-Ai es únicamente PEN mediante excess_pen; no existe exceso USD de combustible.",
        ],
        keywords: ["combustible", "alerta", "anomalía", "anomalia", "exceso", "sobre capacidad", "tanqueo", "vale", "galones", "flota", "auditoría", "auditoria"],
        enabled: true,
        access: { scopes: ["fleet_mgmt"] },
    },
    {
        id: "fleet_gps_distance",
        name: "Recorridos GPS diarios",
        area: "fleet",
        description: "Recorrido GPS válido consolidado a placa-día, listo para analizar distancia sin duplicar una placa cuando intervienen varios equipos GPS.",
        endpoint: "/api/vai/fleet/dist",
        sqlView: "dw.v_dti_vai_flota_recorridos",
        grain: "Una fila por placa y día.",
        query: q(["cal_date"], ["plate", "group_name", "brand", "model", "driver_name"]),
        fields: fleetDistanceFields(),
        metrics: fleetDistanceMetrics(),
        defaultDateField: "cal_date",
        rules: [
            "odometer_km es recorrido diario calculado desde el primer y último odómetro GPS de cada equipo; no es odómetro acumulado.",
            "Primero se calcula equipo-día y luego se consolida placa-día; así un cambio o coexistencia de GPS no duplica combustible en el cruce.",
            "Se excluyen recorridos no positivos, superiores a 5000 km/día por equipo, la unidad 11547 y la sede genérica TRANSPORTE, siguiendo la lógica operativa previa.",
            "La fuente incluye recorridos aunque ese día no exista combustible.",
        ],
        keywords: ["flota", "gps", "recorrido", "recorridos", "distancia", "kilómetros", "kilometros", "placa", "conductor", "batería", "bateria", "dirección"],
        enabled: true,
        access: { scopes: ["fleet_mgmt"] },
    },
    fleetPerformanceSource(),
];
export const VAI_SOURCE_MAP: ReadonlyMap<string, VaiSource> = new Map(VAI_SOURCES.map((source) => [source.id, source]));
export function concarLabel(value: string) {
    return value.replace(/\bVETA\b(?!\s+DORADA)/gi, "CONCAR");
}
export function localDocumentField(sourceId: string, fieldId: string) {
    return sourceId === "finance_mineral_payments" && ["doc_type", "document_type", "payment_document_type"].includes(fieldId);
}
export function widgetLocalFilters(sourceId: string): VaiFilterSpec[] {
    const source = VAI_SOURCE_MAP.get(sourceId);
    if (!source || sourceId !== "finance_mineral_payments")
        return [];
    return ["doc_type", "payment_document_type"].flatMap((id) => {
        const field = vaiField(source, id);
        return field ? [{ kind: "select" as const, source: sourceId, field: id, label: field.label }] : [];
    });
}
export function monthBounds(periods: string[]): VaiDateRange | null {
    const keys = [...new Set(periods.filter((value) => /^\d{4}-(?:0[1-9]|1[0-2])$/.test(value)))].sort();
    if (!keys.length)
        return null;
    const first = keys[0];
    const last = keys[keys.length - 1];
    const [year, month] = last.split("-").map(Number);
    const end = new Date(`${last}-01T00:00:00.000Z`);
    end.setUTCFullYear(year, month, 0);
    return { from: `${first}-01`, to: end.toISOString().slice(0, 10) };
}
export function monthsInRange(from: string, to: string): string[] {
    const first = validIsoDate(from);
    const last = validIsoDate(to);
    if (!first || !last || first > last)
        return [];
    const result: string[] = [];
    let year = Number(first.slice(0, 4));
    let month = Number(first.slice(5, 7));
    const end = last.slice(0, 7);
    while (result.length < 1200) {
        const key = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
        if (key > end)
            break;
        result.push(key);
        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
    }
    return result;
}
export function lotDetailColumns(source: VaiSource, columns: string[]): string[] {
    if (!vaiField(source, "lot") || !vaiField(source, "entry_date"))
        return columns;
    if (!columns.includes("lot"))
        return source.id === "finance_mineral_purchases" ? ["lot", "entry_date", ...columns.filter((id) => id !== "entry_date")] : columns;
    const result = columns.filter((id) => id !== "entry_date");
    result.splice(result.indexOf("lot") + 1, 0, "entry_date");
    return result;
}
export function validateSourceRows(source: VaiSource, rows: VaiRow[]): VaiRow[] {
    if (!["finance_mineral_purchases", "traceability_lots"].includes(source.id))
        return rows;
    const seen = new Set<string>();
    for (const row of rows) {
        const lot = toText(row.lot);
        if (!lot || seen.has(lot))
            throw new Error("La fuente financiera debe devolver una sola fila por lote. No se sumaron ni ocultaron duplicados.");
        if (!("entry_date" in row) || !("lot_usd" in row) || (source.id === "finance_mineral_purchases" && !("pay_date" in row)))
            throw new Error("Contrato financiero desactualizado: actualiza las vistas y endpoints de V-Ai.");
        seen.add(lot);
    }
    return rows;
}
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
export type VaiDateRange = {
    from: string;
    to: string;
};
export function validIsoDate(value: unknown): string | null {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        return null;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}
export function requestedMonth(text: string): VaiDateRange | null {
    const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const hits = [...normalized.matchAll(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)\b/g)];
    const years = [...normalized.matchAll(/\b(20\d{2})\b/g)];
    if (hits.length !== 1 || years.length !== 1 || /\b(?:desde|hasta|entre)\b/.test(normalized))
        return null;
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
    if (preset === "last_7_days")
        return { from: addDays(today, -6), to: today };
    if (preset === "last_30_days")
        return { from: addDays(today, -29), to: today };
    if (preset === "year_to_date")
        return { from: `${today.slice(0, 4)}-01-01`, to: today };
    if (preset === "current_month")
        return { from: `${today.slice(0, 7)}-01`, to: today };
    if (preset === "previous_month") {
        const to = addDays(`${today.slice(0, 7)}-01`, -1);
        return { from: `${to.slice(0, 7)}-01`, to };
    }
    const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
    const from = addDays(today, -weekday - (preset === "previous_week" ? 7 : 0));
    return { from, to: preset === "previous_week" ? addDays(from, 6) : today };
}
export const COST_MONTH_OPTIONS = ["01_ENE", "02_FEB", "03_MAR", "04_ABR", "05_MAY", "06_JUN", "07_JUL", "08_AGO", "09_SEP", "10_OCT", "11_NOV", "12_DIC"];
export const COST_DETAIL_COLUMNS = ["period_label", "posting_date", "account_label", "supplier_label", "cost_center_label", "gloss", "subledger", "voucher_number", "document_type", "document_number", "line_gloss", "voucher_gloss"];
function costPeriodMetrics(): VaiMetric[] {
    const periods = ["REAL 2026", "PPTO 2026", "REAL 2025"];
    return [
        ...(["usd", "pen"] as const).flatMap((currency) => [
            m(`cost_total_${currency}`, `Importe ${currency.toUpperCase()} por período`, "Suma del importe original, siempre separada por period_label; no es un total combinado de escenarios o ejercicios.", "sum", currency, { field: `amount_${currency}` }),
            ...periods.filter((period) => currency === "usd" || !period.startsWith("PPTO")).map((period) => m(
                `cost_${period.toLowerCase().replace(" ", "_")}_${currency}`,
                `${period} ${currency.toUpperCase()}`,
                `Importe neto de ${period}, acumulado en los meses y clasificadores seleccionados. No incluye otros ejercicios ni escenarios.`,
                "sum", currency,
                { field: `amount_${currency}`, where: [{ field: "period_label", op: "eq", value: period }] },
            )),
        ]),
    ];
}
export function costSummaryText(rows: VaiRow[], currency: "usd" | "pen" = "usd") {
    const totals = new Map<string, { cents: number; values: number }>();
    for (const row of rows) {
        const label = toText(row.period_label) || "Sin período";
        const total = totals.get(label) ?? { cents: 0, values: 0 };
        const value = toNumber(row[`amount_${currency}`]);
        if (value !== null) {
            total.cents += Math.round(value * 100);
            total.values += 1;
        }
        totals.set(label, total);
    }
    return [...totals].sort(([a], [b]) => b.localeCompare(a, "es")).map(([label, total]) => `${label}: ${total.values ? formatValue(total.cents / 100, currency) : "Sin importe " + currency.toUpperCase()}`).join(" · ");
}
function requestedCostMonths(prompt: string, filters: VaiRawFilter[]): string[] | null {
    const text = normalizePromptText(prompt.replace(/([a-záéíóú])\s*[-–]\s*([a-záéíóú])/gi, "$1 a $2"));
    const names = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const matches = [...text.matchAll(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)\b/g)];
    const indexes = matches.map((match) => names.indexOf(match[1] === "setiembre" ? "septiembre" : match[1]));
    if (indexes.length) {
        if (indexes.length === 2) {
            const between = text.slice((matches[0].index ?? 0) + matches[0][0].length, matches[1].index);
            if (/\b(a|al|hasta)\b/.test(between) || /\bentre\b/.test(text)) {
                const end = indexes[1] < indexes[0] ? indexes[1] + 12 : indexes[1];
                return Array.from({ length: end - indexes[0] + 1 }, (_, index) => COST_MONTH_OPTIONS[(indexes[0] + index) % 12]);
            }
        }
        return [...new Set(indexes)].sort((a, b) => a - b).map((index) => COST_MONTH_OPTIONS[index]);
    }
    const supplied = filters.find((filter) => filter.source === "finance_costs" && filter.field === "month_label" && filter.values != null)?.values;
    if (supplied != null)
        return [...new Set(supplied)].filter((value) => COST_MONTH_OPTIONS.includes(value));
    if (/\b(ano completo|todo el ano|todos los meses|historico completo)\b/.test(text))
        return null;
    const preset = requestedPresetFromPrompt(prompt);
    const range = preset ? presetRange(preset) : filters.find((filter) => filter.source === "finance_costs" && filter.kind === "date_range" && filter.from && filter.to);
    if (range?.from && range.to && (preset || /\b(desde|hasta|entre|trimestre|semestre)\b/.test(text) || /20\d{2}-\d{2}/.test(prompt)))
        return [...new Set(monthsInRange(range.from, range.to).map((month) => COST_MONTH_OPTIONS[Number(month.slice(5, 7)) - 1]))].sort();
    return null;
}
export const VAI_SPEC_VERSION = 2;
export const VAI_LANGUAGES = ["es", "en", "fr"] as const;
export type VaiLanguage = (typeof VAI_LANGUAGES)[number];
export type VaiLocalePack = {
    sourceLabels: Record<string, string>;
    sourceDescriptions: Record<string, string>;
    sourceGrains: Record<string, string>;
    fieldLabels: Record<string, string>;
    fieldDescriptions: Record<string, string>;
    metricLabels: Record<string, string>;
    metricDescriptions: Record<string, string>;
};
export const VAI_PROMPT_MAX = 1200;
export const VAI_MAX_SOURCES = 3;
export const VAI_MAX_WIDGETS = 10;
export const VAI_MAX_FILTERS = 20;
export const VAI_MAX_LIMIT = 50;
export const VAI_MAX_TABLE_LIMIT = 50000;
export const VAI_WIDGET_TYPES = ["kpi", "line", "area", "bar", "combo", "rank", "donut", "scatter", "pareto", "heatmap", "histogram", "waterfall", "table", "matrix"] as const;
export const VAI_VISUAL_CATALOG = [
    { type: "kpi", label: "Indicador", use: "Una métrica; total, razón ponderada o conteo según catálogo." },
    { type: "bar", label: "Barras", use: "Comparación categórica/temporal, agrupada, apilada o 100 %." },
    { type: "combo", label: "Barras + líneas", use: "2–3 métricas, seriesTypes por métrica y hasta dos unidades/ejes Y; con breakdown cada métrica se repite por categoría conservando su tipo de serie y eje." },
    { type: "line", label: "Líneas", use: "Tendencia temporal o eje X categórico; múltiples series y acumulado válido." },
    { type: "area", label: "Área", use: "Tendencia con relleno, sin inventar pronósticos." },
    { type: "rank", label: "Ranking", use: "Top N horizontal; no añade Otros salvo petición expresa." },
    { type: "donut", label: "Anillo", use: "Composición de una métrica sumable y no negativa." },
    { type: "scatter", label: "Dispersión", use: "Dos métricas: primera en X, segunda en Y; punto por dimensión." },
    { type: "pareto", label: "Pareto", use: "Una métrica aditiva no negativa por dimensión: barras y % acumulado." },
    { type: "heatmap", label: "Mapa de calor", use: "Una métrica por dimension/dateField (filas) y breakdown (columnas)." },
    { type: "histogram", label: "Histograma", use: "Frecuencia por intervalos de un campo numérico directo, a nivel de registro; bins 3–40." },
    { type: "waterfall", label: "Cascada", use: "Una métrica aditiva de variaciones por categoría/fecha; parte de cero y añade el total neto. No concilia saldos inicial/final por sí sola." },
    { type: "table", label: "Tabla", use: "Detalle, resumen agrupado o tabla dinámica con breakdown." },
    { type: "matrix", label: "Matriz desplegable", use: "Una métrica sumable; columns define la jerarquía de filas, matrixColumns define hasta tres dimensiones categóricas de columnas y dateField/bucket puede agregar una dimensión temporal. En costos: cuenta completa → proveedor completo → glosa en filas y escenario/mes en columnas." },
] as const;
export type VaiWidgetType = (typeof VAI_WIDGET_TYPES)[number];
export type VaiSeriesRender = "line" | "bar";
const WIDGET_TYPE_ALIASES: Record<string, VaiWidgetType> = {
    column: "bar",
    columns: "bar",
    bars: "bar",
    stacked_bar: "bar",
    stacked: "bar",
    hbar: "rank",
    horizontal_bar: "rank",
    ranking: "rank",
    top: "rank",
    pie: "donut",
    ring: "donut",
    mixed: "combo",
    bar_line: "combo",
    combination: "combo",
    composed: "combo",
    column_line: "combo",
    barline: "combo",
    lines: "line",
    trend: "line",
    heat_map: "heatmap",
    mapa_calor: "heatmap",
    hist: "histogram",
    histograma: "histogram",
    cascada: "waterfall",
    waterfall_chart: "waterfall",
    xy: "scatter",
    pivot: "table",
    matriz: "matrix",
    matrix_table: "matrix",
    grid: "table",
    card: "kpi",
    metric: "kpi",
    number: "kpi",
};
export const VAI_BUCKETS = ["day", "week", "month", "quarter", "year"] as const;
export type VaiBucket = (typeof VAI_BUCKETS)[number];
export const VAI_STACK_MODES = ["none", "stack", "percent"] as const;
export type VaiStackMode = (typeof VAI_STACK_MODES)[number];
export const VAI_SORT_MODES = ["value_desc", "value_asc", "label_asc", "label_desc"] as const;
export type VaiSortMode = (typeof VAI_SORT_MODES)[number];
export const VAI_BREAKDOWN_CHART_LIMIT = 5;
export const VAI_BREAKDOWN_TABLE_LIMIT = 12;
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
export type VaiFilterSpec = {
    kind: "date_range";
    source: string;
    field: string;
    label: string;
    preset: VaiDatePreset | null;
    from?: string | null;
    to?: string | null;
    mode?: "range" | "period";
} | {
    kind: "select";
    source: string;
    field: string;
    label: string;
    values?: string[] | null;
};
export type VaiWidgetSpec = {
    type: VaiWidgetType;
    title: string;
    source: string;
    metrics: string[];
    seriesTypes: VaiSeriesRender[] | null;
    dimension: string | null;
    dateField: string | null;
    bucket: VaiBucket | null;
    limit: number | null;
    columns: string[] | null;
    matrixColumns?: string[] | null;
    summaries?: VaiSummarySpec[];
    breakdown?: string | null;
    stack?: VaiStackMode | null;
    sort?: VaiSortMode | null;
    sortMetric?: string | null;
    cumulative?: boolean | null;
    seriesAxes?: ("left" | "right" | null)[] | null;
    includeOthers?: boolean | null;
    bins?: number | null;
};
export const VAI_SUMMARY_OPERATIONS = ["auto", "sum", "avg", "min", "max", "none"] as const;
export type VaiSummaryOperation = (typeof VAI_SUMMARY_OPERATIONS)[number];
export type VaiSummarySpec = {
    column: string;
    operation: VaiSummaryOperation;
};
export type VaiDashboardSpec = {
    version: typeof VAI_SPEC_VERSION;
    language: VaiLanguage;
    locale: VaiLocalePack | null;
    title: string;
    description: string;
    sources: string[];
    filters: VaiFilterSpec[];
    widgets: VaiWidgetSpec[];
};
export type VaiRawFilter = {
    values?: string[] | null;
    kind: string;
    source: string;
    field: string;
    label: string;
    preset: string | null;
    from?: string | null;
    to?: string | null;
    mode?: "range" | "period";
};
export type VaiRawWidget = {
    type: string;
    title: string;
    source: string;
    metrics: string[];
    seriesTypes: string[] | null;
    dimension: string | null;
    dateField: string | null;
    bucket: string | null;
    limit: number | null;
    columns: string[] | null;
    matrixColumns?: string[] | null;
    summaries?: {
        column: string;
        operation: string;
    }[];
    breakdown?: string | null;
    stack?: string | null;
    sort?: string | null;
    sortMetric?: string | null;
    cumulative?: boolean | null;
    seriesAxes?: ("left" | "right" | null)[] | null;
    includeOthers?: boolean | null;
    bins?: number | null;
};
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
    notes: string[];
    issues?: string[];
};
const clean = (value: unknown, max: number) => String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
function basePromptText(value: string) {
    return String(value ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
const VAI_SEMANTIC_ALIASES: Array<[RegExp, string]> = [
    [/\b(?:fuel|fuels|carburant|carburants|essence|diesel)\b/, "combustible"],
    [/\b(?:refuel|refuels|refueling|ravitaillement|ravitaillements)\b/, "abastecimiento combustible"],
    [/\b(?:fleet|flotte)\b/, "flota"],
    [/\b(?:vehicle|vehicles|vehicule|vehicules)\b/, "vehiculo"],
    [/\b(?:driver|drivers|conducteur|conducteurs)\b/, "conductor"],
    [/\b(?:site|sites|location|locations|sede|sedes)\b/, "sede"],
    [/\b(?:cost|costs|expense|expenses|cout|couts|depense|depenses)\b/, "costos gastos"],
    [/\b(?:budget|budgets|budgeted|budgetaire|budgetaires)\b/, "presupuesto ppto"],
    [/\b(?:payment|payments|paid|paiement|paiements|paye|payes)\b/, "pago pagos"],
    [/\b(?:purchase|purchases|buying|achat|achats)\b/, "compra compras"],
    [/\b(?:supplier|suppliers|vendor|vendors|fournisseur|fournisseurs)\b/, "proveedor proveedores"],
    [/\b(?:invoice|invoices|facture|factures)\b/, "factura facturas"],
    [/\b(?:mineral|minerals|ore|minerai|minerais)\b/, "mineral"],
    [/\b(?:lot|lots)\b/, "lote lotes"],
    [/\b(?:traceability|tracabilite)\b/, "trazabilidad"],
    [/\b(?:plant|processing plant|usine)\b/, "planta"],
    [/\b(?:refinery|raffinerie)\b/, "refineria"],
    [/\b(?:reagent|reagents|reactif|reactifs)\b/, "reactivo reactivos"],
    [/\b(?:consumption|consommation)\b/, "consumo"],
    [/\b(?:production|production)\b/, "produccion"],
    [/\b(?:stock|inventory|inventaire)\b/, "stock inventario"],
    [/\b(?:logistics|logistique)\b/, "logistica"],
    [/\b(?:fixed asset|fixed assets|asset|assets|immobilisation|immobilisations)\b/, "activo activos fijo"],
    [/\b(?:depreciation|amortization|depreciation|amortissement)\b/, "depreciacion"],
    [/\b(?:gold)\b/, "oro au"],
    [/\b(?:silver)\b/, "plata ag"],
    [/\b(?:bar chart|bar charts|bars|barres|histogramme en barres)\b/, "grafico barras"],
    [/\b(?:line chart|line charts|lines|courbe|courbes|graphique en ligne|graphique lineaire)\b/, "grafico lineas"],
    [/\b(?:pie chart|pie charts|pie|camembert|diagramme circulaire)\b/, "grafico torta anillo"],
    [/\b(?:donut chart|donut charts|donut|doughnut|anneau)\b/, "grafico anillo"],
    [/\b(?:scatter plot|scatter chart|scatter|nuage de points)\b/, "grafico dispersion"],
    [/\b(?:heatmap|heat map|carte de chaleur)\b/, "mapa de calor"],
    [/\b(?:waterfall|waterfall chart|cascade)\b/, "grafico cascada"],
    [/\b(?:histogram|histograms|histogramme|histogrammes)\b/, "histograma"],
    [/\b(?:ranking|rankings|top|classement)\b/, "ranking top"],
    [/\b(?:matrix|matrice|pivot table|tableau croise dynamique)\b/, "matriz tabla dinamica"],
    [/\b(?:table|tables|tableau|tableaux)\b/, "tabla"],
    [/\b(?:x axis|x-axis|axe x|horizontal axis|axe horizontal)\b/, "eje x"],
    [/\b(?:y axis|y-axis|axe y|vertical axis|axe vertical)\b/, "eje y"],
    [/\b(?:trend|trends|tendance|tendances)\b/, "tendencia"],
    [/\b(?:last 7 days|past 7 days|derniers 7 jours)\b/, "ultimos 7 dias"],
    [/\b(?:last 30 days|past 30 days|derniers 30 jours)\b/, "ultimos 30 dias"],
    [/\b(?:this week|current week|cette semaine|semaine actuelle)\b/, "esta semana"],
    [/\b(?:last week|previous week|semaine derniere|semaine precedente)\b/, "semana pasada"],
    [/\b(?:this month|current month|ce mois|mois actuel)\b/, "este mes"],
    [/\b(?:last month|previous month|mois dernier|mois precedent)\b/, "mes pasado"],
    [/\b(?:this year|current year|year to date|annee en cours|cette annee)\b/, "este ano ytd"],
    [/\b(?:compare|comparison|comparisons|versus|vs|comparer|comparaison|comparaisons)\b/, "comparar comparacion versus"],
];
export function normalizeVaiPrompt(value: string) {
    const base = basePromptText(value);
    const aliases = VAI_SEMANTIC_ALIASES
        .filter(([pattern]) => pattern.test(base))
        .map(([, replacement]) => replacement);
    return [base, ...aliases].join(" ").replace(/\s+/g, " ").trim();
}
export function detectVaiLanguage(value: string): VaiLanguage {
    const text = basePromptText(value);
    const words = new Set(text.split(" ").filter(Boolean));
    const score = (items: string[]) => items.reduce((total, item) => total + (item.includes(" ") ? (text.includes(item) ? 2 : 0) : (words.has(item) ? 1 : 0)), 0);
    const es = score(["quiero", "muestra", "mostrar", "grafico", "costos", "combustible", "consumo", "pago", "lote", "proveedor", "por", "con", "del", "para"]);
    const en = score(["show", "display", "chart", "dashboard", "costs", "fuel", "consumption", "payment", "supplier", "lot", "by", "with", "from", "for", "the"]);
    const fr = score(["montre", "affiche", "graphique", "tableau", "couts", "carburant", "consommation", "paiement", "fournisseur", "lot", "par", "avec", "pour", "les", "des"]);
    if (fr > en && fr > es)
        return "fr";
    if (en > fr && en > es)
        return "en";
    return "es";
}
function normalizePromptText(value: string) {
    return normalizeVaiPrompt(value);
}
function requestedPresetFromPrompt(userPrompt: string): VaiDatePreset | null {
    const prompt = normalizePromptText(userPrompt);
    if (/\b(ultimos? 7 dias|ultima semana)\b/.test(prompt))
        return "last_7_days";
    if (/\bultimos? 30 dias\b/.test(prompt))
        return "last_30_days";
    if (/\b(esta semana|semana actual)\b/.test(prompt))
        return "current_week";
    if (/\b(semana pasada|semana anterior)\b/.test(prompt))
        return "previous_week";
    if (/\b(este mes|mes actual)\b/.test(prompt))
        return "current_month";
    if (/\b(mes pasado|mes anterior)\b/.test(prompt))
        return "previous_month";
    if (/\b(este ano|ano actual|ytd)\b/.test(prompt))
        return "year_to_date";
    return null;
}
function requestsAllHistory(userPrompt: string) {
    const prompt = normalizePromptText(userPrompt);
    return /\b(todo el historico|todo historico|historico completo|sin limite de fecha|sin filtro de fecha)\b/.test(prompt);
}
function dateFieldForPrompt(source: VaiSource, userPrompt: string) {
    const prompt = normalizePromptText(userPrompt);
    if (source.id === "finance_mineral_payments" && !/\b(fecha de provision|provision_date|fecha de documento|document_date)\b/.test(prompt)) {
        return { field: vaiField(source, "payment_date"), explicit: /\b(pago|pagos|pagado|pagados|payment_date)\b/.test(prompt) };
    }
    let selected = source.defaultDateField ? vaiField(source, source.defaultDateField) : null;
    let bestLength = 0;
    for (const field of source.fields) {
        if (field.role !== "date")
            continue;
        for (const keyword of field.dateFilterKeywords ?? []) {
            const term = normalizePromptText(keyword);
            if (term && term.length > bestLength && prompt.includes(term)) {
                selected = field;
                bestLength = term.length;
            }
        }
    }
    if (source.id === "fixassets_catalogue" &&
        selected?.id === "acquisition_date" &&
        requestedMonth(userPrompt) &&
        /\bactivos? de\b/.test(prompt)) {
        bestLength = Math.max(bestLength, 1);
    }
    return { field: selected, explicit: bestLength > 0 };
}
function snapshotDateWasExplicitlyRequested(source: VaiSource, field: ReturnType<typeof vaiField>, userPrompt: string) {
    if (source.temporalMode !== "snapshot" || !userPrompt.trim() || !field) {
        return true;
    }
    const prompt = normalizePromptText(userPrompt);
    if (source.id === "fixassets_catalogue" &&
        field.id === "acquisition_date" &&
        requestedMonth(userPrompt) &&
        /\bactivos? de\b/.test(prompt)) {
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
export function coerceModelOutput(raw: unknown): VaiModelOutput | null {
    if (!isRecord(raw))
        return null;
    const status = raw.status === "ok" || raw.status === "partial" || raw.status === "unavailable" ? raw.status : "ok";
    const dashboardRaw = isRecord(raw.dashboard) ? raw.dashboard : null;
    const dashboard = dashboardRaw
        ? {
            title: clean(dashboardRaw.title, 120),
            description: clean(dashboardRaw.description, 1200),
            filters: Array.isArray(dashboardRaw.filters)
                ? dashboardRaw.filters.filter(isRecord).map((item) => ({
                    kind: clean(item.kind, 20),
                    source: clean(item.source, 60),
                    field: clean(item.field, 60),
                    label: clean(item.label, 60),
                    values: Array.isArray(item.values) ? [...new Set(item.values.map((value) => clean(value, 255)))].slice(0, 200) : null,
                    preset: item.preset == null ? null : clean(item.preset, 30),
                    from: item.from == null ? null : clean(item.from, 30),
                    to: item.to == null ? null : clean(item.to, 30),
                    mode: item.mode === "period" ? "period" as const : "range" as const,
                }))
                : [],
            widgets: Array.isArray(dashboardRaw.widgets)
                ? dashboardRaw.widgets.filter(isRecord).map((item) => ({
                    type: clean(item.type, 20),
                    title: clean(item.title, 120),
                    source: clean(item.source, 60),
                    metrics: stringList(item.metrics, 6),
                    seriesTypes: Array.isArray(item.seriesTypes) ? item.seriesTypes.slice(0, 6).map((v) => clean(v, 20)) : null,
                    seriesAxes: Array.isArray(item.seriesAxes) ? item.seriesAxes.slice(0, 6).map((v) => v === "left" || v === "right" ? v : null) : null,
                    includeOthers: typeof item.includeOthers === "boolean" ? item.includeOthers : null,
                    bins: item.bins == null ? null : Number(item.bins),
                    dimension: item.dimension == null ? null : clean(item.dimension, 60),
                    dateField: item.dateField == null ? null : clean(item.dateField, 60),
                    bucket: item.bucket == null ? null : clean(item.bucket, 10),
                    limit: item.limit == null ? null : Number(item.limit),
                    columns: item.columns == null ? null : stringList(item.columns, 12),
                    matrixColumns: item.matrixColumns == null ? null : stringList(item.matrixColumns, 3),
                    summaries: Array.isArray(item.summaries) ? item.summaries.filter(isRecord).slice(0, 12).map((summary) => ({ column: clean(summary.column, 80), operation: clean(summary.operation, 20) })) : [],
                    breakdown: item.breakdown == null ? null : clean(item.breakdown, 60),
                    stack: item.stack == null ? null : clean(item.stack, 20),
                    sort: item.sort == null ? null : clean(item.sort, 20),
                    sortMetric: item.sortMetric == null ? null : clean(item.sortMetric, 60),
                    cumulative: typeof item.cumulative === "boolean" ? item.cumulative : item.cumulative == null ? null : clean(item.cumulative, 10).toLowerCase() === "true",
                }))
                : [],
        }
        : null;
    return {
        status,
        message: concarLabel(clean(raw.message, 600)),
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
function normalizeWidgetType(value: string): VaiWidgetType | null {
    const key = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (VAI_WIDGET_TYPES.includes(key as VaiWidgetType))
        return key as VaiWidgetType;
    return WIDGET_TYPE_ALIASES[key] ?? null;
}
const LINE_TYPES: ReadonlySet<VaiWidgetType> = new Set(["line", "area"]);
const SERIES_TYPES: ReadonlySet<VaiWidgetType> = new Set(["line", "area", "bar", "combo"]);
const BREAKDOWN_TYPES: ReadonlySet<VaiWidgetType> = new Set(["line", "area", "bar", "heatmap", "table"]);
const STACKABLE_AGGS: ReadonlySet<VaiAgg> = new Set(["sum", "count"]);
function normalizeStack(value: string | null | undefined): VaiStackMode | null {
    const key = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (!key || key === "none" || key === "false" || key === "grouped")
        return null;
    if (key === "stack" || key === "stacked" || key === "true")
        return "stack";
    if (key === "percent" || key === "100" || key === "100%" || key === "normalized" || key === "share")
        return "percent";
    return null;
}
function normalizeSort(value: string | null | undefined): VaiSortMode | null {
    const key = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (VAI_SORT_MODES.includes(key as VaiSortMode))
        return key as VaiSortMode;
    if (key === "desc" || key === "value" || key === "descending")
        return "value_desc";
    if (key === "asc" || key === "ascending")
        return "value_asc";
    if (key === "label" || key === "alpha" || key === "alphabetical" || key === "name")
        return "label_asc";
    return null;
}
function validateWidget(raw: VaiRawWidget, notes: string[]): VaiWidgetSpec | null {
    if (raw.source === "finance_mineral_purchases") {
        const dateField = raw.dateField === "payment_date" ? "pay_date" : ["invoice_reg_date", "invoice_doc_date"].includes(raw.dateField ?? "") ? "entry_date" : raw.dateField;
        raw = { ...raw, dateField, metrics: raw.metrics.filter((id) => id !== "rows_count"), columns: raw.columns?.map((id) => id === "payment_date" ? "pay_date" : id) ?? null };
    }
    if (raw.source === "finance_mineral_payments") {
        if (raw.dimension === "lot" || raw.breakdown === "lot" || raw.columns?.some((id) => id === "lot" || id === "entry_date")) {
            notes.push("conta_payments no tiene lot ni entry_date: se descartó una combinación de universos incompatible.");
            return null;
        }
        raw = { ...raw, dimension: raw.dimension === "document_type" ? "doc_type" : raw.dimension, breakdown: raw.breakdown === "document_type" ? "doc_type" : raw.breakdown, columns: raw.columns?.map((id) => id === "document_type" ? "doc_type" : id) ?? null };
    }
    const label = `Widget «${raw.title || raw.type || "sin título"}»`;
    const normalizedType = normalizeWidgetType(raw.type);
    if (!normalizedType) {
        notes.push(`${label}: el tipo «${raw.type}» no está soportado.`);
        return null;
    }
    let type: VaiWidgetType = normalizedType;
    const source = resolveSource(raw.source, notes, label);
    if (!source)
        return null;
    if (type === "matrix") {
        const metric = vaiMetric(source, raw.metrics[0] ?? "");
        const hierarchy = [...new Set(raw.columns ?? [])].filter((id) => {
            const field = vaiField(source, id);
            return field && ["dimension", "attribute", "date"].includes(field.role) && field.type !== "number";
        }).slice(0, 5);
        const matrixColumns = [...new Set(raw.matrixColumns ?? [])].filter((id) => {
            const field = vaiField(source, id);
            return field && ["dimension", "attribute"].includes(field.role) && field.type !== "number" && !hierarchy.includes(field.id);
        }).slice(0, 3);
        if (!metric || metric.agg !== "sum" || !metric.field || !hierarchy.length) {
            notes.push(`${label}: la matriz requiere una métrica de suma y una jerarquía válida en columns.`);
            return null;
        }
        const dateField = vaiField(source, raw.dateField ?? "")?.role === "date" ? raw.dateField : null;
        const breakdown = matrixColumns.length ? null : vaiField(source, raw.breakdown ?? "")?.role === "dimension" ? raw.breakdown : null;
        return {
            type, title: concarLabel(raw.title || source.name), source: source.id,
            metrics: [metric.id], columns: hierarchy, matrixColumns, dateField,
            bucket: dateField ? (VAI_BUCKETS.includes(raw.bucket as VaiBucket) ? raw.bucket as VaiBucket : "month") : null,
            dimension: null, breakdown, seriesTypes: null, limit: null, summaries: [],
            stack: null, sort: "label_asc", sortMetric: null, cumulative: null,
        };
    }
    const rawStack = normalizeStack(raw.stack) ?? (/^stacked/.test(String(raw.type).trim().toLowerCase()) ? "stack" : null);
    const metrics: string[] = [];
    for (const id of raw.metrics) {
        if (vaiMetric(source, id)) {
            if (!metrics.includes(id))
                metrics.push(id);
        }
        else
            notes.push(`${label}: la métrica «${id}» no existe en ${source.name}.`);
    }
    const maxMetrics = ["kpi", "donut", "pareto", "heatmap", "histogram", "waterfall"].includes(type) ? 1 : type === "table" ? 6 : type === "scatter" ? 2 : 3;
    if (metrics.length > maxMetrics)
        metrics.splice(maxMetrics);
    let dimension: string | null = null;
    if (raw.dimension) {
        const field = vaiField(source, raw.dimension);
        if (field && field.role === "dimension")
            dimension = field.id;
        else
            notes.push(`${label}: «${raw.dimension}» no es una dimensión válida de ${source.name}.`);
    }
    let breakdown: string | null = null;
    if (raw.breakdown) {
        const field = vaiField(source, raw.breakdown);
        if (field && field.role === "dimension")
            breakdown = field.id;
        else
            notes.push(`${label}: «${raw.breakdown}» no es una dimensión válida de ${source.name} para desglosar series.`);
    }
    if (breakdown && breakdown === dimension)
        breakdown = null;
    let dateField: string | null = null;
    if (raw.dateField) {
        const field = vaiField(source, raw.dateField);
        if (field && field.role === "date")
            dateField = field.id;
        else
            notes.push(`${label}: «${raw.dateField}» no es un campo de fecha de ${source.name}.`);
    }
    const bucket = raw.bucket && VAI_BUCKETS.includes(raw.bucket as VaiBucket) ? (raw.bucket as VaiBucket) : null;
    let limit: number | null = null;
    if (raw.limit != null && Number.isFinite(raw.limit)) {
        const maxLimit = type === "table" ? VAI_MAX_TABLE_LIMIT : VAI_MAX_LIMIT;
        limit = Math.min(maxLimit, Math.max(1, Math.round(raw.limit)));
    }
    if (["finance_mineral_purchases", "traceability_lots"].includes(source.id) &&
        (dimension === "lot" || breakdown === "lot") &&
        (type !== "table" || breakdown === "lot") &&
        type !== "kpi") {
        notes.push(`${label}: Lote tiene alta cardinalidad; se cambió el eje categórico por una tabla agrupada por lote.`);
        type = "table";
        dimension = "lot";
        if (metrics.includes("lot_usd_purchase_docs") &&
            !metrics.includes("tms_conta_purchase_docs") &&
            vaiMetric(source, "tms_conta_purchase_docs")) {
            metrics.push("tms_conta_purchase_docs");
        }
        dateField = null;
        breakdown = null;
        limit = null;
    }
    let columns: string[] | null = null;
    const metricColumns: string[] = [];
    let hasMetricOnlyColumn = false;
    if (raw.columns) {
        const fieldColumns: string[] = [];
        for (const id of raw.columns) {
            const field = vaiField(source, id);
            const metric = type === "table" ? vaiMetric(source, id) : null;
            if (field && !fieldColumns.includes(field.id)) {
                fieldColumns.push(field.id);
            }
            if (metric && !metricColumns.includes(metric.id)) {
                metricColumns.push(metric.id);
            }
            if (!field && metric) {
                hasMetricOnlyColumn = true;
            }
            if (!field && !metric) {
                notes.push(`${label}: la columna «${id}» no existe en ${source.name}.`);
            }
        }
        columns = fieldColumns.length ? fieldColumns : null;
    }
    if (type === "table" && hasMetricOnlyColumn && metricColumns.length) {
        const groupingField = columns
            ?.map((id) => vaiField(source, id))
            .find((field): field is VaiField => Boolean(field && (field.role === "dimension" || field.role === "date")));
        if (!dimension && !dateField && groupingField) {
            if (groupingField.role === "date")
                dateField = groupingField.id;
            else
                dimension = groupingField.id;
        }
        if (dimension || dateField) {
            for (const id of metricColumns) {
                if (!metrics.includes(id) && metrics.length < 6)
                    metrics.push(id);
            }
            columns = null;
        }
    }
    if ((type === "scatter" || type === "combo") && metrics.length < 2) {
        notes.push(`${label}: ${type === "combo" ? "el combinado" : "la dispersión"} necesita dos métricas válidas; no se sustituye por otro gráfico.`);
        return null;
    }
    if (type === "scatter")
        breakdown = null;
    if (breakdown && !BREAKDOWN_TYPES.has(type)) {
        if (type === "combo")
            notes.push(`${label}: un combo no se desglosa por ${vaiField(source, breakdown)?.label ?? breakdown}; se conservan sus métricas.`);
        breakdown = null;
    }
    if (breakdown && metrics.length > 1) {
        notes.push(`${label}: el desglose por ${vaiField(source, breakdown)?.label ?? breakdown} usa solo la primera métrica.`);
        metrics.splice(1);
    }
    let seriesTypes: VaiSeriesRender[] | null = null;
    if (SERIES_TYPES.has(type)) {
        const requestedSeriesTypes = metrics.map((id) => {
            const value = raw.seriesTypes?.[raw.metrics.indexOf(id)];
            return value === "line" || value === "bar" ? value : null;
        });
        const base: VaiSeriesRender = LINE_TYPES.has(type) ? "line" : "bar";
        const comboDefault = (index: number): VaiSeriesRender => (index === 0 ? "bar" : "line");
        if (breakdown) {
            seriesTypes = metrics.map(() => base);
        }
        else if (requestedSeriesTypes.length) {
            seriesTypes = metrics.map((_, index) => requestedSeriesTypes[index] ?? (type === "combo" ? comboDefault(index) : base));
        }
        else if (metrics.length) {
            seriesTypes = metrics.map((_, index) => (type === "combo" ? comboDefault(index) : base));
        }
        if (seriesTypes?.length) {
            const mixed = seriesTypes.includes("line") && seriesTypes.includes("bar");
            if (type === "combo" && !mixed && metrics.length >= 2)
                seriesTypes = metrics.map((_, index) => comboDefault(index));
            else if (type !== "combo" && mixed)
                type = "combo";
            if (type === "combo" && metrics.length < 2)
                type = seriesTypes[0] === "line" ? "line" : "bar";
        }
    }
    if (type === "kpi" && !metrics.length) {
        notes.push(`${label}: un KPI necesita una métrica válida.`);
        return null;
    }
    if (LINE_TYPES.has(type)) {
        if (!metrics.length) {
            notes.push(`${label}: un gráfico de línea necesita al menos una métrica válida.`);
            return null;
        }
        if (dimension) {
            dateField = null;
        }
        else if (!dateField) {
            const fallback = source.fields.find((field) => field.role === "date");
            if (!fallback) {
                notes.push(`${label}: ${source.name} necesita una dimensión o un campo de fecha válido para el eje X.`);
                return null;
            }
            dateField = fallback.id;
        }
    }
    if ((type === "bar" || type === "combo" || type === "rank" || type === "donut" || type === "scatter") && !metrics.length) {
        notes.push(`${label}: necesita al menos una métrica válida.`);
        return null;
    }
    if ((type === "bar" || type === "combo" || type === "rank" || type === "donut" || type === "scatter") && !dimension && !((type === "bar" || type === "combo") && dateField)) {
        notes.push(`${label}: necesita una dimensión válida para comparar.`);
        return null;
    }
    if (type !== "table" && type !== "kpi" && dimension)
        dateField = null;
    if (type === "donut" && metrics.length > 1)
        metrics.splice(1);
    if (!SERIES_TYPES.has(type))
        seriesTypes = null;
    if (["pareto", "heatmap", "histogram", "waterfall"].includes(type) && !metrics.length) {
        notes.push(`${label}: necesita una métrica válida.`);
        return null;
    }
    if (type === "pareto" && !dimension) {
        notes.push(`${label}: el Pareto necesita una dimensión.`);
        return null;
    }
    if (type === "heatmap" && (!(dimension || dateField) || !breakdown)) {
        notes.push(`${label}: el mapa de calor necesita un eje y una segunda dimensión (breakdown).`);
        return null;
    }
    if (type === "waterfall" && !(dimension || dateField)) {
        notes.push(`${label}: la cascada necesita categorías o fechas.`);
        return null;
    }
    if (["pareto", "donut", "waterfall"].includes(type) && metrics.some((id) => !STACKABLE_AGGS.has(vaiMetric(source, id)!.agg))) {
        notes.push(`${label}: ${type} requiere una métrica aditiva; no representa promedios, ratios o conteos distintos como partes sumables.`);
        return null;
    }
    if (type === "histogram") {
        const metric = vaiMetric(source, metrics[0])!;
        const field = metric.field ? vaiField(source, metric.field) : null;
        if (!field || field.type !== "number" || !["sum", "avg", "min", "max"].includes(metric.agg)) {
            notes.push(`${label}: el histograma necesita una métrica de campo numérico directo, no una fórmula agregada.`);
            return null;
        }
        dimension = null;
        dateField = null;
        breakdown = null;
        limit = null;
    }
    if (SERIES_TYPES.has(type) && new Set(metrics.map((id) => chartAxisGroup(vaiMetric(source, id)!.format))).size > 2) {
        notes.push(`${label}: tiene más de dos unidades incompatibles; solicita gráficos separados.`);
        return null;
    }
    const seriesAxes = SERIES_TYPES.has(type)
        ? metrics.map((id) => raw.seriesAxes?.[raw.metrics.indexOf(id)] ?? null) : null;
    if (seriesAxes?.some(Boolean)) {
        for (const side of ["left", "right"] as const) {
            const units = new Set(metrics.filter((_, i) => seriesAxes[i] === side).map((id) => chartAxisGroup(vaiMetric(source, id)!.format)));
            if (units.size > 1) {
                notes.push(`${label}: el eje ${side} mezcla unidades incompatibles.`);
                return null;
            }
        }
    }
    if (type === "table") {
        if (columns?.length) {
            dimension = null;
            dateField = null;
            limit = null;
            breakdown = null;
            metrics.splice(0);
        }
        else if ((dimension || dateField) && metrics.length) {
            columns = null;
        }
        else {
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
            breakdown = null;
            metrics.splice(0);
        }
    }
    if (type === "table") {
        if (columns)
            columns = lotDetailColumns(source, columns);
        if (["finance_mineral_purchases", "traceability_lots"].includes(source.id) && dimension === "lot") {
            dateField = null;
            breakdown = null;
            const amountMetrics = metrics.filter((id) => !["count", "count_distinct", "count_per_distinct"].includes(vaiMetric(source, id)?.agg ?? ""));
            metrics.splice(0, metrics.length, ...(amountMetrics.length ? amountMetrics : ["lot_usd_total"]));
        }
    }
    const temporal = Boolean(dateField) && (LINE_TYPES.has(type) || !dimension);
    const aggOf = (id: string) => vaiMetric(source, id)?.agg ?? "sum";
    let stack: VaiStackMode | null = null;
    if (type === "bar" && rawStack) {
        const additive = metrics.every((id) => STACKABLE_AGGS.has(aggOf(id)));
        const sameUnit = (Boolean(breakdown) && metrics.length === 1) || (metrics.length >= 2 && new Set(metrics.map((id) => chartAxisGroup(vaiMetric(source, id)?.format ?? "decimal"))).size === 1);
        if (!additive)
            notes.push(`${label}: solo se apilan métricas sumables (sumas o conteos); se muestran agrupadas.`);
        else if (!sameUnit)
            notes.push(`${label}: no se apilan ${breakdown || metrics.length >= 2 ? "métricas con unidades distintas" : "una sola serie"}; se muestran agrupadas.`);
        else
            stack = rawStack;
    }
    const sort = !temporal && dimension && type !== "kpi" && !columns ? normalizeSort(raw.sort) : null;
    const sortMetric = sort && raw.sortMetric && vaiMetric(source, raw.sortMetric) ? raw.sortMetric : null;
    let cumulative: boolean | null = null;
    if (raw.cumulative) {
        if (!temporal || columns)
            notes.push(`${label}: el acumulado necesita un eje temporal; se muestra el valor por período.`);
        else if (!metrics.every((id) => STACKABLE_AGGS.has(aggOf(id))))
            notes.push(`${label}: solo se acumulan sumas o conteos; se muestra el valor por período.`);
        else
            cumulative = true;
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
        if (!summaries.some((item) => item.column === summary.column))
            summaries.push({ column: summary.column, operation: summary.operation as VaiSummaryOperation });
    }
    return {
        type,
        title: concarLabel(raw.title || source.name),
        source: source.id,
        metrics,
        seriesTypes,
        dimension,
        dateField,
        bucket: dateField ? bucket ?? "month" : null,
        limit,
        columns: type === "table" && !dimension && !dateField ? columns : null,
        matrixColumns: null,
        summaries,
        breakdown,
        stack,
        sort: type === "pareto" ? "value_desc" : sort,
        sortMetric,
        cumulative: type === "waterfall" || type === "pareto" || type === "histogram" ? null : cumulative,
        seriesAxes,
        includeOthers: typeof raw.includeOthers === "boolean" ? raw.includeOthers : null,
        bins: type === "histogram" && raw.bins != null && Number.isFinite(raw.bins) ? Math.min(40, Math.max(3, Math.round(raw.bins))) : null,
    };
}
function validateFilter(raw: VaiRawFilter, sources: Set<string>, notes: string[], userPrompt: string): VaiFilterSpec | null {
    if (localDocumentField(raw.source, raw.field))
        return null;
    if (raw.source === "finance_mineral_purchases" && raw.kind === "date_range") {
        const field = raw.field === "payment_date" ? "pay_date" : ["invoice_reg_date", "invoice_doc_date"].includes(raw.field) ? "entry_date" : raw.field;
        raw = { ...raw, field, label: VAI_SOURCE_MAP.get(raw.source)?.fields.find((item) => item.id === field)?.label ?? raw.label };
    }
    const label = `Filtro «${raw.label || raw.field}»`;
    if (raw.kind !== "date_range" && raw.kind !== "select") {
        notes.push(`${label}: el tipo de filtro «${raw.kind}» no está soportado.`);
        return null;
    }
    const source = resolveSource(raw.source, notes, label);
    if (!source)
        return null;
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
    if (raw.kind === "date_range" &&
        source.temporalMode === "snapshot" &&
        userPrompt.trim() &&
        !snapshotDateWasExplicitlyRequested(source, field, userPrompt)) {
        return null;
    }
    if (raw.kind === "select" && field.role !== "dimension" &&
        !(source.id === "finance_costs" && field.id === "gloss")) {
        notes.push(`${label}: «${field.label}» no es una dimensión filtrable.`);
        return null;
    }
    if (raw.kind === "select" && /^(?:is_|has_)/.test(field.id)) {
        return null;
    }
    if (raw.kind === "date_range") {
        const preset = raw.preset && VAI_DATE_PRESETS.includes(raw.preset as VaiDatePreset)
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
            if (requested)
                ({ from, to } = requested);
        }
        return {
            kind: "date_range",
            source: source.id,
            field: field.id,
            label: concarLabel(raw.label || field.label),
            mode: raw.mode === "period" || /\b(periodos?|mensual|mensuales|meses|por mes)\b/.test(normalizePromptText(userPrompt)) ? "period" : "range",
            preset: from || to ? null : preset,
            from,
            to,
        };
    }
    return {
        kind: "select",
        source: source.id,
        field: field.id,
        label: concarLabel(raw.label || field.label),
        values: raw.values ?? null,
    };
}
function normalizedContextText(value: string) {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}
function contextualFilterScore(source: VaiSource, field: VaiField, userPrompt: string) {
    if (field.role !== "dimension" || localDocumentField(source.id, field.id))
        return Number.NEGATIVE_INFINITY;
    const technical = new Set([
        "has_gps",
        "has_fuel",
        "is_vehicle",
        "is_tank_anomaly",
    ]);
    if (technical.has(field.id) || /^(?:is_|has_)/.test(field.id)) {
        return Number.NEGATIVE_INFINITY;
    }
    const prompt = normalizedContextText(userPrompt);
    const promptTokens = new Set(prompt.split(" ").filter((token) => token.length >= 3));
    const fieldText = normalizedContextText(`${field.id.replace(/_/g, " ")} ${field.label} ${field.description}`);
    const tokens = fieldText.split(" ").filter((token) => token.length >= 3);
    let score = 0;
    if (tokens.some((token) => promptTokens.has(token)))
        score += 100;
    const priorities: Record<string, Record<string, number>> = {
        fleet_fuel_refuels: {
            plate: 60,
            driver_name: 55,
            group_name: 50,
            type_fuel: 45,
            gas_station: 30,
            brand: 20,
            model: 15,
            currency_code: 5,
        },
        fleet_fuel_alerts: {
            plate: 60,
            driver_name: 55,
            group_name: 50,
            type_fuel: 45,
            gas_station: 30,
            brand: 20,
            model: 15,
            currency_code: 5,
        },
        fleet_gps_distance: {
            plate: 60,
            driver_name: 55,
            group_name: 50,
            brand: 20,
            model: 15,
        },
        fleet_performance: {
            plate: 60,
            group_name: 50,
            brand: 20,
            model: 15,
        },
        finance_mineral_purchases: {
            lot: 90,
            supplier: 70,
            office_name: 60,
            doc_type: 50,
            program_class: 40,
            sede: 30,
        },
        finance_mineral_payments: {
            supplier: 70,
            office_name: 60,
            document_type: 50,
            provision_currency_code: 40,
            account_code: 30,
            sede: 20,
        },
        finance_costs: {
            macro_process: 80,
            lima_area: 70,
            site_name: 65,
            cost_group: 60,
            cost_nature: 55,
            prod_admin: 50,
            cost_center_desc: 45,
            supplier_name: 40,
            fixed_variable: 35,
            dynacor_group: 30,
            transversal: 25,
            period_label: 20,
            scenario: 15,
        },
    };
    score += priorities[source.id]?.[field.id] ?? 0;
    return score;
}
function contextualSelectFilters(source: VaiSource, userPrompt: string, limit = 4): VaiFilterSpec[] {
    return source.fields.filter((field) => source.id !== "finance_costs" || !["lima_area", "account_desc", "supplier_name", "cost_center_desc", "scenario", "fiscal_year"].includes(field.id))
        .map((field) => ({
        field,
        score: contextualFilterScore(source, field, userPrompt),
    }))
        .filter((item) => Number.isFinite(item.score) && item.score > 0)
        .sort((a, b) => b.score - a.score || a.field.label.localeCompare(b.field.label, "es"))
        .slice(0, limit)
        .map(({ field }) => ({
        kind: "select" as const,
        source: source.id,
        field: field.id,
        label: field.label,
    }));
}
const HINT_STOP = new Set(["de", "del", "la", "el", "los", "las", "y", "e", "o", "u", "un", "una", "unos", "unas", "en", "con", "por", "para", "al", "a", "su", "sus", "mi", "mis", "que", "como", "mas", "menos", "eje", "x", "grafico", "graficos", "chart", "serie", "series", "linea", "lineas", "barra", "barras", "columna", "columnas", "curva", "curvas", "otra", "otro", "misma", "mismo", "cada", "todo", "todos", "toda", "todas"]);
const stemWord = (word: string) => word.replace(/(ciones|cion)$/, "cion").replace(/(es|s)$/, "");
function hintWords(text: string) {
    return normalizePromptText(text).split(" ").filter((word) => word && !HINT_STOP.has(word)).map(stemWord);
}
function metricTerms(metric: VaiMetric) {
    const unit: Record<string, string[]> = {
        pen: ["pen", "sol", "soles", "s/"],
        usd: ["usd", "dolar", "dolares"],
        gal: ["galon", "galones", "gal"],
        km: ["km", "kilometro", "kilometros", "recorrido"],
        percent: ["porcentaje", "%"],
        fraction: ["porcentaje", "%"],
        tmh: ["tmh", "tonelada", "toneladas"],
        tms: ["tms", "tonelada", "toneladas"],
        kg: ["kg", "kilo", "kilos"],
        g: ["gramo", "gramos"],
        m3: ["m3", "metros cubicos"],
        g_m3: ["g/m3", "mg/l"],
        kg_per_tms: ["kg/tms", "kg/t", "ratio"],
        hours: ["hora", "horas"],
        days: ["dia", "dias"],
        integer: ["cantidad", "numero", "conteo"],
    };
    const ids = metric.id.split("_");
    return new Set([...hintWords(metric.label), ...ids.map(stemWord), ...(unit[metric.format] ?? []).map(stemWord)]);
}
const wordHits = (words: string[], candidates: Set<string>) => words.reduce((score, word, index) => (word.length >= 2 && [...candidates].some((candidate) => candidate === word || (word.length >= 3 && Math.abs(candidate.length - word.length) <= 2 && (candidate.startsWith(word) || word.startsWith(candidate)))) ? score + words.length - index : score), 0);
type VaiHintMention<T> = {
    value: T;
    context: string[];
};
export type VaiPromptHints = {
    renders: {
        term: string[];
        render: VaiSeriesRender;
    }[];
    mentionsBars: boolean;
    mentionsLines: boolean;
    families: Set<"donut" | "rank" | "scatter" | "area" | "bar" | "line" | "table" | "kpi">;
    stack: VaiHintMention<VaiStackMode>[];
    cumulative: VaiHintMention<true>[];
    sort: VaiHintMention<VaiSortMode>[];
    bucket: VaiHintMention<VaiBucket>[];
    breakdown: VaiHintMention<string[]>[];
    words: string[];
};
const BAR_WORDS = /^(?:barra|barras|columna|columnas)$/;
const RENDER_WORDS = /^(?:barra|barras|columna|columnas|linea|lineas|curva|curvas)$/;
const HINT_BOUNDARY = /^(?:y|e|o|u|ni|mas|ademas|junto|mientras|donde|que|tambien|luego|despues|antes|sobre|contra|frente|versus|vs)$/;
export function promptRenderHints(userPrompt: string): VaiPromptHints {
    const tokens = positiveVisualText(userPrompt)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[,;.:()\n]+/g, " | ")
        .replace(/[^a-z0-9|]+/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    const words: string[] = [];
    const breakBefore: boolean[] = [];
    let pendingBreak = false;
    for (const token of tokens) {
        if (token === "|") {
            pendingBreak = true;
            continue;
        }
        words.push(token);
        breakBefore.push(pendingBreak);
        pendingBreak = false;
    }
    const text = words.join(" ");
    const offsets: number[] = [];
    let position = 0;
    for (const word of words) {
        offsets.push(position);
        position += word.length + 1;
    }
    const contextAt = (charIndex: number, span = 6) => {
        let index = 0;
        while (index + 1 < offsets.length && offsets[index + 1] <= charIndex)
            index += 1;
        let lo = index;
        while (lo > 0 && index - lo < span && !breakBefore[lo] && !HINT_BOUNDARY.test(words[lo - 1]))
            lo -= 1;
        let hi = index;
        while (hi + 1 < words.length && hi - index < span && !breakBefore[hi + 1] && !HINT_BOUNDARY.test(words[hi + 1]))
            hi += 1;
        return words.slice(lo, hi + 1).filter((word) => !HINT_STOP.has(word)).map(stemWord);
    };
    const mentions = <T,>(pattern: RegExp, valueOf: (match: RegExpExecArray, context: string[]) => T | null) => {
        const out: VaiHintMention<T>[] = [];
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(text))) {
            const context = contextAt(match.index);
            const value = valueOf(match, context);
            if (value != null)
                out.push({ value, context });
        }
        return out;
    };
    const renderOf = (word: string): VaiSeriesRender => (BAR_WORDS.test(word) ? "bar" : "line");
    const renders: VaiPromptHints["renders"] = [];
    const pushRender = (term: string[], render: VaiSeriesRender) => {
        const clean = term.filter((word) => word && !HINT_STOP.has(word)).map(stemWord);
        if (clean.length)
            renders.push({ term: clean, render });
    };
    const isBoundary = (word: string) => HINT_BOUNDARY.test(word) || RENDER_WORDS.test(word);
    let match: RegExpExecArray | null;
    const before = /\b(?:en|como)\s(?:(?:una?|las?|los?)\s+)?(barra|barras|columna|columnas|linea|lineas|curva|curvas)\b(?!\s(?:de|del|para|los|las|el|la)\b)/g;
    while ((match = before.exec(text))) {
        const previous = text.slice(0, match.index).trim().split(" ").filter(Boolean);
        const term: string[] = [];
        for (let i = previous.length - 1; i >= 0 && term.length < 4; i -= 1) {
            if (isBoundary(previous[i]))
                break;
            term.push(previous[i]);
        }
        pushRender(term, renderOf(match[1]));
    }
    const after = /\b(barra|barras|columna|columnas|linea|lineas|curva|curvas)\s(?:de|del|para|con|los|las|el|la)\s/g;
    while ((match = after.exec(text))) {
        const following = text.slice(match.index + match[0].length).split(" ").filter(Boolean);
        const term: string[] = [];
        for (let i = 0; i < following.length; i += 1) {
            const word = following[i];
            if (word === "por" && /^(?:galon|galones|gal|km|kilometro|tms|tmh|hora|vehiculo)$/.test(following[i + 1] ?? "")) {
                term.push(word, following[++i]);
                continue;
            }
            if (term.length >= 6 || isBoundary(word) || /^(?:en|como|con|para|por|segun)$/.test(word))
                break;
            term.push(word);
        }
        pushRender(term, renderOf(match[1]));
        after.lastIndex = match.index + match[0].length;
    }
    const families: VaiPromptHints["families"] = new Set();
    if (/\b(?:torta|pastel|pie|anillo|dona|donut|donuts)\b/.test(text))
        families.add("donut");
    if (/\b(?:ranking|rankings|top \d+|top n|barras horizontales|horizontal|horizontales)\b/.test(text))
        families.add("rank");
    if (/\b(?:dispersion|scatter|correlacion|nube de puntos)\b/.test(text))
        families.add("scatter");
    if (/\b(?:grafico|graficos|chart) de area(?:s)?\b|\ben area(?:s)?\b|\barea(?:s)? apilad/.test(text))
        families.add("area");
    if (/\b(?:barra|barras|columna|columnas)\b/.test(text))
        families.add("bar");
    if (/\b(?:linea|lineas|curva|curvas)\b/.test(text))
        families.add("line");
    if (/\b(?:tabla|tablas|listado|detalle)\b/.test(text))
        families.add("table");
    if (/\b(?:kpi|kpis|indicador|indicadores|tarjeta|tarjetas)\b/.test(text))
        families.add("kpi");
    const stack = mentions<VaiStackMode>(/\bapilad[oa]s?\b|\bstacked?\b/g, (_, context) => context.some((word) => word === "100" || /^(?:porcentual|participacion|normalizad)/.test(word)) ? "percent" : "stack");
    const cumulative = mentions<true>(/\bacumulad[oa]s?\b|\bacumulativ[oa]s?\b/g, () => true);
    const sort = [
        ...mentions<VaiSortMode>(/\borden alfabetic\w*|\balfabeticamente\b|\bpor nombre\b/g, () => "label_asc"),
        ...mentions<VaiSortMode>(/\bde menor a mayor\b|\bascendente\b/g, () => "value_asc"),
        ...mentions<VaiSortMode>(/\bde mayor a menor\b|\bdescendente\b/g, () => "value_desc"),
    ];
    const bucket = [
        ...mentions<VaiBucket>(/\bdiari[oa]s?\b|\bpor dia\b|\bcada dia\b/g, () => "day"),
        ...mentions<VaiBucket>(/\bsemanal(?:es)?\b|\bpor semana\b|\bcada semana\b/g, () => "week"),
        ...mentions<VaiBucket>(/\bmensual(?:es)?\b|\bpor mes\b|\bcada mes\b/g, () => "month"),
        ...mentions<VaiBucket>(/\btrimestral(?:es)?\b|\bpor trimestre\b|\btrimestre\b/g, () => "quarter"),
        ...mentions<VaiBucket>(/\banual(?:es)?\b|\bpor ano\b|\bcada ano\b/g, () => "year"),
    ];
    const breakdown = mentions<string[]>(/\b(?:(?:una|un|cada)\s(?:linea|lineas|serie|series|curva|curvas|barra|barras|columna|columnas|color)|(?:desglos\w*|segment\w*|separad\w*|dividid\w*|apilad\w*|discriminad\w*|abiert\w*|colore\w*)(?:\s\w+)?)\s(?:por|segun|para cada)\s((?:[a-z0-9]+\s?){1,3})/g, (found, context) => {
        const term = hintWords(found[1]);
        if (!term.length)
            return null;
        context.splice(0, context.length, ...context.filter((word) => !term.includes(word)));
        return term;
    });
    return { renders, mentionsBars: families.has("bar"), mentionsLines: families.has("line"), families, stack, cumulative, sort, bucket, breakdown, words };
}
const dimensionTerms = (field: VaiField) => new Set([...hintWords(field.label), ...field.id.split("_").map(stemWord)]);
function positiveVisualText(value: string) {
    const raw = String(value ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\b(?:no|without|sans)\s+(?:(?:a|an|the|un|une|de|des|du)\s+)*(?:pie\s+charts?|donuts?|bars?|barres?|lines?|courbes?|rankings?|areas?|pareto|histograms?|histogrammes?|heatmaps?|waterfalls?|scatter(?:\s+plots?)?)\b/g, " ")
        .replace(/\b(?:no\s+(?:(?:quiero|uses|usar|pongas|incluir|incluyas|muestres|mostrar|necesito)\s+)?|sin\s+)(?:(?:un|una|el|la|los|las|graficos?\s+de)\s+)*(?:tortas?|pastel(?:es)?|anillos?|donuts?|barras?|columnas?|lineas?|curvas?|rankings?|areas?|pareto|histogramas?|mapas?\s+de\s+calor|cascadas?)\b/g, " ")
        .replace(/s\s*\//g, " PEN ")
        .replace(/\bus\s*\$/g, " USD ")
        .replace(/%/g, " porcentaje ");
    return normalizeVaiPrompt(raw)
        .replace(/eje\s+horizontal/g, "eje x")
        .replace(/eje\s+vertical/g, "eje y");
}
function visualRequestSegments(prompt: string) {
    const parts = positiveVisualText(prompt).split(/[;\n]+|\.(?!\d)|\b(?:ademas|tambien|luego|y)\s+(?:(?:quiero|muestra|agrega|incluye)\s+)?(?:otro|otra|un|una)\s+(?=grafico|grafica|anillo|torta|ranking|pareto|histograma|mapa|cascada|tabla|dispersion)/g).map((part) => part.trim()).filter(Boolean);
    const result: string[] = [];
    for (const part of parts) {
        if (result.length && !requestedFamily(part) && /\beje\s*(?:x|y|derecho|izquierdo|primario|secundario)\b/.test(part))
            result[result.length - 1] += ", " + part;
        else
            result.push(part);
    }
    return result;
}
const requestWords = (text: string) => hintWords(text).filter((word) => !/^(?:quier|necesit|muestr|mostr|haya|pon|ponme|agreg|incluy|ejes?|izquierd|derech|secundari|primari|principal|grafica|combinad|combo|barr|line|encima|debajo)$/.test(word));
function requestedFamily(text: string): VaiWidgetType | null {
    if (/\bpareto\b/.test(text))
        return "pareto";
    if (/\b(?:heatmap|mapa de calor)\b/.test(text))
        return "heatmap";
    if (/\b(?:histograma|histogram)\b/.test(text))
        return "histogram";
    if (/\b(?:cascada|waterfall)\b/.test(text))
        return "waterfall";
    if (/\b(?:dispersion|correlacion|scatter|nube de puntos)\b/.test(text))
        return "scatter";
    if (/\b(?:tabla dinamica|pivot|matriz)\b/.test(text))
        return "table";
    const hints = promptRenderHints(text);
    if (hints.mentionsBars && hints.mentionsLines && !/\b(?:por separado|graficos separados)\b/.test(text))
        return "combo";
    if (/\b(?:combo|combinado|mixto)\b/.test(text))
        return "combo";
    if (hints.families.has("donut"))
        return "donut";
    if (hints.families.has("rank"))
        return "rank";
    if (hints.families.has("area"))
        return "area";
    if (hints.families.has("line") || /\b(?:evolucion|tendencia|serie temporal)\b/.test(text))
        return "line";
    if (hints.families.has("bar") || hints.stack.length)
        return "bar";
    return null;
}
function matchingField(term: string, source: VaiSource, roles: VaiFieldRole[] = ["dimension"]) {
    const words = requestWords(term);
    const candidates = source.fields.filter((f) => roles.includes(f.role) && !/^(?:is_|has_)/.test(f.id));
    const ranked = candidates.map((field) => {
        const label = hintWords(field.label);
        const hits = label.filter((word) => wordHits([word], new Set(words)) > 0).length;
        const exactId = normalizePromptText(term).includes(normalizePromptText(field.id));
        const enough = hits === label.length || (label.length > 2 && hits >= 2);
        return { field, score: exactId ? 100 : enough && hits ? wordHits(words, dimensionTerms(field)) + hits * 4 : 0 };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
    return ranked[0]?.field ?? null;
}
function explicitAxisTerm(text: string, axis = "x"): string | null {
    const after = text.match(new RegExp(`\\beje\\s*${axis}\\b\\s*(?:(?:por|con|de|son|sea|sean|las|los|el|la|en)\\s+|[:=]\\s*)*([^,;.]+)`, "i"));
    if (after) {
        const term = after[1].split(/\s+(?:y|e|en el eje|con|mientras)\s+/)[0].trim();
        if (term && !/^(?:y|en|eje)\b/.test(term))
            return term;
    }
    const before = text.match(new RegExp(`([^,;.]+?)\\s+(?:en|sobre|como)\\s+(?:el\\s+)?eje\\s*${axis}\\b`, "i"));
    return before ? before[1].split(/[:]|\b(?:con|que|haya|ponga|pongan|poner|coloca|colocar)\b/).pop()!.trim() : null;
}
function requestMetric(term: string[], source: VaiSource, excluded = new Set<string>()): VaiMetric | null {
    const text = term.join(" ");
    let asksRate = /promedi|ratio|por gal|por km|unitari|por vehicul|precio/.test(text);
    const asksExcess = /exces|anomal|sobrecons|desvi/.test(text);
    const currency = /\busd\b|dolar/.test(text) ? "usd" : /\bpen\b|\bsol(?:es)?\b/.test(text) ? "pen" : null;
    const physical = /\b(?:galon|galones|gal)\b/.test(text) ? "gal" : /\btmh\b/.test(text) ? "tmh" : /\btms\b/.test(text) ? "tms" : null;
    const perUnit = physical && /costo|precio|tarifa|pen|usd|sol|dolar/.test(text) ? physical : /\bkm\b/.test(text) && currency ? "km" : null;
    if (perUnit)
        asksRate = true;
    const ranked = source.metrics.filter((m) => !excluded.has(m.id)).map((metric) => {
        if (perUnit && !metric.format.endsWith(`_per_${perUnit}`))
            return { metric, score: -Infinity };
        if (currency && !metric.format.startsWith(currency))
            return { metric, score: -Infinity };
        if (!currency && physical && metric.format !== physical && !asksRate)
            return { metric, score: -Infinity };
        const hits = wordHits(term, metricTerms(metric));
        if (!hits)
            return { metric, score: -Infinity };
        const isRate = RATE_AGGS.has(metric.agg);
        const isExcess = /excess|exceso|anomal|desvi/.test(`${metric.id} ${normalizePromptText(metric.label)}`);
        const score = hits + (currency === metric.format ? 12 : 0) + (physical === metric.format ? 10 : 0)
            + (asksRate === isRate ? 4 : -6) + (asksExcess === isExcess ? 2 : -12)
            + (metric.agg === "sum" || metric.agg === "count" ? 2 : 0);
        return { metric, score };
    }).filter((item) => Number.isFinite(item.score)).sort((a, b) => b.score - a.score);
    return ranked[0]?.metric ?? null;
}
export type VaiVisualRequest = {
    text: string;
    type: VaiWidgetType | null;
    source: string | null;
    metrics: string[];
    seriesTypes: VaiSeriesRender[] | null;
    seriesAxes: ("left" | "right" | null)[] | null;
    dimension: string | null;
    dateField: string | null;
    breakdown: string | null;
    bucket: VaiBucket | null;
    stack: VaiStackMode | null;
    sort: VaiSortMode | null;
    sortMetric: string | null;
    cumulative: boolean | null;
    limit: number | null;
    includeOthers: boolean | null;
    bins: number | null;
    problems: string[];
};
export function resolveVisualRequests(prompt: string, allowedSourceIds?: string[], preferredSources: string[] = []): VaiVisualRequest[] {
    const full = normalizePromptText(prompt);
    const pool = VAI_SOURCES.filter((s) => s.enabled && (!allowedSourceIds || allowedSourceIds.includes(s.id)) &&
        (!s.explicitOnly || s.keywords.some((k) => full.includes(normalizePromptText(k)))));
    const requests: VaiVisualRequest[] = [];
    for (const text of visualRequestSegments(prompt)) {
        const hints = promptRenderHints(text);
        const type = requestedFamily(text);
        const axisTerm = explicitAxisTerm(text);
        const unsupported = text.match(/\b(?:boxplot|box plot|caja y bigotes|treemap|sankey|burbujas|bubble|radar|velocimetro|gauge|mapa geografico)\b/);
        if (!type && !axisTerm && !hints.stack.length && !hints.cumulative.length && !unsupported)
            continue;
        const ranked = pool.map((source) => {
            const bindings = hints.renders.map((hint) => requestMetric(hint.term, source));
            const axis = axisTerm ? matchingField(axisTerm, source, ["dimension", "date"]) : null;
            const words = requestWords(full);
            let score = source.keywords.reduce((n, word) => n + (full.includes(normalizePromptText(word)) ? 5 : 0), 0);
            score += wordHits(words, new Set(hintWords(source.name))) + (preferredSources.includes(source.id) ? 10 : 0);
            score += bindings.filter(Boolean).length * 12 + (axis ? 15 : 0);
            if (axisTerm && !axis && !/mes|fecha|period|dia|semana|trimestre|ano/.test(axisTerm))
                score -= 20;
            if (/combustible|galon|abastec|tanqueo/.test(full) && !/rendimiento|gps|por km|eficiencia/.test(full)) {
                if (source.id === "fleet_fuel_refuels")
                    score += 60;
                if (source.id === "fleet_performance")
                    score -= 60;
            }
            return { source, score };
        }).sort((a, b) => b.score - a.score);
        const source = ranked[0]?.score > 0 ? ranked[0].source : null;
        const problems: string[] = unsupported ? [`El tipo «${unsupported[0]}» no está implementado en este catálogo. No se sustituirá por otro gráfico.`] : [];
        const metrics: string[] = [];
        const renders: VaiSeriesRender[] = [];
        const axes: ("left" | "right" | null)[] = [];
        if (source && type === "combo" && hints.renders.length) {
            for (const hint of hints.renders) {
                const metric = requestMetric(hint.term, source);
                if (!metric) {
                    problems.push(`No se pudo resolver «${hint.term.join(" ")}» como métrica autorizada de ${source.name}.`);
                    continue;
                }
                const index = metrics.indexOf(metric.id);
                if (index >= 0) {
                    renders[index] = hint.render;
                    continue;
                }
                metrics.push(metric.id);
                renders.push(hint.render);
                axes.push(null);
            }
            if (metrics.length < 2)
                problems.push("El combinado solicitado necesita dos métricas distintas disponibles; no se sustituirá por un anillo ni por una sola serie.");
        }
        else if (source) {
            const metricText = text.split(/\bordenad[oa]s?\b/)[0].split(":").pop()!;
            const cartesian = type === "bar" || type === "line" || type === "area" || type === "scatter";
            const parts = cartesian ? metricText.split(/\s+(?:y|e|vs\.?|versus|contra|frente a)\s+/) : [metricText];
            for (const part of parts) {
                const metric = requestMetric(requestWords(part), source);
                if (metric && !metrics.includes(metric.id))
                    metrics.push(metric.id);
            }
            if (!metrics.length) {
                const metric = requestMetric(requestWords(metricText), source);
                if (metric)
                    metrics.push(metric.id);
            }
            if (!cartesian && metrics.length > 1)
                metrics.splice(1);
        }
        let dimension: string | null = null;
        let dateField: string | null = null;
        let breakdown: string | null = null;
        const bucket = hints.bucket[0]?.value ?? null;
        if (source) {
            const explicit = axisTerm ? matchingField(axisTerm, source, ["dimension", "date"]) : null;
            if (explicit?.role === "dimension")
                dimension = explicit.id;
            else if (explicit?.role === "date")
                dateField = explicit.id;
            else if (axisTerm && /\b(?:mes|meses|fecha|periodo|dia|semana|trimestre|ano)\b/.test(axisTerm))
                dateField = source.defaultDateField ?? null;
            else if (axisTerm)
                problems.push(`No se reconoce el eje X «${axisTerm}» en ${source.name}.`);
            if (!dimension && !dateField) {
                const by = [...text.matchAll(/\b(?:por|segun)\s+([^,;.]+)/g)];
                for (const match of by) {
                    const before = text.slice(Math.max(0, match.index! - 32), match.index);
                    if (type !== "combo" && /(?:una linea|una serie|desglosad[oa]|segmentad[oa]|apilad[oa])\s*$/.test(before))
                        continue;
                    const field = matchingField(match[1].split(/\s+(?:y|en|con)\s+/)[0], source);
                    if (field) {
                        dimension = field.id;
                        break;
                    }
                }
                if (!dimension && (bucket || /temporal|evolucion|tendencia|acumulad/.test(text)))
                    dateField = source.defaultDateField ?? source.fields.find((f) => f.role === "date")?.id ?? null;
            }
            const stackBy = text.match(/\bapilad[oa]s?\b[^,;.]*?\bpor\s+([^,;.]+)/)?.[1];
            const bd = hints.breakdown.map((h) => matchingField(h.value.join(" "), source)).find((f) => f && f.id !== dimension)
                ?? (stackBy ? matchingField(stackBy, source) : null);
            breakdown = bd && bd.id !== dimension ? bd.id : null;
            if (type === "rank" && !dimension) {
                const topTerm = text.match(/\btop\s*\d+\s+([^,;.]+)/)?.[1]?.split(/\bpor\b/)[0];
                dimension = topTerm ? matchingField(topTerm, source)?.id ?? null : null;
            }
            if ((type === "heatmap" || type === "table") && !breakdown) {
                const scopeText = text.split(":").pop()!;
                const dims = source.fields.filter((f) => f.role === "dimension" && !/^(?:is_|has_)/.test(f.id) && hintWords(f.label).every((word) => wordHits([word], new Set(requestWords(scopeText))) > 0));
                const mentionedDimension = dimension;
                if (bucket && !axisTerm) {
                    dateField = source.defaultDateField ?? null;
                    dimension = null;
                }
                if (!dimension && !dateField)
                    dimension = dims[0]?.id ?? null;
                breakdown = (mentionedDimension && mentionedDimension !== dimension ? mentionedDimension : null) ?? dims.find((f) => f.id !== dimension)?.id ?? null;
            }
            if (breakdown && !dimension && !dateField)
                dateField = source.defaultDateField ?? null;
            for (const [index, id] of metrics.entries()) {
                const metric = vaiMetric(source, id)!;
                const sideMatches = [...text.matchAll(/([^,;.]+?)\s+(?:en|al|sobre)\s+(?:el\s+)?eje\s+(?:y\s+)?(derecho|secundario|izquierdo|primario)\b/g)];
                for (const match of sideMatches) {
                    const bound = requestMetric(requestWords(match[1].split(/\s+y\s+/).pop()!), source);
                    if (bound?.id === metric.id)
                        axes[index] = /derecho|secundario/.test(match[2]) ? "right" : "left";
                }
            }
        }
        const top = text.match(/\btop\s*(\d+)\b|\b(\d+)\s+(?:primer[oa]s?|mayores|menores)\b/);
        const includeOthers = /\bsin otros\b|\bno\s+(?:incluir|incluyas|agregues)\s+otros\b/.test(text) ? false : /\b(?:incluy\w*|con|agreg\w*)\s+otros\b/.test(text) ? true : null;
        const sort = hints.sort[0]?.value ?? null;
        const sortTerm = text.match(/ordenad[oa]s?\s+por\s+([^,;.]+)/)?.[1];
        const sortMetric = source && sortTerm ? requestMetric(requestWords(sortTerm), source)?.id ?? null : null;
        const bin = text.match(/\b(\d+)\s+(?:intervalos|bins|clases)\b/);
        if (top && Number(top[1] ?? top[2]) > VAI_MAX_LIMIT)
            problems.push(`El Top solicitado supera el máximo de ${VAI_MAX_LIMIT} categorías. No se redujo silenciosamente.`);
        if (bin && (Number(bin[1]) < 3 || Number(bin[1]) > 40))
            problems.push("El histograma admite de 3 a 40 intervalos; no se cambió la cantidad solicitada silenciosamente.");
        requests.push({ text, type, source: source?.id ?? null, metrics, seriesTypes: renders.length ? renders : null,
            seriesAxes: axes.some(Boolean) ? axes : null, dimension, dateField, breakdown, bucket,
            stack: hints.stack[0]?.value ?? null, sort, sortMetric, cumulative: hints.cumulative.length ? true : null,
            limit: top ? Number(top[1] ?? top[2]) : null, includeOthers, bins: bin ? Number(bin[1]) : null, problems });
    }
    return requests;
}
function requestWidgetScore(request: VaiVisualRequest, widget: VaiRawWidget | VaiWidgetSpec) {
    if (widget.type === "kpi" || (widget.type === "table" && request.type !== "table"))
        return -Infinity;
    if (request.source && widget.source !== request.source)
        return -Infinity;
    const metrics = request.metrics.filter((m) => widget.metrics.includes(m)).length;
    return metrics * 8 + (request.dimension && request.dimension === widget.dimension ? 16 : 0)
        + (request.dateField && request.dateField === widget.dateField ? 14 : 0)
        + (request.type === normalizeWidgetType(widget.type) ? 5 : 0)
        + wordHits(requestWords(request.text), new Set(hintWords(widget.title))) * 0.15;
}
function enforceVisualRequests(input: VaiRawWidget[], prompt: string, allowedSourceIds?: string[]): VaiRawWidget[] {
    const widgets = input.map((w) => ({ ...w, metrics: [...w.metrics], seriesTypes: w.seriesTypes ? [...w.seriesTypes] : null }));
    const requests = resolveVisualRequests(prompt, allowedSourceIds, widgets.map((w) => w.source));
    const used = new Set<number>();
    for (const request of requests) {
        if (request.problems.length || !request.source)
            continue;
        const candidates = widgets.map((w, index) => ({ index, score: used.has(index) ? -Infinity : requestWidgetScore(request, w) }))
            .filter((x) => Number.isFinite(x.score)).sort((a, b) => b.score - a.score);
        const index = candidates[0]?.index ?? widgets.length;
        const source = vaiSource(request.source)!;
        const existing = widgets[index];
        const type = request.type ?? (existing && SERIES_TYPES.has(normalizeWidgetType(existing.type) ?? "bar") ? normalizeWidgetType(existing.type)! : "bar");
        let metrics = request.metrics.length ? [...request.metrics] : [...(existing?.metrics ?? [])];
        if (["bar", "line", "area"].includes(type) && request.metrics.length === 1 && !request.breakdown && existing?.metrics.includes(request.metrics[0])) {
            metrics = [...existing.metrics];
        }
        if (type === "combo" && metrics.length < 2 && existing?.metrics.length >= 2)
            metrics = [...existing.metrics];
        if (type === "scatter" && metrics.length < 2 && existing?.metrics.length >= 2)
            metrics = [...existing.metrics];
        const dimension = type === "histogram" ? null : request.dimension ?? (request.dateField ? null : existing?.dimension ?? null);
        const dateField = type === "histogram" ? null : request.dateField ?? (dimension ? null : existing?.dateField ?? null);
        if (!metrics.length || (type !== "histogram" && !dimension && !dateField))
            continue;
        const mixed = type === "combo";
        const seriesTypes = SERIES_TYPES.has(type)
            ? request.seriesTypes ?? (mixed ? metrics.map((_, i) => i === 0 ? "bar" : "line") : metrics.map(() => type === "line" || type === "area" ? "line" : "bar"))
            : null;
        const metricLabels = metrics.map((id) => vaiMetric(source, id)?.label ?? id);
        const axisLabel = dimension ? vaiField(source, dimension)?.label : dateField ? "período" : "registro";
        const title = existing && normalizeWidgetType(existing.type) === type ? existing.title
            : `${VAI_VISUAL_CATALOG.find((c) => c.type === type)?.label ?? type}: ${metricLabels.join(" y ")} por ${axisLabel}`;
        const replacement: VaiRawWidget = {
            ...(existing ?? {}), type, title: title.slice(0, 180), source: source.id, metrics, seriesTypes,
            seriesAxes: request.seriesAxes ?? (mixed && new Set(metrics.map((id) => chartAxisGroup(vaiMetric(source, id)?.format ?? "decimal"))).size === 2
                ? metrics.map((id) => chartAxisGroup(vaiMetric(source, id)?.format ?? "decimal") === chartAxisGroup(vaiMetric(source, metrics[0])?.format ?? "decimal") ? "left" : "right") : null),
            dimension, dateField, bucket: dateField ? request.bucket ?? existing?.bucket ?? "month" : null,
            breakdown: type === "scatter" ? null : request.breakdown ?? existing?.breakdown ?? null,
            stack: type === "bar" ? request.stack ?? existing?.stack ?? null : null,
            sort: request.sort ?? existing?.sort ?? null, sortMetric: request.sortMetric ?? existing?.sortMetric ?? null,
            cumulative: request.cumulative ?? existing?.cumulative ?? null,
            limit: request.limit ?? (request.dimension && ["bar", "combo", "line", "area"].includes(type) ? null : existing?.limit ?? null),
            includeOthers: request.includeOthers ?? (type === "rank" || type === "pareto" ? false : existing?.includeOthers ?? null),
            columns: type === "table" && !request.breakdown ? existing?.columns ?? null : null,
            summaries: existing?.summaries ?? [], bins: request.bins ?? existing?.bins ?? null,
        };
        if (index === widgets.length)
            widgets.push(replacement);
        else
            widgets[index] = replacement;
        used.add(index);
    }
    return [...widgets.filter((_, i) => used.has(i)), ...widgets.filter((_, i) => !used.has(i))];
}
export function visualContractIssues(spec: VaiDashboardSpec | null, prompt: string, allowedSourceIds?: string[]): string[] {
    const issues: string[] = [];
    const rawText = String(prompt).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const forbidden: [
        RegExp,
        VaiWidgetType[]
    ][] = [
        [/\b(?:no\s+(?:(?:quiero|uses|pongas|incluyas|muestres)\s+)?|sin\s+)(?:graficos?\s+de\s+)?(?:tortas?|anillos?|donuts?|pastel(?:es)?)\b/, ["donut"]],
        [/\b(?:no\s+(?:(?:quiero|uses|pongas|incluyas|muestres)\s+)?|sin\s+)(?:graficos?\s+de\s+)?(?:lineas?|curvas?)\b/, ["line", "area", "combo", "pareto"]],
    ];
    for (const [pattern, types] of forbidden)
        if (pattern.test(rawText) && spec?.widgets.some((w) => types.includes(w.type))) {
            issues.push("La definición incluye un tipo de gráfico que el usuario pidió excluir.");
        }
    const requests = resolveVisualRequests(prompt, allowedSourceIds, spec?.sources ?? []);
    for (const request of requests) {
        issues.push(...request.problems);
        if (request.problems.length)
            continue;
        const matching = spec?.widgets.some((w) => {
            if (w.type === "kpi" || (request.type && w.type !== request.type))
                return false;
            if (!request.type && !SERIES_TYPES.has(w.type))
                return false;
            if (request.source && w.source !== request.source)
                return false;
            if (request.dimension && w.dimension !== request.dimension)
                return false;
            if (request.dateField && w.dateField !== request.dateField)
                return false;
            if (request.breakdown && w.breakdown !== request.breakdown)
                return false;
            if (request.stack && w.stack !== request.stack)
                return false;
            if (request.bucket && w.dateField && w.bucket !== request.bucket)
                return false;
            if (request.cumulative && !w.cumulative)
                return false;
            if (request.sort && w.sort !== request.sort)
                return false;
            if (request.limit && w.limit !== Math.min(VAI_MAX_LIMIT, request.limit))
                return false;
            if (request.includeOthers !== null && w.includeOthers !== request.includeOthers)
                return false;
            if (request.sortMetric && w.sortMetric !== request.sortMetric)
                return false;
            if (request.bins != null && w.bins !== request.bins)
                return false;
            return request.metrics.every((id, i) => {
                const index = w.metrics.indexOf(id);
                return index >= 0 && (!request.seriesTypes?.[i] || w.seriesTypes?.[index] === request.seriesTypes[i])
                    && (!request.seriesAxes?.[i] || w.seriesAxes?.[index] === request.seriesAxes[i]);
            });
        });
        if (!matching)
            issues.push(`No se pudo cumplir el gráfico solicitado: «${request.text}». Revisa sus métricas/ejes disponibles; no se mostrará otra visualización como si fuera la pedida.`);
    }
    return [...new Set(issues)];
}
function prepareCostsDashboard(dashboard: NonNullable<VaiModelOutput["dashboard"]>, prompt: string): NonNullable<VaiModelOutput["dashboard"]> {
    if (!dashboard.widgets.some((widget) => widget.source === "finance_costs"))
        return dashboard;
    const text = normalizePromptText(prompt);
    const wantsPen = /\b(pen|soles)\b/.test(text) || /s\s*\//i.test(prompt);
    const wantsUsd = /\b(usd|dolares|dolar)\b/.test(text);
    const currencies: ("usd" | "pen")[] = wantsPen ? (wantsUsd ? ["usd", "pen"] : ["pen"]) : ["usd"];
    const aliases: Record<string, string> = { lima_area: "gerencia_lima", account_code: "account_label", account_desc: "account_label", annex_code: "supplier_label", supplier_name: "supplier_label", cost_center_code: "cost_center_label", cost_center_desc: "cost_center_label" };
    const field = (id: string | null | undefined) => id ? aliases[id] ?? id : null;
    const incoming = dashboard.filters.map((filter) => filter.source === "finance_costs" && filter.kind === "select" && (!filter.values?.length || filter.field === "lima_area") ? { ...filter, field: field(filter.field)! } : filter);
    const explicitPeriods = [...text.matchAll(/\b(real|ppto|presupuesto)\s+(2025|2026)\b/g)].map((match) => `${match[1] === "real" ? "REAL" : "PPTO"} ${match[2]}`);
    const months = requestedCostMonths(prompt, incoming);
    const required = ["period_label", "month_label", "gerencia_lima", "zone_name", "site_name", "cost_group", "account_label", "cost_center_label", "supplier_label", "gloss", "subledger"];
    const filters: VaiRawFilter[] = required.map((id) => {
        const existing = incoming.find((filter) => filter.source === "finance_costs" && filter.kind === "select" && field(filter.field) === id);
        const values = id === "month_label" ? months : id === "period_label" ? existing?.values ?? (explicitPeriods.length ? [...new Set(explicitPeriods)] : null) : existing?.values ?? null;
        return { kind: "select", source: "finance_costs", field: existing?.field ?? id, label: vaiField(VAI_SOURCE_MAP.get("finance_costs")!, id)?.label ?? id, preset: null, from: null, to: null, values };
    });
    for (const filter of incoming) {
        if (filter.source === "finance_costs" && (filter.kind === "date_range" || ["scenario", "fiscal_year"].includes(filter.field)))
            continue;
        if (!filters.some((item) => item.source === filter.source && item.field === filter.field))
            filters.push(filter);
    }
    const make = (type: string, title: string, metrics: string[], extra: Partial<VaiRawWidget> = {}): VaiRawWidget => ({
        type, title, source: "finance_costs", metrics, seriesTypes: null,
        dimension: null, dateField: null, bucket: null, limit: null, columns: null, matrixColumns: null,
        summaries: [], breakdown: null, stack: null, sort: null, sortMetric: null, cumulative: null, ...extra,
    });
    const remapMetric = (id: string) => {
        const currencyId = !wantsPen ? id.replace(/_pen(?=_|$)/g, "_usd") : wantsPen && !wantsUsd ? id.replace(/_usd(?=_|$)/g, "_pen") : id;
        const aliases: Record<string, string> = {
            real_cost_usd: explicitPeriods.includes("REAL 2025") && !explicitPeriods.includes("REAL 2026") ? "cost_real_2025_usd" : "cost_real_2026_usd",
            real_cost_pen: explicitPeriods.includes("REAL 2025") && !explicitPeriods.includes("REAL 2026") ? "cost_real_2025_pen" : "cost_real_2026_pen",
            budget_cost_usd: "cost_ppto_2026_usd",
        };
        return aliases[currencyId] ?? currencyId;
    };
    const costWidgets = dashboard.widgets.filter((widget) => widget.source === "finance_costs").map((widget) => {
        const currency = wantsPen && (!wantsUsd || widget.metrics.some((id) => id.endsWith("_pen"))) ? "pen" : "usd";
        const next: VaiRawWidget = { ...widget, dimension: field(widget.dimension), breakdown: field(widget.breakdown), columns: widget.columns?.map((id) => field(id)!) ?? null, matrixColumns: widget.matrixColumns?.map((id) => field(id)!) ?? null, metrics: widget.metrics.map(remapMetric) };
        if (next.type === "matrix") {
            const matrixColumns = next.matrixColumns?.length ? next.matrixColumns : next.breakdown ? [next.breakdown] : ["period_label"];
            const dateField = next.dateField ?? null;
            return { ...next, metrics: [`cost_total_${currency}`], columns: next.columns?.length ? next.columns : ["account_label", "supplier_label", "gloss"], matrixColumns, dimension: null, dateField, bucket: dateField ? next.bucket ?? "month" : null, breakdown: null, limit: null };
        }
        if (next.type === "table" && next.columns?.length) {
            return { ...next, columns: [...new Set([...COST_DETAIL_COLUMNS.slice(0, 6), `amount_${currency}`, ...next.columns.filter((id) => !["amount_usd", "amount_pen", "real_usd", "real_pen", "budget_usd"].includes(id))])].slice(0, 12), metrics: [], dimension: null, dateField: null, breakdown: null, limit: null };
        }
        if (next.dateField === "posting_date" && next.type !== "kpi" && (!next.bucket || next.bucket === "month")) {
            next.dimension = "month_label";
            next.dateField = null;
            next.bucket = null;
            next.sort = "label_asc";
        }
        if (next.dimension === "period_label") {
            next.metrics = [`cost_total_${currency}`];
            next.seriesTypes = next.type === "line" || next.type === "area" ? ["line"] : ["bar"];
        }
        const isCostAmount = next.metrics.some((id) => /^(?:cost_(?:total|real_\d{4}|ppto_\d{4})_|real_cost_|budget_cost_)/.test(id));
        if (next.type === "combo" && next.dimension && next.dimension !== "period_label" && wantsUsd && wantsPen) {
            const renderFor = (suffix: "usd" | "pen", fallback: "bar" | "line") => {
                const index = next.metrics.findIndex((id) => id.endsWith(`_${suffix}`));
                return index >= 0 ? next.seriesTypes?.[index] ?? fallback : fallback;
            };
            next.metrics = ["cost_total_usd", "cost_total_pen"];
            next.seriesTypes = [renderFor("usd", "bar"), renderFor("pen", "line")];
            next.breakdown = "period_label";
            next.stack = null;
        }
        else if (next.type === "bar" && next.dimension && next.dimension !== "period_label" && isCostAmount) {
            next.metrics = [`cost_total_${currency}`];
            next.breakdown = "period_label";
            next.seriesTypes = ["bar"];
            next.stack = null;
        }
        else if (["bar", "line", "area", "combo", "table"].includes(next.type) && next.metrics.length === 1 && /^cost_total_/.test(next.metrics[0]) && next.dimension !== "period_label")
            next.breakdown = "period_label";
        return next;
    });
    const fixed = currencies.flatMap((currency) => {
        const periods = currency === "usd" ? ["REAL 2026", "PPTO 2026", "REAL 2025"] : ["REAL 2026", "REAL 2025"];
        const kpis = periods.map((period) => make("kpi", `${period} · ${currency.toUpperCase()}`, [`cost_${period.toLowerCase().replace(" ", "_")}_${currency}`]));
        const existing = costWidgets.find((widget) => widget.type === "matrix" && widget.metrics[0] === `cost_total_${currency}`);
        const matrix = existing ?? make("matrix", `Cuenta → proveedor → glosa · ${currency.toUpperCase()}`, [`cost_total_${currency}`], { columns: ["account_label", "supplier_label", "gloss"], matrixColumns: ["period_label"], dateField: "posting_date", bucket: "month" });
        return [...kpis, matrix];
    });
    const extras = costWidgets.filter((widget) => widget.type !== "matrix" && !(widget.type === "kpi" && /^(cost_(real|ppto|total)_|real_cost_|budget_cost_)/.test(widget.metrics[0] ?? "")) && !(["bar", "line", "area", "combo", "rank", "donut"].includes(widget.type) && widget.dimension === "period_label"));
    const otherSources = dashboard.widgets.filter((widget) => widget.source !== "finance_costs");
    return { ...dashboard, filters: filters.slice(0, VAI_MAX_FILTERS), widgets: [...fixed, ...otherSources, ...extras].slice(0, VAI_MAX_WIDGETS) };
}
export function validateWidgetEdit(raw: VaiRawWidget, userPrompt: string, allowedSourceIds?: string[]) {
    const notes: string[] = [];
    const widget = validateWidget(raw, notes);
    if (!widget)
        return { widget: null as VaiWidgetSpec | null, notes, issues: ["No se pudo construir un widget válido con esa instrucción."] };
    if (allowedSourceIds?.length && !allowedSourceIds.includes(widget.source))
        return { widget: null as VaiWidgetSpec | null, notes, issues: ["El gráfico editado intentó usar una fuente fuera del catálogo autorizado para esta edición."] };
    const spec: VaiDashboardSpec = {
        version: VAI_SPEC_VERSION,
        language: "es",
        locale: null,
        title: widget.title,
        description: "",
        sources: [widget.source],
        filters: [],
        widgets: [widget],
    };
    return { widget, notes, issues: visualContractIssues(spec, userPrompt, allowedSourceIds) };
}

export function validateModelOutput(output: VaiModelOutput, userPrompt = "", allowedSourceIds?: string[]): VaiValidation {
    const notes: string[] = output.unavailable.map(concarLabel);
    if (!output.dashboard)
        return { spec: null, notes, issues: visualContractIssues(null, userPrompt, allowedSourceIds) };
    output.dashboard = prepareCostsDashboard(output.dashboard, userPrompt);
    const promptText = normalizedContextText(userPrompt);
    const asksFuelConsumption = /\b(combustible|combustibles|galon|galones|abastecimiento|abastecimientos|tanqueo|tanqueos|grifo|grifos|diesel|gasolina|costo pen|costo usd)\b/.test(promptText);
    const asksFleetPerformance = /\b(rendimiento|eficiencia|recorrido|recorridos|gps|kilometro|kilometros|km gal|l 100|autonomia|costo por km)\b/.test(promptText);
    const preferFuelRefuels = asksFuelConsumption && !asksFleetPerformance;
    const asksMineralPaymentByLot = /\b(?:lote|lotes)\b/.test(promptText) &&
        /\b(?:pago|pagos|pagado|pagados|desembolso|desembolsos)\b/.test(promptText);
    if (asksMineralPaymentByLot) {
        notes.push("Por lote, pay_date solo identifica que el lote figura pagado en CONCAR y lot_usd sigue siendo el monto facturado/valorizado. El pago efectivo en USD sale únicamente de conta_payments y no se atribuye a lotes.");
    }
    const prepared = enforceVisualRequests(output.dashboard.widgets, userPrompt, allowedSourceIds);
    const validated: VaiWidgetSpec[] = [];
    for (const rawWidget of prepared.slice(0, VAI_MAX_WIDGETS)) {
        const raw = preferFuelRefuels && rawWidget.source === "fleet_performance"
            ? {
                ...rawWidget,
                source: "fleet_fuel_refuels",
                dateField: rawWidget.dateField === "cal_date" ? "date_cons" : rawWidget.dateField,
            }
            : rawWidget;
        const widget = validateWidget(raw, notes);
        if (widget)
            validated.push(widget);
    }
    if (output.dashboard.widgets.length > VAI_MAX_WIDGETS)
        notes.push(`Se limitó el dashboard a ${VAI_MAX_WIDGETS} widgets.`);
    const widgets = validated;
    const usesMineralPurchaseTms = widgets.some((widget) => widget.source === "finance_mineral_purchases" &&
        (widget.metrics.some((id) => [
            "lot_usd_purchase_docs",
            "tms_conta_total",
            "tms_conta_purchase_docs",
            "usd_per_tms_conta",
        ].includes(id)) ||
            Boolean(widget.columns?.includes("tms_conta"))));
    if (usesMineralPurchaseTms) {
        notes.push("Las TMS de los lotes facturados/pagados usan la misma lógica de dw.v_traceability_get: TMS web y, si falta, TMS de CONCAR; no provienen de conta_get.");
    }
    const sources: string[] = [];
    for (const widget of widgets)
        if (!sources.includes(widget.source))
            sources.push(widget.source);
    if (sources.length > VAI_MAX_SOURCES) {
        const dropped = sources.splice(VAI_MAX_SOURCES);
        notes.push(`Se limitó el dashboard a ${VAI_MAX_SOURCES} fuentes; se omitió ${dropped.map((id) => VAI_SOURCE_MAP.get(id)?.name ?? id).join(", ")}.`);
    }
    const kept = widgets.filter((widget) => sources.includes(widget.source));
    if (!kept.length)
        return { spec: null, notes, issues: visualContractIssues(null, userPrompt, allowedSourceIds) };
    const sourceSet = new Set(sources);
    const filters: VaiFilterSpec[] = [];
    for (const raw of output.dashboard.filters.slice(0, VAI_MAX_FILTERS)) {
        const filter = validateFilter(raw, sourceSet, notes, userPrompt);
        if (filter && !filters.some((item) => item.kind === filter.kind && item.source === filter.source && item.field === filter.field)) {
            filters.push(filter);
        }
    }
    if (!requestsAllHistory(userPrompt)) {
        const month = requestedMonth(userPrompt);
        const preset = requestedPresetFromPrompt(userPrompt);
        for (const sourceId of sources) {
            if (filters.length >= VAI_MAX_FILTERS)
                break;
            const source = VAI_SOURCE_MAP.get(sourceId);
            const selected = source ? dateFieldForPrompt(source, userPrompt) : null;
            const field = selected?.field;
            if (!source || source.id === "finance_costs" || (source.temporalMode === "snapshot" && !selected?.explicit) || !field || field.role !== "date")
                continue;
            if (filters.some((filter) => filter.kind === "date_range" && filter.source === sourceId))
                continue;
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
    for (const sourceId of sources) {
        if (filters.length >= VAI_MAX_FILTERS)
            break;
        const source = VAI_SOURCE_MAP.get(sourceId);
        if (!source)
            continue;
        for (const filter of contextualSelectFilters(source, userPrompt, sources.length > 1 ? 2 : 4)) {
            if (filters.length >= VAI_MAX_FILTERS)
                break;
            if (filters.some((item) => item.kind === "select" &&
                item.source === filter.source &&
                item.field === filter.field)) {
                continue;
            }
            filters.push(filter);
        }
    }
    if (sourceSet.has("finance_mineral_purchases")) {
        for (const id of ["entry_date", "pay_date", "valuation_date"]) {
            if (filters.some((filter) => filter.source === "finance_mineral_purchases" && filter.field === id))
                continue;
            const field = vaiField(VAI_SOURCE_MAP.get("finance_mineral_purchases")!, id)!;
            if (filters.length >= VAI_MAX_FILTERS) {
                const index = filters.findIndex((filter) => filter.kind === "select");
                if (index >= 0)
                    filters.splice(index, 1);
            }
            filters.push({ kind: "date_range", source: "finance_mineral_purchases", field: id, label: field.label, preset: null, from: null, to: null, mode: /\b(periodos?|mensual|mensuales|meses|por mes)\b/.test(promptText) ? "period" : "range" });
        }
    }
    if (sourceSet.has("finance_mineral_payments") && !filters.some((filter) => filter.source === "finance_mineral_payments" && filter.field === "payment_date")) {
        filters.push({ kind: "date_range", source: "finance_mineral_payments", field: "payment_date", label: "Fecha de pago", preset: null, from: null, to: null });
    }
    if (/\b(periodos?|mensual|mensuales|meses|por mes)\b/.test(promptText)) {
        for (const filter of filters)
            if (filter.kind === "date_range")
                filter.mode = "period";
        for (const widget of kept)
            if (widget.dateField && !widget.bucket)
                widget.bucket = "month";
    }
    const spec: VaiDashboardSpec = {
        version: VAI_SPEC_VERSION,
        language: "es",
        locale: null,
        title: concarLabel(output.dashboard.title || "Dashboard V-Ai"),
        description: concarLabel(output.dashboard.description),
        sources, filters, widgets: kept,
    };
    const issues = visualContractIssues(spec, userPrompt, allowedSourceIds);
    return { spec, notes: [...new Set(notes)], issues };
}
function localeRecord(value: unknown, max: number) {
    if (!isRecord(value))
        return {};
    return Object.fromEntries(Object.entries(value)
        .map(([key, item]) => [clean(key, 160), clean(item, max)] as const)
        .filter(([key, item]) => key && item));
}
function coerceVaiLocale(value: unknown): VaiLocalePack | null {
    if (!isRecord(value))
        return null;
    return {
        sourceLabels: localeRecord(value.sourceLabels, 160),
        sourceDescriptions: localeRecord(value.sourceDescriptions, 1200),
        sourceGrains: localeRecord(value.sourceGrains, 300),
        fieldLabels: localeRecord(value.fieldLabels, 160),
        fieldDescriptions: localeRecord(value.fieldDescriptions, 1200),
        metricLabels: localeRecord(value.metricLabels, 160),
        metricDescriptions: localeRecord(value.metricDescriptions, 1200),
    };
}
export function parseStoredSpec(raw: unknown, userPrompt = ""): VaiValidation {
    if (!isRecord(raw))
        return { spec: null, notes: ["La configuración guardada no es válida."] };
    const dashboard = coerceModelOutput({ dashboard: raw })?.dashboard ?? null;
    if (!dashboard)
        return { spec: null, notes: ["La configuración guardada no contiene un dashboard válido."] };
    const notes: string[] = [];
    const widgets = dashboard.widgets
        .slice(0, VAI_MAX_WIDGETS)
        .map((widget) => validateWidget(widget, notes))
        .filter((widget): widget is VaiWidgetSpec => Boolean(widget));
    if (!widgets.length)
        return { spec: null, notes: [...new Set([...notes, "La configuración guardada no contiene widgets válidos."])] };
    const sources = [...new Set(widgets.map((widget) => widget.source))].slice(0, VAI_MAX_SOURCES);
    const sourceSet = new Set(sources);
    const filters: VaiFilterSpec[] = [];
    for (const rawFilter of dashboard.filters.slice(0, VAI_MAX_FILTERS)) {
        const filter = validateFilter(rawFilter, sourceSet, notes, "");
        if (filter && !filters.some((item) => item.kind === filter.kind && item.source === filter.source && item.field === filter.field))
            filters.push(filter);
    }
    const language = VAI_LANGUAGES.includes(raw.language as VaiLanguage) ? raw.language as VaiLanguage : detectVaiLanguage(userPrompt);
    return {
        spec: {
            version: VAI_SPEC_VERSION,
            language,
            locale: language === "es" ? null : coerceVaiLocale(raw.locale),
            title: concarLabel(dashboard.title || "Dashboard V-Ai"),
            description: concarLabel(dashboard.description),
            sources,
            filters,
            widgets: widgets.filter((widget) => sourceSet.has(widget.source)),
        },
        notes: [...new Set(notes)],
        issues: [],
    };
}
export function localizeVaiSource(source: VaiSource, spec: Pick<VaiDashboardSpec, "language" | "locale">): VaiSource {
    const locale = spec.locale;
    if (!locale)
        return source;
    return {
        ...source,
        name: locale.sourceLabels[source.id] ?? source.name,
        description: locale.sourceDescriptions[source.id] ?? source.description,
        grain: locale.sourceGrains[source.id] ?? source.grain,
        fields: source.fields.map((field) => ({
            ...field,
            label: locale.fieldLabels[`${source.id}:${field.id}`] ?? field.label,
            description: locale.fieldDescriptions[`${source.id}:${field.id}`] ?? field.description,
        })),
        metrics: source.metrics.map((metric) => ({
            ...metric,
            label: locale.metricLabels[`${source.id}:${metric.id}`] ?? metric.label,
            description: locale.metricDescriptions[`${source.id}:${metric.id}`] ?? metric.description,
        })),
    };
}
export function specSources(spec: VaiDashboardSpec): VaiSource[] {
    return spec.sources.map((id) => VAI_SOURCE_MAP.get(id)).filter((source): source is VaiSource => Boolean(source));
}
export type VaiRow = Record<string, unknown>;
export type VaiFilterValue = {
    from?: string;
    to?: string;
    value?: string;
    values?: string[];
    periods?: string[];
    mode?: "range" | "period";
};
export type VaiFilterState = Record<string, VaiFilterValue>;
export const filterKey = (filter: Pick<VaiFilterSpec, "source" | "field">) => `${filter.source}:${filter.field}`;
export async function loadVaiSourceRows(
    source: VaiSource,
    path: string,
    options: {
        signal?: AbortSignal;
        fresh?: boolean;
        onProgress?: (message: string) => void;
    } = {},
): Promise<VaiRow[]> {
    const { signal, onProgress } = options;

    const check = () => {
        if (signal?.aborted) {
            throw new DOMException(
                "Carga cancelada",
                "AbortError"
            );
        }
    };

    function wait<T>(
        task: Promise<T>,
        milliseconds = 45_000,
    ): Promise<T> {
        check();

        return new Promise<T>((resolve, reject) => {
            const cleanup = () => {
                clearTimeout(timer);
                signal?.removeEventListener(
                    "abort",
                    abort
                );
            };

            const abort = () => {
                cleanup();

                reject(
                    new DOMException(
                        "Carga cancelada",
                        "AbortError"
                    )
                );
            };

            const timer = setTimeout(() => {
                cleanup();

                reject(
                    new Error(
                        "La petición de datos no respondió. Revisa la conexión con la API."
                    )
                );
            }, milliseconds);

            signal?.addEventListener(
                "abort",
                abort,
                { once: true }
            );

            task.then(
                (value) => {
                    cleanup();
                    resolve(value);
                },
                (error) => {
                    cleanup();
                    reject(error);
                },
            );
        });
    }

    const pause = (ms: number) =>
        wait(
            new Promise<void>((resolve) =>
                setTimeout(resolve, ms)
            )
        );

    async function get(url: string) {
        for (let attempt = 0; ; attempt += 1) {
            check();

            try {
                const result = await wait(
                    apiGet(url)
                );

                check();

                if (result?.ok === false) {
                    throw new Error(
                        result.error ||
                        "Error al consultar la fuente"
                    );
                }

                return result;
            } catch (error) {
                check();

                const status = Number(
                    (
                        error as {
                            status?: number;
                        }
                    )?.status
                );

                if (
                    attempt >= 1 ||
                    [400, 401, 403, 404, 410]
                        .includes(status)
                ) {
                    throw error;
                }

                await pause(1000);
            }
        }
    }

    // Las demás fuentes conservan su contrato actual.
    if (source.id !== "finance_costs") {
        const result = await apiGet(path);

        check();

        if (result?.ok === false) {
            throw new Error(
                result.error ||
                "Error al consultar la fuente"
            );
        }

        if (!Array.isArray(result?.rows)) {
            throw new Error(
                "La fuente no devolvió un dataset válido"
            );
        }

        return validateSourceRows(
            source,
            result.rows as VaiRow[]
        );
    }

    const join = (
        base: string,
        values: Record<string, string>,
    ) => {
        const [
            pathname,
            query = "",
        ] = base.split("?");

        const params = new URLSearchParams(
            query
        );

        for (
            const [key, value] of
            Object.entries(values)
        ) {
            params.set(key, value);
        }

        return `${pathname}?${params.toString()}`;
    };

    const started = Date.now();

    onProgress?.("Preparando costos…");

    const initialPath = join(path, {
        transport: "pages-v1",
        ...(options.fresh
            ? { fresh: "1" }
            : {}),
    });

    let manifest = await get(
        initialPath
    );

    while (manifest.status === "busy") {
        if (
            Date.now() - started >
            210_000
        ) {
            throw new Error(
                "El servicio de costos está ocupado. Reintenta la carga."
            );
        }

        onProgress?.(
            "Esperando un turno de consulta de costos…"
        );

        await pause(3000);

        manifest = await get(
            initialPath
        );
    }

    const snapshot = manifest?.snapshot;

    if (
        manifest?.format !== "costs-rows-v1" ||
        typeof snapshot !== "string"
    ) {
        throw new Error(
            "Actualiza el endpoint de costos en server.js y reinicia la API."
        );
    }

    const base = join(source.endpoint, {
        transport: "pages-v1",
        snapshot,
    });

    while (manifest.status === "loading") {
        if (
            Date.now() - started >
            210_000
        ) {
            throw new Error(
                "Costos sigue en preparación. Revisa tiempos y bloqueos en SQL Server."
            );
        }

        onProgress?.(
            `Preparando costos: ${
                Number(
                    manifest.rows_read || 0
                ).toLocaleString("es-PE")
            } filas leídas…`
        );

        await pause(1000);

        manifest = await get(base);

        if (
            manifest.snapshot !== snapshot ||
            manifest.format !== "costs-rows-v1"
        ) {
            throw new Error(
                "Cambió la consulta durante la carga. Actualiza los datos."
            );
        }
    }

    const total = manifest.total;
    const pages = manifest.pages;
    const columns: unknown =
        manifest.columns;

    const known = new Set(
        source.fields.map(
            (field) => field.id
        )
    );

    if (
        manifest.status !== "ready" ||
        !Number.isSafeInteger(total) ||
        total < 0 ||
        !Number.isSafeInteger(pages) ||
        pages < 0 ||
        (
            total === 0
                ? pages !== 0
                : pages < 1 ||
                  pages > total
        ) ||
        !Array.isArray(columns) ||
        columns.length !== known.size ||
        !columns.length ||
        columns.some(
            (field) =>
                typeof field !== "string" ||
                !known.has(field)
        ) ||
        new Set(columns).size !==
            columns.length
    ) {
        throw new Error(
            "El manifiesto de costos no es válido; no se calcularon totales."
        );
    }

    const fields = columns as string[];
    const rows: VaiRow[] = [];
    const downloadStarted = Date.now();

    // Máximo dos páginas simultáneas.
    for (
        let first = 0;
        first < pages;
        first += 2
    ) {
        check();

        const indices =
            first + 1 < pages
                ? [first, first + 1]
                : [first];

        const batch = await Promise.all(
            indices.map((page) =>
                get(
                    join(base, {
                        page: String(page),
                    })
                )
            )
        );

        for (
            let index = 0;
            index < batch.length;
            index += 1
        ) {
            const part = batch[index];

            if (
                part.format !==
                    "costs-rows-v1" ||
                part.snapshot !==
                    snapshot ||
                part.page !==
                    indices[index] ||
                !Array.isArray(part.data) ||
                part.count !==
                    part.data.length
            ) {
                throw new Error(
                    "Página de costos incompleta o de otra consulta. Actualiza los datos."
                );
            }

            for (const tuple of part.data) {
                if (
                    !Array.isArray(tuple) ||
                    tuple.length !==
                        fields.length
                ) {
                    throw new Error(
                        "Una fila de costos no cumple el contrato."
                    );
                }

                const row: VaiRow = {};

                for (
                    let column = 0;
                    column < fields.length;
                    column += 1
                ) {
                    row[fields[column]] =
                        tuple[column];
                }

                rows.push(row);
            }
        }

        if (rows.length > total) {
            throw new Error(
                "La descarga contiene más filas de las declaradas."
            );
        }

        onProgress?.(
            `Descargando costos: ${
                rows.length.toLocaleString("es-PE")
            } de ${
                total.toLocaleString("es-PE")
            } filas…`
        );

        // Ceder el hilo entre lotes.
        // No publicar totales parciales.
        await pause(0);
    }

    check();

    if (rows.length !== total) {
        throw new Error(
            "Faltan filas de costos. No se mostraron totales parciales."
        );
    }

    console.info("[V-Ai costos]", {
        snapshot,
        rows: total,
        pages,
        prepare_ms: manifest.prepare_ms,
        gzip_bytes: manifest.gzip_bytes,
        download_ms:
            Date.now() - downloadStarted,
    });

    return validateSourceRows(
        source,
        rows
    );
}
export function sourceRequestPath(source: VaiSource, filters: VaiFilterSpec[], state: VaiFilterState) {
    if (source.id === "finance_costs") {
        const filter = filters.find((item) => item.source === source.id && item.kind === "select" && item.field === "month_label");
        if (filter?.kind === "select") {
            const value = state[filterKey(filter)];
            const selected = value !== undefined ? value.values : filter.values;
            if (selected != null) {
                const months = [...new Set(selected.filter((item) => COST_MONTH_OPTIONS.includes(item)).map((item) => Number(item.slice(0, 2))))].sort((a, b) => a - b);
                const params = new URLSearchParams({ months: months.length ? months.join(",") : "none" });
                return `${source.endpoint}?${params.toString()}`;
            }
        }
        return source.endpoint;
    }
    for (const filter of filters) {
        if (filter.kind !== "date_range" || filter.source !== source.id || !source.query?.dateFields.includes(filter.field))
            continue;
        const value: VaiFilterValue = state[filterKey(filter)] ?? (filter.from || filter.to ? { from: filter.from ?? "", to: filter.to ?? "" } : filter.preset ? presetRange(filter.preset) : {});
        const bounds = value.periods !== undefined ? monthBounds(value.periods) : value;
        if (!bounds || (!bounds.from && !bounds.to))
            continue;
        const params = new URLSearchParams();
        if (bounds.from)
            params.set("from", bounds.from);
        if (bounds.to)
            params.set("to", bounds.to);
        params.set("date_field", filter.field);
        return `${source.endpoint}${source.endpoint.includes("?") ? "&" : "?"}${params.toString()}`;
    }
    return source.endpoint;
}
export function defaultFilterValues(filters: VaiFilterSpec[], _sources: ReadonlyMap<string, VaiSource>, _data: Record<string, VaiRow[]>): VaiFilterState {
    const defaults: VaiFilterState = {};
    for (const filter of filters) {
        if (filter.kind === "select") {
            if (filter.values != null)
                defaults[filterKey(filter)] = { values: [...filter.values] };
            continue;
        }
        const range = filter.from || filter.to ? { from: filter.from ?? "", to: filter.to ?? "" } : filter.preset ? presetRange(filter.preset) : { from: "", to: "" };
        defaults[filterKey(filter)] = { ...range, mode: filter.mode ?? "range" };
    }
    return defaults;
}
export function toNumber(value: unknown): number | null {
    if (value == null || value === "")
        return null;
    const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
}
export function toText(value: unknown) {
    if (value == null)
        return "";
    if (value instanceof Date)
        return value.toISOString();
    return String(value).trim();
}
export function toIsoDate(value: unknown) {
    const text = toText(value);
    const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match)
        return match[1];
    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : "";
}
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function num(value: number, digits: number) {
    return value.toLocaleString("es-PE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
export function formatDateLabel(iso: string, bucket: VaiBucket | "none" = "none") {
    if (/^\d{4}-Q[1-4]$/.test(iso))
        return `T${iso.slice(6)} ${iso.slice(0, 4)}`;
    if (/^\d{4}$/.test(iso))
        return iso;
    if (!/^\d{4}-\d{2}/.test(iso))
        return iso || "—";
    const [y, mo, d] = iso.split("-");
    if (bucket === "month" || !d)
        return `${y.slice(-2)}_${(MONTHS[Number(mo) - 1] ?? mo).toUpperCase()}`;
    if (bucket === "week")
        return `sem ${d}/${mo}/${y.slice(2)}`;
    return `${d}/${mo}/${y.slice(2)}`;
}
export function periodKey(iso: string, bucket: VaiBucket) {
    if (bucket === "quarter")
        return /^\d{4}-\d{2}/.test(iso) ? `${iso.slice(0, 4)}-Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}` : "Sin fecha";
    if (bucket === "year")
        return /^\d{4}/.test(iso) ? iso.slice(0, 4) : "Sin fecha";
    return kardexPeriodKey(iso, bucket);
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
    if (n == null)
        return "—";
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
        case "months":
            return `${num(n, 1)} meses`;
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
        case "usd_per_km":
            return `USD ${num(n, 2)}/km`;
        case "pen_per_gal":
            return `S/ ${num(n, 2)}/gal`;
        case "usd_per_gal":
            return `USD ${num(n, 2)}/gal`;
        case "grade_oztc":
            return `${num(n, 3)} oz/TC`;
        case "grade_gt":
            return `${num(n, 2)} g/t`;
        case "g":
            return `${num(n, 0)} g`;
        case "m3":
            return `${num(n, 2)} m³`;
        case "g_m3":
            return `${num(n, 2)} g/m³`;
        case "kg_per_tms":
            return `${num(n, 2)} kg/TMS`;
        default:
            return num(n, 2);
    }
}
export function chartFormat(format: VaiFormat): {
    digits: number;
    unit: string;
    scale: number;
} {
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
        case "usd_per_km":
            return { digits: 2, unit: " USD/km", scale: 1 };
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
        case "months":
            return { digits: 1, unit: " meses", scale: 1 };
        case "grade_oztc":
            return { digits: 3, unit: " oz/TC", scale: 1 };
        case "grade_gt":
            return { digits: 2, unit: " g/t", scale: 1 };
        case "g":
            return { digits: 0, unit: " g", scale: 1 };
        case "m3":
            return { digits: 1, unit: " m³", scale: 1 };
        case "g_m3":
            return { digits: 2, unit: " g/m³", scale: 1 };
        case "kg_per_tms":
            return { digits: 2, unit: " kg/TMS", scale: 1 };
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
        case "months":
            return "months";
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
        case "usd_per_km":
            return "usd_per_km";
        case "pen_per_gal":
            return "pen_per_gal";
        case "usd_per_gal":
            return "usd_per_gal";
        case "grade_oztc":
            return "grade_oztc";
        case "grade_gt":
            return "grade_gt";
        case "g":
            return "g";
        case "m3":
            return "m3";
        case "g_m3":
            return "g_m3";
        case "kg_per_tms":
            return "kg_per_tms";
        case "integer":
        case "decimal":
            return "number";
        default:
            return format;
    }
}
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
            if (n == null || target == null)
                return false;
            return condition.op === "gt" ? n > target : condition.op === "gte" ? n >= target : condition.op === "lt" ? n < target : n <= target;
        }
        default:
            return true;
    }
}
function passes(row: VaiRow, conditions: VaiCondition[] | undefined) {
    return !conditions || conditions.every((condition) => matches(row, condition));
}
export function applyFilters(source: VaiSource, rows: VaiRow[], filters: VaiFilterSpec[], state: VaiFilterState) {
    const active = filters
        .filter((filter) => filter.source === source.id)
        .map((filter) => ({ filter, value: state[filterKey(filter)] }))
        .filter(({ value }) => value &&
        (value.from ||
            value.to ||
            value.value ||
            value.values !== undefined ||
            value.periods !== undefined));
    if (!active.length && !source.exclusions?.length)
        return rows;
    const periodSets = new Map(active.filter(({ value }) => value.periods !== undefined).map(({ filter, value }) => [filterKey(filter), new Set(value.periods)]));
    return rows.filter((row) => {
        if (!passes(row, source.exclusions))
            return false;
        for (const { filter, value } of active) {
            if (filter.kind === "date_range") {
                const iso = toIsoDate(row[filter.field]);
                if (!iso)
                    return false;
                const periods = periodSets.get(filterKey(filter));
                if (periods && !periods.has(iso.slice(0, 7)))
                    return false;
                if (value.from && iso < value.from)
                    return false;
                if (value.to && iso > value.to)
                    return false;
                continue;
            }
            const selected = value.values ??
                (value.value
                    ? [value.value]
                    : null);
            const rowValue = toText(row[filter.field]);
            if (selected &&
                !selected.some((option) => option === "Sin dato" ? !rowValue : option === rowValue)) {
                return false;
            }
        }
        return true;
    });
}
export function distinctValues(rows: VaiRow[], field: string, max = 200) {
    const values = new Set<string>();
    let hasBlank = false;
    for (const row of rows) {
        const text = toText(row[field]);
        if (text)
            values.add(text);
        else
            hasBlank = true;
        if (values.size > max)
            break;
    }
    const sorted = [...values].sort((a, b) => a.localeCompare(b, "es"));
    return hasBlank ? ["Sin dato", ...sorted] : sorted;
}
function hoursBetween(a: unknown, b: unknown) {
    const start = Date.parse(toText(a));
    const end = Date.parse(toText(b));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
        return null;
    return (end - start) / 3600000;
}
function metricSubset(metric: VaiMetric, rows: VaiRow[]) {
    return rows.filter((row) => passes(row, metric.where) &&
        (!metric.whereAny?.length || metric.whereAny.some((condition) => matches(row, condition))));
}
export function aggregate(metric: VaiMetric, rows: VaiRow[]): number | null {
    const subset = metricSubset(metric, rows);
    if (["variance_usd", "variance_pct", "budget_execution_pct"].includes(metric.id) &&
        (!subset.some((row) => row.period_label === "REAL 2026") || !subset.some((row) => row.period_label === "PPTO 2026")))
        return null;
    if (metric.agg === "sum" && /^cost_(total_(usd|pen)|real_\d{4}_(usd|pen)|ppto_\d{4}_(usd|pen))(?::|$)/.test(metric.id)) {
        const values = subset.map((row) => toNumber(row[metric.field ?? ""])).filter((value): value is number => value !== null);
        return values.length ? values.reduce((sum, value) => sum + Math.round(value * 100), 0) / 100 : null;
    }
    const values = (field: string | undefined) => field ? subset.map((row) => toNumber(row[field])).filter((v): v is number => v != null) : [];
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
                if (key && value != null && !unique.has(key))
                    unique.set(key, value);
            }
            return [...unique.values()].reduce((sum, value) => sum + value, 0);
        }
        case "sum_per_distinct": {
            const keys = new Set(subset.map((row) => toText(row[metric.distinctField ?? ""])).filter(Boolean));
            if (!keys.size)
                return null;
            return values(metric.field).reduce((sum, value) => sum + value, 0) / keys.size;
        }
        case "count_per_distinct": {
            const keys = new Set(subset.map((row) => toText(row[metric.distinctField ?? ""])).filter(Boolean));
            return keys.size ? subset.length / keys.size : null;
        }
        case "sum_diff":
            return (values(metric.field).reduce((sum, value) => sum + value, 0) -
                values(metric.field2).reduce((sum, value) => sum + value, 0));
        case "avg": {
            const list = values(metric.field);
            return list.length ? list.reduce((sum, v) => sum + v, 0) / list.length : null;
        }
        case "min": {
            const list = values(metric.field);
            return list.length
    ? list.reduce(
        (a, b) => Math.min(a, b),
        Infinity
    )
    : null;
        }
        case "max": {
            const list = values(metric.field);
            return list.length
    ? list.reduce(
        (a, b) => Math.max(a, b),
        -Infinity
    )
    : null;
        }
        case "ratio":
        case "diff_pct":
        case "pct_change": {
            let numerator = 0;
            let denominator = 0;
            const distinctDenominator = metric.agg === "ratio" && metric.distinctField ? new Map<string, number>() : null;
            for (const row of subset) {
                const a = toNumber(row[metric.numerator ?? ""]);
                const b = toNumber(row[metric.denominator ?? ""]);
                if (a == null || b == null)
                    continue;
                numerator += a;
                if (distinctDenominator) {
                    const key = toText(row[metric.distinctField ?? ""]);
                    if (key && !distinctDenominator.has(key))
                        distinctDenominator.set(key, b);
                }
                else
                    denominator += b;
            }
            if (distinctDenominator)
                denominator = [...distinctDenominator.values()].reduce((sum, value) => sum + value, 0);
            if (metric.agg === "ratio")
                return denominator ? (numerator / denominator) * (metric.multiplier ?? 1) : null;
            if (metric.agg === "pct_change")
                return denominator ? ((numerator - denominator) / denominator) * 100 : null;
            return numerator ? ((numerator - denominator) / numerator) * 100 : null;
        }
        case "weighted_avg": {
            let total = 0;
            let weight = 0;
            for (const row of subset) {
                const v = toNumber(row[metric.field ?? ""]);
                const w = toNumber(row[metric.weight ?? ""]);
                if (v == null || w == null || w <= 0)
                    continue;
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
export type VaiNote = [
    label: string,
    value: string,
    series?: number
];
export type VaiTrend = {
    label: string;
    values: (number | null)[];
    from: string;
    to: string;
};
const ADDITIVE_AGGS: ReadonlySet<VaiAgg> = new Set(["sum", "count"]);
const RATE_AGGS: ReadonlySet<VaiAgg> = new Set(["avg", "weighted_avg", "ratio", "diff_pct", "pct_change", "avg_hours_diff", "avg_days_diff", "sum_per_distinct", "count_per_distinct"]);
const NUMERIC_FIELD_AGGS: ReadonlySet<VaiAgg> = new Set(["sum", "avg", "min", "max", "sum_distinct", "sum_per_distinct", "weighted_avg"]);
const fieldLabel = (source: VaiSource, id?: string) => (id ? vaiField(source, id)?.label ?? id : "");
const fieldFormat = (source: VaiSource, id?: string): VaiFormat => (id ? vaiField(source, id)?.format ?? "decimal" : "decimal");
const sumOf = (list: number[]) => list.reduce((sum, v) => sum + v, 0);
const minOf = (list: number[]) => list.reduce((min, v) => (v < min ? v : min), Infinity);
const maxOf = (list: number[]) => list.reduce((max, v) => (v > max ? v : max), -Infinity);
const numbers = (rows: VaiRow[], field?: string) => (field ? rows.map((row) => toNumber(row[field])).filter((v): v is number => v != null) : []);
const distinctCount = (rows: VaiRow[], field?: string) => new Set(rows.map((row) => toText(row[field ?? ""])).filter(Boolean)).size;
const median = (list: number[]) => {
    const sorted = [...list].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const ofRows = (part: number, total: number) => (part === total ? num(part, 0) : `${num(part, 0)} de ${num(total, 0)}`);
const signedPct = (value: number) => `${value < 0 ? "−" : "+"}${num(Math.abs(value), 1)} %`;
const relative = (value: number | null, reference: number | null) => value == null || reference == null || reference === 0 ? null : ((value - reference) / Math.abs(reference)) * 100;
function signedDelta(diff: number, format: VaiFormat) {
    const sign = diff < 0 ? "−" : "+";
    if (format === "percent" || format === "fraction")
        return `${sign}${num(Math.abs(diff) * (format === "fraction" ? 100 : 1), 2)} pp`;
    return `${sign}${formatValue(Math.abs(diff), format)}`;
}
export function kpiInsights(metric: VaiMetric, source: VaiSource, rows: VaiRow[]): VaiNote[] {
    const subset = metricSubset(metric, rows);
    const notes: VaiNote[] = [];
    const fmt = (v: number | null) => formatValue(v, metric.format);
    const fmtField = (v: number | null, field?: string) => formatValue(v, fieldFormat(source, field));
    const list = numbers(subset, metric.field);
    const considered: VaiNote[] = subset.length === rows.length ? [] : [["Filas consideradas", ofRows(subset.length, rows.length)]];
    const distinctNote = (field?: string): VaiNote => [`Valores distintos · ${fieldLabel(source, field)}`, num(distinctCount(subset, field), 0)];
    switch (metric.agg) {
        case "count":
            notes.push(...considered);
            if (subset.length !== rows.length && rows.length)
                notes.push(["Participación en filas", `${num((subset.length / rows.length) * 100, 1)} %`]);
            break;
        case "count_distinct": {
            const keys = distinctCount(subset, metric.field);
            notes.push(...considered);
            if (keys)
                notes.push([`Filas por ${fieldLabel(source, metric.field).toLowerCase()}`, num(subset.length / keys, 1)]);
            break;
        }
        case "sum":
            if (list.length)
                notes.push(["Promedio por fila", fmt(sumOf(list) / list.length)], ["Máximo", fmt(maxOf(list))], ["Mínimo", fmt(minOf(list))]);
            notes.push(...considered);
            break;
        case "avg":
            if (list.length)
                notes.push(["Mediana", fmt(median(list))], ["Máximo", fmt(maxOf(list))], ["Mínimo", fmt(minOf(list))]);
            notes.push(...considered);
            break;
        case "min":
        case "max":
            if (list.length)
                notes.push([metric.agg === "min" ? "Máximo" : "Mínimo", fmt(metric.agg === "min" ? maxOf(list) : minOf(list))], ["Promedio", fmt(sumOf(list) / list.length)]);
            notes.push(...considered);
            break;
        case "sum_distinct":
            notes.push(distinctNote(metric.distinctField), ...considered);
            break;
        case "sum_per_distinct":
            notes.push([`Σ ${fieldLabel(source, metric.field)}`, fmt(sumOf(list))], distinctNote(metric.distinctField), ...considered);
            break;
        case "count_per_distinct":
            notes.push(["Filas consideradas", ofRows(subset.length, rows.length)], distinctNote(metric.distinctField));
            break;
        case "sum_diff":
            notes.push([`Σ ${fieldLabel(source, metric.field)}`, fmt(sumOf(list))], [`Σ ${fieldLabel(source, metric.field2)}`, fmt(sumOf(numbers(subset, metric.field2)))], ...considered);
            break;
        case "ratio":
        case "diff_pct":
        case "pct_change": {
            let numerator = 0;
            let denominator = 0;
            let pairs = 0;
            const distinct = metric.agg === "ratio" && metric.distinctField ? new Map<string, number>() : null;
            for (const row of subset) {
                const a = toNumber(row[metric.numerator ?? ""]);
                const b = toNumber(row[metric.denominator ?? ""]);
                if (a == null || b == null)
                    continue;
                pairs += 1;
                numerator += a;
                if (distinct) {
                    const key = toText(row[metric.distinctField ?? ""]);
                    if (key && !distinct.has(key))
                        distinct.set(key, b);
                }
                else
                    denominator += b;
            }
            if (distinct)
                denominator = sumOf([...distinct.values()]);
            const perKey = distinct ? ` · una vez por ${fieldLabel(source, metric.distinctField).toLowerCase()}` : "";
            notes.push([`Σ ${fieldLabel(source, metric.numerator)}`, fmtField(numerator, metric.numerator)], [`Σ ${fieldLabel(source, metric.denominator)}${perKey}`, fmtField(denominator, metric.denominator)]);
            if (metric.agg !== "ratio")
                notes.push(["Diferencia", signedDelta(numerator - denominator, fieldFormat(source, metric.numerator))]);
            if (distinct)
                notes.push([`Valores distintos · ${fieldLabel(source, metric.distinctField)}`, num(distinct.size, 0)]);
            notes.push(["Filas con ambos valores", ofRows(pairs, rows.length)]);
            break;
        }
        case "weighted_avg": {
            let weight = 0;
            let simple = 0;
            let weighted = 0;
            for (const row of subset) {
                const v = toNumber(row[metric.field ?? ""]);
                const w = toNumber(row[metric.weight ?? ""]);
                if (v == null || w == null || w <= 0)
                    continue;
                weight += w;
                simple += v;
                weighted += 1;
            }
            notes.push([`Σ ${fieldLabel(source, metric.weight)} (peso)`, fmtField(weight, metric.weight)]);
            if (weighted)
                notes.push(["Promedio simple", fmt(simple / weighted)]);
            notes.push(["Filas ponderadas", ofRows(weighted, rows.length)]);
            break;
        }
        case "avg_hours_diff":
        case "avg_days_diff": {
            const divisor = metric.agg === "avg_days_diff" ? 24 : 1;
            const spans = subset.map((row) => hoursBetween(row[metric.field ?? ""], row[metric.field2 ?? ""])).filter((v): v is number => v != null).map((v) => v / divisor);
            if (spans.length)
                notes.push(["Mediana", fmt(median(spans))], ["Máximo", fmt(maxOf(spans))], ["Mínimo", fmt(minOf(spans))]);
            notes.push(["Filas con ambas fechas", ofRows(spans.length, rows.length)]);
            break;
        }
    }
    const missing = NUMERIC_FIELD_AGGS.has(metric.agg) && metric.field ? subset.length - list.length : 0;
    if (missing > 0)
        notes.push([`Sin valor en ${fieldLabel(source, metric.field).toLowerCase()}`, num(missing, 0)]);
    return notes;
}
function trendBucket(dates: string[]): VaiBucket {
    const sorted = [...dates].sort();
    const span = (Date.parse(sorted[sorted.length - 1]) - Date.parse(sorted[0])) / 86400000;
    return span <= 45 ? "day" : span <= 200 ? "week" : "month";
}
export function kpiTrend(metric: VaiMetric, source: VaiSource, rows: VaiRow[], dateField: string | null | undefined): VaiTrend | null {
    if (!dateField)
        return null;
    const field = vaiField(source, dateField);
    if (!field || field.role !== "date")
        return null;
    const dated = rows.filter((row) => toIsoDate(row[dateField]));
    if (!dated.length)
        return null;
    const bucket = trendBucket(dated.map((row) => toIsoDate(row[dateField])));
    const groups = groupRows(dated, (row) => periodKey(toIsoDate(row[dateField]), bucket));
    const keys = [...groups.keys()].sort().slice(-36);
    const values = keys.map((key) => aggregate(metric, groups.get(key) ?? []));
    if (values.filter((v) => v != null).length < 3)
        return null;
    const grain = bucket === "day" ? "diaria" : bucket === "week" ? "semanal" : "mensual";
    return {
        label: `Evolución ${grain} · ${field.label}`,
        values,
        from: formatDateLabel(keys[0], bucket),
        to: formatDateLabel(keys[keys.length - 1], bucket),
    };
}
export type VaiSeriesDef = {
    id: string;
    label: string;
    format: VaiFormat;
    other?: boolean;
};
export type VaiGroupRow = {
    key: string;
    label: string;
    values: (number | null)[];
    count: number;
    notes: VaiNote[];
};
export type VaiTableRow = (string | number | null)[];
export type VaiTableSummaryRule = {
    operation: VaiSummaryOperation;
    label: string;
    metric?: VaiMetric;
} | null;
export type VaiTableData = {
    kind: "table";
    columns: VaiSeriesDef[];
    rows: VaiTableRow[];
    total: number;
    summaryRules: VaiTableSummaryRule[];
    rowMembers: VaiRow[][];
};
export type VaiTableSummary = {
    value: number | null;
    label: string;
} | null;
export type VaiWidgetData = {
    kind: "unavailable";
    message: string;
} | {
    kind: "kpi";
    metric: VaiSeriesDef;
    value: number | null;
    rows: number;
    notes: VaiNote[];
    trend: VaiTrend | null;
} | {
    kind: "series";
    series: VaiSeriesDef[];
    rows: VaiGroupRow[];
    temporal: boolean;
    table: VaiTableData;
    breakdown: string | null;
    stack: VaiStackMode | null;
    cumulative: boolean;
    notices?: string[];
} | VaiTableData;
export type VaiComputeOptions = {
    trendDateField?: string | null;
};
function summaryRule(widget: VaiWidgetSpec, column: string, metric?: VaiMetric, fallback?: VaiSummaryOperation): VaiTableSummaryRule {
    const requested = widget.summaries?.find((item) => item.column === column)?.operation ?? "auto";
    const operation = requested === "auto" && !metric ? fallback : requested;
    if (!operation || (operation === "auto" && !metric))
        return null;
    if (operation === "none")
        return null;
    const labels: Record<string, string> = {
        sum: "Suma",
        sum_distinct: "Suma sin duplicar",
        sum_per_distinct: "Promedio por único",
        count: "Total",
        count_distinct: "Únicos",
        count_per_distinct: "Filas por único",
        sum_diff: "Diferencia global",
        avg: "Promedio",
        min: "Mínimo",
        max: "Máximo",
        ratio: "Razón global",
        diff_pct: "Variación global",
        pct_change: "Variación global",
        weighted_avg: "Promedio ponderado",
        avg_hours_diff: "Promedio",
        avg_days_diff: "Promedio",
    };
    return { operation, label: labels[operation === "auto" ? metric!.agg : operation] ?? "Resumen", metric };
}
export function summarizeTable(data: VaiTableData, visibleRows = data.rows): VaiTableSummary[] {
    const selected = new Set(visibleRows);
    const originals = data.rowMembers.flatMap((members, index) => selected.has(data.rows[index]) ? members : []);
    return data.summaryRules.map((rule, index) => {
        if (!rule)
            return null;
        if (rule.operation === "auto" && rule.metric)
            return { label: rule.label, value: aggregate(rule.metric, originals) };
        const values = visibleRows.map((row) => toNumber(row[index])).filter((v): v is number => v != null);
        const sum = values.reduce((total, v) => total + v, 0);
        const value = rule.operation === "avg" ? (values.length ? sum / values.length : null)
            : rule.operation === "min" ? (values.length ? values.reduce((a, b) => Math.min(a, b)) : null)
                : rule.operation === "max" ? (values.length ? values.reduce((a, b) => Math.max(a, b)) : null) : sum;
        return { label: rule.label, value };
    });
}
export function widgetDetailTable(widget: VaiWidgetSpec, source: VaiSource, chartTable: VaiTableData): VaiTableData | null {
    if (source.id === "finance_costs") {
        const currency = widget.metrics.some((id) => vaiMetric(source, id)?.format === "pen") ? "pen" : "usd";
        const rows = [...new Set(chartTable.rowMembers.flat())];
        const result = computeWidget({ ...widget, type: "table", metrics: [], columns: [...COST_DETAIL_COLUMNS, `amount_${currency}`], dimension: null, dateField: null, breakdown: null, limit: null }, source, rows);
        return result?.kind === "table" ? result : null;
    }
    const entries = chartTable.rowMembers.flatMap((members, groupIndex) => {
        const group = toText(chartTable.rows[groupIndex]?.[0]) ||
            "Sin grupo";
        return members.map((row) => ({
            row,
            group,
        }));
    });
    if (!entries.length) {
        return null;
    }
    const metrics = widget.metrics
        .map((id) => vaiMetric(source, id))
        .filter((metric): metric is VaiMetric => Boolean(metric));
    if (!metrics.length) {
        return null;
    }
    const fieldIds: string[] = [];
    const addField = (id: string | null | undefined) => {
        if (id &&
            vaiField(source, id) &&
            !fieldIds.includes(id)) {
            fieldIds.push(id);
        }
    };
    if (vaiField(source, "lot") && vaiField(source, "entry_date")) {
        addField("lot");
        addField("entry_date");
    }
    addField(widget.dateField);
    addField(widget.dimension);
    addField(widget.breakdown);
    source.fields
        .filter((field) => field.role === "attribute")
        .slice(0, 3)
        .forEach((field) => addField(field.id));
    metrics.forEach((metric) => {
        addField(metric.field);
        addField(metric.field2);
        addField(metric.numerator);
        addField(metric.denominator);
        addField(metric.weight);
        addField(metric.distinctField);
        metric.where?.forEach((condition) => addField(condition.field));
        metric.whereAny?.forEach((condition) => addField(condition.field));
    });
    const fields = fieldIds
        .slice(0, 12)
        .map((id) => vaiField(source, id))
        .filter((field): field is NonNullable<ReturnType<typeof vaiField>> => Boolean(field));
    if (!fields.length) {
        return null;
    }
    const fieldColumns: VaiSeriesDef[] = fields.map((field) => ({
        id: field.id,
        label: field.label,
        format: field.format ??
            (field.role === "date"
                ? "date"
                : field.type === "number"
                    ? "decimal"
                    : "text"),
    }));
    const hasConditionalMetrics = metrics.some((metric) => Boolean(metric.where?.length) ||
        Boolean(metric.whereAny?.length));
    const groupColumn: VaiSeriesDef = {
        id: "__group",
        label: "Grupo gráfico",
        format: "text",
    };
    const appliesColumn: VaiSeriesDef = {
        id: "__applies",
        label: "Aporta a",
        format: "text",
    };
    const columns: VaiSeriesDef[] = [
        groupColumn,
        ...fieldColumns,
        ...(hasConditionalMetrics
            ? [appliesColumn]
            : []),
    ];
    const contributes = (metric: VaiMetric, row: VaiRow) => passes(row, metric.where) &&
        (!metric.whereAny?.length ||
            metric.whereAny.some((condition) => matches(row, condition)));
    const detailRows: VaiTableRow[] = entries.map(({ row, group }) => {
        const values = fieldColumns.map((column) => column.format === "text" ||
            column.format === "date"
            ? toText(row[column.id])
            : toNumber(row[column.id]));
        const applies = hasConditionalMetrics
            ? metrics
                .filter((metric) => contributes(metric, row))
                .map((metric) => metric.label)
                .join(", ") || "—"
            : null;
        return [
            group,
            ...values,
            ...(hasConditionalMetrics
                ? [applies]
                : []),
        ];
    });
    const summarizableAggs = new Set<VaiAgg>([
        "sum",
        "sum_distinct",
        "sum_per_distinct",
        "avg",
        "min",
        "max",
        "weighted_avg",
    ]);
    const fieldSummaryRules: VaiTableSummaryRule[] = fields.map((field) => {
        if (field.role !== "measure") {
            return null;
        }
        const directMetric = metrics.find((metric) => metric.field === field.id &&
            summarizableAggs.has(metric.agg));
        const candidates = source.metrics.filter((metric) => metric.field === field.id &&
            !metric.where?.length &&
            !metric.whereAny?.length &&
            summarizableAggs.has(metric.agg));
        const column = fieldColumns.find((item) => item.id === field.id);
        const catalogueMetric = candidates.find((metric) => metric.agg === "avg" &&
            [
                "percent",
                "fraction",
                "grade_oztc",
                "grade_gt",
            ].includes(column?.format ?? "")) ??
            candidates.find((metric) => metric.agg === "sum") ??
            candidates[0];
        return summaryRule(widget, field.id, directMetric ??
            catalogueMetric);
    });
    return {
        kind: "table",
        columns,
        rows: detailRows,
        total: detailRows.length,
        summaryRules: [
            null,
            ...fieldSummaryRules,
            ...(hasConditionalMetrics
                ? [null]
                : []),
        ],
        rowMembers: entries.map(({ row }) => [row]),
    };
}
function groupRows(rows: VaiRow[], keyOf: (row: VaiRow) => string) {
    const groups = new Map<string, VaiRow[]>();
    for (const row of rows) {
        const key = keyOf(row);
        if (!groups.has(key))
            groups.set(key, []);
        groups.get(key)!.push(row);
    }
    return groups;
}
function computeHistogram(widget: VaiWidgetSpec, source: VaiSource, rows: VaiRow[], metric: VaiMetric): VaiWidgetData {
    const field = metric.field ? vaiField(source, metric.field) : null;
    if (!field || field.type !== "number" || !["sum", "avg", "min", "max"].includes(metric.agg)) {
        return { kind: "unavailable", message: "El histograma necesita un campo numérico directo. No se distribuyen ratios agregados como si fueran registros." };
    }
    const subset = metricSubset(metric, rows);
    const samples = subset.flatMap((row) => {
        const value = toNumber(row[field.id]);
        return value == null ? [] : [{ row, value }];
    });
    const values = samples.map((s) => s.value);
    const low = values.length ? minOf(values) : 0;
    const high = values.length ? maxOf(values) : 0;
    const bins = high === low ? 1 : Math.min(40, Math.max(3, widget.bins ?? Math.ceil(Math.log2(Math.max(1, values.length)) + 1)));
    const step = high === low ? 1 : (high - low) / bins;
    const members: VaiRow[][] = Array.from({ length: bins }, () => []);
    for (const item of samples) {
        const index = Math.max(0, Math.min(bins - 1, Math.floor((item.value - low) / step)));
        members[index].push(item.row);
    }
    const fmt = field.format ?? metric.format;
    const series: VaiSeriesDef[] = [{ id: "__frequency", label: "Frecuencia (registros)", format: "integer" }];
    const grouped: VaiGroupRow[] = values.length ? members.map((part, i) => {
        const from = low + step * i;
        const to = high === low ? high : i === bins - 1 ? high : low + step * (i + 1);
        const label = high === low ? formatValue(low, fmt) : `${formatValue(from, fmt)} – ${formatValue(to, fmt)}`;
        return { key: `bin-${i}`, label, values: [part.length], count: part.length,
            notes: [[field.label, label], ["Intervalo", high === low ? "Valor único" : i === bins - 1 ? "Incluye ambos extremos" : "Incluye límite inferior; excluye superior"], ["Participación", `${num(part.length / values.length * 100, 2)} %`]] };
    }) : [];
    const table: VaiTableData = { kind: "table",
        columns: [{ id: "__from", label: `${field.label}: desde (incluido)`, format: fmt }, { id: "__to", label: "Hasta (último incluido)", format: fmt }, ...series],
        rows: grouped.map((row, i) => [low + step * i, high === low || i === bins - 1 ? high : low + step * (i + 1), row.count]),
        total: grouped.length, summaryRules: [null, null, { operation: "sum", label: "Registros" }], rowMembers: values.length ? members : [] };
    return { kind: "series", series, rows: grouped, temporal: false, table, breakdown: null, stack: null, cumulative: false,
        notices: [`Distribución de ${values.length.toLocaleString("es-PE")} registros de «${field.label}»; ${subset.length - values.length} valores vacíos/no numéricos excluidos. Intervalos de igual ancho.`] };
}
export type VaiMatrixNode = {
    key: string;
    label: string;
    path: string[];
    values: Record<string, number>;
    children: VaiMatrixNode[];
};
export type VaiMatrixData = {
    columns: VaiSeriesDef[];
    roots: VaiMatrixNode[];
    totals: Record<string, number>;
    hierarchy: string[];
    records: VaiRow[];
    format: VaiFormat;
};
const VAI_MATRIX_COLLATOR =
    new Intl.Collator("es", {
        numeric: true,
    });
export function computeMatrix(widget: VaiWidgetSpec, source: VaiSource, rows: VaiRow[]): VaiMatrixData {
    const metric = vaiMetric(source, widget.metrics[0]);
    if (!metric || metric.agg !== "sum" || !metric.field)
        throw new Error("La matriz necesita una métrica de suma válida.");
    const hierarchy = widget.columns ?? [];
    const records = metricSubset(metric, rows);
    const bucket = widget.bucket ?? "month";
    const matrixColumns = widget.matrixColumns ?? [];
    const groupOf = (row: VaiRow) => matrixColumns.length
        ? matrixColumns.map((field) => toText(row[field]) || "Sin dato").join(" · ")
        : widget.breakdown ? toText(row[widget.breakdown]) || "Sin período" : metric.label;
    const timeOf = (row: VaiRow) => {
        const iso = widget.dateField ? toIsoDate(row[widget.dateField]) : "";
        return iso ? periodKey(iso, bucket) : "__missing__";
    };
    const idOf = (group: string, period: string) => JSON.stringify([group, period]);
    const groups = new Map<string, Set<string>>();
    for (const row of records) {
        const group = groupOf(row);
        if (!groups.has(group)) groups.set(group, new Set());
        if (widget.dateField) groups.get(group)!.add(timeOf(row));
    }
    const columns: VaiSeriesDef[] = [];
    const priority = ["REAL 2026", "PPTO 2026", "REAL 2025"];
    const groupOrder = [...groups.keys()].sort((a, b) => {
        const firstA = a.split(" · ")[0];
        const firstB = b.split(" · ")[0];
        const pa = priority.includes(firstA) ? priority.indexOf(firstA) : 99;
        const pb = priority.includes(firstB) ? priority.indexOf(firstB) : 99;
        return pa - pb || a.localeCompare(b, "es", { numeric: true });
    });
    for (const group of groupOrder) {
        for (const period of [...groups.get(group)!].sort())
            columns.push({ id: idOf(group, period), label: `${group} · ${period === "__missing__" ? "Sin fecha" : formatDateLabel(period, bucket)}`, format: metric.format });
        columns.push({ id: idOf(group, "__total__"), label: widget.dateField ? `${group} · Total` : group, format: metric.format });
    }
    type Node = VaiMatrixNode & { lookup: Map<string, Node> };
    const make = (path: string[]): Node => ({ key: JSON.stringify(path), label: path[path.length - 1] || "Sin dato", path, values: {}, children: [], lookup: new Map() });
    const root = make([]);
    const scale = metric.format === "usd" || metric.format === "pen" ? 100 : 1;
    const add = (node: Node, keys: string[], value: number | null) => {
        if (value === null) return;
        const amount = scale === 100 ? Math.round(value * 100) : value;
        for (const key of keys) node.values[key] = (node.values[key] ?? 0) + amount;
    };
    for (const row of records) {
        const group = groupOf(row);
        const keys = [idOf(group, "__total__")];
        if (widget.dateField) keys.push(idOf(group, timeOf(row)));
        const value = toNumber(row[metric.field]);
        add(root, keys, value);
        let parent = root;
        for (const field of hierarchy) {
            const text = toText(row[field]);
            let node = parent.lookup.get(text);
            if (!node) {
                node = make([...parent.path, text]);
                parent.lookup.set(text, node);
                parent.children.push(node);
            }
            add(node, keys, value);
            parent = node;
        }
    }
    const finish = (node: Node) => {
        for (const key of Object.keys(node.values)) node.values[key] /= scale;
        node.children.sort(
    (a, b) =>
        VAI_MATRIX_COLLATOR.compare(
            a.label,
            b.label
        )
);
        for (const child of node.children) finish(child as Node);
        node.lookup.clear();
    };
    finish(root);
    return { columns, roots: root.children, totals: root.values, hierarchy, records, format: metric.format };
}
export function matrixExportTable(matrix: VaiMatrixData, source: VaiSource): VaiExportTable {
    const columns: VaiSeriesDef[] = [
        ...matrix.hierarchy.map((id) => ({ id, label: vaiField(source, id)?.label ?? id, format: "text" as const })),
        ...matrix.columns,
    ];
    const rows: VaiTableRow[] = [];
    const visit = (node: VaiMatrixNode) => {
        if (node.children.length) node.children.forEach(visit);
        else rows.push([...node.path, ...matrix.columns.map((column) => node.values[column.id] ?? null)]);
    };
    matrix.roots.forEach(visit);
    const data: VaiTableData = {
        kind: "table", columns, rows, total: rows.length,
        summaryRules: columns.map((_, index) => index < matrix.hierarchy.length ? null : { operation: "sum", label: "Total" }),
        rowMembers: rows.map(() => []),
    };
    return { data, rows };
}
export function computeWidget(widget: VaiWidgetSpec, source: VaiSource, rows: VaiRow[], options: VaiComputeOptions = {}): VaiWidgetData | null {
    const metrics = widget.metrics.map((id) => vaiMetric(source, id)).filter((metric): metric is VaiMetric => Boolean(metric));
    if (widget.type === "kpi") {
        if (!metrics.length)
            return null;
        const trendDateField = widget.dateField ??
            options.trendDateField ??
            (source.temporalMode === "snapshot" ? null : source.defaultDateField ?? source.fields.find((field) => field.role === "date")?.id ?? null);
        return {
            kind: "kpi",
            metric: { id: metrics[0].id, label: metrics[0].label, format: metrics[0].format },
            value: aggregate(metrics[0], rows),
            rows: rows.length,
            notes: kpiInsights(metrics[0], source, rows),
            trend: kpiTrend(metrics[0], source, rows, trendDateField),
        };
    }
    if (widget.type === "table" && widget.columns) {
        const columns = lotDetailColumns(source, widget.columns)
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
                if (field?.role !== "measure")
                    return null;
                const candidates = source.metrics.filter((metric) => metric.field === field.id && !metric.where?.length && !metric.whereAny?.length && ["sum", "sum_distinct", "avg", "min", "max", "weighted_avg"].includes(metric.agg));
                const metric = candidates.find((item) => item.agg === "avg" && ["percent", "fraction", "grade_oztc", "grade_gt"].includes(column.format)) ?? candidates.find((item) => item.agg === "sum") ?? candidates[0];
                return summaryRule(widget, column.id, metric, ["percent", "fraction", "grade_oztc", "grade_gt"].includes(column.format) ? "avg" : undefined);
            }),
            rowMembers: visibleRows.map((row) => [row]),
        };
    }
    if (!metrics.length)
        return null;
    if (widget.type === "histogram")
        return computeHistogram(widget, source, rows, metrics[0]);
    const notices: string[] = [];
    const lineLike = widget.type === "line" || widget.type === "area";
    const temporal = Boolean(widget.dateField) && (lineLike || !widget.dimension);
    const bucket = widget.bucket ?? "month";
    let groups: Map<string, VaiRow[]>;
    let base: VaiRow[];
    if (temporal && widget.dateField) {
        const dateField = widget.dateField;
        base = rows.filter((row) => toIsoDate(row[dateField]));
        groups = groupRows(base, (row) => periodKey(toIsoDate(row[dateField]), bucket));
    }
    else if (widget.dimension) {
        const dimension = widget.dimension;
        base = rows;
        groups = groupRows(rows, (row) => toText(row[dimension]) || "Sin dato");
    }
    else
        return null;
    const primary = metrics[0];
    const breakdownField = widget.breakdown ? vaiField(source, widget.breakdown) : null;
    const breakdown = breakdownField?.role === "dimension" ? breakdownField.id : null;
    let seriesMetrics: VaiMetric[] = metrics;
    let series: VaiSeriesDef[] = metrics.map((metric) => ({ id: metric.id, label: metric.label, format: metric.format }));
    if (breakdown) {
        const byCategory = groupRows(base, (row) => toText(row[breakdown]) || "Sin dato");
        const ranked = [...byCategory.entries()]
            .map(([key, subset]) => ({ key, value: aggregate(primary, subset), count: subset.length }))
            .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity) || b.count - a.count);
        const cap = widget.type === "heatmap" ? 40 : widget.type === "table" ? VAI_BREAKDOWN_TABLE_LIMIT : VAI_BREAKDOWN_CHART_LIMIT;
        const drawn = ranked.slice(0, cap).map((item) => item.key);
        const rest = ranked.length - drawn.length;
        if (rest > 0)
            notices.push(`${vaiField(source, breakdown)?.label ?? breakdown}: ${drawn.length} categorías y Otros (${rest}); los valores se recalculan sobre sus filas.`);
        const condition = (key: string): VaiCondition => (key === "Sin dato" ? { field: breakdown, op: "empty" } : { field: breakdown, op: "eq", value: key });
        const others: VaiCondition[] = drawn.includes("Sin dato")
            ? [{ field: breakdown, op: "not_empty" }, { field: breakdown, op: "not_in", value: drawn.filter((key) => key !== "Sin dato") }]
            : [{ field: breakdown, op: "not_in", value: drawn }];
        seriesMetrics = [];
        series = [];
        for (const metric of metrics) {
            for (const key of drawn) {
                const subset = byCategory.get(key) ?? [];
                if (aggregate(metric, subset) == null)
                    continue;
                const id = `${metric.id}:${key}`;
                const label = metrics.length > 1 ? `${metric.label} · ${key}` : key;
                seriesMetrics.push({ ...metric, id, label, where: [...(metric.where ?? []), condition(key)] });
                series.push({ id, label, format: metric.format });
            }
            if (rest > 0) {
                const otherMetric: VaiMetric = { ...metric, id: `${metric.id}:__others`, label: `Otros (${rest})`, where: [...(metric.where ?? []), ...others] };
                if (aggregate(otherMetric, base) != null) {
                    seriesMetrics.push(otherMetric);
                    series.push({ id: otherMetric.id, label: metrics.length > 1 ? `${metric.label} · Otros (${rest})` : `Otros (${rest})`, format: metric.format, other: true });
                }
            }
        }
        if (!seriesMetrics.length)
            return { kind: "unavailable", message: `No hay valores para desglosar por ${breakdownField?.label ?? breakdown}.` };
    }
    type Group = VaiGroupRow & {
        members: VaiRow[];
        rank: number;
        order: number;
    };
    const sortBy = widget.sortMetric && !breakdown ? vaiMetric(source, widget.sortMetric) : null;
    let grouped: Group[] = [...groups.entries()].map(([key, members]) => {
        const values = seriesMetrics.map((metric) => aggregate(metric, members));
        const total = breakdown ? aggregate(primary, members) : values[0];
        return {
            key,
            label: temporal ? formatDateLabel(key, bucket) : key,
            values,
            count: members.length,
            notes: [],
            members,
            rank: total ?? -Infinity,
            order: (sortBy ? aggregate(sortBy, members) : total) ?? -Infinity,
        };
    });
    if (temporal)
        grouped.sort((a, b) => a.key.localeCompare(b.key));
    else {
        const byRank = [...grouped].sort((a, b) => b.rank - a.rank);
        byRank.forEach((row, index) => {
            row.rank = index + 1;
        });
        const mode = widget.type === "pareto" ? "value_desc" : widget.sort ?? (widget.type === "waterfall" ? "label_asc" : "value_desc");
        const byLabel = (a: Group, b: Group) => a.label.localeCompare(b.label, "es", { numeric: true, sensitivity: "base" });
        grouped.sort((a, b) => mode === "label_asc" ? byLabel(a, b)
            : mode === "label_desc" ? byLabel(b, a)
                : mode === "value_asc" ? a.order - b.order
                    : b.order - a.order);
    }
    const groupedTotal = grouped.length;
    const totals = seriesMetrics.map((metric, j) => (ADDITIVE_AGGS.has(metric.agg) ? sumOf(grouped.map((row) => row.values[j] ?? 0)) : null));
    const references = seriesMetrics.map((metric, j) => {
        if (RATE_AGGS.has(metric.agg))
            return aggregate(metric, rows);
        if (metric.agg === "min" || metric.agg === "max")
            return null;
        const known = grouped.map((row) => row.values[j]).filter((v): v is number => v != null);
        return known.length ? sumOf(known) / known.length : null;
    });
    if ((widget.type === "donut" || widget.type === "pareto") && grouped.some((row) => (row.values[0] ?? 0) < 0)) {
        return { kind: "unavailable", message: `${widget.type === "pareto" ? "El Pareto" : "El anillo"} no admite aportes negativos. No se ocultaron ni convirtieron en cero; usa barras o cascada.` };
    }
    const limit = widget.limit ?? (widget.type === "rank" ? 10 : widget.type === "donut" ? 6 : grouped.length);
    const totalBeforeLimit = grouped.length;
    let omitted: Group[] = [];
    if (temporal && grouped.length > limit) {
        omitted = grouped.slice(0, grouped.length - limit);
        grouped = grouped.slice(grouped.length - limit);
    }
    else if (!temporal && grouped.length > limit) {
        omitted = grouped.slice(limit);
        grouped = grouped.slice(0, limit);
        const othersRequested = widget.includeOthers ?? (widget.type === "donut");
        const othersAllowed = !["scatter", "waterfall"].includes(widget.type);
        if (othersRequested && othersAllowed && omitted.length) {
            const members = omitted.flatMap((row) => row.members);
            grouped.push({ key: "__vai_other__", label: `Otros (${omitted.length})`,
                values: seriesMetrics.map((metric) => aggregate(metric, members)), count: members.length,
                notes: [], members, rank: 0, order: 0 });
        }
    }
    if (omitted.length)
        notices.push(`${temporal ? "Últimos" : "Top"} ${limit} de ${totalBeforeLimit} ${temporal ? "períodos" : "categorías"}${grouped.some((r) => r.key === "__vai_other__") ? ` + Otros (${omitted.length})` : "; el resto no está incluido en las barras ni en su detalle"}.`);
    const cumulative = Boolean(widget.cumulative) && temporal && widget.type !== "waterfall";
    if (cumulative) {
        const running = seriesMetrics.map((_, j) => sumOf(omitted.map((row) => row.values[j] ?? 0)));
        if (omitted.length)
            notices.push("El acumulado incluye los períodos previos no visibles dentro del filtro; el detalle visible no es toda su base.");
        grouped.forEach((row) => {
            row.values = row.values.map((v, j) => {
                running[j] += v ?? 0;
                return running[j];
            });
        });
    }
    const stack = widget.type === "bar" && widget.stack && series.length > 1 ? widget.stack : null;
    const absolute = grouped.map((row) => [...row.values]);
    if (stack === "percent" && grouped.some((row) => row.values.some((v) => v != null && v < 0))) {
        return { kind: "unavailable", message: "El apilado al 100 % no admite aportes negativos. Usa barras agrupadas o apilado absoluto; no se ocultaron valores." };
    }
    if (stack === "percent") {
        grouped.forEach((row) => {
            const total = sumOf(row.values.filter((v): v is number => v != null && v > 0));
            const shares = row.values.map((v) => (v == null || total <= 0 ? null : v > 0 ? Math.round((v / total) * 100000) / 1000 : 0));
            const known = shares.filter((v): v is number => v != null);
            if (known.length) {
                const largest = shares.indexOf(known.reduce((a, b) => Math.max(a, b)));
                shares[largest] = Math.round(((shares[largest] ?? 0) + 100 - sumOf(known)) * 1000) / 1000;
            }
            row.values = shares;
        });
        series = series.map((item) => ({ ...item, format: "percent" }));
    }
    const dimensionLabel = (vaiField(source, widget.dimension ?? "")?.label ?? "categoría").toLowerCase();
    const purchaseTmsMetric = source.id === "finance_mineral_purchases" &&
        widget.metrics.includes("lot_usd_purchase_docs")
        ? vaiMetric(source, "tms_conta_purchase_docs")
        : null;
    grouped.forEach((row, i) => {
        const notes: VaiNote[] = [];
        const other = !temporal && row.key === "__vai_other__";
        if (!temporal && !other)
            notes.push(["Posición", `#${row.rank} de ${groupedTotal}`]);
        seriesMetrics.forEach((metric, j) => {
            const v = row.values[j];
            if (v == null)
                return;
            if (stack === "percent")
                notes.push(["Valor", formatValue(absolute[i][j], metric.format), j]);
            if (temporal && i > 0) {
                const previous = grouped[i - 1];
                const change = relative(v, previous.values[j]);
                if (change != null)
                    notes.push([`Δ vs ${previous.label}`, `${signedPct(change)} (${signedDelta(v - (previous.values[j] ?? 0), series[j].format)})`, j]);
            }
            const total = totals[j];
            if (widget.type !== "donut" && stack !== "percent" && total)
                notes.push([cumulative ? "Avance del total" : "Participación", `${num((v / total) * 100, 1)} %`, j]);
            const change = temporal || other || stack === "percent" ? null : relative(v, references[j]);
            if (change != null)
                notes.push([RATE_AGGS.has(metric.agg) ? "vs global" : `vs promedio por ${dimensionLabel}`, signedPct(change), j]);
        });
        if (purchaseTmsMetric && !cumulative) {
            const hasTms = row.members.some((member) => toNumber(member.tms_conta) != null);
            if (hasTms) {
                notes.push([
                    "TMS del lote · CONCAR/traceability",
                    formatValue(aggregate(purchaseTmsMetric, row.members), "tms"),
                ]);
            }
        }
        if (stack === "stack")
            notes.push(["Total apilado", formatValue(sumOf(row.values.filter((v): v is number => v != null)), primary.format)]);
        notes.push(["Filas", num(row.count, 0)]);
        row.notes = notes;
    });
    if (widget.type === "pareto") {
        const total = sumOf([...groups.values()].map((members) => aggregate(primary, members) ?? 0));
        let running = 0;
        grouped.forEach((row) => {
            running += row.values[0] ?? 0;
            row.values.push(total > 0 ? Math.min(100, (running / total) * 100) : null);
            row.notes.push(["Base del % acumulado", formatValue(total, primary.format)]);
        });
        series = [...series, { id: "__pareto_pct", label: "% acumulado", format: "percent" }];
        notices.push("Pareto: barras de mayor a menor y porcentaje acumulado sobre el total filtrado.");
    }
    if (widget.type === "waterfall")
        notices.push("Cascada de aportes: parte de cero; la última barra es el total neto. No representa un saldo inicial no disponible.");
    const first: VaiSeriesDef = temporal
        ? { id: widget.dateField ?? "period", label: "Período", format: "text" }
        : { id: widget.dimension ?? "dimension", label: vaiField(source, widget.dimension ?? "")?.label ?? "Categoría", format: "text" };
    const lotGrain = widget.dimension === "lot" && Boolean(vaiField(source, "entry_date"));
    const showCount = source.id !== "finance_mineral_purchases" && !lotGrain;
    const entryColumn: VaiSeriesDef[] = lotGrain ? [{ id: "entry_date", label: "Fecha de ingreso", format: "date" }] : [];
    if (lotGrain && ["finance_mineral_purchases", "traceability_lots"].includes(source.id)) {
        for (const row of grouped) {
            row.values = row.values.map((value, index) => {
                const metric = seriesMetrics[index];
                const field = metric?.field;
                if (!field || metric.agg !== "sum")
                    return value;
                return metricSubset(metric, row.members).some((member) => toNumber(member[field]) !== null) ? value : null;
            });
        }
    }
    const table: VaiTableData = {
        kind: "table",
        columns: [first, ...entryColumn, ...series, ...(showCount ? [{ id: "__count", label: "Filas", format: "integer" as const }] : [])],
        rows: grouped.map((row) => [row.label, ...(lotGrain ? [toText(row.members[0]?.entry_date)] : []), ...row.values, ...(showCount ? [row.count] : [])]),
        total: groupedTotal,
        summaryRules: [null, ...entryColumn.map(() => null), ...seriesMetrics.map((metric) => (stack === "percent" ? null : summaryRule(widget, breakdown ? metric.id.split(":")[0] : metric.id, metric))),
            ...(widget.type === "pareto" ? [{ operation: "max" as const, label: "Acumulado visible" }] : []), ...(showCount ? [{ operation: "sum" as const, label: "Total" }] : [])],
        rowMembers: grouped.map((row) => row.members),
    };
    if (widget.type === "table")
        return table;
    return { kind: "series", series, rows: grouped, temporal, table, breakdown: breakdownField?.label ?? null, stack, cumulative, notices };
}
export function filteredRows(spec: VaiDashboardSpec, rowsBySource: Record<string, VaiRow[]>, state: VaiFilterState, sources: Map<string, VaiSource>) {
    const out: Record<string, VaiRow[]> = {};
    for (const id of spec.sources) {
        const source = sources.get(id);
        if (!source)
            continue;
        out[id] = applyFilters(source, rowsBySource[id] ?? [], spec.filters, state);
    }
    return out;
}
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
    language_code: VaiLanguage;
    created_at: string;
    updated_at: string;
};
export type VaiDashboardDetail = VaiDashboardRecord & {
    spec_json: string;
};
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
    changeType?: "save" | "widget_edit" | "language" | "title";
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
        language_code: input.spec.language,
        change_type: input.changeType ?? "save",
    });
    return Number(out?.dashboard_id);
}
export async function undoDashboard(id: number): Promise<VaiDashboardDetail | null> {
    const out = await apiPost("/api/vai/dashboards/undo", { dashboard_id: id });
    return (out?.row as VaiDashboardDetail | undefined) ?? null;
}
export async function deleteDashboard(id: number) {
    await apiPost("/api/vai/dashboards/delete", { dashboard_id: id });
}
export type VaiExportTable = {
    data: VaiTableData;
    rows: VaiTableRow[];
};
export type VaiExportBlock = {
    title: string;
    kind: "kpi" | "chart" | "table";
    element: HTMLElement | null;
    table?: VaiExportTable;
};
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
    if (format === "usd")
        return `"USD "${numeric}`;
    if (format === "pen")
        return `"S/ "${numeric}`;
    if (format === "percent" || format === "fraction")
        return "0.00%";
    if (format === "integer")
        return "#,##0";
    if (format === "km")
        return '#,##0" km"';
    if (format === "gal")
        return '#,##0.00" gal"';
    if (format === "km_per_gal")
        return '#,##0.00" km/gal"';
    if (format === "l_100km")
        return '#,##0.00" l/100 km"';
    if (format === "pen_per_km")
        return '"S/ "#,##0.00"/km"';
    if (format === "usd_per_km")
        return '"USD "#,##0.00"/km"';
    if (format === "pen_per_gal")
        return '"S/ "#,##0.00"/gal"';
    if (format === "usd_per_gal")
        return '"USD "#,##0.00"/gal"';
    if (format === "hours")
        return '#,##0.0" h"';
    if (format === "days")
        return '#,##0.0" días"';
    if (format === "months")
        return '#,##0.0" meses"';
    if (format === "grade_oztc")
        return '#,##0.000" oz/TC"';
    if (format === "grade_gt")
        return `${numeric}" g/t"`;
    if (format === "g")
        return '#,##0" g"';
    if (format === "m3")
        return '#,##0.00" m³"';
    if (format === "g_m3")
        return '#,##0.00" g/m³"';
    if (format === "kg_per_tms")
        return '#,##0.00" kg/TMS"';
    if (["tmh", "tms", "kg", "oz"].includes(format))
        return `${numeric}" ${format === "tmh" || format === "tms" ? format.toUpperCase() : format}"`;
    if (format === "date")
        return "dd/mm/yyyy";
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
        if (!summary)
            return;
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
        if (number < 4)
            return;
        row.height = number === 4 ? 30 : 23;
        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.font = { name: "Arial", size: 10, bold: number === 4 || number > end, color: { argb: number === 4 ? "FFFFFFFF" : "FF272727" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: number === 4 ? "FF0067AC" : number > end ? "FFFFEBC0" : number % 2 ? "FFF0F5F8" : "FFFFFFFF" } };
            if (number === 4)
                cell.alignment = { vertical: "middle", wrapText: true };
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
        if (paint)
            pdf.text(lines, pad, 21);
        let bottom = 23 + (lines.length - 1) * 7;
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(theme.muted);
        pdf.setFontSize(8);
        for (const line of context) {
            const wrapped = pdf.splitTextToSize(line, headingWidth);
            if (paint)
                pdf.text(wrapped, pad, bottom + 4);
            bottom += wrapped.length * 4;
        }
        return bottom + 8;
    };
    const newPage = (pageTitle: string, pageWidth = 297, height = 210, paint = true) => {
        if (started || pageWidth !== 297 || height !== 210) {
            pdf.addPage([pageWidth, height], height > pageWidth ? "portrait" : "landscape");
            if (!started)
                pdf.deletePage(1);
        }
        started = true;
        x = pad;
        rowHeight = 0;
        y = heading(pageTitle, paint);
    };
    for (const block of blocks) {
        if (block.kind === "table" && block.table) {
            const { data, rows } = block.table;
            const summaries = summarizeTable(data, rows);
            const body = rows.map((row) => row.map((cell, index) => formatValue(cell, data.columns[index].format)));
            body.push(summaries.map((summary, index) => summary ? `${summary.label}\n${formatValue(summary.value, data.columns[index].format)}` : index === 0 ? `Resumen\n${rows.length.toLocaleString("es-PE")} filas` : ""));
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(9);
            const columnWidths = data.columns.map((column, index) => {
                const contentWidth = body.reduce((max, row) => Math.max(max, ...row[index].split("\n").map((line) => pdf.getTextWidth(line) + 6)), 0);
                return Math.max(24, Math.min(column.format === "text" ? 60 : 40, Math.max(contentWidth, pdf.getTextWidth(column.label) + 6)));
            });
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
                didParseCell: (hook) => { if (hook.section === "body" && hook.row.index === body.length - 1) {
                    hook.cell.styles.fillColor = theme.blue;
                    hook.cell.styles.fontStyle = "bold";
                } },
            });
            y = 210;
            x = pad;
            rowHeight = 0;
            previousKind = "table";
            continue;
        }
        if (!block.element)
            continue;
        if (previousKind === "table")
            newPage(title);
        else if (previousKind && previousKind !== block.kind && x !== pad) {
            x = pad;
            y += rowHeight + gap;
            rowHeight = 0;
        }
        previousKind = block.kind;
        const kpiCount = blocks.filter((item) => item.kind === "kpi").length;
        const tileWidth = block.kind === "kpi" ? (width - gap * (Math.min(4, kpiCount) - 1)) / Math.min(4, kpiCount) : blocks.length === 1 ? width : (width - gap) / 2;
        if (block.kind === "kpi") {
            const label = block.element.querySelector(".vai-kpi > span")?.textContent ?? block.title;
            const value = block.element.querySelector(".vai-kpi > strong")?.textContent ?? "";
            const detail = block.element.querySelector(".vai-kpi > small")?.textContent ?? "";
            const inset = 4;
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(9);
            const labels = pdf.splitTextToSize(label, tileWidth - inset * 2);
            pdf.setFontSize(7);
            const details = pdf.splitTextToSize(detail, tileWidth - inset * 2);
            const tileHeight = 22 + labels.length * 4 + details.length * 3;
            if (!started)
                newPage(title);
            if (x + tileWidth > 297 - pad + .1) {
                x = pad;
                y += rowHeight + gap;
                rowHeight = 0;
            }
            if (y + tileHeight > pdf.internal.pageSize.getHeight() - pad)
                newPage(title);
            pdf.setFillColor(theme.panel);
            pdf.roundedRect(x, y, tileWidth, tileHeight, 2, 2, "F");
            pdf.setFillColor(theme.gold);
            pdf.rect(x + inset, y, tileWidth - inset * 2, .6, "F");
            pdf.setTextColor(theme.muted);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(9);
            pdf.text(labels, x + inset, y + 7);
            pdf.setTextColor(theme.ink);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(17);
            const valueSize = Math.min(17, 17 * (tileWidth - inset * 2) / Math.max(1, pdf.getTextWidth(value)));
            pdf.setFontSize(valueSize);
            pdf.text(value, x + inset, y + 15 + (labels.length - 1) * 4);
            pdf.setTextColor(theme.muted);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(7);
            pdf.text(details, x + inset, y + 23 + (labels.length - 1) * 4);
            x += tileWidth + gap;
            rowHeight = Math.max(rowHeight, tileHeight);
            continue;
        }
        const canvas = await html2canvas(block.element, { scale: 2, backgroundColor: theme.canvas, logging: false, useCORS: true,
            ignoreElements: (element) => element.hasAttribute("data-vai-export-ignore") || element.classList.contains("trjk-chart-data") || element.classList.contains("trjk-tip"),
        });
        const tileHeight = (canvas.height / canvas.width) * tileWidth;
        if (!started)
            newPage(title, 297, Math.max(210, tileHeight + 70));
        if (x + tileWidth > 297 - pad + .1) {
            x = pad;
            y += rowHeight + gap;
            rowHeight = 0;
        }
        if (y + tileHeight > pdf.internal.pageSize.getHeight() - pad)
            newPage(title, 297, Math.max(210, tileHeight + 70));
        pdf.addImage(canvas, "PNG", x, y, tileWidth, tileHeight);
        x += tileWidth + gap;
        rowHeight = Math.max(rowHeight, tileHeight);
    }
    if (!started)
        newPage(title);
    return pdf;
}
export async function downloadDashboardPdf(title: string, blocks: VaiExportBlock[], context: string[] = []) {
    const pdf = await createDashboardPdf(title, blocks, context);
    pdf.save(`${fileName(title)}.pdf`);
}
