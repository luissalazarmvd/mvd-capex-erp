// src/app/api/projects/upsert/route.ts
import { NextResponse } from "next/server";
import { upsertProject } from "../../../../lib/db/upserts";

export const runtime = "nodejs";

type Body = {
  project_code: string;
  project_name: string;
  proj_group_id?: number | null;
  inv_class_id?: number | null;
  proj_condition_id?: number | null;
  proj_area_id?: number | null;
  priority_id?: number | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const project_code = String(body?.project_code ?? "").trim();
    const project_name = String(body?.project_name ?? "").trim();

    if (!project_code || !project_name) {
      return NextResponse.json(
        { ok: false, error: "project_code y project_name son obligatorios" },
        { status: 400 }
      );
    }

    if (!/^\d{2}$/.test(project_code)) {
      return NextResponse.json(
        { ok: false, error: "project_code debe ser NN (ej: 01)" },
        { status: 400 }
      );
    }

    await upsertProject({
      project_code,
      project_name,
      proj_group_id: body.proj_group_id ?? null,
      inv_class_id: body.inv_class_id ?? null,
      proj_condition_id: body.proj_condition_id ?? null,
      proj_area_id: body.proj_area_id ?? null,
      priority_id: body.priority_id ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Error inesperado" },
      { status: 500 }
    );
  }
}
