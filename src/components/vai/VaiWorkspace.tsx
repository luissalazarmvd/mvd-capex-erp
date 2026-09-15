// src/components/vai/VaiWorkspace.tsx
//
// Orquestador de V-Ai: prompt → /api/vai/generate (única llamada a IA) →
// dashboard renderizado con datos reales → guardado automático → inventario.
// Abrir, filtrar, actualizar, renombrar y eliminar no consumen IA.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../ui/Button";
import { parseStoredSpec, type VaiDashboardSpec } from "../../lib/vai/spec";
import { deleteDashboard, getDashboard, listDashboards, saveDashboard, type VaiDashboardRecord } from "../../lib/vai/store";
import VaiDashboard from "./VaiDashboard";
import VaiInventory, { formatStamp } from "./VaiInventory";
import VaiPromptForm, { type VaiPromptRequest } from "./VaiPromptForm";

type GenerateResponse =
  | { ok: true; status: "ok" | "partial" | "unavailable"; message: string; unavailable: string[]; spec: VaiDashboardSpec | null }
  | { ok: false; error: string };

type Board = {
  spec: VaiDashboardSpec;
  prompt: string;
  id: number | null;
  name: string;
  savedAt: string | null;
  message: string;
  notes: string[];
  saveError: string | null;
};

const STEPS = ["Validando la solicitud", "Identificando fuentes del catálogo", "Diseñando el dashboard con IA", "Validando la especificación", "Consultando datos reales"];

