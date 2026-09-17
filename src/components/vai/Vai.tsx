"use client";

// src/components/vai/Vai.tsx
//
// Interfaz completa de V-Ai: marca, prompt, inventario, exportaciones,
// renderizado del dashboard y orquestación del flujo.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { apiGet } from "../../lib/apiClient";
import { canUseLogScale, prefersLogScale, type ChartScaleMode } from "../../lib/chartScale";
import {
  VAI_AREAS,
  VAI_VISUAL_CATALOG,
  VAI_PROMPT_MAX,
  VAI_SOURCES,
  VAI_SOURCE_MAP,
  applyFilters,
  chartAxisGroup,
  chartFormat,
  computeWidget,
  defaultFilterValues,
  deleteDashboard,
  distinctValues,
  filterKey,
  formatValue,
  getDashboard,
  listDashboards,
  parseStoredSpec,
  saveDashboard,
  sourceRequestPath,
  summarizeTable,
  widgetDetailTable,
  vaiAreaLabel,
  vaiField,
  type VaiArea,
  type VaiChartPreference,
  type VaiDashboardRecord,
  type VaiDashboardSpec,
  type VaiExportBlock,
  type VaiExportTable,
  type VaiFilterSpec,
  type VaiFilterState,
  type VaiFocus,
  type VaiRow,
  type VaiSource,
  type VaiWidgetData,
  type VaiWidgetSpec,
} from "../../lib/vai";
import {
  CHART_COLORS,
  CHART_OTHER,
  ColumnChart,
  ComboChart,
  DonutChart,
  HeatmapChart,
  WaterfallChart,
  KpiTooltip,
  LineChart,
  RankChart,
  ScatterChart,
  type ChartRow,
  type ChartSeries,
} from "../ui/Charts";
import { Button } from "../ui/Button";
import { ExcelHeaderFilter, useExcelColumnFilters, type ExcelColumnDef } from "../ui/ExcelFilters";
import { Select } from "../ui/Select";

// ── EXPORTACIONES ────────────────────────────────────────────────────

type ExportContextValue = {
  busy: boolean;
  disabled: boolean;
  context: string[];
  run: (action: () => Promise<void>) => void;
  register: (id: string, order: number, get: () => VaiExportBlock) => () => void;
};
const ExportContext = createContext<ExportContextValue | null>(null);

export function VaiExportProvider({ title, context, disabled, children }: { title: string; context: string[]; disabled: boolean; children: ReactNode }) {
  const blocks = useRef(new Map<string, { order: number; get: () => VaiExportBlock }>());
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const register = useCallback((id: string, order: number, get: () => VaiExportBlock) => {
    blocks.current.set(id, { order, get });
    return () => { blocks.current.delete(id); };
  }, []);
  const run = useCallback((action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setError("");
    void action().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo exportar. Inténtalo de nuevo.")).finally(() => { lock.current = false; setBusy(false); });
  }, []);
  return (
    <ExportContext.Provider value={{ busy, disabled, context, run, register }}>
      <div className="vai-export-toolbar" data-vai-export-ignore>
        <span className="muted" aria-live="polite">{busy ? "Preparando archivo…" : "Exporta con los filtros actuales y todas las páginas de las tablas."}</span>
        <Button size="sm" disabled={disabled || busy} onClick={() => run(async () => {
          const { downloadDashboardPdf } = await import("../../lib/vai");
          await downloadDashboardPdf(title, [...blocks.current.values()].sort((a, b) => a.order - b.order).map((item) => item.get()), context);
        })}>Exportar dashboard a PDF</Button>
      </div>
      {error ? <div className="vai-message" data-error="true" role="alert">{error}</div> : null}
      {children}
    </ExportContext.Provider>
  );
}

