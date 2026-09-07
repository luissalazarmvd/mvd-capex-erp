"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../../lib/apiClient";
import { Button } from "../ui/Button";
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
  maxLength?: number;
};

type SortDirection = "asc" | "desc";

const PAGE_SIZE = 100;
const SAVE_CONCURRENCY = 20;
const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

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
  { key: "office_name", label: "Oficina", editable: true, width: 210, maxLength: 50 },
  { key: "zone_name", label: "Zona", editable: true, width: 180, maxLength: 20 },
  { key: "office_code", label: "Cód. oficina", editable: true, width: 180, maxLength: 50 },
];

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
});

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function dateText(value: unknown) {
  const normalized = text(value).trim();
  const match = normalized.match(ISO_DATE_PREFIX);
  return match?.[0] ?? normalized;
}

function displayValue(value: unknown, kind: EntryColumn["kind"]) {
  if (kind === "date") return dateText(value) || "—";
  if (kind === "number") {
    if (value === null || value === undefined || text(value).trim() === "") return "—";
    const parsed = Number(value);
    return Number.isFinite(parsed) ? numberFormatter.format(parsed) : text(value);
  }
  return text(value).trim() || "—";
}

function rowLot(row: CmEntryDateRow) {
  return text(row.lot).trim();
}

function mappingKey(row: Pick<RucConMapRow, "ruc" | "concession_code">) {
  return `${text(row.ruc).trim()}\u001f${text(row.concession_code).trim()}`;
}

function toMappingDraft(row: RucConMapRow): MappingDraft {
  return {
    office_name: text(row.office_name),
    zone_name: text(row.zone_name),
    office_code: text(row.office_code),
  };
}

function sameMappingDraft(left: MappingDraft | undefined, right: MappingDraft | undefined) {
  if (!left || !right) return true;
  return (
    left.office_name === right.office_name &&
    left.zone_name === right.zone_name &&
    left.office_code === right.office_code
  );
}

