"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiGet, apiPost } from "../../lib/apiClient";
import {
  cmDateText as dateText,
  cmEntryDate2Error as entryDate2Error,
  parseCmIsoDate as parseIsoDate,
  todayInLima,
} from "../../lib/traceability/cmEntryDate";
import { Button } from "../ui/Button";
import { Pager } from "../ui/Pager";
import ExcelHeaderFilter, {
  excelFilterIsActive,
  matchesExcelFilter,
  type ExcelColumnFilter,
  type ExcelFilterKind,
} from "../ui/ExcelHeaderFilter";
import { Table } from "../ui/Table";

type NumericValue = number | string | null;

type CmEntryDateRow = {
  lot: string | null;
  entry_date: string | null;
  entry_date_2: string | null;
  sack_qty: NumericValue;
  miner_name: string | null;
  plate: string | null;
  ruc: string | null;
  concession_name: string | null;
  concession_code: string | null;
  office_name: string | null;
  zone_name: string | null;
  office_code: string | null;
  district: string | null;
  province: string | null;
  department: string | null;
  sender_guide_number: string | null;
  transport_name: string | null;
  transport_guide_number: string | null;
  tmh: NumericValue;
  tms: NumericValue;
};

type RucConMapRow = {
  ruc: string | null;
  concession_code: string | null;
  office_name: string | null;
  zone_name: string | null;
  office_code: string | null;
};

type MappingDraft = {
  office_name: string;
  zone_name: string;
  office_code: string;
};

type GetResponse<T> = {
  ok: boolean;
  rows?: T[];
  error?: string;
};

type SaveResponse = {
  ok: boolean;
  error?: string;
};

type EntryColumn = {
  key: keyof CmEntryDateRow;
  label: string;
  kind: "text" | "date" | "number";
  width: number;
};

type MappingColumn = {
  key: keyof RucConMapRow;
  label: string;
  editable: boolean;
  width: number;
};

type SortDirection = "asc" | "desc";
const PAGE_SIZE = 100;
const SAVE_CONCURRENCY = 20;
const ENTRY_COLUMNS: EntryColumn[] = [
  { key: "lot", label: "Lote", kind: "text", width: 110 },
  { key: "entry_date", label: "F. ingreso", kind: "date", width: 112 },
  { key: "entry_date_2", label: "F. ingreso 2", kind: "date", width: 126 },
  { key: "sack_qty", label: "Sacos", kind: "number", width: 90 },
  { key: "miner_name", label: "Minero", kind: "text", width: 220 },
  { key: "plate", label: "Placa", kind: "text", width: 105 },
  { key: "ruc", label: "RUC", kind: "text", width: 125 },
  { key: "concession_name", label: "Concesión", kind: "text", width: 210 },
  { key: "concession_code", label: "Cód. concesión", kind: "text", width: 145 },
  { key: "office_name", label: "Oficina", kind: "text", width: 150 },
  { key: "zone_name", label: "Zona", kind: "text", width: 125 },
  { key: "office_code", label: "Cód. oficina", kind: "text", width: 125 },
  { key: "district", label: "Distrito", kind: "text", width: 135 },
  { key: "province", label: "Provincia", kind: "text", width: 135 },
  { key: "department", label: "Departamento", kind: "text", width: 145 },
  { key: "sender_guide_number", label: "Guía remitente", kind: "text", width: 150 },
  { key: "transport_name", label: "Transportista", kind: "text", width: 210 },
  { key: "transport_guide_number", label: "Guía transportista", kind: "text", width: 165 },
  { key: "tmh", label: "TMH", kind: "number", width: 100 },
  { key: "tms", label: "TMS", kind: "number", width: 100 },
];

const MAPPING_COLUMNS: MappingColumn[] = [
  { key: "ruc", label: "RUC", editable: false, width: 135 },
  { key: "concession_code", label: "Cód. concesión", editable: false, width: 180 },
  { key: "office_name", label: "Oficina", editable: true, width: 210 },
  { key: "zone_name", label: "Zona", editable: true, width: 180 },
  { key: "office_code", label: "Cód. oficina", editable: true, width: 180 },
];

const OFFICE_DEFAULTS: Record<
  string,
  Pick<MappingDraft, "zone_name" | "office_code">
> = {
  ABANCAY: { zone_name: "Sur", office_code: "L" },
  CARHUAMAYO: { zone_name: "Norte", office_code: "L" },
  CHALA: { zone_name: "Sur Aqp", office_code: "C" },
  CHIMBOTE: { zone_name: "Norte", office_code: "L" },
  COLQUEMARCA: { zone_name: "Sur", office_code: "L" },
  HUANCA: { zone_name: "Sur", office_code: "L" },
  ISPACAS: { zone_name: "Sur Aqp", office_code: "P" },
  JULIACA: { zone_name: "Sur", office_code: "L" },
  "LAS LOMAS": { zone_name: "Norte", office_code: "L" },
  NAZCA: { zone_name: "Sur", office_code: "L" },
  PEDREGAL: { zone_name: "Sur Aqp", office_code: "P" },
  SECOCHA: { zone_name: "Sur Aqp", office_code: "S" },
  TRUJILLO: { zone_name: "Norte", office_code: "T" },
};

const MAPPING_OPTIONS: Record<keyof MappingDraft, readonly string[]> = {
  office_name: Object.keys(OFFICE_DEFAULTS),
  zone_name: ["Sur", "Norte", "Sur Aqp"],
  office_code: ["C", "L", "P", "S", "T"],
};

const MAPPING_FIELD_LABELS: Record<keyof MappingDraft, string> = {
  office_name: "Oficina",
  zone_name: "Zona",
  office_code: "Cód. oficina",
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
});

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function displayDate(value: unknown) {
  const parsed = parseIsoDate(value);
  if (!parsed) return dateText(value) || "—";
  const [year, month, day] = parsed.normalized.split("-");
  return `${day}/${month}/${year}`;
}

function displayValue(value: unknown, kind: EntryColumn["kind"]) {
  if (kind === "date") return displayDate(value);
  if (kind === "number") {
    if (value === null || value === undefined || text(value).trim() === "") return "—";
    const parsed = Number(value);
    return Number.isFinite(parsed) ? numberFormatter.format(parsed) : text(value);
  }
  return text(value).trim() || "—";
}

