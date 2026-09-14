"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "../../lib/apiClient";
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

const columnSpecs: [string, string, ExcelFilterKind?][] = [
  ["guide_number", "Guía"],
  ["status_name", "Estado"],
  ["lot", "Lote"],
  ["lot_corr", "Corr."],
  ["transport_name", "Transportista"],
  ["transport_ruc", "RUC"],
  ["departure_date", "Salida", "date"],
  ["arrival_date", "Llegada", "date"],
  ["tmh_departure", "TMH salida lote", "number"],
  ["tmh_arrival", "TMH llegada lote", "number"],
  ["tmh_balance", "Saldo SGM lote", "number"],
  ["bags_tot", "Sacos totales", "number"],
  ["bags_used", "Sacos usados", "number"],
  ["pu_transport_usd", "USD/TMH", "number"],
  ["amount_usd", "USD guía", "number"],
  ["document_number", "Factura"],
  ["invoice_document_date", "Fecha factura", "date"],
  ["invoice_amount_usd_web", "USD factura web", "number"],
  ["invoice_amount_usd", "USD factura Concar", "number"],
  ["subledger_num", "Subdiario"],
  ["comp_num", "Comprobante"],
  ["secu_num", "Secuencia"],
  ["plate_1", "Placa camión"],
  ["plate_2", "Placa carroza"],
  ["driver_name", "Conductor"],
  ["drive_license", "Licencia"],
  ["guide_date", "Fecha guía", "date"],
  ["transport_guide_number", "Guía transportista"],
  ["transport_guide_date", "Fecha guía transportista", "date"],
  ["sender_name", "Remitente"],
  ["sender_ruc", "RUC remitente"],
  ["recipient_name", "Destinatario"],
  ["recipient_ruc", "RUC destinatario"],
  ["origin_department", "Dpto. origen"],
  ["origin_province", "Provincia origen"],
  ["origin_district", "Distrito origen"],
  ["origin_address", "Dirección origen"],
  ["destination_department", "Dpto. destino"],
  ["destination_province", "Provincia destino"],
  ["destination_district", "Distrito destino"],
  ["destination_address", "Dirección destino"],
  ["load_ini", "Inicio carga", "date"],
  ["load_fin", "Fin carga", "date"],
  ["balance_obs", "Observación saldo"],
];
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
// Etiqueta corta del eje X; la clave completa queda en la tabla «Ver datos».
function periodLabel(key: string, period: KardexPeriod) {
  const match = key.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!match) return key;
  const month = MONTHS[Number(match[2]) - 1] ?? match[2];
  if (period === "month") return `${month} ${match[1]}`;
  const text = `${match[3]} ${month}`;
  return period === "week" ? `sem ${text}` : text;
}
const columns: ExcelColumnDef<KardexLot>[] = columnSpecs.map(
  ([key, label, kind]) => ({
    key,
    label,
    kind,
    value: (row) => (kind === "date" ? row[key]?.slice(0, 10) : row[key]),
  }),
);
// Tarjeta KPI con desglose en tooltip; solo se abre al pasar el puntero.
type Kpi = { label: string; value: string; note: string; tip: [string, string][] };
type KpiTrend = { label: string; values: (number | null)[] };
function KpiCard({
  label,
  value,
  note,
  tip,
  trend,
  loading,
}: Kpi & { loading: boolean; trend?: KpiTrend }) {
  const trendValues = (trend?.values || []).filter(
    (item): item is number => item != null && Number.isFinite(item),
  );
  const sparkWidth = 220;
  const sparkHeight = 54;
  const sparkPad = 4;
  const min = trendValues.length ? Math.min(...trendValues) : 0;
  const max = trendValues.length ? Math.max(...trendValues) : 0;
  const span = max - min;
  const spark =
    trendValues.length > 1
      ? trendValues.map((item, index) => ({
          x:
            sparkPad +
            (index * (sparkWidth - sparkPad * 2)) / (trendValues.length - 1),
          y:
            span === 0
              ? sparkHeight / 2
              : sparkHeight -
                sparkPad -
                ((item - min) / span) * (sparkHeight - sparkPad * 2),
        }))
      : [];
  const sparkPoints = spark
    .map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const areaPoints = spark.length
    ? `${spark[0].x.toFixed(1)},${sparkHeight - sparkPad} ${sparkPoints} ${spark[spark.length - 1].x.toFixed(1)},${sparkHeight - sparkPad}`
    : "";
  const lastPoint = spark[spark.length - 1];

  return (
    <div className="trjk-kpi" data-tip="true">
      <span>{label}</span>
      <strong>{loading ? "…" : value}</strong>
      <small>{note}</small>
      <div className="trjk-tip trjk-kpi-tip" role="tooltip">
        <header>{label}</header>
        {spark.length > 1 && (
          <div className="trjk-kpi-trend">
            <div className="trjk-kpi-trend-head">
              <span>{trend?.label}</span>
              <small>{trendValues.length} puntos</small>
            </div>
            <svg
              viewBox={`0 0 ${sparkWidth} ${sparkHeight}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polygon className="trjk-kpi-spark-area" points={areaPoints} />
              <polyline className="trjk-kpi-spark-line" points={sparkPoints} />
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
        {tip.map(([name, amount]) => (
          <div key={name}>
            <span>{name}</span>
            <strong>{loading ? "…" : amount}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
const dateTime = (value: string | null | undefined) =>
  value?.replace("T", " ").slice(0, 16) || "—";
export default function TRJKardexSum() {
  const [rows, setRows] = useState<KardexLot[]>([]);
  const [guides, setGuides] = useState<KardexGuide[]>([]);
  const [invoices, setInvoices] = useState<KardexInvoice[]>([]);
  const [view, setView] = useState<"summary" | "stats">("summary");
  const [period, setPeriod] = useState<KardexPeriod>("day");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [ruc, setRuc] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedGuide, setSelectedGuide] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const responses = await Promise.all([
        apiGet("/api/trjkar"),
        apiGet("/api/trjkar/guides"),
        apiGet("/api/trjkar/invo"),
      ]);
      for (const response of responses)
        if (!Array.isArray(response?.rows))
          throw new Error("Respuesta de Kardex inválida");
      setRows(responses[0].rows);
      setGuides(responses[1].rows);
      setInvoices(responses[2].rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el resumen");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const filtered = useMemo(() => {
    const needle = search.trim().toUpperCase();
    const within = (value: string | null) =>
      (!from && !to) ||
      (!!value &&
        (!from || value.slice(0, 10) >= from) &&
        (!to || value.slice(0, 10) <= to));
    const matchingGuides = new Set(
      rows
        .filter((row) =>
          `${row.guide_number} ${row.lot} ${row.document_number || ""} ${row.transport_name || ""}`
            .toUpperCase()
            .includes(needle),
        )
        .map((r) => r.guide_number),
    );
    const selectedGuides = guides.filter(
      (g) =>
        (!ruc || g.transport_ruc === ruc) &&
        within(g.departure_date) &&
        (!needle ||
          matchingGuides.has(g.guide_number) ||
          `${g.guide_number} ${g.document_number || ""} ${g.transport_name || ""} ${g.transport_ruc || ""}`
            .toUpperCase()
            .includes(needle)),
    );
    const guideSet = new Set(selectedGuides.map((g) => g.guide_number));
    const invoiceSet = new Set(
      selectedGuides.map((g) =>
        JSON.stringify([g.transport_ruc, g.document_number]),
      ),
    );
    return {
      guides: selectedGuides,
      rows: rows.filter((row) => guideSet.has(row.guide_number)),
      invoices: invoices.filter(
        (i) =>
          (!ruc || i.ruc === ruc) &&
          within(i.document_date) &&
          (!needle ||
            `${i.document_number} ${i.ruc} ${i.transport_name || ""}`
              .toUpperCase()
              .includes(needle) ||
            invoiceSet.has(JSON.stringify([i.ruc, i.document_number]))),
      ),
    };
  }, [rows, guides, invoices, from, to, ruc, search]);
  const excel = useExcelColumnFilters(filtered.rows, columns);
  const stats = useMemo(
    () =>
      kardexStatistics(
        filtered.rows,
        filtered.guides,
        filtered.invoices,
        period,
      ),
    [filtered, period],
  );
  const carrierOptions = [
    ...new Map(
      guides
        .filter((g) => g.transport_ruc)
        .map((g) => [g.transport_ruc!, g.transport_name || g.transport_ruc!]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const pages = Math.max(1, Math.ceil(excel.rows.length / 100));
  const currentPage = Math.min(page, pages);
  const entered = Number(kardexDecimal(stats.entered));
  const concar = Number(kardexDecimal(stats.concar));
  const invoiceCount = filtered.invoices.length;
  const topGuide = stats.lotsByGuide[0];
  const cards: Kpi[] = [
    {
      label: "Guías",
      value: fmt(stats.guideCount, 0),
      note: `${stats.closed} cerradas · ${stats.pending} sin factura`,
      tip: [
        ["Cerradas", fmt(stats.status.closed, 0)],
        ["Con factura abierta", fmt(stats.status.invoiced, 0)],
        ["Sin factura", fmt(stats.status.pending, 0)],
        ["Con llegada registrada", fmt(stats.arrivedCount, 0)],
        ["Transportistas distintos", fmt(stats.carrierCount, 0)],
      ],
    },
    {
      label: "TMH enviadas",
      value: fmt(stats.tmh, 3),
      note: "Salidas operativas · excluye PERD",
      tip: [
        [`TMH LIMPIEZA · ${stats.cleanupLots} lotes`, fmt(stats.tmhCleanup, 3)],
        [`TMH PERD · ${stats.perdLots} lotes`, fmt(stats.tmhPerd, 3)],
        ["LIMPIEZA + PERD", fmt(stats.tmhCleanup + stats.tmhPerd, 3)],
        [`TMH llegadas · ${stats.arrivedCount} guías`, fmt(stats.tmhArrived, 3)],
        [
          stats.tmhMaxGuide ? `Mayor guía · ${stats.tmhMaxGuide.label}` : "Mayor guía",
          fmt(stats.tmhMaxGuide?.tmh, 3),
        ],
      ],
    },
    {
      label: "Lotes por guía",
      value: fmt(stats.lotsPerGuide),
      note: `${stats.lotCount} lotes distintos`,
      tip: [
        ["Lotes operativos", fmt(stats.lotRows, 0)],
        ["Lotes distintos", fmt(stats.lotCount, 0)],
        [
          topGuide ? `Guía con más lotes · ${topGuide.label}` : "Guía con más lotes",
          fmt(topGuide?.count, 0),
        ],
        ["Lotes LIMPIEZA", fmt(stats.cleanupLots, 0)],
        ["Lotes con PERD", fmt(stats.perdLots, 0)],
      ],
    },
    {
      label: "USD ingresado",
      value: fmt(kardexDecimal(stats.entered)),
      note: `${invoiceCount} facturas web`,
      tip: [
        ["Facturas cerradas", fmt(stats.invoicesClosed, 0)],
        ["Facturas abiertas", fmt(invoiceCount - stats.invoicesClosed, 0)],
        ["Promedio por factura", fmt(invoiceCount ? entered / invoiceCount : null)],
        [`USD en guías valorizadas · ${stats.billedGuides}`, fmt(stats.billedUsd)],
        ["Ingresado menos guías", fmt(entered - stats.billedUsd)],
      ],
    },
    {
      label: "USD Concar",
      value: fmt(kardexDecimal(stats.concar)),
      note: `${stats.unmatched} facturas sin cruce contable`,
      tip: [
        ["Con cruce contable", fmt(invoiceCount - stats.unmatched, 0)],
        ["Sin cruce contable", fmt(stats.unmatched, 0)],
        ["Con importe distinto al ingresado", fmt(stats.mismatched, 0)],
        ["Cobertura sobre ingresado", entered ? `${fmt((concar / entered) * 100, 1)} %` : "—"],
      ],
    },
    {
      label: "Diferencia USD",
      value: fmt(kardexDecimal(stats.entered - stats.concar)),
      note: "Ingresado menos registrado en Concar",
      tip: [
        [`Facturas sin cruce · ${stats.unmatched}`, fmt(kardexDecimal(stats.enteredUnmatched))],
        [
          `Importes distintos · ${stats.mismatched}`,
          fmt(kardexDecimal(stats.entered - stats.enteredUnmatched - stats.concar)),
        ],
        ["Facturas conciliadas", fmt(invoiceCount - stats.unmatched - stats.mismatched, 0)],
      ],
    },
  ];
  const periodRows = (pick: (r: KardexPeriodStats) => (number | null)[]): ChartRow[] =>
    stats.series.map((r) => ({
      key: r.label,
      label: periodLabel(r.label, period),
      values: pick(r),
    }));
  const carrierShare: DonutItem[] = [
    ...stats.carriers.slice(0, 5).map((c, i) => ({
      label: c.label,
      value: c.tmh,
      color: CHART_COLORS[i],
      note: `${c.guides} guías`,
    })),
    {
      label: "Otros",
      value: stats.carriers.slice(5).reduce((sum, c) => sum + c.tmh, 0),
      color: CHART_OTHER,
      note: `${stats.carriers.slice(5).length} transportistas`,
    },
  ];
  const hours = (v: number | null) => (v == null ? "—" : `${fmt(v, 1)} h`);
  const operationCards: Kpi[] = [
    {
      label: "Merma en tránsito",
      value: stats.lossPct == null ? "—" : `${fmt(stats.lossPct, 2)} %`,
      note:
        stats.lossPct == null
          ? "Sin guías con llegada registrada"
          : `Sobre ${fmt(stats.arrivedGuidesTmh, 1)} TMH con llegada`,
      tip: [
        ["TMH salida con llegada", fmt(stats.arrivedGuidesTmh, 3)],
        ["TMH llegada", fmt(stats.tmhArrived, 3)],
        ["Merma TMH", fmt(stats.arrivedGuidesTmh - stats.tmhArrived, 3)],
        ["Guías con llegada", fmt(stats.arrivedCount, 0)],
        ["Guías sin llegada", fmt(stats.guideCount - stats.arrivedCount, 0)],
      ],
    },
    {
      label: "Tiempo de tránsito",
      value: hours(stats.avgTransitHours),
      note: `${stats.transitCount} guías con salida y llegada`,
      tip: [
        ["Mínimo", hours(stats.transitMin)],
        ["Máximo", hours(stats.transitMax)],
        ["Guías con salida y llegada", fmt(stats.transitCount, 0)],
        ["Guías sin llegada", fmt(stats.guideCount - stats.transitCount, 0)],
      ],
    },
    {
      label: "Tarifa media",
      value: stats.avgRate == null ? "—" : `${fmt(stats.avgRate, 2)} USD/TMH`,
      note: "Ponderada por TMH de guía valorizada",
      tip: [
        ["Guías valorizadas", fmt(stats.billedGuides, 0)],
        ["TMH valorizadas", fmt(stats.billedTmh, 3)],
        ["USD valorizados", fmt(stats.billedUsd)],
        ["Tarifa mínima", stats.rateMin == null ? "—" : `${fmt(stats.rateMin)} USD/TMH`],
        ["Tarifa máxima", stats.rateMax == null ? "—" : `${fmt(stats.rateMax)} USD/TMH`],
      ],
    },
    {
      label: "TMH por guía",
      value: fmt(stats.guideCount ? stats.tmh / stats.guideCount : 0, 2),
      note: "Promedio de las guías filtradas",
      tip: [
        ["TMH enviadas", fmt(stats.tmh, 3)],
        ["Guías", fmt(stats.guideCount, 0)],
        [
          stats.tmhMaxGuide ? `Mayor guía · ${stats.tmhMaxGuide.label}` : "Mayor guía",
          fmt(stats.tmhMaxGuide?.tmh, 3),
        ],
        ["Lotes por guía", fmt(stats.lotsPerGuide)],
      ],
    },
  ];
  const trendPeriodLabel =
    period === "month"
      ? "Evolución mensual"
      : period === "week"
        ? "Evolución semanal"
        : "Evolución diaria";
  const kpiTrend = (label: string): KpiTrend | undefined => {
    const values = (pick: (row: KardexPeriodStats) => number | null) =>
      stats.series.map(pick);

    switch (label) {
      case "Guías":
        return { label: trendPeriodLabel, values: values((row) => row.guides) };
      case "TMH enviadas":
        return { label: trendPeriodLabel, values: values((row) => row.tmh) };
      case "Lotes por guía":
        return {
          label: "Distribución · top 10 guías",
          values: stats.lotsByGuide.slice(0, 10).map((row) => row.count),
        };
      case "USD ingresado":
        return { label: trendPeriodLabel, values: values((row) => row.entered) };
      case "USD Concar":
        return { label: trendPeriodLabel, values: values((row) => row.concar) };
      case "Diferencia USD":
        return {
          label: trendPeriodLabel,
          values: values((row) => row.entered - row.concar),
        };
      case "Merma en tránsito":
        return {
          label: trendPeriodLabel,
          values: values((row) =>
            row.tmhDeparted != null &&
            row.tmhDeparted > 0 &&
            row.tmhArrival != null
              ? ((row.tmhDeparted - row.tmhArrival) / row.tmhDeparted) * 100
              : null,
          ),
        };
      case "Tiempo de tránsito":
        return {
          label: trendPeriodLabel,
          values: values((row) => row.transitHours),
        };
      case "Tarifa media":
        return { label: trendPeriodLabel, values: values((row) => row.rate) };
      case "TMH por guía":
        return {
          label: trendPeriodLabel,
          values: values((row) => (row.guides ? row.tmh / row.guides : null)),
        };
      default:
        return undefined;
    }
  };
  // Lotes de la guía elegida en «Lotes por guía»; PERD se lista al final.
  const focusedGuide = selectedGuide
    ? filtered.guides.find((g) => g.guide_number === selectedGuide)
    : undefined;
  const focusedLots = focusedGuide
    ? filtered.rows
        .filter((row) => row.guide_number === selectedGuide)
        .sort(
          (a, b) =>
            Number(isOperationalLot(b)) - Number(isOperationalLot(a)) ||
            a.lot.localeCompare(b.lot) ||
            a.lot_corr.localeCompare(b.lot_corr),
        )
    : [];
  const focusedTmh = (key: string) =>
    focusedLots
      .filter(isOperationalLot)
      .reduce((sum, row) => sum + Number(row[key] || 0), 0);
  return (
    <div className="trjk-workspace trjk-summary">
      <div className="trjk-toolbar">
        <div>
          <h2>Kardex de transporte</h2>
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
              variant={view === "summary" ? "primary" : "ghost"}
              aria-pressed={view === "summary"}
              onClick={() => setView("summary")}
            >
              Resumen
            </Button>
            <Button
              size="sm"
              variant={view === "stats" ? "primary" : "ghost"}
              aria-pressed={view === "stats"}
              onClick={() => setView("stats")}
            >
              Estadísticas
            </Button>
          </div>
          <Button size="sm" disabled={loading} onClick={() => void load()}>
            Actualizar
          </Button>
        </div>
      </div>
      {error && (
        <div role="alert" className="trjk-message" data-error="true">
          {error}
        </div>
      )}
      <section className="trjk-card trjk-toolbar">
        <label>
          Desde
          <input
            type="date"
            className="input"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            className="input"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Transportista
          <select
            className="input"
            value={ruc}
            onChange={(e) => {
              setRuc(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {carrierOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Buscar
          <input
            className="input"
            value={search}
            placeholder="Guía, lote, factura o RUC"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <Button
          size="sm"
          onClick={() => {
            setFrom("");
            setTo("");
            setRuc("");
            setSearch("");
            setPage(1);
            excel.clear();
          }}
        >
          Limpiar filtros
        </Button>
      </section>
      <div className="trjk-kpi-grid">
        {cards.map((card) => (
          <KpiCard
            key={card.label}
            {...card}
            loading={loading}
            trend={kpiTrend(card.label)}
          />
        ))}
      </div>
      <p className="trjk-method">
        Guías por fecha de salida; facturas por fecha de documento. Cada factura
        se cuenta una vez por RUC y número. Concar corresponde al registro
        contable disponible, no acredita un pago bancario.
      </p>
      {view === "summary" ? (
        <section className="trjk-card">
          <div className="trjk-toolbar">
            <h3>Detalle por lote ({excel.rows.length})</h3>
            <span className="muted">
              Filtros de columna aplicados solo a esta tabla · importes de guía
              y factura se repiten como referencia
            </span>
          </div>
          <div className="trjk-table-scroll trjk-summary-table">
            <table>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key}>
                      <div className="trjk-column">
                        {c.label}
                        <ExcelHeaderFilter {...excel.headerProps(c.key)} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {excel.rows
                  .slice((currentPage - 1) * 100, currentPage * 100)
                  .map((row) => (
                    <tr
                      key={lotKey(row)}
                      data-closed={row.status_name === "CERRADO"}
                    >
                      {columns.map((c) => (
                        <td key={c.key}>
                          {c.kind === "number"
                            ? fmt(row[c.key], c.key.startsWith("tmh") ? 3 : 2)
                            : c.kind === "date"
                              ? row[c.key]?.replace("T", " ").slice(0, 16) ||
                                "—"
                              : row[c.key] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                {!excel.rows.length && (
                  <tr>
                    <td colSpan={columns.length}>
                      {loading
                        ? "Cargando…"
                        : "No hay movimientos para los filtros seleccionados."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="trjk-toolbar">
            <span>
              Página {currentPage} de {pages}
            </span>
            <div className="trjk-actions">
              <Button
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                disabled={currentPage >= pages}
                onClick={() => setPage(currentPage + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="trjk-toolbar">
            <div>
              <h3>Actividad y conciliación</h3>
              <p className="muted" style={{ margin: "3px 0 0" }}>
                {period === "week"
                  ? "Semanas de lunes a domingo, identificadas por la fecha del lunes."
                  : period === "month"
                    ? "Agrupado por mes de salida de la guía."
                    : "Agrupado por día de salida de la guía."}
              </p>
            </div>
            <div
              className="trjk-toggle"
              role="group"
              aria-label="Agrupar estadísticas"
            >
              {(
                [
                  ["day", "Día"],
                  ["week", "Semana"],
                  ["month", "Mes"],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  aria-pressed={period === key}
                  variant={period === key ? "primary" : "ghost"}
                  onClick={() => setPeriod(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="trjk-stat-grid">
            {operationCards.map((card) => (
              <KpiCard
                key={card.label}
                {...card}
                loading={loading}
                trend={kpiTrend(card.label)}
              />
            ))}
          </div>

          <div className="trjk-chart-grid">
            <ColumnChart
              title="Guías despachadas"
              subtitle="Ritmo de salida por período"
              rows={periodRows((r) => [r.guides])}
              series={[{ label: "Guías", color: CHART_COLORS[0] }]}
            />
            <LineChart
              title="TMH enviadas"
              subtitle="Volumen de salida operativo por período, sin PERD"
              digits={2}
              area
              rows={periodRows((r) => [r.tmh])}
              series={[{ label: "TMH", color: CHART_COLORS[0] }]}
            />
            <ColumnChart
              title="Merma en tránsito"
              subtitle="TMH salida menos llegada, solo guías con llegada registrada"
              digits={2}
              unit=" %"
              rows={periodRows((r) => [
                r.tmhDeparted && r.tmhArrival != null
                  ? ((r.tmhDeparted - r.tmhArrival) / r.tmhDeparted) * 100
                  : null,
              ])}
              series={[{ label: "Merma %", color: CHART_COLORS[0] }]}
            />
            <LineChart
              title="Tiempo de tránsito"
              subtitle="Horas promedio entre salida y llegada registrada"
              digits={1}
              unit=" h"
              rows={periodRows((r) => [r.transitHours])}
              series={[{ label: "Horas", color: CHART_COLORS[0] }]}
            />
            <ColumnChart
              title="Facturación y Concar"
              subtitle="Por fecha de factura · cada factura una vez por RUC y número"
              digits={2}
              unit=" USD"
              rows={periodRows((r) => [r.entered, r.concar])}
              series={[
                { label: "USD ingresado", color: CHART_COLORS[0] },
                { label: "USD Concar", color: CHART_COLORS[1] },
              ]}
            />
            <LineChart
              title="Tarifa media de transporte"
              subtitle="USD por TMH de salida, ponderado por guía valorizada"
              digits={2}
              unit=" USD/TMH"
              rows={periodRows((r) => [r.rate])}
              series={[{ label: "USD/TMH", color: CHART_COLORS[0] }]}
            />
            <ColumnChart
              title="Facturas registradas"
              subtitle="Facturas web por fecha de documento"
              rows={periodRows((r) => [r.invoices])}
              series={[{ label: "Facturas", color: CHART_COLORS[0] }]}
            />
            <ColumnChart
              title="Salidas por día de la semana"
              subtitle="Guías despachadas según el día de salida"
              rows={WEEKDAYS.map((label, i) => ({
                key: label,
                label,
                values: [stats.weekdays[i].guides],
              }))}
              series={[{ label: "Guías", color: CHART_COLORS[0] }]}
            />
          </div>

          <div className="trjk-chart-grid">
            <DonutChart
              title="Estado de guías"
              subtitle="Cerradas, abiertas con factura y pendientes de facturar"
              centerLabel="guías"
              items={[
                { label: "Cerradas", value: stats.status.closed, color: "var(--brand-success)" },
                { label: "Con factura abierta", value: stats.status.invoiced, color: "var(--brand-blue-light)" },
                { label: "Sin factura", value: stats.status.pending, color: "var(--brand-warning)" },
              ]}
            />
            <DonutChart
              title="Participación por transportista"
              subtitle="TMH enviadas · los cinco mayores y el resto"
              centerLabel="TMH"
              digits={1}
              items={carrierShare}
            />
          </div>

          <div className="trjk-chart-grid">
            <RankChart
              title="Transportistas por TMH enviadas"
              subtitle="Los diez con mayor volumen · guías y USD valorizados"
              digits={2}
              rows={stats.carriers.slice(0, 10).map((c) => ({
                label: c.label,
                value: c.tmh,
                note: `${c.guides} guías · USD ${fmt(c.usd, 0)}`,
              }))}
            />
            <RankChart
              title="Lotes por guía"
              subtitle="Las diez guías con más lotes distintos · elige una para ver sus lotes"
              rows={stats.lotsByGuide
                .slice(0, 10)
                .map((r) => ({ label: r.label, value: r.count }))}
              selected={selectedGuide}
              onSelect={(guide) =>
                setSelectedGuide(guide === selectedGuide ? null : guide)
              }
              panel={
                focusedGuide ? (
                  <div className="trjk-guide-lots">
                    <div className="trjk-toolbar">
                      <div className="trjk-guide-lots-head">
                        <strong>{focusedGuide.guide_number}</strong>
                        <span>
                          {focusedGuide.transport_name || focusedGuide.transport_ruc || "Sin transportista"}
                          {" · salida "}
                          {dateTime(focusedGuide.departure_date)}
                          {" · "}
                          {focusedGuide.status_name === "CERRADO"
                            ? `cerrada · factura ${focusedGuide.document_number}`
                            : focusedGuide.document_number
                              ? `factura ${focusedGuide.document_number}`
                              : "sin factura"}
                        </span>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedGuide(null)}>
                        Quitar selección
                      </Button>
                    </div>
                    <div className="trjk-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Lote</th>
                            <th>Corr.</th>
                            <th>TMH salida</th>
                            <th>TMH llegada</th>
                            <th>Saldo SGM</th>
                            <th>Sacos usados / totales</th>
                            <th>Observación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {focusedLots.map((row) => (
                            <tr key={lotKey(row)} data-perd={!isOperationalLot(row)}>
                              <td>{row.lot}</td>
                              <td>{row.lot_corr}</td>
                              <td>{fmt(row.tmh_departure, 3)}</td>
                              <td>{fmt(row.tmh_arrival, 3)}</td>
                              <td>{fmt(row.tmh_balance, 3)}</td>
                              <td>
                                {fmt(row.bags_used, 0)} / {fmt(row.bags_tot, 0)}
                              </td>
                              <td>{row.balance_obs || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <th colSpan={2}>Total operativo · sin PERD</th>
                            <th>{fmt(focusedTmh("tmh_departure"), 3)}</th>
                            <th>{fmt(focusedTmh("tmh_arrival"), 3)}</th>
                            <th colSpan={3}>
                              {focusedLots.filter(isOperationalLot).length} lotes ·{" "}
                              {focusedLots.filter((row) => !isOperationalLot(row)).length} PERD
                            </th>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="trjk-chart-hint">
                    {selectedGuide
                      ? `La guía ${selectedGuide} no está en los filtros actuales.`
                      : "Selecciona una guía del ranking para ver los lotes que la componen."}
                  </p>
                )
              }
            />
          </div>
        </>
      )}
    </div>
  );
}