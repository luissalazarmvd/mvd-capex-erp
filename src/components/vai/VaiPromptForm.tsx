// src/components/vai/VaiPromptForm.tsx
//
// Portada de V-Ai: la marca con anillo neón, un composer tipo chat con el
// prompt en lenguaje natural, las preferencias colapsadas justo debajo y
// ejemplos para empezar. Ctrl+Enter o el botón circular generan.
"use client";

import { useState } from "react";
import { Select } from "../ui/Select";
import { VAI_AREAS, type VaiArea } from "../../lib/vai/catalog";
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

const EXAMPLES = [
  "TMH enviadas por transportista, su evolución mensual, total enviado y guías pendientes de facturación.",
  "Tonelaje y ley de oro promedio de los lotes ingresados por concesión y por mes, con los lotes sin factura.",
  "Recuperación de oro y TMS tratadas por guardia en los últimos meses, con horas de parada.",
  "Saldo en libros de activos fijos por área y tipo de activo, con depreciación mensual en PEN.",
];

export default function VaiPromptForm({ busy, initial, onGenerate }: { busy: boolean; /** Última solicitud, para no perder el texto si la generación falla. */ initial?: VaiPromptRequest | null; onGenerate: (request: VaiPromptRequest) => void }) {
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [area, setArea] = useState<VaiArea | "auto">(initial?.area ?? "auto");
  const [focus, setFocus] = useState<VaiFocus>(initial?.focus ?? "auto");
  const [charts, setCharts] = useState<VaiChartPreference[]>(initial?.charts ?? []);

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
          placeholder="Quiero ver las TMH enviadas por transportista, su evolución mensual, total enviado y guías pendientes de facturación."
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
        <div className="vd-label">Ideas para empezar</div>
        {EXAMPLES.map((example) => (
          <button key={example} type="button" onClick={() => setPrompt(example)} disabled={busy}>
            {example}
          </button>
        ))}
      </div>
    </section>
  );
}
