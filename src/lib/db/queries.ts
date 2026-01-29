// src/lib/db/queries.ts
import "server-only";
import { q, sql } from "./sql";

export type ProjectWbsRow = {
  project_code: string;
  project_name: string;
  wbs_code: string;
  wbs_name: string;
};

export type PeriodRow = {
  period_id: number;      // YYYYMM
  period_label: string;   // Ene_26
  period_start: string;   // ISO
  period_end: string;     // ISO
};

// ==================
// Lookups (dropdowns)
// ==================
export type LookupRow = {
  id: number;
  name: string;
};

export type PriorityRow = {
  id: number;
  name: string;
  order: number | null;
};

export async function getInvClasses(): Promise<LookupRow[]> {
  const res = await q<LookupRow>(`
    SELECT
      inv_class_id AS id,
      inv_class_name AS name
    FROM dim.inv_class
    ORDER BY inv_class_name;
  `);
  return res.recordset;
}

export async function getPriorities(): Promise<PriorityRow[]> {
  const res = await q<PriorityRow>(`
    SELECT
      priority_id AS id,
      priority_name AS name,
      priority_order AS [order]
    FROM dim.priority
    ORDER BY
      CASE WHEN priority_order IS NULL THEN 1 ELSE 0 END,
      priority_order,
      priority_name;
  `);
  return res.recordset;
}

export async function getProjAreas(): Promise<LookupRow[]> {
  const res = await q<LookupRow>(`
    SELECT
      proj_area_id AS id,
      proj_area_name AS name
    FROM dim.proj_area
    ORDER BY proj_area_name;
  `);
  return res.recordset;
}

export async function getProjConditions(): Promise<LookupRow[]> {
  const res = await q<LookupRow>(`
    SELECT
      proj_condition_id AS id,
      proj_condition_name AS name
    FROM dim.proj_condition
    ORDER BY proj_condition_name;
  `);
  return res.recordset;
}

export async function getProjGroups(): Promise<LookupRow[]> {
  const res = await q<LookupRow>(`
    SELECT
      proj_group_id AS id,
      proj_group_name AS name
    FROM dim.proj_group
    ORDER BY proj_group_name;
  `);
  return res.recordset;
}

// ==============
// Projects & WBS
// ==============
export type ProjectRow = {
  project_code: string;
  project_name: string;
  proj_group_id: number | null;
  inv_class_id: number | null;
  proj_condition_id: number | null;
  proj_area_id: number | null;
  priority_id: number | null;
};

export async function getProjects(): Promise<ProjectRow[]> {
  const res = await q<ProjectRow>(`
    SELECT
      project_code,
      project_name,
      proj_group_id,
      inv_class_id,
      proj_condition_id,
      proj_area_id,
      priority_id
    FROM dim.project
    ORDER BY project_code;
  `);
  return res.recordset;
}

export async function getProjectTree(): Promise<ProjectWbsRow[]> {
  const res = await q<ProjectWbsRow>(`
    SELECT
      p.project_code,
      p.project_name,
      w.wbs_code,
      w.wbs_name
    FROM dim.project p
    LEFT JOIN dim.wbs w
      ON w.project_code = p.project_code
    ORDER BY p.project_code, w.wbs_code;
  `);
  return res.recordset;
}

export async function getPeriods(fromPeriodId: number, n: number): Promise<PeriodRow[]> {
  const res = await q<PeriodRow>(
    `
    SELECT TOP (@n)
      period_id,
      period_label,
      CONVERT(varchar(10), period_start, 23) AS period_start,
      CONVERT(varchar(10), period_end, 23) AS period_end
    FROM dim.period
    WHERE period_id >= @from
    ORDER BY period_id;
    `,
    (req) => {
      req.input("from", sql.Int, fromPeriodId);
      req.input("n", sql.Int, n);
    }
  );
  return res.recordset;
}

// ==============
// Latest helpers
// ==============
export type LatestCell = {
  wbs_code: string;
  period_id: number;
  col: string;   // ORIG / SOC / AMOUNT / EV_PCT / AC
  value: string; // ya como string para UI
};

