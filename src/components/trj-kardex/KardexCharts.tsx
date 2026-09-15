// src/components/trj-kardex/KardexCharts.tsx
//
// Gráficos SVG de las estadísticas de Kardex: columnas, líneas, anillo y ranking.
// Colores por tokens (--chart-*), marcas finas, tooltip en todas las series y
// tabla «Ver datos» como equivalente accesible de cada gráfico.
"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { kardexFormat as fmt } from "../../lib/trjKardex";

export type ChartSeries = { label: string; color: string };
export type ChartRow = { key: string; label: string; values: (number | null)[] };

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
export const CHART_OTHER = "var(--chart-other)";

const compact = new Intl.NumberFormat("es-PE", {
  notation: "compact",
  maximumFractionDigits: 1,
});

// Ref de callback: el plot puede montarse después del primer render (datos que
// llegan tarde o un filtro que vacía y vuelve a llenar) y debe observarse igual.
function useWidth() {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;
    observer.current = new ResizeObserver((entries) =>
      setWidth(Math.round(entries[0].contentRect.width)),
    );
    observer.current.observe(node);
  }, []);
  return [ref, width] as const;
}

// Ticks redondos (1 / 2 / 2.5 / 5 × 10ⁿ) que siempre incluyen el cero.
function niceScale(low: number, high: number, count = 4) {
  const min = Math.min(0, low);
  const max = Math.max(0, high) || 1;
  const span = max - min || 1;
  const power = 10 ** Math.floor(Math.log10(span / count));
  const step =
    [1, 2, 2.5, 5, 10].map((s) => s * power).find((s) => span / s <= count) ??
    power * 10;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(+v.toFixed(10));
  return { ticks, min: start, max: end };
}

function value(v: number | null, digits: number, unit: string) {
  return v == null ? "—" : `${fmt(v, digits)}${unit}`;
}

