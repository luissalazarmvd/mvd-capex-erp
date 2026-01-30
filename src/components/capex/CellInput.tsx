// src/components/capex/CellInput.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

type Mode = "money" | "pct";

type Props = {
  mode: Mode;
  value: string;
  hint?: string | null;
  placeholder?: string;
  disabled?: boolean;
  onChange: (next: string) => void;
};

function toNumberLoose(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;

  s = s.replace(/\s+/g, "").replace(/[^0-9.,-]/g, "");

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
    s = s.replace(",", ".");
  } else {
    const parts = s.split(".");
    if (parts.length > 2) s = parts.join("");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function roundTo(n: number, dec: number) {
  const f = Math.pow(10, dec);
  return Math.round(n * f) / f;
}

function normalizeNumberInput(raw: string) {
  let s = String(raw ?? "").replace(/\s+/g, "").replace(/[^0-9.,-]/g, "");

  const neg = s.includes("-");
  s = s.replace(/-/g, "");
  if (neg) s = "-" + s;

  const firstSepIdx = s.slice(neg ? 1 : 0).search(/[.,]/);
  if (firstSepIdx >= 0) {
    const i = (neg ? 1 : 0) + firstSepIdx;
    const head = s.slice(0, i + 1);
    const tail = s.slice(i + 1).replace(/[.,]/g, "");
    s = head + tail;
  }

  return s;
}

function clampPct(raw: string) {
  const n = toNumberLoose(raw);
  if (n == null) return raw.trim();

  const clamped = Math.max(0, Math.min(100, n));
  const v = roundTo(clamped, 2);

  const s = String(raw ?? "").trim();
  const hasSep = s.includes(".") || s.includes(",");
  return hasSep ? v.toFixed(2) : String(Math.trunc(v));
}

function fmtMoney(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return (
    "$" +
    v.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function fmtPct(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatHint(mode: Mode, hint: string | null | undefined) {
  const n = toNumberLoose(hint);
  if (n == null) return "";
  if (mode === "pct") return fmtPct(n);
  return fmtMoney(n);
}

function isDirtyValue(mode: Mode, value: string, hint: string | null | undefined) {
  const a = String(value ?? "").trim();
  const b = String(hint ?? "").trim();

  if (!a && !b) return false;
  if (!b) return a.length > 0;

  const na = toNumberLoose(a);
  const nb = toNumberLoose(b);

  if (na != null && nb != null) {
    const dec = mode === "pct" ? 2 : 2;
    return roundTo(na, dec) !== roundTo(nb, dec);
  }

  return a !== b;
}

export function CellInput({ mode, value, hint, placeholder, disabled = false, onChange }: Props) {
  const [local, setLocal] = useState<string>(value ?? "");

  useEffect(() => {
    setLocal(value ?? "");
  }, [value]);

  const isDirty = useMemo(() => isDirtyValue(mode, value ?? "", hint), [mode, value, hint]);

  const hintText = useMemo(() => {
    const f = formatHint(mode, hint);
    return f ? `Prev: ${f}` : "";
  }, [mode, hint]);

  return (
    <div style={{ display: "grid", gap: 4, minWidth: 110 }}>
      <input
        value={local}
        disabled={disabled}
        placeholder={placeholder}
        inputMode="decimal"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          let next = normalizeNumberInput(e.target.value);
          if (mode === "pct") next = clampPct(next);
          setLocal(next);
          onChange(next);
        }}
        style={{
          width: "100%",
          background: disabled ? "rgba(0,0,0,.08)" : "rgba(0,0,0,.14)",
          border: `1px solid ${isDirty ? "rgba(102,199,255,.85)" : "rgba(191,231,255,.22)"}`,
          color: "var(--text)",
          borderRadius: 10,
          padding: "8px 10px",
          outline: "none",
          fontWeight: 800,
          letterSpacing: 0.2,
        }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(102,199,255,.18)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = "none";
        }}
      />

      <div
        className="muted"
        style={{
          fontSize: 12,
          lineHeight: 1.15,
          minHeight: 14,
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          color: "rgba(255,255,255,.86)",
        }}
      >
        <span style={{ fontWeight: 800 }}>{hintText}</span>
        <span style={{ fontWeight: 900, color: "rgba(255,255,255,.92)" }}>{mode === "pct" ? "%" : ""}</span>
      </div>
    </div>
  );
}
