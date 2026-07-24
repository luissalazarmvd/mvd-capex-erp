// src/components/sustainability/SustainabilityProvTable.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

type SustainabilityProvRow = {
  ruc: string | null;
  miner_name: string | null;
  sede: string | null;
  department: string | null;
  province: string | null;
  district: string | null;
  january: number | string | null;
  february: number | string | null;
  march: number | string | null;
  april: number | string | null;
  may: number | string | null;
  june: number | string | null;
  july: number | string | null;
  august: number | string | null;
  september: number | string | null;
  october: number | string | null;
  november: number | string | null;
  december: number | string | null;
  qty_months_active: number | string | null;
  active_this_month: string | number | boolean | null;
  formal_flag: string | null;
  concession_name: string | null;
  concession_code: string | null;
  tit_conces: string | null;
  benef_flag: string | null;
  igafom_status: string | null;
  explot_flag: string | null;
  recpo_flag: string | null;
  recpo_condition: string | null;
  recpo_register: string | null;
  explosive_auth_flag: string | null;
  cira_flag: string | null;
  terrain_flag: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  manager_mail: string | null;
  sunat_status: string | null;
};

type GetResp = {
  ok: boolean;
  rows?: SustainabilityProvRow[];
  count?: number;
  error?: string;
};

type SaveResp = {
  ok: boolean;
  error?: string;
};

type DraftRow = Partial<Record<keyof SustainabilityProvRow, string>>;

type ColumnKind = "readonly" | "select" | "text" | "recpo";
type SortKey = keyof SustainabilityProvRow;
type SortDir = "asc" | "desc";

type ColumnDefinition = {
  key: keyof SustainabilityProvRow;
  label: string;
  editable: boolean;
  kind: ColumnKind;
  width: number;
};

type SelectOption = {
  value: string;
  label: string;
};

const PAGE_SIZE = 50;
const RUC_WIDTH = 130;
const CONCESSION_CODE_WIDTH = 150;

const EDITABLE_FIELDS = [
  "formal_flag",
  "benef_flag",
  "igafom_status",
  "explot_flag",
  "recpo_flag",
  "recpo_condition",
  "recpo_register",
  "explosive_auth_flag",
  "cira_flag",
  "terrain_flag",
  "manager_name",
  "manager_phone",
  "manager_mail",
  "sunat_status",
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

const COLLAPSED_FIELDS: (keyof SustainabilityProvRow)[] = [
  "ruc",
  "concession_code",
  "formal_flag",
  "benef_flag",
  "igafom_status",
  "explot_flag",
  "recpo_flag",
  "recpo_condition",
  "recpo_register",
  "explosive_auth_flag",
  "cira_flag",
  "terrain_flag",
  "manager_name",
  "manager_phone",
  "manager_mail",
  "sunat_status",
];

const MONTH_FIELDS: (keyof SustainabilityProvRow)[] = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  "qty_months_active",
];

const FORMAL_OPTIONS: SelectOption[] = [
  { value: "", label: "Selecciona..." },
  { value: "Excluído", label: "Excluído" },
  { value: "Formalizado", label: "Formalizado" },
  { value: "Suspendido", label: "Suspendido" },
  { value: "Vigente", label: "Vigente" },
];

const YES_NO_OPTIONS: SelectOption[] = [
  { value: "", label: "Selecciona..." },
  { value: "Sí", label: "Sí" },
  { value: "No", label: "No" },
];

const IGAFOM_OPTIONS: SelectOption[] = [
  { value: "", label: "Selecciona..." },
  { value: "Presentado", label: "Presentado" },
  { value: "En Evaluación", label: "En Evaluación" },
];

const RECPO_CONDITION_OPTIONS: SelectOption[] = [
  { value: "", label: "Selecciona..." },
  { value: "Compra y Venta de Oro", label: "Compra y Venta de Oro" },
  {
    value: "Compra, Venta y Refinación de Oro",
    label: "Compra, Venta y Refinación de Oro",
  },
  { value: "Venta de Oro", label: "Venta de Oro" },
];

const SUNAT_STATUS_OPTIONS: SelectOption[] = [
  { value: "", label: "Sin Selección" },
  { value: "Activo/Habido", label: "Activo/Habido" },
];

const SELECT_OPTIONS: Partial<Record<EditableField, SelectOption[]>> = {
  formal_flag: FORMAL_OPTIONS,
  benef_flag: YES_NO_OPTIONS,
  igafom_status: IGAFOM_OPTIONS,
  explot_flag: YES_NO_OPTIONS,
  recpo_flag: YES_NO_OPTIONS,
  recpo_condition: RECPO_CONDITION_OPTIONS,
  explosive_auth_flag: YES_NO_OPTIONS,
  cira_flag: YES_NO_OPTIONS,
  terrain_flag: YES_NO_OPTIONS,
  sunat_status: SUNAT_STATUS_OPTIONS,
};

