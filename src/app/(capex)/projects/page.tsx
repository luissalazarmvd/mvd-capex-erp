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

type WbsForm = {
  wbs_code: string;
  wbs_name: string;
  project_code: string;
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

const emptyWbs: WbsForm = {
  wbs_code: "",
  wbs_name: "",
  project_code: "",
};

const OPT_EMPTY: SelectOption[] = [{ value: "", label: "—" }];

export default function ProjectsPage() {
  const [data, setData] = useState<ProjectNode[]>([
    {
      project_code: "01",
      project_name: "Proyecto Demo",
      wbs: [
        { wbs_code: "01.01", wbs_name: "WBS Demo 1" },
        { wbs_code: "01.02", wbs_name: "WBS Demo 2" },
      ],
    },
  ]);

  const [selectedProject, setSelectedProject] = useState<string | null>("01");
  const [selectedWbs, setSelectedWbs] = useState<string | null>(null);

  const [tab, setTab] = useState<"project" | "wbs">("project");
  const [proj, setProj] = useState<ProjectForm>(emptyProject);
  const [wbs, setWbs] = useState<WbsForm>(emptyWbs);
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

  function loadWbsToForm(wbs_code: string) {
    const p = selectedProjectNode;
    if (!p) return;
    const w = p.wbs.find((x) => x.wbs_code === wbs_code);
    if (!w) return;
    setWbs({
      wbs_code: w.wbs_code,
      wbs_name: w.wbs_name,
      project_code: p.project_code,
    });
  }

  function validateProject(f: ProjectForm) {
    if (!/^\d{2}$/.test(f.project_code.trim()))
      return "project_code debe ser NN (ej: 01)";
    if (!f.project_name.trim()) return "project_name es obligatorio";
    return null;
  }

  function validateWbs(f: WbsForm) {
    if (!/^\d{2}\.\d{2}$/.test(f.wbs_code.trim()))
      return "wbs_code debe ser NN.NN (ej: 01.01)";
    if (!f.wbs_name.trim()) return "wbs_name es obligatorio";
    if (!/^\d{2}$/.test(f.project_code.trim())) return "project_code inválido";
    if (!f.wbs_code.startsWith(f.project_code + "."))
      return "wbs_code debe pertenecer al project_code";
    return null;
  }

  function upsertProjectLocal() {
    setMsg(null);
    const err = validateProject(proj);
    if (err) return setMsg(err);

    setData((prev) => {
      const code = proj.project_code.trim();
      const name = proj.project_name.trim();
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

      return [...prev, nextNode].sort((a, b) =>
        a.project_code.localeCompare(b.project_code)
      );
    });

    setSelectedProject(proj.project_code.trim());
    setSelectedWbs(null);
    setMsg("OK: proyecto guardado (local)");
  }

  function upsertWbsLocal() {
    setMsg(null);
    const err = validateWbs(wbs);
    if (err) return setMsg(err);

    setData((prev) => {
      const pc = wbs.project_code.trim();
      const wc = wbs.wbs_code.trim();
      const wn = wbs.wbs_name.trim();

      const pi = prev.findIndex((x) => x.project_code === pc);
      if (pi < 0) return prev;

      const p = prev[pi];
      const wi = p.wbs.findIndex((x) => x.wbs_code === wc);

      const nextW = { wbs_code: wc, wbs_name: wn };
      const nextWbs =
        wi >= 0 ? p.wbs.map((x, idx) => (idx === wi ? nextW : x)) : [...p.wbs, nextW];

      const nextP: ProjectNode = {
        ...p,
        wbs: nextWbs.sort((a, b) => a.wbs_code.localeCompare(b.wbs_code)),
      };

      const copy = [...prev];
      copy[pi] = nextP;
      return copy;
    });

    setSelectedProject(wbs.project_code.trim());
    setSelectedWbs(wbs.wbs_code.trim());
    setMsg("OK: WBS guardado (local)");
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 14 }}>
      <ProjectTree
        data={data}
        selectedProject={selectedProject}
        selectedWbs={selectedWbs}
        onSelectProject={(pc) => {
          setSelectedProject(pc);
          setSelectedWbs(null);
          if (pc) loadProjectToForm(pc);
        }}
        onSelectWbs={(wc) => {
          setSelectedWbs(wc);
          if (wc) loadWbsToForm(wc);
        }}
        height={640}
      />

      <div style={{ display: "grid", gap: 12 }}>
        <div className="panel-inner" style={{ padding: 10, display: "flex", gap: 10 }}>
          <Button
            type="button"
            size="sm"
            variant={tab === "project" ? "primary" : "ghost"}
            onClick={() => {
              setTab("project");
              setMsg(null);
              if (selectedProject) loadProjectToForm(selectedProject);
              else setProj(emptyProject);
            }}
          >
            Proyecto
          </Button>

          <Button
            type="button"
            size="sm"
            variant={tab === "wbs" ? "primary" : "ghost"}
            onClick={() => {
              setTab("wbs");
              setMsg(null);
              const pc = selectedProject ?? "";
              setWbs({ ...emptyWbs, project_code: pc });
              if (selectedWbs) loadWbsToForm(selectedWbs);
            }}
          >
            WBS
          </Button>

          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setMsg(null);
                if (tab === "project") setProj(emptyProject);
                else setWbs({ ...emptyWbs, project_code: selectedProject ?? "" });
              }}
            >
              Nuevo
            </Button>
          </div>
        </div>

        <div className="panel-inner" style={{ padding: 14 }}>
          {tab === "project" ? (
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
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 180px", gap: 12 }}>
                <Input
                  placeholder="01.01"
                  value={wbs.wbs_code}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setWbs((s) => ({ ...s, wbs_code: e.target.value }))
                  }
                  hint="Código NN.NN"
                />
                <Input
                  placeholder="Nombre del WBS"
                  value={wbs.wbs_name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setWbs((s) => ({ ...s, wbs_name: e.target.value }))
                  }
                />
                <Input
                  placeholder="01"
                  value={wbs.project_code}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setWbs((s) => ({ ...s, project_code: e.target.value }))
                  }
                  hint="Proyecto NN"
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <Button type="button" variant="primary" onClick={upsertWbsLocal}>
                  Guardar WBS
                </Button>
              </div>
            </div>
          )}
        </div>

        {msg ? (
          <div
            className="panel-inner"
            style={{
              padding: 12,
              border: msg.startsWith("OK")
                ? "1px solid rgba(102,199,255,.45)"
                : "1px solid rgba(255,80,80,.45)",
              background: msg.startsWith("OK")
                ? "rgba(102,199,255,.10)"
                : "rgba(255,80,80,.10)",
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