export async function getLatestBudget(
  budgetClass: "ORIG" | "SOC",
  fromPeriodId: number,
  n: number
): Promise<LatestCell[]> {
  const res = await q<LatestCell>(
    `
    ;WITH p AS (
      SELECT TOP (@n) period_id
      FROM dim.period
      WHERE period_id >= @from
      ORDER BY period_id
    ),
    x AS (
      SELECT
        b.wbs_code,
        b.period_id,
        CAST(b.amount AS nvarchar(80)) AS value,
        ROW_NUMBER() OVER (
          PARTITION BY b.wbs_code, b.period_id, b.budget_class
          ORDER BY b.updated_at DESC, b.budget_month_id DESC
        ) AS rn
      FROM stg.budget_month b
      WHERE b.budget_class = @cls
        AND b.period_id IN (SELECT period_id FROM p)
    )
    SELECT
      wbs_code,
      period_id,
      @cls AS col,
      value
    FROM x
    WHERE rn = 1;
    `,
    (req) => {
      req.input("from", sql.Int, fromPeriodId);
      req.input("n", sql.Int, n);
      req.input("cls", sql.VarChar(10), budgetClass);
    }
  );

  return res.recordset;
}

export async function getLatestForecast(
  fromPeriodId: number,
  n: number
): Promise<LatestCell[]> {
  const res = await q<LatestCell>(
    `
    ;WITH p AS (
      SELECT TOP (@n) period_id
      FROM dim.period
      WHERE period_id >= @from
      ORDER BY period_id
    ),
    x AS (
      SELECT
        f.wbs_code,
        f.period_id,
        CAST(f.amount AS nvarchar(80)) AS value,
        ROW_NUMBER() OVER (
          PARTITION BY f.wbs_code, f.period_id
          ORDER BY f.updated_at DESC, f.forecast_month_id DESC
        ) AS rn
      FROM stg.forecast_month f
      WHERE f.period_id IN (SELECT period_id FROM p)
    )
    SELECT
      wbs_code,
      period_id,
      'AMOUNT' AS col,
      value
    FROM x
    WHERE rn = 1;
    `,
    (req) => {
      req.input("from", sql.Int, fromPeriodId);
      req.input("n", sql.Int, n);
    }
  );

  return res.recordset;
}

export async function getLatestProgress(
  fromPeriodId: number,
  n: number
): Promise<LatestCell[]> {
  const res = await q<LatestCell>(
    `
    ;WITH p AS (
      SELECT TOP (@n) period_id, period_start, period_end
      FROM dim.period
      WHERE period_id >= @from
      ORDER BY period_id
    ),
    evx AS (
      SELECT
        e.wbs_code,
        p.period_id,
        CAST(e.ev_pct_cum AS nvarchar(80)) AS value,
        ROW_NUMBER() OVER (
          PARTITION BY e.wbs_code, p.period_id
          ORDER BY e.updated_at DESC, e.ev_entry_id DESC
        ) AS rn
      FROM stg.ev_entry e
      JOIN p
        ON e.as_of_date >= p.period_start
       AND e.as_of_date <= p.period_end
    ),
    acx AS (
      SELECT
        a.wbs_code,
        p.period_id,
        CAST(a.amount AS nvarchar(80)) AS value,
        ROW_NUMBER() OVER (
          PARTITION BY a.wbs_code, p.period_id
          ORDER BY a.updated_at DESC, a.actual_entry_id DESC
        ) AS rn
      FROM stg.actual_entry a
      JOIN p
        ON a.as_of_date >= p.period_start
       AND a.as_of_date <= p.period_end
    )
    SELECT wbs_code, period_id, 'EV_PCT' AS col, value
    FROM evx
    WHERE rn = 1
    UNION ALL
    SELECT wbs_code, period_id, 'AC' AS col, value
    FROM acx
    WHERE rn = 1
    ORDER BY wbs_code, period_id, col;
    `,
    (req) => {
      req.input("from", sql.Int, fromPeriodId);
      req.input("n", sql.Int, n);
    }
  );

  return res.recordset;
}
