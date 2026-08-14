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

function DateFields({
  from,
  to,
  max,
  setFrom,
  setTo,
}: {
  from: string;
  to: string;
  max: string;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
}) {
  return (
    <div className="ti-controls">
      <label className="ti-field">
        <span>Desde</span>
        <input type="date" min="2026-01-01" max={max} value={from} onChange={(event) => setFrom(event.target.value)} />
      </label>
      <label className="ti-field">
        <span>Hasta</span>
        <input type="date" min="2026-01-01" max={max} value={to} onChange={(event) => setTo(event.target.value)} />
      </label>
    </div>
  );
}

function Kpis({ result }: { result: ProjectResult }) {
  const items = [
    ["Trabajo anterior · HH/mes", `${number(result.avgBefore, 2)} HH/mes`, "Promedio mensual previo a la implementación", "gold"],
    ["Trabajo actual · HH/mes", `${number(result.avgCurrent, 2)} HH/mes`, "Promedio mensual posterior a la implementación", "cyan"],
    ["Optimización · %", percent(result.optimization), "Reducción posterior vs. equivalente anterior", "green"],
    ["Costo laboral ahorrado · USD/mes", money(result.avgUsd), "Ritmo promedio posterior", "green"],
    ["Ahorro anualizado · USD/año", money(result.avgUsd * 12), "Ritmo mensual × 12", "green"],
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

function Comparison({ result, note }: { result: ProjectResult; note: string }) {
  return (
    <div className="ti-compare">
      <div className="ti-compare-head">
        <strong>Antes vs. actual</strong>
        <span>{note}</span>
      </div>
      <div className="ti-compare-grid">
        <div className="ti-compare-box">
          <div className="ti-label">Antes de la implementación</div>
          <div className="ti-compare-value">{number(result.avgBefore, 2)} HH/mes</div>
          <div className="ti-sub">Carga mensual promedio del proceso anterior</div>
        </div>
        <div className="ti-compare-box current">
          <div className="ti-label">Proceso actual</div>
          <div className="ti-compare-value">{number(result.avgCurrent, 2)} HH/mes</div>
          <div className="ti-sub">Carga mensual promedio dentro del alcance</div>
        </div>
        <div className="ti-compare-box good">
          <div className="ti-label">Optimización</div>
          <div className="ti-compare-value">{percent(result.optimization)}</div>
          <div className="ti-sub">{number(result.avgSaved, 2)} HH/mes · {money(result.avgUsd)}/mes</div>
        </div>
      </div>
    </div>
  );
}

function MonthlyChart({ points, title }: { points: ChartPoint[]; title: string }) {
  const max = Math.max(1, ...points.flatMap((point) => [point.legacy || 0, point.current || 0]));
  return (
    <div className="ti-chart-card">
      <div className="ti-chart-title">{title}</div>
      <div className="ti-chart-sub">Dorado = equivalente anterior · Azul = carga actual</div>
      {points.length ? (
        <div className="ti-chart" role="img" aria-label={title}>
          {points.map((point) => (
            <div className="ti-chart-column" key={point.month} title={`${point.month}: ${number(point.legacy, 2)} / ${number(point.current ?? Number.NaN, 2)} HH`}>
              <div className="ti-bars">
                <span className="legacy" style={{ height: `${Math.max(2, (point.legacy / max) * 100)}%` }} />
                <span className="current" style={{ height: `${point.current === null ? 0 : Math.max(2, (point.current / max) * 100)}%` }} />
              </div>
              <small>{point.month.slice(5)}</small>
            </div>
          ))}
        </div>
      ) : (
        <div className="ti-empty">No hay datos para el rango seleccionado.</div>
      )}
      <div className="ti-legend"><span className="legacy" /> Proceso anterior <span className="current" /> Proceso actual</div>
    </div>
  );
}

function MonthlyTable({ rows }: { rows: MonthlyRow[] }) {
  return (
    <div className="ti-table-box">
      <div className="ti-table-head"><strong>Antes vs. actual por mes</strong><span>{rows.length} periodo(s)</span></div>
      <div className="ti-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mes</th><th>Periodo</th><th>Base de carga</th><th>Anterior HH</th><th>Anterior USD</th>
              <th>Actual HH</th><th>Actual USD</th><th>Ahorrado HH</th><th>Ahorrado USD</th>
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
            <div className="ti-project-meta">Fuente: {source} · Inicio: {implementation}</div>
            <span className={`ti-status ${rowCount || source === "Supuestos validados" ? "ok" : "bad"}`}>
              {source === "Supuestos validados" ? "Supuestos validados" : `${number(rowCount)} registros`}
            </span>
          </div>
        </div>
        <div className="ti-summary-metric"><div className="ti-label">HH ahorradas · periodo posterior</div><div className="ti-summary-value">{number(result.totalSaved, 2)} HH</div></div>
        <div className="ti-summary-metric"><div className="ti-label">Optimización</div><div className="ti-summary-value good">{percent(result.optimization)}</div></div>
        <div className="ti-summary-metric"><div className="ti-label">USD ahorrados · periodo</div><div className="ti-summary-value">{money(result.totalUsd)}</div></div>
        <div className="ti-summary-metric"><div className="ti-label">USD ahorrados / mes</div><div className="ti-summary-value">{money(result.avgUsd)}</div></div>
        <div className="ti-chevron">⌄</div>
      </summary>
      <div className="ti-project-body">
        <div className="ti-lead"><h3>{name}</h3><p>{description}</p></div>
        <div className="ti-context">
          <div><span>Área</span><strong>{area}</strong></div>
          <div><span>Key User</span><strong>{keyUser}</strong></div>
          <div className="description"><span>Solución implementada</span><strong>{solution}</strong></div>
        </div>
        {controls}
        <Kpis result={result} />
        <Comparison result={result} note={note} />
        {extra}
        <MonthlyChart points={result.chart} title={chartTitle} />
        <MonthlyTable rows={result.rows} />
        <div className="ti-method"><strong>Método.</strong> {method}</div>
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

function DelayChart({ rows, baseline }: { rows: EntriesRow[]; baseline: number }) {
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
  const max = Math.max(1, baseline / 3600 || 0, ...values);
  const points = daily.map((item, index) => `${daily.length === 1 ? 50 : (index / (daily.length - 1)) * 100},${100 - (item.value / max) * 88}`).join(" ");
  const baselineY = 100 - ((baseline / 3600) / max) * 88;
  return (
    <div className="ti-chart-card">
      <div className="ti-chart-title">Demora promedio de carga · antes vs. después</div>
      <div className="ti-chart-sub">Demora diaria observada en horas; la línea verde representa la referencia fija anterior.</div>
      {daily.length ? (
        <svg className="ti-line-chart" viewBox="0 0 100 105" preserveAspectRatio="none" role="img" aria-label="Demora diaria de carga">
          <line x1="0" x2="100" y1={baselineY} y2={baselineY} className="baseline" />
          <polyline points={points} />
        </svg>
      ) : <div className="ti-empty">No hay demoras válidas para el rango seleccionado.</div>}
    </div>
  );
}

function CdmProject({ rows, open, onToggle, onResult }: { rows: EntriesRow[]; open: boolean; onToggle: (open: boolean) => void; onResult: (metric: PortfolioMetric) => void }) {
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
      if (pre.length) monthly.push({ month, period: end < CUT.cdm ? "Antes de implementación" : "Antes · 01–19 jul", workload: `${new Set(pre.map((row) => row.lot)).size} lotes`, beforeMh: preActual.mh, beforeUsd: preActual.usd, currentMh: null, currentUsd: null, savedMh: null, savedUsd: null, segment: "before", fullSegment: start >= from && end <= to && end < CUT.cdm });
      if (post.length) monthly.push({ month, period: start >= CUT.cdm ? "Actual" : "Actual · desde 20 jul", workload: `${new Set(post.map((row) => row.lot)).size} lotes`, beforeMh: postLegacy.mh, beforeUsd: postLegacy.usd, currentMh: postActual.mh, currentUsd: postActual.usd, savedMh: postLegacy.mh - postActual.mh, savedUsd: postLegacy.usd - postActual.usd, segment: "current", fullSegment: start >= CUT.cdm && start >= from && end <= to });
      chart.push({ month, legacy: preActual.mh + postLegacy.mh, current: pre.length || post.length ? preActual.mh + postActual.mh : null, volume: new Set([...pre, ...post].map((row) => row.lot)).size });
    });
    const result = finishResult(monthly, chart, "Demora promedio de carga", `${duration(beforeClean.average)} → ${duration(afterClean.average)}`, `${beforeClean.outliers.length + afterClean.outliers.length} día(s) atípico(s) excluido(s)`);
    result.avgUsd = averageRun(monthly, "savedMh", "current");
    const fullCurrent = monthly.filter((row) => row.segment === "current" && row.fullSegment && row.savedUsd !== null);
    const anyCurrent = monthly.filter((row) => row.segment === "current" && row.savedUsd !== null);
    result.avgUsd = mean((fullCurrent.length ? fullCurrent : anyCurrent).map((row) => Number(row.savedUsd)));
    return { result, base: base.filter((row) => row.entryDate && row.entryDate >= from && row.entryDate <= to), baseline: beforeClean.average };
  }, [rows, range.from, range.to, latest, department, miner, rates]);
  useEffect(() => reportMetric(onResult, calculation.result), [calculation.result, onResult]);

  const controls = <>
    <DateFields {...range} />
    <div className="ti-controls">
      <label className="ti-field"><span>Departamento</span><select value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">Todos</option>{departments.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="ti-field"><span>Minero</span><select value={miner} onChange={(event) => setMiner(event.target.value)}><option value="">Todos</option>{miners.map((value) => <option key={value}>{value}</option>)}</select></label>
    </div>
    <div className="ti-controls assumptions">
      <NumberField label="Costo Contabilidad · USD/HH" value={rates.accounting} onChange={(value) => setRates((current) => ({ ...current, accounting: value }))} />
      <NumberField label="Costo Comercial · USD/HH" value={rates.commercial} onChange={(value) => setRates((current) => ({ ...current, commercial: value }))} />
      <NumberField label="Costo Control de Minerales · USD/HH" value={rates.control} onChange={(value) => setRates((current) => ({ ...current, control: value }))} />
      <NumberField label="Tope Control de Minerales · h/persona/día" value={rates.cap} onChange={(value) => setRates((current) => ({ ...current, cap: value }))} />
    </div>
  </>;
  return <ProjectCard name="Entradas y cargas de lotes" icon="↥" area="CDM" keyUser="Carlos Huamán" implementation="20/07/2026" description="Automatización de balanza que crea e inserta el archivo del lote, eliminando el registro manual y su tiempo de espera." solution="El nuevo sistema de balanza crea e inserta automáticamente el archivo de cada ingreso, reduciendo la espera de Contabilidad, Comercial y Control de Minerales." source="GET /api/dti/entries-up" rowCount={rows.length} result={calculation.result} controls={controls} note="Las demoras atípicas se excluyen mediante IQR 1.5× de los KPI y cálculos laborales." chartTitle="Entradas y cargas · HH anteriores vs. actuales por mes" method="El análisis inicia el 01/01/2026 y la implementación el 20/07/2026. La referencia fija usa registros válidos previos al corte. Contabilidad y Comercial consideran 90% de exposición para 3 y 2 personas, con tope de 8 h/persona/día; Control de Minerales se calcula por lote con un tope diario de 2 personas." open={open} onToggle={onToggle} extra={<DelayChart rows={calculation.base} baseline={calculation.baseline} />} />;
}

