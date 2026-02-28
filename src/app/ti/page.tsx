// src/app/ti/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const PBI_TI =
  "https://app.powerbi.com/view?r=eyJrIjoiZWZiNzE2YzctNDA4Ni00M2UyLWExNzktM2Q4ZTAxMTk2OTdjIiwidCI6IjYzNzhiZmNkLWRjYjktNDMwZi05Nzc4LWRiNTk3NGRjMmFkYyIsImMiOjR9";

const PBI_JEFES =
  "https://app.powerbi.com/view?r=eyJrIjoiNDQ2MTZmZjUtNTBmZC00Mjg2LWI4N2ItMjMzNWFkOWFiYzVmIiwidCI6IjYzNzhiZmNkLWRjYjktNDMwZi05Nzc4LWRiNTk3NGRjMmFkYyIsImMiOjR9";

type TicketOption = {
  id_ticket: string;
  ticket_title: string | null;
  status_name: string | null;

  // placeholders para no romper si backend cambia
  category_name?: string | null;
  tod_date?: string | null;

  // campos reales SQL (si vienen)
  ticket_category?: string | null;
  ticket_subcategory?: string | null;
  due_date?: string | null;
  updated_at?: string | null;
};

type Insight = {
  resumen: string;
  diagnostico_probable: string;
  pasos_sugeridos: string[];
  preguntas_para_aclarar: string[];
  riesgos_y_precauciones: string[];
  tickets_historicos_usados: string[];
  confianza: number;
};

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function normalizeTicketOption(x: any): TicketOption | null {
  if (!x) return null;
  const id_ticket = safeStr(x.id_ticket).trim();
  if (!id_ticket) return null;

  return {
    id_ticket,
    ticket_title: x.ticket_title ?? null,
    status_name: x.status_name ?? null,

    category_name: x.category_name ?? x.ticket_category ?? null,
    tod_date: x.tod_date ?? x.due_date ?? x.updated_at ?? null,

    ticket_category: x.ticket_category ?? x.category_name ?? null,
    ticket_subcategory: x.ticket_subcategory ?? null,
    due_date: x.due_date ?? null,
    updated_at: x.updated_at ?? null,
  };
}

function safeCategoryLabel(t: TicketOption) {
  const legacy = safeStr(t.category_name).trim();
  if (legacy) return legacy;

  const a = safeStr(t.ticket_category).trim();
  const b = safeStr(t.ticket_subcategory).trim();
  return [a, b].filter(Boolean).join(" · ");
}

const DUMMY_INSIGHT: Insight = {
  resumen: "Placeholder: Copiloto TI en configuración.",
  diagnostico_probable: "Aún no hay data suficiente o servicios no están habilitados.",
  pasos_sugeridos: ["Revisa el título/detalle del ticket.", "Confirma alcance e impacto con el usuario.", "Escala a TI si requiere permisos/cambios."],
  preguntas_para_aclarar: ["¿Desde cuándo ocurre?", "¿Afecta a más usuarios?", "¿Hubo cambios recientes (PC/red/app)?"],
  riesgos_y_precauciones: ["No aplicar cambios sin validación.", "Evitar borrar datos sin respaldo."],
  tickets_historicos_usados: [],
  confianza: 0.2,
};

