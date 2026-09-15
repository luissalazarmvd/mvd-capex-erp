// src/components/vai/VaiInventory.tsx
//
// Inventario de dashboards guardados: abrir (vuelve a consultar los datos,
// sin IA) y eliminar (con confirmación en el orquestador).
"use client";

import { Button } from "../ui/Button";
import type { VaiDashboardRecord } from "../../lib/vai/store";

type Props = {
  items: VaiDashboardRecord[];
  loading: boolean;
  error: string | null;
  currentId: number | null;
  onOpen: (item: VaiDashboardRecord) => void;
  onDelete: (item: VaiDashboardRecord) => void;
  onNew: () => void;
  onReload: () => void;
};

export function formatStamp(value: string | null | undefined) {
  if (!value) return "";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return String(value).slice(0, 16).replace("T", " ");
  return new Date(parsed).toLocaleString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function VaiInventory({ items, loading, error, currentId, onOpen, onDelete, onNew, onReload }: Props) {
  return (
    <section className="trjk-card">
      <div className="trjk-toolbar">
        <h3>Mis dashboards</h3>
        <div className="trjk-actions">
          <Button size="sm" variant="ghost" onClick={onReload} disabled={loading} title="Actualizar inventario">
            ↻
          </Button>
          <Button size="sm" variant="default" onClick={onNew}>
            + Nuevo
          </Button>
        </div>
      </div>
      <div className="vai-inventory" style={{ marginTop: 10 }}>
        {error ? (
          <div className="vai-message" data-error="true">
            {error}
          </div>
        ) : loading && !items.length ? (
          <div className="vai-empty">Cargando…</div>
        ) : !items.length ? (
          <div className="vai-empty">Aún no hay dashboards guardados. El primero que generes aparecerá aquí.</div>
        ) : (
          items.map((item) => (
            <div key={item.dashboard_id} className="vai-inventory-item" role="button" tabIndex={0} aria-current={item.dashboard_id === currentId} onClick={() => onOpen(item)} onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(item);
              }
            }}>
              <div style={{ minWidth: 0 }}>
                <strong>{item.dashboard_name}</strong>
                {item.dashboard_desc ? <span>{item.dashboard_desc}</span> : null}
                <small>{formatStamp(item.updated_at || item.created_at)}</small>
              </div>
              <button
                type="button"
                className="vai-icon-btn"
                title="Eliminar dashboard"
                aria-label={`Eliminar ${item.dashboard_name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item);
                }}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
