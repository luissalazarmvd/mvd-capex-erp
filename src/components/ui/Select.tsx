// src/components/ui/Select.tsx
import React from "react";

export type SelectOption = { value: string; label: string };

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  options: SelectOption[];
  placeholder?: string;
  hint?: string;
};

export function Select({
  label,
  options,
  placeholder = "Selecciona…",
  hint,
  style,
  ...props
}: Props) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {label ? (
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)" }}>
          {label}
        </div>
      ) : null}

      <select {...props} className="select" style={{ ...style }}>
        {placeholder ? (
          <option value="" disabled={false}>
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {hint ? (
        <div
          className="muted"
          style={{ fontSize: 12, lineHeight: 1.2, paddingLeft: 2 }}
        >
          {hint}
        </div>
      ) : null}

      {/* mejora visual del dropdown en algunos browsers */}
      <style jsx>{`
        select.select {
          appearance: none;
          background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%),
            linear-gradient(135deg, var(--muted) 50%, transparent 50%);
          background-position: calc(100% - 18px) calc(50% - 3px),
            calc(100% - 12px) calc(50% - 3px);
          background-size: 6px 6px, 6px 6px;
          background-repeat: no-repeat;
          padding-right: 34px;
        }
      `}</style>
    </div>
  );
}
