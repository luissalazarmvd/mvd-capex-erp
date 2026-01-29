// src/lib/domain/rules.ts

export type MoneyLike = string | number | null | undefined;

export type BudgetClass = "ORIG" | "SOC";
export type MatrixMode = "budget" | "forecast" | "progress";

export type MatrixCol = "AMOUNT" | "ORIG" | "SOC" | "EV_PCT" | "AC";

export type CellKeyParts = {
  wbs_code: string;
  period_id: number; // YYYYMM
  col: MatrixCol | string;
};

export function parseCellKey(key: string): CellKeyParts | null {
  const parts = key.split("|");
  if (parts.length !== 3) return null;

  const wbs_code = parts[0]?.trim();
  const period_id = Number(parts[1]);
  const col = (parts[2] ?? "").trim();

  if (!wbs_code) return null;
  if (!Number.isFinite(period_id)) return null;
  if (!col) return null;

  return { wbs_code, period_id, col };
}

export function isValidPeriodId(period_id: number): boolean {
  if (!Number.isInteger(period_id)) return false;
  if (period_id < 190001 || period_id > 299912) return false;
  const mm = period_id % 100;
  return mm >= 1 && mm <= 12;
}

export function isValidProjectCode(code: string): boolean {
  return /^\d{2}$/.test((code ?? "").trim());
}

export function isValidWbsCode(code: string): boolean {
  return /^\d{2}\.\d{2}$/.test((code ?? "").trim());
}

export function wbsBelongsToProject(wbs_code: string, project_code: string): boolean {
  const w = (wbs_code ?? "").trim();
  const p = (project_code ?? "").trim();
  return isValidWbsCode(w) && isValidProjectCode(p) && w.startsWith(`${p}.`);
}

export function normalizeNumberString(raw: string): string {
  return (raw ?? "").replace(/[^\d\.\-]/g, "");
}

export function parseMoney(raw: MoneyLike): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;

  const s = normalizeNumberString(String(raw)).trim();
  if (!s || s === "-" || s === "." || s === "-.") return null;

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parsePct(raw: MoneyLike): number | null {
  const n = parseMoney(raw);
  if (n === null) return null;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

export function fmtMoney(n: number): string {
  // sin locales para no meter comas raras en inputs; solo string simple
  return String(n);
}

export function fmtPct(n: number): string {
  return String(n);
}

export function buildCellKey(wbs_code: string, period_id: number, col: string): string {
  return `${wbs_code}|${period_id}|${col}`;
}

export function colMode(col: string): "money" | "pct" {
  return col === "EV_PCT" ? "pct" : "money";
}
