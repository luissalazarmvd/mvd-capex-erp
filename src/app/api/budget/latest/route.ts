// src/app/api/budget/latest/route.ts
import { NextResponse } from "next/server";
import { getLatestBudget } from "../../../../lib/db/queries";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = Number(url.searchParams.get("from") ?? "");
  const n = Number(url.searchParams.get("n") ?? "");
  const cls = String(url.searchParams.get("class") ?? "ORIG").toUpperCase();

  if (!Number.isFinite(from) || !Number.isFinite(n) || n <= 0) {
    return NextResponse.json(
      { ok: false, error: "Params inválidos: from (YYYYMM) y n (>0)" },
      { status: 400 }
    );
  }
  if (cls !== "ORIG" && cls !== "SOC") {
    return NextResponse.json(
      { ok: false, error: "Param inválido: class debe ser ORIG o SOC" },
      { status: 400 }
    );
  }

  const cells = await getLatestBudget(cls as "ORIG" | "SOC", from, n);

  const latest: Record<string, string | null> = {};
  for (const c of cells) {
    const k = `${c.wbs_code}|${c.period_id}|${c.col}`; // col = ORIG/SOC
    latest[k] = c.value ?? null;
  }

  return NextResponse.json({ ok: true, latest });
}
