// src/components/vai/VaiDashboard.tsx
//
// Renderer fijo de V-Ai: dado un spec validado, consulta cada fuente por su
// endpoint del catálogo (nunca una URL del modelo), aplica filtros en el
// navegador y dibuja KPIs, gráficos (KardexCharts) y tablas. Cambiar filtros o
// actualizar datos no vuelve a llamar a la IA.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "../../lib/apiClient";
import { CHART_COLORS, CHART_OTHER, ColumnChart, DonutChart, LineChart, RankChart, type ChartRow, type ChartSeries } from "../trj-kardex/KardexCharts";
import { Button } from "../ui/Button";
import { ExcelHeaderFilter, useExcelColumnFilters, type ExcelColumnDef } from "../ui/ExcelFilters";
import { VAI_SOURCE_MAP, vaiAreaLabel, vaiField, type VaiSource } from "../../lib/vai/catalog";
import { canUseLogScale, prefersLogScale, type ChartScaleMode } from "../../lib/chartScale";
import { VaiExportProvider, VaiExportSection } from "./VaiExportControls";
import {
  applyFilters,
  chartAxisGroup,
  chartFormat,
  computeWidget,
  distinctValues,
  defaultFilterValues,
  filterKey,
  formatValue,
  summarizeTable,
  type VaiFilterState,
  type VaiRow,
  type VaiWidgetData,
} from "../../lib/vai/engine";
import type { VaiDashboardSpec, VaiFilterSpec, VaiWidgetSpec } from "../../lib/vai/spec";

type SourceState = { rows: VaiRow[]; loading: boolean; error: string | null; loadedAt: number | null };

type Props = {
  spec: VaiDashboardSpec;
  /** Cambia cuando el usuario pide actualizar datos. */
  refreshToken?: number;
};

