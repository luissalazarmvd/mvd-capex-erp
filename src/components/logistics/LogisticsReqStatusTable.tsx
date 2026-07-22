// src/components/logistics/LogisticsMreqStatusTable.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

type ReqStatusRow = {
  req_item_key: string | null;

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

  cost_center_code: string | null;
  cost_center_desc: string | null;
  glosa_req_1: string | null;
  glosa_req_2: string | null;
  glosa_po_1: string | null;
  glosa_po_2: string | null;
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

  web_comment: string | null;
  web_status: string | null;
  priority_desc: string | null;
};

type GetReqStatusResp = {
  ok: boolean;
  rows?: ReqStatusRow[];
  count?: number;
  error?: string;
};

type SaveReqStatusResp = {
  ok: boolean;
  count?: number;
  error?: string;
};

type WebDraft = {
  web_comment: string;
  web_status: "Activo" | "Anulado";
};

const WEB_STATUS_OPTIONS = ["Activo", "Anulado"] as const;

const columns: { key: keyof ReqStatusRow; label: string; type?: "date" | "num" }[] = [
  { key: "req_item_key", label: "Key RQ" },

  { key: "req_num", label: "RQ" },
  { key: "req_date", label: "F. Req", type: "date" },
  { key: "assign_date", label: "F. Asig.", type: "date" },
  { key: "modified_date", label: "F. Apr.", type: "date" },

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

  { key: "cost_center_code", label: "Cod. Centro Costo" },
  { key: "cost_center_desc", label: "Centro Costo" },
  { key: "glosa_req_1", label: "Glosa RQ 1" },
  { key: "glosa_req_2", label: "Glosa RQ 2" },
  { key: "glosa_po_1", label: "Glosa OC 1" },
  { key: "glosa_po_2", label: "Glosa OC 2" },
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

  { key: "web_comment", label: "Comentario" },
  { key: "web_status", label: "Estado" },
  { key: "priority_desc", label: "Prioridad" },
];