function FinProject({ rows, open, onToggle, onResult }: { rows: FinanceRow[]; open: boolean; onToggle: (open: boolean) => void; onResult: (metric: PortfolioMetric) => void }) {
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
        monthly.push({ month, period: "Antes de implementación", workload: `${volume.entered} / ${volume.commercial} / ${volume.review}`, beforeMh, beforeUsd, currentMh: null, currentUsd: null, savedMh: null, savedUsd: null, segment: "before", fullSegment: start >= from && end <= to });
        chart.push({ month, legacy: beforeMh, current: beforeMh, volume: volume.entered });
      } else {
        const commercialNow = volume.commercial * newCommercialPerLot;
        const controlNow = volume.review * newReviewPerLot;
        const currentMh = commercialNow + controlNow;
        const currentUsd = commercialNow * a.commercialRate + controlNow * a.controlRate;
        monthly.push({ month, period: "Actual", workload: `${volume.entered} / ${volume.commercial} / ${volume.review}`, beforeMh, beforeUsd, currentMh, currentUsd, savedMh: beforeMh - currentMh, savedUsd: beforeUsd - currentUsd, segment: "current", fullSegment: start >= CUT.fin && start >= from && end <= to && end <= dataEnd });
        chart.push({ month, legacy: beforeMh, current: currentMh, volume: volume.entered });
      }
    });
    const calculated = finishResult(monthly, chart, "Base de carga", `${sum(chart.map((item) => item.volume || 0))} lotes ingresados`, "Ingresados / Comercial / revisión CDM");
    const fullCurrent = monthly.filter((row) => row.segment === "current" && row.fullSegment);
    calculated.avgUsd = mean((fullCurrent.length ? fullCurrent : monthly.filter((row) => row.segment === "current")).map((row) => Number(row.savedUsd)));
    return calculated;
  }, [rows, range.from, range.to, latest, a]);
  useEffect(() => reportMetric(onResult, result), [result, onResult]);
  const controls = <><DateFields {...range} /><div className="ti-controls assumptions">
    <NumberField label="Costo Finance · USD/HH" value={a.financeRate} onChange={(value) => setA((c) => ({ ...c, financeRate: value }))} />
    <NumberField label="Costo Comercial · USD/HH" value={a.commercialRate} onChange={(value) => setA((c) => ({ ...c, commercialRate: value }))} />
    <NumberField label="Costo Control de Minerales · USD/HH" value={a.controlRate} onChange={(value) => setA((c) => ({ ...c, controlRate: value }))} />
    <NumberField label="Preparación anterior Finance · HH/mes" value={a.financeOld} step={0.25} onChange={(value) => setA((c) => ({ ...c, financeOld: value }))} />
    <NumberField label="Personas Comercial" value={a.people} step={1} onChange={(value) => setA((c) => ({ ...c, people: Math.max(1, value) }))} />
    <NumberField label="Esfuerzo anterior Comercial · h/persona/mes" value={a.commercialOld} step={0.25} onChange={(value) => setA((c) => ({ ...c, commercialOld: value }))} />
    <NumberField label="Esfuerzo actual Comercial · h/persona/mes" value={a.commercialNew} step={0.05} onChange={(value) => setA((c) => ({ ...c, commercialNew: value }))} />
    <NumberField label="Esfuerzo anterior CDM · HH/mes" value={a.controlOld} step={0.25} onChange={(value) => setA((c) => ({ ...c, controlOld: value }))} />
    <NumberField label="Esfuerzo actual CDM · HH/mes" value={a.controlNew} step={0.25} onChange={(value) => setA((c) => ({ ...c, controlNew: value }))} />
  </div></>;
  return <ProjectCard name="Control de valorización y pagos" icon="$" area="Finance, CDM y Comercial" keyUser="Carlos Huamán" implementation="01/04/2026" description="Trazabilidad integrada de la valorización y pago de lotes, comparando la carga anterior con el proceso automatizado." solution="Los datos de SGM, Concar y Comercial se integraron en un reporte validado que brinda trazabilidad de extremo a extremo de los lotes pagados." source="GET /api/dti/trace-fin" rowCount={rows.length} result={result} controls={controls} note="Los ahorros posteriores usan los volúmenes mensuales reales de cada etapa valorizados bajo ambos procesos." chartTitle="Valorización y pagos · HH anteriores vs. actuales por mes" method="El histórico inicia el 01/01/2026 y la implementación el 01/04/2026. Finance anterior usa una preparación mensual editable; Comercial y Control de Minerales se convierten a HH/lote con su productividad media previa y posterior. La revisión de CDM requiere valuation_date y doc_number." open={open} onToggle={onToggle} />;
}

