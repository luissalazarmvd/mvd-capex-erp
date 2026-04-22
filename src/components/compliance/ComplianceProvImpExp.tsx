// src/components/compliance/ComplianceProvImpExp.tsx
"use client";

import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

type ComplianceRow = {
  rucodm: string;
  ruc: string | null;
  proveedor: string | null;
  concession_owner: string | null;
  concession_status: string | null;
  concession_code: string | null;
  concession_name: string | null;
  department: string | null;
  province: string | null;
  district: string | null;
  zona_acopio: string | null;
  provider_condition: string | null;
  tipo_persona: string | null;
  tipo_empresa: string | null;
  geocatmin_xy: string | null;
  flag_informe_verificacion_minera: string | null;
  fecha_de_visita: string | null;
  coordinates_xy: string | null;
  zone_utm: string | null;
  north: number | string | null;
  east: number | string | null;
  tipo_vlm: string | null;
  geologist_name: string | null;
  updated_at: string | null;
};

type ComplianceResp = {
  ok: boolean;
  rows: ComplianceRow[];
  count?: number;
};

type CompliancePayload = {
  rucodm: string;
  ruc: string;
  proveedor: string;
  concession_owner: string;
  concession_status: string;
  concession_code: string;
  concession_name: string;
  department: string;
  province: string;
  district: string;
  zona_acopio: string;
  provider_condition: string;
  tipo_persona: string;
  tipo_empresa: string;
  geocatmin_xy: string;
  flag_informe_verificacion_minera: string;
  fecha_de_visita: string;
  coordinates_xy: string;
  zone_utm: string;
  north: number;
  east: number;
  tipo_vlm: string;
  geologist_name: string;
};

type ImportField =
  | "rucodm"
  | "ruc"
  | "proveedor"
  | "concession_owner"
  | "concession_status"
  | "concession_code"
  | "concession_name"
  | "department"
  | "province"
  | "district"
  | "zona_acopio"
  | "provider_condition"
  | "tipo_persona"
  | "tipo_empresa"
  | "geocatmin_xy"
  | "flag_informe_verificacion_minera"
  | "fecha_de_visita"
  | "coordinates_xy"
  | "zone_utm"
  | "north"
  | "east"
  | "tipo_vlm"
  | "geologist_name";

type PreviewField = ImportField;

type PreviewRow = {
  row_num: number;
  rucodm: string;
  ruc: string;
  proveedor: string;
  concession_owner: string;
  concession_status: string;
  concession_code: string;
  concession_name: string;
  department: string;
  province: string;
  district: string;
  zona_acopio: string;
  provider_condition: string;
  tipo_persona: string;
  tipo_empresa: string;
  geocatmin_xy: string;
  flag_informe_verificacion_minera: string;
  fecha_de_visita: string;
  coordinates_xy: string;
  zone_utm: string;
  north: string;
  east: string;
  tipo_vlm: string;
  geologist_name: string;
  status: "NUEVA" | "ACTUALIZAR" | "IGUAL" | "INVÁLIDA";
  errors: string;
  duplicate_count: number;
  is_duplicate: boolean;
  valid: boolean;
  payload: CompliancePayload | null;
  fieldErrors: Partial<Record<PreviewField, string>>;
};

type ImportSummary = {
  file_name: string;
  total_excel_rows: number;
  preview_rows: number;
  valid_rows: number;
  invalid_rows: number;
  new_rows: number;
  update_rows: number;
  equal_rows: number;
  repeated_keys: number;
};

type Props = {
  rows: ComplianceRow[];
  setMsgAction: React.Dispatch<React.SetStateAction<string | null>>;
  loadRowsAction: (clearMsg?: boolean) => Promise<void>;
  disabled?: boolean;
};

const IMPORT_FIELDS: ImportField[] = [
  "rucodm",
  "ruc",
  "proveedor",
  "concession_owner",
  "concession_status",
  "concession_code",
  "concession_name",
  "department",
  "province",
  "district",
  "zona_acopio",
  "provider_condition",
  "tipo_persona",
  "tipo_empresa",
  "geocatmin_xy",
  "flag_informe_verificacion_minera",
  "fecha_de_visita",
  "coordinates_xy",
  "zone_utm",
  "north",
  "east",
  "tipo_vlm",
  "geologist_name",
];

