// src/components/refinery/ConsImpExp.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

type CampaignRow = {
  campaign_id: string;
  campaign_date: string | null;
};
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

type ImportPreviewRow = {
  sheet_name: string;
  row_num: number;
  campaign_id: string;
  reagent_name: string;
  consumption_date: string;
  subprocess_name: string;
  consumption_qty: string;
  status: "NUEVA" | "ACTUALIZAR" | "IGUAL" | "INVÁLIDA";
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
  equal_rows: number;
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

const REAGENT_ORDER = Array.from(new Set(FIXED_MAPPING.map((x) => x.reagent_name)));

const SUBPROCESSES_BY_REAGENT = new Map<string, string[]>(
  REAGENT_ORDER.map((reagent) => [
    reagent,
    FIXED_MAPPING.filter((x) => x.reagent_name === reagent).map((x) => x.subprocess_name),
  ])
);

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

function normalizeLooseKey(v: unknown) {
  return normalizeText(v)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function sanitizeSheetName(name: string) {
  const clean = normalizeText(name).replace(/[:\\/?*\[\]]/g, " ").trim();
  return clean.slice(0, 31) || "Hoja";
}

const SHEET_NAME_BY_REAGENT = (() => {
  const used = new Set<string>();
  const map = new Map<string, string>();

  for (const reagent of REAGENT_ORDER) {
    const base = sanitizeSheetName(reagent);
    let candidate = base;
    let i = 1;

    while (used.has(candidate.toUpperCase())) {
      const suffix = `_${i}`;
      candidate = `${base.slice(0, Math.max(0, 31 - suffix.length))}${suffix}`;
      i += 1;
    }

    used.add(candidate.toUpperCase());
    map.set(reagent, candidate);
  }

  return map;
})();

const REAGENT_BY_SHEET_KEY = (() => {
  const map = new Map<string, string>();
  for (const reagent of REAGENT_ORDER) {
    const sheetName = SHEET_NAME_BY_REAGENT.get(reagent)!;
    map.set(normalizeLooseKey(sheetName), reagent);
  }
  return map;
})();

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

function toCompareFixed6(v: unknown) {
  const n = toNum(v);
  if (n === null) return null;
  return n.toFixed(6);
}

function buildMapKey(reagent_name: string, subprocess_name: string) {
  return `${normalizeText(reagent_name).toUpperCase()}||${normalizeText(subprocess_name).toUpperCase()}`;
}

function buildDbKey(campaign_id: string, reagent_name: string, subprocess_name: string) {
  return `${normalizeText(campaign_id).toUpperCase()}||${normalizeText(reagent_name).toUpperCase()}||${normalizeText(subprocess_name).toUpperCase()}`;
}

function getCampaignEomonth(campaign_id: string) {
  const m = normalizeText(campaign_id).match(/^(\d{2})-C(\d{2})-\d{2}$/i);
  if (!m) return "";

  const yyyy = 2000 + Number(m[1]);
  const mm = Number(m[2]);

  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || mm < 1 || mm > 12) return "";

  const lastDay = new Date(yyyy, mm, 0).getDate();
  return `${yyyy}-${pad2(mm)}-${pad2(lastDay)}`;
}

function appendError(base: string, msg: string) {
  return base ? `${base} | ${msg}` : msg;
}

function sortPreviewRows(rows: ImportPreviewRow[]) {
  return [...rows].sort((a, b) => {
    const reagentCmp = normalizeText(a.reagent_name).localeCompare(normalizeText(b.reagent_name));
    if (reagentCmp !== 0) return reagentCmp;

    const campaignCmp = normalizeText(a.campaign_id).localeCompare(normalizeText(b.campaign_id));
    if (campaignCmp !== 0) return campaignCmp;

    const dateCmp = normalizeText(a.consumption_date).localeCompare(normalizeText(b.consumption_date));
    if (dateCmp !== 0) return dateCmp;

    const subCmp = normalizeText(a.subprocess_name).localeCompare(normalizeText(b.subprocess_name));
    if (subCmp !== 0) return subCmp;

    return a.row_num - b.row_num;
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
  const equalRows = validRows.filter((row) => row.status === "IGUAL").length;

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
    equal_rows: equalRows,
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

  const campaignDateById = new Map<string, string>(
    (refData.campaigns || [])
      .map((x) => [normalizeText(x.campaign_id).toUpperCase(), normalizeText(x.campaign_date)] as const)
      .filter(([campaign_id]) => !!campaign_id)
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

    const existingRows = (refData.consumptions || []).map((x) => ({
      key: buildDbKey(x.campaign_id, x.reagent_name, x.subprocess_name),
      qty6: toCompareFixed6(x.consumption_qty),
    }));

    const existingKeySet = new Set(
      existingRows
        .map((x) => x.key)
        .filter(Boolean)
    );

    const existingQtyByKey = new Map<string, string>();
    for (const row of existingRows) {
      if (row.key && row.qty6 !== null && !existingQtyByKey.has(row.key)) {
        existingQtyByKey.set(row.key, row.qty6);
      }
    }

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
    const consumption_date = campaignDateById.get(campaign_id) || "";
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

    if (campaign_id && campaignSet.has(campaign_id)) {
      if (!consumption_date || !isIsoDate(consumption_date)) {
        errors = appendError(errors, "campaign_date no encontrada para la campaña");
      } else {
        const eomonth = getCampaignEomonth(campaign_id);

        if (!eomonth) {
          errors = appendError(errors, "campaign_id con formato inválido");
        } else if (consumption_date > eomonth) {
          errors = appendError(errors, `campaign_date mayor al fin de mes de la campaña (${eomonth})`);
        }
      }
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
    const incomingQty6 = qty !== null ? Number(qty).toFixed(6) : null;
    const existingQty6 = comboKey ? existingQtyByKey.get(comboKey) ?? null : null;
    const isEqualToDb = existsInDb && incomingQty6 !== null && existingQty6 !== null && incomingQty6 === existingQty6;

    const status: ImportPreviewRow["status"] = !validBase
      ? "INVÁLIDA"
      : isEqualToDb
      ? "IGUAL"
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
        validBase && qty !== null && status !== "IGUAL"
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

  const [runtimeMapping, setRuntimeMapping] = useState<MapRow[]>(FIXED_MAPPING);

const REAGENT_ORDER = useMemo(
  () =>
    Array.from(
      new Set(
        runtimeMapping
          .map((x) => normalizeText(x.reagent_name))
          .filter(Boolean)
      )
    ),
  [runtimeMapping]
);

const SUBPROCESSES_BY_REAGENT = useMemo(
  () =>
    new Map<string, string[]>(
      REAGENT_ORDER.map((reagent) => [
        reagent,
        runtimeMapping
          .filter((x) => normalizeText(x.reagent_name) === reagent)
          .map((x) => normalizeText(x.subprocess_name))
          .filter(Boolean),
      ])
    ),
  [REAGENT_ORDER, runtimeMapping]
);

const SHEET_NAME_BY_REAGENT = useMemo(() => {
  const used = new Set<string>();
  const map = new Map<string, string>();

  for (const reagent of REAGENT_ORDER) {
    const base = sanitizeSheetName(reagent);
    let candidate = base;
    let i = 1;

    while (used.has(candidate.toUpperCase())) {
      const suffix = `_${i}`;
      candidate = `${base.slice(0, Math.max(0, 31 - suffix.length))}${suffix}`;
      i += 1;
    }

    used.add(candidate.toUpperCase());
    map.set(reagent, candidate);
  }

  return map;
}, [REAGENT_ORDER]);

const REAGENT_BY_SHEET_KEY = useMemo(() => {
  const map = new Map<string, string>();

  for (const reagent of REAGENT_ORDER) {
    const sheetName = SHEET_NAME_BY_REAGENT.get(reagent)!;
    map.set(normalizeLooseKey(sheetName), reagent);
  }

  return map;
}, [REAGENT_ORDER, SHEET_NAME_BY_REAGENT]);

useEffect(() => {
  let mounted = true;

  (async () => {
    try {
      const mappingRes = (await apiGet("/api/refineria/mapping")) as MappingResp;
      const backendMapping =
        Array.isArray(mappingRes?.rows) && mappingRes.rows.length
          ? mappingRes.rows
          : FIXED_MAPPING;

      if (mounted) setRuntimeMapping(backendMapping);
    } catch {
      if (mounted) setRuntimeMapping(FIXED_MAPPING);
    }
  })();

  return () => {
    mounted = false;
  };
}, []);

  const groupedPreview = useMemo(() => {
    return REAGENT_ORDER.map((reagent_name) => ({
      reagent_name,
      sheet_name: SHEET_NAME_BY_REAGENT.get(reagent_name) || reagent_name,
      rows: previewRows.filter((x) => x.reagent_name === reagent_name),
    })).filter((g) => g.rows.length > 0);
  }, [previewRows]);

  const [previewReagent, setPreviewReagent] = useState<string>("");

  useEffect(() => {
    if (!groupedPreview.length) {
      setPreviewReagent("");
      return;
    }

    if (!groupedPreview.some((g) => g.reagent_name === previewReagent)) {
      setPreviewReagent(groupedPreview[0].reagent_name);
    }
  }, [groupedPreview, previewReagent]);

  const selectedPreviewGroup = useMemo(() => {
    return groupedPreview.find((g) => g.reagent_name === previewReagent) || null;
  }, [groupedPreview, previewReagent]);

  const previewMatrixRows = useMemo(() => {
    if (!selectedPreviewGroup) return [];

    const subprocesses = SUBPROCESSES_BY_REAGENT.get(selectedPreviewGroup.reagent_name) || [];
    const map = new Map<
      string,
      {
        row_num: number;
        campaign_id: string;
        consumption_date: string;
        status: "NUEVA" | "ACTUALIZAR" | "IGUAL" | "INVÁLIDA";
        has_duplicate: boolean;
        errors: string;
        cells: Record<string, string>;
        cellValid: Record<string, boolean>;
      }
    >();

    for (const row of selectedPreviewGroup.rows) {
      const key = `${row.reagent_name}||${row.row_num}||${row.campaign_id}||${row.consumption_date}`;
      if (!map.has(key)) {
        const seedCells: Record<string, string> = {};
        const seedValid: Record<string, boolean> = {};
        for (const sp of subprocesses) {
          seedCells[sp] = "";
          seedValid[sp] = true;
        }

        map.set(key, {
          row_num: row.row_num,
          campaign_id: row.campaign_id,
          consumption_date: row.consumption_date,
          status: row.status,
          has_duplicate: row.source_duplicate_count > 1,
          errors: row.errors,
          cells: seedCells,
          cellValid: seedValid,
        });
      }

      const item = map.get(key)!;
      item.cells[row.subprocess_name] = row.consumption_qty;
      item.cellValid[row.subprocess_name] = row.valid;

      if (row.status === "INVÁLIDA") {
        item.status = "INVÁLIDA";
      } else if (item.status !== "INVÁLIDA") {
        if (row.status === "ACTUALIZAR") {
          item.status = "ACTUALIZAR";
        } else if (row.status === "NUEVA" && item.status !== "ACTUALIZAR") {
          item.status = "NUEVA";
        } else if (
          row.status === "IGUAL" &&
          item.status !== "ACTUALIZAR" &&
          item.status !== "NUEVA"
        ) {
          item.status = "IGUAL";
        }
      }

      if (row.source_duplicate_count > 1) item.has_duplicate = true;
      if (row.errors) item.errors = item.errors ? `${item.errors} | ${row.errors}` : row.errors;
    }

    return Array.from(map.values()).sort((a, b) => {
      const cmpCampaign = normalizeText(a.campaign_id).localeCompare(normalizeText(b.campaign_id));
      if (cmpCampaign !== 0) return cmpCampaign;

      const cmpDate = normalizeText(a.consumption_date).localeCompare(normalizeText(b.consumption_date));
      if (cmpDate !== 0) return cmpDate;

      return a.row_num - b.row_num;
    });
  }, [selectedPreviewGroup]);

  async function getReferenceData(): Promise<RefData> {
    const [campaignsRes, mappingRes, consumptionsRes] = await Promise.all([
      apiGet("/api/refineria/campaigns") as Promise<CampaignsResp>,
      apiGet("/api/refineria/mapping") as Promise<MappingResp>,
      apiGet("/api/refineria/consumption") as Promise<ConsumptionResp>,
    ]);

    const backendMapping =
      Array.isArray(mappingRes?.rows) && mappingRes.rows.length
        ? mappingRes.rows
        : FIXED_MAPPING;

    setRuntimeMapping(backendMapping);

    return {
      campaigns: Array.isArray(campaignsRes?.rows) ? campaignsRes.rows : [],
      mapping: backendMapping,
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
      const r = (await apiGet("/api/refineria/consumption")) as ConsumptionResp;
      const rows = Array.isArray(r?.rows) ? r.rows : [];

      const wb = XLSX.utils.book_new();

      for (const reagent_name of REAGENT_ORDER) {
        const sheetName = SHEET_NAME_BY_REAGENT.get(reagent_name)!;
        const subprocesses = SUBPROCESSES_BY_REAGENT.get(reagent_name) || [];

        const filtered = rows.filter(
          (x) => normalizeText(x.reagent_name).toUpperCase() === normalizeText(reagent_name).toUpperCase()
        );

      const grouped = new Map<string, Record<string, any>>();

      for (const row of filtered) {
        const campaign_id = normalizeText(row.campaign_id).toUpperCase();
        const subprocess_name = normalizeText(row.subprocess_name);
        const key = campaign_id;

        if (!grouped.has(key)) {
          const seed: Record<string, any> = {
            campaign_id,
          };
          for (const sp of subprocesses) seed[sp] = "";
          grouped.set(key, seed);
        }

        grouped.get(key)![subprocess_name] =
          row.consumption_qty == null ? "" : String(toNum(row.consumption_qty) ?? row.consumption_qty);
      }

      const headers = ["campaign_id", ...subprocesses];
      const orderedRows = Array.from(grouped.values()).sort((a, b) =>
        normalizeText(a.campaign_id).localeCompare(normalizeText(b.campaign_id))
      );

      const aoa = [
        headers,
        ...orderedRows.map((row) => headers.map((h) => row[h] ?? "")),
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = [
        { wch: 14 },
        ...subprocesses.map((sp) => ({
          wch: Math.max(18, Math.min(40, sp.length + 4)),
        })),
      ];

        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      XLSX.writeFile(wb, `refinery_consumption_by_reagent_${getFileStamp()}.xlsx`);
    } catch (e: any) {
      setMsgAction(`ERROR: ${String(e?.message || e || "No se pudo exportar")}`);
    } finally {
      setExporting(false);
    }
  }

  function onEditPreviewCell(
    reagent_name: string,
    rowNum: number,
    field: "campaign_id" | "consumption_date" | "subprocess_name" | "consumption_qty",
    value: string
  ) {
    const file_name = importSummary?.file_name || "Consumption";
    const total_excel_rows = importSummary?.total_excel_rows || previewRows.length;

    const draftRows = previewRows.map((row) =>
      row.reagent_name === reagent_name && row.row_num === rowNum
        ? { ...row, [field]: value }
        : row
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
        const fallbackRefData: RefData = { campaigns: [], mapping: FIXED_MAPPING, consumptions: [] };
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

  function onEditPreviewRowField(
    reagent_name: string,
    rowNum: number,
    field: "campaign_id",
    value: string
  ) {
    const file_name = importSummary?.file_name || "Consumption";
    const total_excel_rows = importSummary?.total_excel_rows || previewRows.length;

    const draftRows = previewRows.map((row) =>
      row.reagent_name === reagent_name && row.row_num === rowNum
        ? { ...row, [field]: value }
        : row
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
        const fallbackRefData: RefData = { campaigns: [], mapping: FIXED_MAPPING, consumptions: [] };
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

  function onEditPreviewQtyMatrixCell(
    reagent_name: string,
    rowNum: number,
    subprocess_name: string,
    value: string
  ) {
    const file_name = importSummary?.file_name || "Consumption";
    const total_excel_rows = importSummary?.total_excel_rows || previewRows.length;

    const draftRows = previewRows.map((row) =>
      row.reagent_name === reagent_name &&
      row.row_num === rowNum &&
      row.subprocess_name === subprocess_name
        ? { ...row, consumption_qty: value }
        : row
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
        const fallbackRefData: RefData = { campaigns: [], mapping: FIXED_MAPPING, consumptions: [] };
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

      if (!workbook.SheetNames.length) {
        throw new Error("El archivo no tiene hojas.");
      }

      const refData = await getReferenceData();

      const allEntries: ImportPreviewRow[] = [];
      const recognizedSheets = workbook.SheetNames.filter((sheetName) =>
        REAGENT_BY_SHEET_KEY.has(normalizeLooseKey(sheetName))
      );

      if (!recognizedSheets.length) {
        throw new Error("No se reconocen hojas de reactivos válidas.");
      }

      const campaignDateById = new Map<string, string>(
        (refData.campaigns || [])
          .map((x) => [normalizeText(x.campaign_id).toUpperCase(), normalizeText(x.campaign_date)] as const)
          .filter(([campaign_id]) => !!campaign_id)
      );

      for (const sheetName of recognizedSheets) {
        const reagent_name = REAGENT_BY_SHEET_KEY.get(normalizeLooseKey(sheetName))!;
        const subprocesses = SUBPROCESSES_BY_REAGENT.get(reagent_name) || [];
        const sheet = workbook.Sheets[sheetName];

        const matrix = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
          raw: true,
        }) as unknown[][];

        if (!matrix.length) {
          continue;
        }

        const headersRaw = (matrix[0] || []).map((x) => normalizeText(x));
        const headersNorm = headersRaw.map((x) => normalizeHeader(x));

        const campaignIdx = headersNorm.findIndex((x) => x === "campaignid" || x === "campaign_id");

        if (campaignIdx < 0) {
          throw new Error(`En la hoja "${sheetName}" falta campaign_id.`);
        }

        const subIdxByName = new Map<string, number>();
        const missingSubCols: string[] = [];

        for (const sp of subprocesses) {
          const idx = headersNorm.findIndex((x) => x === normalizeHeader(sp));
          if (idx < 0) missingSubCols.push(sp);
          else subIdxByName.set(sp, idx);
        }

        if (missingSubCols.length) {
          throw new Error(`En la hoja "${sheetName}" faltan columnas: ${missingSubCols.join(", ")}`);
        }

        for (let i = 1; i < matrix.length; i++) {
          const excelRowNum = i + 1;
          const row = matrix[i] || [];

          const campaign_id = normalizeText(row[campaignIdx]).toUpperCase();
          const consumption_date = campaignDateById.get(campaign_id) || "";

          for (const subprocess_name of subprocesses) {
            const idx = subIdxByName.get(subprocess_name);
            if (idx === undefined) continue;

            const rawQty = normalizeText(row[idx]);
            if (isBlank(rawQty)) continue;

            allEntries.push({
              sheet_name: sheetName,
              row_num: excelRowNum,
              campaign_id,
              reagent_name,
              consumption_date,
              subprocess_name,
              consumption_qty: rawQty,
              status: "INVÁLIDA",
              errors: "",
              valid: false,
              source_duplicate_count: 0,
              payload: null,
            });
          }
        }
      }

      if (!allEntries.length) {
        throw new Error("No hay consumos para importar.");
      }

      const sourceDuplicateCounts = new Map<string, number>();
      for (const row of allEntries) {
        const key = buildDbKey(row.campaign_id, row.reagent_name, row.subprocess_name);
        if (!key) continue;
        sourceDuplicateCounts.set(key, (sourceDuplicateCounts.get(key) || 0) + 1);
      }

      const dedupMap = new Map<string, ImportPreviewRow>();
      const rowsWithoutKey: ImportPreviewRow[] = [];

      for (const row of allEntries) {
        const key = buildDbKey(row.campaign_id, row.reagent_name, row.subprocess_name);

        const seedRow: ImportPreviewRow = {
          ...row,
          source_duplicate_count: key ? sourceDuplicateCounts.get(key) || 0 : 0,
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
        allEntries.length
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

      const orderedRows = sortPreviewRows(latestPreviewRows.filter((row) => !!row.payload));

      if (!orderedRows.length) {
        setMsgAction("No hay cambios para importar.");
        return;
      }

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
              width: "min(1520px, 96vw)",
              height: "min(84vh, 860px)",
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
                  Preview de importación de consumos por reactivo
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Se leerán las 21 hojas por reactivo. Si una combinación campaign_id + reagent_name + subprocess_name
                  se repite, se toma la fila más baja.
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
                <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Iguales: {importSummary.equal_rows}
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
                padding: 10,
                display: "grid",
                gap: 10,
              }}
            >
              {groupedPreview.length ? (
                <>
                  <div style={{ display: "grid", gap: 6, maxWidth: 380 }}>
                    <div style={{ fontWeight: 900, fontSize: 13 }}>Reactivo a visualizar</div>
                    <select
                      value={previewReagent}
                      onChange={(e) => setPreviewReagent(e.target.value)}
                      style={{
                        width: "100%",
                        background: "rgba(0,0,0,.10)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                        borderRadius: 10,
                        padding: "10px 12px",
                        outline: "none",
                        fontWeight: 900,
                      }}
                    >
                      {groupedPreview.map((g) => (
                        <option key={g.reagent_name} value={g.reagent_name}>
                          {g.reagent_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedPreviewGroup ? (
                    <div
                      style={{
                        border: "1px solid rgba(191,231,255,.12)",
                        borderRadius: 12,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          padding: "10px 12px",
                          background: "rgba(255,255,255,.04)",
                          borderBottom: "1px solid rgba(191,231,255,.10)",
                          fontWeight: 900,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <span>{selectedPreviewGroup.reagent_name}</span>
                        <span style={{ opacity: 0.8, fontSize: 12 }}>{selectedPreviewGroup.sheet_name}</span>
                      </div>

                      <Table stickyHeader disableScrollWrapper>
                        <thead>
                          <tr>
                            <th className="capex-th" style={{ position: "sticky", top: 0, zIndex: 20, background: headerBg, border: headerBorder, padding: "8px 8px", fontSize: 12, whiteSpace: "nowrap", textAlign: "left" }}>
                              fila
                            </th>
                            <th className="capex-th" style={{ position: "sticky", top: 0, zIndex: 20, background: headerBg, border: headerBorder, padding: "8px 8px", fontSize: 12, whiteSpace: "nowrap", textAlign: "left" }}>
                              campaign_id
                            </th>
                            {(SUBPROCESSES_BY_REAGENT.get(selectedPreviewGroup.reagent_name) || []).map((sp) => (
                              <th
                                key={sp}
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
                                {sp}
                              </th>
                            ))}
                            <th className="capex-th" style={{ position: "sticky", top: 0, zIndex: 20, background: headerBg, border: headerBorder, padding: "8px 8px", fontSize: 12, whiteSpace: "nowrap", textAlign: "left" }}>
                              estado
                            </th>
                            <th className="capex-th" style={{ position: "sticky", top: 0, zIndex: 20, background: headerBg, border: headerBorder, padding: "8px 8px", fontSize: 12, whiteSpace: "nowrap", textAlign: "left" }}>
                              repetido
                            </th>
                            <th className="capex-th" style={{ position: "sticky", top: 0, zIndex: 20, background: headerBg, border: headerBorder, padding: "8px 8px", fontSize: 12, whiteSpace: "nowrap", textAlign: "left" }}>
                              errores
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {previewMatrixRows.map((row) => {
                            const bg = row.status === "INVÁLIDA" ? "rgba(255,80,80,.10)" : rowBg;

                            return (
                              <tr key={`${selectedPreviewGroup.reagent_name}_${row.row_num}_${row.campaign_id}_${row.consumption_date}`} className="capex-tr">
                                <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>
                                  {row.row_num}
                                </td>

                                <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>
                                  <input
                                    value={row.campaign_id}
                                    onChange={(e) =>
                                      onEditPreviewRowField(
                                        selectedPreviewGroup.reagent_name,
                                        row.row_num,
                                        "campaign_id",
                                        String(e.target.value || "").toUpperCase()
                                      )
                                    }
                                    style={previewInputStyle}
                                  />
                                </td>

                                {(SUBPROCESSES_BY_REAGENT.get(selectedPreviewGroup.reagent_name) || []).map((sp) => {
                                  const cellBg = row.cellValid[sp] ? bg : "rgba(255,80,80,.16)";
                                  return (
                                    <td
                                      key={`${row.row_num}_${sp}`}
                                      className="capex-td"
                                      style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: cellBg }}
                                    >
                                      <input
                                        value={row.cells[sp] || ""}
                                        onChange={(e) =>
                                          onEditPreviewQtyMatrixCell(
                                            selectedPreviewGroup.reagent_name,
                                            row.row_num,
                                            sp,
                                            e.target.value
                                          )
                                        }
                                        style={previewInputStyle}
                                      />
                                    </td>
                                  );
                                })}

                                <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg, fontWeight: 900 }}>
                                  {row.status}
                                </td>

                                <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg, fontWeight: 900 }}>
                                  {row.has_duplicate ? "Sí" : "No"}
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
                        </tbody>
                      </Table>
                    </div>
                  ) : null}
                </>
              ) : (
                <div style={{ padding: 12, fontWeight: 900 }}>No hay filas para preview.</div>
              )}
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