export function VaiExportSection({ id, order = 0, title, kind, table, children, controls }: {
  id?: string; order?: number; title: string; kind: VaiExportBlock["kind"]; table?: VaiExportTable; children: ReactNode; controls?: ReactNode;
}) {
  const context = useContext(ExportContext);
  const ref = useRef<HTMLDivElement>(null);
  const register = context?.register;
  useEffect(() => {
    if (!id || !register) return;
    return register(id, order, () => ({ title, kind, table, element: ref.current }));
  }, [id, register, order, title, kind, table]);
  return (
    <div
      className="vai-export-section"
      style={kind === "chart" ? { height: "100%", minWidth: 0 } : { minWidth: 0 }}
    >
      {controls || (kind === "table" && table) ? (
        <div className="vai-export-tools" data-vai-export-ignore>
          {controls}
          {kind === "table" && table ? (
            <button
              type="button"
              className="vai-icon-btn"
              disabled={!context || context.disabled || context.busy}
              aria-label={`Exportar ${title} a Excel`}
              title="Exportar a Excel"
              onClick={() =>
                context?.run(async () => {
                  const { downloadTableExcel } =
                    await import("../../lib/vai");

                  await downloadTableExcel(
                    title,
                    table,
                  );
                })
              }
              style={{
                width: 28,
                height: 28,
                display: "inline-grid",
                placeItems: "center",
                flex: "0 0 28px",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="17"
                height="17"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 3h11l5 5v13H4z" />
                <path d="M15 3v5h5" />
                <path d="M7.5 11l5 7" />
                <path d="M12.5 11l-5 7" />
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        ref={ref}
        className="vai-export-content"
        style={kind === "chart" ? { height: "100%", minWidth: 0 } : { minWidth: 0 }}
      >
        {children}
      </div>
    </div>
  );
}

// ── MARCA ────────────────────────────────────────────────────────────

type VaiLogoProps = { size?: number; title?: string };

// Coordenadas relativas al punto de la i; el vuelo nace dentro del domo.
const STAR_FLIGHT = "M-74 -20 C-54 -42 -17 -38 0 0";
const GOLD_DUST = [
  { x: 0, to: 0, size: 1.1, delay: 0 },
  { x: -2.4, to: -1.3, size: .7, delay: .04 },
  { x: 2.8, to: 1.4, size: .8, delay: .07 },
  { x: -4, to: -.6, size: .55, delay: .11 },
  { x: 1.2, to: .5, size: .65, delay: .15 },
  { x: 3.6, to: 1.6, size: .5, delay: .19 },
  { x: -1.5, to: -.9, size: .85, delay: .23 },
  { x: 2.1, to: .3, size: .6, delay: .28 },
];

export function VaiLogo({ size = 40, title = "V-Ai" }: VaiLogoProps) {
  const goldId = useId();
  const stemClipId = useId();

  return (
    <svg
      className="vai-logo"
      width={size * (132 / 92)}
      height={size}
      viewBox="0 0 132 92"
      role="img"
      aria-label={title}
      focusable="false"
    >
      <title>{title}</title>

      <defs>
        <linearGradient id={goldId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--brand-gold)" />
          <stop offset="1" stopColor="var(--brand-gold-light)" />
        </linearGradient>
        <clipPath id={stemClipId} clipPathUnits="userSpaceOnUse">
          {/* El borde inferior de la máscara desciende junto a la escarcha. */}
          <rect className="vai-logo-stem-reveal" x="113" y="-12" width="8" height="60" />
        </clipPath>
      </defs>

      <g className="vai-logo-foundation">
        <path d="M29 29 A14 14 0 0 1 57 29 Z" fill={`url(#${goldId})`} />
        {/* El brazo derecho de la V ya es el izquierdo de la futura A. */}
        <path
          d="M14 39 L43 80 L72 39"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      <path
        className="vai-logo-a-leg"
        d="M72 39 L101 80"
        pathLength="100"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        className="vai-logo-a-bar"
        d="M53.6 65 H90.4"
        pathLength="100"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      <rect x="114.25" y="55.25" width="5.5" height="27.5" rx="2.75" fill={`url(#${goldId})`} clipPath={`url(#${stemClipId})`} />

      <g transform="translate(117 48)" aria-hidden="true">
        {GOLD_DUST.map((grain, index) => (
          <circle
            key={index}
            className="vai-logo-dust"
            r={grain.size}
            style={{
              "--vai-dust-x": `${grain.x}px`,
              "--vai-dust-to-x": `${grain.to}px`,
              "--vai-dust-delay": `${grain.delay}s`,
            } as CSSProperties}
          />
        ))}
      </g>

      <circle className="vai-logo-launch" cx="43" cy="21" r="8" />

      <g transform="translate(117 41)">
        <path className="vai-logo-trail vai-logo-trail-glow" d={STAR_FLIGHT} pathLength="100" />
        <path className="vai-logo-trail" d={STAR_FLIGHT} pathLength="100" />
        <g className="vai-logo-star" style={{ offsetPath: `path('${STAR_FLIGHT}')` }}>
          <path
            className="vai-logo-spark"
            d="M0 -7 C1.2 -2.4 2.4 -1.2 7 0 C2.4 1.2 1.2 2.4 0 7 C-1.2 2.4 -2.4 1.2 -7 0 C-2.4 -1.2 -1.2 -2.4 0 -7 Z"
            fill={`url(#${goldId})`}
          />
        </g>
      </g>
    </svg>
  );
}

// ── INVENTARIO ───────────────────────────────────────────────────────

//
// Inventario de dashboards guardados: abrir (vuelve a consultar los datos,
// sin IA) y eliminar (con confirmación en el orquestador).

type VaiInventoryProps = {
  items: VaiDashboardRecord[];
  loading: boolean;
  error: string | null;
  currentId: number | null;
  onOpen: (item: VaiDashboardRecord) => void;
  onDelete: (item: VaiDashboardRecord) => void;
  onNew: () => void;
  onReload: () => void;
};

export function formatStamp(value: string | null | undefined) {
  if (!value) return "";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return String(value).slice(0, 16).replace("T", " ");
  return new Date(parsed).toLocaleString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function VaiInventory({ items, loading, error, currentId, onOpen, onDelete, onNew, onReload }: VaiInventoryProps) {
  return (
    <section className="trjk-card">
      <div className="trjk-toolbar">
        <h3>Mis dashboards</h3>
        <div className="trjk-actions">
          <Button size="sm" variant="ghost" onClick={onReload} disabled={loading} title="Actualizar inventario">
            ↻
          </Button>
          <Button size="sm" variant="default" onClick={onNew}>
            + Nuevo
          </Button>
        </div>
      </div>
      <div className="vai-inventory" style={{ marginTop: 10 }}>
        {error ? (
          <div className="vai-message" data-error="true">
            {error}
          </div>
        ) : loading && !items.length ? (
          <div className="vai-empty">Cargando…</div>
        ) : !items.length ? (
          <div className="vai-empty">Aún no hay dashboards guardados. El primero que generes aparecerá aquí.</div>
        ) : (
          items.map((item) => (
            <div key={item.dashboard_id} className="vai-inventory-item" role="button" tabIndex={0} aria-current={item.dashboard_id === currentId} onClick={() => onOpen(item)} onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(item);
              }
            }}>
              <div style={{ minWidth: 0 }}>
                <strong>{item.dashboard_name}</strong>
                {item.dashboard_desc ? <span>{item.dashboard_desc}</span> : null}
                <small>{formatStamp(item.updated_at || item.created_at)}</small>
              </div>
              <button
                type="button"
                className="vai-icon-btn"
                title="Eliminar dashboard"
                aria-label={`Eliminar ${item.dashboard_name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item);
                }}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

// ── PROMPT ───────────────────────────────────────────────────────────

//
// Portada de V-Ai: la marca con anillo neón, un composer tipo chat con el
// prompt en lenguaje natural, las preferencias colapsadas justo debajo y
// ejemplos para empezar. Ctrl+Enter o el botón circular generan.

export type VaiPromptRequest = { prompt: string; area: VaiArea | "auto"; focus: VaiFocus; charts: VaiChartPreference[] };

const FOCUS_OPTIONS: Array<{ value: VaiFocus; label: string }> = [
  { value: "auto", label: "Automático" },
  { value: "kpis", label: "KPIs y resumen" },
  { value: "trends", label: "Tendencias" },
  { value: "comparisons", label: "Comparaciones" },
  { value: "detail", label: "Detalle / tablas" },
];

const CHART_OPTIONS: Array<{ value: VaiChartPreference; label: string }> = VAI_VISUAL_CATALOG.map((item) => ({ value: item.type, label: item.label }));

const CURATED_SOURCE_SUGGESTIONS: Record<string, string[]> = {
  finance_mineral_purchases: [
    "Mineral facturado por lote y proveedor, con importe USD y fechas de factura y pago.",
    "Compras de mineral por oficina: importe USD, TMS contables y USD/TMS, con evolución mensual.",
  ],
  finance_mineral_payments: [
    "Pagos de mineral por proveedor y oficina, con total USD y evolución mensual.",
    "Detalle de pagos de mineral con provisión, documento, proveedor, fecha de pago e importe USD.",
  ],
  finance_costs: [
    "Costo real vs presupuesto por macroproceso, con variación USD y avance porcentual.",
    "Costos reales PEN y USD por sede y grupo de costos, con evolución mensual.",
  ],
};

function joinNatural(values: string[]) {
  const clean = values.map((value) => value.trim()).filter(Boolean);

  if (!clean.length) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} y ${clean[1]}`;

  return `${clean.slice(0, -1).join(", ")} y ${clean[clean.length - 1]}`;
}

function sourceSuggestions(source: VaiSource) {
  const metrics = source.metrics;
  const dimensions = source.fields.filter((field) => field.role === "dimension");
  const dates = source.fields.filter((field) => field.role === "date");
  const detailFields = source.fields.filter(
    (field) =>
      field.role === "dimension" ||
      field.role === "attribute" ||
      field.role === "date",
  );

  const metric1 = metrics[0];
  const metric2 = metrics[1];
  const metric3 = metrics[2];
  const dimension1 = dimensions[0];
  const dimension2 = dimensions[1] ?? dimension1;
  const date1 = dates[0];

  const suggestions: string[] = [...(CURATED_SOURCE_SUGGESTIONS[source.id] ?? [])];

  if (metric1) {
    suggestions.push(
      `Quiero ver ${joinNatural(
        [metric1.label, metric2?.label ?? ""].filter(Boolean),
      )}${dimension1 ? ` por ${dimension1.label}` : ""}${
        date1 ? `, con evolución mensual según ${date1.label}` : ""
      }.`,
    );
  }

  if (metric1 && dimension1) {
    suggestions.push(
      `Compara ${metric1.label} por ${dimension1.label}${
        metric2 ? ` y muestra también ${metric2.label}` : ""
      }.`,
    );
  }

  // Instrucciones visuales explícitas: combo, desglose apilado y dispersión.
  if (metric1 && metric2 && dimension1) {
    suggestions.push(
      `${dimension1.label} en el eje X, ${metric1.label} en barras y ${metric2.label} en línea.`,
    );
  }

  if (metric1 && date1 && dimensions[1]) {
    suggestions.push(
      `Evolución mensual de ${metric1.label} según ${date1.label}, en barras apiladas por ${dimensions[1].label}.`,
    );
  }

  if (metric1 && metric2 && dimension1 && metric1.format !== metric2.format) {
    suggestions.push(
      `Dispersión de ${metric1.label} frente a ${metric2.label} por ${dimension1.label}.`,
    );
  }

  if (metric1 && dimension2) {
    suggestions.push(
      `Ranking de ${dimension2.label} por ${metric1.label}${
        metric2 ? `, junto con ${metric2.label}` : ""
      }.`,
    );
  }

  if (date1 && metric1) {
    suggestions.push(
      `Muéstrame la tendencia de ${joinNatural(
        [metric1.label, metric2?.label ?? "", metric3?.label ?? ""].filter(Boolean),
      )} usando ${date1.label}.`,
    );
  }

  if (metrics.length) {
    suggestions.push(
      `Resumen de ${source.name.toLowerCase()} con KPIs de ${joinNatural(
        metrics.slice(0, 3).map((metric) => metric.label),
      )}${dimension1 ? ` y comparación por ${dimension1.label}` : ""}.`,
    );
  }

  if (detailFields.length) {
    suggestions.push(
      `Quiero un detalle de ${source.name.toLowerCase()} con ${joinNatural(
        detailFields.slice(0, 5).map((field) => field.label),
      )}.`,
    );
  }

  return suggestions;
}

function seededShuffle<T>(items: T[], seed: number) {
  const out = [...items];
  let state = Math.max(1, Math.floor(seed * 2147483646));

  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (state * 48271) % 2147483647;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out;
}

function buildSuggestions(area: VaiArea | "auto", seed: number) {
  const sources = VAI_SOURCES.filter(
    (source) =>
      source.enabled &&
      (area === "auto" || source.area === area),
  );

  const pool = [
    ...new Set(
      sources.flatMap((source) => sourceSuggestions(source)),
    ),
  ];

  return seededShuffle(pool, seed);
}

function VaiPromptForm({ busy, initial, onGenerate }: { busy: boolean; /** Última solicitud, para no perder el texto si la generación falla. */ initial?: VaiPromptRequest | null; onGenerate: (request: VaiPromptRequest) => void }) {
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [area, setArea] = useState<VaiArea | "auto">(initial?.area ?? "auto");
  const [focus, setFocus] = useState<VaiFocus>(initial?.focus ?? "auto");
  const [charts, setCharts] = useState<VaiChartPreference[]>(initial?.charts ?? []);
  const [suggestionSeed] = useState(() => Math.random());

  const suggestionPool = useMemo(
    () => buildSuggestions(area, suggestionSeed),
    [area, suggestionSeed],
  );

  const examples = suggestionPool.slice(0, 4);

  const hint =
    suggestionPool[4] ??
    suggestionPool[0] ??
    "Describe el análisis que necesitas usando la información disponible en V-Ai.";

  const length = prompt.length;
  const ready = prompt.trim().length >= 8 && length <= VAI_PROMPT_MAX && !busy;
  const customized = area !== "auto" || focus !== "auto" || charts.length > 0;

  function submit() {
    if (!ready) return;
    onGenerate({ prompt: prompt.trim(), area, focus, charts });
  }

  return (
    <section className="vai-hero">
      <div className="vai-hero-glow" aria-hidden="true" />

      <div className="vai-brand">
        <div className="vai-brand-body">
          <VaiLogo size={88} />
        </div>
      </div>

      <p className="vai-hero-tag">Describe el dashboard que necesitas. V-Ai lo construye con el catálogo de fuentes de Veta.</p>

      <div className="vai-composer" data-busy={busy}>
        <textarea
          value={prompt}
          maxLength={VAI_PROMPT_MAX}
          placeholder={`Ej.: ${hint}`}
          onChange={(e) => setPrompt(e.target.value.slice(0, VAI_PROMPT_MAX))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
          }}
          disabled={busy}
          aria-label="Descripción del dashboard"
        />
        <div className="vai-composer-foot">
          <span className="vai-counter" data-limit={length >= VAI_PROMPT_MAX}>
            {length.toLocaleString("es-PE")} / {VAI_PROMPT_MAX.toLocaleString("es-PE")} · Ctrl+Enter
          </span>
          <button type="button" className="vai-send" onClick={submit} disabled={!ready} aria-label="Generar dashboard" title="Generar dashboard (Ctrl+Enter)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 19V5" />
              <path d="M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      <details className="vai-options" data-custom={customized}>
        <summary>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h9M18 7h2M4 17h4M13 17h7" />
            <circle cx="15.5" cy="7" r="2.4" />
            <circle cx="10.5" cy="17" r="2.4" />
          </svg>
          Personalizar
          {customized ? <i className="vai-dot" aria-label="Con preferencias" /> : null}
        </summary>
        <div className="vai-options-grid">
          <Select
            label="Área / fuente"
            placeholder=""
            value={area}
            onChange={(e) => setArea(e.target.value as VaiArea | "auto")}
            options={[{ value: "auto", label: "Automático" }, ...VAI_AREAS.map((item) => ({ value: item.id, label: item.label }))]}
          />
          <Select label="Prioridad visual" placeholder="" value={focus} onChange={(e) => setFocus(e.target.value as VaiFocus)} options={FOCUS_OPTIONS} />
          <div style={{ display: "grid", gap: 6 }}>
            <div className="vd-label">Tipos de gráfico preferidos</div>
            <div className="vai-check-list">
              {CHART_OPTIONS.map((option) => {
                const on = charts.includes(option.value);
                return (
                  <label key={option.value} className="vai-chip" data-on={on}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => setCharts((prev) => (on ? prev.filter((item) => item !== option.value) : [...prev, option.value]))}
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
            <div className="muted" style={{ fontSize: 11 }}>Sin selección = automático.</div>
          </div>
        </div>
      </details>

      <div className="vai-examples" aria-label="Ejemplos">
        <div className="vd-label">
          {area === "auto"
            ? "Ideas según las fuentes disponibles"
            : `Ideas de ${
                VAI_AREAS.find((item) => item.id === area)?.label ?? "esta área"
              }`}
        </div>
        {examples.map((example) => (
          <button key={example} type="button" onClick={() => setPrompt(example)} disabled={busy}>
            {example}
          </button>
        ))}
      </div>
    </section>
  );
}

// ── DASHBOARD ────────────────────────────────────────────────────────

//
// Renderer fijo de V-Ai: dado un spec validado, consulta cada fuente por su
// endpoint del catálogo (nunca una URL del modelo), aplica filtros en el
// navegador y dibuja KPIs, gráficos compartidos y tablas. Cambiar filtros o
// actualizar datos no vuelve a llamar a la IA.

type SourceState = { rows: VaiRow[]; loading: boolean; error: string | null; loadedAt: number | null };

type VaiDashboardProps = {
  spec: VaiDashboardSpec;
  /** Cambia cuando el usuario pide actualizar datos. */
  refreshToken?: number;
};

function VaiDashboard({ spec, refreshToken = 0 }: VaiDashboardProps) {
  const sources = useMemo(
    () => spec.sources.map((id) => VAI_SOURCE_MAP.get(id)).filter((source): source is VaiSource => Boolean(source)),
    [spec.sources],
  );
  const [data, setData] = useState<Record<string, SourceState>>({});
  const [filters, setFilters] = useState<VaiFilterState>({});

  // Rutas por fuente con el rango de fechas resuelto en SQL; la clave solo
  // cambia cuando cambia un rango, no cuando cambia un filtro de selección.
  const requestKey = useMemo(
    () => JSON.stringify(Object.fromEntries(sources.map((source) => [source.id, sourceRequestPath(source, spec.filters, filters)]))),
    [sources, spec.filters, filters],
  );

  const load = useCallback(async () => {
    const paths = JSON.parse(requestKey) as Record<string, string>;
    setData((prev) => {
      const next = { ...prev };
      for (const source of sources) next[source.id] = { rows: prev[source.id]?.rows ?? [], loading: true, error: null, loadedAt: prev[source.id]?.loadedAt ?? null };
      return next;
    });
    await Promise.all(
      sources.map(async (source) => {
        try {
          const out = await apiGet(paths[source.id] ?? source.endpoint);
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
  }, [sources, requestKey]);

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

  const filterOptionRows = useCallback(
    (filter: VaiFilterSpec) => {
      const source = VAI_SOURCE_MAP.get(filter.source);
      if (!source) return [];

      return applyFilters(
        source,
        data[filter.source]?.rows ?? [],
        spec.filters.filter((item) => filterKey(item) !== filterKey(filter)),
        effectiveFilters,
      );
    },
    [data, spec.filters, effectiveFilters],
  );

  const loading = sources.some((source) => data[source.id]?.loading ?? true);
  const exportContext = spec.filters.map((filter) => {
    const value =
      effectiveFilters[filterKey(filter)] ?? {};

    if (filter.kind === "date_range") {
      return `${filter.label}: ${value.from || "Sin límite"} a ${value.to || "Sin límite"}`;
    }

    const selected =
      value.values ??
      (
        value.value
          ? [value.value]
          : undefined
      );

    return `${filter.label}: ${
      selected === undefined
        ? "Todos"
        : selected.length
          ? selected.join(", ")
          : "Ninguno"
    }`;
  });
  const kpis = spec.widgets.filter((widget) => widget.type === "kpi");
  const others = spec.widgets.filter((widget) => widget.type !== "kpi");

  const widgetSpan = (index: number) => {
    const widget = others[index];
    if (!widget || ["table", "combo", "heatmap", "waterfall", "pareto"].includes(widget.type)) return "2";

    let runStart = index;
    while (runStart > 0 && !["table", "combo", "heatmap", "waterfall", "pareto"].includes(others[runStart - 1]?.type)) runStart -= 1;

    let runEnd = index;
    while (runEnd + 1 < others.length && !["table", "combo", "heatmap", "waterfall", "pareto"].includes(others[runEnd + 1]?.type)) runEnd += 1;

    const runLength = runEnd - runStart + 1;
    return index === runEnd && runLength % 2 === 1 ? "2" : "1";
  };

  const hasFilters = spec.filters.some((filter) => {
    const key = filterKey(filter);
    const value = filters[key];

    if (!value) return false;

    if (filter.kind === "select") {
      return (
        value.values !== undefined ||
        Boolean(value.value)
      );
    }

    const defaults = defaultFilters[key] ?? {};

    return (
      (value.from ?? defaults.from ?? "") !== (defaults.from ?? "") ||
      (value.to ?? defaults.to ?? "") !== (defaults.to ?? "")
    );
  });

  return (
    <div className="vai-board">
      <VaiExportProvider title={spec.title} context={exportContext} disabled={loading || sources.some((source) => Boolean(data[source.id]?.error))}>
      {spec.description ? <p className="muted" style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", overflow: "visible", textOverflow: "clip", maxHeight: "none" }}>{spec.description}</p> : null}

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
                rows={filterOptionRows(filter)}
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
            <KpiCard
              key={`${widget.source}-${widget.metrics[0]}-${i}`}
              id={`kpi-${i}`}
              order={i}
              widget={widget}
              rows={filtered[widget.source] ?? []}
              loading={loading}
              trendDateField={spec.filters.find((filter): filter is Extract<VaiFilterSpec, { kind: "date_range" }> => filter.kind === "date_range" && filter.source === widget.source)?.field ?? null}
            />
          ))}
        </div>
      ) : null}

      {others.length ? (
        <div className="vai-widget-grid" style={{ alignItems: "stretch" }}>
          {others.map((widget, i) => (
            <div
              key={`${widget.type}-${widget.source}-${i}`}
              data-span={widgetSpan(i)}
              style={{ minWidth: 0, height: "100%", gridColumn: widgetSpan(i) === "2" ? "1 / -1" : undefined }}
            >
              <Widget id={`widget-${i}`} order={kpis.length + i} widget={widget} rows={filtered[widget.source] ?? []} />
            </div>
          ))}
        </div>
      ) : null}
      </VaiExportProvider>
    </div>
  );
}

function FilterControl({
  filter,
  rows,
  value,
  onChange,
}: {
  filter: VaiFilterSpec;
  rows: VaiRow[];
  value: {
    from?: string;
    to?: string;
    value?: string;
    values?: string[];
  };
  onChange: (value: {
    from?: string;
    to?: string;
    value?: string;
    values?: string[];
  }) => void;
}) {
  const options = useMemo(
    () =>
      filter.kind === "select"
        ? distinctValues(
            rows,
            filter.field,
          )
        : [],
    [filter, rows],
  );

  const sourceName =
    VAI_SOURCE_MAP.get(filter.source)
      ?.name ??
    filter.source;

  const selectRootRef =
    useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    if (filter.kind !== "select") return;

    const closeOnOutside = (event: PointerEvent) => {
      const root = selectRootRef.current;
      const target = event.target as Node | null;

      if (
        !root ||
        !target ||
        root.contains(target)
      ) {
        return;
      }

      root.open = false;
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        selectRootRef.current
      ) {
        selectRootRef.current.open = false;
      }
    };

    document.addEventListener(
      "pointerdown",
      closeOnOutside,
    );

    document.addEventListener(
      "keydown",
      closeOnEscape,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        closeOnOutside,
      );

      document.removeEventListener(
        "keydown",
        closeOnEscape,
      );
    };
  }, [filter.kind]);

  if (filter.kind === "date_range") {
    return (
      <label title={sourceName}>
        <span>{filter.label}</span>

        <div className="vai-range">
          <input
            className="input"
            type="date"
            value={value.from ?? ""}
            max={value.to || undefined}
            onChange={(e) =>
              onChange({
                ...value,
                from: e.target.value,
              })
            }
          />

          <input
            className="input"
            type="date"
            value={value.to ?? ""}
            min={value.from || undefined}
            onChange={(e) =>
              onChange({
                ...value,
                to: e.target.value,
              })
            }
          />
        </div>
      </label>
    );
  }

  const selected =
    value.values ??
    (
      value.value
        ? [value.value]
        : undefined
    );

  const allSelected =
    selected === undefined;

  const selectedSet =
    new Set(selected ?? []);

  const selectedLabel =
    allSelected
      ? "Todos"
      : selectedSet.size === 0
        ? "Ninguno"
        : selectedSet.size === 1
          ? [...selectedSet][0]
          : `${selectedSet.size} seleccionados`;

  const toggleOption = (
    option: string,
  ) => {
    const next = allSelected
      ? options.filter(
          (item) => item !== option,
        )
      : selectedSet.has(option)
        ? [...selectedSet].filter(
            (item) => item !== option,
          )
        : [...selectedSet, option];

    if (
      options.length > 0 &&
      next.length === options.length
    ) {
      onChange({});
      return;
    }

    onChange({
      values: next,
    });
  };

  return (
    <label title={sourceName}>
      <span>{filter.label}</span>

      <details
        ref={selectRootRef}
        style={{
          position: "relative",
          minWidth: 0,
        }}
      >
        <summary
          className="select"
          style={{
            listStyle: "none",
            cursor: "pointer",
            userSelect: "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selectedLabel}
        </summary>

        <div
          style={{
            position: "absolute",
            zIndex: 500,
            top: "calc(100% + 5px)",
            left: 0,
            width: "max(100%, 240px)",
            maxWidth: 360,
            maxHeight: 300,
            overflow: "auto",
            padding: 8,
            display: "grid",
            gap: 3,
            background:
              "var(--s-1, #071a24)",
            border:
              "1px solid var(--line, rgba(255,255,255,.16))",
            borderRadius: 8,
            boxShadow:
              "0 14px 34px rgba(0,0,0,.35)",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 7px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() =>
                onChange({})
              }
            />

            Seleccionar todos
          </label>

          <div
            style={{
              height: 1,
              background:
                "var(--line, rgba(255,255,255,.12))",
              margin: "2px 0 4px",
            }}
          />

          {options.map((option) => (
            <label
              key={option}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 7px",
                cursor: "pointer",
                minWidth: 0,
              }}
            >
              <input
                type="checkbox"
                checked={
                  allSelected ||
                  selectedSet.has(option)
                }
                onChange={() =>
                  toggleOption(option)
                }
              />

              <span
                style={{
                  overflow: "hidden",
                  textOverflow:
                    "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={option}
              >
                {option}
              </span>
            </label>
          ))}
        </div>
      </details>
    </label>
  );
}

function KpiCard({ id, order, widget, rows, loading, trendDateField }: { id: string; order: number; widget: VaiWidgetSpec; rows: VaiRow[]; loading: boolean; trendDateField: string | null }) {
  const source = VAI_SOURCE_MAP.get(widget.source);
  const result = useMemo(() => (source ? computeWidget(widget, source, rows, { trendDateField }) : null), [widget, source, rows, trendDateField]);
  if (!result || result.kind !== "kpi") return null;
  const waiting = loading && !rows.length;
  return (
    <VaiExportSection id={id} order={order} title={widget.title} kind="kpi">
    <div className="vai-kpi" data-tip="true">
      <span>{widget.title}</span>
      <strong>{waiting ? "…" : formatValue(result.value, result.metric.format)}</strong>
      <small>
        {result.metric.label} · {rows.length.toLocaleString("es-PE")} filas · {source?.name}
      </small>
      <KpiTooltip
        label={widget.title}
        notes={result.notes}
        trend={result.trend}
        loading={waiting}
        footer={source?.metrics.find((metric) => metric.id === result.metric.id)?.description}
      />
    </div>
    </VaiExportSection>
  );
}

const BUCKET_LABEL: Record<NonNullable<VaiWidgetSpec["bucket"]>, string> = { day: "día", week: "semana", month: "mes", quarter: "trimestre", year: "año" };

function Widget({ id, order, widget, rows }: { id: string; order: number; widget: VaiWidgetSpec; rows: VaiRow[] }) {
  const [scaleChoice, setScaleChoice] = useState<"auto" | ChartScaleMode>("auto");
  const source = VAI_SOURCE_MAP.get(widget.source);
  const result = useMemo(() => source ? computeWidget(widget, source, rows) : null, [widget, source, rows]);
  if (!source || !result) return <section className="trjk-card" role="alert">No se pudo resolver la fuente de este gráfico.</section>;
  if (result.kind === "unavailable") return <section className="trjk-card" role="status"><h3>{widget.title}</h3><p className="muted">{result.message}</p></section>;
  const lineLike = widget.type === "line" || widget.type === "area";
  const temporalAxis = Boolean(widget.dateField) && (lineLike || !widget.dimension);
  const axisLabel = temporalAxis
    ? `por ${BUCKET_LABEL[widget.bucket ?? "month"]} de ${vaiField(source, widget.dateField ?? "")?.label ?? widget.dateField}`
    : widget.dimension
      ? `por ${vaiField(source, widget.dimension)?.label ?? widget.dimension}`
      : "";
  const extras = [
    result.kind === "series" && result.breakdown ? `una serie por ${result.breakdown.toLowerCase()}` : "",
    result.kind === "series" && result.stack === "percent" ? "apilado al 100 %" : result.kind === "series" && result.stack ? "apilado" : "",
    result.kind === "series" && result.cumulative ? "acumulado" : "",
  ].filter(Boolean);
  const subtitle = [source.name, axisLabel, ...extras].filter(Boolean).join(" · ");

  if (result.kind === "table") return <TableWidget id={id} order={order} title={widget.title} subtitle={subtitle} data={result} source={source} />;
  if (result.kind !== "series") return null;

  const first = result.series[0];
  const formats = result.series.map((item) => chartFormat(item.format));
  const primaryFormat = formats[0] ?? chartFormat("decimal");
  const baseRender = lineLike ? "line" : "bar";
  const unitGroups = [...new Set(result.series.map((item) => chartAxisGroup(item.format)))];
  const explicitByUnit = new Map<string, "left" | "right">();
  result.series.forEach((item, j) => {
    const side = widget.seriesAxes?.[j];
    if (side && !result.breakdown) explicitByUnit.set(chartAxisGroup(item.format), side);
  });
  const firstSide = explicitByUnit.get(unitGroups[0]) ?? (explicitByUnit.get(unitGroups[1]) === "left" ? "right" : "left");
  const series: ChartSeries[] = result.series.map((item, j) => ({
    label: item.label,
    color: item.other ? CHART_OTHER : CHART_COLORS[j % CHART_COLORS.length],
    digits: formats[j].digits,
    unit: formats[j].unit,
    axisKey: chartAxisGroup(item.format),
    seriesType: widget.type === "pareto" ? (j === 0 ? "bar" : "line") : result.breakdown ? baseRender : widget.seriesTypes?.[j] ?? baseRender,
    axisSide: widget.type === "pareto" ? (j === 0 ? "left" : "right") : (!result.breakdown ? widget.seriesAxes?.[j] : null) ?? (unitGroups.length === 1 && widget.seriesAxes?.some(Boolean) ? "left" : undefined) ?? explicitByUnit.get(chartAxisGroup(item.format)) ?? (chartAxisGroup(item.format) === unitGroups[0] ? firstSide : firstSide === "left" ? "right" : "left"),
    axisRange: widget.type === "pareto" && j === 1 ? [0, 100] : undefined,
  }));
  const chartRows: ChartRow[] = result.rows.map((row) => ({
    key: row.key,
    label: row.label,
    values: row.values.map((v, j) => (v == null ? null : v * formats[j].scale)),
    notes: row.notes,
  }));

  const values = chartRows.flatMap((row) => widget.type === "rank" ? [row.values[0]] : row.values);
  const logAllowed = canUseLogScale(values) && !result.stack && unitGroups.length === 1 && widget.type !== "pareto";
  const scale: ChartScaleMode = logAllowed && (scaleChoice === "log" || (scaleChoice === "auto" && prefersLogScale(values))) ? "log" : "linear";
  const hasBarSeries = series.some((item) => item.seriesType !== "line");
  const hasLineSeries = series.some((item) => item.seriesType === "line");
  // Barras y líneas juntas se dibujan en el mismo plano, sea el eje X categórico o temporal.
  const isCombo = widget.type === "pareto" || (["bar", "combo", "line", "area"].includes(widget.type) && hasBarSeries && hasLineSeries);
  const comboScale: ChartScaleMode = logAllowed && scaleChoice === "log" ? "log" : "linear";
  const controls = widget.type === "rank" || ((widget.type === "bar" || widget.type === "combo" || lineLike) && hasBarSeries && !result.stack) ? (
    <label
      className="vai-scale-control"
      style={{ display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap", minWidth: 0 }}
      title={!logAllowed ? "La escala logarítmica requiere valores positivos; los ceros y negativos se muestran en escala lineal." : undefined}
    >
      <span>Escala</span>
      <select
        className="select"
        aria-label={`Escala de ${widget.title}`}
        value={scaleChoice}
        onChange={(event) => setScaleChoice(event.target.value as "auto" | ChartScaleMode)}
        style={{ width: 128, minWidth: 128, maxWidth: 128 }}
      >
        <option value="auto">Automática</option>
        <option value="linear">Lineal</option>
        <option value="log" disabled={!logAllowed}>Logarítmica</option>
      </select>
    </label>
  ) : null;
  const detailTable = widgetDetailTable(
    widget,
    source,
    result.table,
  );

  const dataTable = (
    <div
      style={{
        display: "grid",
        gap: 18,
      }}
    >
      <TableWidget
        title={`Resumen exacto de ${widget.title}`}
        subtitle={`${subtitle} · valores agregados que alimentan directamente el gráfico`}
        data={result.table}
        source={source}
        compact
      />

      {detailTable ? (
        <TableWidget
          title="Detalle de respaldo"
          subtitle={`${source.grain} · filas originales utilizadas en los grupos visibles del gráfico`}
          data={detailTable}
          source={source}
          compact
        />
      ) : null}
    </div>
  );

  const wrap = (chart: ReactNode) => <VaiExportSection id={id} order={order} title={widget.title} kind="chart" table={{ data: result.table, rows: result.table.rows }}>
    {chart}
    {result.notices?.length ? <p className="muted" style={{ fontSize: 11, margin: "7px 2px 0", whiteSpace: "normal", overflowWrap: "anywhere", lineHeight: 1.5 }}>{result.notices.join(" · ")}</p> : null}
  </VaiExportSection>;
  // Mantener cada categoría y etiquetas legibles; nunca sustituirlas por «Otros» para que quepan.
  const minCategoryWidth = !result.temporal ? (widget.type === "histogram" ? 65 : chartRows.reduce((max, row) => Math.max(max, Math.min(148, Math.min(20, row.label.length) * 6.2 + 16)), 86)) : 0;
  const chartHeight = widget.type === "combo" || widget.type === "pareto" ? 340 : 290;
  if (widget.type === "heatmap") return wrap(<HeatmapChart title={widget.title} subtitle={subtitle} rows={chartRows} series={series} dataTable={dataTable} />);
  if (widget.type === "waterfall") return wrap(<WaterfallChart title={widget.title} subtitle={subtitle} rows={chartRows} digits={primaryFormat.digits} unit={primaryFormat.unit} dataTable={dataTable} />);
  if (widget.type === "histogram") return wrap(<ColumnChart title={widget.title} subtitle={subtitle} rows={chartRows} series={series.map((s) => ({ ...s, unit: " registros" }))} digits={0} unit=" registros" intervals minCategoryWidth={65} height={chartHeight} dataTable={dataTable} />);
  if (widget.type === "scatter" && result.series.length >= 2) {
    const [xSeries, ySeries] = result.series;
    return wrap(
      <ScatterChart
        title={widget.title}
        subtitle={subtitle}
        points={chartRows.flatMap((row) => (row.values[0] == null || row.values[1] == null ? [] : [{ label: row.label, x: row.values[0], y: row.values[1], notes: row.notes }]))}
        xLabel={xSeries.label}
        yLabel={ySeries.label}
        xDigits={formats[0].digits}
        xUnit={formats[0].unit}
        yDigits={formats[1].digits}
        yUnit={formats[1].unit}
        controls={controls}
        dataTable={dataTable}
      />,
    );
  }
  if (isCombo) return wrap(<ComboChart title={widget.title} subtitle={subtitle} rows={chartRows} series={series} digits={primaryFormat.digits} unit={primaryFormat.unit} scale={widget.type === "pareto" ? "linear" : comboScale} minCategoryWidth={minCategoryWidth} height={chartHeight} controls={controls} dataTable={dataTable} />);
  if (lineLike || (widget.type === "combo" && !hasBarSeries)) {
    return wrap(<LineChart title={widget.title} subtitle={subtitle} rows={chartRows} series={series} digits={primaryFormat.digits} unit={primaryFormat.unit} area={widget.type === "area" ? "all" : false} minCategoryWidth={minCategoryWidth} height={chartHeight} dataTable={dataTable} />);
  }
  if (widget.type === "bar" || widget.type === "combo") {
    return wrap(<ColumnChart title={widget.title} subtitle={subtitle} rows={chartRows} series={series} digits={primaryFormat.digits} unit={primaryFormat.unit} scale={scale} minCategoryWidth={minCategoryWidth} height={chartHeight} stacked={result.stack === "percent" ? "percent" : result.stack === "stack" ? "stack" : false} controls={controls} dataTable={dataTable} />);
  }
  if (widget.type === "rank") {
    return wrap(
      <RankChart
        title={widget.title}
        subtitle={subtitle}
        rows={result.rows.filter((row) => row.values[0] != null).map((row) => ({ label: row.label, value: row.values[0]! * primaryFormat.scale, note: result.series[1] ? `${result.series[1].label}: ${formatValue(row.values[1], result.series[1].format)}` : undefined, notes: row.notes }))}
        digits={primaryFormat.digits}
        unit={primaryFormat.unit}
        scale={scale}
        controls={controls}
        dataTable={dataTable}
      />
    );
  }
  if (widget.type === "donut") return wrap(
    <DonutChart
      title={widget.title}
      subtitle={subtitle}
      centerLabel={first?.label ?? ""}
      items={result.rows.filter((row) => row.values[0] != null).map((row, i) => ({
        label: row.label,
        value: row.values[0]! * primaryFormat.scale,
        color: row.key === "__vai_other__" ? CHART_OTHER : CHART_COLORS[i % CHART_COLORS.length],
        notes: row.notes,
      }))}
      digits={primaryFormat.digits}
      unit={primaryFormat.unit}
      dataTable={dataTable}
    />
  );
  return <section className="trjk-card" role="alert"><h3>{widget.title}</h3><p>No hay un renderer válido para «{widget.type}». No se reemplazó por otro tipo de gráfico.</p></section>;
}

function SourceHint({
  source,
  columnId,
  columnLabel,
}: {
  source: VaiSource;
  columnId: string;
  columnLabel: string;
}) {
  const ref =
    useRef<HTMLButtonElement>(null);

  const [open, setOpen] =
    useState(false);

  const [position, setPosition] =
    useState({
      top: 0,
      left: 0,
    });

  const field =
    vaiField(
      source,
      columnId,
    );

  const metric =
    source.metrics.find(
      (item) =>
        item.id === columnId,
    );

  const description =
    field?.description ??
    metric?.description ??
    source.grain;

  const baseFields =
    metric
      ? [
          metric.field,
          metric.field2,
          metric.numerator,
          metric.denominator,
          metric.weight,
          metric.distinctField,
        ]
          .filter(
            (
              item,
            ): item is string =>
              Boolean(item),
          )
          .filter(
            (
              item,
              index,
              list,
            ) =>
              list.indexOf(item) ===
              index,
          )
      : [];

  const show = () => {
    const node = ref.current;

    if (!node) {
      return;
    }

    const rect =
      node.getBoundingClientRect();

    const tooltipWidth = 370;

    setPosition({
      top: Math.min(
        rect.bottom + 8,
        window.innerHeight - 190,
      ),
      left: Math.max(
        12,
        Math.min(
          rect.left,
          window.innerWidth -
            tooltipWidth -
            12,
        ),
      ),
    });

    setOpen(true);
  };

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={`Fuente de ${columnLabel}`}
        title={`GET ${source.endpoint}`}
        onMouseEnter={show}
        onMouseLeave={() =>
          setOpen(false)
        }
        onFocus={show}
        onBlur={() =>
          setOpen(false)
        }
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();

          if (open) {
            setOpen(false);
          } else {
            show();
          }
        }}
        style={{
          display: "inline-grid",
          placeItems: "center",
          width: 15,
          height: 15,
          padding: 0,
          flex: "0 0 15px",
          borderRadius: "50%",
          border:
            "1px solid currentColor",
          background:
            "transparent",
          color: "inherit",
          fontSize: 9,
          fontWeight: 800,
          lineHeight: 1,
          opacity: 0.55,
          cursor: "help",
        }}
      >
        ?
      </button>

      {open &&
      typeof document !==
        "undefined"
        ? createPortal(
            <div
              role="tooltip"
              style={{
                position:
                  "fixed",
                zIndex: 20000,
                top: position.top,
                left: position.left,
                width:
                  "min(370px, calc(100vw - 24px))",
                padding: 11,
                display:
                  "grid",
                gap: 5,
                pointerEvents:
                  "none",
                background:
                  "var(--s-1, #071a24)",
                color:
                  "var(--ink, #fff)",
                border:
                  "1px solid var(--line, rgba(255,255,255,.2))",
                borderRadius: 8,
                boxShadow:
                  "0 14px 34px rgba(0,0,0,.48)",
                fontSize: 11,
                fontWeight: 400,
                lineHeight: 1.4,
                whiteSpace:
                  "normal",
                textAlign:
                  "left",
              }}
            >
              <strong>
                {columnLabel}
              </strong>

              <span>
                Endpoint API:{" "}
                <code
                  style={{
                    fontSize: 10,
                    whiteSpace:
                      "pre-wrap",
                    overflowWrap:
                      "anywhere",
                  }}
                >
                  GET {source.endpoint}
                </code>
              </span>

              <span>
                Campo V-Ai:{" "}
                <code>
                  {columnId}
                </code>
              </span>

              {baseFields.length ? (
                <span>
                  Campo(s) base:{" "}
                  <code>
                    {baseFields.join(
                      ", ",
                    )}
                  </code>
                </span>
              ) : null}

              {source.sqlView ? (
                <span>
                  Fuente SQL:{" "}
                  <code>
                    {
                      source.sqlView
                    }
                  </code>
                </span>
              ) : null}

              {description ? (
                <span
                  style={{
                    color:
                      "var(--ink-2)",
                  }}
                >
                  {description}
                </span>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function TableWidget({ id, order, title, subtitle, data, source, compact = false }: { id?: string; order?: number; title: string; subtitle: string; data: Extract<VaiWidgetData, { kind: "table" }>; source?: VaiSource; compact?: boolean }) {
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
                {data.columns.map((column) => {
                  return (
                    <th
                      key={column.id}
                      data-num={
                        column.format !== "text" &&
                        column.format !== "date"
                      }
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            minWidth: 0,
                          }}
                        >
                          <span>
                            {column.label}
                          </span>

                          {source ? (
                            <SourceHint
                              source={source}
                              columnId={column.id}
                              columnLabel={column.label}
                            />
                          ) : null}
                        </span>

                        <ExcelHeaderFilter
                          {...excel.headerProps(
                            column.id,
                          )}
                        />
                      </div>
                    </th>
                  );
                })}
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
            <tfoot style={{ position: "sticky", bottom: 0, zIndex: 3 }}>
              <tr aria-label={`Resumen de ${excel.rows.length} filas filtradas`}>
                {data.columns.map((column, index) => {
                  const summary = summaries[index];
                  const hint = summary
                    ? `${column.label}: ${summary.label}. ${data.summaryRules[index]?.metric?.description ?? "Calculado sobre todas las filas filtradas."}`
                    : undefined;

                  return (
                    <td
                      key={column.id}
                      data-num={Boolean(summary)}
                      title={hint}
                      aria-label={summary ? `${hint} ${formatValue(summary.value, column.format)}` : undefined}
                      style={{
                        position: "sticky",
                        bottom: 0,
                        zIndex: 3,
                        padding: "12px 10px",
                        background: "linear-gradient(var(--s-2, transparent), var(--s-2, transparent)), var(--s-canvas, #ffffff)",
                        borderTop: "2px solid var(--brand-gold)",
                        boxShadow: "0 -4px 10px rgba(0, 0, 0, 0.12)",
                        color: "var(--ink)",
                        fontVariantNumeric: "tabular-nums",
                        verticalAlign: "middle",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {summary ? (
                        <strong style={{ display: "block", fontSize: 12, fontWeight: 700 }}>
                          {formatValue(summary.value, column.format)}
                        </strong>
                      ) : index === 0 ? (
                        <div style={{ display: "grid", gap: 3 }}>
                          <strong style={{ fontSize: 11, color: "var(--brand-gold)", letterSpacing: "0.04em" }}>
                            Resumen
                          </strong>
                          <span style={{ fontSize: 10, color: "var(--ink-2)" }}>
                            {excel.rows.length.toLocaleString("es-PE")} filas
                          </span>
                        </div>
                      ) : null}
                    </td>
                  );
                })}
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

// ── WORKSPACE ────────────────────────────────────────────────────────

//
// Orquestador de V-Ai: prompt → /api/vai/generate (única llamada a IA) →
// dashboard renderizado con datos reales → guardado automático → inventario.
// Abrir, filtrar, actualizar, renombrar y eliminar no consumen IA.

type GenerateResponse =
  | { ok: true; status: "ok" | "partial" | "unavailable"; message: string; unavailable: string[]; spec: VaiDashboardSpec | null; model?: string }
  | { ok: false; error: string };

type Board = {
  spec: VaiDashboardSpec;
  prompt: string;
  id: number | null;
  name: string;
  savedAt: string | null;
  message: string;
  notes: string[];
  saveError: string | null;
  model: string | null;
};

const STEPS = ["Validando la solicitud", "Identificando fuentes del catálogo", "Diseñando el dashboard con IA", "Validando la especificación", "Consultando datos reales"];

export default function VaiWorkspace() {
  const [items, setItems] = useState<VaiDashboardRecord[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [generating, setGenerating] = useState<{ step: number; prompt: string } | null>(null);
  const [failure, setFailure] = useState<{ message: string; unavailable: string[] } | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VaiDashboardRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [titleDraft, setTitleDraft] = useState("");
  const [lastRequest, setLastRequest] = useState<VaiPromptRequest | null>(null);
  const stepTimers = useRef<number[]>([]);

  const reloadInventory = useCallback(async () => {
    setInventoryLoading(true);
    setInventoryError(null);
    try {
      setItems(await listDashboards());
    } catch (error) {
      setInventoryError(error instanceof Error ? error.message : "No se pudo cargar el inventario");
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadInventory();
  }, [reloadInventory]);

  useEffect(() => () => stepTimers.current.forEach((timer) => window.clearTimeout(timer)), []);

  function scheduleSteps(prompt: string) {
    stepTimers.current.forEach((timer) => window.clearTimeout(timer));
    setGenerating({ step: 0, prompt });
    stepTimers.current = [900, 2200].map((delay, i) => window.setTimeout(() => setGenerating((prev) => (prev ? { ...prev, step: i + 1 } : prev)), delay));
  }

  async function generate(request: VaiPromptRequest) {
    setLastRequest(request);
    setFailure(null);
    setBoard(null);
    scheduleSteps(request.prompt);
    let response: GenerateResponse;
    try {
      const res = await fetch("/api/vai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(request),
      });
      response = (await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))) as GenerateResponse;
      if (res.status === 401) response = { ok: false, error: "Tu sesión de V-Ai expiró. Vuelve al portal e ingresa de nuevo." };
    } catch {
      response = { ok: false, error: "No se pudo contactar al servicio de generación." };
    }
    stepTimers.current.forEach((timer) => window.clearTimeout(timer));

    if (!response.ok) {
      setGenerating(null);
      setFailure({ message: response.error, unavailable: [] });
      return;
    }
    if (!response.spec) {
      setGenerating(null);
      setFailure({
        message: response.message || "Actualmente no existe información disponible en V-Ai para construir ese dashboard.",
        unavailable: response.unavailable,
      });
      return;
    }

    const checked = parseStoredSpec(response.spec, request.prompt);
    if (!checked.spec) {
      setGenerating(null);
      setFailure({ message: "La definición recibida no cumple el gráfico solicitado. No se guardó una versión distinta.", unavailable: checked.notes });
      return;
    }
    setGenerating({ step: 4, prompt: request.prompt });
    const next: Board = {
      spec: checked.spec,
      prompt: request.prompt,
      id: null,
      name: response.spec.title,
      savedAt: null,
      message: response.status === "partial" ? response.message : "",
      notes: [...new Set([...response.unavailable, ...checked.notes])],
      saveError: null,
      model: response.model ?? null,
    };
    // Guardado automático de la definición; los datos se consultan al abrir.
    try {
      const id = await saveDashboard({ name: next.name, description: next.spec.description, prompt: next.prompt, spec: next.spec, model: next.model });
      next.id = Number.isFinite(id) ? id : null;
      next.savedAt = new Date().toISOString();
    } catch (error) {
      next.saveError = error instanceof Error ? error.message : "No se pudo guardar el dashboard";
    }
    setGenerating(null);
    setTitleDraft(next.name);
    setBoard(next);
    setRefreshToken((token) => token + 1);
    void reloadInventory();
  }

  async function open(item: VaiDashboardRecord) {
    setFailure(null);
    setOpening(item.dashboard_id);
    try {
      const detail = await getDashboard(item.dashboard_id);
      if (!detail) throw new Error("El dashboard ya no existe.");
      let raw: unknown = null;
      try {
        raw = JSON.parse(detail.spec_json);
      } catch {
        raw = null;
      }
      const { spec, notes } = parseStoredSpec(raw, detail.prompt_text);
      if (!spec) {
        setFailure({ message: `«${detail.dashboard_name}» ya no puede reconstruirse con el catálogo actual.`, unavailable: notes });
        setBoard(null);
        return;
      }
      setTitleDraft(detail.dashboard_name);
      setBoard({
        spec: { ...spec, title: detail.dashboard_name },
        prompt: detail.prompt_text,
        id: detail.dashboard_id,
        name: detail.dashboard_name,
        savedAt: detail.updated_at || detail.created_at,
        message: "",
        notes,
        saveError: null,
        model: detail.model_name ?? null,
      });
      setRefreshToken((token) => token + 1);
    } catch (error) {
      setFailure({ message: error instanceof Error ? error.message : "No se pudo abrir el dashboard", unavailable: [] });
    } finally {
      setOpening(null);
    }
  }

  async function persist(current: Board, name: string) {
    try {
      const id = await saveDashboard({ dashboard_id: current.id, name, description: current.spec.description, prompt: current.prompt, spec: current.spec, model: current.model });
      setBoard((prev) => (prev ? { ...prev, id: Number.isFinite(id) ? id : prev.id, name, spec: { ...prev.spec, title: name }, savedAt: new Date().toISOString(), saveError: null } : prev));
      void reloadInventory();
    } catch (error) {
      setBoard((prev) => (prev ? { ...prev, saveError: error instanceof Error ? error.message : "No se pudo guardar" } : prev));
    }
  }

  function commitTitle() {
    if (!board) return;
    const name = titleDraft.trim().slice(0, 150);
    if (!name) {
      setTitleDraft(board.name);
      return;
    }
    if (name !== board.name || !board.id) void persist(board, name);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteDashboard(pendingDelete.dashboard_id);
      if (board?.id === pendingDelete.dashboard_id) setBoard(null);
      setPendingDelete(null);
      void reloadInventory();
    } catch (error) {
      setInventoryError(error instanceof Error ? error.message : "No se pudo eliminar");
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  const deleteModal =
    pendingDelete && typeof document !== "undefined"
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="vai-delete-title"
            style={{ position: "fixed", inset: 0, zIndex: 12000, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, background: "rgba(0,0,0,.68)" }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !deleting) setPendingDelete(null);
            }}
          >
            <section className="panel-inner" style={{ width: "min(440px, 96vw)", padding: 18, display: "grid", gap: 12, background: "#071a24", borderColor: "rgba(147,211,230,.34)" }}>
              <h2 id="vai-delete-title" style={{ margin: 0, fontSize: 18 }}>Eliminar dashboard</h2>
              <p style={{ margin: 0 }}>
                Se eliminará la configuración de «{pendingDelete.dashboard_name}». Los datos de las fuentes no se modifican.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={deleting}>
                  Cancelar
                </Button>
                <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
                  {deleting ? "Eliminando…" : "Eliminar"}
                </Button>
              </div>
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="vai-shell">
      <div className="vai-main">
        {failure ? (
          <section className="trjk-card" style={{ display: "grid", gap: 10 }}>
            <div className="vai-message" data-error="true">{failure.message}</div>
            {failure.unavailable.length ? (
              <div className="vai-notes">
                <strong>No disponible en V-Ai:</strong>
                <ul>
                  {failure.unavailable.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div>
              <Button variant="ghost" size="sm" onClick={() => setFailure(null)}>
                Cerrar
              </Button>
            </div>
          </section>
        ) : null}

        {!board && !generating ? <VaiPromptForm busy={opening != null} initial={lastRequest} onGenerate={generate} /> : null}

        {generating ? (
          <section className="trjk-card vai-progress" aria-live="polite">
            <h3>Generando dashboard</h3>
            <p className="muted" style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>«{generating.prompt}»</p>
            <div className="vai-bar">
              <span />
            </div>
            <ol>
              {STEPS.map((label, i) => (
                <li key={label} data-state={i < generating.step ? "done" : i === generating.step ? "active" : "pending"}>
                  {label}
                </li>
              ))}
            </ol>
            <p className="muted" style={{ margin: 0, fontSize: 11 }}>OpenAI recibe solo el catálogo de metadatos; los datos reales se consultan después desde nuestros endpoints.</p>
          </section>
        ) : null}

        {board ? (
          <section className="trjk-card" style={{ display: "grid", gap: 12 }}>
            <div className="vai-board-head" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
              <div style={{ display: "grid", gap: 4, minWidth: 0, flex: 1 }}>
                <input
                  className="input vai-title"
                  value={titleDraft}
                  maxLength={150}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setTitleDraft(board.name);
                  }}
                  aria-label="Nombre del dashboard"
                  title="Editar nombre; se guarda al salir del campo"
                />
                <div className="vai-board-meta" style={{ whiteSpace: "normal", overflowWrap: "anywhere", overflow: "visible", textOverflow: "clip" }}>
                  {board.id ? `Guardado · ${formatStamp(board.savedAt)}` : "Sin guardar"}
                  {board.saveError ? <span style={{ color: "var(--bad)" }}> · {board.saveError}</span> : null}
                </div>
                <p className="vai-board-prompt" style={{ display: "block", whiteSpace: "pre-wrap", overflowWrap: "anywhere", overflow: "visible", textOverflow: "clip", WebkitLineClamp: "unset", maxHeight: "none", height: "auto", margin: "4px 0 0", lineHeight: 1.6 }}>

                  <span style={{ marginRight: 8 }}>Prompt:</span>
                  {board.prompt}
                </p>
              </div>
              <div className="trjk-actions">
                {board.saveError ? (
                  <Button size="sm" variant="primary" onClick={() => void persist(board, board.name)}>
                    Reintentar guardado
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => setRefreshToken((token) => token + 1)}>
                  Actualizar datos
                </Button>
                <Button size="sm" variant="default" onClick={() => setBoard(null)}>
                  Nuevo dashboard
                </Button>
              </div>
            </div>

            {board.message ? <div className="vai-message">{board.message}</div> : null}
            {board.notes.length ? (
              <div className="vai-notes">
                <strong>Observaciones de la definición:</strong>
                <ul>
                  {board.notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <VaiDashboard spec={board.spec} refreshToken={refreshToken} />
          </section>
        ) : null}
      </div>

      <aside className="vai-side">
        <VaiInventory
          items={items}
          loading={inventoryLoading || opening != null}
          error={inventoryError}
          currentId={board?.id ?? null}
          onOpen={(item) => void open(item)}
          onDelete={setPendingDelete}
          onNew={() => {
            setBoard(null);
            setFailure(null);
          }}
          onReload={() => void reloadInventory()}
        />
        <section className="trjk-card" style={{ fontSize: 11, color: "var(--ink-2)", display: "grid", gap: 6 }}>
          <h3 style={{ color: "var(--ink)" }}>Cómo funciona</h3>
          <p style={{ margin: 0 }}>La IA solo recibe el catálogo de fuentes (nombres de campos, métricas y reglas), nunca registros, montos ni nombres reales.</p>
          <p style={{ margin: 0 }}>Los datos se consultan desde los endpoints existentes al abrir cada dashboard; los filtros no usan IA.</p>
        </section>
      </aside>

      {deleteModal}
    </div>
  );
}

