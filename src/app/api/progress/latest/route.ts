// src/app/api/progress/latest/route.ts
import { NextResponse } from "next/server";
import { getLatestProgress } from "../../../../lib/db/queries";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = Number(url.searchParams.get("from") ?? "");
  const n = Number(url.searchParams.get("n") ?? "");

  if (!Number.isFinite(from) || !Number.isFinite(n) || n <= 0) {
    return NextResponse.json(
      { ok: false, error: "Params inválidos: from (YYYYMM) y n (>0)" },
      { status: 400 }
    );
  }

  const cells = await getLatestProgress(from, n);

  const latest: Record<string, string | null> = {};
  for (const c of cells) {
    const k = `${c.wbs_code}|${c.period_id}|${c.col}`; // col = EV_PCT / AC
    latest[k] = c.value ?? null;
  }

  return NextResponse.json({ ok: true, latest });
}
