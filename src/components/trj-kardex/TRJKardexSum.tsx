"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import {
  ExcelHeaderFilter,
  useExcelColumnFilters,
  type ExcelColumnDef,
  type ExcelFilterKind,
} from "../ui/ExcelFilters";
import {
  isOperationalLot,
  kardexDecimal,
  kardexFormat as fmt,
  kardexStatistics,
  lotKey,
  type KardexGuide,
  type KardexInvoice,
  type KardexLot,
  type KardexPeriod,
  type KardexPeriodStats,
} from "../../lib/trjKardex";
import {
  CHART_COLORS,
  CHART_OTHER,
  ColumnChart,
  DonutChart,
  LineChart,
  RankChart,
  type ChartRow,
  type DonutItem,
} from "./KardexCharts";

type LotStatus =
  | "Sin valorización"
  | "Sin pago"
  | "No enviado"
  | "En ruta"
  | "Finalizado";

type SummaryStatus =
  | "Sin pago"
  | "No enviado"
  | "En ruta"
  | "Finalizado";

type PaymentStatus =
  | "Sin valorización"
  | "Con valorización";

type SummaryRow = {
  lot: string;
  lot_corr: string | null;
  entry_year: string | number | null;
  entry_month: string | number | null;
  summary_tmh: string | number | null;
  lot_status: LotStatus;
  summary_status: SummaryStatus;
  payment_status: PaymentStatus | null;
  aging_days: string | number | null;
  entry_date: string | null;
  process_date: string | null;
  valuation_date: string | null;
  sack_qty: string | number | null;
  miner_name: string | null;
  plate: string | null;
  ruc: string | null;
  concession_name: string | null;
  concession_code: string | null;
  district: string | null;
  province: string | null;
  department: string | null;
  sender_guide_number: string | null;
  transport_name: string | null;
  transport_guide_number: string | null;
  zone_1: string | null;
  zone_2: string | null;
  tmh: string | number | null;
  h2o: string | number | null;
  tms: string | number | null;
  au_grade_oztc: string | number | null;
  ag_grade_oztc: string | number | null;
  cu_grade_pct: string | number | null;
  au_oz: string | number | null;
  ag_oz: string | number | null;
  au_rec: string | number | null;
  ag_rec: string | number | null;
  pio: string | number | null;
  pip: string | number | null;
  pio_disc: string | number | null;
  maquila: string | number | null;
  nacn: string | number | null;
  escalador: string | number | null;
  usd_tms: string | number | null;
  au_usd: string | number | null;
  ag_usd: string | number | null;
  pay_type: string | null;
  doc_date: string | null;
  doc_number: string | null;
  lot_usd: string | number | null;
  payment_date: string | null;
  traceability_updated_at: string | null;
  guide_number: string | null;
  tmh_departure: string | number | null;
  tmh_arrival: string | number | null;
  bags_tot: string | number | null;
  bags_used: string | number | null;
  balance_obs: string | null;
  tmh_balance: string | number | null;
  guide_date: string | null;
  trjkar_transport_guide_number: string | null;
  transport_guide_date: string | null;
  trjkar_transport_name: string | null;
  transport_ruc: string | null;
  driver_name: string | null;
  drive_license: string | null;
  plate_1: string | null;
  plate_2: string | null;
  sender_name: string | null;
  sender_ruc: string | null;
  recipient_name: string | null;
  recipient_ruc: string | null;
  origin_district: string | null;
  origin_province: string | null;
  origin_department: string | null;
  origin_address: string | null;
  destination_district: string | null;
  destination_province: string | null;
  destination_department: string | null;
  destination_address: string | null;
  load_ini: string | null;
  load_fin: string | null;
  departure_date: string | null;
  arrival_date: string | null;
  pu_transport_usd: string | number | null;
  amount_usd: string | number | null;
  trjkar_document_number: string | null;
  guide_status_name: string | null;
  invoice_document_date: string | null;
  invoice_amount_usd_web: string | number | null;
  subledger_num: string | null;
  comp_num: string | null;
  secu_num: string | null;
  invoice_amount_usd_con: string | number | null;
  control_status_desc: string | null;
  control_status_comment: string | null;
  control_comment_count: string | number | null;
  control_created_at: string | null;
  control_updated_at: string | null;
  [key: string]: string | number | null;
};

type HistoryRow = {
  lot: string;
  lot_corr: string | null;
  guide_number: string | null;
  status_desc: string;
  status_comment: string;
  created_at: string | null;
  updated_at: string | null;
};

type BalanceControlRow = {
  lot: string;
  lot_corr: string;
  guide_number: string | null;
  guide_date: string | null;
  transport_guide_number: string | null;
  transport_name: string | null;
  transport_ruc: string | null;
  guide_status_name: string | null;
  departure_date: string | null;
  arrival_date: string | null;
  tmh_departure: string | number | null;
  tmh_arrival: string | number | null;
  bags_tot: string | number | null;
  bags_used: string | number | null;
  balance_obs: string | null;
  created_at: string | null;
  updated_at: string | null;
  [key: string]: string | number | null;
};

type ControlDraft = {
  status_desc: string;
  status_comment: string;
};

type Kpi = {
  label: string;
  value: string;
  note: string;
  tip: [string, string][];
};

type KpiTrend = {
  label: string;
  values: (number | null)[];
};

const LOT_STATUS_ORDER: SummaryStatus[] = [
  "Sin pago",
  "No enviado",
  "En ruta",
  "Finalizado",
];

const PAYMENT_STATUS_ORDER: PaymentStatus[] = [
  "Sin valorización",
  "Con valorización",
];

const CONTROL_STATUS_OPTIONS = [
  "PENDIENTE",
  "LIQUIDADO",
  "VALORIZADO",
  "PM",
] as const;

const WEEKDAYS = [
  "Lun",
  "Mar",
  "Mié",
  "Jue",
  "Vie",
  "Sáb",
  "Dom",
];

const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const summaryColumnSpecs: [string, string, ExcelFilterKind?][] = [
  ["lot", "Lote"],
  ["entry_year", "Año", "number"],
  ["entry_month", "Mes", "number"],
  ["summary_tmh", "TMH", "number"],
  ["miner_name", "Minero / proveedor"],
  ["entry_date", "Fecha ingreso", "date"],
  ["lot_status", "Status"],
  ["payment_date", "Fecha pago", "date"],
  ["departure_date", "Fecha salida", "date"],
  ["guide_number", "Guía remitente"],
  ["trjkar_transport_guide_number", "Guía transportista"],
  ["tmh", "TMH ingreso", "number"],
  ["tmh_departure", "TMH salida", "number"],
  ["control_status_desc", "Status desc"],
  ["control_status_comment", "Status comment"],
  ["aging_days", "Aging (días)", "number"],
  ["lot_corr", "Corr."],
  ["summary_status", "Grupo status"],
  ["payment_status", "Clasificación pago"],
  ["guide_date", "Fecha guía remitente", "date"],
  ["process_date", "Proceso", "date"],
  ["valuation_date", "Valorización", "date"],
  ["ruc", "RUC minero"],
  ["concession_name", "Concesión"],
  ["concession_code", "Código concesión"],
  ["tms", "TMS", "number"],
  ["au_grade_oztc", "Ley Au", "number"],
  ["doc_number", "Documento pago"],
  ["tmh_arrival", "TMH llegada", "number"],
  ["tmh_balance", "Saldo SGM", "number"],
  ["trjkar_transport_name", "Transportista TRJ"],
  ["transport_ruc", "RUC transportista"],
  ["arrival_date", "Llegada", "date"],
  ["trjkar_document_number", "Factura transporte"],
  ["invoice_amount_usd_web", "USD factura web", "number"],
  ["invoice_amount_usd_con", "USD factura Concar", "number"],
];

const summaryColumns: ExcelColumnDef<SummaryRow>[] =
  summaryColumnSpecs.map(
    ([key, label, kind]) => ({
      key,
      label,
      kind,
      value: (row) =>
        kind === "date"
          ? String(row[key] ?? "").slice(0, 10)
          : row[key],
    }),
  );

const SUMMARY_COLUMN_KEYS_BY_STATUS: Record<SummaryStatus, string[]> = {
  "Sin pago": [
    "lot",
    "entry_year",
    "entry_month",
    "summary_tmh",
    "miner_name",
    "entry_date",
    "lot_status",
    "payment_status",
    "valuation_date",
    "tmh",
    "tms",
    "au_grade_oztc",
    "aging_days",
    "control_status_desc",
    "control_status_comment",
  ],
  "No enviado": [
    "lot",
    "entry_year",
    "entry_month",
    "summary_tmh",
    "miner_name",
    "entry_date",
    "lot_status",
    "payment_date",
    "tmh",
    "doc_number",
    "aging_days",
    "control_status_desc",
    "control_status_comment",
  ],
  "En ruta": [
    "lot",
    "entry_year",
    "entry_month",
    "summary_tmh",
    "miner_name",
    "entry_date",
    "lot_status",
    "payment_date",
    "departure_date",
    "guide_number",
    "trjkar_transport_guide_number",
    "tmh",
    "tmh_departure",
    "tmh_balance",
    "aging_days",
    "control_status_desc",
    "control_status_comment",
  ],
  "Finalizado": [
    "lot",
    "entry_year",
    "entry_month",
    "summary_tmh",
    "miner_name",
    "entry_date",
    "lot_status",
    "payment_date",
    "departure_date",
    "guide_number",
    "trjkar_transport_guide_number",
    "tmh",
    "tmh_departure",
    "tmh_arrival",
    "tmh_balance",
    "arrival_date",
    "trjkar_document_number",
    "invoice_amount_usd_web",
    "invoice_amount_usd_con",
    "aging_days",
    "control_status_desc",
    "control_status_comment",
  ],
};

const EXPORT_LABELS: Record<string, string> = {
  lot: "Lote",
  lot_corr: "Correlativo",
  entry_year: "Año",
  entry_month: "Mes",
  summary_tmh: "TMH",
  lot_status: "Status",
  summary_status: "Grupo status",
  payment_status: "Clasificación pago",
  aging_days: "Aging (días)",
  entry_date: "Fecha ingreso",
  process_date: "Fecha proceso",
  valuation_date: "Fecha valorización",
  sack_qty: "Sacos",
  miner_name: "Minero",
  plate: "Placa ingreso",
  ruc: "RUC minero",
  concession_name: "Concesión",
  concession_code: "Código concesión",
  district: "Distrito",
  province: "Provincia",
  department: "Departamento",
  sender_guide_number: "Guía remitente origen",
  transport_name: "Transportista ingreso",
  transport_guide_number: "Guía transportista ingreso",
  zone_1: "Zona 1",
  zone_2: "Zona 2",
  tmh: "TMH SGM",
  h2o: "H2O",
  tms: "TMS",
  au_grade_oztc: "Ley Au",
  ag_grade_oztc: "Ley Ag",
  cu_grade_pct: "Ley Cu",
  au_oz: "Oz Au",
  ag_oz: "Oz Ag",
  au_rec: "Recuperación Au",
  ag_rec: "Recuperación Ag",
  pio: "PIO",
  pip: "PIP",
  pio_disc: "PIO descuento",
  maquila: "Maquila",
  nacn: "NaCN",
  escalador: "Escalador",
  usd_tms: "USD/TMS",
  au_usd: "USD Au",
  ag_usd: "USD Ag",
  pay_type: "Tipo pago",
  doc_date: "Fecha documento pago",
  doc_number: "Documento pago",
  lot_usd: "USD lote",
  payment_date: "Fecha pago",
  guide_number: "Guía TRJ",
  tmh_departure: "TMH salida",
  tmh_arrival: "TMH llegada",
  bags_tot: "Sacos totales",
  bags_used: "Sacos usados",
  balance_obs: "Observación saldo",
  tmh_balance: "Saldo SGM",
  guide_date: "Fecha guía remitente",
  trjkar_transport_guide_number: "Guía transportista TRJ",
  transport_guide_date: "Fecha guía transportista",
  trjkar_transport_name: "Transportista TRJ",
  transport_ruc: "RUC transportista",
  driver_name: "Conductor",
  drive_license: "Licencia",
  plate_1: "Placa camión",
  plate_2: "Placa carroza",
  sender_name: "Remitente",
  sender_ruc: "RUC remitente",
  recipient_name: "Destinatario",
  recipient_ruc: "RUC destinatario",
  origin_district: "Distrito origen",
  origin_province: "Provincia origen",
  origin_department: "Departamento origen",
  origin_address: "Dirección origen",
  destination_district: "Distrito destino",
  destination_province: "Provincia destino",
  destination_department: "Departamento destino",
  destination_address: "Dirección destino",
  load_ini: "Inicio carga",
  load_fin: "Fin carga",
  departure_date: "Salida",
  arrival_date: "Llegada",
  pu_transport_usd: "USD/TMH transporte",
  amount_usd: "USD guía",
  trjkar_document_number: "Factura transporte",
  guide_status_name: "Estado guía",
  invoice_document_date: "Fecha factura transporte",
  invoice_amount_usd_web: "USD factura web",
  subledger_num: "Subdiario",
  comp_num: "Comprobante",
  secu_num: "Secuencia",
  invoice_amount_usd_con: "USD factura Concar",
  control_status_desc: "Status desc",
  control_status_comment: "Status comment",
  control_comment_count: "Cantidad comentarios",
  control_created_at: "Creado control",
  control_updated_at: "Actualizado control",
  created_at: "Creado",
  updated_at: "Actualizado",
};