function FcsProject({ rows, open, onToggle, onResult }: { rows: FcsRow[]; open: boolean; onToggle: (open: boolean) => void; onResult: (metric: PortfolioMetric) => void }) {
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
      const workload = `${number(referenceLots)} (${number(referenceLots * 0.95)}–${number(referenceLots * 1.05)}) lotes ref.`;
      if (preDays > 0) monthly.push({ month, period: "Antes de implementación", workload, beforeMh: beforePre, beforeUsd: beforePre * effectiveRate, currentMh: null, currentUsd: null, savedMh: null, savedUsd: null, segment: "before", fullSegment: false });
      if (postDays > 0) monthly.push({ month, period: month === "2026-01" ? "Actual · desde 19 ene" : "Actual", workload, beforeMh: beforePost, beforeUsd: beforePost * effectiveRate, currentMh: 0, currentUsd: 0, savedMh: beforePost, savedUsd: beforePost * effectiveRate, segment: "current", fullSegment: postDays === end.getDate() });
      chart.push({ month, legacy: beforePre + beforePost, current: beforePre, volume: referenceLots });
    });
    return finishResult(monthly, chart, "Volumen representativo", `${number(referenceLots)} lotes/mes`, `${number(referenceLots * 0.95)}–${number(referenceLots * 1.05)} lotes/mes · ±5%`, { avgBefore: monthlyRun, avgCurrent: 0, avgSaved: monthlyRun, avgUsd: monthlyUsd, optimization: 100 });
  }, [rows, range.from, range.to, latest, a]);
  useEffect(() => reportMetric(onResult, result), [result, onResult]);
  const controls = <><DateFields {...range} /><div className="ti-controls assumptions">
    <NumberField label="Costo Finance · USD/HH" value={a.finance} onChange={(value) => setA((c) => ({ ...c, finance: value }))} />
    <NumberField label="Costo Comercial · USD/HH" value={a.commercial} onChange={(value) => setA((c) => ({ ...c, commercial: value }))} />
    <NumberField label="Costo Control de Minerales · USD/HH" value={a.control} onChange={(value) => setA((c) => ({ ...c, control: value }))} />
    <NumberField label="Ciclo anterior · HH/semana" value={a.weekly} step={0.25} onChange={(value) => setA((c) => ({ ...c, weekly: value }))} />
  </div></>;
  return <ProjectCard name="Proyección de pago de lotes" icon="F" area="Finance" keyUser="Daniel Pajuelo" implementation="19/01/2026" description="Proyección semanal automatizada de pagos de mineral usando un volumen representativo de stock y lógica integrada de pagos y valorización." solution="Los lotes no pagados se concilian automáticamente con Concar y se valorizan para proyectar obligaciones y sustentar la solicitud semanal de fondos." source="GET /api/dti/fcs-non" rowCount={rows.length} result={result} controls={controls} note="La vista es un stock actual; el máximo mensual de lotes distintos define solo el volumen operativo representativo." chartTitle="Proyección de pago · HH anteriores vs. actuales por mes" method="El análisis inicia el 01/01/2026 y la implementación el 19/01/2026. El ciclo semanal editable se prorratea por días calendario. La preparación actual dentro del alcance es cero; la revisión y gestión restante de Finance está fuera del alcance de esta automatización." open={open} onToggle={onToggle} />;
}

