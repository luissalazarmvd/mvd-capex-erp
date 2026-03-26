// src/components/logistics/LogisticsMRATable.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

const PAGE_SIZE = 200;

const COLUMN_KEYS = [
  "mat_code",
  "mat_desc",
  "mat_unit",
  "first_act",
  "second_act",
  "third_act",
  "fourth_act",
  "fifth_act",
  "sixth_act",
  "seventh_act",
  "eighth_act",
  "ninth_act",
  "tenth_act",
  "eleventh_act",
  "twelve_act",
  "avg_prev",
  "cons_act",
  "val_act",
  "avg_act",
  "dif_act_prev",
  "frequency_act",
  "st_dev_act",
  "var_coef_act",
  "min_act",
  "max_act",
  "min_val_act",
  "max_val_act",
  "sem_1",
  "sem_1_qty",
  "sem_1_val",
  "rq_act",
  "po_act",
  "buy_act",
  "buy_val_act",
  "ceva_act",
  "stock_qty",
  "stock_transit_act",
  "stock_transit_val_act",
  "sem_2",
  "sem_2_qty",
  "sem_2_act",
  "sem_2_val",
  "repos_act",
  "repos_act_2",
  "repos_cost_act",
  "repos_cost_act_2",
  "stock_transit_buy_act",
  "stock_transit_buy_val_act",
  "mat_pu",
  "inv_val_act",
  "fcs_day_act",
  "fcs_month_act",
  "fcs_day_act_2",
  "fcs_month_act_2",
  "rotation",
  "warehouse_location_1",
  "warehouse_location_2",
] as const;

const IMPORT_HEADERS = [
  "mat_code",
  "mat_desc",
  "mat_unit",
  "mat_fam",
  "mat_category",
] as const;

type ColumnKey = (typeof COLUMN_KEYS)[number];
type ImportKey = (typeof IMPORT_HEADERS)[number];

type MRAStgRow = Partial<Record<ColumnKey, string | number | null>> & {
  [key: string]: string | number | null | undefined;
};

type MRADimRow = {
  mat_code: string | null;
  mat_desc: string | null;
  mat_unit: string | null;
  mat_fam: string | null;
  mat_category: string | null;
  updated_at?: string | null;
};

type MRAImportRow = {
  mat_code: string | null;
  mat_desc: string | null;
  mat_unit: string | null;
  mat_fam: string | null;
  mat_category: string | null;
};

type MRAImportPreviewRow = MRAImportRow & {
  row_num: number;
  duplicate_count: number;
  is_duplicate: boolean;
};

type ImportSummary = {
  file_name: string;
  total_excel_rows: number;
  valid_rows: number;
  repeated_codes: number;
  repeated_rows: number;
  repeated_extra_rows: number;
};

type GetStgResp = {
  ok: boolean;
  rows?: MRAStgRow[];
  error?: string;
};

type GetDimResp = {
  ok: boolean;
  rows?: MRADimRow[];
  error?: string;
};

type PostDimResp = {
  ok: boolean;
  count?: number;
  error?: string;
};

type SortDir = "asc" | "desc";

const WIDTHS: Partial<Record<ColumnKey, number>> = {
  mat_code: 120,
  mat_desc: 260,
  mat_unit: 100,
  warehouse_location_1: 180,
  warehouse_location_2: 180,
};

const COLUMNS = COLUMN_KEYS.map((key) => ({
  key,
  label: getColumnLabel(key),
  width: WIDTHS[key] ?? 110,
  sticky:
    key === "mat_code"
      ? true
      : key === "mat_desc"
      ? true
      : false,
  left:
    key === "mat_code"
      ? 0
      : key === "mat_desc"
      ? (WIDTHS.mat_code ?? 120)
      : undefined,
}));

function normalizeText(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeCode(v: unknown) {
  return normalizeText(v).toUpperCase();
}

function isBlank(v: unknown) {
  return v === null || v === undefined || String(v).trim() === "";
}

function toNullableString(v: unknown) {
  const text = normalizeText(v);
  return text === "" ? null : text;
}

function toHeaderKey(v: unknown) {
  return normalizeText(v).toLowerCase();
}

function formatCellValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";

  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });
  }

  return String(value);
}

