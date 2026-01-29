// src/components/ui/Table.tsx
import React from "react";

type Props = {
  children: React.ReactNode;
  stickyHeader?: boolean;
  maxHeight?: number | string; // para matrices grandes
};

export function Table({ children, stickyHeader = true, maxHeight }: Props) {
  return (
    <div
      className="panel-inner"
      style={{
        overflow: "auto",
        maxHeight: maxHeight ?? "unset",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
          fontSize: 13,
        }}
      >
        {children}
      </table>

      <style jsx global>{`
        /* head */
        .capex-th {
          position: ${stickyHeader ? "sticky" : "static"};
          top: 0;
          z-index: 2;
          background: rgba(0, 0, 0, 0.18);
          color: var(--text);
          text-align: left;
          font-weight: 900;
          border-bottom: 1px solid var(--border);
          padding: 10px 10px;
          white-space: nowrap;
        }

        /* cells */
        .capex-td {
          border-bottom: 1px solid rgba(191, 231, 255, 0.14);
          padding: 8px 10px;
          vertical-align: middle;
        }

        .capex-tr:hover .capex-td {
          background: rgba(0, 0, 0, 0.08);
        }

        /* first column (WBS / Proyecto) más fuerte */
        .capex-td-strong {
          font-weight: 900;
          white-space: nowrap;
        }

        /* subtle separators between months */
        .capex-td-sep,
        .capex-th-sep {
          border-left: 1px solid rgba(191, 231, 255, 0.18);
        }
      `}</style>
    </div>
  );
}
