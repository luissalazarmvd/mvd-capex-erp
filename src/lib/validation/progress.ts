// src/lib/validation/progress.ts
export function parsePct(input: string): number | null {
  const s = String(input ?? "").trim();
  if (!s) return null;

  const norm = s.replace(/\s/g, "").replace(/,/g, "");
  const n = Number(norm);

  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 100) return null;
  return n;
}

export function parseAmount(input: string): number | null {
  const s = String(input ?? "").trim();
  if (!s) return null;

  const norm = s.replace(/\s/g, "").replace(/,/g, "");
  const n = Number(norm);

  if (!Number.isFinite(n)) return null;
  return n;
}
