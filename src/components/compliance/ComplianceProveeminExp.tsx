// src/components/compliance/ComplianceProveeminExp.tsx
"use client";

import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

type ComplianceRow = {
  rucodm: string | null;
  ruc: string | null;
  proveedor: string | null;
  concession_owner: string | null;
  concession_status: string | null;
  concession_code: string | null;
  concession_name: string | null;
  department: string | null;
  province: string | null;
  district: string | null;
  sede: string | null;
  zona: string | null;
  condicion_formal_minero: string | null;
  tipo_persona: string | null;
  tipo_empresa: string | null;
  fecha_ivplm: string | null;
  coorxy_vlm: string | null;
  zonautm_vlm: string | null;
  norte_vlm: number | string | null;
  este_vlm: number | string | null;
  tipo_vlm: string | null;
  geologo_ivplm: string | null;
  url_ivplm: string | null;
  modalidad_contrato: string | null;
  ley_au_minima_contrato: number | string | null;
  sujeto_uif: string | null;
  business_year: number | string | null;
};

type ComplianceResp = {
  ok: boolean;
  rows: ComplianceRow[];
  count?: number;
  error?: string;
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
  sede: string;
  zona: string;
  condicion_formal_minero: string;
  tipo_persona: string;
  tipo_empresa: string;
  fecha_ivplm: string;
  coorxy_vlm: string;
  zonautm_vlm: string;
  norte_vlm: number | null;
  este_vlm: number | null;
  tipo_vlm: string;
  geologo_ivplm: string;
  url_ivplm: string;
  modalidad_contrato: string;
  ley_au_minima_contrato: number | null;
  sujeto_uif: string;
  business_year: number | null;
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
  | "sede"
  | "zona"
  | "condicion_formal_minero"
  | "tipo_persona"
  | "tipo_empresa"
  | "fecha_ivplm"
  | "coorxy_vlm"
  | "zonautm_vlm"
  | "norte_vlm"
  | "este_vlm"
  | "tipo_vlm"
  | "geologo_ivplm"
  | "url_ivplm"
  | "modalidad_contrato"
  | "ley_au_minima_contrato"
  | "sujeto_uif"
  | "business_year";

type PreviewField = ImportField;

type PreviewRow = Record<PreviewField, string> & {
  row_num: number;
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

const ENDPOINT = "/api/compliance/format-proveemin";

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
  "sede",
  "zona",
  "condicion_formal_minero",
  "tipo_persona",
  "tipo_empresa",
  "fecha_ivplm",
  "coorxy_vlm",
  "zonautm_vlm",
  "norte_vlm",
  "este_vlm",
  "tipo_vlm",
  "geologo_ivplm",
  "url_ivplm",
  "modalidad_contrato",
  "ley_au_minima_contrato",
  "sujeto_uif",
  "business_year",
];

const REQUIRED_IMPORT_HEADERS = IMPORT_FIELDS.filter((f) => f !== "rucodm");

const PREVIEW_COLUMNS: { key: PreviewField; label: string; width?: number }[] = [
  { key: "rucodm", label: "RUC ODM", width: 170 },
  { key: "ruc", label: "RUC", width: 115 },
  { key: "proveedor", label: "Proveedor", width: 190 },
  { key: "concession_owner", label: "Concession Owner", width: 190 },
  { key: "concession_status", label: "Concession Status", width: 160 },
  { key: "concession_code", label: "Concession Code", width: 155 },
  { key: "concession_name", label: "Concession Name", width: 190 },
  { key: "department", label: "Department", width: 135 },
  { key: "province", label: "Province", width: 135 },
  { key: "district", label: "District", width: 135 },
  { key: "sede", label: "Sede", width: 120 },
  { key: "zona", label: "Zona", width: 120 },
  { key: "condicion_formal_minero", label: "Condición Formal Minero", width: 190 },
  { key: "tipo_persona", label: "Tipo Persona", width: 135 },
  { key: "tipo_empresa", label: "Tipo Empresa", width: 145 },
  { key: "fecha_ivplm", label: "Fecha IVPLM", width: 130 },
  { key: "coorxy_vlm", label: "CoorXY VLM", width: 140 },
  { key: "zonautm_vlm", label: "ZonaUTM VLM", width: 130 },
  { key: "norte_vlm", label: "Norte VLM", width: 115 },
  { key: "este_vlm", label: "Este VLM", width: 115 },
  { key: "tipo_vlm", label: "Tipo VLM", width: 130 },
  { key: "geologo_ivplm", label: "Geólogo IVPLM", width: 180 },
  { key: "url_ivplm", label: "URL IVPLM", width: 220 },
  { key: "modalidad_contrato", label: "Modalidad Contrato", width: 170 },
  { key: "ley_au_minima_contrato", label: "Ley Au Mínima Contrato", width: 190 },
  { key: "sujeto_uif", label: "Sujeto UIF", width: 120 },
  { key: "business_year", label: "Business Year", width: 130 },
];

function normalizeText(v: unknown) {
  return String(v ?? "").trim();
}

function isBlank(v: unknown) {
  return v === null || v === undefined || String(v).trim() === "";
}

function isDash(v: unknown) {
  return String(v ?? "").trim() === "-";
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

function hasAnyLetter(v: unknown) {
  return /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(normalizeText(v));
}

function isComercializadora(v: unknown) {
  const value = normalizeText(v)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return value === "COMERCIALIZADORA";
}

function buildRucodm(ruc: unknown, concessionCode: unknown) {
  const r = normalizeText(ruc);
  const code = normalizeText(concessionCode).toUpperCase();

  if (!r || !code || code === "-") return "";
  return `${r}-${code}`;
}

function toPositiveNumberOrNull(v: unknown) {
  let s = normalizeText(v).replace(/\s/g, "");
  if (!s) return null;

  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    s = s.replace(/,/g, "");
  } else if (/^\d+,\d+$/.test(s)) {
    s = s.replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }

  if (!/^\d+(\.\d+)?$/.test(s)) return null;

  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function toYearOrNull(v: unknown) {
  const s = normalizeText(v).replace(/,/g, "");
  if (!/^\d{4}$/.test(s)) return null;

  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < 1900 || n > 2100) return null;

  return n;
}

function normalizeFieldValue(field: ImportField, value: unknown) {
  if (field === "fecha_ivplm") return parseExcelDateToIso(value);
  return normalizeText(value);
}

function getImportField(header: unknown): ImportField | "" {
  const h = normalizeHeader(header);

  if (["rucodm", "codigoodm", "codigooodm"].includes(h)) return "rucodm";
  if (["ruc"].includes(h)) return "ruc";
  if (["proveedor", "provider"].includes(h)) return "proveedor";
  if (["concessionowner", "titular", "titularconcesion"].includes(h)) return "concession_owner";
  if (["concessionstatus", "estadoconcesion"].includes(h)) return "concession_status";
  if (["concessioncode", "codigoconcesion"].includes(h)) return "concession_code";
  if (["concessionname", "nombreconcesion"].includes(h)) return "concession_name";
  if (["department", "departamento"].includes(h)) return "department";
  if (["province", "provincia"].includes(h)) return "province";
  if (["district", "distrito"].includes(h)) return "district";
  if (["sede"].includes(h)) return "sede";
  if (["zona"].includes(h)) return "zona";
  if (["condicionformalminero", "condicionformal", "providercondition", "condicionproveedor"].includes(h)) return "condicion_formal_minero";
  if (["tipopersona"].includes(h)) return "tipo_persona";
  if (["tipoempresa"].includes(h)) return "tipo_empresa";
  if (["fechaivplm", "fechadevisita", "fecha_visita", "fecha"].includes(h)) return "fecha_ivplm";
  if (["coorxyvlm", "coorxy", "geocatminxy", "coordinatesxy", "coordenadasxy"].includes(h)) return "coorxy_vlm";
  if (["zonautmvlm", "zonautm", "zoneutm", "utmzone"].includes(h)) return "zonautm_vlm";
  if (["nortevlm", "norte", "north"].includes(h)) return "norte_vlm";
  if (["estevlm", "este", "east"].includes(h)) return "este_vlm";
  if (["tipovlm"].includes(h)) return "tipo_vlm";
  if (["geologoivplm", "geologistname", "nombregeologo", "geologo"].includes(h)) return "geologo_ivplm";
  if (["urlivplm", "url"].includes(h)) return "url_ivplm";
  if (["modalidadcontrato"].includes(h)) return "modalidad_contrato";
  if (["leyauminimacontrato", "leyaucontrato", "leyauminima"].includes(h)) return "ley_au_minima_contrato";
  if (["sujetouif"].includes(h)) return "sujeto_uif";
  if (["businessyear", "anio", "ano", "year"].includes(h)) return "business_year";

  return "";
}

function buildFieldErrors(
  row: Omit<
    PreviewRow,
    "status" | "errors" | "duplicate_count" | "is_duplicate" | "valid" | "payload" | "fieldErrors"
  >
) {
  const errors: Partial<Record<PreviewField, string>> = {};
  const allowOptionalMineFields = isComercializadora(row.condicion_formal_minero);

  if (isBlank(row.ruc)) {
    errors.ruc = "Vacío";
  } else if (!/^\d+$/.test(row.ruc)) {
    errors.ruc = "Solo números";
  }

  if (isBlank(row.proveedor)) {
    errors.proveedor = "Vacío";
  } else if (!hasAnyLetter(row.proveedor)) {
    errors.proveedor = "Debe contener texto";
  }

  if (isBlank(row.condicion_formal_minero)) {
    errors.condicion_formal_minero = "Vacío";
  } else if (!hasAnyLetter(row.condicion_formal_minero)) {
    errors.condicion_formal_minero = "Debe contener texto";
  }

  if (isBlank(row.concession_code) || isDash(row.concession_code)) {
    errors.concession_code = "Vacío";
  }

  if (isBlank(row.rucodm)) {
    errors.rucodm = "No se pudo armar con ruc + concession_code";
  }

  const requiredConditionalTextWithLetters: PreviewField[] = [
    "concession_owner",
    "concession_status",
    "concession_name",
    "department",
    "province",
    "district",
    "sede",
    "zona",
    "tipo_persona",
    "tipo_empresa",
    "tipo_vlm",
    "geologo_ivplm",
    "modalidad_contrato",
    "sujeto_uif",
  ];

  const requiredConditionalTextOnly: PreviewField[] = [
    "coorxy_vlm",
    "zonautm_vlm",
  ];

  for (const field of requiredConditionalTextOnly) {
    if (!allowOptionalMineFields && isBlank(row[field])) {
      errors[field] = "Vacío";
    }
  }

  for (const field of requiredConditionalTextWithLetters) {
    const value = row[field];

    if (!allowOptionalMineFields && isBlank(value)) {
      errors[field] = "Vacío";
    } else if (!(allowOptionalMineFields && isDash(value)) && !isBlank(value) && !hasAnyLetter(value)) {
      errors[field] = "Debe contener texto";
    }
  }

  if (!allowOptionalMineFields && isBlank(row.fecha_ivplm)) {
    errors.fecha_ivplm = "Vacío";
  } else if (!isBlank(row.fecha_ivplm) && !isValidIsoDate(row.fecha_ivplm)) {
    errors.fecha_ivplm = "Fecha inválida";
  }

  if (!allowOptionalMineFields && isBlank(row.norte_vlm)) {
    errors.norte_vlm = "Vacío";
  } else if (!(allowOptionalMineFields && isDash(row.norte_vlm)) && !isBlank(row.norte_vlm) && toPositiveNumberOrNull(row.norte_vlm) === null) {
    errors.norte_vlm = "Número >= 0";
  }

  if (!allowOptionalMineFields && isBlank(row.este_vlm)) {
    errors.este_vlm = "Vacío";
  } else if (!(allowOptionalMineFields && isDash(row.este_vlm)) && !isBlank(row.este_vlm) && toPositiveNumberOrNull(row.este_vlm) === null) {
    errors.este_vlm = "Número >= 0";
  }

  if (!allowOptionalMineFields && isBlank(row.ley_au_minima_contrato)) {
    errors.ley_au_minima_contrato = "Vacío";
  } else if (!isBlank(row.ley_au_minima_contrato) && toPositiveNumberOrNull(row.ley_au_minima_contrato) === null) {
    errors.ley_au_minima_contrato = "Número >= 0";
  }

  if (isBlank(row.business_year)) {
    errors.business_year = "Vacío";
  } else if (toYearOrNull(row.business_year) === null) {
    errors.business_year = "Año inválido";
  }

  return errors;
}

function sameNumber(existing: unknown, payload: number | null) {
  if (isBlank(existing) && payload === null) return true;
  if (!isBlank(existing) && payload !== null) return Number(existing) === payload;
  return false;
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
    normalizeText(existing.sede) === payload.sede &&
    normalizeText(existing.zona) === payload.zona &&
    normalizeText(existing.condicion_formal_minero) === payload.condicion_formal_minero &&
    normalizeText(existing.tipo_persona) === payload.tipo_persona &&
    normalizeText(existing.tipo_empresa) === payload.tipo_empresa &&
    normalizeText(existing.fecha_ivplm).slice(0, 10) === payload.fecha_ivplm &&
    normalizeText(existing.coorxy_vlm) === payload.coorxy_vlm &&
    normalizeText(existing.zonautm_vlm) === payload.zonautm_vlm &&
    sameNumber(existing.norte_vlm, payload.norte_vlm) &&
    sameNumber(existing.este_vlm, payload.este_vlm) &&
    normalizeText(existing.tipo_vlm) === payload.tipo_vlm &&
    normalizeText(existing.geologo_ivplm) === payload.geologo_ivplm &&
    normalizeText(existing.url_ivplm) === payload.url_ivplm &&
    normalizeText(existing.modalidad_contrato) === payload.modalidad_contrato &&
    sameNumber(existing.ley_au_minima_contrato, payload.ley_au_minima_contrato) &&
    normalizeText(existing.sujeto_uif) === payload.sujeto_uif &&
    sameNumber(existing.business_year, payload.business_year)
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

  const normalizedDrafts = draftRows.map((draft) => {
    const ruc = normalizeText(draft.ruc);
    const concession_code = normalizeText(draft.concession_code).toUpperCase();

    return {
      ...draft,
      rucodm: buildRucodm(ruc, concession_code),
      ruc,
      proveedor: normalizeText(draft.proveedor),
      concession_owner: normalizeText(draft.concession_owner),
      concession_status: normalizeText(draft.concession_status),
      concession_code,
      concession_name: normalizeText(draft.concession_name),
      department: normalizeText(draft.department),
      province: normalizeText(draft.province),
      district: normalizeText(draft.district),
      sede: normalizeText(draft.sede),
      zona: normalizeText(draft.zona),
      condicion_formal_minero: normalizeText(draft.condicion_formal_minero),
      tipo_persona: normalizeText(draft.tipo_persona),
      tipo_empresa: normalizeText(draft.tipo_empresa),
      fecha_ivplm: normalizeText(draft.fecha_ivplm),
      coorxy_vlm: normalizeText(draft.coorxy_vlm),
      zonautm_vlm: normalizeText(draft.zonautm_vlm),
      norte_vlm: normalizeText(draft.norte_vlm),
      este_vlm: normalizeText(draft.este_vlm),
      tipo_vlm: normalizeText(draft.tipo_vlm),
      geologo_ivplm: normalizeText(draft.geologo_ivplm),
      url_ivplm: normalizeText(draft.url_ivplm),
      modalidad_contrato: normalizeText(draft.modalidad_contrato),
      ley_au_minima_contrato: normalizeText(draft.ley_au_minima_contrato),
      sujeto_uif: normalizeText(draft.sujeto_uif),
      business_year: normalizeText(draft.business_year),
    } satisfies PreviewRow;
  });

  const counts = new Map<string, number>();
  for (const row of normalizedDrafts) {
    const key = normalizeText(row.rucodm).toUpperCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const rows = normalizedDrafts.map((normalized) => {
    const fieldErrors = buildFieldErrors(normalized);
    const validBase = Object.keys(fieldErrors).length === 0;
    const isComer = isComercializadora(normalized.condicion_formal_minero);

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
          sede: normalized.sede,
          zona: normalized.zona,
          condicion_formal_minero: normalized.condicion_formal_minero,
          tipo_persona: normalized.tipo_persona,
          tipo_empresa: normalized.tipo_empresa,
          fecha_ivplm: normalized.fecha_ivplm,
          coorxy_vlm: normalized.coorxy_vlm,
          zonautm_vlm: normalized.zonautm_vlm,
          norte_vlm: isDash(normalized.norte_vlm) && isComer
            ? 0
            : isBlank(normalized.norte_vlm)
              ? null
              : toPositiveNumberOrNull(normalized.norte_vlm),
          este_vlm: isDash(normalized.este_vlm) && isComer
            ? 0
            : isBlank(normalized.este_vlm)
              ? null
              : toPositiveNumberOrNull(normalized.este_vlm),
          tipo_vlm: normalized.tipo_vlm,
          geologo_ivplm: normalized.geologo_ivplm,
          url_ivplm: normalized.url_ivplm,
          modalidad_contrato: normalized.modalidad_contrato,
          ley_au_minima_contrato: isBlank(normalized.ley_au_minima_contrato)
            ? null
            : toPositiveNumberOrNull(normalized.ley_au_minima_contrato),
          sujeto_uif: normalized.sujeto_uif,
          business_year: toYearOrNull(normalized.business_year),
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

export default function ComplianceProveeminExp({
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
      const resp = (await apiGet(ENDPOINT)) as ComplianceResp;
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

  function onExportExcel() {
    if (!rows.length) {
      setMsgAction("No hay registros para exportar.");
      return;
    }

    const exportRows = [...rows]
      .sort((a, b) => {
        const fa = normalizeText(a.fecha_ivplm);
        const fb = normalizeText(b.fecha_ivplm);
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
        sede: normalizeText(row.sede),
        zona: normalizeText(row.zona),
        condicion_formal_minero: normalizeText(row.condicion_formal_minero),
        tipo_persona: normalizeText(row.tipo_persona),
        tipo_empresa: normalizeText(row.tipo_empresa),
        fecha_ivplm: normalizeText(row.fecha_ivplm).slice(0, 10),
        coorxy_vlm: normalizeText(row.coorxy_vlm),
        zonautm_vlm: normalizeText(row.zonautm_vlm),
        norte_vlm: row.norte_vlm ?? "",
        este_vlm: row.este_vlm ?? "",
        tipo_vlm: normalizeText(row.tipo_vlm),
        geologo_ivplm: normalizeText(row.geologo_ivplm),
        url_ivplm: normalizeText(row.url_ivplm),
        modalidad_contrato: normalizeText(row.modalidad_contrato),
        ley_au_minima_contrato: row.ley_au_minima_contrato ?? "",
        sujeto_uif: normalizeText(row.sujeto_uif),
        business_year: row.business_year ?? "",
      }));

    const ws = XLSX.utils.json_to_sheet(exportRows);

    ws["!cols"] = PREVIEW_COLUMNS.map((c) => ({
      wch: Math.max(12, Math.round((c.width || 120) / 8)),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "format_proveemin");
    XLSX.writeFile(wb, `compliance_format_proveemin_${getFileStamp()}.xlsx`);
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

      const missingHeaders = REQUIRED_IMPORT_HEADERS.filter((field) => !normalizedFields.includes(field));

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
            sede: normalizeFieldValue("sede", getValue("sede")),
            zona: normalizeFieldValue("zona", getValue("zona")),
            condicion_formal_minero: normalizeFieldValue("condicion_formal_minero", getValue("condicion_formal_minero")),
            tipo_persona: normalizeFieldValue("tipo_persona", getValue("tipo_persona")),
            tipo_empresa: normalizeFieldValue("tipo_empresa", getValue("tipo_empresa")),
            fecha_ivplm: normalizeFieldValue("fecha_ivplm", getValue("fecha_ivplm")),
            coorxy_vlm: normalizeFieldValue("coorxy_vlm", getValue("coorxy_vlm")),
            zonautm_vlm: normalizeFieldValue("zonautm_vlm", getValue("zonautm_vlm")),
            norte_vlm: normalizeFieldValue("norte_vlm", getValue("norte_vlm")),
            este_vlm: normalizeFieldValue("este_vlm", getValue("este_vlm")),
            tipo_vlm: normalizeFieldValue("tipo_vlm", getValue("tipo_vlm")),
            geologo_ivplm: normalizeFieldValue("geologo_ivplm", getValue("geologo_ivplm")),
            url_ivplm: normalizeFieldValue("url_ivplm", getValue("url_ivplm")),
            modalidad_contrato: normalizeFieldValue("modalidad_contrato", getValue("modalidad_contrato")),
            ley_au_minima_contrato: normalizeFieldValue("ley_au_minima_contrato", getValue("ley_au_minima_contrato")),
            sujeto_uif: normalizeFieldValue("sujeto_uif", getValue("sujeto_uif")),
            business_year: normalizeFieldValue("business_year", getValue("business_year")),
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
        .filter((row) => REQUIRED_IMPORT_HEADERS.some((field) => !isBlank(row[field])));

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
      await apiPost(ENDPOINT, { rows: payloadRows });
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
                  disabled={importing || previewRows.length === 0 || invalidCount > 0}
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
                    <th className="capex-th" style={{ position: "sticky", top: 0, zIndex: 20, background: headerBg, border: headerBorder, borderBottom: headerBorder, textAlign: "left", padding: "8px 8px", fontSize: 12, whiteSpace: "nowrap" }}>
                      Fila
                    </th>
                    <th className="capex-th" style={{ position: "sticky", top: 0, zIndex: 20, background: headerBg, border: headerBorder, borderBottom: headerBorder, textAlign: "left", padding: "8px 8px", fontSize: 12, whiteSpace: "nowrap" }}>
                      Estado
                    </th>

                    {PREVIEW_COLUMNS.map((col) => (
                      <th key={col.key} className="capex-th" style={{ position: "sticky", top: 0, zIndex: 20, background: headerBg, border: headerBorder, borderBottom: headerBorder, textAlign: "left", padding: "8px 8px", fontSize: 12, whiteSpace: "nowrap" }}>
                        {col.label}
                      </th>
                    ))}

                    <th className="capex-th" style={{ position: "sticky", top: 0, zIndex: 20, background: headerBg, border: headerBorder, borderBottom: headerBorder, textAlign: "left", padding: "8px 8px", fontSize: 12, whiteSpace: "nowrap" }}>
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
                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>
                          {row.row_num}
                        </td>

                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg, fontWeight: 900 }}>
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
                            <td key={col.key} className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>
                              <div
                                style={{
                                  ...previewInputStyle,
                                  minWidth: col.width || 120,
                                  border: error ? "1px solid #ff6b6b" : "1px solid rgba(255,255,255,.10)",
                                  background: error ? "rgba(255, 77, 77, 0.12)" : "rgba(0,0,0,.10)",
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

                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg, whiteSpace: "normal", color: row.errors ? "#ffb3b3" : "inherit" }} title={row.errors || "—"}>
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

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9 }}>
                {invalidCount > 0
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