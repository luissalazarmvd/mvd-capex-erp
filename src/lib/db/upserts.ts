// src/lib/db/upserts.ts
import "server-only";
import { withTx, sql, getPool } from "./sql";

type BudgetClass = "ORIG" | "SOC";

function parseKey(key: string) {
  const [wbs_code, pid, col] = key.split("|");
  const period_id = Number(pid);
  if (!wbs_code || !Number.isFinite(period_id) || !col) {
    throw new Error(`Key inválida: ${key}`);
  }
  return { wbs_code, period_id, col };
}

async function periodEndFromId(tx: sql.Transaction, period_id: number): Promise<string> {
  const req = new sql.Request(tx);
  req.input("pid", sql.Int, period_id);
  const r = await req.query<{ period_end: string }>(`
    SELECT CONVERT(varchar(10), period_end, 23) AS period_end
    FROM dim.period
    WHERE period_id = @pid;
  `);
  if (!r.recordset?.[0]?.period_end) throw new Error(`period_id no existe: ${period_id}`);
  return r.recordset[0].period_end;
}

export async function upsertProject(input: {
  project_code: string;
  project_name: string;
  proj_group_id?: number | null;
  inv_class_id?: number | null;
  proj_condition_id?: number | null;
  proj_area_id?: number | null;
  priority_id?: number | null;
}) {
  const pool = await getPool();
  const req = pool.request();

  req.input("project_code", sql.VarChar(10), input.project_code);
  req.input("project_name", sql.NVarChar(200), input.project_name);
  req.input("proj_group_id", sql.Int, input.proj_group_id ?? null);
  req.input("inv_class_id", sql.Int, input.inv_class_id ?? null);
  req.input("proj_condition_id", sql.Int, input.proj_condition_id ?? null);
  req.input("proj_area_id", sql.Int, input.proj_area_id ?? null);
  req.input("priority_id", sql.Int, input.priority_id ?? null);

  await req.query(`
    MERGE dim.project AS t
    USING (SELECT
      @project_code AS project_code,
      @project_name AS project_name,
      @proj_group_id AS proj_group_id,
      @inv_class_id AS inv_class_id,
      @proj_condition_id AS proj_condition_id,
      @proj_area_id AS proj_area_id,
      @priority_id AS priority_id
    ) AS s
    ON t.project_code = s.project_code
    WHEN MATCHED THEN UPDATE SET
      project_name = s.project_name,
      proj_group_id = s.proj_group_id,
      inv_class_id = s.inv_class_id,
      proj_condition_id = s.proj_condition_id,
      proj_area_id = s.proj_area_id,
      priority_id = s.priority_id,
      updated_at = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (
      project_code, project_name,
      proj_group_id, inv_class_id, proj_condition_id, proj_area_id, priority_id,
      updated_at
    ) VALUES (
      s.project_code, s.project_name,
      s.proj_group_id, s.inv_class_id, s.proj_condition_id, s.proj_area_id, s.priority_id,
      SYSUTCDATETIME()
    );
  `);
}

export async function upsertWbs(input: {
  wbs_code: string;
  wbs_name: string;
  project_code: string;
}) {
  const pool = await getPool();
  const req = pool.request();

  req.input("wbs_code", sql.VarChar(20), input.wbs_code);
  req.input("wbs_name", sql.NVarChar(200), input.wbs_name);
  req.input("project_code", sql.VarChar(10), input.project_code);

  await req.query(`
    MERGE dim.wbs AS t
    USING (SELECT
      @wbs_code AS wbs_code,
      @wbs_name AS wbs_name,
      @project_code AS project_code
    ) AS s
    ON t.wbs_code = s.wbs_code
    WHEN MATCHED THEN UPDATE SET
      wbs_name = s.wbs_name,
      project_code = s.project_code,
      updated_at = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (
      wbs_code, wbs_name, project_code, updated_at
    ) VALUES (
      s.wbs_code, s.wbs_name, s.project_code, SYSUTCDATETIME()
    );
  `);
}

export async function insertBudgetVersions(
  rows: { key: string; value: string }[]
) {
  await withTx(async (tx) => {
    for (const r of rows) {
      const { wbs_code, period_id, col } = parseKey(r.key);
      const cls = col as BudgetClass;

      const amount = r.value === "" ? null : Number(r.value);
      if (amount === null || Number.isNaN(amount)) continue;

      const req = new sql.Request(tx);
      req.input("wbs_code", sql.VarChar(20), wbs_code);
      req.input("period_id", sql.Int, period_id);
      req.input("budget_class", sql.VarChar(10), cls);
      req.input("amount", sql.Decimal(38, 18), amount);

      await req.query(`
        INSERT INTO stg.budget_month (wbs_code, period_id, budget_class, amount, updated_at)
        VALUES (@wbs_code, @period_id, @budget_class, @amount, SYSUTCDATETIME());
      `);
    }
  });
}

export async function insertForecastVersions(
  rows: { key: string; value: string }[]
) {
  await withTx(async (tx) => {
    for (const r of rows) {
      const { wbs_code, period_id } = parseKey(r.key);
      const amount = r.value === "" ? null : Number(r.value);
      if (amount === null || Number.isNaN(amount)) continue;

      const req = new sql.Request(tx);
      req.input("wbs_code", sql.VarChar(20), wbs_code);
      req.input("period_id", sql.Int, period_id);
      req.input("amount", sql.Decimal(38, 18), amount);

      await req.query(`
        INSERT INTO stg.forecast_month (wbs_code, period_id, amount, updated_at)
        VALUES (@wbs_code, @period_id, @amount, SYSUTCDATETIME());
      `);
    }
  });
}

export async function insertProgressVersions(
  rows: { key: string; value: string }[]
) {
  await withTx(async (tx) => {
    for (const r of rows) {
      const { wbs_code, period_id, col } = parseKey(r.key);
      const v = r.value === "" ? null : Number(r.value);
      if (v === null || Number.isNaN(v)) continue;

      const as_of_date = await periodEndFromId(tx, period_id);

      if (col === "EV_PCT") {
        const req = new sql.Request(tx);
        req.input("wbs_code", sql.VarChar(20), wbs_code);
        req.input("as_of_date", sql.Date, as_of_date);
        req.input("ev_pct_cum", sql.Decimal(38, 18), v);

        await req.query(`
          INSERT INTO stg.ev_entry (wbs_code, as_of_date, ev_pct_cum, updated_at)
          VALUES (@wbs_code, @as_of_date, @ev_pct_cum, SYSUTCDATETIME());
        `);
      } else if (col === "AC") {
        const req = new sql.Request(tx);
        req.input("wbs_code", sql.VarChar(20), wbs_code);
        req.input("as_of_date", sql.Date, as_of_date);
        req.input("amount", sql.Decimal(38, 18), v);

        await req.query(`
          INSERT INTO stg.actual_entry (wbs_code, as_of_date, amount, updated_at)
          VALUES (@wbs_code, @as_of_date, @amount, SYSUTCDATETIME());
        `);
      }
    }
  });
}