function optionalText(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showEditedOnly, setShowEditedOnly] = useState(false);
  const [sortKey, setSortKey] = useState<keyof CmEntryDateRow>("lot");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);

  const [mappingOpen, setMappingOpen] = useState(false);
  const [mappingRows, setMappingRows] = useState<RucConMapRow[]>([]);
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, MappingDraft>>({});
  const [mappingOriginals, setMappingOriginals] = useState<Record<string, MappingDraft>>({});
  const [mappingLoading, setMappingLoading] = useState(false);
  const [mappingSaving, setMappingSaving] = useState(false);
  const [mappingMessage, setMappingMessage] = useState<string | null>(null);
  const [mappingSearch, setMappingSearch] = useState("");
  const [mappingPage, setMappingPage] = useState(1);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = (await apiGet(
        "/api/traceability/cm/entrydate"
      )) as GetResponse<CmEntryDateRow>;
      const nextRows = Array.isArray(response.rows) ? response.rows : [];
      const nextDrafts: Record<string, string> = {};
      const nextOriginals: Record<string, string> = {};

      nextRows.forEach((row) => {
        const lot = rowLot(row);
        if (!lot) return;
        const value = dateText(row.entry_date_2);
        nextDrafts[lot] = value;
        nextOriginals[lot] = value;
      });

      setRows(nextRows);
      setDraftDates(nextDrafts);
      setOriginalDates(nextOriginals);
      setShowEditedOnly(false);
      setPage(1);
    } catch (error: unknown) {
      setRows([]);
      setDraftDates({});
      setOriginalDates({});
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

  const editedLots = useMemo(
    () =>
      rows
        .map(rowLot)
        .filter(
          (lot) => lot && dateText(draftDates[lot]) !== dateText(originalDates[lot])
        ),
    [rows, draftDates, originalDates]
  );

  const editedLotSet = useMemo(() => new Set(editedLots), [editedLots]);

  const entryDateBounds = useMemo(() => {
    const dates = rows.map((row) => dateText(row.entry_date)).filter(Boolean).sort();
    return { min: dates[0] ?? "", max: dates[dates.length - 1] ?? "" };
  }, [rows]);

  useEffect(() => {
    if (!rows.length) return;
    setDateFrom((current) => current || entryDateBounds.min);
    setDateTo((current) => current || entryDateBounds.max);
  }, [rows, entryDateBounds.min, entryDateBounds.max]);

  useEffect(() => {
    setPage(1);
  }, [search, dateFrom, dateTo, showEditedOnly, sortKey, sortDirection]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    const matching = rows.filter((row) => {
      const lot = rowLot(row);
      const entryDate = dateText(row.entry_date);
      if (dateFrom && entryDate < dateFrom) return false;
      if (dateTo && entryDate > dateTo) return false;
      if (showEditedOnly && !editedLotSet.has(lot)) return false;
      if (!query) return true;

      return ENTRY_COLUMNS.some((column) => {
        const value =
          column.key === "entry_date_2" ? draftDates[lot] : row[column.key];
        return text(value).toLocaleLowerCase("es").includes(query);
      });
    });

    return matching
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const leftLot = rowLot(left.row);
        const rightLot = rowLot(right.row);
        const leftEdited = editedLotSet.has(leftLot);
        const rightEdited = editedLotSet.has(rightLot);
        if (leftEdited !== rightEdited) return leftEdited ? -1 : 1;

        const column = ENTRY_COLUMNS.find((item) => item.key === sortKey) ?? ENTRY_COLUMNS[0];
        const leftValue =
          column.key === "entry_date_2" ? draftDates[leftLot] : left.row[column.key];
        const rightValue =
          column.key === "entry_date_2" ? draftDates[rightLot] : right.row[column.key];
        let result = 0;

        if (column.kind === "number") {
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
    showEditedOnly,
    editedLotSet,
    draftDates,
    sortKey,
    sortDirection,
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
      mappingRows
        .map(mappingKey)
        .filter((key) => !sameMappingDraft(mappingDrafts[key], mappingOriginals[key])),
    [mappingRows, mappingDrafts, mappingOriginals]
  );

  const editedMappingSet = useMemo(
    () => new Set(editedMappingKeys),
    [editedMappingKeys]
  );

  const filteredMappingRows = useMemo(() => {
    const query = mappingSearch.trim().toLocaleLowerCase("es");
    return mappingRows
      .filter((row) => {
        if (!query) return true;
        const key = mappingKey(row);
        const draft = mappingDrafts[key] ?? toMappingDraft(row);
        return [row.ruc, row.concession_code, draft.office_name, draft.zone_name, draft.office_code]
          .some((value) => text(value).toLocaleLowerCase("es").includes(query));
      })
      .sort((left, right) => {
        const leftEdited = editedMappingSet.has(mappingKey(left));
        const rightEdited = editedMappingSet.has(mappingKey(right));
        if (leftEdited !== rightEdited) return leftEdited ? -1 : 1;
        return mappingKey(left).localeCompare(mappingKey(right), "es", {
          numeric: true,
          sensitivity: "base",
        });
      });
  }, [mappingRows, mappingSearch, mappingDrafts, editedMappingSet]);

  useEffect(() => {
    setMappingPage(1);
  }, [mappingSearch]);

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
    if (sortKey === column.key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(column.key);
    setSortDirection("asc");
  }

  function updateEntryDate(lot: string, value: string) {
    setDraftDates((current) => ({ ...current, [lot]: value }));
    setMessage(null);
  }

  async function saveEntries() {
    if (!editedLots.length || saving) return;
    setSaving(true);
    setMessage(null);

    const rowsByLot = new Map(rows.map((row) => [rowLot(row), row]));
    const { fulfilled, rejected } = await settleInChunks(editedLots, async (lot) => {
      if (!rowsByLot.has(lot)) throw new Error(`${lot}: lote no encontrado.`);
      const response = (await apiPost("/api/traceability/cm/entrydate/insert", {
        lot,
        entry_date_2: dateText(draftDates[lot]) || null,
      })) as SaveResponse;
      if (!response.ok) throw new Error(`${lot}: ${response.error || "no se pudo guardar"}`);
      return lot;
    });

    if (fulfilled.length) {
      const fulfilledSet = new Set(fulfilled);
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
    setMappingDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] ?? { office_name: "", zone_name: "", office_code: "" }), [field]: value },
    }));
    setMappingMessage(null);
  }

  async function saveMapping() {
    if (!editedMappingKeys.length || mappingSaving) return;
    setMappingSaving(true);
    setMappingMessage(null);

    const rowsByKey = new Map(mappingRows.map((row) => [mappingKey(row), row]));
    const { fulfilled, rejected } = await settleInChunks(
      editedMappingKeys,
      async (key) => {
        const row = rowsByKey.get(key);
        const draft = mappingDrafts[key];
        const ruc = text(row?.ruc).trim();
        const concessionCode = text(row?.concession_code).trim();
        if (!row || !draft || !ruc || !concessionCode) {
          throw new Error("Mapping sin RUC o código de concesión.");
        }

        const response = (await apiPost("/api/traceability/cm/ruccon-map/insert", {
          ruc,
          concession_code: concessionCode,
          office_name: optionalText(draft.office_name),
          zone_name: optionalText(draft.zone_name),
          office_code: optionalText(draft.office_code),
        })) as SaveResponse;
        if (!response.ok) {
          throw new Error(
            `${ruc} / ${concessionCode}: ${response.error || "no se pudo guardar"}`
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

  const inputStyle: React.CSSProperties = {
    border: "1px solid rgba(216,238,255,.18)",
    background: "rgba(0,0,0,.10)",
    color: "white",
    fontWeight: 800,
    padding: "6px 8px",
    borderRadius: 8,
    outline: "none",
    fontSize: 12,
    lineHeight: "14px",
    boxSizing: "border-box",
    colorScheme: "dark",
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
        gridTemplateRows: "auto auto minmax(0, 1fr) auto",
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
        <div style={{ alignSelf: "center", fontWeight: 900 }}>Trazabilidad · CM Inputs</div>

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
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Editadas: {editedLots.length}
        </button>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800 }}>F. ingreso desde</span>
            <input
              type="date"
              value={dateFrom}
              min={entryDateBounds.min || undefined}
              max={dateTo || entryDateBounds.max || undefined}
              onChange={(event) => setDateFrom(event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800 }}>F. ingreso hasta</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || entryDateBounds.min || undefined}
              max={entryDateBounds.max || undefined}
              onChange={(event) => setDateTo(event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800 }}>Buscador global</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Lote, minero, RUC, concesión, placa..."
              style={{ ...inputStyle, minWidth: 270 }}
            />
          </label>

          <Button type="button" size="sm" onClick={() => void loadEntries()} disabled={loading || saving}>
            {loading ? "Cargando…" : "Refrescar"}
          </Button>
          <Button type="button" size="sm" onClick={openMapping} disabled={mappingSaving}>
            Actualizar mapeo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => void saveEntries()}
            disabled={loading || saving || editedLots.length === 0}
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
            fontWeight: 800,
          }}
        >
          {message}
        </div>
      ) : (
        <div style={{ display: "none" }} />
      )}

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
                    aria-sort={sortKey === column.key ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
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
                      background: "rgb(6,77,121)",
                      borderRight: "1px solid rgba(216,238,255,.14)",
                      textAlign: column.kind === "number" ? "right" : "left",
                      cursor: "pointer",
                    }}
                  >
                    {column.label}{sortKey === column.key ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const lot = rowLot(row);
                const edited = editedLotSet.has(lot);
                return (
                  <tr key={lot} className="capex-tr">
                    {ENTRY_COLUMNS.map((column) => (
                      <td
                        key={column.key}
                        className={`capex-td${column.key === "lot" ? " capex-td-strong" : ""}`}
                        title={column.key === "entry_date_2" ? undefined : text(row[column.key])}
                        style={{
                          ...cellStyle,
                          background: edited ? "rgba(94,128,25,.28)" : "rgba(0,0,0,.10)",
                          textAlign: column.kind === "number" ? "right" : "left",
                        }}
                      >
                        {column.key === "entry_date_2" ? (
                          <input
                            type="date"
                            value={draftDates[lot] ?? ""}
                            onChange={(event) => updateEntryDate(lot, event.target.value)}
                            disabled={loading || saving || !lot}
                            aria-label={`Fecha de ingreso 2 del lote ${lot}`}
                            style={{ ...inputStyle, width: "100%", minWidth: 0 }}
                          />
                        ) : (
                          displayValue(row[column.key], column.kind)
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}

              {!loading && visibleRows.length === 0 ? (
                <tr className="capex-tr">
                  <td className="capex-td" colSpan={ENTRY_COLUMNS.length} style={{ ...cellStyle, fontWeight: 900 }}>
                    No hay filas para el filtro seleccionado.
                  </td>
                </tr>
              ) : null}

              {loading ? (
                <tr className="capex-tr">
                  <td className="capex-td" colSpan={ENTRY_COLUMNS.length} style={{ ...cellStyle, fontWeight: 900 }}>
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
        <div style={{ fontSize: 12, fontWeight: 800 }}>
          Mostrando {filteredRows.length ? pageStart + 1 : 0} - {Math.min(pageStart + PAGE_SIZE, filteredRows.length)} de {filteredRows.length} filas
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button type="button" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || safePage <= 1}>←</Button>
          <div style={{ minWidth: 90, textAlign: "center", fontSize: 12, fontWeight: 900, padding: "6px 10px", borderRadius: 999, background: "rgba(255,255,255,.06)", border: "1px solid rgba(216,238,255,.18)" }}>
            Página {safePage} / {totalPages}
          </div>
          <Button type="button" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={loading || safePage >= totalPages}>→</Button>
        </div>
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
                <div id="cm-mapping-title" style={{ fontSize: 18, fontWeight: 900 }}>Actualizar mapeo CM</div>
                <div style={{ fontSize: 12, opacity: .82 }}>RUC y código de concesión identifican el registro; oficina, zona y código de oficina son editables.</div>
              </div>
              <Button type="button" size="sm" onClick={() => setMappingOpen(false)} disabled={mappingSaving}>Cerrar</Button>
            </div>

            <div style={{ display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap" }}>
              <label style={{ display: "grid", gap: 4, flex: "1 1 320px" }}>
                <span style={{ fontSize: 11, fontWeight: 800 }}>Buscador global</span>
                <input type="search" value={mappingSearch} onChange={(event) => setMappingSearch(event.target.value)} placeholder="RUC, concesión, oficina, zona..." style={{ ...inputStyle, width: "100%" }} />
              </label>
              <div style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(147,178,92,.45)", background: editedMappingKeys.length ? "rgba(94,128,25,.24)" : "rgba(255,255,255,.06)", color: editedMappingKeys.length ? "rgb(174,202,125)" : "rgba(255,255,255,.8)", fontSize: 12, fontWeight: 900 }}>
                Editadas: {editedMappingKeys.length}
              </div>
              <Button type="button" size="sm" onClick={() => void loadMapping()} disabled={mappingLoading || mappingSaving}>{mappingLoading ? "Cargando…" : "Refrescar"}</Button>
            </div>

            {mappingMessage ? (
              <div role={messageSuccess(mappingMessage) ? "status" : "alert"} style={{ padding: 10, borderRadius: 10, border: messageSuccess(mappingMessage) ? "1px solid rgba(62,180,137,.45)" : "1px solid rgba(216,93,39,.45)", background: messageSuccess(mappingMessage) ? "rgba(62,180,137,.10)" : "rgba(216,93,39,.10)", fontWeight: 800 }}>
                {mappingMessage}
              </div>
            ) : (
              <div style={{ fontSize: 12, fontWeight: 800, opacity: .82 }}>Solo se enviarán las filas modificadas.</div>
            )}

            <div style={{ minWidth: 0, minHeight: 0, overflow: "auto", border: "1px solid rgba(216,238,255,.12)", borderRadius: 12 }}>
              <Table stickyHeader disableScrollWrapper>
                <colgroup>
                  {MAPPING_COLUMNS.map((column) => <col key={column.key} style={{ width: column.width, minWidth: column.width, maxWidth: column.width }} />)}
                </colgroup>
                <thead>
                  <tr>
                    {MAPPING_COLUMNS.map((column) => (
                      <th key={column.key} className="capex-th" style={{ top: 0, zIndex: 20, width: column.width, background: "rgb(6,77,121)", padding: 9, borderRight: "1px solid rgba(216,238,255,.14)" }}>{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleMappingRows.map((row) => {
                    const key = mappingKey(row);
                    const draft = mappingDrafts[key] ?? toMappingDraft(row);
                    const edited = editedMappingSet.has(key);
                    return (
                      <tr key={key} className="capex-tr">
                        {MAPPING_COLUMNS.map((column) => (
                          <td key={column.key} className={`capex-td${!column.editable ? " capex-td-strong" : ""}`} style={{ ...cellStyle, background: edited ? "rgba(94,128,25,.28)" : "rgba(0,0,0,.10)" }}>
                            {column.editable ? (
                              <input
                                type="text"
                                value={draft[column.key as keyof MappingDraft]}
                                maxLength={column.maxLength}
                                onChange={(event) => updateMapping(key, column.key as keyof MappingDraft, event.target.value)}
                                disabled={mappingLoading || mappingSaving}
                                aria-label={`${column.label} para ${text(row.ruc)} / ${text(row.concession_code)}`}
                                style={{ ...inputStyle, width: "100%", minWidth: 0 }}
                              />
                            ) : (
                              <span title={text(row[column.key])}>{text(row[column.key]).trim() || "—"}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}

                  {!mappingLoading && visibleMappingRows.length === 0 ? (
                    <tr className="capex-tr"><td className="capex-td" colSpan={MAPPING_COLUMNS.length} style={{ ...cellStyle, fontWeight: 900 }}>No hay mappings para el filtro seleccionado.</td></tr>
                  ) : null}
                  {mappingLoading ? (
                    <tr className="capex-tr"><td className="capex-td" colSpan={MAPPING_COLUMNS.length} style={{ ...cellStyle, fontWeight: 900 }}>Cargando mapping…</td></tr>
                  ) : null}
                </tbody>
              </Table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800 }}>Mostrando {filteredMappingRows.length ? mappingPageStart + 1 : 0} - {Math.min(mappingPageStart + PAGE_SIZE, filteredMappingRows.length)} de {filteredMappingRows.length}</span>
                <Button type="button" size="sm" onClick={() => setMappingPage((current) => Math.max(1, current - 1))} disabled={mappingLoading || safeMappingPage <= 1}>←</Button>
                <span style={{ fontSize: 12, fontWeight: 900 }}>Página {safeMappingPage} / {mappingTotalPages}</span>
                <Button type="button" size="sm" onClick={() => setMappingPage((current) => Math.min(mappingTotalPages, current + 1))} disabled={mappingLoading || safeMappingPage >= mappingTotalPages}>→</Button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button type="button" size="sm" onClick={() => setMappingOpen(false)} disabled={mappingSaving}>Cancelar</Button>
                <Button type="button" size="sm" variant="primary" onClick={() => void saveMapping()} disabled={mappingLoading || mappingSaving || editedMappingKeys.length === 0}>{mappingSaving ? "Guardando…" : "Guardar"}</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
