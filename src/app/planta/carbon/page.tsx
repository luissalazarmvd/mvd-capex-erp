// src/app/planta/carbon/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../../lib/apiClient";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";

type MonthRow = {
  tank_day: string;
  au_tk1: any;
  au_tk2: any;
  au_tk3: any;
  au_tk4: any;
  au_tk5: any;
  au_tk6: any;
  au_tk7: any;
  au_tk8: any;
  au_tk9: any;
  au_tk10: any;
  au_tk11: any;
  ag_tk1: any;
  ag_tk2: any;
  ag_tk3: any;
  ag_tk4: any;
  ag_tk5: any;
  ag_tk6: any;
  ag_tk7: any;
  ag_tk8: any;
  ag_tk9: any;
  ag_tk10: any;
  ag_tk11: any;
};

type MonthResp = {
  ok: boolean;
  ym: string;
  rows: MonthRow[];
};

type RowState = {
  tank_day: string;
  au_tk1: string;
  au_tk2: string;
  au_tk3: string;
  au_tk4: string;
  au_tk5: string;
  au_tk6: string;
  au_tk7: string;
  au_tk8: string;
  au_tk9: string;
  au_tk10: string;
  au_tk11: string;
  ag_tk1: string;
  ag_tk2: string;
  ag_tk3: string;
  ag_tk4: string;
  ag_tk5: string;
  ag_tk6: string;
  ag_tk7: string;
  ag_tk8: string;
  ag_tk9: string;
  ag_tk10: string;
  ag_tk11: string;
};

const AU_KEYS = [
  "au_tk1",
  "au_tk2",
  "au_tk3",
  "au_tk4",
  "au_tk5",
  "au_tk6",
  "au_tk7",
  "au_tk8",
  "au_tk9",
  "au_tk10",
  "au_tk11",
] as const;

const AG_KEYS = [
  "ag_tk1",
  "ag_tk2",
  "ag_tk3",
  "ag_tk4",
  "ag_tk5",
  "ag_tk6",
  "ag_tk7",
  "ag_tk8",
  "ag_tk9",
  "ag_tk10",
  "ag_tk11",
] as const;

type AuKey = (typeof AU_KEYS)[number];
type AgKey = (typeof AG_KEYS)[number];
type FieldKey = AuKey | AgKey;

