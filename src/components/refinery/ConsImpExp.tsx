// src/components/refinery/ConsImpExp.tsx
"use client";

import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

type CampaignRow = { campaign_id: string };
type CampaignsResp = { ok: boolean; rows: CampaignRow[] };

type MapRow = { reagent_name: string; subprocess_name: string };
type MappingResp = { ok: boolean; rows: MapRow[] };

type ConsumptionRow = {
  campaign_id: string;
  reagent_name: string;
  consumption_date: string | null;
  subprocess_name: string;
  consumption_qty: any;
};
type ConsumptionResp = { ok: boolean; rows: ConsumptionRow[] };

type ImportField =
  | "campaign_id"
  | "reagent_name"
  | "consumption_date"
  | "subprocess_name"
  | "consumption_qty";

type ImportPreviewRow = {
  row_num: number;
  campaign_id: string;
  reagent_name: string;
  consumption_date: string;
  subprocess_name: string;
  consumption_qty: string;
  status: "NUEVA" | "ACTUALIZAR" | "INVÁLIDA";
  errors: string;
  valid: boolean;
  source_duplicate_count: number;
  payload: {
    campaign_id: string;
    reagent_name: string;
    consumption_date: string;
    subprocess_name: string;
    consumption_qty: string;
  } | null;
};

type ImportSummary = {
  file_name: string;
  total_excel_rows: number;
  unique_rows: number;
  valid_rows: number;
  invalid_rows: number;
  repeated_keys: number;
  repeated_extra_rows: number;
  new_rows: number;
  update_rows: number;
};

type RefData = {
  campaigns: CampaignRow[];
  mapping: MapRow[];
  consumptions: ConsumptionRow[];
};

const FIXED_MAPPING: MapRow[] = [
  { reagent_name: "Ácido Clorhídrico 1.165", subprocess_name: "Agua Regia - Disolución" },
  { reagent_name: "Ácido Clorhídrico 1.165", subprocess_name: "Otros" },
  { reagent_name: "Ácido Clorhídrico 1.165", subprocess_name: "Reactivación Química" },
  { reagent_name: "Ácido Nítrico 68%", subprocess_name: "Agua Regia - Disolución" },
  { reagent_name: "Ácido Nítrico 68%", subprocess_name: "Ataque Químico" },
  { reagent_name: "Ácido Nítrico 68%", subprocess_name: "Otros" },
  { reagent_name: "Ácido Sulfúrico 1.825-1.84", subprocess_name: "Ataque de Lanillas" },
  { reagent_name: "Alcohol", subprocess_name: "Desorción" },
  { reagent_name: "Azúcar", subprocess_name: "Metalización - Ag" },
  { reagent_name: "Bisulfito de Sodio", subprocess_name: "Agua Regia - Precipitación" },
  { reagent_name: "Borax", subprocess_name: "Fundición" },
  { reagent_name: "Crisol A10", subprocess_name: "Fundición - Ag" },
  { reagent_name: "Crisol A10", subprocess_name: "Fundición - Au" },
  { reagent_name: "Crisol A20", subprocess_name: "Fundición - Ag" },
  { reagent_name: "Crisol A20", subprocess_name: "Fundición - Au" },
  { reagent_name: "Crisol A5", subprocess_name: "Fundición - Ag" },
  { reagent_name: "Crisol A5", subprocess_name: "Fundición - Au" },
  { reagent_name: "GLP", subprocess_name: "Desorción" },
  { reagent_name: "GLP", subprocess_name: "Fundición" },
  { reagent_name: "Guantes", subprocess_name: "Guantes" },
  { reagent_name: "Lana Acero", subprocess_name: "Desorción" },
  { reagent_name: "Mandil", subprocess_name: "Mandiles" },
  { reagent_name: "Papel Filtro Lento", subprocess_name: "Filtrado - Ag" },
  { reagent_name: "Papel Filtro Lento", subprocess_name: "Filtrado - Au" },
  { reagent_name: "Papel Filtro Rápido", subprocess_name: "Filtrado - Ag" },
  { reagent_name: "Papel Filtro Rápido", subprocess_name: "Filtrado - Au" },
  { reagent_name: "Peróxido de Hidrógeno", subprocess_name: "Neutralización - Gases" },
  { reagent_name: "Sal", subprocess_name: "Metalización - Ag" },
  { reagent_name: "Soda Cáustica", subprocess_name: "Agua Regia - Neutralización" },
  { reagent_name: "Soda Cáustica", subprocess_name: "Desorción" },
  { reagent_name: "Soda Cáustica", subprocess_name: "Metalización - Ag" },
  { reagent_name: "Soda Cáustica", subprocess_name: "Neutralización de Pozas de Solución Barren - Solución" },
  { reagent_name: "Soda Cáustica", subprocess_name: "Neutralización - Solución" },
  { reagent_name: "Soda Cáustica", subprocess_name: "Regeneración Resinas Desionizador" },
  { reagent_name: "Soda Cáustica", subprocess_name: "Torres de Neutralización - Gases" },
  { reagent_name: "Solución Amoniacal 25%-34%", subprocess_name: "Agua Regia - Precipitación" },
  { reagent_name: "Urea", subprocess_name: "Agua Regia - Precipitación" },
];

