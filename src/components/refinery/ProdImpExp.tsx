// src/components/refinery/ProdImpExp.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Table } from "../ui/Table";

type CampaignRow = {
  campaign_id: string;
  campaign_date: string | null;
  campaign_au: any;
  campaign_ag: any;
  campaign_cu: any;
};

type CampaignsResp = {
  ok: boolean;
  rows: CampaignRow[];
};

type ImportField = "campaign_id" | "campaign_au" | "campaign_ag" | "campaign_cu";

type ImportPreviewRow = {
  row_num: number;
  campaign_id: string;
  campaign_au: string;
  campaign_ag: string;
  campaign_cu: string;
  status: "ACTUALIZAR" | "IGUAL" | "INVÁLIDA";
  errors: string;
  duplicate_count: number;
  is_duplicate: boolean;
  valid: boolean;
  payload: {
    campaign_id: string;
    campaign_au: number;
    campaign_ag: number;
    campaign_cu: number | null;
  } | null;
};

type ImportSummary = {
  file_name: string;
  total_excel_rows: number;
  unique_rows: number;
  valid_rows: number;
  invalid_rows: number;
  repeated_campaigns: number;
  repeated_extra_rows: number;
  update_rows: number;
  equal_rows: number;
};

type Props = {
  rows: CampaignRow[];
  setMsgAction: React.Dispatch<React.SetStateAction<string | null>>;
  loadCampaignsAction: (clearMsg?: boolean) => Promise<void>;
  disabled?: boolean;
};

const MONTHS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
] as const;