export default function TiPage() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [role, setRole] = useState<"ti" | "jefes" | null>(null);

  const [q, setQ] = useState("");
  const [options, setOptions] = useState<TicketOption[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const [selected, setSelected] = useState<TicketOption | null>(null);

  const [loadingInsight, setLoadingInsight] = useState(false);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [insightError, setInsightError] = useState<string>("");

  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  const pbiUrl = useMemo(() => {
    if (role === "ti") return PBI_TI;
    if (role === "jefes") return PBI_JEFES;
    return null;
  }, [role]);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/ti/auth/me", { method: "GET" });
        if (!res.ok) {
          router.replace("/?next=/ti");
          return;
        }
        const js = await res.json().catch(() => null);
        if (!js?.ok) {
          router.replace("/?next=/ti");
          return;
        }

        const r = js?.role;
        if (r !== "ti" && r !== "jefes") {
          router.replace("/?next=/ti");
          return;
        }

        setAuthorized(true);
        setRole(r);
      } catch {
        router.replace("/?next=/ti");
      }
    };
    check();
  }, [router]);

  const logout = async () => {
    try {
      await fetch("/api/ti/auth/logout", { method: "POST" });
    } catch {}

    setAuthorized(false);
    setRole(null);
    setSelected(null);
    setOptions([]);
    setInsight(null);
    setInsightError("");
    setRating(null);
    setComment("");
    setFeedbackSent(false);
    setSendingFeedback(false);

    router.push("/");
  };

  useEffect(() => {
    if (!authorized) return;

    const handle = setTimeout(async () => {
      setLoadingTickets(true);
      try {
        const res = await fetch(`/api/ti-tickets?q=${encodeURIComponent(q)}`);
        const js = await res.json().catch(() => null);

        const raw = js?.data ?? js?.rows ?? [];
        const arr = Array.isArray(raw) ? raw : [];

        const normalized = arr
          .map((x: any) => normalizeTicketOption(x))
          .filter(Boolean) as TicketOption[];

        setOptions(normalized);
      } catch {
        setOptions([]);
      } finally {
        setLoadingTickets(false);
      }
    }, 350);

    return () => clearTimeout(handle);
  }, [q, authorized]);

  const generateInsight = async () => {
    setInsight(null);
    setInsightError("");

    if (!selected?.id_ticket) {
      setInsightError("Selecciona un ticket primero.");
      return;
    }

    setLoadingInsight(true);
    try {
      const res = await fetch("/api/ai/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_ticket: selected.id_ticket }),
      });

      const js = await res.json().catch(() => null);

      if (js?.ok && js?.data) {
        setInsight(js.data as Insight);
        return;
      }

      // placeholder: no rompas UI
      setInsight(DUMMY_INSIGHT);
      setInsightError(js?.error ?? "");
    } catch (e: any) {
      setInsight(DUMMY_INSIGHT);
      setInsightError(e?.message ?? "");
    } finally {
      setLoadingInsight(false);
    }
  };

  const sendFeedback = async () => {
    if (!rating) return;

    setSendingFeedback(true);
    try {
      const res = await fetch("/api/ti-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });

      const js = await res.json().catch(() => null);

      // placeholder: si backend no existe o responde raro, igual marca enviado
      if (!js || js.ok) {
        setFeedbackSent(true);
        return;
      }

      setFeedbackSent(true);
    } catch {
      setFeedbackSent(true);
    } finally {
      setSendingFeedback(false);
    }
  };

  const resetFeedbackForm = () => {
    setRating(null);
    setComment("");
    setFeedbackSent(false);
    setSendingFeedback(false);
  };

  if (!authorized) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ opacity: 0.75 }}>Redirigiendo…</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Seguimiento Tickets TI</div>
          <div style={{ opacity: 0.75, fontSize: 12 }}>
            Rol: {role === "ti" ? "Responsable TI" : "Jefatura"} · Power BI + Copiloto
          </div>
        </div>

        <button
          onClick={logout}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #333", cursor: "pointer" }}
        >
          Salir
        </button>
      </div>

      {pbiUrl ? (
        <div style={{ width: "100%", height: "72vh", borderRadius: 16, overflow: "hidden", border: "1px solid #2a2a2a" }}>
          <iframe title="Power BI" src={pbiUrl} width="100%" height="100%" style={{ border: "none" }} allowFullScreen />
        </div>
      ) : null}

      <div style={{ marginTop: 14, padding: 16, borderRadius: 16, border: "1px solid #2a2a2a" }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Copiloto TI (gpt 5 mini)</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "start" }}>
          <div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar ticket por ID o título..."
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 10,
                border: "1px solid #333",
                background: "transparent",
                color: "inherit",
              }}
            />

            <div style={{ marginTop: 10, border: "1px solid #333", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "8px 10px", fontSize: 12, opacity: 0.8, borderBottom: "1px solid #333" }}>
                {loadingTickets ? "Buscando..." : "Resultados (elige uno)"}
              </div>

              <div style={{ maxHeight: 220, overflow: "auto" }}>
                {options.length === 0 ? (
                  <div style={{ padding: 10, opacity: 0.7, fontSize: 12 }}>No hay resultados.</div>
                ) : (
                  options.map((t) => {
                    const active = selected?.id_ticket === t.id_ticket;
                    return (
                      <button
                        key={t.id_ticket}
                        onClick={() => setSelected(t)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: 10,
                          border: "none",
                          borderTop: "1px solid #2a2a2a",
                          background: active ? "rgba(255,255,255,0.06)" : "transparent",
                          color: "inherit",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {t.id_ticket}{" "}
                          <span style={{ opacity: 0.7, fontWeight: 400 }}>· {t.status_name ?? "—"}</span>
                        </div>
                        <div style={{ opacity: 0.75, fontSize: 12 }}>{t.ticket_title ?? ""}</div>
                        <div style={{ opacity: 0.6, fontSize: 11 }}>{safeCategoryLabel(t)}</div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {selected ? (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 10, border: "1px dashed #333", fontSize: 12, opacity: 0.85 }}>
                Seleccionado: <b>{selected.id_ticket}</b> — {selected.ticket_title ?? ""}
              </div>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <button
              onClick={generateInsight}
              disabled={loadingInsight}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #333",
                cursor: "pointer",
                opacity: loadingInsight ? 0.7 : 1,
              }}
            >
              {loadingInsight ? "Generando..." : "Generar insight"}
            </button>

            <div style={{ fontSize: 12, opacity: 0.7, width: 260 }}>
              La respuesta usa el ticket actual + históricos resueltos (misma categoría) para sugerir pasos y riesgos.
            </div>
          </div>
        </div>

        {insightError ? <div style={{ marginTop: 12, color: "#ff6b6b" }}>{insightError}</div> : null}

        {insight ? (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #333" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>Insight</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Confianza: {(insight.confianza * 100).toFixed(0)}%</div>
            </div>

            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Resumen</div>
              <div style={{ opacity: 0.9 }}>{insight.resumen}</div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Diagnóstico probable</div>
              <div style={{ opacity: 0.9 }}>{insight.diagnostico_probable}</div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Pasos sugeridos</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {insight.pasos_sugeridos.map((x, i) => (
                  <li key={i} style={{ marginBottom: 6, opacity: 0.95 }}>
                    {x}
                  </li>
                ))}
              </ul>
            </div>

            {insight.preguntas_para_aclarar?.length ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Preguntas para aclarar</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {insight.preguntas_para_aclarar.map((x, i) => (
                    <li key={i} style={{ marginBottom: 6, opacity: 0.95 }}>
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {insight.riesgos_y_precauciones?.length ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Riesgos y precauciones</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {insight.riesgos_y_precauciones.map((x, i) => (
                    <li key={i} style={{ marginBottom: 6, opacity: 0.95 }}>
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {insight.tickets_historicos_usados?.length ? (
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                Históricos usados: {insight.tickets_historicos_usados.join(", ")}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 16, padding: 16, borderRadius: 16, border: "1px solid #2a2a2a" }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Valora el Copiloto TI</div>

        {feedbackSent ? (
          <div>
            <div style={{ color: "#6bff95", fontSize: 13, marginBottom: 8 }}>Gracias por tu feedback 🙌</div>

            <button
              onClick={resetFeedbackForm}
              style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #333", cursor: "pointer" }}
            >
              Ingresar nueva valoración
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #333",
                    background: rating === n ? "#fff" : "transparent",
                    color: rating === n ? "#000" : "inherit",
                    cursor: "pointer",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Comentario opcional..."
              rows={3}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid #333",
                background: "transparent",
                color: "inherit",
              }}
            />

            <button
              onClick={sendFeedback}
              disabled={!rating || sendingFeedback}
              style={{
                marginTop: 10,
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #333",
                cursor: "pointer",
                opacity: !rating || sendingFeedback ? 0.6 : 1,
              }}
            >
              {sendingFeedback ? "Enviando..." : "Enviar feedback"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}