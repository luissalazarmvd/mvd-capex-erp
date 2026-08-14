// src/components/traceability/TraceabilityContaForm.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

type NumericValue = number | string | null;

type TraceabilityContaRow = {
  subledger: string | null;
  voucher_number: string | null;
  payment_date: string | null;
  sede: string | null;
  invoice_subledger: string | null;
  invoice_voucher_number: string | null;
  doc_type: string | null;
  doc_number: string | null;
  invoice_reg_date: string | null;
  invoice_doc_date: string | null;
  ruc: string | null;
  supplier: string | null;
  lot: string | null;
  tms: NumericValue;
  currency: string | null;
  lot_usd: NumericValue;
  au_grade_oztc: NumericValue;
  entry_date: string | null;
  concession_name: string | null;
  concession_code: string | null;
  district: string | null;
  province: string | null;
  department: string | null;
  sender_guide_number: string | null;
  transport_name: string | null;
  transport_guide_number: string | null;
};

type GetResp = {
  ok: boolean;
  rows?: TraceabilityContaRow[];
  error?: string;
};

type Column = {
  key: keyof TraceabilityContaRow;
  label: string;
  kind: "text" | "date" | "number";
  width: number;
};

type SortDir = "asc" | "desc";

// El orden de esta lista replica exactamente el SELECT de /api/traceability/conta.
const COLUMNS: Column[] = [
  { key: "subledger", label: "Subdiario", kind: "text", width: 105 },
  { key: "voucher_number", label: "N.º Voucher", kind: "text", width: 125 },
  { key: "payment_date", label: "F. Pago", kind: "date", width: 110 },
  { key: "sede", label: "Sede", kind: "text", width: 110 },
  { key: "invoice_subledger", label: "Subdiario Factura", kind: "text", width: 140 },
  { key: "invoice_voucher_number", label: "N.º Voucher Factura", kind: "text", width: 155 },
  { key: "doc_type", label: "Tipo Documento", kind: "text", width: 125 },
  { key: "doc_number", label: "N.º Documento", kind: "text", width: 135 },
  { key: "invoice_reg_date", label: "F. Registro Factura", kind: "date", width: 145 },
  { key: "invoice_doc_date", label: "F. Documento Factura", kind: "date", width: 160 },
  { key: "ruc", label: "RUC", kind: "text", width: 120 },
  { key: "supplier", label: "Proveedor", kind: "text", width: 220 },
  { key: "lot", label: "Lote", kind: "text", width: 110 },
  { key: "tms", label: "TMS", kind: "number", width: 90 },
  { key: "currency", label: "Moneda", kind: "text", width: 90 },
  { key: "lot_usd", label: "Lote USD", kind: "number", width: 110 },
  { key: "au_grade_oztc", label: "Au (Oz/TC)", kind: "number", width: 105 },
  { key: "entry_date", label: "F. Ingreso", kind: "date", width: 110 },
  { key: "concession_name", label: "Concesión", kind: "text", width: 180 },
  { key: "concession_code", label: "Cód. Concesión", kind: "text", width: 130 },
  { key: "district", label: "Distrito", kind: "text", width: 120 },
  { key: "province", label: "Provincia", kind: "text", width: 120 },
  { key: "department", label: "Departamento", kind: "text", width: 130 },
  { key: "sender_guide_number", label: "Guía Remitente", kind: "text", width: 140 },
  { key: "transport_name", label: "Transportista", kind: "text", width: 180 },
  { key: "transport_guide_number", label: "Guía Transportista", kind: "text", width: 155 },
];

const SEARCHABLE_KEYS = COLUMNS.filter(
  (column) => column.kind !== "number" && column.key !== "payment_date"
).map((column) => column.key);

const PAGE_SIZE = 100;

function normalizeDate(value: unknown) {
  return String(value ?? "").trim().slice(0, 10);
}

function formatDate(value: unknown) {
  const date = normalizeDate(value);
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : date || "—";
}

function formatNumber(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return "—";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 6 }).format(parsed);
}

function formatCell(row: TraceabilityContaRow, column: Column) {
  const value = row[column.key];
  if (column.kind === "date") return formatDate(value);
  if (column.kind === "number") return formatNumber(value);
  return value === null || value === undefined || String(value).trim() === "" ? "—" : String(value);
}

function excelValue(value: unknown, kind: Column["kind"]) {
  if (value === null || value === undefined || String(value).trim() === "") return "";
  if (kind !== "number") return String(value);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : String(value);
}

function isInPaymentDateRange(row: TraceabilityContaRow, from: string, to: string) {
  const paymentDate = normalizeDate(row.payment_date);
  if (!from && !to) return true;
  if (!paymentDate) return false;
  if (from && paymentDate < from) return false;
  if (to && paymentDate > to) return false;
  return true;
}

