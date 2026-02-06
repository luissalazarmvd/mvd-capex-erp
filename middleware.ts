// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

function b64urlToBytes(b64url: string) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSha256(secret: string, data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verifyToken(token: string, secret: string) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, sigB64] = parts;

  // Firma esperada
  const expected = await hmacSha256(secret, payloadB64);

  // Firma recibida
  let got: Uint8Array;
  try {
    got = b64urlToBytes(sigB64);
  } catch {
    return null;
  }

  if (!timingSafeEqual(expected, got)) return null;

  // Payload
  let payload: any;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
  } catch {
    return null;
  }

  const exp = Number(payload?.exp ?? 0);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;

  const scopes = Array.isArray(payload?.scopes) ? payload.scopes.map((x: any) => String(x)) : [];
  return { scopes };
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ Permitir: portal + login + assets
  if (
    pathname === "/" ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/logo_") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/images")
  ) {
    return NextResponse.next();
  }

  const secret = process.env.AUTH_SECRET || "";
  if (!secret) {
    // Sin secret -> bloquea todo menos portal/login
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  const token = req.cookies.get("mvd_auth")?.value || "";
  const auth = token ? await verifyToken(token, secret) : null;

  if (!auth) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Reglas por “área”
  const need = pathname.startsWith("/planta") ? "planta" : "capex";

  if (!auth.scopes.includes(need)) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Aplica a todo excepto estáticos internos
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
