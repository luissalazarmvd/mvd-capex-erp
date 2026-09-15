// src/lib/vai/catalog.ts
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
  | "fleet"
  | "sustainability";

export const VAI_AREAS: Array<{ id: VaiArea; label: string }> = [
  { id: "kardex", label: "Kardex TRJ" },
  { id: "traceability", label: "Trazabilidad" },
  { id: "fixassets", label: "Activos Fijos" },
  { id: "planta", label: "Planta" },
  { id: "refinery", label: "Refinería" },
  { id: "logistics", label: "Logística" },
  { id: "fleet", label: "Flota" },
  { id: "sustainability", label: "Sostenibilidad" },
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
  | "km"
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
  | "ratio" // Σ numerator / Σ denominator
  | "diff_pct" // (Σ numerator − Σ denominator) / Σ numerator × 100
  | "weighted_avg" // Σ(field × weight) / Σ weight
  | "avg_hours_diff"; // promedio de horas entre `field` y `field2`

export type VaiMetric = {
  id: string;
  label: string;
  description: string;
  agg: VaiAgg;
  format: VaiFormat;
  field?: string;
  field2?: string;
  numerator?: string;
  denominator?: string;
  weight?: string;
  /** Condiciones fijas que las filas deben cumplir antes de agregar. */
  where?: VaiCondition[];
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
): VaiField => ({ id, label, role, type, description, format });

const m = (
  id: string,
  label: string,
  description: string,
  agg: VaiAgg,
  format: VaiFormat,
  extra: Partial<Omit<VaiMetric, "id" | "label" | "description" | "agg" | "format">> = {},
): VaiMetric => ({ id, label, description, agg, format, ...extra });

const OPERATIONAL_LOT: VaiCondition = { field: "lot_corr", op: "not_in", value: ["PERD", "EXCE"] };

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
      f("guide_date", "Fecha de guía", "date", "Fecha de emisión de la guía."),
      f("departure_date", "Fecha de salida", "date", "Fecha y hora de salida del camión; base temporal principal.", "datetime"),
      f("arrival_date", "Fecha de llegada", "date", "Fecha y hora de llegada a planta; vacía si aún no llega.", "datetime"),
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
    ],
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
      "Detalle de lotes de mineral dentro de cada guía TRJ: TMH por lote, sacos, saldo SGM y correlativo (PERD = pérdida, EXCE = excedente).",
    endpoint: "/api/trjkar",
    sqlView: "dw.v_finance_trjkar_get",
    grain: "Una fila por lote dentro de una guía (una guía tiene varios lotes).",
    fields: [
      f("lot", "Lote", "dimension", "Código del lote de mineral."),
      f("lot_corr", "Correlativo", "dimension", "Correlativo del lote; PERD = pérdida y EXCE = excedente no son operativos."),
      f("guide_number", "Número de guía", "attribute", "Guía a la que pertenece el lote."),
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
      m("tmh_perd", "TMH pérdida (PERD)", "TMH registradas como pérdida.", "sum", "tmh", { field: "tmh_departure", where: [{ field: "lot_corr", op: "eq", value: "PERD" }] }),
      m("tmh_cleanup", "TMH limpieza", "TMH de lotes LIMPIEZA (operativos, sin saldo SGM).", "sum", "tmh", { field: "tmh_departure", where: [OPERATIONAL_LOT, { field: "lot", op: "ends_with", value: "LIMPIEZA" }] }),
    ],
    rules: [
      "Los importes y datos de factura pertenecen a la guía (cabecera) y se repiten por lote: no sumarlos aquí; usar la fuente de guías.",
      "PERD y EXCE se excluyen de las métricas operativas.",
    ],
    relations: [{ field: "guide_number", source: "trjkar_guides", targetField: "guide_number", description: "Lote → guía." }],
    keywords: ["lote", "lotes", "sacos", "perd", "pérdida", "limpieza", "saldo", "sgm", "kardex", "trj"],
    enabled: true,
    access: { scopes: ["trjkardex_sum", "trjkardex_guides"] },
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
      f("document_date", "Fecha de factura", "date", "Fecha del documento."),
      f("transport_name", "Transportista", "dimension", "Nombre del transportista."),
      f("status_name", "Estado", "dimension", "CERRADO si sus guías fueron cerradas, si no ABIERTO."),
      f("amount_usd", "USD ingresado", "measure", "Importe registrado en la web.", "number", "usd"),
      f("amount_usd_con", "USD contabilizado", "measure", "Importe hallado en Concar (cuenta 631111 / subdiario 820); vacío sin cruce.", "number", "usd"),
      f("calculated_amount_usd", "USD de guías", "measure", "Suma de importes de las guías vinculadas.", "number", "usd"),
      f("guide_count", "Guías vinculadas", "measure", "Número de guías de la factura.", "number", "integer"),
      f("subledger_num", "Subdiario", "attribute", "Subdiario contable del cruce; vacío si no cruzó."),
    ],
    metrics: [
      m("invoices_count", "Facturas", "Número de facturas.", "count", "integer"),
      m("amount_usd_total", "USD ingresado", "Suma del importe ingresado.", "sum", "usd", { field: "amount_usd" }),
      m("amount_usd_con_total", "USD contabilizado", "Suma del importe contabilizado.", "sum", "usd", { field: "amount_usd_con" }),
      m("calculated_usd_total", "USD de guías", "Suma de la valorización de guías vinculadas.", "sum", "usd", { field: "calculated_amount_usd" }),
      m("guides_linked", "Guías vinculadas", "Total de guías vinculadas.", "sum", "integer", { field: "guide_count" }),
      m("unmatched_invoices", "Facturas sin cruce", "Facturas sin registro contable.", "count", "integer", { where: [{ field: "subledger_num", op: "empty" }] }),
      m("closed_invoices", "Facturas cerradas", "Facturas en estado CERRADO.", "count", "integer", { where: [{ field: "status_name", op: "eq", value: "CERRADO" }] }),
    ],
    rules: ["Cada factura se cuenta una sola vez por RUC/documento.", "El cruce contable es registro, no prueba de pago."],
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
      f("entry_date", "Fecha de ingreso", "date", "Ingreso del lote a planta; base temporal principal."),
      f("process_date", "Fecha de proceso", "date", "Fecha de procesamiento."),
      f("valuation_date", "Fecha de valorización", "date", "Fecha de valorización."),
      f("doc_date", "Fecha de factura", "date", "Fecha de la factura del proveedor."),
      f("payment_date", "Fecha de pago", "date", "Fecha de pago al proveedor; vacía si no se ha pagado."),
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
      f("lot_usd", "Factura USD", "measure", "Importe facturado del lote.", "number", "usd"),
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
      m("lot_usd_total", "USD facturado", "Suma de importes facturados.", "sum", "usd", { field: "lot_usd" }),
      m("avg_au_grade", "Ley Au promedio", "Ley de oro ponderada por TMS.", "weighted_avg", "grade_oztc", { field: "au_grade_oztc", weight: "tms" }),
      m("avg_ag_grade", "Ley Ag promedio", "Ley de plata ponderada por TMS.", "weighted_avg", "grade_oztc", { field: "ag_grade_oztc", weight: "tms" }),
      m("avg_h2o", "Humedad promedio", "Promedio simple de humedad.", "avg", "percent", { field: "h2o" }),
      m("avg_usd_tms", "USD/TMS promedio", "USD por TMS ponderado por TMS.", "weighted_avg", "usd", { field: "usd_tms", weight: "tms" }),
      m("avg_au_rec", "Recuperación Au promedio", "Promedio simple de recuperación Au.", "avg", "percent", { field: "au_rec" }),
      m("avg_pio", "PIO promedio", "Promedio del precio del oro aplicado.", "avg", "usd", { field: "pio" }),
      m("lots_pending_invoice", "Lotes sin factura", "Lotes sin número de factura.", "count", "integer", { where: [{ field: "doc_number", op: "empty" }] }),
      m("lots_pending_payment", "Lotes facturados sin pago", "Lotes con factura y sin fecha de pago.", "count", "integer", { where: [{ field: "doc_number", op: "not_empty" }, { field: "payment_date", op: "empty" }] }),
      m("lots_paid", "Lotes pagados", "Lotes con fecha de pago.", "count", "integer", { where: [{ field: "payment_date", op: "not_empty" }] }),
    ],
    rules: [
      "Solo incluye lotes con ingreso desde 2026-01-01.",
      "Las leyes se promedian ponderadas por TMS, nunca se suman.",
      "Los precios (PIO, PIP) y ratios (USD/TMS) no se suman.",
    ],
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
      f("entry_date", "Fecha de ingreso", "date", "Ingreso del lote."),
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
      m("avg_usd_tms", "USD/TMS promedio", "USD/TMS ponderado por TMS.", "weighted_avg", "usd", { field: "usd_tms", weight: "tms" }),
    ],
    rules: ["Las leyes se promedian ponderadas por TMS."],
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
      f("payment_date", "Fecha de pago", "date", "Fecha del voucher de pago."),
      f("invoice_doc_date", "Fecha de factura", "date", "Fecha del documento de la factura."),
      f("entry_date", "Fecha de ingreso", "date", "Ingreso del lote."),
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
    rules: ["Incluye lotes desde 2025."],
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
      "Inventario de activos fijos con ubicación, área, centro de costo, tipo, situación, fechas y valores contables (costo, depreciación acumulada y saldo) en USD y PEN.",
    endpoint: "/api/actfij/catalogue",
    sqlView: "dw.v_finance_actfij_cat_get",
    grain: "Una fila por activo (COD).",
    fields: [
      f("asset_code", "COD", "attribute", "Código del activo (7 dígitos)."),
      f("asset_description", "Descripción", "attribute", "Descripción del activo."),
      f("source_name", "Origen", "dimension", "WEB, VR, TRASLADO o HISTORIC."),
      f("location_name", "Ubicación", "dimension", "Ubicación física."),
      f("area_name", "Área", "dimension", "Área usuaria."),
      f("assigned_to", "Asignado a", "dimension", "Responsable asignado."),
      f("asset_type", "Tipo de activo", "dimension", "Clase contable del activo."),
      f("origin_account_desc", "Cuenta origen", "dimension", "Descripción de la cuenta contable de origen."),
      f("cost_center_desc", "Centro de costo", "dimension", "Descripción del CECO."),
      f("capex_code", "Código CAPEX", "dimension", "Proyecto CAPEX asociado, si existe."),
      f("brand", "Marca", "dimension", "Marca."),
      f("asset_situation", "Situación", "dimension", "OPERATIVO, DEPRECIADO o vacío."),
      f("depreciation_method", "Método", "dimension", "Método de depreciación."),
      f("comp_date", "Fecha contable", "date", "Fecha contable original."),
      f("acquisition_date", "Fecha de adquisición", "date", "Fecha de adquisición."),
      f("operation_date", "Fecha de operación", "date", "Inicio de operación (inicio de depreciación)."),
      f("disposal_date", "Fecha de baja", "date", "Fecha de baja; vacía si sigue activo."),
      f("asset_ini_cost_usd", "Costo inicial USD", "measure", "Costo de adquisición en USD.", "number", "usd"),
      f("asset_ini_cost_pen", "Costo inicial PEN", "measure", "Costo de adquisición en PEN.", "number", "pen"),
      f("asset_final_value_usd", "Valor final USD", "measure", "Valor contable tras variaciones.", "number", "usd"),
      f("asset_final_value_pen", "Valor final PEN", "measure", "Valor contable tras variaciones.", "number", "pen"),
      f("depreciation_cum_amount_usd", "Depreciación acumulada USD", "measure", "Depreciación acumulada.", "number", "usd"),
      f("depreciation_cum_amount_pen", "Depreciación acumulada PEN", "measure", "Depreciación acumulada.", "number", "pen"),
      f("asset_balance_usd", "Saldo USD", "measure", "Valor neto en libros USD.", "number", "usd"),
      f("asset_balance_pen", "Saldo PEN", "measure", "Valor neto en libros PEN.", "number", "pen"),
      f("deprec_rate_pct", "Tasa deprec. %", "measure", "Tasa anual de depreciación.", "number", "percent"),
    ],
    metrics: [
      m("assets_count", "Activos", "Número de activos.", "count", "integer"),
      m("active_assets", "Activos sin baja", "Activos sin fecha de baja.", "count", "integer", { where: [{ field: "disposal_date", op: "empty" }] }),
      m("disposed_assets", "Activos dados de baja", "Activos con fecha de baja.", "count", "integer", { where: [{ field: "disposal_date", op: "not_empty" }] }),
      m("ini_cost_usd_total", "Costo inicial USD", "Suma del costo inicial USD.", "sum", "usd", { field: "asset_ini_cost_usd" }),
      m("ini_cost_pen_total", "Costo inicial PEN", "Suma del costo inicial PEN.", "sum", "pen", { field: "asset_ini_cost_pen" }),
      m("final_value_usd_total", "Valor final USD", "Suma del valor final USD.", "sum", "usd", { field: "asset_final_value_usd" }),
      m("final_value_pen_total", "Valor final PEN", "Suma del valor final PEN.", "sum", "pen", { field: "asset_final_value_pen" }),
      m("deprec_cum_usd_total", "Depreciación acumulada USD", "Suma de depreciación acumulada USD.", "sum", "usd", { field: "depreciation_cum_amount_usd" }),
      m("deprec_cum_pen_total", "Depreciación acumulada PEN", "Suma de depreciación acumulada PEN.", "sum", "pen", { field: "depreciation_cum_amount_pen" }),
      m("balance_usd_total", "Saldo USD", "Suma del valor neto USD.", "sum", "usd", { field: "asset_balance_usd" }),
      m("balance_pen_total", "Saldo PEN", "Suma del valor neto PEN.", "sum", "pen", { field: "asset_balance_pen" }),
      m("avg_rate_pct", "Tasa promedio %", "Promedio simple de la tasa.", "avg", "percent", { field: "deprec_rate_pct" }),
    ],
    rules: ["Los valores del catálogo son el estado actual; para evolución mensual usar la fuente de depreciación.", "La tasa es un porcentaje: se promedia, no se suma."],
    relations: [{ field: "asset_code", source: "fixassets_depreciation", targetField: "asset_code", description: "Activo → depreciación mensual." }],
    keywords: ["activo", "activos", "fijos", "catálogo", "inventario", "ubicación", "área", "ceco", "centro de costo", "saldo", "valor", "costo", "baja", "capex", "marca", "tipo"],
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
      f("period_date", "Período", "date", "Mes contable de la depreciación."),
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
    ],
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
      f("shift_date", "Fecha", "date", "Fecha de la guardia."),
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
    rules: ["Recuperaciones y leyes son ratios: se calculan sobre sumas, no se suman.", "Las recuperaciones vienen como fracción 0-1."],
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
      f("consumption_date", "Fecha de consumo", "date", "Fecha del consumo."),
      f("reagent_name", "Reactivo", "dimension", "Nombre del reactivo."),
      f("subprocess_name", "Subproceso", "dimension", "Subproceso de refinería."),
      f("consumption_qty", "Cantidad consumida", "measure", "Cantidad consumida en la unidad propia del reactivo.", "number", "decimal"),
    ],
    metrics: [
      m("consumption_total", "Consumo", "Suma de cantidad consumida.", "sum", "decimal", { field: "consumption_qty" }),
      m("campaigns_count", "Campañas", "Campañas distintas.", "count_distinct", "integer", { field: "campaign_id" }),
      m("reagents_count", "Reactivos", "Reactivos distintos.", "count_distinct", "integer", { field: "reagent_name" }),
    ],
    rules: ["Cada reactivo tiene su propia unidad: no sumar consumos de reactivos distintos en un mismo total sin agrupar por reactivo."],
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
      f("entry_date", "Fecha de ingreso", "date", "Fecha de la entrada."),
      f("reagent_name", "Reactivo", "dimension", "Nombre del reactivo."),
      f("entry_qty", "Cantidad ingresada", "measure", "Cantidad ingresada en la unidad del reactivo.", "number", "decimal"),
    ],
    metrics: [
      m("entries_total", "Ingresos", "Suma de cantidad ingresada.", "sum", "decimal", { field: "entry_qty" }),
      m("entries_count", "Registros", "Número de ingresos.", "count", "integer"),
    ],
    rules: ["Cada reactivo tiene su propia unidad."],
    keywords: ["refinería", "reactivo", "ingreso", "entrada", "almacén", "stock"],
    enabled: true,
    access: { scopes: ["refinery"] },
  },
  {
    id: "refinery_stock",
    name: "Stock de reactivos de refinería",
    area: "refinery",
    description: "Foto actual por reactivo: total ingresado, total consumido y stock disponible.",
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
    rules: ["Sin fechas: no sirve para tendencias.", "Cada reactivo tiene su propia unidad; agrupar siempre por reactivo."],
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
      f("campaign_date", "Fecha", "date", "Fecha de la campaña."),
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
      m("avg_moisture", "Humedad promedio", "Promedio simple de humedad.", "avg", "percent", { field: "campaign_moisture_pct" }),
    ],
    rules: ["Leyes y humedad se promedian, no se suman."],
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
      f("req_date", "Fecha de requerimiento", "date", "Fecha de creación del requerimiento."),
      f("po_date", "Fecha de OC", "date", "Fecha de la orden de compra."),
      f("po_est_delivery_date", "Entrega estimada", "date", "Fecha estimada de entrega."),
      f("delivery_date", "Fecha de entrega", "date", "Fecha de entrega real."),
      f("mat_code", "Código material", "attribute", "Código del material."),
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
      m("items_without_po", "Ítems sin OC", "Ítems sin orden de compra.", "count", "integer", { where: [{ field: "po_num", op: "empty" }] }),
      m("items_with_po", "Ítems con OC", "Ítems con orden de compra.", "count", "integer", { where: [{ field: "po_num", op: "not_empty" }] }),
      m("qty_requested_total", "Cantidad solicitada", "Suma de cantidades solicitadas (unidades mixtas).", "sum", "decimal", { field: "qty_requested" }),
      m("qty_delivered_total", "Cantidad entregada", "Suma de cantidades entregadas (unidades mixtas).", "sum", "decimal", { field: "qty_delivered" }),
      m("delivery_pct", "% entregado", "Entregado / solicitado.", "ratio", "fraction", { numerator: "qty_delivered", denominator: "qty_requested" }),
      m("avg_unit_price", "Precio unitario promedio", "Promedio simple del precio unitario USD.", "avg", "usd", { field: "po_unit_price_us", where: [{ field: "po_unit_price_us", op: "gt", value: 0 }] }),
      m("suppliers_count", "Proveedores", "Proveedores distintos.", "count_distinct", "integer", { field: "supplier_name" }),
    ],
    rules: ["Las cantidades tienen unidades distintas por material: sumarlas solo agrupando por material o unidad.", "No hay importe total de OC en esta fuente, solo precio unitario."],
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
      f("req_date", "Fecha de requerimiento", "date", "Fecha del requerimiento."),
      f("entry_date", "Ingreso a taller", "date", "Fecha de ingreso al taller."),
      f("exit_date", "Salida de taller", "date", "Fecha de salida del taller."),
      f("po_date", "Fecha de OC", "date", "Fecha de la orden de compra."),
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
      f("po_amount_usd", "Monto OC USD", "measure", "Importe de la OC en USD.", "number", "usd"),
      f("app_budget_pen", "Presupuesto aprobado PEN", "measure", "Presupuesto aprobado en PEN.", "number", "pen"),
      f("qty_requested", "Cantidad solicitada", "measure", "Cantidad solicitada.", "number", "decimal"),
    ],
    metrics: [
      m("items_count", "Ítems", "Número de ítems.", "count", "integer"),
      m("vehicles_count", "Vehículos", "Placas distintas.", "count_distinct", "integer", { field: "plate" }),
      m("po_amount_usd_total", "Monto OC USD", "Suma de importes de OC.", "sum", "usd", { field: "po_amount_usd" }),
      m("budget_pen_total", "Presupuesto PEN", "Suma de presupuesto aprobado.", "sum", "pen", { field: "app_budget_pen" }),
      m("avg_odometer", "Odómetro promedio", "Promedio de kilometraje.", "avg", "km", { field: "odometer_km", where: [{ field: "odometer_km", op: "gt", value: 0 }] }),
      m("max_odometer", "Odómetro máximo", "Kilometraje máximo registrado.", "max", "km", { field: "odometer_km" }),
      m("avg_shop_days", "Días en taller", "Promedio de horas entre ingreso y salida (expresado en horas).", "avg_hours_diff", "hours", { field: "entry_date", field2: "exit_date" }),
    ],
    rules: ["El presupuesto está en PEN y la OC en USD: no mezclarlos en un mismo total."],
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
    rules: ["Sin importes: solo conteos por alerta y fechas de vencimiento."],
    keywords: ["soat", "revisión técnica", "rtv", "vencimiento", "flota", "placa", "alerta"],
    enabled: true,
    access: { scopes: ["fleet_units"] },
  },

  // ── Sostenibilidad ────────────────────────────────────────────────────
  {
    id: "sustainability_padron",
    name: "Padrón de proveedores de mineral",
    area: "sustainability",
    description:
      "Padrón de proveedores de mineral por concesión: sede, ubicación, meses activos del año, formalidad, IGAFOM, RECPO, beneficio, explotación, explosivos, CIRA y estado SUNAT.",
    endpoint: "/api/sustainability/prov-padron",
    sqlView: "dw.v_sustainability_prov_padron",
    grain: "Una fila por proveedor (RUC) y concesión.",
    fields: [
      f("ruc", "RUC", "attribute", "RUC del proveedor."),
      f("miner_name", "Proveedor", "dimension", "Nombre del proveedor."),
      f("sede", "Sede", "dimension", "Sede de acopio."),
      f("department", "Departamento", "dimension", "Departamento."),
      f("province", "Provincia", "dimension", "Provincia."),
      f("district", "Distrito", "dimension", "Distrito."),
      f("concession_name", "Concesión", "dimension", "Concesión minera."),
      f("formal_flag", "Formal", "dimension", "Condición de formalidad."),
      f("igafom_status", "Estado IGAFOM", "dimension", "Estado del IGAFOM."),
      f("benef_flag", "Beneficio", "dimension", "Autorización de beneficio."),
      f("explot_flag", "Explotación", "dimension", "Autorización de explotación."),
      f("recpo_flag", "RECPO", "dimension", "Registro RECPO."),
      f("explosive_auth_flag", "Explosivos", "dimension", "Autorización de explosivos."),
      f("cira_flag", "CIRA", "dimension", "Certificado CIRA."),
      f("terrain_flag", "Terreno", "dimension", "Acreditación de terreno."),
      f("sunat_status", "Estado SUNAT", "dimension", "Estado del RUC en SUNAT."),
      f("active_this_month", "Activo este mes", "dimension", "Si entregó mineral en el mes actual."),
      f("qty_months_active", "Meses activos", "measure", "Meses del año con entregas.", "number", "integer"),
    ],
    metrics: [
      m("rows_count", "Proveedor-concesión", "Número de combinaciones proveedor-concesión.", "count", "integer"),
      m("suppliers_count", "Proveedores", "Proveedores distintos.", "count_distinct", "integer", { field: "ruc" }),
      m("concessions_count", "Concesiones", "Concesiones distintas.", "count_distinct", "integer", { field: "concession_name" }),
      m("avg_months_active", "Meses activos promedio", "Promedio de meses activos.", "avg", "decimal", { field: "qty_months_active" }),
    ],
    rules: ["Sin fechas ni importes: sirve para conteos y distribuciones por condición.", "Datos de contacto del proveedor no están disponibles en V-Ai."],
    keywords: ["padrón", "padron", "proveedor", "proveedores", "formal", "igafom", "recpo", "concesión", "sunat", "sostenibilidad", "minero"],
    enabled: true,
    access: { scopes: ["sustainability"] },
  },
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
