// src/components/logistics/LogisticsStockTable.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

const PAGE_SIZE = 200;

const COLUMN_KEYS = [
  "mat_code",
  "mat_desc",
  "mat_unit",
  "mat_category",
  "frequency_act",
  "avg_act",
  "doc_num",
  "doc_date",
  "qty",
  "po_num",
  "rq_act",
  "po_act",
  "stock_qty",
  "ceva_act",
  "stock_tot",
] as const;

type ColumnKey = (typeof COLUMN_KEYS)[number];
type SortDir = "asc" | "desc";

type StockRow = {
  mat_code: string | null;
  mat_desc: string | null;
  mat_unit: string | null;
  frequency_act: number | string | null;
  avg_act: number | string | null;
  doc_num: string | null;
  doc_date: string | null;
  qty: number | string | null;
  po_num: string | null;
  rq_act: number | string | null;
  po_act: number | string | null;
  stock_qty: number | string | null;
  ceva_act: number | string | null;
  stock_tot: number | string | null;
  [key: string]: string | number | null | undefined;
};

type DimRow = {
  mat_code: string | null;
  mat_desc: string | null;
  mat_unit: string | null;
  mat_fam: string | null;
  mat_category: string | null;
  updated_at?: string | null;
};

type MergedRow = StockRow & {
  mat_category: string | null;
  sku_search: string;
};

type GetStockResp = {
  ok: boolean;
  rows?: StockRow[];
  count?: number;
  error?: string;
};

type GetDimResp = {
  ok: boolean;
  rows?: DimRow[];
  error?: string;
};

const WIDTHS: Partial<Record<ColumnKey, number>> = {
  mat_code: 130,
  mat_desc: 300,
  mat_unit: 100,
  mat_category: 150,
  frequency_act: 130,
  avg_act: 110,
  doc_num: 150,
  doc_date: 130,
  qty: 130,
  po_num: 160,
  rq_act: 100,
  po_act: 100,
  stock_qty: 150,
  ceva_act: 130,
  stock_tot: 180,
};

const COLUMNS = COLUMN_KEYS.map((key) => ({
  key,
  label: getColumnLabel(key),
  width: WIDTHS[key] ?? 120,
  sticky: key === "mat_code" || key === "mat_desc",
  left:
    key === "mat_code"
      ? 0
      : key === "mat_desc"
      ? (WIDTHS.mat_code ?? 130)
      : undefined,
}));

function getColumnLabel(key: ColumnKey) {
  const labelMap: Record<ColumnKey, string> = {
    mat_code: "SKU",
    mat_desc: "Descripción",
    mat_unit: "Unidad",
    mat_category: "Categoría",
    frequency_act: "Frecuencia (Últimos 12 Meses)",
    avg_act: "Consumo Prom.",
    doc_num: "Vale Último Consumo",
    doc_date: "Fecha Último Consumo",
    qty: "Cantidad Último Consumo",
    po_num: "#Orden de Compra (OC)",
    rq_act: "RQ",
    po_act: "OC",
    stock_qty: "Stock - UM Chala (010)",
    ceva_act: "CEVA (Alm. 035)",
    stock_tot: "Stock Total (UM Chala+CEVA+OC)",
  };

  return labelMap[key];
}

