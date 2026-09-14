// src/components/ui/Dropdown.tsx
//
// Selector con menú propio (botón + lista), a diferencia de `Select`, que es un
// <select> nativo. Se usa en los formularios de Planta y Refinería.
"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import type { SelectOption } from "./Select";

type Props = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  /** `overlay` flota sobre el contenido; `inline` empuja el layout (útil dentro de acordeones). */
  menu?: "overlay" | "inline";
  /** Alto máximo del menú con scroll interno; sin valor, crece con las opciones. */
  maxMenuHeight?: number;
  buttonStyle?: CSSProperties;
};

const menuSurface: CSSProperties = {
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.10)",
  background: "rgba(6, 77, 121, .98)",
  boxShadow: "0 10px 30px rgba(0,0,0,.45)",
};

export function Dropdown({
  value,
  options,
  onChange,
  label,
  disabled,
  menu = "overlay",
  maxMenuHeight,
  buttonStyle,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const currentLabel =
    options.find((o) => o.value === value)?.label ??
    options.find((o) => o.value === "")?.label ??
    "";

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const items = options.map((o) => {
    const active = o.value === value;
    const isEmpty = o.value === "";
    const restBackground = active ? "rgba(27,147,227,.18)" : "transparent";
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
          background: restBackground,
          color: isEmpty ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.92)",
          border: "none",
          cursor: "pointer",
          fontWeight: 700,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = active ? "rgba(27,147,227,.18)" : "rgba(255,255,255,.06)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = restBackground;
        }}
      >
        {o.label}
      </button>
    );
  });

  return (
    <div style={{ display: "grid", gap: 6 }} ref={wrapRef}>
      {label ? <div style={{ fontWeight: 700, fontSize: 13 }}>{label}</div> : null}

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
          fontWeight: 700,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.7 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          ...buttonStyle,
        }}
      >
        <span style={{ opacity: value ? 1 : 0.6 }}>{currentLabel}</span>
        <span style={{ opacity: 0.8 }}>▾</span>
      </button>

      {open && menu === "inline" ? (
        <div style={{ ...menuSurface, marginTop: 8, overflow: "auto", maxHeight: maxMenuHeight }}>
          {items}
        </div>
      ) : null}

      {open && menu === "overlay" ? (
        <div style={{ position: "relative", zIndex: 50 }}>
          <div
            style={{
              ...menuSurface,
              position: "absolute",
              top: 6,
              left: 0,
              right: 0,
              ...(maxMenuHeight
                ? { maxHeight: maxMenuHeight, overflowY: "auto", overscrollBehavior: "contain" }
                : { overflow: "hidden" }),
            }}
          >
            {items}
          </div>
        </div>
      ) : null}
    </div>
  );
}
