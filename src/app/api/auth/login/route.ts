// src/app/api/auth/login/route.ts
import { NextResponse } from "next/server";

function bytesToB64url(bytes: Uint8Array) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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

function buildToken(payload: any, secret: string) {
  const payloadB64 = bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  return hmacSha256(secret, payloadB64).then((sig) => `${payloadB64}.${bytesToB64url(sig)}`);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const area = String(body?.area || "").trim().toLowerCase();
    const password = String(body?.password || "").trim();

    if (!area || (area !== "planta" && area !== "capex" && area !== "refinery")) {
      return NextResponse.json({ ok: false, error: "area inválida" }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ ok: false, error: "password requerido" }, { status: 400 });
    }

    const secret = process.env.AUTH_SECRET || "";
    if (!secret) {
      return NextResponse.json({ ok: false, error: "AUTH_SECRET no configurado" }, { status: 500 });
    }

    const CAPEX_PASSWORD = process.env.CAPEX_PASSWORD || "";
    const PLANTA_PASSWORD = process.env.PLANTA_PASSWORD || "";
    const REFINERY_PASSWORD = process.env.REFINERY_PASSWORD || "";

    const ok =
      (area === "capex" && password === CAPEX_PASSWORD) ||
      (area === "planta" && password === PLANTA_PASSWORD) ||
      (area === "refinery" && password === REFINERY_PASSWORD);

    if (!ok) {
      return NextResponse.json({ ok: false, error: "Clave incorrecta" }, { status: 401 });
    }

    const exp = Date.now() + 1000 * 60 * 60 * 12;
    const payload = { exp, scopes: [area] };

    const token = await buildToken(payload, secret);

    const res = NextResponse.json({ ok: true, area });

    res.cookies.set({
      name: "mvd_auth",
      value: token,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
