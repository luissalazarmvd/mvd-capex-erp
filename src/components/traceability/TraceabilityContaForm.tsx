// src/components/traceability/TraceabilityContaForm.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Table } from "../ui/Table";

type NumericValue = number | string | null;

type TraceabilityContaRow = {
  subledger: string | null;
  voucher_number: string | null;
  payment_date: string | null;
  office_name: string | null;
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
  pay_usd: NumericValue;
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

type TraceabilityTargetRow = {
  office_name: string | null;
  target_tms: NumericValue;
  target_lot_usd: NumericValue;
  target_period: string | null;
};

type TargetGetResp = {
  ok: boolean;
  rows?: TraceabilityTargetRow[];
  error?: string;
};

type EditableTargetRow = {
  office_name: string;
  target_tms: string;
  target_lot_usd: string;
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
  { key: "office_name", label: "Oficina", kind: "text", width: 110 },
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
  { key: "pay_usd", label: "Pago USD", kind: "number", width: 110 },
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
const FIRST_TARGET_YEAR = 2026;
const FIRST_TARGET_MONTH = 8;
const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Setiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const TARGET_NUMBER_FORMAT = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 6,
});

function currentTargetPeriod() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  if (
    currentYear < FIRST_TARGET_YEAR ||
    (currentYear === FIRST_TARGET_YEAR && currentMonth < FIRST_TARGET_MONTH)
  ) {
    return { year: FIRST_TARGET_YEAR, month: FIRST_TARGET_MONTH };
  }

  return { year: currentYear, month: currentMonth };
}