const PREVIEW_COLUMNS: { key: PreviewField; label: string; width?: number }[] = [
  { key: "rucodm", label: "RUC ODM", width: 130 },
  { key: "ruc", label: "RUC", width: 110 },
  { key: "proveedor", label: "Proveedor", width: 180 },
  { key: "concession_owner", label: "Concession Owner", width: 180 },
  { key: "concession_status", label: "Concession Status", width: 160 },
  { key: "concession_code", label: "Concession Code", width: 150 },
  { key: "concession_name", label: "Concession Name", width: 180 },
  { key: "department", label: "Department", width: 130 },
  { key: "province", label: "Province", width: 130 },
  { key: "district", label: "District", width: 130 },
  { key: "zona_acopio", label: "Zona Acopio", width: 140 },
  { key: "provider_condition", label: "Provider Condition", width: 150 },
  { key: "tipo_persona", label: "Tipo Persona", width: 130 },
  { key: "tipo_empresa", label: "Tipo Empresa", width: 140 },
  { key: "geocatmin_xy", label: "Geocatmin XY", width: 140 },
  { key: "flag_informe_verificacion_minera", label: "Flag Informe Verificación Minera", width: 230 },
  { key: "fecha_de_visita", label: "Fecha de Visita", width: 130 },
  { key: "coordinates_xy", label: "Coordinates XY", width: 150 },
  { key: "zone_utm", label: "Zone UTM", width: 110 },
  { key: "north", label: "North", width: 100 },
  { key: "east", label: "East", width: 100 },
  { key: "tipo_vlm", label: "Tipo VLM", width: 130 },
  { key: "geologist_name", label: "Geologist Name", width: 180 },
];

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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function peNow() {
  return new Date(new Date().getTime() - 5 * 60 * 60 * 1000);
}