const EXPORT_NUMERIC = new Set([
  "entry_year",
  "entry_month",
  "summary_tmh",
  "aging_days",
  "sack_qty",
  "tmh",
  "h2o",
  "tms",
  "au_grade_oztc",
  "ag_grade_oztc",
  "cu_grade_pct",
  "au_oz",
  "ag_oz",
  "au_rec",
  "ag_rec",
  "pio",
  "pip",
  "pio_disc",
  "maquila",
  "nacn",
  "escalador",
  "usd_tms",
  "au_usd",
  "ag_usd",
  "lot_usd",
  "tmh_departure",
  "tmh_arrival",
  "bags_tot",
  "bags_used",
  "tmh_balance",
  "pu_transport_usd",
  "amount_usd",
  "invoice_amount_usd_web",
  "invoice_amount_usd_con",
  "control_comment_count",
]);

const isExceLot = (row: KardexLot) =>
  row.lot_corr.trim().toUpperCase() === "EXCE";

const isCountableLot = (row: KardexLot) =>
  isOperationalLot(row) &&
  !isExceLot(row);

const dateTime = (
  value:
    | string
    | null
    | undefined
) =>
  value
    ?.replace("T", " ")
    .slice(0, 16)
  || "—";

function periodLabel(
  key: string,
  period: KardexPeriod,
) {
  const match =
    key.match(
      /^(\d{4})-(\d{2})(?:-(\d{2}))?/
    );

  if (!match) {
    return key;
  }

  const month =
    MONTHS[
      Number(match[2]) - 1
    ]
    ?? match[2];

  if (period === "month") {
    return `${month} ${match[1]}`;
  }

  const text =
    `${match[3]} ${month}`;

  return period === "week"
    ? `sem ${text}`
    : text;
}

function controlKey(
  row: {
    lot: string;
    lot_corr:
      | string
      | null;
    guide_number:
      | string
      | null;
  }
) {
  return JSON.stringify([
    row.lot,
    row.lot_corr || "",
    row.guide_number || "",
  ]);
}

function parseSqlDate(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return null;
  }

  const text =
    value.trim();

  if (!text) {
    return null;
  }

  const normalized =
    /^\d{4}-\d{2}-\d{2}$/.test(
      text
    )
      ? `${text}T00:00:00`
      : text;

  const timestamp =
    Date.parse(
      normalized
    );

  return Number.isFinite(
    timestamp
  )
    ? timestamp
    : null;
}

function elapsedDays(
  start:
    | string
    | null
    | undefined,
  end?:
    | string
    | null
    | undefined,
) {
  const startMs =
    parseSqlDate(
      start
    );

  const endMs =
    end
      ? parseSqlDate(end)
      : Date.now();

  if (
    startMs == null ||
    endMs == null ||
    endMs < startMs
  ) {
    return null;
  }

  return (
    endMs -
    startMs
  ) / 86400000;
}

function stageAgingDays(
  row: SummaryRow
) {
  const apiAging =
    row.aging_days == null ||
    row.aging_days === ""
      ? null
      : Number(
          row.aging_days
        );

  if (
    apiAging != null &&
    Number.isFinite(
      apiAging
    )
  ) {
    return apiAging;
  }

  switch (
    row.lot_status
  ) {
    case "Sin valorización":
      return elapsedDays(
        row.entry_date
      );

    case "Sin pago":
      return elapsedDays(
        row.valuation_date
        || row.process_date
        || row.entry_date
      );

    case "No enviado":
      return elapsedDays(
        row.payment_date
        || row.doc_date
        || row.valuation_date
        || row.entry_date
      );

    case "En ruta":
      return elapsedDays(
        row.departure_date
        || row.guide_date
      );

    case "Finalizado":
      return elapsedDays(
        row.departure_date
        || row.guide_date,
        row.arrival_date
      );

    default:
      return null;
  }
}

function exportCell(
  key: string,
  value: unknown,
) {
  if (
    value == null ||
    value === ""
  ) {
    return "";
  }

  if (
    typeof value ===
    "number"
  ) {
    return value;
  }

  const raw =
    String(value);

  if (
    EXPORT_NUMERIC.has(key) &&
    Number.isFinite(
      Number(raw)
    )
  ) {
    return Number(raw);
  }

  if (
    /^\d{4}-\d{2}-\d{2}T/.test(
      raw
    )
  ) {
    const text =
      raw
        .replace("T", " ")
        .slice(0, 19);

    return text.endsWith(
      " 00:00:00"
    )
      ? text.slice(0, 10)
      : text;
  }

  return raw;
}

function exportRowsExcel(
  rows: Record<
    string,
    unknown
  >[],
  fileName: string,
  sheetName: string,
) {
  if (!rows.length) {
    return false;
  }

  const keys = [
    ...new Set(
      rows.flatMap(
        (row) =>
          Object.keys(row)
      )
    ),
  ];

  const data =
    rows.map(
      (row) =>
        Object.fromEntries(
          keys.map(
            (key) => [
              EXPORT_LABELS[key]
              || key,
              exportCell(
                key,
                row[key]
              ),
            ]
          )
        )
    );

  const ws =
    XLSX.utils
      .json_to_sheet(
        data
      );

  ws["!cols"] =
    keys.map(
      (key) => ({
        wch: Math.min(
          42,
          Math.max(
            (
              EXPORT_LABELS[key]
              || key
            ).length + 2,
            ...rows.map(
              (row) =>
                String(
                  exportCell(
                    key,
                    row[key]
                  )
                ).length + 2
            )
          )
        ),
      })
    );

  if (ws["!ref"]) {
    ws["!autofilter"] = {
      ref: ws["!ref"],
    };
  }

  const wb =
    XLSX.utils
      .book_new();

  XLSX.utils
    .book_append_sheet(
      wb,
      ws,
      sheetName
    );

  XLSX.writeFile(
    wb,
    fileName
  );

  return true;
}

function formatHistoryDay(
  value:
    | string
    | null
) {
  const day =
    String(value || "")
      .slice(0, 10);

  const match =
    day.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  return match
    ? `${match[3]}/${match[2]}/${match[1]}`
    : day;
}

