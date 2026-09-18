"use client";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, } from "react";
import { canUseLogScale, logarithmicScale, type ChartScaleMode } from "../../lib/chartScale";
import type { VaiLanguage } from "../../lib/vai";
const CHART_UI = {
    es: { empty: "Sin datos para los filtros seleccionados.", exact: "Ver cifras exactas y detalle", period: "Período", category: "Categoría", value: "Valor", detail: "Detalle", total: "total", group: "Grupo", exactHint: "Los valores exactos están en «Ver cifras exactas».", linearTrend: "tendencia lineal", logScale: "Escala logarítmica (base 10)", heatmapDesc: "Valores por grupo y categoría; intensidad proporcional a la magnitud absoluta. El detalle conserva las filas originales.", filterTotal: "Total del filtro", net: "Neto", positive: "Aporte positivo", negative: "Aporte negativo", contribution: "Aporte", cumulative: "Acumulado desde cero", collapse: "Contraer", expand: "Expandir", secondLevel: "Segundo nivel", expandAll: "Expandir todo", matrixHint: "50 filas por página · subtotales por período, sin mezclar escenarios", hierarchy: "Jerarquía", expandedRows: "filas desplegadas", previous: "Anterior", next: "Siguiente", points: "puntos", radarScale: "escala radial normalizada por serie" },
    en: { empty: "No data for the selected filters.", exact: "View exact figures and detail", period: "Period", category: "Category", value: "Value", detail: "Detail", total: "total", group: "Group", exactHint: "Exact values are available under “View exact figures”.", linearTrend: "linear trend", logScale: "Logarithmic scale (base 10)", heatmapDesc: "Values by group and category; intensity is proportional to absolute magnitude. Detail preserves the original rows.", filterTotal: "Filtered total", net: "Net", positive: "Positive contribution", negative: "Negative contribution", contribution: "Contribution", cumulative: "Cumulative from zero", collapse: "Collapse", expand: "Expand", secondLevel: "Second level", expandAll: "Expand all", matrixHint: "50 rows per page · subtotals by period without mixing scenarios", hierarchy: "Hierarchy", expandedRows: "expanded rows", previous: "Previous", next: "Next", points: "points", radarScale: "radial scale normalized per series" },
    fr: { empty: "Aucune donnée pour les filtres sélectionnés.", exact: "Voir les chiffres exacts et le détail", period: "Période", category: "Catégorie", value: "Valeur", detail: "Détail", total: "total", group: "Groupe", exactHint: "Les valeurs exactes sont disponibles dans « Voir les chiffres exacts ».", linearTrend: "tendance linéaire", logScale: "Échelle logarithmique (base 10)", heatmapDesc: "Valeurs par groupe et catégorie ; l’intensité est proportionnelle à la magnitude absolue. Le détail conserve les lignes d’origine.", filterTotal: "Total filtré", net: "Net", positive: "Contribution positive", negative: "Contribution négative", contribution: "Contribution", cumulative: "Cumul depuis zéro", collapse: "Réduire", expand: "Développer", secondLevel: "Deuxième niveau", expandAll: "Tout développer", matrixHint: "50 lignes par page · sous-totaux par période sans mélanger les scénarios", hierarchy: "Hiérarchie", expandedRows: "lignes déployées", previous: "Précédent", next: "Suivant", points: "points", radarScale: "échelle radiale normalisée par série" },
} as const;
const ChartLanguageContext = createContext<VaiLanguage>("es");
export function ChartLanguageProvider({ language, children }: { language: VaiLanguage; children: ReactNode }) {
    return <ChartLanguageContext.Provider value={language}>{children}</ChartLanguageContext.Provider>;
}
function useChartUi() {
    return CHART_UI[useContext(ChartLanguageContext)];
}
export type ChartSeries = {
    label: string;
    color: string;
    digits?: number;
    unit?: string;
    axisKey?: string;
    axisSide?: "left" | "right";
    axisRange?: [
        number,
        number
    ];
    seriesType?: "bar" | "line";
};
export type ChartNote = [
    label: string,
    value: string,
    series?: number
];
export type ChartRow = {
    key: string;
    label: string;
    values: (number | null)[];
    notes?: ChartNote[];
};
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
    const formatted = Math.abs(value) >= 100000
        ? compact.format(value)
        : formatNumber(value, digits);
    return `${formatted}${unit}`;
}
function useWidth() {
    const [width, setWidth] = useState(0);
    const observer = useRef<ResizeObserver | null>(null);
    const ref = useCallback((node: HTMLDivElement | null) => {
        observer.current?.disconnect();
        observer.current = null;
        if (!node)
            return;
        observer.current = new ResizeObserver((entries) => setWidth(Math.round(entries[0].contentRect.width)));
        observer.current.observe(node);
    }, []);
    return [ref, width] as const;
}
function niceScale(low: number, high: number, count = 4) {
    const min = Math.min(0, low);
    const max = Math.max(0, high) || 1;
    const span = max - min || 1;
    const power = 10 ** Math.floor(Math.log10(span / count));
    const step = [1, 2, 2.5, 5, 10].map((s) => s * power).find((s) => span / s <= count) ??
        power * 10;
    const start = Math.floor(min / step) * step;
    const end = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let v = start; v <= end + step / 2; v += step)
        ticks.push(+v.toFixed(10));
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
    const padding = rawSpan > 0
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
    const step = [1, 2, 2.5, 5, 10]
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
type TipLine = {
    color?: string;
    value?: string;
    label: string;
};
type Pointer = {
    x: number;
    y: number;
    w: number;
    h: number;
};
function usePointer() {
    const [pointer, setPointer] = useState<Pointer | null>(null);
    const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
        const box = e.currentTarget.getBoundingClientRect();
        setPointer({ x: e.clientX - box.left, y: e.clientY - box.top, w: box.width, h: box.height });
    }, []);
    const clear = useCallback(() => setPointer(null), []);
    return [pointer, onPointerMove, clear] as const;
}
function tipStyle(x: number, width: number, vertical: {
    top: number;
} | {
    pointerY: number;
    height: number;
}): CSSProperties {
    const horizontal = x > width / 2 ? { right: Math.max(0, width - x + 12) } : { left: Math.max(0, x + 12) };
    if ("top" in vertical)
        return { ...horizontal, top: vertical.top };
    return vertical.pointerY > vertical.height / 2
        ? { ...horizontal, bottom: Math.max(0, vertical.height - vertical.pointerY + 14) }
        : { ...horizontal, top: Math.max(0, vertical.pointerY + 14) };
}
function NoteRows({ notes, className }: {
    notes: ChartNote[];
    className: string;
}) {
    if (!notes.length)
        return null;
    return (<div className={className}>
      {notes.map(([label, note], i) => (<div key={`${i}-${label}`}>
          <span>{label}</span>
          <strong>{note}</strong>
        </div>))}
    </div>);
}
function ChartTip({ title, lines, notes = [], style }: {
    title: string;
    lines: TipLine[];
    notes?: ChartNote[];
    style: CSSProperties;
}) {
    const bySeries = (index: number) => notes.filter((note) => note[2] === index);
    const general = notes.filter((note) => note[2] == null || note[2] >= lines.length);
    return (<div className="trjk-tip" style={style}>
      <header>{title}</header>
      {lines.map((line, i) => (<div key={i} className="trjk-tip-line">
          <div>
            {line.color ? <i style={{ background: line.color }}/> : null}
            {line.value ? <strong>{line.value}</strong> : null}
            <span>{line.label}</span>
          </div>
          <NoteRows notes={bySeries(i)} className="trjk-tip-sub"/>
        </div>))}
      <NoteRows notes={general} className="trjk-tip-notes"/>
    </div>);
}
export type KpiTrend = {
    label: string;
    values: (number | null)[];
    from?: string;
    to?: string;
};
export function KpiTooltip({ label, notes, trend, loading = false, footer, }: {
    label: string;
    notes: ChartNote[];
    trend?: KpiTrend | null;
    loading?: boolean;
    footer?: string;
}) {
    const ui = useChartUi();
    const ref = useRef<HTMLDivElement>(null);
    const [align, setAlign] = useState<"start" | "end">("start");
    useEffect(() => {
        const node = ref.current;
        if (!node)
            return;
        const update = () => {
            const card = node.parentElement;
            if (!card)
                return;
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
    const spark = trendValues.length > 1
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
    return (<div ref={ref} className="trjk-tip trjk-kpi-tip" role="tooltip" data-align={align}>
      <header>{label}</header>
      {spark.length > 1 && (<div className="trjk-kpi-trend">
          <div className="trjk-kpi-trend-head">
            <span>{trend?.label}</span>
            <small>{trendValues.length} {ui.points}</small>
          </div>
          <svg viewBox={`0 0 ${sparkWidth} ${sparkHeight}`} preserveAspectRatio="none" aria-hidden="true">
            <polygon className="trjk-kpi-spark-area" points={areaPoints}/>
            <polyline className="trjk-kpi-spark-line" points={sparkPoints}/>
            {lastPoint && <circle className="trjk-kpi-spark-dot" cx={lastPoint.x} cy={lastPoint.y} r="2.8"/>}
          </svg>
          {trend?.from || trend?.to ? (<div className="trjk-kpi-trend-range">
              <span>{trend.from}</span>
              <span>{trend.to}</span>
            </div>) : null}
        </div>)}
      {notes.map(([name, amount], i) => (<div key={`${i}-${name}`}>
          <span>{name}</span>
          <strong>{loading ? "…" : amount}</strong>
        </div>))}
      {footer ? <footer>{footer}</footer> : null}
    </div>);
}
function ChartCard({ title, subtitle, series, kind, empty, table, panel, controls, children, }: {
    title: string;
    subtitle: string;
    series?: ChartSeries[];
    kind?: "bar" | "line";
    empty: boolean;
    table?: ReactNode;
    panel?: ReactNode;
    controls?: ReactNode;
    children: ReactNode;
}) {
    const ui = useChartUi();
    const [dataOpen, setDataOpen] = useState(false);
    const hasLegend = Boolean(series && series.length > 1);
    return (<section className="trjk-card trjk-chart" style={{ height: "100%", minWidth: 0, position: "relative" }}>
      <div className="trjk-chart-head" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 12, paddingRight: controls ? 76 : 0 }}>
        <div style={{ minWidth: 0, flex: "1 1 320px" }}>
          <h3 style={{ whiteSpace: "normal", overflow: "visible", textOverflow: "clip", overflowWrap: "anywhere", lineHeight: 1.4 }}>{title}</h3>
          <p className="trjk-chart-sub" style={{ whiteSpace: "normal", overflow: "visible", textOverflow: "clip", overflowWrap: "anywhere", lineHeight: 1.5 }}>{subtitle}</p>
        </div>
        {hasLegend ? (<div className="trjk-legend" style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "7px 14px", whiteSpace: "normal", minWidth: 0, maxWidth: "100%", flex: "0 1 auto" }}>
            {series!.map((s) => (<span key={s.label}>
                <i data-kind={s.seriesType ?? kind} style={{ background: s.color,
                    display: "inline-block", width: (s.seriesType ?? kind) === "line" ? 18 : 9,
                    height: (s.seriesType ?? kind) === "line" ? 3 : 9, borderRadius: 2, marginRight: 5 }}/>
                {s.label}
              </span>))}
          </div>) : null}
      </div>
      {controls ? (<div data-vai-export-ignore style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 6,
            width: "auto",
            minWidth: 0,
        }}>
          {controls}
        </div>) : null}
      {empty ? (<div className="trjk-empty">{ui.empty}</div>) : (children)}
      {!empty && panel ? (<div className="trjk-chart-data">{panel}</div>) : !empty && table ? (<details className="trjk-chart-data" onToggle={(event) => setDataOpen(event.currentTarget.open)}>
          <summary>{ui.exact}</summary>
          {dataOpen ? <div className="trjk-table-scroll">{table}</div> : null}
        </details>) : null}
    </section>);
}
function SeriesTable({ rows, series, digits, unit, head, }: {
    rows: ChartRow[];
    series: ChartSeries[];
    digits: number;
    unit: string;
    head?: string;
}) {
    const ui = useChartUi();
    const sticky = { position: "sticky" as const, left: 0, background: "var(--s-1)", boxShadow: "1px 0 0 var(--line)", zIndex: 2 };
    return (<table style={{ width: "max-content", minWidth: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
      <thead>
        <tr>
          <th style={{ ...sticky, zIndex: 4 }}>{head ?? ui.period}</th>
          {series.map((s) => (<th key={s.label}>{s.label}</th>))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (<tr key={r.key}>
            <td style={sticky}>{r.key}</td>
            {r.values.map((v, j) => (<td key={j}>{value(v, series[j]?.digits ?? digits, series[j]?.unit ?? unit)}</td>))}
          </tr>))}
      </tbody>
    </table>);
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
    const longestVisibleLabel = rows.reduce((max, row) => Math.max(max, axisLabelText(row.label).length), 0);
    const estimatedLabelWidth = Math.min(148, Math.max(48, longestVisibleLabel * 6.2 + 14));
    const every = Math.max(1, Math.ceil(estimatedLabelWidth / Math.max(1, band)));
    const shown = new Set<number>();
    for (let i = 0; i < count; i += every) {
        shown.add(i);
    }
    const last = count - 1;
    const lastShown = Math.floor(last / every) * every;
    if (!shown.has(last) &&
        (last - lastShown) * band >= estimatedLabelWidth) {
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
    if (series.some((s) => s.axisSide)) {
        const firstKey = series[0]?.axisKey ?? "__default";
        const explicitByUnit = new Map<string, ChartAxisSide>();
        series.forEach((s) => { if (s.axisSide)
            explicitByUnit.set(s.axisKey ?? firstKey, s.axisSide); });
        return series.map((s) => s.axisSide ?? explicitByUnit.get(s.axisKey ?? firstKey) ?? ((s.axisKey ?? firstKey) === firstKey ? "left" : "right"));
    }
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
        const ratio = magnitude > 0 && leftRef > 0
            ? Math.max(magnitude, leftRef) / Math.max(Math.min(magnitude, leftRef), 1e-12)
            : 1;
        if (rightKey === null) {
            if (key !== leftKey || ratio >= 12) {
                axes[index] = "right";
                rightKey = key;
                rightRef = magnitude || 1;
            }
            else {
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
        }
        else {
            axes[index] = "left";
            leftRef = Math.max(leftRef, current);
        }
    }
    return axes;
}
function fixedAxisScale(series: ChartSeries[], axes: ChartAxisSide[], side: ChartAxisSide, fallback: ReturnType<typeof adaptiveScale>) {
    const range = series.find((s, i) => axes[i] === side && s.axisRange)?.axisRange;
    if (!range || !Number.isFinite(range[0]) || !Number.isFinite(range[1]) || range[1] <= range[0])
        return fallback;
    return { min: range[0], max: range[1], ticks: Array.from({ length: 5 }, (_, i) => range[0] + (range[1] - range[0]) * i / 4) };
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
function axisUnitLabel(series: ChartSeries[], axes: ChartAxisSide[], side: ChartAxisSide, fallbackUnit: string) {
    const units = Array.from(new Set(series
        .map((item, index) => (axes[index] === side ? (item.unit ?? fallbackUnit).trim() : ""))
        .filter(Boolean)));
    return units.length === 1 ? units[0] : "";
}
function seriesLines(row: ChartRow, series: ChartSeries[], digits: number, unit: string): TipLine[] {
    return series.map((s, j) => ({
        color: s.color,
        value: value(row.values[j] ?? null, s.digits ?? digits, s.unit ?? unit),
        label: s.label,
    }));
}
function BarGradients({ id, series }: {
    id: string;
    series: ChartSeries[];
}) {
    return (<defs>
      {series.map((s, j) => (<linearGradient key={j} id={`${id}-${j}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.color}/>
          <stop offset="1" stopColor={s.color} stopOpacity="0.58"/>
        </linearGradient>))}
    </defs>);
}
function LinePath({ d, color, axis }: {
    d: string;
    color: string;
    axis?: ChartAxisSide;
}) {
    if (!d)
        return null;
    return (<g data-series-type="line" data-axis={axis}>
      <path d={d} fill="none" stroke={color} strokeWidth="7" strokeOpacity="0.14" strokeLinejoin="round" strokeLinecap="round"/>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
    </g>);
}
function barPath(x: number, y0: number, y1: number, w: number, roundEnd: boolean) {
    const top = Math.min(y0, y1);
    const h = Math.abs(y0 - y1);
    if (h < 0.5)
        return `M${x},${top}h${w}v0.5h-${w}z`;
    const r = roundEnd ? Math.min(4, w / 2, h) : 0;
    const upward = y1 <= y0;
    if (!r)
        return `M${x},${top}h${w}v${h}h-${w}z`;
    return upward
        ? `M${x},${y0}V${top + r}a${r},${r} 0 0 1 ${r},-${r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}V${y0}z`
        : `M${x},${y0}V${y0 + h - r}a${r},${r} 0 0 0 ${r},${r}h${w - 2 * r}a${r},${r} 0 0 0 ${r},-${r}V${y0}z`;
}
function stackSegments(values: (number | null)[]) {
    let positive = 0;
    let negative = 0;
    const segments = values.map((v) => {
        if (v == null || v === 0)
            return null;
        if (v > 0) {
            const from = positive;
            positive += v;
            return { from, to: positive };
        }
        const from = negative;
        negative += v;
        return { from, to: negative };
    });
    const lastPositive = values.reduce((last, v, j) => (v != null && v > 0 ? j : last), -1);
    const lastNegative = values.reduce((last, v, j) => (v != null && v < 0 ? j : last), -1);
    return { segments, positive: Number(positive.toFixed(9)), negative: Number(negative.toFixed(9)), lastPositive, lastNegative };
}
export function ColumnChart({ title, subtitle, rows, series, digits = 0, unit = "", height = 220, scale: scaleMode = "linear", stacked = false, dataTable, controls, minCategoryWidth = 0, intervals = false, onSelect, }: {
    title: string;
    subtitle: string;
    rows: ChartRow[];
    series: ChartSeries[];
    digits?: number;
    unit?: string;
    height?: number;
    scale?: ChartScaleMode;
    stacked?: boolean | "stack" | "percent";
    dataTable?: ReactNode;
    controls?: ReactNode;
    minCategoryWidth?: number;
    intervals?: boolean;
    onSelect?: (key: string, seriesIndex?: number) => void;
}) {
    const ui = useChartUi();
    const gradientId = useId();
    const [ref, width] = useWidth();
    const [hover, setHover] = useState<number | null>(null);
    const stack = Boolean(stacked) && series.length > 1;
    const stackTotals = stack && stacked !== "percent";
    const axes = stack ? series.map(() => "left" as ChartAxisSide) : assignSeriesAxes(rows, series);
    const hasRight = axes.includes("right");
    const pad = { l: 46, r: hasRight ? 52 : 10, t: 18, b: 28 };
    const plotW = Math.max(0, width - pad.l - pad.r);
    const plotH = height - pad.t - pad.b;
    const stacks = stack ? rows.map((row) => stackSegments(row.values)) : [];
    const leftFinite = stack ? stacks.flatMap((item) => [item.positive, item.negative]) : axisValues(rows, axes, "left");
    const rightFinite = axisValues(rows, axes, "right");
    const leftHasBars = series.some((item, index) => axes[index] === "left" &&
        item.seriesType !== "line");
    const rightHasBars = series.some((item, index) => axes[index] === "right" &&
        item.seriesType !== "line");
    const log = !stack &&
        scaleMode === "log" &&
        canUseLogScale([...leftFinite, ...rightFinite]);
    const leftLog = logarithmicScale(leftFinite);
    const rightLog = logarithmicScale(rightFinite);
    const leftScale = log
        ? leftLog
        : adaptiveScale(leftFinite, leftHasBars || stack);
    const rightScale = log
        ? rightLog
        : adaptiveScale(rightFinite, rightHasBars);
    const yFor = (index: number, v: number) => {
        const scale = axes[index] === "right"
            ? rightScale
            : leftScale;
        const fraction = log
            ? (axes[index] === "right"
                ? rightLog
                : leftLog).fraction(v)
            : (v - scale.min) /
                (scale.max - scale.min);
        return pad.t + plotH - fraction * plotH;
    };
    const leftAxisUnit = axisUnitLabel(series, axes, "left", unit);
    const rightAxisUnit = axisUnitLabel(series, axes, "right", unit);
    const band = rows.length ? plotW / rows.length : 0;
    const n = stack ? 1 : series.length;
    const barW = intervals && n === 1 ? Math.max(0.5, band - 1) : Math.max(3, Math.min(30, (band * 0.68 - 2 * (n - 1)) / n));
    const groupW = n * barW + 2 * (n - 1);
    const labels = visibleLabels(rows, band);
    const capLabels = rows.length <= 12 && band / n >= 44;
    const bar = (x: number, v: number, w: number, index: number) => {
        const baseline = log
            ? (axes[index] === "right" ? rightScale.min : leftScale.min)
            : 0;
        return barPath(x, yFor(index, baseline), yFor(index, v), w, true);
    };
    const tip = hover == null ? null : rows[hover];
    const pointIndex = (e: ReactPointerEvent<SVGSVGElement>) => {
        const box = e.currentTarget.getBoundingClientRect();
        const px = e.clientX - box.left - pad.l;
        const py = e.clientY - box.top;
        if (!band || px < 0 || px > plotW || py < pad.t || py > pad.t + plotH)
            return null;
        return Math.max(0, Math.min(rows.length - 1, Math.floor(px / band)));
    };
    const locate = (e: ReactPointerEvent<SVGSVGElement>) => setHover(pointIndex(e));
    const select = (e: ReactPointerEvent<SVGSVGElement>) => {
        const index = pointIndex(e);
        if (index != null)
            onSelect?.(rows[index].key);
    };
    const capLabel = (x: number, v: number, index: number, key: string) => {
        const labelY = v >= 0 ? yFor(index, v) - 4 : yFor(index, v) + 11;
        if (labelY < pad.t + 9 || labelY > pad.t + plotH - 4)
            return null;
        return (<text key={key} className="trjk-mark-label" x={x} y={labelY} textAnchor="middle">
        {formatMarkLabel(v, series[index]?.digits ?? digits)}
      </text>);
    };
    return (<ChartCard title={title} subtitle={`${subtitle}${log ? ` · ${ui.logScale}` : ""}`} series={series} kind="bar" empty={!rows.length} controls={controls} table={dataTable ?? <SeriesTable rows={rows} series={series} digits={digits} unit={unit}/>}>
      <div style={{ overflowX: "auto", maxWidth: "100%" }}>
      <div className="trjk-chart-plot" ref={ref} style={{ position: "relative", minHeight: height, minWidth: minCategoryWidth > 0 ? rows.length * minCategoryWidth + 110 : undefined }}>
        {width > 0 && (<svg role="img" tabIndex={0} onKeyDown={(event) => {
                if (event.key === "Escape")
                    setHover(null);
                if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                    event.preventDefault();
                    setHover((current) => Math.max(0, Math.min(rows.length - 1, (current ?? -1) + (event.key === "ArrowRight" ? 1 : -1))));
                }
            }} aria-label={`${title}. Usa las flechas para consultar valores; Escape cierra el detalle.`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} onPointerMove={locate} onPointerDown={locate} onClick={onSelect ? select : undefined} onPointerLeave={() => setHover(null)} style={onSelect ? { cursor: "pointer" } : undefined}>
            <desc>{`${title}. Los valores exactos están en «Ver cifras exactas».`}</desc>
            <BarGradients id={gradientId} series={series}/>
            {(axes.includes("left") ? leftScale.ticks : []).map((t) => (<g key={`l-${t}`}>
                <line className={t === 0 ? "trjk-zero-line" : "trjk-grid-line"} x1={pad.l} x2={width - pad.r} y1={yFor(Math.max(0, axes.indexOf("left")), t)} y2={yFor(Math.max(0, axes.indexOf("left")), t)}/>
                <text className="trjk-axis" x={pad.l - 6} y={yFor(Math.max(0, axes.indexOf("left")), t) + 3.5} textAnchor="end">
                  {compact.format(t)}
                </text>
              </g>))}
            {hasRight
                ? rightScale.ticks.map((t) => {
                    const rightIndex = axes.findIndex((axis) => axis === "right");
                    return (<text key={`r-${t}`} className="trjk-axis" x={width - pad.r + 6} y={yFor(rightIndex, t) + 3.5} textAnchor="start">
                      {compact.format(t)}
                    </text>);
                })
                : null}
            {leftAxisUnit ? (<text className="trjk-axis" x={pad.l} y={11} textAnchor="start">
                {leftAxisUnit}
              </text>) : null}
            {hasRight && rightAxisUnit ? (<text className="trjk-axis" x={width - pad.r} y={11} textAnchor="end">
                {rightAxisUnit}
              </text>) : null}
            {rows.map((row, i) => {
                const x0 = pad.l + band * i + (band - groupW) / 2;
                const dimmed = hover != null && hover !== i;
                const stackRow = stacks[i];
                return (<g key={row.key}>
                  <rect className="trjk-band" data-hover={hover === i} x={pad.l + band * i} y={pad.t} width={band} height={plotH} rx="4"/>
                  {stackRow
                        ? stackRow.segments.map((segment, j) => segment == null ? null : (<path key={j} className="trjk-mark" opacity={dimmed ? 0.45 : 1} d={barPath(x0, yFor(j, segment.from), yFor(j, segment.to), barW, j === stackRow.lastPositive || j === stackRow.lastNegative)} fill={`url(#${gradientId}-${j})`} onClick={onSelect ? (event) => { event.stopPropagation(); onSelect(row.key, j); } : undefined}/>))
                        : row.values.map((v, j) => v == null ? null : (<path key={j} className="trjk-mark" opacity={dimmed ? 0.45 : 1} d={bar(x0 + j * (barW + 2), v, barW, j)} fill={`url(#${gradientId}-${j})`} onClick={onSelect ? (event) => { event.stopPropagation(); onSelect(row.key, j); } : undefined}/>))}
                  {capLabels && stackRow
                        ? stackTotals
                            ? [stackRow.positive > 0 ? capLabel(x0 + barW / 2, stackRow.positive, 0, "lp") : null, stackRow.negative < 0 ? capLabel(x0 + barW / 2, stackRow.negative, 0, "ln") : null]
                            : null
                        : capLabels &&
                            row.values.map((v, j) => (v == null || v === 0 ? null : capLabel(x0 + j * (barW + 2) + barW / 2, v, j, `l${j}`)))}
                  {labels.has(i) && (<text className="trjk-axis" x={pad.l + band * i + band / 2} y={height - 8} textAnchor="middle">
                      <title>{row.label}</title>
                      {axisLabelText(row.label)}
                    </text>)}
                </g>);
            })}
          </svg>)}
        {tip && hover != null && (<ChartTip title={tip.label} lines={seriesLines(tip, series, digits, unit)} notes={tip.notes} style={tipStyle(pad.l + band * hover + band / 2, width, { top: pad.t })}/>)}
      </div>
      </div>
    </ChartCard>);
}
export function ComboChart({ title, subtitle, rows, series, digits = 0, unit = "", height = 220, scale: scaleMode = "linear", dataTable, controls, minCategoryWidth = 0, onSelect, }: {
    title: string;
    subtitle: string;
    rows: ChartRow[];
    series: ChartSeries[];
    digits?: number;
    unit?: string;
    height?: number;
    scale?: ChartScaleMode;
    dataTable?: ReactNode;
    controls?: ReactNode;
    minCategoryWidth?: number;
    onSelect?: (key: string, seriesIndex?: number) => void;
}) {
    const ui = useChartUi();
    const gradientId = useId();
    const [ref, width] = useWidth();
    const [hover, setHover] = useState<number | null>(null);
    const axes = assignSeriesAxes(rows, series);
    const hasRight = axes.includes("right");
    const pad = { l: 46, r: hasRight ? 56 : 14, t: 18, b: 28 };
    const plotW = Math.max(0, width - pad.l - pad.r);
    const plotH = height - pad.t - pad.b;
    const leftFinite = axisValues(rows, axes, "left");
    const rightFinite = axisValues(rows, axes, "right");
    const leftHasBars = series.some((item, index) => axes[index] === "left" &&
        item.seriesType !== "line");
    const rightHasBars = series.some((item, index) => axes[index] === "right" &&
        item.seriesType !== "line");
    const log = scaleMode === "log" &&
        canUseLogScale([...leftFinite, ...rightFinite]);
    const leftLog = logarithmicScale(leftFinite);
    const rightLog = logarithmicScale(rightFinite);
    const leftScale = log
        ? leftLog
        : fixedAxisScale(series, axes, "left", adaptiveScale(leftFinite, leftHasBars));
    const rightScale = log
        ? rightLog
        : fixedAxisScale(series, axes, "right", adaptiveScale(rightFinite, rightHasBars));
    const yFor = (index: number, v: number) => {
        const scale = axes[index] === "right"
            ? rightScale
            : leftScale;
        const fraction = log
            ? (axes[index] === "right"
                ? rightLog
                : leftLog).fraction(v)
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
        const baseline = log
            ? (axes[index] === "right" ? rightScale.min : leftScale.min)
            : 0;
        return barPath(x, yFor(index, baseline), yFor(index, v), w, true);
    };
    const x = (i: number) => pad.l + band * i + band / 2;
    const paths = series.map((item, j) => {
        if (item.seriesType !== "line")
            return "";
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
    const endLabels: {
        j: number;
        i: number;
        v: number;
        y: number;
    }[] = [];
    series.forEach((item, j) => {
        if (item.seriesType !== "line")
            return;
        for (let i = rows.length - 1; i >= 0; i--) {
            const v = rows[i].values[j];
            if (v == null)
                continue;
            const py = yFor(j, v);
            const collidesWithBar = rows[i].values.some((barValue, barIndex) => barValue != null &&
                series[barIndex]?.seriesType !== "line" &&
                Math.abs(yFor(barIndex, barValue) - py) < 18);
            const collidesWithLine = endLabels.some((label) => Math.abs(label.y - py) < 18);
            if (py >= pad.t + 10 &&
                py <= pad.t + plotH - 10 &&
                !collidesWithBar &&
                !collidesWithLine) {
                endLabels.push({ j, i, v, y: py });
            }
            break;
        }
    });
    const tip = hover == null ? null : rows[hover];
    const pointIndex = (e: ReactPointerEvent<SVGSVGElement>) => {
        const box = e.currentTarget.getBoundingClientRect();
        const px = e.clientX - box.left - pad.l;
        const py = e.clientY - box.top;
        if (!band || px < 0 || px > plotW || py < pad.t || py > pad.t + plotH)
            return null;
        return Math.max(0, Math.min(rows.length - 1, Math.floor(px / band)));
    };
    const locate = (e: ReactPointerEvent<SVGSVGElement>) => setHover(pointIndex(e));
    const select = (e: ReactPointerEvent<SVGSVGElement>) => {
        const index = pointIndex(e);
        if (index != null)
            onSelect?.(rows[index].key);
    };
    return (<ChartCard title={title} subtitle={`${subtitle}${log ? ` · ${ui.logScale}` : ""}`} series={series} empty={!rows.length} controls={controls} table={dataTable ?? <SeriesTable rows={rows} series={series} digits={digits} unit={unit}/>}>
      <div style={{ overflowX: "auto", maxWidth: "100%" }}>
      <div className="trjk-chart-plot" ref={ref} style={{ position: "relative", minHeight: height, minWidth: minCategoryWidth > 0 ? rows.length * minCategoryWidth + 110 : undefined }}>
        {width > 0 && (<svg role="img" tabIndex={0} onKeyDown={(event) => {
                if (event.key === "Escape")
                    setHover(null);
                if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                    event.preventDefault();
                    setHover((current) => Math.max(0, Math.min(rows.length - 1, (current ?? -1) + (event.key === "ArrowRight" ? 1 : -1))));
                }
            }} aria-label={`${title}. Usa las flechas para consultar valores; Escape cierra el detalle.`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} onPointerMove={locate} onPointerDown={locate} onClick={onSelect ? select : undefined} onPointerLeave={() => setHover(null)} style={onSelect ? { cursor: "pointer" } : undefined}>
            <desc>{`${title}. Los valores exactos están en «Ver cifras exactas».`}</desc>
            <BarGradients id={gradientId} series={series}/>
            {(axes.includes("left") ? leftScale.ticks : []).map((t) => (<g key={`l-${t}`}>
                <line className={t === 0 ? "trjk-zero-line" : "trjk-grid-line"} x1={pad.l} x2={width - pad.r} y1={yFor(Math.max(0, axes.indexOf("left")), t)} y2={yFor(Math.max(0, axes.indexOf("left")), t)}/>
                <text className="trjk-axis" x={pad.l - 6} y={yFor(Math.max(0, axes.indexOf("left")), t) + 3.5} textAnchor="end">
                  {compact.format(t)}
                </text>
              </g>))}
            {hasRight
                ? rightScale.ticks.map((t) => {
                    const rightIndex = axes.findIndex((axis) => axis === "right");
                    return (<text key={`r-${t}`} className="trjk-axis" x={width - pad.r + 6} y={yFor(rightIndex, t) + 3.5} textAnchor="start">
                      {compact.format(t)}
                    </text>);
                })
                : null}
            {leftAxisUnit ? (<text className="trjk-axis" x={pad.l} y={11} textAnchor="start">
                {leftAxisUnit}
              </text>) : null}
            {hasRight && rightAxisUnit ? (<text className="trjk-axis" x={width - pad.r} y={11} textAnchor="end">
                {rightAxisUnit}
              </text>) : null}
            {rows.map((row, i) => {
                const x0 = pad.l + band * i + (band - groupW) / 2;
                const dimmed = hover != null && hover !== i;
                return (<g key={row.key}>
                  <rect className="trjk-band" data-hover={hover === i} x={pad.l + band * i} y={pad.t} width={band} height={plotH} rx="4"/>
                  {row.values.map((v, j) => v == null || !barSlots.has(j) ? null : (<path key={j} data-series-type="bar" data-axis={axes[j]} className="trjk-mark" opacity={dimmed ? 0.45 : 1} d={bar(x0 + (barSlots.get(j) ?? 0) * (barW + 2), v, barW, j)} fill={`url(#${gradientId}-${j})`} onClick={onSelect ? (event) => { event.stopPropagation(); onSelect(row.key, j); } : undefined}/>))}
                  {capLabels &&
                        row.values.map((v, j) => {
                            if (v == null ||
                                v === 0 ||
                                !barSlots.has(j)) {
                                return null;
                            }
                            const labelY = v >= 0
                                ? yFor(j, v) - 4
                                : yFor(j, v) + 11;
                            const collidesWithLine = row.values.some((lineValue, lineIndex) => lineValue != null &&
                                series[lineIndex]?.seriesType === "line" &&
                                Math.abs(yFor(lineIndex, lineValue) - labelY) < 18);
                            if (labelY < pad.t + 9 ||
                                labelY > pad.t + plotH - 4 ||
                                collidesWithLine) {
                                return null;
                            }
                            return (<text key={`l${j}`} className="trjk-mark-label" x={x0 +
                                    (barSlots.get(j) ?? 0) * (barW + 2) +
                                    barW / 2} y={labelY} textAnchor="middle">
                          {formatMarkLabel(v, series[j]?.digits ?? digits)}
                        </text>);
                        })}
                  {labels.has(i) && (<text className="trjk-axis" x={x(i)} y={height - 8} textAnchor="middle">
                      <title>{row.label}</title>
                      {axisLabelText(row.label)}
                    </text>)}
                </g>);
            })}
            {hover != null && (<line className="trjk-crosshair" x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + plotH}/>)}
            {paths.map((d, j) => (<LinePath key={j} d={d} color={series[j].color} axis={axes[j]}/>))}
            {rows.map((row, i) => row.values.map((v, j) => v == null || series[j]?.seriesType !== "line" || (!markers && hover !== i) ? null : (<circle key={`${i}-${j}`} cx={x(i)} cy={yFor(j, v)} r={hover === i ? 5 : 4} fill={series[j].color} stroke="var(--s-1)" strokeWidth="2" onClick={onSelect ? (event) => { event.stopPropagation(); onSelect(row.key, j); } : undefined}/>)))}
            {endLabels.map((e) => {
                const text = formatMarkLabel(e.v, series[e.j]?.digits ?? digits, series[e.j]?.unit ?? unit);
                const placeLeft = x(e.i) + 9 + text.length * 6 > width - pad.r;
                return (<text key={e.j} className="trjk-mark-label" x={placeLeft ? x(e.i) - 9 : x(e.i) + 9} y={e.y + 3.5} textAnchor={placeLeft ? "end" : "start"}>
                  {text}
                </text>);
            })}
          </svg>)}
        {tip && hover != null && (<ChartTip title={tip.label} lines={seriesLines(tip, series, digits, unit)} notes={tip.notes} style={tipStyle(x(hover), width, { top: pad.t })}/>)}
      </div>
      </div>
    </ChartCard>);
}
export function LineChart({ title, subtitle, rows, series, digits = 0, unit = "", height = 220, area = false, dataTable, controls, minCategoryWidth = 0, scale: scaleMode = "linear", onSelect, }: {
    title: string;
    subtitle: string;
    rows: ChartRow[];
    series: ChartSeries[];
    digits?: number;
    unit?: string;
    height?: number;
    area?: boolean | "all";
    dataTable?: ReactNode;
    controls?: ReactNode;
    minCategoryWidth?: number;
    scale?: ChartScaleMode;
    onSelect?: (key: string, seriesIndex?: number) => void;
}) {
    const ui = useChartUi();
    const [ref, width] = useWidth();
    const [hover, setHover] = useState<number | null>(null);
    const axes = assignSeriesAxes(rows, series);
    const hasRight = axes.includes("right");
    const pad = { l: 46, r: 58, t: 18, b: 28 };
    const plotW = Math.max(0, width - pad.l - pad.r);
    const plotH = height - pad.t - pad.b;
    const leftFinite = axisValues(rows, axes, "left");
    const rightFinite = axisValues(rows, axes, "right");
    const log = scaleMode === "log" &&
        canUseLogScale([...leftFinite, ...rightFinite]);
    const leftLog = logarithmicScale(leftFinite);
    const rightLog = logarithmicScale(rightFinite);
    const leftScale = log ? leftLog : adaptiveScale(leftFinite, false);
    const rightScale = log ? rightLog : adaptiveScale(rightFinite, false);
    const yFor = (index: number, v: number) => {
        const scale = axes[index] === "right" ? rightScale : leftScale;
        const fraction = log
            ? (axes[index] === "right" ? rightLog : leftLog).fraction(v)
            : (v - scale.min) / (scale.max - scale.min);
        return pad.t + plotH - fraction * plotH;
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
    const endLabels: {
        j: number;
        i: number;
        v: number;
        y: number;
    }[] = [];
    series.forEach((_, j) => {
        for (let i = rows.length - 1; i >= 0; i--) {
            const v = rows[i].values[j];
            if (v == null)
                continue;
            const py = yFor(j, v);
            if (py >= pad.t + 10 &&
                py <= pad.t + plotH - 10 &&
                !endLabels.some((label) => Math.abs(label.y - py) < 18)) {
                endLabels.push({ j, i, v, y: py });
            }
            break;
        }
    });
    const areaPaths = series.map((_, j) => {
        if (!rows.length || !area || (area !== "all" && j > 0))
            return "";
        const points = rows.map((r, i) => r.values[j] == null
            ? null
            : `${x(i).toFixed(1)},${yFor(j, r.values[j] as number).toFixed(1)}`);
        const first = points.findIndex(Boolean);
        let last = points.length - 1;
        while (last >= 0 && !points[last]) {
            last--;
        }
        if (first < 0 || last <= first)
            return "";
        const baselineY = pad.t + plotH;
        return `M${x(first).toFixed(1)},${baselineY.toFixed(1)}L${points
            .slice(first, last + 1)
            .filter(Boolean)
            .join("L")}L${x(last).toFixed(1)},${baselineY.toFixed(1)}z`;
    });
    const tip = hover == null ? null : rows[hover];
    const pointIndex = (e: ReactPointerEvent<SVGSVGElement>) => {
        const box = e.currentTarget.getBoundingClientRect();
        const px = e.clientX - box.left - pad.l;
        const py = e.clientY - box.top;
        if (px < -Math.max(step / 2, 8) || px > plotW + Math.max(step / 2, 8) || py < pad.t || py > pad.t + plotH)
            return null;
        return Math.max(0, Math.min(rows.length - 1, step ? Math.round(px / step) : 0));
    };
    const locate = (e: ReactPointerEvent<SVGSVGElement>) => setHover(pointIndex(e));
    const select = (e: ReactPointerEvent<SVGSVGElement>) => {
        const index = pointIndex(e);
        if (index != null)
            onSelect?.(rows[index].key);
    };
    return (<ChartCard title={title} subtitle={`${subtitle}${log ? ` · ${ui.logScale}` : ""}`} series={series} kind="line" empty={!rows.length} controls={controls} table={dataTable ?? <SeriesTable rows={rows} series={series} digits={digits} unit={unit}/>}>
      <div style={{ overflowX: "auto", maxWidth: "100%" }}>
      <div className="trjk-chart-plot" ref={ref} style={{ position: "relative", minHeight: height, minWidth: minCategoryWidth > 0 ? rows.length * minCategoryWidth + 110 : undefined }}>
        {width > 0 && (<svg role="img" tabIndex={0} onKeyDown={(event) => {
                if (event.key === "Escape")
                    setHover(null);
                if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                    event.preventDefault();
                    setHover((current) => Math.max(0, Math.min(rows.length - 1, (current ?? -1) + (event.key === "ArrowRight" ? 1 : -1))));
                }
            }} aria-label={`${title}. Usa las flechas para consultar valores; Escape cierra el detalle.`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} onPointerMove={locate} onPointerDown={locate} onClick={onSelect ? select : undefined} onPointerLeave={() => setHover(null)} style={onSelect ? { cursor: "pointer" } : undefined}>
            <desc>{`${title}. Los valores exactos están en «Ver cifras exactas».`}</desc>
            {(axes.includes("left") ? leftScale.ticks : []).map((t) => (<g key={`l-${t}`}>
                <line className={t === 0 ? "trjk-zero-line" : "trjk-grid-line"} x1={pad.l} x2={width - pad.r} y1={yFor(Math.max(0, axes.indexOf("left")), t)} y2={yFor(Math.max(0, axes.indexOf("left")), t)}/>
                <text className="trjk-axis" x={pad.l - 6} y={yFor(Math.max(0, axes.indexOf("left")), t) + 3.5} textAnchor="end">
                  {compact.format(t)}
                </text>
              </g>))}
            {hasRight
                ? rightScale.ticks.map((t) => {
                    const rightIndex = axes.findIndex((axis) => axis === "right");
                    return (<text key={`r-${t}`} className="trjk-axis" x={width - pad.r + 6} y={yFor(rightIndex, t) + 3.5} textAnchor="start">
                      {compact.format(t)}
                    </text>);
                })
                : null}
            {leftAxisUnit ? (<text className="trjk-axis" x={pad.l} y={11} textAnchor="start">
                {leftAxisUnit}
              </text>) : null}
            {hasRight && rightAxisUnit ? (<text className="trjk-axis" x={width - pad.r} y={11} textAnchor="end">
                {rightAxisUnit}
              </text>) : null}
            {rows.map((row, i) => labels.has(i) ? (<text key={row.key} className="trjk-axis" x={x(i)} y={height - 8} textAnchor="middle">
                  <title>{row.label}</title>
                  {axisLabelText(row.label)}
                </text>) : null)}
            {areaPaths.map((d, j) => (d ? <path key={`a${j}`} d={d} fill={series[j].color} opacity={series.length > 1 ? 0.09 : 0.12}/> : null))}
            {hover != null && (<line className="trjk-crosshair" x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + plotH}/>)}
            {paths.map((d, j) => (<LinePath key={j} d={d} color={series[j].color}/>))}
            {rows.map((row, i) => row.values.map((v, j) => v == null || (!markers && hover !== i) ? null : (<circle key={`${i}-${j}`} cx={x(i)} cy={yFor(j, v)} r={hover === i ? 5 : 4} fill={series[j].color} stroke="var(--s-1)" strokeWidth="2" onClick={onSelect ? (event) => { event.stopPropagation(); onSelect(row.key, j); } : undefined}/>)))}
            {endLabels.map((e) => {
                const text = formatMarkLabel(e.v, series[e.j]?.digits ?? digits, series[e.j]?.unit ?? unit);
                const estimatedWidth = Math.max(24, text.length * 6.2);
                const placeLeft = hasRight ||
                    axes[e.j] === "right" ||
                    x(e.i) + 9 + estimatedWidth > width - 6;
                return (<text key={e.j} className="trjk-mark-label" x={placeLeft ? x(e.i) - 9 : x(e.i) + 9} y={e.y + 3.5} textAnchor={placeLeft ? "end" : "start"}>
                  {text}
                </text>);
            })}
          </svg>)}
        {tip && hover != null && (<ChartTip title={tip.label} lines={seriesLines(tip, series, digits, unit)} notes={tip.notes} style={tipStyle(x(hover), width, { top: pad.t })}/>)}
      </div>
      </div>
    </ChartCard>);
}
export type DonutItem = {
    label: string;
    value: number;
    color: string;
    note?: string;
    notes?: ChartNote[];
};
function arc(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) {
    const p = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M${p(r1, a0)}A${r1},${r1} 0 ${large} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0},${r0} 0 ${large} 0 ${p(r0, a0)}z`;
}
export function DonutChart({ title, subtitle, items, digits = 0, unit = "", centerLabel, selected, onSelect, panel, showTable = true, dataTable, controls, }: {
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
    controls?: ReactNode;
}) {
    const ui = useChartUi();
    const [active, setActive] = useState<number | null>(null);
    const [pointer, onPointerMove, clearPointer] = usePointer();
    const shown = items.filter((i) => i.value > 0);
    const total = shown.reduce((sum, i) => sum + i.value, 0);
    const size = 150;
    const cx = size / 2;
    const r1 = 66;
    const r0 = 46;
    const gap = shown.length > 1 ? 2 / r1 : 0;
    const segments: {
        item: DonutItem;
        d: string;
        pct: number;
    }[] = [];
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
    const focusIndex = active != null ? active : selectedIndex >= 0 ? selectedIndex : null;
    const focus = focusIndex != null ? shown[focusIndex] : null;
    const tip = active != null && pointer ? segments[active] : null;
    return (<ChartCard title={title} subtitle={subtitle} empty={!shown.length} panel={panel} controls={controls} table={dataTable ?? (showTable ? (<table>
            <thead>
              <tr>
                <th>{ui.category}</th>
                <th>{ui.value}</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((s) => (<tr key={s.item.label}>
                  <td>{s.item.label}</td>
                  <td>{value(s.item.value, digits, unit)}</td>
                  <td>{formatNumber(s.pct, 1)} %</td>
                </tr>))}
            </tbody>
          </table>) : undefined)}>
      <div className="trjk-donut" onPointerMove={onPointerMove} onPointerDown={onPointerMove} onPointerLeave={() => {
            setActive(null);
            clearPointer();
        }}>
        <svg role="img" aria-label={title} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <desc>
            {showTable
            ? `${title}. ${ui.exactHint}`
            : title}
          </desc>
          {segments.map((s, i) => (<path key={s.item.label} d={s.d} fill={s.item.color} opacity={focusIndex == null || focusIndex === i ? 1 : 0.35} onPointerEnter={() => setActive(i)} onClick={onSelect
                ? () => onSelect(selected === s.item.label ? null : s.item.label)
                : undefined} style={onSelect ? { cursor: "pointer" } : undefined}/>))}
          <text className="trjk-donut-value" x={cx} y={cx - 2} textAnchor="middle">
            {focus ? `${formatNumber(focus.value / total * 100, 0)} %` : compact.format(total)}
          </text>
          <text className="trjk-donut-label" x={cx} y={cx + 14} textAnchor="middle">
            {focus ? focus.label.slice(0, 18) : centerLabel}
          </text>
        </svg>
        <div className="trjk-donut-list">
          {segments.map((s, i) => (<button type="button" key={s.item.label} data-active={focusIndex === i} aria-pressed={onSelect ? selected === s.item.label : undefined} onPointerEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} onClick={onSelect
                ? () => onSelect(selected === s.item.label ? null : s.item.label)
                : undefined}>
              <i style={{ background: s.item.color }}/>
              <span>{s.item.label}</span>
              <strong>{value(s.item.value, digits, unit)}</strong>
              <em>{formatNumber(s.pct, 1)} %</em>
            </button>))}
        </div>
        {tip && pointer && (<ChartTip title={tip.item.label} lines={[{ color: tip.item.color, value: value(tip.item.value, digits, unit), label: `${formatNumber(tip.pct, 1)} % ${centerLabel || ui.total}` }]} notes={[...(tip.item.note ? ([[ui.detail, tip.item.note]] as ChartNote[]) : []), ...(tip.item.notes ?? [])]} style={tipStyle(pointer.x, pointer.w, { pointerY: pointer.y, height: pointer.h })}/>)}
      </div>
    </ChartCard>);
}
export type RankRow = {
    label: string;
    value: number;
    note?: string;
    notes?: ChartNote[];
};
export function RankChart({ title, subtitle, rows, digits = 0, unit = "", color = CHART_COLORS[0], selected, onSelect, panel, scale: scaleMode = "linear", dataTable, controls, }: {
    title: string;
    subtitle: string;
    rows: RankRow[];
    digits?: number;
    unit?: string;
    color?: string;
    selected?: string | null;
    onSelect?: (label: string) => void;
    panel?: ReactNode;
    scale?: ChartScaleMode;
    dataTable?: ReactNode;
    controls?: ReactNode;
}) {
    const ui = useChartUi();
    const [active, setActive] = useState<number | null>(null);
    const [pointer, onPointerMove, clearPointer] = usePointer();
    const max = rows.reduce((n, row) => Math.max(n, row.value), 1);
    const min = rows.reduce((n, row) => Math.min(n, row.value), 0);
    const diverging = min < 0;
    const zero = -min / (max - min) * 100;
    const log = scaleMode === "log" && canUseLogScale(rows.map((row) => row.value));
    const logScale = logarithmicScale(rows.map((row) => row.value));
    const tip = active != null && pointer ? rows[active] : null;
    return (<ChartCard title={title} subtitle={`${subtitle}${log ? ` · ${ui.logScale}` : ""}`} empty={!rows.length} panel={panel} controls={controls} table={dataTable ?? (<table>
          <thead>
            <tr>
              <th>#</th>
              <th>{ui.category}</th>
              <th>{ui.value}</th>
              <th>{ui.detail}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (<tr key={r.label}>
                <td>{i + 1}</td>
                <td>{r.label}</td>
                <td>{value(r.value, digits, unit)}</td>
                <td>{r.note || "—"}</td>
              </tr>))}
          </tbody>
        </table>)}>
      <div className="trjk-rank" onPointerMove={onPointerMove} onPointerDown={onPointerMove} onPointerLeave={() => {
            setActive(null);
            clearPointer();
        }}>
        {rows.map((r, i) => {
            const Row = onSelect ? "button" : "div";
            return (<Row className="trjk-rank-row" key={r.label} onPointerEnter={() => setActive(i)} {...(onSelect
                ? {
                    type: "button" as const,
                    "aria-pressed": selected === r.label,
                    onClick: () => onSelect(r.label),
                }
                : {})}>
              <span>
                {i + 1}. {r.label}
              </span>
              <div style={diverging ? { position: "relative", minHeight: 8 } : undefined}>
                {diverging ? <span aria-hidden="true" style={{ position: "absolute", left: `${zero}%`, top: -3, bottom: -3, borderLeft: "1px solid var(--chart-other)", opacity: .6 }}/> : null}
                <div className="trjk-rank-bar" style={diverging ? {
                    position: "relative", marginLeft: `${r.value < 0 ? (r.value - min) / (max - min) * 100 : zero}%`,
                    width: `${Math.abs(r.value) / (max - min) * 100}%`, background: r.value < 0 ? CHART_COLORS[1] : color,
                } : { width: `${(log ? logScale.fraction(r.value) : r.value / max) * 100}%`, background: color }}/>
              </div>
              <strong>
                {value(r.value, digits, unit)}
                {r.note ? <small>{r.note}</small> : null}
              </strong>
            </Row>);
        })}
        {tip && pointer && active != null && (<ChartTip title={`${active + 1}. ${tip.label}`} lines={[{ color, value: value(tip.value, digits, unit), label: "" }, ...(tip.note ? [{ label: tip.note }] : [])]} notes={tip.notes} style={tipStyle(pointer.x, pointer.w, { pointerY: pointer.y, height: pointer.h })}/>)}
      </div>
    </ChartCard>);
}
export function LollipopChart({ title, subtitle, rows, digits = 0, unit = "", color = CHART_COLORS[0], selected, onSelect, scale: scaleMode = "linear", dataTable, controls, }: {
    title: string;
    subtitle: string;
    rows: RankRow[];
    digits?: number;
    unit?: string;
    color?: string;
    selected?: string | null;
    onSelect?: (label: string) => void;
    scale?: ChartScaleMode;
    dataTable?: ReactNode;
    controls?: ReactNode;
}) {
    const ui = useChartUi();
    const [active, setActive] = useState<number | null>(null);
    const [pointer, onPointerMove, clearPointer] = usePointer();
    const finite = rows.map((row) => row.value).filter(Number.isFinite);
    const log = scaleMode === "log" && canUseLogScale(finite);
    const logScale = logarithmicScale(finite);
    const linear = adaptiveScale(finite, true, 5);
    const fraction = (v: number) => log ? logScale.fraction(v) : (v - linear.min) / Math.max(1e-12, linear.max - linear.min);
    const zero = log ? 0 : fraction(0);
    const tip = active != null && pointer ? rows[active] : null;
    return <ChartCard title={title} subtitle={`${subtitle}${log ? ` · ${ui.logScale}` : ""}`} empty={!rows.length} controls={controls} table={dataTable ?? <table>
      <thead><tr><th>{ui.category}</th><th>{ui.value}</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.label}><td>{row.label}</td><td>{value(row.value, digits, unit)}</td></tr>)}</tbody>
    </table>}>
      <div style={{ overflowX: "auto", maxWidth: "100%" }} onPointerMove={onPointerMove} onPointerDown={onPointerMove} onPointerLeave={() => { setActive(null); clearPointer(); }}>
        <div style={{ minWidth: 520, display: "grid", gap: 5 }}>
          {rows.map((row, index) => {
            const Row = onSelect ? "button" : "div";
            const at = Math.max(0, Math.min(1, fraction(row.value)));
            const left = Math.min(zero, at) * 100;
            const width = Math.max(0.7, Math.abs(at - zero) * 100);
            return <Row key={row.label} {...(onSelect ? { type: "button" as const, "aria-pressed": selected === row.label, onClick: () => onSelect(row.label) } : {})} onPointerEnter={() => setActive(index)} style={{ display: "grid", gridTemplateColumns: "minmax(120px, 190px) minmax(260px, 1fr) minmax(90px, auto)", alignItems: "center", gap: 10, width: "100%", minHeight: 34, padding: "4px 6px", border: 0, background: selected === row.label ? "var(--s-2)" : "transparent", color: "inherit", textAlign: "left", cursor: onSelect ? "pointer" : "default" }}>
              <span title={row.label} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</span>
              <span style={{ position: "relative", height: 20 }}>
                <span aria-hidden="true" style={{ position: "absolute", left: `${Math.max(0, Math.min(100, zero * 100))}%`, top: 2, bottom: 2, borderLeft: "1px solid var(--line)" }}/>
                <span aria-hidden="true" style={{ position: "absolute", left: `${left}%`, width: `${width}%`, top: 9, height: 2, background: row.value < 0 ? CHART_COLORS[1] : color, opacity: .72 }}/>
                <span aria-hidden="true" style={{ position: "absolute", left: `calc(${at * 100}% - 5px)`, top: 5, width: 10, height: 10, borderRadius: "50%", background: row.value < 0 ? CHART_COLORS[1] : color, boxShadow: "0 0 0 2px var(--s-1)" }}/>
              </span>
              <strong style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{value(row.value, digits, unit)}</strong>
            </Row>;
          })}
        </div>
        {tip && pointer && <ChartTip title={tip.label} lines={[{ color: tip.value < 0 ? CHART_COLORS[1] : color, value: value(tip.value, digits, unit), label: "" }]} notes={tip.notes} style={tipStyle(pointer.x, pointer.w, { pointerY: pointer.y, height: pointer.h })}/>}
      </div>
    </ChartCard>;
}

export type ScatterPoint = {
    label: string;
    x: number;
    y: number;
    notes?: ChartNote[];
};
function linearFit(points: ScatterPoint[]) {
    const n = points.length;
    if (n < 3)
        return null;
    const mx = points.reduce((sum, p) => sum + p.x, 0) / n;
    const my = points.reduce((sum, p) => sum + p.y, 0) / n;
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (const p of points) {
        sxy += (p.x - mx) * (p.y - my);
        sxx += (p.x - mx) ** 2;
        syy += (p.y - my) ** 2;
    }
    if (sxx === 0 || syy === 0)
        return null;
    const slope = sxy / sxx;
    return { slope, intercept: my - slope * mx, r: sxy / Math.sqrt(sxx * syy) };
}
export function ScatterChart({ title, subtitle, points, xLabel, yLabel, xDigits = 0, xUnit = "", yDigits = 0, yUnit = "", color = CHART_COLORS[0], height = 240, dataTable, controls, }: {
    title: string;
    subtitle: string;
    points: ScatterPoint[];
    xLabel: string;
    yLabel: string;
    xDigits?: number;
    xUnit?: string;
    yDigits?: number;
    yUnit?: string;
    color?: string;
    height?: number;
    dataTable?: ReactNode;
    controls?: ReactNode;
}) {
    const ui = useChartUi();
    const [ref, width] = useWidth();
    const [hover, setHover] = useState<number | null>(null);
    const pad = { l: 52, r: 18, t: 18, b: 34 };
    const plotW = Math.max(0, width - pad.l - pad.r);
    const plotH = height - pad.t - pad.b;
    const shown = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    const xScale = adaptiveScale(shown.map((p) => p.x), false, 5);
    const yScale = adaptiveScale(shown.map((p) => p.y), false, 4);
    const xFor = (v: number) => pad.l + ((v - xScale.min) / (xScale.max - xScale.min)) * plotW;
    const yFor = (v: number) => pad.t + plotH - ((v - yScale.min) / (yScale.max - yScale.min)) * plotH;
    const fit = linearFit(shown);
    const fitLine = fit
        ? (() => {
            const x0 = xScale.min;
            const x1 = xScale.max;
            const y0 = fit.intercept + fit.slope * x0;
            const y1 = fit.intercept + fit.slope * x1;
            return { x0: xFor(x0), y0: yFor(y0), x1: xFor(x1), y1: yFor(y1) };
        })()
        : null;
    const placed: {
        x: number;
        y: number;
    }[] = [];
    const labeled = new Set<number>();
    if (shown.length <= 14) {
        shown.forEach((p, i) => {
            const px = xFor(p.x) + 8;
            const py = yFor(p.y) + 3.5;
            if (placed.some((q) => Math.abs(q.x - px) < 64 && Math.abs(q.y - py) < 12))
                return;
            placed.push({ x: px, y: py });
            labeled.add(i);
        });
    }
    const tip = hover == null ? null : shown[hover];
    const locate = (e: ReactPointerEvent<SVGSVGElement>) => {
        const box = e.currentTarget.getBoundingClientRect();
        const px = e.clientX - box.left;
        const py = e.clientY - box.top;
        let best = -1;
        let bestDistance = 26;
        shown.forEach((p, i) => {
            const distance = Math.hypot(xFor(p.x) - px, yFor(p.y) - py);
            if (distance < bestDistance) {
                best = i;
                bestDistance = distance;
            }
        });
        setHover(best >= 0 ? best : null);
    };
    return (<ChartCard title={title} subtitle={`${subtitle}${fit ? ` · ${ui.linearTrend}, r = ${formatNumber(fit.r, 2)}` : ""}`} empty={!shown.length} controls={controls} table={dataTable ?? (<table>
            <thead>
              <tr>
                <th>{ui.category}</th>
                <th>{xLabel}</th>
                <th>{yLabel}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (<tr key={p.label}>
                  <td>{p.label}</td>
                  <td>{value(p.x, xDigits, xUnit)}</td>
                  <td>{value(p.y, yDigits, yUnit)}</td>
                </tr>))}
            </tbody>
          </table>)}>
      <div className="trjk-chart-plot" ref={ref} style={{ minHeight: height }}>
        {width > 0 && (<svg role="img" aria-label={title} width={width} height={height} viewBox={`0 0 ${width} ${height}`} onPointerMove={locate} onPointerDown={locate} onPointerLeave={() => setHover(null)}>
            <desc>{`${title}. Los valores exactos están en «Ver cifras exactas».`}</desc>
            {yScale.ticks.map((t) => (<g key={`y-${t}`}>
                <line className={t === 0 ? "trjk-zero-line" : "trjk-grid-line"} x1={pad.l} x2={width - pad.r} y1={yFor(t)} y2={yFor(t)}/>
                <text className="trjk-axis" x={pad.l - 6} y={yFor(t) + 3.5} textAnchor="end">
                  {compact.format(t)}
                </text>
              </g>))}
            {xScale.ticks.map((t) => (<g key={`x-${t}`}>
                <line className="trjk-grid-line" x1={xFor(t)} x2={xFor(t)} y1={pad.t} y2={pad.t + plotH} opacity="0.5"/>
                <text className="trjk-axis" x={xFor(t)} y={height - 20} textAnchor="middle">
                  {compact.format(t)}
                </text>
              </g>))}
            <text className="trjk-axis" x={pad.l} y={11} textAnchor="start">
              {`${yLabel}${yUnit ? ` (${yUnit.trim()})` : ""}`}
            </text>
            <text className="trjk-axis" x={width - pad.r} y={height - 6} textAnchor="end">
              {`${xLabel}${xUnit ? ` (${xUnit.trim()})` : ""}`}
            </text>
            {fitLine ? (<line x1={fitLine.x0} y1={fitLine.y0} x2={fitLine.x1} y2={fitLine.y1} stroke={color} strokeWidth="1.5" strokeOpacity="0.55" strokeDasharray="5 4"/>) : null}
            {shown.map((p, i) => {
                const dimmed = hover != null && hover !== i;
                return (<g key={`${p.label}-${i}`} opacity={dimmed ? 0.4 : 1}>
                  <circle cx={xFor(p.x)} cy={yFor(p.y)} r={hover === i ? 7 : 5.5} fill={color} fillOpacity="0.22"/>
                  <circle className="trjk-mark" cx={xFor(p.x)} cy={yFor(p.y)} r={hover === i ? 5 : 3.5} fill={color} stroke="var(--s-1)" strokeWidth="1.5"/>
                  {labeled.has(i) ? (<text className="trjk-mark-label" x={xFor(p.x) + 8} y={yFor(p.y) + 3.5} textAnchor="start">
                      {axisLabelText(p.label, 16)}
                    </text>) : null}
                </g>);
            })}
          </svg>)}
        {tip && hover != null && (<ChartTip title={tip.label} lines={[
                { color, value: value(tip.x, xDigits, xUnit), label: xLabel },
                { color, value: value(tip.y, yDigits, yUnit), label: yLabel },
            ]} notes={tip.notes} style={tipStyle(xFor(tip.x), width, { pointerY: yFor(tip.y), height })}/>)}
      </div>
    </ChartCard>);
}
export function RadarChart({ title, subtitle, rows, series, height = 360, dataTable, controls, onSelect, }: {
    title: string;
    subtitle: string;
    rows: ChartRow[];
    series: ChartSeries[];
    height?: number;
    dataTable?: ReactNode;
    controls?: ReactNode;
    onSelect?: (key: string, seriesIndex?: number) => void;
}) {
    const ui = useChartUi();
    const [ref, width] = useWidth();
    const [hover, setHover] = useState<{ row: number; series: number } | null>(null);
    const shown = rows.slice(0, 12);
    const cx = width / 2;
    const cy = height / 2 + 8;
    const radius = Math.max(34, Math.min(width * .31, height * .31));
    const ranges = series.map((_, j) => {
        const values = shown.map((row) => row.values[j]).filter((v): v is number => v != null && Number.isFinite(v));
        if (!values.length) return { min: 0, max: 1 };
        const min = Math.min(...values);
        const max = Math.max(...values);
        if (min === max) {
            if (max === 0) return { min: 0, max: 1 };
            if (max > 0) return { min: 0, max };
            return { min: min * 2, max: 0 };
        }
        return { min: Math.min(0, min), max };
    });
    const point = (rowIndex: number, seriesIndex: number, level?: number) => {
        const angle = -Math.PI / 2 + rowIndex * (Math.PI * 2 / Math.max(1, shown.length));
        const raw = shown[rowIndex]?.values[seriesIndex];
        const range = ranges[seriesIndex];
        const normalized = level ?? (raw == null ? 0 : Math.max(0, Math.min(1, (raw - range.min) / Math.max(1e-12, range.max - range.min))));
        return { x: cx + Math.cos(angle) * radius * normalized, y: cy + Math.sin(angle) * radius * normalized };
    };
    const polygon = (seriesIndex: number, level?: number) => shown.map((_, rowIndex) => {
        const p = point(rowIndex, seriesIndex, level);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(" ");
    const tipRow = hover ? shown[hover.row] : null;
    const tipSeries = hover ? series[hover.series] : null;
    const tipPoint = hover ? point(hover.row, hover.series) : null;
    return <ChartCard title={title} subtitle={`${subtitle} · ${ui.radarScale}`} series={series} empty={!shown.length || !series.length} controls={controls} table={dataTable ?? <SeriesTable rows={shown} series={series} digits={2} unit=""/>}>
      <div ref={ref} className="trjk-chart-plot" style={{ minHeight: height, minWidth: 0, overflow: "hidden" }}>
        {width > 0 ? <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
          <desc>{`${title}. ${ui.radarScale}. ${ui.exactHint}`}</desc>
          {[.25, .5, .75, 1].map((level) => <polygon key={level} points={polygon(0, level)} fill="none" stroke="var(--line)" strokeWidth="1" opacity={level === 1 ? .75 : .42}/>)}
          {shown.map((row, i) => {
            const outer = point(i, 0, 1);
            const angle = -Math.PI / 2 + i * (Math.PI * 2 / Math.max(1, shown.length));
            const labelRadius = radius + 20;
            const lx = cx + Math.cos(angle) * labelRadius;
            const ly = cy + Math.sin(angle) * labelRadius;
            const anchor = Math.cos(angle) > .25 ? "start" : Math.cos(angle) < -.25 ? "end" : "middle";
            return <g key={row.key}>
              <line x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="var(--line)" strokeWidth="1" opacity=".45"/>
              <text className="trjk-axis" x={lx} y={ly + 3} textAnchor={anchor}><title>{row.label}</title>{axisLabelText(row.label, 16)}</text>
            </g>;
          })}
          {series.map((item, j) => <g key={`${item.label}-${j}`}>
            <polygon points={polygon(j)} fill={item.color} fillOpacity={series.length === 1 ? .14 : .07} stroke={item.color} strokeWidth="2"/>
            {shown.map((row, i) => {
                const raw = row.values[j];
                if (raw == null) return null;
                const p = point(i, j);
                const active = hover?.row === i && hover.series === j;
                return <circle key={`${row.key}-${j}`} cx={p.x} cy={p.y} r={active ? 6 : 4} fill={item.color} stroke="var(--s-1)" strokeWidth="2" tabIndex={0} role="button" aria-label={`${row.label}, ${item.label}: ${value(raw, item.digits ?? 2, item.unit ?? "")}`} onPointerEnter={() => setHover({ row: i, series: j })} onPointerLeave={() => setHover(null)} onFocus={() => setHover({ row: i, series: j })} onBlur={() => setHover(null)} onClick={onSelect ? () => onSelect(row.key, j) : undefined}/>;
            })}
          </g>)}
        </svg> : null}
        {hover && tipRow && tipSeries && tipPoint ? <ChartTip title={tipRow.label} lines={[{ label: tipSeries.label, color: tipSeries.color, value: value(tipRow.values[hover.series], tipSeries.digits ?? 2, tipSeries.unit ?? "") }]} notes={tipRow.notes} style={tipStyle(tipPoint.x, width, { pointerY: tipPoint.y, height })}/> : null}
      </div>
    </ChartCard>;
}

export function HeatmapChart({ title, subtitle, rows, series, dataTable, controls }: {
    title: string;
    subtitle: string;
    rows: ChartRow[];
    series: ChartSeries[];
    dataTable?: ReactNode;
    controls?: ReactNode;
}) {
    const ui = useChartUi();
    const [ref, measured] = useWidth();
    const [hover, setHover] = useState<{
        row: number;
        column: number;
    } | null>(null);
    const width = Math.max(measured, rows.length * 76 + 170);
    const left = 162, top = 48, cellH = 36;
    const cellW = (width - left - 16) / Math.max(1, rows.length);
    const height = top + series.length * cellH + 24;
    const finite = rows.flatMap((r) => r.values).filter((v): v is number => v != null && Number.isFinite(v));
    const maximum = finite.reduce((n, v) => Math.max(n, Math.abs(v)), 0);
    const selected = hover ? rows[hover.row] : null;
    const metric = hover ? series[hover.column] : null;
    const selectedValue = hover ? selected?.values[hover.column] : null;
    return <ChartCard title={title} subtitle={subtitle} empty={!rows.length || !series.length} controls={controls} table={dataTable ?? <SeriesTable rows={rows} series={series} digits={2} unit="" head={ui.group}/>}>
    <div className="muted" style={{ fontSize: 11, marginBottom: 10, whiteSpace: "normal" }}>
      Intensidad: menor a mayor magnitud · — sin dato{finite.some((v) => v < 0) ? " · tono secundario: valores negativos" : ""}.
    </div>
    <div style={{ overflowX: "auto", maxWidth: "100%" }}>
      <div ref={ref} className="trjk-chart-plot" style={{ minWidth: rows.length * 76 + 170, position: "relative" }}>
        <svg width={width} height={height} role="img" aria-label={`${title}. Cada celda es consultable con Tab.`}>
          <desc>{ui.heatmapDesc}</desc>
          {rows.map((row, i) => <text key={row.key} className="trjk-axis" x={left + (i + .5) * cellW} y={25} textAnchor="middle">
            <title>{row.label}</title>{axisLabelText(row.label, 11)}
          </text>)}
          {series.map((s, j) => <text key={`${j}-${s.label}`} className="trjk-axis" x={left - 10} y={top + (j + .5) * cellH + 4} textAnchor="end">
            <title>{s.label}</title>{axisLabelText(s.label, 24)}
          </text>)}
          {rows.flatMap((row, i) => series.map((s, j) => {
            const v = row.values[j];
            const valid = v != null && Number.isFinite(v);
            const x = left + i * cellW, y = top + j * cellH;
            const active = hover?.row === i && hover.column === j;
            const text = value(v, s.digits ?? 2, s.unit ?? "");
            return <g key={`${row.key}-${j}`} role="img" tabIndex={0} aria-label={`${row.label}, ${s.label}: ${text}`} onPointerEnter={() => setHover({ row: i, column: j })} onPointerLeave={() => setHover(null)} onFocus={() => setHover({ row: i, column: j })} onBlur={() => setHover(null)} onKeyDown={(e) => { if (e.key === "Escape")
                setHover(null); }}>
              <rect data-heatmap-cell="true" x={x + 2} y={y + 2} width={Math.max(1, cellW - 4)} height={cellH - 4} rx={4} fill={valid ? (v < 0 ? CHART_COLORS[1] : CHART_COLORS[0]) : CHART_OTHER} fillOpacity={valid ? .12 + .72 * (maximum ? Math.abs(v) / maximum : 0) : .08} stroke={active ? CHART_COLORS[0] : "none"}/>
              <text className="trjk-axis" x={x + cellW / 2} y={y + cellH / 2 + 4} textAnchor="middle" style={{ fontSize: 10, pointerEvents: "none" }}>
                {valid ? compact.format(v) : "—"}
              </text>
              <title>{`${row.label} · ${s.label}: ${text}`}</title>
            </g>;
        }))}
        </svg>
        {hover && selected && metric ? <ChartTip title={selected.label} lines={[{ label: metric.label, color: selectedValue != null && selectedValue < 0 ? CHART_COLORS[1] : CHART_COLORS[0], value: value(selectedValue ?? null, metric.digits ?? 2, metric.unit ?? "") }]} style={tipStyle(left + (hover.row + .5) * cellW, width, { top: top + (hover.column + 1) * cellH })}/> : null}
      </div>
    </div>
  </ChartCard>;
}
export function MatrixChart({ title, subtitle, columns, roots, totals, format, controls, onDetail }: {
    title: string;
    subtitle: string;
    columns: { id: string; label: string }[];
    roots: import("../../lib/vai").VaiMatrixNode[];
    totals: Record<string, number>;
    format: (value: number | null) => string;
    controls?: ReactNode;
    onDetail?: (node: import("../../lib/vai").VaiMatrixNode) => void;
}) {
    const ui = useChartUi();
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [page, setPage] = useState(1);
    useEffect(() => { setExpanded(new Set()); setPage(1); }, [roots]);
    const matrixButtonStyle: CSSProperties = {
        minHeight: 32,
        padding: "6px 10px",
        borderRadius: 8,
        border: "1px solid rgba(219, 173, 65, .36)",
        background: "rgba(7, 29, 41, .94)",
        color: "#d9b35f",
        fontWeight: 700,
        cursor: "pointer",
    };
    const visible = useMemo(() => {
        const result: import("../../lib/vai").VaiMatrixNode[] = [];
        const visit = (node: import("../../lib/vai").VaiMatrixNode) => {
            result.push(node);
            if (expanded.has(node.key)) node.children.forEach(visit);
        };
        roots.forEach(visit);
        return result;
    }, [roots, expanded]);
    const pageCount = Math.max(1, Math.ceil(visible.length / 50));
    const currentPage = Math.min(page, pageCount);
    const pageRows = visible.slice((currentPage - 1) * 50, currentPage * 50);
    const expandLevel = (level: number) => {
        const keys = new Set<string>();
        const visit = (node: import("../../lib/vai").VaiMatrixNode) => {
            if (node.path.length < level && node.children.length) {
                keys.add(node.key);
                node.children.forEach(visit);
            }
        };
        roots.forEach(visit);
        setExpanded(keys);
        setPage(1);
    };
    return <ChartCard title={title} subtitle={subtitle} empty={!roots.length} controls={controls}>
      <div data-vai-export-ignore style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button type="button" style={matrixButtonStyle} onClick={() => expandLevel(1)}>{ui.collapse}</button>
        <button type="button" style={matrixButtonStyle} onClick={() => expandLevel(2)}>{ui.secondLevel}</button>
        <button type="button" style={matrixButtonStyle} onClick={() => expandLevel(6)}>{ui.expandAll}</button>
        <span className="muted">{ui.matrixHint}</span>
      </div>
      <div className="vai-table-scroll" style={{ maxHeight: 560, overflow: "auto" }}>
        <table style={{ width: "max-content", minWidth: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 4, background: "var(--s-1)" }}>
            <tr>
              <th style={{ position: "sticky", left: 0, zIndex: 5, background: "var(--s-1)", minWidth: 360 }}>{ui.hierarchy}</th>
              {columns.map((column) => <th key={column.id} data-num style={{ minWidth: 130, maxWidth: 170, whiteSpace: "normal" }}>{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((node) => <tr key={node.key} onClick={onDetail ? () => onDetail(node) : undefined} onKeyDown={onDetail ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onDetail(node);
                }
            } : undefined} role={onDetail ? "button" : undefined} tabIndex={onDetail ? 0 : undefined} style={onDetail ? { cursor: "pointer" } : undefined}>
              <td title={node.path.join(" → ")} style={{ position: "sticky", left: 0, zIndex: 2, background: "var(--s-1)", maxWidth: 480, paddingLeft: 10 + (node.path.length - 1) * 18, fontWeight: node.children.length ? 700 : 400, whiteSpace: "normal", overflowWrap: "anywhere" }}>
                {node.children.length ? <button type="button" aria-expanded={expanded.has(node.key)} aria-label={`${expanded.has(node.key) ? ui.collapse : ui.expand} ${node.label}`} onClick={(event) => {
                    event.stopPropagation();
                    setExpanded((previous) => {
                        const next = new Set(previous);
                        if (next.has(node.key)) next.delete(node.key); else next.add(node.key);
                        return next;
                    });
                }} style={{ ...matrixButtonStyle, minWidth: 26, minHeight: 26, width: 26, height: 26, padding: 0, marginRight: 6 }}>{expanded.has(node.key) ? "−" : "+"}</button> : <span style={{ display: "inline-block", width: 32 }}/>}
                {node.label}
              </td>
              {columns.map((column) => <td key={column.id} data-num style={{ fontVariantNumeric: "tabular-nums", fontWeight: node.children.length ? 700 : 400, whiteSpace: "nowrap" }}>{format(node.values[column.id] ?? null)}</td>)}
            </tr>)}
          </tbody>
          <tfoot style={{ position: "sticky", bottom: 0, zIndex: 3, background: "var(--s-1)", fontWeight: 700 }}>
            <tr>
              <td style={{ position: "sticky", left: 0, background: "var(--s-1)" }}>{ui.filterTotal}</td>
              {columns.map((column) => <td key={column.id} data-num>{format(totals[column.id] ?? null)}</td>)}
            </tr>
          </tfoot>
        </table>
      </div>
      <div data-vai-export-ignore style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "flex-end", marginTop: 12 }}>
        <span className="muted">{visible.length.toLocaleString("es-PE")} {ui.expandedRows}</span>
        <button type="button" style={matrixButtonStyle} disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>{ui.previous}</button>
        <span>{currentPage} / {pageCount}</span>
        <button type="button" style={matrixButtonStyle} disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>{ui.next}</button>
      </div>
    </ChartCard>;
}
export function WaterfallChart({ title, subtitle, rows, digits = 2, unit = "", dataTable, height = 320, controls }: {
    title: string;
    subtitle: string;
    rows: ChartRow[];
    digits?: number;
    unit?: string;
    dataTable?: ReactNode;
    height?: number;
    controls?: ReactNode;
}) {
    const ui = useChartUi();
    const [ref, width] = useWidth();
    const [hover, setHover] = useState<number | null>(null);
    let balance = 0;
    const steps = rows.map((row) => {
        const from = balance;
        const delta = row.values[0];
        if (delta != null && Number.isFinite(delta))
            balance += delta;
        return { row, from, to: balance, delta };
    });
    const final = balance;
    const entries = [...steps, { row: { key: "__net__", label: ui.net, values: [final] } as ChartRow, from: 0, to: final, delta: final }];
    const pad = { l: 70, r: 18, t: 30, b: 44 };
    const plotH = height - pad.t - pad.b;
    const band = Math.max(1, (width - pad.l - pad.r) / entries.length);
    const barW = Math.min(44, band * .64);
    const scale = adaptiveScale(entries.flatMap((e) => [e.from, e.to]), true);
    const yFor = (v: number) => pad.t + plotH - (v - scale.min) / (scale.max - scale.min || 1) * plotH;
    const tip = hover == null ? null : entries[hover];
    return <ChartCard title={title} subtitle={subtitle} empty={!rows.length} series={[{ label: ui.positive, color: CHART_COLORS[0] }, { label: ui.negative, color: CHART_COLORS[1] }, { label: ui.net, color: CHART_OTHER }]} kind="bar" controls={controls} table={dataTable ?? <SeriesTable rows={rows} series={[{ label: ui.contribution, color: CHART_COLORS[0] }]} digits={digits} unit={unit} head={ui.category}/>}>
    <div style={{ overflowX: "auto", maxWidth: "100%" }}>
      <div ref={ref} className="trjk-chart-plot" style={{ position: "relative", minWidth: entries.length * 80 + 90, minHeight: height }}>
        {width > 0 ? <svg width={width} height={height} role="img" aria-label={`${title}. Contribuciones desde cero y neto final.`}>
          {scale.ticks.map((v) => <g key={v}>
            <line className={v === 0 ? "trjk-zero-line" : "trjk-grid-line"} x1={pad.l} x2={width - pad.r} y1={yFor(v)} y2={yFor(v)}/>
            <text className="trjk-axis" x={pad.l - 8} y={yFor(v) + 4} textAnchor="end">{compact.format(v)}</text>
          </g>)}
          <text className="trjk-axis" x={pad.l} y={12}>{unit.trim()}</text>
          {entries.map((step, i) => {
                const x = pad.l + (i + .5) * band;
                const color = i === entries.length - 1 ? CHART_OTHER : (step.delta ?? 0) < 0 ? CHART_COLORS[1] : CHART_COLORS[0];
                return <g key={step.row.key} tabIndex={0} role="img" aria-label={`${step.row.label}: ${value(step.delta, digits, unit)}`} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
              <rect x={x - band / 2} y={pad.t} width={band} height={plotH} fill="transparent"/>
              {step.delta != null ? <rect data-waterfall-step="true" x={x - barW / 2} y={Math.min(yFor(step.from), yFor(step.to))} width={barW} height={Math.max(.8, Math.abs(yFor(step.to) - yFor(step.from)))} rx={2} fill={color} fillOpacity={hover == null || hover === i ? .9 : .45}/> : null}
              {i < steps.length - 1 ? <line x1={x + barW / 2} x2={x + band - barW / 2} y1={yFor(step.to)} y2={yFor(step.to)} stroke={CHART_OTHER} strokeDasharray="3 3" strokeOpacity={.6}/> : null}
              <text className="trjk-axis" x={x} y={height - 14} textAnchor="middle"><title>{step.row.label}</title>{axisLabelText(step.row.label, 12)}</text>
              <title>{`${step.row.label}: ${value(step.delta, digits, unit)} · acumulado: ${value(step.to, digits, unit)}`}</title>
            </g>;
            })}
        </svg> : null}
        {tip && hover != null ? <ChartTip title={tip.row.label} lines={[
                { label: hover === entries.length - 1 ? ui.net : ui.contribution, value: value(tip.delta, digits, unit) },
                { label: ui.cumulative, value: value(tip.to, digits, unit) },
            ]} notes={tip.row.notes} style={tipStyle(pad.l + (hover + .5) * band, width, { top: pad.t })}/> : null}
      </div>
    </div>
  </ChartCard>;
}
