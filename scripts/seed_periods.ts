// scripts/seed_periods.ts
import "dotenv/config";
import { q, sql } from "../src/lib/db/sql";

function yyyymm(d: Date) {
  return d.getFullYear() * 100 + (d.getMonth() + 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function labelEs(d: Date) {
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Set","Oct","Nov","Dic"];
  const y = d.getFullYear();
  const m = d.getMonth();
  return `${months[m]}_${String(y).slice(2)}`;
}

async function main() {
  // rango: 2024-01 a 2030-12 (ajusta)
  const from = new Date(2024, 0, 1);
  const to = new Date(2030, 11, 1);

  const rows: {
    period_id: number;
    period_start: string;
    period_end: string;
    period_label: string;
  }[] = [];

  for (let d = new Date(from); d <= to; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const pid = yyyymm(d);
    const ps = startOfMonth(d);
    const pe = endOfMonth(d);

    rows.push({
      period_id: pid,
      period_start: ps.toISOString().slice(0, 10),
      period_end: pe.toISOString().slice(0, 10),
      period_label: labelEs(d),
    });
  }

  // insert if not exists
  for (const r of rows) {
    await q(
      `
      IF NOT EXISTS (SELECT 1 FROM dim.period WHERE period_id = @pid)
      BEGIN
        INSERT INTO dim.period (period_id, period_start, period_end, period_label, updated_at)
        VALUES (@pid, @ps, @pe, @pl, SYSUTCDATETIME());
      END
      `,
      (req) => {
        req.input("pid", sql.Int, r.period_id);
        req.input("ps", sql.Date, r.period_start);
        req.input("pe", sql.Date, r.period_end);
        req.input("pl", sql.VarChar(20), r.period_label);
      }
    );
  }

  console.log(`[OK] seed_periods: ${rows.length} periodos revisados`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
