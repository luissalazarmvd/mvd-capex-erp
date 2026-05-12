// src/components/logistics/LogisticsMreqStatusTable.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

type ReqStatusRow = {
  item_ord: number | null;
  req_num: string | null;
  req_date: string | null;
  assign_date: string | null;
  modified_date: string | null;

  mat_code: string | null;
  mat_desc: string | null;
  mat_unit: string | null;
  mat_group: string | null;
  mat_family: string | null;
  responsible: string | null;

  qty_requested: number | null;
  qty_ordered: number | null;
  qty_delivered: number | null;
  qty_approved: number | null;

  req_status: string | null;

  cost_center_desc: string | null;
  requester_desc: string | null;
  requester_area: string | null;
  office_desc: string | null;

  po_num: string | null;
  supplier_name: string | null;
  po_date: string | null;
  po_unit_price_us: number | null;
  po_status: string | null;
  po_est_delivery_date: string | null;

  delivery_date: string | null;
  partial_recep_qty: number | null;
  ceva: number | null;
  warehouse_dest: number | null;
  warehouse_name: string | null;

  updated_at: string | null;
};

type GetReqStatusResp = {
  ok: boolean;
  rows?: ReqStatusRow[];
  count?: number;
  error?: string;
};

const columns: { key: keyof ReqStatusRow; label: string; type?: "date" | "num" }[] = [
  { key: "item_ord", label: "Item", type: "num" },
  { key: "req_num", label: "RQ" },
  { key: "req_date", label: "F. Req", type: "date" },
  { key: "assign_date", label: "F. Asig.", type: "date" },
  { key: "modified_date", label: "F. Mod.", type: "date" },

  { key: "mat_code", label: "Código" },
  { key: "mat_desc", label: "Material" },
  { key: "mat_unit", label: "Unidad" },
  { key: "mat_group", label: "Grupo" },
  { key: "mat_family", label: "Familia" },
  { key: "responsible", label: "Responsable" },

  { key: "qty_requested", label: "Cant. Solicitada", type: "num" },
  { key: "qty_ordered", label: "Cant. Ordenada", type: "num" },
  { key: "qty_delivered", label: "Cant. Entregada", type: "num" },
  { key: "qty_approved", label: "Cant. Aprobada", type: "num" },

  { key: "req_status", label: "Estado RQ" },

  { key: "cost_center_desc", label: "Centro Costo" },
  { key: "requester_desc", label: "Solicitante" },
  { key: "requester_area", label: "Área Solicitante" },
  { key: "office_desc", label: "Oficina" },

  { key: "po_num", label: "OC" },
  { key: "supplier_name", label: "Proveedor" },
  { key: "po_date", label: "F. OC", type: "date" },
  { key: "po_unit_price_us", label: "PU US$", type: "num" },
  { key: "po_status", label: "Estado OC" },
  { key: "po_est_delivery_date", label: "F. Entrega Est.", type: "date" },

  { key: "delivery_date", label: "F. Entrega", type: "date" },
  { key: "partial_recep_qty", label: "Recep. Parcial", type: "num" },
  { key: "ceva", label: "CEVA", type: "num" },
  { key: "warehouse_dest", label: "Alm. Destino", type: "num" },
  { key: "warehouse_name", label: "Almacén" },
];

function getStatusColWidth(key: keyof ReqStatusRow) {
  if (key === "mat_desc" || key === "supplier_name") return 260;
  if (key === "warehouse_name" || key === "cost_center_desc") return 240;
  if (key === "requester_desc" || key === "requester_area") return 220;
  if (key === "po_est_delivery_date") return 150;
  if (key === "qty_requested" || key === "qty_ordered" || key === "qty_delivered" || key === "qty_approved") return 150;
  if (key === "partial_recep_qty") return 150;
  if (key === "req_num" || key === "mat_code" || key === "po_num") return 120;
  return 130;
}

const STATUS_TABLE_WIDTH = columns.reduce(
  (acc, c) => acc + getStatusColWidth(c.key),
  0
);

function toDateInput(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("es-PE");
}

function formatNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("es-PE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim();
}

