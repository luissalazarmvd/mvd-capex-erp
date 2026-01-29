// src/app/(capex)/budget/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../../lib/apiClient";
import { ProjectTree, ProjectNode } from "../../../components/capex/ProjectTree";
import { WbsMatrix, Period, Row } from "../../../components/capex/WbsMatrix";
import { Button } from "../../../components/ui/Button";

type BudgetClass = "ORIG" | "SOC";

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

export default function BudgetPage() {
  const [projects, setProjects] = useState<ProjectNode[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);

  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedWbs, setSelectedWbs] = useState<string | null>(null);

  const [budgetClass, setBudgetClass] = useState<BudgetClass>("ORIG");

  const [latest, setLatest] = useState<Record<string, string | null>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Ajusta esto si quieres otro inicio
  const FROM_PERIOD = 202601;
  const N_PERIODS = 12;

  async function loadMetaAndPeriods() {
    const [meta, per] = await Promise.all([
      apiGet("/api/projects/meta"),
      apiGet(`/api/periods?from=${FROM_PERIOD}&n=${N_PERIODS}`),
    ]);

    const m = meta as ProjectsMeta;
    const p = per as PeriodsResp;

    setProjects(m.tree ?? []);
    setPeriods(p.periods ?? []);

    if (!selectedProject && m.tree?.length) {
      setSelectedProject(m.tree[0].project_code);
      setSelectedWbs(null);
    }
  }

  async function loadLatest(cls: BudgetClass) {
    const out = (await apiGet(
      `/api/budget/latest?from=${FROM_PERIOD}&n=${N_PERIODS}&class=${cls}`
    )) as LatestResp;

    setLatest(out.latest ?? {});
  }

  async function loadAll(cls: BudgetClass) {
    setLoading(true);
    setMsg(null);
    try {
      await loadMetaAndPeriods();
      await loadLatest(cls);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll(budgetClass);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // al cambiar ORIG/SOC, recargar hints y limpiar draft
    setDraft({});
    loadAll(budgetClass);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetClass]);

  const rows: Row[] = useMemo(() => {
    const p = selectedProject ? projects.filter((x) => x.project_code === selectedProject) : projects;

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

  function onChangeDraft(k: string, v: string) {
    setDraft((prev) => ({ ...prev, [k]: v }));
  }

  async function onSave(payload: { key: string; value: string }[]) {
    setMsg(null);

    try {
      await apiPost("/api/budget/upsert", { rows: payload });

      setDraft({});
      await loadAll(budgetClass);
      setMsg("OK: budget guardado");
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando budget");
    }
  }

  function onResetDraft() {
    setDraft({});
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
        <div className="panel-inner" style={{ padding: 10, display: "flex", gap: 10 }}>
          <Button
            type="button"
            size="sm"
            variant={budgetClass === "ORIG" ? "primary" : "ghost"}
            onClick={() => setBudgetClass("ORIG")}
          >
            ORIG
          </Button>
          <Button
            type="button"
            size="sm"
            variant={budgetClass === "SOC" ? "primary" : "ghost"}
            onClick={() => setBudgetClass("SOC")}
          >
            SOC
          </Button>

          <div className="muted" style={{ marginLeft: "auto", fontWeight: 800 }}>
            {loading ? "Cargando…" : ""}
          </div>
        </div>

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
          mode="budget"
          title={loading ? `Budget mensual (${budgetClass}) (cargando…)` : `Budget mensual (${budgetClass})`}
          periods={periods}
          rows={rows}
          latest={latest}
          draft={draft}
          budgetClass={budgetClass}
          onChangeDraft={onChangeDraft}
          onSave={onSave}
          onResetDraft={onResetDraft}
        />
      </div>
    </div>
  );
}
