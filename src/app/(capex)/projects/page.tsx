// src/app/(capex)/projects/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import { ProjectTree, ProjectNode } from "../../../components/capex/ProjectTree";
import { Input } from "../../../components/ui/Input";
import { Select, SelectOption } from "../../../components/ui/Select";
import { Button } from "../../../components/ui/Button";

type ProjectForm = {
  project_code: string;
  project_name: string;
  proj_group_id: string;
  inv_class_id: string;
  proj_condition_id: string;
  proj_area_id: string;
  priority_id: string;
};

const emptyProject: ProjectForm = {
  project_code: "",
  project_name: "",
  proj_group_id: "",
  inv_class_id: "",
  proj_condition_id: "",
  proj_area_id: "",
  priority_id: "",
};

// placeholders (luego los jalas de dim.*)
const OPT_EMPTY: SelectOption[] = [{ value: "", label: "—" }];

// ✅ Nombres WBS (luego lo jalas de dim_wbs_name)
const OPT_WBS_NAME: SelectOption[] = [
  { value: "", label: "— Selecciona —" },
  { value: "Ingeniería", label: "Ingeniería" },
  { value: "Procura", label: "Procura" },
  { value: "Construcción", label: "Construcción" },
  { value: "Supervisión", label: "Supervisión" },
  { value: "Puesta en marcha", label: "Puesta en marcha" },
];

function nextWbsCode(project_code: string, existing: { wbs_code: string }[]) {
  const pc = project_code.trim();
  const prefix = pc + ".";
  const nums = existing
    .map((x) => x.wbs_code)
    .filter((c) => c.startsWith(prefix))
    .map((c) => {
      const s = c.split(".")[1] ?? "";
      const n = Number(s);
      return Number.isFinite(n) ? n : 0;
    });

  const max = nums.length ? Math.max(...nums) : 0;
  const next = max + 1;
  const nn = String(next).padStart(2, "0");
  return `${pc}.${nn}`;
}

