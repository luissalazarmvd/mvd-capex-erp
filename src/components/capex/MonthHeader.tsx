// src/components/capex/MonthHeader.tsx
"use client";

import React from "react";

type Props = {
  label: string;
  sublabel?: string;
  double?: boolean;
};

export function MonthHeader({ label, sublabel, double }: Props) {
  return (
    <div style={{ display: "grid", gap: 2, minWidth: double ? 240 : 120 }}>
      <div style={{ fontWeight: 900, letterSpacing: 0.2 }}>{label}</div>
      {sublabel ? (
        <div className="muted" style={{ fontSize: 11, fontWeight: 800 }}>
          {sublabel}
        </div>
      ) : (
        <div style={{ height: 12 }} />
      )}
    </div>
  );
}