export default function VaiDashboard({ spec, refreshToken = 0 }: Props) {
  const sources = useMemo(
    () => spec.sources.map((id) => VAI_SOURCE_MAP.get(id)).filter((source): source is VaiSource => Boolean(source)),
    [spec.sources],
  );
  const [data, setData] = useState<Record<string, SourceState>>({});
  const [filters, setFilters] = useState<VaiFilterState>({});

  const load = useCallback(async () => {
    setData((prev) => {
      const next = { ...prev };
      for (const source of sources) next[source.id] = { rows: prev[source.id]?.rows ?? [], loading: true, error: null, loadedAt: prev[source.id]?.loadedAt ?? null };
      return next;
    });
    await Promise.all(
      sources.map(async (source) => {
        try {
          const out = await apiGet(source.endpoint);
          const rows = Array.isArray(out?.rows) ? (out.rows as VaiRow[]) : [];
          setData((prev) => ({ ...prev, [source.id]: { rows, loading: false, error: null, loadedAt: Date.now() } }));
        } catch (error) {
          setData((prev) => ({
            ...prev,
            [source.id]: { rows: [], loading: false, error: error instanceof Error ? error.message : "Error al consultar la fuente", loadedAt: null },
          }));
        }
      }),
    );
  }, [sources]);

  useEffect(() => {
    setFilters({});
  }, [spec.filters]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const defaultFilters = useMemo(() => defaultFilterValues(spec.filters, VAI_SOURCE_MAP, Object.fromEntries(Object.entries(data).map(([id, state]) => [id, state.rows]))), [spec.filters, data]);

  const effectiveFilters = useMemo<VaiFilterState>(() => {
    const next: VaiFilterState = { ...defaultFilters };

    for (const [key, value] of Object.entries(filters)) {
      next[key] = {
        ...(defaultFilters[key] ?? {}),
        ...value,
      };
    }

    return next;
  }, [defaultFilters, filters]);

  const filtered = useMemo(() => {
    const out: Record<string, VaiRow[]> = {};
    for (const source of sources) out[source.id] = applyFilters(source, data[source.id]?.rows ?? [], spec.filters, effectiveFilters);
    return out;
  }, [sources, data, spec.filters, effectiveFilters]);

  const loading = sources.some((source) => data[source.id]?.loading ?? true);
  const exportContext = spec.filters.map((filter) => {
    const value = effectiveFilters[filterKey(filter)] ?? {};
    return `${filter.label}: ${filter.kind === "date_range" ? `${value.from || "Sin límite"} a ${value.to || "Sin límite"}` : value.value || "Todos"}`;
  });
  const kpis = spec.widgets.filter((widget) => widget.type === "kpi");
  const others = spec.widgets.filter((widget) => widget.type !== "kpi");
  const hasFilters = spec.filters.some((filter) => {
    const key = filterKey(filter);
    const value = filters[key];

    if (!value) return false;
    if (filter.kind === "select") return Boolean(value.value);

    const defaults = defaultFilters[key] ?? {};

    return (
      (value.from ?? defaults.from ?? "") !== (defaults.from ?? "") ||
      (value.to ?? defaults.to ?? "") !== (defaults.to ?? "")
    );
  });

  return (
    <div className="vai-board">
      <VaiExportProvider title={spec.title} context={exportContext} disabled={loading || sources.some((source) => Boolean(data[source.id]?.error))}>
      {spec.description ? <p className="muted" style={{ margin: 0 }}>{spec.description}</p> : null}

      {spec.filters.length ? (
        <section className="trjk-card">
          <div className="trjk-toolbar">
            <h3>Filtros</h3>
            <div className="trjk-actions">
              {hasFilters ? (
                <Button size="sm" variant="ghost" onClick={() => setFilters({})}>
                  Limpiar filtros
                </Button>
              ) : null}
            </div>
          </div>
          <div className="vai-filters" style={{ marginTop: 10 }}>
            {spec.filters.map((filter) => (
              <FilterControl
                key={filterKey(filter)}
                filter={filter}
                rows={data[filter.source]?.rows ?? []}
                value={effectiveFilters[filterKey(filter)] ?? {}}
                onChange={(value) => setFilters((prev) => ({ ...prev, [filterKey(filter)]: value }))}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="vai-board-meta" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {sources.map((source) => {
          const state = data[source.id];
          return (
            <span key={source.id} title={`${source.endpoint} · ${source.grain}`}>
              {vaiAreaLabel(source.area)} · {source.name}:{" "}
              {state?.loading ? "cargando…" : state?.error ? <span style={{ color: "var(--bad)" }}>error</span> : `${(filtered[source.id] ?? []).length.toLocaleString("es-PE")} de ${(state?.rows ?? []).length.toLocaleString("es-PE")} filas`}
            </span>
          );
        })}
      </div>

      {sources.map((source) =>
        data[source.id]?.error ? (
          <div key={source.id} className="vai-message" data-error="true">
            No se pudo consultar «{source.name}»: {data[source.id].error}
          </div>
        ) : null,
      )}

      {kpis.length ? (
        <div className="vai-kpi-grid">
          {kpis.map((widget, i) => (
            <KpiCard key={`${widget.source}-${widget.metrics[0]}-${i}`} id={`kpi-${i}`} order={i} widget={widget} rows={filtered[widget.source] ?? []} loading={loading} />
          ))}
        </div>
      ) : null}

      {others.length ? (
        <div className="vai-widget-grid">
          {others.map((widget, i) => (
            <div key={`${widget.type}-${widget.source}-${i}`} data-span={widget.type === "table" || (widget.type === "line" && others.length % 2 === 1 && i === others.length - 1) ? "2" : "1"}>
              <Widget id={`widget-${i}`} order={kpis.length + i} widget={widget} rows={filtered[widget.source] ?? []} />
            </div>
          ))}
        </div>
      ) : null}
      </VaiExportProvider>
    </div>
  );
}

function FilterControl({ filter, rows, value, onChange }: { filter: VaiFilterSpec; rows: VaiRow[]; value: { from?: string; to?: string; value?: string }; onChange: (value: { from?: string; to?: string; value?: string }) => void }) {
  const options = useMemo(() => (filter.kind === "select" ? distinctValues(rows, filter.field) : []), [filter, rows]);
  const sourceName = VAI_SOURCE_MAP.get(filter.source)?.name ?? filter.source;
  if (filter.kind === "date_range") {
    return (
      <label title={sourceName}>
        <span>{filter.label}</span>
        <div className="vai-range">
          <input className="input" type="date" value={value.from ?? ""} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          <input className="input" type="date" value={value.to ?? ""} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </div>
      </label>
    );
  }
  return (
    <label title={sourceName}>
      <span>{filter.label}</span>
      <select className="select" value={value.value ?? ""} onChange={(e) => onChange({ value: e.target.value })}>
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function KpiCard({ id, order, widget, rows, loading }: { id: string; order: number; widget: VaiWidgetSpec; rows: VaiRow[]; loading: boolean }) {
  const source = VAI_SOURCE_MAP.get(widget.source);
  const result = source ? computeWidget(widget, source, rows) : null;
  if (!result || result.kind !== "kpi") return null;
  return (
    <VaiExportSection id={id} order={order} title={widget.title} kind="kpi">
    <div className="vai-kpi" title={source?.metrics.find((metric) => metric.id === result.metric.id)?.description}>
      <span>{widget.title}</span>
      <strong>{loading && !rows.length ? "…" : formatValue(result.value, result.metric.format)}</strong>
      <small>
        {result.metric.label} · {rows.length.toLocaleString("es-PE")} filas · {source?.name}
      </small>
    </div>
    </VaiExportSection>
  );
}

function Widget({ id, order, widget, rows }: { id: string; order: number; widget: VaiWidgetSpec; rows: VaiRow[] }) {
  const [scaleChoice, setScaleChoice] = useState<"auto" | ChartScaleMode>("auto");
  const source = VAI_SOURCE_MAP.get(widget.source);
  const result = source ? computeWidget(widget, source, rows) : null;
  if (!source || !result) return null;
  const subtitle = widget.dimension
    ? `${source.name} · por ${vaiField(source, widget.dimension)?.label ?? widget.dimension}`
    : widget.dateField
      ? `${source.name} · por ${widget.bucket === "day" ? "día" : widget.bucket === "week" ? "semana" : "mes"} de ${vaiField(source, widget.dateField)?.label ?? widget.dateField}`
      : source.name;

  if (result.kind === "table") return <TableWidget id={id} order={order} title={widget.title} subtitle={subtitle} data={result} />;
  if (result.kind !== "series") return null;

  const first = result.series[0];
  const formats = result.series.map((item) => chartFormat(item.format));
  const primaryFormat = formats[0] ?? chartFormat("decimal");
  const series: ChartSeries[] = result.series.map((item, j) => ({
    label: item.label,
    color: CHART_COLORS[j % CHART_COLORS.length],
    digits: formats[j].digits,
    unit: formats[j].unit,
    axisKey: chartAxisGroup(item.format),
  }));
  const chartRows: ChartRow[] = result.rows.map((row) => ({
    key: row.label,
    label: row.label,
    values: row.values.map((v, j) => (v == null ? null : v * formats[j].scale)),
  }));

  const values = chartRows.flatMap((row) => widget.type === "rank" ? [row.values[0]] : row.values);
  const logAllowed = canUseLogScale(values);
  const scale: ChartScaleMode = logAllowed && (scaleChoice === "log" || (scaleChoice === "auto" && prefersLogScale(values))) ? "log" : "linear";
  const controls = widget.type === "bar" || widget.type === "rank" ? (
    <label className="vai-scale-control">
      Escala
      <select className="select" aria-label={`Escala de ${widget.title}`} value={scaleChoice} onChange={(event) => setScaleChoice(event.target.value as "auto" | ChartScaleMode)}>
        <option value="auto">Automática</option><option value="linear">Lineal</option>
        <option value="log" disabled={!logAllowed}>Logarítmica</option>
      </select>
      {!logAllowed ? <span title="La escala logarítmica requiere valores positivos; los ceros y negativos se muestran en escala lineal.">Lineal: incluye cero o negativos</span> : null}
    </label>
  ) : null;
  const dataTable = <TableWidget title={`Cifras de ${widget.title}`} subtitle={subtitle} data={result.table} compact />;
  const wrap = (chart: React.ReactNode) => <VaiExportSection id={id} order={order} title={widget.title} kind="chart" table={{ data: result.table, rows: result.table.rows }} controls={controls}>{chart}</VaiExportSection>;
  if (widget.type === "line") return wrap(<LineChart title={widget.title} subtitle={subtitle} rows={chartRows} series={series} digits={primaryFormat.digits} unit={primaryFormat.unit} area={series.length === 1} dataTable={dataTable} />);
  if (widget.type === "bar") return wrap(<ColumnChart title={widget.title} subtitle={subtitle} rows={chartRows} series={series} digits={primaryFormat.digits} unit={primaryFormat.unit} scale={scale} dataTable={dataTable} />);
  if (widget.type === "rank") {
    return wrap(
      <RankChart
        title={widget.title}
        subtitle={subtitle}
        rows={result.rows.map((row) => ({ label: row.label, value: (row.values[0] ?? 0) * primaryFormat.scale, note: result.series[1] ? `${result.series[1].label}: ${formatValue(row.values[1], result.series[1].format)}` : undefined }))}
        digits={primaryFormat.digits}
        unit={primaryFormat.unit}
        scale={scale}
        dataTable={dataTable}
      />
    );
  }
  return wrap(
    <DonutChart
      title={widget.title}
      subtitle={subtitle}
      centerLabel={first?.label ?? ""}
      items={result.rows.map((row, i) => ({
        label: row.label,
        value: Math.max(0, (row.values[0] ?? 0) * primaryFormat.scale),
        color: row.key === "Otros" ? CHART_OTHER : CHART_COLORS[i % CHART_COLORS.length],
      }))}
      digits={primaryFormat.digits}
      unit={primaryFormat.unit}
      dataTable={dataTable}
    />
  );
}

function TableWidget({ id, order, title, subtitle, data, compact = false }: { id?: string; order?: number; title: string; subtitle: string; data: Extract<VaiWidgetData, { kind: "table" }>; compact?: boolean }) {
  const excelColumns = useMemo<Array<ExcelColumnDef<(string | number | null)[]>>>(
    () =>
      data.columns.map((column, index) => ({
        key: column.id,
        label: column.label,
        kind: column.format === "date" ? "date" : column.format === "text" ? "text" : "number",
        value: (row) => row[index],
      })),
    [data.columns],
  );
  const excel = useExcelColumnFilters(data.rows, excelColumns);
  const summaries = useMemo(() => summarizeTable(data, excel.rows), [data, excel.rows]);
  const exportTable = useMemo(() => ({ data, rows: excel.rows }), [data, excel.rows]);
  const [pageSize, setPageSize] = useState(100);
  const [pagination, setPagination] = useState({ page: 1, count: excel.rows.length });
  const page = pagination.count === excel.rows.length ? pagination.page : 1;
  const setPage = (next: number) => setPagination({ page: next, count: excel.rows.length });
  const pageCount = pageSize === 0 ? 1 : Math.max(1, Math.ceil(excel.rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = pageSize === 0
    ? excel.rows
    : excel.rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <VaiExportSection id={id} order={order} title={title} kind="table" table={exportTable}>
    <section className={compact ? "vai-table-detail" : "trjk-card trjk-chart"}>
      <div className="trjk-chart-head">
        <div>
          <h3>{title}</h3>
          <p className="trjk-chart-sub">
            {subtitle} · {excel.rows.length.toLocaleString("es-PE")} de {data.total.toLocaleString("es-PE")} filas
          </p>
        </div>
        <div className="trjk-actions" style={{ alignItems: "center", flexWrap: "wrap" }}>
          {excel.activeCount || excel.hasSort ? (
            <Button size="sm" variant="ghost" onClick={excel.clear}>
              Limpiar columnas
            </Button>
          ) : null}
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="muted">Filas</span>
            <select
              className="select"
              value={pageSize}
              onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}
              style={{ width: 92 }}
            >
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
              <option value={0}>Todas</option>
            </select>
          </label>
          {pageSize > 0 && pageCount > 1 ? (
            <>
              <Button size="sm" variant="ghost" disabled={safePage <= 1} onClick={() => setPage(Math.max(1, safePage - 1))}>
                Anterior
              </Button>
              <span className="muted">
                {safePage.toLocaleString("es-PE")} / {pageCount.toLocaleString("es-PE")}
              </span>
              <Button size="sm" variant="ghost" disabled={safePage >= pageCount} onClick={() => setPage(Math.min(pageCount, safePage + 1))}>
                Siguiente
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {data.rows.length ? (
        <div className="vai-table-scroll">
          <table>
            <thead>
              <tr>
                {data.columns.map((column) => (
                  <th key={column.id} data-num={column.format !== "text" && column.format !== "date"}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <span>{column.label}</span>
                      <ExcelHeaderFilter {...excel.headerProps(column.id)} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => (
                <tr key={`${safePage}-${i}`}>
                  {row.map((cell, j) => (
                    <td key={j} data-num={data.columns[j].format !== "text" && data.columns[j].format !== "date"}>
                      {formatValue(cell, data.columns[j].format)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr aria-label={`Resumen de ${excel.rows.length} filas filtradas`}>
                {data.columns.map((column, index) => (
                  <td key={column.id} data-num={Boolean(summaries[index])}>
                    {summaries[index] ? <><small>{summaries[index]!.label}</small><strong>{formatValue(summaries[index]!.value, column.format)}</strong></> : index === 0 ? <><small>Resumen</small><strong>{excel.rows.length.toLocaleString("es-PE")} filas</strong></> : null}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="trjk-empty">Sin datos para los filtros seleccionados.</div>
      )}
    </section>
    </VaiExportSection>
  );
}
