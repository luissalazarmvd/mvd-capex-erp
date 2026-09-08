"use server";

import {
  cmDateText,
  cmEntryDate2Error,
  parseCmIsoDate,
  todayInLima,
} from "../../../lib/traceability/cmEntryDate";

type EntryDateRow = {
  lot?: unknown;
  entry_date?: unknown;
  entry_date_2?: unknown;
};

type EntryDateRequest = {
  lot: string;
  entry_date_2: string | null;
};

type BackendResponse = {
  ok?: boolean;
  rows?: EntryDateRow[];
  error?: string;
};

export type SaveCmEntryDatesResult = {
  ok: boolean;
  fulfilled: string[];
  rejected: string[];
};

const SAVE_CONCURRENCY = 20;

function backendConfig() {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.NEXT_PUBLIC_API_KEY?.trim();
  if (!base) throw new Error("Falta NEXT_PUBLIC_API_BASE_URL en Vercel.");
  if (!apiKey) throw new Error("Falta NEXT_PUBLIC_API_KEY en Vercel.");
  return { base, apiKey };
}

async function backendJson(
  path: string,
  init: RequestInit,
  config: ReturnType<typeof backendConfig>
) {
  const response = await fetch(`${config.base}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      ...init.headers,
    },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as BackendResponse;
  if (!response.ok || body.ok === false) {
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return body;
}

function normalizeRequests(value: unknown): EntryDateRequest[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("No hay fechas modificadas para guardar.");
  }

  const seen = new Set<string>();
  return value.map((item) => {
    const candidate =
      typeof item === "object" && item !== null
        ? (item as { lot?: unknown; entry_date_2?: unknown })
        : {};
    const lot = String(candidate.lot ?? "").trim();
    const rawDate = candidate.entry_date_2;
    const entryDate2 = cmDateText(rawDate) || null;

    if (!lot) throw new Error("Hay una fila sin lote.");
    if (seen.has(lot)) throw new Error(`El lote ${lot} está repetido en el guardado.`);
    if (entryDate2 && !parseCmIsoDate(entryDate2)) {
      throw new Error(`Lote ${lot}: la fecha de ingreso 2 no es válida.`);
    }
    seen.add(lot);
    return { lot, entry_date_2: entryDate2 };
  });
}

export async function saveCmEntryDates(
  value: unknown
): Promise<SaveCmEntryDatesResult> {
  try {
    const requestedRows = normalizeRequests(value);
    const config = backendConfig();
    const current = await backendJson(
      "/api/traceability/cm/entrydate",
      { method: "GET" },
      config
    );
    const rows = Array.isArray(current.rows) ? current.rows : [];
    const entryDatesByLot = new Map<string, string[]>();

    rows.forEach((row) => {
      const lot = String(row.lot ?? "").trim();
      const entryDate = cmDateText(row.entry_date);
      if (!lot || !entryDate) return;
      const dates = entryDatesByLot.get(lot) ?? [];
      dates.push(entryDate);
      entryDatesByLot.set(lot, dates);
    });

    const maximumDate = todayInLima();
    const invalid = requestedRows.flatMap((row) => {
      const entryDates = entryDatesByLot.get(row.lot) ?? [];
      if (!entryDates.length) {
        return [`Lote ${row.lot}: no existe en el GET vigente.`];
      }

      const invalidEntryDate = entryDates.find((entryDate) => !parseCmIsoDate(entryDate));
      if (invalidEntryDate) {
        return [`Lote ${row.lot}: la fecha de ingreso 1 del GET no es válida.`];
      }

      const minimumDate = entryDates.reduce((latest, entryDate) =>
        entryDate > latest ? entryDate : latest
      );
      const error = cmEntryDate2Error(row.entry_date_2, minimumDate, maximumDate);
      return error ? [`Lote ${row.lot}: ${error}`] : [];
    });

    if (invalid.length) {
      return { ok: false, fulfilled: [], rejected: invalid };
    }

    const fulfilled: string[] = [];
    const rejected: string[] = [];

    for (let start = 0; start < requestedRows.length; start += SAVE_CONCURRENCY) {
      const chunk = requestedRows.slice(start, start + SAVE_CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map(async (row) => {
          await backendJson(
            "/api/traceability/cm/entrydate/insert",
            {
              method: "POST",
              body: JSON.stringify({
                lot: row.lot,
                entry_date_2: row.entry_date_2,
              }),
            },
            config
          );
          return row.lot;
        })
      );

      results.forEach((result) => {
        if (result.status === "fulfilled") fulfilled.push(result.value);
        else {
          rejected.push(
            result.reason instanceof Error ? result.reason.message : String(result.reason)
          );
        }
      });
    }

    return { ok: rejected.length === 0, fulfilled, rejected };
  } catch (error) {
    return {
      ok: false,
      fulfilled: [],
      rejected: [error instanceof Error ? error.message : String(error)],
    };
  }
}
