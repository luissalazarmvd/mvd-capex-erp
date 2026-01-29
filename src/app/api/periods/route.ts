// src/app/api/periods/route.ts
import { NextResponse } from "next/server";
import { getPeriods } from "../../../lib/db/queries";

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

  const rows = await getPeriods(from, n);

  return NextResponse.json({
    ok: true,
    periods: rows.map((r) => ({ period_id: r.period_id, label: r.period_label })),
  });
}