function LogProject({ rows, open, onToggle, onResult }: { rows: LogisticsRow[]; open: boolean; onToggle: (open: boolean) => void; onResult: (metric: PortfolioMetric) => void }) {
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
        monthly.push({ month, period: "Antes de implementación", workload: `${buyers} compradores · ${pre.length} RQ`, beforeMh: before, beforeUsd: before * a.rate, currentMh: null, currentUsd: null, savedMh: null, savedUsd: null, segment: "before", fullSegment: start >= from && end <= to });
        chart.push({ month, legacy: before, current: before, volume: pre.length });
      } else if (start >= CUT.log) {
        const before = prepFull + postReview;
        monthly.push({ month, period: "Actual", workload: `${buyers} compradores · ${post.length} RQ`, beforeMh: before, beforeUsd: before * a.rate, currentMh: 0, currentUsd: 0, savedMh: before, savedUsd: before * a.rate, segment: "current", fullSegment: start >= from && end <= to && end <= dataEnd });
        chart.push({ month, legacy: before, current: 0, volume: post.length });
      } else {
        const before = prepFull + preReview;
        if (pre.length) monthly.push({ month, period: "Antes · 01–10 may", workload: `${buyers} compradores · ${pre.length} RQ`, beforeMh: before, beforeUsd: before * a.rate, currentMh: null, currentUsd: null, savedMh: null, savedUsd: null, segment: "before", fullSegment: false });
        if (post.length) monthly.push({ month, period: "Actual · desde 11 may", workload: `${post.length} RQ`, beforeMh: postReview, beforeUsd: postReview * a.rate, currentMh: 0, currentUsd: 0, savedMh: postReview, savedUsd: postReview * a.rate, segment: "current", fullSegment: false });
        chart.push({ month, legacy: prepFull + preReview + postReview, current: before, volume: selected.length });
      }
    });
    const selectedRows = rows.filter((row) => row.reqDate && row.reqDate >= from && row.reqDate <= to);
    const calculated = finishResult(monthly, chart, "Base de carga", `${new Set(selectedRows.map((row) => row.responsible).filter(Boolean)).size} compradores`, `${selectedRows.length} filas RQ`);
    const fullCurrent = monthly.filter((row) => row.segment === "current" && row.fullSegment);
    calculated.avgUsd = mean((fullCurrent.length ? fullCurrent : monthly.filter((row) => row.segment === "current")).map((row) => Number(row.savedUsd)));
    return calculated;
  }, [rows, range.from, range.to, latest, a]);
  useEffect(() => reportMetric(onResult, result), [result, onResult]);
  const controls = <><DateFields {...range} /><div className="ti-controls assumptions">
    <NumberField label="Costo comprador Logística · USD/HH" value={a.rate} onChange={(value) => setA((c) => ({ ...c, rate: value }))} />
    <NumberField label="Preparación anterior · h/comprador/mes" value={a.prep} step={0.25} onChange={(value) => setA((c) => ({ ...c, prep: value }))} />
    <NumberField label="Revisión anterior · min/fila RQ" value={a.review} step={0.25} onChange={(value) => setA((c) => ({ ...c, review: value }))} />
  </div></>;
  return <ProjectCard name="Trazabilidad logística" icon="⇄" area="Logística" keyUser="Joel Morales" implementation="11/05/2026" description="Trazabilidad integrada desde la requisición hasta la orden de compra, con una vista preparada automáticamente para cada comprador." solution="Las requisiciones se integraron con responsables, órdenes, fechas, cantidades, recepciones parciales, estados y almacenes para agilizar el seguimiento." source="GET /api/dti/trace-log" rowCount={rows.length} result={result} controls={controls} note="La carga anterior usa responsables distintos como compradores y todas las filas como trabajo de revisión." chartTitle="Trazabilidad logística · HH anteriores vs. actuales por mes" method="El histórico inicia el 01/01/2026 y la implementación el 11/05/2026. El esfuerzo anterior mensual equivale a compradores distintos × horas de preparación + filas RQ × minutos de revisión. En mayo se considera que la preparación mensual ya había ocurrido antes del corte; desde junio la preparación y revisión actuales dentro del alcance son cero." open={open} onToggle={onToggle} />;
}

