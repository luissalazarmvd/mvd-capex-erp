// src/app/ti/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/src/lib/apiClient";

const ANALYSIS_START = new Date(2026, 0, 1);
const CUT = {
  cdm: new Date(2026, 6, 20),
  fin: new Date(2026, 3, 1),
  fcs: new Date(2026, 0, 19),
  log: new Date(2026, 4, 11),
  ro: new Date(2026, 3, 1),
};

type Lang = "en" | "fr";

function tr(lang: Lang, en: string, fr: string) {
  return lang === "fr" ? fr : en;
}

type EntriesRow = {
  entryDate: Date | null;
  entryDatetime: Date | null;
  uploadDatetime: Date | null;
  lot: string;
  miner: string;
  department: string;
  delaySeconds: number;
};

type FinanceRow = {
  lot: string;
  entryDate: Date | null;
  valuationDate: Date | null;
  docDate: Date | null;
  hasAu: boolean;
  hasDoc: boolean;
};

type FcsRow = { lot: string; entryDate: Date | null };
type LogisticsRow = { reqDate: Date | null; responsible: string };
type MlRow = {
  campaignId: string;
  campaignDate: Date | null;
  actualCost: number;
  modelCost: number;
};

type MonthlyRow = {
  month: string;
  period: string;
  workload: string;
  beforeMh: number;
  beforeUsd: number;
  currentMh: number | null;
  currentUsd: number | null;
  savedMh: number | null;
  savedUsd: number | null;
  segment: "before" | "current";
  fullSegment: boolean;
};

type ChartPoint = {
  month: string;
  legacy: number;
  current: number | null;
  volume?: number;
};

type ProjectResult = {
  avgBefore: number;
  avgCurrent: number;
  avgSaved: number;
  avgUsd: number;
  optimization: number;
  totalSaved: number;
  totalUsd: number;
  rows: MonthlyRow[];
  chart: ChartPoint[];
  extraLabel: string;
  extraValue: string;
  extraSub: string;
};

type PortfolioMetric = Pick<
  ProjectResult,
  "avgSaved" | "avgUsd" | "optimization" | "totalSaved" | "totalUsd"
>;

type ProjectKey = "cdm" | "fin" | "fcs" | "log" | "ro";

function has(value: unknown) {
  return (
    value !== null &&
    value !== undefined &&
    String(value).trim() !== "" &&
    String(value).trim().toUpperCase() !== "NULL"
  );
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function toDate(value: unknown): Date | null {
  if (!has(value)) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  const match = raw.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.\d+)?)?)?/
  );
  if (match && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4] || 0),
      Number(match[5] || 0),
      Number(match[6] || 0)
    );
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateKey(date: Date | null) {
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(key: string) {
  const [year, month] = key.split("-").map(Number);
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 0, 23, 59, 59, 999),
  };
}

function monthsFrom(start: Date, end: Date) {
  const months: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    months.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function inputDate(value: string, endOfDay = false) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
}

function latestDate(dates: Array<Date | null>) {
  const valid = dates.filter((date): date is Date => Boolean(date));
  return valid.length ? new Date(Math.max(...valid.map((date) => date.getTime()))) : null;
}

function inPeriod(date: Date | null, start: Date, end: Date) {
  return Boolean(date && date >= start && date <= end);
}

