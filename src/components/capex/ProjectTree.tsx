// src/components/capex/ProjectTree.tsx
"use client";

import React, { useMemo, useState } from "react";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

export type WbsNode = {
  wbs_code: string;
  wbs_name: string;
};

export type ProjectNode = {
  project_code: string;
  project_name: string;
  wbs: WbsNode[];
};

type Props = {
  data: ProjectNode[];
  selectedProject?: string | null;
  selectedWbs?: string | null;
  onSelectProject?: (project_code: string | null) => void;
  onSelectWbs?: (wbs_code: string | null) => void;
  height?: number;
};

export function ProjectTree({
  data,
  selectedProject,
  selectedWbs,
  onSelectProject,
  onSelectWbs,
  height = 520,
}: Props) {
  const [q, setQ] = useState<string>("");

  const filtered = useMemo<ProjectNode[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return data;

    return data
      .map((p) => {
        const matchProject =
          p.project_code.toLowerCase().includes(term) ||
          p.project_name.toLowerCase().includes(term);

        const wbs = p.wbs.filter(
          (w) =>
            w.wbs_code.toLowerCase().includes(term) ||
            w.wbs_name.toLowerCase().includes(term)
        );

        if (matchProject) return p;
        if (wbs.length) return { ...p, wbs };
        return null;
      })
      .filter((x): x is ProjectNode => x !== null);
  }, [data, q]);

  return (
    <div className="panel-inner" style={{ padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 900, letterSpacing: 0.2 }}>Proyectos</div>
        <div style={{ marginLeft: "auto" }}>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => {
              onSelectProject?.(null);
              onSelectWbs?.(null);
            }}
          >
            Limpiar
          </Button>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <Input
          placeholder="Buscar (código o nombre)…"
          value={q}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setQ(e.target.value)
          }
        />
      </div>

      <div
        style={{
          marginTop: 10,
          maxHeight: height,
          overflow: "auto",
          paddingRight: 6,
        }}
      >
        {filtered.length === 0 ? (
          <div className="muted" style={{ padding: 10 }}>
            Sin resultados.
          </div>
        ) : (
          filtered.map((p) => {
            const isP = selectedProject === p.project_code;
            return (
              <div key={p.project_code} style={{ marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectProject?.(p.project_code);
                    onSelectWbs?.(null);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 10px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: isP
                      ? "rgba(102,199,255,.18)"
                      : "rgba(0,0,0,.10)",
                    color: "var(--text)",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        minWidth: 54,
                        textAlign: "center",
                        borderRadius: 999,
                        padding: "4px 10px",
                        border: "1px solid var(--border)",
                        background: "rgba(0,0,0,.12)",
                      }}
                    >
                      {p.project_code}
                    </div>
                    <div style={{ lineHeight: 1.1 }}>
                      <div>{p.project_name}</div>
                      <div
                        className="muted"
                        style={{ fontSize: 12, fontWeight: 800 }}
                      >
                        {p.wbs.length} WBS
                      </div>
                    </div>
                  </div>
                </button>

                <div style={{ marginTop: 6, paddingLeft: 12 }}>
                  {p.wbs.map((w) => {
                    const isW = selectedWbs === w.wbs_code;
                    return (
                      <button
                        key={w.wbs_code}
                        type="button"
                        onClick={() => {
                          onSelectProject?.(p.project_code);
                          onSelectWbs?.(w.wbs_code);
                        }}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "8px 10px",
                          marginTop: 6,
                          borderRadius: 12,
                          border: "1px solid rgba(191,231,255,.18)",
                          background: isW
                            ? "rgba(191,231,255,.12)"
                            : "rgba(0,0,0,.08)",
                          color: "var(--text)",
                          cursor: "pointer",
                          fontWeight: 800,
                        }}
                      >
                        <span style={{ opacity: 0.95 }}>{w.wbs_code}</span>
                        <span
                          className="muted"
                          style={{ marginLeft: 8, fontWeight: 800 }}
                        >
                          {w.wbs_name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