function targetPeriodEnd(year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

function targetValueToInput(value: NumericValue) {
  if (value === null || value === undefined || String(value).trim() === "") return "";
  return String(value);
}

function parseTargetValue(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,12}(?:\.\d{1,6})?$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatTargetNumber(value: number) {
  return TARGET_NUMBER_FORMAT.format(value);
}

function formatTargetUsdInput(value: string) {
  const parsed = parseTargetValue(value);
  return parsed === null ? value : `$${formatTargetNumber(parsed)}`;
}

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
  const initialTargetPeriod = currentTargetPeriod();
  const [rows, setRows] = useState<TraceabilityContaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof TraceabilityContaRow>("payment_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [targetPreviewOpen, setTargetPreviewOpen] = useState(false);
  const [targetLoading, setTargetLoading] = useState(false);
  const [targetSaving, setTargetSaving] = useState(false);
  const [targetMessage, setTargetMessage] = useState<string | null>(null);
  const [targetMessageKind, setTargetMessageKind] = useState<"error" | "success">("error");
  const [targetHistory, setTargetHistory] = useState<TraceabilityTargetRow[]>([]);
  const [targetRows, setTargetRows] = useState<EditableTargetRow[]>([]);
  const [focusedTargetLotUsdOffice, setFocusedTargetLotUsdOffice] = useState<string | null>(null);
  const [targetYear, setTargetYear] = useState(initialTargetPeriod.year);
  const [targetMonth, setTargetMonth] = useState(initialTargetPeriod.month);

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

  const selectableTargetPeriods = useMemo(() => {
    const current = currentTargetPeriod();
    const periods: Array<{ year: number; month: number }> = [];

    for (let year = FIRST_TARGET_YEAR; year <= current.year; year += 1) {
      const firstMonth = year === FIRST_TARGET_YEAR ? FIRST_TARGET_MONTH : 1;
      const lastMonth = year === current.year ? current.month : 12;
      for (let month = firstMonth; month <= lastMonth; month += 1) {
        periods.push({ year, month });
      }
    }

    return periods;
  }, []);

  const targetYearOptions = useMemo(
    () =>
      Array.from(new Set(selectableTargetPeriods.map((period) => period.year))).map((year) => ({
        value: String(year),
        label: String(year),
      })),
    [selectableTargetPeriods]
  );

  const targetMonthOptions = useMemo(
    () =>
      selectableTargetPeriods
        .filter((period) => period.year === targetYear)
        .map((period) => ({
          value: String(period.month),
          label: MONTH_NAMES[period.month - 1],
        })),
    [selectableTargetPeriods, targetYear]
  );

  const selectedTargetPeriod = targetPeriodEnd(targetYear, targetMonth);

  useEffect(() => {
    if (!targetPreviewOpen) return;

    const offices = Array.from(
      new Set(
        targetHistory
          .map((row) => String(row.office_name ?? "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

    const rowsByOffice = new Map<string, TraceabilityTargetRow>();
    targetHistory.forEach((row) => {
      const officeName = String(row.office_name ?? "").trim();
      if (officeName && normalizeDate(row.target_period) === selectedTargetPeriod) {
        rowsByOffice.set(officeName, row);
      }
    });

    setTargetRows(
      offices.map((officeName) => {
        const row = rowsByOffice.get(officeName);
        return {
          office_name: officeName,
          target_tms: targetValueToInput(row?.target_tms ?? null),
          target_lot_usd: targetValueToInput(row?.target_lot_usd ?? null),
        };
      })
    );
  }, [selectedTargetPeriod, targetHistory, targetPreviewOpen]);

  async function loadTargetHistory() {
    setTargetLoading(true);
    setTargetMessage(null);

    try {
      const response = (await apiGet("/api/traceability/conta/target")) as TargetGetResp;
      setTargetHistory(Array.isArray(response.rows) ? response.rows : []);
    } catch (error: unknown) {
      setTargetHistory([]);
      setTargetMessageKind("error");
      setTargetMessage(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTargetLoading(false);
    }
  }

  function openTargetPreview() {
    const current = currentTargetPeriod();
    setTargetYear(current.year);
    setTargetMonth(current.month);
    setTargetHistory([]);
    setTargetRows([]);
    setFocusedTargetLotUsdOffice(null);
    setTargetMessage(null);
    setTargetPreviewOpen(true);
    void loadTargetHistory();
  }

  function closeTargetPreview() {
    if (targetSaving) return;
    setTargetPreviewOpen(false);
  }

  function changeTargetYear(value: string) {
    const year = Number(value);
    const months = selectableTargetPeriods.filter((period) => period.year === year);
    setTargetYear(year);
    setTargetMonth(months[months.length - 1]?.month ?? FIRST_TARGET_MONTH);
    setTargetMessage(null);
  }

  function changeTargetMonth(value: string) {
    setTargetMonth(Number(value));
    setTargetMessage(null);
  }

  function editTarget(
    officeName: string,
    field: "target_tms" | "target_lot_usd",
    value: string
  ) {
    setTargetRows((current) =>
      current.map((row) =>
        row.office_name === officeName ? { ...row, [field]: value } : row
      )
    );
    setTargetMessage(null);
  }

  const targetsAreValid =
    targetRows.length > 0 &&
    targetRows.every(
      (row) =>
        parseTargetValue(row.target_tms) !== null &&
        parseTargetValue(row.target_lot_usd) !== null
    );

  const targetTotals = useMemo(() => {
    let targetTms = 0;
    let targetLotUsd = 0;
    let targetTmsValid = targetRows.length > 0;
    let targetLotUsdValid = targetRows.length > 0;

    targetRows.forEach((row) => {
      const parsedTms = parseTargetValue(row.target_tms);
      const parsedLotUsd = parseTargetValue(row.target_lot_usd);

      if (parsedTms === null) targetTmsValid = false;
      else targetTms += parsedTms;

      if (parsedLotUsd === null) targetLotUsdValid = false;
      else targetLotUsd += parsedLotUsd;
    });

    return { targetTms, targetLotUsd, targetTmsValid, targetLotUsdValid };
  }, [targetRows]);

  async function saveTargets() {
    if (!targetsAreValid || targetSaving) return;

    setTargetSaving(true);
    setTargetMessage(null);

    try {
      await Promise.all(
        targetRows.map(async (row) => {
          try {
            await apiPost("/api/traceability/conta/target/insert", {
              office_name: row.office_name,
              target_tms: parseTargetValue(row.target_tms),
              target_lot_usd: parseTargetValue(row.target_lot_usd),
              target_period: selectedTargetPeriod,
            });
          } catch (error: unknown) {
            throw new Error(
              `${row.office_name}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        })
      );

      setTargetMessageKind("success");
      setTargetMessage(
        `Targets de ${MONTH_NAMES[targetMonth - 1]} ${targetYear} guardados para ${targetRows.length} oficinas.`
      );
    } catch (error: unknown) {
      setTargetMessageKind("error");
      setTargetMessage(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTargetSaving(false);
    }
  }

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

          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={openTargetPreview}
          >
            Actualizar Target
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

      {targetPreviewOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="target-preview-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            className="panel-inner"
            style={{
              width: "min(900px, 96vw)",
              height: "min(84vh, 760px)",
              display: "grid",
              gridTemplateRows: "auto auto auto 1fr auto",
              gap: 12,
              padding: 14,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div id="target-preview-title" style={{ fontSize: 18, fontWeight: 900 }}>
                  Actualizar Target
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Edita los targets de todas las oficinas para el periodo seleccionado.
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={closeTargetPreview}
                disabled={targetSaving}
              >
                Cerrar
              </Button>
            </div>

            <div style={{ display: "flex", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 150 }}>
                <Select
                  label="Año"
                  placeholder=""
                  value={String(targetYear)}
                  onChange={(event) => changeTargetYear(event.target.value)}
                  options={targetYearOptions}
                  disabled={targetLoading || targetSaving}
                />
              </div>

              <div style={{ minWidth: 180 }}>
                <Select
                  label="Mes"
                  placeholder=""
                  value={String(targetMonth)}
                  onChange={(event) => changeTargetMonth(event.target.value)}
                  options={targetMonthOptions}
                  disabled={targetLoading || targetSaving}
                />
              </div>

              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(27,147,227,.45)",
                  background: "rgba(27,147,227,.10)",
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                Periodo target: {formatDate(selectedTargetPeriod)}
              </div>
            </div>

            {targetMessage ? (
              <div
                role={targetMessageKind === "error" ? "alert" : "status"}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border:
                    targetMessageKind === "error"
                      ? "1px solid rgba(216,93,39,.45)"
                      : "1px solid rgba(62,180,137,.45)",
                  background:
                    targetMessageKind === "error"
                      ? "rgba(216,93,39,.10)"
                      : "rgba(62,180,137,.10)",
                  fontWeight: 800,
                }}
              >
                {targetMessage}
              </div>
            ) : (
              <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>
                Se aceptan números positivos o cero, con hasta 6 decimales. Todos los campos son obligatorios.
              </div>
            )}

            <div
              style={{
                minWidth: 0,
                minHeight: 0,
                overflow: "auto",
                border: "1px solid rgba(216,238,255,.12)",
                borderRadius: 12,
              }}
            >
              <Table stickyHeader disableScrollWrapper>
                <thead>
                  <tr>
                    <th
                      className="capex-th"
                      style={{ top: 0, zIndex: 20, background: "rgb(6, 77, 121)", padding: 9 }}
                    >
                      Oficina
                    </th>
                    <th
                      className="capex-th"
                      style={{ top: 0, zIndex: 20, background: "rgb(6, 77, 121)", padding: 9 }}
                    >
                      Target TMS
                    </th>
                    <th
                      className="capex-th"
                      style={{ top: 0, zIndex: 20, background: "rgb(6, 77, 121)", padding: 9 }}
                    >
                      Target lote USD
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {targetRows.map((row, rowIndex) => {
                    const tmsValid = parseTargetValue(row.target_tms) !== null;
                    const lotUsdValid = parseTargetValue(row.target_lot_usd) !== null;
                    const rowBackground =
                      rowIndex % 2 === 0 ? "rgba(255,255,255,.035)" : "rgba(255,255,255,.07)";

                    return (
                      <tr className="capex-tr" key={row.office_name}>
                        <td
                          className="capex-td"
                          style={{ ...cellStyle, background: rowBackground, fontWeight: 900 }}
                        >
                          {row.office_name}
                        </td>
                        <td className="capex-td" style={{ ...cellStyle, background: rowBackground }}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.target_tms}
                            onChange={(event) =>
                              editTarget(row.office_name, "target_tms", event.target.value)
                            }
                            disabled={targetSaving}
                            aria-invalid={!tmsValid}
                            title={tmsValid ? "" : "Ingresa un número válido con hasta 6 decimales"}
                            style={{
                              ...inputStyle,
                              minWidth: 180,
                              width: "100%",
                              borderColor: tmsValid
                                ? "rgba(216,238,255,.18)"
                                : "rgba(216,93,39,.85)",
                              background: tmsValid ? "rgba(0,0,0,.10)" : "rgba(216,93,39,.12)",
                            }}
                          />
                        </td>
                        <td className="capex-td" style={{ ...cellStyle, background: rowBackground }}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              focusedTargetLotUsdOffice === row.office_name
                                ? row.target_lot_usd
                                : formatTargetUsdInput(row.target_lot_usd)
                            }
                            onFocus={() => setFocusedTargetLotUsdOffice(row.office_name)}
                            onBlur={() => setFocusedTargetLotUsdOffice(null)}
                            onChange={(event) =>
                              editTarget(row.office_name, "target_lot_usd", event.target.value)
                            }
                            disabled={targetSaving}
                            aria-invalid={!lotUsdValid}
                            title={lotUsdValid ? "" : "Ingresa un número válido con hasta 6 decimales"}
                            style={{
                              ...inputStyle,
                              minWidth: 180,
                              width: "100%",
                              borderColor: lotUsdValid
                                ? "rgba(216,238,255,.18)"
                                : "rgba(216,93,39,.85)",
                              background: lotUsdValid ? "rgba(0,0,0,.10)" : "rgba(216,93,39,.12)",
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}

                  {targetLoading ? (
                    <tr className="capex-tr">
                      <td className="capex-td" colSpan={3} style={{ ...cellStyle, fontWeight: 900 }}>
                        Cargando targets…
                      </td>
                    </tr>
                  ) : null}

                  {!targetLoading && targetRows.length === 0 ? (
                    <tr className="capex-tr">
                      <td className="capex-td" colSpan={3} style={{ ...cellStyle, fontWeight: 900 }}>
                        No se encontraron oficinas en el historial de targets.
                      </td>
                    </tr>
                  ) : null}
                </tbody>

                {!targetLoading && targetRows.length > 0 ? (
                  <tfoot>
                    <tr>
                      <td
                        className="capex-td"
                        style={{
                          ...cellStyle,
                          position: "sticky",
                          bottom: 0,
                          zIndex: 10,
                          background: "rgb(6, 77, 121)",
                          fontWeight: 900,
                          borderTop: "2px solid rgba(216,238,255,.35)",
                        }}
                      >
                        TOTAL
                      </td>
                      <td
                        className="capex-td"
                        style={{
                          ...cellStyle,
                          position: "sticky",
                          bottom: 0,
                          zIndex: 10,
                          background: "rgb(6, 77, 121)",
                          fontWeight: 900,
                          borderTop: "2px solid rgba(216,238,255,.35)",
                          textAlign: "right",
                        }}
                      >
                        {targetTotals.targetTmsValid
                          ? formatTargetNumber(targetTotals.targetTms)
                          : "—"}
                      </td>
                      <td
                        className="capex-td"
                        style={{
                          ...cellStyle,
                          position: "sticky",
                          bottom: 0,
                          zIndex: 10,
                          background: "rgb(6, 77, 121)",
                          fontWeight: 900,
                          borderTop: "2px solid rgba(216,238,255,.35)",
                          textAlign: "right",
                        }}
                      >
                        {targetTotals.targetLotUsdValid
                          ? `$${formatTargetNumber(targetTotals.targetLotUsd)}`
                          : "—"}
                      </td>
                    </tr>
                  </tfoot>
                ) : null}
              </Table>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9 }}>
                {!targetRows.length
                  ? "Carga las oficinas para poder guardar."
                  : targetsAreValid
                    ? `Se guardarán ${targetRows.length} oficinas para ${formatDate(selectedTargetPeriod)}.`
                    : "Completa o corrige los valores resaltados para habilitar Guardar."}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={closeTargetPreview}
                  disabled={targetSaving}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={saveTargets}
                  disabled={targetLoading || targetSaving || !targetsAreValid}
                >
                  {targetSaving ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