const COLUMNS: ColumnDefinition[] = [
  {
    key: "ruc",
    label: "RUC",
    editable: false,
    kind: "readonly",
    width: RUC_WIDTH,
  },
  {
    key: "concession_code",
    label: "Cod. Concesión",
    editable: false,
    kind: "readonly",
    width: CONCESSION_CODE_WIDTH,
  },
  {
    key: "miner_name",
    label: "Minero",
    editable: false,
    kind: "readonly",
    width: 260,
  },
  {
    key: "sede",
    label: "Sede",
    editable: false,
    kind: "readonly",
    width: 140,
  },
  {
    key: "department",
    label: "Departamento",
    editable: false,
    kind: "readonly",
    width: 140,
  },
  {
    key: "province",
    label: "Provincia",
    editable: false,
    kind: "readonly",
    width: 140,
  },
  {
    key: "district",
    label: "Distrito",
    editable: false,
    kind: "readonly",
    width: 140,
  },
  {
    key: "january",
    label: "Enero",
    editable: false,
    kind: "readonly",
    width: 90,
  },
  {
    key: "february",
    label: "Febrero",
    editable: false,
    kind: "readonly",
    width: 90,
  },
  {
    key: "march",
    label: "Marzo",
    editable: false,
    kind: "readonly",
    width: 90,
  },
  {
    key: "april",
    label: "Abril",
    editable: false,
    kind: "readonly",
    width: 90,
  },
  {
    key: "may",
    label: "Mayo",
    editable: false,
    kind: "readonly",
    width: 90,
  },
  {
    key: "june",
    label: "Junio",
    editable: false,
    kind: "readonly",
    width: 90,
  },
  {
    key: "july",
    label: "Julio",
    editable: false,
    kind: "readonly",
    width: 90,
  },
  {
    key: "august",
    label: "Agosto",
    editable: false,
    kind: "readonly",
    width: 90,
  },
  {
    key: "september",
    label: "Septiembre",
    editable: false,
    kind: "readonly",
    width: 100,
  },
  {
    key: "october",
    label: "Octubre",
    editable: false,
    kind: "readonly",
    width: 90,
  },
  {
    key: "november",
    label: "Noviembre",
    editable: false,
    kind: "readonly",
    width: 100,
  },
  {
    key: "december",
    label: "Diciembre",
    editable: false,
    kind: "readonly",
    width: 100,
  },
  {
    key: "qty_months_active",
    label: "Meses Activos",
    editable: false,
    kind: "readonly",
    width: 120,
  },
  {
    key: "active_this_month",
    label: "Activo Mes Actual",
    editable: false,
    kind: "readonly",
    width: 140,
  },
  {
    key: "formal_flag",
    label: "Estado Formalización",
    editable: true,
    kind: "select",
    width: 190,
  },
  {
    key: "concession_name",
    label: "Concesión",
    editable: false,
    kind: "readonly",
    width: 240,
  },
  {
    key: "tit_conces",
    label: "Titular Concesión",
    editable: false,
    kind: "readonly",
    width: 240,
  },
  {
    key: "benef_flag",
    label: "Beneficio",
    editable: true,
    kind: "select",
    width: 130,
  },
  {
    key: "igafom_status",
    label: "Estado IGAFOM",
    editable: true,
    kind: "select",
    width: 170,
  },
  {
    key: "explot_flag",
    label: "Explotación",
    editable: true,
    kind: "select",
    width: 130,
  },
  {
    key: "recpo_flag",
    label: "RECPO",
    editable: true,
    kind: "select",
    width: 120,
  },
  {
    key: "recpo_condition",
    label: "Condición RECPO",
    editable: true,
    kind: "select",
    width: 290,
  },
  {
    key: "recpo_register",
    label: "Registro RECPO",
    editable: true,
    kind: "recpo",
    width: 210,
  },
  {
    key: "explosive_auth_flag",
    label: "Aut. Explosivos",
    editable: true,
    kind: "select",
    width: 150,
  },
  {
    key: "cira_flag",
    label: "CIRA",
    editable: true,
    kind: "select",
    width: 120,
  },
  {
    key: "terrain_flag",
    label: "Terreno",
    editable: true,
    kind: "select",
    width: 120,
  },
  {
    key: "manager_name",
    label: "Responsable",
    editable: true,
    kind: "text",
    width: 300,
  },
  {
    key: "manager_phone",
    label: "Teléfono Responsable",
    editable: true,
    kind: "text",
    width: 210,
  },
  {
    key: "manager_mail",
    label: "Correo Responsable",
    editable: true,
    kind: "text",
    width: 320,
  },
  {
    key: "sunat_status",
    label: "Estado SUNAT",
    editable: true,
    kind: "select",
    width: 170,
  },
];

