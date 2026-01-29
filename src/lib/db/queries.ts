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

export async function getProjectTree(): Promise<ProjectWbsRow[]> {
  // OJO: asume que tus tablas se llaman dim.project y dim.wbs (sin "dim_")
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
          ORDER BY b.updated_at DESC, b.stg_budget_month_id DESC
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
          ORDER BY f.updated_at DESC, f.stg_forecast_month_id DESC
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
  // EV y AC se guardan por as_of_date (diario/semanal)
  // Los mapeamos a period_id con dim.period (rango de fechas)
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
          ORDER BY e.updated_at DESC, e.stg_ev_entry_id DESC
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
          ORDER BY a.updated_at DESC, a.stg_actual_entry_id DESC
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
