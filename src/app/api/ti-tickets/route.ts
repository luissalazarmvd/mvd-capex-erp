import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeBase() {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!base) return null;
  return base.replace(/\/+$/, "");
}

function safeKey() {
  return process.env.NEXT_PUBLIC_API_KEY?.trim() ?? "";
}

export async function GET(req: Request) {
  try {
    const base = safeBase();
    if (!base) return NextResponse.json({ ok: true, data: [] });

    const apiKey = safeKey();

    const { searchParams } = new URL(req.url);
    const q = String(searchParams.get("q") ?? "").trim();
    const status = String(searchParams.get("status") ?? "").trim();
    const limit = String(searchParams.get("limit") ?? "").trim();

    const url = new URL("/api/ti/tickets", base);
    if (q) url.searchParams.set("q", q);
    if (status) url.searchParams.set("status", status);
    if (limit) url.searchParams.set("limit", limit);

    const r = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
      cache: "no-store",
    });

    if (!r.ok) return NextResponse.json({ ok: true, data: [] });

    const js = await r.json().catch(() => null);

    // tu backend: { ok:true, rows:[...] } (pero si cambia, no rompe)
    return NextResponse.json({ ok: true, data: js?.rows ?? js?.data ?? [] });
  } catch {
    return NextResponse.json({ ok: true, data: [] });
  }
}