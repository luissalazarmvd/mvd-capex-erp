// src/components/planta/ReactivosPanel.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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

function toDecimalStrOrNullFront(v: string, scale = 18) {
  const s0 = String(v ?? "").trim();
  if (!s0) return null;

  let s = s0.replace(/\s+/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    const decSep = lastComma > lastDot ? "," : ".";
    const thouSep = decSep === "," ? "." : ",";
    s = s.split(thouSep).join("");
    if (decSep === ",") s = s.replace(",", ".");
  } else if (hasComma && !hasDot) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length === 3) s = parts.join("");
    else s = s.replace(",", ".");
  } else {
    const parts = s.split(".");
    if (parts.length > 2) s = parts.join("");
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  if (Math.abs(n) > 9e15) return null;

  const f = Math.pow(10, scale);
  const rounded = Math.round(n * f) / f;
  return rounded.toFixed(scale);
}

function qtyOk(v: string) {
  const t = String(v ?? "").trim();
  if (!t) return true;
  return toDecimalStrOrNullFront(v, 18) !== null;
}

function qtyToPayload(v: string) {
  const t = String(v ?? "").trim();
  if (!t) return null;
  return t;
}

function qtyDisplay(v: any) {
  if (v === null || v === undefined || v === "") return "";
  const s = String(v);
  return s.includes("e") || s.includes("E") ? Number(v).toFixed(18) : s;
}

export default function ReactivosPanel({ shiftId }: { shiftId: string }) {
  const [msg, setMsg] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const sid = useMemo(() => String(shiftId || "").trim().toUpperCase(), [shiftId]);

  const [nacn, setNacn] = useState<string>("");
  const [sodaCaustica, setSodaCaustica] = useState<string>("");

  const nacnInvalid = useMemo(() => !qtyOk(nacn), [nacn]);
  const sodaInvalid = useMemo(() => !qtyOk(sodaCaustica), [sodaCaustica]);

  const canSave = useMemo(() => {
    if (!sid || saving || loadingExisting) return false;
    if (nacnInvalid || sodaInvalid) return false;

    const anyFilled = !!String(nacn || "").trim() || !!String(sodaCaustica || "").trim();
    return anyFilled;
  }, [sid, saving, loadingExisting, nacnInvalid, sodaInvalid, nacn, sodaCaustica]);

  function clearFields() {
    setNacn("");
    setSodaCaustica("");
  }

  async function loadExistingForSelectedShift(nextSid: string) {
    const q = parseShiftIdToQuery(nextSid);
    if (!q) return;

    setLoadingExisting(true);
    setMsg(null);

    try {
      const r = (await apiGet(
        `/api/planta/guardia/get?date=${encodeURIComponent(q.date)}&shift=${encodeURIComponent(q.shift)}`
      )) as GuardiaGetResp;

      const cons = Array.isArray(r.consumables) ? r.consumables : [];

      const hitNaCN = cons.find((x) => String(x.reagent_name || "").trim() === "NaCN");
      const hitSoda = cons.find((x) => String(x.reagent_name || "").trim() === "Soda Cáustica");

      setNacn(hitNaCN ? qtyDisplay(hitNaCN.qty) : "");
      setSodaCaustica(hitSoda ? qtyDisplay(hitSoda.qty) : "");
    } catch {
      clearFields();
    } finally {
      setLoadingExisting(false);
    }
  }

  useEffect(() => {
    if (!sid) {
      setMsg(null);
      clearFields();
      return;
    }
    loadExistingForSelectedShift(sid);
  }, [sid]);

  async function onSave() {
    if (!sid) return;

    if (nacnInvalid || sodaInvalid) {
      setMsg("ERROR: corrige valores inválidos.");
      return;
    }

    const items: { reagent_name: string; qty: string }[] = [];

    const nacnPayload = qtyToPayload(nacn);
    const sodaPayload = qtyToPayload(sodaCaustica);

    if (nacnPayload !== null) {
      items.push({
        reagent_name: "NaCN",
        qty: nacnPayload,
      });
    }

    if (sodaPayload !== null) {
      items.push({
        reagent_name: "Soda Cáustica",
        qty: sodaPayload,
      });
    }

    if (!items.length) {
      setMsg("ERROR: Ingresa al menos un valor.");
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      await apiPost("/api/planta/reactivos/upsert", {
        shift_id: sid,
        items,
      });

      setMsg(`OK: guardado ${sid} · Reactivos`);
      await loadExistingForSelectedShift(sid);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando reactivos");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 820 }}>
      <div className="panel-inner" style={{ padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900 }}>Reactivos</div>

        <div className="muted" style={{ fontWeight: 800, marginLeft: 8 }}>
          Guardia: {sid || "—"}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => sid && loadExistingForSelectedShift(sid)}
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
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>NaCN</div>
            <Input
              placeholder="vacío o >= 0"
              value={nacn}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNacn(e.target.value)}
              disabled={!sid || saving || loadingExisting}
              hint="Cantidad (kg)"
              style={nacnInvalid ? { border: "1px solid rgba(255,80,80,.55)", background: "rgba(255,80,80,.10)" } : undefined}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>Soda Cáustica</div>
            <Input
              placeholder="vacío o >= 0"
              value={sodaCaustica}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSodaCaustica(e.target.value)}
              disabled={!sid || saving || loadingExisting}
              hint="Cantidad (kg)"
              style={sodaInvalid ? { border: "1px solid rgba(255,80,80,.55)", background: "rgba(255,80,80,.10)" } : undefined}
            />
          </div>
        </div>

        {!sid ? (
          <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginTop: 12 }}>
            Selecciona una guardia en el page.
          </div>
        ) : null}

        {sid && !loadingExisting && (nacnInvalid || sodaInvalid) ? (
          <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginTop: 12, color: "rgba(255,120,120,.95)" }}>
            Corrige valores inválidos.
          </div>
        ) : null}

        {loadingExisting ? (
          <div className="muted" style={{ fontWeight: 800, marginTop: 12 }}>
            Cargando datos existentes…
          </div>
        ) : null}
      </div>
    </div>
  );
}