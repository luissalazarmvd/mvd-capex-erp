const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function cmDateText(value: unknown) {
  const normalized = value === null || value === undefined ? "" : String(value).trim();
  const match = normalized.match(ISO_DATE_PREFIX);
  return match?.[0] ?? normalized;
}

export function parseCmIsoDate(value: unknown) {
  const normalized = cmDateText(value);
  if (!ISO_DATE.test(normalized)) return null;

  const timestamp = Date.parse(`${normalized}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) return null;
  if (new Date(timestamp).toISOString().slice(0, 10) !== normalized) return null;

  return { normalized, timestamp };
}

export function cmEntryDate2Error(
  value: unknown,
  entryDate: unknown,
  maximumDate: unknown
) {
  if (!cmDateText(value)) return null;

  const candidate = parseCmIsoDate(value);
  if (!candidate) return "La fecha de ingreso 2 no es válida.";

  const minimum = parseCmIsoDate(entryDate);
  if (!minimum) {
    return "La fecha de ingreso 1 no es válida; esta fila no se puede guardar.";
  }

  const maximum = parseCmIsoDate(maximumDate);
  if (!maximum) return "No se pudo determinar la fecha máxima permitida.";

  if (candidate.timestamp < minimum.timestamp) {
    return `La fecha de ingreso 2 (${candidate.normalized}) no puede ser anterior a la fecha de ingreso 1 (${minimum.normalized}).`;
  }
  if (candidate.timestamp > maximum.timestamp) {
    return `La fecha de ingreso 2 (${candidate.normalized}) no puede ser posterior a ${maximum.normalized}.`;
  }
  return null;
}

export function todayInLima() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value])
  ) as Record<string, string>;

  return `${parts.year}-${parts.month}-${parts.day}`;
}
