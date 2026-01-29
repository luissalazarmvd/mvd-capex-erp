// src/lib/apiClient.ts
type Json = Record<string, any>;

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

export async function apiGet(path: string) {
  const base = getBaseUrl();
  const key = getApiKey();

  const r = await fetch(`${base}${path}`, {
    method: "GET",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    cache: "no-store",
  });

  return parseOrThrow(r);
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
