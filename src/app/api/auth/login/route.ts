// src/app/api/auth/login/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = String(body?.username ?? body?.user ?? "").trim();
    const password = String(body?.password ?? "").trim();

    // Placeholder: NO valida nada aún (solo evita que falle el build).
    // Aquí luego conectas tu auth real (DB, LDAP, etc.)
    if (!username || !password) {
      return NextResponse.json({ ok: false, error: "Faltan credenciales" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
