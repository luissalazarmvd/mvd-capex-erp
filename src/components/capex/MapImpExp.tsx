// src/components/capex/MapImpExp.tsx
"use client";

import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

type MappingRow = {
  wbs_code: string;
  capex_code: string;
  updated_at?: string | null;
};

type ImportField = "wbs_code" | "capex_code";

type ImportPreviewRow = {
  row_num: number;
  wbs_code: string;
  capex_code: string;
  status: "NUEVA" | "ACTUALIZAR" | "IGUAL" | "INVÁLIDA";
  errors: string;
  duplicate_count: number;
  is_duplicate: boolean;
  valid: boolean;
};

type ImportSummary = {
  file_name: string;
  total_excel_rows: number;
  preview_rows: number;
  valid_rows: number;
  invalid_rows: number;
  repeated_wbs: number;
  repeated_extra_rows: number;
};

type Props = {
  rows: MappingRow[];
  setMsgAction: React.Dispatch<React.SetStateAction<string | null>>;
  loadMappingAction: (clearMsg?: boolean) => Promise<void>;
  disabled?: boolean;
};

function normalizeText(v: unknown) {
  return String(v ?? "").trim();
}

function isBlank(v: unknown) {
  return v === null || v === undefined || String(v).trim() === "";
}

function normalizeHeader(v: unknown) {
  return normalizeText(v)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_]+/g, "");
}

function getImportField(header: unknown): ImportField | "" {
  const h = normalizeHeader(header);

  if (["wbscode", "wbs", "codigowbs", "codigoedt"].includes(h)) return "wbs_code";
  if (["capexcode", "capex", "codigocapex"].includes(h)) return "capex_code";

  return "";
}

function sortRowsByWbs<T extends { wbs_code: string; capex_code: string }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const aw = normalizeText(a.wbs_code);
    const bw = normalizeText(b.wbs_code);
    const cw = aw.localeCompare(bw);
    if (cw !== 0) return cw;

    return normalizeText(a.capex_code).localeCompare(normalizeText(b.capex_code));
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

