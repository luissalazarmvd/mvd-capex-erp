// src/app/api/actual/upsert/route.ts
import { NextResponse } from "next/server";
import { insertProgressVersions } from "../../../../lib/db/upserts";

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

  // Nota: insertProgressVersions decide si inserta AC o EV según col en la key
  await insertProgressVersions(body.rows);

  return NextResponse.json({ ok: true });
}
