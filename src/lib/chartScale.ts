export type ChartScaleMode = "linear" | "log";

export function canUseLogScale(values: (number | null)[]) {
  const finite = values.filter((value): value is number => value != null && Number.isFinite(value));
  return finite.length > 0 && finite.every((value) => value > 0);
}

export function prefersLogScale(values: (number | null)[]) {
  if (!canUseLogScale(values)) return false;
  const finite = values.filter((value): value is number => value != null && Number.isFinite(value));
  return finite.reduce((a, b) => Math.max(a, b)) / finite.reduce((a, b) => Math.min(a, b)) >= 1000;
}

/** Log base 10 real; la base es positiva y sus etiquetas nunca muestran cero. */
export function logarithmicScale(values: number[]) {
  const positive = values.filter((value) => Number.isFinite(value) && value > 0);
  const low = positive.length ? positive.reduce((a, b) => Math.min(a, b)) : 1;
  const high = positive.length ? positive.reduce((a, b) => Math.max(a, b)) : 10;
  const start = Math.floor(Math.log10(low)) - 1;
  const end = Math.max(start + 1, Math.ceil(Math.log10(high)));
  const step = Math.max(1, Math.ceil((end - start) / 6));
  const powers = Array.from({ length: Math.floor((end - start) / step) + 1 }, (_, i) => start + i * step);
  if (powers.at(-1) !== end) powers.push(end);
  return { min: 10 ** start, max: 10 ** end, ticks: powers.map((power) => 10 ** power), fraction: (value: number) => value > 0 ? (Math.log10(value) - start) / (end - start) : 0 };
}
