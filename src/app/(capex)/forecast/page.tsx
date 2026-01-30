// src/app/(capex)/forecast/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../../lib/apiClient";
import { ProjectTree, ProjectNode } from "../../../components/capex/ProjectTree";
import { WbsMatrix, Period, Row } from "../../../components/capex/WbsMatrix";

type ProjectsMeta = {
  ok: boolean;
  tree: ProjectNode[];
};

type PeriodsResp = {
  ok: boolean;
  periods: Period[];
};

type LatestResp = {
  ok: boolean;
  latest: Record<string, string | null>;
};

function keyOf(wbs: string, period_id: number, col: string) {
  return `${wbs}|${period_id}|${col}`;
}

export default function ForecastPage() {
  const [projects, setProjects] = useState<ProjectNode[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);

  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedWbs, setSelectedWbs] = useState<string | null>(null);

  const [latest, setLatest] = useState<Record<string, string | null>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const FROM_PERIOD = 202601;
  const N_PERIODS = 12;

  async function loadAll() {
    setLoading(true);
    setMsg(null);
    try {
      const [meta, per, lat] = await Promise.all([
        apiGet("/api/projects/meta"),
        apiGet(`/api/periods?from=${FROM_PERIOD}&n=${N_PERIODS}`),
        apiGet(`/api/forecast/latest?from=${FROM_PERIOD}&n=${N_PERIODS}`),
      ]);

      const m = meta as ProjectsMeta;
      const p = per as PeriodsResp;
      const l = lat as LatestResp;

      setProjects(m.tree ?? []);
      setPeriods(p.periods ?? []);
      setLatest(l.latest ?? {});

      if (!selectedProject && m.tree?.length) {
        setSelectedProject(m.tree[0].project_code);
        setSelectedWbs(null);
      }
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const projectLabel = useMemo(() => {
    if (!selectedProject) return "";
    const p = projects.find((x) => x.project_code === selectedProject);
    if (!p) return "";
    return `${p.project_code} — ${p.project_name}`;
  }, [projects, selectedProject]);

  const rows: Row[] = useMemo(() => {
    const p = selectedProject
      ? projects.filter((x) => x.project_code === selectedProject)
      : projects;

    const out: Row[] = [];
    for (const proj of p) {
      for (const w of proj.wbs) {
        if (selectedWbs && w.wbs_code !== selectedWbs) continue;
        out.push({
          project_code: proj.project_code,
          project_name: proj.project_name,
          wbs_code: w.wbs_code,
          wbs_name: w.wbs_name,
        });
      }
    }
    return out;
  }, [projects, selectedProject, selectedWbs]);

  const projectAllRows: Row[] = useMemo(() => {
    if (!selectedProject) return [];
    const proj = projects.find((x) => x.project_code === selectedProject);
    if (!proj) return [];
    return (proj.wbs ?? []).map((w) => ({
      project_code: proj.project_code,
      project_name: proj.project_name,
      wbs_code: w.wbs_code,
      wbs_name: w.wbs_name,
    }));
  }, [projects, selectedProject]);

  function onChangeDraft(k: string, v: string) {
    setDraft((prev) => ({ ...prev, [k]: v }));
  }

  async function onSave(_pending: { key: string; value: string }[]) {
    setMsg(null);

    if (!selectedProject) {
      setMsg("ERROR: selecciona un proyecto");
      return;
    }
    if (!periods.length) {
      setMsg("ERROR: no hay periodos cargados");
      return;
    }
    if (!projectAllRows.length) {
      setMsg("ERROR: el proyecto no tiene WBS");
      return;
    }

    const payloadAll: { key: string; value: string }[] = [];
    for (const r of projectAllRows) {
      for (const p of periods) {
        const k = keyOf(r.wbs_code, p.period_id, "AMOUNT");
        const raw = Object.prototype.hasOwnProperty.call(draft, k) ? draft[k] : "";
        const v = String(raw ?? "").trim();
        payloadAll.push({ key: k, value: v === "" ? "0" : v });
      }
    }

    try {
      await apiPost("/api/forecast/upsert", {
        project_code: selectedProject,
        from: FROM_PERIOD,
        n: N_PERIODS,
        rows: payloadAll,
      });

      setDraft({});
      await loadAll();
      setMsg("OK: forecast guardado (snapshot por proyecto)");
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando forecast");
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 14 }}>
      <ProjectTree
        data={projects}
        selectedProject={selectedProject}
        selectedWbs={selectedWbs}
        onSelectProject={(pc) => {
          setSelectedProject(pc);
          setSelectedWbs(null);
        }}
        onSelectWbs={(wc) => setSelectedWbs(wc)}
        height={640}
      />

      <div style={{ display: "grid", gap: 12 }}>
        {msg ? (
          <div
            className="panel-inner"
            style={{
              padding: 12,
              border: msg.startsWith("OK")
                ? "1px solid rgba(102,199,255,.45)"
                : "1px solid rgba(255,80,80,.45)",
              background: msg.startsWith("OK") ? "rgba(102,199,255,.10)" : "rgba(255,80,80,.10)",
              fontWeight: 800,
            }}
          >
            {msg}
          </div>
        ) : null}

        <WbsMatrix
          mode="forecast"
          title={loading ? "Forecast mensual (cargando…)" : "Forecast mensual"}
          projectLabel={projectLabel}
          periods={periods}
          rows={rows}
          latest={latest}
          draft={draft}
          onChangeDraft={onChangeDraft}
          onSave={onSave}
        />
      </div>
    </div>
  );
}
