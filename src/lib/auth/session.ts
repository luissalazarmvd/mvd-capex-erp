// src/lib/auth/session.ts
//
// Verificación server-side de la cookie `mvd_auth` (mismo token HMAC que
// emite /api/auth/login y comprueba middleware.ts) para proteger route
// handlers por scope. Solo Web Crypto: sirve en Node y en Edge.

export const AUTH_COOKIE = "mvd_auth";

export type AuthSession = { scopes: string[]; exp: number };

function b64urlToBytes(b64url: string) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSha256(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyAuthToken(token: string, secret: string): Promise<AuthSession | null> {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !secret) return null;
  const [payloadB64, sigB64] = parts;
  let got: Uint8Array;
  try {
    got = b64urlToBytes(sigB64);
  } catch {
    return null;
  }
  if (!timingSafeEqual(await hmacSha256(secret, payloadB64), got)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
  } catch {
    return null;
  }
  const record = typeof payload === "object" && payload !== null ? (payload as { exp?: unknown; scopes?: unknown }) : {};
  const exp = Number(record.exp ?? 0);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  const scopes = Array.isArray(record.scopes) ? record.scopes.map((x) => String(x)) : [];
  return { scopes, exp };
}

/** Lee la cookie de sesión de una Request y devuelve la sesión si el scope está presente. */
export async function sessionWithScope(req: Request, scope: string): Promise<AuthSession | null> {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${AUTH_COOKIE}=([^;]*)`));
  const token = match ? decodeURIComponent(match[1]) : "";
  if (!token) return null;
  const session = await verifyAuthToken(token, process.env.AUTH_SECRET || "");
  return session && session.scopes.includes(scope) ? session : null;
}
