import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { id_ticket: string };

type Insight = {
  resumen: string;
  diagnostico_probable: string;
  pasos_sugeridos: string[];
  preguntas_para_aclarar: string[];
  riesgos_y_precauciones: string[];
  tickets_historicos_usados: string[];
  confianza: number;
};

const DUMMY: Insight = {
  resumen: "Placeholder: Copiloto TI aún en configuración.",
  diagnostico_probable: "Falta data/históricos suficientes o servicios no habilitados.",
  pasos_sugeridos: ["Registrar más tickets y resoluciones para entrenar el criterio.", "Habilitar endpoints de históricos cuando estén listos."],
  preguntas_para_aclarar: ["¿Cuál es el impacto al usuario?", "¿Desde cuándo ocurre?", "¿Hay cambios recientes (PC/red/app)?"],
  riesgos_y_precauciones: ["No aplicar cambios en producción sin validación TI.", "Evitar borrar datos sin respaldo."],
  tickets_historicos_usados: [],
  confianza: 0.2,
};

function safeBase() {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!base) return null;
  return base.replace(/\/+$/, "");
}

function safeKey() {
  return process.env.NEXT_PUBLIC_API_KEY?.trim() ?? "";
}

async function fetchTicket(base: string, apiKey: string, id_ticket: string) {
  const url = new URL(`/api/ti/tickets/${encodeURIComponent(id_ticket)}`, base);

  const r = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
    cache: "no-store",
  });

  if (!r.ok) return null;
  const js = await r.json().catch(() => null);
  return js?.row ?? null;
}

async function fetchWebSnippets(origin: string, q: string) {
  try {
    if (!q) return [];
    const url = new URL("/api/web/search", origin);
    url.searchParams.set("q", q);
    const r = await fetch(url.toString(), { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" });
    if (!r.ok) return [];
    const js = await r.json().catch(() => null);
    const data = js?.data ?? [];
    return Array.isArray(data) ? data.slice(0, 3) : [];
  } catch {
    return [];
  }
}

function buildWebQuery(cur: any) {
  const cat = (cur?.ticket_category ?? "").toString().trim();
  const title = (cur?.ticket_title ?? "").toString().trim();
  const detail = (cur?.ticket_detail ?? "").toString().trim();
  const shortDetail = detail.length > 220 ? detail.slice(0, 220) : detail;
  return [cat, title, shortDetail].filter(Boolean).join(" ");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const id_ticket = String(body?.id_ticket ?? "").trim();

    if (!id_ticket) return NextResponse.json({ ok: false, error: "Falta id_ticket" }, { status: 200 });

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
    const base = safeBase();
    const apiKey = safeKey();
    const origin = new URL(req.url).origin;

    // Si todavía no tienes backend o key, devuelve dummy sin romper nada
    if (!OPENAI_API_KEY || !base) {
      return NextResponse.json({ ok: true, data: DUMMY, meta: { placeholder: true } });
    }

    const cur = await fetchTicket(base, apiKey, id_ticket);
    if (!cur) {
      return NextResponse.json({ ok: true, data: DUMMY, meta: { placeholder: true, reason: "ticket_not_found_or_api_down" } });
    }

    const webQuery = buildWebQuery(cur);
    const webSnippets = await fetchWebSnippets(origin, webQuery);

    // Prompt mínimo (placeholder-friendly)
    const system = `
Eres un analista senior de soporte TI (ITSM).
Devuelve SOLO JSON válido y corto.
`.trim();

    const user = `
TICKET:
${JSON.stringify(
  {
    id_ticket: cur.id_ticket,
    ticket_title: cur.ticket_title,
    ticket_detail: cur.ticket_detail,
    status_name: cur.status_name,
    site_name: cur.site_name,
  },
  null,
  2
)}

WEB (secundario):
${JSON.stringify(webSnippets, null, 2)}
`.trim();

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        resumen: { type: "string" },
        diagnostico_probable: { type: "string" },
        pasos_sugeridos: { type: "array", maxItems: 5, items: { type: "string" } },
        preguntas_para_aclarar: { type: "array", items: { type: "string" } },
        riesgos_y_precauciones: { type: "array", items: { type: "string" } },
        tickets_historicos_usados: { type: "array", items: { type: "string" } },
        confianza: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["resumen", "diagnostico_probable", "pasos_sugeridos", "preguntas_para_aclarar", "riesgos_y_precauciones", "tickets_historicos_usados", "confianza"],
    };

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        model: "gpt-5-mini",
        input: [
          { role: "system", content: [{ type: "input_text", text: system }] },
          { role: "user", content: [{ type: "input_text", text: user }] },
        ],
        text: { format: { type: "json_schema", name: "ticket_insight", schema } },
      }),
    });

    // placeholder: si OpenAI falla, devuelve dummy
    if (!resp.ok) {
      return NextResponse.json({ ok: true, data: DUMMY, meta: { placeholder: true, reason: `openai_${resp.status}` } });
    }

    const out = await resp.json();

    // extracción simple (y si falla => dummy)
    let parsed: any = null;
    for (const block of out?.output ?? []) {
      for (const c of block.content ?? []) {
        if (c.type === "output_json" && c.json) parsed = c.json;
      }
    }
    if (!parsed) {
      try {
        const txt = out?.output?.[0]?.content?.find((x: any) => x.type === "output_text")?.text;
        if (txt) parsed = JSON.parse(txt);
      } catch {}
    }

    if (!parsed) return NextResponse.json({ ok: true, data: DUMMY, meta: { placeholder: true, reason: "parse_fail" } });

    return NextResponse.json({ ok: true, data: parsed, meta: { webQuery, webSnippetsUsed: webSnippets.length } });
  } catch {
    return NextResponse.json({ ok: true, data: DUMMY, meta: { placeholder: true, reason: "unexpected" } });
  }
}