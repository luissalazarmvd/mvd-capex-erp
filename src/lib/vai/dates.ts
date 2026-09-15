import type { VaiDatePreset } from "./spec";

export type VaiDateRange = { from: string; to: string };

export function validIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

/** Recupera un único mes explícito; no interpreta comparaciones ni rangos ambiguos. */
export function requestedMonth(text: string): VaiDateRange | null {
  const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const hits = [...normalized.matchAll(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)\b/g)];
  const years = [...normalized.matchAll(/\b(20\d{2})\b/g)];
  if (hits.length !== 1 || years.length !== 1 || /\b(?:desde|hasta|entre)\b/.test(normalized)) return null;
  const month = months.indexOf(hits[0][1].replace("setiembre", "septiembre")) + 1;
  const year = Number(years[0][1]);
  return { from: `${year}-${String(month).padStart(2, "0")}-01`, to: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) };
}

export function limaToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)?.value).join("-");
}

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export function presetRange(preset: VaiDatePreset, today = limaToday()): VaiDateRange {
  if (preset === "last_7_days") return { from: addDays(today, -6), to: today };
  if (preset === "last_30_days") return { from: addDays(today, -29), to: today };
  if (preset === "year_to_date") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  if (preset === "current_month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (preset === "previous_month") {
    const to = addDays(`${today.slice(0, 7)}-01`, -1);
    return { from: `${to.slice(0, 7)}-01`, to };
  }
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const from = addDays(today, -weekday - (preset === "previous_week" ? 7 : 0));
  return { from, to: preset === "previous_week" ? addDays(from, 6) : today };
}
