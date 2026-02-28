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

export async function POST(req: Request) {
  try {
    // placeholder: valida leve y si no hay backend, ok igual
    const body = await req.json().catch(() => ({}));
    const rating = Number(body?.rating);
    const comment = typeof body?.comment === "string" ? body.comment.trim() : null;

    if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
      // no rompas UI: responde ok false pero 200 (si quieres que tu UI no se rompa)
      return NextResponse.json({ ok: false, error: "Valoración inválida (1–10)." }, { status: 200 });
    }

    const base = safeBase();
    if (!base) return NextResponse.json({ ok: true });

    const apiKey = safeKey();
    const url = new URL("/api/ti/feedback", base);

    const r = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {}),
      },
      body: JSON.stringify({ rating, comment }),
      cache: "no-store",
    });

    // placeholder: aunque falle, no mates tu app
    if (!r.ok) return NextResponse.json({ ok: true });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}