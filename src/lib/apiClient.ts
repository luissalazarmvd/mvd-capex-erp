// src/lib/apiClient.ts
type Json = Record<string, any>;

// Lecturas en curso. Alimentan el overlay global `DataLoading`
// (src/components/ui/DataLoading.tsx): solo cuentan los apiGet; las
// escrituras y descargas conservan el estado propio de cada módulo.
// `silent` excluye consultas ligadas al tecleo (lookups) para no cubrir
// la pantalla mientras el usuario escribe.
type ApiGetOptions = { silent?: boolean };

const inflight = new Map<number, string>();
const listeners = new Set<() => void>();
let inflightSnapshot: string[] = [];
let inflightSeq = 0;

function trackStart(path: string) {
  const ticket = ++inflightSeq;
  inflight.set(ticket, path);
  inflightSnapshot = Array.from(inflight.values());
  listeners.forEach((listener) => listener());
  return ticket;
}

function trackEnd(ticket: number) {
  if (!inflight.delete(ticket)) return;
  inflightSnapshot = Array.from(inflight.values());
  listeners.forEach((listener) => listener());
}

export function subscribeInflight(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getInflightPaths() {
  return inflightSnapshot;
}

function normBase(url: string) {
  return url.replace(/\/+$/, "");
}

function getBaseUrl() {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  if (!base) throw new Error("Falta NEXT_PUBLIC_API_BASE_URL en Vercel/.env");
  return normBase(base);
}

function getApiKey() {
  const key = process.env.NEXT_PUBLIC_API_KEY || "";
  if (!key) throw new Error("Falta NEXT_PUBLIC_API_KEY en Vercel/.env");
  return key;
}

async function parseOrThrow(r: Response) {
  const out = await r.json().catch(() => ({}));
  if (!r.ok || out?.ok === false) {
    throw new Error(out?.error ?? `HTTP ${r.status}`);
  }
  return out;
}

export async function apiGet(path: string, options?: ApiGetOptions) {
  const base = getBaseUrl();
  const key = getApiKey();
  const ticket = options?.silent ? null : trackStart(path);

  try {
    const r = await fetch(`${base}${path}`, {
      method: "GET",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      cache: "no-store",
    });

    return await parseOrThrow(r);
  } finally {
    if (ticket !== null) trackEnd(ticket);
  }
}

export async function apiPost(path: string, body: Json) {
  const base = getBaseUrl();
  const key = getApiKey();

  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  return parseOrThrow(r);
}

export async function apiDownload(path: string, filename: string) {
  const base = getBaseUrl();
  const key = getApiKey();

  const r = await fetch(`${base}${path}`, {
    method: "GET",
    headers: { "x-api-key": key },
    cache: "no-store",
  });

  if (!r.ok) {
    const out = await r.json().catch(() => ({}));
    throw new Error(out?.error ?? `HTTP ${r.status}`);
  }

  const blob = await r.blob();
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => window.URL.revokeObjectURL(url), 0);
}
