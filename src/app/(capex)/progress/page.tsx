// src/app/(capex)/progress/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiDownload, apiGet, apiPost } from "../../../lib/apiClient";
import { ProjectTree, ProjectNode } from "../../../components/capex/ProjectTree";
import { WbsMatrix, Period, Row } from "../../../components/capex/WbsMatrix";
import { Button } from "../../../components/ui/Button";

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

type RowsResp = {
  ok: boolean;
  rows: Record<string, any>[];
};

export default function ProgressPage() {
  const [projects, setProjects] = useState<ProjectNode[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);

  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedWbs, setSelectedWbs] = useState<string | null>(null);

  const [latest, setLatest] = useState<Record<string, string | null>>({});
  const [budgetLatest, setBudgetLatest] = useState<Record<string, string | null>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportingAC, setExportingAC] = useState<boolean>(false);

  const FROM_PERIOD = 202601;
  const N_PERIODS = 12;

  async function loadAll() {
    setLoading(true);
    setMsg(null);
    try {
      const [meta, per, lat, bOrig, bSoc] = await Promise.all([
        apiGet("/api/projects/meta"),
        apiGet(`/api/periods?from=${FROM_PERIOD}&n=${N_PERIODS}`),
        apiGet(`/api/progress/latest?from=${FROM_PERIOD}&n=${N_PERIODS}`),
        apiGet(`/api/budget/latest?from=${FROM_PERIOD}&n=${N_PERIODS}&class=ORIG`),
        apiGet(`/api/budget/latest?from=${FROM_PERIOD}&n=${N_PERIODS}&class=SOC`),
      ]);

      const m = meta as ProjectsMeta;
      const p = per as PeriodsResp;
      const l = lat as LatestResp;
      const bo = bOrig as LatestResp;
      const bs = bSoc as LatestResp;

      setProjects(m.tree ?? []);
      setPeriods(p.periods ?? []);
      setLatest(l.latest ?? {});
      setBudgetLatest({ ...(bo.latest ?? {}), ...(bs.latest ?? {}) });

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

    const evRows = payload.filter((r) => r.key.endsWith("|EV_PCT"));

    if (!evRows.length) {
      setDraft({});
      return;
    }

    try {
      await apiPost("/api/ev/upsert", { rows: evRows });

      setDraft({});
      await loadAll();
      setMsg("OK: progreso guardado");
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando progreso");
    }
  }

  async function onExport() {
    setMsg(null);
    setExporting(true);
    try {
      await apiDownload("/api/export/ev", "ev.xlsx");
      setMsg("OK: export descargado");
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR exportando");
    } finally {
      setExporting(false);
    }
  }

  async function onExportAC() {
    setMsg(null);
    setExportingAC(true);

    try {
      const [fullResp, mappedResp] = await Promise.all([
        apiGet("/api/capex/actual-veta?top=1000000"),
        apiGet("/api/capex/actual-det?top=1000000"),
      ]);

      const full = fullResp as RowsResp;
      const mapped = mappedResp as RowsResp;

      const XLSX = await import("xlsx");

      const wb = XLSX.utils.book_new();

      const wsFull = XLSX.utils.json_to_sheet(full.rows ?? []);
      const wsMapped = XLSX.utils.json_to_sheet(mapped.rows ?? []);

      XLSX.utils.book_append_sheet(wb, wsFull, "actual_full");
      XLSX.utils.book_append_sheet(wb, wsMapped, "actual_mapped");

      const fileName = `capex_actual_${new Date().toISOString().slice(0, 10)}.xlsx`;

      XLSX.writeFile(wb, fileName);

      setMsg("OK: export AC descargado");
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR exportando AC");
    } finally {
      setExportingAC(false);
    }
  }

  const headerActions = (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={loading || exporting || exportingAC}
        onClick={onExport}
      >
        {exporting ? "Exportando…" : "Exportar"}
      </Button>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={loading || exporting || exportingAC}
        onClick={onExportAC}
      >
        {exportingAC ? "Exportando AC…" : "Exportar AC"}
      </Button>
    </div>
  );

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
              border: msg.startsWith("OK") ? "1px solid rgba(102,199,255,.45)" : "1px solid rgba(255,80,80,.45)",
              background: msg.startsWith("OK") ? "rgba(102,199,255,.10)" : "rgba(255,80,80,.10)",
              fontWeight: 800,
            }}
          >
            {msg}
          </div>
        ) : null}

        <WbsMatrix
          mode="progress"
          title={loading ? "Avance EV (cargando…)" : "Avance EV (EV%)"}
          projectLabel={projectLabel}
          headerActions={headerActions}
          periods={periods}
          rows={rows}
          latest={latest}
          draft={draft}
          budgetLatest={budgetLatest}
          onChangeDraft={onChangeDraft}
          onSave={onSave}
        />
      </div>
    </div>
  );
}