function normalizeText(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeCode(v: unknown) {
  return normalizeText(v).toUpperCase();
}

function isBlank(v: unknown) {
  return v === null || v === undefined || String(v).trim() === "";
}

function formatDateDisplay(value: unknown) {
  const text = normalizeText(value);
  if (!text) return "—";

  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return text;

  return d.toLocaleDateString("es-PE");
}

function formatCellValue(key: ColumnKey, value: unknown) {
  if (value === null || value === undefined || value === "") return "—";

  if (key === "doc_date") {
    return formatDateDisplay(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });
  }

  const num = Number(String(value).replace(/,/g, ""));
  if (!Number.isNaN(num) && String(value).trim() !== "") {
    return num.toLocaleString("en-US", {
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

function getFileStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${hh}${mi}`;
}

function buildExportRows(rows: MergedRow[]) {
  return rows.map((row) => {
    const out: Record<string, string | number | null> = {};
    for (const col of COLUMNS) {
      if (col.key === "doc_date") {
        out[col.label] = formatDateDisplay(row[col.key]);
      } else {
        out[col.label] = (row[col.key] as string | number | null) ?? null;
      }
    }
    return out;
  });
}

export default function LogisticsStockTable() {
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [dimRows, setDimRows] = useState<DimRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [mraOnly, setMraOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<ColumnKey>("mat_code");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  const [importedCodes, setImportedCodes] = useState<string[]>([]);
  const [importFileName, setImportFileName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setMsg(null);

    try {
      const [stockResp, dimResp] = await Promise.all([
        apiGet("/api/logistics/mra/stock-vis") as Promise<GetStockResp>,
        apiGet("/api/logistics/mra/dim") as Promise<GetDimResp>,
      ]);

      if (!stockResp?.ok) {
        throw new Error(stockResp?.error || "No se pudo cargar stock-vis.");
      }

      if (!dimResp?.ok) {
        throw new Error(dimResp?.error || "No se pudo cargar dim.");
      }

      setStockRows(Array.isArray(stockResp.rows) ? stockResp.rows : []);
      setDimRows(Array.isArray(dimResp.rows) ? dimResp.rows : []);
      setPage(1);
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo cargar información")}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dimMap = useMemo(() => {
    const map = new Map<string, DimRow>();
    for (const row of dimRows) {
      const code = normalizeCode(row.mat_code);
      if (code) map.set(code, row);
    }
    return map;
  }, [dimRows]);

  const dimCodeSet = useMemo(() => {
    return new Set(Array.from(dimMap.keys()));
  }, [dimMap]);

  const importedCodeSet = useMemo(() => {
    return new Set(importedCodes.map((x) => normalizeCode(x)).filter(Boolean));
  }, [importedCodes]);

  const mergedRows = useMemo<MergedRow[]>(() => {
    return stockRows.map((row) => {
      const code = normalizeCode(row.mat_code);
      const dim = dimMap.get(code);

      return {
        ...row,
        mat_category: dim?.mat_category ?? null,
        sku_search: `${normalizeText(row.mat_code)} - ${normalizeText(row.mat_desc)}`,
      };
    });
  }, [stockRows, dimMap]);

  const preparedRows = useMemo(() => {
    let rows = [...mergedRows];

    if (mraOnly) {
      rows = rows.filter((row) => dimCodeSet.has(normalizeCode(row.mat_code)));
    }

    if (importedCodeSet.size > 0) {
      rows = rows.filter((row) => importedCodeSet.has(normalizeCode(row.mat_code)));
    }

    const searchText = search.trim().toLowerCase();
    if (searchText) {
      rows = rows.filter((row) => row.sku_search.toLowerCase().includes(searchText));
    }

    rows.sort((a, b) => {
      const result = compareSmart(a[sortKey], b[sortKey]);
      return sortDir === "asc" ? result : -result;
    });

    return rows;
  }, [mergedRows, mraOnly, dimCodeSet, importedCodeSet, search, sortKey, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [mraOnly, search, importedCodes, sortKey, sortDir, stockRows.length, dimRows.length]);

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

  function onClickImport() {
    fileInputRef.current?.click();
  }

  function clearImportedFilter() {
    setImportedCodes([]);
    setImportFileName(null);
    setMsg("OK: se limpió el filtro por Excel.");
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
      const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
        header: 1,
        defval: "",
        raw: false,
      });

      if (!rows.length) {
        throw new Error("El Excel está vacío.");
      }

      const dataRows = rows.slice(1);
      const rawCodes = dataRows
        .map((row) => (Array.isArray(row) ? row[0] : ""))
        .map((value) => normalizeCode(value))
        .filter(Boolean);

      if (!rawCodes.length) {
        throw new Error("No se encontraron mat_code válidos en la primera columna.");
      }

      const uniqueCodes = Array.from(new Set(rawCodes));
      const repeatedExtraRows = rawCodes.length - uniqueCodes.length;

      setImportedCodes(uniqueCodes);
      setImportFileName(file.name);
      setPage(1);

      setMsg(
        `OK: se cargaron ${uniqueCodes.length} mat_code únicos para filtrar la vista.` +
          (repeatedExtraRows > 0 ? ` Se ignoraron ${repeatedExtraRows} duplicado(s).` : "")
      );
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo importar el archivo")}`);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function onExportExcel() {
    if (!preparedRows.length) {
      setMsg("No hay filas para exportar.");
      return;
    }

    const exportRows = buildExportRows(preparedRows);
    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws["!cols"] = COLUMNS.map((col) => ({
      wch: Math.max(12, Math.round(col.width / 8)),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock");

    XLSX.writeFile(wb, `logistics_stock_vis_${getFileStamp()}.xlsx`);
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
        <div style={{ fontWeight: 900 }}>Logistics · Stock Vis</div>

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
          Materiales: {stockRows.length}
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

        <div
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: importedCodes.length > 0
              ? "1px solid rgba(102,199,255,.45)"
              : "1px solid rgba(255,255,255,0.12)",
            background: importedCodes.length > 0
              ? "rgba(102,199,255,.10)"
              : "rgba(255,255,255,0.06)",
            fontSize: 12,
            fontWeight: 900,
            color: "rgba(255,255,255,0.9)",
          }}
          title={importFileName || undefined}
        >
          Excel filtro: {importedCodes.length}
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
          Filas: {totalRows}
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

        <div style={{ flex: 1, minWidth: 260 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar SKU - Descripción"
            style={{
              width: "100%",
              height: 34,
              borderRadius: 10,
              border: "1px solid rgba(191,231,255,.18)",
              background: "rgba(255,255,255,0.06)",
              color: "white",
              padding: "0 10px",
              outline: "none",
              fontSize: 12,
              fontWeight: 700,
            }}
          />
        </div>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
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
            disabled={loading}
          >
            {loading ? "Cargando…" : "Refrescar"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={onExportExcel}
            disabled={loading || preparedRows.length === 0}
          >
            Exportar Excel
          </Button>

          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={onClickImport}
            disabled={loading}
          >
            Importar Excel
          </Button>

          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={clearImportedFilter}
            disabled={loading || importedCodes.length === 0}
          >
            Limpiar Excel
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
                      padding: "6px 8px",
                      fontSize: 12,
                      lineHeight: "14px",
                      height: 44,
                      width: c.width,
                      minWidth: c.width,
                      maxWidth: c.width,
                      cursor: "pointer",
                      userSelect: "none",
                      whiteSpace: "normal",
                      overflow: "visible",
                      textOverflow: "clip",
                      wordBreak: "break-word",
                      verticalAlign: "middle",
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
                        title={formatCellValue(c.key, row[c.key])}
                      >
                        {formatCellValue(c.key, row[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading && visibleRows.length === 0 ? (
                <tr className="capex-tr">
                  <td
                    className="capex-td"
                    style={{ ...cellBase, fontWeight: 900 }}
                    colSpan={COLUMNS.length}
                  >
                    No hay filas para mostrar.
                  </td>
                </tr>
              ) : null}

              {loading ? (
                <tr className="capex-tr">
                  <td
                    className="capex-td"
                    style={{ ...cellBase, fontWeight: 900 }}
                    colSpan={COLUMNS.length}
                  >
                    Cargando logistics stock-vis…
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
                  {importedCodes.length > 0
                    ? `Vista filtrada por Excel${mraOnly ? " + MRA" : ""}`
                    : mraOnly
                    ? "Vista filtrada por MRA"
                    : "Vista completa"}
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
            disabled={loading || safePage <= 1}
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
            disabled={loading || safePage >= totalPages}
          >
            →
          </Button>
        </div>
      </div>
    </div>
  );
}