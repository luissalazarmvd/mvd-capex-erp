// src/lib/domain/periods.ts
export type Period = {
  period_id: number;      // YYYYMM
  period_label: string;   // Ene_26
  period_start: string;   // YYYY-MM-DD
  period_end: string;     // YYYY-MM-DD
};

export function yyyymmFromDate(d: Date): number {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return y * 100 + m;
}

export function addMonths(yyyymm: number, n: number): number {
  const y0 = Math.floor(yyyymm / 100);
  const m0 = yyyymm % 100;

  const total = (y0 * 12 + (m0 - 1)) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return y * 100 + m;
}

export function shortLabelEs(yyyymm: number): string {
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Set","Oct","Nov","Dic"];
  const y = Math.floor(yyyymm / 100);
  const m = yyyymm % 100;
  const mm = Math.min(Math.max(m, 1), 12);
  return `${months[mm - 1]}_${String(y).slice(2)}`;
}