function mean(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : Number.NaN;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function quantile(values: number[], q: number) {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  return sorted[base + 1] === undefined
    ? sorted[base]
    : sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

function averageRun(rows: MonthlyRow[], key: "beforeMh" | "currentMh" | "savedMh", segment: "before" | "current") {
  let selected = rows.filter(
    (row) => row.segment === segment && row.fullSegment && Number.isFinite(row[key])
  );
  if (!selected.length) {
    selected = rows.filter((row) => row.segment === segment && Number.isFinite(row[key]));
  }
  return mean(selected.map((row) => Number(row[key])));
}

function weightedOptimization(rows: MonthlyRow[]) {
  const current = rows.filter(
    (row) => row.segment === "current" && Number.isFinite(row.beforeMh) && Number.isFinite(row.currentMh)
  );
  const before = sum(current.map((row) => row.beforeMh));
  const now = sum(current.map((row) => Number(row.currentMh)));
  return before > 0 ? ((before - now) / before) * 100 : Number.NaN;
}

function overlapDays(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  const start = new Date(Math.max(aStart.getTime(), bStart.getTime()));
  const end = new Date(Math.min(aEnd.getTime(), bEnd.getTime()));
  return end < start ? 0 : Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function money(value: number, decimals = 0) {
  return Number.isFinite(value)
    ? new Intl.NumberFormat("es-PE", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value)
    : "—";
}

function number(value: number, decimals = 0) {
  return Number.isFinite(value)
    ? new Intl.NumberFormat("es-PE", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value)
    : "—";
}

function percent(value: number, decimals = 2) {
  return Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${number(value, decimals)}%` : "—";
}

function duration(seconds: number) {
  if (!Number.isFinite(seconds)) return "—";
  const safe = Math.max(0, Math.round(seconds));
  const days = Math.floor(safe / 86_400);
  const hours = Math.floor((safe % 86_400) / 3_600);
  const minutes = Math.floor((safe % 3_600) / 60);
  return `${days}d ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function smoothSvgPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  const tension = 0.65;
  for (let index = 0; index < points.length - 1; index++) {
    const previous = points[index - 1] || points[index];
    const current = points[index];
    const next = points[index + 1];
    const following = points[index + 2] || next;
    const control1 = {
      x: current.x + (next.x - previous.x) / 6 * tension,
      y: current.y + (next.y - previous.y) / 6 * tension,
    };
    const control2 = {
      x: next.x - (following.x - current.x) / 6 * tension,
      y: next.y - (following.y - current.y) / 6 * tension,
    };
    path += ` C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${next.x} ${next.y}`;
  }
  return path;
}

function finishResult(
  rows: MonthlyRow[],
  chart: ChartPoint[],
  extraLabel: string,
  extraValue: string,
  extraSub: string,
  fixed?: Partial<Pick<ProjectResult, "avgBefore" | "avgCurrent" | "avgSaved" | "avgUsd" | "optimization">>
): ProjectResult {
  const currentRows = rows.filter((row) => row.segment === "current");
  return {
    avgBefore: fixed?.avgBefore ?? averageRun(rows, "beforeMh", "before"),
    avgCurrent: fixed?.avgCurrent ?? averageRun(rows, "currentMh", "current"),
    avgSaved: fixed?.avgSaved ?? averageRun(rows, "savedMh", "current"),
    avgUsd: fixed?.avgUsd ?? averageRun(currentRows, "savedMh", "current") * 0,
    optimization: fixed?.optimization ?? weightedOptimization(rows),
    totalSaved: sum(currentRows.map((row) => row.savedMh || 0)),
    totalUsd: sum(currentRows.map((row) => row.savedUsd || 0)),
    rows,
    chart,
    extraLabel,
    extraValue,
    extraSub,
  };
}

function reportMetric(onResult: (metric: PortfolioMetric) => void, result: ProjectResult) {
  onResult({
    avgSaved: result.avgSaved,
    avgUsd: result.avgUsd,
    optimization: result.optimization,
    totalSaved: result.totalSaved,
    totalUsd: result.totalUsd,
  });
}

function NumberField({
  label,
  value,
  onChange,
  step = 0.5,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) {
  return (
    <label className="ti-field">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
      />
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: number }) {
  return (
    <label className="ti-field">
      <span>{label}</span>
      <input type="number" value={Number.isFinite(value) ? Number(value.toFixed(2)) : 0} readOnly />
    </label>
  );
}

function DateFields({
  lang,
  from,
  to,
  max,
  setFrom,
  setTo,
}: {
  lang: Lang;
  from: string;
  to: string;
  max: string;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
}) {
  return (
    <div className="ti-controls">
      <label className="ti-field">
        <span>{tr(lang, "From", "Depuis")}</span>
        <input type="date" min="2026-01-01" max={max} value={from} onChange={(event) => setFrom(event.target.value)} />
      </label>
      <label className="ti-field">
        <span>{tr(lang, "To", "Jusqu’au")}</span>
        <input type="date" min="2026-01-01" max={max} value={to} onChange={(event) => setTo(event.target.value)} />
      </label>
    </div>
  );
}

function Kpis({ result, lang }: { result: ProjectResult; lang: Lang }) {
  const items = [
    [tr(lang, "Before labor · MH/month", "Travail avant · HP/mois"), `${number(result.avgBefore, 2)} ${tr(lang, "MH/month", "HP/mois")}`, tr(lang, "Average pre-implementation monthly workload", "Charge mensuelle moyenne avant mise en œuvre"), "gold"],
    [tr(lang, "Current labor · MH/month", "Travail actuel · HP/mois"), `${number(result.avgCurrent, 2)} ${tr(lang, "MH/month", "HP/mois")}`, tr(lang, "Average post-implementation monthly workload", "Charge mensuelle moyenne après mise en œuvre"), "cyan"],
    [tr(lang, "Labor optimization · %", "Optimisation du travail · %"), percent(result.optimization), tr(lang, "Post-cut reduction vs. legacy equivalent", "Réduction après coupure vs. équivalent historique"), "green"],
    [tr(lang, "Labor cost saved · USD/month", "Coût du travail économisé · USD/mois"), money(result.avgUsd), tr(lang, "Average post-implementation run-rate", "Rythme moyen après mise en œuvre"), "green"],
    [tr(lang, "Annualized labor savings · USD/year", "Économies de travail annualisées · USD/an"), money(result.avgUsd * 12), tr(lang, "Monthly run-rate × 12", "Rythme mensuel × 12"), "green"],
    [result.extraLabel, result.extraValue, result.extraSub, "blue"],
  ];
  return (
    <div className="ti-kpis">
      {items.map(([label, value, sub, tone]) => (
        <div className={`ti-kpi ${tone}`} key={label}>
          <div className="ti-label">{label}</div>
          <div className="ti-kpi-value">{value}</div>
          <div className="ti-sub">{sub}</div>
        </div>
      ))}
    </div>
  );
}

function Comparison({ result, note, lang }: { result: ProjectResult; note: string; lang: Lang }) {
  return (
    <div className="ti-compare">
      <div className="ti-compare-head">
        <strong>{tr(lang, "Before vs. current", "Avant vs. actuel")}</strong>
        <span>{note}</span>
      </div>
      <div className="ti-compare-grid">
        <div className="ti-compare-box">
          <div className="ti-label">{tr(lang, "Before implementation", "Avant la mise en œuvre")}</div>
          <div className="ti-compare-value">{number(result.avgBefore, 2)} {tr(lang, "MH/month", "HP/mois")}</div>
          <div className="ti-sub">{tr(lang, "Average legacy-process monthly workload", "Charge mensuelle moyenne du processus historique")}</div>
        </div>
        <div className="ti-compare-box current">
          <div className="ti-label">{tr(lang, "Current process", "Processus actuel")}</div>
          <div className="ti-compare-value">{number(result.avgCurrent, 2)} {tr(lang, "MH/month", "HP/mois")}</div>
          <div className="ti-sub">{tr(lang, "Average in-scope monthly workload", "Charge mensuelle moyenne dans le périmètre")}</div>
        </div>
        <div className="ti-compare-box good">
          <div className="ti-label">{tr(lang, "Optimization", "Optimisation")}</div>
          <div className="ti-compare-value">{percent(result.optimization)}</div>
          <div className="ti-sub">{number(result.avgSaved, 2)} {tr(lang, "MH/month", "HP/mois")} · {money(result.avgUsd)}/{tr(lang, "month", "mois")}</div>
        </div>
      </div>
    </div>
  );
}

function MonthlyChart({ points, title, lang }: { points: ChartPoint[]; title: string; lang: Lang }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const max = Math.max(1, ...points.flatMap((point) => [point.legacy || 0, point.current || 0]));
  const active = activeIndex === null ? null : points[activeIndex];
  return (
    <div className="ti-chart-card ti-interactive-chart">
      <div className="ti-chart-title">{title}</div>
      <div className="ti-chart-sub">{tr(lang, "Gold = legacy equivalent · Blue = current workload", "Or = équivalent historique · Bleu = charge actuelle")}</div>
      {points.length ? (
        <div className="ti-chart-shell">
          {active ? <div className="ti-tooltip" style={{ left: `${Math.min(92, Math.max(8, ((Number(activeIndex) + 0.5) / points.length) * 100))}%` }}>
            <strong>{active.month}</strong>
            <span><i className="legacy" />{tr(lang, "Legacy", "Historique")}: <b>{number(active.legacy, 2)} {tr(lang, "MH", "HP")}</b></span>
            <span><i className="current" />{tr(lang, "Current", "Actuel")}: <b>{number(active.current ?? Number.NaN, 2)} {tr(lang, "MH", "HP")}</b></span>
            <span>{tr(lang, "Difference", "Écart")}: <b>{number(active.current === null ? Number.NaN : active.legacy - active.current, 2)} {tr(lang, "MH", "HP")}</b></span>
            {active.volume !== undefined ? <span>{tr(lang, "Volume", "Volume")}: <b>{number(active.volume, 0)}</b></span> : null}
          </div> : null}
          <div className="ti-chart" role="img" aria-label={title} onMouseLeave={() => setActiveIndex(null)}>
          {points.map((point, index) => (
            <div className={`ti-chart-column ${activeIndex === index ? "active" : ""}`} key={point.month} tabIndex={0} aria-label={`${point.month}: ${number(point.legacy, 2)} / ${number(point.current ?? Number.NaN, 2)} ${tr(lang, "MH", "HP")}`} onMouseEnter={() => setActiveIndex(index)} onFocus={() => setActiveIndex(index)} onBlur={() => setActiveIndex(null)}>
              <div className="ti-bars">
                <span className="legacy" style={{ height: `${Math.max(2, (point.legacy / max) * 100)}%` }} />
                <span className="current" style={{ height: `${point.current === null ? 0 : Math.max(2, (point.current / max) * 100)}%` }} />
              </div>
              <small>{point.month.slice(5)}</small>
            </div>
          ))}
          </div>
        </div>
      ) : (
        <div className="ti-empty">{tr(lang, "No data for the selected range.", "Aucune donnée pour la période sélectionnée.")}</div>
      )}
      <div className="ti-legend"><span className="legacy" /> {tr(lang, "Legacy process", "Processus historique")} <span className="current" /> {tr(lang, "Current process", "Processus actuel")}</div>
      <div className="ti-chart-hint">{tr(lang, "Hover or focus a month to inspect values", "Survolez ou sélectionnez un mois pour afficher les valeurs")}</div>
    </div>
  );
}

function MonthlyTable({ rows, lang }: { rows: MonthlyRow[]; lang: Lang }) {
  return (
    <div className="ti-table-box">
      <div className="ti-table-head"><strong>{tr(lang, "Monthly before vs. current", "Avant vs. actuel par mois")}</strong><span>{rows.length} {tr(lang, "period(s)", "période(s)")}</span></div>
      <div className="ti-table-wrap">
        <table>
          <thead>
            <tr>
              <th>{tr(lang, "Month", "Mois")}</th><th>{tr(lang, "Period", "Période")}</th><th>{tr(lang, "Workload basis", "Base de charge")}</th><th>{tr(lang, "Before MH", "HP avant")}</th><th>{tr(lang, "Before USD", "USD avant")}</th>
              <th>{tr(lang, "Current MH", "HP actuelles")}</th><th>{tr(lang, "Current USD", "USD actuels")}</th><th>{tr(lang, "Saved MH", "HP économisées")}</th><th>{tr(lang, "Saved USD", "USD économisés")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.month}-${row.period}-${index}`}>
                <td>{row.month}</td><td>{row.period}</td><td>{row.workload}</td><td>{number(row.beforeMh, 2)}</td>
                <td>{money(row.beforeUsd)}</td><td>{row.currentMh === null ? "—" : number(row.currentMh, 2)}</td>
                <td>{row.currentUsd === null ? "—" : money(row.currentUsd)}</td>
                <td className="ti-total">{row.savedMh === null ? "—" : number(row.savedMh, 2)}</td>
                <td className="ti-total">{row.savedUsd === null ? "—" : money(row.savedUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectCard({
  lang,
  name,
  icon,
  area,
  keyUser,
  implementation,
  description,
  solution,
  source,
  rowCount,
  result,
  controls,
  note,
  chartTitle,
  method,
  open,
  onToggle,
  extra,
}: {
  lang: Lang;
  name: string;
  icon: string;
  area: string;
  keyUser: string;
  implementation: string;
  description: string;
  solution: string;
  source: string;
  rowCount: number;
  result: ProjectResult;
  controls: React.ReactNode;
  note: string;
  chartTitle: string;
  method: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  extra?: React.ReactNode;
}) {
  return (
    <details className="ti-project" open={open} onToggle={(event) => onToggle(event.currentTarget.open)}>
      <summary>
        <div className="ti-project-title">
          <div className="ti-icon">{icon}</div>
          <div>
            <div className="ti-project-name">{name}</div>
            <div className="ti-project-meta">{tr(lang, "Source", "Source")}: {source} · {tr(lang, "Implementation start", "Début de mise en œuvre")}: {implementation}</div>
            <span className={`ti-status ${rowCount || source === "Validated assumptions" ? "ok" : "bad"}`}>
              {source === "Validated assumptions" ? tr(lang, "Validated assumptions", "Hypothèses validées") : `${number(rowCount)} ${tr(lang, "records", "enregistrements")}`}
            </span>
          </div>
        </div>
        <div className="ti-summary-metric"><div className="ti-label">{tr(lang, "MH saved · post-cut period", "HP économisées · période après coupure")}</div><div className="ti-summary-value">{number(result.totalSaved, 2)} {tr(lang, "MH", "HP")}</div></div>
        <div className="ti-summary-metric"><div className="ti-label">{tr(lang, "Optimization", "Optimisation")}</div><div className="ti-summary-value good">{percent(result.optimization)}</div></div>
        <div className="ti-summary-metric"><div className="ti-label">{tr(lang, "USD saved · post-cut period", "USD économisés · période après coupure")}</div><div className="ti-summary-value">{money(result.totalUsd)}</div></div>
        <div className="ti-summary-metric"><div className="ti-label">{tr(lang, "USD saved / month", "USD économisés / mois")}</div><div className="ti-summary-value">{money(result.avgUsd)}</div></div>
        <div className="ti-chevron">⌄</div>
      </summary>
      <div className="ti-project-body">
        <div className="ti-lead"><h3>{name}</h3><p>{description}</p></div>
        <div className="ti-context">
          <div><span>{tr(lang, "Area", "Domaine")}</span><strong>{area}</strong></div>
          <div><span>{tr(lang, "Key User", "Utilisateur clé")}</span><strong>{keyUser}</strong></div>
          <div className="description"><span>{tr(lang, "Implemented solution", "Solution mise en œuvre")}</span><strong>{solution}</strong></div>
        </div>
        {controls}
        <Kpis result={result} lang={lang} />
        <Comparison result={result} note={note} lang={lang} />
        {extra}
        <MonthlyChart points={result.chart} title={chartTitle} lang={lang} />
        <MonthlyTable rows={result.rows} lang={lang} />
        <div className="ti-method"><strong>{tr(lang, "Method.", "Méthode.")}</strong> {method}</div>
      </div>
    </details>
  );
}

function useRange(latest: Date | null) {
  const [from, setFrom] = useState("2026-01-01");
  const [to, setTo] = useState("");
  const max = dateKey(latest) || dateKey(new Date());
  return { from, to: to || max, max, setFrom, setTo };
}

function cleanDelay(rows: EntriesRow[]) {
  const valid = rows.filter(
    (row) => row.lot && row.entryDate && row.entryDatetime && row.uploadDatetime && Number.isFinite(row.delaySeconds) && row.delaySeconds >= 0
  );
  const byDay = new Map<string, number[]>();
  valid.forEach((row) => {
    const key = dateKey(row.entryDate);
    byDay.set(key, [...(byDay.get(key) || []), row.delaySeconds]);
  });
  const daily = [...byDay.entries()].map(([day, values]) => ({ day, average: mean(values) }));
  if (daily.length < 4) return { average: mean(valid.map((row) => row.delaySeconds)), outliers: [] as string[], rows: valid };
  const values = daily.map((day) => day.average);
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const iqr = q3 - q1;
  if (!Number.isFinite(iqr) || iqr <= 0) return { average: mean(valid.map((row) => row.delaySeconds)), outliers: [] as string[], rows: valid };
  const low = Math.max(0, q1 - 1.5 * iqr);
  const high = q3 + 1.5 * iqr;
  const outliers = daily.filter((day) => day.average < low || day.average > high).map((day) => day.day);
  const excluded = new Set(outliers);
  const kept = valid.filter((row) => !excluded.has(dateKey(row.entryDate)));
  return { average: mean(kept.map((row) => row.delaySeconds)), outliers, rows: kept };
}

function DelayChart({ rows, baseline, lang }: { rows: EntriesRow[]; baseline: number; lang: Lang }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const daily = useMemo(() => {
    const map = new Map<string, number[]>();
    rows.forEach((row) => {
      if (!row.entryDate || !Number.isFinite(row.delaySeconds)) return;
      const key = dateKey(row.entryDate);
      map.set(key, [...(map.get(key) || []), row.delaySeconds / 3600]);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, values]) => ({ day, value: mean(values) }));
  }, [rows]);
  const values = daily.map((item) => item.value);
  const max = Math.max(1, baseline / 3600 || 0, ...values) * 1.08;
  const width = 1200, height = 260, left = 46, right = 1188, top = 14, bottom = 224;
  const xAt = (index: number) => daily.length === 1 ? (left + right) / 2 : left + index / (daily.length - 1) * (right - left);
  const yAt = (value: number) => top + (1 - Math.max(0, Math.min(max, value)) / max) * (bottom - top);
  const plotted = daily.map((item, index) => ({ ...item, x: xAt(index), y: yAt(item.value) }));
  const cut = dateKey(CUT.cdm);
  const beforePath = smoothSvgPath(plotted.filter((item) => item.day < cut));
  const currentPath = smoothSvgPath(plotted.filter((item) => item.day >= cut));
  const baselineY = yAt(baseline / 3600);
  const active = activeIndex === null ? null : daily[activeIndex];
  const activePoint = activeIndex === null ? null : plotted[activeIndex];
  const gridTicks = [0, .25, .5, .75, 1];
  return (
    <div className="ti-chart-card ti-interactive-chart">
      <div className="ti-chart-title">{tr(lang, "Average upload delay · before vs. after", "Délai moyen de chargement · avant vs. après")}</div>
      <div className="ti-chart-sub">{tr(lang, "Gold = before implementation · Blue = current · Dashed green = fixed legacy baseline", "Or = avant mise en œuvre · Bleu = actuel · Vert pointillé = référence historique fixe")}</div>
      {daily.length ? (
        <div className="ti-chart-shell ti-line-shell">
          {active && activePoint ? <div className="ti-tooltip" style={{ left: `${Math.min(92, Math.max(8, activePoint.x / width * 100))}%` }}><strong>{active.day}</strong><span>{tr(lang, "Period", "Période")}: <b>{active.day < cut ? tr(lang, "Before", "Avant") : tr(lang, "Current", "Actuel")}</b></span><span>{tr(lang, "Observed delay", "Délai observé")}: <b>{number(active.value, 2)} h</b></span><span>{tr(lang, "Legacy baseline", "Référence historique")}: <b>{number(baseline / 3600, 2)} h</b></span><span>{tr(lang, "Difference", "Écart")}: <b>{number(active.value - baseline / 3600, 2)} h</b></span></div> : null}
          <div className="ti-line-canvas">
          {activePoint ? <span className="ti-line-marker" style={{ left: `${activePoint.x / width * 100}%`, top: `${activePoint.y / height * 100}%` }} /> : null}
          {gridTicks.map((ratio) => <span key={ratio} className="ti-y-label" style={{ top: `${(top + ratio * (bottom - top)) / height * 100}%` }}>{number(max * (1 - ratio), 1)} h</span>)}
          <svg className="ti-line-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={tr(lang, "Daily upload delay", "Délai quotidien de chargement")} tabIndex={0} onMouseMove={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)); setActiveIndex(Math.round(ratio * (daily.length - 1))); }} onMouseLeave={() => setActiveIndex(null)} onFocus={() => setActiveIndex((current) => current ?? 0)} onBlur={() => setActiveIndex(null)} onKeyDown={(event) => { if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; event.preventDefault(); setActiveIndex((current) => Math.max(0, Math.min(daily.length - 1, (current ?? 0) + (event.key === "ArrowRight" ? 1 : -1)))); }}>
            {gridTicks.map((ratio) => <line key={ratio} x1={left} x2={right} y1={top + ratio * (bottom - top)} y2={top + ratio * (bottom - top)} className="grid" />)}
            <line x1={left} x2={right} y1={baselineY} y2={baselineY} className="baseline" />
            {beforePath ? <path d={beforePath} className="before" /> : null}
            {currentPath ? <path d={currentPath} className="current" /> : null}
          </svg>
          <div className="ti-x-labels"><span>{daily[0].day}</span><span>{cut}</span><span>{daily[daily.length - 1].day}</span></div>
          </div>
        </div>
      ) : <div className="ti-empty">{tr(lang, "No valid delays for the selected range.", "Aucun délai valide pour la période sélectionnée.")}</div>}
      <div className="ti-legend"><span className="legacy" /> {tr(lang, "Before implementation", "Avant mise en œuvre")} <span className="current" /> {tr(lang, "Current process", "Processus actuel")} <span className="baseline" /> {tr(lang, "Legacy baseline", "Référence historique")}</div>
      <div className="ti-chart-hint">{tr(lang, "Move across the curve or use the arrow keys to inspect each day", "Parcourez la courbe ou utilisez les flèches pour consulter chaque jour")}</div>
    </div>
  );
}

function CdmProject({ rows, open, onToggle, onResult, lang }: { rows: EntriesRow[]; open: boolean; onToggle: (open: boolean) => void; onResult: (metric: PortfolioMetric) => void; lang: Lang }) {
  const latest = useMemo(() => latestDate(rows.map((row) => row.entryDate)), [rows]);
  const range = useRange(latest);
  const [department, setDepartment] = useState("");
  const [miner, setMiner] = useState("");
  const [rates, setRates] = useState({ accounting: 8, commercial: 8, control: 20, cap: 12 });
  const departments = useMemo(() => [...new Set(rows.map((row) => row.department).filter(Boolean))].sort(), [rows]);
  const miners = useMemo(() => [...new Set(rows.map((row) => row.miner).filter(Boolean))].sort(), [rows]);

  const calculation = useMemo(() => {
    const from = inputDate(range.from) || ANALYSIS_START;
    const to = inputDate(range.to, true) || latest || new Date();
    const base = rows.filter((row) => (!department || row.department === department) && (!miner || row.miner === miner) && row.entryDate && row.entryDate >= ANALYSIS_START && Number.isFinite(row.delaySeconds) && row.delaySeconds >= 0);
    const beforeClean = cleanDelay(base.filter((row) => row.entryDate && row.entryDate < CUT.cdm));
    const afterClean = cleanDelay(base.filter((row) => row.entryDate && row.entryDate >= CUT.cdm && row.entryDate <= to));
    const baselineHours = beforeClean.average / 3600;
    const calculate = (selected: EntriesRow[], legacy: boolean) => {
      const days = new Map<string, EntriesRow[]>();
      selected.forEach((row) => {
        const key = dateKey(row.entryDate);
        days.set(key, [...(days.get(key) || []), row]);
      });
      let accounting = 0, commercial = 0, control = 0;
      days.forEach((dayRows) => {
        const delayHours = legacy ? baselineHours : mean(dayRows.map((row) => row.delaySeconds)) / 3600;
        accounting += Math.min(8, Math.max(0, delayHours)) * 0.9 * 3;
        commercial += Math.min(8, Math.max(0, delayHours)) * 0.9 * 2;
        const controlRaw = legacy ? dayRows.length * baselineHours : sum(dayRows.map((row) => row.delaySeconds / 3600));
        control += Math.min(Math.max(0, controlRaw), 2 * rates.cap);
      });
      return { mh: accounting + commercial + control, usd: accounting * rates.accounting + commercial * rates.commercial + control * rates.control };
    };
    const beforeRows = beforeClean.rows.filter((row) => row.entryDate && row.entryDate >= from && row.entryDate <= to);
    const afterRows = afterClean.rows.filter((row) => row.entryDate && row.entryDate >= from && row.entryDate <= to);
    const monthly: MonthlyRow[] = [];
    const chart: ChartPoint[] = [];
    monthsFrom(from, to).forEach((month) => {
      const { start, end } = monthBounds(month);
      const pre = beforeRows.filter((row) => inPeriod(row.entryDate, start, end));
      const post = afterRows.filter((row) => inPeriod(row.entryDate, start, end));
      const preActual = calculate(pre, false);
      const postLegacy = calculate(post, true);
      const postActual = calculate(post, false);
      if (pre.length) monthly.push({ month, period: end < CUT.cdm ? tr(lang, "Before implementation", "Avant mise en œuvre") : tr(lang, "Before · 01–19 Jul", "Avant · 01–19 juil."), workload: `${new Set(pre.map((row) => row.lot)).size} ${tr(lang, "lots", "lots")}`, beforeMh: preActual.mh, beforeUsd: preActual.usd, currentMh: null, currentUsd: null, savedMh: null, savedUsd: null, segment: "before", fullSegment: start >= from && end <= to && end < CUT.cdm });
      if (post.length) monthly.push({ month, period: start >= CUT.cdm ? tr(lang, "Current", "Actuel") : tr(lang, "Current · from 20 Jul", "Actuel · dès le 20 juil."), workload: `${new Set(post.map((row) => row.lot)).size} ${tr(lang, "lots", "lots")}`, beforeMh: postLegacy.mh, beforeUsd: postLegacy.usd, currentMh: postActual.mh, currentUsd: postActual.usd, savedMh: postLegacy.mh - postActual.mh, savedUsd: postLegacy.usd - postActual.usd, segment: "current", fullSegment: start >= CUT.cdm && start >= from && end <= to });
      chart.push({ month, legacy: preActual.mh + postLegacy.mh, current: pre.length || post.length ? preActual.mh + postActual.mh : null, volume: new Set([...pre, ...post].map((row) => row.lot)).size });
    });
    const result = finishResult(monthly, chart, tr(lang, "Average upload delay", "Délai moyen de chargement"), `${duration(beforeClean.average)} → ${duration(afterClean.average)}`, `${beforeClean.outliers.length + afterClean.outliers.length} ${tr(lang, "outlier day(s) excluded", "jour(s) atypique(s) exclu(s)")}`);
    result.avgUsd = averageRun(monthly, "savedMh", "current");
    const fullCurrent = monthly.filter((row) => row.segment === "current" && row.fullSegment && row.savedUsd !== null);
    const anyCurrent = monthly.filter((row) => row.segment === "current" && row.savedUsd !== null);
    result.avgUsd = mean((fullCurrent.length ? fullCurrent : anyCurrent).map((row) => Number(row.savedUsd)));
    return { result, base: base.filter((row) => row.entryDate && row.entryDate >= from && row.entryDate <= to), baseline: beforeClean.average };
  }, [rows, range.from, range.to, latest, department, miner, rates, lang]);
  useEffect(() => reportMetric(onResult, calculation.result), [calculation.result, onResult]);

  const controls = <>
    <DateFields {...range} lang={lang} />
    <div className="ti-controls">
      <label className="ti-field"><span>{tr(lang, "Department", "Département")}</span><select value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">{tr(lang, "All", "Tous")}</option>{departments.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="ti-field"><span>{tr(lang, "Miner", "Mineur")}</span><select value={miner} onChange={(event) => setMiner(event.target.value)}><option value="">{tr(lang, "All", "Tous")}</option>{miners.map((value) => <option key={value}>{value}</option>)}</select></label>
    </div>
    <div className="ti-controls assumptions">
      <NumberField label={tr(lang, "Accounting labor cost · USD/MH", "Coût Comptabilité · USD/HP")} value={rates.accounting} onChange={(value) => setRates((current) => ({ ...current, accounting: value }))} />
      <NumberField label={tr(lang, "Commercial labor cost · USD/MH", "Coût Commercial · USD/HP")} value={rates.commercial} onChange={(value) => setRates((current) => ({ ...current, commercial: value }))} />
      <NumberField label={tr(lang, "Mineral Control labor cost · USD/MH", "Coût Contrôle des Minéraux · USD/HP")} value={rates.control} onChange={(value) => setRates((current) => ({ ...current, control: value }))} />
      <NumberField label={tr(lang, "Mineral Control cap · h/person/day", "Plafond Contrôle des Minéraux · h/personne/jour")} value={rates.cap} onChange={(value) => setRates((current) => ({ ...current, cap: value }))} />
    </div>
  </>;
  return <ProjectCard lang={lang} name={tr(lang, "Lot Entries & Uploads", "Entrées et chargements des lots")} icon="↥" area="CDM" keyUser="Carlos Huamán" implementation="20/07/2026" description={tr(lang, "A weighing-scale automation that creates and inserts the lot file automatically, eliminating manual registration and its associated waiting time.", "Une automatisation de la balance crée et insère automatiquement le dossier du lot, supprimant l’enregistrement manuel et le temps d’attente associé.")} solution={tr(lang, "The new weighing-scale system automatically creates and inserts each entry file, reducing standby time for Accounting, Commercial and Mineral Control.", "Le nouveau système de balance crée et insère automatiquement chaque dossier d’entrée, réduisant l’attente pour la Comptabilité, le Commercial et le Contrôle des Minéraux.")} source="GET /api/dti/entries-up" rowCount={rows.length} result={calculation.result} controls={controls} note={tr(lang, "Delay outliers are excluded from KPIs and labor calculations using 1.5× IQR.", "Les délais atypiques sont exclus des KPI et des calculs de travail selon l’IQR 1,5×.")} chartTitle={tr(lang, "Lot Entries & Uploads · legacy vs. current MH by month", "Entrées et chargements · HP historiques vs. actuelles par mois")} method={tr(lang, "Analysis starts on 01/01/2026 and implementation on 20/07/2026. The fixed baseline uses valid pre-cut records. Accounting and Commercial apply 90% exposure for 3 and 2 people, capped at 8 h/person/day; Mineral Control is calculated lot by lot with a daily two-person cap.", "L’analyse débute le 01/01/2026 et la mise en œuvre le 20/07/2026. La référence fixe utilise les enregistrements valides avant coupure. Comptabilité et Commercial appliquent une exposition de 90 % pour 3 et 2 personnes, plafonnée à 8 h/personne/jour ; le Contrôle des Minéraux est calculé lot par lot avec un plafond quotidien de deux personnes.")} open={open} onToggle={onToggle} extra={<DelayChart rows={calculation.base} baseline={calculation.baseline} lang={lang} />} />;
}

function FinProject({ rows, open, onToggle, onResult, lang }: { rows: FinanceRow[]; open: boolean; onToggle: (open: boolean) => void; onResult: (metric: PortfolioMetric) => void; lang: Lang }) {
  const latest = useMemo(() => latestDate(rows.flatMap((row) => [row.entryDate, row.valuationDate, row.docDate])), [rows]);
  const range = useRange(latest);
  const [a, setA] = useState({ financeRate: 20, commercialRate: 8, controlRate: 20, financeOld: 1.25, people: 7, commercialOld: 2, commercialNew: 0.25, controlOld: 9, controlNew: 1 });
  const result = useMemo(() => {
    const from = inputDate(range.from) || ANALYSIS_START;
    const dataEnd = latest || new Date();
    const to = inputDate(range.to, true) || dataEnd;
    const counts = (month: string) => {
      const { start, end } = monthBounds(month);
      const entered = new Set<string>(), commercial = new Set<string>(), review = new Set<string>();
      rows.forEach((row) => {
        if (inPeriod(row.entryDate, start, end)) entered.add(row.lot);
        const commercialDate = row.valuationDate || row.entryDate;
        if (row.hasAu && inPeriod(commercialDate, start, end)) commercial.add(row.lot);
        if (row.hasDoc && row.valuationDate && inPeriod(row.valuationDate, start, end)) review.add(row.lot);
      });
      return { entered: entered.size, commercial: commercial.size, review: review.size };
    };
    const stats = monthsFrom(ANALYSIS_START, dataEnd).map((month) => ({ month, ...counts(month) }));
    const avgPositive = (selected: typeof stats, key: "commercial" | "review") => mean(selected.map((item) => item[key]).filter((value) => value > 0));
    const pre = stats.filter((item) => monthBounds(item.month).end < CUT.fin);
    const post = stats.filter((item) => monthBounds(item.month).start >= CUT.fin);
    const preCommercial = avgPositive(pre, "commercial"), postCommercial = avgPositive(post, "commercial");
    const preReview = avgPositive(pre, "review"), postReview = avgPositive(post, "review");
    const oldCommercialPerLot = preCommercial > 0 ? (a.commercialOld * 1.5 * a.people) / preCommercial : 0;
    const newCommercialPerLot = postCommercial > 0 ? (a.commercialNew * a.people) / postCommercial : 0;
    const oldReviewPerLot = preReview > 0 ? (a.controlOld * 1.5) / preReview : 0;
    const newReviewPerLot = postReview > 0 ? a.controlNew / postReview : 0;
    const monthly: MonthlyRow[] = [], chart: ChartPoint[] = [];
    monthsFrom(from, to).forEach((month) => {
      const volume = counts(month), { start, end } = monthBounds(month);
      const financeBefore = volume.entered > 0 ? a.financeOld : 0;
      const commercialBefore = volume.commercial * oldCommercialPerLot;
      const controlBefore = volume.review * oldReviewPerLot;
      const beforeMh = financeBefore + commercialBefore + controlBefore;
      const beforeUsd = financeBefore * a.financeRate + commercialBefore * a.commercialRate + controlBefore * a.controlRate;
      if (end < CUT.fin) {
        monthly.push({ month, period: tr(lang, "Before implementation", "Avant mise en œuvre"), workload: `${volume.entered} / ${volume.commercial} / ${volume.review}`, beforeMh, beforeUsd, currentMh: null, currentUsd: null, savedMh: null, savedUsd: null, segment: "before", fullSegment: start >= from && end <= to });
        chart.push({ month, legacy: beforeMh, current: beforeMh, volume: volume.entered });
      } else {
        const commercialNow = volume.commercial * newCommercialPerLot;
        const controlNow = volume.review * newReviewPerLot;
        const currentMh = commercialNow + controlNow;
        const currentUsd = commercialNow * a.commercialRate + controlNow * a.controlRate;
        monthly.push({ month, period: tr(lang, "Current", "Actuel"), workload: `${volume.entered} / ${volume.commercial} / ${volume.review}`, beforeMh, beforeUsd, currentMh, currentUsd, savedMh: beforeMh - currentMh, savedUsd: beforeUsd - currentUsd, segment: "current", fullSegment: start >= CUT.fin && start >= from && end <= to && end <= dataEnd });
        chart.push({ month, legacy: beforeMh, current: currentMh, volume: volume.entered });
      }
    });
    const calculated = finishResult(monthly, chart, tr(lang, "Workload basis", "Base de charge"), `${sum(chart.map((item) => item.volume || 0))} ${tr(lang, "entered lots", "lots entrés")}`, tr(lang, "Entered / Commercial / Mineral Control review", "Entrés / Commercial / Révision Contrôle des Minéraux"));
    const fullCurrent = monthly.filter((row) => row.segment === "current" && row.fullSegment);
    calculated.avgUsd = mean((fullCurrent.length ? fullCurrent : monthly.filter((row) => row.segment === "current")).map((row) => Number(row.savedUsd)));
    return calculated;
  }, [rows, range.from, range.to, latest, a, lang]);
  useEffect(() => reportMetric(onResult, result), [result, onResult]);
  const controls = <><DateFields {...range} lang={lang} /><div className="ti-controls assumptions">
    <NumberField label={tr(lang, "Finance labor cost · USD/MH", "Coût Finance · USD/HP")} value={a.financeRate} onChange={(value) => setA((c) => ({ ...c, financeRate: value }))} />
    <NumberField label={tr(lang, "Commercial labor cost · USD/MH", "Coût Commercial · USD/HP")} value={a.commercialRate} onChange={(value) => setA((c) => ({ ...c, commercialRate: value }))} />
    <NumberField label={tr(lang, "Mineral Control labor cost · USD/MH", "Coût Contrôle des Minéraux · USD/HP")} value={a.controlRate} onChange={(value) => setA((c) => ({ ...c, controlRate: value }))} />
    <NumberField label={tr(lang, "Legacy Finance preparation · MH/month", "Préparation historique Finance · HP/mois")} value={a.financeOld} step={0.25} onChange={(value) => setA((c) => ({ ...c, financeOld: value }))} />
    <NumberField label={tr(lang, "Commercial headcount", "Effectif Commercial")} value={a.people} step={1} onChange={(value) => setA((c) => ({ ...c, people: Math.max(1, value) }))} />
    <NumberField label={tr(lang, "Legacy Commercial effort · h/person/month", "Effort historique Commercial · h/personne/mois")} value={a.commercialOld} step={0.25} onChange={(value) => setA((c) => ({ ...c, commercialOld: value }))} />
    <NumberField label={tr(lang, "Current Commercial effort · h/person/month", "Effort actuel Commercial · h/personne/mois")} value={a.commercialNew} step={0.05} onChange={(value) => setA((c) => ({ ...c, commercialNew: value }))} />
    <NumberField label={tr(lang, "Legacy Mineral Control effort · MH/month", "Effort historique Contrôle des Minéraux · HP/mois")} value={a.controlOld} step={0.25} onChange={(value) => setA((c) => ({ ...c, controlOld: value }))} />
    <NumberField label={tr(lang, "Current Mineral Control effort · MH/month", "Effort actuel Contrôle des Minéraux · HP/mois")} value={a.controlNew} step={0.25} onChange={(value) => setA((c) => ({ ...c, controlNew: value }))} />
  </div></>;
  return <ProjectCard lang={lang} name={tr(lang, "Valuation & Payment Control", "Contrôle des valorisations et paiements")} icon="$" area={tr(lang, "Finance, CDM & Commercial", "Finance, CDM et Commercial")} keyUser="Carlos Huamán" implementation="01/04/2026" description={tr(lang, "Integrated traceability of lot valuation and payment, comparing legacy workload with the automated process.", "Traçabilité intégrée de la valorisation et du paiement des lots, comparant la charge historique au processus automatisé.")} solution={tr(lang, "SGM, Concar and Commercial data were integrated into a validated report that provides end-to-end traceability of paid lots.", "Les données SGM, Concar et Commercial ont été intégrées dans un rapport validé offrant une traçabilité de bout en bout des lots payés.")} source="GET /api/dti/trace-fin" rowCount={rows.length} result={result} controls={controls} note={tr(lang, "Post-cut savings use actual monthly stage volumes valued under both workflows.", "Les économies après coupure utilisent les volumes mensuels réels de chaque étape valorisés selon les deux processus.")} chartTitle={tr(lang, "Valuation & Payment Control · legacy vs. current MH by month", "Contrôle des valorisations et paiements · HP historiques vs. actuelles par mois")} method={tr(lang, "History starts on 01/01/2026 and implementation on 01/04/2026. Legacy Finance uses editable monthly preparation; Commercial and Mineral Control are converted to MH/lot using their pre- and post-cut productivity. Mineral Control review requires valuation_date and doc_number.", "L’historique débute le 01/01/2026 et la mise en œuvre le 01/04/2026. Finance historique utilise une préparation mensuelle modifiable ; Commercial et Contrôle des Minéraux sont convertis en HP/lot selon leur productivité avant et après coupure. La révision exige valuation_date et doc_number.")} open={open} onToggle={onToggle} />;
}

function FcsProject({ rows, open, onToggle, onResult, lang }: { rows: FcsRow[]; open: boolean; onToggle: (open: boolean) => void; onResult: (metric: PortfolioMetric) => void; lang: Lang }) {
  const latest = useMemo(() => latestDate(rows.map((row) => row.entryDate)), [rows]);
  const range = useRange(latest);
  const [a, setA] = useState({ finance: 20, commercial: 8, control: 20, weekly: 4.5 });
  const result = useMemo(() => {
    const from = inputDate(range.from) || ANALYSIS_START, to = inputDate(range.to, true) || latest || new Date();
    const firstByLot = new Map<string, FcsRow>();
    rows.forEach((row) => { if (row.lot && !firstByLot.has(row.lot)) firstByLot.set(row.lot, row); });
    const lotsByMonth = new Map<string, Set<string>>();
    firstByLot.forEach((row) => { if (!row.entryDate || row.entryDate < ANALYSIS_START) return; const key = monthKey(row.entryDate); const set = lotsByMonth.get(key) || new Set<string>(); set.add(row.lot); lotsByMonth.set(key, set); });
    const referenceLots = Math.max(0, ...[...lotsByMonth.values()].map((set) => set.size));
    const effectiveRate = (a.control + 2.5 * a.finance + a.commercial) / 4.5;
    const monthlyRun = a.weekly * 52 / 12, monthlyUsd = monthlyRun * effectiveRate;
    const monthly: MonthlyRow[] = [], chart: ChartPoint[] = [];
    monthsFrom(from, to).forEach((month) => {
      const { start, end } = monthBounds(month), selectedStart = new Date(Math.max(start.getTime(), from.getTime())), selectedEnd = new Date(Math.min(end.getTime(), to.getTime()));
      if (selectedEnd < selectedStart) return;
      const beforeEnd = new Date(CUT.fcs.getTime() - 1);
      const preDays = overlapDays(selectedStart, selectedEnd, start, new Date(Math.min(end.getTime(), beforeEnd.getTime())));
      const postDays = overlapDays(selectedStart, selectedEnd, new Date(Math.max(start.getTime(), CUT.fcs.getTime())), end);
      const beforePre = a.weekly * preDays / 7, beforePost = a.weekly * postDays / 7;
      const workload = `${number(referenceLots)} (${number(referenceLots * 0.95)}–${number(referenceLots * 1.05)}) ${tr(lang, "reference lots", "lots de référence")}`;
      if (preDays > 0) monthly.push({ month, period: tr(lang, "Before implementation", "Avant mise en œuvre"), workload, beforeMh: beforePre, beforeUsd: beforePre * effectiveRate, currentMh: null, currentUsd: null, savedMh: null, savedUsd: null, segment: "before", fullSegment: false });
      if (postDays > 0) monthly.push({ month, period: month === "2026-01" ? tr(lang, "Current · from 19 Jan", "Actuel · dès le 19 janv.") : tr(lang, "Current", "Actuel"), workload, beforeMh: beforePost, beforeUsd: beforePost * effectiveRate, currentMh: 0, currentUsd: 0, savedMh: beforePost, savedUsd: beforePost * effectiveRate, segment: "current", fullSegment: postDays === end.getDate() });
      chart.push({ month, legacy: beforePre + beforePost, current: beforePre, volume: referenceLots });
    });
    return finishResult(monthly, chart, tr(lang, "Representative stock volume", "Volume de stock représentatif"), `${number(referenceLots)} ${tr(lang, "lots/month", "lots/mois")}`, `${number(referenceLots * 0.95)}–${number(referenceLots * 1.05)} ${tr(lang, "lots/month", "lots/mois")} · ±5%`, { avgBefore: monthlyRun, avgCurrent: 0, avgSaved: monthlyRun, avgUsd: monthlyUsd, optimization: 100 });
  }, [rows, range.from, range.to, latest, a, lang]);
  useEffect(() => reportMetric(onResult, result), [result, onResult]);
  const controls = <><DateFields {...range} lang={lang} /><div className="ti-controls assumptions">
    <NumberField label={tr(lang, "Finance labor cost · USD/MH", "Coût Finance · USD/HP")} value={a.finance} onChange={(value) => setA((c) => ({ ...c, finance: value }))} />
    <NumberField label={tr(lang, "Commercial labor cost · USD/MH", "Coût Commercial · USD/HP")} value={a.commercial} onChange={(value) => setA((c) => ({ ...c, commercial: value }))} />
    <NumberField label={tr(lang, "Mineral Control labor cost · USD/MH", "Coût Contrôle des Minéraux · USD/HP")} value={a.control} onChange={(value) => setA((c) => ({ ...c, control: value }))} />
    <NumberField label={tr(lang, "Legacy cycle · MH/week", "Cycle historique · HP/semaine")} value={a.weekly} step={0.25} onChange={(value) => setA((c) => ({ ...c, weekly: value }))} />
  </div></>;
  return <ProjectCard lang={lang} name={tr(lang, "Lot Payment Forecast", "Prévision de paiement des lots")} icon="F" area="Finance" keyUser="Daniel Pajuelo" implementation="19/01/2026" description={tr(lang, "Automated weekly mineral-payment forecast using a representative stock volume and integrated payment and valuation logic.", "Prévision hebdomadaire automatisée des paiements de minerai à partir d’un volume de stock représentatif et d’une logique intégrée de paiement et de valorisation.")} solution={tr(lang, "Unpaid lots are automatically reconciled with Concar and valued to forecast liabilities and support the weekly funding request.", "Les lots non payés sont automatiquement rapprochés avec Concar et valorisés afin de prévoir les obligations et d’appuyer la demande hebdomadaire de fonds.")} source="GET /api/dti/fcs-non" rowCount={rows.length} result={result} controls={controls} note={tr(lang, "This is a current-stock view; the highest monthly distinct-lot count only defines a representative operating volume.", "Il s’agit d’une vue du stock actuel ; le nombre mensuel maximal de lots distincts définit uniquement un volume opérationnel représentatif.")} chartTitle={tr(lang, "Lot Payment Forecast · legacy vs. current MH by month", "Prévision de paiement · HP historiques vs. actuelles par mois")} method={tr(lang, "Analysis starts on 01/01/2026 and implementation on 19/01/2026. The editable weekly cycle is prorated by calendar days. Current in-scope preparation is zero; remaining Finance review and management are outside this automation scope.", "L’analyse débute le 01/01/2026 et la mise en œuvre le 19/01/2026. Le cycle hebdomadaire modifiable est proratisé selon les jours calendaires. La préparation actuelle dans le périmètre est nulle ; la révision et la gestion Finance restantes sont hors périmètre.")} open={open} onToggle={onToggle} />;
}

function LogProject({ rows, open, onToggle, onResult, lang }: { rows: LogisticsRow[]; open: boolean; onToggle: (open: boolean) => void; onResult: (metric: PortfolioMetric) => void; lang: Lang }) {
  const latest = useMemo(() => latestDate(rows.map((row) => row.reqDate)), [rows]);
  const range = useRange(latest);
  const [a, setA] = useState({ rate: 10, prep: 2, review: 1 });
  const result = useMemo(() => {
    const from = inputDate(range.from) || ANALYSIS_START, dataEnd = latest || new Date(), to = inputDate(range.to, true) || dataEnd;
    const monthly: MonthlyRow[] = [], chart: ChartPoint[] = [];
    monthsFrom(from, to).forEach((month) => {
      const { start, end } = monthBounds(month);
      const selected = rows.filter((row) => row.reqDate && row.reqDate >= from && row.reqDate <= to && inPeriod(row.reqDate, start, end));
      if (!selected.length) return;
      const pre = selected.filter((row) => row.reqDate && row.reqDate < CUT.log), post = selected.filter((row) => row.reqDate && row.reqDate >= CUT.log);
      const buyers = new Set(selected.map((row) => row.responsible).filter(Boolean)).size;
      const prepFull = buyers * a.prep, preReview = pre.length * a.review / 60, postReview = post.length * a.review / 60;
      if (end < CUT.log) {
        const before = prepFull + preReview;
        monthly.push({ month, period: tr(lang, "Before implementation", "Avant mise en œuvre"), workload: `${buyers} ${tr(lang, "buyers", "acheteurs")} · ${pre.length} RQ`, beforeMh: before, beforeUsd: before * a.rate, currentMh: null, currentUsd: null, savedMh: null, savedUsd: null, segment: "before", fullSegment: start >= from && end <= to });
        chart.push({ month, legacy: before, current: before, volume: pre.length });
      } else if (start >= CUT.log) {
        const before = prepFull + postReview;
        monthly.push({ month, period: tr(lang, "Current", "Actuel"), workload: `${buyers} ${tr(lang, "buyers", "acheteurs")} · ${post.length} RQ`, beforeMh: before, beforeUsd: before * a.rate, currentMh: 0, currentUsd: 0, savedMh: before, savedUsd: before * a.rate, segment: "current", fullSegment: start >= from && end <= to && end <= dataEnd });
        chart.push({ month, legacy: before, current: 0, volume: post.length });
      } else {
        const before = prepFull + preReview;
        if (pre.length) monthly.push({ month, period: tr(lang, "Before · 01–10 May", "Avant · 01–10 mai"), workload: `${buyers} ${tr(lang, "buyers", "acheteurs")} · ${pre.length} RQ`, beforeMh: before, beforeUsd: before * a.rate, currentMh: null, currentUsd: null, savedMh: null, savedUsd: null, segment: "before", fullSegment: false });
        if (post.length) monthly.push({ month, period: tr(lang, "Current · from 11 May", "Actuel · dès le 11 mai"), workload: `${post.length} RQ`, beforeMh: postReview, beforeUsd: postReview * a.rate, currentMh: 0, currentUsd: 0, savedMh: postReview, savedUsd: postReview * a.rate, segment: "current", fullSegment: false });
        chart.push({ month, legacy: prepFull + preReview + postReview, current: before, volume: selected.length });
      }
    });
    const selectedRows = rows.filter((row) => row.reqDate && row.reqDate >= from && row.reqDate <= to);
    const calculated = finishResult(monthly, chart, tr(lang, "Workload basis", "Base de charge"), `${new Set(selectedRows.map((row) => row.responsible).filter(Boolean)).size} ${tr(lang, "buyers", "acheteurs")}`, `${selectedRows.length} ${tr(lang, "requirement rows", "lignes de demandes")}`);
    const fullCurrent = monthly.filter((row) => row.segment === "current" && row.fullSegment);
    calculated.avgUsd = mean((fullCurrent.length ? fullCurrent : monthly.filter((row) => row.segment === "current")).map((row) => Number(row.savedUsd)));
    return calculated;
  }, [rows, range.from, range.to, latest, a, lang]);
  useEffect(() => reportMetric(onResult, result), [result, onResult]);
  const controls = <><DateFields {...range} lang={lang} /><div className="ti-controls assumptions">
    <NumberField label={tr(lang, "Logistics buyer labor cost · USD/MH", "Coût acheteur Logistique · USD/HP")} value={a.rate} onChange={(value) => setA((c) => ({ ...c, rate: value }))} />
    <NumberField label={tr(lang, "Legacy preparation · h/buyer/month", "Préparation historique · h/acheteur/mois")} value={a.prep} step={0.25} onChange={(value) => setA((c) => ({ ...c, prep: value }))} />
    <NumberField label={tr(lang, "Legacy review · min/requirement row", "Révision historique · min/ligne de demande")} value={a.review} step={0.25} onChange={(value) => setA((c) => ({ ...c, review: value }))} />
  </div></>;
  return <ProjectCard lang={lang} name={tr(lang, "Logistics Traceability", "Traçabilité logistique")} icon="⇄" area={tr(lang, "Logistics", "Logistique")} keyUser="Joel Morales" implementation="11/05/2026" description={tr(lang, "Integrated traceability from procurement requirements to purchase orders, with an automatically prepared view for each buyer.", "Traçabilité intégrée des demandes d’achat jusqu’aux commandes, avec une vue préparée automatiquement pour chaque acheteur.")} solution={tr(lang, "Procurement requirements were integrated with owners, orders, dates, quantities, partial receipts, statuses and warehouses to accelerate follow-up.", "Les demandes d’achat ont été intégrées avec les responsables, commandes, dates, quantités, réceptions partielles, statuts et magasins afin d’accélérer le suivi.")} source="GET /api/dti/trace-log" rowCount={rows.length} result={result} controls={controls} note={tr(lang, "Legacy workload uses distinct responsible buyers and all requirement rows as review workload.", "La charge historique utilise les acheteurs responsables distincts et toutes les lignes de demandes comme charge de révision.")} chartTitle={tr(lang, "Logistics Traceability · legacy vs. current MH by month", "Traçabilité logistique · HP historiques vs. actuelles par mois")} method={tr(lang, "History starts on 01/01/2026 and implementation on 11/05/2026. Legacy monthly effort equals distinct buyers × preparation hours + requirement rows × review minutes. May assumes monthly preparation occurred before the cut; from June onward, current in-scope preparation and review are zero.", "L’historique débute le 01/01/2026 et la mise en œuvre le 11/05/2026. L’effort mensuel historique correspond aux acheteurs distincts × heures de préparation + lignes de demandes × minutes de révision. En mai, la préparation mensuelle est considérée comme antérieure à la coupure ; dès juin, la préparation et la révision actuelles dans le périmètre sont nulles.")} open={open} onToggle={onToggle} />;
}

function RoProject({ open, onToggle, onResult, lang }: { open: boolean; onToggle: (open: boolean) => void; onResult: (metric: PortfolioMetric) => void; lang: Lang }) {
  const [rate, setRate] = useState(10);
  const result = useMemo(() => {
    const monthly: MonthlyRow[] = [], chart: ChartPoint[] = [];
    monthsFrom(ANALYSIS_START, new Date()).forEach((month) => {
      const { end } = monthBounds(month);
      if (end < CUT.ro) {
        monthly.push({ month, period: tr(lang, "Before implementation", "Avant mise en œuvre"), workload: tr(lang, "Validated Compliance preparation scope", "Périmètre de préparation Compliance validé"), beforeMh: 136, beforeUsd: 136 * rate, currentMh: null, currentUsd: null, savedMh: null, savedUsd: null, segment: "before", fullSegment: true });
        chart.push({ month, legacy: 136, current: 136 });
      } else {
        monthly.push({ month, period: tr(lang, "Current", "Actuel"), workload: tr(lang, "Validated Compliance preparation scope", "Périmètre de préparation Compliance validé"), beforeMh: 136, beforeUsd: 136 * rate, currentMh: 30, currentUsd: 30 * rate, savedMh: 106, savedUsd: 106 * rate, segment: "current", fullSegment: true });
        chart.push({ month, legacy: 136, current: 30 });
      }
    });
    return finishResult(monthly, chart, tr(lang, "Validated scope", "Périmètre validé"), `136 → 30 ${tr(lang, "MH/month", "HP/mois")}`, tr(lang, "Final RO review excluded", "Révision finale du RO exclue"), { avgBefore: 136, avgCurrent: 30, avgSaved: 106, avgUsd: 106 * rate, optimization: (106 / 136) * 100 });
  }, [rate, lang]);
  useEffect(() => reportMetric(onResult, result), [result, onResult]);
  const activityTable = <div className="ti-table-box ti-activity"><div className="ti-table-head"><strong>{tr(lang, "Validated Compliance activity basis", "Base d’activités validée par Compliance")}</strong><span>{tr(lang, "Monthly equivalent", "Équivalent mensuel")}</span></div><div className="ti-table-wrap"><table><thead><tr><th>{tr(lang, "Activity", "Activité")}</th><th>{tr(lang, "Before MH/month", "HP avant/mois")}</th><th>{tr(lang, "Current MH/month", "HP actuelles/mois")}</th><th>{tr(lang, "Change", "Variation")}</th></tr></thead><tbody><tr><td>{tr(lang, "Excel preparation and RO update", "Préparation Excel et mise à jour RO")}</td><td>44.00</td><td>22.00</td><td className="ti-total">-22.00</td></tr><tr><td>{tr(lang, "Manual supplier/accounting files", "Dossiers fournisseurs/comptables manuels")}</td><td>88.00</td><td>0.00</td><td className="ti-total">-88.00</td></tr><tr><td>{tr(lang, "Month-end annexes", "Annexes de fin de mois")}</td><td>4.00</td><td>8.00</td><td>+4.00</td></tr><tr><td><strong>{tr(lang, "In-scope total", "Total dans le périmètre")}</strong></td><td><strong>136.00</strong></td><td><strong>30.00</strong></td><td className="ti-total"><strong>-106.00</strong></td></tr></tbody></table></div></div>;
  return <ProjectCard lang={lang} name="RO" icon="✓" area="Compliance" keyUser="Santiago Jacobo" implementation="01/04/2026" description={tr(lang, "Automated generation of mineral Purchase and Sales RO reports, reducing manual-error risk and freeing review capacity.", "Génération automatisée des rapports RO d’achats et de ventes de minerai, réduisant le risque d’erreur manuelle et libérant de la capacité de révision.")} solution={tr(lang, "Concar, SGM, GEOCATMIN and support tables were integrated to automate reporting and provide lot-level supplier-to-customer traceability.", "Concar, SGM, GEOCATMIN et les tables auxiliaires ont été intégrés afin d’automatiser les rapports et d’assurer une traçabilité par lot du fournisseur au client.")} source="Validated assumptions" rowCount={0} result={result} controls={<div className="ti-controls assumptions"><NumberField label={tr(lang, "Compliance labor cost · USD/MH", "Coût Compliance · USD/HP")} value={rate} onChange={setRate} /></div>} note={tr(lang, "Only report preparation and manual data assembly are in scope; final review remains with Compliance.", "Seules la préparation du rapport et l’assemblage manuel des données sont dans le périmètre ; la révision finale reste à la charge de Compliance.")} chartTitle={tr(lang, "RO · legacy vs. current MH by month", "RO · HP historiques vs. actuelles par mois")} method={tr(lang, "Validated in-scope preparation is 44→22 + 88→0 + 4→8 = 136→30 MH/month: 106 MH/month saved. Monthly USD savings equal 106 × hourly rate; annualized savings equal monthly savings × 12.", "La préparation validée dans le périmètre est 44→22 + 88→0 + 4→8 = 136→30 HP/mois : 106 HP/mois économisées. Les économies mensuelles en USD correspondent à 106 × coût horaire ; les économies annualisées au montant mensuel × 12.")} open={open} onToggle={onToggle} extra={activityTable} />;
}

type ProjectionMetric = { monthlyMh: number; monthlyUsd: number; annualUsd: number };
type PotentialMetric = { monthlyUsd: number; annualUsd: number; totalUsd: number };

type ProjectedDefinition = {
  key: string;
  titleEn: string;
  titleFr: string;
  areaEn: string;
  areaFr: string;
  descriptionEn: string;
  descriptionFr: string;
  logicEn: string;
  logicFr: string;
  beforeMinutes: number;
  afterMinutes: number;
  unitEn: string;
  unitFr: string;
  volumeRule: "lots" | "samples" | "piles" | "campaigns" | "guides";
};

const PROJECTED_PROJECTS: ProjectedDefinition[] = [
  {
    key: "collection",
    titleEn: "Digital Collection and Shipment Authorization",
    titleFr: "Digitalisation de la collecte et autorisation des expéditions",
    areaEn: "CDM / Collection",
    areaFr: "CDM / Collecte",
    descriptionEn: "Digitize the process before mineral enters the plant by integrating producer coordination, sack distribution, documentary and legal shipment validation, and truck-entry scheduling in a single system. The system will automatically validate SUNAT, REINFO, SIDENCAT, internal contracts and all other required conditions; generate and attach the corresponding files; flag inconsistencies before weighing-scale entry; and keep the supplier informed through an application.",
    descriptionFr: "Digitaliser le processus préalable à l’entrée du minerai dans l’usine en intégrant, dans un système unique, la coordination avec le producteur, la distribution des sacs, la validation documentaire et juridique de l’expédition ainsi que la programmation de l’entrée des camions. Le système validera automatiquement les informations SUNAT, REINFO, SIDENCAT, les contrats internes et les autres conditions requises ; générera et joindra les dossiers correspondants ; signalera les incohérences avant l’entrée à la balance ; et informera le fournisseur au moyen d’une application.",
    logicEn: "Compare person-time per shipment guide in the current and projected processes. The current process requires 89 person-minutes per guide across coordination, sack distribution, guide review, legal validation and entry authorization. Automation reduces this to 40 person-minutes per guide, focused mainly on commercial coordination and sack distribution, while document validation, file generation and notifications are performed automatically.",
    logicFr: "Comparer le temps-personne par guide d’expédition des processus actuel et projeté. Le processus actuel exige 89 minutes-personne par guide pour la coordination, la distribution des sacs, la révision des guides, les validations juridiques et l’autorisation d’entrée. L’automatisation réduit ce temps à 40 minutes-personne par guide, principalement consacrées à la coordination commerciale et à la distribution des sacs, tandis que les validations documentaires, la génération des dossiers et les notifications sont automatisées.",
    beforeMinutes: 89, afterMinutes: 40, unitEn: "shipment guide", unitFr: "guide d’expédition", volumeRule: "guides",
  },
  {
    key: "weighing",
    titleEn: "Weighing Process Digitalization",
    titleFr: "Digitalisation du processus de pesage",
    areaEn: "CDM / Weighing Scale", areaFr: "CDM / Balance",
    descriptionEn: "Automate entry, weighing, lot creation and document-file assembly, removing data entry, recalculations, manual searches, file editing and physical document handling.",
    descriptionFr: "Automatiser l’entrée, le pesage, la création des lots et la constitution du dossier documentaire, en supprimant les saisies, recalculs, recherches manuelles, modifications de fichiers et documents physiques.",
    logicEn: "Compare person-minutes per lot in the current and projected processes and multiply the difference by monthly lots processed.",
    logicFr: "Comparer les minutes-personne par lot des processus actuel et projeté, puis multiplier l’écart par les lots traités chaque mois.",
    beforeMinutes: 129, afterMinutes: 49, unitEn: "lot", unitFr: "lot", volumeRule: "lots",
  },
  {
    key: "yard",
    titleEn: "Digital Mineral Yard Traceability",
    titleFr: "Traçabilité numérique du minerai en parc",
    areaEn: "CDM / Mineral Yard", areaFr: "CDM / Parc à minerai",
    descriptionEn: "Digitize mineral receipt, identification, sampling and preparation through system records and QR codes, reducing field notes, manual calculations and subsequent re-entry.",
    descriptionFr: "Digitaliser la réception, l’identification, l’échantillonnage et la préparation du minerai au moyen d’enregistrements système et de codes QR, réduisant les notes terrain, calculs manuels et ressaisies.",
    logicEn: "Compare person-minutes per lot for receipt, sampling, pulverizing and registration, scaled by monthly lots processed.",
    logicFr: "Comparer les minutes-personne par lot pour la réception, l’échantillonnage, le broyage et l’enregistrement, multipliées par les lots mensuels traités.",
    beforeMinutes: 398, afterMinutes: 290, unitEn: "lot", unitFr: "lot", volumeRule: "lots",
  },
  {
    key: "laboratory",
    titleEn: "Laboratory Traceability and Digitalization",
    titleFr: "Traçabilité et digitalisation du laboratoire",
    areaEn: "Laboratory", areaFr: "Laboratoire",
    descriptionEn: "Digitize sample receipt, assay records, calculations, weighing, metallurgical tests and result issuance, reducing paper, transcription and manual calculations.",
    descriptionFr: "Digitaliser la réception des échantillons, les essais, calculs, pesées, tests métallurgiques et l’émission des résultats, réduisant le papier, les transcriptions et les calculs manuels.",
    logicEn: "Compare person-minutes per sample before and after implementation and multiply the savings by monthly samples processed.",
    logicFr: "Comparer les minutes-personne par échantillon avant et après mise en œuvre, puis multiplier l’économie par les échantillons mensuels traités.",
    beforeMinutes: 84, afterMinutes: 68, unitEn: "sample", unitFr: "échantillon", volumeRule: "samples",
  },
  {
    key: "grade",
    titleEn: "Grade Evaluation and Approval Automation",
    titleFr: "Automatisation de l’évaluation et de l’approbation des teneurs",
    areaEn: "CDM", areaFr: "CDM",
    descriptionEn: "Automate laboratory-result consolidation, commercial-grade calculations and the evaluation and approval flow, replacing manual Excel calculations with a traceable digital workflow.",
    descriptionFr: "Automatiser la consolidation des résultats de laboratoire, le calcul des teneurs commerciales et le flux d’évaluation et d’approbation, en remplaçant Excel par un workflow numérique traçable.",
    logicEn: "Compare person-minutes per lot for data entry, calculation, evaluation and approval, scaled by monthly lots.",
    logicFr: "Comparer les minutes-personne par lot pour la saisie, le calcul, l’évaluation et l’approbation, multipliées par les lots mensuels.",
    beforeMinutes: 16, afterMinutes: 8, unitEn: "lot", unitFr: "lot", volumeRule: "lots",
  },
  {
    key: "settlement",
    titleEn: "Commercial Valuation and Settlement Digitalization",
    titleFr: "Digitalisation de la valorisation et du règlement commercial",
    areaEn: "Commercial / CDM", areaFr: "Commercial / CDM",
    descriptionEn: "Integrate mineral valuation, negotiation, umpire analysis, approval and settlement into one digital flow, reducing Excel cross-checks, emails, manual calculations and document handling.",
    descriptionFr: "Intégrer la valorisation, la négociation, l’arbitrage, l’approbation et le règlement du minerai dans un flux numérique unique, réduisant les rapprochements Excel, courriels, calculs manuels et documents.",
    logicEn: "Compare person-minutes per lot in the current and projected commercial processes and multiply the savings by lots processed.",
    logicFr: "Comparer les minutes-personne par lot des processus commerciaux actuel et projeté, puis multiplier l’économie par les lots traités.",
    beforeMinutes: 51, afterMinutes: 21, unitEn: "lot", unitFr: "lot", volumeRule: "lots",
  },
  {
    key: "blending",
    titleEn: "Blending Digitalization and Optimization",
    titleFr: "Digitalisation et optimisation du blending",
    areaEn: "CDM / Plant", areaFr: "CDM / Usine",
    descriptionEn: "Integrate blending simulation, recipe approval, pile assembly and weight control in one platform, removing Excel files, emails, printouts and manual entries.",
    descriptionFr: "Intégrer la simulation du blending, l’approbation des recettes, la constitution des piles et le contrôle des poids sur une plateforme unique, supprimant Excel, courriels, impressions et saisies manuelles.",
    logicEn: "Compare person-minutes required to prepare and execute a pile today with the projected process, scaled by monthly piles.",
    logicFr: "Comparer les minutes-personne nécessaires pour préparer et exécuter une pile aujourd’hui avec le processus projeté, multipliées par les piles mensuelles.",
    beforeMinutes: 412, afterMinutes: 338, unitEn: "pile", unitFr: "pile", volumeRule: "piles",
  },
  {
    key: "plant-records",
    titleEn: "Plant Operational Records Digitalization",
    titleFr: "Digitalisation des registres opérationnels de l’usine",
    areaEn: "Plant", areaFr: "Usine",
    descriptionEn: "Digitize grinding, leaching, adsorption, harvesting, tailings and metallurgical-balance records through direct data capture and automatic calculations.",
    descriptionFr: "Digitaliser les registres de broyage, lixiviation, adsorption, récolte, résidus et bilan métallurgique grâce à la saisie directe et aux calculs automatiques.",
    logicEn: "Compare person-minutes per pile in the current and projected processes. Savings tied to physical work or lower staffing must be validated before being treated as final.",
    logicFr: "Comparer les minutes-personne par pile des processus actuel et projeté. Les économies liées aux activités physiques ou à une baisse d’effectif doivent être validées avant d’être considérées comme définitives.",
    beforeMinutes: 8970, afterMinutes: 7540, unitEn: "pile", unitFr: "pile", volumeRule: "piles",
  },
  {
    key: "refinery-traceability",
    titleEn: "Digital Refinery and Export Traceability",
    titleFr: "Traçabilité numérique de la raffinerie et des exportations",
    areaEn: "Refinery", areaFr: "Raffinerie",
    descriptionEn: "Digitize desorption and electrowinning campaign records, reporting and export/customs-close documentation, reducing manual records, data entry and rework.",
    descriptionFr: "Digitaliser les campagnes de désorption et d’électrodéposition, les rapports et la documentation d’exportation et de clôture douanière, réduisant les registres manuels, saisies et reprises.",
    logicEn: "Compare person-minutes per campaign in the current and projected processes, multiply by monthly campaigns and value saved hours at the labor rate.",
    logicFr: "Comparer les minutes-personne par campagne des processus actuel et projeté, multiplier par les campagnes mensuelles et valoriser les heures économisées au coût horaire.",
    beforeMinutes: 7350, afterMinutes: 6456, unitEn: "campaign", unitFr: "campagne", volumeRule: "campaigns",
  },
];

function AutodeskProject({ lang, open, onToggle }: { lang: Lang; open: boolean; onToggle: (open: boolean) => void }) {
  return (
    <details className="ti-project" open={open} onToggle={(event) => onToggle(event.currentTarget.open)}>
      <summary>
        <div className="ti-project-title"><div className="ti-icon">A</div><div><div className="ti-project-name">{tr(lang, "Autodesk License Optimization", "Optimisation des licences Autodesk")}</div><div className="ti-project-meta">{tr(lang, "Area", "Domaine")}: {tr(lang, "Projects", "Projets")} · Key User: Axel Gallegos</div><span className="ti-status ok">{tr(lang, "Validated static data", "Données statiques validées")}</span></div></div>
        <div className="ti-summary-metric"><div className="ti-label">{tr(lang, "Licenses reduced", "Licences supprimées")}</div><div className="ti-summary-value">13</div></div>
        <div className="ti-summary-metric"><div className="ti-label">{tr(lang, "Optimization", "Optimisation")}</div><div className="ti-summary-value good">43.2%</div></div>
        <div className="ti-summary-metric"><div className="ti-label">{tr(lang, "Annual savings", "Économies annuelles")}</div><div className="ti-summary-value">{money(24941)}</div></div>
        <div className="ti-summary-metric"><div className="ti-label">{tr(lang, "Optimized annual cost", "Coût annuel optimisé")}</div><div className="ti-summary-value">{money(32780)}</div></div><div className="ti-chevron">⌄</div>
      </summary>
      <div className="ti-project-body">
        <div className="ti-lead"><h3>{tr(lang, "Autodesk License Optimization", "Optimisation des licences Autodesk")}</h3><p>{tr(lang, "Autodesk license use was analyzed against each user’s responsibilities and license capabilities. The optimized allocation lowers cost without affecting operational needs.", "L’utilisation des licences Autodesk a été analysée selon les responsabilités de chaque utilisateur et les capacités de chaque licence. La répartition optimisée réduit les coûts sans affecter les besoins opérationnels.")}</p></div>
        <div className="ti-context"><div><span>{tr(lang, "Area", "Domaine")}</span><strong>{tr(lang, "Projects", "Projets")}</strong></div><div><span>Key User</span><strong>Axel Gallegos</strong></div><div className="description"><span>{tr(lang, "Data source", "Source des données")}</span><strong>{tr(lang, "Validated static data from the Autodesk license optimization analysis.", "Données statiques validées de l’analyse d’optimisation des licences Autodesk.")}</strong></div></div>
        <div className="ti-kpis"><div className="ti-kpi gold"><div className="ti-label">{tr(lang, "Licenses before", "Licences avant")}</div><div className="ti-kpi-value">35</div></div><div className="ti-kpi cyan"><div className="ti-label">{tr(lang, "Licenses after", "Licences après")}</div><div className="ti-kpi-value">22</div></div><div className="ti-kpi green"><div className="ti-label">{tr(lang, "License reduction", "Réduction des licences")}</div><div className="ti-kpi-value">13</div></div><div className="ti-kpi gold"><div className="ti-label">{tr(lang, "Annual cost before", "Coût annuel avant")}</div><div className="ti-kpi-value">{money(57721)}</div></div><div className="ti-kpi cyan"><div className="ti-label">{tr(lang, "Annual cost after", "Coût annuel après")}</div><div className="ti-kpi-value">{money(32780)}</div></div><div className="ti-kpi green"><div className="ti-label">{tr(lang, "Annual savings", "Économies annuelles")}</div><div className="ti-kpi-value">{money(24941)}</div><div className="ti-sub">43.2%</div></div></div>
        <div className="ti-method"><strong>{tr(lang, "Method.", "Méthode.")}</strong> {tr(lang, "Static comparison between the previous and optimized license scenarios: 35 → 22 licenses and USD 57,721 → USD 32,780 per year.", "Comparaison statique entre les scénarios de licences antérieur et optimisé : 35 → 22 licences et 57 721 USD → 32 780 USD par an.")}</div>
      </div>
    </details>
  );
}

function ProjectedProject({ definition, lang, open, onToggle, onResult, averageLots, averageCampaigns }: { definition: ProjectedDefinition; lang: Lang; open: boolean; onToggle: (open: boolean) => void; onResult: (key: string, metric: ProjectionMetric) => void; averageLots: number; averageCampaigns: number }) {
  const [before, setBefore] = useState(definition.beforeMinutes);
  const [after, setAfter] = useState(definition.afterMinutes);
  const [rate, setRate] = useState(10);
  const volume = definition.volumeRule === "samples"
    ? averageLots * 6
    : definition.volumeRule === "piles"
    ? 2 * 365 / 12
    : definition.volumeRule === "campaigns"
    ? averageCampaigns
    : definition.volumeRule === "guides"
    ? averageLots
    : averageLots;
  const keyUser = definition.key === "collection"
    ? tr(lang, "To be defined", "À définir")
    : definition.key === "laboratory"
    ? "Luis Jimenez"
    : definition.key === "settlement"
    ? "Junior de La Cruz"
    : definition.key === "refinery-traceability"
    ? "Richard Alcocer"
    : definition.areaEn === "Plant"
    ? "Carlos Perez"
    : definition.areaEn.includes("CDM")
    ? "Carlos Huaman"
    : tr(lang, "To be defined", "À définir");
  const volumeBasis = definition.volumeRule === "samples"
    ? tr(lang, "Average distinct lots/month from entries-up × 6 samples", "Moyenne des lots distincts/mois de entries-up × 6 échantillons")
    : definition.volumeRule === "piles"
    ? tr(lang, "2 piles/day × 365/12", "2 piles/jour × 365/12")
    : definition.volumeRule === "campaigns"
    ? tr(lang, "Average distinct campaigns/month from ref-ml", "Moyenne des campagnes distinctes/mois de ref-ml")
    : definition.volumeRule === "guides"
    ? tr(lang, "1 shipment guide per lot × average distinct lots/month from entries-up", "1 guide d’expédition par lot × moyenne des lots distincts/mois de entries-up")
    : tr(lang, "Average distinct lots/month from entries-up", "Moyenne des lots distincts/mois de entries-up");
  const savedMinutes = Math.max(0, before - after);
  const optimization = before > 0 ? savedMinutes / before * 100 : Number.NaN;
  const monthlyMh = savedMinutes / 60 * volume;
  const monthlyUsd = monthlyMh * rate;
  const metric = useMemo(() => ({ monthlyMh, monthlyUsd, annualUsd: monthlyUsd * 12 }), [monthlyMh, monthlyUsd]);
  useEffect(() => onResult(definition.key, metric), [definition.key, metric, onResult]);
  const unit = tr(lang, definition.unitEn, definition.unitFr);
  const quantified = before > 0;
  return (
    <details className="ti-project projected" open={open} onToggle={(event) => onToggle(event.currentTarget.open)}>
      <summary><div className="ti-project-title"><div className="ti-icon">P</div><div><div className="ti-project-name">{tr(lang, definition.titleEn, definition.titleFr)}</div><div className="ti-project-meta">{tr(lang, "Area", "Domaine")}: {tr(lang, definition.areaEn, definition.areaFr)} · Key User: {keyUser}</div><span className={`ti-status ${quantified ? "ok" : "bad"}`}>{quantified ? tr(lang, "Projected assumptions", "Hypothèses projetées") : tr(lang, "Baseline pending", "Référence à définir")}</span></div></div><div className="ti-summary-metric"><div className="ti-label">{tr(lang, "Before · min-person/unit", "Avant · min-personne/unité")}</div><div className="ti-summary-value">{quantified ? number(before) : "—"}</div></div><div className="ti-summary-metric"><div className="ti-label">{tr(lang, "Projected · min-person/unit", "Projeté · min-personne/unité")}</div><div className="ti-summary-value">{quantified ? number(after) : "—"}</div></div><div className="ti-summary-metric"><div className="ti-label">{tr(lang, "Optimization", "Optimisation")}</div><div className="ti-summary-value good">{percent(optimization)}</div></div><div className="ti-summary-metric"><div className="ti-label">{tr(lang, "Projected USD / year", "USD projetés / an")}</div><div className="ti-summary-value">{money(metric.annualUsd)}</div></div><div className="ti-chevron">⌄</div></summary>
      <div className="ti-project-body"><div className="ti-lead"><h3>{tr(lang, definition.titleEn, definition.titleFr)}</h3><p>{tr(lang, definition.descriptionEn, definition.descriptionFr)}</p></div><div className="ti-context"><div><span>{tr(lang, "Area", "Domaine")}</span><strong>{tr(lang, definition.areaEn, definition.areaFr)}</strong></div><div><span>Key User</span><strong>{keyUser}</strong></div><div className="description"><span>{tr(lang, "Optimization logic", "Logique d’optimisation")}</span><strong>{tr(lang, definition.logicEn, definition.logicFr)}</strong></div></div>
        <div className="ti-controls assumptions"><NumberField label={`${tr(lang, "Before", "Avant")} · min-person/${unit}`} value={before} step={1} onChange={setBefore} /><NumberField label={`${tr(lang, "Projected", "Projeté")} · min-person/${unit}`} value={after} step={1} onChange={setAfter} /><ReadOnlyField label={`${tr(lang, "Assumed monthly volume", "Volume mensuel supposé")} · ${unit}`} value={volume} /><NumberField label={tr(lang, "Labor cost · USD/MH", "Coût du travail · USD/HP")} value={rate} onChange={setRate} /></div>
        <div className="ti-kpis"><div className="ti-kpi gold"><div className="ti-label">{tr(lang, "Before · min-person/unit", "Avant · min-personne/unité")}</div><div className="ti-kpi-value">{quantified ? number(before) : "—"}</div><div className="ti-sub">{unit}</div></div><div className="ti-kpi cyan"><div className="ti-label">{tr(lang, "Projected · min-person/unit", "Projeté · min-personne/unité")}</div><div className="ti-kpi-value">{quantified ? number(after) : "—"}</div><div className="ti-sub">{unit}</div></div><div className="ti-kpi green"><div className="ti-label">{tr(lang, "Saved · min-person/unit", "Économie · min-personne/unité")}</div><div className="ti-kpi-value">{quantified ? number(savedMinutes) : "—"}</div><div className="ti-sub">{percent(optimization)}</div></div><div className="ti-kpi green"><div className="ti-label">{tr(lang, "Projected MH saved / month", "HP projetées économisées / mois")}</div><div className="ti-kpi-value">{number(monthlyMh, 2)}</div><div className="ti-sub">{number(volume)} {unit}/{tr(lang, "month", "mois")}</div></div><div className="ti-kpi green"><div className="ti-label">{tr(lang, "Projected USD saved / month", "USD projetés économisés / mois")}</div><div className="ti-kpi-value">{money(monthlyUsd)}</div></div><div className="ti-kpi green"><div className="ti-label">{tr(lang, "Projected USD saved / year", "USD projetés économisés / an")}</div><div className="ti-kpi-value">{money(metric.annualUsd)}</div></div></div>
        <div className="ti-method"><strong>{tr(lang, "Method.", "Méthode.")}</strong> {tr(lang, "Projected savings = (before − projected person-minutes) × monthly volume. Labor savings are converted to hours and valued using the editable hourly rate. Volume basis:", "Économies projetées = (minutes-personne avant − projetées) × volume mensuel. Les économies sont converties en heures et valorisées au coût horaire modifiable. Base de volume :")} <b>{volumeBasis}</b>.</div>
      </div>
    </details>
  );
}

function MlProject({ rows, lang, open, onToggle, onResult }: { rows: MlRow[]; lang: Lang; open: boolean; onToggle: (open: boolean) => void; onResult: (metric: PotentialMetric) => void }) {
  const latest = useMemo(() => latestDate(rows.map((row) => row.campaignDate)), [rows]);
  const range = useRange(latest);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const monthly = useMemo(() => {
    const from = inputDate(range.from) || ANALYSIS_START, to = inputDate(range.to, true) || latest || new Date();
    const groups = new Map<string, { campaignIds: Set<string>; rows: MlRow[] }>();
    rows.forEach((row) => {
      if (!row.campaignId || !row.campaignDate || row.campaignDate < from || row.campaignDate > to) return;
      const key = monthKey(row.campaignDate);
      const group = groups.get(key) || { campaignIds: new Set<string>(), rows: [] };
      group.campaignIds.add(row.campaignId);
      group.rows.push(row);
      groups.set(key, group);
    });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, group]) => {
      const actual = sum(group.rows.map((row) => row.actualCost)), model = sum(group.rows.map((row) => row.modelCost));
      return { month, campaigns: group.campaignIds.size, actual, model, saved: actual - model };
    });
  }, [rows, range.from, range.to, latest]);
  const avgActual = mean(monthly.map((row) => row.actual)), avgModel = mean(monthly.map((row) => row.model)), avgSaved = mean(monthly.map((row) => row.saved));
  const totalActual = sum(monthly.map((row) => row.actual)), totalSaved = sum(monthly.map((row) => row.saved));
  const optimization = totalActual > 0 ? totalSaved / totalActual * 100 : Number.NaN;
  const metric = useMemo(() => {
    const monthlyUsd = Number.isFinite(avgSaved) ? avgSaved : 0;
    return { monthlyUsd, annualUsd: monthlyUsd * 12, totalUsd: Number.isFinite(totalSaved) ? totalSaved : 0 };
  }, [avgSaved, totalSaved]);
  useEffect(() => onResult(metric), [metric, onResult]);
  const maxCost = Math.max(1, ...monthly.flatMap((row) => [row.actual, row.model]));
  const active = activeIndex === null ? null : monthly[activeIndex];
  return (
    <details className="ti-project potential" open={open} onToggle={(event) => onToggle(event.currentTarget.open)}><summary><div className="ti-project-title"><div className="ti-icon">ML</div><div><div className="ti-project-name">{tr(lang, "ML Refinery Consumption Optimization", "Optimisation ML de la consommation en raffinerie")}</div><div className="ti-project-meta">{tr(lang, "Area", "Domaine")}: {tr(lang, "Refinery", "Raffinerie")} · Key User: Richard Alcocer · GET /api/dti/ref-ml</div><span className={`ti-status ${rows.length ? "ok" : "bad"}`}>{number(rows.length)} {tr(lang, "records", "enregistrements")}</span></div></div><div className="ti-summary-metric"><div className="ti-label">{tr(lang, "Distinct campaigns", "Campagnes distinctes")}</div><div className="ti-summary-value">{sum(monthly.map((row) => row.campaigns))}</div></div><div className="ti-summary-metric"><div className="ti-label">{tr(lang, "Potential optimization", "Optimisation potentielle")}</div><div className="ti-summary-value good">{percent(optimization)}</div></div><div className="ti-summary-metric"><div className="ti-label">{tr(lang, "Potential USD / month", "USD potentiels / mois")}</div><div className="ti-summary-value">{money(avgSaved)}</div></div><div className="ti-summary-metric"><div className="ti-label">{tr(lang, "Potential USD / year", "USD potentiels / an")}</div><div className="ti-summary-value">{money(metric.annualUsd)}</div></div><div className="ti-chevron">⌄</div></summary>
      <div className="ti-project-body"><div className="ti-lead"><h3>{tr(lang, "ML Refinery Consumption Optimization", "Optimisation ML de la consommation en raffinerie")}</h3><p>{tr(lang, "A Machine Learning model estimates optimal input consumption for each refinery campaign, creating a data-driven benchmark to reduce material cost while preserving process requirements and operating performance.", "Un modèle de Machine Learning estime la consommation optimale d’intrants pour chaque campagne de raffinerie, créant une référence fondée sur les données afin de réduire le coût des matières tout en préservant les exigences du processus et la performance opérationnelle.")}</p></div><div className="ti-context"><div><span>{tr(lang, "Area", "Domaine")}</span><strong>{tr(lang, "Refinery", "Raffinerie")}</strong></div><div><span>Key User</span><strong>Richard Alcocer</strong></div><div className="description"><span>{tr(lang, "Calculation logic", "Logique de calcul")}</span><strong>{tr(lang, "Distinct campaign_id values are counted by campaign_date month. Costs are the sum of all campaign rows in each month; potential savings equal total actual consumption cost minus total ML-model consumption cost.", "Les campaign_id distincts sont comptés par mois de campaign_date. Les coûts correspondent à la somme de toutes les lignes de campagnes du mois ; l’économie potentielle est le coût réel total moins le coût total estimé par le modèle ML.")}</strong></div></div><DateFields {...range} lang={lang} />
        <div className="ti-kpis"><div className="ti-kpi gold"><div className="ti-label">{tr(lang, "Actual cost · USD/month", "Coût réel · USD/mois")}</div><div className="ti-kpi-value">{money(avgActual)}</div></div><div className="ti-kpi cyan"><div className="ti-label">{tr(lang, "ML model cost · USD/month", "Coût modèle ML · USD/mois")}</div><div className="ti-kpi-value">{money(avgModel)}</div></div><div className="ti-kpi green"><div className="ti-label">{tr(lang, "Potential savings · USD/month", "Économies potentielles · USD/mois")}</div><div className="ti-kpi-value">{money(avgSaved)}</div></div><div className="ti-kpi green"><div className="ti-label">{tr(lang, "Potential optimization", "Optimisation potentielle")}</div><div className="ti-kpi-value">{percent(optimization)}</div></div><div className="ti-kpi green"><div className="ti-label">{tr(lang, "Potential savings · selected period", "Économies potentielles · période")}</div><div className="ti-kpi-value">{money(totalSaved)}</div></div><div className="ti-kpi green"><div className="ti-label">{tr(lang, "Annualized potential", "Potentiel annualisé")}</div><div className="ti-kpi-value">{money(metric.annualUsd)}</div></div></div>
        <div className="ti-chart-card ti-interactive-chart"><div className="ti-chart-title">{tr(lang, "Actual vs. ML-model consumption cost by month", "Coût de consommation réel vs. modèle ML par mois")}</div><div className="ti-chart-sub">{tr(lang, "Gold = actual cost · Blue = ML-model cost", "Or = coût réel · Bleu = coût du modèle ML")}</div><div className="ti-chart-shell">{active ? <div className="ti-tooltip" style={{ left: `${Math.min(92, Math.max(8, ((Number(activeIndex) + .5) / monthly.length) * 100))}%` }}><strong>{active.month}</strong><span>{tr(lang, "Distinct campaigns", "Campagnes distinctes")}: <b>{active.campaigns}</b></span><span><i className="legacy" />{tr(lang, "Actual cost", "Coût réel")}: <b>{money(active.actual)}</b></span><span><i className="current" />{tr(lang, "ML model cost", "Coût modèle ML")}: <b>{money(active.model)}</b></span><span>{tr(lang, "Potential savings", "Économies potentielles")}: <b>{money(active.saved)}</b></span></div> : null}<div className="ti-chart" onMouseLeave={() => setActiveIndex(null)}>{monthly.map((row, index) => <div className={`ti-chart-column ${activeIndex === index ? "active" : ""}`} key={row.month} tabIndex={0} aria-label={`${row.month}: ${money(row.actual)} / ${money(row.model)}`} onMouseEnter={() => setActiveIndex(index)} onFocus={() => setActiveIndex(index)} onBlur={() => setActiveIndex(null)}><div className="ti-bars"><span className="legacy" style={{ height: `${Math.max(2, row.actual / maxCost * 100)}%` }} /><span className="current" style={{ height: `${Math.max(2, row.model / maxCost * 100)}%` }} /></div><small>{row.month.slice(5)}</small></div>)}</div></div><div className="ti-chart-hint">{tr(lang, "Hover or focus a month to inspect campaigns and costs", "Survolez ou sélectionnez un mois pour afficher les campagnes et les coûts")}</div></div>
        <div className="ti-table-box"><div className="ti-table-head"><strong>{tr(lang, "Monthly campaign economics", "Économie mensuelle des campagnes")}</strong><span>{monthly.length} {tr(lang, "month(s)", "mois")}</span></div><div className="ti-table-wrap"><table><thead><tr><th>{tr(lang, "Month", "Mois")}</th><th>{tr(lang, "Distinct campaigns", "Campagnes distinctes")}</th><th>{tr(lang, "Actual cost", "Coût réel")}</th><th>{tr(lang, "ML model cost", "Coût modèle ML")}</th><th>{tr(lang, "Potential savings", "Économies potentielles")}</th></tr></thead><tbody>{monthly.map((row) => <tr key={row.month}><td>{row.month}</td><td>{row.campaigns}</td><td>{money(row.actual)}</td><td>{money(row.model)}</td><td className="ti-total">{money(row.saved)}</td></tr>)}</tbody></table></div></div>
        <div className="ti-method"><strong>{tr(lang, "Method.", "Méthode.")}</strong> {tr(lang, "Distinct campaigns are counted once per campaign_date month, while monthly actual and ML costs sum every campaign row in that month. Monthly potential savings are total consumption_cost_us minus total ml_consumption_cost_us; annualized potential is the average monthly difference × 12.", "Les campagnes distinctes sont comptées une fois par mois de campaign_date, tandis que les coûts réels et ML mensuels additionnent toutes les lignes de campagnes du mois. L’économie potentielle mensuelle est le total consumption_cost_us moins le total ml_consumption_cost_us ; le potentiel annualisé est l’écart mensuel moyen × 12.")}</div>
      </div></details>
  );
}

function PortfolioSection({ title, subtitle, category, children, onExpand, onCollapse, lang }: { title: string; subtitle: string; category: string; children: React.ReactNode; onExpand: () => void; onCollapse: () => void; lang: Lang }) {
  return <section className="ti-category"><div className="ti-category-head"><div><span>{category}</span><h2>{title}</h2><p>{subtitle}</p></div><div className="ti-actions"><button onClick={onExpand}>{tr(lang, "Expand all", "Tout développer")}</button><button onClick={onCollapse}>{tr(lang, "Collapse all", "Tout réduire")}</button></div></div>{children}</section>;
}

export default function TiPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("en");
  const [data, setData] = useState<{ entries: EntriesRow[]; finance: FinanceRow[]; fcs: FcsRow[]; logistics: LogisticsRow[]; ml: MlRow[] }>({ entries: [], finance: [], fcs: [], logistics: [], ml: [] });
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({ cdm: false, fin: false, fcs: false, log: false, ro: false, autodesk: false, ml: false });
  const [metrics, setMetrics] = useState<Partial<Record<ProjectKey, PortfolioMetric>>>({});
  const [projectionMetrics, setProjectionMetrics] = useState<Record<string, ProjectionMetric>>({});
  const [potentialMetric, setPotentialMetric] = useState<PotentialMetric>({ monthlyUsd: 0, annualUsd: 0, totalUsd: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    const endpoints = [
      ["entries", "/api/dti/entries-up"], ["finance", "/api/dti/trace-fin"], ["fcs", "/api/dti/fcs-non"], ["logistics", "/api/dti/trace-log"], ["ml", "/api/dti/ref-ml"],
    ] as const;
    const responses = await Promise.allSettled(endpoints.map(([, path]) => apiGet(path)));
    const next = { entries: [] as EntriesRow[], finance: [] as FinanceRow[], fcs: [] as FcsRow[], logistics: [] as LogisticsRow[], ml: [] as MlRow[] };
    const nextErrors: string[] = [];
    responses.forEach((response, index) => {
      const [key, path] = endpoints[index];
      if (response.status === "rejected") { nextErrors.push(`${path}: ${response.reason instanceof Error ? response.reason.message : "error de conexión"}`); return; }
      const raw = Array.isArray(response.value?.rows) ? response.value.rows as Array<Record<string, unknown>> : [];
      if (key === "entries") next.entries = raw.map((row) => { const entryDatetime = toDate(row.entry_datetime), uploadDatetime = toDate(row.upload_datetime); return { entryDate: toDate(row.entry_date) || entryDatetime, entryDatetime, uploadDatetime, lot: text(row.lot_number), miner: text(row.miner), department: text(row.department), delaySeconds: entryDatetime && uploadDatetime ? (uploadDatetime.getTime() - entryDatetime.getTime()) / 1000 : Number.NaN }; }).filter((row) => (row.lot || row.entryDate) && (!row.entryDate || row.entryDate >= ANALYSIS_START));
      if (key === "finance") next.finance = raw.map((row) => ({ lot: text(row.lot), entryDate: toDate(row.entry_date), valuationDate: toDate(row.valuation_date), docDate: toDate(row.doc_date), hasAu: has(row.au_usd), hasDoc: has(row.doc_number) })).filter((row) => (row.lot || row.entryDate) && (!row.entryDate || row.entryDate >= ANALYSIS_START));
      if (key === "fcs") next.fcs = raw.map((row) => ({ lot: text(row.lot), entryDate: toDate(row.entry_date) })).filter((row) => (row.lot || row.entryDate) && (!row.entryDate || row.entryDate >= ANALYSIS_START));
      if (key === "logistics") next.logistics = raw.map((row) => ({ reqDate: toDate(row.req_date), responsible: text(row.responsible) })).filter((row) => row.reqDate && row.reqDate >= ANALYSIS_START);
      if (key === "ml") next.ml = raw.map((row) => ({ campaignId: text(row.campaign_id), campaignDate: toDate(row.campaign_date), actualCost: Number(row.consumption_cost_us) || 0, modelCost: Number(row.ml_consumption_cost_us) || 0 })).filter((row) => row.campaignId && row.campaignDate);
    });
    setData(next); setErrors(nextErrors); setUpdatedAt(new Date()); setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateMetric = useCallback((key: ProjectKey, metric: PortfolioMetric) => {
    setMetrics((current) => {
      const previous = current[key];
      if (previous && Object.keys(metric).every((field) => Object.is(previous[field as keyof PortfolioMetric], metric[field as keyof PortfolioMetric]))) return current;
      return { ...current, [key]: metric };
    });
  }, []);

  const updateProjectionMetric = useCallback((key: string, metric: ProjectionMetric) => {
    setProjectionMetrics((current) => {
      const previous = current[key];
      if (previous && Object.keys(metric).every((field) => Object.is(previous[field as keyof ProjectionMetric], metric[field as keyof ProjectionMetric]))) return current;
      return { ...current, [key]: metric };
    });
  }, []);

  const portfolio = useMemo(() => {
    const valid = Object.values(metrics).filter((metric): metric is PortfolioMetric => Boolean(metric && Number.isFinite(metric.avgSaved) && Number.isFinite(metric.avgUsd)));
    return { mh: sum(valid.map((metric) => metric.avgSaved)), usd: sum(valid.map((metric) => metric.avgUsd)) };
  }, [metrics]);

  const projected = useMemo(() => {
    const values = Object.values(projectionMetrics);
    return {
      mh: sum(values.map((metric) => metric.monthlyMh)),
      usd: sum(values.map((metric) => metric.monthlyUsd)),
      annual: sum(values.map((metric) => metric.annualUsd)),
    };
  }, [projectionMetrics]);

  const averageLots = useMemo(() => {
    const byMonth = new Map<string, Set<string>>();
    data.entries.forEach((row) => {
      if (!row.entryDate || !row.lot) return;
      const key = monthKey(row.entryDate);
      const lots = byMonth.get(key) || new Set<string>();
      lots.add(row.lot);
      byMonth.set(key, lots);
    });
    return mean([...byMonth.values()].map((lots) => lots.size));
  }, [data.entries]);

  const averageCampaigns = useMemo(() => {
    const byMonth = new Map<string, Set<string>>();
    data.ml.forEach((row) => {
      if (!row.campaignDate || !row.campaignId) return;
      const key = monthKey(row.campaignDate);
      const campaigns = byMonth.get(key) || new Set<string>();
      campaigns.add(row.campaignId);
      byMonth.set(key, campaigns);
    });
    return mean([...byMonth.values()].map((campaigns) => campaigns.size));
  }, [data.ml]);

  const executedAnnual = portfolio.usd * 12 + 24941;
  const unifiedAnnual = executedAnnual + projected.annual + potentialMetric.annualUsd;
  const executedKeys = ["cdm", "fin", "fcs", "log", "ro", "autodesk"];
  const projectedKeys = PROJECTED_PROJECTS.map((project) => `projected-${project.key}`);
  const setCategoryOpen = (keys: string[], value: boolean) =>
    setOpen((current) => ({ ...current, ...Object.fromEntries(keys.map((key) => [key, value])) }));
  const setProjectOpen = (key: string, value: boolean) =>
    setOpen((current) => ({ ...current, [key]: value }));

  const logout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } finally { router.push("/"); router.refresh(); }
  };

  return (
    <div className="ti-dashboard">
      <header className="ti-header"><div className="ti-stripe"><span /><span /></div><div className="ti-header-inner"><div><div className="ti-eyebrow">Veta Dorada · {tr(lang, "Operational Excellence", "Excellence opérationnelle")}</div><h1>{tr(lang, "IT Operational Efficiency", "Efficacité opérationnelle IT")}</h1><p>{tr(lang, "Executed, projected and potential initiatives · standardized savings portfolio", "Initiatives exécutées, projetées et potentielles · portefeuille d’économies standardisé")}</p></div><div className="ti-actions"><span className={`ti-live ${errors.length ? "warning" : ""}`}>{loading ? tr(lang, "Refreshing data…", "Actualisation des données…") : errors.length ? `${errors.length} ${tr(lang, "source(s) with errors", "source(s) en erreur")}` : tr(lang, "API data refreshed", "Données API actualisées")}</span><button className="lang" onClick={() => setLang((current) => current === "en" ? "fr" : "en")}>{lang === "en" ? "FR" : "EN"}</button><button onClick={() => void load()} disabled={loading}>{tr(lang, "Refresh", "Actualiser")}</button><button className="primary" onClick={logout}>{tr(lang, "Sign out", "Quitter")}</button></div></div></header>
      <main className="ti-main">
        {errors.length ? <div className="ti-error"><strong>{tr(lang, "Some data sources could not be loaded.", "Certaines sources de données n’ont pas pu être chargées.")}</strong>{errors.map((error) => <div key={error}>{error}</div>)}</div> : null}
        <section className="ti-portfolio">
          <div className="ti-portfolio-head"><div><h2>{tr(lang, "Portfolio savings overview", "Vue d’ensemble des économies du portefeuille")}</h2><p>{tr(lang, "Comparable annualized view across executed, projected and potential initiatives. Executed combines validated run-rate savings and Autodesk; projected uses editable planning assumptions; potential uses the ML benchmark.", "Vue annualisée comparable des initiatives exécutées, projetées et potentielles. Les économies exécutées combinent le rythme validé et Autodesk ; les projections utilisent des hypothèses modifiables ; le potentiel utilise la référence ML.")}</p></div></div>
          <div className="ti-portfolio-grid four"><div className="green"><span>{tr(lang, "Executed savings · USD/year", "Économies exécutées · USD/an")}</span><strong>{money(executedAnnual)}</strong><small>{number(portfolio.mh, 2)} {tr(lang, "MH/month saved + Autodesk", "HP/mois économisées + Autodesk")}</small></div><div><span>{tr(lang, "Projected savings · USD/year", "Économies projetées · USD/an")}</span><strong>{money(projected.annual)}</strong><small>{number(projected.mh, 2)} {tr(lang, "projected MH/month", "HP/mois projetées")}</small></div><div className="gold"><span>{tr(lang, "Potential savings · USD/year", "Économies potentielles · USD/an")}</span><strong>{money(potentialMetric.annualUsd)}</strong><small>{tr(lang, "ML annualized potential", "Potentiel ML annualisé")}</small></div><div className="total"><span>{tr(lang, "Unified savings · USD/year", "Économies unifiées · USD/an")}</span><strong>{money(unifiedAnnual)}</strong><small>{tr(lang, "Executed + projected + potential", "Exécutées + projetées + potentielles")}</small></div></div>
          <div className="ti-source-status"><span className={data.entries.length ? "ok" : "bad"}>entries-up · {number(data.entries.length)} {tr(lang, "rows", "lignes")}</span><span className={data.finance.length ? "ok" : "bad"}>trace-fin · {number(data.finance.length)} {tr(lang, "rows", "lignes")}</span><span className={data.fcs.length ? "ok" : "bad"}>fcs-non · {number(data.fcs.length)} {tr(lang, "rows", "lignes")}</span><span className={data.logistics.length ? "ok" : "bad"}>trace-log · {number(data.logistics.length)} {tr(lang, "rows", "lignes")}</span><span className={data.ml.length ? "ok" : "bad"}>ref-ml · {number(data.ml.length)} {tr(lang, "rows", "lignes")}</span><span className="ok">RO · {tr(lang, "validated assumptions", "hypothèses validées")}</span></div>
          {updatedAt ? <div className="ti-updated">{tr(lang, "Last query", "Dernière requête")}: {updatedAt.toLocaleString(lang === "fr" ? "fr-FR" : "en-US")}</div> : null}
        </section>
        <PortfolioSection lang={lang} category="01" title={tr(lang, "Executed", "Exécutés")} subtitle={tr(lang, "Implemented initiatives with observed or validated savings.", "Initiatives mises en œuvre avec des économies observées ou validées.")} onExpand={() => setCategoryOpen(executedKeys, true)} onCollapse={() => setCategoryOpen(executedKeys, false)}>
          <CdmProject lang={lang} rows={data.entries} open={open.cdm} onToggle={(value) => setProjectOpen("cdm", value)} onResult={(metric) => updateMetric("cdm", metric)} />
          <FinProject lang={lang} rows={data.finance} open={open.fin} onToggle={(value) => setProjectOpen("fin", value)} onResult={(metric) => updateMetric("fin", metric)} />
          <FcsProject lang={lang} rows={data.fcs} open={open.fcs} onToggle={(value) => setProjectOpen("fcs", value)} onResult={(metric) => updateMetric("fcs", metric)} />
          <LogProject lang={lang} rows={data.logistics} open={open.log} onToggle={(value) => setProjectOpen("log", value)} onResult={(metric) => updateMetric("log", metric)} />
          <RoProject lang={lang} open={open.ro} onToggle={(value) => setProjectOpen("ro", value)} onResult={(metric) => updateMetric("ro", metric)} />
          <AutodeskProject lang={lang} open={open.autodesk} onToggle={(value) => setProjectOpen("autodesk", value)} />
        </PortfolioSection>
        <PortfolioSection lang={lang} category="02" title={tr(lang, "Projected", "Projetés")} subtitle={tr(lang, "Planning scenarios using API-derived monthly volumes, operational pile assumptions, and editable unit-time and labor-rate inputs.", "Scénarios de planification utilisant les volumes mensuels issus des API, les hypothèses opérationnelles de piles et des temps unitaires et coûts horaires modifiables.")} onExpand={() => setCategoryOpen(projectedKeys, true)} onCollapse={() => setCategoryOpen(projectedKeys, false)}>
          {PROJECTED_PROJECTS.map((definition) => { const key = `projected-${definition.key}`; return <ProjectedProject key={definition.key} definition={definition} lang={lang} open={Boolean(open[key])} onToggle={(value) => setProjectOpen(key, value)} onResult={updateProjectionMetric} averageLots={Number.isFinite(averageLots) ? averageLots : 0} averageCampaigns={Number.isFinite(averageCampaigns) ? averageCampaigns : 0} />; })}
        </PortfolioSection>
        <PortfolioSection lang={lang} category="03" title={tr(lang, "Potential", "Potentiels")} subtitle={tr(lang, "Data-driven opportunities that still require operational validation before being recognized as executed savings.", "Opportunités fondées sur les données qui nécessitent encore une validation opérationnelle avant d’être reconnues comme économies exécutées.")} onExpand={() => setProjectOpen("ml", true)} onCollapse={() => setProjectOpen("ml", false)}>
          <MlProject rows={data.ml} lang={lang} open={open.ml} onToggle={(value) => setProjectOpen("ml", value)} onResult={setPotentialMetric} />
        </PortfolioSection>
        <footer>Veta Dorada · {tr(lang, "IT Operational Efficiency portfolio · API-connected dashboard", "Portefeuille d’efficacité opérationnelle IT · tableau connecté aux API")}</footer>
      </main>
      <style jsx global>{`
        .ti-dashboard{--blue:#0067AC;--gold:#C69214;--cyan:#00A5CE;--green:#5E8019;--orange:#D85D27;--ink:#24313B;--muted:#6B7280;--line:#DDE5EA;min-height:100vh;background:#F2F5F7;color:var(--ink);font-family:var(--font-exo),Exo,Arial,sans-serif}.ti-dashboard *{box-sizing:border-box}.ti-header{background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:20}.ti-stripe{height:7px;display:grid;grid-template-columns:2fr 1fr}.ti-stripe span:first-child{background:var(--blue)}.ti-stripe span:last-child{background:var(--gold)}.ti-header-inner,.ti-main{max-width:1600px;margin:auto}.ti-header-inner{padding:15px 26px;display:flex;justify-content:space-between;align-items:center;gap:16px}.ti-eyebrow{color:var(--blue);font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.ti-header h1{margin:3px 0 0;color:var(--blue);font-size:clamp(24px,2.4vw,36px)}.ti-header p{margin:5px 0 0;color:var(--muted);font-size:13px}.ti-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ti-dashboard button,.ti-dashboard input,.ti-dashboard select{font:inherit;border:1px solid #C9D5DC;background:#fff;color:var(--ink);border-radius:9px;padding:9px 11px;font-size:12px;outline:none}.ti-dashboard button{cursor:pointer;font-weight:800}.ti-dashboard button:disabled{cursor:wait;opacity:.55}.ti-dashboard button.primary,.ti-dashboard button.lang{background:var(--blue);border-color:var(--blue);color:#fff}.ti-live{border:1px solid rgba(94,128,25,.3);background:rgba(94,128,25,.08);color:#2F6B19;border-radius:999px;padding:8px 11px;font-size:11px;font-weight:800}.ti-live.warning{border-color:rgba(216,93,39,.3);background:rgba(216,93,39,.08);color:#AA431B}.ti-main{padding:22px 26px 42px}.ti-error{background:#FFF6F2;border:1px solid #E9B8A4;color:#9A3D18;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:11px;line-height:1.6}.ti-error strong{display:block}.ti-portfolio,.ti-project{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 12px 30px rgba(20,47,66,.08)}.ti-portfolio{padding:18px;margin-bottom:28px;border-top:5px solid var(--gold)}.ti-portfolio-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.ti-portfolio h2{margin:0;color:var(--blue);font-size:20px}.ti-portfolio-head p{margin:5px 0 0;color:var(--muted);font-size:11px;line-height:1.5;max-width:1000px}.ti-portfolio-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.ti-portfolio-grid.four{grid-template-columns:repeat(4,1fr)}.ti-portfolio-grid>div{border:1px solid var(--line);border-radius:12px;padding:13px;background:#FBFCFD}.ti-portfolio-grid span,.ti-label{font-size:9px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.04em}.ti-portfolio-grid strong{display:block;font-size:22px;color:var(--blue);margin-top:5px}.ti-portfolio-grid small{display:block;color:var(--muted);font-size:9px;margin-top:5px}.ti-portfolio-grid .green strong{color:#2F6B19}.ti-portfolio-grid .gold strong{color:#9A700C}.ti-portfolio-grid .total{background:var(--blue);border-color:var(--blue)}.ti-portfolio-grid .total span,.ti-portfolio-grid .total strong,.ti-portfolio-grid .total small{color:#fff}.ti-source-status{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.ti-source-status span,.ti-status{border-radius:999px;padding:6px 9px;font-size:9px;font-weight:800}.ti-source-status .ok,.ti-status.ok{background:rgba(94,128,25,.08);color:#2F6B19;border:1px solid rgba(94,128,25,.3)}.ti-source-status .bad,.ti-status.bad{background:rgba(216,93,39,.07);color:#AA431B;border:1px solid rgba(216,93,39,.3)}.ti-updated{text-align:right;color:var(--muted);font-size:9px;margin-top:9px}.ti-category{margin:0 0 30px}.ti-category-head{display:flex;justify-content:space-between;gap:16px;align-items:end;margin:0 2px 13px;padding-bottom:10px;border-bottom:2px solid rgba(0,103,172,.18)}.ti-category-head>div:first-child>span{color:var(--gold);font-size:10px;font-weight:800;letter-spacing:.16em}.ti-category-head h2{color:var(--blue);font-size:24px;margin:2px 0}.ti-category-head p{color:var(--muted);font-size:11px;margin:0;max-width:900px}.ti-project{margin-bottom:14px;overflow:hidden}.ti-project.projected{border-left:4px solid var(--cyan)}.ti-project.potential{border-left:4px solid var(--gold)}.ti-project>summary{list-style:none;cursor:pointer;padding:16px 18px;display:grid;grid-template-columns:minmax(300px,1.4fr) repeat(4,minmax(120px,.55fr)) 26px;gap:10px;align-items:center}.ti-project>summary::-webkit-details-marker{display:none}.ti-project[open]>summary{border-bottom:1px solid var(--line);background:#FBFCFD}.ti-project-title{display:flex;gap:12px;align-items:center}.ti-icon{width:42px;height:42px;border-radius:12px;background:rgba(0,103,172,.09);display:grid;place-items:center;color:var(--blue);font-size:18px;font-weight:800;flex:none}.ti-project-name{color:var(--blue);font-weight:800;font-size:16px}.ti-project-meta{font-size:9px;color:var(--muted);margin:4px 0 6px}.ti-summary-metric{border-left:1px solid #EDF1F3;padding-left:12px}.ti-summary-value{font-size:16px;font-weight:800;margin-top:4px;white-space:nowrap}.ti-summary-value.good{color:#2F6B19}.ti-chevron{font-size:22px;color:var(--gold);transition:.2s}.ti-project[open] .ti-chevron{transform:rotate(180deg)}.ti-project-body{padding:18px}.ti-lead h3{margin:0;color:var(--blue);font-size:18px}.ti-lead p{margin:5px 0 14px;color:var(--muted);font-size:11px;line-height:1.5;max-width:1200px}.ti-context{display:grid;grid-template-columns:minmax(180px,.45fr) minmax(180px,.45fr) minmax(0,2fr);gap:10px;margin-bottom:14px}.ti-context>div{border:1px solid var(--line);border-radius:11px;background:#F8FAFB;padding:11px 12px}.ti-context span,.ti-field span{display:block;font-size:9px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.04em}.ti-context strong{display:block;margin-top:4px;font-size:11px;line-height:1.45}.ti-context .description strong{font-weight:500}.ti-controls{display:flex;gap:9px;flex-wrap:wrap;align-items:end;margin-bottom:10px}.ti-controls.assumptions{margin-bottom:14px}.ti-field{min-width:150px;flex:0 1 205px}.ti-field span{margin:0 0 5px 2px}.ti-field input,.ti-field select{width:100%}.ti-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:14px}.ti-kpi{min-height:103px;position:relative;overflow:hidden;background:#fff;border:1px solid var(--line);border-radius:12px;padding:13px}.ti-kpi:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--blue)}.ti-kpi.gold:before{background:var(--gold)}.ti-kpi.cyan:before{background:var(--cyan)}.ti-kpi.green:before{background:var(--green)}.ti-kpi-value{font-size:19px;font-weight:800;color:var(--blue);margin-top:7px}.ti-kpi.green .ti-kpi-value{color:#2F6B19}.ti-sub{font-size:9px;color:var(--muted);margin-top:4px;line-height:1.4}.ti-compare{border:1px solid var(--line);border-top:4px solid var(--gold);border-radius:12px;background:#FBFCFD;padding:13px;margin-bottom:14px}.ti-compare-head{display:flex;justify-content:space-between;gap:12px}.ti-compare-head strong{color:var(--blue);font-size:13px}.ti-compare-head span{font-size:9px;color:var(--muted);max-width:850px;text-align:right;line-height:1.45}.ti-compare-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:11px}.ti-compare-box{border:1px solid var(--line);border-radius:11px;background:#fff;padding:12px}.ti-compare-value{font-size:20px;color:var(--blue);font-weight:800;margin-top:5px}.ti-compare-box.current .ti-compare-value{color:#007FA0}.ti-compare-box.good .ti-compare-value{color:#2F6B19}.ti-chart-card,.ti-table-box{border:1px solid var(--line);border-radius:12px;background:#fff;overflow:hidden;margin-bottom:12px}.ti-chart-card{padding:13px}.ti-chart-title{font-size:12px;font-weight:800}.ti-chart-sub{font-size:9px;color:var(--muted);margin-top:3px}.ti-chart{height:245px;display:flex;gap:7px;align-items:stretch;border-bottom:1px solid var(--line);padding:14px 8px 0;overflow-x:auto}.ti-chart-column{min-width:34px;flex:1;display:grid;grid-template-rows:1fr 20px;align-items:end;text-align:center}.ti-bars{height:100%;display:flex;gap:2px;align-items:end;justify-content:center}.ti-bars span{width:min(15px,42%);border-radius:3px 3px 0 0}.ti-bars .legacy,.ti-legend .legacy{background:var(--gold)}.ti-bars .current,.ti-legend .current{background:var(--blue)}.ti-chart-column small{font-size:8px;color:var(--muted);padding-top:5px}.ti-legend{font-size:9px;color:var(--muted);display:flex;gap:5px;align-items:center;justify-content:center;padding-top:8px}.ti-legend span{width:9px;height:9px;border-radius:2px;margin-left:8px}.ti-line-chart{width:100%;height:245px;margin-top:10px;background:linear-gradient(to bottom,#fff,#F8FAFB);overflow:visible}.ti-line-chart polyline{fill:none;stroke:var(--blue);stroke-width:1.3;vector-effect:non-scaling-stroke}.ti-line-chart .baseline{stroke:var(--green);stroke-width:1;stroke-dasharray:5 4;vector-effect:non-scaling-stroke}.ti-table-head{padding:11px 13px;background:#F8FAFB;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:10px}.ti-table-head strong{font-size:12px;color:var(--blue)}.ti-table-head span{font-size:9px;color:var(--muted)}.ti-table-wrap{overflow:auto;max-height:340px}.ti-dashboard table{width:100%;border-collapse:collapse;font-size:9px}.ti-dashboard th{position:sticky;top:0;background:#F4F7F9;color:#51616D;padding:9px 10px;text-align:right;white-space:nowrap;z-index:1}.ti-dashboard th:first-child,.ti-dashboard td:first-child{text-align:left}.ti-dashboard td{padding:8px 10px;border-top:1px solid #EDF1F3;text-align:right;white-space:nowrap}.ti-total{font-weight:800;color:#2F6B19}.ti-activity{margin-top:0}.ti-method{margin-top:12px;padding:11px 13px;border-radius:10px;background:#F4F8FA;border:1px solid #DCE8EE;color:#586A76;font-size:10px;line-height:1.55}.ti-empty{text-align:center;padding:60px 20px;color:var(--muted);font-size:11px}.ti-main footer{text-align:center;color:#7B8790;font-size:10px;margin-top:18px}@media(max-width:1250px){.ti-kpis{grid-template-columns:repeat(3,1fr)}.ti-portfolio-grid.four{grid-template-columns:repeat(2,1fr)}.ti-project>summary{grid-template-columns:minmax(260px,1fr) repeat(2,minmax(120px,.5fr)) 26px}.ti-project>summary .ti-summary-metric:nth-of-type(n+4){display:none}}@media(max-width:850px){.ti-header-inner,.ti-portfolio-head,.ti-compare-head,.ti-category-head{flex-direction:column;align-items:flex-start}.ti-header{position:static}.ti-context{grid-template-columns:1fr}.ti-portfolio-grid,.ti-kpis{grid-template-columns:1fr 1fr}.ti-project>summary{grid-template-columns:1fr 24px}.ti-project>summary .ti-summary-metric{display:none!important}.ti-compare-grid{grid-template-columns:1fr}.ti-main{padding:16px 12px 28px}.ti-header-inner{padding:14px 16px}.ti-compare-head span{text-align:left}}@media(max-width:560px){.ti-portfolio-grid,.ti-portfolio-grid.four,.ti-kpis{grid-template-columns:1fr}.ti-field{flex:1 1 100%}}
      `}</style>
      <style jsx global>{`
        .ti-chart-card,.ti-chart-shell{position:relative}.ti-chart-shell{margin-top:4px}.ti-tooltip{position:absolute;z-index:12;top:8px;transform:translateX(-50%);min-width:170px;max-width:230px;padding:10px 12px;border-radius:10px;background:rgba(63,63,58,.97);color:#fff;box-shadow:0 10px 26px rgba(36,49,59,.28);pointer-events:none;display:grid;gap:4px;font-size:9px;line-height:1.35;animation:tiTooltipIn .14s ease-out}.ti-tooltip:after{content:"";position:absolute;left:50%;bottom:-5px;width:10px;height:10px;background:rgba(63,63,58,.97);transform:translateX(-50%) rotate(45deg)}.ti-tooltip strong{font-size:11px;color:#fff;margin-bottom:2px}.ti-tooltip span{display:flex;align-items:center;gap:4px;white-space:nowrap}.ti-tooltip b{margin-left:auto;color:#fff}.ti-tooltip i{width:7px;height:7px;border-radius:2px;display:inline-block;flex:none}.ti-tooltip i.legacy{background:#C69214}.ti-tooltip i.current{background:#00A5CE}.ti-chart-column{position:relative;border-radius:6px 6px 0 0;transition:opacity .16s ease,background .16s ease,transform .16s ease;outline:none}.ti-chart-column:hover,.ti-chart-column:focus,.ti-chart-column.active{background:rgba(0,103,172,.055);transform:translateY(-2px)}.ti-chart:has(.ti-chart-column.active) .ti-chart-column:not(.active){opacity:.5}.ti-bars span{transition:height .28s ease,filter .16s ease,transform .16s ease}.ti-chart-column.active .ti-bars span,.ti-chart-column:hover .ti-bars span{filter:saturate(1.2) brightness(1.04);transform:scaleX(1.08)}.ti-chart-hint{text-align:center;color:#7B8790;font-size:8px;margin-top:6px}.ti-line-chart circle{fill:#0067AC;stroke:#fff;stroke-width:.45;vector-effect:non-scaling-stroke;cursor:crosshair;outline:none;transition:r .12s ease,fill .12s ease}.ti-line-chart circle:hover,.ti-line-chart circle:focus,.ti-line-chart circle.active{fill:#C69214;stroke:#3F3F3A}.ti-kpi,.ti-portfolio-grid>div,.ti-context>div{transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}.ti-kpi:hover,.ti-portfolio-grid>div:hover,.ti-context>div:hover{transform:translateY(-2px);border-color:rgba(0,103,172,.28);box-shadow:0 8px 20px rgba(20,47,66,.08)}.ti-project>summary{transition:background .18s ease}.ti-project>summary:hover{background:#F7FAFC}.ti-dashboard tbody tr{transition:background .12s ease}.ti-dashboard tbody tr:hover{background:rgba(0,165,206,.055)}.ti-field input:read-only{background:#F4F7F9;color:#51616D;cursor:default}@keyframes tiTooltipIn{from{opacity:0;transform:translateX(-50%) translateY(4px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}@media(max-width:650px){.ti-tooltip{min-width:155px;max-width:190px}.ti-chart-hint{display:none}}
      `}</style>
      <style jsx global>{`
        .ti-line-shell{height:305px;margin-top:8px;padding:0}.ti-line-shell .ti-line-chart{display:block;width:100%;height:285px;margin:0;background:linear-gradient(to bottom,#fff,#FBFCFD);cursor:crosshair;outline:none}.ti-line-chart path{fill:none;stroke-width:2;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round}.ti-line-chart path.before{stroke:#C69214}.ti-line-chart path.current{stroke:#0067AC}.ti-line-chart line.grid{stroke:#E8EEF1;stroke-width:1;vector-effect:non-scaling-stroke}.ti-line-chart line.baseline{stroke:#5E8019;stroke-width:1.5;stroke-dasharray:6 5;vector-effect:non-scaling-stroke}.ti-line-marker{position:absolute;z-index:8;width:11px;height:11px;border-radius:50%;background:#fff;border:3px solid #0067AC;box-shadow:0 2px 8px rgba(36,49,59,.28);transform:translate(-50%,-50%);pointer-events:none}.ti-y-label{position:absolute;z-index:3;left:0;transform:translateY(-50%);width:38px;text-align:right;color:#7B8790;font-size:8px;pointer-events:none}.ti-x-labels{position:absolute;left:4%;right:1%;bottom:0;display:flex;justify-content:space-between;color:#7B8790;font-size:8px;pointer-events:none}.ti-legend span.baseline{width:15px;height:0;border-top:2px dashed #5E8019;border-radius:0}.ti-line-shell .ti-tooltip{top:10px}@media(max-width:650px){.ti-line-shell{height:270px}.ti-line-shell .ti-line-chart{height:250px}.ti-x-labels span:nth-child(2){display:none}}
      `}</style>
      <style jsx global>{`
        .ti-line-shell{height:auto}.ti-line-canvas{position:relative;height:285px}.ti-line-shell .ti-line-chart{height:100%}@media(max-width:650px){.ti-line-shell{height:auto}.ti-line-canvas{height:250px}.ti-line-shell .ti-line-chart{height:100%}}
      `}</style>
    </div>
  );
}