function toText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function formatDateTime2Pe() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const getPart = (type: string) =>
    parts.find((part) => part.type === type)?.value || "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")} ${getPart(
    "hour"
  )}:${getPart("minute")}:${getPart("second")}.${String(
    now.getMilliseconds()
  ).padStart(3, "0")}`;
}

function getRowKey(row: SustainabilityProvRow | DraftRow) {
  const ruc = String(row.ruc ?? "").trim();
  const concessionCode = String(row.concession_code ?? "").trim();
  return `${ruc}__${concessionCode}`;
}

function toDraftRow(row: SustainabilityProvRow): DraftRow {
  const draft: DraftRow = {};

  for (const column of COLUMNS) {
    draft[column.key] = toText(row[column.key]);
  }

  const recpoRegister = String(row.recpo_register ?? "").trim();
  draft.recpo_register = recpoRegister || "RECPO-";

  return draft;
}

function isEditableField(
  field: keyof SustainabilityProvRow
): field is EditableField {
  return EDITABLE_FIELDS.includes(field as EditableField);
}

function normalizeRecpoRegister(value: unknown) {
  const current = String(value ?? "").trim();

  if (!current || current === "RECPO-") {
    return "RECPO-";
  }

  const digits = current.startsWith("RECPO-")
    ? current.slice(6).replace(/\D/g, "").slice(0, 6)
    : current.replace(/\D/g, "").slice(0, 6);

  return `RECPO-${digits}`;
}

function getRecpoDigits(value: unknown) {
  const normalized = normalizeRecpoRegister(value);
  return normalized.replace(/^RECPO-/, "");
}

function validateField(field: EditableField, value: unknown) {
  const text = String(value ?? "").trim();

  if (SELECT_OPTIONS[field]) {
    const validValues = SELECT_OPTIONS[field]!.map((option) => option.value);

    if (!validValues.includes(text)) {
      return "Valor no permitido.";
    }
  }

  if (field === "recpo_register") {
    if (!text || text === "RECPO-") return null;

    if (!/^RECPO-\d{6}$/.test(text)) {
      return "Debe contener RECPO- y 6 dígitos.";
    }
  }

  if (field === "manager_name" && text.length > 100) {
    return "Máximo 100 caracteres.";
  }

  if (field === "manager_phone") {
    if (!text) return null;

    if (!/^\d{9}$/.test(text)) {
      return "Debe contener exactamente 9 números.";
    }
  }

  if (field === "manager_mail") {
    if (text.length > 100) {
      return "Máximo 100 caracteres.";
    }

    if (text && !/^[A-Za-z0-9@._+\-]+$/.test(text)) {
      return "Contiene caracteres no permitidos.";
    }
  }

  return null;
}

function getRowValidationError(draft: DraftRow) {
  for (const field of EDITABLE_FIELDS) {
    const error = validateField(field, draft[field]);
    if (error) return `${field}: ${error}`;
  }

  return null;
}

function isRowEdited(
  current: DraftRow | undefined,
  original: DraftRow | undefined
) {
  if (!current || !original) return false;

  return EDITABLE_FIELDS.some(
    (field) =>
      String(current[field] ?? "") !== String(original[field] ?? "")
  );
}

function buildPayload(draft: DraftRow) {
  const ruc = String(draft.ruc ?? "").trim();
  const concessionCode = String(draft.concession_code ?? "").trim();

  if (!ruc || !concessionCode) {
    throw new Error("La fila no tiene RUC o código de concesión.");
  }

  const recpoRegister = normalizeRecpoRegister(draft.recpo_register);

  return {
    ruc,
    concession_code: concessionCode,
    formal_flag: String(draft.formal_flag ?? "").trim() || null,
    benef_flag: String(draft.benef_flag ?? "").trim() || null,
    igafom_status: String(draft.igafom_status ?? "").trim() || null,
    explot_flag: String(draft.explot_flag ?? "").trim() || null,
    recpo_flag: String(draft.recpo_flag ?? "").trim() || null,
    recpo_condition: String(draft.recpo_condition ?? "").trim() || null,
    recpo_register:
      recpoRegister === "RECPO-" ? null : recpoRegister || null,
    explosive_auth_flag:
      String(draft.explosive_auth_flag ?? "").trim() || null,
    cira_flag: String(draft.cira_flag ?? "").trim() || null,
    terrain_flag: String(draft.terrain_flag ?? "").trim() || null,
    manager_name:
      String(draft.manager_name ?? "").trim().slice(0, 100) || null,
    manager_phone: String(draft.manager_phone ?? "").trim() || null,
    manager_mail:
      String(draft.manager_mail ?? "").trim().slice(0, 100) || null,
    sunat_status: String(draft.sunat_status ?? "").trim() || null,
  };
}

function matchesGlobal(
  row: SustainabilityProvRow,
  draft: DraftRow,
  filterValue: string
) {
  const filter = String(filterValue ?? "").trim().toLowerCase();

  if (!filter) return true;

  return COLUMNS.some((column) => {
    const value = column.editable
      ? draft[column.key]
      : row[column.key];

    return String(value ?? "").toLowerCase().includes(filter);
  });
}

function compareText(a: unknown, b: unknown) {
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function compareRows(
  a: SustainabilityProvRow,
  b: SustainabilityProvRow,
  sortKey: SortKey,
  sortDir: SortDir,
  draftA: DraftRow,
  draftB: DraftRow
) {
  const valueA = isEditableField(sortKey)
    ? draftA[sortKey]
    : a[sortKey];

  const valueB = isEditableField(sortKey)
    ? draftB[sortKey]
    : b[sortKey];

  let result = 0;

  if (MONTH_FIELDS.includes(sortKey)) {
    const numberA = Number(valueA);
    const numberB = Number(valueB);
    const validA = Number.isFinite(numberA);
    const validB = Number.isFinite(numberB);

    if (validA && validB) result = numberA - numberB;
    else if (validA) result = -1;
    else if (validB) result = 1;
    else result = compareText(valueA, valueB);
  } else {
    result = compareText(valueA, valueB);
  }

  if (result === 0 && sortKey !== "ruc") {
    result = compareText(a.ruc, b.ruc);
  }

  if (result === 0 && sortKey !== "concession_code") {
    result = compareText(a.concession_code, b.concession_code);
  }

  return sortDir === "asc" ? result : -result;
}

type DropdownProps = {
  value: string;
  options: SelectOption[];
  disabled: boolean;
  invalid: boolean;
  onChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
};

function Dropdown({
  value,
  options,
  disabled,
  invalid,
  onChange,
  onOpenChange,
}: DropdownProps) {
  const [open, setOpen] = useState(false);

  const selected =
    options.find((option) => option.value === value) ??
    (value
      ? {
          value,
          label: value,
        }
      : options[0]);

  function changeOpen(next: boolean) {
    setOpen(next);
    onOpenChange(next);
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        overflow: "visible",
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();

          if (disabled) return;

          changeOpen(!open);
        }}
        style={{
          width: "100%",
          minWidth: 0,
          textAlign: "left",
          background: invalid
            ? "rgba(120, 30, 30, 0.22)"
            : "rgba(0,0,0,.10)",
          border: invalid
            ? "1px solid rgba(255, 92, 92, 0.75)"
            : "1px solid var(--border)",
          color: "var(--text)",
          borderRadius: 10,
          padding: "10px 12px",
          outline: "none",
          fontWeight: 900,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.7 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            opacity: value ? 1 : 0.6,
          }}
          title={selected?.label ?? ""}
        >
          {selected?.label ?? ""}
        </span>

        <span style={{ opacity: 0.8, flexShrink: 0 }}>▾</span>
      </button>

      {open ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 99999,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.10)",
            background: "rgba(5, 25, 45, .99)",
            boxShadow: "0 10px 30px rgba(0,0,0,.45)",
            overflowY: "auto",
            overflowX: "hidden",
            maxHeight: 290,
            width: "max-content",
            minWidth: "100%",
            maxWidth: 360,
          }}
        >
          {options.map((option) => {
            const active = option.value === value;
            const empty = option.value === "";

            return (
              <button
                key={option.value || "__empty__"}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange(option.value);
                  changeOpen(false);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  background: active
                    ? "rgba(102,199,255,.18)"
                    : "transparent",
                  color: empty
                    ? "rgba(255,255,255,.55)"
                    : "rgba(255,255,255,.92)",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 900,
                  whiteSpace: "normal",
                  lineHeight: "16px",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = active
                    ? "rgba(102,199,255,.18)"
                    : "rgba(255,255,255,.06)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = active
                    ? "rgba(102,199,255,.18)"
                    : "transparent";
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

type RowItemProps = {
  row: SustainabilityProvRow;
  draft: DraftRow;
  columns: ColumnDefinition[];
  loading: boolean;
  saving: boolean;
  edited: boolean;
  invalid: boolean;
  onCellChange: (
    rowKey: string,
    field: keyof SustainabilityProvRow,
    value: string
  ) => void;
  cellBase: React.CSSProperties;
  gridH: string;
  gridV: string;
  rowBg: string;
  editedRowBg: string;
  invalidRowBg: string;
};

function RowItem({
  row,
  draft,
  columns,
  loading,
  saving,
  edited,
  invalid,
  onCellChange,
  cellBase,
  gridH,
  gridV,
  rowBg,
  editedRowBg,
  invalidRowBg,
}: RowItemProps) {
  const rowKey = getRowKey(row);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const currentRowBg = invalid
    ? invalidRowBg
    : edited
    ? editedRowBg
    : rowBg;

  const stickyRowBg = invalid
    ? "rgb(67, 27, 31)"
    : edited
    ? "rgb(18, 63, 50)"
    : "rgb(7, 30, 47)";

  return (
    <tr
      className="capex-tr"
      style={{
        position: "relative",
        zIndex: dropdownOpen ? 9999 : "auto",
      }}
    >
      {columns.map((column) => {
        const sticky =
          column.key === "ruc" || column.key === "concession_code";

        const stickyLeft =
          column.key === "ruc"
            ? 0
            : column.key === "concession_code"
            ? RUC_WIDTH
            : undefined;

        const rawValue = column.editable
          ? draft[column.key]
          : row[column.key];

        const displayValue =
          rawValue === null ||
          rawValue === undefined ||
          String(rawValue).trim() === ""
            ? "—"
            : String(rawValue);

        const fieldError =
          column.editable && isEditableField(column.key)
            ? validateField(column.key, draft[column.key])
            : null;

        if (!column.editable) {
          return (
            <td
              key={String(column.key)}
              className="capex-td"
              style={{
                ...cellBase,
                position: sticky ? "sticky" : "relative",
                left: stickyLeft,
                zIndex: sticky ? 8 : "auto",
                borderTop: gridH,
                borderBottom: gridH,
                borderRight: gridV,
                background: sticky ? stickyRowBg : currentRowBg,
                color: "rgb(185,185,185)",
                width: column.width,
                minWidth: column.width,
                maxWidth: column.width,
                fontWeight: sticky ? 800 : 400,
                boxShadow:
                  column.key === "concession_code"
                    ? "3px 0 8px rgba(0,0,0,.22)"
                    : "none",
              }}
              title={displayValue}
            >
              {displayValue}
            </td>
          );
        }

        if (column.kind === "select" && isEditableField(column.key)) {
          const options = SELECT_OPTIONS[column.key] ?? [];

          return (
            <td
              key={String(column.key)}
              className="capex-td"
              style={{
                ...cellBase,
                borderTop: gridH,
                borderBottom: gridH,
                borderRight: gridV,
                background: currentRowBg,
                padding: "6px 8px",
                width: column.width,
                minWidth: column.width,
                maxWidth: column.width,
                overflow: "visible",
                position: "relative",
                zIndex: dropdownOpen ? 9998 : "auto",
              }}
            >
              <Dropdown
                value={String(draft[column.key] ?? "")}
                options={options}
                disabled={loading || saving}
                invalid={!!fieldError}
                onOpenChange={setDropdownOpen}
                onChange={(value) =>
                  onCellChange(rowKey, column.key, value)
                }
              />
            </td>
          );
        }

        if (column.kind === "recpo") {
          const digits = getRecpoDigits(draft.recpo_register);

          return (
            <td
              key={String(column.key)}
              className="capex-td"
              style={{
                ...cellBase,
                borderTop: gridH,
                borderBottom: gridH,
                borderRight: gridV,
                background: currentRowBg,
                padding: "6px 8px",
                width: column.width,
                minWidth: column.width,
                maxWidth: column.width,
                overflow: "visible",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  border: fieldError
                    ? "1px solid rgba(255, 92, 92, 0.75)"
                    : "1px solid var(--border)",
                  background: fieldError
                    ? "rgba(120, 30, 30, 0.22)"
                    : "rgba(0,0,0,.10)",
                  borderRadius: 10,
                  overflow: "hidden",
                  boxSizing: "border-box",
                }}
              >
                <span
                  style={{
                    padding: "10px 0 10px 12px",
                    fontWeight: 900,
                    color: "var(--text)",
                    whiteSpace: "nowrap",
                  }}
                >
                  RECPO-
                </span>

                <input
                  type="text"
                  inputMode="numeric"
                  value={digits}
                  maxLength={6}
                  disabled={loading || saving}
                  onChange={(event) => {
                    const nextDigits = event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 6);

                    onCellChange(
                      rowKey,
                      "recpo_register",
                      `RECPO-${nextDigits}`
                    );
                  }}
                  style={{
                    width: "100%",
                    minWidth: 0,
                    border: "none",
                    background: "transparent",
                    color: "var(--text)",
                    outline: "none",
                    fontWeight: 900,
                    padding: "10px 12px 10px 2px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </td>
          );
        }

        if (column.key === "manager_name") {
          const value = String(draft.manager_name ?? "").slice(0, 100);

          return (
            <td
              key={String(column.key)}
              className="capex-td"
              style={{
                ...cellBase,
                borderTop: gridH,
                borderBottom: gridH,
                borderRight: gridV,
                background: currentRowBg,
                padding: "6px 8px",
                width: column.width,
                minWidth: column.width,
                maxWidth: column.width,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <input
                  type="text"
                  value={value}
                  maxLength={100}
                  disabled={loading || saving}
                  onChange={(event) =>
                    onCellChange(
                      rowKey,
                      "manager_name",
                      event.target.value.slice(0, 100)
                    )
                  }
                  style={{
                    width: "100%",
                    minWidth: 0,
                    background: fieldError
                      ? "rgba(120, 30, 30, 0.22)"
                      : "rgba(0,0,0,.10)",
                    border: fieldError
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
                    whiteSpace: "nowrap",
                    color:
                      value.length >= 100
                        ? "rgb(255,170,170)"
                        : "rgba(255,255,255,.65)",
                  }}
                >
                  {value.length}/100
                </span>
              </div>
            </td>
          );
        }

        if (column.key === "manager_phone") {
          const value = String(draft.manager_phone ?? "")
            .replace(/\D/g, "")
            .slice(0, 9);

          return (
            <td
              key={String(column.key)}
              className="capex-td"
              style={{
                ...cellBase,
                borderTop: gridH,
                borderBottom: gridH,
                borderRight: gridV,
                background: currentRowBg,
                padding: "6px 8px",
                width: column.width,
                minWidth: column.width,
                maxWidth: column.width,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={value}
                  maxLength={9}
                  disabled={loading || saving}
                  onChange={(event) =>
                    onCellChange(
                      rowKey,
                      "manager_phone",
                      event.target.value.replace(/\D/g, "").slice(0, 9)
                    )
                  }
                  style={{
                    width: "100%",
                    minWidth: 0,
                    background: fieldError
                      ? "rgba(120, 30, 30, 0.22)"
                      : "rgba(0,0,0,.10)",
                    border: fieldError
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
                    whiteSpace: "nowrap",
                    color:
                      value.length > 0 && value.length !== 9
                        ? "rgb(255,170,170)"
                        : "rgba(255,255,255,.65)",
                  }}
                >
                  {value.length}/9
                </span>
              </div>
            </td>
          );
        }

        if (column.key === "manager_mail") {
          const value = String(draft.manager_mail ?? "").slice(0, 100);

          return (
            <td
              key={String(column.key)}
              className="capex-td"
              style={{
                ...cellBase,
                borderTop: gridH,
                borderBottom: gridH,
                borderRight: gridV,
                background: currentRowBg,
                padding: "6px 8px",
                width: column.width,
                minWidth: column.width,
                maxWidth: column.width,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <input
                  type="text"
                  value={value}
                  maxLength={100}
                  disabled={loading || saving}
                  onChange={(event) => {
                    const nextValue = event.target.value
                      .replace(/[^A-Za-z0-9@._+\-]/g, "")
                      .slice(0, 100);

                    onCellChange(rowKey, "manager_mail", nextValue);
                  }}
                  style={{
                    width: "100%",
                    minWidth: 0,
                    background: fieldError
                      ? "rgba(120, 30, 30, 0.22)"
                      : "rgba(0,0,0,.10)",
                    border: fieldError
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
                    whiteSpace: "nowrap",
                    color:
                      value.length >= 100
                        ? "rgb(255,170,170)"
                        : "rgba(255,255,255,.65)",
                  }}
                >
                  {value.length}/100
                </span>
              </div>
            </td>
          );
        }

        return (
          <td
            key={String(column.key)}
            className="capex-td"
            style={{
              ...cellBase,
              borderTop: gridH,
              borderBottom: gridH,
              borderRight: gridV,
              background: currentRowBg,
              padding: "6px 8px",
              width: column.width,
              minWidth: column.width,
              maxWidth: column.width,
            }}
          >
            <input
              type="text"
              value={String(draft[column.key] ?? "")}
              disabled={loading || saving}
              onChange={(event) =>
                onCellChange(rowKey, column.key, event.target.value)
              }
              style={{
                width: "100%",
                minWidth: 0,
                background: fieldError
                  ? "rgba(120, 30, 30, 0.22)"
                  : "rgba(0,0,0,.10)",
                border: fieldError
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
          </td>
        );
      })}
    </tr>
  );
}

export default function SustainabilityProvTable() {
  const [rows, setRows] = useState<SustainabilityProvRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [originals, setOriginals] = useState<Record<string, DraftRow>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(true);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("ruc");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    setMsg(null);

    try {
      const response = (await apiGet(
        "/api/sustainability/prov-padron"
      )) as GetResp;

      if (!response?.ok) {
        throw new Error(
          response?.error || "No se pudo cargar el padrón de proveedores."
        );
      }

      const data = Array.isArray(response.rows) ? response.rows : [];
      const nextDrafts: Record<string, DraftRow> = {};
      const nextOriginals: Record<string, DraftRow> = {};

      for (const row of data) {
        const key = getRowKey(row);

        if (!String(row.ruc ?? "").trim()) continue;
        if (!String(row.concession_code ?? "").trim()) continue;

        const draft = toDraftRow(row);

        nextDrafts[key] = { ...draft };
        nextOriginals[key] = { ...draft };
      }

      setRows(data);
      setDrafts(nextDrafts);
      setOriginals(nextOriginals);
      setPage(1);
    } catch (error: any) {
      setMsg(
        `ERROR: ${String(
          error?.message || error || "No se pudo cargar el padrón."
        )}`
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [globalFilter, sortKey, sortDir, showDetails]);

  const visibleColumns = useMemo(() => {
    if (showDetails) return COLUMNS;

    return COLUMNS.filter((column) =>
      COLLAPSED_FIELDS.includes(column.key)
    );
  }, [showDetails]);

  const editedMap = useMemo(() => {
    const map: Record<string, boolean> = {};

    for (const key of Object.keys(drafts)) {
      map[key] = isRowEdited(drafts[key], originals[key]);
    }

    return map;
  }, [drafts, originals]);

  const invalidMap = useMemo(() => {
    const map: Record<string, boolean> = {};

    for (const key of Object.keys(drafts)) {
      map[key] = !!getRowValidationError(drafts[key]);
    }

    return map;
  }, [drafts]);

  const editedCount = useMemo(() => {
    return Object.values(editedMap).filter(Boolean).length;
  }, [editedMap]);

  const invalidEditedCount = useMemo(() => {
    return Object.keys(drafts).filter(
      (key) => editedMap[key] && invalidMap[key]
    ).length;
  }, [drafts, editedMap, invalidMap]);

  const hasInvalidEditedRows = invalidEditedCount > 0;

  const preparedRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      const rowKey = getRowKey(row);
      const draft = drafts[rowKey] ?? toDraftRow(row);

      return matchesGlobal(row, draft, globalFilter);
    });

    return [...filtered].sort((a, b) => {
      const draftA = drafts[getRowKey(a)] ?? toDraftRow(a);
      const draftB = drafts[getRowKey(b)] ?? toDraftRow(b);

      return compareRows(a, b, sortKey, sortDir, draftA, draftB);
    });
  }, [rows, drafts, globalFilter, sortKey, sortDir]);

  const totalRows = preparedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const visibleRows = preparedRows.slice(pageStart, pageEnd);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const onCellChange = useCallback(
    (
      rowKey: string,
      field: keyof SustainabilityProvRow,
      value: string
    ) => {
      setDrafts((current) => {
        const currentRow = current[rowKey];

        if (!currentRow) return current;

        return {
          ...current,
          [rowKey]: {
            ...currentRow,
            [field]:
              field === "recpo_register"
                ? normalizeRecpoRegister(value)
                : value,
          },
        };
      });
    },
    []
  );

  function onSortClick(key: SortKey) {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDir(
      key === "ruc" || key === "concession_code" ? "asc" : "desc"
    );
  }

  function getSortIndicator(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  async function onSaveAll() {
    const editedKeys = Object.keys(drafts).filter(
      (key) => editedMap[key]
    );

    if (!editedKeys.length) {
      setMsg("No hay filas editadas para guardar.");
      return;
    }

    const invalidKeys = editedKeys.filter((key) => invalidMap[key]);

    if (invalidKeys.length) {
      const firstKey = invalidKeys[0];
      const firstDraft = drafts[firstKey];
      const validationError = getRowValidationError(firstDraft);

      setMsg(
        `ERROR: hay ${invalidKeys.length} fila(s) con datos inválidos. ${
          validationError || ""
        }`
      );
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      const jobs = editedKeys.map(async (key) => {
        const draft = drafts[key];
        const payload = buildPayload(draft);

        const response = (await apiPost(
          "/api/sustainability/prov-padron",
          payload
        )) as SaveResp;

        if (!response?.ok) {
          throw new Error(
            response?.error ||
              `No se pudo guardar ${payload.ruc} / ${payload.concession_code}`
          );
        }

        return `${payload.ruc} / ${payload.concession_code}`;
      });

      const results = await Promise.allSettled(jobs);
      const savedRows: string[] = [];
      const failedRows: string[] = [];

      results.forEach((result, index) => {
        const key = editedKeys[index];
        const draft = drafts[key];
        const label = `${String(draft.ruc ?? "").trim()} / ${String(
          draft.concession_code ?? ""
        ).trim()}`;

        if (result.status === "fulfilled") {
          savedRows.push(result.value);
        } else {
          failedRows.push(
            `${label}: ${String(
              result.reason?.message ||
                result.reason ||
                "Error al guardar"
            )}`
          );
        }
      });

      if (!failedRows.length) {
        await loadData();
        setMsg(`OK: se guardaron ${savedRows.length} fila(s).`);
      } else if (savedRows.length) {
        await loadData();
        setMsg(
          `PARCIAL: se guardaron ${savedRows.length} fila(s). ${failedRows.join(
            " | "
          )}`
        );
      } else {
        setMsg(
          `ERROR: no se pudo guardar ninguna fila. ${failedRows.join(
            " | "
          )}`
        );
      }
    } catch (error: any) {
      setMsg(
        `ERROR: ${String(
          error?.message || error || "No se pudo guardar."
        )}`
      );
    } finally {
      setSaving(false);
    }
  }

  function onExportExcel() {
    const exportRows = preparedRows.map((row) => {
      const rowKey = getRowKey(row);
      const draft = drafts[rowKey] ?? toDraftRow(row);
      const out: Record<string, string | number> = {};

      for (const column of COLUMNS) {
        const raw = column.editable
          ? draft[column.key]
          : row[column.key];

        if (raw === null || raw === undefined) {
          out[column.label] = "";
        } else if (typeof raw === "boolean") {
          out[column.label] = raw ? "Sí" : "No";
        } else {
          out[column.label] = raw;
        }
      }

      return out;
    });

    if (!exportRows.length) {
      setMsg("No hay filas para exportar con el filtro seleccionado.");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(exportRows);

    ws["!cols"] = COLUMNS.map((column) => ({
      wch: Math.max(
        12,
        Math.min(40, Math.round(column.width / 8))
      ),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      "Padrón Proveedores"
    );

    const stamp = formatDateTime2Pe()
      .slice(0, 19)
      .replace(/[-: ]/g, "");

    XLSX.writeFile(
      wb,
      `sustainability_prov_padron_${stamp}.xlsx`
    );
  }

  const headerBg = "rgb(6, 36, 58)";
  const headerBorder = "1px solid rgba(191, 231, 255, 0.26)";
  const gridV = "1px solid rgba(191, 231, 255, 0.10)";
  const gridH = "1px solid rgba(191, 231, 255, 0.08)";
  const rowBg = "rgba(0,0,0,.10)";
  const editedRowBg = "rgba(30, 110, 74, 0.28)";
  const invalidRowBg = "rgba(120, 24, 24, 0.34)";

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
    padding: "8px 10px",
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
        <div style={{ fontWeight: 900 }}>
          Sostenibilidad · Padrón de Proveedores
        </div>

        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={() => setShowDetails((current) => !current)}
          disabled={loading || saving}
        >
          {showDetails ? "Contraer detalle" : "Desglosar detalle"}
        </Button>

        <div
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(92, 211, 158, 0.45)",
            background:
              editedCount > 0
                ? "rgba(38, 120, 88, 0.24)"
                : "rgba(255,255,255,0.06)",
            fontSize: 12,
            fontWeight: 900,
            color:
              editedCount > 0
                ? "rgb(160, 255, 214)"
                : "rgba(255,255,255,0.8)",
          }}
        >
          Editadas: {editedCount}
        </div>

        {invalidEditedCount > 0 ? (
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
            Inválidas: {invalidEditedCount}
          </div>
        ) : null}

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                opacity: 0.9,
              }}
            >
              Buscador global
            </div>

            <input
              type="text"
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Buscar RUC, minero, sede, concesión, responsable, estado..."
              style={{
                ...inputBase,
                minWidth: 390,
              }}
            />
          </div>

          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={loadData}
            disabled={loading || saving}
          >
            {loading ? "Cargando…" : "Refrescar"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={onExportExcel}
            disabled={
              loading ||
              saving ||
              preparedRows.length === 0
            }
          >
            Exportar Excel
          </Button>

          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={onSaveAll}
            disabled={
              loading ||
              saving ||
              editedCount === 0 ||
              hasInvalidEditedRows
            }
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
          maxHeight: "calc(100vh - 285px)",
          overflow: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ minWidth: "max-content" }}>
          <Table stickyHeader disableScrollWrapper>
            <colgroup>
              {visibleColumns.map((column) => (
                <col
                  key={String(column.key)}
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
                {visibleColumns.map((column) => {
                  const sticky =
                    column.key === "ruc" ||
                    column.key === "concession_code";

                  const stickyLeft =
                    column.key === "ruc"
                      ? 0
                      : column.key === "concession_code"
                      ? RUC_WIDTH
                      : undefined;

                  return (
                    <th
                      key={String(column.key)}
                      className="capex-th"
                      onClick={() => onSortClick(column.key)}
                      style={{
                        position: "sticky",
                        top: 0,
                        left: stickyLeft,
                        zIndex: sticky ? 40 : 20,
                        background: headerBg,
                        border: headerBorder,
                        borderBottom: headerBorder,
                        textAlign: "left",
                        padding: "8px",
                        fontSize: 12,
                        width: column.width,
                        minWidth: column.width,
                        maxWidth: column.width,
                        cursor: "pointer",
                        userSelect: "none",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        boxSizing: "border-box",
                        boxShadow:
                          column.key === "concession_code"
                            ? "3px 0 8px rgba(0,0,0,.28)"
                            : "none",
                      }}
                      title={column.label}
                    >
                      {column.label}
                      {getSortIndicator(column.key)}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {visibleRows.map((row, index) => {
                const rowKey = getRowKey(row);
                const draft = drafts[rowKey] ?? toDraftRow(row);

                return (
                  <RowItem
                    key={rowKey || `row-${index}`}
                    row={row}
                    draft={draft}
                    columns={visibleColumns}
                    loading={loading}
                    saving={saving}
                    edited={!!editedMap[rowKey]}
                    invalid={
                      !!editedMap[rowKey] && !!invalidMap[rowKey]
                    }
                    onCellChange={onCellChange}
                    cellBase={cellBase}
                    gridH={gridH}
                    gridV={gridV}
                    rowBg={rowBg}
                    editedRowBg={editedRowBg}
                    invalidRowBg={invalidRowBg}
                  />
                );
              })}

              {!loading && visibleRows.length === 0 ? (
                <tr className="capex-tr">
                  <td
                    className="capex-td"
                    colSpan={visibleColumns.length}
                    style={{
                      ...cellBase,
                      padding: 14,
                      fontWeight: 900,
                    }}
                  >
                    No hay filas para el filtro seleccionado.
                  </td>
                </tr>
              ) : null}

              {loading ? (
                <tr className="capex-tr">
                  <td
                    className="capex-td"
                    colSpan={visibleColumns.length}
                    style={{
                      ...cellBase,
                      padding: 14,
                      fontWeight: 900,
                    }}
                  >
                    Cargando padrón de proveedores…
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
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            opacity: 0.9,
          }}
        >
          Mostrando {totalRows === 0 ? 0 : pageStart + 1} -{" "}
          {Math.min(pageEnd, totalRows)} de {totalRows} filas
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={() =>
              setPage((current) => Math.max(1, current - 1))
            }
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
            onClick={() =>
              setPage((current) =>
                Math.min(totalPages, current + 1)
              )
            }
            disabled={
              loading || saving || safePage >= totalPages
            }
          >
            →
          </Button>
        </div>
      </div>
    </div>
  );
}