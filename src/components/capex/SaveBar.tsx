// src/components/capex/SaveBar.tsx
"use client";

import React from "react";
import { Button } from "../ui/Button";

type Props = {
  dirtyCount: number;
  isSaving?: boolean;
  lastSavedAt?: string | null;
  error?: string | null;
  onSave: () => void;
  onReset?: () => void;
};

export function SaveBar({ dirtyCount, isSaving = false, lastSavedAt, error, onSave, onReset }: Props) {
  return (
    <div
      className="panel-inner"
      style={{
        padding: 12,
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ fontWeight: 900 }}>
        Cambios: <span style={{ color: "var(--accent2)" }}>{dirtyCount}</span>
      </div>

      <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
        {lastSavedAt ? `Último guardado: ${lastSavedAt}` : "Aún no guardas"}
      </div>

      <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
        {onReset ? (
          <Button type="button" variant="ghost" size="sm" disabled={isSaving || dirtyCount === 0} onClick={onReset}>
            Deshacer
          </Button>
        ) : null}

        <Button type="button" variant="primary" size="sm" disabled={isSaving || dirtyCount === 0} onClick={onSave}>
          {isSaving ? "Guardando…" : "Guardar"}
        </Button>
      </div>

      {error ? (
        <div
          style={{
            width: "100%",
            marginTop: 8,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,80,80,.55)",
            background: "rgba(255,80,80,.10)",
            color: "var(--text)",
            fontWeight: 800,
          }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
