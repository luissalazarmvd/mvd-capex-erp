// src/app/(capex)/reports/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import { ProjectTree, ProjectNode } from "../../../components/capex/ProjectTree";
import { Button } from "../../../components/ui/Button";

type CurvePoint = {
  period_label: string;
  pv_cum: number;
  ev_cum: number;
  ac_cum: number;
};

function demoCurve(): CurvePoint[] {
  return [
    { period_label: "Ene_26", pv_cum: 170000, ev_cum: 12000, ac_cum: 17000 },
    { period_label: "Feb_26", pv_cum: 265000, ev_cum: 52000, ac_cum: 64000 },
    { period_label: "Mar_26", pv_cum: 345000, ev_cum: 98000, ac_cum: 112000 },
    { period_label: "Abr_26", pv_cum: 430000, ev_cum: 165000, ac_cum: 190000 },
  ];
}

export default function ReportsPage() {
  const [projects] = useState<ProjectNode[]>([
    {
      project_code: "01",
      project_name: "Proyecto Demo",
      wbs: [
        { wbs_code: "01.01", wbs_name: "Obra Civil" },
        { wbs_code: "01.02", wbs_name: "Equipos" },
      ],
    },
  ]);

  const [selectedProject, setSelectedProject] = useState<string | null>("01");
  const [selectedWbs, setSelectedWbs] = useState<string | null>(null);

  const curve = useMemo(() => demoCurve(), []);

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
        <div className="panel-inner" style={{ padding: 12, display: "flex", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>Curva S</div>
          <div className="muted" style={{ fontWeight: 800, marginLeft: "auto" }}>
            Demo (luego consume views dw)
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => {}}>
            Actualizar
          </Button>
        </div>

        <div className="panel-inner" style={{ padding: 14 }}>
          <div className="muted" style={{ fontWeight: 800, marginBottom: 10 }}>
            (Aquí va el chart. Luego metemos Recharts)
          </div>

          <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "10px 10px",
                      borderBottom: "1px solid var(--border)",
                      fontWeight: 900,
                    }}
                  >
                    Periodo
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "10px 10px",
                      borderBottom: "1px solid var(--border)",
                      fontWeight: 900,
                    }}
                  >
                    PV (acum)
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "10px 10px",
                      borderBottom: "1px solid var(--border)",
                      fontWeight: 900,
                    }}
                  >
                    EV (acum)
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "10px 10px",
                      borderBottom: "1px solid var(--border)",
                      fontWeight: 900,
                    }}
                  >
                    AC (acum)
                  </th>
                </tr>
              </thead>
              <tbody>
                {curve.map((r) => (
                  <tr key={r.period_label}>
                    <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(191,231,255,.10)" }}>
                      {r.period_label}
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "right", borderBottom: "1px solid rgba(191,231,255,.10)" }}>
                      {r.pv_cum.toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "right", borderBottom: "1px solid rgba(191,231,255,.10)" }}>
                      {r.ev_cum.toLocaleString()}
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "right", borderBottom: "1px solid rgba(191,231,255,.10)" }}>
                      {r.ac_cum.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