function RoProject({ open, onToggle, onResult }: { open: boolean; onToggle: (open: boolean) => void; onResult: (metric: PortfolioMetric) => void }) {
  const [rate, setRate] = useState(10);
  const result = useMemo(() => {
    const monthly: MonthlyRow[] = [], chart: ChartPoint[] = [];
    monthsFrom(ANALYSIS_START, new Date()).forEach((month) => {
      const { end } = monthBounds(month);
      if (end < CUT.ro) {
        monthly.push({ month, period: "Antes de implementación", workload: "Alcance validado de preparación Compliance", beforeMh: 136, beforeUsd: 136 * rate, currentMh: null, currentUsd: null, savedMh: null, savedUsd: null, segment: "before", fullSegment: true });
        chart.push({ month, legacy: 136, current: 136 });
      } else {
        monthly.push({ month, period: "Actual", workload: "Alcance validado de preparación Compliance", beforeMh: 136, beforeUsd: 136 * rate, currentMh: 30, currentUsd: 30 * rate, savedMh: 106, savedUsd: 106 * rate, segment: "current", fullSegment: true });
        chart.push({ month, legacy: 136, current: 30 });
      }
    });
    return finishResult(monthly, chart, "Alcance validado", "136 → 30 HH/mes", "Revisión final del RO excluida", { avgBefore: 136, avgCurrent: 30, avgSaved: 106, avgUsd: 106 * rate, optimization: (106 / 136) * 100 });
  }, [rate]);
  useEffect(() => reportMetric(onResult, result), [result, onResult]);
  const activityTable = <div className="ti-table-box ti-activity"><div className="ti-table-head"><strong>Base de actividades validada por Compliance</strong><span>Equivalente mensual</span></div><div className="ti-table-wrap"><table><thead><tr><th>Actividad</th><th>Anterior HH/mes</th><th>Actual HH/mes</th><th>Cambio</th></tr></thead><tbody><tr><td>Preparación Excel y actualización RO</td><td>44.00</td><td>22.00</td><td className="ti-total">-22.00</td></tr><tr><td>Archivos manuales de proveedores/contabilidad</td><td>88.00</td><td>0.00</td><td className="ti-total">-88.00</td></tr><tr><td>Anexos de cierre de mes</td><td>4.00</td><td>8.00</td><td>+4.00</td></tr><tr><td><strong>Total dentro del alcance</strong></td><td><strong>136.00</strong></td><td><strong>30.00</strong></td><td className="ti-total"><strong>-106.00</strong></td></tr></tbody></table></div></div>;
  return <ProjectCard name="RO" icon="✓" area="Compliance" keyUser="Santiago Jacobo" implementation="01/04/2026" description="Generación automatizada de reportes RO de compras y ventas de mineral, reduciendo el riesgo de error manual y liberando capacidad de revisión." solution="La información de Concar, SGM, GEOCATMIN y tablas de soporte se integró para automatizar los reportes y brindar trazabilidad por lote de proveedor a cliente." source="Supuestos validados" rowCount={0} result={result} controls={<div className="ti-controls assumptions"><NumberField label="Costo Compliance · USD/HH" value={rate} onChange={setRate} /></div>} note="Solo la preparación del reporte y el armado manual de datos están dentro del alcance; la revisión final permanece en Compliance." chartTitle="RO · HH anteriores vs. actuales por mes" method="La preparación validada dentro del alcance es 44→22 + 88→0 + 4→8 = 136→30 HH/mes: 106 HH/mes ahorradas. El ahorro mensual en USD equivale a 106 × costo horario y el anualizado al resultado mensual × 12." open={open} onToggle={onToggle} extra={activityTable} />;
}