function ChartCard({
  title,
  subtitle,
  series,
  kind,
  empty,
  table,
  panel,
  children,
}: {
  title: string;
  subtitle: string;
  series?: ChartSeries[];
  kind?: "bar" | "line";
  empty: boolean;
  table?: ReactNode;
  /** Detalle propio del gráfico; sustituye a la tabla «Ver datos». */
  panel?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="trjk-card trjk-chart">
      <div className="trjk-chart-head">
        <div>
          <h3>{title}</h3>
          <p className="trjk-chart-sub">{subtitle}</p>
        </div>
        {series && series.length > 1 ? (
          <div className="trjk-legend">
            {series.map((s) => (
              <span key={s.label}>
                <i data-kind={kind} style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {empty ? (
        <div className="trjk-empty">Sin datos para los filtros seleccionados.</div>
      ) : (
        children
      )}
      {!empty && panel ? (
        <div className="trjk-chart-data">{panel}</div>
      ) : !empty && table ? (
        <details className="trjk-chart-data">
          <summary>Ver cifras exactas</summary>
          <div className="trjk-table-scroll">{table}</div>
        </details>
      ) : null}
    </section>
  );
}

function SeriesTable({
  rows,
  series,
  digits,
  unit,
  head = "Período",
}: {
  rows: ChartRow[];
  series: ChartSeries[];
  digits: number;
  unit: string;
  head?: string;
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>{head}</th>
          {series.map((s) => (
            <th key={s.label}>{s.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <td>{r.key}</td>
            {r.values.map((v, j) => (
              <td key={j}>{value(v, digits, unit)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Índices de etiquetas del eje X que caben sin pisarse.
function visibleLabels(count: number, band: number, minGap = 52) {
  const every = Math.max(1, Math.ceil(minGap / Math.max(1, band)));
  const shown = new Set<number>();
  for (let i = 0; i < count; i += every) shown.add(i);
  const last = count - 1;
  if (!shown.has(last) && (last - Math.floor(last / every) * every) * band >= minGap)
    shown.add(last);
  return shown;
}

export function ColumnChart({
  title,
  subtitle,
  rows,
  series,
  digits = 0,
  unit = "",
  height = 220,
}: {
  title: string;
  subtitle: string;
  rows: ChartRow[];
  series: ChartSeries[];
  digits?: number;
  unit?: string;
  height?: number;
}) {
  const [ref, width] = useWidth();
  const pad = { l: 46, r: 10, t: 18, b: 28 };
  const plotW = Math.max(0, width - pad.l - pad.r);
  const plotH = height - pad.t - pad.b;
  const finite = rows.flatMap((r) => r.values).filter((v): v is number => v != null);
  const scale = niceScale(Math.min(...finite, 0), Math.max(...finite, 0));
  const y = (v: number) => pad.t + plotH - ((v - scale.min) / (scale.max - scale.min)) * plotH;
  const band = rows.length ? plotW / rows.length : 0;
  const n = series.length;
  const barW = Math.max(3, Math.min(24, (band * 0.68 - 2 * (n - 1)) / n));
  const groupW = n * barW + 2 * (n - 1);
  const labels = visibleLabels(rows.length, band);
  const capLabels = rows.length <= 12 && band / n >= 44;

  const bar = (x: number, v: number, w: number) => {
    const y0 = y(0);
    const y1 = y(v);
    const top = Math.min(y0, y1);
    const h = Math.abs(y0 - y1);
    const r = Math.min(4, w / 2, h);
    if (h < 0.5) return `M${x},${y0}h${w}v0.5h-${w}z`;
    return v >= 0
      ? `M${x},${y0}V${top + r}a${r},${r} 0 0 1 ${r},-${r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}V${y0}z`
      : `M${x},${y0}V${y0 + h - r}a${r},${r} 0 0 0 ${r},${r}h${w - 2 * r}a${r},${r} 0 0 0 ${r},-${r}V${y0}z`;
  };

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      series={series}
      kind="bar"
      empty={!rows.length}
      table={<SeriesTable rows={rows} series={series} digits={digits} unit={unit} />}
    >
      <div className="trjk-chart-plot" ref={ref} style={{ minHeight: height }}>
        {width > 0 && (
          <svg role="img" aria-label={title} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <title>{`${title}. Los valores exactos están en «Ver cifras exactas».`}</title>
            {scale.ticks.map((t) => (
              <g key={t}>
                <line className={t === 0 ? "trjk-zero-line" : "trjk-grid-line"} x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} />
                <text className="trjk-axis" x={pad.l - 6} y={y(t) + 3.5} textAnchor="end">
                  {compact.format(t)}
                </text>
              </g>
            ))}
            {rows.map((row, i) => {
              const x0 = pad.l + band * i + (band - groupW) / 2;
              return (
                <g key={row.key}>
                  {row.values.map((v, j) =>
                    v == null ? null : (
                      <path key={j} className="trjk-mark" d={bar(x0 + j * (barW + 2), v, barW)} fill={series[j].color} />
                    ),
                  )}
                  {capLabels &&
                    row.values.map((v, j) =>
                      v == null || v === 0 ? null : (
                        <text
                          key={`l${j}`}
                          className="trjk-mark-label"
                          x={x0 + j * (barW + 2) + barW / 2}
                          y={v >= 0 ? y(v) - 4 : y(v) + 11}
                          textAnchor="middle"
                        >
                          {fmt(v, digits)}
                        </text>
                      ),
                    )}
                  {labels.has(i) && (
                    <text className="trjk-axis" x={pad.l + band * i + band / 2} y={height - 8} textAnchor="middle">
                      {row.label}
                    </text>
                  )}
                  <rect className="trjk-band" x={pad.l + band * i} y={pad.t} width={band} height={plotH} rx="4">
                    <title>
                      {[row.label, ...row.values.map((v, j) => `${series[j].label}: ${value(v, digits, unit)}`)].join("\n")}
                    </title>
                  </rect>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </ChartCard>
  );
}

export function LineChart({
  title,
  subtitle,
  rows,
  series,
  digits = 0,
  unit = "",
  height = 220,
  area = false,
}: {
  title: string;
  subtitle: string;
  rows: ChartRow[];
  series: ChartSeries[];
  digits?: number;
  unit?: string;
  height?: number;
  /** Lavado del 12 % bajo la primera serie. */
  area?: boolean;
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 46, r: 58, t: 18, b: 28 };
  const plotW = Math.max(0, width - pad.l - pad.r);
  const plotH = height - pad.t - pad.b;
  const finite = rows.flatMap((r) => r.values).filter((v): v is number => v != null);
  const scale = niceScale(Math.min(...finite, 0), Math.max(...finite, 0));
  const y = (v: number) => pad.t + plotH - ((v - scale.min) / (scale.max - scale.min)) * plotH;
  const step = rows.length > 1 ? plotW / (rows.length - 1) : 0;
  const x = (i: number) => (rows.length > 1 ? pad.l + step * i : pad.l + plotW / 2);
  const labels = visibleLabels(rows.length, step || plotW);
  const markers = rows.length <= 40;

  const paths = series.map((_, j) => {
    let d = "";
    let open = false;
    rows.forEach((row, i) => {
      const v = row.values[j];
      if (v == null) {
        open = false;
        return;
      }
      d += `${open ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      open = true;
    });
    return d;
  });

  // Etiqueta del último punto por serie, salvo que se pise con la anterior.
  const endLabels: { j: number; i: number; v: number; y: number }[] = [];
  series.forEach((_, j) => {
    for (let i = rows.length - 1; i >= 0; i--) {
      const v = rows[i].values[j];
      if (v == null) continue;
      const py = y(v);
      if (!endLabels.some((e) => Math.abs(e.y - py) < 12)) endLabels.push({ j, i, v, y: py });
      break;
    }
  });

  const areaPath = (() => {
    if (!area || !rows.length) return "";
    const points = rows.map((r, i) => (r.values[0] == null ? null : `${x(i).toFixed(1)},${y(r.values[0]).toFixed(1)}`));
    const first = points.findIndex(Boolean);
    let last = points.length - 1;
    while (last >= 0 && !points[last]) last--;
    if (first < 0 || last <= first) return "";
    return `M${x(first).toFixed(1)},${y(0).toFixed(1)}L${points.slice(first, last + 1).filter(Boolean).join("L")}L${x(last).toFixed(1)},${y(0).toFixed(1)}z`;
  })();

  const tip = hover == null ? null : rows[hover];
  const tipLeft = hover == null ? 0 : x(hover);

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      series={series}
      kind="line"
      empty={!rows.length}
      table={<SeriesTable rows={rows} series={series} digits={digits} unit={unit} />}
    >
      <div className="trjk-chart-plot" ref={ref} style={{ minHeight: height }}>
        {width > 0 && (
          <svg
            role="img"
            aria-label={title}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            onPointerMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              const px = e.clientX - box.left - pad.l;
              setHover(Math.max(0, Math.min(rows.length - 1, step ? Math.round(px / step) : 0)));
            }}
            onPointerLeave={() => setHover(null)}
          >
            <title>{`${title}. Los valores exactos están en «Ver cifras exactas».`}</title>
            {scale.ticks.map((t) => (
              <g key={t}>
                <line className={t === 0 ? "trjk-zero-line" : "trjk-grid-line"} x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} />
                <text className="trjk-axis" x={pad.l - 6} y={y(t) + 3.5} textAnchor="end">
                  {compact.format(t)}
                </text>
              </g>
            ))}
            {rows.map((row, i) =>
              labels.has(i) ? (
                <text key={row.key} className="trjk-axis" x={x(i)} y={height - 8} textAnchor="middle">
                  {row.label}
                </text>
              ) : null,
            )}
            {areaPath && <path d={areaPath} fill={series[0].color} opacity="0.12" />}
            {hover != null && (
              <line className="trjk-crosshair" x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + plotH} />
            )}
            {paths.map((d, j) => (
              <path key={j} d={d} fill="none" stroke={series[j].color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {rows.map((row, i) =>
              row.values.map((v, j) =>
                v == null || (!markers && hover !== i) ? null : (
                  <circle
                    key={`${i}-${j}`}
                    cx={x(i)}
                    cy={y(v)}
                    r={hover === i ? 5 : 4}
                    fill={series[j].color}
                    stroke="var(--s-1)"
                    strokeWidth="2"
                  />
                ),
              ),
            )}
            {endLabels.map((e) => (
              <text key={e.j} className="trjk-mark-label" x={x(e.i) + 9} y={e.y + 3.5}>
                {fmt(e.v, digits)}
                {unit}
              </text>
            ))}
          </svg>
        )}
        {tip && (
          <div
            className="trjk-tip"
            style={
              tipLeft > width / 2
                ? { right: width - tipLeft + 12, top: pad.t }
                : { left: tipLeft + 12, top: pad.t }
            }
          >
            <header>{tip.label}</header>
            {series.map((s, j) => (
              <div key={s.label}>
                <i style={{ background: s.color }} />
                <strong>{value(tip.values[j], digits, unit)}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ChartCard>
  );
}

export type DonutItem = { label: string; value: number; color: string; note?: string };

function arc(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
  const p = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p(r1, a0)}A${r1},${r1} 0 ${large} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0},${r0} 0 ${large} 0 ${p(r0, a0)}z`;
}

export function DonutChart({
  title,
  subtitle,
  items,
  digits = 0,
  unit = "",
  centerLabel,
  selected,
  onSelect,
  panel,
  showTable = true,
}: {
  title: string;
  subtitle: string;
  items: DonutItem[];
  digits?: number;
  unit?: string;
  centerLabel: string;
  selected?: string | null;
  onSelect?: (label: string | null) => void;
  panel?: ReactNode;
  showTable?: boolean;
}) {
  
  const [active, setActive] = useState<number | null>(null);
  const shown = items.filter((i) => i.value > 0);
  const total = shown.reduce((sum, i) => sum + i.value, 0);
  const size = 150;
  const cx = size / 2;
  const r1 = 66;
  const r0 = 46;
  const gap = shown.length > 1 ? 2 / r1 : 0;
  const segments: { item: DonutItem; d: string; pct: number }[] = [];
  let angle = -Math.PI / 2;
  for (const item of shown) {
    const sweep = (item.value / total) * Math.PI * 2;
    const a0 = angle + gap / 2;
    const a1 = Math.max(a0, angle + sweep - gap / 2);
    angle += sweep;
    segments.push({ item, d: arc(cx, cx, r0, r1, a0, a1), pct: (item.value / total) * 100 });
  }
  const selectedIndex = selected
    ? shown.findIndex((item) => item.label === selected)
    : -1;
  const focusIndex =
    active != null ? active : selectedIndex >= 0 ? selectedIndex : null;
  const focus = focusIndex != null ? shown[focusIndex] : null;

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      empty={!shown.length}
      panel={panel}
      table={
        showTable ? (
          <table>
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Valor</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((s) => (
                <tr key={s.item.label}>
                  <td>{s.item.label}</td>
                  <td>{value(s.item.value, digits, unit)}</td>
                  <td>{fmt(s.pct, 1)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : undefined
      }
    >
      <div className="trjk-donut" onPointerLeave={() => setActive(null)}>
        <svg role="img" aria-label={title} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <title>
            {showTable
              ? `${title}. Los valores exactos están en «Ver cifras exactas».`
              : title}
          </title>
          {segments.map((s, i) => (
            <path
              key={s.item.label}
              d={s.d}
              fill={s.item.color}
              opacity={focusIndex == null || focusIndex === i ? 1 : 0.35}
              onPointerEnter={() => setActive(i)}
              onClick={
                onSelect
                  ? () =>
                      onSelect(
                        selected === s.item.label ? null : s.item.label,
                      )
                  : undefined
              }
              style={onSelect ? { cursor: "pointer" } : undefined}
            >
              <title>{`${s.item.label}: ${value(s.item.value, digits, unit)} (${fmt(s.pct, 1)} %)`}</title>
            </path>
          ))}
          <text className="trjk-donut-value" x={cx} y={cx - 2} textAnchor="middle">
            {focus ? `${fmt(focus.value / total * 100, 0)} %` : compact.format(total)}
          </text>
          <text className="trjk-donut-label" x={cx} y={cx + 14} textAnchor="middle">
            {focus ? focus.label.slice(0, 18) : centerLabel}
          </text>
        </svg>
        <div className="trjk-donut-list">
          {segments.map((s, i) => (
            <button
              type="button"
              key={s.item.label}
              data-active={focusIndex === i}
              aria-pressed={onSelect ? selected === s.item.label : undefined}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onClick={
                onSelect
                  ? () =>
                      onSelect(
                        selected === s.item.label ? null : s.item.label,
                      )
                  : undefined
              }
            >
              <i style={{ background: s.item.color }} />
              <span title={s.item.note ? `${s.item.label} · ${s.item.note}` : s.item.label}>{s.item.label}</span>
              <strong>{value(s.item.value, digits, unit)}</strong>
              <em>{fmt(s.pct, 1)} %</em>
            </button>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

export type RankRow = { label: string; value: number; note?: string };

export function RankChart({
  title,
  subtitle,
  rows,
  digits = 0,
  unit = "",
  color = CHART_COLORS[0],
  selected,
  onSelect,
  panel,
}: {
  title: string;
  subtitle: string;
  rows: RankRow[];
  digits?: number;
  unit?: string;
  color?: string;
  /** Fila seleccionada; con `onSelect` cada fila es un botón. */
  selected?: string | null;
  onSelect?: (label: string) => void;
  /** Detalle de la selección; sustituye a «Ver datos». */
  panel?: ReactNode;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      empty={!rows.length}
      panel={panel}
      table={
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Categoría</th>
              <th>Valor</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.label}>
                <td>{i + 1}</td>
                <td>{r.label}</td>
                <td>{value(r.value, digits, unit)}</td>
                <td>{r.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="trjk-rank">
        {rows.map((r, i) => {
          const Row = onSelect ? "button" : "div";
          return (
            <Row
              className="trjk-rank-row"
              key={r.label}
              title={`${r.label}: ${value(r.value, digits, unit)}${r.note ? ` · ${r.note}` : ""}`}
              {...(onSelect
                ? {
                    type: "button" as const,
                    "aria-pressed": selected === r.label,
                    onClick: () => onSelect(r.label),
                  }
                : {})}
            >
              <span>
                {i + 1}. {r.label}
              </span>
              <div>
                <div className="trjk-rank-bar" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
              </div>
              <strong>
                {value(r.value, digits, unit)}
                {r.note ? <small>{r.note}</small> : null}
              </strong>
            </Row>
          );
        })}
      </div>
    </ChartCard>
  );
}
