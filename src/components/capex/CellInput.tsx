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

function normalizeNumberInput(raw: string) {
  return raw.replace(/[^\d\.\-]/g, "");
}

function clampPct(raw: string) {
  const s = raw.trim();
  if (!s) return s;
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  const clamped = Math.max(0, Math.min(100, n));
  // no forzar decimales; conservar “look” simple
  return String(clamped);
}

export function CellInput({
  mode,
  value,
  hint,
  placeholder,
  disabled = false,
  onChange,
}: Props) {
  const [local, setLocal] = useState<string>(value ?? "");

  useEffect(() => {
    setLocal(value ?? "");
  }, [value]);

  const isDirty = useMemo(() => {
    const a = (value ?? "").trim();
    const b = (hint ?? "").trim();
    if (!b) return a.length > 0;
    return a !== b;
  }, [value, hint]);

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
          border: `1px solid ${
            isDirty ? "rgba(102,199,255,.85)" : "rgba(191,231,255,.22)"
          }`,
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
          fontSize: 11,
          lineHeight: 1.1,
          minHeight: 12,
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span>{hint ? `Prev: ${hint}` : ""}</span>
        <span style={{ fontWeight: 900 }}>{mode === "pct" ? "%" : ""}</span>
      </div>
    </div>
  );
}
