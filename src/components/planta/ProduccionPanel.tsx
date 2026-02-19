// src/components/planta/ProduccionPanel.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

type GuardiaGetResp = {
  ok: boolean;
  shift_id: string;
  header: any | null;
  consumables: { shift_id: string; reagent_name: string; qty: any }[];
  balls: any[];
  duration: any[];
};

function toNumOrNaN(s: string) {
  if (!s) return NaN;
  const t = String(s).trim().replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function toNumOrNull(s: string) {
  const n = toNumOrNaN(s);
  return Number.isFinite(n) ? n : null;
}

function okNonNegOrEmpty(s: string) {
  const t = String(s ?? "").trim();
  if (!t) return true;
  const n = toNumOrNaN(t);
  return Number.isFinite(n) && n >= 0;
}

function okPct1to100OrEmpty(s: string) {
  const t = String(s ?? "").trim();
  if (!t) return true;
  const n = toNumOrNaN(t);
  return Number.isFinite(n) && n >= 1 && n <= 100;
}

function okPh1to14OrEmpty(s: string) {
  const t = String(s ?? "").trim();
  if (!t) return true;
  const n = toNumOrNaN(t);
  return Number.isFinite(n) && n >= 1 && n <= 14;
}

function pctStrToDecimalOrNull(s: string) {
  const t = String(s ?? "").trim();
  if (!t) return null;
  const n = toNumOrNaN(t);
  if (!Number.isFinite(n) || n < 1 || n > 100) return null;
  return n / 100;
}

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

function parseShiftIdToQuery(shift_id: string): { date: string; shift: "A" | "B" } | null {
  const s = String(shift_id || "").trim().toUpperCase();
  const m = s.match(/^(\d{8})-([AB])$/);
  if (!m) return null;
  const ymd = m[1];
  const shift = m[2] as "A" | "B";
  const date = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
  if (!isIsoDate(date)) return null;
  return { date, shift };
}

export default function ProduccionPanel({ shiftId }: { shiftId: string }) {
  const [msg, setMsg] = useState<string | null>(null);

  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);

  const sid = useMemo(() => String(shiftId || "").trim().toUpperCase(), [shiftId]);

  const [densityOf, setDensityOf] = useState("");
  const [pct200, setPct200] = useState("");

  const [nacnOf, setNacnOf] = useState("");
  const [nacnAds, setNacnAds] = useState("");
  const [nacnTail, setNacnTail] = useState("");

  const [phOf, setPhOf] = useState("");
  const [phAds, setPhAds] = useState("");
  const [phTail, setPhTail] = useState("");

  function clearFields() {
    setDensityOf("");
    setPct200("");
    setNacnOf("");
    setNacnAds("");
    setNacnTail("");
    setPhOf("");
    setPhAds("");
    setPhTail("");
  }

  const validNonNeg = okNonNegOrEmpty(densityOf);

  const validPct =
    okPct1to100OrEmpty(pct200) &&
    okPct1to100OrEmpty(nacnOf) &&
    okPct1to100OrEmpty(nacnAds) &&
    okPct1to100OrEmpty(nacnTail);

  const validPh = okPh1to14OrEmpty(phOf) && okPh1to14OrEmpty(phAds) && okPh1to14OrEmpty(phTail);

  const canSave = useMemo(() => !!sid && validNonNeg && validPct && validPh && !saving, [sid, validNonNeg, validPct, validPh, saving]);

  async function loadExisting(nextSid: string) {
    if (!nextSid) return;

    const q = parseShiftIdToQuery(nextSid);
    if (!q) {
      clearFields();
      return;
    }

    setLoadingExisting(true);
    setMsg(null);

    try {
      const r = (await apiGet(
        `/api/planta/guardia/get?date=${encodeURIComponent(q.date)}&shift=${encodeURIComponent(q.shift)}`
      )) as GuardiaGetResp;

      const h = r.header || null;

      clearFields();

      if (h) {
        if (h.density_of !== null && h.density_of !== undefined) setDensityOf(String(h.density_of));

        if (h.pct_200 !== null && h.pct_200 !== undefined) {
          const v = Number(h.pct_200);
          setPct200(Number.isFinite(v) ? String(Math.round(v * 100 * 1000) / 1000) : String(h.pct_200));
        }

        if (h.nacn_of !== null && h.nacn_of !== undefined) {
          const v = Number(h.nacn_of);
          setNacnOf(Number.isFinite(v) ? String(Math.round(v * 100 * 1000) / 1000) : String(h.nacn_of));
        }
        if (h.nacn_ads !== null && h.nacn_ads !== undefined) {
          const v = Number(h.nacn_ads);
          setNacnAds(Number.isFinite(v) ? String(Math.round(v * 100 * 1000) / 1000) : String(h.nacn_ads));
        }
        if (h.nacn_tail !== null && h.nacn_tail !== undefined) {
          const v = Number(h.nacn_tail);
          setNacnTail(Number.isFinite(v) ? String(Math.round(v * 100 * 1000) / 1000) : String(h.nacn_tail));
        }

        if (h.ph_of !== null && h.ph_of !== undefined) setPhOf(String(h.ph_of));
        if (h.ph_ads !== null && h.ph_ads !== undefined) setPhAds(String(h.ph_ads));
        if (h.ph_tail !== null && h.ph_tail !== undefined) setPhTail(String(h.ph_tail));
      }
    } catch {
      // silencioso como estaba
    } finally {
      setLoadingExisting(false);
    }
  }

  useEffect(() => {
    if (!sid) {
      clearFields();
      setMsg(null);
      return;
    }
    loadExisting(sid);
  }, [sid]);

  async function onSave() {
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        shift_id: sid,
        density_of: toNumOrNull(densityOf),
        pct_200: pctStrToDecimalOrNull(pct200),
        nacn_of: pctStrToDecimalOrNull(nacnOf),
        nacn_ads: pctStrToDecimalOrNull(nacnAds),
        nacn_tail: pctStrToDecimalOrNull(nacnTail),
        ph_of: toNumOrNull(phOf),
        ph_ads: toNumOrNull(phAds),
        ph_tail: toNumOrNull(phTail),
      };

      await apiPost("/api/planta/produccion/upsert", payload);
      setMsg(`OK: guardado ${payload.shift_id} · Producción`);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando producción");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 980 }}>
      <div className="panel-inner" style={{ padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Producción</div>

        <div className="muted" style={{ fontWeight: 800, marginLeft: 8 }}>
          Guardia: {sid || "—"}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => sid && loadExisting(sid)}
            disabled={!sid || loadingExisting || saving}
          >
            {loadingExisting ? "Cargando..." : "Refrescar"}
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
        <div style={{ display: "grid", gap: 12 }}>
          {!sid ? (
            <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
              Selecciona una guardia en el page.
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr", alignItems: "start" }}>
            <Input value={densityOf} onChange={(e: any) => setDensityOf(e.target.value)} hint="Densidad (g/l)" />
            <Input value={pct200} onChange={(e: any) => setPct200(e.target.value)} hint="%-m-200 (1-100)" />
            <div />

            <Input value={nacnOf} onChange={(e: any) => setNacnOf(e.target.value)} hint="%NaCN OF (1-100)" />
            <Input value={nacnAds} onChange={(e: any) => setNacnAds(e.target.value)} hint="%NaCN TK1 (1-100)" />
            <Input value={nacnTail} onChange={(e: any) => setNacnTail(e.target.value)} hint="%NaCN TK11 (1-100)" />

            <Input value={phOf} onChange={(e: any) => setPhOf(e.target.value)} hint="PH OF (1-14)" />
            <Input value={phAds} onChange={(e: any) => setPhAds(e.target.value)} hint="PH TK1 (1-14)" />
            <Input value={phTail} onChange={(e: any) => setPhTail(e.target.value)} hint="PH TK11 (1-14)" />
          </div>

          {loadingExisting ? (
            <div className="muted" style={{ fontWeight: 800 }}>
              Cargando datos existentes…
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