function matchesGlobalSearch(row: TraceabilityContaRow, search: string) {
  const term = search.trim().toLocaleLowerCase("es");
  if (!term) return true;

  return SEARCHABLE_KEYS.some((key) =>
    String(row[key] ?? "").toLocaleLowerCase("es").includes(term)
  );
}

function compareRowsByColumn(
  a: TraceabilityContaRow,
  b: TraceabilityContaRow,
  column: Column,
  direction: SortDir
) {
  const aValue = a[column.key];
  const bValue = b[column.key];
  const aBlank = aValue === null || aValue === undefined || String(aValue).trim() === "";
  const bBlank = bValue === null || bValue === undefined || String(bValue).trim() === "";

  // Los valores vacíos siempre quedan al final, en ambos sentidos.
  if (aBlank && bBlank) return 0;
  if (aBlank) return 1;
  if (bBlank) return -1;

  let result: number;

  if (column.kind === "number") {
    const aNumber = Number(aValue);
    const bNumber = Number(bValue);
    result = Number.isFinite(aNumber) && Number.isFinite(bNumber)
      ? aNumber - bNumber
      : String(aValue).localeCompare(String(bValue), "es", {
          numeric: true,
          sensitivity: "base",
        });
  } else {
    const aText = column.kind === "date" ? normalizeDate(aValue) : String(aValue).trim();
    const bText = column.kind === "date" ? normalizeDate(bValue) : String(bValue).trim();
    result = aText.localeCompare(bText, "es", {
      numeric: true,
      sensitivity: "base",
    });
  }

  return direction === "asc" ? result : -result;
}

