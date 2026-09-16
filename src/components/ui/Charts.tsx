// src/components/ui/Charts.tsx
//
// Gráficos SVG compartidos: columnas, líneas, anillo y ranking.
// Colores por tokens (--chart-*), marcas finas, tooltip HTML con notas de
// contexto en todas las series y tabla «Ver datos» como equivalente accesible
// de cada gráfico. `KpiTooltip` es el desglose flotante de las tarjetas KPI.
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { canUseLogScale, logarithmicScale, type ChartScaleMode } from "../../lib/chartScale";

export type ChartSeries = {
  label: string;
  color: string;
  digits?: number;
  unit?: string;
  axisKey?: string;
  seriesType?: "bar" | "line";
};
/**
 * Línea adicional del tooltip: etiqueta y valor ya formateado por quien conoce
 * la semántica. Con índice de serie se muestra debajo de esa serie; sin él, en
 * el bloque general del final.
 */
export type ChartNote = [label: string, value: string, series?: number];
export type ChartRow = { key: string; label: string; values: (number | null)[]; notes?: ChartNote[] };

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

function formatNumber(value: unknown, digits = 2) {
  if (value == null || value === "" || !Number.isFinite(Number(value))) {
    return "—";
  }

  return Number(value).toLocaleString("es-PE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatMarkLabel(value: number, digits = 2, unit = "") {
  const formatted =
    Math.abs(value) >= 100000
      ? compact.format(value)
      : formatNumber(value, digits);

  return `${formatted}${unit}`;
}

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

function adaptiveScale(values: number[], includeZero: boolean, count = 4) {
  const finite = values.filter((value) => Number.isFinite(value));

  if (!finite.length) {
    return niceScale(0, 1, count);
  }

  const low = Math.min(...finite);
  const high = Math.max(...finite);

  if (includeZero) {
    return niceScale(low, high, count);
  }

  const rawSpan = high - low;
  const reference = Math.max(Math.abs(low), Math.abs(high), 1);
  const padding =
    rawSpan > 0
      ? rawSpan * 0.1
      : reference * 0.1;

  let min = low - padding;
  let max = high + padding;

  if (low >= 0) {
    min = Math.max(0, min);
  }

  if (high <= 0) {
    max = Math.min(0, max);
  }

  const span = Math.max(max - min, reference * 0.01, 1e-9);
  const power = 10 ** Math.floor(Math.log10(span / count));
  const step =
    [1, 2, 2.5, 5, 10]
      .map((factor) => factor * power)
      .find((candidate) => span / candidate <= count) ??
    power * 10;

  let start = Math.floor(min / step) * step;
  let end = Math.ceil(max / step) * step;

  if (start === end) {
    start -= step;
    end += step;
  }

  const ticks: number[] = [];

  for (let value = start; value <= end + step / 2; value += step) {
    ticks.push(+value.toFixed(10));
  }

  return {
    ticks,
    min: start,
    max: end,
  };
}

function value(v: number | null, digits: number, unit: string) {
  return v == null ? "—" : `${formatNumber(v, digits)}${unit}`;
}

// ── Tooltip ────────────────────────────────────────────────────────────

/** Línea principal del tooltip; sin color ni valor es una línea de detalle. */
type TipLine = { color?: string; value?: string; label: string };

/** Posición del pointer relativa al contenedor que lo escucha. */
type Pointer = { x: number; y: number; w: number; h: number };

function usePointer() {
  const [pointer, setPointer] = useState<Pointer | null>(null);
  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    setPointer({ x: e.clientX - box.left, y: e.clientY - box.top, w: box.width, h: box.height });
  }, []);
  const clear = useCallback(() => setPointer(null), []);
  return [pointer, onPointerMove, clear] as const;
}

// El tooltip cambia de lado al cruzar la mitad del ancho y, cuando sigue al
// pointer, también la mitad del alto, para no salirse del contenedor.
function tipStyle(x: number, width: number, vertical: { top: number } | { pointerY: number; height: number }): CSSProperties {
  const horizontal = x > width / 2 ? { right: Math.max(0, width - x + 12) } : { left: Math.max(0, x + 12) };
  if ("top" in vertical) return { ...horizontal, top: vertical.top };
  return vertical.pointerY > vertical.height / 2
    ? { ...horizontal, bottom: Math.max(0, vertical.height - vertical.pointerY + 14) }
    : { ...horizontal, top: Math.max(0, vertical.pointerY + 14) };
}

function NoteRows({ notes, className }: { notes: ChartNote[]; className: string }) {
  if (!notes.length) return null;
  return (
    <div className={className}>
      {notes.map(([label, note], i) => (
        <div key={`${i}-${label}`}>
          <span>{label}</span>
          <strong>{note}</strong>
        </div>
      ))}
    </div>
  );
}

function ChartTip({ title, lines, notes = [], style }: { title: string; lines: TipLine[]; notes?: ChartNote[]; style: CSSProperties }) {
  const bySeries = (index: number) => notes.filter((note) => note[2] === index);
  const general = notes.filter((note) => note[2] == null || note[2] >= lines.length);
  return (
    <div className="trjk-tip" style={style}>
      <header>{title}</header>
      {lines.map((line, i) => (
        <div key={i} className="trjk-tip-line">
          <div>
            {line.color ? <i style={{ background: line.color }} /> : null}
            {line.value ? <strong>{line.value}</strong> : null}
            <span>{line.label}</span>
          </div>
          <NoteRows notes={bySeries(i)} className="trjk-tip-sub" />
        </div>
      ))}
      <NoteRows notes={general} className="trjk-tip-notes" />
    </div>
  );
}