function ymdToDate(ymd: string) {
  const m = String(ymd || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
  return new Date(y, mo - 1, d);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function defaultYm() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}${pad2(m)}`;
}

function daysInMonth(ym: string) {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return 0;
  return new Date(y, m, 0).getDate();
}

function buildMonthDates(ym: string) {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return [];
  const n = new Date(y, m, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= n; d++) out.push(`${y}-${pad2(m)}-${pad2(d)}`);
  return out;
}

function toNumOrNaN(s: string) {
  if (!s) return NaN;
  const t = String(s).trim().replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function toNumOrNull(s: string) {
  const t = String(s ?? "").trim();
  if (!t) return null;
  const n = toNumOrNaN(t);
  return Number.isFinite(n) ? n : null;
}

function okNonNegOrEmpty(s: string) {
  const t = String(s ?? "").trim();
  if (!t) return true;
  const n = toNumOrNaN(t);
  return Number.isFinite(n) && n >= 0;
}

function makeBlankRow(tank_day: string): RowState {
  const z: any = { tank_day };
  for (const k of AU_KEYS) z[k] = "";
  for (const k of AG_KEYS) z[k] = "";
  return z as RowState;
}

function fromApiRow(r: MonthRow): RowState {
  const out: any = { tank_day: String(r.tank_day || "").trim() };
  for (const k of AU_KEYS) out[k] = r[k] === null || r[k] === undefined ? "" : String(r[k]);
  for (const k of AG_KEYS) out[k] = r[k] === null || r[k] === undefined ? "" : String(r[k]);
  return out as RowState;
}

function weekdayShort(ymd: string) {
  const dt = ymdToDate(ymd);
  if (!dt) return "";
  const w = dt.getDay();
  return ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][w] || "";
}

export default function CarbonPage() {
  const [msg, setMsg] = useState<string | null>(null);

  const [ym, setYm] = useState(defaultYm());

  const [loading, setLoading] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [savingDay, setSavingDay] = useState<Record<string, boolean>>({});

  const [rows, setRows] = useState<RowState[]>([]);
  const [dirty, setDirty] = useState<Record<string, true>>({});

  const isYmValid = useMemo(() => /^\d{6}$/.test(String(ym || "").trim()) && daysInMonth(ym.trim()) > 0, [ym]);

  const canSaveAll = useMemo(() => {
    const hasDirty = Object.keys(dirty).length > 0;
    if (!hasDirty) return false;
    if (savingAll || loading) return false;
    for (const r of rows) {
      if (!dirty[r.tank_day]) continue;
      for (const k of AU_KEYS) if (!okNonNegOrEmpty((r as any)[k])) return false;
      for (const k of AG_KEYS) if (!okNonNegOrEmpty((r as any)[k])) return false;
    }
    return true;
  }, [dirty, savingAll, loading, rows]);

  async function loadMonth(nextYm?: string) {
    const ym0 = String(nextYm ?? ym).trim();
    setMsg(null);

    if (!/^\d{6}$/.test(ym0) || daysInMonth(ym0) <= 0) {
      setRows([]);
      setDirty({});
      setMsg("ERROR: ym inválido (YYYYMM)");
      return;
    }

    setLoading(true);
    try {
      const r = (await apiGet(`/api/planta/carbones/month?ym=${encodeURIComponent(ym0)}`)) as MonthResp;
      const list = Array.isArray(r.rows) ? r.rows : [];

      const byDay = new Map<string, MonthRow>();
      for (const it of list) {
        const d = String(it?.tank_day || "").trim();
        if (d) byDay.set(d, it);
      }

      const days = buildMonthDates(ym0);
      const merged = days.map((d) => (byDay.has(d) ? fromApiRow(byDay.get(d)!) : makeBlankRow(d)));

      setRows(merged);
      setDirty({});
    } catch (e: any) {
      setRows([]);
      setDirty({});
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando carbones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMonth(ym);
  }, []);

  function setCell(day: string, key: FieldKey, value: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.tank_day !== day) return r;
        return { ...r, [key]: value } as any;
      })
    );
    setDirty((d) => ({ ...d, [day]: true }));
  }

  function rowValid(r: RowState) {
    for (const k of AU_KEYS) if (!okNonNegOrEmpty((r as any)[k])) return false;
    for (const k of AG_KEYS) if (!okNonNegOrEmpty((r as any)[k])) return false;
    return true;
  }

  async function saveOne(day: string) {
    const r = rows.find((x) => x.tank_day === day);
    if (!r) return;
    if (!rowValid(r)) {
      setMsg(`ERROR: valores inválidos en ${day}`);
      return;
    }

    setSavingDay((s) => ({ ...s, [day]: true }));
    setMsg(null);
    try {
      const payload: any = { tank_day: day };
      for (const k of AU_KEYS) payload[k] = toNumOrNull((r as any)[k]);
      for (const k of AG_KEYS) payload[k] = toNumOrNull((r as any)[k]);

      await apiPost("/api/planta/carbones/upsert", payload);

      setDirty((d) => {
        const next = { ...d };
        delete next[day];
        return next;
      });
      setMsg(`OK: guardado ${day} · Carbones`);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : `ERROR guardando ${day}`);
    } finally {
      setSavingDay((s) => {
        const next = { ...s };
        delete next[day];
        return next;
      });
    }
  }

  async function saveAll() {
    const days = Object.keys(dirty);
    if (!days.length) return;

    for (const d of days) {
      const r = rows.find((x) => x.tank_day === d);
      if (!r) continue;
      if (!rowValid(r)) {
        setMsg(`ERROR: valores inválidos en ${d}`);
        return;
      }
    }

    setSavingAll(true);
    setMsg(null);
    try {
      for (const d of days) {
        await saveOne(d);
      }
      setMsg(`OK: guardado mes ${ym.trim()} · Carbones`);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando mes");
    } finally {
      setSavingAll(false);
    }
  }

  const colStyle: React.CSSProperties = {
    minWidth: 108,
    maxWidth: 120,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(0,0,0,.10)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    borderRadius: 10,
    padding: "8px 10px",
    outline: "none",
    fontWeight: 900,
  };

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 1400 }}>
      <div className="panel-inner" style={{ padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Carbones</div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Input
              value={ym}
              onChange={(e: any) => setYm(String(e.target.value || "").trim())}
              hint="Mes (YYYYMM) · ej: 202601"
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => loadMonth(ym)}
              disabled={loading || savingAll || !isYmValid}
            >
              {loading ? "Cargando..." : "Cargar"}
            </Button>
          </div>

          <Button type="button" size="sm" variant="primary" onClick={saveAll} disabled={!canSaveAll}>
            {savingAll ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>

      {msg ? (
        <div
          className="panel-inner"
          style={{
            padding: 12,
            border: msg.startsWith("OK") ? "1px solid rgba(102,199,255,.45)" : "1px solid rgba(255,80,80,.45)",
            background: msg.startsWith("OK") ? "rgba(102,199,255,.10)" : "rgba(255,80,80,.10)",
            fontWeight: 800,
          }}
        >
          {msg}
        </div>
      ) : null}

      <div className="panel-inner" style={{ padding: 14 }}>
        {!isYmValid ? (
          <div className="muted" style={{ fontWeight: 800 }}>
            Ingresa un mes válido en formato YYYYMM.
          </div>
        ) : rows.length ? (
          <div style={{ overflow: "auto", borderRadius: 12, border: "1px solid rgba(255,255,255,.06)" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th
                    style={{
                      position: "sticky",
                      left: 0,
                      zIndex: 3,
                      background: "var(--panel)",
                      textAlign: "left",
                      padding: "10px 10px",
                      borderBottom: "1px solid rgba(255,255,255,.08)",
                      fontWeight: 900,
                      minWidth: 140,
                    }}
                  >
                    Día
                  </th>

                  <th
                    style={{
                      background: "var(--panel)",
                      textAlign: "left",
                      padding: "10px 10px",
                      borderBottom: "1px solid rgba(255,255,255,.08)",
                      fontWeight: 900,
                      minWidth: 120,
                    }}
                  >
                    Acción
                  </th>

                  {AU_KEYS.map((k) => (
                    <th
                      key={k}
                      style={{
                        ...colStyle,
                        background: "var(--panel)",
                        textAlign: "left",
                        padding: "10px 10px",
                        borderBottom: "1px solid rgba(255,255,255,.08)",
                        fontWeight: 900,
                      }}
                    >
                      {k.toUpperCase()}
                    </th>
                  ))}

                  {AG_KEYS.map((k) => (
                    <th
                      key={k}
                      style={{
                        ...colStyle,
                        background: "var(--panel)",
                        textAlign: "left",
                        padding: "10px 10px",
                        borderBottom: "1px solid rgba(255,255,255,.08)",
                        fontWeight: 900,
                      }}
                    >
                      {k.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => {
                  const isDirty = !!dirty[r.tank_day];
                  const busy = !!savingDay[r.tank_day] || savingAll || loading;
                  const valid = rowValid(r);

                  return (
                    <tr key={r.tank_day} style={{ background: isDirty ? "rgba(102,199,255,.06)" : "transparent" }}>
                      <td
                        style={{
                          position: "sticky",
                          left: 0,
                          zIndex: 2,
                          background: isDirty ? "rgba(102,199,255,.06)" : "var(--panel)",
                          padding: "10px 10px",
                          borderBottom: "1px solid rgba(255,255,255,.06)",
                          fontWeight: 900,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <div>{r.tank_day}</div>
                          <div className="muted" style={{ fontWeight: 900, fontSize: 12 }}>
                            {weekdayShort(r.tank_day)}
                          </div>
                        </div>
                        {!valid ? (
                          <div style={{ marginTop: 4, fontSize: 11, fontWeight: 900, color: "rgba(255,120,120,.95)" }}>
                            Solo números ≥ 0 (o vacío)
                          </div>
                        ) : null}
                      </td>

                      <td style={{ padding: "10px 10px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => saveOne(r.tank_day)}
                          disabled={!isDirty || busy || !valid}
                        >
                          {savingDay[r.tank_day] ? "Guardando…" : "Guardar"}
                        </Button>
                      </td>

                      {AU_KEYS.map((k) => {
                        const v = (r as any)[k] as string;
                        const ok = okNonNegOrEmpty(v);
                        return (
                          <td key={k} style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                            <input
                              value={v}
                              disabled={busy}
                              onChange={(e) => setCell(r.tank_day, k, e.target.value)}
                              style={{
                                ...inputStyle,
                                border: ok ? "1px solid var(--border)" : "1px solid rgba(255,80,80,.55)",
                                background: ok ? "rgba(0,0,0,.10)" : "rgba(255,80,80,.08)",
                                opacity: busy ? 0.7 : 1,
                              }}
                              placeholder=""
                            />
                          </td>
                        );
                      })}

                      {AG_KEYS.map((k) => {
                        const v = (r as any)[k] as string;
                        const ok = okNonNegOrEmpty(v);
                        return (
                          <td key={k} style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                            <input
                              value={v}
                              disabled={busy}
                              onChange={(e) => setCell(r.tank_day, k, e.target.value)}
                              style={{
                                ...inputStyle,
                                border: ok ? "1px solid var(--border)" : "1px solid rgba(255,80,80,.55)",
                                background: ok ? "rgba(0,0,0,.10)" : "rgba(255,80,80,.08)",
                                opacity: busy ? 0.7 : 1,
                              }}
                              placeholder=""
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="muted" style={{ fontWeight: 800 }}>
            {loading ? "Cargando…" : "No hay filas para este mes."}
          </div>
        )}
      </div>
    </div>
  );
}