function excelDate(value: unknown) {
  const parsed = parseIsoDate(value);
  if (!parsed) return "";
  const [year, month, day] = parsed.normalized.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function excelNumber(value: NumericValue) {
  const normalized = text(value).trim();
  if (!normalized) return "";
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : normalized;
}

function excelFilterValue(value: unknown, kind: ExcelFilterKind) {
  const normalized = text(value).trim();
  if (!normalized) return "";
  if (kind === "date") return dateText(normalized);
  if (kind === "number") {
    const parsed = Number(normalized.replace(",", "."));
    if (!Number.isFinite(parsed)) return normalized;
    return (Math.abs(parsed) < 0.005 ? 0 : parsed).toFixed(2);
  }
  return normalized;
}

function rowLot(row: CmEntryDateRow) {
  return text(row.lot).trim();
}

function mappingKey(row: { ruc: string | null }) {
  return text(row.ruc).trim();
}

function mappingRowKey(
  row: Pick<RucConMapRow, "ruc" | "concession_code">
) {
  return `${text(row.ruc).trim()}\u001f${text(row.concession_code).trim()}`;
}

function toMappingDraft(
  row: Pick<RucConMapRow, "office_name" | "zone_name" | "office_code">
): MappingDraft {
  return {
    office_name: text(row.office_name).trim(),
    zone_name: text(row.zone_name).trim(),
    office_code: text(row.office_code).trim(),
  };
}

function mappingColumnValue(
  row: RucConMapRow,
  key: keyof RucConMapRow,
  draft: MappingDraft
) {
  if (key === "office_name" || key === "zone_name" || key === "office_code") {
    return draft[key];
  }
  return row[key];
}

function sameMappingDraft(left: MappingDraft | undefined, right: MappingDraft | undefined) {
  if (!left || !right) return true;
  return (
    left.office_name === right.office_name &&
    left.zone_name === right.zone_name &&
    left.office_code === right.office_code
  );
}

function mappingDraftError(draft: MappingDraft | undefined) {
  if (!draft) return "No se encontraron los datos editables del mapping.";

  for (const field of Object.keys(MAPPING_OPTIONS) as Array<keyof MappingDraft>) {
    const value = draft[field].trim();
    if (value && !MAPPING_OPTIONS[field].includes(value)) {
      return `${MAPPING_FIELD_LABELS[field]} debe ser uno de estos valores: ${MAPPING_OPTIONS[field].join(", ")}.`;
    }
  }

  return null;
}

function optionalText(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function entrySaveErrorMessage(error: unknown) {
  const message = errorMessage(error).trim();
  if (/fetch failed|failed to fetch|networkerror/i.test(message)) {
    return "No se pudo conectar con la API de trazabilidad; el lote no fue guardado.";
  }
  return message || "La API rechazó el guardado sin indicar el motivo.";
}

async function settleInChunks<T>(
  items: T[],
  task: (item: T) => Promise<string>
) {
  const fulfilled: string[] = [];
  const rejected: string[] = [];

  for (let start = 0; start < items.length; start += SAVE_CONCURRENCY) {
    const chunk = items.slice(start, start + SAVE_CONCURRENCY);
    const results = await Promise.allSettled(chunk.map(task));

    results.forEach((result) => {
      if (result.status === "fulfilled") fulfilled.push(result.value);
      else rejected.push(errorMessage(result.reason));
    });
  }

  return { fulfilled, rejected };
}

export default function TraceabilityCmInputsForm() {
  const [rows, setRows] = useState<CmEntryDateRow[]>([]);
  const [draftDates, setDraftDates] = useState<Record<string, string>>({});
  const [originalDates, setOriginalDates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [entrySaveErrors, setEntrySaveErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showEditedOnly, setShowEditedOnly] = useState(false);
  const [sortKey, setSortKey] = useState<keyof CmEntryDateRow>("lot");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [hasManualSort, setHasManualSort] = useState(false);
  const [columnFilters, setColumnFilters] = useState<
    Partial<Record<keyof CmEntryDateRow, ExcelColumnFilter>>
  >({});
  const [page, setPage] = useState(1);

  const [mappingOpen, setMappingOpen] = useState(false);
  const [mappingRows, setMappingRows] = useState<RucConMapRow[]>([]);
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, MappingDraft>>({});
  const [mappingOriginals, setMappingOriginals] = useState<Record<string, MappingDraft>>({});
  const [mappingLoading, setMappingLoading] = useState(false);
  const [mappingSaving, setMappingSaving] = useState(false);
  const [mappingMessage, setMappingMessage] = useState<string | null>(null);
  const [mappingSearch, setMappingSearch] = useState("");
  const [mappingSortKey, setMappingSortKey] = useState<keyof RucConMapRow>("ruc");
  const [mappingSortDirection, setMappingSortDirection] = useState<SortDirection>("asc");
  const [hasMappingManualSort, setHasMappingManualSort] = useState(false);
  const [mappingColumnFilters, setMappingColumnFilters] = useState<
    Partial<Record<keyof RucConMapRow, ExcelColumnFilter>>
  >({});
  const [mappingPage, setMappingPage] = useState(1);
  const mappingImportInputRef = useRef<HTMLInputElement | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = (await apiGet(
        "/api/traceability/cm/entrydate"
      )) as GetResponse<CmEntryDateRow>;
      const nextRows = Array.isArray(response.rows) ? response.rows : [];
      const nextOriginals: Record<string, string> = {};

      nextRows.forEach((row) => {
        const lot = rowLot(row);
        if (!lot) return;
        nextOriginals[lot] = dateText(row.entry_date_2);
      });

      setRows(nextRows);
      setDraftDates({});
      setOriginalDates(nextOriginals);
      setEntrySaveErrors({});
      setShowEditedOnly(false);
      setColumnFilters({});
      setHasManualSort(false);
      setSortKey("lot");
      setSortDirection("asc");
      setPage(1);
    } catch (error: unknown) {
      setRows([]);
      setDraftDates({});
      setOriginalDates({});
      setEntrySaveErrors({});
      setMessage(`ERROR: ${errorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMapping = useCallback(async () => {
    setMappingLoading(true);
    setMappingMessage(null);

    try {
      const response = (await apiGet(
        "/api/traceability/cm/ruccon-map"
      )) as GetResponse<RucConMapRow>;
      const nextRows = Array.isArray(response.rows) ? response.rows : [];
      const nextDrafts: Record<string, MappingDraft> = {};
      const nextOriginals: Record<string, MappingDraft> = {};

      nextRows.forEach((row) => {
        const key = mappingKey(row);
        const draft = toMappingDraft(row);
        nextDrafts[key] = { ...draft };
        nextOriginals[key] = { ...draft };
      });

      setMappingRows(nextRows);
      setMappingDrafts(nextDrafts);
      setMappingOriginals(nextOriginals);
      setMappingColumnFilters({});
      setHasMappingManualSort(false);
      setMappingSortKey("ruc");
      setMappingSortDirection("asc");
      setMappingPage(1);
    } catch (error: unknown) {
      setMappingRows([]);
      setMappingDrafts({});
      setMappingOriginals({});
      setMappingMessage(`ERROR: ${errorMessage(error)}`);
    } finally {
      setMappingLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    if (!mappingOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !mappingSaving) setMappingOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mappingOpen, mappingSaving]);

  const maximumEntryDate2 = useMemo(todayInLima, []);
  const entryRowsByLot = useMemo(
    () => new Map(rows.map((row) => [rowLot(row), row])),
    [rows]
  );

  const editedLots = useMemo(
    () =>
      Object.keys(draftDates).filter(
        (lot) => dateText(draftDates[lot]) !== dateText(originalDates[lot])
      ),
    [draftDates, originalDates]
  );

  const editedLotSet = useMemo(() => new Set(editedLots), [editedLots]);
  const activeEditedLotSet = showEditedOnly ? editedLotSet : null;

  const entryDate2Errors = useMemo(() => {
    const errors = new Map<string, string>();

    editedLots.forEach((lot) => {
      const row = entryRowsByLot.get(lot);
      if (!row) return;

      const draftDate = dateText(draftDates[lot]);
      const error =
        (
          !draftDate
            ? "La fecha de ingreso 2 es obligatoria para guardar esta fila."
            : entryDate2Error(
                draftDate,
                row.entry_date,
                maximumEntryDate2
              )
        ) ?? entrySaveErrors[lot];

      if (error) errors.set(lot, error);
    });

    return errors;
  }, [
    draftDates,
    editedLots,
    entryRowsByLot,
    entrySaveErrors,
    maximumEntryDate2,
  ]);

  const invalidEditedLots = useMemo(
    () => editedLots.filter((lot) => entryDate2Errors.has(lot)),
    [editedLots, entryDate2Errors]
  );

  const entryDateBounds = useMemo(() => {
    const dates = rows.map((row) => dateText(row.entry_date)).filter(Boolean).sort();
    return { min: dates[0] ?? "", max: dates[dates.length - 1] ?? "" };
  }, [rows]);

  useEffect(() => {
    if (!rows.length) return;
    setDateFrom((current) => current || entryDateBounds.min);
    setDateTo((current) => current || entryDateBounds.max);
  }, [rows, entryDateBounds.min, entryDateBounds.max]);

  const entryExcelColumnValues = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    const baseRows = rows.filter((row) => {
      const lot = rowLot(row);
      const entryDate = dateText(row.entry_date);
      if (dateFrom && entryDate < dateFrom) return false;
      if (dateTo && entryDate > dateTo) return false;
      if (activeEditedLotSet && !activeEditedLotSet.has(lot)) return false;
      if (!query) return true;
      return ENTRY_COLUMNS.some((column) =>
        text(row[column.key])
          .toLocaleLowerCase("es")
          .includes(query)
      );
    });

    const values: Partial<Record<keyof CmEntryDateRow, string[]>> = {};
    ENTRY_COLUMNS.forEach((column) => {
      values[column.key] = baseRows.map((row) =>
        excelFilterValue(
          row[column.key],
          column.kind
        )
      );
    });
    return values;
  }, [rows, search, dateFrom, dateTo, activeEditedLotSet]);

  useEffect(() => {
    setPage(1);
  }, [search, dateFrom, dateTo, showEditedOnly, sortKey, sortDirection, columnFilters]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    const matching = rows.filter((row) => {
      const lot = rowLot(row);
      const entryDate = dateText(row.entry_date);
      if (dateFrom && entryDate < dateFrom) return false;
      if (dateTo && entryDate > dateTo) return false;
      if (activeEditedLotSet && !activeEditedLotSet.has(lot)) return false;
      if (
        query &&
        !ENTRY_COLUMNS.some((column) =>
          text(row[column.key])
            .toLocaleLowerCase("es")
            .includes(query)
        )
      ) {
        return false;
      }

      return (
        Object.entries(columnFilters) as Array<
          [keyof CmEntryDateRow, ExcelColumnFilter]
        >
      ).every(([columnKey, filter]) => {
        const kind = ENTRY_COLUMNS.find((item) => item.key === columnKey)?.kind ?? "text";
        return matchesExcelFilter(
          excelFilterValue(row[columnKey], kind),
          filter,
          kind
        );
      });
    });

    const sortColumn =
      ENTRY_COLUMNS.find((item) => item.key === sortKey) ?? ENTRY_COLUMNS[0];
    return matching
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {

        if (!hasManualSort) {
          const leftPending = !dateText(left.row.entry_date_2);
          const rightPending = !dateText(right.row.entry_date_2);
          if (leftPending !== rightPending) return leftPending ? -1 : 1;
        }

        const leftValue = left.row[sortColumn.key];
        const rightValue = right.row[sortColumn.key];
        let result = 0;

        if (sortColumn.kind === "number") {
          const a = Number(leftValue);
          const b = Number(rightValue);
          const validA = Number.isFinite(a);
          const validB = Number.isFinite(b);
          result = validA && validB ? a - b : validA ? -1 : validB ? 1 : 0;
        } else {
          result = text(leftValue).localeCompare(text(rightValue), "es", {
            numeric: true,
            sensitivity: "base",
          });
        }

        if (result === 0) result = left.index - right.index;
        return sortDirection === "asc" ? result : -result;
      })
      .map(({ row }) => row);
  }, [
    rows,
    search,
    dateFrom,
    dateTo,
    activeEditedLotSet,
    hasManualSort,
    sortKey,
    sortDirection,
    columnFilters,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const visibleRows = filteredRows.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const editedMappingKeys = useMemo(
    () =>
      Array.from(
        new Set(
          mappingRows
            .map(mappingKey)
            .filter(Boolean)
        )
      ).filter(
        (key) =>
          !sameMappingDraft(
            mappingDrafts[key],
            mappingOriginals[key]
          )
      ),
    [mappingRows, mappingDrafts, mappingOriginals]
  );

  const editedMappingSet = useMemo(
    () => new Set(editedMappingKeys),
    [editedMappingKeys]
  );

  const mappingDraftErrors = useMemo(() => {
    const errors = new Map<string, string>();
    editedMappingKeys.forEach((key) => {
      const error = mappingDraftError(mappingDrafts[key]);
      if (error) errors.set(key, error);
    });
    return errors;
  }, [editedMappingKeys, mappingDrafts]);

  const invalidEditedMappingKeys = useMemo(
    () => editedMappingKeys.filter((key) => mappingDraftErrors.has(key)),
    [editedMappingKeys, mappingDraftErrors]
  );

  const mappingExcelColumnValues = useMemo(() => {
    const query = mappingSearch.trim().toLocaleLowerCase("es");
    const baseRows = mappingRows.filter((row) => {
      if (!query) return true;
      const key = mappingKey(row);
      const draft = mappingDrafts[key] ?? toMappingDraft(row);
      return MAPPING_COLUMNS.some((column) =>
        text(mappingColumnValue(row, column.key, draft))
          .toLocaleLowerCase("es")
          .includes(query)
      );
    });

    const values: Partial<Record<keyof RucConMapRow, string[]>> = {};
    MAPPING_COLUMNS.forEach((column) => {
      values[column.key] = baseRows.map((row) => {
        const draft = mappingDrafts[mappingKey(row)] ?? toMappingDraft(row);
        return excelFilterValue(
          mappingColumnValue(row, column.key, draft),
          "text"
        );
      });
    });
    return values;
  }, [mappingRows, mappingSearch, mappingDrafts]);

  const filteredMappingRows = useMemo(() => {
    const query = mappingSearch.trim().toLocaleLowerCase("es");
    return mappingRows
      .filter((row) => {
        const key = mappingKey(row);
        const draft = mappingDrafts[key] ?? toMappingDraft(row);
        if (
          query &&
          !MAPPING_COLUMNS.some((column) =>
            text(mappingColumnValue(row, column.key, draft))
              .toLocaleLowerCase("es")
              .includes(query)
          )
        ) {
          return false;
        }

        return (
          Object.entries(mappingColumnFilters) as Array<
            [keyof RucConMapRow, ExcelColumnFilter]
          >
        ).every(([columnKey, filter]) =>
          matchesExcelFilter(
            excelFilterValue(mappingColumnValue(row, columnKey, draft), "text"),
            filter,
            "text"
          )
        );
      })
      .sort((left, right) => {

        if (!hasMappingManualSort) {
          const leftPending = !text(left.office_name).trim();
          const rightPending = !text(right.office_name).trim();
          if (leftPending !== rightPending) return leftPending ? -1 : 1;
        }

        const result = text(
          left[mappingSortKey]
        ).localeCompare(
          text(right[mappingSortKey]),
          "es",
          {
            numeric: true,
            sensitivity: "base",
          }
        );
        return mappingSortDirection === "asc" ? result : -result;
      });
  }, [
    mappingRows,
    mappingSearch,
    mappingDrafts,
    editedMappingSet,
    hasMappingManualSort,
    mappingColumnFilters,
    mappingSortKey,
    mappingSortDirection,
  ]);

  useEffect(() => {
    setMappingPage(1);
  }, [mappingSearch, mappingColumnFilters, mappingSortKey, mappingSortDirection]);

  const mappingTotalPages = Math.max(
    1,
    Math.ceil(filteredMappingRows.length / PAGE_SIZE)
  );
  const safeMappingPage = Math.min(mappingPage, mappingTotalPages);
  const mappingPageStart = (safeMappingPage - 1) * PAGE_SIZE;
  const visibleMappingRows = filteredMappingRows.slice(
    mappingPageStart,
    mappingPageStart + PAGE_SIZE
  );

  useEffect(() => {
    if (mappingPage > mappingTotalPages) setMappingPage(mappingTotalPages);
  }, [mappingPage, mappingTotalPages]);

  function onSort(column: EntryColumn) {
    setHasManualSort(true);
    if (sortKey === column.key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(column.key);
    setSortDirection("asc");
  }

  function applyColumnFilter(
    key: keyof CmEntryDateRow,
    filter: ExcelColumnFilter
  ) {
    setColumnFilters((current) => {
      const next = { ...current };
      if (excelFilterIsActive(filter)) next[key] = filter;
      else delete next[key];
      return next;
    });
    setPage(1);
  }

  function clearEntryFilters() {
    setColumnFilters({});
    setHasManualSort(false);
    setSortKey("lot");
    setSortDirection("asc");
    setShowEditedOnly(false);
    setPage(1);
  }

  function sortMapping(key: keyof RucConMapRow, direction: SortDirection) {
    setHasMappingManualSort(true);
    setMappingSortKey(key);
    setMappingSortDirection(direction);
    setMappingPage(1);
  }

  function applyMappingColumnFilter(
    key: keyof RucConMapRow,
    filter: ExcelColumnFilter
  ) {
    setMappingColumnFilters((current) => {
      const next = { ...current };
      if (excelFilterIsActive(filter)) next[key] = filter;
      else delete next[key];
      return next;
    });
    setMappingPage(1);
  }

  function clearMappingFilters() {
    setMappingColumnFilters({});
    setHasMappingManualSort(false);
    setMappingSortKey("ruc");
    setMappingSortDirection("asc");
    setMappingPage(1);
  }

  function updateEntryDate(lot: string, value: string) {
    setDraftDates((current) => {
      const normalized = dateText(value);
      const original = dateText(originalDates[lot]);
      const currentValue = dateText(current[lot] ?? original);

      if (currentValue === normalized) {
        return current;
      }

      const next = { ...current };

      if (normalized === original) {
        delete next[lot];
      } else {
        next[lot] = value;
      }

      return next;
    });

    setEntrySaveErrors((current) => {
      if (!current[lot]) return current;
      const next = { ...current };
      delete next[lot];
      return next;
    });
    const error =
      !dateText(value) && dateText(originalDates[lot])
        ? "La fecha de ingreso 2 es obligatoria para guardar esta fila."
        : entryDate2Error(
            value,
            entryRowsByLot.get(lot)?.entry_date,
            maximumEntryDate2
          );
    setMessage(error ? `ERROR: lote ${lot}: ${error}` : null);
  }

  async function updateEntryMapping(
    row: CmEntryDateRow,
    field: keyof MappingDraft,
    value: string
  ) {
    const ruc = mappingKey(row);

    if (!ruc || loading || saving) return;

    const currentDraft = toMappingDraft(row);
    const officeDefaults =
      field === "office_name"
        ? OFFICE_DEFAULTS[value]
        : undefined;

    const nextDraft: MappingDraft = {
      ...currentDraft,
      [field]: value,
      ...(officeDefaults ?? {}),
    };

    const validationError = mappingDraftError(nextDraft);

    if (validationError) {
      setMessage(
        `ERROR: RUC ${ruc}: ${validationError}`
      );
      return;
    }

    const previousRows = rows;

    setRows((current) =>
      current.map((candidate) =>
        mappingKey(candidate) === ruc
          ? {
              ...candidate,
              office_name: optionalText(nextDraft.office_name),
              zone_name: optionalText(nextDraft.zone_name),
              office_code: optionalText(nextDraft.office_code),
            }
          : candidate
      )
    );

    setSaving(true);
    setMessage(null);

    try {
      const response = (await apiPost(
        "/api/traceability/cm/ruccon-map/insert",
        {
          ruc,
          concession_code:
            optionalText(text(row.concession_code)),
          office_name:
            optionalText(nextDraft.office_name),
          zone_name:
            optionalText(nextDraft.zone_name),
          office_code:
            optionalText(nextDraft.office_code),
        }
      )) as SaveResponse;

      if (!response.ok) {
        throw new Error(
          response.error ||
            "No se pudo actualizar el mapping."
        );
      }

      setMappingRows((current) =>
        current.map((candidate) =>
          mappingKey(candidate) === ruc
            ? {
                ...candidate,
                office_name:
                  optionalText(nextDraft.office_name),
                zone_name:
                  optionalText(nextDraft.zone_name),
                office_code:
                  optionalText(nextDraft.office_code),
              }
            : candidate
        )
      );

      setMappingDrafts((current) =>
        current[ruc]
          ? {
              ...current,
              [ruc]: { ...nextDraft },
            }
          : current
      );

      setMappingOriginals((current) =>
        current[ruc]
          ? {
              ...current,
              [ruc]: { ...nextDraft },
            }
          : current
      );

      setMessage(
        `OK: mapping del RUC ${ruc} actualizado.`
      );
    } catch (error: unknown) {
      setRows(previousRows);
      setMessage(
        `ERROR: RUC ${ruc}: ${errorMessage(error)}`
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveEntries() {
    if (!editedLots.length || saving) return;

    const pendingPayloads = editedLots.map((lot) => {
      const row = entryRowsByLot.get(lot);
      const entryDate2 = dateText(draftDates[lot]) || null;
      const error = row
        ? entryDate2
          ? entryDate2Error(entryDate2, row.entry_date, maximumEntryDate2)
          : "La fecha de ingreso 2 es obligatoria para guardar esta fila."
        : "Lote no encontrado.";
      return { lot, entryDate2, entryDate: row?.entry_date, error };
    });
    const invalidPayloads = pendingPayloads.filter((payload) => payload.error);

    if (invalidPayloads.length) {
      const firstInvalid = invalidPayloads[0];
      setMessage(
        `ERROR: no se envió ningún dato. Corrige ${invalidPayloads.length} fila(s) inválida(s). Lote ${firstInvalid.lot}: ${firstInvalid.error}`
      );
      return;
    }
    setSaving(true);
    setMessage(null);
    const failedByLot: Record<string, string> = {};
    const { fulfilled, rejected } = await settleInChunks(
      pendingPayloads,
      async (payload) => {
        try {
          const response = (await apiPost(
            "/api/traceability/cm/entrydate/insert",
            {
              lot: payload.lot,
              entry_date_2: payload.entryDate2,
            }
          )) as SaveResponse;
          if (!response.ok) {
            throw new Error(response.error || "La API rechazó el guardado.");
          }
          return payload.lot;
        } catch (error) {
          const specificError = entrySaveErrorMessage(error);
          failedByLot[payload.lot] = specificError;
          throw new Error(
            specificError.includes(payload.lot)
              ? specificError
              : `Lote ${payload.lot}: ${specificError}`
          );
        }
      }
    );

    setEntrySaveErrors((current) => {
      const next = { ...current };
      fulfilled.forEach((lot) => delete next[lot]);
      Object.entries(failedByLot).forEach(([lot, error]) => {
        next[lot] = error;
      });
      return next;
    });

    if (fulfilled.length) {
      const fulfilledSet = new Set(fulfilled);

      setDraftDates((current) => {
        const next = { ...current };

        fulfilled.forEach((lot) => {
          delete next[lot];
        });

        return next;
      });

      setOriginalDates((current) => {
        const next = { ...current };
        fulfilled.forEach((lot) => {
          next[lot] = dateText(draftDates[lot]);
        });
        return next;
      });
      setRows((current) =>
        current.map((row) => {
          const lot = rowLot(row);
          return fulfilledSet.has(lot)
            ? { ...row, entry_date_2: dateText(draftDates[lot]) || null }
            : row;
        })
      );
    }

    if (!rejected.length) {
      setMessage(`OK: se guardaron ${fulfilled.length} fila(s).`);
    } else if (fulfilled.length) {
      setMessage(
        `PARCIAL: guardadas ${fulfilled.length} fila(s). ${rejected.join(" | ")}`
      );
    } else {
      setMessage(`ERROR: no se pudo guardar ninguna fila. ${rejected.join(" | ")}`);
    }
    setSaving(false);
  }

  function openMapping() {
    setMappingOpen(true);
    setMappingSearch("");
    setMappingMessage(null);
    void loadMapping();
  }

  function updateMapping(key: string, field: keyof MappingDraft, value: string) {
    setMappingDrafts((current) => {
      const currentDraft = current[key] ?? {
        office_name: "",
        zone_name: "",
        office_code: "",
      };
      const officeDefaults = field === "office_name" ? OFFICE_DEFAULTS[value] : undefined;

      return {
        ...current,
        [key]: {
          ...currentDraft,
          [field]: value,
          ...(officeDefaults ?? {}),
        },
      };
    });
    setMappingMessage(null);
  }

  async function saveMapping() {
    if (!editedMappingKeys.length || mappingSaving) return;

    if (invalidEditedMappingKeys.length) {
      const key = invalidEditedMappingKeys[0];
      const row = mappingRows.find((candidate) => mappingKey(candidate) === key);
      setMappingMessage(
        `ERROR: no se envió ningún mapping. ${text(row?.ruc).trim()} / ${text(row?.concession_code).trim()}: ${mappingDraftErrors.get(key)}`
      );
      return;
    }

    setMappingSaving(true);
    setMappingMessage(null);

    const rowsByKey = new Map(
      mappingRows.map((row) => [
        mappingKey(row),
        row,
      ])
    );

    const { fulfilled, rejected } =
      await settleInChunks(
        editedMappingKeys,
        async (key) => {
          const row = rowsByKey.get(key);
          const draft = mappingDrafts[key];
          const ruc = text(row?.ruc).trim();
          const concessionCode =
            text(row?.concession_code).trim();

          if (!row || !draft || !ruc) {
            throw new Error("Mapping sin RUC.");
          }

          const validationError =
            mappingDraftError(draft);

          if (validationError) {
            throw new Error(
              `${ruc}: ${validationError}`
            );
          }

          const response = (await apiPost(
            "/api/traceability/cm/ruccon-map/insert",
            {
              ruc,
              concession_code:
                optionalText(concessionCode),
              office_name:
                optionalText(draft.office_name),
              zone_name:
                optionalText(draft.zone_name),
              office_code:
                optionalText(draft.office_code),
            }
          )) as SaveResponse;

          if (!response.ok) {
            throw new Error(
              `${ruc}: ${
                response.error ||
                "no se pudo guardar"
              }`
            );
          }

          return key;
        }
      );

    if (fulfilled.length) {
      const fulfilledSet = new Set(fulfilled);
      setMappingOriginals((current) => {
        const next = { ...current };
        fulfilled.forEach((key) => {
          next[key] = { ...mappingDrafts[key] };
        });
        return next;
      });
      setMappingRows((current) =>
        current.map((row) => {
          const key = mappingKey(row);
          if (!fulfilledSet.has(key)) return row;
          const draft = mappingDrafts[key];
          return {
            ...row,
            office_name: optionalText(draft.office_name),
            zone_name: optionalText(draft.zone_name),
            office_code: optionalText(draft.office_code),
          };
        })
      );
    }

    if (!rejected.length) {
      setMappingMessage(`OK: se actualizaron ${fulfilled.length} mapping(s).`);
    } else if (fulfilled.length) {
      setMappingMessage(
        `PARCIAL: actualizados ${fulfilled.length} mapping(s). ${rejected.join(" | ")}`
      );
    } else {
      setMappingMessage(`ERROR: no se pudo actualizar ningún mapping. ${rejected.join(" | ")}`);
    }
    setMappingSaving(false);
  }

  function exportMappingExcel() {
    if (!mappingRows.length) {
      setMappingMessage(
        "ERROR: no hay mappings cargados para exportar."
      );
      return;
    }

    try {
      const exportRows = mappingRows.map(
        (row) => ({
          ruc: text(row.ruc).trim(),
          concession_code:
            text(row.concession_code).trim(),
          office_name:
            text(row.office_name).trim(),
          zone_name:
            text(row.zone_name).trim(),
          office_code:
            text(row.office_code).trim(),
        })
      );

      const worksheet =
        XLSX.utils.json_to_sheet(exportRows);

      worksheet["!cols"] = [
        { wch: 16 },
        { wch: 22 },
        { wch: 22 },
        { wch: 18 },
        { wch: 18 },
      ];

      worksheet["!autofilter"] = {
        ref: worksheet["!ref"] ?? "A1:E1",
      };

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Mapping"
      );

      XLSX.writeFile(
        workbook,
        `trazabilidad_cm_mapping_${todayInLima()}.xlsx`
      );

      setMappingMessage(
        `OK: se exportaron ${exportRows.length} fila(s).`
      );
    } catch (error: unknown) {
      setMappingMessage(
        `ERROR: no se pudo exportar el mapping. ${errorMessage(error)}`
      );
    }
  }

  async function importMappingExcel(
    file: File
  ) {
    if (mappingSaving || mappingLoading) return;

    setMappingSaving(true);
    setMappingMessage(null);

    try {
      const workbook = XLSX.read(
        await file.arrayBuffer(),
        {
          type: "array",
        }
      );

      const sheetName =
        workbook.SheetNames[0];

      const worksheet =
        workbook.Sheets[sheetName];

      if (!worksheet) {
        throw new Error(
          "El Excel no contiene una hoja válida."
        );
      }

      const matrix =
        XLSX.utils.sheet_to_json<unknown[]>(
          worksheet,
          {
            header: 1,
            defval: "",
          }
        );

      const headers = (
        matrix[0] ?? []
      ).map((value) =>
        text(value).trim()
      );

      const expectedHeaders = [
        "ruc",
        "concession_code",
        "office_name",
        "zone_name",
        "office_code",
      ];

      if (
        headers.length !==
          expectedHeaders.length ||
        expectedHeaders.some(
          (header, index) =>
            headers[index] !== header
        )
      ) {
        throw new Error(
          "La estructura debe ser exactamente: ruc, concession_code, office_name, zone_name, office_code."
        );
      }

      const excelRows =
        XLSX.utils.sheet_to_json<
          Record<string, unknown>
        >(worksheet, {
          defval: "",
          raw: false,
        });

      const importRows = excelRows
        .map((row) => ({
          ruc: text(row.ruc).trim(),
          concession_code:
            text(row.concession_code).trim() ||
            null,
          office_name:
            text(row.office_name).trim() ||
            null,
          zone_name:
            text(row.zone_name).trim() ||
            null,
          office_code:
            text(row.office_code).trim() ||
            null,
        }))
        .filter(
          (row) =>
            row.ruc ||
            row.concession_code ||
            row.office_name ||
            row.zone_name ||
            row.office_code
        );

      if (!importRows.length) {
        throw new Error(
          "El Excel no contiene filas para importar."
        );
      }

      const response = (await apiPost(
        "/api/traceability/cm/ruccon-map/import",
        {
          rows: importRows,
        }
      )) as SaveResponse & {
        imported_rucs?: number;
        rows_received?: number;
      };

      if (!response.ok) {
        throw new Error(
          response.error ||
            "No se pudo importar el mapping."
        );
      }

      await Promise.all([
        loadMapping(),
        loadEntries(),
      ]);

      setMappingMessage(
        `OK: se importaron ${
          response.imported_rucs ??
          importRows.length
        } RUC(s).`
      );
    } catch (error: unknown) {
      setMappingMessage(
        `ERROR: ${errorMessage(error)}`
      );
    } finally {
      setMappingSaving(false);

      if (mappingImportInputRef.current) {
        mappingImportInputRef.current.value =
          "";
      }
    }
  }

  function exportEntriesExcel() {
    if (!rows.length) {
      setMessage("ERROR: no hay filas cargadas para exportar.");
      return;
    }

    try {
      const exportRows = rows.map((row) => ({
        Lote: text(row.lot).trim(),
        "F. ingreso": excelDate(row.entry_date),
        "F. ingreso 2": excelDate(row.entry_date_2),
        Sacos: excelNumber(row.sack_qty),
        Minero: row.miner_name ?? "",
        Placa: row.plate ?? "",
        RUC: row.ruc ?? "",
        Concesión: row.concession_name ?? "",
        "Cód. concesión": row.concession_code ?? "",
        Distrito: row.district ?? "",
        Provincia: row.province ?? "",
        Departamento: row.department ?? "",
        "Guía remitente": row.sender_guide_number ?? "",
        Transportista: row.transport_name ?? "",
        "Guía transportista": row.transport_guide_number ?? "",
        TMH: excelNumber(row.tmh),
        TMS: excelNumber(row.tms),
      }));
      const worksheet = XLSX.utils.json_to_sheet(exportRows, { cellDates: true });

      exportRows.forEach((_, index) => {
        const excelRow = index + 2;
        if (worksheet[`B${excelRow}`]) worksheet[`B${excelRow}`].z = "dd/mm/yyyy";
        if (worksheet[`C${excelRow}`]) worksheet[`C${excelRow}`].z = "dd/mm/yyyy";
        if (worksheet[`D${excelRow}`]) worksheet[`D${excelRow}`].z = "#,##0";
        if (worksheet[`P${excelRow}`]) worksheet[`P${excelRow}`].z = "#,##0.000";
        if (worksheet[`Q${excelRow}`]) worksheet[`Q${excelRow}`].z = "#,##0.000";
      });

      worksheet["!cols"] = [
        { wch: 14 },
        { wch: 13 },
        { wch: 13 },
        { wch: 10 },
        { wch: 34 },
        { wch: 18 },
        { wch: 16 },
        { wch: 34 },
        { wch: 20 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 20 },
        { wch: 34 },
        { wch: 22 },
        { wch: 14 },
        { wch: 14 },
      ];
      worksheet["!autofilter"] = { ref: worksheet["!ref"] ?? "A1:Q1" };

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "CM Inputs");
      XLSX.writeFile(workbook, `trazabilidad_cm_inputs_${todayInLima()}.xlsx`, {
        cellDates: true,
      });
      setMessage(`OK: se exportaron ${exportRows.length} fila(s) a Excel.`);
    } catch (error: unknown) {
      setMessage(`ERROR: no se pudo exportar a Excel. ${errorMessage(error)}`);
    }
  }

  const inputStyle: React.CSSProperties = {
    border: "1px solid rgba(216,238,255,.18)",
    background: "rgba(0,0,0,.10)",
    color: "white",
    fontWeight: 600,
    padding: "6px 8px",
    borderRadius: 6,
    outline: "none",
    fontSize: 12,
    lineHeight: "14px",
    boxSizing: "border-box",
  };

  const cellStyle: React.CSSProperties = {
    padding: "6px 8px",
    fontSize: 12,
    lineHeight: "16px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    boxSizing: "border-box",
    borderRight: "1px solid rgba(216,238,255,.10)",
    borderBottom: "1px solid rgba(216,238,255,.08)",
  };

  const messageSuccess = (value: string | null) =>
    Boolean(value?.startsWith("OK") || value?.startsWith("PARCIAL"));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: message
          ? "auto auto minmax(0, 1fr) auto"
          : "auto minmax(0, 1fr) auto",
        gap: 10,
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        className="panel-inner"
        style={{
          padding: "10px 12px",
          display: "flex",
          alignItems: "end",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ alignSelf: "center", fontWeight: 700 }}>Trazabilidad · CM Inputs</div>

        <button
          type="button"
          onClick={() => setShowEditedOnly((current) => !current)}
          style={{
            alignSelf: "center",
            padding: "6px 10px",
            borderRadius: 999,
            border: showEditedOnly
              ? "1px solid rgba(147,178,92,.90)"
              : "1px solid rgba(147,178,92,.45)",
            background: editedLots.length
              ? "rgba(94,128,25,.24)"
              : "rgba(255,255,255,.06)",
            color: editedLots.length ? "rgb(174,202,125)" : "rgba(255,255,255,.8)",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Editadas: {editedLots.length}
        </button>

        {invalidEditedLots.length ? (
          <div
            role="status"
            style={{
              alignSelf: "center",
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(216,93,39,.55)",
              background: "rgba(216,93,39,.18)",
              color: "rgb(255,178,143)",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Inválidas: {invalidEditedLots.length}
          </div>
        ) : null}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600 }}>F. ingreso desde</span>
            <input
              type="date"
              value={dateFrom}
              min={entryDateBounds.min || undefined}
              max={dateTo || entryDateBounds.max || undefined}
              onChange={(event) => setDateFrom(event.target.value)}
              style={{ ...inputStyle, colorScheme: "dark" }}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600 }}>F. ingreso hasta</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || entryDateBounds.min || undefined}
              max={entryDateBounds.max || undefined}
              onChange={(event) => setDateTo(event.target.value)}
              style={{ ...inputStyle, colorScheme: "dark" }}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600 }}>Buscador global</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Lote, minero, RUC, concesión, placa..."
              style={{ ...inputStyle, minWidth: 270 }}
            />
          </label>

          <Button
            type="button"
            size="sm"
            onClick={clearEntryFilters}
            disabled={
              loading ||
              saving ||
              (!Object.keys(columnFilters).length && !hasManualSort && !showEditedOnly)
            }
          >
            Limpiar filtros
          </Button>
          <Button type="button" size="sm" onClick={() => void loadEntries()} disabled={loading || saving}>
            {loading ? "Cargando…" : "Refrescar"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={exportEntriesExcel}
            disabled={loading || saving || mappingSaving || rows.length === 0}
          >
            Exportar Excel
          </Button>
          <Button type="button" size="sm" onClick={openMapping} disabled={mappingSaving}>
            Actualizar mapeo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => void saveEntries()}
            disabled={
              loading || saving || editedLots.length === 0 || invalidEditedLots.length > 0
            }
            title={
              invalidEditedLots.length
                ? "Corrige las fechas inválidas antes de guardar."
                : undefined
            }
          >
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      {message ? (
        <div
          role={messageSuccess(message) ? "status" : "alert"}
          className="panel-inner"
          style={{
            padding: 10,
            border: messageSuccess(message)
              ? "1px solid rgba(62,180,137,.45)"
              : "1px solid rgba(216,93,39,.45)",
            background: messageSuccess(message)
              ? "rgba(62,180,137,.10)"
              : "rgba(216,93,39,.10)",
            fontWeight: 600,
          }}
        >
          {message}
        </div>
      ) : null}

      <div
        className="panel-inner"
        style={{ minWidth: 0, minHeight: 0, overflow: "auto", padding: 0 }}
      >
        <div style={{ minWidth: "max-content" }}>
          <Table stickyHeader disableScrollWrapper>
            <colgroup>
              {ENTRY_COLUMNS.map((column) => (
                <col key={column.key} style={{ width: column.width, minWidth: column.width, maxWidth: column.width }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {ENTRY_COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    className="capex-th"
                    tabIndex={0}
                    aria-sort={hasManualSort && sortKey === column.key ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    onClick={() => onSort(column)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSort(column);
                      }
                    }}
                    style={{
                      padding: "8px",
                      width: column.width,
                      minWidth: column.width,
                      maxWidth: column.width,
                      background: "rgb(20, 52, 68)",
                      borderRight: "1px solid rgba(216,238,255,.14)",
                      textAlign: column.kind === "number" ? "right" : "left",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 5 }}>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {column.label}
                        {hasManualSort && sortKey === column.key
                          ? sortDirection === "asc"
                            ? " ↑"
                            : " ↓"
                          : ""}
                      </span>
                      <ExcelHeaderFilter
                        label={column.label}
                        kind={column.kind}
                        values={entryExcelColumnValues[column.key] ?? []}
                        filter={columnFilters[column.key]}
                        sortDirection={
                          hasManualSort && sortKey === column.key
                            ? sortDirection
                            : undefined
                        }
                        onApply={(filter) => applyColumnFilter(column.key, filter)}
                        onSort={(direction) => {
                          setHasManualSort(true);
                          setSortKey(column.key);
                          setSortDirection(direction);
                          setPage(1);
                        }}
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const lot = rowLot(row);
                const edited = editedLotSet.has(lot);
                const dateError = entryDate2Errors.get(lot);
                return (
                  <tr key={lot} className="capex-tr">
                    {ENTRY_COLUMNS.map((column) => (
                      <td
                        key={column.key}
                        className={`capex-td${column.key === "lot" ? " capex-td-strong" : ""}`}
                        title={column.key === "entry_date_2" ? undefined : text(row[column.key])}
                        style={{
                          ...cellStyle,
                          background: dateError
                            ? "rgba(216,93,39,.25)"
                            : edited
                              ? "rgba(94,128,25,.28)"
                              : "rgba(0,0,0,.10)",
                          textAlign: column.kind === "number" ? "right" : "left",
                        }}
                      >
                        {column.key === "entry_date_2" ? (
                          <input
                            key={`${lot}:${originalDates[lot] ?? ""}`}
                            type="date"
                            inputMode="text"
                            defaultValue={
                              draftDates[lot] ??
                              originalDates[lot] ??
                              ""
                            }
                            min={dateText(row.entry_date) || undefined}
                            max={maximumEntryDate2}
                            onChange={(event) => {
                              const value = event.currentTarget.value;

                              React.startTransition(() => {
                                updateEntryDate(lot, value);
                              });
                            }}
                            onBlur={(event) =>
                              updateEntryDate(
                                lot,
                                event.currentTarget.value
                              )
                            }
                            disabled={loading || saving || !lot}
                            aria-label={`Fecha de ingreso 2 del lote ${lot}`}
                            aria-invalid={Boolean(dateError)}
                            title={
                              dateError ??
                              `Rango permitido: ${displayDate(row.entry_date)} a ${displayDate(maximumEntryDate2)}`
                            }
                            style={{
                              ...inputStyle,
                              colorScheme: "dark",
                              width: "100%",
                              minWidth: 0,
                              borderColor: dateError
                                ? "rgba(216,93,39,.90)"
                                : undefined,
                              background: dateError
                                ? "rgba(216,93,39,.12)"
                                : undefined,
                            }}
                          />
                        ) : column.key === "office_name" ||
                          column.key === "zone_name" ||
                          column.key === "office_code" ? (
                          <select
                            value={
                              toMappingDraft(row)[column.key]
                            }
                            onChange={(event) =>
                              void updateEntryMapping(
                                row,
                                column.key as keyof MappingDraft,
                                event.target.value
                              )
                            }
                            disabled={
                              loading ||
                              saving ||
                              !mappingKey(row)
                            }
                            aria-label={`${column.label} para RUC ${text(row.ruc)}`}
                            style={{
                              ...inputStyle,
                              width: "100%",
                              minWidth: 0,
                            }}
                          >
                            <option value="">
                              — Seleccionar —
                            </option>

                            {toMappingDraft(row)[column.key] &&
                            !MAPPING_OPTIONS[column.key].includes(
                              toMappingDraft(row)[column.key]
                            ) ? (
                              <option
                                value={
                                  toMappingDraft(row)[column.key]
                                }
                              >
                                {toMappingDraft(row)[column.key]}
                              </option>
                            ) : null}

                            {MAPPING_OPTIONS[column.key].map(
                              (option) => (
                                <option
                                  key={option}
                                  value={option}
                                >
                                  {option}
                                </option>
                              )
                            )}
                          </select>
                        ) : (
                          displayValue(
                            row[column.key],
                            column.kind
                          )
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}

              {!loading && visibleRows.length === 0 ? (
                <tr className="capex-tr">
                  <td className="capex-td" colSpan={ENTRY_COLUMNS.length} style={{ ...cellStyle, fontWeight: 700 }}>
                    No hay filas para el filtro seleccionado.
                  </td>
                </tr>
              ) : null}

              {loading ? (
                <tr className="capex-tr">
                  <td className="capex-td" colSpan={ENTRY_COLUMNS.length} style={{ ...cellStyle, fontWeight: 700 }}>
                    Cargando CM Inputs…
                  </td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </div>

      <div
        className="panel-inner"
        style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}
      >
        <div style={{ fontSize: 12, fontWeight: 600 }}>
          Mostrando {filteredRows.length ? pageStart + 1 : 0} - {Math.min(pageStart + PAGE_SIZE, filteredRows.length)} de {filteredRows.length} filas
        </div>
        <Pager
          page={safePage}
          totalPages={totalPages}
          onPrev={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
          disabled={loading}
        />
      </div>

      {mappingOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cm-mapping-title"
          style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,.58)" }}
        >
          <div
            className="panel-inner"
            style={{ width: "min(1050px, 96vw)", height: "min(86vh, 820px)", display: "grid", gridTemplateRows: "auto auto auto minmax(0, 1fr) auto", gap: 12, padding: 14, overflow: "hidden" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div id="cm-mapping-title" style={{ fontSize: 18, fontWeight: 700 }}>Actualizar mapeo CM</div>
                <div style={{ fontSize: 12, opacity: .82 }}>El mapping se asigna por RUC. El código de concesión es informativo; oficina, zona y código de oficina se aplican a todas las concesiones del mismo RUC.</div>
              </div>
              <Button type="button" size="sm" onClick={() => setMappingOpen(false)} disabled={mappingSaving}>Cerrar</Button>
            </div>

            <div style={{ display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap" }}>
              <label style={{ display: "grid", gap: 4, flex: "1 1 320px" }}>
                <span style={{ fontSize: 11, fontWeight: 600 }}>Buscador global</span>
                <input type="search" value={mappingSearch} onChange={(event) => setMappingSearch(event.target.value)} placeholder="RUC, concesión, oficina, zona..." style={{ ...inputStyle, width: "100%" }} />
              </label>
              <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(147,178,92,.45)", background: editedMappingKeys.length ? "rgba(94,128,25,.24)" : "rgba(255,255,255,.06)", color: editedMappingKeys.length ? "rgb(174,202,125)" : "rgba(255,255,255,.8)", fontSize: 12, fontWeight: 700 }}>
                Editadas: {editedMappingKeys.length}
              </div>
              {invalidEditedMappingKeys.length ? (
                <div role="status" style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(216,93,39,.55)", background: "rgba(216,93,39,.18)", color: "rgb(255,178,143)", fontSize: 12, fontWeight: 700 }}>
                  Inválidas: {invalidEditedMappingKeys.length}
                </div>
              ) : null}
              <Button
                type="button"
                size="sm"
                onClick={clearMappingFilters}
                disabled={
                  mappingLoading ||
                  mappingSaving ||
                  (!Object.keys(mappingColumnFilters).length && !hasMappingManualSort)
                }
              >
                Limpiar filtros
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={exportMappingExcel}
                disabled={
                  mappingLoading ||
                  mappingSaving ||
                  mappingRows.length === 0
                }
              >
                Exportar Excel
              </Button>

              <input
                ref={mappingImportInputRef}
                type="file"
                accept=".xlsx,.xls"
                hidden
                onChange={(event) => {
                  const file =
                    event.target.files?.[0];

                  if (file) {
                    void importMappingExcel(file);
                  }
                }}
              />

              <Button
                type="button"
                size="sm"
                onClick={() =>
                  mappingImportInputRef.current?.click()
                }
                disabled={
                  mappingLoading ||
                  mappingSaving
                }
              >
                Importar Excel
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => void loadMapping()}
                disabled={
                  mappingLoading ||
                  mappingSaving
                }
              >
                {mappingLoading
                  ? "Cargando…"
                  : "Refrescar"}
              </Button>
            </div>

            {mappingMessage ? (
              <div role={messageSuccess(mappingMessage) ? "status" : "alert"} style={{ padding: 10, borderRadius: 10, border: messageSuccess(mappingMessage) ? "1px solid rgba(62,180,137,.45)" : "1px solid rgba(216,93,39,.45)", background: messageSuccess(mappingMessage) ? "rgba(62,180,137,.10)" : "rgba(216,93,39,.10)", fontWeight: 600 }}>
                {mappingMessage}
              </div>
            ) : (
              <div style={{ fontSize: 12, fontWeight: 600, opacity: .82 }}>Solo se enviarán las filas modificadas.</div>
            )}

            <div style={{ minWidth: 0, minHeight: 0, overflow: "auto", border: "1px solid rgba(216,238,255,.12)", borderRadius: 10 }}>
              <Table stickyHeader disableScrollWrapper>
                <colgroup>
                  {MAPPING_COLUMNS.map((column) => <col key={column.key} style={{ width: column.width, minWidth: column.width, maxWidth: column.width }} />)}
                </colgroup>
                <thead>
                  <tr>
                    {MAPPING_COLUMNS.map((column) => (
                      <th
                        key={column.key}
                        className="capex-th"
                        aria-sort={
                          hasMappingManualSort && mappingSortKey === column.key
                            ? mappingSortDirection === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        style={{ top: 0, zIndex: 20, width: column.width, background: "rgb(20, 52, 68)", padding: 9, borderRight: "1px solid rgba(216,238,255,.14)" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 5 }}>
                          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {column.label}
                            {hasMappingManualSort && mappingSortKey === column.key
                              ? mappingSortDirection === "asc"
                                ? " ↑"
                                : " ↓"
                              : ""}
                          </span>
                          <ExcelHeaderFilter
                            label={column.label}
                            kind="text"
                            values={mappingExcelColumnValues[column.key] ?? []}
                            filter={mappingColumnFilters[column.key]}
                            sortDirection={
                              hasMappingManualSort && mappingSortKey === column.key
                                ? mappingSortDirection
                                : undefined
                            }
                            onApply={(filter) => applyMappingColumnFilter(column.key, filter)}
                            onSort={(direction) => sortMapping(column.key, direction)}
                          />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleMappingRows.map((row) => {
                    const key = mappingKey(row);
                    const draft = mappingDrafts[key] ?? toMappingDraft(row);
                    const edited = editedMappingSet.has(key);
                    const draftError = mappingDraftErrors.get(key);
                    return (
                      <tr key={mappingRowKey(row)} className="capex-tr">
                        {MAPPING_COLUMNS.map((column) => {
                          const field = column.key as keyof MappingDraft;
                          const value = column.editable ? draft[field] : "";
                          const options = column.editable ? MAPPING_OPTIONS[field] : [];
                          const unsupportedValue = Boolean(value) && !options.includes(value);

                          return (
                            <td
                              key={column.key}
                              className={`capex-td${!column.editable ? " capex-td-strong" : ""}`}
                              title={draftError ?? undefined}
                              style={{
                                ...cellStyle,
                                background: draftError
                                  ? "rgba(216,93,39,.25)"
                                  : edited
                                    ? "rgba(94,128,25,.28)"
                                    : "rgba(0,0,0,.10)",
                              }}
                            >
                              {column.editable ? (
                                <select
                                  value={value}
                                  onChange={(event) => updateMapping(key, field, event.target.value)}
                                  disabled={mappingLoading || mappingSaving}
                                  aria-label={`${column.label} para ${text(row.ruc)} / ${text(row.concession_code)}`}
                                  aria-invalid={Boolean(draftError)}
                                  style={{
                                    ...inputStyle,
                                    width: "100%",
                                    minWidth: 0,
                                    borderColor: draftError ? "rgba(216,93,39,.90)" : undefined,
                                    background: draftError ? "rgba(216,93,39,.12)" : undefined,
                                  }}
                                >
                                  <option value="" disabled>— Seleccionar —</option>
                                  {unsupportedValue ? (
                                    <option value={value} disabled>{value} (no permitido)</option>
                                  ) : null}
                                  {options.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                  ))}
                                </select>
                              ) : (
                                <span title={text(row[column.key])}>{text(row[column.key]).trim() || "—"}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {!mappingLoading && visibleMappingRows.length === 0 ? (
                    <tr className="capex-tr"><td className="capex-td" colSpan={MAPPING_COLUMNS.length} style={{ ...cellStyle, fontWeight: 700 }}>No hay mappings para el filtro seleccionado.</td></tr>
                  ) : null}
                  {mappingLoading ? (
                    <tr className="capex-tr"><td className="capex-td" colSpan={MAPPING_COLUMNS.length} style={{ ...cellStyle, fontWeight: 700 }}>Cargando mapping…</td></tr>
                  ) : null}
                </tbody>
              </Table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Mostrando {filteredMappingRows.length ? mappingPageStart + 1 : 0} - {Math.min(mappingPageStart + PAGE_SIZE, filteredMappingRows.length)} de {filteredMappingRows.length}</span>
                <Button type="button" size="sm" onClick={() => setMappingPage((current) => Math.max(1, current - 1))} disabled={mappingLoading || safeMappingPage <= 1}>←</Button>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Página {safeMappingPage} / {mappingTotalPages}</span>
                <Button type="button" size="sm" onClick={() => setMappingPage((current) => Math.min(mappingTotalPages, current + 1))} disabled={mappingLoading || safeMappingPage >= mappingTotalPages}>→</Button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button type="button" size="sm" onClick={() => setMappingOpen(false)} disabled={mappingSaving}>Cancelar</Button>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => void saveMapping()}
                  disabled={
                    mappingLoading ||
                    mappingSaving ||
                    editedMappingKeys.length === 0 ||
                    invalidEditedMappingKeys.length > 0
                  }
                  title={
                    invalidEditedMappingKeys.length
                      ? "Corrige los mappings marcados en rojo antes de guardar."
                      : undefined
                  }
                >
                  {mappingSaving ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
