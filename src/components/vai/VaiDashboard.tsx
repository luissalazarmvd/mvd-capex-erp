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
import { VAI_SOURCE_MAP, vaiAreaLabel, vaiField, type VaiSource } from "../../lib/vai/catalog";
import {
  applyFilters,
  chartFormat,
  computeWidget,
  distinctValues,
  filterKey,
  formatValue,
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

  const filtered = useMemo(() => {
    const out: Record<string, VaiRow[]> = {};
    for (const source of sources) out[source.id] = applyFilters(source, data[source.id]?.rows ?? [], spec.filters, filters);
    return out;
  }, [sources, data, spec.filters, filters]);

  const loading = sources.some((source) => data[source.id]?.loading);
  const kpis = spec.widgets.filter((widget) => widget.type === "kpi");
  const others = spec.widgets.filter((widget) => widget.type !== "kpi");
  const hasFilters = spec.filters.some((filter) => {
    const value = filters[filterKey(filter)];
    return value && (value.from || value.to || value.value);
  });

  return (
    <div className="vai-board">
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
                value={filters[filterKey(filter)] ?? {}}
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
            <KpiCard key={`${widget.source}-${widget.metrics[0]}-${i}`} widget={widget} rows={filtered[widget.source] ?? []} loading={loading} />
          ))}
        </div>
      ) : null}

      {others.length ? (
        <div className="vai-widget-grid">
          {others.map((widget, i) => (
            <div key={`${widget.type}-${widget.source}-${i}`} data-span={widget.type === "table" || (widget.type === "line" && others.length % 2 === 1 && i === others.length - 1) ? "2" : "1"}>
              <Widget widget={widget} rows={filtered[widget.source] ?? []} />
            </div>
          ))}
        </div>
      ) : null}
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

function KpiCard({ widget, rows, loading }: { widget: VaiWidgetSpec; rows: VaiRow[]; loading: boolean }) {
  const source = VAI_SOURCE_MAP.get(widget.source);
  const result = source ? computeWidget(widget, source, rows) : null;
  if (!result || result.kind !== "kpi") return null;
  return (
    <div className="vai-kpi" title={source?.metrics.find((metric) => metric.id === result.metric.id)?.description}>
      <span>{widget.title}</span>
      <strong>{loading && !rows.length ? "…" : formatValue(result.value, result.metric.format)}</strong>
      <small>
        {result.metric.label} · {rows.length.toLocaleString("es-PE")} filas · {source?.name}
      </small>
    </div>
  );
}

function Widget({ widget, rows }: { widget: VaiWidgetSpec; rows: VaiRow[] }) {
  const source = VAI_SOURCE_MAP.get(widget.source);
  const result = source ? computeWidget(widget, source, rows) : null;
  if (!source || !result) return null;
  const subtitle = widget.dimension
    ? `${source.name} · por ${vaiField(source, widget.dimension)?.label ?? widget.dimension}`
    : widget.dateField
      ? `${source.name} · por ${widget.bucket === "day" ? "día" : widget.bucket === "week" ? "semana" : "mes"} de ${vaiField(source, widget.dateField)?.label ?? widget.dateField}`
      : source.name;

  if (result.kind === "table") return <TableWidget title={widget.title} subtitle={subtitle} data={result} />;
  if (result.kind !== "series") return null;

  const first = result.series[0];
  const format = chartFormat(first?.format ?? "decimal");
  const series: ChartSeries[] = result.series.map((item, j) => ({ label: item.label, color: CHART_COLORS[j % CHART_COLORS.length] }));
  const chartRows: ChartRow[] = result.rows.map((row) => ({
    key: row.label,
    label: row.label,
    values: row.values.map((v) => (v == null ? null : v * format.scale)),
  }));

  if (widget.type === "line") return <LineChart title={widget.title} subtitle={subtitle} rows={chartRows} series={series} digits={format.digits} unit={format.unit} area={series.length === 1} />;
  if (widget.type === "bar") return <ColumnChart title={widget.title} subtitle={subtitle} rows={chartRows} series={series} digits={format.digits} unit={format.unit} />;
  if (widget.type === "rank") {
    return (
      <RankChart
        title={widget.title}
        subtitle={subtitle}
        rows={result.rows.map((row) => ({ label: row.label, value: (row.values[0] ?? 0) * format.scale, note: result.series[1] ? `${result.series[1].label}: ${formatValue(row.values[1], result.series[1].format)}` : undefined }))}
        digits={format.digits}
        unit={format.unit}
      />
    );
  }
  return (
    <DonutChart
      title={widget.title}
      subtitle={subtitle}
      centerLabel={first?.label ?? ""}
      items={result.rows.map((row, i) => ({
        label: row.label,
        value: Math.max(0, (row.values[0] ?? 0) * format.scale),
        color: row.key === "Otros" ? CHART_OTHER : CHART_COLORS[i % CHART_COLORS.length],
      }))}
      digits={format.digits}
      unit={format.unit}
    />
  );
}

function TableWidget({ title, subtitle, data }: { title: string; subtitle: string; data: Extract<VaiWidgetData, { kind: "table" }> }) {
  return (
    <section className="trjk-card trjk-chart">
      <div className="trjk-chart-head">
        <div>
          <h3>{title}</h3>
          <p className="trjk-chart-sub">
            {subtitle} · {data.rows.length.toLocaleString("es-PE")} de {data.total.toLocaleString("es-PE")} filas
          </p>
        </div>
      </div>
      {data.rows.length ? (
        <div className="vai-table-scroll">
          <table>
            <thead>
              <tr>
                {data.columns.map((column) => (
                  <th key={column.id} data-num={column.format !== "text" && column.format !== "date"}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} data-num={data.columns[j].format !== "text" && data.columns[j].format !== "date"}>
                      {formatValue(cell, data.columns[j].format)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="trjk-empty">Sin datos para los filtros seleccionados.</div>
      )}
    </section>
  );
}