function getFileStamp() {
  const d = peNow();
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}_${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}`;
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

function isValidIsoDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !Number.isNaN(d.getTime());
}

function toStrictPositiveIntOrNull(v: unknown) {
  const s = normalizeText(v).replace(/,/g, "");
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}

function hasAnyLetter(v: unknown) {
  return /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(normalizeText(v));
}

function normalizeFieldValue(field: ImportField, value: unknown) {
  if (field === "fecha_de_visita") {
    return parseExcelDateToIso(value);
  }
  return normalizeText(value);
}

function getImportField(header: unknown): ImportField | "" {
  const h = normalizeHeader(header);

  if (["rucodm", "codigoodm", "codigoodm"].includes(h)) return "rucodm";
  if (["ruc"].includes(h)) return "ruc";
  if (["proveedor", "provider"].includes(h)) return "proveedor";
  if (["concessionowner", "titular", "titularconcesion"].includes(h)) return "concession_owner";
  if (["concessionstatus", "estadoconcesion"].includes(h)) return "concession_status";
  if (["concessioncode", "codigoconcesion"].includes(h)) return "concession_code";
  if (["concessionname", "nombreconcesion"].includes(h)) return "concession_name";
  if (["department", "departamento"].includes(h)) return "department";
  if (["province", "provincia"].includes(h)) return "province";
  if (["district", "distrito"].includes(h)) return "district";
  if (["zonaacopio"].includes(h)) return "zona_acopio";
  if (["providercondition", "condicionproveedor"].includes(h)) return "provider_condition";
  if (["tipopersona"].includes(h)) return "tipo_persona";
  if (["tipoempresa"].includes(h)) return "tipo_empresa";
  if (["geocatminxy"].includes(h)) return "geocatmin_xy";
  if (["flaginformeverificacionminera"].includes(h)) return "flag_informe_verificacion_minera";
  if (["fechadevisita", "fecha_visita", "fecha"].includes(h)) return "fecha_de_visita";
  if (["coordinatesxy", "coordenadasxy"].includes(h)) return "coordinates_xy";
  if (["zoneutm", "utmzone"].includes(h)) return "zone_utm";
  if (["north", "norte"].includes(h)) return "north";
  if (["east", "este"].includes(h)) return "east";
  if (["tipovlm"].includes(h)) return "tipo_vlm";
  if (["geologistname", "nombregeologo", "geologo"].includes(h)) return "geologist_name";

  return "";
}

function buildFieldErrors(row: Omit<PreviewRow, "status" | "errors" | "duplicate_count" | "is_duplicate" | "valid" | "payload" | "fieldErrors">) {
  const errors: Partial<Record<PreviewField, string>> = {};

  const requiredTextWithLetters: PreviewField[] = [
    "proveedor",
    "concession_owner",
    "concession_status",
    "concession_name",
    "department",
    "province",
    "district",
    "zona_acopio",
    "provider_condition",
    "tipo_persona",
    "tipo_empresa",
    "flag_informe_verificacion_minera",
    "tipo_vlm",
    "geologist_name",
  ];

  const requiredTextOnly: PreviewField[] = [
    "rucodm",
    "concession_code",
    "geocatmin_xy",
    "coordinates_xy",
    "zone_utm",
  ];

  for (const field of requiredTextOnly) {
    if (isBlank(row[field])) {
      errors[field] = "Vacío";
    }
  }

  for (const field of requiredTextWithLetters) {
    const value = row[field];
    if (isBlank(value)) {
      errors[field] = "Vacío";
    } else if (!hasAnyLetter(value)) {
      errors[field] = "Debe contener texto";
    }
  }

  if (isBlank(row.ruc)) {
    errors.ruc = "Vacío";
  } else if (!/^\d+$/.test(row.ruc)) {
    errors.ruc = "Solo números";
  }

  if (isBlank(row.fecha_de_visita)) {
    errors.fecha_de_visita = "Vacío";
  } else if (!isValidIsoDate(row.fecha_de_visita)) {
    errors.fecha_de_visita = "Fecha inválida";
  }

  if (toStrictPositiveIntOrNull(row.north) === null) {
    errors.north = isBlank(row.north) ? "Vacío" : "Entero > 0";
  }

  if (toStrictPositiveIntOrNull(row.east) === null) {
    errors.east = isBlank(row.east) ? "Vacío" : "Entero > 0";
  }

  return errors;
}

function isEqualRow(existing: ComplianceRow | null, payload: CompliancePayload) {
  if (!existing) return false;

  return (
    normalizeText(existing.rucodm) === payload.rucodm &&
    normalizeText(existing.ruc) === payload.ruc &&
    normalizeText(existing.proveedor) === payload.proveedor &&
    normalizeText(existing.concession_owner) === payload.concession_owner &&
    normalizeText(existing.concession_status) === payload.concession_status &&
    normalizeText(existing.concession_code) === payload.concession_code &&
    normalizeText(existing.concession_name) === payload.concession_name &&
    normalizeText(existing.department) === payload.department &&
    normalizeText(existing.province) === payload.province &&
    normalizeText(existing.district) === payload.district &&
    normalizeText(existing.zona_acopio) === payload.zona_acopio &&
    normalizeText(existing.provider_condition) === payload.provider_condition &&
    normalizeText(existing.tipo_persona) === payload.tipo_persona &&
    normalizeText(existing.tipo_empresa) === payload.tipo_empresa &&
    normalizeText(existing.geocatmin_xy) === payload.geocatmin_xy &&
    normalizeText(existing.flag_informe_verificacion_minera) === payload.flag_informe_verificacion_minera &&
    normalizeText(existing.fecha_de_visita).slice(0, 10) === payload.fecha_de_visita &&
    normalizeText(existing.coordinates_xy) === payload.coordinates_xy &&
    normalizeText(existing.zone_utm) === payload.zone_utm &&
    Number(existing.north) === payload.north &&
    Number(existing.east) === payload.east &&
    normalizeText(existing.tipo_vlm) === payload.tipo_vlm &&
    normalizeText(existing.geologist_name) === payload.geologist_name
  );
}

function buildImportSummary(previewRows: PreviewRow[], file_name: string, total_excel_rows: number): ImportSummary {
  const validRows = previewRows.filter((row) => row.valid);
  const repeatedKeys = new Set(
    previewRows.filter((row) => row.is_duplicate).map((row) => normalizeText(row.rucodm).toUpperCase())
  );

  return {
    file_name,
    total_excel_rows,
    preview_rows: previewRows.length,
    valid_rows: validRows.length,
    invalid_rows: previewRows.length - validRows.length,
    new_rows: validRows.filter((row) => row.status === "NUEVA").length,
    update_rows: validRows.filter((row) => row.status === "ACTUALIZAR").length,
    equal_rows: validRows.filter((row) => row.status === "IGUAL").length,
    repeated_keys: repeatedKeys.size,
  };
}

function revalidatePreviewRows(
  draftRows: PreviewRow[],
  latestRows: ComplianceRow[],
  file_name: string,
  total_excel_rows: number
): { rows: PreviewRow[]; summary: ImportSummary } {
  const latestByKey = new Map<string, ComplianceRow>(
    latestRows
      .filter((row) => !!normalizeText(row.rucodm))
      .map((row) => [normalizeText(row.rucodm).toUpperCase(), row] as const)
  );

  const counts = new Map<string, number>();
  for (const row of draftRows) {
    const key = normalizeText(row.rucodm).toUpperCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const rows = draftRows.map((draft) => {
    const normalized = {
      row_num: draft.row_num,
      rucodm: normalizeText(draft.rucodm),
      ruc: normalizeText(draft.ruc),
      proveedor: normalizeText(draft.proveedor),
      concession_owner: normalizeText(draft.concession_owner),
      concession_status: normalizeText(draft.concession_status),
      concession_code: normalizeText(draft.concession_code),
      concession_name: normalizeText(draft.concession_name),
      department: normalizeText(draft.department),
      province: normalizeText(draft.province),
      district: normalizeText(draft.district),
      zona_acopio: normalizeText(draft.zona_acopio),
      provider_condition: normalizeText(draft.provider_condition),
      tipo_persona: normalizeText(draft.tipo_persona),
      tipo_empresa: normalizeText(draft.tipo_empresa),
      geocatmin_xy: normalizeText(draft.geocatmin_xy),
      flag_informe_verificacion_minera: normalizeText(draft.flag_informe_verificacion_minera),
      fecha_de_visita: normalizeText(draft.fecha_de_visita),
      coordinates_xy: normalizeText(draft.coordinates_xy),
      zone_utm: normalizeText(draft.zone_utm),
      north: normalizeText(draft.north),
      east: normalizeText(draft.east),
      tipo_vlm: normalizeText(draft.tipo_vlm),
      geologist_name: normalizeText(draft.geologist_name),
    };

    const fieldErrors = buildFieldErrors(normalized);
    const validBase = Object.keys(fieldErrors).length === 0;

    const payload: CompliancePayload | null = validBase
      ? {
          rucodm: normalized.rucodm,
          ruc: normalized.ruc,
          proveedor: normalized.proveedor,
          concession_owner: normalized.concession_owner,
          concession_status: normalized.concession_status,
          concession_code: normalized.concession_code,
          concession_name: normalized.concession_name,
          department: normalized.department,
          province: normalized.province,
          district: normalized.district,
          zona_acopio: normalized.zona_acopio,
          provider_condition: normalized.provider_condition,
          tipo_persona: normalized.tipo_persona,
          tipo_empresa: normalized.tipo_empresa,
          geocatmin_xy: normalized.geocatmin_xy,
          flag_informe_verificacion_minera: normalized.flag_informe_verificacion_minera,
          fecha_de_visita: normalized.fecha_de_visita,
          coordinates_xy: normalized.coordinates_xy,
          zone_utm: normalized.zone_utm,
          north: Number(normalized.north),
          east: Number(normalized.east),
          tipo_vlm: normalized.tipo_vlm,
          geologist_name: normalized.geologist_name,
        }
      : null;

    const key = normalized.rucodm.toUpperCase();
    const duplicateCount = key ? counts.get(key) || 0 : 0;
    const isDuplicate = duplicateCount > 1;
    const existing = key ? latestByKey.get(key) ?? null : null;
    const equalToDb = !!payload && isEqualRow(existing, payload);

    let status: PreviewRow["status"] = "INVÁLIDA";
    if (validBase && !isDuplicate) {
      status = equalToDb ? "IGUAL" : existing ? "ACTUALIZAR" : "NUEVA";
    }

    const errorList = [
      ...Object.entries(fieldErrors).map(([field, msg]) => `${field}: ${msg}`),
      ...(isDuplicate ? ["rucodm repetido en el preview"] : []),
    ];

    return {
      ...normalized,
      status,
      errors: errorList.join(" | "),
      duplicate_count: duplicateCount,
      is_duplicate: isDuplicate,
      valid: validBase && !isDuplicate,
      payload: validBase && !isDuplicate && !equalToDb ? payload : null,
      fieldErrors,
    } satisfies PreviewRow;
  });

  return {
    rows,
    summary: buildImportSummary(rows, file_name, total_excel_rows),
  };
}

export default function ComplianceProvImpExp({
  rows,
  setMsgAction,
  loadRowsAction,
  disabled = false,
}: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const invalidCount = useMemo(
    () => previewRows.filter((row) => !row.valid).length,
    [previewRows]
  );

  async function getLatestRows() {
    try {
      const resp = (await apiGet("/api/compliance/provider-format")) as ComplianceResp;
      return Array.isArray(resp?.rows) ? resp.rows : rows;
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

  function onEditPreviewCell(rowNum: number, field: PreviewField, value: string) {
    const draftRows = previewRows.map((row) =>
      row.row_num === rowNum ? { ...row, [field]: value } : row
    );

    const fileName = importSummary?.file_name || "compliance_provider_format";
    const totalExcelRows = importSummary?.total_excel_rows || draftRows.length;

    const { rows: revalidatedRows, summary } = revalidatePreviewRows(
      draftRows,
      rows,
      fileName,
      totalExcelRows
    );

    setPreviewRows(revalidatedRows);
    setImportSummary(summary);
  }

  function onExportExcel() {
    if (!rows.length) {
      setMsgAction("No hay registros para exportar.");
      return;
    }

    const exportRows = [...rows]
      .sort((a, b) => {
        const fa = normalizeText(a.fecha_de_visita);
        const fb = normalizeText(b.fecha_de_visita);
        if (fa !== fb) return fb.localeCompare(fa);
        return normalizeText(a.rucodm).localeCompare(normalizeText(b.rucodm));
      })
      .map((row) => ({
        rucodm: normalizeText(row.rucodm),
        ruc: normalizeText(row.ruc),
        proveedor: normalizeText(row.proveedor),
        concession_owner: normalizeText(row.concession_owner),
        concession_status: normalizeText(row.concession_status),
        concession_code: normalizeText(row.concession_code),
        concession_name: normalizeText(row.concession_name),
        department: normalizeText(row.department),
        province: normalizeText(row.province),
        district: normalizeText(row.district),
        zona_acopio: normalizeText(row.zona_acopio),
        provider_condition: normalizeText(row.provider_condition),
        tipo_persona: normalizeText(row.tipo_persona),
        tipo_empresa: normalizeText(row.tipo_empresa),
        geocatmin_xy: normalizeText(row.geocatmin_xy),
        flag_informe_verificacion_minera: normalizeText(row.flag_informe_verificacion_minera),
        fecha_de_visita: normalizeText(row.fecha_de_visita).slice(0, 10),
        coordinates_xy: normalizeText(row.coordinates_xy),
        zone_utm: normalizeText(row.zone_utm),
        north: row.north ?? "",
        east: row.east ?? "",
        tipo_vlm: normalizeText(row.tipo_vlm),
        geologist_name: normalizeText(row.geologist_name),
        updated_at: normalizeText(row.updated_at).slice(0, 23),
      }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws["!cols"] = PREVIEW_COLUMNS.map((c) => ({ wch: Math.max(12, Math.round((c.width || 120) / 8)) })).concat([
      { wch: 22 },
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "provider_format");
    XLSX.writeFile(wb, `compliance_provider_format_${getFileStamp()}.xlsx`);
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

      const headers = Object.keys(rawRows[0] || {});
      const normalizedFields = headers
        .map((h) => getImportField(h))
        .filter((field): field is ImportField => field !== "");

      const missingHeaders = IMPORT_FIELDS.filter((field) => !normalizedFields.includes(field));
      if (missingHeaders.length) {
        throw new Error(`Faltan columnas: ${missingHeaders.join(", ")}`);
      }

      const latestRows = await getLatestRows();

      const previewSeed = rawRows
        .map((raw, idx) => {
          const getValue = (fieldName: ImportField) => {
            const sourceKey = Object.keys(raw).find((k) => getImportField(k) === fieldName);
            return sourceKey ? raw[sourceKey] : "";
          };

          const base: PreviewRow = {
            row_num: idx + 2,
            rucodm: normalizeFieldValue("rucodm", getValue("rucodm")),
            ruc: normalizeFieldValue("ruc", getValue("ruc")),
            proveedor: normalizeFieldValue("proveedor", getValue("proveedor")),
            concession_owner: normalizeFieldValue("concession_owner", getValue("concession_owner")),
            concession_status: normalizeFieldValue("concession_status", getValue("concession_status")),
            concession_code: normalizeFieldValue("concession_code", getValue("concession_code")),
            concession_name: normalizeFieldValue("concession_name", getValue("concession_name")),
            department: normalizeFieldValue("department", getValue("department")),
            province: normalizeFieldValue("province", getValue("province")),
            district: normalizeFieldValue("district", getValue("district")),
            zona_acopio: normalizeFieldValue("zona_acopio", getValue("zona_acopio")),
            provider_condition: normalizeFieldValue("provider_condition", getValue("provider_condition")),
            tipo_persona: normalizeFieldValue("tipo_persona", getValue("tipo_persona")),
            tipo_empresa: normalizeFieldValue("tipo_empresa", getValue("tipo_empresa")),
            geocatmin_xy: normalizeFieldValue("geocatmin_xy", getValue("geocatmin_xy")),
            flag_informe_verificacion_minera: normalizeFieldValue(
              "flag_informe_verificacion_minera",
              getValue("flag_informe_verificacion_minera")
            ),
            fecha_de_visita: normalizeFieldValue("fecha_de_visita", getValue("fecha_de_visita")),
            coordinates_xy: normalizeFieldValue("coordinates_xy", getValue("coordinates_xy")),
            zone_utm: normalizeFieldValue("zone_utm", getValue("zone_utm")),
            north: normalizeFieldValue("north", getValue("north")),
            east: normalizeFieldValue("east", getValue("east")),
            tipo_vlm: normalizeFieldValue("tipo_vlm", getValue("tipo_vlm")),
            geologist_name: normalizeFieldValue("geologist_name", getValue("geologist_name")),
            status: "INVÁLIDA",
            errors: "",
            duplicate_count: 0,
            is_duplicate: false,
            valid: false,
            payload: null,
            fieldErrors: {},
          };

          return base;
        })
        .filter((row) => IMPORT_FIELDS.some((field) => !isBlank(row[field])));

      if (!previewSeed.length) {
        throw new Error("No hay filas con datos para importar.");
      }

      const { rows: revalidatedRows, summary } = revalidatePreviewRows(
        previewSeed,
        latestRows,
        file.name,
        rawRows.length
      );

      setPreviewRows(revalidatedRows);
      setImportSummary(summary);
      setPreviewOpen(true);
    } catch (err: any) {
      setMsgAction(`ERROR: ${String(err?.message || err || "No se pudo importar el archivo")}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function confirmImport() {
    if (!previewRows.length) {
      setMsgAction("No hay filas para importar.");
      return;
    }

    if (previewRows.some((row) => !row.valid)) {
      setMsgAction("ERROR: corrige las celdas en rojo antes de guardar.");
      return;
    }

    const payloadRows = previewRows
      .filter((row) => !!row.payload)
      .map((row) => row.payload as CompliancePayload);

    if (!payloadRows.length) {
      setMsgAction("No hay cambios para importar.");
      return;
    }

    setImporting(true);
    setMsgAction(null);

    try {
      await apiPost("/api/compliance/provider-format", { rows: payloadRows });
      await loadRowsAction(false);
      setPreviewOpen(false);
      setPreviewRows([]);
      setImportSummary(null);
      setMsgAction(`OK: se importaron ${payloadRows.length} registro(s).`);
    } catch (err: any) {
      setMsgAction(`ERROR: ${String(err?.message || err || "No se pudo guardar")}`);
    } finally {
      setImporting(false);
    }
  }

  const headerBg = "rgb(6, 36, 58)";
  const headerBorder = "1px solid rgba(191, 231, 255, 0.26)";
  const gridV = "1px solid rgba(191, 231, 255, 0.10)";
  const gridH = "1px solid rgba(191, 231, 255, 0.08)";
  const rowBg = "rgba(0,0,0,.10)";
  const border = "1px solid rgba(191, 231, 255, 0.18)";

  const cellBase: React.CSSProperties = {
    padding: "8px 10px",
    verticalAlign: "middle",
    fontSize: 13,
    whiteSpace: "nowrap",
  };

const previewInputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  height: 32,
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.10)",
  background: "rgba(0,0,0,.10)",
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 800,
  boxSizing: "border-box",
  whiteSpace: "nowrap",
};

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: "none" }}
          onChange={onImportFile}
        />

        <Button onClick={onClickImport} disabled={disabled || importing}>
          Importar Excel
        </Button>

        <Button onClick={onExportExcel} disabled={disabled || importing || !rows.length}>
          Exportar Excel
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
              width: "min(1700px, 96vw)",
              height: "min(86vh, 900px)",
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
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 18, fontWeight: 900 }}>Preview de importación</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Celdas en rojo = inválidas. No se guarda mientras exista una sola inválida.
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={closePreview}
                  disabled={importing}
                >
                  Cerrar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={confirmImport}
                  disabled={importing || previewRows.length === 0 || previewRows.some((row) => !row.valid)}
                >
                  {importing ? "Guardando..." : "Guardar importación"}
                </Button>
              </div>
            </div>

            {importSummary ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Archivo: {importSummary.file_name || "-"}
                </div>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Total Excel: {importSummary.total_excel_rows || 0}
                </div>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Preview: {importSummary.preview_rows || 0}
                </div>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Válidas: {importSummary.valid_rows || 0}
                </div>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Inválidas: {importSummary.invalid_rows || 0}
                </div>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Nuevas: {importSummary.new_rows || 0}
                </div>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Actualizar: {importSummary.update_rows || 0}
                </div>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  Igual: {importSummary.equal_rows || 0}
                </div>
                <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 900 }}>
                  RUC ODM repetidos: {importSummary.repeated_keys || 0}
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
                  <col style={{ width: 120 }} />
                  {PREVIEW_COLUMNS.map((col) => (
                    <col key={col.key} style={{ width: col.width || 140 }} />
                  ))}
                  <col style={{ width: 320 }} />
                </colgroup>

                <thead>
                  <tr>
                    <th
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
                      Fila
                    </th>
                    <th
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
                      Estado
                    </th>

                    {PREVIEW_COLUMNS.map((col) => (
                      <th
                        key={col.key}
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
                        {col.label}
                      </th>
                    ))}

                    <th
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
                      Errores
                    </th>
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
                      <tr key={row.row_num} className="capex-tr">
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
                            fontWeight: 900,
                          }}
                        >
                          <div>{row.status}</div>
                          {row.is_duplicate ? (
                            <div style={{ fontSize: 11, opacity: 0.9 }}>
                              Sí ({row.duplicate_count})
                            </div>
                          ) : null}
                        </td>

                        {PREVIEW_COLUMNS.map((col) => {
                          const error = row.fieldErrors[col.key];
                          return (
                            <td
                              key={col.key}
                              className="capex-td"
                              style={{
                                ...cellBase,
                                borderTop: gridH,
                                borderBottom: gridH,
                                borderRight: gridV,
                                background: bg,
                              }}
                            >
                            <div
                            style={{
                                ...previewInputStyle,
                                minWidth: col.width || 120,
                                border: error
                                ? "1px solid #ff6b6b"
                                : "1px solid rgba(255,255,255,.10)",
                                background: error
                                ? "rgba(255, 77, 77, 0.12)"
                                : "rgba(0,0,0,.10)",
                                display: "flex",
                                alignItems: "center",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                userSelect: "text",
                                cursor: "default",
                            }}
                            title={String(row[col.key] ?? "")}
                            >
                            {String(row[col.key] ?? "")}
                            </div>
                            {error ? (
                            <div style={{ marginTop: 4, fontSize: 11, color: "#ff8b8b" }}>
                                {error}
                            </div>
                            ) : null}
                            </td>
                          );
                        })}

                        <td
                          className="capex-td"
                          style={{
                            ...cellBase,
                            borderTop: gridH,
                            borderBottom: gridH,
                            borderRight: gridV,
                            background: bg,
                            whiteSpace: "normal",
                            color: row.errors ? "#ffb3b3" : "inherit",
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
                      <td className="capex-td" style={{ ...cellBase, fontWeight: 900 }} colSpan={PREVIEW_COLUMNS.length + 3}>
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
                  : `Se postearán exactamente ${previewRows.filter((row) => !!row.payload).length} fila(s) con cambios.`}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}