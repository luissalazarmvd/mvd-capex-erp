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

    if (
      !area ||
      ![
        "planta",
        "capex",
        "refinery",
        "traceability",
        "compliance",
        "logistics",
        "sustainability",
        "fleet",
      ].includes(area)
    ) {
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
    const TRACEABILITY_PASSWORD = process.env.TRACEABILITY_PASSWORD || "";
    const COMPLIANCE_PASSWORD = process.env.COMPLIANCE_PASSWORD || "";
    const LOGISTICS_PASSWORD = process.env.LOGISTICS_PASSWORD || "";
    const SUSTAINABILITY_PASSWORD = process.env.SUSTAINABILITY_PASSWORD || "";
    const FLEET_PASSWORD_L1 = process.env.FLEET_PASSWORD_L1 || "";
    const FLEET_PASSWORD_L2 = process.env.FLEET_PASSWORD_L2 || "";

    let ok = false;
    let scopes: string[] = [area];
    let defaultPath: string | null = null;

    if (area === "capex" && password === CAPEX_PASSWORD) ok = true;
    if (area === "planta" && password === PLANTA_PASSWORD) ok = true;
    if (area === "refinery" && password === REFINERY_PASSWORD) ok = true;
    if (area === "traceability" && password === TRACEABILITY_PASSWORD) ok = true;
    if (area === "compliance" && password === COMPLIANCE_PASSWORD) ok = true;
    if (area === "logistics" && password === LOGISTICS_PASSWORD) ok = true;
    if (area === "sustainability" && password === SUSTAINABILITY_PASSWORD) ok = true;

    if (area === "fleet" && password === FLEET_PASSWORD_L1) {
      ok = true;
      scopes = ["fleet_offices"];
      defaultPath = "/fleet/offices";
    }

    if (area === "fleet" && password === FLEET_PASSWORD_L2) {
      ok = true;
      scopes = ["fleet_offices", "fleet_mgmt"];
      defaultPath = "/fleet/offices";
    }

    if (!ok) {
      return NextResponse.json({ ok: false, error: "Clave incorrecta" }, { status: 401 });
    }
    const exp = Date.now() + 1000 * 60 * 60 * 12;
    const payload = { exp, scopes };

    const token = await buildToken(payload, secret);

    const res = NextResponse.json({ ok: true, area, scopes, defaultPath });

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