export default function TiPage() {
  const router = useRouter();
  const [data, setData] = useState<{ entries: EntriesRow[]; finance: FinanceRow[]; fcs: FcsRow[]; logistics: LogisticsRow[] }>({ entries: [], finance: [], fcs: [], logistics: [] });
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [open, setOpen] = useState<Record<ProjectKey, boolean>>({ cdm: false, fin: false, fcs: false, log: false, ro: false });
  const [metrics, setMetrics] = useState<Partial<Record<ProjectKey, PortfolioMetric>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const endpoints = [
      ["entries", "/api/dti/entries-up"], ["finance", "/api/dti/trace-fin"], ["fcs", "/api/dti/fcs-non"], ["logistics", "/api/dti/trace-log"],
    ] as const;
    const responses = await Promise.allSettled(endpoints.map(([, path]) => apiGet(path)));
    const next = { entries: [] as EntriesRow[], finance: [] as FinanceRow[], fcs: [] as FcsRow[], logistics: [] as LogisticsRow[] };
    const nextErrors: string[] = [];
    responses.forEach((response, index) => {
      const [key, path] = endpoints[index];
      if (response.status === "rejected") { nextErrors.push(`${path}: ${response.reason instanceof Error ? response.reason.message : "error de conexión"}`); return; }
      const raw = Array.isArray(response.value?.rows) ? response.value.rows as Array<Record<string, unknown>> : [];
      if (key === "entries") next.entries = raw.map((row) => { const entryDatetime = toDate(row.entry_datetime), uploadDatetime = toDate(row.upload_datetime); return { entryDate: toDate(row.entry_date) || entryDatetime, entryDatetime, uploadDatetime, lot: text(row.lot_number), miner: text(row.miner), department: text(row.department), delaySeconds: entryDatetime && uploadDatetime ? (uploadDatetime.getTime() - entryDatetime.getTime()) / 1000 : Number.NaN }; }).filter((row) => (row.lot || row.entryDate) && (!row.entryDate || row.entryDate >= ANALYSIS_START));
      if (key === "finance") next.finance = raw.map((row) => ({ lot: text(row.lot), entryDate: toDate(row.entry_date), valuationDate: toDate(row.valuation_date), docDate: toDate(row.doc_date), hasAu: has(row.au_usd), hasDoc: has(row.doc_number) })).filter((row) => (row.lot || row.entryDate) && (!row.entryDate || row.entryDate >= ANALYSIS_START));
      if (key === "fcs") next.fcs = raw.map((row) => ({ lot: text(row.lot), entryDate: toDate(row.entry_date) })).filter((row) => (row.lot || row.entryDate) && (!row.entryDate || row.entryDate >= ANALYSIS_START));
      if (key === "logistics") next.logistics = raw.map((row) => ({ reqDate: toDate(row.req_date), responsible: text(row.responsible) })).filter((row) => row.reqDate && row.reqDate >= ANALYSIS_START);
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

  const portfolio = useMemo(() => {
    const valid = Object.values(metrics).filter((metric): metric is PortfolioMetric => Boolean(metric && Number.isFinite(metric.avgSaved) && Number.isFinite(metric.avgUsd)));
    return { mh: sum(valid.map((metric) => metric.avgSaved)), usd: sum(valid.map((metric) => metric.avgUsd)) };
  }, [metrics]);

  const logout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } finally { router.push("/"); router.refresh(); }
  };

  return (
    <div className="ti-dashboard">
      <header className="ti-header"><div className="ti-stripe"><span /><span /></div><div className="ti-header-inner"><div><div className="ti-eyebrow">Veta Dorada · Excelencia Operacional</div><h1>Eficiencia Operacional TI</h1><p>Portafolio de cinco iniciativas · optimización de trabajo antes vs. actual</p></div><div className="ti-actions"><span className={`ti-live ${errors.length ? "warning" : ""}`}>{loading ? "Actualizando datos…" : errors.length ? `${errors.length} fuente(s) con error` : "Datos API actualizados"}</span><button onClick={() => void load()} disabled={loading}>Actualizar</button><button className="primary" onClick={logout}>Salir</button></div></div></header>
      <main className="ti-main">
        {errors.length ? <div className="ti-error"><strong>No se pudieron cargar todas las fuentes.</strong>{errors.map((error) => <div key={error}>{error}</div>)}</div> : null}
        <section className="ti-portfolio">
          <div className="ti-portfolio-head"><div><h2>Resumen de ahorros del portafolio</h2><p>Vista estandarizada de la carga laboral anterior, la carga actual dentro del alcance y el esfuerzo evitado. Los datos se consultan directamente desde las vistas DTI; no se carga ni procesa Excel.</p></div><div className="ti-actions"><button onClick={() => setOpen({ cdm: true, fin: true, fcs: true, log: true, ro: true })}>Expandir todo</button><button onClick={() => setOpen({ cdm: false, fin: false, fcs: false, log: false, ro: false })}>Contraer todo</button></div></div>
          <div className="ti-portfolio-grid"><div><span>HH promedio ahorradas / mes</span><strong>{number(portfolio.mh, 2)} HH/mes</strong></div><div className="green"><span>Costo laboral ahorrado / mes</span><strong>{money(portfolio.usd)}</strong></div><div className="gold"><span>Ahorro laboral anualizado</span><strong>{money(portfolio.usd * 12)}</strong></div></div>
          <div className="ti-source-status"><span className={data.entries.length ? "ok" : "bad"}>entries-up · {number(data.entries.length)} filas</span><span className={data.finance.length ? "ok" : "bad"}>trace-fin · {number(data.finance.length)} filas</span><span className={data.fcs.length ? "ok" : "bad"}>fcs-non · {number(data.fcs.length)} filas</span><span className={data.logistics.length ? "ok" : "bad"}>trace-log · {number(data.logistics.length)} filas</span><span className="ok">RO · supuestos validados</span></div>
          {updatedAt ? <div className="ti-updated">Última consulta: {updatedAt.toLocaleString("es-PE")}</div> : null}
        </section>
        <CdmProject rows={data.entries} open={open.cdm} onToggle={(value) => setOpen((current) => ({ ...current, cdm: value }))} onResult={(metric) => updateMetric("cdm", metric)} />
        <FinProject rows={data.finance} open={open.fin} onToggle={(value) => setOpen((current) => ({ ...current, fin: value }))} onResult={(metric) => updateMetric("fin", metric)} />
        <FcsProject rows={data.fcs} open={open.fcs} onToggle={(value) => setOpen((current) => ({ ...current, fcs: value }))} onResult={(metric) => updateMetric("fcs", metric)} />
        <LogProject rows={data.logistics} open={open.log} onToggle={(value) => setOpen((current) => ({ ...current, log: value }))} onResult={(metric) => updateMetric("log", metric)} />
        <RoProject open={open.ro} onToggle={(value) => setOpen((current) => ({ ...current, ro: value }))} onResult={(metric) => updateMetric("ro", metric)} />
        <footer>Veta Dorada · Dashboard conectado a las vistas de Eficiencia Operacional DTI</footer>
      </main>
      <style jsx global>{`
        .ti-dashboard{--blue:#0067AC;--gold:#C69214;--cyan:#00A5CE;--green:#5E8019;--orange:#D85D27;--ink:#24313B;--muted:#6B7280;--line:#DDE5EA;min-height:100vh;background:#F2F5F7;color:var(--ink);font-family:var(--font-exo),Exo,Arial,sans-serif}.ti-dashboard *{box-sizing:border-box}.ti-header{background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:20}.ti-stripe{height:7px;display:grid;grid-template-columns:2fr 1fr}.ti-stripe span:first-child{background:var(--blue)}.ti-stripe span:last-child{background:var(--gold)}.ti-header-inner,.ti-main{max-width:1600px;margin:auto}.ti-header-inner{padding:15px 26px;display:flex;justify-content:space-between;align-items:center;gap:16px}.ti-eyebrow{color:var(--blue);font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.ti-header h1{margin:3px 0 0;color:var(--blue);font-size:clamp(24px,2.4vw,36px)}.ti-header p{margin:5px 0 0;color:var(--muted);font-size:13px}.ti-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ti-dashboard button,.ti-dashboard input,.ti-dashboard select{font:inherit;border:1px solid #C9D5DC;background:#fff;color:var(--ink);border-radius:9px;padding:9px 11px;font-size:12px;outline:none}.ti-dashboard button{cursor:pointer;font-weight:800}.ti-dashboard button:disabled{cursor:wait;opacity:.55}.ti-dashboard button.primary{background:var(--blue);border-color:var(--blue);color:#fff}.ti-live{border:1px solid rgba(94,128,25,.3);background:rgba(94,128,25,.08);color:#2F6B19;border-radius:999px;padding:8px 11px;font-size:11px;font-weight:800}.ti-live.warning{border-color:rgba(216,93,39,.3);background:rgba(216,93,39,.08);color:#AA431B}.ti-main{padding:22px 26px 42px}.ti-error{background:#FFF6F2;border:1px solid #E9B8A4;color:#9A3D18;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:11px;line-height:1.6}.ti-error strong{display:block}.ti-portfolio,.ti-project{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 12px 30px rgba(20,47,66,.08)}.ti-portfolio{padding:18px;margin-bottom:18px;border-top:5px solid var(--gold)}.ti-portfolio-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.ti-portfolio h2{margin:0;color:var(--blue);font-size:20px}.ti-portfolio-head p{margin:5px 0 0;color:var(--muted);font-size:11px;line-height:1.5;max-width:900px}.ti-portfolio-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.ti-portfolio-grid>div{border:1px solid var(--line);border-radius:12px;padding:13px;background:#FBFCFD}.ti-portfolio-grid span,.ti-label{font-size:9px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.04em}.ti-portfolio-grid strong{display:block;font-size:22px;color:var(--blue);margin-top:5px}.ti-portfolio-grid .green strong{color:#2F6B19}.ti-portfolio-grid .gold strong{color:#9A700C}.ti-source-status{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.ti-source-status span,.ti-status{border-radius:999px;padding:6px 9px;font-size:9px;font-weight:800}.ti-source-status .ok,.ti-status.ok{background:rgba(94,128,25,.08);color:#2F6B19;border:1px solid rgba(94,128,25,.3)}.ti-source-status .bad,.ti-status.bad{background:rgba(216,93,39,.07);color:#AA431B;border:1px solid rgba(216,93,39,.3)}.ti-updated{text-align:right;color:var(--muted);font-size:9px;margin-top:9px}.ti-project{margin-bottom:14px;overflow:hidden}.ti-project>summary{list-style:none;cursor:pointer;padding:16px 18px;display:grid;grid-template-columns:minmax(300px,1.4fr) repeat(4,minmax(120px,.55fr)) 26px;gap:10px;align-items:center}.ti-project>summary::-webkit-details-marker{display:none}.ti-project[open]>summary{border-bottom:1px solid var(--line);background:#FBFCFD}.ti-project-title{display:flex;gap:12px;align-items:center}.ti-icon{width:42px;height:42px;border-radius:12px;background:rgba(0,103,172,.09);display:grid;place-items:center;color:var(--blue);font-size:20px;font-weight:800;flex:none}.ti-project-name{color:var(--blue);font-weight:800;font-size:16px}.ti-project-meta{font-size:9px;color:var(--muted);margin:4px 0 6px}.ti-summary-metric{border-left:1px solid #EDF1F3;padding-left:12px}.ti-summary-value{font-size:16px;font-weight:800;margin-top:4px;white-space:nowrap}.ti-summary-value.good{color:#2F6B19}.ti-chevron{font-size:22px;color:var(--gold);transition:.2s}.ti-project[open] .ti-chevron{transform:rotate(180deg)}.ti-project-body{padding:18px}.ti-lead h3{margin:0;color:var(--blue);font-size:18px}.ti-lead p{margin:5px 0 14px;color:var(--muted);font-size:11px;line-height:1.5;max-width:1200px}.ti-context{display:grid;grid-template-columns:minmax(180px,.45fr) minmax(180px,.45fr) minmax(0,2fr);gap:10px;margin-bottom:14px}.ti-context>div{border:1px solid var(--line);border-radius:11px;background:#F8FAFB;padding:11px 12px}.ti-context span,.ti-field span{display:block;font-size:9px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.04em}.ti-context strong{display:block;margin-top:4px;font-size:11px;line-height:1.45}.ti-context .description strong{font-weight:500}.ti-controls{display:flex;gap:9px;flex-wrap:wrap;align-items:end;margin-bottom:10px}.ti-controls.assumptions{margin-bottom:14px}.ti-field{min-width:150px;flex:0 1 205px}.ti-field span{margin:0 0 5px 2px}.ti-field input,.ti-field select{width:100%}.ti-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:14px}.ti-kpi{min-height:103px;position:relative;overflow:hidden;background:#fff;border:1px solid var(--line);border-radius:12px;padding:13px}.ti-kpi:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--blue)}.ti-kpi.gold:before{background:var(--gold)}.ti-kpi.cyan:before{background:var(--cyan)}.ti-kpi.green:before{background:var(--green)}.ti-kpi-value{font-size:19px;font-weight:800;color:var(--blue);margin-top:7px}.ti-kpi.green .ti-kpi-value{color:#2F6B19}.ti-sub{font-size:9px;color:var(--muted);margin-top:4px;line-height:1.4}.ti-compare{border:1px solid var(--line);border-top:4px solid var(--gold);border-radius:12px;background:#FBFCFD;padding:13px;margin-bottom:14px}.ti-compare-head{display:flex;justify-content:space-between;gap:12px}.ti-compare-head strong{color:var(--blue);font-size:13px}.ti-compare-head span{font-size:9px;color:var(--muted);max-width:850px;text-align:right;line-height:1.45}.ti-compare-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:11px}.ti-compare-box{border:1px solid var(--line);border-radius:11px;background:#fff;padding:12px}.ti-compare-value{font-size:20px;color:var(--blue);font-weight:800;margin-top:5px}.ti-compare-box.current .ti-compare-value{color:#007FA0}.ti-compare-box.good .ti-compare-value{color:#2F6B19}.ti-chart-card,.ti-table-box{border:1px solid var(--line);border-radius:12px;background:#fff;overflow:hidden;margin-bottom:12px}.ti-chart-card{padding:13px}.ti-chart-title{font-size:12px;font-weight:800}.ti-chart-sub{font-size:9px;color:var(--muted);margin-top:3px}.ti-chart{height:245px;display:flex;gap:7px;align-items:stretch;border-bottom:1px solid var(--line);padding:14px 8px 0;overflow-x:auto}.ti-chart-column{min-width:34px;flex:1;display:grid;grid-template-rows:1fr 20px;align-items:end;text-align:center}.ti-bars{height:100%;display:flex;gap:2px;align-items:end;justify-content:center}.ti-bars span{width:min(15px,42%);border-radius:3px 3px 0 0}.ti-bars .legacy,.ti-legend .legacy{background:var(--gold)}.ti-bars .current,.ti-legend .current{background:var(--blue)}.ti-chart-column small{font-size:8px;color:var(--muted);padding-top:5px}.ti-legend{font-size:9px;color:var(--muted);display:flex;gap:5px;align-items:center;justify-content:center;padding-top:8px}.ti-legend span{width:9px;height:9px;border-radius:2px;margin-left:8px}.ti-line-chart{width:100%;height:245px;margin-top:10px;background:linear-gradient(to bottom,#fff,#F8FAFB);overflow:visible}.ti-line-chart polyline{fill:none;stroke:var(--blue);stroke-width:1.3;vector-effect:non-scaling-stroke}.ti-line-chart .baseline{stroke:var(--green);stroke-width:1;stroke-dasharray:5 4;vector-effect:non-scaling-stroke}.ti-table-head{padding:11px 13px;background:#F8FAFB;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:10px}.ti-table-head strong{font-size:12px;color:var(--blue)}.ti-table-head span{font-size:9px;color:var(--muted)}.ti-table-wrap{overflow:auto;max-height:340px}.ti-dashboard table{width:100%;border-collapse:collapse;font-size:9px}.ti-dashboard th{position:sticky;top:0;background:#F4F7F9;color:#51616D;padding:9px 10px;text-align:right;white-space:nowrap;z-index:1}.ti-dashboard th:first-child,.ti-dashboard td:first-child{text-align:left}.ti-dashboard td{padding:8px 10px;border-top:1px solid #EDF1F3;text-align:right;white-space:nowrap}.ti-total{font-weight:800;color:#2F6B19}.ti-activity{margin-top:0}.ti-method{margin-top:12px;padding:11px 13px;border-radius:10px;background:#F4F8FA;border:1px solid #DCE8EE;color:#586A76;font-size:10px;line-height:1.55}.ti-empty{text-align:center;padding:60px 20px;color:var(--muted);font-size:11px}.ti-main footer{text-align:center;color:#7B8790;font-size:10px;margin-top:18px}@media(max-width:1250px){.ti-kpis{grid-template-columns:repeat(3,1fr)}.ti-project>summary{grid-template-columns:minmax(260px,1fr) repeat(2,minmax(120px,.5fr)) 26px}.ti-project>summary .ti-summary-metric:nth-of-type(n+4){display:none}}@media(max-width:850px){.ti-header-inner,.ti-portfolio-head,.ti-compare-head{flex-direction:column;align-items:flex-start}.ti-header{position:static}.ti-context{grid-template-columns:1fr}.ti-portfolio-grid,.ti-kpis{grid-template-columns:1fr 1fr}.ti-project>summary{grid-template-columns:1fr 24px}.ti-project>summary .ti-summary-metric{display:none!important}.ti-compare-grid{grid-template-columns:1fr}.ti-main{padding:16px 12px 28px}.ti-header-inner{padding:14px 16px}.ti-compare-head span{text-align:left}}@media(max-width:560px){.ti-portfolio-grid,.ti-kpis{grid-template-columns:1fr}.ti-field{flex:1 1 100%}}
      `}</style>
    </div>
  );
}