export type KpiTrend = {
  label: string;
  values: (number | null)[];
  /** Etiquetas del primer y último período, para leer el sparkline. */
  from?: string;
  to?: string;
};

/**
 * Desglose flotante de una tarjeta KPI: sparkline de tendencia, notas
 * (etiqueta, valor) y una nota al pie con la definición. La tarjeta que lo
 * contiene declara `data-tip` y `position: relative`; se muestra al pasar el
 * puntero y se alinea a la derecha cuando la tarjeta está pegada al borde.
 */
export function KpiTooltip({
  label,
  notes,
  trend,
  loading = false,
  footer,
}: {
  label: string;
  notes: ChartNote[];
  trend?: KpiTrend | null;
  loading?: boolean;
  footer?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [align, setAlign] = useState<"start" | "end">("start");

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => {
      const card = node.parentElement;
      if (!card) return;
      setAlign(card.getBoundingClientRect().left + 300 > window.innerWidth - 12 ? "end" : "start");
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const trendValues = (trend?.values ?? []).filter((item): item is number => item != null && Number.isFinite(item));
  const sparkWidth = 220;
  const sparkHeight = 54;
  const sparkPad = 4;
  const min = trendValues.length ? Math.min(...trendValues) : 0;
  const max = trendValues.length ? Math.max(...trendValues) : 0;
  const span = max - min;
  const spark =
    trendValues.length > 1
      ? trendValues.map((item, index) => ({
          x: sparkPad + (index * (sparkWidth - sparkPad * 2)) / (trendValues.length - 1),
          y: span === 0 ? sparkHeight / 2 : sparkHeight - sparkPad - ((item - min) / span) * (sparkHeight - sparkPad * 2),
        }))
      : [];
  const sparkPoints = spark.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPoints = spark.length
    ? `${spark[0].x.toFixed(1)},${sparkHeight - sparkPad} ${sparkPoints} ${spark[spark.length - 1].x.toFixed(1)},${sparkHeight - sparkPad}`
    : "";
  const lastPoint = spark[spark.length - 1];

  return (
    <div ref={ref} className="trjk-tip trjk-kpi-tip" role="tooltip" data-align={align}>
      <header>{label}</header>
      {spark.length > 1 && (
        <div className="trjk-kpi-trend">
          <div className="trjk-kpi-trend-head">
            <span>{trend?.label}</span>
            <small>{trendValues.length} puntos</small>
          </div>
          <svg viewBox={`0 0 ${sparkWidth} ${sparkHeight}`} preserveAspectRatio="none" aria-hidden="true">
            <polygon className="trjk-kpi-spark-area" points={areaPoints} />
            <polyline className="trjk-kpi-spark-line" points={sparkPoints} />
            {lastPoint && <circle className="trjk-kpi-spark-dot" cx={lastPoint.x} cy={lastPoint.y} r="2.8" />}
          </svg>
          {trend?.from || trend?.to ? (
            <div className="trjk-kpi-trend-range">
              <span>{trend.from}</span>
              <span>{trend.to}</span>
            </div>
          ) : null}
        </div>
      )}
      {notes.map(([name, amount], i) => (
        <div key={`${i}-${name}`}>
          <span>{name}</span>
          <strong>{loading ? "…" : amount}</strong>
        </div>
      ))}
      {footer ? <footer>{footer}</footer> : null}
    </div>
  );
}

// ── Tarjeta ────────────────────────────────────────────────────────────

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
                <i data-kind={s.seriesType ?? kind} style={{ background: s.color }} />
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
          <summary>Ver cifras exactas y detalle</summary>
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
              <td key={j}>{value(v, series[j]?.digits ?? digits, series[j]?.unit ?? unit)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function axisLabelText(label: string, maxChars = 20) {
  const text = String(label ?? "").trim();

  if (text.length <= maxChars) {
    return text;
  }

  const available = maxChars - 1;
  const left = Math.ceil(available / 2);
  const right = Math.floor(available / 2);

  return `${text.slice(0, left)}…${text.slice(-right)}`;
}

function visibleLabels(rows: ChartRow[], band: number) {
  const count = rows.length;

  if (!count) {
    return new Set<number>();
  }

  const longestVisibleLabel = rows.reduce(
    (max, row) => Math.max(max, axisLabelText(row.label).length),
    0,
  );

  const estimatedLabelWidth = Math.min(
    148,
    Math.max(48, longestVisibleLabel * 6.2 + 14),
  );

  const every = Math.max(
    1,
    Math.ceil(estimatedLabelWidth / Math.max(1, band)),
  );

  const shown = new Set<number>();

  for (let i = 0; i < count; i += every) {
    shown.add(i);
  }

  const last = count - 1;
  const lastShown = Math.floor(last / every) * every;

  if (
    !shown.has(last) &&
    (last - lastShown) * band >= estimatedLabelWidth
  ) {
    shown.add(last);
  }

  return shown;
}

type ChartAxisSide = "left" | "right";

function seriesMagnitude(rows: ChartRow[], index: number) {
  const values = rows
    .map((row) => row.values[index])
    .filter((v): v is number => v != null && Number.isFinite(v))
    .map((v) => Math.abs(v));

  return values.length ? Math.max(...values) : 0;
}

function assignSeriesAxes(rows: ChartRow[], series: ChartSeries[]) {
  const axes: ChartAxisSide[] = series.map(() => "left");

  if (series.length <= 1) {
    return axes;
  }

  const magnitudes = series.map((_, index) => seriesMagnitude(rows, index));
  const leftKey = series[0]?.axisKey ?? "__default";
  let leftRef = magnitudes[0] || 1;
  let rightKey: string | null = null;
  let rightRef = 1;

  for (let index = 1; index < series.length; index += 1) {
    const key = series[index]?.axisKey ?? leftKey;
    const magnitude = magnitudes[index] || 0;
    const ratio =
      magnitude > 0 && leftRef > 0
        ? Math.max(magnitude, leftRef) / Math.max(Math.min(magnitude, leftRef), 1e-12)
        : 1;

    if (rightKey === null) {
      if (key !== leftKey || ratio >= 12) {
        axes[index] = "right";
        rightKey = key;
        rightRef = magnitude || 1;
      } else {
        leftRef = Math.max(leftRef, magnitude || 0);
      }
      continue;
    }

    if (key === leftKey && key !== rightKey) {
      axes[index] = "left";
      leftRef = Math.max(leftRef, magnitude || 0);
      continue;
    }

    if (key === rightKey && key !== leftKey) {
      axes[index] = "right";
      rightRef = Math.max(rightRef, magnitude || 0);
      continue;
    }

    const current = magnitude || 1;
    const leftDistance = Math.abs(Math.log10(current / Math.max(leftRef, 1e-12)));
    const rightDistance = Math.abs(Math.log10(current / Math.max(rightRef, 1e-12)));

    if (rightDistance < leftDistance) {
      axes[index] = "right";
      rightRef = Math.max(rightRef, current);
    } else {
      axes[index] = "left";
      leftRef = Math.max(leftRef, current);
    }
  }

  return axes;
}

function axisValues(rows: ChartRow[], axes: ChartAxisSide[], side: ChartAxisSide) {
  const values: number[] = [];

  rows.forEach((row) => {
    row.values.forEach((value, index) => {
      if (value != null && Number.isFinite(value) && axes[index] === side) {
        values.push(value);
      }
    });
  });

  return values;
}

function axisUnitLabel(
  series: ChartSeries[],
  axes: ChartAxisSide[],
  side: ChartAxisSide,
  fallbackUnit: string,
) {
  const units = Array.from(
    new Set(
      series
        .map((item, index) => (axes[index] === side ? (item.unit ?? fallbackUnit).trim() : ""))
        .filter(Boolean),
    ),
  );

  return units.length === 1 ? units[0] : "";
}

/** Líneas del tooltip para una fila: una por serie, en el color de la serie. */
function seriesLines(row: ChartRow, series: ChartSeries[], digits: number, unit: string): TipLine[] {
  return series.map((s, j) => ({
    color: s.color,
    value: value(row.values[j] ?? null, s.digits ?? digits, s.unit ?? unit),
    label: s.label,
  }));
}

export function ColumnChart({
  title,
  subtitle,
  rows,
  series,
  digits = 0,
  unit = "",
  height = 220,
  scale: scaleMode = "linear",
  dataTable,
}: {
  title: string;
  subtitle: string;
  rows: ChartRow[];
  series: ChartSeries[];
  digits?: number;
  unit?: string;
  height?: number;
  scale?: ChartScaleMode;
  dataTable?: ReactNode;
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const axes = assignSeriesAxes(rows, series);
  const hasRight = axes.includes("right");
  const pad = { l: 46, r: hasRight ? 52 : 10, t: 18, b: 28 };
  const plotW = Math.max(0, width - pad.l - pad.r);
  const plotH = height - pad.t - pad.b;
  const leftFinite = axisValues(rows, axes, "left");
  const rightFinite = axisValues(rows, axes, "right");

  const leftHasBars = series.some(
    (item, index) =>
      axes[index] === "left" &&
      item.seriesType !== "line",
  );

  const rightHasBars = series.some(
    (item, index) =>
      axes[index] === "right" &&
      item.seriesType !== "line",
  );

  const log =
    scaleMode === "log" &&
    canUseLogScale([...leftFinite, ...rightFinite]);

  const leftLog = logarithmicScale(leftFinite);
  const rightLog = logarithmicScale(rightFinite);

  const leftScale = log
    ? leftLog
    : adaptiveScale(leftFinite, leftHasBars);

  const rightScale = log
    ? rightLog
    : adaptiveScale(rightFinite, rightHasBars);

  const yFor = (index: number, v: number) => {
    const scale =
      axes[index] === "right"
        ? rightScale
        : leftScale;

    const fraction = log
      ? (
          axes[index] === "right"
            ? rightLog
            : leftLog
        ).fraction(v)
      : (v - scale.min) /
        (scale.max - scale.min);

    return pad.t + plotH - fraction * plotH;
  };
  const leftAxisUnit = axisUnitLabel(series, axes, "left", unit);
  const rightAxisUnit = axisUnitLabel(series, axes, "right", unit);
  const band = rows.length ? plotW / rows.length : 0;
  const n = series.length;
  const barW = Math.max(3, Math.min(24, (band * 0.68 - 2 * (n - 1)) / n));
  const groupW = n * barW + 2 * (n - 1);
  const labels = visibleLabels(rows, band);
  const capLabels = rows.length <= 12 && band / n >= 44;

  const bar = (x: number, v: number, w: number, index: number) => {
    const y0 = yFor(index, 0);
    const y1 = yFor(index, v);
    const top = Math.min(y0, y1);
    const h = Math.abs(y0 - y1);
    const r = Math.min(4, w / 2, h);
    if (h < 0.5) return `M${x},${y0}h${w}v0.5h-${w}z`;
    return v >= 0
      ? `M${x},${y0}V${top + r}a${r},${r} 0 0 1 ${r},-${r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}V${y0}z`
      : `M${x},${y0}V${y0 + h - r}a${r},${r} 0 0 0 ${r},${r}h${w - 2 * r}a${r},${r} 0 0 0 ${r},-${r}V${y0}z`;
  };

  const tip = hover == null ? null : rows[hover];
  // La banda bajo el puntero (o bajo el toque) fija la fila del tooltip.
  const locate = (e: ReactPointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left - pad.l;
    const py = e.clientY - box.top;
    if (!band || px < 0 || px > plotW || py < pad.t || py > pad.t + plotH) {
      setHover(null);
      return;
    }
    setHover(Math.max(0, Math.min(rows.length - 1, Math.floor(px / band))));
  };

  return (
    <ChartCard
      title={title}
      subtitle={`${subtitle}${log ? " · Escala logarítmica (base 10)" : ""}`}
      series={series}
      kind="bar"
      empty={!rows.length}
      table={dataTable ?? <SeriesTable rows={rows} series={series} digits={digits} unit={unit} />}
    >
      <div className="trjk-chart-plot" ref={ref} style={{ minHeight: height }}>
        {width > 0 && (
          <svg
            role="img"
            aria-label={title}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            onPointerMove={locate}
            onPointerDown={locate}
            onPointerLeave={() => setHover(null)}
          >
            <desc>{`${title}. Los valores exactos están en «Ver cifras exactas».`}</desc>
            {leftScale.ticks.map((t) => (
              <g key={`l-${t}`}>
                <line className={t === 0 ? "trjk-zero-line" : "trjk-grid-line"} x1={pad.l} x2={width - pad.r} y1={yFor(0, t)} y2={yFor(0, t)} />
                <text className="trjk-axis" x={pad.l - 6} y={yFor(0, t) + 3.5} textAnchor="end">
                  {compact.format(t)}
                </text>
              </g>
            ))}
            {hasRight
              ? rightScale.ticks.map((t) => {
                  const rightIndex = axes.findIndex((axis) => axis === "right");
                  return (
                    <text key={`r-${t}`} className="trjk-axis" x={width - pad.r + 6} y={yFor(rightIndex, t) + 3.5} textAnchor="start">
                      {compact.format(t)}
                    </text>
                  );
                })
              : null}
            {leftAxisUnit ? (
              <text className="trjk-axis" x={pad.l} y={11} textAnchor="start">
                {leftAxisUnit}
              </text>
            ) : null}
            {hasRight && rightAxisUnit ? (
              <text className="trjk-axis" x={width - pad.r} y={11} textAnchor="end">
                {rightAxisUnit}
              </text>
            ) : null}
            {rows.map((row, i) => {
              const x0 = pad.l + band * i + (band - groupW) / 2;
              const dimmed = hover != null && hover !== i;
              return (
                <g key={row.key}>
                  <rect className="trjk-band" data-hover={hover === i} x={pad.l + band * i} y={pad.t} width={band} height={plotH} rx="4" />
                  {row.values.map((v, j) =>
                    v == null ? null : (
                      <path key={j} className="trjk-mark" opacity={dimmed ? 0.45 : 1} d={bar(x0 + j * (barW + 2), v, barW, j)} fill={series[j].color} />
                    ),
                  )}
                  {capLabels &&
                    row.values.map((v, j) => {
                      if (v == null || v === 0) return null;

                      const labelY =
                        v >= 0
                          ? yFor(j, v) - 4
                          : yFor(j, v) + 11;

                      if (
                        labelY < pad.t + 9 ||
                        labelY > pad.t + plotH - 4
                      ) {
                        return null;
                      }

                      return (
                        <text
                          key={`l${j}`}
                          className="trjk-mark-label"
                          x={x0 + j * (barW + 2) + barW / 2}
                          y={labelY}
                          textAnchor="middle"
                        >
                          {formatMarkLabel(
                            v,
                            series[j]?.digits ?? digits,
                          )}
                        </text>
                      );
                    })}
                  {labels.has(i) && (
                    <text className="trjk-axis" x={pad.l + band * i + band / 2} y={height - 8} textAnchor="middle">
                      <title>{row.label}</title>
                      {axisLabelText(row.label)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        {tip && hover != null && (
          <ChartTip
            title={tip.label}
            lines={seriesLines(tip, series, digits, unit)}
            notes={tip.notes}
            style={tipStyle(pad.l + band * hover + band / 2, width, { top: pad.t })}
          />
        )}
      </div>
    </ChartCard>
  );
}

export function ComboChart({
  title,
  subtitle,
  rows,
  series,
  digits = 0,
  unit = "",
  height = 220,
  scale: scaleMode = "linear",
  dataTable,
}: {
  title: string;
  subtitle: string;
  rows: ChartRow[];
  series: ChartSeries[];
  digits?: number;
  unit?: string;
  height?: number;
  scale?: ChartScaleMode;
  dataTable?: ReactNode;
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const axes = assignSeriesAxes(rows, series);
  const hasRight = axes.includes("right");
  const pad = { l: 46, r: 64, t: 18, b: 28 };
  const plotW = Math.max(0, width - pad.l - pad.r);
  const plotH = height - pad.t - pad.b;
  const leftFinite = axisValues(rows, axes, "left");
  const rightFinite = axisValues(rows, axes, "right");

  const leftHasBars = series.some(
    (item, index) =>
      axes[index] === "left" &&
      item.seriesType !== "line",
  );

  const rightHasBars = series.some(
    (item, index) =>
      axes[index] === "right" &&
      item.seriesType !== "line",
  );

  const log =
    scaleMode === "log" &&
    canUseLogScale([...leftFinite, ...rightFinite]);

  const leftLog = logarithmicScale(leftFinite);
  const rightLog = logarithmicScale(rightFinite);

  const leftScale = log
    ? leftLog
    : adaptiveScale(leftFinite, leftHasBars);

  const rightScale = log
    ? rightLog
    : adaptiveScale(rightFinite, rightHasBars);

  const yFor = (index: number, v: number) => {
    const scale =
      axes[index] === "right"
        ? rightScale
        : leftScale;

    const fraction = log
      ? (
          axes[index] === "right"
            ? rightLog
            : leftLog
        ).fraction(v)
      : (v - scale.min) /
        (scale.max - scale.min);

    return pad.t + plotH - fraction * plotH;
  };
  const leftAxisUnit = axisUnitLabel(series, axes, "left", unit);
  const rightAxisUnit = axisUnitLabel(series, axes, "right", unit);
  const band = rows.length ? plotW / rows.length : 0;

  const barIndexes = series.map((item, index) => (item.seriesType === "line" ? -1 : index)).filter((index) => index >= 0);
  const barSlots = new Map(barIndexes.map((index, slot) => [index, slot]));
  const barCount = barIndexes.length;
  const barW = barCount ? Math.max(3, Math.min(24, (band * 0.68 - 2 * (barCount - 1)) / barCount)) : 0;
  const groupW = barCount ? barCount * barW + 2 * (barCount - 1) : 0;

  const labels = visibleLabels(rows, band);
  const capLabels = barCount > 0 && rows.length <= 12 && band / Math.max(barCount, 1) >= 44;
  const markers = rows.length <= 40;

  const bar = (x: number, v: number, w: number, index: number) => {
    const y0 = yFor(index, 0);
    const y1 = yFor(index, v);
    const top = Math.min(y0, y1);
    const h = Math.abs(y0 - y1);
    const r = Math.min(4, w / 2, h);
    if (h < 0.5) return `M${x},${y0}h${w}v0.5h-${w}z`;
    return v >= 0
      ? `M${x},${y0}V${top + r}a${r},${r} 0 0 1 ${r},-${r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}V${y0}z`
      : `M${x},${y0}V${y0 + h - r}a${r},${r} 0 0 0 ${r},${r}h${w - 2 * r}a${r},${r} 0 0 0 ${r},-${r}V${y0}z`;
  };

  const step = rows.length > 1 ? plotW / (rows.length - 1) : 0;
  const x = (i: number) => (rows.length > 1 ? pad.l + step * i : pad.l + plotW / 2);

  const paths = series.map((item, j) => {
    if (item.seriesType !== "line") return "";
    let d = "";
    let open = false;
    rows.forEach((row, i) => {
      const v = row.values[j];
      if (v == null) {
        open = false;
        return;
      }
      d += `${open ? "L" : "M"}${x(i).toFixed(1)},${yFor(j, v).toFixed(1)}`;
      open = true;
    });
    return d;
  });

  const endLabels: { j: number; i: number; v: number; y: number }[] = [];

  series.forEach((item, j) => {
    if (item.seriesType !== "line") return;

    for (let i = rows.length - 1; i >= 0; i--) {
      const v = rows[i].values[j];
      if (v == null) continue;

      const py = yFor(j, v);

      const collidesWithBar = rows[i].values.some(
        (barValue, barIndex) =>
          barValue != null &&
          series[barIndex]?.seriesType !== "line" &&
          Math.abs(yFor(barIndex, barValue) - py) < 18,
      );

      const collidesWithLine = endLabels.some(
        (label) => Math.abs(label.y - py) < 18,
      );

      if (
        py >= pad.t + 10 &&
        py <= pad.t + plotH - 10 &&
        !collidesWithBar &&
        !collidesWithLine
      ) {
        endLabels.push({ j, i, v, y: py });
      }

      break;
    }
  });

  const tip = hover == null ? null : rows[hover];
  const locate = (e: ReactPointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left - pad.l;
    const py = e.clientY - box.top;
    if (!band || px < 0 || px > plotW || py < pad.t || py > pad.t + plotH) {
      setHover(null);
      return;
    }
    setHover(Math.max(0, Math.min(rows.length - 1, Math.floor(px / band))));
  };

  return (
    <ChartCard
      title={title}
      subtitle={`${subtitle}${log ? " · Escala logarítmica (base 10)" : ""}`}
      series={series}
      empty={!rows.length}
      table={dataTable ?? <SeriesTable rows={rows} series={series} digits={digits} unit={unit} />}
    >
      <div className="trjk-chart-plot" ref={ref} style={{ minHeight: height }}>
        {width > 0 && (
          <svg
            role="img"
            aria-label={title}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            onPointerMove={locate}
            onPointerDown={locate}
            onPointerLeave={() => setHover(null)}
          >
            <desc>{`${title}. Los valores exactos están en «Ver cifras exactas».`}</desc>
            {leftScale.ticks.map((t) => (
              <g key={`l-${t}`}>
                <line className={t === 0 ? "trjk-zero-line" : "trjk-grid-line"} x1={pad.l} x2={width - pad.r} y1={yFor(0, t)} y2={yFor(0, t)} />
                <text className="trjk-axis" x={pad.l - 6} y={yFor(0, t) + 3.5} textAnchor="end">
                  {compact.format(t)}
                </text>
              </g>
            ))}
            {hasRight
              ? rightScale.ticks.map((t) => {
                  const rightIndex = axes.findIndex((axis) => axis === "right");
                  return (
                    <text key={`r-${t}`} className="trjk-axis" x={width - pad.r + 6} y={yFor(rightIndex, t) + 3.5} textAnchor="start">
                      {compact.format(t)}
                    </text>
                  );
                })
              : null}
            {leftAxisUnit ? (
              <text className="trjk-axis" x={pad.l} y={11} textAnchor="start">
                {leftAxisUnit}
              </text>
            ) : null}
            {hasRight && rightAxisUnit ? (
              <text className="trjk-axis" x={width - pad.r} y={11} textAnchor="end">
                {rightAxisUnit}
              </text>
            ) : null}
            {rows.map((row, i) => {
              const x0 = pad.l + band * i + (band - groupW) / 2;
              const dimmed = hover != null && hover !== i;
              return (
                <g key={row.key}>
                  <rect className="trjk-band" data-hover={hover === i} x={pad.l + band * i} y={pad.t} width={band} height={plotH} rx="4" />
                  {row.values.map((v, j) =>
                    v == null || !barSlots.has(j) ? null : (
                      <path key={j} className="trjk-mark" opacity={dimmed ? 0.45 : 1} d={bar(x0 + (barSlots.get(j) ?? 0) * (barW + 2), v, barW, j)} fill={series[j].color} />
                    ),
                  )}
                  {capLabels &&
                    row.values.map((v, j) => {
                      if (
                        v == null ||
                        v === 0 ||
                        !barSlots.has(j)
                      ) {
                        return null;
                      }

                      const labelY =
                        v >= 0
                          ? yFor(j, v) - 4
                          : yFor(j, v) + 11;

                      const collidesWithLine = row.values.some(
                        (lineValue, lineIndex) =>
                          lineValue != null &&
                          series[lineIndex]?.seriesType === "line" &&
                          Math.abs(
                            yFor(lineIndex, lineValue) - labelY,
                          ) < 18,
                      );

                      if (
                        labelY < pad.t + 9 ||
                        labelY > pad.t + plotH - 4 ||
                        collidesWithLine
                      ) {
                        return null;
                      }

                      return (
                        <text
                          key={`l${j}`}
                          className="trjk-mark-label"
                          x={
                            x0 +
                            (barSlots.get(j) ?? 0) * (barW + 2) +
                            barW / 2
                          }
                          y={labelY}
                          textAnchor="middle"
                        >
                          {formatMarkLabel(
                            v,
                            series[j]?.digits ?? digits,
                          )}
                        </text>
                      );
                    })}
                  {labels.has(i) && (
                    <text className="trjk-axis" x={pad.l + band * i + band / 2} y={height - 8} textAnchor="middle">
                      <title>{row.label}</title>
                      {axisLabelText(row.label)}
                    </text>
                  )}
                </g>
              );
            })}
            {hover != null && (
              <line className="trjk-crosshair" x1={pad.l + band * hover + band / 2} x2={pad.l + band * hover + band / 2} y1={pad.t} y2={pad.t + plotH} />
            )}
            {paths.map((d, j) =>
              !d ? null : (
                <path key={j} d={d} fill="none" stroke={series[j].color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              ),
            )}
            {rows.map((row, i) =>
              row.values.map((v, j) =>
                v == null || series[j]?.seriesType !== "line" || (!markers && hover !== i) ? null : (
                  <circle
                    key={`${i}-${j}`}
                    cx={x(i)}
                    cy={yFor(j, v)}
                    r={hover === i ? 5 : 4}
                    fill={series[j].color}
                    stroke="var(--s-1)"
                    strokeWidth="2"
                  />
                ),
              ),
            )}
            {endLabels.map((e) => {
              const placeLeft = hasRight || axes[e.j] === "right";

              return (
                <text
                  key={e.j}
                  className="trjk-mark-label"
                  x={placeLeft ? x(e.i) - 9 : x(e.i) + 9}
                  y={e.y + 3.5}
                  textAnchor={placeLeft ? "end" : "start"}
                >
                  {formatMarkLabel(
                    e.v,
                    series[e.j]?.digits ?? digits,
                    series[e.j]?.unit ?? unit,
                  )}
                </text>
              );
            })}
          </svg>
        )}
        {tip && hover != null && (
          <ChartTip
            title={tip.label}
            lines={seriesLines(tip, series, digits, unit)}
            notes={tip.notes}
            style={tipStyle(pad.l + band * hover + band / 2, width, { top: pad.t })}
          />
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
  dataTable,
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
  dataTable?: ReactNode;
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const axes = assignSeriesAxes(rows, series);
  const hasRight = axes.includes("right");
  const pad = { l: 46, r: 58, t: 18, b: 28 };
  const plotW = Math.max(0, width - pad.l - pad.r);
  const plotH = height - pad.t - pad.b;
  const leftFinite = axisValues(rows, axes, "left");
  const rightFinite = axisValues(rows, axes, "right");
  const leftScale = adaptiveScale(leftFinite, false);
  const rightScale = adaptiveScale(rightFinite, false);
  const yFor = (index: number, v: number) => {
    const scale = axes[index] === "right" ? rightScale : leftScale;
    return pad.t + plotH - ((v - scale.min) / (scale.max - scale.min)) * plotH;
  };
  const leftAxisUnit = axisUnitLabel(series, axes, "left", unit);
  const rightAxisUnit = axisUnitLabel(series, axes, "right", unit);
  const step = rows.length > 1 ? plotW / (rows.length - 1) : 0;
  const x = (i: number) => (rows.length > 1 ? pad.l + step * i : pad.l + plotW / 2);
  const labels = visibleLabels(rows, step || plotW);
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
      d += `${open ? "L" : "M"}${x(i).toFixed(1)},${yFor(j, v).toFixed(1)}`;
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

      const py = yFor(j, v);

      if (
        py >= pad.t + 10 &&
        py <= pad.t + plotH - 10 &&
        !endLabels.some(
          (label) => Math.abs(label.y - py) < 18,
        )
      ) {
        endLabels.push({ j, i, v, y: py });
      }

      break;
    }
  });

  const areaPath = (() => {
    if (!area || !rows.length) return "";

    const points = rows.map((r, i) =>
      r.values[0] == null
        ? null
        : `${x(i).toFixed(1)},${yFor(0, r.values[0]).toFixed(1)}`,
    );

    const first = points.findIndex(Boolean);
    let last = points.length - 1;

    while (last >= 0 && !points[last]) {
      last--;
    }

    if (first < 0 || last <= first) return "";

    const baselineY = pad.t + plotH;

    return `M${x(first).toFixed(1)},${baselineY.toFixed(1)}L${points
      .slice(first, last + 1)
      .filter(Boolean)
      .join("L")}L${x(last).toFixed(1)},${baselineY.toFixed(1)}z`;
  })();

  const tip = hover == null ? null : rows[hover];
  // El punto más cercano en x (puntero o toque) fija la fila del tooltip.
  const locate = (e: ReactPointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left - pad.l;
    setHover(Math.max(0, Math.min(rows.length - 1, step ? Math.round(px / step) : 0)));
  };

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      series={series}
      kind="line"
      empty={!rows.length}
      table={dataTable ?? <SeriesTable rows={rows} series={series} digits={digits} unit={unit} />}
    >
      <div className="trjk-chart-plot" ref={ref} style={{ minHeight: height }}>
        {width > 0 && (
          <svg
            role="img"
            aria-label={title}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            onPointerMove={locate}
            onPointerDown={locate}
            onPointerLeave={() => setHover(null)}
          >
            <desc>{`${title}. Los valores exactos están en «Ver cifras exactas».`}</desc>
            {leftScale.ticks.map((t) => (
              <g key={`l-${t}`}>
                <line className={t === 0 ? "trjk-zero-line" : "trjk-grid-line"} x1={pad.l} x2={width - pad.r} y1={yFor(0, t)} y2={yFor(0, t)} />
                <text className="trjk-axis" x={pad.l - 6} y={yFor(0, t) + 3.5} textAnchor="end">
                  {compact.format(t)}
                </text>
              </g>
            ))}
            {hasRight
              ? rightScale.ticks.map((t) => {
                  const rightIndex = axes.findIndex((axis) => axis === "right");
                  return (
                    <text key={`r-${t}`} className="trjk-axis" x={width - pad.r + 6} y={yFor(rightIndex, t) + 3.5} textAnchor="start">
                      {compact.format(t)}
                    </text>
                  );
                })
              : null}
            {leftAxisUnit ? (
              <text className="trjk-axis" x={pad.l} y={11} textAnchor="start">
                {leftAxisUnit}
              </text>
            ) : null}
            {hasRight && rightAxisUnit ? (
              <text className="trjk-axis" x={width - pad.r} y={11} textAnchor="end">
                {rightAxisUnit}
              </text>
            ) : null}
            {rows.map((row, i) =>
              labels.has(i) ? (
                <text key={row.key} className="trjk-axis" x={x(i)} y={height - 8} textAnchor="middle">
                  <title>{row.label}</title>
                  {axisLabelText(row.label)}
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
                    cy={yFor(j, v)}
                    r={hover === i ? 5 : 4}
                    fill={series[j].color}
                    stroke="var(--s-1)"
                    strokeWidth="2"
                  />
                ),
              ),
            )}
            {endLabels.map((e) => {
              const placeLeft = hasRight || axes[e.j] === "right";

              return (
                <text
                  key={e.j}
                  className="trjk-mark-label"
                  x={placeLeft ? x(e.i) - 9 : x(e.i) + 9}
                  y={e.y + 3.5}
                  textAnchor={placeLeft ? "end" : "start"}
                >
                  {formatMarkLabel(
                    e.v,
                    series[e.j]?.digits ?? digits,
                    series[e.j]?.unit ?? unit,
                  )}
                </text>
              );
            })}
          </svg>
        )}
        {tip && hover != null && (
          <ChartTip
            title={tip.label}
            lines={seriesLines(tip, series, digits, unit)}
            notes={tip.notes}
            style={tipStyle(x(hover), width, { top: pad.t })}
          />
        )}
      </div>
    </ChartCard>
  );
}

export type DonutItem = { label: string; value: number; color: string; note?: string; notes?: ChartNote[] };

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
  dataTable,
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
  dataTable?: ReactNode;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [pointer, onPointerMove, clearPointer] = usePointer();
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
  const tip = active != null && pointer ? segments[active] : null;

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      empty={!shown.length}
      panel={panel}
      table={
        dataTable ?? (showTable ? (
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
                  <td>{formatNumber(s.pct, 1)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : undefined)
      }
    >
      <div
        className="trjk-donut"
        onPointerMove={onPointerMove}
        onPointerDown={onPointerMove}
        onPointerLeave={() => {
          setActive(null);
          clearPointer();
        }}
      >
        <svg role="img" aria-label={title} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <desc>
            {showTable
              ? `${title}. Los valores exactos están en «Ver cifras exactas».`
              : title}
          </desc>
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
            />
          ))}
          <text className="trjk-donut-value" x={cx} y={cx - 2} textAnchor="middle">
            {focus ? `${formatNumber(focus.value / total * 100, 0)} %` : compact.format(total)}
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
              <span>{s.item.label}</span>
              <strong>{value(s.item.value, digits, unit)}</strong>
              <em>{formatNumber(s.pct, 1)} %</em>
            </button>
          ))}
        </div>
        {tip && pointer && (
          <ChartTip
            title={tip.item.label}
            lines={[{ color: tip.item.color, value: value(tip.item.value, digits, unit), label: `${formatNumber(tip.pct, 1)} % de ${centerLabel || "total"}` }]}
            notes={[...(tip.item.note ? ([["Detalle", tip.item.note]] as ChartNote[]) : []), ...(tip.item.notes ?? [])]}
            style={tipStyle(pointer.x, pointer.w, { pointerY: pointer.y, height: pointer.h })}
          />
        )}
      </div>
    </ChartCard>
  );
}

export type RankRow = { label: string; value: number; note?: string; notes?: ChartNote[] };

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
  scale: scaleMode = "linear",
  dataTable,
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
  scale?: ChartScaleMode;
  dataTable?: ReactNode;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [pointer, onPointerMove, clearPointer] = usePointer();
  const max = Math.max(1, ...rows.map((r) => r.value));
  const log = scaleMode === "log" && canUseLogScale(rows.map((row) => row.value));
  const logScale = logarithmicScale(rows.map((row) => row.value));
  const tip = active != null && pointer ? rows[active] : null;
  return (
    <ChartCard
      title={title}
      subtitle={`${subtitle}${log ? " · Escala logarítmica (base 10)" : ""}`}
      empty={!rows.length}
      panel={panel}
      table={dataTable ?? (
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
      )}
    >
      <div
        className="trjk-rank"
        onPointerMove={onPointerMove}
        onPointerDown={onPointerMove}
        onPointerLeave={() => {
          setActive(null);
          clearPointer();
        }}
      >
        {rows.map((r, i) => {
          const Row = onSelect ? "button" : "div";
          return (
            <Row
              className="trjk-rank-row"
              key={r.label}
              onPointerEnter={() => setActive(i)}
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
                <div className="trjk-rank-bar" style={{ width: `${(log ? logScale.fraction(r.value) : r.value / max) * 100}%`, background: color }} />
              </div>
              <strong>
                {value(r.value, digits, unit)}
                {r.note ? <small>{r.note}</small> : null}
              </strong>
            </Row>
          );
        })}
        {tip && pointer && active != null && (
          <ChartTip
            title={`${active + 1}. ${tip.label}`}
            lines={[{ color, value: value(tip.value, digits, unit), label: "" }, ...(tip.note ? [{ label: tip.note }] : [])]}
            notes={tip.notes}
            style={tipStyle(pointer.x, pointer.w, { pointerY: pointer.y, height: pointer.h })}
          />
        )}
      </div>
    </ChartCard>
  );
}
