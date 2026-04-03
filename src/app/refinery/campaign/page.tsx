// src/app/refinery/campaign/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet, apiPost } from "../../../lib/apiClient";
import { Button } from "../../../components/ui/Button";
import { Table } from "../../../components/ui/Table";

type CampaignRow = {
  campaign_id: string;
  campaign_date: string | null;
  campaign_wet_cr: any;
  campaign_moisture_pct: any;
  campaign_au_grade: any;
  campaign_ag_grade: any;
  campaign_cr: any;
  campaign_au: any;
  campaign_ag: any;
  campaign_cu: any;
};

type CampaignsResp = {
  ok: boolean;
  rows: CampaignRow[];
};

type Form = {
  campaign_no: string;
  campaign_date: string;
  campaign_wet_cr: string;
  campaign_moisture_pct: string;
  campaign_au_grade: string;
  campaign_ag_grade: string;
};

type ImportField =
  | "campaign_no"
  | "campaign_date"
  | "campaign_wet_cr"
  | "campaign_moisture_pct"
  | "campaign_au_grade"
  | "campaign_ag_grade";

type ImportPreviewRow = {
  row_num: number;
  campaign_id: string;
  campaign_date: string | null;
  campaign_wet_cr: string | null;
  campaign_moisture_pct: string | null;
  campaign_cr: string | null;
  campaign_au_grade: string | null;
  campaign_ag_grade: string | null;
  status: "NUEVA" | "ACTUALIZAR" | "INVÁLIDA";
  errors: string;
  duplicate_count: number;
  is_duplicate: boolean;
  valid: boolean;
  payload: {
    campaign_id: string;
    campaign_date: string;
    campaign_wet_cr: number;
    campaign_moisture_pct: number;
    campaign_au_grade: number;
    campaign_ag_grade: number;
    campaign_cr: number;
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
  new_rows: number;
  update_rows: number;
};

function isoTodayPe(): string {
  const now = new Date();
  const pe = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const y = pe.getUTCFullYear();
  const m = String(pe.getUTCMonth() + 1).padStart(2, "0");
  const d = String(pe.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toNumOrNaN(s: string) {
  if (s === null || s === undefined) return NaN;
  const t = String(s).trim().replace(",", ".");
  if (!t) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function clampInt_1to99_OrNull(s: string) {
  const n = toNumOrNaN(s);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (String(i) !== String(n) && String(n).includes(".")) return null;
  if (i < 1 || i > 99) return null;
  return i;
}

function clampPct_1to100_OrNull(s: string) {
  const n = toNumOrNaN(s);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 100) return null;
  return n;
}

function gt0_OrNull(s: string) {
  const n = toNumOrNaN(s);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return n;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function round3(n: number) {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

function buildCampaignId(campaign_date: string, campaign_no: string) {
  const no = clampInt_1to99_OrNull(campaign_no);
  if (!campaign_date || no === null) return "";
  const dt = new Date(`${campaign_date}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return "";
  const y = String(dt.getFullYear()).slice(-2);
  const m = pad2(dt.getMonth() + 1);
  const n2 = pad2(no);
  return `${y}-C${m}-${n2}`;
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

  if (["#campana", "campana", "campaignno", "campaignnumber"].includes(h)) return "campaign_no";
  if (["campaigndate", "fecha"].includes(h)) return "campaign_date";
  if (["campaignwetcr", "cr", "tmh"].includes(h)) return "campaign_wet_cr";
  if (["campaignmoisturepct", "moisture", "humedad", "%humedad"].includes(h)) return "campaign_moisture_pct";
  if (["campaignaugrade", "augrade", "leyau"].includes(h)) return "campaign_au_grade";
  if (["campaignaggrade", "aggrade", "leyag"].includes(h)) return "campaign_ag_grade";

  return "";
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

function campaignNoFromId(campaign_id: unknown) {
  const m = normalizeText(campaign_id).match(/-(\d{2})$/);
  if (!m) return "";
  return String(Number(m[1]));
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

function DatePicker({
  valueIso,
  onChangeIso,
  disabled,
}: {
  valueIso: string;
  onChangeIso: (iso: string) => void;
  disabled?: boolean;
}) {
  const max = useMemo(() => isoTodayPe(), []);
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontWeight: 900, fontSize: 13 }}>Fecha de Campaña</div>
      <input
        type="date"
        value={valueIso}
        max={max}
        disabled={disabled}
        onChange={(e) => onChangeIso(e.target.value)}
        style={{
          width: "100%",
          background: "rgba(0,0,0,.10)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          borderRadius: 10,
          padding: "10px 12px",
          outline: "none",
          fontWeight: 900,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.7 : 1,
        }}
      />
    </div>
  );
}

export default function RefineryCampaignPage() {
  const [msg, setMsg] = useState<string | null>(null);

  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [loadingExisting, setLoadingExisting] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);

  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [existingDateIso, setExistingDateIso] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<Form>({
    campaign_no: "",
    campaign_date: isoTodayPe(),
    campaign_wet_cr: "",
    campaign_moisture_pct: "",
    campaign_au_grade: "",
    campaign_ag_grade: "",
  });

  const campaign_id = useMemo(
    () => buildCampaignId(form.campaign_date, form.campaign_no),
    [form.campaign_date, form.campaign_no]
  );

  const existingIdSet = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      const id = normalizeText(row.campaign_id).toUpperCase();
      if (id) set.add(id);
    }
    return set;
  }, [rows]);

  const dateOk = useMemo(() => {
    if (!form.campaign_date) return false;
    return form.campaign_date <= isoTodayPe();
  }, [form.campaign_date]);

  const inputsOk = useMemo(() => {
    const no = clampInt_1to99_OrNull(form.campaign_no);
    const wet = gt0_OrNull(form.campaign_wet_cr);
    const moist = clampPct_1to100_OrNull(form.campaign_moisture_pct);
    const au = gt0_OrNull(form.campaign_au_grade);
    const ag = gt0_OrNull(form.campaign_ag_grade);
    return dateOk && no !== null && wet !== null && moist !== null && au !== null && ag !== null;
  }, [
    dateOk,
    form.campaign_no,
    form.campaign_wet_cr,
    form.campaign_moisture_pct,
    form.campaign_au_grade,
    form.campaign_ag_grade,
  ]);

  const canSave = useMemo(() => inputsOk && !!campaign_id && !saving, [inputsOk, campaign_id, saving]);

  const validPreviewRows = useMemo(() => previewRows.filter((row) => row.valid && row.payload), [previewRows]);

  const visualTms = useMemo(() => {
    const tmh = toNumOrNaN(form.campaign_wet_cr);
    const moisturePct = toNumOrNaN(form.campaign_moisture_pct);

    if (!Number.isFinite(tmh) || tmh <= 0) return null;
    if (!Number.isFinite(moisturePct) || moisturePct < 0) return null;

    return round3(tmh * (1 - moisturePct / 100));
  }, [form.campaign_wet_cr, form.campaign_moisture_pct]);

  async function loadCampaigns(clearMsg: boolean = true) {
    setLoadingList(true);
    if (clearMsg) setMsg(null);
    try {
      const r = (await apiGet("/api/refineria/campaigns")) as CampaignsResp;
      setRows(Array.isArray(r.rows) ? r.rows : []);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando campañas");
    } finally {
      setLoadingList(false);
    }
  }

  function numToStr(v: any) {
    if (v === null || v === undefined || v === "") return "";
    const n = Number(v);
    return Number.isFinite(n) ? round3(n).toFixed(3) : "";
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
      setMsg("No hay campañas para exportar.");
      return;
    }

    const exportRows = rows.map((row) => ({
      "#campaña": campaignNoFromId(row.campaign_id),
      campaign_date: row.campaign_date ? String(row.campaign_date).slice(0, 10) : "",
      campaign_wet_cr: row.campaign_wet_cr == null ? "" : round3(Number(row.campaign_wet_cr)),
      campaign_moisture_pct:
        row.campaign_moisture_pct == null ? "" : round3(Number(row.campaign_moisture_pct) * 100),
      campaign_au_grade: row.campaign_au_grade == null ? "" : round3(Number(row.campaign_au_grade)),
      campaign_ag_grade: row.campaign_ag_grade == null ? "" : round3(Number(row.campaign_ag_grade)),
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws["!cols"] = [
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 22 },
      { wch: 18 },
      { wch: 18 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Campaigns");
    XLSX.writeFile(wb, `refinery_campaigns_${getFileStamp()}.xlsx`);
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setMsg(null);

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
        "campaign_no",
        "campaign_date",
        "campaign_wet_cr",
        "campaign_moisture_pct",
        "campaign_au_grade",
        "campaign_ag_grade",
      ];

      const missingHeaders = requiredFields.filter((field) => !normalizedFields.includes(field));

      if (missingHeaders.length) {
        throw new Error(
          `Faltan columnas: ${missingHeaders.join(", ")}. Deben venir: #campaña, campaign_date, campaign_wet_cr, campaign_moisture_pct, campaign_au_grade, campaign_ag_grade`
        );
      }

      const baseRows = rawRows
        .map((raw, idx) => {
          const getValue = (fieldName: string) => {
            const sourceKey = Object.keys(raw).find((k) => getImportField(k) === fieldName);
            return sourceKey ? raw[sourceKey] : "";
          };

          const campaign_no_raw = normalizeText(getValue("campaign_no"));
          const campaign_date_iso = parseExcelDateToIso(getValue("campaign_date"));
          const campaign_id = buildCampaignId(campaign_date_iso, campaign_no_raw);

          return {
            row_num: idx + 2,
            campaign_no_raw,
            campaign_id,
            campaign_date: campaign_date_iso || null,
            campaign_wet_cr_raw: normalizeText(getValue("campaign_wet_cr")),
            campaign_moisture_pct_raw: normalizeText(getValue("campaign_moisture_pct")),
            campaign_au_grade_raw: normalizeText(getValue("campaign_au_grade")),
            campaign_ag_grade_raw: normalizeText(getValue("campaign_ag_grade")),
          };
        })
        .filter((row) => {
          return (
            !isBlank(row.campaign_no_raw) ||
            !isBlank(row.campaign_date) ||
            !isBlank(row.campaign_wet_cr_raw) ||
            !isBlank(row.campaign_moisture_pct_raw) ||
            !isBlank(row.campaign_au_grade_raw) ||
            !isBlank(row.campaign_ag_grade_raw)
          );
        });

      if (!baseRows.length) {
        throw new Error("No hay filas válidas para importar.");
      }

      const counts = new Map<string, number>();
      for (const row of baseRows) {
        if (!row.campaign_id) continue;
        counts.set(row.campaign_id, (counts.get(row.campaign_id) || 0) + 1);
      }

      const dedupMap = new Map<string, ImportPreviewRow>();
      const rowsWithoutId: ImportPreviewRow[] = [];

      for (const row of baseRows) {
        const no = clampInt_1to99_OrNull(row.campaign_no_raw);
        const wet = gt0_OrNull(row.campaign_wet_cr_raw);
        const moistPct = clampPct_1to100_OrNull(row.campaign_moisture_pct_raw);
        const au = gt0_OrNull(row.campaign_au_grade_raw);
        const ag = gt0_OrNull(row.campaign_ag_grade_raw);
        const dateIsValid = !!row.campaign_date && row.campaign_date <= isoTodayPe();

        const errors: string[] = [];
        if (no === null) errors.push("#campaña inválida (1-99)");
        if (!row.campaign_date) errors.push("fecha inválida");
        else if (!dateIsValid) errors.push("fecha mayor a hoy");
        if (wet === null) errors.push("campaign_wet_cr inválido (>0)");
        if (moistPct === null) errors.push("campaign_moisture_pct inválido (1-100)");
        if (au === null) errors.push("campaign_au_grade inválido (>0)");
        if (ag === null) errors.push("campaign_ag_grade inválido (>0)");
        if (!row.campaign_id) errors.push("no se pudo construir campaign_id");

        const valid =
          !!row.campaign_id &&
          !!row.campaign_date &&
          dateIsValid &&
          no !== null &&
          wet !== null &&
          moistPct !== null &&
          au !== null &&
          ag !== null;

        const moistDec = moistPct !== null ? round3(moistPct / 100) : null;
        const campaign_cr = wet !== null && moistDec !== null ? round3(wet * (1 - moistDec)) : null;

        const previewRow: ImportPreviewRow = {
          row_num: row.row_num,
          campaign_id: row.campaign_id || "—",
          campaign_date: row.campaign_date,
          campaign_wet_cr: wet !== null ? round3(wet).toFixed(3) : null,
          campaign_moisture_pct: moistPct !== null ? round3(moistPct).toFixed(3) : null,
          campaign_cr: campaign_cr !== null ? campaign_cr.toFixed(3) : null,
          campaign_au_grade: au !== null ? round3(au).toFixed(3) : null,
          campaign_ag_grade: ag !== null ? round3(ag).toFixed(3) : null,
          status: !valid
            ? "INVÁLIDA"
            : existingIdSet.has(row.campaign_id.toUpperCase())
            ? "ACTUALIZAR"
            : "NUEVA",
          errors: errors.join(" | "),
          duplicate_count: row.campaign_id ? counts.get(row.campaign_id) || 0 : 0,
          is_duplicate: row.campaign_id ? (counts.get(row.campaign_id) || 0) > 1 : false,
          valid,
          payload:
            valid && moistDec !== null && campaign_cr !== null
              ? {
                  campaign_id: row.campaign_id,
                  campaign_date: row.campaign_date!,
                  campaign_wet_cr: round3(wet!),
                  campaign_moisture_pct: moistDec,
                  campaign_au_grade: round3(au!),
                  campaign_ag_grade: round3(ag!),
                  campaign_cr,
                }
              : null,
        };

        if (!row.campaign_id) {
          rowsWithoutId.push(previewRow);
        } else {
          dedupMap.set(row.campaign_id, previewRow);
        }
      }

      const preview = [...rowsWithoutId, ...Array.from(dedupMap.values())].sort((a, b) => a.row_num - b.row_num);

      const validRows = preview.filter((row) => row.valid);
      const newRows = validRows.filter((row) => row.status === "NUEVA").length;
      const updateRows = validRows.filter((row) => row.status === "ACTUALIZAR").length;
      const repeatedCampaigns = Array.from(counts.values()).filter((count) => count > 1).length;
      const repeatedExtraRows = Array.from(counts.values()).reduce(
        (acc, count) => acc + (count > 1 ? count - 1 : 0),
        0
      );

      setPreviewRows(preview);
      setImportSummary({
        file_name: file.name,
        total_excel_rows: rawRows.length,
        unique_rows: preview.length,
        valid_rows: validRows.length,
        invalid_rows: preview.length - validRows.length,
        repeated_campaigns: repeatedCampaigns,
        repeated_extra_rows: repeatedExtraRows,
        new_rows: newRows,
        update_rows: updateRows,
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
    if (!validPreviewRows.length) {
      setMsg("No hay filas válidas para importar.");
      return;
    }

    setImporting(true);
    setMsg(null);

    try {
      for (const row of validPreviewRows) {
        if (!row.payload) continue;
        await apiPost("/api/refineria/campaign/upsert", row.payload);
      }

      await loadCampaigns(false);
      setPreviewOpen(false);
      setPreviewRows([]);
      setImportSummary(null);
      setMsg(`OK: se importaron ${validPreviewRows.length} campaña(s).`);
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo importar el archivo")}`);
    } finally {
      setImporting(false);
    }
  }

  async function loadExistingIfAny() {
    if (!campaign_id) {
      setExistingDateIso(null);
      setForm((s) => ({
        ...s,
        campaign_wet_cr: "",
        campaign_moisture_pct: "",
        campaign_au_grade: "",
        campaign_ag_grade: "",
      }));
      return;
    }

    setLoadingExisting(true);
    setMsg(null);
    try {
      const list = rows.length
        ? rows
        : ((await apiGet("/api/refineria/campaigns")) as CampaignsResp).rows || [];

      if (!rows.length) setRows(Array.isArray(list) ? list : []);

      const ex =
        (Array.isArray(list) ? list : []).find(
          (x) => String(x.campaign_id || "").trim().toUpperCase() === campaign_id.toUpperCase()
        ) ?? null;

      if (ex) {
        const exDateIso = ex.campaign_date ? String(ex.campaign_date).slice(0, 10) : "";
        setExistingDateIso(exDateIso || null);
        setForm((s) => ({
          ...s,
          campaign_date: exDateIso || s.campaign_date,
          campaign_wet_cr: numToStr(ex.campaign_wet_cr),
          campaign_moisture_pct:
            ex.campaign_moisture_pct === null || ex.campaign_moisture_pct === undefined
              ? ""
              : round3(Number(ex.campaign_moisture_pct) * 100).toFixed(3),
          campaign_au_grade: numToStr(ex.campaign_au_grade),
          campaign_ag_grade: numToStr(ex.campaign_ag_grade),
        }));
        setMsg(`OK: cargado ${campaign_id}`);
      } else {
        setExistingDateIso(null);
        setForm((s) => ({
          ...s,
          campaign_wet_cr: "",
          campaign_moisture_pct: "",
          campaign_au_grade: "",
          campaign_ag_grade: "",
        }));
        setMsg(null);
      }
    } catch (e: any) {
      const m = String(e?.message || "");
      if (m.includes("400") || m.includes("404")) setMsg(null);
      else setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR cargando campaña");
    } finally {
      setLoadingExisting(false);
    }
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    setExistingDateIso(null);
    loadExistingIfAny();
  }, [campaign_id]);

  async function onSave() {
    setMsg(null);
    setSaving(true);
    try {
      const no = clampInt_1to99_OrNull(form.campaign_no);
      const wet = gt0_OrNull(form.campaign_wet_cr);
      const moistPct = clampPct_1to100_OrNull(form.campaign_moisture_pct);
      const au = gt0_OrNull(form.campaign_au_grade);
      const ag = gt0_OrNull(form.campaign_ag_grade);

      if (!campaign_id || no === null || wet === null || moistPct === null || au === null || ag === null || !dateOk) {
        setMsg("ERROR: valida los campos");
        return;
      }

      const moistDec = round3(moistPct / 100);
      const campaign_cr = round3(wet * (1 - moistDec));

      const payload = {
        campaign_id,
        campaign_date: form.campaign_date,
        campaign_wet_cr: round3(wet),
        campaign_moisture_pct: moistDec,
        campaign_au_grade: round3(au),
        campaign_ag_grade: round3(ag),
        campaign_cr,
      };

      await apiPost("/api/refineria/campaign/upsert", payload);
      setMsg(`OK: guardado ${campaign_id}`);
      await loadCampaigns(false);
    } catch (e: any) {
      setMsg(e?.message ? `ERROR: ${e.message}` : "ERROR guardando campaña");
    } finally {
      setSaving(false);
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
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={onImportFile}
        style={{ display: "none" }}
      />

      <div style={{ display: "grid", gap: 12, maxWidth: 820 }}>
        <div className="panel-inner" style={{ padding: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 900 }}>Crear Campaña</div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
            {campaign_id
              ? `campaign_id: ${campaign_id}${existingDateIso ? `  |  fecha: ${existingDateIso}` : ""}`
              : "Completa # campaña y fecha"}
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Button type="button" size="sm" variant="ghost" onClick={() => loadCampaigns()} disabled={loadingList || saving || importing}>
              {loadingList ? "Cargando..." : "Refrescar"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onExportExcel} disabled={loadingList || saving || importing || rows.length === 0}>
              Exportar Excel
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onClickImport} disabled={loadingList || saving || importing}>
              {importing ? "Importando…" : "Importar Excel"}
            </Button>
            <Button type="button" size="sm" variant="primary" onClick={onSave} disabled={!canSave}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>

        {msg ? (
          <div
            className="panel-inner"
            style={{
              padding: 12,
              border: msg.startsWith("OK") ? "1px solid rgba(102,199,255,.45)" : "1px solid rgba(255,80,80,.45)",
              background: msg.startsWith("OK") ? "rgba(102,199,255,.10)" : "rgba(255,80,80,.10)",
              fontWeight: 800,
            }}
          >
            {msg}
          </div>
        ) : null}

        <div className="panel-inner" style={{ padding: 14 }}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "260px 260px 1fr", gap: 12, alignItems: "end" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 900, fontSize: 13 }}># de Campaña en el Mes</div>
                <input
                  value={form.campaign_no}
                  disabled={saving}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      campaign_no: String(e.target.value || "").replace(/[^\d]/g, "").slice(0, 2),
                    }))
                  }
                  placeholder=""
                  inputMode="numeric"
                  style={{
                    width: "100%",
                    background: "rgba(0,0,0,.10)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    outline: "none",
                    fontWeight: 900,
                    opacity: saving ? 0.7 : 1,
                  }}
                />
              </div>

              <DatePicker
                valueIso={form.campaign_date}
                onChangeIso={(iso) => setForm((s) => ({ ...s, campaign_date: iso }))}
                disabled={saving}
              />

              <div className="muted" style={{ fontWeight: 900, fontSize: 12, alignSelf: "center", opacity: 0.9 }}>
                {loadingExisting ? "Cargando existente…" : campaign_id ? "Si existe, se autocompleta" : ""}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 900, fontSize: 13 }}>TMH</div>
                <input
                  value={form.campaign_wet_cr}
                  disabled={saving}
                  onChange={(e) => setForm((s) => ({ ...s, campaign_wet_cr: e.target.value }))}
                  placeholder=""
                  inputMode="decimal"
                  style={{
                    width: "100%",
                    background: "rgba(0,0,0,.10)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    outline: "none",
                    fontWeight: 900,
                    opacity: saving ? 0.7 : 1,
                  }}
                />
                <div
                  className="muted"
                  style={{
                    fontWeight: 900,
                    fontSize: 13,
                    lineHeight: 1.2,
                    color: "rgba(102,199,255,.95)",
                  }}
                >
                  {visualTms !== null ? `TMS=${visualTms.toFixed(3)}` : "TMS=-"}
                </div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 900, fontSize: 13 }}>% de Humedad (1-100)</div>
                <input
                  value={form.campaign_moisture_pct}
                  disabled={saving}
                  onChange={(e) => setForm((s) => ({ ...s, campaign_moisture_pct: e.target.value }))}
                  placeholder=""
                  inputMode="decimal"
                  style={{
                    width: "100%",
                    background: "rgba(0,0,0,.10)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    outline: "none",
                    fontWeight: 900,
                    opacity: saving ? 0.7 : 1,
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 900, fontSize: 13 }}>Ley Au</div>
                <input
                  value={form.campaign_au_grade}
                  disabled={saving}
                  onChange={(e) => setForm((s) => ({ ...s, campaign_au_grade: e.target.value }))}
                  placeholder=""
                  inputMode="decimal"
                  style={{
                    width: "100%",
                    background: "rgba(0,0,0,.10)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    outline: "none",
                    fontWeight: 900,
                    opacity: saving ? 0.7 : 1,
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 900, fontSize: 13 }}>Ley Ag</div>
                <input
                  value={form.campaign_ag_grade}
                  disabled={saving}
                  onChange={(e) => setForm((s) => ({ ...s, campaign_ag_grade: e.target.value }))}
                  placeholder=""
                  inputMode="decimal"
                  style={{
                    width: "100%",
                    background: "rgba(0,0,0,.10)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    outline: "none",
                    fontWeight: 900,
                    opacity: saving ? 0.7 : 1,
                  }}
                />
              </div>
            </div>

            {!inputsOk ? (
              <div className="muted" style={{ fontWeight: 900, fontSize: 12, color: "rgba(255,255,255,.70)" }}>
                Completa todos los campos y respeta rangos: # campaña 1-99, humedad 1-100, kg y leyes &gt; 0.
              </div>
            ) : null}
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
              width: "min(1320px, 96vw)",
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
                <div style={{ fontSize: 18, fontWeight: 900 }}>Preview de importación de campañas</div>
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
                  <col style={{ width: 120 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 320 }} />
                </colgroup>
                <thead>
                  <tr>
                    {[
                      "fila",
                      "campaign_id",
                      "campaign_date",
                      "campaign_wet_cr",
                      "campaign_moisture_pct",
                      "campaign_cr",
                      "campaign_au_grade",
                      "campaign_ag_grade",
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
                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>{row.row_num}</td>
                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg, fontWeight: 900 }} title={row.campaign_id}>{row.campaign_id}</td>
                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>{row.campaign_date || "—"}</td>
                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>{row.campaign_wet_cr || "—"}</td>
                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>{row.campaign_moisture_pct || "—"}</td>
                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>{row.campaign_cr || "—"}</td>
                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>{row.campaign_au_grade || "—"}</td>
                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }}>{row.campaign_ag_grade || "—"}</td>
                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg, fontWeight: 900 }}>{row.status}</td>
                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg, fontWeight: 900 }}>{row.is_duplicate ? `Sí (${row.duplicate_count})` : "No"}</td>
                        <td className="capex-td" style={{ ...cellBase, borderTop: gridH, borderBottom: gridH, borderRight: gridV, background: bg }} title={row.errors || "—"}>{row.errors || "—"}</td>
                      </tr>
                    );
                  })}

                  {previewRows.length === 0 ? (
                    <tr className="capex-tr">
                      <td className="capex-td" style={{ ...cellBase, fontWeight: 900 }} colSpan={11}>
                        No hay filas para preview.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </Table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9 }}>
                Se postearán exactamente {validPreviewRows.length} fila(s) válidas con el mismo payload actual.
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button type="button" size="sm" variant="default" onClick={closePreview} disabled={importing}>
                  Cancelar
                </Button>
                <Button type="button" size="sm" variant="primary" onClick={confirmImport} disabled={importing || validPreviewRows.length === 0}>
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