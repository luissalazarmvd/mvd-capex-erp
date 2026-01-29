// src/app/api/budget/upsert/route.ts
import { NextResponse } from "next/server";
import { insertBudgetVersions } from "../../../../lib/db/upserts";

export const runtime = "nodejs";

type Body = {
  rows: { key: string; value: string }[];
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  if (!body?.rows || !Array.isArray(body.rows)) {
    return NextResponse.json(
      { ok: false, error: "Body inválido" },
      { status: 400 }
    );
  }

  await insertBudgetVersions(body.rows);

  return NextResponse.json({ ok: true });
}
