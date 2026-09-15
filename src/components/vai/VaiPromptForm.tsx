// src/components/vai/VaiPromptForm.tsx
//
// Portada de V-Ai: la marca con anillo neón, un composer tipo chat con el
// prompt en lenguaje natural, las preferencias colapsadas justo debajo y
// ejemplos para empezar. Ctrl+Enter o el botón circular generan.
"use client";

import { useMemo, useState } from "react";
import { Select } from "../ui/Select";
import { VAI_AREAS, VAI_SOURCES, type VaiArea, type VaiSource } from "../../lib/vai/catalog";
import { VAI_PROMPT_MAX } from "../../lib/vai/spec";
import type { VaiChartPreference, VaiFocus } from "../../lib/vai/generate";
import VaiLogo from "./VaiLogo";

export type VaiPromptRequest = { prompt: string; area: VaiArea | "auto"; focus: VaiFocus; charts: VaiChartPreference[] };

const FOCUS_OPTIONS: Array<{ value: VaiFocus; label: string }> = [
  { value: "auto", label: "Automático" },
  { value: "kpis", label: "KPIs y resumen" },
  { value: "trends", label: "Tendencias" },
  { value: "comparisons", label: "Comparaciones" },
  { value: "detail", label: "Detalle / tablas" },
];

const CHART_OPTIONS: Array<{ value: VaiChartPreference; label: string }> = [
  { value: "line", label: "Línea" },
  { value: "bar", label: "Barras" },
  { value: "kpi", label: "KPI" },
  { value: "table", label: "Tabla" },
];

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

  const suggestions: string[] = [];

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

export default function VaiPromptForm({ busy, initial, onGenerate }: { busy: boolean; /** Última solicitud, para no perder el texto si la generación falla. */ initial?: VaiPromptRequest | null; onGenerate: (request: VaiPromptRequest) => void }) {
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

      <div className="vai-brand" role="img" aria-label="V-Ai">
        <div className="vai-brand-body">
          <VaiLogo size={52} />
          <span className="vai-brand-word" aria-hidden="true">
            V-<em>Ai</em>
          </span>
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
