export type KardexGuide = {
  guide_number: string;
  [key: string]: string | null;
};
export type KardexLot = KardexGuide & { lot: string; lot_corr: string };
export type KardexInvoice = {
  ruc: string;
  document_number: string;
  document_date: string;
  amount_usd: string;
  amount_usd_con: string | null;
  subledger_num: string | null;
  comp_num: string | null;
  secu_num: string | null;
  transport_name: string | null;
  guide_count: number;
  calculated_amount_usd: string;
  status_name: string;
};

export const invoiceKey = (row: { ruc: string; document_number: string }) =>
  JSON.stringify([row.ruc, row.document_number]);
export const lotKey = (row: {
  lot: string;
  lot_corr: string;
  guide_number: string;
}) => JSON.stringify([row.lot, row.lot_corr, row.guide_number]);
export const isOperationalLot = (row: { lot_corr: string }) =>
  row.lot_corr.trim().toUpperCase() !== "PERD";

export function normalizeInvoiceNumber(value: string) {
  const match = value
    .trim()
    .toUpperCase()
    .match(/^([A-Z0-9]{4})-?(\d{1,10})$/);
  return match ? `${match[1]}-${match[2].padStart(10, "0")}` : "";
}

// Cantidades exactas a seis decimales; evita errores binarios al conciliar USD.
export function kardexUnits(value: unknown): bigint {
  const raw = String(value ?? "").trim();
  if (!/^-?\d+(?:\.\d{1,6})?$/.test(raw)) return BigInt(0);
  const [whole, fraction = ""] = raw.replace(/^-/, "").split(".");
  const amount =
    BigInt(whole) * BigInt(1000000) + BigInt(fraction.padEnd(6, "0"));
  return raw.startsWith("-") ? -amount : amount;
}

export function kardexDecimal(value: bigint) {
  const absolute = value < BigInt(0) ? -value : value;
  return `${value < BigInt(0) ? "-" : ""}${absolute / BigInt(1000000)}.${String(absolute % BigInt(1000000)).padStart(6, "0")}`;
}

export function kardexCents(value: bigint) {
  return value < BigInt(0)
    ? -((-value + BigInt(5000)) / BigInt(10000))
    : (value + BigInt(5000)) / BigInt(10000);
}

export function kardexFormat(value: unknown, digits = 2) {
  if (value == null || value === "" || !Number.isFinite(Number(value)))
    return "—";
  return Number(value).toLocaleString("es-PE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export type KardexPeriod = "day" | "week" | "month";
export function kardexPeriodKey(value: string | null, period: KardexPeriod) {
  const date = (value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Sin fecha";
  if (period === "month") return date.slice(0, 7);
  if (period === "day") return date;
  // Semana de lunes a domingo; UTC preserva la fecha local recibida de SQL.
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() - ((parsed.getUTCDay() + 6) % 7));
  return parsed.toISOString().slice(0, 10);
}

export function kardexStatistics(
  lots: KardexLot[],
  guides: KardexGuide[],
  invoices: KardexInvoice[],
  period: KardexPeriod,
) {
  const uniqueLots = [
    ...new Map(
      lots.filter(isOperationalLot).map((row) => [lotKey(row), row]),
    ).values(),
  ];
  const uniqueGuides = [
    ...new Map(guides.map((row) => [row.guide_number, row])).values(),
  ];
  const uniqueInvoices = [
    ...new Map(invoices.map((row) => [invoiceKey(row), row])).values(),
  ];
  const byPeriod = new Map<
    string,
    {
      label: string;
      guides: number;
      tmh: number;
      entered: number;
      concar: number;
    }
  >();
  const bucket = (key: string) => {
    if (!byPeriod.has(key))
      byPeriod.set(key, {
        label: key,
        guides: 0,
        tmh: 0,
        entered: 0,
        concar: 0,
      });
    return byPeriod.get(key)!;
  };
  const lotsByGuide = new Map<string, Set<string>>();
  for (const row of uniqueLots) {
    if (!lotsByGuide.has(row.guide_number))
      lotsByGuide.set(row.guide_number, new Set());
    lotsByGuide.get(row.guide_number)!.add(row.lot);
  }
  const carriers = new Map<
    string,
    { label: string; guides: number; tmh: number }
  >();
  for (const guide of uniqueGuides) {
    const group = bucket(kardexPeriodKey(guide.departure_date, period));
    group.guides++;
    group.tmh += Number(guide.tmh_departure || 0);
    const ruc = guide.transport_ruc || "Sin transportista";
    if (!carriers.has(ruc))
      carriers.set(ruc, {
        label: guide.transport_name || ruc,
        guides: 0,
        tmh: 0,
      });
    const carrier = carriers.get(ruc)!;
    carrier.guides++;
    carrier.tmh += Number(guide.tmh_departure || 0);
  }
  for (const invoice of uniqueInvoices) {
    const group = bucket(kardexPeriodKey(invoice.document_date, period));
    group.entered += Number(invoice.amount_usd);
    group.concar += Number(invoice.amount_usd_con || 0);
  }
  return {
    guideCount: uniqueGuides.length,
    lotCount: new Set(uniqueLots.map((row) => row.lot)).size,
    lotsPerGuide: uniqueGuides.length
      ? [...lotsByGuide.values()].reduce((n, rows) => n + rows.size, 0) /
        uniqueGuides.length
      : 0,
    tmh: uniqueGuides.reduce(
      (sum, row) => sum + Number(row.tmh_departure || 0),
      0,
    ),
    entered: uniqueInvoices.reduce(
      (sum, row) => sum + kardexUnits(row.amount_usd),
      BigInt(0),
    ),
    concar: uniqueInvoices.reduce(
      (sum, row) => sum + kardexUnits(row.amount_usd_con),
      BigInt(0),
    ),
    unmatched: uniqueInvoices.filter((row) => !row.subledger_num).length,
    closed: uniqueGuides.filter((row) => row.status_name === "CERRADO").length,
    pending: uniqueGuides.filter((row) => !row.document_number).length,
    series: [...byPeriod.values()].sort((a, b) =>
      a.label.localeCompare(b.label),
    ),
    carriers: [...carriers.values()].sort((a, b) => b.tmh - a.tmh),
    lotsByGuide: uniqueGuides
      .map((row) => ({
        label: row.guide_number,
        count: lotsByGuide.get(row.guide_number)?.size || 0,
      }))
      .sort((a, b) => b.count - a.count),
  };
}