export default function ProjectsPage() {
  const [data, setData] = useState<ProjectNode[]>([
    {
      project_code: "01",
      project_name: "Proyecto Demo",
      wbs: [
        { wbs_code: "01.01", wbs_name: "Ingeniería" },
        { wbs_code: "01.02", wbs_name: "Construcción" },
      ],
    },
  ]);

  const [selectedProject, setSelectedProject] = useState<string | null>("01");
  const [selectedWbs, setSelectedWbs] = useState<string | null>(null);

  const [proj, setProj] = useState<ProjectForm>(emptyProject);
  const [wbsName, setWbsName] = useState<string>("");

  const [msg, setMsg] = useState<string | null>(null);

  const selectedProjectNode = useMemo(() => {
    if (!selectedProject) return null;
    return data.find((p) => p.project_code === selectedProject) ?? null;
  }, [data, selectedProject]);

  function loadProjectToForm(project_code: string) {
    const p = data.find((x) => x.project_code === project_code);
    if (!p) return;
    setProj({
      project_code: p.project_code,
      project_name: p.project_name,
      proj_group_id: "",
      inv_class_id: "",
      proj_condition_id: "",
      proj_area_id: "",
      priority_id: "",
    });
  }

  function validateProject(f: ProjectForm) {
    if (!/^\d{2}$/.test(f.project_code.trim())) return "project_code debe ser NN (ej: 01)";
    if (!f.project_name.trim()) return "project_name es obligatorio";
    return null;
  }

  function upsertProjectLocal() {
    setMsg(null);
    const err = validateProject(proj);
    if (err) return setMsg(err);

    const code = proj.project_code.trim();
    const name = proj.project_name.trim();

    setData((prev) => {
      const i = prev.findIndex((x) => x.project_code === code);

      const nextNode: ProjectNode = {
        project_code: code,
        project_name: name,
        wbs: i >= 0 ? prev[i].wbs : [],
      };

      if (i >= 0) {
        const copy = [...prev];
        copy[i] = nextNode;
        return copy;
      }

      return [...prev, nextNode].sort((a, b) => a.project_code.localeCompare(b.project_code));
    });

    setSelectedProject(code);
    setSelectedWbs(null);
    setWbsName("");
    setMsg("OK: proyecto guardado (local)");
  }

  function addWbsLocal() {
    setMsg(null);

    const pc = (selectedProject ?? proj.project_code).trim();
    if (!/^\d{2}$/.test(pc)) return setMsg("Primero guarda/selecciona un proyecto válido (NN).");

    const p = data.find((x) => x.project_code === pc);
    if (!p) return setMsg("Primero guarda el proyecto.");

    const name = (wbsName ?? "").trim();
    if (!name) return setMsg("Selecciona un nombre de WBS.");

    const dupByName = p.wbs.some((x) => x.wbs_name.toLowerCase() === name.toLowerCase());
    if (dupByName) return setMsg("No se puede duplicar WBS con el mismo nombre en el mismo proyecto.");

    const wc = nextWbsCode(pc, p.wbs);

    setData((prev) => {
      const pi = prev.findIndex((x) => x.project_code === pc);
      if (pi < 0) return prev;

      const projPrev = prev[pi];

      // seguridad extra (no duplicar por código)
      if (projPrev.wbs.some((x) => x.wbs_code === wc)) return prev;

      const nextWbs = [...projPrev.wbs, { wbs_code: wc, wbs_name: name }].sort((a, b) =>
        a.wbs_code.localeCompare(b.wbs_code)
      );

      const nextP: ProjectNode = { ...projPrev, wbs: nextWbs };
      const copy = [...prev];
      copy[pi] = nextP;
      return copy;
    });

    setSelectedProject(pc);
    setSelectedWbs(wc);
    setWbsName("");
    setMsg("OK: WBS agregado (local)");
  }

  const existingWbs = selectedProjectNode?.wbs ?? [];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 14 }}>
      <ProjectTree
        data={data}
        selectedProject={selectedProject}
        selectedWbs={selectedWbs}
        onSelectProject={(pc) => {
          setMsg(null);
          setSelectedProject(pc);
          setSelectedWbs(null);
          setWbsName("");
          if (pc) loadProjectToForm(pc);
        }}
        onSelectWbs={(wc) => {
          setMsg(null);
          setSelectedWbs(wc);
        }}
        height={640}
      />

      <div style={{ display: "grid", gap: 12 }}>
        {/* Header */}
        <div className="panel-inner" style={{ padding: 10, display: "flex", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>Proyecto + WBS</div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setMsg(null);
                setProj(emptyProject);
                setSelectedProject(null);
                setSelectedWbs(null);
                setWbsName("");
              }}
            >
              Nuevo
            </Button>
          </div>
        </div>

        {/* Proyecto */}
        <div className="panel-inner" style={{ padding: 14 }}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
              <Input
                placeholder="01"
                value={proj.project_code}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setProj((s) => ({ ...s, project_code: e.target.value }))
                }
                hint="Código NN"
              />
              <Input
                placeholder="Nombre del proyecto"
                value={proj.project_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setProj((s) => ({ ...s, project_name: e.target.value }))
                }
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Select
                label="Grupo"
                value={proj.proj_group_id}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setProj((s) => ({ ...s, proj_group_id: e.target.value }))
                }
                options={OPT_EMPTY}
              />
              <Select
                label="Inv. Class"
                value={proj.inv_class_id}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setProj((s) => ({ ...s, inv_class_id: e.target.value }))
                }
                options={OPT_EMPTY}
              />
              <Select
                label="Condición"
                value={proj.proj_condition_id}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setProj((s) => ({ ...s, proj_condition_id: e.target.value }))
                }
                options={OPT_EMPTY}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Select
                label="Área"
                value={proj.proj_area_id}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setProj((s) => ({ ...s, proj_area_id: e.target.value }))
                }
                options={OPT_EMPTY}
              />
              <Select
                label="Prioridad"
                value={proj.priority_id}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setProj((s) => ({ ...s, priority_id: e.target.value }))
                }
                options={OPT_EMPTY}
              />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Button type="button" variant="primary" onClick={upsertProjectLocal}>
                Guardar Proyecto
              </Button>
            </div>
          </div>
        </div>

        {/* WBS debajo (con dropdown) */}
        <div className="panel-inner" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>WBS</div>
            <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
              {selectedProject ? `Proyecto: ${selectedProject}` : "Guarda/selecciona un proyecto para agregar WBS"}
            </div>
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 190px", gap: 12 }}>
            <Select
              label="Nombre de WBS"
              value={wbsName}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setWbsName(e.target.value)}
              options={OPT_WBS_NAME}
            />

            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <Button type="button" variant="primary" onClick={addWbsLocal} style={{ width: "100%" } as any}>
                Añadir WBS
              </Button>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {existingWbs.length === 0 ? (
              <div className="muted" style={{ fontWeight: 800 }}>
                Sin WBS todavía.
              </div>
            ) : (
              existingWbs.map((w) => {
                const active = selectedWbs === w.wbs_code;
                return (
                  <button
                    key={w.wbs_code}
                    type="button"
                    onClick={() => setSelectedWbs(w.wbs_code)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(191,231,255,.18)",
                      background: active ? "rgba(191,231,255,.12)" : "rgba(0,0,0,.08)",
                      color: "var(--text)",
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    <span style={{ opacity: 0.95 }}>{w.wbs_code}</span>
                    <span className="muted" style={{ marginLeft: 10, fontWeight: 800 }}>
                      {w.wbs_name}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Message */}
        {msg ? (
          <div
            className="panel-inner"
            style={{
              padding: 12,
              border: msg.startsWith("OK") ? "1px solid rgba(102,199,255,.45)" : "1px solid rgba(255,80,80,.45)",
              background: msg.startsWith("OK") ? "rgba(102,199,255,.10)" : "rgba(255,80,80,.10)",
              fontWeight: 800,
            }}
          >
            {msg}
          </div>
        ) : null}
      </div>
    </div>
  );
}
