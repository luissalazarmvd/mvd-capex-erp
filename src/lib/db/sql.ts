// src/lib/db/sql.ts
import "server-only";
import sql from "mssql";

type PoolGlobal = {
  __mssqlPool?: sql.ConnectionPool;
};

const g = globalThis as unknown as PoolGlobal;

function cfg(): sql.config {
  const port = process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 1433;

  return {
    server: process.env.SQL_SERVER || "localhost",
    database: process.env.SQL_DATABASE || "MVDPRO",
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    port,
    options: {
      encrypt: (process.env.SQL_ENCRYPT ?? "true") === "true",
      trustServerCertificate:
        (process.env.SQL_TRUST_CERT ?? "false") === "true",
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    requestTimeout: 60000,
  };
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (g.__mssqlPool && g.__mssqlPool.connected) return g.__mssqlPool;

  const pool = new sql.ConnectionPool(cfg());
  g.__mssqlPool = await pool.connect();
  return g.__mssqlPool;
}

export async function q<T = any>(
  text: string,
  input?: (req: sql.Request) => void
): Promise<sql.IResult<T>> {
  const pool = await getPool();
  const req = pool.request();
  if (input) input(req);
  return req.query<T>(text);
}

export async function withTx<T>(
  fn: (tx: sql.Transaction) => Promise<T>
): Promise<T> {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    const out = await fn(tx);
    await tx.commit();
    return out;
  } catch (e) {
    try {
      await tx.rollback();
    } catch {}
    throw e;
  }
}

export { sql };