function KpiCard({
  label,
  value,
  note,
  tip,
  trend,
  loading,
}: Kpi & {
  loading: boolean;
  trend?: KpiTrend;
}) {
  const trendValues =
    (
      trend?.values
      || []
    ).filter(
      (
        item
      ): item is number =>
        item != null &&
        Number.isFinite(item)
    );

  const sparkWidth = 220;
  const sparkHeight = 54;
  const sparkPad = 4;

  const min =
    trendValues.length
      ? Math.min(
          ...trendValues
        )
      : 0;

  const max =
    trendValues.length
      ? Math.max(
          ...trendValues
        )
      : 0;

  const span =
    max - min;

  const spark =
    trendValues.length > 1
      ? trendValues.map(
          (
            item,
            index
          ) => ({
            x:
              sparkPad +
              (
                index *
                (
                  sparkWidth -
                  sparkPad * 2
                )
              ) /
                (
                  trendValues.length -
                  1
                ),
            y:
              span === 0
                ? sparkHeight / 2
                : sparkHeight -
                  sparkPad -
                  (
                    (
                      item -
                      min
                    ) /
                    span
                  ) *
                    (
                      sparkHeight -
                      sparkPad * 2
                    ),
          })
        )
      : [];

  const sparkPoints =
    spark
      .map(
        ({
          x,
          y,
        }) =>
          `${x.toFixed(1)},${y.toFixed(1)}`
      )
      .join(" ");

  const areaPoints =
    spark.length
      ? `${spark[0].x.toFixed(1)},${sparkHeight - sparkPad} ${sparkPoints} ${spark[spark.length - 1].x.toFixed(1)},${sparkHeight - sparkPad}`
      : "";

  const lastPoint =
    spark[
      spark.length - 1
    ];

  return (
    <div
      className="trjk-kpi"
      data-tip="true"
    >
      <span>
        {label}
      </span>
      <strong>
        {loading
          ? "…"
          : value}
      </strong>
      <small>
        {note}
      </small>
      <div
        className="trjk-tip trjk-kpi-tip"
        role="tooltip"
      >
        <header>
          {label}
        </header>
        {spark.length > 1 && (
          <div className="trjk-kpi-trend">
            <div className="trjk-kpi-trend-head">
              <span>
                {trend?.label}
              </span>
              <small>
                {trendValues.length} puntos
              </small>
            </div>
            <svg
              viewBox={`0 0 ${sparkWidth} ${sparkHeight}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polygon
                className="trjk-kpi-spark-area"
                points={areaPoints}
              />
              <polyline
                className="trjk-kpi-spark-line"
                points={sparkPoints}
              />
              {lastPoint && (
                <circle
                  className="trjk-kpi-spark-dot"
                  cx={lastPoint.x}
                  cy={lastPoint.y}
                  r="2.8"
                />
              )}
            </svg>
          </div>
        )}
        {tip.map(
          ([
            name,
            amount,
          ]) => (
            <div key={name}>
              <span>
                {name}
              </span>
              <strong>
                {loading
                  ? "…"
                  : amount}
              </strong>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function GuideDetailPanel({
  label,
  rows,
  emptyHint,
  onClear,
}: {
  label:
    | string
    | null;
  rows: KardexGuide[];
  emptyHint: string;
  onClear: () => void;
}) {
  if (!label) {
    return (
      <p className="trjk-chart-hint">
        {emptyHint}
      </p>
    );
  }

  return (
    <div className="trjk-guide-lots">
      <div className="trjk-toolbar">
        <div className="trjk-guide-lots-head">
          <strong>
            {label}
          </strong>
          <span>
            {rows.length} guías en los filtros actuales
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
        >
          Quitar selección
        </Button>
      </div>

      {rows.length ? (
        <div className="trjk-table-scroll">
          <table>
            <thead>
              <tr>
                <th>
                  Guía
                </th>
                <th>
                  Guía transportista
                </th>
                <th>
                  Transportista
                </th>
                <th>
                  Fecha guía
                </th>
                <th>
                  Salida
                </th>
                <th>
                  TMH salida
                </th>
                <th>
                  Llegada
                </th>
                <th>
                  TMH llegada
                </th>
                <th>
                  USD/TMH
                </th>
                <th>
                  USD guía
                </th>
                <th>
                  Factura
                </th>
                <th>
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(
                (guide) => (
                  <tr
                    key={
                      guide.guide_number
                    }
                  >
                    <td>
                      {guide.guide_number}
                    </td>
                    <td>
                      {guide.transport_guide_number || "—"}
                    </td>
                    <td>
                      {guide.transport_name
                        || guide.transport_ruc
                        || "—"}
                    </td>
                    <td>
                      {dateTime(
                        guide.guide_date
                      )}
                    </td>
                    <td>
                      {dateTime(
                        guide.departure_date
                      )}
                    </td>
                    <td>
                      {fmt(
                        guide.tmh_departure,
                        3
                      )}
                    </td>
                    <td>
                      {dateTime(
                        guide.arrival_date
                      )}
                    </td>
                    <td>
                      {fmt(
                        guide.tmh_arrival,
                        3
                      )}
                    </td>
                    <td>
                      {fmt(
                        guide.pu_transport_usd,
                        2
                      )}
                    </td>
                    <td>
                      {fmt(
                        guide.amount_usd,
                        2
                      )}
                    </td>
                    <td>
                      {guide.document_number
                        || "—"}
                    </td>
                    <td>
                      {guide.status_name
                        || "—"}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="trjk-chart-hint">
          No hay guías de esta selección con los filtros actuales.
        </p>
      )}
    </div>
  );
}

export default function TRJKardexSum() {
  const [
    rows,
    setRows,
  ] =
    useState<KardexLot[]>(
      []
    );

  const [
    guides,
    setGuides,
  ] =
    useState<KardexGuide[]>(
      []
    );

  const [
    invoices,
    setInvoices,
  ] =
    useState<KardexInvoice[]>(
      []
    );

  const [
    summaryRows,
    setSummaryRows,
  ] =
    useState<SummaryRow[]>(
      []
    );

  const [
    historyRows,
    setHistoryRows,
  ] =
    useState<HistoryRow[]>(
      []
    );

  const [
    balanceRows,
    setBalanceRows,
  ] =
    useState<BalanceControlRow[]>(
      []
    );

  const [
    view,
    setView,
  ] =
    useState<
      | "summary"
      | "stats"
      | "balance"
    >(
      "summary"
    );

  const [
    period,
    setPeriod,
  ] =
    useState<KardexPeriod>(
      "day"
    );

  const [
    from,
    setFrom,
  ] =
    useState("");

  const [
    to,
    setTo,
  ] =
    useState("");

  const [
    ruc,
    setRuc,
  ] =
    useState("");

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    page,
    setPage,
  ] =
    useState(1);

  const [
    selectedLotStatus,
    setSelectedLotStatus,
  ] =
    useState<
      | SummaryStatus
      | "TODOS"
    >(
      "TODOS"
    );

  const [
    selectedPaymentStatus,
    setSelectedPaymentStatus,
  ] =
    useState<
      | PaymentStatus
      | "TODOS"
    >(
      "TODOS"
    );

  const [
    selectedGuide,
    setSelectedGuide,
  ] =
    useState<
      string
      | null
    >(
      null
    );

  const [
    selectedGuideStatus,
    setSelectedGuideStatus,
  ] =
    useState<
      string
      | null
    >(
      "Sin factura"
    );

  const [
    selectedCarrier,
    setSelectedCarrier,
  ] =
    useState<
      string
      | null
    >(
      null
    );

  const [
    controlDrafts,
    setControlDrafts,
  ] =
    useState<
      Record<
        string,
        ControlDraft
      >
    >(
      {}
    );

  const [
    savingControlKey,
    setSavingControlKey,
  ] =
    useState<
      string
      | null
    >(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const responses =
            await Promise.all([
              apiGet(
                "/api/trjkar"
              ),
              apiGet(
                "/api/trjkar/guides"
              ),
              apiGet(
                "/api/trjkar/invo"
              ),
              apiGet(
                "/api/trjkar/lots-control/sum"
              ),
              apiGet(
                "/api/trjkar/lots-control"
              ),
              apiGet(
                "/api/trjkar/lots-balance-control"
              ),
            ]);

          for (
            const response
            of responses
          ) {
            if (
              !Array.isArray(
                response?.rows
              )
            ) {
              throw new Error(
                "Respuesta de Kardex inválida"
              );
            }
          }

          setRows(
            responses[0].rows
          );

          setGuides(
            responses[1].rows
          );

          setInvoices(
            responses[2].rows
          );

          setSummaryRows(
            responses[3].rows
          );

          setHistoryRows(
            responses[4].rows
          );

          setBalanceRows(
            responses[5].rows
          );
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo cargar el resumen"
          );
        } finally {
          setLoading(false);
        }
      },
      []
    );

  useEffect(
    () => {
      void load();
    },
    [load]
  );

  const withinGuideDate =
    useCallback(
      (
        value:
          | string
          | null
          | undefined
      ) => {
        if (
          !from &&
          !to
        ) {
          return true;
        }

        const date =
          String(
            value || ""
          ).slice(
            0,
            10
          );

        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(
            date
          )
        ) {
          return false;
        }

        return (
          (
            !from ||
            date >= from
          ) &&
          (
            !to ||
            date <= to
          )
        );
      },
      [
        from,
        to,
      ]
    );

  const filtered =
    useMemo(
      () => {
        const needle =
          search
            .trim()
            .toUpperCase();

        const summaryMatches =
          (
            row: SummaryRow
          ) =>
            !needle ||
            [
              row.lot,
              row.lot_corr,
              row.lot_status,
              row.guide_number,
              row.trjkar_transport_guide_number,
              row.trjkar_transport_name,
              row.transport_ruc,
              row.trjkar_document_number,
              row.doc_number,
              row.miner_name,
              row.ruc,
              row.control_status_desc,
              row.control_status_comment,
            ]
              .map(
                (value) =>
                  String(
                    value || ""
                  )
              )
              .join(" ")
              .toUpperCase()
              .includes(
                needle
              );

        const balanceMatches =
          (
            row: BalanceControlRow
          ) =>
            !needle ||
            [
              row.lot,
              row.lot_corr,
              row.guide_number,
              row.transport_guide_number,
              row.transport_name,
              row.transport_ruc,
              row.balance_obs,
            ]
              .map(
                (value) =>
                  String(
                    value || ""
                  )
              )
              .join(" ")
              .toUpperCase()
              .includes(
                needle
              );

        const oldLotMatches =
          (
            row: KardexLot
          ) =>
            !needle ||
            [
              row.guide_number,
              row.lot,
              row.lot_corr,
              row.document_number,
              row.transport_name,
              row.transport_ruc,
            ]
              .map(
                (value) =>
                  String(
                    value || ""
                  )
              )
              .join(" ")
              .toUpperCase()
              .includes(
                needle
              );

        const matchingGuides =
          new Set<string>();

        if (needle) {
          for (
            const row
            of rows
          ) {
            if (
              oldLotMatches(row)
            ) {
              matchingGuides.add(
                row.guide_number
              );
            }
          }

          for (
            const row
            of summaryRows
          ) {
            if (
              row.guide_number &&
              summaryMatches(row)
            ) {
              matchingGuides.add(
                row.guide_number
              );
            }
          }

          for (
            const row
            of balanceRows
          ) {
            if (
              row.guide_number &&
              balanceMatches(row)
            ) {
              matchingGuides.add(
                row.guide_number
              );
            }
          }
        }

        const selectedGuides =
          guides.filter(
            (guide) =>
              (
                !ruc ||
                guide.transport_ruc ===
                  ruc
              ) &&
              withinGuideDate(
                guide.guide_date
              ) &&
              (
                !needle ||
                matchingGuides.has(
                  guide.guide_number
                ) ||
                [
                  guide.guide_number,
                  guide.transport_guide_number,
                  guide.document_number,
                  guide.transport_name,
                  guide.transport_ruc,
                ]
                  .map(
                    (value) =>
                      String(
                        value || ""
                      )
                  )
                  .join(" ")
                  .toUpperCase()
                  .includes(
                    needle
                  )
              )
          );

        const guideSet =
          new Set(
            selectedGuides.map(
              (guide) =>
                guide.guide_number
            )
          );

        const invoiceSet =
          new Set(
            selectedGuides
              .filter(
                (guide) =>
                  guide.transport_ruc &&
                  guide.document_number
              )
              .map(
                (guide) =>
                  JSON.stringify([
                    guide.transport_ruc,
                    guide.document_number,
                  ])
              )
          );

        const selectedSummary =
          summaryRows.filter(
            (row) =>
              (
                !ruc ||
                row.transport_ruc ===
                  ruc
              ) &&
              withinGuideDate(
                row.guide_date
              ) &&
              summaryMatches(
                row
              )
          );

        const selectedBalance =
          balanceRows.filter(
            (row) =>
              (
                !ruc ||
                row.transport_ruc ===
                  ruc
              ) &&
              withinGuideDate(
                row.guide_date
              ) &&
              balanceMatches(
                row
              )
          );

        return {
          guides:
            selectedGuides,
          rows:
            rows.filter(
              (row) =>
                guideSet.has(
                  row.guide_number
                ) &&
                isCountableLot(
                  row
                )
            ),
          invoices:
            invoices.filter(
              (invoice) =>
                invoiceSet.has(
                  JSON.stringify([
                    invoice.ruc,
                    invoice.document_number,
                  ])
                )
            ),
          summary:
            selectedSummary,
          balance:
            selectedBalance,
        };
      },
      [
        rows,
        guides,
        invoices,
        summaryRows,
        balanceRows,
        ruc,
        search,
        withinGuideDate,
      ]
    );

  const statusCounts =
    useMemo(
      () =>
        Object.fromEntries(
          LOT_STATUS_ORDER.map(
            (status) => [
              status,
              filtered.summary.filter(
                (row) =>
                  row.summary_status ===
                  status
              ).length,
            ]
          )
        ) as Record<
          SummaryStatus,
          number
        >,
      [
        filtered.summary,
      ]
    );

  const paymentStatusCounts =
    useMemo(
      () =>
        Object.fromEntries(
          PAYMENT_STATUS_ORDER.map(
            (status) => [
              status,
              filtered.summary.filter(
                (row) =>
                  row.summary_status ===
                    "Sin pago" &&
                  row.payment_status ===
                    status
              ).length,
            ]
          )
        ) as Record<
          PaymentStatus,
          number
        >,
      [
        filtered.summary,
      ]
    );

  const statusRows =
    useMemo(
      () => {
        const rowsByStatus =
          selectedLotStatus ===
          "TODOS"
            ? filtered.summary
            : filtered.summary.filter(
                (row) =>
                  row.summary_status ===
                  selectedLotStatus
              );

        const rowsByPayment =
          selectedLotStatus ===
            "Sin pago" &&
          selectedPaymentStatus !==
            "TODOS"
            ? rowsByStatus.filter(
                (row) =>
                  row.payment_status ===
                  selectedPaymentStatus
              )
            : rowsByStatus;

        return [
          ...rowsByPayment,
        ].sort(
          (a, b) =>
            Number(
              b.aging_days
              ?? -1
            ) -
              Number(
                a.aging_days
                ?? -1
              ) ||
            String(
              a.entry_date
              || ""
            ).localeCompare(
              String(
                b.entry_date
                || ""
              )
            )
        );
      },
      [
        filtered.summary,
        selectedLotStatus,
        selectedPaymentStatus,
      ]
    );

  const visibleSummaryColumns =
    useMemo(
      () => {
        if (
          selectedLotStatus ===
          "TODOS"
        ) {
          return summaryColumns;
        }

        const visibleKeys =
          new Set(
            SUMMARY_COLUMN_KEYS_BY_STATUS[
              selectedLotStatus
            ]
          );

        return summaryColumns.filter(
          (column) =>
            visibleKeys.has(
              column.key
            )
        );
      },
      [
        selectedLotStatus,
      ]
    );

  const summaryExcel =
    useExcelColumnFilters(
      statusRows,
      visibleSummaryColumns
    );

  const pages =
    Math.max(
      1,
      Math.ceil(
        summaryExcel
          .rows
          .length /
          50
      )
    );

  const currentPage =
    Math.min(
      page,
      pages
    );

  const historyByLot =
    useMemo(
      () => {
        const buckets =
          new Map<
            string,
            HistoryRow[]
          >();

        for (
          const row
          of historyRows
        ) {
          const lot =
            String(
              row.lot || ""
            )
              .trim()
              .toUpperCase();

          if (!lot) {
            continue;
          }

          if (
            !buckets.has(
              lot
            )
          ) {
            buckets.set(
              lot,
              []
            );
          }

          buckets
            .get(lot)!
            .push(row);
        }

        const result =
          new Map<
            string,
            HistoryRow[]
          >();

        for (
          const [
            lot,
            records,
          ]
          of buckets
        ) {
          const sorted =
            [
              ...records,
            ].sort(
              (
                a,
                b
              ) =>
                String(
                  b.updated_at
                  || b.created_at
                  || ""
                ).localeCompare(
                  String(
                    a.updated_at
                    || a.created_at
                    || ""
                  )
                )
            );

          const perDay =
            new Map<
              string,
              HistoryRow
            >();

          for (
            const record
            of sorted
          ) {
            const timestamp =
              record.updated_at
              || record.created_at
              || "";

            const day =
              timestamp.slice(
                0,
                10
              );

            if (
              day &&
              !perDay.has(
                day
              )
            ) {
              perDay.set(
                day,
                record
              );
            }
          }

          result.set(
            lot,
            [
              ...perDay.values(),
            ]
          );
        }

        return result;
      },
      [
        historyRows,
      ]
    );

  const historyTitle =
    useCallback(
      (
        lot: string
      ) => {
        const history =
          historyByLot.get(
            lot
              .trim()
              .toUpperCase()
          )
          || [];

        if (
          !history.length
        ) {
          return "Sin historial de comentarios";
        }

        return history
          .map(
            (row) => {
              const timestamp =
                row.updated_at
                || row.created_at;

              return [
                formatHistoryDay(
                  timestamp
                ),
                row.status_desc,
                row.status_comment,
              ]
                .filter(Boolean)
                .join(
                  " · "
                );
            }
          )
          .join("\n");
      },
      [
        historyByLot,
      ]
    );

  const getControlDraft =
    (
      row: SummaryRow
    ) => {
      const key =
        controlKey(
          row
        );

      return (
        controlDrafts[key]
        || {
          status_desc:
            String(
              row.control_status_desc
              || ""
            )
              .trim()
              .toUpperCase(),
          status_comment:
            String(
              row.control_status_comment
              || ""
            ),
        }
      );
    };

  const updateControlDraft =
    (
      row: SummaryRow,
      patch: Partial<
        ControlDraft
      >
    ) => {
      const key =
        controlKey(
          row
        );

      const current =
        getControlDraft(
          row
        );

      setControlDrafts(
        (drafts) => ({
          ...drafts,
          [key]: {
            ...current,
            ...patch,
          },
        })
      );
    };

  const saveControl =
    async (
      row: SummaryRow
    ) => {
      const key =
        controlKey(
          row
        );

      const draft =
        getControlDraft(
          row
        );

      const statusDesc =
        draft.status_desc
          .trim()
          .toUpperCase();

      const statusComment =
        draft.status_comment
          .trim();

      if (
        !CONTROL_STATUS_OPTIONS.includes(
          statusDesc as
            typeof CONTROL_STATUS_OPTIONS[number]
        )
      ) {
        setError(
          "Selecciona PENDIENTE, LIQUIDADO, VALORIZADO o PM."
        );
        return;
      }

      if (
        !statusComment
      ) {
        setError(
          `Lote ${row.lot}: escribe un comentario antes de guardar.`
        );
        return;
      }

      setSavingControlKey(
        key
      );

      setError("");

      try {
        const response =
          await apiPost(
            "/api/trjkar/lots-control/insert",
            {
              lot:
                row.lot,
              lot_corr:
                row.lot_corr,
              guide_number:
                row.guide_number,
              status_desc:
                statusDesc,
              status_comment:
                statusComment,
            }
          );
        if (
          !response?.ok ||
          !response?.row
        ) {
          throw new Error(
            response?.error
            || "No se pudo guardar el control"
          );
        }
        const saved = response.row as HistoryRow;

        setSummaryRows(
          (current) =>
            current.map(
              (item) =>
                controlKey(
                  item
                ) === key
                  ? {
                      ...item,
                      control_status_desc:
                        saved.status_desc,
                      control_status_comment:
                        saved.status_comment,
                      control_created_at:
                        saved.created_at,
                      control_updated_at:
                        saved.updated_at,
                      control_comment_count:
                        Number(
                          item.control_comment_count
                          || 0
                        ) + 1,
                    }
                  : item
            )
        );

        setHistoryRows(
          (current) => [
            saved,
            ...current,
          ]
        );

        setControlDrafts(
          (current) => {
            const next = {
              ...current,
            };

            delete next[key];

            return next;
          }
        );
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "No se pudo guardar el control"
        );
      } finally {
        setSavingControlKey(
          null
        );
      }
    };

  const summaryTmhByRow =
    useMemo(
      () =>
        new Map(
          filtered.summary
            .filter(
              (row) =>
                row.guide_number &&
                row.lot_corr &&
                Number.isFinite(
                  Number(
                    row.summary_tmh
                  )
                )
            )
            .map(
              (row) => [
                controlKey(
                  row
                ),
                Number(
                  row.summary_tmh
                ),
              ] as const
            )
        ),
      [
        filtered.summary,
      ]
    );

  const statsRows =
    useMemo(
      () =>
        filtered.rows.map(
          (row) => {
            const normalized =
              summaryTmhByRow.get(
                controlKey({
                  lot:
                    row.lot,
                  lot_corr:
                    row.lot_corr,
                  guide_number:
                    row.guide_number,
                })
              );

            return normalized == null
              ? row
              : {
                  ...row,
                  tmh_departure:
                    normalized.toFixed(
                      3
                    ),
                };
          }
        ),
      [
        filtered.rows,
        summaryTmhByRow,
      ]
    );

  const stats =
    useMemo(
      () =>
        kardexStatistics(
          statsRows,
          filtered.guides,
          filtered.invoices,
          period
        ),
      [
        statsRows,
        filtered.guides,
        filtered.invoices,
        period,
      ]
    );

  const aging =
    useMemo(
      () =>
        LOT_STATUS_ORDER.map(
          (status) => {
            const matching =
              filtered.summary.filter(
                (row) =>
                  row.summary_status ===
                  status
              );

            const values =
              matching
                .map(
                  stageAgingDays
                )
                .filter(
                  (
                    value
                  ): value is number =>
                    value != null &&
                    Number.isFinite(
                      value
                    )
                );

            const average =
              values.length
                ? values.reduce(
                    (
                      total,
                      value
                    ) =>
                      total +
                      value,
                    0
                  ) /
                    values.length
                : null;

            const maximum =
              values.length
                ? Math.max(
                    ...values
                  )
                : null;

            return {
              status,
              count:
                matching.length,
              average,
              maximum,
            };
          }
        ),
      [
        filtered.summary,
      ]
    );

  const calculatedStatusItems:
    DonutItem[] =
    LOT_STATUS_ORDER.map(
      (
        status,
        index
      ) => ({
        label:
          status,
        value:
          statusCounts[
            status
          ],
        color:
          CHART_COLORS[
            index
          ]
          || CHART_OTHER,
      })
    );

  const agingRows:
    ChartRow[] =
    aging.map(
      (row) => ({
        key:
          row.status,
        label:
          row.status,
        values: [
          row.average,
        ],
      })
    );

  const agingAlerts =
    useMemo(
      () =>
        statusRows
          .map(
            (row) => ({
              row,
              aging:
                stageAgingDays(
                  row
                ),
            })
          )
          .filter(
            (item): item is {
              row: SummaryRow;
              aging: number;
            } =>
              item.aging != null &&
              Number.isFinite(
                item.aging
              )
          )
          .sort(
            (a, b) =>
              b.aging -
              a.aging
          )
          .slice(
            0,
            5
          ),
      [
        statusRows,
      ]
    );

  const carrierOptions =
    [
      ...new Map(
        guides
          .filter(
            (guide) =>
              guide.transport_ruc
          )
          .map(
            (guide) => [
              guide.transport_ruc!,
              guide.transport_name
              || guide.transport_ruc!,
            ]
          )
      ).entries(),
    ].sort(
      (
        a,
        b
      ) =>
        a[1].localeCompare(
          b[1]
        )
    );

  const entered =
    Number(
      kardexDecimal(
        stats.entered
      )
    );

  const concar =
    Number(
      kardexDecimal(
        stats.concar
      )
    );

  const invoiceCount =
    filtered
      .invoices
      .length;

  const topGuide =
    stats
      .lotsByGuide[0];

  const cards:
    Kpi[] = [
      {
        label:
          "Guías",
        value:
          fmt(
            stats.guideCount,
            0
          ),
        note:
          `${stats.closed} cerradas · ${stats.pending} sin factura`,
        tip: [
          [
            "Cerradas",
            fmt(
              stats.status.closed,
              0
            ),
          ],
          [
            "Con factura abierta",
            fmt(
              stats.status.invoiced,
              0
            ),
          ],
          [
            "Sin factura",
            fmt(
              stats.status.pending,
              0
            ),
          ],
          [
            "Con llegada registrada",
            fmt(
              stats.arrivedCount,
              0
            ),
          ],
          [
            "Transportistas distintos",
            fmt(
              stats.carrierCount,
              0
            ),
          ],
        ],
      },
      {
        label:
          "TMH enviadas",
        value:
          fmt(
            stats.tmh,
            3
          ),
        note:
          "Salidas operativas · PERD/EXCE excluidos",
        tip: [
          [
            `TMH LIMPIEZA · ${stats.cleanupLots} lotes`,
            fmt(
              stats.tmhCleanup,
              3
            ),
          ],
          [
            `TMH llegadas · ${stats.arrivedCount} guías`,
            fmt(
              stats.tmhArrived,
              3
            ),
          ],
          [
            stats.tmhMaxGuide
              ? `Mayor guía · ${stats.tmhMaxGuide.label}`
              : "Mayor guía",
            fmt(
              stats.tmhMaxGuide?.tmh,
              3
            ),
          ],
        ],
      },
      {
        label:
          "Lotes por guía",
        value:
          fmt(
            stats.lotsPerGuide
          ),
        note:
          `${stats.lotCount} lotes distintos`,
        tip: [
          [
            "Filas operativas",
            fmt(
              stats.lotRows,
              0
            ),
          ],
          [
            "Lotes distintos",
            fmt(
              stats.lotCount,
              0
            ),
          ],
          [
            topGuide
              ? `Guía con más lotes · ${topGuide.label}`
              : "Guía con más lotes",
            fmt(
              topGuide?.count,
              0
            ),
          ],
          [
            "Lotes LIMPIEZA",
            fmt(
              stats.cleanupLots,
              0
            ),
          ],
        ],
      },
      {
        label:
          "USD ingresado",
        value:
          fmt(
            kardexDecimal(
              stats.entered
            )
          ),
        note:
          `${invoiceCount} facturas web`,
        tip: [
          [
            "Facturas cerradas",
            fmt(
              stats.invoicesClosed,
              0
            ),
          ],
          [
            "Facturas abiertas",
            fmt(
              invoiceCount -
              stats.invoicesClosed,
              0
            ),
          ],
          [
            "Promedio por factura",
            fmt(
              invoiceCount
                ? entered /
                  invoiceCount
                : null
            ),
          ],
          [
            `USD en guías valorizadas · ${stats.billedGuides}`,
            fmt(
              stats.billedUsd
            ),
          ],
          [
            "Ingresado menos guías",
            fmt(
              entered -
              stats.billedUsd
            ),
          ],
        ],
      },
      {
        label:
          "USD Concar",
        value:
          fmt(
            kardexDecimal(
              stats.concar
            )
          ),
        note:
          `${stats.unmatched} facturas sin cruce contable`,
        tip: [
          [
            "Con cruce contable",
            fmt(
              invoiceCount -
              stats.unmatched,
              0
            ),
          ],
          [
            "Sin cruce contable",
            fmt(
              stats.unmatched,
              0
            ),
          ],
          [
            "Con importe distinto al ingresado",
            fmt(
              stats.mismatched,
              0
            ),
          ],
          [
            "Cobertura sobre ingresado",
            entered
              ? `${fmt(
                  (
                    concar /
                    entered
                  ) *
                    100,
                  1
                )} %`
              : "—",
          ],
        ],
      },
      {
        label:
          "Diferencia USD",
        value:
          fmt(
            kardexDecimal(
              stats.entered -
              stats.concar
            )
          ),
        note:
          "Ingresado menos registrado en Concar",
        tip: [
          [
            `Facturas sin cruce · ${stats.unmatched}`,
            fmt(
              kardexDecimal(
                stats.enteredUnmatched
              )
            ),
          ],
          [
            `Importes distintos · ${stats.mismatched}`,
            fmt(
              kardexDecimal(
                stats.entered -
                stats.enteredUnmatched -
                stats.concar
              )
            ),
          ],
          [
            "Facturas conciliadas",
            fmt(
              invoiceCount -
              stats.unmatched -
              stats.mismatched,
              0
            ),
          ],
        ],
      },
    ];

  const periodRows =
    (
      pick:
        (
          row:
            KardexPeriodStats
        ) =>
          (
            number
            | null
          )[]
    ):
      ChartRow[] =>
      stats.series.map(
        (row) => ({
          key:
            row.label,
          label:
            periodLabel(
              row.label,
              period
            ),
          values:
            pick(row),
        })
      );

  const carrierShare:
    DonutItem[] = [
      ...stats.carriers
        .slice(
          0,
          5
        )
        .map(
          (
            carrier,
            index
          ) => ({
            label:
              carrier.label,
            value:
              carrier.tmh,
            color:
              CHART_COLORS[
                index
              ],
            note:
              `${carrier.guides} guías`,
          })
        ),
      {
        label:
          "Otros",
        value:
          stats.carriers
            .slice(5)
            .reduce(
              (
                total,
                carrier
              ) =>
                total +
                carrier.tmh,
              0
            ),
        color:
          CHART_OTHER,
        note:
          `${stats.carriers.slice(5).length} transportistas`,
      },
    ];

  const hours =
    (
      value:
        | number
        | null
    ) =>
      value == null
        ? "—"
        : `${fmt(
            value,
            1
          )} h`;

  const operationCards:
    Kpi[] = [
      {
        label:
          "Merma en tránsito",
        value:
          stats.lossPct == null
            ? "—"
            : `${fmt(
                stats.lossPct,
                2
              )} %`,
        note:
          stats.lossPct == null
            ? "Sin guías con llegada registrada"
            : `Sobre ${fmt(
                stats.arrivedGuidesTmh,
                1
              )} TMH con llegada`,
        tip: [
          [
            "TMH salida con llegada",
            fmt(
              stats.arrivedGuidesTmh,
              3
            ),
          ],
          [
            "TMH llegada",
            fmt(
              stats.tmhArrived,
              3
            ),
          ],
          [
            "Merma TMH",
            fmt(
              stats.arrivedGuidesTmh -
              stats.tmhArrived,
              3
            ),
          ],
          [
            "Guías con llegada",
            fmt(
              stats.arrivedCount,
              0
            ),
          ],
          [
            "Guías sin llegada",
            fmt(
              stats.guideCount -
              stats.arrivedCount,
              0
            ),
          ],
        ],
      },
      {
        label:
          "Tiempo de tránsito",
        value:
          hours(
            stats.avgTransitHours
          ),
        note:
          `${stats.transitCount} guías con salida y llegada`,
        tip: [
          [
            "Mínimo",
            hours(
              stats.transitMin
            ),
          ],
          [
            "Máximo",
            hours(
              stats.transitMax
            ),
          ],
          [
            "Guías con salida y llegada",
            fmt(
              stats.transitCount,
              0
            ),
          ],
          [
            "Guías sin llegada",
            fmt(
              stats.guideCount -
              stats.transitCount,
              0
            ),
          ],
        ],
      },
      {
        label:
          "Tarifa media",
        value:
          stats.avgRate == null
            ? "—"
            : `${fmt(
                stats.avgRate,
                2
              )} USD/TMH`,
        note:
          "Ponderada por TMH de guía valorizada",
        tip: [
          [
            "Guías valorizadas",
            fmt(
              stats.billedGuides,
              0
            ),
          ],
          [
            "TMH valorizadas",
            fmt(
              stats.billedTmh,
              3
            ),
          ],
          [
            "USD valorizados",
            fmt(
              stats.billedUsd
            ),
          ],
          [
            "Tarifa mínima",
            stats.rateMin == null
              ? "—"
              : `${fmt(
                  stats.rateMin
                )} USD/TMH`,
          ],
          [
            "Tarifa máxima",
            stats.rateMax == null
              ? "—"
              : `${fmt(
                  stats.rateMax
                )} USD/TMH`,
          ],
        ],
      },
      {
        label:
          "TMH por guía",
        value:
          fmt(
            stats.guideCount
              ? stats.tmh /
                stats.guideCount
              : 0,
            2
          ),
        note:
          "Promedio de las guías filtradas",
        tip: [
          [
            "TMH enviadas",
            fmt(
              stats.tmh,
              3
            ),
          ],
          [
            "Guías",
            fmt(
              stats.guideCount,
              0
            ),
          ],
          [
            stats.tmhMaxGuide
              ? `Mayor guía · ${stats.tmhMaxGuide.label}`
              : "Mayor guía",
            fmt(
              stats.tmhMaxGuide?.tmh,
              3
            ),
          ],
          [
            "Lotes por guía",
            fmt(
              stats.lotsPerGuide
            ),
          ],
        ],
      },
    ];

  const trendPeriodLabel =
    period === "month"
      ? "Evolución mensual"
      : period === "week"
        ? "Evolución semanal"
        : "Evolución diaria";

  const kpiTrend =
    (
      label: string
    ):
      KpiTrend
      | undefined => {
      const values =
        (
          pick:
            (
              row:
                KardexPeriodStats
            ) =>
              number
              | null
        ) =>
          stats.series.map(
            pick
          );

      switch (label) {
        case "Guías":
          return {
            label:
              trendPeriodLabel,
            values:
              values(
                (row) =>
                  row.guides
              ),
          };

        case "TMH enviadas":
          return {
            label:
              trendPeriodLabel,
            values:
              values(
                (row) =>
                  row.tmh
              ),
          };

        case "Lotes por guía":
          return {
            label:
              "Distribución · top 10 guías",
            values:
              stats.lotsByGuide
                .slice(
                  0,
                  10
                )
                .map(
                  (row) =>
                    row.count
                ),
          };

        case "USD ingresado":
          return {
            label:
              trendPeriodLabel,
            values:
              values(
                (row) =>
                  row.entered
              ),
          };

        case "USD Concar":
          return {
            label:
              trendPeriodLabel,
            values:
              values(
                (row) =>
                  row.concar
              ),
          };

        case "Diferencia USD":
          return {
            label:
              trendPeriodLabel,
            values:
              values(
                (row) =>
                  row.entered -
                  row.concar
              ),
          };

        case "Merma en tránsito":
          return {
            label:
              trendPeriodLabel,
            values:
              values(
                (row) =>
                  row.tmhDeparted != null &&
                  row.tmhDeparted > 0 &&
                  row.tmhArrival != null
                    ? (
                        (
                          row.tmhDeparted -
                          row.tmhArrival
                        ) /
                        row.tmhDeparted
                      ) *
                        100
                    : null
              ),
          };

        case "Tiempo de tránsito":
          return {
            label:
              trendPeriodLabel,
            values:
              values(
                (row) =>
                  row.transitHours
              ),
          };

        case "Tarifa media":
          return {
            label:
              trendPeriodLabel,
            values:
              values(
                (row) =>
                  row.rate
              ),
          };

        case "TMH por guía":
          return {
            label:
              trendPeriodLabel,
            values:
              values(
                (row) =>
                  row.guides
                    ? row.tmh /
                      row.guides
                    : null
              ),
          };

        default:
          return undefined;
      }
    };

  const focusedGuide =
    selectedGuide
      ? filtered.guides.find(
          (guide) =>
            guide.guide_number ===
            selectedGuide
        )
      : undefined;

  const focusedLots =
    focusedGuide
      ? filtered.rows
          .filter(
            (row) =>
              row.guide_number ===
              selectedGuide
          )
          .sort(
            (
              a,
              b
            ) =>
              a.lot.localeCompare(
                b.lot
              ) ||
              a.lot_corr.localeCompare(
                b.lot_corr
              )
          )
      : [];

  const focusedTmh =
    (
      key: string
    ) =>
      focusedLots.reduce(
        (
          total,
          row
        ) =>
          total +
          Number(
            row[key]
            || 0
          ),
        0
      );

  const selectedStatusGuides =
    selectedGuideStatus
      ? filtered.guides.filter(
          (guide) => {
            if (
              selectedGuideStatus ===
              "Cerradas"
            ) {
              return (
                guide.status_name ===
                "CERRADO"
              );
            }

            if (
              selectedGuideStatus ===
              "Con factura abierta"
            ) {
              return (
                guide.status_name !==
                  "CERRADO" &&
                !!guide.document_number
              );
            }

            return (
              guide.status_name !==
                "CERRADO" &&
              !guide.document_number
            );
          }
        )
      : [];

  const selectedCarrierGuides =
    selectedCarrier
      ? filtered.guides.filter(
          (guide) =>
            (
              guide.transport_name
              || guide.transport_ruc
              || "Sin transportista"
            ) ===
            selectedCarrier
        )
      : [];

  const perdRows =
    filtered.balance.filter(
      (row) =>
        row.lot_corr ===
        "PERD"
    );

  const exceRows =
    filtered.balance.filter(
      (row) =>
        row.lot_corr ===
        "EXCE"
    );

  const perdTmh =
    perdRows.reduce(
      (
        total,
        row
      ) =>
        total +
        Number(
          row.tmh_departure
          || 0
        ),
      0
    );

  const exceTmh =
    exceRows.reduce(
      (
        total,
        row
      ) =>
        total +
        Number(
          row.tmh_departure
          || 0
        ),
      0
    );

  function exportSummaryExcel() {
    const stamp =
      new Date()
        .toISOString()
        .slice(
          0,
          19
        )
        .replace(
          /[-:T]/g,
          ""
        );

    const statusLabel =
      selectedLotStatus ===
      "TODOS"
        ? "todos"
        : selectedLotStatus
            .toLowerCase()
            .replace(
              /\s+/g,
              "_"
            )
            .normalize("NFD")
            .replace(
              /[\u0300-\u036f]/g,
              ""
            );

    const ok =
      exportRowsExcel(
        summaryExcel.rows as unknown as Record<string, unknown>[],
        `trjkar_lotes_${statusLabel}_${stamp}.xlsx`,
        "Lotes"
      );

    if (!ok) {
      setError(
        "No hay filas para exportar con los filtros actuales."
      );
    }
  }

  function exportBalanceExcel() {
    const stamp =
      new Date()
        .toISOString()
        .slice(
          0,
          19
        )
        .replace(
          /[-:T]/g,
          ""
        );

    const ok =
      exportRowsExcel(
        filtered.balance as unknown as Record<string, unknown>[],
        `trjkar_control_perd_exce_${stamp}.xlsx`,
        "PERD_EXCE"
      );

    if (!ok) {
      setError(
        "No hay filas PERD/EXCE para exportar con los filtros actuales."
      );
    }
  }

  function exportStatsPdf() {
    const kpis =
      document.querySelector<HTMLElement>(
        ".trjk-kpi-grid"
      );

    const statsNode =
      document.querySelector<HTMLElement>(
        ".trjk-stats-export"
      );

    if (
      !kpis ||
      !statsNode
    ) {
      setError(
        "No se encontraron las estadísticas para exportar."
      );
      return;
    }

    const printWindow =
      window.open(
        "",
        "_blank",
        "width=1400,height=900"
      );

    if (!printWindow) {
      setError(
        "El navegador bloqueó la ventana de exportación a PDF."
      );
      return;
    }

    const styles =
      Array.from(
        document.head.querySelectorAll(
          'link[rel="stylesheet"], style'
        )
      )
        .map(
          (node) =>
            node.outerHTML
        )
        .join("");

    const carrierLabel =
      ruc
        ? carrierOptions.find(
            ([id]) =>
              id === ruc
          )?.[1] || ruc
        : "Todos";

    const periodText =
      period === "day"
        ? "Día"
        : period === "week"
          ? "Semana"
          : "Mes";

    const generatedAt =
      new Intl.DateTimeFormat(
        "es-PE",
        {
          dateStyle:
            "medium",
          timeStyle:
            "short",
        }
      ).format(
        new Date()
      );

    printWindow.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>TRJ Kardex - Estadísticas</title>
          ${styles}
          <style>
            @page {
              size: A4 landscape;
              margin: 10mm;
            }

            html,
            body {
              width: auto !important;
              height: auto !important;
              overflow: visible !important;
            }

            body {
              margin: 0 !important;
              padding: 0 !important;
              background: var(--s-canvas) !important;
              color: var(--ink) !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            .trjk-pdf-page {
              width: 100%;
              display: grid;
              gap: 12px;
              font-size: 11px;
            }

            .trjk-pdf-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 24px;
              padding-bottom: 10px;
              border-bottom: 2px solid var(--mod);
            }

            .trjk-pdf-header h1 {
              margin: 0;
              font-size: 20px;
              font-weight: 600;
            }

            .trjk-pdf-header p {
              margin: 4px 0 0;
              color: var(--ink-2);
            }

            .trjk-pdf-meta {
              display: grid;
              grid-template-columns: repeat(4, auto);
              gap: 5px 18px;
              padding: 8px 10px;
              background: var(--s-1);
              border: 1px solid var(--line);
              border-radius: var(--r-2);
            }

            .trjk-pdf-meta div {
              display: grid;
              gap: 2px;
            }

            .trjk-pdf-meta span {
              color: var(--ink-3);
              font-size: 9px;
              text-transform: uppercase;
              letter-spacing: .05em;
            }

            .trjk-pdf-meta strong {
              font-size: 10px;
              white-space: nowrap;
            }

            .trjk-kpi-grid {
              grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            }

            .trjk-stat-grid {
              grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            }

            .trjk-chart-grid,
            .trjk-chart-grid-3 {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }

            .trjk-card,
            .trjk-kpi,
            .trjk-chart {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            .trjk-chart-plot,
            .trjk-chart-plot svg {
              max-width: 100% !important;
            }

            .trjk-kpi-tip,
            .trjk-chart-data,
            button,
            .trjk-toggle,
            .trjk-chart-hint {
              display: none !important;
            }

            .trjk-stats-export {
              display: grid;
              gap: 12px;
            }

            .trjk-workspace,
            .trjk-summary {
              overflow: visible !important;
              height: auto !important;
              padding: 0 !important;
            }

            @media print {
              .trjk-pdf-header,
              .trjk-pdf-meta,
              .trjk-kpi-grid,
              .trjk-stat-grid,
              .trjk-chart-grid {
                margin-bottom: 12px;
              }
            }
          </style>
        </head>
        <body data-module="kardex">
          <main class="trjk-pdf-page trjk-workspace">
            <header class="trjk-pdf-header">
              <div>
                <h1>MVD · Kardex TRJ — Estadísticas</h1>
                <p>Operación, transporte, facturación y conciliación contable</p>
              </div>
              <p>Generado: ${generatedAt}</p>
            </header>

            <section class="trjk-pdf-meta">
              <div>
                <span>Fecha guía desde</span>
                <strong>${from || "Inicio"}</strong>
              </div>
              <div>
                <span>Fecha guía hasta</span>
                <strong>${to || "Actualidad"}</strong>
              </div>
              <div>
                <span>Transportista</span>
                <strong>${carrierLabel}</strong>
              </div>
              <div>
                <span>Agrupación</span>
                <strong>${periodText}</strong>
              </div>
            </section>

            ${kpis.outerHTML}
            ${statsNode.outerHTML}
          </main>
        </body>
      </html>
    `);

    printWindow.document.close();

    const runPrint =
      () => {
        printWindow.focus();
        printWindow.print();
      };

    if (
      printWindow.document
        .fonts?.ready
    ) {
      void printWindow.document
        .fonts.ready.then(
          () => {
            window.setTimeout(
              runPrint,
              300
            );
          }
        );
    } else {
      window.setTimeout(
        runPrint,
        700
      );
    }
  }

  return (
    <div className="trjk-workspace trjk-summary">
      <div className="trjk-toolbar">
        <div>
          <h2>
            Kardex de transporte
          </h2>
          <p className="muted">
            Operación, facturación y conciliación contable
          </p>
        </div>

        <div className="trjk-actions">
          <div
            className="trjk-toggle"
            role="group"
            aria-label="Vista de Kardex"
          >
            <Button
              size="sm"
              variant={
                view ===
                "summary"
                  ? "primary"
                  : "ghost"
              }
              aria-pressed={
                view ===
                "summary"
              }
              onClick={
                () =>
                  setView(
                    "summary"
                  )
              }
            >
              Resumen
            </Button>

            <Button
              size="sm"
              variant={
                view ===
                "stats"
                  ? "primary"
                  : "ghost"
              }
              aria-pressed={
                view ===
                "stats"
              }
              onClick={
                () =>
                  setView(
                    "stats"
                  )
              }
            >
              Estadísticas
            </Button>

            <Button
              size="sm"
              variant={
                view ===
                "balance"
                  ? "primary"
                  : "ghost"
              }
              aria-pressed={
                view ===
                "balance"
              }
              onClick={
                () =>
                  setView(
                    "balance"
                  )
              }
            >
              Control PERD/EXCE
            </Button>
          </div>

          {view ===
            "summary" && (
            <Button
              size="sm"
              disabled={
                loading
              }
              onClick={
                exportSummaryExcel
              }
            >
              Exportar Excel
            </Button>
          )}

          {view ===
            "stats" && (
            <Button
              size="sm"
              disabled={
                loading
              }
              onClick={
                exportStatsPdf
              }
            >
              Exportar PDF
            </Button>
          )}

          {view ===
            "balance" && (
            <Button
              size="sm"
              disabled={
                loading
              }
              onClick={
                exportBalanceExcel
              }
            >
              Exportar control Excel
            </Button>
          )}

          <Button
            size="sm"
            disabled={
              loading
            }
            onClick={
              () =>
                void load()
            }
          >
            Actualizar
          </Button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="trjk-message"
          data-error="true"
        >
          {error}
        </div>
      )}

      <section className="trjk-card">
        <div className="trjk-toolbar">
          <label>
            Fecha guía desde
            <input
              type="date"
              className="input"
              value={from}
              max={
                to
                || undefined
              }
              onChange={
                (event) => {
                  setFrom(
                    event.target.value
                  );
                  setPage(1);
                }
              }
            />
          </label>

          <label>
            Fecha guía hasta
            <input
              type="date"
              className="input"
              value={to}
              min={
                from
                || undefined
              }
              onChange={
                (event) => {
                  setTo(
                    event.target.value
                  );
                  setPage(1);
                }
              }
            />
          </label>

          <label>
            Transportista
            <select
              className="input"
              value={ruc}
              onChange={
                (event) => {
                  setRuc(
                    event.target.value
                  );
                  setPage(1);
                }
              }
            >
              <option value="">
                Todos
              </option>
              {carrierOptions.map(
                ([
                  id,
                  name,
                ]) => (
                  <option
                    key={id}
                    value={id}
                  >
                    {name}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            Buscar
            <input
              className="input"
              value={search}
              placeholder="Lote, guía, factura, RUC o comentario"
              onChange={
                (event) => {
                  setSearch(
                    event.target.value
                  );
                  setPage(1);
                }
              }
            />
          </label>

          <Button
            size="sm"
            onClick={
              () => {
                setFrom("");
                setTo("");
                setRuc("");
                setSearch("");
                setPage(1);
                summaryExcel.clear();
              }
            }
          >
            Limpiar filtros
          </Button>
        </div>

        <p
          className="muted"
          style={{
            margin:
              "10px 0 0",
          }}
        >
          El rango global usa Fecha guía remitente. Los registros todavía sin guía no pertenecen a ningún rango de fecha de guía y se muestran cuando el rango está libre.
        </p>
      </section>

      {view !==
        "balance" && (
        <>
          <div className="trjk-kpi-grid">
            {cards.map(
              (card) => (
                <KpiCard
                  key={
                    card.label
                  }
                  {...card}
                  loading={
                    loading
                  }
                  trend={
                    kpiTrend(
                      card.label
                    )
                  }
                />
              )
            )}
          </div>

          <p className="trjk-method">
            PERD y EXCE siguen separados como control. En Resumen, la TMH se normaliza por lote y guía: PERD suma al último envío y EXCE resta, de modo que tablas, KPIs y gráficos trabajen con la TMH original. El rango global se determina por la fecha de la guía de remitente.
          </p>
        </>
      )}

      {view ===
        "summary" && (
        <section className="trjk-card">
          <div className="trjk-toolbar">
            <div>
              <h3>
                Detalle por lote y guía
              </h3>
              <p
                className="muted"
                style={{
                  margin:
                    "3px 0 0",
                }}
              >
                Fuente: control sum · TMH original normalizada por lote y guía; PERD/EXCE permanecen en control separado
              </p>
            </div>

            <span className="muted">
              {filtered.summary.length} filas en filtros globales
            </span>
          </div>

          <div
            className="trjk-toggle"
            style={{
              marginTop:
                12,
            }}
          >
            <Button
              size="sm"
              variant={
                selectedLotStatus ===
                "TODOS"
                  ? "primary"
                  : "ghost"
              }
              aria-pressed={
                selectedLotStatus ===
                "TODOS"
              }
              onClick={
                () => {
                  setSelectedLotStatus(
                    "TODOS"
                  );
                  setSelectedPaymentStatus(
                    "TODOS"
                  );
                  setPage(1);
                  summaryExcel.clear();
                }
              }
            >
              TODOS ·{" "}
              {
                filtered
                  .summary
                  .length
              }
            </Button>

            {LOT_STATUS_ORDER.map(
              (status) => (
                <Button
                  key={
                    status
                  }
                  size="sm"
                  variant={
                    selectedLotStatus ===
                    status
                      ? "primary"
                      : "ghost"
                  }
                  aria-pressed={
                    selectedLotStatus ===
                    status
                  }
                  onClick={
                    () => {
                      setSelectedLotStatus(
                        status
                      );
                      setSelectedPaymentStatus(
                        "TODOS"
                      );
                      setPage(1);
                      summaryExcel.clear();
                    }
                  }
                >
                  {status} ·{" "}
                  {statusCounts[
                    status
                  ]}
                </Button>
              )
            )}

          </div>

          {selectedLotStatus ===
            "Sin pago" && (
            <div
              className="trjk-toggle"
              style={{
                marginTop:
                  8,
              }}
            >
              <Button
                size="sm"
                variant={
                  selectedPaymentStatus ===
                  "TODOS"
                    ? "primary"
                    : "ghost"
                }
                onClick={
                  () => {
                    setSelectedPaymentStatus(
                      "TODOS"
                    );
                    setPage(1);
                    summaryExcel.clear();
                  }
                }
              >
                Todos sin pago ·{" "}
                {statusCounts[
                  "Sin pago"
                ]}
              </Button>

              {PAYMENT_STATUS_ORDER.map(
                (status) => (
                  <Button
                    key={
                      status
                    }
                    size="sm"
                    variant={
                      selectedPaymentStatus ===
                      status
                        ? "primary"
                        : "ghost"
                    }
                    onClick={
                      () => {
                        setSelectedPaymentStatus(
                          status
                        );
                        setPage(1);
                        summaryExcel.clear();
                      }
                    }
                  >
                    {status} ·{" "}
                    {paymentStatusCounts[
                      status
                    ]}
                  </Button>
                )
              )}
            </div>
          )}

          {agingAlerts.length >
            0 && (
            <div
              className="trjk-actions"
              style={{
                marginTop:
                  10,
                flexWrap:
                  "wrap",
              }}
            >
              <strong>
                Mayor aging
              </strong>

              {agingAlerts.map(
                ({
                  row,
                  aging,
                }) => (
                  <span
                    key={
                      `${controlKey(
                        row
                      )}-aging`
                    }
                    className="trjk-badge"
                    title={`${row.lot_status}${
                      row.payment_status
                        ? ` · ${row.payment_status}`
                        : ""
                    }`}
                  >
                    ⚠ {row.lot} ·{" "}
                    {fmt(
                      aging,
                      0
                    )} días
                  </span>
                )
              )}
            </div>
          )}

          <div
            className="trjk-table-scroll trjk-summary-table"
            style={{
              marginTop:
                12,
            }}
          >
            <table>
              <thead>
                <tr>
                  {visibleSummaryColumns.map(
                    (column) => (
                      <th
                        key={
                          column.key
                        }
                      >
                        <div className="trjk-column">
                          {
                            column.label
                          }
                          <ExcelHeaderFilter
                            {...summaryExcel.headerProps(
                              column.key
                            )}
                          />
                        </div>
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {summaryExcel.rows
                  .slice(
                    (
                      currentPage -
                      1
                    ) * 50,
                    currentPage *
                      50
                  )
                  .map(
                    (row) => {
                      const rowKey =
                        controlKey(
                          row
                        );

                      const draft =
                        getControlDraft(
                          row
                        );

                      return (
                        <tr
                          key={
                            rowKey
                          }
                          data-closed={
                            row.guide_status_name ===
                            "CERRADO"
                          }
                        >
                          {visibleSummaryColumns.map(
                            (
                              column
                            ) => {
                              if (
                                column.key ===
                                "lot"
                              ) {
                                return (
                                  <td
                                    key={
                                      column.key
                                    }
                                  >
                                    <span
                                      title={
                                        historyTitle(
                                          row.lot
                                        )
                                      }
                                      style={{
                                        cursor:
                                          "help",
                                        textDecoration:
                                          Number(
                                            row.control_comment_count
                                            || 0
                                          ) >
                                          0
                                            ? "underline dotted"
                                            : undefined,
                                        textUnderlineOffset:
                                          3,
                                      }}
                                    >
                                      {
                                        row.lot
                                      }
                                      {Number(
                                        row.control_comment_count
                                        || 0
                                      ) >
                                        0 &&
                                        ` (${Number(
                                          row.control_comment_count
                                        )})`}
                                    </span>
                                  </td>
                                );
                              }

                              if (
                                column.key ===
                                "control_status_desc"
                              ) {
                                return (
                                  <td
                                    key={
                                      column.key
                                    }
                                  >
                                    <select
                                      className="input"
                                      value={
                                        draft.status_desc
                                      }
                                      style={{
                                        minWidth:
                                          135,
                                      }}
                                      onChange={
                                        (
                                          event
                                        ) =>
                                          updateControlDraft(
                                            row,
                                            {
                                              status_desc:
                                                event
                                                  .target
                                                  .value,
                                            }
                                          )
                                      }
                                    >
                                      <option value="">
                                        —
                                      </option>
                                      {CONTROL_STATUS_OPTIONS.map(
                                        (
                                          status
                                        ) => (
                                          <option
                                            key={
                                              status
                                            }
                                            value={
                                              status
                                            }
                                          >
                                            {
                                              status
                                            }
                                          </option>
                                        )
                                      )}
                                    </select>
                                  </td>
                                );
                              }

                              if (
                                column.key ===
                                "control_status_comment"
                              ) {
                                return (
                                  <td
                                    key={
                                      column.key
                                    }
                                  >
                                    <div
                                      style={{
                                        display:
                                          "flex",
                                        alignItems:
                                          "center",
                                        gap:
                                          6,
                                        minWidth:
                                          340,
                                      }}
                                    >
                                      <input
                                        className="input"
                                        maxLength={
                                          1000
                                        }
                                        value={
                                          draft.status_comment
                                        }
                                        placeholder="Comentario"
                                        onChange={
                                          (
                                            event
                                          ) =>
                                            updateControlDraft(
                                              row,
                                              {
                                                status_comment:
                                                  event
                                                    .target
                                                    .value,
                                              }
                                            )
                                        }
                                      />

                                      <Button
                                        size="sm"
                                        disabled={
                                          savingControlKey ===
                                            rowKey ||
                                          !draft.status_desc ||
                                          !draft.status_comment.trim()
                                        }
                                        onClick={
                                          () =>
                                            void saveControl(
                                              row
                                            )
                                        }
                                      >
                                        {savingControlKey ===
                                        rowKey
                                          ? "…"
                                          : "Guardar"}
                                      </Button>
                                    </div>
                                  </td>
                                );
                              }

                              return (
                                <td
                                  key={
                                    column.key
                                  }
                                >
                                  {column.kind ===
                                  "number"
                                    ? fmt(
                                        row[
                                          column
                                            .key
                                        ],
                                        [
                                          "summary_tmh",
                                          "tmh",
                                          "tmh_departure",
                                          "tmh_arrival",
                                          "tmh_balance",
                                        ].includes(
                                          column.key
                                        )
                                          ? 3
                                          : [
                                                "entry_year",
                                                "entry_month",
                                                "aging_days",
                                              ].includes(
                                                column.key
                                              )
                                            ? 0
                                            : column.key ===
                                                "au_grade_oztc"
                                              ? 4
                                              : 2
                                      )
                                    : column.kind ===
                                        "date"
                                      ? String(
                                          row[
                                            column
                                              .key
                                          ]
                                          || ""
                                        )
                                          .replace(
                                            "T",
                                            " "
                                          )
                                          .slice(
                                            0,
                                            16
                                          )
                                        || "—"
                                      : String(
                                          row[
                                            column
                                              .key
                                          ]
                                          || "—"
                                        )}
                                </td>
                              );
                            }
                          )}
                        </tr>
                      );
                    }
                  )}

                {!summaryExcel
                  .rows
                  .length && (
                  <tr>
                    <td
                      colSpan={
                        visibleSummaryColumns.length
                      }
                    >
                      {loading
                        ? "Cargando…"
                        : "No hay lotes para este estado y filtros."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="trjk-toolbar">
            <span>
              Página{" "}
              {
                currentPage
              }{" "}
              de{" "}
              {pages}
              {" · "}
              {
                summaryExcel
                  .rows
                  .length
              }{" "}
              filas
            </span>

            <div className="trjk-actions">
              <Button
                size="sm"
                disabled={
                  currentPage <=
                  1
                }
                onClick={
                  () =>
                    setPage(
                      currentPage -
                      1
                    )
                }
              >
                Anterior
              </Button>

              <Button
                size="sm"
                disabled={
                  currentPage >=
                  pages
                }
                onClick={
                  () =>
                    setPage(
                      currentPage +
                      1
                    )
                }
              >
                Siguiente
              </Button>
            </div>
          </div>
        </section>
      )}

      {view ===
        "balance" && (
        <section className="trjk-card">
          <div className="trjk-toolbar">
            <div>
              <h3>
                Control PERD / EXCE
              </h3>
              <p
                className="muted"
                style={{
                  margin:
                    "3px 0 0",
                }}
              >
                Reporte independiente de control · no participa en KPIs, estadísticas ni exportación principal
              </p>
            </div>

            <div className="trjk-actions">
              <span className="trjk-badge">
                PERD ·{" "}
                {perdRows.length} filas ·{" "}
                {fmt(
                  perdTmh,
                  3
                )}{" "}
                TMH
              </span>

              <span className="trjk-badge">
                EXCE ·{" "}
                {exceRows.length} filas ·{" "}
                {fmt(
                  exceTmh,
                  3
                )}{" "}
                TMH
              </span>
            </div>
          </div>

          <div
            className="trjk-table-scroll trjk-summary-table"
            style={{
              marginTop:
                12,
            }}
          >
            <table>
              <thead>
                <tr>
                  <th>
                    Lote
                  </th>
                  <th>
                    Tipo
                  </th>
                  <th>
                    Guía
                  </th>
                  <th>
                    Fecha guía remitente
                  </th>
                  <th>
                    Guía transportista
                  </th>
                  <th>
                    Transportista
                  </th>
                  <th>
                    RUC
                  </th>
                  <th>
                    Salida
                  </th>
                  <th>
                    Llegada
                  </th>
                  <th>
                    TMH control
                  </th>
                  <th>
                    Observación
                  </th>
                  <th>
                    Creado
                  </th>
                  <th>
                    Actualizado
                  </th>
                </tr>
              </thead>

              <tbody>
                {filtered.balance.map(
                  (row) => (
                    <tr
                      key={
                        JSON.stringify([
                          row.lot,
                          row.lot_corr,
                          row.guide_number,
                        ])
                      }
                    >
                      <td>
                        {row.lot}
                      </td>
                      <td>
                        <span className="trjk-badge">
                          {
                            row.lot_corr
                          }
                        </span>
                      </td>
                      <td>
                        {row.guide_number
                          || "—"}
                      </td>
                      <td>
                        {dateTime(
                          row.guide_date
                        )}
                      </td>
                      <td>
                        {row.transport_guide_number
                          || "—"}
                      </td>
                      <td>
                        {row.transport_name
                          || "—"}
                      </td>
                      <td>
                        {row.transport_ruc
                          || "—"}
                      </td>
                      <td>
                        {dateTime(
                          row.departure_date
                        )}
                      </td>
                      <td>
                        {dateTime(
                          row.arrival_date
                        )}
                      </td>
                      <td>
                        {fmt(
                          row.tmh_departure,
                          3
                        )}
                      </td>
                      <td>
                        {row.balance_obs
                          || "—"}
                      </td>
                      <td>
                        {dateTime(
                          row.created_at
                        )}
                      </td>
                      <td>
                        {dateTime(
                          row.updated_at
                        )}
                      </td>
                    </tr>
                  )
                )}

                {!filtered
                  .balance
                  .length && (
                  <tr>
                    <td colSpan={13}>
                      {loading
                        ? "Cargando…"
                        : "No hay registros PERD/EXCE para los filtros actuales."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view ===
        "stats" && (
        <div className="trjk-stats-export">
          <div className="trjk-toolbar">
            <div>
              <h3>
                Actividad y conciliación
              </h3>
              <p
                className="muted"
                style={{
                  margin:
                    "3px 0 0",
                }}
              >
                {period ===
                "week"
                  ? "Semanas de lunes a domingo."
                  : period ===
                      "month"
                    ? "Agrupado por mes."
                    : "Agrupado por día."}
              </p>
            </div>

            <div
              className="trjk-toggle"
              role="group"
              aria-label="Agrupar estadísticas"
            >
              {(
                [
                  [
                    "day",
                    "Día",
                  ],
                  [
                    "week",
                    "Semana",
                  ],
                  [
                    "month",
                    "Mes",
                  ],
                ] as const
              ).map(
                ([
                  key,
                  label,
                ]) => (
                  <Button
                    key={
                      key
                    }
                    size="sm"
                    aria-pressed={
                      period ===
                      key
                    }
                    variant={
                      period ===
                      key
                        ? "primary"
                        : "ghost"
                    }
                    onClick={
                      () =>
                        setPeriod(
                          key
                        )
                    }
                  >
                    {label}
                  </Button>
                )
              )}
            </div>
          </div>

          <div className="trjk-stat-grid">
            {operationCards.map(
              (card) => (
                <KpiCard
                  key={
                    card.label
                  }
                  {...card}
                  loading={
                    loading
                  }
                  trend={
                    kpiTrend(
                      card.label
                    )
                  }
                />
              )
            )}
          </div>

          <div className="trjk-chart-grid">
            <DonutChart
              title="Estado calculado de lotes"
              subtitle="Universo del control sum, sin PERD/EXCE"
              centerLabel="filas"
              items={
                calculatedStatusItems
              }
              showTable
            />

            <ColumnChart
              title="Aging por estado calculado"
              subtitle="Días promedio en el estado actual; Finalizado muestra salida a llegada"
              digits={1}
              unit=" días"
              rows={
                agingRows
              }
              series={[
                {
                  label:
                    "Días promedio",
                  color:
                    CHART_COLORS[0],
                },
              ]}
            />
          </div>

          <div className="trjk-chart-grid">
            <ColumnChart
              title="Guías despachadas"
              subtitle="Ritmo de salida por período"
              rows={
                periodRows(
                  (row) => [
                    row.guides,
                  ]
                )
              }
              series={[
                {
                  label:
                    "Guías",
                  color:
                    CHART_COLORS[0],
                },
              ]}
            />

            <LineChart
              title="TMH enviadas"
              subtitle="Volumen operativo · PERD/EXCE excluidos"
              digits={2}
              area
              rows={
                periodRows(
                  (row) => [
                    row.tmh,
                  ]
                )
              }
              series={[
                {
                  label:
                    "TMH",
                  color:
                    CHART_COLORS[0],
                },
              ]}
            />

            <ColumnChart
              title="Merma en tránsito"
              subtitle="TMH salida menos llegada, solo guías con llegada"
              digits={2}
              unit=" %"
              rows={
                periodRows(
                  (row) => [
                    row.tmhDeparted &&
                    row.tmhArrival != null
                      ? (
                          (
                            row.tmhDeparted -
                            row.tmhArrival
                          ) /
                          row.tmhDeparted
                        ) *
                          100
                      : null,
                  ]
                )
              }
              series={[
                {
                  label:
                    "Merma %",
                  color:
                    CHART_COLORS[0],
                },
              ]}
            />

            <LineChart
              title="Tiempo de tránsito"
              subtitle="Horas promedio entre salida y llegada"
              digits={1}
              unit=" h"
              rows={
                periodRows(
                  (row) => [
                    row.transitHours,
                  ]
                )
              }
              series={[
                {
                  label:
                    "Horas",
                  color:
                    CHART_COLORS[0],
                },
              ]}
            />

            <ColumnChart
              title="Facturación y Concar"
              subtitle="Facturas asociadas a las guías del rango"
              digits={2}
              unit=" USD"
              rows={
                periodRows(
                  (row) => [
                    row.entered,
                    row.concar,
                  ]
                )
              }
              series={[
                {
                  label:
                    "USD ingresado",
                  color:
                    CHART_COLORS[0],
                },
                {
                  label:
                    "USD Concar",
                  color:
                    CHART_COLORS[1],
                },
              ]}
            />

            <LineChart
              title="Tarifa media de transporte"
              subtitle="USD por TMH de salida"
              digits={2}
              unit=" USD/TMH"
              rows={
                periodRows(
                  (row) => [
                    row.rate,
                  ]
                )
              }
              series={[
                {
                  label:
                    "USD/TMH",
                  color:
                    CHART_COLORS[0],
                },
              ]}
            />

            <ColumnChart
              title="Facturas registradas"
              subtitle="Facturas asociadas a las guías filtradas"
              rows={
                periodRows(
                  (row) => [
                    row.invoices,
                  ]
                )
              }
              series={[
                {
                  label:
                    "Facturas",
                  color:
                    CHART_COLORS[0],
                },
              ]}
            />

            <ColumnChart
              title="Salidas por día de la semana"
              subtitle="Guías despachadas según día de salida"
              rows={
                WEEKDAYS.map(
                  (
                    label,
                    index
                  ) => ({
                    key:
                      label,
                    label,
                    values: [
                      stats.weekdays[
                        index
                      ].guides,
                    ],
                  })
                )
              }
              series={[
                {
                  label:
                    "Guías",
                  color:
                    CHART_COLORS[0],
                },
              ]}
            />
          </div>

          <div className="trjk-chart-grid">
            <DonutChart
              title="Estado de guías"
              subtitle="Selecciona un estado para revisar sus guías"
              centerLabel="guías"
              items={[
                {
                  label:
                    "Cerradas",
                  value:
                    stats.status.closed,
                  color:
                    "var(--brand-success)",
                },
                {
                  label:
                    "Con factura abierta",
                  value:
                    stats.status.invoiced,
                  color:
                    "var(--brand-blue-light)",
                },
                {
                  label:
                    "Sin factura",
                  value:
                    stats.status.pending,
                  color:
                    "var(--brand-warning)",
                },
              ]}
              selected={
                selectedGuideStatus
              }
              onSelect={
                (
                  status
                ) =>
                  setSelectedGuideStatus(
                    status
                  )
              }
              panel={
                <GuideDetailPanel
                  label={
                    selectedGuideStatus
                  }
                  rows={
                    selectedStatusGuides
                  }
                  emptyHint="Selecciona un estado para ver sus guías."
                  onClear={
                    () =>
                      setSelectedGuideStatus(
                        null
                      )
                  }
                />
              }
            />

            <DonutChart
              title="Participación por transportista"
              subtitle="TMH operativas enviadas"
              centerLabel="TMH"
              digits={1}
              items={
                carrierShare
              }
              showTable={false}
            />
          </div>

          <div className="trjk-chart-grid">
            <RankChart
              title="Transportistas por TMH enviadas"
              subtitle="Los diez con mayor volumen"
              digits={2}
              rows={
                stats.carriers
                  .slice(
                    0,
                    10
                  )
                  .map(
                    (
                      carrier
                    ) => ({
                      label:
                        carrier.label,
                      value:
                        carrier.tmh,
                      note:
                        `${carrier.guides} guías · USD ${fmt(
                          carrier.usd,
                          0
                        )}`,
                    })
                  )
              }
              selected={
                selectedCarrier
              }
              onSelect={
                (
                  carrier
                ) =>
                  setSelectedCarrier(
                    carrier ===
                    selectedCarrier
                      ? null
                      : carrier
                  )
              }
              panel={
                <GuideDetailPanel
                  label={
                    selectedCarrier
                  }
                  rows={
                    selectedCarrierGuides
                  }
                  emptyHint="Selecciona un transportista para revisar sus guías."
                  onClear={
                    () =>
                      setSelectedCarrier(
                        null
                      )
                  }
                />
              }
            />

            <RankChart
              title="Lotes por guía"
              subtitle="Las diez guías con más lotes operativos"
              rows={
                stats.lotsByGuide
                  .slice(
                    0,
                    10
                  )
                  .map(
                    (row) => ({
                      label:
                        row.label,
                      value:
                        row.count,
                    })
                  )
              }
              selected={
                selectedGuide
              }
              onSelect={
                (
                  guide
                ) =>
                  setSelectedGuide(
                    guide ===
                    selectedGuide
                      ? null
                      : guide
                  )
              }
              panel={
                focusedGuide
                  ? (
                    <div className="trjk-guide-lots">
                      <div className="trjk-toolbar">
                        <div className="trjk-guide-lots-head">
                          <strong>
                            {
                              focusedGuide.guide_number
                            }
                          </strong>
                          <span>
                            {focusedGuide.transport_name
                              || focusedGuide.transport_ruc
                              || "Sin transportista"}
                            {" · fecha guía "}
                            {dateTime(
                              focusedGuide.guide_date
                            )}
                            {" · salida "}
                            {dateTime(
                              focusedGuide.departure_date
                            )}
                          </span>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={
                            () =>
                              setSelectedGuide(
                                null
                              )
                          }
                        >
                          Quitar selección
                        </Button>
                      </div>

                      <div className="trjk-table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>
                                Lote
                              </th>
                              <th>
                                Corr.
                              </th>
                              <th>
                                TMH salida
                              </th>
                              <th>
                                TMH llegada
                              </th>
                              <th>
                                Saldo SGM
                              </th>
                              <th>
                                Sacos usados / totales
                              </th>
                              <th>
                                Observación
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {focusedLots.map(
                              (
                                row
                              ) => (
                                <tr
                                  key={
                                    lotKey(
                                      row
                                    )
                                  }
                                >
                                  <td>
                                    {
                                      row.lot
                                    }
                                  </td>
                                  <td>
                                    {
                                      row.lot_corr
                                    }
                                  </td>
                                  <td>
                                    {fmt(
                                      row.tmh_departure,
                                      3
                                    )}
                                  </td>
                                  <td>
                                    {fmt(
                                      row.tmh_arrival,
                                      3
                                    )}
                                  </td>
                                  <td>
                                    {fmt(
                                      row.tmh_balance,
                                      3
                                    )}
                                  </td>
                                  <td>
                                    {fmt(
                                      row.bags_used,
                                      0
                                    )}{" "}
                                    /{" "}
                                    {fmt(
                                      row.bags_tot,
                                      0
                                    )}
                                  </td>
                                  <td>
                                    {row.balance_obs
                                      || "—"}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>

                          <tfoot>
                            <tr>
                              <th
                                colSpan={
                                  2
                                }
                              >
                                Total operativo
                              </th>
                              <th>
                                {fmt(
                                  focusedTmh(
                                    "tmh_departure"
                                  ),
                                  3
                                )}
                              </th>
                              <th>
                                {fmt(
                                  focusedTmh(
                                    "tmh_arrival"
                                  ),
                                  3
                                )}
                              </th>
                              <th
                                colSpan={
                                  3
                                }
                              >
                                {
                                  focusedLots.length
                                }{" "}
                                filas · PERD/EXCE excluidos
                              </th>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )
                  : (
                    <p className="trjk-chart-hint">
                      {selectedGuide
                        ? `La guía ${selectedGuide} no está en los filtros actuales.`
                        : "Selecciona una guía para revisar sus lotes."}
                    </p>
                  )
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}