function buildImportSummary(
  previewRows: ImportPreviewRow[],
  file_name: string,
  total_excel_rows: number
): ImportSummary {
  const counts = new Map<string, number>();

  for (const row of previewRows) {
    const key = normalizeText(row.wbs_code).toUpperCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const repeatedWbs = Array.from(counts.values()).filter((count) => count > 1).length;
  const repeatedExtraRows = Array.from(counts.values()).reduce(
    (acc, count) => acc + (count > 1 ? count - 1 : 0),
    0
  );

  const validRows = previewRows.filter((row) => row.valid).length;
  const invalidRows = previewRows.length - validRows;

  return {
    file_name,
    total_excel_rows,
    preview_rows: previewRows.length,
    valid_rows: validRows,
    invalid_rows: invalidRows,
    repeated_wbs: repeatedWbs,
    repeated_extra_rows: repeatedExtraRows,
  };
}

function revalidatePreviewRows(
  draftRows: ImportPreviewRow[],
  file_name: string,
  total_excel_rows: number,
  existingMap: Map<string, string>,
  validWbsSet: Set<string>
): { rows: ImportPreviewRow[]; summary: ImportSummary } {
  const counts = new Map<string, number>();

  for (const draft of draftRows) {
    const key = normalizeText(draft.wbs_code).toUpperCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const rows = draftRows.map((draft) => {
    const wbs_code = normalizeText(draft.wbs_code);
    const capex_code = normalizeText(draft.capex_code);

    const errors: string[] = [];

    if (!wbs_code) errors.push("wbs_code vacío");
    if (!capex_code) errors.push("capex_code vacío");

    const key = wbs_code.toUpperCase();

    if (wbs_code && !validWbsSet.has(key)) {
      errors.push("wbs_code no existe en dim.wbs");
    }
    const duplicateCount = key ? counts.get(key) || 0 : 0;
    const isDuplicate = duplicateCount > 1;

    if (isDuplicate) {
      errors.push("wbs_code repetido en preview");
    }

    let status: "NUEVA" | "ACTUALIZAR" | "IGUAL" | "INVÁLIDA" = "INVÁLIDA";

    if (errors.length === 0) {
      const existingCapex = existingMap.get(key);

      if (existingCapex === undefined) {
        status = "NUEVA";
      } else if (normalizeText(existingCapex) === capex_code) {
        status = "IGUAL";
      } else {
        status = "ACTUALIZAR";
      }
    }

    const valid = errors.length === 0;

    return {
      ...draft,
      wbs_code,
      capex_code,
      status,
      errors: errors.join(" | "),
      duplicate_count: duplicateCount,
      is_duplicate: isDuplicate,
      valid,
    } satisfies ImportPreviewRow;
  });

  const orderedRows = sortRowsByWbs(rows);

  return {
    rows: orderedRows,
    summary: buildImportSummary(orderedRows, file_name, total_excel_rows),
  };
}

export default function MapImpExp({
  rows,
  setMsgAction,
  loadMappingAction,
  disabled = false,
}: Props) {
  const [importing, setImporting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const existingMap = new Map(
    rows.map((r) => [normalizeText(r.wbs_code).toUpperCase(), normalizeText(r.capex_code)])
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function getValidWbsSet() {
    const data = await apiGet("/api/capex/mapping/wbs");

    if (!data?.ok) {
      throw new Error(data?.error || "No se pudo cargar dim.wbs");
    }

    const set = new Set<string>();

    for (const row of Array.isArray(data?.rows) ? data.rows : []) {
      const code = normalizeText(row?.wbs_code).toUpperCase();
      if (code) set.add(code);
    }

    return set;
  }

  function closePreview() {
    if (importing) return;
    setPreviewOpen(false);
    setPreviewRows([]);
    setImportSummary(null);
  }

  function onClickImport() {
    fileInputRef.current?.click();
  }

  function onExportExcel() {
    if (!rows.length) {
      setMsgAction("No hay mapping para exportar.");
      return;
    }

    const exportRows = sortRowsByWbs(rows).map((row) => ({
      wbs_code: normalizeText(row.wbs_code),
      capex_code: normalizeText(row.capex_code),
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws["!cols"] = [{ wch: 18 }, { wch: 22 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "capex_mapping");
    XLSX.writeFile(wb, `capex_mapping_${getFileStamp()}.xlsx`);
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setMsgAction(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error("El archivo no tiene hojas.");
      }

      const sheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: true,
      });

      if (!rawRows.length) {
        throw new Error("El Excel está vacío.");
      }

      const firstRowHeaders = Object.keys(rawRows[0] || {});
      const normalizedFields: ImportField[] = firstRowHeaders
        .map((h) => getImportField(h))
        .filter((field): field is ImportField => field !== "");

      const requiredFields: ImportField[] = ["wbs_code", "capex_code"];

      const missingHeaders = requiredFields.filter((field) => !normalizedFields.includes(field));

      if (missingHeaders.length) {
        throw new Error(
          "Faltan columnas. Deben venir exactamente wbs_code y capex_code."
        );
      }

      const baseRows = rawRows
        .map((raw, idx) => {
          const getValue = (fieldName: ImportField) => {
            const sourceKey = Object.keys(raw).find((k) => getImportField(k) === fieldName);
            return sourceKey ? raw[sourceKey] : "";
          };

          return {
            row_num: idx + 2,
            wbs_code: normalizeText(getValue("wbs_code")),
            capex_code: normalizeText(getValue("capex_code")),
          };
        })
        .filter((row) => !isBlank(row.wbs_code) || !isBlank(row.capex_code));

      if (!baseRows.length) {
        throw new Error("No hay filas para importar.");
      }

      const validWbsSet = await getValidWbsSet();

      const previewSeed: ImportPreviewRow[] = baseRows.map((row) => ({
        row_num: row.row_num,
        wbs_code: row.wbs_code,
        capex_code: row.capex_code,
        status: "INVÁLIDA",
        errors: "",
        duplicate_count: 0,
        is_duplicate: false,
        valid: false,
      }));

      const { rows: revalidatedRows, summary } = revalidatePreviewRows(
        previewSeed,
        file.name,
        rawRows.length,
        existingMap,
        validWbsSet
      );

      setPreviewRows(revalidatedRows);
      setImportSummary(summary);
      setPreviewOpen(true);
    } catch (e: any) {
      setMsgAction(`ERROR: ${String(e?.message || e || "No se pudo importar el archivo")}`);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function confirmImport() {
    if (!previewRows.length) {
      setMsgAction("No hay filas para importar.");
      return;
    }

    if (previewRows.some((row) => !row.valid)) {
      setMsgAction("ERROR: corrige las filas inválidas del preview antes de importar.");
      return;
    }

    setImporting(true);
    setMsgAction(null);

    try {
      const payloadRows = sortRowsByWbs(previewRows)
        .filter((row) => row.valid && row.status !== "IGUAL")
        .map((row) => ({
          wbs_code: normalizeText(row.wbs_code),
          capex_code: normalizeText(row.capex_code),
        }));

      if (!payloadRows.length) {
        setMsgAction("No hay filas nuevas ni por actualizar. Todo está IGUAL.");
        return;
      }

      await apiPost("/api/capex/mapping/replace", {
        rows: payloadRows,
      });

      await loadMappingAction(false);
      setPreviewOpen(false);
      setPreviewRows([]);
      setImportSummary(null);
      const nuevas = previewRows.filter((row) => row.valid && row.status === "NUEVA").length;
      const actualizar = previewRows.filter((row) => row.valid && row.status === "ACTUALIZAR").length;

      setMsgAction(
        `OK: se procesaron ${payloadRows.length} fila(s) de mapping. Nuevas: ${nuevas}. Actualizadas: ${actualizar}.`
      );
    } catch (e: any) {
      setMsgAction(`ERROR: ${String(e?.message || e || "No se pudo importar el archivo")}`);
    } finally {
      setImporting(false);
    }
  }

  const headerBg = "rgb(6, 36, 58)";
  const headerBorder = "1px solid rgba(191, 231, 255, 0.26)";
  const gridV = "1px solid rgba(191, 231, 255, 0.10)";
  const gridH = "1px solid rgba(191, 231, 255, 0.08)";
  const rowBg = "rgba(0,0,0,.10)";

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
        variant="ghost"
        onClick={onExportExcel}
        disabled={disabled || importing || rows.length === 0}
      >
        Exportar Mapping
      </Button>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onClickImport}
        disabled={disabled || importing}
      >
        {importing ? "Importando…" : "Importar Mapping"}
      </Button>

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
              height: "min(80vh, 760px)",
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
                <div style={{ fontSize: 18, fontWeight: 900 }}>Preview de importación de mapping CAPEX</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Se reconocerán filas NUEVAS, ACTUALIZAR e IGUAL. Las IGUAL no se importan.
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
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
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
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.06)",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  Filas preview: {importSummary.preview_rows}
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
                  Válidas: {importSummary.valid_rows}
                </div>

                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border:
                      importSummary.invalid_rows > 0
                        ? "1px solid rgba(255,80,80,.45)"
                        : "1px solid rgba(255,255,255,0.12)",
                    background:
                      importSummary.invalid_rows > 0
                        ? "rgba(255,80,80,.10)"
                        : "rgba(255,255,255,0.06)",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  Inválidas: {importSummary.invalid_rows}
                </div>

                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border:
                      importSummary.repeated_wbs > 0
                        ? "1px solid rgba(255,170,60,.45)"
                        : "1px solid rgba(255,255,255,0.12)",
                    background:
                      importSummary.repeated_wbs > 0
                        ? "rgba(255,170,60,.10)"
                        : "rgba(255,255,255,0.06)",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  WBS repetidas: {importSummary.repeated_wbs}
                </div>

                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border:
                      importSummary.repeated_extra_rows > 0
                        ? "1px solid rgba(255,170,60,.45)"
                        : "1px solid rgba(255,255,255,0.12)",
                    background:
                      importSummary.repeated_extra_rows > 0
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
                  <col style={{ width: 70 }} />
                  <col style={{ width: 220 }} />
                  <col style={{ width: 220 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 360 }} />
                </colgroup>

                <thead>
                  <tr>
                    {["fila", "wbs_code", "capex_code", "estado", "repetido", "errores"].map(
                      (label) => (
                        <th
                          key={label}
                          className="capex-th"
                          style={{
                            position: "sticky",
                            top: 0,
                            zIndex: 20,
                            background: headerBg,
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
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {previewRows.map((row) => {
                    const bg = !row.valid
                      ? "rgba(255,80,80,.10)"
                      : row.status === "IGUAL"
                      ? "rgba(160,160,160,.10)"
                      : row.status === "ACTUALIZAR"
                      ? "rgba(255,170,60,.12)"
                      : row.status === "NUEVA"
                      ? "rgba(102,199,255,.10)"
                      : rowBg;

                    return (
                      <tr key={`${row.row_num}_${row.wbs_code}_${row.capex_code}`} className="capex-tr">
                        <td
                          className="capex-td"
                          style={{
                            ...cellBase,
                            borderTop: gridH,
                            borderBottom: gridH,
                            borderRight: gridV,
                            background: bg,
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
                            background: bg,
                          }}
                        >
                          {row.wbs_code || "—"}
                        </td>

                        <td
                          className="capex-td"
                          style={{
                            ...cellBase,
                            borderTop: gridH,
                            borderBottom: gridH,
                            borderRight: gridV,
                            background: bg,
                          }}
                        >
                          {row.capex_code || "—"}
                        </td>

                        <td
                          className="capex-td"
                          style={{
                            ...cellBase,
                            borderTop: gridH,
                            borderBottom: gridH,
                            borderRight: gridV,
                            background: bg,
                            fontWeight: 900,
                          }}
                        >
                          {row.status}
                        </td>

                        <td
                          className="capex-td"
                          style={{
                            ...cellBase,
                            borderTop: gridH,
                            borderBottom: gridH,
                            borderRight: gridV,
                            background: bg,
                            fontWeight: 900,
                          }}
                        >
                          {row.is_duplicate ? `Sí (${row.duplicate_count})` : "No"}
                        </td>

                        <td
                          className="capex-td"
                          style={{
                            ...cellBase,
                            borderTop: gridH,
                            borderBottom: gridH,
                            borderRight: gridV,
                            background: bg,
                          }}
                          title={row.errors || "—"}
                        >
                          {row.errors || "—"}
                        </td>
                      </tr>
                    );
                  })}

                  {previewRows.length === 0 ? (
                    <tr className="capex-tr">
                      <td className="capex-td" style={{ ...cellBase, fontWeight: 900 }} colSpan={6}>
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
                {previewRows.some((row) => !row.valid)
                  ? "Corrige las filas inválidas para habilitar la importación."
                  : `Se importarán ${
                      previewRows.filter((row) => row.valid && row.status !== "IGUAL").length
                    } fila(s): ${
                      previewRows.filter((row) => row.status === "NUEVA").length
                    } nuevas, ${
                      previewRows.filter((row) => row.status === "ACTUALIZAR").length
                    } por actualizar y ${
                      previewRows.filter((row) => row.status === "IGUAL").length
                    } iguales.`}
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
                  disabled={
                    importing ||
                    previewRows.length === 0 ||
                    previewRows.some((row) => !row.valid)
                  }
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