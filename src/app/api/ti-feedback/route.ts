import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { ok: false, error: "TI pendiente: feedback deshabilitado temporalmente." },
    { status: 503 }
  );
}