function getStatusColWidth(key: keyof ReqStatusRow) {
  if (key === "req_item_key") return 360;
  if (key === "web_comment") return 180;
  if (
    key === "glosa_req_1" ||
    key === "glosa_req_2" ||
    key === "glosa_po_1" ||
    key === "glosa_po_2"
  ) return 160;
  if (key === "mat_desc" || key === "supplier_name") return 260;
  if (key === "cost_center_desc") return 170;
  if (key === "warehouse_name") return 240;
  if (key === "requester_desc" || key === "requester_area") return 220;
  if (key === "po_est_delivery_date") return 150;
  if (key === "qty_requested" || key === "qty_ordered" || key === "qty_delivered" || key === "qty_approved") return 150;
  if (key === "partial_recep_qty" || key === "cost_center_code" || key === "web_status") return 150;
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

function matchesGlobal(
  row: ReqStatusRow,
  draft: WebDraft | undefined,
  filterValue: string
) {
  const filter = String(filterValue ?? "").trim().toLowerCase();

  if (!filter) return true;

  return columns.some((column) => {
    const value =
      column.key === "web_comment"
        ? draft?.web_comment ?? row.web_comment
        : column.key === "web_status"
          ? draft?.web_status ?? row.web_status
          : row[column.key];

    return String(value ?? "").trim().toLowerCase().includes(filter);
  });
}

function normalizeWebStatus(value: string | null | undefined): "Activo" | "Anulado" {
  return normalizeText(value).toLowerCase() === "anulado" ? "Anulado" : "Activo";
}

function isDraftChanged(current: WebDraft | undefined, original: WebDraft | undefined) {
  if (!current || !original) return false;

  return (
    current.web_comment.trim() !== original.web_comment.trim() ||
    current.web_status !== original.web_status
  );
}

function isDraftReady(current: WebDraft | undefined, original: WebDraft | undefined) {
  if (!current || !original) return false;

  const comment = current.web_comment.trim();

  return (
    original.web_status !== "Anulado" &&
    current.web_status === "Anulado" &&
    comment.length > 0 &&
    comment.length <= 255 &&
    comment !== original.web_comment.trim()
  );
}

export default function LogisticsMreqStatusTable() {
  const [rows, setRows] = useState<ReqStatusRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState<Record<string, WebDraft>>({});
  const [originals, setOriginals] = useState<Record<string, WebDraft>>({});
  const [openStatusKey, setOpenStatusKey] = useState<string | null>(null);
  const [focusedCommentKey, setFocusedCommentKey] = useState<string | null>(null);
  const [selectedReadonlyCellKey, setSelectedReadonlyCellKey] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [responsible, setResponsible] = useState("");
  const [responsibleOpen, setResponsibleOpen] = useState(false);
  const [globalFilter, setGlobalFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 200;

  useEffect(() => {
    let alive = true;

    async function loadData() {
      try {
        setLoading(true);
        setError("");
        setMessage("");

        const data = (await apiGet("/api/logistics/req-status")) as GetReqStatusResp;

        if (!data?.ok) {
          throw new Error(data?.error || "Error al consultar requerimientos");
        }

        const nextRows: ReqStatusRow[] = Array.isArray(data.rows)
          ? data.rows.map((row) => ({
              ...row,
              web_comment: normalizeText(row.web_comment).slice(0, 255),
              web_status: normalizeWebStatus(row.web_status),
            }))
          : [];

        const nextDrafts: Record<string, WebDraft> = {};
        const nextOriginals: Record<string, WebDraft> = {};

        for (const row of nextRows) {
          const key = normalizeText(row.req_item_key);
          if (!key || nextDrafts[key]) continue;

          const draft: WebDraft = {
            web_comment: normalizeText(row.web_comment).slice(0, 255),
            web_status: normalizeWebStatus(row.web_status),
          };

          nextDrafts[key] = { ...draft };
          nextOriginals[key] = { ...draft };
        }

        if (!alive) return;

        setRows(nextRows);
        setDrafts(nextDrafts);
        setOriginals(nextOriginals);
        setOpenStatusKey(null);

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
        const reqItemKey = normalizeText(r.req_item_key);
        const draft = drafts[reqItemKey];

        if (fromDate && reqDate && reqDate < fromDate) return false;
        if (toDate && reqDate && reqDate > toDate) return false;
        if (responsible && rowResponsible !== responsible) return false;
        if (!matchesGlobal(r, draft, globalFilter)) return false;

        return true;
      })
      .sort((a, b) => {
        const keyCompare = normalizeText(a.req_item_key).localeCompare(
          normalizeText(b.req_item_key),
          undefined,
          { numeric: true, sensitivity: "base" }
        );

        if (keyCompare !== 0) return keyCompare;

        return normalizeText(a.po_num).localeCompare(
          normalizeText(b.po_num),
          undefined,
          { numeric: true, sensitivity: "base" }
        );
      });
  }, [rows, drafts, fromDate, toDate, responsible, globalFilter]);

  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate, responsible, globalFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const pageStart = filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, filteredRows.length);

  const editSummary = useMemo(() => {
    const changedKeys = Object.keys(drafts).filter((key) =>
      isDraftChanged(drafts[key], originals[key])
    );

    const invalidKeys = changedKeys.filter(
      (key) => !isDraftReady(drafts[key], originals[key])
    );

    return {
      changedKeys,
      editedCount: changedKeys.length,
      invalidCount: invalidKeys.length,
      canSave: changedKeys.length > 0 && invalidKeys.length === 0,
    };
  }, [drafts, originals]);

  function updateDraft(
    key: string,
    field: keyof WebDraft,
    value: string
  ) {
    if (!key || originals[key]?.web_status === "Anulado") return;

    setDrafts((current) => {
      const draft = current[key] ?? {
        web_comment: "",
        web_status: "Activo" as const,
      };

      return {
        ...current,
        [key]: {
          ...draft,
          [field]:
            field === "web_comment"
              ? value.slice(0, 255)
              : normalizeWebStatus(value),
        },
      };
    });
  }

  async function saveChanges() {
    if (editSummary.editedCount === 0) {
      setMessage("No hay filas editadas para guardar.");
      return;
    }

    if (!editSummary.canSave) {
      setMessage(
        "Para guardar, cada fila editada debe tener un comentario nuevo y cambiar su estado de Activo a Anulado."
      );
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const payloadRows = editSummary.changedKeys.map((key) => ({
        req_item_key: key,
        web_comment: drafts[key].web_comment.trim(),
        web_status: drafts[key].web_status,
      }));

      const response = (await apiPost(
        "/api/logistics/req-status/web",
        { rows: payloadRows }
      )) as SaveReqStatusResp;

      if (!response?.ok) {
        throw new Error(
          response?.error || "No se pudo guardar el estado de los requerimientos."
        );
      }

      const savedKeys = new Set(editSummary.changedKeys);

      setOriginals((current) => {
        const next = { ...current };

        for (const key of savedKeys) {
          next[key] = { ...drafts[key] };
        }

        return next;
      });

      setRows((current) =>
        current.map((row) => {
          const key = normalizeText(row.req_item_key);
          if (!savedKeys.has(key)) return row;

          return {
            ...row,
            web_comment: drafts[key].web_comment.trim(),
            web_status: drafts[key].web_status,
          };
        })
      );

      setOpenStatusKey(null);
      setMessage(`OK: se guardaron ${payloadRows.length} requerimiento(s).`);
    } catch (err) {
      setMessage(
        `ERROR: ${
          err instanceof Error ? err.message : "No se pudo guardar la información."
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  function exportExcel() {
    const data = filteredRows.map((r) => {
      const key = normalizeText(r.req_item_key);
      const draft = drafts[key];

      return {
        req_item_key: r.req_item_key,

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

        cost_center_code: r.cost_center_code,
        cost_center_desc: r.cost_center_desc,
        glosa_req_1: r.glosa_req_1,
        glosa_req_2: r.glosa_req_2,
        glosa_po_1: r.glosa_po_1,
        glosa_po_2: r.glosa_po_2,
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

        web_comment: draft?.web_comment ?? normalizeText(r.web_comment),
        web_status: draft?.web_status ?? normalizeWebStatus(r.web_status),
        priority_desc: r.priority_desc,
      };
    });

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

        <div
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(92, 211, 158, 0.45)",
            background:
              editSummary.editedCount > 0
                ? "rgba(38, 120, 88, 0.24)"
                : "rgba(255,255,255,0.06)",
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          Editadas: {editSummary.editedCount}
        </div>

        {editSummary.invalidCount > 0 ? (
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255, 92, 92, 0.65)",
              background: "rgba(120, 24, 24, 0.28)",
              fontSize: 12,
              fontWeight: 900,
              color: "rgb(255, 170, 170)",
            }}
          >
            Inválidas: {editSummary.invalidCount}
          </div>
        ) : null}

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={saveChanges}
          disabled={loading || saving || !editSummary.canSave}
          style={{ marginLeft: "auto", whiteSpace: "nowrap" }}
        >
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
      <div
        className="panel-inner"
        style={{
          padding: 12,
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(160px, 1fr)) auto",
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

        <label
          style={{
            display: "grid",
            gap: 6,
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          Buscador global
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Buscar RQ, centro de costo, OC, código, material, glosa..."
            style={{
              ...inputStyle,
              minWidth: 320,
            }}
          />
        </label>

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

      {message ? (
        <div
          className="panel-inner"
          style={{
            padding: 12,
            color: message.startsWith("OK")
              ? "rgb(160, 255, 214)"
              : "rgba(255,170,170,0.95)",
            fontWeight: 900,
          }}
        >
          {message}
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
            pagedRows.map((row, idx) => {
              const reqItemKey = normalizeText(row.req_item_key);
              const rowUiKey = `${reqItemKey || "rq"}-${normalizeText(row.po_num) || "po"}-${pageStart + idx}`;
              const draft = drafts[reqItemKey] ?? {
                web_comment: normalizeText(row.web_comment).slice(0, 255),
                web_status: normalizeWebStatus(row.web_status),
              };
              const original = originals[reqItemKey] ?? draft;
              const locked = original.web_status === "Anulado";
              const changed = isDraftChanged(draft, original);
              const ready = isDraftReady(draft, original);
              const rowBackground = locked
                ? "rgba(255,255,255,0.035)"
                : changed
                  ? ready
                    ? "rgba(30, 110, 74, 0.28)"
                    : "rgba(120, 24, 24, 0.34)"
                  : "transparent";

              return (
                <tr
                  key={rowUiKey}
                  className="capex-tr"
                  style={{
                    position: "relative",
                    zIndex:
                      openStatusKey === rowUiKey ||
                      focusedCommentKey === rowUiKey ||
                      selectedReadonlyCellKey?.startsWith(`${rowUiKey}-`)
                        ? 99999
                        : "auto",
                  }}
                >
                  {columns.map((c) => {
                    const value = row[c.key];

                    if (c.key === "web_comment") {
                      const currentValue = draft.web_comment.slice(0, 255);
                      const charCount = currentValue.length;
                      const defaultCommentWidth =
                        getStatusColWidth("web_comment") - 16;
                      const commentEditorWidth =
                        focusedCommentKey === rowUiKey
                          ? Math.max(
                              defaultCommentWidth,
                              Math.min(
                                1800,
                                currentValue.length * 8 + 90
                              )
                            )
                          : defaultCommentWidth;

                      return (
                        <td
                          key={String(c.key)}
                          className="capex-td"
                          style={{
                            background: rowBackground,
                            padding: "6px 8px",
                            whiteSpace: "nowrap",
                            overflow: "visible",
                            position: "relative",
                            zIndex:
                              focusedCommentKey === rowUiKey
                                ? 99999
                                : "auto",
                          }}
                        >
                          {locked ? (
                            currentValue || "—"
                          ) : (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto",
                                alignItems: "center",
                                gap: 8,
                                width: commentEditorWidth,
                                maxWidth: "none",
                                position: "relative",
                                zIndex:
                                  focusedCommentKey === rowUiKey
                                    ? 99999
                                    : "auto",
                                transition: "width 120ms ease",
                              }}
                            >
                              <input
                                type="text"
                                value={currentValue}
                                maxLength={255}
                                disabled={loading || saving || !reqItemKey}
                                onFocus={() =>
                                  setFocusedCommentKey(rowUiKey)
                                }
                                onBlur={() =>
                                  setFocusedCommentKey(null)
                                }
                                onChange={(e) =>
                                  updateDraft(
                                    reqItemKey,
                                    "web_comment",
                                    e.target.value.slice(0, 255)
                                  )
                                }
                                style={{
                                  width: "100%",
                                  minWidth: 0,
                                  background: "rgba(0,0,0,.10)",
                                  border:
                                    changed && !currentValue.trim()
                                      ? "1px solid rgba(255, 92, 92, 0.75)"
                                      : "1px solid var(--border)",
                                  color: "var(--text)",
                                  borderRadius: 10,
                                  padding: "10px 12px",
                                  outline: "none",
                                  fontWeight: 900,
                                  boxSizing: "border-box",
                                }}
                              />

                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 900,
                                  color:
                                    charCount >= 255
                                      ? "rgb(255, 170, 170)"
                                      : "rgba(255,255,255,.65)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {charCount}/255
                              </span>
                            </div>
                          )}
                        </td>
                      );
                    }

                    if (c.key === "web_status") {
                      return (
                        <td
                          key={String(c.key)}
                          className="capex-td"
                          style={{
                            background: rowBackground,
                            padding: "6px 8px",
                            overflow: "visible",
                            position: "relative",
                            zIndex: openStatusKey === rowUiKey ? 9999 : "auto",
                          }}
                        >
                          {locked ? (
                            <span style={{ fontWeight: 900 }}>Anulado</span>
                          ) : (
                            <div style={{ position: "relative" }}>
                              <button
                                type="button"
                                disabled={loading || saving || !reqItemKey}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setOpenStatusKey((current) =>
                                    current === rowUiKey ? null : rowUiKey
                                  );
                                }}
                                style={{
                                  width: "100%",
                                  minWidth: 0,
                                  textAlign: "left",
                                  background: "rgba(0,0,0,.10)",
                                  border: "1px solid var(--border)",
                                  color: "var(--text)",
                                  borderRadius: 10,
                                  padding: "10px 12px",
                                  outline: "none",
                                  fontWeight: 900,
                                  cursor:
                                    loading || saving || !reqItemKey
                                      ? "not-allowed"
                                      : "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 12,
                                }}
                              >
                                <span>{draft.web_status}</span>
                                <span style={{ opacity: 0.8 }}>▾</span>
                              </button>

                              {openStatusKey === rowUiKey ? (
                                <div
                                  style={{
                                    position: "absolute",
                                    top: "calc(100% + 8px)",
                                    left: 0,
                                    zIndex: 99999,
                                    borderRadius: 12,
                                    border: "1px solid rgba(255,255,255,.10)",
                                    background: "rgba(5, 25, 45, .98)",
                                    boxShadow: "0 10px 30px rgba(0,0,0,.45)",
                                    overflow: "hidden",
                                    width: "100%",
                                    minWidth: 150,
                                  }}
                                >
                                  {WEB_STATUS_OPTIONS.map((option) => {
                                    const active = option === draft.web_status;

                                    return (
                                      <button
                                        key={option}
                                        type="button"
                                        className="req-status-dd-option"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          updateDraft(
                                            reqItemKey,
                                            "web_status",
                                            option
                                          );
                                          setOpenStatusKey(null);
                                        }}
                                        style={{
                                          width: "100%",
                                          textAlign: "left",
                                          padding: "10px 12px",
                                          background: active
                                            ? "rgba(102,199,255,.18)"
                                            : "transparent",
                                          color: "rgba(255,255,255,.92)",
                                          border: "none",
                                          cursor: "pointer",
                                          fontWeight: 900,
                                        }}
                                      >
                                        {option}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </td>
                      );
                    }

                    const displayValue =
                      c.type === "date"
                        ? formatDate(value as string | null)
                        : c.type === "num"
                          ? formatNumber(value as number | string | null)
                          : String(value ?? "");

                    const isExpandableReadonly =
                      c.key === "cost_center_desc" ||
                      c.key === "glosa_req_1" ||
                      c.key === "glosa_req_2" ||
                      c.key === "glosa_po_1" ||
                      c.key === "glosa_po_2";

                    const readonlyCellKey = `${rowUiKey}-${String(c.key)}`;
                    const readonlySelected =
                      selectedReadonlyCellKey === readonlyCellKey;

                    const defaultReadonlyWidth =
                      getStatusColWidth(c.key) - 16;

                    const expandedReadonlyWidth =
                      readonlySelected
                        ? Math.max(
                            defaultReadonlyWidth,
                            Math.min(
                              1800,
                              displayValue.length * 8 + 48
                            )
                          )
                        : defaultReadonlyWidth;

                    return (
                      <td
                        key={String(c.key)}
                        className={`capex-td ${c.key === "req_num" ? "capex-td-strong" : ""}`}
                        tabIndex={isExpandableReadonly ? 0 : undefined}
                        onClick={
                          isExpandableReadonly
                            ? (e) => {
                                e.currentTarget.focus();
                                setSelectedReadonlyCellKey(readonlyCellKey);
                              }
                            : undefined
                        }
                        onBlur={
                          isExpandableReadonly
                            ? () => setSelectedReadonlyCellKey(null)
                            : undefined
                        }
                        style={{
                          background: rowBackground,
                          whiteSpace: "nowrap",
                          textAlign: c.type === "num" ? "right" : "left",
                          overflow: isExpandableReadonly ? "visible" : "hidden",
                          position: isExpandableReadonly ? "relative" : undefined,
                          zIndex: readonlySelected ? 99999 : "auto",
                          cursor: isExpandableReadonly ? "pointer" : "default",
                          outline: "none",
                        }}
                      >
                        {isExpandableReadonly ? (
                          <div
                            title={displayValue || "—"}
                            style={{
                              width: expandedReadonlyWidth,
                              minWidth: expandedReadonlyWidth,
                              maxWidth: "none",
                              overflow: "hidden",
                              textOverflow: readonlySelected
                                ? "clip"
                                : "ellipsis",
                              whiteSpace: "nowrap",
                              background: readonlySelected
                                ? "rgb(6, 36, 58)"
                                : "transparent",
                              border: readonlySelected
                                ? "1px solid rgba(191,231,255,0.32)"
                                : "1px solid transparent",
                              borderRadius: readonlySelected ? 8 : 0,
                              boxShadow: readonlySelected
                                ? "0 10px 30px rgba(0,0,0,0.45)"
                                : "none",
                              padding: readonlySelected ? "8px 10px" : 0,
                              boxSizing: "border-box",
                              transition: "width 120ms ease",
                            }}
                          >
                            {displayValue || "—"}
                          </div>
                        ) : (
                          displayValue
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })
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