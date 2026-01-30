// src/lib/validation/forecast.ts

import { parseCellKey, isValidPeriodId, isValidWbsCode, parseMoney } from "../domain/rules";

export type ForecastRow = {
  key: string;
  value: string;
};

export type ValidationResult =
  | { ok: true; cleaned: ForecastRow[] }
  | { ok: false; error: string };

export function validateForecastPayload(rows: ForecastRow[]): ValidationResult {
  if (!Array.isArray(rows)) return { ok: false, error: "rows inválido" };

  const cleaned: ForecastRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || typeof r.key !== "string") return { ok: false, error: `Fila ${i + 1}: key inválido` };
    if (typeof r.value !== "string") return { ok: false, error: `Fila ${i + 1}: value inválido` };

    const parts = parseCellKey(r.key);
    if (!parts) return { ok: false, error: `Fila ${i + 1}: key malformado` };

    const { wbs_code, period_id, col } = parts;

    if (!isValidWbsCode(wbs_code)) return { ok: false, error: `Fila ${i + 1}: wbs_code inválido` };
    if (!isValidPeriodId(period_id)) return { ok: false, error: `Fila ${i + 1}: period_id inválido` };
    if (col !== "AMOUNT") return { ok: false, error: `Fila ${i + 1}: col inválida (debe ser AMOUNT)` };

    const n = parseMoney(r.value);
    if (n === null) return { ok: false, error: `Fila ${i + 1}: monto inválido` };

    cleaned.push({ key: `${wbs_code}|${period_id}|AMOUNT`, value: String(n) });
  }

  return { ok: true, cleaned };
}