type Props = {
  setMsgAction: React.Dispatch<React.SetStateAction<string | null>>;
  afterImportAction?: () => Promise<void> | void;
  disabled?: boolean;
  exportCampaignId?: string;
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

  if (["campaignid", "campaign_id", "campaign"].includes(h)) return "campaign_id";
  if (["reagentname", "reagent_name", "reagent", "insumo"].includes(h)) return "reagent_name";
  if (["consumptiondate", "consumption_date", "fecha", "fechaconsumo"].includes(h))
    return "consumption_date";
  if (["subprocessname", "subprocess_name", "subprocess", "subproceso"].includes(h))
    return "subprocess_name";
  if (["consumptionqty", "consumption_qty", "qty", "cantidad", "consumo"].includes(h))
    return "consumption_qty";

  return "";
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

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

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

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(normalizeText(s));
}

function toNum(v: any) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toDecimalStrOrNullFront(v: string, scale = 9) {
  const s0 = String(v ?? "").trim();
  if (!s0) return null;

  let s = s0.replace(/\s+/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    const decSep = lastComma > lastDot ? "," : ".";
    const thouSep = decSep === "," ? "." : ",";
    s = s.split(thouSep).join("");
    if (decSep === ",") s = s.replace(",", ".");
  } else if (hasComma && !hasDot) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length === 3) s = parts.join("");
    else s = s.replace(",", ".");
  } else {
    const parts = s.split(".");
    if (parts.length > 2) s = parts.join("");
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  if (Math.abs(n) > 9e15) return null;

  const f = Math.pow(10, scale);
  const rounded = Math.round(n * f) / f;
  return rounded.toFixed(scale);
}

function buildMapKey(reagent_name: string, subprocess_name: string) {
  return `${normalizeText(reagent_name).toUpperCase()}||${normalizeText(subprocess_name).toUpperCase()}`;
}

function buildDbKey(campaign_id: string, reagent_name: string, subprocess_name: string) {
  return `${normalizeText(campaign_id).toUpperCase()}||${normalizeText(reagent_name).toUpperCase()}||${normalizeText(subprocess_name).toUpperCase()}`;
}

function appendError(base: string, msg: string) {
  return base ? `${base} | ${msg}` : msg;
}