function compareSmart(a: unknown, b: unknown) {
  const av = a ?? "";
  const bv = b ?? "";

  const aNum =
    typeof av === "number"
      ? av
      : !isBlank(av) && !Number.isNaN(Number(String(av).replace(/,/g, "")))
      ? Number(String(av).replace(/,/g, ""))
      : null;

  const bNum =
    typeof bv === "number"
      ? bv
      : !isBlank(bv) && !Number.isNaN(Number(String(bv).replace(/,/g, "")))
      ? Number(String(bv).replace(/,/g, ""))
      : null;

  if (aNum !== null && bNum !== null) return aNum - bNum;

  return String(av).localeCompare(String(bv), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function buildExportRows(rows: MRAStgRow[]) {
  return rows.map((row) => {
    const out: Record<string, string | number | null> = {};
    for (const col of COLUMNS) {
      out[col.label] = (row[col.key] as string | number | null) ?? null;
    }
    return out;
  });
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

function capitalizeFirst(text: string) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getColumnLabel(key: ColumnKey) {
  const offsets: Partial<Record<ColumnKey, number>> = {
    first_act: 11,
    second_act: 10,
    third_act: 9,
    fourth_act: 8,
    fifth_act: 7,
    sixth_act: 6,
    seventh_act: 5,
    eighth_act: 4,
    ninth_act: 3,
    tenth_act: 2,
    eleventh_act: 1,
    twelve_act: 0,
  };

  const offset = offsets[key];

  if (offset === undefined) return key;

  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - offset);

  const label = new Intl.DateTimeFormat("es-PE", {
    month: "long",
  }).format(d);

  return capitalizeFirst(label);
}

export default function LogisticsMRATable() {
  const [stgRows, setStgRows] = useState<MRAStgRow[]>([]);
  const [dimRows, setDimRows] = useState<MRADimRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [mraOnly, setMraOnly] = useState(false);
  const [sortKey, setSortKey] = useState<ColumnKey>("mat_code");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<MRAImportPreviewRow[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setMsg(null);

    try {
      const [stgResp, dimResp] = await Promise.all([
        apiGet("/api/logistics/mra/stg") as Promise<GetStgResp>,
        apiGet("/api/logistics/mra/dim") as Promise<GetDimResp>,
      ]);

      if (!stgResp?.ok) {
        throw new Error(stgResp?.error || "No se pudo cargar STG.");
      }

      if (!dimResp?.ok) {
        throw new Error(dimResp?.error || "No se pudo cargar DIM.");
      }

      setStgRows(Array.isArray(stgResp.rows) ? stgResp.rows : []);
      setDimRows(Array.isArray(dimResp.rows) ? dimResp.rows : []);
      setPage(1);
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo cargar información")}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDimOnly = useCallback(async () => {
    try {
      const dimResp = (await apiGet("/api/logistics/mra/dim")) as GetDimResp;
      if (!dimResp?.ok) {
        throw new Error(dimResp?.error || "No se pudo cargar DIM.");
      }
      setDimRows(Array.isArray(dimResp.rows) ? dimResp.rows : []);
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo recargar DIM")}`);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dimCodeSet = useMemo(() => {
    const set = new Set<string>();
    for (const row of dimRows) {
      const code = normalizeCode(row.mat_code);
      if (code) set.add(code);
    }
    return set;
  }, [dimRows]);

  const preparedRows = useMemo(() => {
    const base = mraOnly
      ? stgRows.filter((row) => dimCodeSet.has(normalizeCode(row.mat_code)))
      : stgRows;

    return [...base].sort((a, b) => {
      const result = compareSmart(a[sortKey], b[sortKey]);
      return sortDir === "asc" ? result : -result;
    });
  }, [stgRows, dimCodeSet, mraOnly, sortKey, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [mraOnly, sortKey, sortDir, stgRows.length, dimRows.length]);

  const totalRows = preparedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const visibleRows = preparedRows.slice(pageStart, pageEnd);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function onSortClick(key: ColumnKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  function getSortIndicator(key: ColumnKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  function onExportExcel() {
    if (!preparedRows.length) {
      setMsg("No hay filas para exportar.");
      return;
    }

    const exportRows = buildExportRows(preparedRows);
    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws["!cols"] = COLUMNS.map((col) => ({ wch: Math.max(12, Math.round(col.width / 8)) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MRA");

    XLSX.writeFile(
      wb,
      `logistics_mra_${mraOnly ? "solo_mra" : "todo"}_${getFileStamp()}.xlsx`
    );
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
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error("El archivo no tiene hojas.");
      }

      const sheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
      });

      if (!rawRows.length) {
        throw new Error("El Excel está vacío.");
      }

      const firstRowHeaders = Object.keys(rawRows[0] || {});
      const missingHeaders = IMPORT_HEADERS.filter(
        (header) => !firstRowHeaders.some((h) => toHeaderKey(h) === header)
      );

      if (missingHeaders.length) {
        throw new Error(`Faltan columnas: ${missingHeaders.join(", ")}`);
      }

      const mappedRows = rawRows
        .map((raw, idx) => {
          const getValue = (targetHeader: ImportKey) => {
            const sourceKey = Object.keys(raw).find((k) => toHeaderKey(k) === targetHeader);
            return sourceKey ? raw[sourceKey] : "";
          };

          const row: MRAImportPreviewRow = {
            row_num: idx + 2,
            mat_code: toNullableString(getValue("mat_code")),
            mat_desc: toNullableString(getValue("mat_desc")),
            mat_unit: toNullableString(getValue("mat_unit")),
            mat_fam: toNullableString(getValue("mat_fam")),
            mat_category: toNullableString(getValue("mat_category")),
            duplicate_count: 0,
            is_duplicate: false,
          };

          return row;
        })
        .filter((row) => IMPORT_HEADERS.some((header) => !isBlank(row[header])));

      if (!mappedRows.length) {
        throw new Error("No hay filas válidas para importar.");
      }

      const counts = new Map<string, number>();

      for (const row of mappedRows) {
        const code = normalizeCode(row.mat_code);
        if (!code) continue;
        counts.set(code, (counts.get(code) || 0) + 1);
      }

      const preview = mappedRows.map((row) => {
        const code = normalizeCode(row.mat_code);
        const count = code ? counts.get(code) || 0 : 0;

        return {
          ...row,
          duplicate_count: count,
          is_duplicate: count > 1,
        };
      });

      const repeatedCodes = Array.from(counts.values()).filter((count) => count > 1).length;
      const repeatedRows = preview.filter((row) => row.is_duplicate).length;
      const repeatedExtraRows = Array.from(counts.values()).reduce(
        (acc, count) => acc + (count > 1 ? count - 1 : 0),
        0
      );

      setPreviewRows(preview);
      setImportSummary({
        file_name: file.name,
        total_excel_rows: rawRows.length,
        valid_rows: preview.length,
        repeated_codes: repeatedCodes,
        repeated_rows: repeatedRows,
        repeated_extra_rows: repeatedExtraRows,
      });
      setPreviewOpen(true);
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo importar el archivo")}`);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function confirmImport() {
    if (!previewRows.length) {
      setMsg("No hay filas para importar.");
      return;
    }

    setImporting(true);
    setMsg(null);

    try {
      const payload: MRAImportRow[] = previewRows.map((row) => ({
        mat_code: row.mat_code,
        mat_desc: row.mat_desc,
        mat_unit: row.mat_unit,
        mat_fam: row.mat_fam,
        mat_category: row.mat_category,
      }));

      const resp = (await apiPost("/api/logistics/mra/dim", payload)) as PostDimResp;

      if (!resp?.ok) {
        throw new Error(resp?.error || "No se pudo importar MRA.");
      }

      await loadDimOnly();
      setPreviewOpen(false);
      setPreviewRows([]);
      setImportSummary(null);
      setMsg(`OK: se importaron ${resp.count ?? payload.length} fila(s) en dim.logistics_mra_mat.`);
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo importar el archivo")}`);
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

  return (
    <>
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
            Logistics · MRA
          </div>

          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              fontSize: 12,
              fontWeight: 900,
              color: "rgba(255,255,255,0.9)",
            }}
          >
            Materiales: {stgRows.length}
          </div>

          <div
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              fontSize: 12,
              fontWeight: 900,
              color: "rgba(255,255,255,0.9)",
            }}
          >
            MRA: {dimRows.length}
          </div>

          <button
            type="button"
            onClick={() => setMraOnly((prev) => !prev)}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: mraOnly
                ? "1px solid rgba(102,199,255,.55)"
                : "1px solid rgba(255,255,255,0.12)",
              background: mraOnly
                ? "rgba(102,199,255,.16)"
                : "rgba(255,255,255,0.06)",
              fontSize: 12,
              fontWeight: 900,
              color: mraOnly
                ? "rgb(170, 225, 255)"
                : "rgba(255,255,255,0.8)",
              cursor: "pointer",
            }}
          >
            MRA {mraOnly ? "ON" : "OFF"}
          </button>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={onImportFile}
              style={{ display: "none" }}
            />

            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={loadData}
              disabled={loading || importing}
            >
              {loading ? "Cargando…" : "Refrescar"}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={onExportExcel}
              disabled={loading || importing || preparedRows.length === 0}
            >
              Exportar Excel
            </Button>

            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={onClickImport}
              disabled={loading || importing}
            >
              {importing ? "Importando…" : "Importar MRA"}
            </Button>
          </div>
        </div>

        {msg ? (
          <div
            className="panel-inner"
            style={{
              padding: 10,
              flexShrink: 0,
              border: msg.startsWith("OK")
                ? "1px solid rgba(102,199,255,.45)"
                : "1px solid rgba(255,80,80,.45)",
              background: msg.startsWith("OK")
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
            maxHeight: "calc(100vh - 270px)",
            overflow: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div style={{ minWidth: "max-content" }}>
            <Table stickyHeader disableScrollWrapper>
              <colgroup>
                {COLUMNS.map((c) => (
                  <col
                    key={c.key}
                    style={{
                      width: c.width,
                      minWidth: c.width,
                      maxWidth: c.width,
                    }}
                  />
                ))}
              </colgroup>

              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      className="capex-th"
                      onClick={() => onSortClick(c.key)}
                      style={{
                        ...stickyHead,
                        border: headerBorder,
                        borderBottom: headerBorder,
                        textAlign: "left",
                        padding: "8px 8px",
                        fontSize: 12,
                        width: c.width,
                        minWidth: c.width,
                        maxWidth: c.width,
                        cursor: "pointer",
                        userSelect: "none",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        boxSizing: "border-box",
                        left: c.sticky ? c.left : undefined,
                        zIndex: c.sticky ? 40 : stickyHead.zIndex,
                        background: c.sticky ? headerBg : stickyHead.background,
                        boxShadow: c.sticky ? "2px 0 0 rgba(191, 231, 255, 0.12)" : undefined,
                      }}
                      title={c.label}
                    >
                      {c.label}
                      {getSortIndicator(c.key)}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {!loading &&
                  visibleRows.map((row, index) => (
                    <tr key={`${normalizeText(row.mat_code)}_${pageStart + index}`} className="capex-tr">
                      {COLUMNS.map((c) => (
                        <td
                          key={c.key}
                          className="capex-td"
                          style={{
                            ...cellBase,
                            borderTop: gridH,
                            borderBottom: gridH,
                            borderRight: gridV,
                            background: c.sticky ? "rgb(10, 30, 46)" : rowBg,
                            width: c.width,
                            minWidth: c.width,
                            maxWidth: c.width,
                            color: "rgb(185,185,185)",
                            position: c.sticky ? "sticky" : "static",
                            left: c.sticky ? c.left : undefined,
                            zIndex: c.sticky ? 15 : undefined,
                            boxShadow: c.sticky ? "2px 0 0 rgba(191, 231, 255, 0.10)" : undefined,
                          }}
                          title={formatCellValue(row[c.key])}
                        >
                          {formatCellValue(row[c.key])}
                        </td>
                      ))}
                    </tr>
                  ))}

                {!loading && visibleRows.length === 0 ? (
                  <tr className="capex-tr">
                    <td className="capex-td" style={{ ...cellBase, fontWeight: 900 }} colSpan={COLUMNS.length}>
                      No hay filas para mostrar.
                    </td>
                  </tr>
                ) : null}

                {loading ? (
                  <tr className="capex-tr">
                    <td className="capex-td" style={{ ...cellBase, fontWeight: 900 }} colSpan={COLUMNS.length}>
                      Cargando logistics MRA…
                    </td>
                  </tr>
                ) : null}
              </tbody>

              <tfoot>
                <tr>
                  <td
                    className="capex-td"
                    style={{
                      ...cellBase,
                      fontWeight: 900,
                      borderTop: headerBorder,
                      borderRight: gridV,
                      background: "rgba(255,255,255,0.06)",
                    }}
                  >
                    Filas: {totalRows}
                  </td>
                  <td
                    className="capex-td"
                    colSpan={COLUMNS.length - 1}
                    style={{
                      ...cellBase,
                      borderTop: headerBorder,
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    {mraOnly ? "Vista filtrada por MRA" : "Vista completa de Materiales"}
                  </td>
                </tr>
              </tfoot>
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
              disabled={loading || importing || safePage <= 1}
            >
              ←
            </Button>

            <div
              style={{
                minWidth: 110,
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
              disabled={loading || importing || safePage >= totalPages}
            >
              →
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
              width: "min(1200px, 96vw)",
              height: "min(82vh, 820px)",
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
                <div style={{ fontSize: 18, fontWeight: 900 }}>Preview de importación MRA</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Revisa la data antes de reemplazar dim.logistics_mra_mat
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={closePreview}
                disabled={importing}
              >
                Cerrar
              </Button>
            </div>

            {importSummary ? (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.06)",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  Archivo: {importSummary.file_name}
                </div>

                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.06)",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  Filas Excel: {importSummary.total_excel_rows}
                </div>

                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(102,199,255,.45)",
                    background: "rgba(102,199,255,.10)",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  Filas válidas: {importSummary.valid_rows}
                </div>

                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: importSummary.repeated_codes > 0
                      ? "1px solid rgba(255,170,60,.45)"
                      : "1px solid rgba(255,255,255,0.12)",
                    background: importSummary.repeated_codes > 0
                      ? "rgba(255,170,60,.10)"
                      : "rgba(255,255,255,0.06)",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  Códigos repetidos: {importSummary.repeated_codes}
                </div>

                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: importSummary.repeated_rows > 0
                      ? "1px solid rgba(255,170,60,.45)"
                      : "1px solid rgba(255,255,255,0.12)",
                    background: importSummary.repeated_rows > 0
                      ? "rgba(255,170,60,.10)"
                      : "rgba(255,255,255,0.06)",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  Filas repetidas: {importSummary.repeated_rows}
                </div>

                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: importSummary.repeated_extra_rows > 0
                      ? "1px solid rgba(255,170,60,.45)"
                      : "1px solid rgba(255,255,255,0.12)",
                    background: importSummary.repeated_extra_rows > 0
                      ? "rgba(255,170,60,.10)"
                      : "rgba(255,255,255,0.06)",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  Filas extra repetidas: {importSummary.repeated_extra_rows}
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
              <Table stickyHeader disableScrollWrapper>
                <colgroup>
                  <col style={{ width: 80, minWidth: 80, maxWidth: 80 }} />
                  <col style={{ width: 130, minWidth: 130, maxWidth: 130 }} />
                  <col style={{ width: 260, minWidth: 260, maxWidth: 260 }} />
                  <col style={{ width: 110, minWidth: 110, maxWidth: 110 }} />
                  <col style={{ width: 170, minWidth: 170, maxWidth: 170 }} />
                  <col style={{ width: 170, minWidth: 170, maxWidth: 170 }} />
                  <col style={{ width: 110, minWidth: 110, maxWidth: 110 }} />
                </colgroup>

                <thead>
                  <tr>
                    {["fila", "mat_code", "mat_desc", "mat_unit", "mat_fam", "mat_category", "repetido"].map((label) => (
                      <th
                        key={label}
                        className="capex-th"
                        style={{
                          ...stickyHead,
                          border: headerBorder,
                          borderBottom: headerBorder,
                          textAlign: "left",
                          padding: "8px 8px",
                          fontSize: 12,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {previewRows.map((row) => (
                    <tr key={`${row.row_num}_${normalizeText(row.mat_code)}`} className="capex-tr">
                      <td
                        className="capex-td"
                        style={{
                          ...cellBase,
                          borderTop: gridH,
                          borderBottom: gridH,
                          borderRight: gridV,
                          background: row.is_duplicate ? "rgba(255,170,60,.12)" : rowBg,
                        }}
                      >
                        {row.row_num}
                      </td>
                      <td
                        className="capex-td"
                        style={{
                          ...cellBase,
                          borderTop: gridH,
                          borderBottom: gridH,
                          borderRight: gridV,
                          background: row.is_duplicate ? "rgba(255,170,60,.12)" : rowBg,
                          fontWeight: 900,
                        }}
                        title={row.mat_code || "—"}
                      >
                        {row.mat_code || "—"}
                      </td>
                      <td
                        className="capex-td"
                        style={{
                          ...cellBase,
                          borderTop: gridH,
                          borderBottom: gridH,
                          borderRight: gridV,
                          background: row.is_duplicate ? "rgba(255,170,60,.12)" : rowBg,
                        }}
                        title={row.mat_desc || "—"}
                      >
                        {row.mat_desc || "—"}
                      </td>
                      <td
                        className="capex-td"
                        style={{
                          ...cellBase,
                          borderTop: gridH,
                          borderBottom: gridH,
                          borderRight: gridV,
                          background: row.is_duplicate ? "rgba(255,170,60,.12)" : rowBg,
                        }}
                        title={row.mat_unit || "—"}
                      >
                        {row.mat_unit || "—"}
                      </td>
                      <td
                        className="capex-td"
                        style={{
                          ...cellBase,
                          borderTop: gridH,
                          borderBottom: gridH,
                          borderRight: gridV,
                          background: row.is_duplicate ? "rgba(255,170,60,.12)" : rowBg,
                        }}
                        title={row.mat_fam || "—"}
                      >
                        {row.mat_fam || "—"}
                      </td>
                      <td
                        className="capex-td"
                        style={{
                          ...cellBase,
                          borderTop: gridH,
                          borderBottom: gridH,
                          borderRight: gridV,
                          background: row.is_duplicate ? "rgba(255,170,60,.12)" : rowBg,
                        }}
                        title={row.mat_category || "—"}
                      >
                        {row.mat_category || "—"}
                      </td>
                      <td
                        className="capex-td"
                        style={{
                          ...cellBase,
                          borderTop: gridH,
                          borderBottom: gridH,
                          borderRight: gridV,
                          background: row.is_duplicate ? "rgba(255,170,60,.12)" : rowBg,
                          fontWeight: 900,
                          color: row.is_duplicate ? "rgb(255,199,120)" : "rgb(185,185,185)",
                        }}
                      >
                        {row.is_duplicate ? `Sí (${row.duplicate_count})` : "No"}
                      </td>
                    </tr>
                  ))}

                  {previewRows.length === 0 ? (
                    <tr className="capex-tr">
                      <td className="capex-td" style={{ ...cellBase, fontWeight: 900 }} colSpan={7}>
                        No hay filas para preview.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
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
                Se importarán exactamente {previewRows.length} fila(s) al confirmar.
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={closePreview}
                  disabled={importing}
                >
                  Cancelar
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={confirmImport}
                  disabled={importing || previewRows.length === 0}
                >
                  {importing ? "Importando…" : "Confirmar importación"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}