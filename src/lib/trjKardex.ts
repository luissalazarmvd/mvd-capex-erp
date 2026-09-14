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
// Lote de limpieza («LIMPIEZA» o «NN-LIMPIEZA»): operativo, sin saldo SGM.
export const isCleanupLot = (lot: string) =>
  /^(?:\d{2}-)?LIMPIEZA$/.test(lot.trim().toUpperCase());

export function normalizeInvoiceNumber(value: string) {
  const match = value
    .trim()
    .toUpperCase()
    .match(/^([A-Z0-9]{4})-?(\d{1,8})$/);
  return match ? `${match[1]}-${match[2].padStart(8, "0")}` : "";
}

// Máscara del número de factura mientras se escribe, igual que el número de
// guía: serie de 4 alfanuméricos, guion y correlativo mostrado con sus ocho
// dígitos. El borrador guarda el correlativo sin ceros a la izquierda.
const INVOICE_DRAFT = /^([A-Z0-9]{4})(?:-(\d{1,8}))?$/;

export function invoiceDraftValue(value: string) {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const prefix = compact.slice(0, 4);
  if (prefix.length < 4) return prefix;
  const suffix = compact
    .slice(4)
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/^0+(?=\d)/, "");
  return suffix ? `${prefix}-${suffix}` : prefix;
}

export function invoiceDisplayValue(value: string) {
  const draft = invoiceDraftValue(value);
  const match = draft.match(INVOICE_DRAFT);
  if (!match) return draft;
  return match[2] ? `${match[1]}-${match[2].padStart(8, "0")}` : `${match[1]}-`;
}

