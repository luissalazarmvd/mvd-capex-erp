// src/app/planta/carbon/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "../../../lib/apiClient";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { Table } from "../../../components/ui/Table";

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

const MONTHS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
] as const;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymdToDate(ymd: string) {
  const m = String(ymd || "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
  return new Date(y, mo - 1, d);
}

function weekdayShort(ymd: string) {
  const dt = ymdToDate(ymd);
  if (!dt) return "";
  const w = dt.getDay();
  return ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][w] || "";
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

function defaultYearMonth() {
  const d = new Date();
  return { year: String(d.getFullYear()), month: d.getMonth() + 1 };
}

function ymFromInputs(year: string, month: number) {
  const y = String(year || "").trim();
  if (!/^\d{4}$/.test(y)) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return `${y}${pad2(month)}`;
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

function Select({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const currentLabel =
    options.find((o) => o.value === value)?.label ?? options.find((o) => o.value === "")?.label ?? "";

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as any)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  return (
    <div style={{ display: "grid", gap: 6 }} ref={wrapRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((s) => !s)}
        style={{
          width: "100%",
          textAlign: "left",
          background: "rgba(0,0,0,.10)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          borderRadius: 10,
          padding: "10px 12px",
          outline: "none",
          fontWeight: 900,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.7 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          height: 38,
          minWidth: 190,
        }}
      >
        <span style={{ opacity: value ? 1 : 0.6 }}>{currentLabel}</span>
        <span style={{ opacity: 0.8 }}>▾</span>
      </button>

      {open ? (
        <div style={{ position: "relative", zIndex: 50 }}>
          <div
            style={{
              position: "absolute",
              top: 6,
              left: 0,
              right: 0,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.10)",
              background: "rgba(5, 25, 45, .98)",
              boxShadow: "0 10px 30px rgba(0,0,0,.45)",
              overflow: "hidden",
            }}
          >
            {options.map((o) => {
              const active = o.value === value;
              const isEmpty = o.value === "";
              return (
                <button
                  key={o.value || "__empty__"}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    background: active ? "rgba(102,199,255,.18)" : "transparent",
                    color: isEmpty ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.92)",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as any).style.background = active
                      ? "rgba(102,199,255,.18)"
                      : "rgba(255,255,255,.06)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as any).style.background = active ? "rgba(102,199,255,.18)" : "transparent";
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

const TANKS = ["TK1", "TK2", "TK3", "TK4", "TK5", "TK6", "TK7", "TK8", "TK9", "TK10", "TK11"] as const;
type Tank = (typeof TANKS)[number];
const COMMENT_MAX = 255;
type TankQtyRow = {
  tank: Tank;
  entry_date: string;
  campaign1_mm: string;
  campaign1_seq: string;
  campaign2_mm: string;
  campaign2_seq: string;
  carbon_kg_1: string;
  carbon_kg_2: string;
  eff_pct_ui: string;
  cycles: string;
  tank_comment: string;
};

function blankQtyRow(tank: Tank): TankQtyRow {
  return {
    tank,
    entry_date: "",
    campaign1_mm: "",
    campaign1_seq: "",
    campaign2_mm: "",
    campaign2_seq: "",
    carbon_kg_1: "",
    carbon_kg_2: "",
    eff_pct_ui: "",
    cycles: "",
    tank_comment: "",
  };
}

function toEff01OrNull(s: string) {
  const t = String(s ?? "").trim();
  if (!t) return null;
  const n = toNumOrNaN(t);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  const v = n / 100;
  return Number.isFinite(v) ? v : null;
}

function okEff0to100OrEmpty(s: string) {
  const t = String(s ?? "").trim();
  if (!t) return true;
  const n = toNumOrNaN(t);
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

function okIntNonNegOrEmpty(s: string) {
  const t = String(s ?? "").trim();
  if (!t) return true;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0;
}

function only2Digits(s: string) {
  const x = String(s || "").replace(/\D/g, "").slice(0, 2);
  return x;
}

function ok2DigitsOrEmpty(s: string) {
  const t = String(s ?? "").trim();
  if (!t) return true;
  return /^\d{2}$/.test(t);
}

function campaignCode(mm: string, seq: string) {
  const a = String(mm || "").trim();
  const b = String(seq || "").trim();
  if (!/^\d{2}$/.test(a) || !/^\d{2}$/.test(b)) return null;
  return `C-${a}-${b}`;
}

function campaignFilled(mm: string, seq: string) {
  const a = String(mm ?? "").trim();
  const b = String(seq ?? "").trim();
  const any = !!a || !!b;
  const complete = /^\d{2}$/.test(a) && /^\d{2}$/.test(b);
  if (!any) return { any: false, complete: false, code: null as string | null };
  if (!complete) return { any: true, complete: false, code: null as string | null };
  return { any: true, complete: true, code: campaignCode(a, b) };
}

function lineState(mm: string, seq: string, kg: string) {
  const c = campaignFilled(mm, seq);
  const kgTrim = String(kg ?? "").trim();
  const kgAny = !!kgTrim;
  const kgOk = okNonNegOrEmpty(kgTrim) && kgTrim !== "";
  const active = c.any || kgAny;
  return {
    active,
    campAny: c.any,
    campComplete: c.complete,
    campCode: c.code,
    kgAny,
    kgOk,
    kgRequiredOk: kgAny && kgOk,
  };
}

function rowHasMeaningfulQty(r: TankQtyRow) {
  const l1 = lineState(r.campaign1_mm, r.campaign1_seq, r.carbon_kg_1);
  const l2 = lineState(r.campaign2_mm, r.campaign2_seq, r.carbon_kg_2);
  return l1.active || l2.active;
}

function qtyRowCompleteAndValid(r: TankQtyRow) {
  const l1 = lineState(r.campaign1_mm, r.campaign1_seq, r.carbon_kg_1);
  const l2 = lineState(r.campaign2_mm, r.campaign2_seq, r.carbon_kg_2);
  const cmtLen = String(r.tank_comment ?? "").length;
  if (cmtLen > COMMENT_MAX) return false;

  if (l1.active && l2.active) {
    const c1 = campaignFilled(r.campaign1_mm, r.campaign1_seq);
    const c2 = campaignFilled(r.campaign2_mm, r.campaign2_seq);

    if (c1.complete && c2.complete && c1.code && c2.code && c1.code === c2.code) {
      return false;
    }
  }

  if (!(l1.active || l2.active)) return false;

  if (!isIsoDate(r.entry_date)) return false;

  if (!okEff0to100OrEmpty(r.eff_pct_ui) || String(r.eff_pct_ui || "").trim() === "") return false;
  if (!okIntNonNegOrEmpty(r.cycles) || String(r.cycles || "").trim() === "") return false;

  const eff01 = toEff01OrNull(r.eff_pct_ui);
  if (eff01 === null) return false;

  const checkLine = (ln: ReturnType<typeof lineState>) => {
    if (!ln.active) return true;
    if (!ln.campAny && ln.kgAny) return false;
    if (ln.campAny && !ln.campComplete) return false;
    if (ln.campComplete && !ln.kgAny) return false;
    if (ln.kgAny && !ln.kgOk) return false;
    return true;
  };

  if (!checkLine(l1)) return false;
  if (!checkLine(l2)) return false;

  if (!(l1.campComplete || l2.campComplete)) return false;

  return true;
}

export default function CarbonPage() {
  const originalByDayRef = useRef<Record<string, RowState>>({});
  const init = useMemo(() => defaultYearMonth(), []);
  const [year, setYear] = useState<string>(init.year);
  const [month, setMonth] = useState<number>(init.month);

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  const [rows, setRows] = useState<RowState[]>([]);
  const [dirty, setDirty] = useState<Record<string, true>>({});

  const ym = useMemo(() => ymFromInputs(year, month) ?? "", [year, month]);
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
      setMsg("ERROR: mes inválido");
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

      const orig: Record<string, RowState> = {};
      for (const rr of merged) orig[rr.tank_day] = rr;
      originalByDayRef.current = orig;

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
    if (!isYmValid) {
      setRows([]);
      setDirty({});
      originalByDayRef.current = {};
      return;
    }
    if (savingAll) return;

    setMsg(null);
    setRows([]);
    setDirty({});
    originalByDayRef.current = {};

    loadMonth(ym);
  }, [ym, isYmValid, savingAll]);

  function isRowDirty(nextRow: RowState) {
    const orig = originalByDayRef.current[nextRow.tank_day];
    if (!orig) return true;
    for (const k of AU_KEYS) if (String((nextRow as any)[k] ?? "") !== String((orig as any)[k] ?? "")) return true;
    for (const k of AG_KEYS) if (String((nextRow as any)[k] ?? "") !== String((orig as any)[k] ?? "")) return true;
    return false;
  }

  function setCell(day: string, key: FieldKey, value: string) {
    setRows((prev) => {
      const next = prev.map((r) => (r.tank_day === day ? ({ ...r, [key]: value } as any) : r));
      const changed = next.find((x) => x.tank_day === day);

      if (changed) {
        setDirty((d) => {
          const nd: any = { ...d };
          if (isRowDirty(changed)) nd[day] = true;
          else delete nd[day];
          return nd;
        });
      }

      return next;
    });
  }

  function rowValid(r: RowState) {
    for (const k of AU_KEYS) if (!okNonNegOrEmpty((r as any)[k])) return false;
    for (const k of AG_KEYS) if (!okNonNegOrEmpty((r as any)[k])) return false;
    return true;
  }

  async function saveAll() {
    const days = Object.keys(dirty);
    if (!days.length) return;

    for (const d of days) {
      const rr = rows.find((x) => x.tank_day === d);
      if (!rr) continue;
      if (!rowValid(rr)) {
        setMsg(`ERROR: valores inválidos en ${d}`);
        return;
      }
    }

    setSavingAll(true);
    setMsg(null);

    try {
      for (const d of days) {
        const rr = rows.find((x) => x.tank_day === d);
        if (!rr) continue;

        const payload: any = { tank_day: d };
        for (const k of AU_KEYS) payload[k] = toNumOrNull((rr as any)[k]);
        for (const k of AG_KEYS) payload[k] = toNumOrNull((rr as any)[k]);

        await apiPost("/api/planta/carbones/upsert", payload);
      }

      setDirty({});
      setMsg(`OK: carbones guardados (${ym.trim()})`);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando carbones");
    } finally {
      setSavingAll(false);
    }
  }

  const colW: React.CSSProperties = { minWidth: 72, maxWidth: 84 };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(0,0,0,.10)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    borderRadius: 8,
    padding: "6px 8px",
    outline: "none",
    fontWeight: 900,
    fontSize: 12,
    textAlign: "center",
  };

  const groupBorder = "1px solid rgba(191, 231, 255, 0.22)";
  const groupBg = "rgba(0,0,0,.08)";

  const auHeadTL: React.CSSProperties = { borderTopLeftRadius: 12 };
  const auHeadTR: React.CSSProperties = { borderTopRightRadius: 12 };
  const auBotBL: React.CSSProperties = { borderBottomLeftRadius: 12 };
  const auBotBR: React.CSSProperties = { borderBottomRightRadius: 12 };

  const agHeadTL: React.CSSProperties = { borderTopLeftRadius: 12 };
  const agHeadTR: React.CSSProperties = { borderTopRightRadius: 12 };
  const agBotBL: React.CSSProperties = { borderBottomLeftRadius: 12 };
  const agBotBR: React.CSSProperties = { borderBottomRightRadius: 12 };

  const GAP_W = 14;
  const HEADER_ROW1_H = 44;

  const solidHeaderBg = "rgb(6, 36, 58)";
  const solidHeaderBorder = "1px solid rgba(191, 231, 255, 0.26)";
  const solidHeaderShadow = "0 8px 18px rgba(0,0,0,.18)";

  const stickyRow1: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 8,
    background: solidHeaderBg,
    boxShadow: solidHeaderShadow,
  };

  const stickyRow2: React.CSSProperties = {
    position: "sticky",
    top: HEADER_ROW1_H,
    zIndex: 7,
    background: solidHeaderBg,
    boxShadow: solidHeaderShadow,
  };

  const stickyDayBg = "rgb(6, 36, 58)";

  const monthOptions = useMemo(() => MONTHS.map((m) => ({ value: String(m.value), label: m.label })), []);

  const originalQtyRef = useRef<Record<string, TankQtyRow>>({});
  const [qtyMsg, setQtyMsg] = useState<string | null>(null);
  const [qtySaving, setQtySaving] = useState(false);
  const [qtyRows, setQtyRows] = useState<TankQtyRow[]>(() => TANKS.map((t) => blankQtyRow(t)));
  const [qtyDirty, setQtyDirty] = useState<Record<string, true>>({});

  useEffect(() => {
    const orig: Record<string, TankQtyRow> = {};
    for (const r of qtyRows) orig[r.tank] = { ...r };
    originalQtyRef.current = orig;
    setQtyDirty({});
    setQtyMsg(null);
  }, []);

  function isQtyRowDirty(nextRow: TankQtyRow) {
    const orig = originalQtyRef.current[nextRow.tank];
    if (!orig) return true;

    const keys: (keyof TankQtyRow)[] = [
      "entry_date",
      "campaign1_mm",
      "campaign1_seq",
      "campaign2_mm",
      "campaign2_seq",
      "carbon_kg_1",
      "carbon_kg_2",
      "eff_pct_ui",
      "cycles",
      "tank_comment",
    ];

    for (const k of keys) {
      if (String(nextRow[k] ?? "") !== String(orig[k] ?? "")) return true;
    }
    return false;
  }

  function setQtyCell(tank: Tank, key: keyof Omit<TankQtyRow, "tank">, value: string) {
    setQtyRows((prev) => {
      const next = prev.map((r) => (r.tank === tank ? ({ ...r, [key]: value } as TankQtyRow) : r));
      const changed = next.find((x) => x.tank === tank);
      if (changed) {
        setQtyDirty((d) => {
          const nd: any = { ...d };
          if (isQtyRowDirty(changed)) nd[tank] = true;
          else delete nd[tank];
          return nd;
        });
      }
      return next;
    });
  }

  const canSaveQty = useMemo(() => {
    if (qtySaving || loading || savingAll) return false;

    const dirtyTanks = Object.keys(qtyDirty) as Tank[];
    if (!dirtyTanks.length) return false;

    let hasMeaningful = false;

    for (const t of dirtyTanks) {
      const r = qtyRows.find((x) => x.tank === t);
      if (!r) continue;

      const meaningful = rowHasMeaningfulQty(r);
      if (!meaningful) continue;

      hasMeaningful = true;
      if (!qtyRowCompleteAndValid(r)) return false;
    }

    return hasMeaningful;
  }, [qtyDirty, qtySaving, qtyRows, loading, savingAll]);

  async function saveQty() {
  const tanks = Object.keys(qtyDirty) as Tank[];
  if (!tanks.length) return;

  for (const t of tanks) {
    const r = qtyRows.find((x) => x.tank === t);
    if (!r) continue;
    if (!rowHasMeaningfulQty(r)) continue;
    if (!qtyRowCompleteAndValid(r)) {
      setQtyMsg(`ERROR: valores inválidos en ${t}`);
      return;
    }
  }

  setQtySaving(true);
  setQtyMsg(null);

  try {
    for (const t of tanks) {
      const r = qtyRows.find((x) => x.tank === t);
      if (!r) continue;

      if (!rowHasMeaningfulQty(r)) continue;

      const eff01 = toEff01OrNull(r.eff_pct_ui);
      if (eff01 === null) throw new Error(`eff inválida en ${t}`);

      const c1 = campaignFilled(r.campaign1_mm, r.campaign1_seq);
      const c2 = campaignFilled(r.campaign2_mm, r.campaign2_seq);

      const l1 = lineState(r.campaign1_mm, r.campaign1_seq, r.carbon_kg_1);
      const l2 = lineState(r.campaign2_mm, r.campaign2_seq, r.carbon_kg_2);

      if (l1.active && l2.active && c1.complete && c2.complete && c1.code === c2.code) {
        throw new Error(`ERROR: campaña repetida en ${t} (${c1.code})`);
      }

      const baseCommon: any = {
        tank: t,
        entry_date: r.entry_date,
        eff_pct: eff01,
        cycles: Number(String(r.cycles || "").trim()),
        tank_comment: String(r.tank_comment ?? "").trim() || null,
      };

      const activeCount = (l1.active ? 1 : 0) + (l2.active ? 1 : 0);

      // 1) Enviar campañas activas
      if (l1.active) {
        if (!c1.complete) throw new Error(`campaña 1 inválida en ${t}`);
        if (!l1.kgAny || !l1.kgOk) throw new Error(`carbón 1 inválido en ${t}`);

        await apiPost("/api/planta/carbones/qty/upsert", {
          ...baseCommon,
          campaign: c1.code,
          carbon_kg: toNumOrNull(r.carbon_kg_1),
        });
      }

      if (l2.active) {
        if (!c2.complete) throw new Error(`campaña 2 inválida en ${t}`);
        if (!l2.kgAny || !l2.kgOk) throw new Error(`carbón 2 inválido en ${t}`);

        await apiPost("/api/planta/carbones/qty/upsert", {
          ...baseCommon,
          campaign: c2.code,
          carbon_kg: toNumOrNull(r.carbon_kg_2),
        });
      }

      // 2) Si SOLO hay 1 campaña activa => enviar "fila" extra con campaña vacía (snapshot)
      //    OJO: tu server acepta campaign_id obligatorio, así que mandamos campaign: null
      //    y el server debe aceptar campaign_id NULL para crear el snapshot.
      //    Si tu server NO acepta null, abajo te digo qué cambiar.
      if (activeCount === 1) {
        await apiPost("/api/planta/carbones/qty/upsert", {
          ...baseCommon,
          campaign: null,
          carbon_kg: null,
        });
      }
    }

    const orig: Record<string, TankQtyRow> = {};
    for (const r of qtyRows) orig[r.tank] = { ...r };
    originalQtyRef.current = orig;

    setQtyDirty({});
    setQtyMsg("OK: carbón por tanque guardado");
  } catch (e: any) {
    setQtyMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando carbón por tanque");
  } finally {
    setQtySaving(false);
  }
}


  const qtyInputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(0,0,0,.10)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    borderRadius: 8,
    padding: "8px 10px",
    outline: "none",
    fontWeight: 900,
    fontSize: 12,
  };

  return (
    <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
      <div className="panel-inner" style={{ padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Carbones</div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Input
            value={year}
            onChange={(e: any) => {
              const v = String(e.target.value || "").trim();
              setYear(v);
            }}
            hint="Año (YYYY)"
          />

          <div style={{ display: "grid", gap: 4 }}>
            <Select value={String(month)} onChange={(v) => setMonth(Number(v))} disabled={loading || savingAll} options={monthOptions} />
            <div className="muted" style={{ fontWeight: 900, fontSize: 12, paddingLeft: 2 }}>
              Mes
            </div>
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
            padding: 10,
            border: msg.startsWith("OK") ? "1px solid rgba(102,199,255,.45)" : "1px solid rgba(255,80,80,.45)",
            background: msg.startsWith("OK") ? "rgba(102,199,255,.10)" : "rgba(255,80,80,.10)",
            fontWeight: 800,
          }}
        >
          {msg}
        </div>
      ) : null}

      <div style={{ minWidth: 0 }}>
        {!isYmValid ? (
          <div className="panel-inner" style={{ padding: 12, fontWeight: 800 }}>
            Año debe ser YYYY y mes válido.
          </div>
        ) : rows.length ? (
          <Table stickyHeader maxHeight={"calc(100vh - 340px)"}>
            <thead>
              <tr>
                <th
                  className="capex-th"
                  rowSpan={2}
                  style={{
                    ...stickyRow1,
                    position: "sticky",
                    left: 0,
                    zIndex: 14,
                    minWidth: 150,
                    background: stickyDayBg,
                    borderRight: "1px solid rgba(255,255,255,.08)",
                  }}
                >
                  Día
                </th>

                <th
                  className="capex-th"
                  colSpan={AU_KEYS.length}
                  style={{
                    ...stickyRow1,
                    textAlign: "center",
                    background: solidHeaderBg,
                    border: solidHeaderBorder,
                    borderBottom: "0",
                    ...auHeadTL,
                    ...auHeadTR,
                  }}
                >
                  Au
                </th>

                <th
                  className="capex-th"
                  style={{
                    ...stickyRow1,
                    width: GAP_W,
                    minWidth: GAP_W,
                    maxWidth: GAP_W,
                    padding: 0,
                    background: "transparent",
                    borderBottom: "0",
                    boxShadow: "none",
                  }}
                />

                <th
                  className="capex-th"
                  colSpan={AG_KEYS.length}
                  style={{
                    ...stickyRow1,
                    textAlign: "center",
                    background: solidHeaderBg,
                    border: solidHeaderBorder,
                    borderBottom: "0",
                    ...agHeadTL,
                    ...agHeadTR,
                  }}
                >
                  Ag
                </th>
              </tr>

              <tr>
                {AU_KEYS.map((k, i) => (
                  <th
                    key={k}
                    className="capex-th"
                    style={{
                      ...stickyRow2,
                      ...colW,
                      background: solidHeaderBg,
                      borderLeft: i === 0 ? solidHeaderBorder : undefined,
                      borderRight: i === AU_KEYS.length - 1 ? solidHeaderBorder : undefined,
                      borderBottom: solidHeaderBorder,
                      ...(i === 0 ? auHeadTL : {}),
                      ...(i === AU_KEYS.length - 1 ? auHeadTR : {}),
                    }}
                  >
                    {`TK${i + 1}`}
                  </th>
                ))}

                <th
                  className="capex-th"
                  style={{
                    ...stickyRow2,
                    width: GAP_W,
                    minWidth: GAP_W,
                    maxWidth: GAP_W,
                    padding: 0,
                    background: "transparent",
                    borderBottom: "0",
                    boxShadow: "none",
                  }}
                />

                {AG_KEYS.map((k, i) => (
                  <th
                    key={k}
                    className="capex-th"
                    style={{
                      ...stickyRow2,
                      ...colW,
                      background: solidHeaderBg,
                      borderLeft: i === 0 ? solidHeaderBorder : undefined,
                      borderRight: i === AG_KEYS.length - 1 ? solidHeaderBorder : undefined,
                      borderBottom: solidHeaderBorder,
                      ...(i === 0 ? agHeadTL : {}),
                      ...(i === AG_KEYS.length - 1 ? agHeadTR : {}),
                    }}
                  >
                    {`TK${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((r, rowIdx) => {
                const isDirty = !!dirty[r.tank_day];
                const valid = rowValid(r);
                const isLastRow = rowIdx === rows.length - 1;

                return (
                  <tr key={r.tank_day} className="capex-tr" style={{ background: isDirty ? "rgba(102,199,255,.05)" : "transparent" }}>
                    <td
                      className="capex-td capex-td-strong"
                      style={{
                        position: "sticky",
                        left: 0,
                        zIndex: 2,
                        background: isDirty ? "rgba(102,199,255,.05)" : "rgba(0,0,0,.18)",
                        minWidth: 150,
                        padding: "6px 10px",
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div>{r.tank_day}</div>
                        <div className="muted" style={{ fontWeight: 900, fontSize: 12 }}>
                          {weekdayShort(r.tank_day)}
                        </div>
                        {!valid ? (
                          <div style={{ marginLeft: 8, fontSize: 11, fontWeight: 900, color: "rgba(255,120,120,.95)" }}>Inválido</div>
                        ) : null}
                      </div>
                    </td>

                    {AU_KEYS.map((k, i) => {
                      const v = (r as any)[k] as string;
                      const ok = okNonNegOrEmpty(v);
                      return (
                        <td
                          key={k}
                          className="capex-td"
                          style={{
                            padding: "6px 6px",
                            background: groupBg,
                            borderLeft: i === 0 ? groupBorder : undefined,
                            borderRight: i === AU_KEYS.length - 1 ? groupBorder : undefined,
                            borderBottom: isLastRow ? groupBorder : undefined,
                            ...(isLastRow && i === 0 ? auBotBL : {}),
                            ...(isLastRow && i === AU_KEYS.length - 1 ? auBotBR : {}),
                          }}
                        >
                          <input
                            value={v}
                            disabled={savingAll || loading}
                            onChange={(e) => setCell(r.tank_day, k, e.target.value)}
                            style={{
                              ...inputStyle,
                              border: ok ? "1px solid var(--border)" : "1px solid rgba(255,80,80,.55)",
                              background: ok ? "rgba(0,0,0,.10)" : "rgba(255,80,80,.08)",
                              opacity: savingAll || loading ? 0.7 : 1,
                            }}
                          />
                        </td>
                      );
                    })}

                    <td
                      style={{
                        width: GAP_W,
                        minWidth: GAP_W,
                        maxWidth: GAP_W,
                        padding: 0,
                        background: "transparent",
                        borderBottom: "0",
                      }}
                    />

                    {AG_KEYS.map((k, i) => {
                      const v = (r as any)[k] as string;
                      const ok = okNonNegOrEmpty(v);
                      return (
                        <td
                          key={k}
                          className="capex-td"
                          style={{
                            padding: "6px 6px",
                            background: groupBg,
                            borderLeft: i === 0 ? groupBorder : undefined,
                            borderRight: i === AG_KEYS.length - 1 ? groupBorder : undefined,
                            borderBottom: isLastRow ? groupBorder : undefined,
                            ...(isLastRow && i === 0 ? agBotBL : {}),
                            ...(isLastRow && i === AG_KEYS.length - 1 ? agBotBR : {}),
                          }}
                        >
                          <input
                            value={v}
                            disabled={savingAll || loading}
                            onChange={(e) => setCell(r.tank_day, k, e.target.value)}
                            style={{
                              ...inputStyle,
                              border: ok ? "1px solid var(--border)" : "1px solid rgba(255,80,80,.55)",
                              background: ok ? "rgba(0,0,0,.10)" : "rgba(255,80,80,.08)",
                              opacity: savingAll || loading ? 0.7 : 1,
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <div className="panel-inner" style={{ padding: 12, fontWeight: 800 }}>
            {loading ? "Cargando…" : "No hay filas para este mes."}
          </div>
        )}
      </div>

      <div className="panel-inner" style={{ padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Ingreso de carbón</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Button type="button" size="sm" variant="primary" onClick={saveQty} disabled={!canSaveQty}>
            {qtySaving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      {qtyMsg ? (
        <div
          className="panel-inner"
          style={{
            padding: 10,
            border: qtyMsg.startsWith("OK") ? "1px solid rgba(102,199,255,.45)" : "1px solid rgba(255,80,80,.45)",
            background: qtyMsg.startsWith("OK") ? "rgba(102,199,255,.10)" : "rgba(255,80,80,.10)",
            fontWeight: 800,
          }}
        >
          {qtyMsg}
        </div>
      ) : null}

      <Table>
        <thead>
          <tr>
            <th className="capex-th" style={{ background: solidHeaderBg, border: solidHeaderBorder }}>
              Tanque
            </th>
            <th className="capex-th" style={{ background: solidHeaderBg, border: solidHeaderBorder }}>
              Fecha de Ingreso
            </th>
            <th className="capex-th" style={{ background: solidHeaderBg, border: solidHeaderBorder }}>
              Campaña
            </th>
            <th className="capex-th" style={{ background: solidHeaderBg, border: solidHeaderBorder }}>
              Carbón (kg)
            </th>
            <th className="capex-th" style={{ background: solidHeaderBg, border: solidHeaderBorder }}>
              Eficiencia (%)
            </th>
            <th className="capex-th" style={{ background: solidHeaderBg, border: solidHeaderBorder }}>
              # Vueltas
            </th>
            <th className="capex-th" style={{ background: solidHeaderBg, border: solidHeaderBorder }}>
              Comentario
            </th>
          </tr>
        </thead>
        <tbody>
          {qtyRows.map((r) => {
            const isD = !!qtyDirty[r.tank];

            const l1 = lineState(r.campaign1_mm, r.campaign1_seq, r.carbon_kg_1);
            const l2 = lineState(r.campaign2_mm, r.campaign2_seq, r.carbon_kg_2);

            const meaningful = l1.active || l2.active;
            const valid = !meaningful || qtyRowCompleteAndValid(r);

            const okDate = !meaningful || isIsoDate(r.entry_date);

            const okCamp1 = !meaningful || !l1.active || l1.campComplete;
            const okCamp2 = !meaningful || !l2.active || l2.campComplete;

            const okKg1 = !meaningful || !l1.active || (l1.kgAny && l1.kgOk);
            const okKg2 = !meaningful || !l2.active || (l2.kgAny && l2.kgOk);

            const okEff = !meaningful || (okEff0to100OrEmpty(r.eff_pct_ui) && String(r.eff_pct_ui || "").trim() !== "");
            const okCy = !meaningful || (okIntNonNegOrEmpty(r.cycles) && String(r.cycles || "").trim() !== "");

            return (
              <tr key={r.tank} className="capex-tr" style={{ background: isD ? "rgba(102,199,255,.05)" : "transparent" }}>
                <td className="capex-td capex-td-strong" style={{ fontWeight: 900 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div>{r.tank}</div>
                    {!valid ? <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(255,120,120,.95)" }}>Inválido</div> : null}
                  </div>
                </td>

                <td className="capex-td">
                  <input
                    type="date"
                    value={r.entry_date}
                    disabled={qtySaving || loading || savingAll}
                    onChange={(e) => setQtyCell(r.tank, "entry_date", e.target.value)}
                    style={{
                      ...qtyInputStyle,
                      border: okDate ? "1px solid var(--border)" : "1px solid rgba(255,80,80,.55)",
                      background: okDate ? "rgba(0,0,0,.10)" : "rgba(255,80,80,.08)",
                      opacity: qtySaving || loading || savingAll ? 0.7 : 1,
                    }}
                  />
                </td>

                <td className="capex-td">
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ fontWeight: 900, opacity: 0.85, width: 22 }}>C-</div>

                      <input
                        value={r.campaign1_mm}
                        disabled={qtySaving || loading || savingAll}
                        onChange={(e) => setQtyCell(r.tank, "campaign1_mm", only2Digits(e.target.value))}
                        style={{
                          ...qtyInputStyle,
                          width: 54,
                          textAlign: "center",
                          border: ok2DigitsOrEmpty(r.campaign1_mm) && okCamp1 ? "1px solid var(--border)" : "1px solid rgba(255,80,80,.55)",
                          background: ok2DigitsOrEmpty(r.campaign1_mm) && okCamp1 ? "rgba(0,0,0,.10)" : "rgba(255,80,80,.08)",
                          opacity: qtySaving || loading || savingAll ? 0.7 : 1,
                        }}
                        placeholder="MM"
                        inputMode="numeric"
                      />

                      <div style={{ fontWeight: 900, opacity: 0.85 }}>-</div>

                      <input
                        value={r.campaign1_seq}
                        disabled={qtySaving || loading || savingAll}
                        onChange={(e) => setQtyCell(r.tank, "campaign1_seq", only2Digits(e.target.value))}
                        style={{
                          ...qtyInputStyle,
                          width: 54,
                          textAlign: "center",
                          border: ok2DigitsOrEmpty(r.campaign1_seq) && okCamp1 ? "1px solid var(--border)" : "1px solid rgba(255,80,80,.55)",
                          background: ok2DigitsOrEmpty(r.campaign1_seq) && okCamp1 ? "rgba(0,0,0,.10)" : "rgba(255,80,80,.08)",
                          opacity: qtySaving || loading || savingAll ? 0.7 : 1,
                        }}
                        placeholder="##"
                        inputMode="numeric"
                      />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ fontWeight: 900, opacity: 0.55, width: 22 }}>C-</div>

                      <input
                        value={r.campaign2_mm}
                        disabled={qtySaving || loading || savingAll}
                        onChange={(e) => setQtyCell(r.tank, "campaign2_mm", only2Digits(e.target.value))}
                        style={{
                          ...qtyInputStyle,
                          width: 54,
                          textAlign: "center",
                          border: ok2DigitsOrEmpty(r.campaign2_mm) && okCamp2 ? "1px solid var(--border)" : "1px solid rgba(255,80,80,.55)",
                          background: ok2DigitsOrEmpty(r.campaign2_mm) && okCamp2 ? "rgba(0,0,0,.10)" : "rgba(255,80,80,.08)",
                          opacity: qtySaving || loading || savingAll ? 0.7 : 1,
                        }}
                        placeholder="MM"
                        inputMode="numeric"
                      />

                      <div style={{ fontWeight: 900, opacity: 0.55 }}>-</div>

                      <input
                        value={r.campaign2_seq}
                        disabled={qtySaving || loading || savingAll}
                        onChange={(e) => setQtyCell(r.tank, "campaign2_seq", only2Digits(e.target.value))}
                        style={{
                          ...qtyInputStyle,
                          width: 54,
                          textAlign: "center",
                          border: ok2DigitsOrEmpty(r.campaign2_seq) && okCamp2 ? "1px solid var(--border)" : "1px solid rgba(255,80,80,.55)",
                          background: ok2DigitsOrEmpty(r.campaign2_seq) && okCamp2 ? "rgba(0,0,0,.10)" : "rgba(255,80,80,.08)",
                          opacity: qtySaving || loading || savingAll ? 0.7 : 1,
                        }}
                        placeholder="##"
                        inputMode="numeric"
                      />
                    </div>

                    {meaningful && !(l1.campComplete || l2.campComplete) ? (
                      <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(255,120,120,.95)" }}>Mínimo 1 campaña completa</div>
                    ) : null}
                  </div>
                </td>

                <td className="capex-td">
                  <div style={{ display: "grid", gap: 8 }}>
                    <input
                      value={r.carbon_kg_1}
                      disabled={qtySaving || loading || savingAll}
                      onChange={(e) => setQtyCell(r.tank, "carbon_kg_1", e.target.value)}
                      style={{
                        ...qtyInputStyle,
                        textAlign: "right",
                        border: okKg1 ? "1px solid var(--border)" : "1px solid rgba(255,80,80,.55)",
                        background: okKg1 ? "rgba(0,0,0,.10)" : "rgba(255,80,80,.08)",
                        opacity: qtySaving || loading || savingAll ? 0.7 : 1,
                      }}
                      placeholder="0.000"
                    />
                    <input
                      value={r.carbon_kg_2}
                      disabled={qtySaving || loading || savingAll}
                      onChange={(e) => setQtyCell(r.tank, "carbon_kg_2", e.target.value)}
                      style={{
                        ...qtyInputStyle,
                        textAlign: "right",
                        border: okKg2 ? "1px solid var(--border)" : "1px solid rgba(255,80,80,.55)",
                        background: okKg2 ? "rgba(0,0,0,.10)" : "rgba(255,80,80,.08)",
                        opacity: qtySaving || loading || savingAll ? 0.7 : 1,
                      }}
                      placeholder="0.000"
                    />
                  </div>
                </td>

                <td className="capex-td">
                  <input
                    value={r.eff_pct_ui}
                    disabled={qtySaving || loading || savingAll}
                    onChange={(e) => setQtyCell(r.tank, "eff_pct_ui", e.target.value)}
                    style={{
                      ...qtyInputStyle,
                      textAlign: "right",
                      border: okEff ? "1px solid var(--border)" : "1px solid rgba(255,80,80,.55)",
                      background: okEff ? "rgba(0,0,0,.10)" : "rgba(255,80,80,.08)",
                      opacity: qtySaving || loading || savingAll ? 0.7 : 1,
                    }}
                    placeholder="0-100"
                  />
                </td>

                <td className="capex-td">
                  <input
                    value={r.cycles}
                    disabled={qtySaving || loading || savingAll}
                    onChange={(e) => setQtyCell(r.tank, "cycles", e.target.value)}
                    style={{
                      ...qtyInputStyle,
                      textAlign: "right",
                      border: okCy ? "1px solid var(--border)" : "1px solid rgba(255,80,80,.55)",
                      background: okCy ? "rgba(0,0,0,.10)" : "rgba(255,80,80,.08)",
                      opacity: qtySaving || loading || savingAll ? 0.7 : 1,
                    }}
                    placeholder="0"
                  />
                </td>

                <td className="capex-td">
  <div style={{ display: "grid", gap: 6 }}>
    <input
      value={r.tank_comment}
      disabled={qtySaving || loading || savingAll}
      onChange={(e) => setQtyCell(r.tank, "tank_comment", String(e.target.value || "").slice(0, COMMENT_MAX))}
      style={{
        ...qtyInputStyle,
        opacity: qtySaving || loading || savingAll ? 0.7 : 1,
      }}
      placeholder="(opcional)"
      maxLength={COMMENT_MAX}
    />

    <div
      className="muted"
      style={{
        fontSize: 11,
        fontWeight: 900,
        textAlign: "right",
        opacity: 0.75,
      }}
    >
      {String(r.tank_comment ?? "").length}/{COMMENT_MAX}
    </div>
  </div>
</td>

              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
