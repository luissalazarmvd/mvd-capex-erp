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
  const cards = [
    [
      "Guías",
      fmt(stats.guideCount, 0),
      `${stats.closed} cerradas · ${stats.pending} sin factura`,
    ],
    ["TMH enviadas", fmt(stats.tmh, 3), "Salidas operativas · excluye PERD"],
    [
      "Lotes por guía",
      fmt(stats.lotsPerGuide),
      `${stats.lotCount} lotes distintos`,
    ],
    [
      "USD ingresado",
      fmt(kardexDecimal(stats.entered)),
      `${filtered.invoices.length} facturas web`,
    ],
    [
      "USD Concar",
      fmt(kardexDecimal(stats.concar)),
      `${stats.unmatched} facturas sin cruce contable`,
    ],
    [
      "Diferencia USD",
      fmt(kardexDecimal(stats.entered - stats.concar)),
      "Ingresado menos registrado en Concar",
    ],
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
  const operationCards = [
    [
      "Merma en tránsito",
      stats.lossPct == null ? "—" : `${fmt(stats.lossPct, 2)} %`,
      stats.lossPct == null
        ? "Sin guías con llegada registrada"
        : `Sobre ${fmt(stats.arrivedGuidesTmh, 1)} TMH con llegada`,
    ],
    [
      "Tiempo de tránsito",
      stats.avgTransitHours == null ? "—" : `${fmt(stats.avgTransitHours, 1)} h`,
      `${stats.transitCount} guías con salida y llegada`,
    ],
    [
      "Tarifa media",
      stats.avgRate == null ? "—" : `${fmt(stats.avgRate, 2)} USD/TMH`,
      "Ponderada por TMH de guía valorizada",
    ],
    [
      "TMH por guía",
      fmt(stats.guideCount ? stats.tmh / stats.guideCount : 0, 2),
      "Promedio de las guías filtradas",
    ],
  ];
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
        {cards.map(([label, value, note]) => (
          <div className="trjk-kpi" key={label}>
            <span>{label}</span>
            <strong>{loading ? "…" : value}</strong>
            <small>{note}</small>
          </div>
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
            {operationCards.map(([label, value, note]) => (
              <div className="trjk-kpi" key={label}>
                <span>{label}</span>
                <strong>{loading ? "…" : value}</strong>
                <small>{note}</small>
              </div>
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

          <div className="trjk-chart-grid trjk-chart-grid-3">
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
            <RankChart
              title="Origen de la carga"
              subtitle="TMH enviadas por provincia de origen"
              digits={1}
              rows={stats.origins.slice(0, 8).map((o) => ({
                label: o.label,
                value: o.tmh,
                note: `${o.guides} guías`,
              }))}
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
              subtitle="Las diez guías con más lotes distintos"
              rows={stats.lotsByGuide
                .slice(0, 10)
                .map((r) => ({ label: r.label, value: r.count }))}
            />
          </div>
        </>
      )}
    </div>
  );
}