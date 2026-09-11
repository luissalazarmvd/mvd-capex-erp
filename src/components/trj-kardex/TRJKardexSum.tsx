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
} from "../../lib/trjKardex";

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
const columns: ExcelColumnDef<KardexLot>[] = columnSpecs.map(
  ([key, label, kind]) => ({
    key,
    label,
    kind,
    value: (row) => (kind === "date" ? row[key]?.slice(0, 10) : row[key]),
  }),
);
type BarRow = { label: string; values: number[] };
type BarSeries = { label: string; color: string };

function Bars({
  title,
  subtitle,
  rows,
  series,
  digits = 0,
}: {
  title: string;
  subtitle: string;
  rows: BarRow[];
  series: BarSeries[];
  digits?: number;
}) {
  const finite = rows.flatMap((r) => r.values).filter(Number.isFinite);
  const max = Math.max(1, ...finite);
  const min = Math.min(0, ...finite);
  const scale = (n: number) => 175 - ((n - min) / (max - min)) * 150;
  const width = Math.max(550, rows.length * 76 + 70);
  const groupWidth = (width - 70) / Math.max(1, rows.length);
  const barWidth = Math.min(26, groupWidth / (series.length + 1));
  return (
    <section className="trjk-card trjk-chart">
      <h3>{title}</h3>
      <p className="muted">{subtitle}</p>
      <div className="trjk-legend">
        {series.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      {!rows.length ? (
        <div className="trjk-empty">Sin datos para este período.</div>
      ) : (
        <>
          <div className="trjk-chart-scroll">
            <svg
              role="img"
              aria-label={title}
              width={width}
              height="235"
              viewBox={`0 0 ${width} 235`}
            >
              <title>
                {title}. Los valores también están disponibles en la tabla de
                datos.
              </title>
              {[0, 0.5, 1].map((ratio) => {
                const value = min + (max - min) * ratio;
                return (
                  <g key={ratio}>
                    <line
                      className="trjk-grid-line"
                      x1="55"
                      x2={width - 10}
                      y1={scale(value)}
                      y2={scale(value)}
                    />
                    <text
                      className="trjk-axis"
                      x="50"
                      y={scale(value) + 4}
                      textAnchor="end"
                    >
                      {Intl.NumberFormat("es", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(value)}
                    </text>
                  </g>
                );
              })}
              <line
                className="trjk-zero-line"
                x1="55"
                x2={width - 10}
                y1={scale(0)}
                y2={scale(0)}
              />
              {rows.map((row, index) => (
                <g key={row.label}>
                  {row.values.map((value, j) => (
                    <rect
                      key={j}
                      x={60 + groupWidth * index + barWidth * j}
                      y={Math.min(scale(value), scale(0))}
                      width={barWidth - 3}
                      height={Math.max(
                        value === 0 ? 0 : 1,
                        Math.abs(scale(0) - scale(value)),
                      )}
                      rx="2"
                      fill={series[j].color}
                    >
                      <title>
                        {row.label} · {series[j].label}: {fmt(value, digits)}
                      </title>
                    </rect>
                  ))}
                  <text
                    className="trjk-axis"
                    x={60 + groupWidth * index}
                    y="195"
                    transform={`rotate(25 ${60 + groupWidth * index} 195)`}
                  >
                    {row.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
          <details className="trjk-chart-data">
            <summary>Ver datos</summary>
            <div className="trjk-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Período</th>
                    {series.map((s) => (
                      <th key={s.label}>{s.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      {r.values.map((v, j) => (
                        <td key={j}>{fmt(v, digits)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}

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
            <h3>Actividad y conciliación</h3>
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
          {period === "week" && (
            <p className="muted">
              Semanas de lunes a domingo, identificadas por la fecha del lunes.
            </p>
          )}
          <div className="trjk-chart-grid">
            <Bars
              title="Guías despachadas"
              subtitle="Ritmo de salida por período"
              rows={stats.series.map((r) => ({
                label: r.label,
                values: [r.guides],
              }))}
              series={[{ label: "Guías", color: "var(--mod)" }]}
            />
            <Bars
              title="TMH enviadas"
              subtitle="Volumen transportado, sin pérdidas PERD"
              digits={3}
              rows={stats.series.map((r) => ({
                label: r.label,
                values: [r.tmh],
              }))}
              series={[{ label: "TMH", color: "var(--brand-blue-light)" }]}
            />
            <Bars
              title="Facturación y Concar"
              subtitle="Comparación por fecha de factura · importes únicos"
              digits={2}
              rows={stats.series.map((r) => ({
                label: r.label,
                values: [r.entered, r.concar],
              }))}
              series={[
                { label: "USD ingresado", color: "var(--brand-gold)" },
                { label: "USD Concar", color: "var(--mod)" },
              ]}
            />
            <Bars
              title="Lotes por guía"
              subtitle="Las 12 guías con más lotes distintos"
              rows={stats.lotsByGuide
                .slice(0, 12)
                .map((r) => ({ label: r.label, values: [r.count] }))}
              series={[{ label: "Lotes", color: "var(--ok)" }]}
            />
          </div>
          <section className="trjk-card">
            <h3>Transportistas por TMH enviadas</h3>
            <div className="trjk-ranking">
              {stats.carriers.slice(0, 10).map((c, index) => (
                <div key={`${c.label}:${index}`}>
                  <span>
                    {index + 1}. {c.label}
                  </span>
                  <meter
                    min="0"
                    max={Math.max(1, stats.tmh)}
                    value={c.tmh}
                    aria-label={`TMH de ${c.label}`}
                  />
                  <strong>{fmt(c.tmh, 3)} TMH</strong>
                  <small>{c.guides} guías</small>
                </div>
              ))}
              {!stats.carriers.length && (
                <p className="muted">
                  Sin transportistas para los filtros seleccionados.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
