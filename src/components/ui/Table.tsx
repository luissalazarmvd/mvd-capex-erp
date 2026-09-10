// src/components/ui/Table.tsx
import React from "react";

type Props = {
  children: React.ReactNode;
  stickyHeader?: boolean;
  maxHeight?: number | string;
  disableScrollWrapper?: boolean;
};

export function Table({
  children,
  stickyHeader = true,
  maxHeight,
  disableScrollWrapper = false,
}: Props) {
  const tableNode = (
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
  );

  return (
    <>
      {disableScrollWrapper ? (
        tableNode
      ) : (
        <div
          className="panel-inner"
          style={{
            overflow: "auto",
            maxHeight: maxHeight ?? "unset",
          }}
        >
          {tableNode}
        </div>
      )}

      <style jsx global>{`
        /* head */
        .capex-th {
          position: ${stickyHeader ? "sticky" : "static"};
          top: 0;
          z-index: 2;
          background: var(--s-3);
          color: var(--ink);
          text-align: left;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          border-bottom: 1px solid var(--line-2);
          padding: 9px 10px;
          white-space: nowrap;
        }

        /* cells */
        .capex-td {
          border-bottom: 1px solid var(--line);
          padding: 7px 10px;
          vertical-align: middle;
          color: var(--ink);
        }

        .capex-tr:hover .capex-td {
          background: var(--mod-soft);
        }

        /* first column (WBS / Proyecto) más fuerte */
        .capex-td-strong {
          font-weight: 600;
          color: var(--ink);
          white-space: nowrap;
        }

        /* subtle separators between months */
        .capex-td-sep,
        .capex-th-sep {
          border-left: 1px solid var(--line);
        }
      `}</style>
    </>
  );
}