export default function LogisticsMreqStatusTable() {
  const [rows, setRows] = useState<ReqStatusRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [responsible, setResponsible] = useState("");
  const [responsibleOpen, setResponsibleOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 200;

  useEffect(() => {
    let alive = true;

    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const data = (await apiGet("/api/logistics/req-status")) as GetReqStatusResp;

        if (!data?.ok) {
        throw new Error(data?.error || "Error al consultar requerimientos");
        }

        const nextRows: ReqStatusRow[] = Array.isArray(data.rows) ? data.rows : [];

        if (!alive) return;

        setRows(nextRows);

        const dates = nextRows
          .map((r) => toDateInput(r.req_date))
          .filter(Boolean)
          .sort();

        if (dates.length > 0) {
          setFromDate(dates[0]);
          setToDate(dates[dates.length - 1]);
        }
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Error inesperado");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadData();

    return () => {
      alive = false;
    };
  }, []);

  const responsibleOptions = useMemo(() => {
    return Array.from(
      new Set(
        rows
          .map((r) => normalizeText(r.responsible))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows
      .filter((r) => {
        const reqDate = toDateInput(r.req_date);
        const rowResponsible = normalizeText(r.responsible);

        if (fromDate && reqDate && reqDate < fromDate) return false;
        if (toDate && reqDate && reqDate > toDate) return false;
        if (responsible && rowResponsible !== responsible) return false;

        return true;
      })
      .sort((a, b) => Number(a.item_ord ?? 0) - Number(b.item_ord ?? 0));
  }, [rows, fromDate, toDate, responsible]);

  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate, responsible]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const pageStart = filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, filteredRows.length);

  function exportExcel() {
    const data = filteredRows.map((r) => ({
      item_ord: r.item_ord,
      req_num: r.req_num,
      req_date: toDateInput(r.req_date),
      assign_date: toDateInput(r.assign_date),
      modified_date: toDateInput(r.modified_date),

      mat_code: r.mat_code,
      mat_desc: r.mat_desc,
      mat_unit: r.mat_unit,
      mat_group: r.mat_group,
      mat_family: r.mat_family,
      responsible: r.responsible,

      qty_requested: r.qty_requested,
      qty_ordered: r.qty_ordered,
      qty_delivered: r.qty_delivered,
      qty_approved: r.qty_approved,

      req_status: r.req_status,

      cost_center_desc: r.cost_center_desc,
      requester_desc: r.requester_desc,
      requester_area: r.requester_area,
      office_desc: r.office_desc,

      po_num: r.po_num,
      supplier_name: r.supplier_name,
      po_date: toDateInput(r.po_date),
      po_unit_price_us: r.po_unit_price_us,
      po_status: r.po_status,
      po_est_delivery_date: toDateInput(r.po_est_delivery_date),

      delivery_date: toDateInput(r.delivery_date),
      partial_recep_qty: r.partial_recep_qty,
      ceva: r.ceva,
      warehouse_dest: r.warehouse_dest,
      warehouse_name: r.warehouse_name,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "req_status");

    const suffixFrom = fromDate || "min";
    const suffixTo = toDate || "max";
    const suffixResponsible = responsible
      ? responsible.replaceAll(" ", "_").replace(/[^\w-]/g, "")
      : "todos";

    XLSX.writeFile(
      wb,
      `logistics_req_status_${suffixFrom}_${suffixTo}_${suffixResponsible}.xlsx`
    );
  }

  return (
    <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
      <div
        className="panel-inner"
        style={{
          padding: "10px 12px",
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        <div style={{ fontWeight: 900 }}>
          Logística · Status de RQ
        </div>
      </div>
      <div
        className="panel-inner"
        style={{
          padding: 12,
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(160px, 1fr)) auto",
          gap: 10,
          alignItems: "end",
        }}
      >
        <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 900 }}>
          Desde
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 900 }}>
          Hasta
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={inputStyle}
          />
        </label>

        <div
          style={{
            display: "grid",
            gap: 6,
            fontSize: 12,
            fontWeight: 900,
            position: "relative",
          }}
        >
          Responsable

          <button
            type="button"
            className="input"
            onClick={(e) => {
              e.stopPropagation();
              setResponsibleOpen((v) => !v);
            }}
            style={{
              width: "100%",
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              textAlign: "left",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            <span>{responsible || "Todos"}</span>
            <span style={{ opacity: 0.8 }}>▾</span>
          </button>

          {responsibleOpen ? (
            <div
              style={{
                position: "absolute",
                top: 68,
                left: 0,
                right: 0,
                zIndex: 20,
                background: "#06192a",
                border: "1px solid rgba(191,231,255,0.22)",
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "0 14px 30px rgba(0,0,0,0.35)",
              }}
            >
              {["", ...responsibleOptions].map((x) => {
                const label = x || "Todos";
                const active = responsible === x;

                return (
                  <button
                    key={label}
                    type="button"
                    className="req-status-dd-option"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setResponsible(x);
                      setResponsibleOpen(false);
                    }}
                    style={{
                      width: "100%",
                      height: 38,
                      padding: "0 12px",
                      border: 0,
                      background: active ? "rgba(102,199,255,0.18)" : "transparent",
                      color: "var(--text)",
                      textAlign: "left",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "grid",
            gap: 2,
            fontSize: 12,
            color: "rgba(255,255,255,0.72)",
            fontWeight: 800,
          }}
        >
          <span>Total: {rows.length.toLocaleString("es-PE")}</span>
          <span>Filtrado: {filteredRows.length.toLocaleString("es-PE")}</span>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={exportExcel}
          disabled={loading || filteredRows.length === 0}
          style={{ whiteSpace: "nowrap" }}
        >
          Exportar Excel
        </Button>
      </div>

      {error ? (
        <div
          className="panel-inner"
          style={{
            padding: 12,
            color: "rgba(255,120,120,0.95)",
            fontWeight: 900,
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        className="panel-inner"
        style={{
          padding: "8px 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.78)" }}>
          Mostrando {pageStart.toLocaleString("es-PE")} - {pageEnd.toLocaleString("es-PE")} de{" "}
          {filteredRows.length.toLocaleString("es-PE")}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            ←
          </Button>

          <div style={{ fontSize: 12, fontWeight: 900 }}>
            Página {currentPage} / {totalPages}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            →
          </Button>
        </div>
      </div>

      <div
        className="panel-inner"
        style={{
          padding: 0,
          minWidth: 0,
          maxWidth: "100%",
          maxHeight: "calc(100vh - 300px)",
          overflow: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ width: `${STATUS_TABLE_WIDTH}px`, minWidth: `${STATUS_TABLE_WIDTH}px` }}>
          <Table stickyHeader disableScrollWrapper>
            <colgroup>
              {columns.map((c) => (
                <col
                  key={String(c.key)}
                  style={{ width: getStatusColWidth(c.key) }}
                />
              ))}
            </colgroup>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={String(c.key)}
                className="capex-th"
                style={{
                  background: "rgb(6, 36, 58)",
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr className="capex-tr">
              <td className="capex-td" colSpan={columns.length}>
                Cargando...
              </td>
            </tr>
          ) : filteredRows.length === 0 ? (
            <tr className="capex-tr">
              <td className="capex-td" colSpan={columns.length}>
                Sin registros.
              </td>
            </tr>
          ) : (
            pagedRows.map((row, idx) => (
              <tr
                key={`${row.req_num || "rq"}-${row.mat_code || "mat"}-${row.po_num || "po"}-${pageStart + idx}`}
                className="capex-tr"
              >
                {columns.map((c) => {
                  const value = row[c.key];

                  return (
                    <td
                      key={String(c.key)}
                      className={`capex-td ${c.key === "req_num" ? "capex-td-strong" : ""}`}
                      style={{
                        whiteSpace: "nowrap",
                        textAlign: c.type === "num" ? "right" : "left",
                      }}
                    >
                      {c.type === "date"
                        ? formatDate(value as string | null)
                        : c.type === "num"
                          ? formatNumber(value as number | string | null)
                          : value ?? ""}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
          </Table>
        </div>
      </div>

      <style jsx global>{`
        .req-status-dd-option:hover {
          background: rgba(102, 199, 255, 0.12) !important;
        }
      `}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 40,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "rgba(0,0,0,.12)",
  color: "var(--text)",
  padding: "0 10px",
  fontWeight: 800,
  outline: "none",
};