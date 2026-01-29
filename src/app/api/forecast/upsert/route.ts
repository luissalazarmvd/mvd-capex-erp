// src/app/api/forecast/upsert/route.ts
import { NextResponse } from "next/server";
import { insertForecastVersions } from "../../../../lib/db/upserts";

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

  await insertForecastVersions(body.rows);

  return NextResponse.json({ ok: true });
}
