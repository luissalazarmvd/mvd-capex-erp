// src/app/(capex)/projects/page.tsx
"use client";

import { apiGet, apiPost } from "../../../lib/apiClient";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ProjectTree, ProjectNode } from "../../../components/capex/ProjectTree";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

export type SelectOption = { value: string; label: string };

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

const OPT_EMPTY: SelectOption[] = [{ value: "", label: "—" }];

// ✅ Nombres WBS (placeholder por ahora)
const OPT_WBS_NAME: SelectOption[] = [
  { value: "", label: "— Selecciona —" },
  { value: "Ingeniería", label: "Ingeniería" },
  { value: "Procura", label: "Procura" },
  { value: "Construcción", label: "Construcción" },
  { value: "Supervisión", label: "Supervisión" },
  { value: "Puesta en marcha", label: "Puesta en marcha" },
];

type LookupOption = { id: number; name: string };
type PriorityOption = { id: number; name: string; order: number | null };

type ProjectRow = {
  project_code: string;
  project_name: string;
  proj_group_id: number | null;
  inv_class_id: number | null;
  proj_condition_id: number | null;
  proj_area_id: number | null;
  priority_id: number | null;
};

type ProjectsMeta = {
  tree: ProjectNode[];
  projects: ProjectRow[];
  lookups: {
    inv_classes: LookupOption[];
    priorities: PriorityOption[];
    proj_areas: LookupOption[];
    proj_conditions: LookupOption[];
    proj_groups: LookupOption[];
  };
};

function toSelectOptions(xs: LookupOption[], emptyLabel = "—"): SelectOption[] {
  return [{ value: "", label: emptyLabel }, ...xs.map((x) => ({ value: String(x.id), label: x.name }))];
}

function toPriorityOptions(xs: PriorityOption[]): SelectOption[] {
  const sorted = [...xs].sort((a, b) => {
    const ao = a.order ?? 999999;
    const bo = b.order ?? 999999;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name);
  });
  return [{ value: "", label: "—" }, ...sorted.map((x) => ({ value: String(x.id), label: x.name }))];
}

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

