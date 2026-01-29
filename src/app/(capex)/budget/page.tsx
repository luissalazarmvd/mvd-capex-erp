// src/app/(capex)/budget/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import { ProjectTree, ProjectNode } from "../../../components/capex/ProjectTree";
import { WbsMatrix, Period, Row } from "../../../components/capex/WbsMatrix";
import { Button } from "../../../components/ui/Button";

function makePeriods(startYYYYMM: number, n: number): Period[] {
  const y0 = Math.floor(startYYYYMM / 100);
  const m0 = startYYYYMM % 100;

  const months = [
    "Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Set","Oct","Nov","Dic",
  ];

  const out: Period[] = [];
  for (let i = 0; i < n; i++) {
    const mIndex = (m0 - 1 + i) % 12;
    const y = y0 + Math.floor((m0 - 1 + i) / 12);
    const m = mIndex + 1;
    const period_id = y * 100 + m;
    const label = `${months[mIndex]}_${String(y).slice(2)}`;
    out.push({ period_id, label });
  }
  return out;
}

function keyOf(wbs: string, period_id: number, col: string) {
  return `${wbs}|${period_id}|${col}`;
}

type BudgetClass = "ORIG" | "SOC";

export default function BudgetPage() {
  // demo data (luego lo jalas de dim.project + dim.wbs)
  const [projects] = useState<ProjectNode[]>([
    {
      project_code: "01",
      project_name: "Proyecto Demo",
      wbs: [
        { wbs_code: "01.01", wbs_name: "Obra Civil" },
        { wbs_code: "01.02", wbs_name: "Equipos" },
      ],
    },
    {
      project_code: "02",
      project_name: "Proyecto 2",
      wbs: [{ wbs_code: "02.01", wbs_name: "Ingeniería" }],
    },
  ]);

  const periods = useMemo(() => makePeriods(202601, 12), []);

  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedWbs, setSelectedWbs] = useState<string | null>(null);
  const [budgetClass, setBudgetClass] = useState<BudgetClass>("ORIG");

  // latest (hint)
  const [latest] = useState<Record<string, string | null>>(() => {
    const l: Record<string, string | null> = {};
    l[keyOf("01.01", 202601, "ORIG")] = "120000";
    l[keyOf("01.01", 202602, "ORIG")] = "90000";
    l[keyOf("01.02", 202601, "ORIG")] = "50000";
    return l;
  });

  // draft (editable)
  const [draft, setDraft] = useState<Record<string, string>>({});

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

  function onChangeDraft(k: string, v: string) {
    setDraft((prev) => ({ ...prev, [k]: v }));
  }

  async function onSave(payload: { key: string; value: string }[]) {
    // demo: aquí llamas POST /api/budget/upsert
    // y luego recargas latest desde DB
    console.log("SAVE budget", payload);

    // simular que se guardó y latest “cambia”
    // (por ahora solo limpias draft)
    setDraft({});
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
        </div>

        <WbsMatrix
          mode="budget"
          title={`Budget mensual (${budgetClass})`}
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