function defaultExportRange() {
  const d = new Date();
  return {
    fromYear: String(d.getFullYear()),
    fromMonth: 1,
    toYear: String(d.getFullYear()),
    toMonth: d.getMonth() + 1,
  };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymFromInputs(year: string, month: number) {
  const y = String(year || "").trim();
  if (!/^\d{4}$/.test(y)) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return `${y}${pad2(month)}`;
}

function getRowYm(campaign_date: string | null | undefined) {
  const s = String(campaign_date || "").slice(0, 7);
  return /^\d{4}-\d{2}$/.test(s) ? s.replace("-", "") : "";
}

function round3(n: number) {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

function toNumOrNaN(v: unknown) {
  if (v === null || v === undefined) return NaN;
  const t = String(v).trim().replace(",", ".");
  if (!t) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function gt0_OrNull(v: unknown) {
  const n = toNumOrNaN(v);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return n;
}

function parseCuValue(v: unknown): { ok: boolean; value: number | null } {
  const t = String(v ?? "").trim();
  if (!t) return { ok: true, value: null };

  const n = toNumOrNaN(t);
  if (!Number.isFinite(n)) return { ok: false, value: null };
  if (n < 0) return { ok: false, value: null };
  if (n === 0) return { ok: true, value: null };

  return { ok: true, value: n };
}

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

  if (["campaignid", "campana", "campaña", "campaign"].includes(h)) return "campaign_id";
  if (["campaignau", "au", "produccionau", "productionau"].includes(h)) return "campaign_au";
  if (["campaignag", "ag", "produccionag", "productionag"].includes(h)) return "campaign_ag";
  if (["campaigncu", "cu", "produccioncu", "productioncu"].includes(h)) return "campaign_cu";

  return "";
}

function toCompareFixed3(v: unknown) {
  const n = toNumOrNaN(v);
  if (!Number.isFinite(n)) return null;
  return round3(n).toFixed(3);
}

function toCompareFixed3NullZero(v: unknown) {
  const n = toNumOrNaN(v);
  if (!Number.isFinite(n)) return null;
  const r = round3(n);
  if (r === 0) return null;
  return r.toFixed(3);
}

function sortPreviewRowsByCampaignId(rows: ImportPreviewRow[]) {
  return [...rows].sort((a, b) => {
    const aId = normalizeText(a.campaign_id).toUpperCase();
    const bId = normalizeText(b.campaign_id).toUpperCase();

    if (!aId && !bId) return a.row_num - b.row_num;
    if (!aId || aId === "—") return 1;
    if (!bId || bId === "—") return -1;

    return aId.localeCompare(bId);
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

function getDuplicateStats(rows: ImportPreviewRow[]) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const id = normalizeText(row.campaign_id).toUpperCase();
    if (!id || id === "—") continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }

  const repeatedCampaigns = Array.from(counts.values()).filter((count) => count > 1).length;
  const repeatedExtraRows = Array.from(counts.values()).reduce(
    (acc, count) => acc + (count > 1 ? count - 1 : 0),
    0
  );

  return {
    repeated_campaigns: repeatedCampaigns,
    repeated_extra_rows: repeatedExtraRows,
  };
}

function buildImportSummary(
  previewRows: ImportPreviewRow[],
  file_name: string,
  total_excel_rows: number,
  baseRepeatedCampaigns = 0,
  baseRepeatedExtraRows = 0
): ImportSummary {
  const currentDup = getDuplicateStats(previewRows);
  const validRows = previewRows.filter((row) => row.valid);
  const updateRows = validRows.filter((row) => row.status === "ACTUALIZAR").length;
  const equalRows = validRows.filter((row) => row.status === "IGUAL").length;

  return {
    file_name,
    total_excel_rows,
    unique_rows: previewRows.length,
    valid_rows: validRows.length,
    invalid_rows: previewRows.length - validRows.length,
    repeated_campaigns: Math.max(baseRepeatedCampaigns, currentDup.repeated_campaigns),
    repeated_extra_rows: Math.max(baseRepeatedExtraRows, currentDup.repeated_extra_rows),
    update_rows: updateRows,
    equal_rows: equalRows,
  };
}

function revalidatePreviewRows(
  draftRows: ImportPreviewRow[],
  latestRows: CampaignRow[],
  file_name: string,
  total_excel_rows: number,
  baseRepeatedCampaigns = 0,
  baseRepeatedExtraRows = 0
): { rows: ImportPreviewRow[]; summary: ImportSummary } {
  const existingById = new Map<string, CampaignRow>(
    latestRows
      .filter((x) => !!normalizeText(x.campaign_id))
      .map((x) => [normalizeText(x.campaign_id).toUpperCase(), x] as const)
  );

  const counts = new Map<string, number>();

  for (const draft of draftRows) {
    const id = normalizeText(draft.campaign_id).toUpperCase();
    if (!id || id === "—") continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }

  const rows: ImportPreviewRow[] = draftRows.map((draft) => {
    const campaign_id = normalizeText(draft.campaign_id).toUpperCase();
    const campaign_au = normalizeText(draft.campaign_au);
    const campaign_ag = normalizeText(draft.campaign_ag);
    const campaign_cu = normalizeText(draft.campaign_cu);

    const au = gt0_OrNull(campaign_au);
    const ag = gt0_OrNull(campaign_ag);
    const cuParsed = parseCuValue(campaign_cu);

    const existingRow = campaign_id ? existingById.get(campaign_id) ?? null : null;

    const errors: string[] = [];
    if (!campaign_id) errors.push("campaign_id inválido");
    if (!existingRow) errors.push("campaign_id no existe en dim.refinery_campaign");
    if (au === null) errors.push("campaign_au inválido (>0)");
    if (ag === null) errors.push("campaign_ag inválido (>0)");
    if (!cuParsed.ok) errors.push("campaign_cu inválido (vacío, 0 o >0)");

    const validBase =
      !!campaign_id &&
      !!existingRow &&
      au !== null &&
      ag !== null &&
      cuParsed.ok;

    const payloadAu = au !== null ? round3(au) : null;
    const payloadAg = ag !== null ? round3(ag) : null;
    const payloadCu =
      cuParsed.ok && cuParsed.value !== null ? round3(cuParsed.value) : null;

    const isEqualToDb =
      validBase &&
      !!existingRow &&
      toCompareFixed3(existingRow.campaign_au) === toCompareFixed3(payloadAu) &&
      toCompareFixed3(existingRow.campaign_ag) === toCompareFixed3(payloadAg) &&
      toCompareFixed3NullZero(existingRow.campaign_cu) ===
        toCompareFixed3NullZero(payloadCu);

    const status: ImportPreviewRow["status"] = !validBase
      ? "INVÁLIDA"
      : isEqualToDb
      ? "IGUAL"
      : "ACTUALIZAR";

    return {
      ...draft,
      campaign_id: campaign_id || "—",
      campaign_au,
      campaign_ag,
      campaign_cu,
      status,
      errors: errors.join(" | "),
      duplicate_count: 0,
      is_duplicate: false,
      valid: validBase,
      payload:
        validBase && campaign_id && payloadAu !== null && payloadAg !== null && status !== "IGUAL"
          ? {
              campaign_id,
              campaign_au: payloadAu,
              campaign_ag: payloadAg,
              campaign_cu: payloadCu,
            }
          : null,
    };
  });

  for (const row of rows) {
    const id = normalizeText(row.campaign_id).toUpperCase();
    const count = id && id !== "—" ? counts.get(id) || 0 : 0;

    row.duplicate_count = count;
    row.is_duplicate = count > 1;

    if (row.is_duplicate) {
      row.status = "INVÁLIDA";
      row.valid = false;
      row.payload = null;
      row.errors = row.errors
        ? `${row.errors} | campaign_id repetido en preview`
        : "campaign_id repetido en preview";
    }
  }

  const orderedRows = sortPreviewRowsByCampaignId(rows);

  return {
    rows: orderedRows,
    summary: buildImportSummary(
      orderedRows,
      file_name,
      total_excel_rows,
      baseRepeatedCampaigns,
      baseRepeatedExtraRows
    ),
  };
}

function Select({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const currentLabel =
    options.find((o) => o.value === value)?.label ??
    options.find((o) => o.value === "")?.label ??
    "";

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as any)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  return (
    <div style={{ display: "grid", gap: 6 }} ref={wrapRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((s) => !s)}
        style={{
          width: "100%",
          textAlign: "left",
          background: "rgba(0,0,0,.10)",
          border: "1px solid var(--border)",
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
          gap: 12,
          height: 38,
          minWidth: 114,
        }}
      >
        <span style={{ opacity: value ? 1 : 0.6 }}>{currentLabel}</span>
        <span style={{ opacity: 0.8 }}>▾</span>
      </button>

      {open ? (
        <div style={{ position: "relative", zIndex: 50 }}>
          <div
            style={{
              position: "absolute",
              top: 6,
              left: 0,
              right: 0,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.10)",
              background: "rgba(5, 25, 45, .98)",
              boxShadow: "0 10px 30px rgba(0,0,0,.45)",
              overflow: "hidden",
            }}
          >
            {options.map((o) => {
              const active = o.value === value;
              const isEmpty = o.value === "";
              return (
                <button
                  key={o.value || "__empty__"}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
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
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as any).style.background = active
                      ? "rgba(102,199,255,.18)"
                      : "rgba(255,255,255,.06)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as any).style.background = active
                      ? "rgba(102,199,255,.18)"
                      : "transparent";
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ProdImpExp({
  rows,
  setMsgAction,
  loadCampaignsAction,
  disabled = false,
}: Props) {
  const [importing, setImporting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const initRange = useMemo(() => defaultExportRange(), []);
  const [fromYear, setFromYear] = useState<string>(initRange.fromYear);
  const [fromMonth, setFromMonth] = useState<number>(initRange.fromMonth);
  const [toYear, setToYear] = useState<string>(initRange.toYear);
  const [toMonth, setToMonth] = useState<number>(initRange.toMonth);

  const monthOptions = useMemo(
    () => MONTHS.map((m) => ({ value: String(m.value), label: m.label })),
    []
  );

  const fromYm = useMemo(() => ymFromInputs(fromYear, fromMonth) ?? "", [fromYear, fromMonth]);
  const toYm = useMemo(() => ymFromInputs(toYear, toMonth) ?? "", [toYear, toMonth]);

  const exportRangeValid = !!fromYm && !!toYm && fromYm <= toYm;

  const exportRowsInRange = useMemo(() => {
    if (!exportRangeValid) return [];

    return rows.filter((row) => {
      const rowYm = getRowYm(row.campaign_date);
      return !!rowYm && rowYm >= fromYm && rowYm <= toYm;
    });
  }, [rows, fromYm, toYm, exportRangeValid]);

  async function getLatestRows() {
    try {
      const r = (await apiGet("/api/refineria/campaigns")) as CampaignsResp;
      return Array.isArray(r?.rows) ? r.rows : rows;
    } catch {
      return rows;
    }
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

  function onEditPreviewCell(
    rowNum: number,
    field: "campaign_id" | "campaign_au" | "campaign_ag" | "campaign_cu",
    value: string
  ) {
    const file_name = importSummary?.file_name || "Production";
    const total_excel_rows = importSummary?.total_excel_rows || previewRows.length;
    const repeated_campaigns = importSummary?.repeated_campaigns || 0;
    const repeated_extra_rows = importSummary?.repeated_extra_rows || 0;

    const draftRows = previewRows.map((row) =>
      row.row_num === rowNum ? { ...row, [field]: value } : row
    );

    const { rows: revalidatedRows, summary } = revalidatePreviewRows(
      draftRows,
      rows,
      file_name,
      total_excel_rows,
      repeated_campaigns,
      repeated_extra_rows
    );

    setPreviewRows(revalidatedRows);
    setImportSummary(summary);
  }

  function onExportExcel() {
    if (!exportRangeValid) {
      setMsgAction("ERROR: rango Desde/Hasta inválido.");
      return;
    }

    if (!exportRowsInRange.length) {
      setMsgAction("No hay campañas para exportar en el rango seleccionado.");
      return;
    }

    const exportRows = [...exportRowsInRange]
      .sort((a, b) => normalizeText(a.campaign_id).localeCompare(normalizeText(b.campaign_id)))
      .map((row) => {
        const cu = toNumOrNaN(row.campaign_cu);
        return {
          campaign_id: normalizeText(row.campaign_id),
          campaign_au:
            row.campaign_au == null || row.campaign_au === ""
              ? ""
              : round3(Number(row.campaign_au)),
          campaign_ag:
            row.campaign_ag == null || row.campaign_ag === ""
              ? ""
              : round3(Number(row.campaign_ag)),
          campaign_cu:
            !Number.isFinite(cu) || cu === 0 ? "" : round3(cu),
        };
      });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws["!cols"] = [
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Production");
    XLSX.writeFile(wb, `refinery_production_${getFileStamp()}.xlsx`);
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

      const requiredFields: ImportField[] = [
        "campaign_id",
        "campaign_au",
        "campaign_ag",
        "campaign_cu",
      ];

      const missingHeaders = requiredFields.filter((field) => !normalizedFields.includes(field));

      if (missingHeaders.length) {
        throw new Error(
          "Faltan columnas. Deben venir: campaign_id, campaign_au, campaign_ag, campaign_cu"
        );
      }

      const latestRows = await getLatestRows();

      const baseRows = rawRows
        .map((raw, idx) => {
          const getValue = (fieldName: string) => {
            const sourceKey = Object.keys(raw).find((k) => getImportField(k) === fieldName);
            return sourceKey ? raw[sourceKey] : "";
          };

          return {
            row_num: idx + 2,
            campaign_id: normalizeText(getValue("campaign_id")).toUpperCase(),
            campaign_au_raw: normalizeText(getValue("campaign_au")),
            campaign_ag_raw: normalizeText(getValue("campaign_ag")),
            campaign_cu_raw: normalizeText(getValue("campaign_cu")),
          };
        })
        .filter((row) => {
          return (
            !isBlank(row.campaign_id) ||
            !isBlank(row.campaign_au_raw) ||
            !isBlank(row.campaign_ag_raw) ||
            !isBlank(row.campaign_cu_raw)
          );
        });

      if (!baseRows.length) {
        throw new Error("No hay filas válidas para importar.");
      }

      const rawCounts = new Map<string, number>();
      for (const row of baseRows) {
        const id = normalizeText(row.campaign_id).toUpperCase();
        if (!id) continue;
        rawCounts.set(id, (rawCounts.get(id) || 0) + 1);
      }

      const rawRepeatedCampaigns = Array.from(rawCounts.values()).filter((count) => count > 1).length;
      const rawRepeatedExtraRows = Array.from(rawCounts.values()).reduce(
        (acc, count) => acc + (count > 1 ? count - 1 : 0),
        0
      );

      const dedupMap = new Map<string, ImportPreviewRow>();
      const rowsWithoutId: ImportPreviewRow[] = [];

      for (const row of baseRows) {
        const seedRow: ImportPreviewRow = {
          row_num: row.row_num,
          campaign_id: row.campaign_id || "—",
          campaign_au: row.campaign_au_raw,
          campaign_ag: row.campaign_ag_raw,
          campaign_cu: row.campaign_cu_raw,
          status: "INVÁLIDA",
          errors: "",
          duplicate_count: 0,
          is_duplicate: false,
          valid: false,
          payload: null,
        };

        if (!row.campaign_id) {
          rowsWithoutId.push(seedRow);
        } else {
          dedupMap.set(row.campaign_id, seedRow);
        }
      }

      const preview = [...rowsWithoutId, ...Array.from(dedupMap.values())];

      const { rows: revalidatedRows, summary } = revalidatePreviewRows(
        preview,
        latestRows,
        file.name,
        rawRows.length,
        rawRepeatedCampaigns,
        rawRepeatedExtraRows
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
      const orderedPreviewRows = sortPreviewRowsByCampaignId(previewRows).filter((row) => !!row.payload);

      if (!orderedPreviewRows.length) {
        setMsgAction("No hay cambios para importar.");
        return;
      }

      for (const row of orderedPreviewRows) {
        if (!row.payload) continue;
        await apiPost("/api/refineria/campaign/upsert", row.payload);
      }

      await loadCampaignsAction(false);
      setPreviewOpen(false);
      setPreviewRows([]);
      setImportSummary(null);
      setMsgAction(`OK: se importaron ${orderedPreviewRows.length} fila(s) de producción.`);
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
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={onImportFile}
        style={{ display: "none" }}
      />

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.9 }}>Desde</div>

        <div style={{ width: 114 }}>
          <Input
            value={fromYear}
            onChange={(e: any) => {
              const v = String(e.target.value || "").trim();
              setFromYear(v);
            }}
          />
        </div>

        <div style={{ display: "grid", gap: 4 }}>
          <Select
            value={String(fromMonth)}
            onChange={(v) => setFromMonth(Number(v))}
            disabled={disabled || importing}
            options={monthOptions}
          />
        </div>

        <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.9, marginLeft: 6 }}>Hasta</div>

        <div style={{ width: 114 }}>
          <Input
            value={toYear}
            onChange={(e: any) => {
              const v = String(e.target.value || "").trim();
              setToYear(v);
            }}
          />
        </div>

        <div style={{ display: "grid", gap: 4 }}>
          <Select
            value={String(toMonth)}
            onChange={(v) => setToMonth(Number(v))}
            disabled={disabled || importing}
            options={monthOptions}
          />
        </div>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onExportExcel}
          disabled={disabled || importing || !exportRangeValid || exportRowsInRange.length === 0}
        >
          Exportar Excel
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onClickImport}
          disabled={disabled || importing}
        >
          {importing ? "Importando…" : "Importar Excel"}
        </Button>
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
              width: "min(1120px, 96vw)",
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
                <div style={{ fontSize: 18, fontWeight: 900 }}>Preview de importación de producción</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Se tomará la fila más baja cuando un campaign_id venga repetido.
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
                <div style={{ padding: "6px 10px", borderRadius: 999, border: importSummary.repeated_campaigns > 0 ? "1px solid rgba(255,170,60,.45)" : "1px solid rgba(255,255,255,0.12)", background: importSummary.repeated_campaigns > 0 ? "rgba(255,170,60,.10)" : "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Campaigns repetidas: {importSummary.repeated_campaigns}
                </div>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: importSummary.repeated_extra_rows > 0 ? "1px solid rgba(255,170,60,.45)" : "1px solid rgba(255,255,255,0.12)", background: importSummary.repeated_extra_rows > 0 ? "rgba(255,170,60,.10)" : "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Filas extra repetidas: {importSummary.repeated_extra_rows}
                </div>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Actualizar: {importSummary.update_rows}
                </div>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Iguales: {importSummary.equal_rows}
                </div>
              </div>
            ) : null}

            <div style={{ minWidth: 0, minHeight: 0, overflow: "auto", border: "1px solid rgba(191,231,255,.12)", borderRadius: 12 }}>
              <Table stickyHeader disableScrollWrapper>
                <colgroup>
                  <col style={{ width: 70 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 320 }} />
                </colgroup>
                <thead>
                  <tr>
                    {[
                      "fila",
                      "campaign_id",
                      "campaign_au",
                      "campaign_ag",
                      "campaign_cu",
                      "estado",
                      "repetido",
                      "errores",
                    ].map((label) => (
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
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => {
                    const bg = !row.valid
                      ? "rgba(255,80,80,.10)"
                      : row.is_duplicate
                      ? "rgba(255,170,60,.12)"
                      : rowBg;

                    return (
                      <tr key={`${row.row_num}_${row.campaign_id}`} className="capex-tr">
                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>
                          {row.row_num}
                        </td>

                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>
                          <input
                            value={row.campaign_id === "—" ? "" : row.campaign_id}
                            onChange={(e) =>
                              onEditPreviewCell(
                                row.row_num,
                                "campaign_id",
                                String(e.target.value || "").trim().toUpperCase()
                              )
                            }
                            placeholder="campaign_id"
                            style={previewInputStyle}
                          />
                        </td>

                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>
                          <input
                            value={row.campaign_au}
                            onChange={(e) => onEditPreviewCell(row.row_num, "campaign_au", e.target.value)}
                            style={previewInputStyle}
                          />
                        </td>

                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>
                          <input
                            value={row.campaign_ag}
                            onChange={(e) => onEditPreviewCell(row.row_num, "campaign_ag", e.target.value)}
                            style={previewInputStyle}
                          />
                        </td>

                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>
                          <input
                            value={row.campaign_cu}
                            onChange={(e) => onEditPreviewCell(row.row_num, "campaign_cu", e.target.value)}
                            style={previewInputStyle}
                            placeholder="vacío o 0 = null"
                          />
                        </td>

                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg, fontWeight: 900 }}>
                          {row.status}
                        </td>

                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg, fontWeight: 900 }}>
                          {row.is_duplicate ? `Sí (${row.duplicate_count})` : "No"}
                        </td>

                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }} title={row.errors || "—"}>
                          {row.errors || "—"}
                        </td>
                      </tr>
                    );
                  })}

                  {previewRows.length === 0 ? (
                    <tr className="capex-tr">
                      <td className="capex-td" style={{ ...cellBase, fontWeight: 900 }} colSpan={8}>
                        No hay filas para preview.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </Table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9 }}>
                {previewRows.some((row) => !row.valid)
                  ? "Corrige las filas inválidas para habilitar la importación."
                  : `Se postearán exactamente ${previewRows.filter((row) => !!row.payload).length} fila(s) con cambios.`}
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
    </>
  );
}