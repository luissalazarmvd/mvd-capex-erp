// src/app/api/vai/generate/route.ts
//
// Única llamada a OpenAI de V-Ai. Protegida por la cookie de sesión con scope
// `vai`; valida el prompt, envía solo metadatos del catálogo y devuelve una
// especificación ya validada contra el catálogo. Los datos reales los consulta
// el navegador después, contra los endpoints autorizados.

import { NextResponse } from "next/server";
import { sessionWithScope } from "@/src/lib/auth/session";
import { VAI_AREAS, type VaiArea } from "@/src/lib/vai/catalog";
import { VaiGenerationError, generateDashboardSpec, type VaiChartPreference, type VaiFocus } from "@/src/lib/vai/generate";
import { VAI_PROMPT_MAX, validateModelOutput } from "@/src/lib/vai/spec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FOCUS: VaiFocus[] = ["auto", "kpis", "trends", "comparisons", "detail"];
const CHARTS: VaiChartPreference[] = ["line", "bar", "kpi", "table"];

export async function POST(req: Request) {
  const session = await sessionWithScope(req, "vai");
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { prompt?: unknown; area?: unknown; focus?: unknown; charts?: unknown };
  const prompt = String(body.prompt ?? "").replace(/\s+/g, " ").trim();
  if (prompt.length < 8) return NextResponse.json({ ok: false, error: "Describe con más detalle el dashboard que quieres." }, { status: 400 });
  if (prompt.length > VAI_PROMPT_MAX) return NextResponse.json({ ok: false, error: `El prompt supera los ${VAI_PROMPT_MAX} caracteres.` }, { status: 400 });

  const areaRaw = String(body.area ?? "auto");
  const area: VaiArea | "auto" = VAI_AREAS.some((item) => item.id === areaRaw) ? (areaRaw as VaiArea) : "auto";
  const focusRaw = String(body.focus ?? "auto") as VaiFocus;
  const focus = FOCUS.includes(focusRaw) ? focusRaw : "auto";
  const charts = Array.isArray(body.charts) ? body.charts.map(String).filter((c): c is VaiChartPreference => CHARTS.includes(c as VaiChartPreference)) : [];

  try {
    const { output, candidates } = await generateDashboardSpec(prompt, { area, focus, charts });
    const { spec, notes } = validateModelOutput(output);

    if (!spec) {
      const unavailable = [...new Set([...output.unavailable, ...notes])];

      return NextResponse.json({
        ok: true,
        status: "unavailable",
        message: output.message || "Actualmente no existe información disponible en V-Ai para construir ese dashboard.",
        unavailable,
        spec: null,
        candidates,
      });
    }

    const unavailable = [...new Set(notes)];
    const status = unavailable.length ? "partial" : "ok";

    return NextResponse.json({
      ok: true,
      status,
      message: unavailable.length ? output.message : "",
      unavailable,
      spec,
      candidates,
    });
  } catch (error) {
    // Detalle técnico solo en el servidor; el usuario recibe un mensaje entendible.
    if (error instanceof VaiGenerationError) {
      console.error("V-Ai generate:", error.detail ?? error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    }
    console.error("V-Ai generate:", error);
    return NextResponse.json({ ok: false, error: "No se pudo generar el dashboard. Inténtalo de nuevo." }, { status: 500 });
  }
}
