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
  period_id: number;
  label: string;
};

export type MatrixRow = {
  project_code: string;
  project_name: string;
  wbs_code: string;
  wbs_name: string;
};

export type MatrixCell = {
  key: string;
  value: string;
  hint?: string | null;
};

export type BudgetClass = "ORIG" | "SOC";
export type MatrixMode = "budget" | "forecast" | "progress";

export type LookupOption = {
  id: number;
  name: string;
};

export type PriorityOption = {
  id: number;
  name: string;
  order: number | null;
};

export type ProjectLookups = {
  inv_classes: LookupOption[];
  priorities: PriorityOption[];
  proj_areas: LookupOption[];
  proj_conditions: LookupOption[];
  proj_groups: LookupOption[];
};


export type ProjectInput = {
  project_code: string;
  project_name: string;

  proj_group_id?: number | null;
  inv_class_id?: number | null;
  proj_condition_id?: number | null;
  proj_area_id?: number | null;
  priority_id?: number | null;
};

export type ProjectRow = ProjectInput;
