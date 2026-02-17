// app/api/ti/auth/login/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const pass = String(body?.pass ?? "").trim();

    const pTI = process.env.PASS_TI || "";
    const pJ = process.env.PASS_JEFES || "";

    if (!pTI || !pJ) {
      return NextResponse.json(
        { ok: false, error: "PASS_TI o PASS_JEFES no configurado" },
        { status: 500 }
      );
    }

    let role: "ti" | "jefes" | null = null;
    if (pass === pTI) role = "ti";
    else if (pass === pJ) role = "jefes";

    if (!role) {
      return NextResponse.json({ ok: false, error: "Clave incorrecta" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true, role });

    res.cookies.set({
      name: "mvd_ti_session",
      value: role,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8, // 8h
    });

    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
}