export default function VaiWorkspace() {
  const [items, setItems] = useState<VaiDashboardRecord[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [generating, setGenerating] = useState<{ step: number; prompt: string } | null>(null);
  const [failure, setFailure] = useState<{ message: string; unavailable: string[] } | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VaiDashboardRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [titleDraft, setTitleDraft] = useState("");
  const [lastRequest, setLastRequest] = useState<VaiPromptRequest | null>(null);
  const stepTimers = useRef<number[]>([]);

  const reloadInventory = useCallback(async () => {
    setInventoryLoading(true);
    setInventoryError(null);
    try {
      setItems(await listDashboards());
    } catch (error) {
      setInventoryError(error instanceof Error ? error.message : "No se pudo cargar el inventario");
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadInventory();
  }, [reloadInventory]);

  useEffect(() => () => stepTimers.current.forEach((timer) => window.clearTimeout(timer)), []);

  function scheduleSteps(prompt: string) {
    stepTimers.current.forEach((timer) => window.clearTimeout(timer));
    setGenerating({ step: 0, prompt });
    stepTimers.current = [900, 2200].map((delay, i) => window.setTimeout(() => setGenerating((prev) => (prev ? { ...prev, step: i + 1 } : prev)), delay));
  }

  async function generate(request: VaiPromptRequest) {
    setLastRequest(request);
    setFailure(null);
    setBoard(null);
    scheduleSteps(request.prompt);
    let response: GenerateResponse;
    try {
      const res = await fetch("/api/vai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(request),
      });
      response = (await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))) as GenerateResponse;
      if (res.status === 401) response = { ok: false, error: "Tu sesión de V-Ai expiró. Vuelve al portal e ingresa de nuevo." };
    } catch {
      response = { ok: false, error: "No se pudo contactar al servicio de generación." };
    }
    stepTimers.current.forEach((timer) => window.clearTimeout(timer));

    if (!response.ok) {
      setGenerating(null);
      setFailure({ message: response.error, unavailable: [] });
      return;
    }
    if (!response.spec) {
      setGenerating(null);
      setFailure({
        message: response.message || "Actualmente no existe información disponible en V-Ai para construir ese dashboard.",
        unavailable: response.unavailable,
      });
      return;
    }

    setGenerating({ step: 4, prompt: request.prompt });
    const next: Board = {
      spec: response.spec,
      prompt: request.prompt,
      id: null,
      name: response.spec.title,
      savedAt: null,
      message: response.status === "partial" ? response.message : "",
      notes: response.unavailable,
      saveError: null,
    };
    // Guardado automático de la definición; los datos se consultan al abrir.
    try {
      const id = await saveDashboard({ name: next.name, description: next.spec.description, prompt: next.prompt, spec: next.spec, model: null });
      next.id = Number.isFinite(id) ? id : null;
      next.savedAt = new Date().toISOString();
    } catch (error) {
      next.saveError = error instanceof Error ? error.message : "No se pudo guardar el dashboard";
    }
    setGenerating(null);
    setTitleDraft(next.name);
    setBoard(next);
    setRefreshToken((token) => token + 1);
    void reloadInventory();
  }

  async function open(item: VaiDashboardRecord) {
    setFailure(null);
    setOpening(item.dashboard_id);
    try {
      const detail = await getDashboard(item.dashboard_id);
      if (!detail) throw new Error("El dashboard ya no existe.");
      let raw: unknown = null;
      try {
        raw = JSON.parse(detail.spec_json);
      } catch {
        raw = null;
      }
      const { spec, notes } = parseStoredSpec(raw);
      if (!spec) {
        setFailure({ message: `«${detail.dashboard_name}» ya no puede reconstruirse con el catálogo actual.`, unavailable: notes });
        setBoard(null);
        return;
      }
      setTitleDraft(detail.dashboard_name);
      setBoard({
        spec: { ...spec, title: detail.dashboard_name },
        prompt: detail.prompt_text,
        id: detail.dashboard_id,
        name: detail.dashboard_name,
        savedAt: detail.updated_at || detail.created_at,
        message: "",
        notes,
        saveError: null,
      });
      setRefreshToken((token) => token + 1);
    } catch (error) {
      setFailure({ message: error instanceof Error ? error.message : "No se pudo abrir el dashboard", unavailable: [] });
    } finally {
      setOpening(null);
    }
  }

  async function persist(current: Board, name: string) {
    try {
      const id = await saveDashboard({ dashboard_id: current.id, name, description: current.spec.description, prompt: current.prompt, spec: current.spec, model: null });
      setBoard((prev) => (prev ? { ...prev, id: Number.isFinite(id) ? id : prev.id, name, spec: { ...prev.spec, title: name }, savedAt: new Date().toISOString(), saveError: null } : prev));
      void reloadInventory();
    } catch (error) {
      setBoard((prev) => (prev ? { ...prev, saveError: error instanceof Error ? error.message : "No se pudo guardar" } : prev));
    }
  }

  function commitTitle() {
    if (!board) return;
    const name = titleDraft.trim().slice(0, 150);
    if (!name) {
      setTitleDraft(board.name);
      return;
    }
    if (name !== board.name || !board.id) void persist(board, name);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteDashboard(pendingDelete.dashboard_id);
      if (board?.id === pendingDelete.dashboard_id) setBoard(null);
      setPendingDelete(null);
      void reloadInventory();
    } catch (error) {
      setInventoryError(error instanceof Error ? error.message : "No se pudo eliminar");
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  const deleteModal =
    pendingDelete && typeof document !== "undefined"
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="vai-delete-title"
            style={{ position: "fixed", inset: 0, zIndex: 12000, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, background: "rgba(0,0,0,.68)" }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !deleting) setPendingDelete(null);
            }}
          >
            <section className="panel-inner" style={{ width: "min(440px, 96vw)", padding: 18, display: "grid", gap: 12, background: "#071a24", borderColor: "rgba(147,211,230,.34)" }}>
              <h2 id="vai-delete-title" style={{ margin: 0, fontSize: 18 }}>Eliminar dashboard</h2>
              <p style={{ margin: 0 }}>
                Se eliminará la configuración de «{pendingDelete.dashboard_name}». Los datos de las fuentes no se modifican.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={deleting}>
                  Cancelar
                </Button>
                <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
                  {deleting ? "Eliminando…" : "Eliminar"}
                </Button>
              </div>
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="vai-shell">
      <div className="vai-main">
        {failure ? (
          <section className="trjk-card" style={{ display: "grid", gap: 10 }}>
            <div className="vai-message" data-error="true">{failure.message}</div>
            {failure.unavailable.length ? (
              <div className="vai-notes">
                <strong>No disponible en V-Ai:</strong>
                <ul>
                  {failure.unavailable.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div>
              <Button variant="ghost" size="sm" onClick={() => setFailure(null)}>
                Cerrar
              </Button>
            </div>
          </section>
        ) : null}

        {!board && !generating ? <VaiPromptForm busy={opening != null} initial={lastRequest} onGenerate={generate} /> : null}

        {generating ? (
          <section className="trjk-card vai-progress" aria-live="polite">
            <h3>Generando dashboard</h3>
            <p className="muted" style={{ margin: 0 }}>«{generating.prompt.length > 160 ? `${generating.prompt.slice(0, 160)}…` : generating.prompt}»</p>
            <div className="vai-bar">
              <span />
            </div>
            <ol>
              {STEPS.map((label, i) => (
                <li key={label} data-state={i < generating.step ? "done" : i === generating.step ? "active" : "pending"}>
                  {label}
                </li>
              ))}
            </ol>
            <p className="muted" style={{ margin: 0, fontSize: 11 }}>OpenAI recibe solo el catálogo de metadatos; los datos reales se consultan después desde nuestros endpoints.</p>
          </section>
        ) : null}

        {board ? (
          <section className="trjk-card" style={{ display: "grid", gap: 12 }}>
            <div className="vai-board-head">
              <div style={{ display: "grid", gap: 4, minWidth: 0, flex: 1 }}>
                <input
                  className="input vai-title"
                  value={titleDraft}
                  maxLength={150}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setTitleDraft(board.name);
                  }}
                  aria-label="Nombre del dashboard"
                  title="Editar nombre; se guarda al salir del campo"
                />
                <div className="vai-board-meta">
                  {board.id ? `Guardado · ${formatStamp(board.savedAt)}` : "Sin guardar"}
                  {board.saveError ? <span style={{ color: "var(--bad)" }}> · {board.saveError}</span> : null}
                  {" · "}
                  <span title={board.prompt}>Prompt: {board.prompt.length > 90 ? `${board.prompt.slice(0, 90)}…` : board.prompt}</span>
                </div>
              </div>
              <div className="trjk-actions">
                {board.saveError ? (
                  <Button size="sm" variant="primary" onClick={() => void persist(board, board.name)}>
                    Reintentar guardado
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => setRefreshToken((token) => token + 1)}>
                  Actualizar datos
                </Button>
                <Button size="sm" variant="default" onClick={() => setBoard(null)}>
                  Nuevo dashboard
                </Button>
              </div>
            </div>

            {board.message ? <div className="vai-message">{board.message}</div> : null}
            {board.notes.length ? (
              <div className="vai-notes">
                <strong>Partes no construidas:</strong>
                <ul>
                  {board.notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <VaiDashboard spec={board.spec} refreshToken={refreshToken} />
          </section>
        ) : null}
      </div>

      <aside className="vai-side">
        <VaiInventory
          items={items}
          loading={inventoryLoading || opening != null}
          error={inventoryError}
          currentId={board?.id ?? null}
          onOpen={(item) => void open(item)}
          onDelete={setPendingDelete}
          onNew={() => {
            setBoard(null);
            setFailure(null);
          }}
          onReload={() => void reloadInventory()}
        />
        <section className="trjk-card" style={{ fontSize: 11, color: "var(--ink-2)", display: "grid", gap: 6 }}>
          <h3 style={{ color: "var(--ink)" }}>Cómo funciona</h3>
          <p style={{ margin: 0 }}>La IA solo recibe el catálogo de fuentes (nombres de campos, métricas y reglas), nunca registros, montos ni nombres reales.</p>
          <p style={{ margin: 0 }}>Los datos se consultan desde los endpoints existentes al abrir cada dashboard; los filtros no usan IA.</p>
        </section>
      </aside>

      {deleteModal}
    </div>
  );
}
