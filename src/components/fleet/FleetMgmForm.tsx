// src/components/fleet/FleetMgmForm.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

type FleetMgmRow = {
  req_item_key: string | null;
  req_num: string | null;
  plate: string | null;
  req_date: string | null;
  assign_date: string | null;
  modified_date: string | null;
  mat_code: string | null;
  mat_desc: string | null;
  mat_unit: string | null;
  mat_group: string | null;
  mat_family: string | null;
  responsible: string | null;
  qty_requested: number | string | null;
  qty_ordered: number | string | null;
  qty_delivered: number | string | null;
  qty_approved: number | string | null;
  req_status: string | null;
  cost_center_desc: string | null;
  cost_center_code: string | null;
  requester_desc: string | null;
  requester_area: string | null;
  office_desc: string | null;
  po_num: string | null;
  supplier_name: string | null;
  po_date: string | null;
  po_unit_price_us: number | string | null;
  po_amount_usd: number | string | null;
  po_status: string | null;
  po_est_delivery_date: string | null;
  odometer_km: number | string | null;
  req_type: string | null;
  office_serv_desc: string | null;
  repair_shop_name: string | null;
  entry_date: string | null;
  exit_date: string | null;
  app_budget_pen: number | string | null;
  mgm_serv_comm: string | null;
  req_serv_status: string | null;
};

type GetResp = {
  ok: boolean;
  rows?: FleetMgmRow[];
  error?: string;
};

type SaveResp = {
  ok: boolean;
  count?: number;
  error?: string;
};

type DraftRow = Partial<Record<keyof FleetMgmRow, string>>;

const EDITABLE_FIELDS = ["repair_shop_name", "entry_date", "exit_date", "app_budget_pen", "mgm_serv_comm"] as const;
type SortKey = keyof FleetMgmRow;
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "Abierto" | "Cerrado";

const PAGE_SIZE = 50;

const REQ_TYPE_OPTIONS = ["Motor", "Llantas", "Transmisión", "Sist. Eléctrico", "Otros"];

const REQ_HEADER_COLLAPSIBLE_KEYS: (keyof FleetMgmRow)[] = [
  "req_date",
  "assign_date",
  "modified_date",
  "mat_code",
  "mat_desc",
  "mat_unit",
  "mat_group",
  "mat_family",
  "responsible",
  "qty_requested",
  "qty_ordered",
  "qty_delivered",
  "qty_approved",
  "req_status",
  "cost_center_desc",
  "cost_center_code",
  "requester_desc",
  "requester_area",
  "office_desc",
  "po_num",
  "supplier_name",
  "po_date",
  "po_unit_price_us",
  "po_amount_usd",
  "po_status",
  "po_est_delivery_date",
];

const COLUMNS: {
  key: keyof FleetMgmRow;
  label: string;
  editable: boolean;
  kind: "text" | "date" | "number" | "readonly" | "select";
  width?: number;
  sortable?: boolean;
}[] = [
  { key: "req_item_key", label: "Key RQ", editable: false, kind: "readonly", width: 360, sortable: true },
  { key: "req_num", label: "RQ", editable: false, kind: "readonly", width: 120, sortable: true },
  { key: "plate", label: "Placa", editable: false, kind: "readonly", width: 100, sortable: true },
  { key: "req_date", label: "F. Req", editable: false, kind: "date", width: 110, sortable: true },
  { key: "assign_date", label: "F. Asign.", editable: false, kind: "date", width: 110, sortable: true },
  { key: "modified_date", label: "F. Modif.", editable: false, kind: "date", width: 110, sortable: true },
  { key: "mat_code", label: "Cod. Material", editable: false, kind: "readonly", width: 130, sortable: true },
  { key: "mat_desc", label: "Material", editable: false, kind: "readonly", width: 320, sortable: true },
  { key: "mat_unit", label: "UM", editable: false, kind: "readonly", width: 80, sortable: true },
  { key: "mat_group", label: "Grupo Mat.", editable: false, kind: "readonly", width: 130, sortable: true },
  { key: "mat_family", label: "Familia Mat.", editable: false, kind: "readonly", width: 140, sortable: true },
  { key: "responsible", label: "Responsable", editable: false, kind: "readonly", width: 150, sortable: true },
  { key: "qty_requested", label: "Cant. Sol.", editable: false, kind: "number", width: 110, sortable: true },
  { key: "qty_ordered", label: "Cant. OC", editable: false, kind: "number", width: 110, sortable: true },
  { key: "qty_delivered", label: "Cant. Ent.", editable: false, kind: "number", width: 110, sortable: true },
  { key: "qty_approved", label: "Cant. Aprob.", editable: false, kind: "number", width: 120, sortable: true },
  { key: "req_status", label: "Estado RQ", editable: false, kind: "readonly", width: 130, sortable: true },
  { key: "cost_center_desc", label: "Centro de Costo", editable: false, kind: "readonly", width: 260, sortable: true },
  { key: "cost_center_code", label: "Cod. CC", editable: false, kind: "readonly", width: 100, sortable: true },
  { key: "requester_desc", label: "Solicitante", editable: false, kind: "readonly", width: 180, sortable: true },
  { key: "requester_area", label: "Área Sol.", editable: false, kind: "readonly", width: 150, sortable: true },
  { key: "office_desc", label: "Oficina", editable: false, kind: "readonly", width: 150, sortable: true },
  { key: "po_num", label: "OC", editable: false, kind: "readonly", width: 120, sortable: true },
  { key: "supplier_name", label: "Proveedor", editable: false, kind: "readonly", width: 240, sortable: true },
  { key: "po_date", label: "F. OC", editable: false, kind: "date", width: 110, sortable: true },
  { key: "po_unit_price_us", label: "PU OC USD", editable: false, kind: "number", width: 120, sortable: true },
  { key: "po_amount_usd", label: "Monto USD OC", editable: false, kind: "number", width: 130, sortable: true },
  { key: "po_status", label: "Estado OC", editable: false, kind: "readonly", width: 130, sortable: true },
  { key: "po_est_delivery_date", label: "F. Est. Entrega", editable: false, kind: "date", width: 130, sortable: true },
  { key: "odometer_km", label: "Odómetro Km", editable: false, kind: "number", width: 140, sortable: true },
  { key: "req_type", label: "Tipo Req", editable: false, kind: "readonly", width: 180, sortable: true },
  { key: "office_serv_desc", label: "Descripción", editable: false, kind: "readonly", width: 320, sortable: true },
  { key: "repair_shop_name", label: "Taller", editable: true, kind: "text", width: 220, sortable: true },
  { key: "entry_date", label: "F. Ingreso", editable: true, kind: "date", width: 130, sortable: true },
  { key: "exit_date", label: "F. Salida", editable: true, kind: "date", width: 130, sortable: true },
  { key: "app_budget_pen", label: "Presup. Aprob. PEN", editable: true, kind: "number", width: 170, sortable: true },
  { key: "mgm_serv_comm", label: "Comentario", editable: true, kind: "text", width: 340, sortable: true },
  { key: "req_serv_status", label: "Estado Servicio", editable: false, kind: "readonly", width: 140, sortable: true },
];

