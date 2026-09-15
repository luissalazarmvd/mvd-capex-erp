// src/lib/vai/store.ts
//
// Persistencia de dashboards V-Ai contra el backend (`/api/vai/dashboards*`,
// tabla stg.vai_dashboards_web). Solo se guarda la definición; los datos se
// vuelven a consultar al abrir. Ninguna de estas operaciones llama a OpenAI.

import { apiGet, apiPost } from "../apiClient";
import { VAI_SPEC_VERSION, type VaiDashboardSpec } from "./spec";

export type VaiDashboardRecord = {
  dashboard_id: number;
  dashboard_name: string;
  dashboard_desc: string | null;
  prompt_text: string;
  schema_version: number;
  model_name: string | null;
  source_ids: string | null;
  owner_key: string | null;
  visibility: string;
  created_at: string;
  updated_at: string;
};

export type VaiDashboardDetail = VaiDashboardRecord & { spec_json: string };

export async function listDashboards(): Promise<VaiDashboardRecord[]> {
  const out = await apiGet("/api/vai/dashboards");
  return Array.isArray(out?.rows) ? (out.rows as VaiDashboardRecord[]) : [];
}

export async function getDashboard(id: number): Promise<VaiDashboardDetail | null> {
  const out = await apiGet(`/api/vai/dashboards/${encodeURIComponent(String(id))}`);
  return (out?.row as VaiDashboardDetail | undefined) ?? null;
}

export async function saveDashboard(input: {
  dashboard_id?: number | null;
  name: string;
  description: string;
  prompt: string;
  spec: VaiDashboardSpec;
  model: string | null;
}): Promise<number> {
  const out = await apiPost("/api/vai/dashboards/insert", {
    dashboard_id: input.dashboard_id ?? null,
    dashboard_name: input.name,
    dashboard_desc: input.description,
    prompt_text: input.prompt,
    spec_json: JSON.stringify(input.spec),
    schema_version: VAI_SPEC_VERSION,
    model_name: input.model,
    source_ids: input.spec.sources.join(","),
  });
  return Number(out?.dashboard_id);
}

export async function deleteDashboard(id: number) {
  await apiPost("/api/vai/dashboards/delete", { dashboard_id: id });
}
