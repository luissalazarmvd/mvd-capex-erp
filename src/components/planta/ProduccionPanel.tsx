// src/components/planta/ProduccionPanel.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

type UpsertResp = { ok: boolean; error?: string };

type FactsHeader = {
  density_of?: any;
  pct_200?: any;
};

function toNumOrNaN(s: string) {
  if (s === null || s === undefined) return NaN;
  const t = String(s).trim().replace(",", ".");
  if (!t) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function toTextNum(v: any) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? String(n) : "";
}

function isShiftId(s: string) {
  return /^\d{8}-[AB]$/.test(String(s || "").trim().toUpperCase());
}

function parseShiftIdToQuery(shift_id: string): { date: string; shift: "A" | "B" } | null {
  const s = String(shift_id || "").trim().toUpperCase();
  const m = s.match(/^(\d{8})-([AB])$/);
  if (!m) return null;
  const ymd = m[1];
  const shift = m[2] as "A" | "B";
  const date = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
  return { date, shift };
}

function validateDensityUi(s: string): boolean {
  const t = String(s ?? "").trim();
  if (!t) return true;
  const n = toNumOrNaN(t);
  if (!Number.isFinite(n)) return false;
  if (n === 0) return true;
  return n >= 0;
}

function validatePctUi(s: string): boolean {
  const t = String(s ?? "").trim();
  if (!t) return true;
  const n = toNumOrNaN(t);
  if (!Number.isFinite(n)) return false;
  if (n === 0) return true;
  return n >= 1 && n <= 100;
}

function densityUiToDbOrNull(s: string): number | null {
  const t = String(s ?? "").trim();
  if (!t) return null;
  const n = toNumOrNaN(t);
  if (!Number.isFinite(n)) return NaN;
  if (n === 0) return 0;
  if (n < 0) return NaN;
  return n;
}

function pctUiToDbOrNull(s: string): number | null {
  const t = String(s ?? "").trim();
  if (!t) return null;
  const n = toNumOrNaN(t);
  if (!Number.isFinite(n)) return NaN;
  if (n === 0) return null;
  if (n < 1 || n > 100) return NaN;
  return n / 100;
}

export default function ProduccionPanel({ shiftId }: { shiftId: string; facts?: FactsHeader | null }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);

  const sid = useMemo(() => String(shiftId || "").trim().toUpperCase(), [shiftId]);

  const [densityOf, setDensityOf] = useState<string>("");
  const [pct200, setPct200] = useState<string>("");

  const densityInvalid = useMemo(() => !validateDensityUi(densityOf), [densityOf]);
  const pct200Invalid = useMemo(() => !validatePctUi(pct200), [pct200]);

  const allValid = useMemo(() => {
    if (!sid || !isShiftId(sid)) return false;
    return !densityInvalid && !pct200Invalid;
  }, [sid, densityInvalid, pct200Invalid]);

  const canSave = useMemo(() => allValid && !saving && !loadingExisting, [allValid, saving, loadingExisting]);

  function clearAll() {
    setDensityOf("");
    setPct200("");
  }

  async function loadExisting(nextSid: string, opts?: { silentMsg?: boolean }) {
    if (!nextSid || !isShiftId(nextSid)) {
      clearAll();
      return;
    }

    const q = parseShiftIdToQuery(nextSid);
    if (!q) {
      clearAll();
      return;
    }

    setLoadingExisting(true);
    if (!opts?.silentMsg) setMsg(null);

    try {
      const r = (await apiGet(
        `/api/planta/guardia/get?date=${encodeURIComponent(q.date)}&shift=${encodeURIComponent(q.shift)}`
      )) as any;

      const h: FactsHeader = (r?.header as any) || {};

      setDensityOf(toTextNum(h.density_of));
      setPct200(
        h.pct_200 === null || h.pct_200 === undefined || h.pct_200 === ""
          ? ""
          : toTextNum(Number(h.pct_200) * 100)
      );
    } catch (e: any) {
      clearAll();
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando producción");
    } finally {
      setLoadingExisting(false);
    }
  }

  useEffect(() => {
    if (!sid) {
      clearAll();
      setMsg(null);
      return;
    }
    loadExisting(sid);
  }, [sid]);

  async function onSave() {
    if (!sid || !isShiftId(sid)) {
      setMsg("ERROR: shift_id inválido");
      return;
    }

    if (!allValid) {
      setMsg("ERROR: corrige valores inválidos.");
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      const densityDb = densityUiToDbOrNull(densityOf);
      const pct200Db = pctUiToDbOrNull(pct200);

      if (Number.isNaN(densityDb as number) || Number.isNaN(pct200Db as number)) {
        setMsg("ERROR: corrige valores inválidos.");
        return;
      }

      const payloadFacts = {
        shift_id: sid,
        density_of: densityDb,
        pct_200: pct200Db,
      };

      const rr = (await apiPost("/api/planta/produccion/upsert", payloadFacts)) as UpsertResp;
      if (!rr?.ok) throw new Error(rr?.error || "Error guardando producción");

      await loadExisting(sid, { silentMsg: true });

      setMsg(`OK: guardado ${sid} · Producción`);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando producción");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
      <div className="panel-inner" style={{ padding: "10px 12px", display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Producción</div>

        <div className="muted" style={{ fontWeight: 800, marginLeft: 8 }}>
          Guardia: {sid || "—"}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={() => sid && loadExisting(sid)}
            disabled={!sid || loadingExisting || saving}
          >
            {loadingExisting ? "Cargando…" : "Refrescar"}
          </Button>
          <Button type="button" size="sm" variant="primary" onClick={onSave} disabled={!canSave}>
            {saving ? "Guardando…" : "Guardar"}
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

      <div className="panel-inner" style={{ padding: 14 }}>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>Densidad (g/l)</div>
            <Input
              placeholder="vacío o >= 0"
              value={densityOf}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDensityOf(e.target.value)}
              disabled={!sid || saving || loadingExisting}
              hint=""
              style={densityInvalid ? { border: "1px solid rgba(255,80,80,.55)", background: "rgba(255,80,80,.10)" } : undefined}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>%-m-200 (1-100)</div>
            <Input
              placeholder="vacío, 0 o 1-100"
              value={pct200}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPct200(e.target.value)}
              disabled={!sid || saving || loadingExisting}
              hint=""
              style={pct200Invalid ? { border: "1px solid rgba(255,80,80,.55)", background: "rgba(255,80,80,.10)" } : undefined}
            />
          </div>
        </div>

        {!sid ? (
          <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginTop: 12 }}>
            Selecciona una guardia en el page.
          </div>
        ) : null}

        {sid && !loadingExisting && !allValid ? (
          <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginTop: 12, color: "rgba(255,120,120,.95)" }}>
            Corrige valores inválidos.
          </div>
        ) : null}

        {loadingExisting ? (
          <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginTop: 12 }}>
            Cargando datos existentes…
          </div>
        ) : null}
      </div>
    </div>
  );
}