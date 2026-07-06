// src/components/fleet/FleetUnitsPermits.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Table } from "../ui/Table";


type AlertStatus = "Activo" | "Por Renovar <15d" | "Por Renovar <30d" | "Vencido" | "Sin Fecha";

type PermitRow = {
  plate: string | null;
  soat_exp_date: string | null;
  soat_alert: AlertStatus | string | null;
  rtv_exp_date: string | null;
  rtv_alert: AlertStatus | string | null;
  updated_at?: string | null;
};

type GetResp = {
  ok: boolean;
  rows?: PermitRow[];
  error?: string;
};

type SaveResp = {
  ok: boolean;
  count?: number;
  error?: string;
};

type SortKey = keyof PermitRow;
type SortDir = "asc" | "desc";

type AlertFilter = {
  scope: "soat" | "rtv";
  status: AlertStatus;
} | null;

type ImportPreviewRow = {
  row_num: number;
  plate: string;
  soat_exp_date: string;
  rtv_exp_date: string;
  status: "VÁLIDA" | "INVÁLIDA";
  errors: string;
  valid: boolean;
  source_duplicate_count: number;
  payload: {
    plate: string;
    soat_exp_date: string | null;
    rtv_exp_date: string | null;
  } | null;
};

type ImportSummary = {
  file_name: string;
  total_excel_rows: number;
  unique_rows: number;
  valid_rows: number;
  invalid_rows: number;
  repeated_plates: number;
  repeated_extra_rows: number;
  post_rows: number;
};

const PAGE_SIZE = 50;

const ALERT_ORDER: AlertStatus[] = [
  "Activo",
  "Por Renovar <30d",
  "Por Renovar <15d",
  "Vencido",
  "Sin Fecha",
];

const COLUMNS: {
  key: keyof PermitRow;
  label: string;
  kind: "text" | "date" | "alert";
  width: number;
  sortable: boolean;
}[] = [
  { key: "plate", label: "Placa", kind: "text", width: 120, sortable: true },
  { key: "soat_exp_date", label: "Vencimiento SOAT", kind: "date", width: 150, sortable: true },
  { key: "soat_alert", label: "Alerta SOAT", kind: "alert", width: 160, sortable: true },
  { key: "rtv_exp_date", label: "Vencimiento RTV", kind: "date", width: 150, sortable: true },
  { key: "rtv_alert", label: "Alerta RTV", kind: "alert", width: 160, sortable: true },
];

const SORTABLE_KEYS = COLUMNS.filter((c) => c.sortable).map((c) => c.key);

function normalizeText(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeHeader(v: unknown) {
  return normalizeText(v)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_./-]+/g, "");
}

function normalizePlateInput(v: unknown) {
  const raw = normalizeText(v).toUpperCase().replace(/\s+/g, "");
  if (/^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(raw)) return raw.replace("-", "");
  return raw;
}

function isValidNormalizedPlate(v: unknown) {
  return /^[A-Z0-9]{6}$/.test(normalizeText(v).toUpperCase());
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function excelDateNumberToIso(value: number) {
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed || !parsed.y || !parsed.m || !parsed.d) return "";
  return `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`;
}

function parseExcelDateToIso(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return excelDateNumberToIso(value);
  }

  const text = normalizeText(value);
  if (!text) return "";

  if (/^\d+(\.\d+)?$/.test(text)) {
    return excelDateNumberToIso(Number(text));
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const dd = Number(dmy[1]);
    const mm = Number(dmy[2]);
    const yyyy = Number(dmy[3]);

    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
      return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
    }
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
  }

  return "";
}

function isIsoDate(v: unknown) {
  return /^\d{4}-\d{2}-\d{2}$/.test(normalizeText(v));
}

function formatDateYyyyMmDd(value: unknown) {
  const v = normalizeText(value);
  if (!v) return "";

  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  return parseExcelDateToIso(v);
}

function getFileStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${hh}${mi}`;
}

function compareText(a: string, b: string) {
  return String(a || "").localeCompare(String(b || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function getSortValue(row: PermitRow, key: SortKey) {
  const value = row[key];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function compareByKey(a: PermitRow, b: PermitRow, key: SortKey, dir: SortDir) {
  const av = getSortValue(a, key);
  const bv = getSortValue(b, key);

  const cmp = compareText(av, bv);
  return dir === "asc" ? cmp : -cmp;
}

function inDateRange(value: unknown, from: string, to: string) {
  const d = formatDateYyyyMmDd(value);
  if (from && (!d || d < from)) return false;
  if (to && (!d || d > to)) return false;
  return true;
}

function matchesSearch(row: PermitRow, search: string) {
  const q = normalizeText(search).toLowerCase();
  if (!q) return true;

  const values = [
    row.plate,
    row.soat_alert,
    row.rtv_alert,
  ];

  return values.some((v) => String(v ?? "").toLowerCase().includes(q));
}

function countAlerts(rows: PermitRow[], key: "soat_alert" | "rtv_alert") {
  const counts = Object.fromEntries(ALERT_ORDER.map((x) => [x, 0])) as Record<AlertStatus, number>;

  for (const row of rows) {
    const status = normalizeText(row[key]) as AlertStatus;
    if (ALERT_ORDER.includes(status)) {
      counts[status] += 1;
    }
  }

  return counts;
}

function getAlertStyle(status: unknown): React.CSSProperties {
  const s = normalizeText(status);

  if (s === "Activo") {
    return {
      border: "1px solid rgba(102,199,255,.45)",
      background: "rgba(102,199,255,.10)",
    };
  }

  if (s === "Por Renovar <30d") {
    return {
      border: "1px solid rgba(255,210,80,.45)",
      background: "rgba(255,210,80,.10)",
    };
  }

  if (s === "Por Renovar <15d") {
    return {
      border: "1px solid rgba(255,170,60,.45)",
      background: "rgba(255,170,60,.12)",
    };
  }

  if (s === "Vencido") {
    return {
      border: "1px solid rgba(255,80,80,.50)",
      background: "rgba(255,80,80,.13)",
    };
  }

  return {
    border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(255,255,255,.06)",
  };
}

function buildImportSummary(
  previewRows: ImportPreviewRow[],
  file_name: string,
  total_excel_rows: number
): ImportSummary {
  const validRows = previewRows.filter((row) => row.valid);

  const repeatedPlates = previewRows.filter((row) => row.source_duplicate_count > 1).length;
  const repeatedExtraRows = previewRows.reduce(
    (acc, row) => acc + (row.source_duplicate_count > 1 ? row.source_duplicate_count - 1 : 0),
    0
  );

  return {
    file_name,
    total_excel_rows,
    unique_rows: previewRows.length,
    valid_rows: validRows.length,
    invalid_rows: previewRows.length - validRows.length,
    repeated_plates: repeatedPlates,
    repeated_extra_rows: repeatedExtraRows,
    post_rows: validRows.length,
  };
}

function appendError(base: string, msg: string) {
  return base ? `${base} | ${msg}` : msg;
}

function revalidatePreviewRows(
  draftRows: ImportPreviewRow[],
  file_name: string,
  total_excel_rows: number
): { rows: ImportPreviewRow[]; summary: ImportSummary } {
  const plateCounts = new Map<string, number>();

  for (const row of draftRows) {
    const plate = normalizePlateInput(row.plate);
    if (!plate) continue;
    plateCounts.set(plate, (plateCounts.get(plate) || 0) + 1);
  }

  const rows = draftRows.map((draft): ImportPreviewRow => {
    const plate = normalizePlateInput(draft.plate);
    const soat_exp_date = normalizeText(draft.soat_exp_date);
    const rtv_exp_date = normalizeText(draft.rtv_exp_date);

    let errors = "";

    if (!plate) {
      errors = appendError(errors, "plate vacío");
    } else if (!isValidNormalizedPlate(plate)) {
      errors = appendError(errors, "plate debe tener 6 caracteres alfanuméricos");
    }

    const duplicateCount = plate ? plateCounts.get(plate) || 0 : 0;

    if (duplicateCount > 1) {
      errors = appendError(errors, "plate repetida en preview");
    }

    if (soat_exp_date && !isIsoDate(soat_exp_date)) {
      errors = appendError(errors, "soat_exp_date inválida");
    }

    if (rtv_exp_date && !isIsoDate(rtv_exp_date)) {
      errors = appendError(errors, "rtv_exp_date inválida");
    }

    const valid = !errors;

    return {
      ...draft,
      plate,
      soat_exp_date,
      rtv_exp_date,
      status: valid ? "VÁLIDA" : "INVÁLIDA",
      errors,
      valid,
      source_duplicate_count: duplicateCount,
      payload: valid
        ? {
            plate,
            soat_exp_date: soat_exp_date || null,
            rtv_exp_date: rtv_exp_date || null,
          }
        : null,
    };
  });

  const orderedRows = [...rows].sort((a, b) => {
    const plateCmp = compareText(a.plate, b.plate);
    if (plateCmp !== 0) return plateCmp;
    return a.row_num - b.row_num;
  });

  return {
    rows: orderedRows,
    summary: buildImportSummary(orderedRows, file_name, total_excel_rows),
  };
}

export default function FleetUnitsPermits() {
  const [rows, setRows] = useState<PermitRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [alertFilter, setAlertFilter] = useState<AlertFilter>(null);
  const [soatFrom, setSoatFrom] = useState("");
  const [soatTo, setSoatTo] = useState("");
  const [rtvFrom, setRtvFrom] = useState("");
  const [rtvTo, setRtvTo] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("plate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const busy = loading || importing || exporting;

  const loadData = useCallback(async () => {
    setLoading(true);
    setMsg(null);

    try {
      const r = (await apiGet("/api/logistics/flota/soat-rtv")) as GetResp;
      const data = Array.isArray(r?.rows) ? r.rows : [];

      setRows(data);
      setPage(1);
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo cargar SOAT/RTV")}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [search, alertFilter, soatFrom, soatTo, rtvFrom, rtvTo, sortKey, sortDir]);

  const alertBaseRows = useMemo(() => {
    return rows.filter((row) => {
      if (!matchesSearch(row, search)) return false;
      if (!inDateRange(row.soat_exp_date, soatFrom, soatTo)) return false;
      if (!inDateRange(row.rtv_exp_date, rtvFrom, rtvTo)) return false;
      return true;
    });
  }, [rows, search, soatFrom, soatTo, rtvFrom, rtvTo]);

  const filteredRows = useMemo(() => {
    return alertBaseRows.filter((row) => {
      if (!alertFilter) return true;

      const key = alertFilter.scope === "soat" ? "soat_alert" : "rtv_alert";
      return normalizeText(row[key]) === alertFilter.status;
    });
  }, [alertBaseRows, alertFilter]);

  const soatCounts = useMemo(() => countAlerts(alertBaseRows, "soat_alert"), [alertBaseRows]);
  const rtvCounts = useMemo(() => countAlerts(alertBaseRows, "rtv_alert"), [alertBaseRows]);

  const preparedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const primary = compareByKey(a, b, sortKey, sortDir);
      if (primary !== 0) return primary;
      return compareByKey(a, b, "plate", "asc");
    });
  }, [filteredRows, sortKey, sortDir]);

  const totalRows = preparedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const visibleRows = preparedRows.slice(pageStart, pageEnd);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function onSortClick(key: keyof PermitRow) {
    if (!SORTABLE_KEYS.includes(key)) return;

    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDir("asc");
  }

  function getSortIndicator(key: keyof PermitRow) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  function onExportExcel() {
    if (!preparedRows.length) {
      setMsg("No hay filas para exportar con el filtro seleccionado.");
      return;
    }

    setExporting(true);
    setMsg(null);

    try {
      const exportRows = preparedRows.map((row) => ({
        Placa: row.plate ?? "",
        "Vencimiento SOAT": formatDateYyyyMmDd(row.soat_exp_date),
        "Alerta SOAT": row.soat_alert ?? "",
        "Vencimiento RTV": formatDateYyyyMmDd(row.rtv_exp_date),
        "Alerta RTV": row.rtv_alert ?? "",
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      ws["!cols"] = [
        { wch: 14 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "SOAT_RTV");

      XLSX.writeFile(wb, `flota_soat_rtv_view_${getFileStamp()}.xlsx`);
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo exportar")}`);
    } finally {
      setExporting(false);
    }
  }

  function onExportFormat() {
    if (!rows.length) {
      setMsg("No hay filas para exportar formato.");
      return;
    }

    setExporting(true);
    setMsg(null);

    try {
      const exportRows = rows
        .map((row) => ({
          plate: normalizeText(row.plate).toUpperCase(),
          soat_exp_date: formatDateYyyyMmDd(row.soat_exp_date),
          rtv_exp_date: formatDateYyyyMmDd(row.rtv_exp_date),
        }))
        .sort((a, b) => compareText(a.plate, b.plate));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      ws["!cols"] = [
        { wch: 14 },
        { wch: 16 },
        { wch: 16 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Formato");

      XLSX.writeFile(wb, `formato_flota_soat_rtv_${getFileStamp()}.xlsx`);
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo exportar formato")}`);
    } finally {
      setExporting(false);
    }
  }

  function onClickImport() {
    fileInputRef.current?.click();
  }

  function closePreview() {
    if (importing) return;
    setPreviewOpen(false);
    setPreviewRows([]);
    setImportSummary(null);
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setMsg(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

      if (!workbook.SheetNames.length) {
        throw new Error("El archivo no tiene hojas.");
      }

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const matrix = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: true,
      }) as unknown[][];

      if (!matrix.length) {
        throw new Error("La primera hoja está vacía.");
      }

      const headersRaw = (matrix[0] || []).map((x) => normalizeText(x));
      const headersNorm = headersRaw.map((x) => normalizeHeader(x));

      const plateIdx = headersNorm.findIndex((x) => x === "plate" || x === "placa");
      const soatIdx = headersNorm.findIndex((x) => x === "soatexpdate" || x === "vencimientosoat" || x === "fechasoat" || x === "soat");
      const rtvIdx = headersNorm.findIndex((x) => x === "rtvexpdate" || x === "vencimientortv" || x === "fechartv" || x === "rtv");

      if (plateIdx < 0) throw new Error("Falta columna plate.");
      if (soatIdx < 0) throw new Error("Falta columna soat_exp_date.");
      if (rtvIdx < 0) throw new Error("Falta columna rtv_exp_date.");

      const draftRows: ImportPreviewRow[] = [];
      let totalExcelRows = 0;

      for (let i = 1; i < matrix.length; i++) {
        const excelRowNum = i + 1;
        const row = matrix[i] || [];

        const rawPlate = normalizeText(row[plateIdx]);
        const rawSoat = row[soatIdx];
        const rawRtv = row[rtvIdx];

        if (!rawPlate && !normalizeText(rawSoat) && !normalizeText(rawRtv)) continue;

        totalExcelRows++;

        const plate = normalizePlateInput(rawPlate);
        const soat_exp_date = parseExcelDateToIso(rawSoat);
        const rtv_exp_date = parseExcelDateToIso(rawRtv);

        draftRows.push({
          row_num: excelRowNum,
          plate,
          soat_exp_date,
          rtv_exp_date,
          status: "INVÁLIDA",
          errors: "",
          valid: false,
          source_duplicate_count: 0,
          payload: null,
        });
      }

      if (!draftRows.length) {
        throw new Error("No hay filas para importar.");
      }

      const { rows: preview, summary } = revalidatePreviewRows(draftRows, file.name, totalExcelRows);

      setPreviewRows(preview);
      setImportSummary(summary);
      setPreviewOpen(true);
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo importar el archivo")}`);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function onEditPreviewCell(
    rowNum: number,
    field: "plate" | "soat_exp_date" | "rtv_exp_date",
    value: string
  ) {
    const fileName = importSummary?.file_name || "SOAT_RTV";
    const totalExcelRows = importSummary?.total_excel_rows || previewRows.length;

    const draftRows = previewRows.map((row) =>
      row.row_num === rowNum
        ? {
            ...row,
            [field]: field === "plate" ? normalizePlateInput(value) : parseExcelDateToIso(value) || value,
          }
        : row
    );

    const { rows: nextRows, summary } = revalidatePreviewRows(draftRows, fileName, totalExcelRows);

    setPreviewRows(nextRows);
    setImportSummary(summary);
  }

  async function confirmImport() {
    if (!previewRows.length) {
      setMsg("No hay filas para importar.");
      return;
    }

    if (previewRows.some((row) => !row.valid)) {
      setMsg("ERROR: corrige las filas inválidas del preview antes de importar.");
      return;
    }

    const payloadRows = previewRows
      .filter((row) => row.payload)
      .map((row) => row.payload!);

    if (!payloadRows.length) {
      setMsg("No hay filas válidas para importar.");
      return;
    }

    setImporting(true);
    setMsg(null);

    try {
      const rr = (await apiPost("/api/logistics/flota/soat-rtv", { rows: payloadRows })) as SaveResp;

      if (!rr?.ok) {
        throw new Error(rr?.error || "No se pudo importar SOAT/RTV.");
      }

      await loadData();

      setPreviewOpen(false);
      setPreviewRows([]);
      setImportSummary(null);
      setMsg(`OK: se importaron ${Number(rr?.count ?? payloadRows.length)} placa(s).`);
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo importar")}`);
    } finally {
      setImporting(false);
    }
  }

  const headerBg = "rgb(6, 36, 58)";
  const headerBorder = "1px solid rgba(191, 231, 255, 0.26)";
  const gridV = "1px solid rgba(191, 231, 255, 0.10)";
  const gridH = "1px solid rgba(191, 231, 255, 0.08)";
  const rowBg = "rgba(0,0,0,.10)";

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

  const previewInputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(0,0,0,.12)",
    border: "1px solid rgba(191,231,255,.16)",
    color: "var(--text)",
    borderRadius: 8,
    padding: "6px 8px",
    outline: "none",
    fontWeight: 800,
    fontSize: 12,
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
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={onImportFile}
        style={{ display: "none" }}
      />

      <div
        className="panel-inner"
        style={{
          padding: "10px 12px",
          display: "grid",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 900 }}>Flota · SOAT / RTV</div>

          <Button type="button" size="sm" variant="ghost" onClick={loadData} disabled={busy}>
            {loading ? "Cargando…" : "Recargar"}
          </Button>

          <Button type="button" size="sm" variant="ghost" onClick={onExportExcel} disabled={busy || !preparedRows.length}>
            {exporting ? "Exportando…" : "Exportar Excel"}
          </Button>

          <Button type="button" size="sm" variant="ghost" onClick={onExportFormat} disabled={busy || !rows.length}>
            Exportar Formato
          </Button>

          <Button type="button" size="sm" variant="primary" onClick={onClickImport} disabled={busy}>
            {importing ? "Importando…" : "Importar Formato"}
          </Button>

          <div style={{ fontSize: 12, opacity: 0.78, fontWeight: 800 }}>
            {preparedRows.length} de {rows.length} fila(s)
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.9, minWidth: 45 }}>SOAT</div>
            {ALERT_ORDER.map((status) => {
              const active = alertFilter?.scope === "soat" && alertFilter.status === status;

              return (
                <button
                  key={`soat_${status}`}
                  type="button"
                  onClick={() =>
                    setAlertFilter((prev) =>
                      prev?.scope === "soat" && prev.status === status
                        ? null
                        : { scope: "soat", status }
                    )
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 900,
                    color: "var(--text)",
                    cursor: "pointer",
                    outline: active ? "2px solid rgba(255,255,255,.55)" : "none",
                    boxShadow: active ? "0 0 0 2px rgba(102,199,255,.18)" : "none",
                    ...getAlertStyle(status),
                  }}
                >
                  {status}: {soatCounts[status]}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.9, minWidth: 45 }}>RTV</div>
            {ALERT_ORDER.map((status) => {
              const active = alertFilter?.scope === "rtv" && alertFilter.status === status;

              return (
                <button
                  key={`rtv_${status}`}
                  type="button"
                  onClick={() =>
                    setAlertFilter((prev) =>
                      prev?.scope === "rtv" && prev.status === status
                        ? null
                        : { scope: "rtv", status }
                    )
                  }
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 900,
                    color: "var(--text)",
                    cursor: "pointer",
                    outline: active ? "2px solid rgba(255,255,255,.55)" : "none",
                    boxShadow: active ? "0 0 0 2px rgba(102,199,255,.18)" : "none",
                    ...getAlertStyle(status),
                  }}
                >
                  {status}: {rtvCounts[status]}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px, 1.2fr) repeat(4, minmax(145px, .7fr))",
            gap: 8,
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>Buscar placa o alerta</span>
            <Input
              value={search}
              onChange={(e: any) => setSearch(String(e.target.value ?? ""))}
              placeholder="Ej: ABC123, Vencido, Por Renovar"
              disabled={busy}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>SOAT desde</span>
            <input
              type="date"
              value={soatFrom}
              onChange={(e) => setSoatFrom(e.target.value)}
              disabled={busy}
              style={inputBase}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>SOAT hasta</span>
            <input
              type="date"
              value={soatTo}
              onChange={(e) => setSoatTo(e.target.value)}
              disabled={busy}
              style={inputBase}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>RTV desde</span>
            <input
              type="date"
              value={rtvFrom}
              onChange={(e) => setRtvFrom(e.target.value)}
              disabled={busy}
              style={inputBase}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>RTV hasta</span>
            <input
              type="date"
              value={rtvTo}
              onChange={(e) => setRtvTo(e.target.value)}
              disabled={busy}
              style={inputBase}
            />
          </label>
        </div>

        {msg ? (
          <div
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: msg.startsWith("ERROR")
                ? "1px solid rgba(255,80,80,.45)"
                : "1px solid rgba(102,199,255,.35)",
              background: msg.startsWith("ERROR")
                ? "rgba(255,80,80,.10)"
                : "rgba(102,199,255,.08)",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            {msg}
          </div>
        ) : null}
      </div>

      <div
        className="panel-inner"
        style={{
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
          padding: 0,
          display: "grid",
          gridTemplateRows: "1fr auto",
        }}
      >
        <div
          style={{
            minWidth: 0,
            minHeight: 0,
            overflow: "auto",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
          }}
        >
          <div style={{ width: "max-content", minWidth: "100%" }}>
            <Table stickyHeader disableScrollWrapper>
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th
                      key={String(c.key)}
                      className="capex-th"
                      onClick={() => onSortClick(c.key)}
                      style={{
                        ...stickyHead,
                        minWidth: c.width,
                        width: c.width,
                        maxWidth: c.width,
                        border: headerBorder,
                        padding: "8px 8px",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                        textAlign: "left",
                        cursor: c.sortable ? "pointer" : "default",
                        userSelect: "none",
                      }}
                    >
                      {c.label}
                      {getSortIndicator(c.key)}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {visibleRows.map((row) => {
                  const rowKey = normalizeText(row.plate) || Math.random().toString(36);
                  return (
                    <tr key={rowKey} className="capex-tr">
                      {COLUMNS.map((c) => {
                        const raw = row[c.key];
                        const display =
                          c.kind === "date" ? formatDateYyyyMmDd(raw) : normalizeText(raw);

                        return (
                          <td
                            key={String(c.key)}
                            className="capex-td"
                            title={display || "—"}
                            style={{
                              ...cellBase,
                              minWidth: c.width,
                              width: c.width,
                              maxWidth: c.width,
                              borderTop: gridH,
                              borderBottom: gridH,
                              borderRight: gridV,
                              background: rowBg,
                              fontWeight: c.key === "plate" ? 900 : 700,
                            }}
                          >
                            {c.kind === "alert" ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  maxWidth: "100%",
                                  padding: "4px 8px",
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 900,
                                  ...getAlertStyle(raw),
                                }}
                              >
                                {display || "—"}
                              </span>
                            ) : (
                              display || "—"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {!visibleRows.length ? (
                  <tr>
                    <td
                      colSpan={COLUMNS.length}
                      className="capex-td"
                      style={{
                        ...cellBase,
                        padding: 14,
                        borderTop: gridH,
                        background: rowBg,
                        fontWeight: 900,
                      }}
                    >
                      {loading ? "Cargando…" : "No hay filas para mostrar."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </div>
        </div>

        <div
          style={{
            borderTop: "1px solid rgba(191,231,255,.12)",
            padding: "8px 10px",
            display: "flex",
            gap: 8,
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            background: "rgba(0,0,0,.10)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>
            Página {safePage} de {totalPages} · Mostrando {visibleRows.length} de {totalRows}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPage(1)}
              disabled={safePage <= 1}
            >
              «
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            >
              Anterior
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            >
              Siguiente
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPage(totalPages)}
              disabled={safePage >= totalPages}
            >
              »
            </Button>
          </div>
        </div>
      </div>

      {previewOpen ? (
        <div
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
              width: "min(1100px, 96vw)",
              height: "min(82vh, 760px)",
              display: "grid",
              gridTemplateRows: "auto auto 1fr auto",
              gap: 10,
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
                <div style={{ fontSize: 18, fontWeight: 900 }}>
                  Preview de importación SOAT / RTV
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Columnas válidas: plate, soat_exp_date, rtv_exp_date.
                </div>
              </div>

              <Button type="button" size="sm" variant="default" onClick={closePreview} disabled={importing}>
                Cerrar
              </Button>
            </div>

            {importSummary ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Archivo: {importSummary.file_name}
                </div>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Filas Excel: {importSummary.total_excel_rows}
                </div>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Filas únicas: {importSummary.unique_rows}
                </div>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(102,199,255,.45)", background: "rgba(102,199,255,.10)", fontSize: 12, fontWeight: 900 }}>
                  Válidas: {importSummary.valid_rows}
                </div>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: importSummary.invalid_rows > 0 ? "1px solid rgba(255,80,80,.45)" : "1px solid rgba(255,255,255,0.12)", background: importSummary.invalid_rows > 0 ? "rgba(255,80,80,.10)" : "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Inválidas: {importSummary.invalid_rows}
                </div>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: importSummary.repeated_plates > 0 ? "1px solid rgba(255,170,60,.45)" : "1px solid rgba(255,255,255,0.12)", background: importSummary.repeated_plates > 0 ? "rgba(255,170,60,.10)" : "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Placas repetidas: {importSummary.repeated_plates}
                </div>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: importSummary.repeated_extra_rows > 0 ? "1px solid rgba(255,170,60,.45)" : "1px solid rgba(255,255,255,0.12)", background: importSummary.repeated_extra_rows > 0 ? "rgba(255,170,60,.10)" : "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Filas extra repetidas: {importSummary.repeated_extra_rows}
                </div>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(102,199,255,.45)", background: "rgba(102,199,255,.10)", fontSize: 12, fontWeight: 900 }}>
                  A postear: {importSummary.post_rows}
                </div>
              </div>
            ) : null}

            <div
              style={{
                minWidth: 0,
                minHeight: 0,
                overflow: "auto",
                border: "1px solid rgba(191,231,255,.12)",
                borderRadius: 12,
              }}
            >
              <div style={{ width: "max-content", minWidth: "100%" }}>
                <Table stickyHeader disableScrollWrapper>
                  <thead>
                    <tr>
                      {["fila", "plate", "soat_exp_date", "rtv_exp_date", "estado", "repetido", "errores"].map((h) => (
                        <th
                          key={h}
                          className="capex-th"
                          style={{
                            position: "sticky",
                            top: 0,
                            zIndex: 20,
                            background: headerBg,
                            border: headerBorder,
                            padding: "8px 8px",
                            fontSize: 12,
                            whiteSpace: "nowrap",
                            textAlign: "left",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {previewRows.map((row) => {
                      const bg = row.valid ? rowBg : "rgba(255,80,80,.10)";

                      return (
                        <tr key={`${row.row_num}_${row.plate}`} className="capex-tr">
                          <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>
                            {row.row_num}
                          </td>

                          <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg, minWidth: 140 }}>
                            <input
                              value={row.plate}
                              onChange={(e) => onEditPreviewCell(row.row_num, "plate", String(e.target.value || "").toUpperCase())}
                              style={previewInputStyle}
                            />
                          </td>

                          <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg, minWidth: 150 }}>
                            <input
                              type="date"
                              value={row.soat_exp_date}
                              onChange={(e) => onEditPreviewCell(row.row_num, "soat_exp_date", e.target.value)}
                              style={previewInputStyle}
                            />
                          </td>

                          <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg, minWidth: 150 }}>
                            <input
                              type="date"
                              value={row.rtv_exp_date}
                              onChange={(e) => onEditPreviewCell(row.row_num, "rtv_exp_date", e.target.value)}
                              style={previewInputStyle}
                            />
                          </td>

                          <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg, fontWeight: 900 }}>
                            {row.status}
                          </td>

                          <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg, fontWeight: 900 }}>
                            {row.source_duplicate_count > 1 ? "Sí" : "No"}
                          </td>

                          <td
                            className="capex-td"
                            title={row.errors || "—"}
                            style={{
                              ...cellBase,
                              borderTop: gridH,
                              borderBottom: gridH,
                              borderRight: gridV,
                              background: bg,
                              minWidth: 300,
                              maxWidth: 500,
                            }}
                          >
                            {row.errors || "—"}
                          </td>
                        </tr>
                      );
                    })}

                    {!previewRows.length ? (
                      <tr>
                        <td colSpan={7} className="capex-td" style={{ ...cellBase, padding: 14, background: rowBg, fontWeight: 900 }}>
                          No hay filas para preview.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </Table>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9 }}>
                {previewRows.some((row) => !row.valid)
                  ? "Corrige las filas inválidas para habilitar la importación."
                  : `Se reemplazará la tabla con ${previewRows.length} placa(s).`}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button type="button" size="sm" variant="default" onClick={closePreview} disabled={importing}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={confirmImport}
                  disabled={importing || previewRows.length === 0 || previewRows.some((row) => !row.valid)}
                >
                  {importing ? "Importando…" : "Confirmar importación"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}