function asNullableInt(s: string): number | null {
  const t = (s ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * ✅ Custom dropdown (no native <select>)
 * - Fondo azul oscuro (panel2)
 * - Letras blancas
 * - Hover celeste
 */
function DarkSelect({
  label,
  value,
  options,
  onValueChange,
  disabled,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const current = useMemo(() => {
    return options.find((o) => o.value === value)?.label ?? options[0]?.label ?? "—";
  }, [options, value]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={ref} style={{ display: "grid", gap: 6, position: "relative" }}>
      <div style={{ fontWeight: 900, fontSize: 13 }}>{label}</div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((s) => !s)}
        style={{
          width: "100%",
          background: "rgba(0,0,0,.10)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          borderRadius: 10,
          padding: "10px 12px",
          outline: "none",
          textAlign: "left",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          fontWeight: 900,
          opacity: disabled ? 0.7 : 1,
        }}
      >
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{current}</span>
        <span
          style={{
            width: 0,
            height: 0,
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderTop: "7px solid rgba(191,231,255,.75)",
            opacity: 0.9,
          }}
        />
      </button>

      {open ? (
        <div
          style={{
            position: "absolute",
            zIndex: 50,
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 6,
            background: "var(--panel2)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "var(--shadow)",
            overflow: "hidden",
            maxHeight: 240,
          }}
        >
          <div style={{ maxHeight: 240, overflow: "auto" }}>
            {options.map((o) => {
              const active = o.value === value;
              return (
                <button
                  key={o.value || "__empty__"}
                  type="button"
                  onClick={() => {
                    onValueChange(o.value);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "none",
                    background: active ? "rgba(102,199,255,.18)" : "transparent",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: active ? 900 : 800,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = active
                      ? "rgba(102,199,255,.18)"
                      : "rgba(102,199,255,.10)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = active
                      ? "rgba(102,199,255,.18)"
                      : "transparent";
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ProjectsPage() {
  // data del tree (izquierda)
  const [data, setData] = useState<ProjectNode[]>([]);

  // lista plana con FKs (para cargar a form cuando seleccionas)
  const [projectsFlat, setProjectsFlat] = useState<ProjectRow[]>([]);

  // lookups
  const [optGroups, setOptGroups] = useState<SelectOption[]>(OPT_EMPTY);
  const [optInvClass, setOptInvClass] = useState<SelectOption[]>(OPT_EMPTY);
  const [optCond, setOptCond] = useState<SelectOption[]>(OPT_EMPTY);
  const [optArea, setOptArea] = useState<SelectOption[]>(OPT_EMPTY);
  const [optPrio, setOptPrio] = useState<SelectOption[]>(OPT_EMPTY);

  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedWbs, setSelectedWbs] = useState<string | null>(null);

  const [proj, setProj] = useState<ProjectForm>(emptyProject);
  const [wbsName, setWbsName] = useState<string>("");

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  async function fetchMeta() {
    setLoading(true);
    setMsg(null);
    try {
      const meta = (await apiGet("/api/projects/meta")) as ProjectsMeta;

      setData(meta.tree ?? []);
      setProjectsFlat(meta.projects ?? []);

      setOptGroups(toSelectOptions(meta.lookups?.proj_groups ?? []));
      setOptInvClass(toSelectOptions(meta.lookups?.inv_classes ?? []));
      setOptCond(toSelectOptions(meta.lookups?.proj_conditions ?? []));
      setOptArea(toSelectOptions(meta.lookups?.proj_areas ?? []));
      setOptPrio(toPriorityOptions(meta.lookups?.priorities ?? []));

      if (!selectedProject && meta.tree?.length) {
        const first = meta.tree[0].project_code;
        setSelectedProject(first);
        setSelectedWbs(null);
      }
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando metadata");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProjectNode = useMemo(() => {
    if (!selectedProject) return null;
    return data.find((p) => p.project_code === selectedProject) ?? null;
  }, [data, selectedProject]);

  function loadProjectToForm(project_code: string) {
    const p = projectsFlat.find((x) => x.project_code === project_code);
    if (!p) {
      const t = data.find((x) => x.project_code === project_code);
      if (!t) return;
      setProj({
        project_code: t.project_code,
        project_name: t.project_name,
        proj_group_id: "",
        inv_class_id: "",
        proj_condition_id: "",
        proj_area_id: "",
        priority_id: "",
      });
      return;
    }

    setProj({
      project_code: p.project_code,
      project_name: p.project_name,
      proj_group_id: p.proj_group_id ? String(p.proj_group_id) : "",
      inv_class_id: p.inv_class_id ? String(p.inv_class_id) : "",
      proj_condition_id: p.proj_condition_id ? String(p.proj_condition_id) : "",
      proj_area_id: p.proj_area_id ? String(p.proj_area_id) : "",
      priority_id: p.priority_id ? String(p.priority_id) : "",
    });
  }

  function validateProject(f: ProjectForm) {
    if (!/^\d{2}$/.test(f.project_code.trim())) return "project_code debe ser NN (ej: 01)";
    if (!f.project_name.trim()) return "project_name es obligatorio";
    return null;
  }

  async function upsertProject() {
    setMsg(null);
    const err = validateProject(proj);
    if (err) return setMsg(err);

    const payload = {
      project_code: proj.project_code.trim(),
      project_name: proj.project_name.trim(),
      proj_group_id: asNullableInt(proj.proj_group_id),
      inv_class_id: asNullableInt(proj.inv_class_id),
      proj_condition_id: asNullableInt(proj.proj_condition_id),
      proj_area_id: asNullableInt(proj.proj_area_id),
      priority_id: asNullableInt(proj.priority_id),
    };

    try {
      await apiPost("/api/projects/upsert", payload);

      setMsg("OK: proyecto guardado");
      setSelectedProject(payload.project_code);
      setSelectedWbs(null);
      setWbsName("");
      await fetchMeta();
      loadProjectToForm(payload.project_code);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando proyecto");
    }
  }

  async function addWbs() {
    setMsg(null);

    const pc = (selectedProject ?? proj.project_code).trim();
    if (!/^\d{2}$/.test(pc)) return setMsg("Primero guarda/selecciona un proyecto válido (NN).");

    const pnode = data.find((x) => x.project_code === pc);
    if (!pnode) return setMsg("Primero guarda el proyecto.");

    const name = (wbsName ?? "").trim();
    if (!name) return setMsg("Selecciona un nombre de WBS.");

    const dupByName = pnode.wbs.some((x) => x.wbs_name.toLowerCase() === name.toLowerCase());
    if (dupByName) return setMsg("No se puede duplicar WBS con el mismo nombre en el mismo proyecto.");

    const wc = nextWbsCode(pc, pnode.wbs);

    try {
      await apiPost("/api/wbs/upsert", { project_code: pc, wbs_code: wc, wbs_name: name });

      setMsg("OK: WBS agregado");
      setSelectedProject(pc);
      setSelectedWbs(wc);
      setWbsName("");
      await fetchMeta();
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando WBS");
    }
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

            <Button type="button" size="sm" variant="ghost" onClick={() => fetchMeta()} disabled={loading}>
              {loading ? "Cargando..." : "Refrescar"}
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProj((s) => ({ ...s, project_code: e.target.value }))}
                hint="Código NN"
              />
              <Input
                placeholder="Nombre del proyecto"
                value={proj.project_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProj((s) => ({ ...s, project_name: e.target.value }))}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <DarkSelect
                label="Grupo"
                value={proj.proj_group_id}
                onValueChange={(v) => setProj((s) => ({ ...s, proj_group_id: v }))}
                options={optGroups}
                disabled={loading}
              />
              <DarkSelect
                label="Inv. Class"
                value={proj.inv_class_id}
                onValueChange={(v) => setProj((s) => ({ ...s, inv_class_id: v }))}
                options={optInvClass}
                disabled={loading}
              />
              <DarkSelect
                label="Condición"
                value={proj.proj_condition_id}
                onValueChange={(v) => setProj((s) => ({ ...s, proj_condition_id: v }))}
                options={optCond}
                disabled={loading}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <DarkSelect
                label="Área"
                value={proj.proj_area_id}
                onValueChange={(v) => setProj((s) => ({ ...s, proj_area_id: v }))}
                options={optArea}
                disabled={loading}
              />
              <DarkSelect
                label="Prioridad"
                value={proj.priority_id}
                onValueChange={(v) => setProj((s) => ({ ...s, priority_id: v }))}
                options={optPrio}
                disabled={loading}
              />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Button type="button" variant="primary" onClick={upsertProject} disabled={loading}>
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
            <DarkSelect
              label="Nombre de WBS"
              value={wbsName}
              onValueChange={(v) => setWbsName(v)}
              options={OPT_WBS_NAME}
              disabled={loading}
            />

            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <Button type="button" variant="primary" onClick={addWbs} style={{ width: "100%" } as any} disabled={loading}>
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
