// src/lib/validation/budget.ts
export function parseAmount(input: string): number | null {
  const s = String(input ?? "").trim();
  if (!s) return null;

  const norm = s.replace(/\s/g, "").replace(/,/g, "");
  const n = Number(norm);

  if (!Number.isFinite(n)) return null;
  return n;
}

export function isBudgetClass(x: string): x is "ORIG" | "SOC" {
  const v = String(x ?? "").trim().toUpperCase();
  return v === "ORIG" || v === "SOC";
}