const SORTABLE_KEYS = COLUMNS.filter((c) => c.sortable).map((c) => c.key);

function isBlank(v: unknown) {
  return v === null || v === undefined || String(v).trim() === "";
}

function toText(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function parseNum(v: unknown) {
  const t = String(v ?? "").trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function formatNumber(value: unknown, decimals = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDateYyyyMmDd(value: unknown) {
  const v = String(value ?? "").trim();
  if (!v) return "";

  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v.slice(0, 10);

  return d.toISOString().slice(0, 10);
}

function formatDisplayValue(key: keyof FleetMgmRow, value: unknown) {
  if (isBlank(value)) return "";

  if (
    key === "req_date" ||
    key === "assign_date" ||
    key === "modified_date" ||
    key === "po_date" ||
    key === "po_est_delivery_date" ||
    key === "entry_date" ||
    key === "exit_date"
  ) {
    return formatDateYyyyMmDd(value);
  }

  if (
    key === "qty_requested" ||
    key === "qty_ordered" ||
    key === "qty_delivered" ||
    key === "qty_approved" ||
    key === "po_unit_price_us" ||
    key === "po_amount_usd" ||
    key === "odometer_km" ||
    key === "app_budget_pen"
  ) {
    return formatNumber(value, 2);
  }

  return String(value ?? "");
}

function toDraftRow(r: FleetMgmRow): DraftRow {
  const out: DraftRow = {};

  for (const c of COLUMNS) {
    out[c.key] = c.kind === "date" ? formatDateYyyyMmDd(r[c.key]) : toText(r[c.key]);
  }

  return out;
}

function compareText(a: string, b: string) {
  return String(a || "").localeCompare(String(b || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function getSortValue(row: FleetMgmRow, key: SortKey, draft?: DraftRow) {
  const value = draft?.[key] ?? row[key];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function compareByKey(
  a: FleetMgmRow,
  b: FleetMgmRow,
  key: SortKey,
  dir: SortDir,
  draftA?: DraftRow,
  draftB?: DraftRow
) {
  const av = getSortValue(a, key, draftA);
  const bv = getSortValue(b, key, draftB);

  const numericKeys: SortKey[] = ["qty_requested", "qty_ordered", "qty_delivered", "qty_approved", "po_unit_price_us", "po_amount_usd", "odometer_km", "app_budget_pen"];

  if (numericKeys.includes(key)) {
    const an = parseNum(av);
    const bn = parseNum(bv);

    const aBlank = an === null;
    const bBlank = bn === null;

    if (aBlank && bBlank) return 0;
    if (aBlank) return 1;
    if (bBlank) return -1;

    return dir === "asc" ? an - bn : bn - an;
  }

  const result = compareText(av, bv);
  return dir === "asc" ? result : -result;
}

function inDateRange(reqDate: string | null, from: string, to: string) {
  const d = formatDateYyyyMmDd(reqDate);
  if (!d) return !from && !to;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function inDraftDateRange(row: FleetMgmRow, draft: DraftRow | undefined, key: keyof FleetMgmRow, from: string, to: string) {
  const d = formatDateYyyyMmDd(draft?.[key] ?? row[key]);
  if (!d) return !from && !to;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function matchesGlobal(row: FleetMgmRow, draft: DraftRow | undefined, filterValue: string) {
  const filter = String(filterValue || "").trim().toLowerCase();
  if (!filter) return true;

  const values = [
    row.req_item_key,
    row.req_num,
    row.mat_code,
    row.mat_desc,
    row.cost_center_desc,
    row.requester_desc,
    row.requester_area,
    row.req_type,
    draft?.repair_shop_name ?? row.repair_shop_name,
    draft?.entry_date ?? row.entry_date,
    draft?.exit_date ?? row.exit_date,
    draft?.app_budget_pen ?? row.app_budget_pen,
    row.req_serv_status,
  ];

  return values.some((value) =>
    String(value || "").trim().toLowerCase().includes(filter)
  );
}

function isRowEdited(current: DraftRow | undefined, original: DraftRow | undefined) {
  if (!current || !original) return false;

  return EDITABLE_FIELDS.some(
    (field) => String(current[field] ?? "") !== String(original[field] ?? "")
  );
}

function todayPeYyyyMmDd() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year")?.value || "";
  const m = parts.find((p) => p.type === "month")?.value || "";
  const d = parts.find((p) => p.type === "day")?.value || "";

  return `${y}-${m}-${d}`;
}

function isFutureDatePe(value: unknown) {
  const d = formatDateYyyyMmDd(value);
  if (!d) return false;
  return d > todayPeYyyyMmDd();
}

function rowHasInvalidNumber(current: DraftRow | undefined) {
  if (!current) return false;

  const budget = String(current.app_budget_pen ?? "").trim();

  if (budget && parseNum(budget) === null) return true;
  if (isFutureDatePe(current.entry_date)) return true;
  if (isFutureDatePe(current.exit_date)) return true;

  return false;
}

function buildPayload(row: DraftRow) {
  const payload: Record<string, string | number | null> = {
    req_item_key: String(row.req_item_key ?? "").trim() || null,
  };

  const repairShopName = String(row.repair_shop_name ?? "").trim();
  const entryDate = formatDateYyyyMmDd(row.entry_date);
  const exitDate = formatDateYyyyMmDd(row.exit_date);
  const appBudgetPen = parseNum(row.app_budget_pen);
  const mgmServComm = String(row.mgm_serv_comm ?? "").trim().slice(0, 255);

  if (repairShopName) payload.repair_shop_name = repairShopName;
  if (entryDate) payload.entry_date = entryDate;
  if (exitDate) payload.exit_date = exitDate;
  if (appBudgetPen !== null) payload.app_budget_pen = appBudgetPen;
  if (mgmServComm) payload.mgm_serv_comm = mgmServComm;

  return payload;
}

type RowItemProps = {
  row: FleetMgmRow;
  draft: DraftRow;
  loading: boolean;
  saving: boolean;
  edited: boolean;
  invalid: boolean;
  registerInput: (
    key: string,
    field: keyof FleetMgmRow,
    el: HTMLInputElement | HTMLSelectElement | null
  ) => void;
  onCellBlur: (key: string, field: keyof FleetMgmRow, value: string) => void;
  onCellFocus: (key: string) => void;
  cellBase: React.CSSProperties;
  gridH: string;
  gridV: string;
  rowBg: string;
  editedRowBg: string;
  invalidRowBg: string;
  columnWidths: Partial<Record<keyof FleetMgmRow, number>>;
  columns: typeof COLUMNS;
};

function RowItem({
  row,
  draft,
  loading,
  saving,
  edited,
  invalid,
  registerInput,
  onCellBlur,
  onCellFocus,
  cellBase,
  gridH,
  gridV,
  rowBg,
  editedRowBg,
  invalidRowBg,
  columnWidths,
  columns,
}: RowItemProps) {
  const key = String(row.req_item_key ?? "").trim();
  const [openDropdown, setOpenDropdown] = useState<keyof FleetMgmRow | null>(null);
  const currentRowBg = invalid ? invalidRowBg : edited ? editedRowBg : rowBg;

  return (
    <tr
      className="capex-tr"
      style={{
        position: "relative",
        zIndex: openDropdown ? 99999 : "auto",
      }}
    >
      {columns.map((c) => {
        const colWidth = columnWidths[c.key] ?? c.width ?? 110;

        if (!c.editable) {
          const isNumber = c.kind === "number";
          const raw = row[c.key];
          const show = formatDisplayValue(c.key, raw);

          return (
            <td
              key={String(c.key)}
              className="capex-td"
              style={{
                ...cellBase,
                borderTop: gridH,
                borderBottom: gridH,
                borderRight: gridV,
                background: currentRowBg,
                textAlign: isNumber ? "right" : "left",
                fontWeight: 400,
                width: colWidth,
                minWidth: colWidth,
                maxWidth: colWidth,
                padding: isNumber ? "6px 4px" : "6px 8px",
                color: invalid ? "rgb(255,190,190)" : "rgb(185,185,185)",
              }}
              title={show || "—"}
            >
              {show || "—"}
            </td>
          );
        }

        if (c.kind === "number") {
          const currentValue = toText(draft[c.key]);

          return (
            <td
              key={String(c.key)}
              className="capex-td"
              style={{
                ...cellBase,
                borderTop: gridH,
                borderBottom: gridH,
                borderRight: gridV,
                background: currentRowBg,
                padding: "6px 8px",
                width: colWidth,
                minWidth: colWidth,
                maxWidth: colWidth,
                boxSizing: "border-box",
              }}
            >
              <input
                ref={(el) => registerInput(key, c.key, el)}
                type="text"
                inputMode="decimal"
                value={currentValue}
                disabled={loading || saving}
                onFocus={() => onCellFocus(key)}
                onChange={(e) => onCellBlur(key, c.key, e.target.value)}
                style={{
                  width: "100%",
                  minWidth: 0,
                  background: "rgba(0,0,0,.10)",
                  border: invalid ? "1px solid rgba(255, 92, 92, 0.75)" : "1px solid var(--border)",
                  color: "var(--text)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  outline: "none",
                  fontWeight: 900,
                  textAlign: "right",
                  boxSizing: "border-box",
                }}
              />
            </td>
          );
        }

        if (c.kind === "date") {
          const currentValue = formatDateYyyyMmDd(draft[c.key]);

          return (
            <td
              key={String(c.key)}
              className="capex-td"
              style={{
                ...cellBase,
                borderTop: gridH,
                borderBottom: gridH,
                borderRight: gridV,
                background: currentRowBg,
                padding: "6px 8px",
                width: colWidth,
                minWidth: colWidth,
                maxWidth: colWidth,
                boxSizing: "border-box",
              }}
            >
              <input
                ref={(el) => registerInput(key, c.key, el)}
                type="date"
                value={currentValue}
                max={todayPeYyyyMmDd()}
                disabled={loading || saving}
                onFocus={() => onCellFocus(key)}
                onKeyDown={(e) => e.preventDefault()}
                onPaste={(e) => e.preventDefault()}
                onChange={(e) => onCellBlur(key, c.key, e.target.value)}
                style={{
                  width: "100%",
                  minWidth: 0,
                  background: "rgba(0,0,0,.10)",
                  border: invalid ? "1px solid rgba(255, 92, 92, 0.75)" : "1px solid var(--border)",
                  color: "var(--text)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  outline: "none",
                  fontWeight: 900,
                  boxSizing: "border-box",
                  colorScheme: "dark",
                }}
              />
            </td>
          );
        }

        if (c.key === "mgm_serv_comm") {
          const currentValue = toText(draft[c.key]).slice(0, 255);
          const charCount = currentValue.length;

          return (
            <td
              key={String(c.key)}
              className="capex-td"
              style={{
                ...cellBase,
                borderTop: gridH,
                borderBottom: gridH,
                borderRight: gridV,
                background: currentRowBg,
                padding: "6px 8px",
                width: colWidth,
                minWidth: colWidth,
                maxWidth: colWidth,
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                }}
              >
                <input
                  ref={(el) => registerInput(key, c.key, el)}
                  type="text"
                  value={currentValue}
                  maxLength={255}
                  disabled={loading || saving}
                  onFocus={() => onCellFocus(key)}
                  onChange={(e) => onCellBlur(key, c.key, e.target.value.slice(0, 255))}
                  style={{
                    width: "100%",
                    minWidth: 0,
                    background: "rgba(0,0,0,.10)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    outline: "none",
                    fontWeight: 900,
                    textAlign: "left",
                    boxSizing: "border-box",
                  }}
                />

                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    color: charCount >= 255 ? "rgb(255, 170, 170)" : "rgba(255,255,255,.65)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {charCount}/255
                </span>
              </div>
            </td>
          );
        }

        if (c.kind === "text") {
          const currentValue = toText(draft[c.key]);

          return (
            <td
              key={String(c.key)}
              className="capex-td"
              style={{
                ...cellBase,
                borderTop: gridH,
                borderBottom: gridH,
                borderRight: gridV,
                background: currentRowBg,
                padding: "6px 8px",
                width: colWidth,
                minWidth: colWidth,
                maxWidth: colWidth,
                boxSizing: "border-box",
              }}
            >
              <input
                ref={(el) => registerInput(key, c.key, el)}
                type="text"
                value={currentValue}
                disabled={loading || saving}
                onFocus={() => onCellFocus(key)}
                onChange={(e) => onCellBlur(key, c.key, e.target.value)}
                style={{
                  width: "100%",
                  minWidth: 0,
                  background: "rgba(0,0,0,.10)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  outline: "none",
                  fontWeight: 900,
                  textAlign: "left",
                  boxSizing: "border-box",
                }}
              />
            </td>
          );
        }

        return (
          <td
            key={String(c.key)}
            className="capex-td"
            style={{
              ...cellBase,
              borderTop: gridH,
              borderBottom: gridH,
              borderRight: gridV,
              background: currentRowBg,
              padding: "6px 8px",
              width: colWidth,
              minWidth: colWidth,
              maxWidth: colWidth,
              overflow: "visible",
              position: "relative",
              zIndex: openDropdown === c.key ? 9999 : "auto",
              boxSizing: "border-box",
            }}
          >
            {(() => {
              const options = [
                { value: "", label: "Selecciona..." },
                ...REQ_TYPE_OPTIONS.map((x) => ({ value: x, label: x })),
              ];

              const currentValue = toText(draft[c.key]);
              const currentLabel =
                options.find((o) => o.value === currentValue)?.label ??
                options.find((o) => o.value === "")?.label ??
                "";

              return (
                <div
                  style={{
                    display: "grid",
                    gap: 6,
                    overflow: "visible",
                    position: "relative",
                  }}
                >
                  <button
                    type="button"
                    disabled={loading || saving}
                    onFocus={() => onCellFocus(key)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (loading || saving) return;
                      setOpenDropdown((s) => (s === c.key ? null : c.key));
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
                      cursor: loading || saving ? "not-allowed" : "pointer",
                      opacity: loading || saving ? 0.7 : 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <span
                      style={{
                        opacity: currentValue ? 1 : 0.6,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {currentLabel}
                    </span>
                    <span style={{ opacity: 0.8 }}>▾</span>
                  </button>

                  {openDropdown === c.key ? (
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
                        overflowY: "auto",
                        overflowX: "hidden",
                        maxHeight: 280,
                        width: 230,
                        minWidth: "100%",
                        whiteSpace: "normal",
                      }}
                    >
                      {options.map((o) => {
                        const active = o.value === currentValue;
                        const isEmpty = o.value === "";

                        return (
                          <button
                            key={o.value || "__empty__"}
                            type="button"
                            ref={(el) => {
                              if (active) registerInput(key, c.key, el as any);
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onCellBlur(key, c.key, o.value);
                              setOpenDropdown(null);
                            }}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: "10px 12px",
                              background: active ? "rgba(102,199,255,.18)" : "transparent",
                              color: isEmpty ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.92)",
                              border: "none",
                              cursor: "pointer",
                              fontWeight: 900,
                              whiteSpace: "normal",
                              lineHeight: "16px",
                              wordBreak: "normal",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = active
                                ? "rgba(102,199,255,.18)"
                                : "rgba(255,255,255,.06)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = active
                                ? "rgba(102,199,255,.18)"
                                : "transparent";
                            }}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </td>
        );
      })}
    </tr>
  );
}

export default function FleetMgmForm() {
  const [rows, setRows] = useState<FleetMgmRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [entryDateFrom, setEntryDateFrom] = useState("");
  const [entryDateTo, setEntryDateTo] = useState("");
  const [exitDateFrom, setExitDateFrom] = useState("");
  const [exitDateTo, setExitDateTo] = useState("");
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showReqDetails, setShowReqDetails] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("req_item_key");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editedTick, setEditedTick] = useState(0);
  const [page, setPage] = useState(1);
  const [, setActiveItem] = useState<string | null>(null);

  const draftsRef = useRef<Record<string, DraftRow>>({});
  const originalsRef = useRef<Record<string, DraftRow>>({});
  const inputsRef = useRef<
    Record<string, Partial<Record<keyof FleetMgmRow, HTMLInputElement | HTMLSelectElement | null>>>
  >({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setMsg(null);

    try {
      const r = (await apiGet("/api/logistics/flota/req")) as GetResp;
      const data = Array.isArray(r?.rows) ? r.rows : [];

      const nextDrafts: Record<string, DraftRow> = {};
      const nextOriginals: Record<string, DraftRow> = {};

      for (const row of data) {
        const key = String(row.req_item_key ?? "").trim();
        if (!key) continue;

        const draft = toDraftRow(row);
        nextDrafts[key] = { ...draft };
        nextOriginals[key] = { ...draft };
      }

      draftsRef.current = nextDrafts;
      originalsRef.current = nextOriginals;
      inputsRef.current = {};
      setRows(data);
      setEditedTick((v) => v + 1);
      setActiveItem(null);
      setPage(1);
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo cargar")}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const reqDateBounds = useMemo(() => {
    const dates = rows
      .map((row) => formatDateYyyyMmDd(row.req_date))
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();

    if (!dates.length) return { min: "", max: "" };

    return {
      min: dates[0],
      max: dates[dates.length - 1],
    };
  }, [rows]);

  useEffect(() => {
    if (!rows.length) return;

    setDateFrom((prev) => prev || reqDateBounds.min);
    setDateTo((prev) => prev || reqDateBounds.max);
  }, [rows, reqDateBounds.min, reqDateBounds.max]);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, entryDateFrom, entryDateTo, exitDateFrom, exitDateTo, globalFilter, statusFilter, sortKey, sortDir]);

  const editedCount = useMemo(() => {
    editedTick;
    let count = 0;

    for (const key of Object.keys(draftsRef.current)) {
      if (isRowEdited(draftsRef.current[key], originalsRef.current[key])) count++;
    }

    return count;
  }, [editedTick]);

  const editedMap = useMemo(() => {
    editedTick;
    const map: Record<string, boolean> = {};

    for (const key of Object.keys(draftsRef.current)) {
      map[key] = isRowEdited(draftsRef.current[key], originalsRef.current[key]);
    }

    return map;
  }, [editedTick]);

  const invalidMap = useMemo(() => {
    editedTick;
    const map: Record<string, boolean> = {};

    for (const key of Object.keys(draftsRef.current)) {
      map[key] = rowHasInvalidNumber(draftsRef.current[key]);
    }

    return map;
  }, [editedTick]);

  const invalidCount = useMemo(() => {
    return Object.values(invalidMap).filter(Boolean).length;
  }, [invalidMap]);

  const statusCounts = useMemo(() => {
    editedTick;

    let abiertos = 0;
    let cerrados = 0;

    for (const row of rows) {
      const key = String(row.req_item_key ?? "").trim();
      const draft = draftsRef.current[key];

      if (!inDateRange(row.req_date, dateFrom, dateTo)) continue;
      if (!inDraftDateRange(row, draft, "entry_date", entryDateFrom, entryDateTo)) continue;
      if (!inDraftDateRange(row, draft, "exit_date", exitDateFrom, exitDateTo)) continue;
      if (!matchesGlobal(row, draft, globalFilter)) continue;

      const status = String(row.req_serv_status ?? "").trim();

      if (status === "Abierto") abiertos++;
      if (status === "Cerrado") cerrados++;
    }

    return { abiertos, cerrados };
  }, [rows, dateFrom, dateTo, entryDateFrom, entryDateTo, exitDateFrom, exitDateTo, globalFilter, editedTick]);

  const preparedRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      const key = String(row.req_item_key ?? "").trim();
      const draft = draftsRef.current[key];

      if (!inDateRange(row.req_date, dateFrom, dateTo)) return false;
      if (!inDraftDateRange(row, draft, "entry_date", entryDateFrom, entryDateTo)) return false;
      if (!inDraftDateRange(row, draft, "exit_date", exitDateFrom, exitDateTo)) return false;
      if (statusFilter !== "all" && String(row.req_serv_status ?? "").trim() !== statusFilter) return false;
      if (!matchesGlobal(row, draft, globalFilter)) return false;

      return true;
    });

    return [...filtered].sort((a, b) => {
      const keyA = String(a.req_item_key ?? "").trim();
      const keyB = String(b.req_item_key ?? "").trim();

      const draftA = draftsRef.current[keyA];
      const draftB = draftsRef.current[keyB];

      const primary = compareByKey(a, b, sortKey, sortDir, draftA, draftB);
      if (primary !== 0) return primary;

      return compareByKey(a, b, "req_item_key", "asc", draftA, draftB);
    });
  }, [rows, dateFrom, dateTo, entryDateFrom, entryDateTo, exitDateFrom, exitDateTo, globalFilter, statusFilter, sortKey, sortDir, editedTick]);

  const totalRows = preparedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const visibleRows = preparedRows.slice(pageStart, pageEnd);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const hasInvalidEditedRows = useMemo(() => {
    editedTick;

    return Object.keys(draftsRef.current).some((key) => {
      if (!isRowEdited(draftsRef.current[key], originalsRef.current[key])) return false;
      return rowHasInvalidNumber(draftsRef.current[key]);
    });
  }, [editedTick]);

  const visibleColumns = useMemo(() => {
    return COLUMNS.filter((c) => showReqDetails || !REQ_HEADER_COLLAPSIBLE_KEYS.includes(c.key));
  }, [showReqDetails]);

  const dynamicColumnWidths = useMemo<Partial<Record<keyof FleetMgmRow, number>>>(() => {
    return {};
  }, []);

  const registerInput = useCallback(
    (
      key: string,
      field: keyof FleetMgmRow,
      el: HTMLInputElement | HTMLSelectElement | null
    ) => {
      if (!inputsRef.current[key]) inputsRef.current[key] = {};
      inputsRef.current[key][field] = el;
    },
    []
  );

  const onCellFocus = useCallback((key: string) => {
    setActiveItem(key);
  }, []);

  const onCellBlur = useCallback((key: string, field: keyof FleetMgmRow, value: string) => {
    const current = draftsRef.current[key];
    if (!current) return;

    current[field] = field === "mgm_serv_comm" ? value.slice(0, 255) : value;
    setEditedTick((v) => v + 1);
  }, []);

  async function onSaveAll() {
    const editedKeys = Object.keys(draftsRef.current).filter((key) =>
      isRowEdited(draftsRef.current[key], originalsRef.current[key])
    );

    if (editedKeys.length === 0) {
      setMsg("No hay filas editadas para guardar.");
      return;
    }

    const invalidEditedKeys = editedKeys.filter((key) => rowHasInvalidNumber(draftsRef.current[key]));
    if (invalidEditedKeys.length > 0) {
      setMsg("ERROR: el presupuesto debe ser numérico y las fechas no pueden ser mayores a hoy.");
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      const payloadRows = editedKeys
        .map((key) => {
          const row = draftsRef.current[key];

          if (!String(row?.req_item_key ?? "").trim()) {
            throw new Error("Hay una fila editada sin req_item_key.");
          }

          return buildPayload(row);
        })
        .filter((row) => Object.keys(row).some((k) => k !== "req_item_key"));

      if (payloadRows.length === 0) {
        setMsg("No hay cambios con datos para guardar.");
        return;
      }

      const rr = (await apiPost("/api/logistics/flota/web", { rows: payloadRows })) as SaveResp;

      if (!rr?.ok) {
        throw new Error(rr?.error || "No se pudo guardar la información de flota.");
      }

      const savedCount = Number(rr?.count ?? payloadRows.length);

      await loadData();

      setMsg(`OK: se guardaron ${savedCount} fila(s).`);
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo guardar")}`);
    } finally {
      setSaving(false);
    }
  }

  function onExportExcel() {
    const exportRows = preparedRows.map((row) => {
      const key = String(row.req_item_key ?? "").trim();
      const draft = draftsRef.current[key] ?? toDraftRow(row);
      const out: Record<string, string | number> = {};

      for (const c of visibleColumns) {
        const raw = c.editable ? draft[c.key] : row[c.key];

        if (c.kind === "date") {
          out[c.label] = formatDateYyyyMmDd(raw);
        } else if (c.kind === "number") {
          out[c.label] = parseNum(raw) ?? "";
        } else {
          out[c.label] = String(raw ?? "");
        }
      }

      return out;
    });

    if (!exportRows.length) {
      setMsg("No hay filas para exportar con el filtro seleccionado.");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(exportRows);

    ws["!cols"] = visibleColumns.map((c) => ({
      wch: Math.max(10, Math.round((c.width ?? 120) / 8)),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Flota Gestión");

    const fromPart = dateFrom || "inicio";
    const toPart = dateTo || "fin";

    XLSX.writeFile(wb, `flota_gestion_req_${fromPart}_${toPart}.xlsx`);
  }

  function onSortClick(key: keyof FleetMgmRow) {
    if (!SORTABLE_KEYS.includes(key)) return;

    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDir(key === "req_item_key" ? "asc" : "desc");
  }

  function getSortIndicator(key: keyof FleetMgmRow) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  const headerBg = "rgb(6, 36, 58)";
  const headerBorder = "1px solid rgba(191, 231, 255, 0.26)";
  const gridV = "1px solid rgba(191, 231, 255, 0.10)";
  const gridH = "1px solid rgba(191, 231, 255, 0.08)";
  const rowBg = "rgba(0,0,0,.10)";
  const editedRowBg = "rgba(30, 110, 74, 0.28)";
  const invalidRowBg = "rgba(120, 24, 24, 0.34)";

  const stickyHead: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 20,
    background: headerBg,
    boxShadow: "none",
  };

  const cellBase: React.CSSProperties = {
    padding: "6px 8px",
    fontSize: 12,
    lineHeight: "14px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    boxSizing: "border-box",
  };

  const inputBase: React.CSSProperties = {
    border: "1px solid rgba(191,231,255,.18)",
    background: "rgba(0,0,0,.10)",
    color: "white",
    fontWeight: 900,
    padding: "6px 8px",
    borderRadius: 8,
    outline: "none",
    fontSize: 12,
    lineHeight: "14px",
    boxSizing: "border-box",
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
        maxWidth: "100%",
        overflow: "hidden",
      }}
    >
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
        <div style={{ fontWeight: 900 }}>Flota · Gestión</div>

        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={() => setShowReqDetails((v) => !v)}
          disabled={loading || saving}
        >
          {showReqDetails ? "Contraer RQ" : "Desglosar RQ"}
        </Button>

        <div
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(92, 211, 158, 0.45)",
            background: editedCount > 0 ? "rgba(38, 120, 88, 0.24)" : "rgba(255,255,255,0.06)",
            fontSize: 12,
            fontWeight: 900,
            color: editedCount > 0 ? "rgb(160, 255, 214)" : "rgba(255,255,255,0.8)",
          }}
        >
          Editadas: {editedCount}
        </div>

        {invalidCount > 0 ? (
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
            Inválidas: {invalidCount}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setStatusFilter((v) => (v === "Abierto" ? "all" : "Abierto"))}
          disabled={loading || saving}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: statusFilter === "Abierto" ? "1px solid rgba(102,199,255,.75)" : "1px solid rgba(191,231,255,.18)",
            background: statusFilter === "Abierto" ? "rgba(102,199,255,.18)" : "rgba(255,255,255,0.06)",
            color: "white",
            fontSize: 12,
            fontWeight: 900,
            cursor: loading || saving ? "not-allowed" : "pointer",
          }}
        >
          Abiertos: {statusCounts.abiertos}
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter((v) => (v === "Cerrado" ? "all" : "Cerrado"))}
          disabled={loading || saving}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: statusFilter === "Cerrado" ? "1px solid rgba(102,199,255,.75)" : "1px solid rgba(191,231,255,.18)",
            background: statusFilter === "Cerrado" ? "rgba(102,199,255,.18)" : "rgba(255,255,255,0.06)",
            color: "white",
            fontSize: 12,
            fontWeight: 900,
            cursor: loading || saving ? "not-allowed" : "pointer",
          }}
        >
          Cerrados: {statusCounts.cerrados}
        </button>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>Req Date desde</div>
            <input
              type="date"
              value={dateFrom}
              min={reqDateBounds.min || undefined}
              max={reqDateBounds.max || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ ...inputBase, minWidth: 150 }}
            />
          </div>

          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>Req Date hasta</div>
            <input
              type="date"
              value={dateTo}
              min={reqDateBounds.min || undefined}
              max={reqDateBounds.max || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ ...inputBase, minWidth: 150 }}
            />
          </div>

          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>F. Ingreso desde</div>
            <input
              type="date"
              value={entryDateFrom}
              max={todayPeYyyyMmDd()}
              onKeyDown={(e) => e.preventDefault()}
              onPaste={(e) => e.preventDefault()}
              onChange={(e) => setEntryDateFrom(e.target.value)}
              style={{ ...inputBase, minWidth: 150, colorScheme: "dark" }}
            />
          </div>

          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>F. Ingreso hasta</div>
            <input
              type="date"
              value={entryDateTo}
              max={todayPeYyyyMmDd()}
              onKeyDown={(e) => e.preventDefault()}
              onPaste={(e) => e.preventDefault()}
              onChange={(e) => setEntryDateTo(e.target.value)}
              style={{ ...inputBase, minWidth: 150, colorScheme: "dark" }}
            />
          </div>

          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>F. Salida desde</div>
            <input
              type="date"
              value={exitDateFrom}
              max={todayPeYyyyMmDd()}
              onKeyDown={(e) => e.preventDefault()}
              onPaste={(e) => e.preventDefault()}
              onChange={(e) => setExitDateFrom(e.target.value)}
              style={{ ...inputBase, minWidth: 150, colorScheme: "dark" }}
            />
          </div>

          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>F. Salida hasta</div>
            <input
              type="date"
              value={exitDateTo}
              max={todayPeYyyyMmDd()}
              onKeyDown={(e) => e.preventDefault()}
              onPaste={(e) => e.preventDefault()}
              onChange={(e) => setExitDateTo(e.target.value)}
              style={{ ...inputBase, minWidth: 150, colorScheme: "dark" }}
            />
          </div>

          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>Buscador global</div>
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Buscar RQ, código, material, centro, solicitante, área, taller o estado..."
              style={{ ...inputBase, minWidth: 420 }}
            />
          </div>

          <Button type="button" size="sm" variant="default" onClick={loadData} disabled={loading || saving}>
            {loading ? "Cargando…" : "Refrescar"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={onExportExcel}
            disabled={loading || saving || preparedRows.length === 0}
          >
            Exportar Excel
          </Button>

          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={onSaveAll}
            disabled={loading || saving || editedCount === 0 || hasInvalidEditedRows}
          >
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      {msg ? (
        <div
          className="panel-inner"
          style={{
            padding: 10,
            flexShrink: 0,
            border:
              msg.startsWith("OK") || msg.startsWith("PARCIAL")
                ? "1px solid rgba(102,199,255,.45)"
                : "1px solid rgba(255,80,80,.45)",
            background:
              msg.startsWith("OK") || msg.startsWith("PARCIAL")
                ? "rgba(102,199,255,.10)"
                : "rgba(255,80,80,.10)",
            fontWeight: 800,
          }}
        >
          {msg}
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
          maxWidth: "100%",
          maxHeight: "calc(100vh - 300px)",
          overflow: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ minWidth: "max-content" }}>
          <Table stickyHeader disableScrollWrapper>
            <colgroup>
              {visibleColumns.map((c) => (
                <col
                  key={String(c.key)}
                  style={{
                    width: dynamicColumnWidths[c.key] ?? c.width ?? 110,
                    minWidth: dynamicColumnWidths[c.key] ?? c.width ?? 110,
                    maxWidth: dynamicColumnWidths[c.key] ?? c.width ?? 110,
                  }}
                />
              ))}
            </colgroup>

            <thead>
              <tr>
                {visibleColumns.map((c) => {
                  const sortable = !!c.sortable;

                  return (
                    <th
                      key={String(c.key)}
                      className="capex-th"
                      onClick={sortable ? () => onSortClick(c.key) : undefined}
                      style={{
                        ...stickyHead,
                        border: headerBorder,
                        borderBottom: headerBorder,
                        textAlign: c.kind === "number" ? "right" : "left",
                        padding: c.kind === "number" ? "8px 4px" : "8px 8px",
                        fontSize: 12,
                        width: dynamicColumnWidths[c.key] ?? c.width ?? 110,
                        minWidth: dynamicColumnWidths[c.key] ?? c.width ?? 110,
                        maxWidth: dynamicColumnWidths[c.key] ?? c.width ?? 110,
                        cursor: sortable ? "pointer" : "default",
                        userSelect: "none",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        boxSizing: "border-box",
                      }}
                      title={c.label}
                    >
                      {c.label}
                      {sortable ? getSortIndicator(c.key) : ""}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {visibleRows.map((row, index) => {
                const rowKey = String(row.req_item_key ?? "").trim();
                const safeKey = rowKey || `row-${index}`;
                const draft = draftsRef.current[rowKey] ?? toDraftRow(row);

                return (
                  <RowItem
                    key={safeKey}
                    row={row}
                    draft={draft}
                    loading={loading}
                    saving={saving}
                    edited={!!editedMap[rowKey]}
                    invalid={!!invalidMap[rowKey]}
                    registerInput={registerInput}
                    onCellBlur={onCellBlur}
                    onCellFocus={onCellFocus}
                    cellBase={cellBase}
                    gridH={gridH}
                    gridV={gridV}
                    rowBg={rowBg}
                    editedRowBg={editedRowBg}
                    invalidRowBg={invalidRowBg}
                    columnWidths={dynamicColumnWidths}
                    columns={visibleColumns}
                  />
                );
              })}

              {!loading && visibleRows.length === 0 ? (
                <tr className="capex-tr">
                  <td className="capex-td" style={{ ...cellBase, fontWeight: 900 }} colSpan={visibleColumns.length}>
                    No hay filas para el filtro seleccionado.
                  </td>
                </tr>
              ) : null}

              {loading ? (
                <tr className="capex-tr">
                  <td className="capex-td" style={{ ...cellBase, fontWeight: 900 }} colSpan={visibleColumns.length}>
                    Cargando requerimientos de flota…
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
          Mostrando {totalRows === 0 ? 0 : pageStart + 1} - {Math.min(pageEnd, totalRows)} de {totalRows} filas
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={loading || saving || safePage <= 1}
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
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(191,231,255,.18)",
            }}
          >
            Página {safePage} / {totalPages}
          </div>

          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={loading || saving || safePage >= totalPages}
          >
            →
          </Button>
        </div>
      </div>
    </div>
  );
}