export default function TraceabilityContaForm() {
  const [rows, setRows] = useState<TraceabilityContaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof TraceabilityContaRow>("payment_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = (await apiGet("/api/traceability/conta")) as GetResp;
      setRows(Array.isArray(response.rows) ? response.rows : []);
    } catch (error: unknown) {
      setRows([]);
      setMessage(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, globalSearch, sortKey, sortDir]);

  const paymentDateBounds = useMemo(() => {
    const dates = rows.map((row) => normalizeDate(row.payment_date)).filter(Boolean).sort();
    return {
      min: dates[0] ?? "",
      max: dates[dates.length - 1] ?? "",
    };
  }, [rows]);

  useEffect(() => {
    if (!rows.length) return;
    setDateFrom((current) => current || paymentDateBounds.min);
    setDateTo((current) => current || paymentDateBounds.max);
  }, [rows, paymentDateBounds.min, paymentDateBounds.max]);

  const filteredRows = useMemo(() => {
    const column = COLUMNS.find((item) => item.key === sortKey) ?? COLUMNS[0];
    const matchingRows = rows.filter(
        (row) =>
          isInPaymentDateRange(row, dateFrom, dateTo) &&
          matchesGlobalSearch(row, globalSearch)
      );

    return matchingRows
      .map((row, originalIndex) => ({ row, originalIndex }))
      .sort((a, b) => {
        const result = compareRowsByColumn(a.row, b.row, column, sortDir);
        return result || a.originalIndex - b.originalIndex;
      })
      .map(({ row }) => row);
  }, [rows, dateFrom, dateTo, globalSearch, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const visibleRows = filteredRows.slice(pageStart, pageStart + PAGE_SIZE);

  function onSortClick(key: keyof TraceabilityContaRow) {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDir("asc");
  }

  function getSortIndicator(key: keyof TraceabilityContaRow) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  function exportExcel() {
    if (!filteredRows.length) {
      setMessage("No hay filas para exportar con los filtros seleccionados.");
      return;
    }

    const data = [
      COLUMNS.map((column) => column.label),
      ...filteredRows.map((row) =>
        COLUMNS.map((column) => excelValue(row[column.key], column.kind))
      ),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    worksheet["!cols"] = COLUMNS.map((column) => ({
      wch: Math.max(12, Math.min(32, Math.round(column.width / 8))),
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Lotes Pagados");
    XLSX.writeFile(
      workbook,
      `lotes_pagados_${dateFrom || "inicio"}_${dateTo || "fin"}.xlsx`
    );
  }

  const inputStyle: React.CSSProperties = {
    minWidth: 150,
    height: 34,
    border: "1px solid rgba(216,238,255,.18)",
    background: "rgba(0,0,0,.10)",
    color: "white",
    fontWeight: 800,
    padding: "6px 8px",
    borderRadius: 8,
    outline: "none",
    fontSize: 12,
    boxSizing: "border-box",
  };

  const cellStyle: React.CSSProperties = {
    padding: "7px 8px",
    fontSize: 12,
    lineHeight: "15px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    boxSizing: "border-box",
    borderRight: "1px solid rgba(216,238,255,.08)",
  };

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        minWidth: 0,
        minHeight: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <div
        className="panel-inner"
        style={{
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        <div style={{ fontWeight: 900 }}>Trazabilidad · Lotes Pagados</div>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 8,
            alignItems: "end",
            flexWrap: "wrap",
          }}
        >
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>Fecha de pago desde</span>
            <input
              type="date"
              value={dateFrom}
              min={paymentDateBounds.min || undefined}
              max={dateTo || paymentDateBounds.max || undefined}
              onChange={(event) => setDateFrom(event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>Fecha de pago hasta</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || paymentDateBounds.min || undefined}
              max={paymentDateBounds.max || undefined}
              onChange={(event) => setDateTo(event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>Buscador global</span>
            <input
              type="search"
              value={globalSearch}
              onChange={(event) => setGlobalSearch(event.target.value)}
              placeholder="Lote, documento, sede, RUC, concesión..."
              style={{ ...inputStyle, minWidth: 290 }}
            />
          </label>

          <Button type="button" size="sm" onClick={loadData} disabled={loading}>
            {loading ? "Cargando…" : "Refrescar"}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={exportExcel}
            disabled={loading || filteredRows.length === 0}
          >
            Exportar Excel
          </Button>
        </div>
      </div>

      {message ? (
        <div
          className="panel-inner"
          style={{
            padding: 10,
            flexShrink: 0,
            border: "1px solid rgba(216,93,39,.45)",
            background: "rgba(216,93,39,.10)",
            fontWeight: 800,
          }}
        >
          {message}
        </div>
      ) : null}

      <div
        className="panel-inner"
        style={{
          padding: 0,
          minWidth: 0,
          minHeight: 0,
          width: "100%",
          height: "100%",
          maxHeight: "calc(100vh - 285px)",
          overflow: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ minWidth: "max-content" }}>
          <Table stickyHeader disableScrollWrapper>
            <colgroup>
              {COLUMNS.map((column) => (
                <col
                  key={column.key}
                  style={{
                    width: column.width,
                    minWidth: column.width,
                    maxWidth: column.width,
                  }}
                />
              ))}
            </colgroup>

            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    className="capex-th"
                    onClick={() => onSortClick(column.key)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSortClick(column.key);
                      }
                    }}
                    tabIndex={0}
                    aria-sort={
                      sortKey === column.key
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    title={`Ordenar por ${column.label}`}
                    style={{
                      top: 0,
                      zIndex: 20,
                      background: "rgb(6, 77, 121)",
                      border: "1px solid rgba(216,238,255,.26)",
                      padding: "8px",
                      fontSize: 12,
                      textAlign: column.kind === "number" ? "right" : "left",
                      width: column.width,
                      minWidth: column.width,
                      maxWidth: column.width,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      boxSizing: "border-box",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    {column.label}
                    {getSortIndicator(column.key)}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {visibleRows.map((row, rowIndex) => (
                <tr
                  className="capex-tr"
                  key={`${row.lot ?? "lote"}-${row.doc_number ?? "documento"}-${row.invoice_voucher_number ?? "voucher"}-${pageStart + rowIndex}`}
                >
                  {COLUMNS.map((column) => {
                    const displayValue = formatCell(row, column);
                    return (
                      <td
                        key={column.key}
                        className="capex-td"
                        title={displayValue === "—" ? "" : displayValue}
                        style={{
                          ...cellStyle,
                          background:
                            (pageStart + rowIndex) % 2 === 0
                              ? "rgba(255,255,255,.035)"
                              : "rgba(255,255,255,.07)",
                          textAlign: column.kind === "number" ? "right" : "left",
                          width: column.width,
                          minWidth: column.width,
                          maxWidth: column.width,
                        }}
                      >
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {!loading && visibleRows.length === 0 ? (
                <tr className="capex-tr">
                  <td className="capex-td" colSpan={COLUMNS.length} style={{ ...cellStyle, fontWeight: 900 }}>
                    No hay lotes pagados para los filtros seleccionados.
                  </td>
                </tr>
              ) : null}

              {loading ? (
                <tr className="capex-tr">
                  <td className="capex-td" colSpan={COLUMNS.length} style={{ ...cellStyle, fontWeight: 900 }}>
                    Cargando lotes pagados…
                  </td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </div>

      <div
        className="panel-inner"
        style={{
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9 }}>
          Mostrando {filteredRows.length === 0 ? 0 : pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredRows.length)} de {filteredRows.length} filas
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button
            type="button"
            size="sm"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={loading || safePage <= 1}
            aria-label="Página anterior"
          >
            ←
          </Button>

          <div
            style={{
              minWidth: 90,
              textAlign: "center",
              fontSize: 12,
              fontWeight: 900,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(255,255,255,.06)",
              border: "1px solid rgba(216,238,255,.18)",
            }}
          >
            Página {safePage} / {totalPages}
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={loading || safePage >= totalPages}
            aria-label="Página siguiente"
          >
            →
          </Button>
        </div>
      </div>
    </div>
  );
}