export function invoiceEditValue(value: string, previousValue: string) {
  const previousDraft = invoiceDraftValue(previousValue);
  const previousDisplay = invoiceDisplayValue(previousDraft);
  const previousMatch = previousDraft.match(INVOICE_DRAFT);
  const next = value.toUpperCase();

  if (
    previousMatch &&
    next.length === previousDisplay.length + 1 &&
    next.startsWith(previousDisplay)
  ) {
    const char = next.slice(-1);
    const suffix = previousMatch[2] || "";
    if (/\d/.test(char) && suffix.length < 8) {
      return `${previousMatch[1]}-${suffix}${char}`;
    }
  }

  if (
    previousMatch &&
    next.length === previousDisplay.length - 1 &&
    previousDisplay.startsWith(next)
  ) {
    const suffix = previousMatch[2] || "";
    if (suffix.length > 1) return `${previousMatch[1]}-${suffix.slice(0, -1)}`;
    if (suffix.length === 1) return previousMatch[1];
    return previousMatch[1].slice(0, -1);
  }

  return invoiceDraftValue(next);
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

export type KardexPeriodStats = {
  label: string;
  guides: number;
  tmh: number;
  entered: number;
  concar: number;
  invoices: number;
  /** TMH llegadas y sus TMH de salida, solo guías con llegada registrada. */
  tmhArrival: number | null;
  tmhDeparted: number | null;
  /** USD/TMH ponderado de las guías con importe. */
  rate: number | null;
  /** Horas promedio entre salida y llegada. */
  transitHours: number | null;
};

// Horas entre salida y llegada; ambas fechas llegan en la misma zona horaria.
export function kardexTransitHours(
  departure: string | null,
  arrival: string | null,
) {
  if (!departure || !arrival) return null;
  const start = Date.parse(departure);
  const end = Date.parse(arrival);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return (end - start) / 3600000;
}

/** 0 = lunes … 6 = domingo, a partir de la fecha local recibida de SQL. */
export function kardexWeekday(value: string | null) {
  const date = (value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
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
  // LIMPIEZA forma parte de las TMH enviadas; PERD es pérdida y queda fuera.
  const cleanupLots = uniqueLots.filter((row) => isCleanupLot(row.lot));
  const perdLots = [
    ...new Map(
      lots
        .filter((row) => !isOperationalLot(row))
        .map((row) => [lotKey(row), row]),
    ).values(),
  ];
  const sumTmh = (rows: KardexLot[]) =>
    rows.reduce((sum, row) => sum + Number(row.tmh_departure || 0), 0);
  const byPeriod = new Map<string, KardexPeriodStats>();
  const bucket = (key: string) => {
    if (!byPeriod.has(key))
      byPeriod.set(key, {
        label: key,
        guides: 0,
        tmh: 0,
        entered: 0,
        concar: 0,
        invoices: 0,
        tmhArrival: null,
        tmhDeparted: null,
        rate: null,
        transitHours: null,
      });
    return byPeriod.get(key)!;
  };
  // Acumuladores por período de medidas que solo aplican a guías completas.
  const partial = new Map<
    string,
    { amount: number; tmhBilled: number; hours: number; withHours: number }
  >();
  const partialOf = (key: string) => {
    if (!partial.has(key))
      partial.set(key, { amount: 0, tmhBilled: 0, hours: 0, withHours: 0 });
    return partial.get(key)!;
  };
  const lotsByGuide = new Map<string, Set<string>>();
  for (const row of uniqueLots) {
    if (!lotsByGuide.has(row.guide_number))
      lotsByGuide.set(row.guide_number, new Set());
    lotsByGuide.get(row.guide_number)!.add(row.lot);
  }
  const carriers = new Map<
    string,
    { label: string; guides: number; tmh: number; usd: number }
  >();
  const weekdays = Array.from({ length: 7 }, () => ({ guides: 0, tmh: 0 }));
  let departed = 0;
  let arrived = 0;
  let arrivedCount = 0;
  let billedTmh = 0;
  let billedUsd = 0;
  let billedGuides = 0;
  let rateMin: number | null = null;
  let rateMax: number | null = null;
  let transitHours = 0;
  let transitCount = 0;
  let transitMin: number | null = null;
  let transitMax: number | null = null;
  let tmhMaxGuide: { label: string; tmh: number } | null = null;
  const status = { closed: 0, invoiced: 0, pending: 0 };
  for (const guide of uniqueGuides) {
    const key = kardexPeriodKey(guide.departure_date, period);
    const group = bucket(key);
    const tmh = Number(guide.tmh_departure || 0);
    const arrival = Number(guide.tmh_arrival || 0);
    const amount = Number(guide.amount_usd || 0);
    group.guides++;
    group.tmh += tmh;
    if (!tmhMaxGuide || tmh > tmhMaxGuide.tmh)
      tmhMaxGuide = { label: guide.guide_number, tmh };
    if (arrival > 0) {
      group.tmhArrival = (group.tmhArrival ?? 0) + arrival;
      group.tmhDeparted = (group.tmhDeparted ?? 0) + tmh;
      departed += tmh;
      arrived += arrival;
      arrivedCount++;
    }
    const extra = partialOf(key);
    if (amount > 0 && tmh > 0) {
      extra.amount += amount;
      extra.tmhBilled += tmh;
      billedUsd += amount;
      billedTmh += tmh;
      billedGuides++;
      const rate = amount / tmh;
      rateMin = rateMin == null ? rate : Math.min(rateMin, rate);
      rateMax = rateMax == null ? rate : Math.max(rateMax, rate);
    }
    const hours = kardexTransitHours(guide.departure_date, guide.arrival_date);
    if (hours != null) {
      extra.hours += hours;
      extra.withHours++;
      transitHours += hours;
      transitCount++;
      transitMin = transitMin == null ? hours : Math.min(transitMin, hours);
      transitMax = transitMax == null ? hours : Math.max(transitMax, hours);
    }
    if (guide.status_name === "CERRADO") status.closed++;
    else if (guide.document_number) status.invoiced++;
    else status.pending++;
    const weekday = kardexWeekday(guide.departure_date);
    if (weekday != null) {
      weekdays[weekday].guides++;
      weekdays[weekday].tmh += tmh;
    }
    const ruc = guide.transport_ruc || "Sin transportista";
    if (!carriers.has(ruc))
      carriers.set(ruc, {
        label: guide.transport_name || ruc,
        guides: 0,
        tmh: 0,
        usd: 0,
      });
    const carrier = carriers.get(ruc)!;
    carrier.guides++;
    carrier.tmh += tmh;
    carrier.usd += amount;
  }
  for (const [key, extra] of partial) {
    const group = bucket(key);
    if (extra.tmhBilled > 0) group.rate = extra.amount / extra.tmhBilled;
    if (extra.withHours > 0) group.transitHours = extra.hours / extra.withHours;
  }
  for (const invoice of uniqueInvoices) {
    const group = bucket(kardexPeriodKey(invoice.document_date, period));
    group.invoices++;
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
    // USD ingresado de facturas sin cruce: explica esa parte de la diferencia.
    enteredUnmatched: uniqueInvoices
      .filter((row) => !row.subledger_num)
      .reduce((sum, row) => sum + kardexUnits(row.amount_usd), BigInt(0)),
    mismatched: uniqueInvoices.filter(
      (row) =>
        row.subledger_num &&
        kardexUnits(row.amount_usd) !== kardexUnits(row.amount_usd_con),
    ).length,
    invoicesClosed: uniqueInvoices.filter(
      (row) => row.status_name === "CERRADO",
    ).length,
    closed: uniqueGuides.filter((row) => row.status_name === "CERRADO").length,
    pending: uniqueGuides.filter((row) => !row.document_number).length,
    carrierCount: carriers.size,
    lotRows: uniqueLots.length,
    tmhCleanup: sumTmh(cleanupLots),
    cleanupLots: cleanupLots.length,
    tmhPerd: sumTmh(perdLots),
    perdLots: perdLots.length,
    tmhArrived: arrived,
    arrivedCount,
    tmhMaxGuide,
    billedGuides,
    billedTmh,
    billedUsd,
    rateMin,
    rateMax,
    transitMin,
    transitMax,
    series: [...byPeriod.values()].sort((a, b) =>
      a.label.localeCompare(b.label),
    ),
    carriers: [...carriers.values()].sort((a, b) => b.tmh - a.tmh),
    weekdays,
    status,
    // Merma sobre guías con llegada registrada; null si ninguna la tiene.
    lossPct: departed > 0 ? ((departed - arrived) / departed) * 100 : null,
    arrivedGuidesTmh: departed,
    avgRate: billedTmh > 0 ? billedUsd / billedTmh : null,
    avgTransitHours: transitCount > 0 ? transitHours / transitCount : null,
    transitCount,
    lotsByGuide: uniqueGuides
      .map((row) => ({
        label: row.guide_number,
        count: lotsByGuide.get(row.guide_number)?.size || 0,
      }))
      .sort((a, b) => b.count - a.count),
  };
}
