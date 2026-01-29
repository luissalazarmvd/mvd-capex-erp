// src/app/api/wbs/upsert/route.ts
import { NextResponse } from "next/server";
import { upsertWbs } from "../../../../lib/db/upserts";

export const runtime = "nodejs";

type Body = {
  wbs_code: string;
  wbs_name: string;
  project_code: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;

  if (!body?.wbs_code || !body?.wbs_name || !body?.project_code) {
    return NextResponse.json(
      { ok: false, error: "wbs_code, wbs_name y project_code son obligatorios" },
      { status: 400 }
    );
  }

  await upsertWbs({
    wbs_code: String(body.wbs_code).trim(),
    wbs_name: String(body.wbs_name).trim(),
    project_code: String(body.project_code).trim(),
  });

  return NextResponse.json({ ok: true });
}
