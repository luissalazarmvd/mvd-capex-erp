// src/lib/types/capex.ts

export type WbsNode = {
  wbs_code: string;
  wbs_name: string;
};

export type ProjectNode = {
  project_code: string;
  project_name: string;
  wbs: WbsNode[];
};

export type Period = {
  period_id: number; // YYYYMM
  label: string;     // Ene_26
};

export type MatrixRow = {
  project_code: string;
  project_name: string;
  wbs_code: string;
  wbs_name: string;
};

export type MatrixCell = {
  key: string;        // `${wbs_code}|${period_id}|${col}`
  value: string;      // draft
  hint?: string | null; // latest
};

export type BudgetClass = "ORIG" | "SOC";

export type MatrixMode = "budget" | "forecast" | "progress";
