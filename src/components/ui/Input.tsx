// src/components/ui/Input.tsx
import React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  hint?: string;
};

export function Input({ hint, style, ...props }: Props) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <input
        {...props}
        className="input"
        style={{
          ...style,
        }}
      />
      {hint ? (
        <div
          className="muted"
          style={{ fontSize: 12, lineHeight: 1.2, paddingLeft: 2 }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}