function sortPreviewRows(rows: ImportPreviewRow[]) {
  return [...rows].sort((a, b) => {
    const ka = buildDbKey(a.campaign_id, a.reagent_name, a.subprocess_name);
    const kb = buildDbKey(b.campaign_id, b.reagent_name, b.subprocess_name);

    if (!ka && !kb) return a.row_num - b.row_num;
    if (!ka) return 1;
    if (!kb) return -1;

    const cmp = ka.localeCompare(kb);
    return cmp !== 0 ? cmp : a.row_num - b.row_num;
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
  const validRows = previewRows.filter((row) => row.valid);
  const newRows = validRows.filter((row) => row.status === "NUEVA").length;
  const updateRows = validRows.filter((row) => row.status === "ACTUALIZAR").length;

  const repeatedKeys = previewRows.filter((row) => row.source_duplicate_count > 1).length;
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
    repeated_keys: repeatedKeys,
    repeated_extra_rows: repeatedExtraRows,
    new_rows: newRows,
    update_rows: updateRows,
  };
}

function revalidatePreviewRows(
  draftRows: ImportPreviewRow[],
  refData: RefData,
  file_name: string,
  total_excel_rows: number
): { rows: ImportPreviewRow[]; summary: ImportSummary } {
  const campaignSet = new Set(
    (refData.campaigns || []).map((x) => normalizeText(x.campaign_id).toUpperCase()).filter(Boolean)
  );

  const mapLookup = new Map<string, { reagent_name: string; subprocess_name: string }>();
  const validReagentLookup = new Map<string, string>();
  const validSubprocessLookup = new Map<string, string>();

  for (const row of refData.mapping || []) {
    const reagent_name = normalizeText(row.reagent_name);
    const subprocess_name = normalizeText(row.subprocess_name);

    const key = buildMapKey(reagent_name, subprocess_name);
    if (key && !mapLookup.has(key)) {
      mapLookup.set(key, { reagent_name, subprocess_name });
    }

    const reagentKey = normalizeText(reagent_name).toUpperCase();
    if (reagentKey && !validReagentLookup.has(reagentKey)) {
      validReagentLookup.set(reagentKey, reagent_name);
    }

    const subprocessKey = normalizeText(subprocess_name).toUpperCase();
    if (subprocessKey && !validSubprocessLookup.has(subprocessKey)) {
      validSubprocessLookup.set(subprocessKey, subprocess_name);
    }
  }

  const existingKeySet = new Set(
    (refData.consumptions || [])
      .map((x) => buildDbKey(x.campaign_id, x.reagent_name, x.subprocess_name))
      .filter(Boolean)
  );

  const previewCounts = new Map<string, number>();
  for (const row of draftRows) {
    const key = buildDbKey(row.campaign_id, row.reagent_name, row.subprocess_name);
    if (!key) continue;
    previewCounts.set(key, (previewCounts.get(key) || 0) + 1);
  }

  const rows = draftRows.map((draft): ImportPreviewRow => {
    const campaign_id = normalizeText(draft.campaign_id).toUpperCase();
    const reagent_name_raw = normalizeText(draft.reagent_name);
    const subprocess_name_raw = normalizeText(draft.subprocess_name);
    const consumption_date = normalizeText(draft.consumption_date);
    const consumption_qty = normalizeText(draft.consumption_qty);

    let errors = "";

    if (!campaign_id) {
      errors = appendError(errors, "campaign_id vacío");
    } else if (!campaignSet.has(campaign_id)) {
      errors = appendError(errors, "campaign_id no existe");
    }

    if (!reagent_name_raw) {
      errors = appendError(errors, "reagent_name vacío");
    }

    if (!subprocess_name_raw) {
      errors = appendError(errors, "subprocess_name vacío");
    }

    const reagentKey = normalizeText(reagent_name_raw).toUpperCase();
    const subprocessKey = normalizeText(subprocess_name_raw).toUpperCase();

    const canonicalReagent = validReagentLookup.get(reagentKey) ?? reagent_name_raw;
    const canonicalSubprocess = validSubprocessLookup.get(subprocessKey) ?? subprocess_name_raw;

    if (reagent_name_raw && !validReagentLookup.has(reagentKey)) {
      errors = appendError(errors, "reagent_name no existe en mapping");
    }

    if (subprocess_name_raw && !validSubprocessLookup.has(subprocessKey)) {
      errors = appendError(errors, "subprocess_name no existe en mapping");
    }

    const mapKey = buildMapKey(canonicalReagent, canonicalSubprocess);
    const canonicalCombo = mapLookup.get(mapKey);

    if (
      reagent_name_raw &&
      subprocess_name_raw &&
      validReagentLookup.has(reagentKey) &&
      validSubprocessLookup.has(subprocessKey) &&
      !canonicalCombo
    ) {
      errors = appendError(errors, "subprocess_name no corresponde a reagent_name");
    }

    if (!consumption_date || !isIsoDate(consumption_date)) {
      errors = appendError(errors, "consumption_date inválida");
    }

    const qty = toDecimalStrOrNullFront(consumption_qty, 9);
    if (qty === null) {
      errors = appendError(errors, "consumption_qty inválido (>0)");
    }

    const reagent_name = canonicalCombo?.reagent_name ?? canonicalReagent;
    const subprocess_name = canonicalCombo?.subprocess_name ?? canonicalSubprocess;

    const comboKey = buildDbKey(campaign_id, reagent_name, subprocess_name);
    const previewDupCount = comboKey ? previewCounts.get(comboKey) || 0 : 0;

    if (previewDupCount > 1) {
      errors = appendError(errors, "combinación repetida en preview");
    }

    const validBase = !errors;
    const existsInDb = comboKey ? existingKeySet.has(comboKey) : false;

    const status: ImportPreviewRow["status"] = !validBase
      ? "INVÁLIDA"
      : existsInDb
      ? "ACTUALIZAR"
      : "NUEVA";

    return {
      ...draft,
      campaign_id,
      reagent_name,
      consumption_date,
      subprocess_name,
      consumption_qty,
      status,
      errors,
      valid: validBase,
      payload:
        validBase && qty !== null
          ? {
              campaign_id,
              reagent_name,
              consumption_date,
              subprocess_name,
              consumption_qty: qty,
            }
          : null,
    };
  });

  const orderedRows = sortPreviewRows(rows);

  return {
    rows: orderedRows,
    summary: buildImportSummary(orderedRows, file_name, total_excel_rows),
  };
}

export default function ConsImpExp({
  setMsgAction,
  afterImportAction,
  disabled = false,
  exportCampaignId,
}: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const busy = importing || exporting;

    async function getReferenceData(): Promise<RefData> {
    const [campaignsRes, consumptionsRes] = await Promise.all([
        apiGet("/api/refineria/campaigns") as Promise<CampaignsResp>,
        apiGet("/api/refineria/consumption") as Promise<ConsumptionResp>,
    ]);

    return {
        campaigns: Array.isArray(campaignsRes?.rows) ? campaignsRes.rows : [],
        mapping: FIXED_MAPPING,
        consumptions: Array.isArray(consumptionsRes?.rows) ? consumptionsRes.rows : [],
    };
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

  async function onExportExcel() {
    if (busy) return;

    setExporting(true);
    setMsgAction(null);

    try {
      const q = exportCampaignId
        ? `?campaign_id=${encodeURIComponent(normalizeText(exportCampaignId).toUpperCase())}`
        : "";

      const r = (await apiGet(`/api/refineria/consumption${q}`)) as ConsumptionResp;
      const rows = Array.isArray(r?.rows) ? r.rows : [];

      if (!rows.length) {
        setMsgAction("No hay consumos para exportar.");
        return;
      }

      const exportRows = [...rows]
        .sort((a, b) => {
          const ka = buildDbKey(a.campaign_id, a.reagent_name, a.subprocess_name);
          const kb = buildDbKey(b.campaign_id, b.reagent_name, b.subprocess_name);
          const cmp = ka.localeCompare(kb);
          if (cmp !== 0) return cmp;
          return normalizeText(a.consumption_date).localeCompare(normalizeText(b.consumption_date));
        })
        .map((row) => ({
          campaign_id: normalizeText(row.campaign_id).toUpperCase(),
          reagent_name: normalizeText(row.reagent_name),
          consumption_date: normalizeText(row.consumption_date),
          subprocess_name: normalizeText(row.subprocess_name),
          consumption_qty:
            row.consumption_qty == null ? "" : String(toNum(row.consumption_qty) ?? row.consumption_qty),
        }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      ws["!cols"] = [
        { wch: 14 },
        { wch: 28 },
        { wch: 16 },
        { wch: 38 },
        { wch: 18 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Consumption");
      XLSX.writeFile(wb, `refinery_consumption_${getFileStamp()}.xlsx`);
    } catch (e: any) {
      setMsgAction(`ERROR: ${String(e?.message || e || "No se pudo exportar")}`);
    } finally {
      setExporting(false);
    }
  }

  function onEditPreviewCell(
    rowNum: number,
    field: "campaign_id" | "reagent_name" | "consumption_date" | "subprocess_name" | "consumption_qty",
    value: string
  ) {
    const file_name = importSummary?.file_name || "Consumption";
    const total_excel_rows = importSummary?.total_excel_rows || previewRows.length;

    const draftRows = previewRows.map((row) =>
      row.row_num === rowNum ? { ...row, [field]: value } : row
    );

    getReferenceData()
      .then((refData) => {
        const { rows, summary } = revalidatePreviewRows(
          draftRows,
          refData,
          file_name,
          total_excel_rows
        );
        setPreviewRows(rows);
        setImportSummary(summary);
      })
      .catch(() => {
        const fallbackRefData: RefData = { campaigns: [], mapping: [], consumptions: [] };
        const { rows, summary } = revalidatePreviewRows(
          draftRows,
          fallbackRefData,
          file_name,
          total_excel_rows
        );
        setPreviewRows(rows);
        setImportSummary(summary);
      });
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
        "reagent_name",
        "consumption_date",
        "subprocess_name",
        "consumption_qty",
      ];

      const missingHeaders = requiredFields.filter((field) => !normalizedFields.includes(field));

      if (missingHeaders.length) {
        throw new Error(
          "Faltan columnas. Deben venir exactamente: campaign_id, reagent_name, consumption_date, subprocess_name, consumption_qty"
        );
      }

      const refData = await getReferenceData();

      const baseRows = rawRows
        .map((raw, idx) => {
          const getValue = (fieldName: ImportField) => {
            const sourceKey = Object.keys(raw).find((k) => getImportField(k) === fieldName);
            return sourceKey ? raw[sourceKey] : "";
          };

          return {
            row_num: idx + 2,
            campaign_id: normalizeText(getValue("campaign_id")).toUpperCase(),
            reagent_name: normalizeText(getValue("reagent_name")),
            consumption_date: parseExcelDateToIso(getValue("consumption_date")),
            subprocess_name: normalizeText(getValue("subprocess_name")),
            consumption_qty: normalizeText(getValue("consumption_qty")),
          };
        })
        .filter((row) => {
          return (
            !isBlank(row.campaign_id) ||
            !isBlank(row.reagent_name) ||
            !isBlank(row.consumption_date) ||
            !isBlank(row.subprocess_name) ||
            !isBlank(row.consumption_qty)
          );
        });

      if (!baseRows.length) {
        throw new Error("No hay filas para importar.");
      }

      const sourceDuplicateCounts = new Map<string, number>();
      for (const row of baseRows) {
        const key = buildDbKey(row.campaign_id, row.reagent_name, row.subprocess_name);
        if (!key) continue;
        sourceDuplicateCounts.set(key, (sourceDuplicateCounts.get(key) || 0) + 1);
      }

      const dedupMap = new Map<string, ImportPreviewRow>();
      const rowsWithoutKey: ImportPreviewRow[] = [];

      for (const row of baseRows) {
        const key = buildDbKey(row.campaign_id, row.reagent_name, row.subprocess_name);

        const seedRow: ImportPreviewRow = {
          row_num: row.row_num,
          campaign_id: row.campaign_id,
          reagent_name: row.reagent_name,
          consumption_date: row.consumption_date,
          subprocess_name: row.subprocess_name,
          consumption_qty: row.consumption_qty,
          status: "INVÁLIDA",
          errors: "",
          valid: false,
          source_duplicate_count: key ? sourceDuplicateCounts.get(key) || 0 : 0,
          payload: null,
        };

        if (!key) {
          rowsWithoutKey.push(seedRow);
        } else {
          dedupMap.set(key, seedRow);
        }
      }

      const preview = [...rowsWithoutKey, ...Array.from(dedupMap.values())];

      const { rows, summary } = revalidatePreviewRows(
        preview,
        refData,
        file.name,
        rawRows.length
      );

      setPreviewRows(rows);
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

    setImporting(true);
    setMsgAction(null);

    try {
      const refData = await getReferenceData();
      const file_name = importSummary?.file_name || "Consumption";
      const total_excel_rows = importSummary?.total_excel_rows || previewRows.length;

      const { rows: latestPreviewRows, summary } = revalidatePreviewRows(
        previewRows,
        refData,
        file_name,
        total_excel_rows
      );

      setPreviewRows(latestPreviewRows);
      setImportSummary(summary);

      if (latestPreviewRows.some((row) => !row.valid)) {
        setMsgAction("ERROR: corrige las filas inválidas del preview antes de importar.");
        return;
      }

      const orderedRows = sortPreviewRows(latestPreviewRows);

      for (const row of orderedRows) {
        if (!row.payload) continue;
        await apiPost("/api/refineria/consumption/insert", row.payload);
      }

      if (afterImportAction) {
        await afterImportAction();
      }

      setPreviewOpen(false);
      setPreviewRows([]);
      setImportSummary(null);
      setMsgAction(`OK: se importaron ${orderedRows.length} consumo(s).`);
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

      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onExportExcel}
        disabled={disabled || busy}
      >
        {exporting ? "Exportando…" : "Exportar Excel"}
      </Button>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onClickImport}
        disabled={disabled || busy}
      >
        {importing ? "Importando…" : "Importar Excel"}
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
              width: "min(1480px, 96vw)",
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
                <div style={{ fontSize: 18, fontWeight: 900 }}>Preview de importación de consumos</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Si la combinación campaign_id + reagent_name + subprocess_name se repite en el Excel,
                  se tomará la fila más baja.
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
                <div style={{ padding: "6px 10px", borderRadius: 999, border: importSummary.repeated_keys > 0 ? "1px solid rgba(255,170,60,.45)" : "1px solid rgba(255,255,255,0.12)", background: importSummary.repeated_keys > 0 ? "rgba(255,170,60,.10)" : "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Combinaciones repetidas: {importSummary.repeated_keys}
                </div>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: importSummary.repeated_extra_rows > 0 ? "1px solid rgba(255,170,60,.45)" : "1px solid rgba(255,255,255,0.12)", background: importSummary.repeated_extra_rows > 0 ? "rgba(255,170,60,.10)" : "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Filas extra repetidas: {importSummary.repeated_extra_rows}
                </div>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Nuevas: {importSummary.new_rows}
                </div>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Actualizar: {importSummary.update_rows}
                </div>
              </div>
            ) : null}

            <div style={{ minWidth: 0, minHeight: 0, overflow: "auto", border: "1px solid rgba(191,231,255,.12)", borderRadius: 12 }}>
              <Table stickyHeader disableScrollWrapper>
                <colgroup>
                  <col style={{ width: 70 }} />
                  <col style={{ width: 140 }} />
                  <col style={{ width: 240 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 340 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 360 }} />
                </colgroup>
                <thead>
                  <tr>
                    {[
                      "fila",
                      "campaign_id",
                      "reagent_name",
                      "consumption_date",
                      "subprocess_name",
                      "consumption_qty",
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
                    const bg = !row.valid ? "rgba(255,80,80,.10)" : rowBg;

                    return (
                      <tr
                        key={`${row.row_num}_${row.campaign_id}_${row.reagent_name}_${row.subprocess_name}`}
                        className="capex-tr"
                      >
                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>
                          {row.row_num}
                        </td>

                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>
                          <input
                            value={row.campaign_id}
                            onChange={(e) => onEditPreviewCell(row.row_num, "campaign_id", String(e.target.value || "").toUpperCase())}
                            style={previewInputStyle}
                          />
                        </td>

                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>
                          <input
                            value={row.reagent_name}
                            onChange={(e) => onEditPreviewCell(row.row_num, "reagent_name", e.target.value)}
                            style={previewInputStyle}
                          />
                        </td>

                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>
                          <input
                            type="date"
                            value={row.consumption_date || ""}
                            onChange={(e) => onEditPreviewCell(row.row_num, "consumption_date", e.target.value)}
                            style={previewInputStyle}
                          />
                        </td>

                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>
                          <input
                            value={row.subprocess_name}
                            onChange={(e) => onEditPreviewCell(row.row_num, "subprocess_name", e.target.value)}
                            style={previewInputStyle}
                          />
                        </td>

                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>
                          <input
                            value={row.consumption_qty}
                            onChange={(e) => onEditPreviewCell(row.row_num, "consumption_qty", e.target.value)}
                            style={previewInputStyle}
                          />
                        </td>

                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg, fontWeight: 900 }}>
                          {row.status}
                        </td>

                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg, fontWeight: 900 }}>
                          {row.source_duplicate_count > 1 ? `Sí (${row.source_duplicate_count})` : "No"}
                        </td>

                        <td
                          className="capex-td"
                          style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}
                          title={row.errors || "—"}
                        >
                          {row.errors || "—"}
                        </td>
                      </tr>
                    );
                  })}

                  {previewRows.length === 0 ? (
                    <tr className="capex-tr">
                      <td className="capex-td" style={{ ...cellBase, fontWeight: 900 }} colSpan={9}>
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
                  : `Se postearán exactamente ${previewRows.length} fila(s) al endpoint de consumos.`}
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