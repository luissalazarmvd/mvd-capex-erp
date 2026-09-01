"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiGet } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";
import { FastCellInput } from "./FastCellInput";

type AuditOperation = "I" | "U" | "D" | "";

type AuditRow = {
  audit_id: number | string;
  request_id: string | null;
  occurred_at: string | null;
  module_name: string | null;
  action_name: string | null;
  endpoint: string | null;
  table_name: string | null;
  operation: string | null;
  row_count: number | string | null;
  entity_keys_json: string | null;
  actor_name: string | null;
  client_ip: string | null;
  user_agent: string | null;
  database_login: string | null;
  application_name: string | null;
  host_name: string | null;
  session_id: number | string | null;
  total_rows?: number | string | null;
};

type AuditDetailRow = AuditRow & {
  before_json: string | null;
  after_json: string | null;
};

type JsonRow = Record<string, unknown>;

type AuditEntityChange = {
  key: string;
  before: JsonRow | null;
  after: JsonRow | null;
  fields: string[];
};

type FixAssetsAuditProps = {
  disabled?: boolean;
  defaultTable?: string;
  buttonLabel?: string;
};

const PAGE_SIZE = 50;

const TABLE_OPTIONS = [
  { value: "", label: "Todas las tablas" },
  { value: "stg.finance_actfij_catalogue", label: "Catálogo" },
  { value: "stg.finance_actfij_deprec", label: "Depreciación" },
  { value: "stg.finance_actfij_mapping", label: "Mapping" },
  { value: "stg.finance_actfij_veta_vr", label: "Veta VR" },
];

const OPERATION_OPTIONS: { value: AuditOperation; label: string }[] = [
  { value: "", label: "Todas las operaciones" },
  { value: "I", label: "Inserciones" },
  { value: "U", label: "Actualizaciones" },
  { value: "D", label: "Eliminaciones" },
];

const HIDDEN_DIFF_FIELDS = new Set(["created_at", "updated_at"]);

const ACTION_LABELS: Record<string, string> = {
  ACTFIJ_CATALOGUE_SAVE: "Guardado de catálogo",
  ACTFIJ_CATALOGUE_INSERT: "Inserción en catálogo",
  ACTFIJ_CATALOGUE_UPDATE: "Actualización de catálogo",
  ACTFIJ_CATALOGUE_DELETE: "Eliminación de catálogo",
  ACTFIJ_DEPREC_SAVE_PEN: "Guardado de depreciación PEN",
  ACTFIJ_DEPREC_SAVE_USD: "Guardado de depreciación USD",
  ACTFIJ_DEPREC_DELETE_PEN: "Borrado de depreciación PEN",
  ACTFIJ_DEPREC_DELETE_USD: "Borrado de depreciación USD",
  ACTFIJ_DEPREC_INSERT: "Inserción de depreciación",
  ACTFIJ_DEPREC_UPDATE: "Actualización de depreciación",
  ACTFIJ_DEPREC_DELETE: "Eliminación de depreciación",
  ACTFIJ_MAPPING_SAVE: "Guardado de mapping",
  ACTFIJ_MAPPING_INSERT: "Inserción en mapping",
  ACTFIJ_MAPPING_UPDATE: "Actualización de mapping",
  ACTFIJ_MAPPING_DELETE: "Eliminación de mapping",
  ACTFIJ_VETA_VR_SAVE: "Guardado de Veta VR",
  ACTFIJ_VETA_VR_INSERT: "Inserción de Veta VR",
  ACTFIJ_VETA_VR_UPDATE: "Actualización de Veta VR",
  ACTFIJ_VETA_VR_DELETE: "Eliminación de Veta VR",
  ACTFIJ_DISPOSAL: "Baja de activo",
  ACTFIJ_RECLASSIFY: "Reclasificación de activos",
};

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseJsonRows(value: unknown): JsonRow[] {
  if (Array.isArray(value)) {
    return value.filter((row): row is JsonRow => Boolean(row) && typeof row === "object" && !Array.isArray(row));
  }

  const raw = text(value).trim();

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((row): row is JsonRow => Boolean(row) && typeof row === "object" && !Array.isArray(row))
      : [];
  } catch {
    return [];
  }
}

function normalizedComparable(value: unknown) {
  if (value == null) {
    return null;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function sameValue(left: unknown, right: unknown) {
  return normalizedComparable(left) === normalizedComparable(right);
}

function tableLabel(value: unknown) {
  const tableName = text(value);
  return TABLE_OPTIONS.find((option) => option.value === tableName)?.label || tableName || "—";
}

function actionLabel(value: unknown) {
  const action = text(value).trim().toUpperCase();

  if (!action) {
    return "—";
  }

  return ACTION_LABELS[action]
    || action.replace(/^ACTFIJ_/, "").replaceAll("_", " ");
}

function operationLabel(value: unknown) {
  const operation = text(value).toUpperCase();

  if (operation === "I") return "Insertó";
  if (operation === "U") return "Actualizó";
  if (operation === "D") return "Eliminó";

  return operation || "—";
}

function operationBackground(value: unknown) {
  const operation = text(value).toUpperCase();

  if (operation === "I") return "rgba(94,128,25,.28)";
  if (operation === "U") return "rgba(27,147,227,.24)";
  if (operation === "D") return "rgba(216,93,39,.26)";

  return "rgba(255,255,255,.08)";
}

function formatDateTime(value: unknown) {
  const raw = text(value).trim();

  if (!raw) {
    return "—";
  }

  return raw.replace("T", " ").slice(0, 23);
}

function formatValue(value: unknown) {
  if (value == null || value === "") {
    return "—";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function entityIdentity(tableName: string, row: JsonRow, index: number) {
  if (tableName === "stg.finance_actfij_catalogue") {
    return text(row.asset_code) || `CAT-${index + 1}`;
  }

  if (tableName === "stg.finance_actfij_deprec") {
    return `${text(row.asset_code) || "SIN-COD"} | ${text(row.period_date) || "SIN-PERIODO"}`;
  }

  if (tableName === "stg.finance_actfij_mapping") {
    return text(row.origin_account_code) || `MAP-${index + 1}`;
  }

  if (tableName === "stg.finance_actfij_veta_vr") {
    if (text(row.veta_vr_id)) {
      return `ID ${text(row.veta_vr_id)}`;
    }

    return [
      text(row.asset_code),
      text(row.map_type),
      text(row.account_code),
      text(row.voucher_number),
      text(row.document_number),
    ].filter(Boolean).join(" | ") || `VR-${index + 1}`;
  }

  return text(row.asset_code)
    || text(row.origin_account_code)
    || text(row.veta_vr_id)
    || `FILA-${index + 1}`;
}

function buildEntityChanges(row: AuditDetailRow | null): AuditEntityChange[] {
  if (!row) {
    return [];
  }

  const tableName = text(row.table_name);
  const beforeRows = parseJsonRows(row.before_json);
  const afterRows = parseJsonRows(row.after_json);
  const beforeByKey = new Map<string, JsonRow>();
  const afterByKey = new Map<string, JsonRow>();

  beforeRows.forEach((item, index) => {
    beforeByKey.set(entityIdentity(tableName, item, index), item);
  });

  afterRows.forEach((item, index) => {
    afterByKey.set(entityIdentity(tableName, item, index), item);
  });

  const keys = Array.from(new Set([...beforeByKey.keys(), ...afterByKey.keys()]));

  return keys.map((key) => {
    const before = beforeByKey.get(key) || null;
    const after = afterByKey.get(key) || null;
    const fields = Array.from(new Set([
      ...Object.keys(before || {}),
      ...Object.keys(after || {}),
    ])).filter((field) => {
      if (HIDDEN_DIFF_FIELDS.has(field)) {
        return false;
      }

      if (!before || !after) {
        return true;
      }

      return !sameValue(before[field], after[field]);
    });

    return { key, before, after, fields };
  });
}

function compactEntityKeys(value: unknown) {
  const rows = parseJsonRows(value);

  if (!rows.length) {
    return "—";
  }

  const labels = rows.slice(0, 2).map((row) => Object.values(row).filter((item) => item != null && item !== "").join(" | "));
  const remaining = rows.length - labels.length;

  return `${labels.join("; ")}${remaining > 0 ? ` +${remaining}` : ""}`;
}

function actorLabel(row: AuditRow) {
  return text(row.actor_name).trim()
    || text(row.database_login).trim()
    || text(row.application_name).trim()
    || "—";
}

export default function FixAssetsAudit({
  disabled = false,
  defaultTable = "",
  buttonLabel = "Historial de cambios",
}: FixAssetsAuditProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [tableName, setTableName] = useState(defaultTable);
  const [operation, setOperation] = useState<AuditOperation>("");
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<AuditDetailRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const pageCount = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  const selectedRow = useMemo(() => rows.find((row) => text(row.audit_id) === selectedAuditId) || null, [rows, selectedAuditId]);
  const selectedChanges = useMemo(() => buildEntityChanges(selectedDetail), [selectedDetail]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
      });

      if (tableName) params.set("table", tableName);
      if (operation) params.set("operation", operation);
      if (query.trim()) params.set("search", query.trim());
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const response = await apiGet(`/api/actfij/audit?${params.toString()}`);
      const nextRows = Array.isArray(response?.rows) ? response.rows as AuditRow[] : [];
      const nextTotal = numberValue(response?.total);

      setRows(nextRows);
      setTotalRows(nextTotal);
      setSelectedAuditId((current) => {
        if (current && nextRows.some((row) => text(row.audit_id) === current)) {
          return current;
        }

        return nextRows.length ? text(nextRows[0].audit_id) : null;
      });
    } catch (loadError) {
      setRows([]);
      setTotalRows(0);
      setSelectedAuditId(null);
      setSelectedDetail(null);
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el historial de cambios");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, operation, page, query, tableName]);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [load, open]);

  useEffect(() => {
    if (!open || !selectedAuditId) {
      setSelectedDetail(null);
      setDetailError("");
      setDetailLoading(false);
      return;
    }

    let active = true;

    setDetailLoading(true);
    setDetailError("");

    void apiGet(`/api/actfij/audit/${encodeURIComponent(selectedAuditId)}`)
      .then((response) => {
        if (!active) {
          return;
        }

        setSelectedDetail(response?.row ? response.row as AuditDetailRow : null);
      })
      .catch((loadError) => {
        if (!active) {
          return;
        }

        setSelectedDetail(null);
        setDetailError(loadError instanceof Error ? loadError.message : "No se pudo cargar el detalle de auditoría");
      })
      .finally(() => {
        if (active) {
          setDetailLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [open, selectedAuditId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function applySearch() {
    setPage(1);
    setQuery(queryDraft.trim());
  }

  function clearFilters() {
    setTableName(defaultTable);
    setOperation("");
    setQueryDraft("");
    setQuery("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  const modal = open && typeof document !== "undefined"
    ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="fixassets-audit-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 12000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
            background: "rgba(0,0,0,.68)",
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <section
            className="panel-inner fixassets-audit-modal"
            style={{
              width: "min(1500px, 98vw)",
              height: "min(900px, 94vh)",
              minHeight: 0,
              display: "grid",
              gridTemplateRows: "auto auto minmax(0, 1fr) auto",
              gap: 10,
              padding: 14,
              overflow: "hidden",
              background: "#082f44",
              borderColor: "rgba(147,211,230,.34)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h2 id="fixassets-audit-title" style={{ margin: 0, fontSize: 20 }}>Historial de cambios</h2>
                <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                  Auditoría consolidada de catálogo, depreciación, mapping y movimientos Veta VR.
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Button size="sm" onClick={() => void load()} disabled={loading}>{loading ? "Cargando..." : "Refrescar"}</Button>
                <Button size="sm" onClick={() => setOpen(false)}>Cerrar</Button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap" }}>
              <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 800 }}>
                Tabla
                <select
                  className="input"
                  value={tableName}
                  onChange={(event) => {
                    setTableName(event.target.value);
                    setPage(1);
                  }}
                  style={{ minWidth: 190, height: 34, padding: "5px 8px" }}
                >
                  {TABLE_OPTIONS.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}
                </select>
              </label>

              <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 800 }}>
                Operación
                <select
                  className="input"
                  value={operation}
                  onChange={(event) => {
                    setOperation(event.target.value as AuditOperation);
                    setPage(1);
                  }}
                  style={{ minWidth: 170, height: 34, padding: "5px 8px" }}
                >
                  {OPERATION_OPTIONS.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}
                </select>
              </label>

              <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 800 }}>
                Desde
                <input
                  className="input"
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setDateFrom(event.target.value);
                    setPage(1);
                  }}
                  style={{ width: 145, height: 34, padding: "5px 8px" }}
                />
              </label>

              <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 800 }}>
                Hasta
                <input
                  className="input"
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setDateTo(event.target.value);
                    setPage(1);
                  }}
                  style={{ width: 145, height: 34, padding: "5px 8px" }}
                />
              </label>

              <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 800 }}>
                Buscar
                <FastCellInput
                  className="input"
                  value={queryDraft}
                  onCommit={(value) => {
                    setQueryDraft(value);
                    setPage(1);
                    setQuery(value.trim());
                  }}
                  onLiveChange={setQueryDraft}
                  placeholder="COD, acción, endpoint o usuario"
                  style={{ width: 280, height: 34, padding: "5px 9px" }}
                />
              </label>

              <Button size="sm" variant="primary" onClick={applySearch} disabled={loading}>Buscar</Button>
              <Button size="sm" onClick={clearFilters} disabled={loading}>Limpiar filtros</Button>
            </div>

            <div className="fixassets-audit-content" style={{ minHeight: 0, display: "grid", gridTemplateColumns: "minmax(660px, 1.35fr) minmax(420px, .85fr)", gap: 10, overflow: "hidden" }}>
              <div style={{ minWidth: 0, minHeight: 0, overflow: "auto", border: "1px solid rgba(147,211,230,.2)", borderRadius: 10 }}>
                <div style={{ minWidth: 1130 }}>
                  <Table disableScrollWrapper stickyHeader>
                    <colgroup>
                      <col style={{ width: 165 }} />
                      <col style={{ width: 180 }} />
                      <col style={{ width: 155 }} />
                      <col style={{ width: 105 }} />
                      <col style={{ width: 70 }} />
                      <col style={{ width: 260 }} />
                      <col style={{ width: 145 }} />
                      <col style={{ width: 110 }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="capex-th">Fecha</th>
                        <th className="capex-th">Acción</th>
                        <th className="capex-th">Tabla</th>
                        <th className="capex-th">Operación</th>
                        <th className="capex-th">Filas</th>
                        <th className="capex-th">Entidades</th>
                        <th className="capex-th">Usuario</th>
                        <th className="capex-th">Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const selected = text(row.audit_id) === selectedAuditId;

                        return (
                          <tr key={text(row.audit_id)} className="capex-tr" style={{ background: selected ? "rgba(27,147,227,.2)" : undefined }}>
                            <td className="capex-td" style={{ padding: 7, whiteSpace: "nowrap" }}>{formatDateTime(row.occurred_at)}</td>
                            <td className="capex-td" style={{ padding: 7 }} title={text(row.endpoint)}>{actionLabel(row.action_name)}</td>
                            <td className="capex-td" style={{ padding: 7 }}>{tableLabel(row.table_name)}</td>
                            <td className="capex-td" style={{ padding: 7 }}>
                              <span style={{ display: "inline-flex", padding: "3px 7px", borderRadius: 999, background: operationBackground(row.operation), fontWeight: 900 }}>
                                {operationLabel(row.operation)}
                              </span>
                            </td>
                            <td className="capex-td" style={{ padding: 7, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{numberValue(row.row_count)}</td>
                            <td className="capex-td" style={{ padding: 7 }} title={text(row.entity_keys_json)}>{compactEntityKeys(row.entity_keys_json)}</td>
                            <td className="capex-td" style={{ padding: 7 }} title={`${text(row.database_login)} · ${text(row.client_ip)}`}>{actorLabel(row)}</td>
                            <td className="capex-td" style={{ padding: 7 }}>
                              <Button size="sm" onClick={() => setSelectedAuditId(text(row.audit_id))}>{selected ? "Viendo" : "Ver"}</Button>
                            </td>
                          </tr>
                        );
                      })}
                      {loading ? <tr><td className="capex-td" colSpan={8} style={{ padding: 12 }}>Cargando historial...</td></tr> : null}
                      {!loading && !rows.length ? <tr><td className="capex-td" colSpan={8} style={{ padding: 12 }}>{error || "No hay cambios para los filtros seleccionados."}</td></tr> : null}
                    </tbody>
                  </Table>
                </div>
              </div>

              <div style={{ minWidth: 0, minHeight: 0, overflow: "auto", border: "1px solid rgba(147,211,230,.2)", borderRadius: 10, padding: 10, background: "rgba(3,24,36,.28)" }}>
                {selectedRow ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ fontSize: 15, fontWeight: 900 }}>{actionLabel(selectedRow.action_name)}</div>
                      <div className="muted" style={{ fontSize: 11, wordBreak: "break-word" }}>
                        {formatDateTime(selectedRow.occurred_at)} · {tableLabel(selectedRow.table_name)} · solicitud {text(selectedRow.request_id).slice(0, 8) || "sin ID"}
                      </div>
                      <div className="muted" style={{ fontSize: 11, wordBreak: "break-word" }}>{text(selectedRow.endpoint) || "Sin endpoint registrado"}</div>
                    </div>

                    {detailLoading ? <div className="muted" style={{ fontSize: 12 }}>Cargando valores anteriores y posteriores...</div> : null}
                    {detailError ? <div style={{ color: "#ffd0bf", fontWeight: 800, fontSize: 12 }}>{detailError}</div> : null}

                    {!detailLoading && !detailError ? selectedChanges.map((change) => (
                      <section key={change.key} style={{ display: "grid", gap: 6, padding: 9, border: "1px solid rgba(147,211,230,.18)", borderRadius: 9, background: "rgba(255,255,255,.025)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <strong style={{ fontSize: 12, wordBreak: "break-word" }}>{change.key}</strong>
                          <span className="muted" style={{ fontSize: 11 }}>{change.fields.length} campo{change.fields.length === 1 ? "" : "s"}</span>
                        </div>

                        <div style={{ overflow: "auto" }}>
                          <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse", fontSize: 11 }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: "left", padding: 5, borderBottom: "1px solid rgba(147,211,230,.18)" }}>Campo</th>
                                <th style={{ textAlign: "left", padding: 5, borderBottom: "1px solid rgba(147,211,230,.18)" }}>Antes</th>
                                <th style={{ textAlign: "left", padding: 5, borderBottom: "1px solid rgba(147,211,230,.18)" }}>Después</th>
                              </tr>
                            </thead>
                            <tbody>
                              {change.fields.map((field) => (
                                <tr key={field}>
                                  <td style={{ padding: 5, borderBottom: "1px solid rgba(147,211,230,.1)", fontWeight: 800 }}>{field}</td>
                                  <td style={{ padding: 5, borderBottom: "1px solid rgba(147,211,230,.1)", wordBreak: "break-word" }}>{formatValue(change.before?.[field])}</td>
                                  <td style={{ padding: 5, borderBottom: "1px solid rgba(147,211,230,.1)", wordBreak: "break-word" }}>{formatValue(change.after?.[field])}</td>
                                </tr>
                              ))}
                              {!change.fields.length ? <tr><td colSpan={3} style={{ padding: 6 }} className="muted">Solo cambió metadata de actualización.</td></tr> : null}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    )) : null}

                    {!detailLoading && !detailError && !selectedChanges.length ? <div className="muted" style={{ fontSize: 12 }}>No se pudo reconstruir el detalle JSON de esta operación.</div> : null}
                  </div>
                ) : (
                  <div className="muted" style={{ fontSize: 12 }}>Selecciona una operación para revisar los valores anteriores y posteriores.</div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="muted" style={{ fontSize: 12 }}>
                {totalRows} registro{totalRows === 1 ? "" : "s"} de auditoría · página {page} de {pageCount}
              </span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Button size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page <= 1}>Anterior</Button>
                <Button size="sm" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={loading || page >= pageCount}>Siguiente</Button>
              </div>
            </div>
          </section>

          <style jsx global>{`
            .fixassets-audit-modal select.input {
              background: #0b4d6b !important;
              color: #f4fbff !important;
              border-color: rgba(147,211,230,.30) !important;
              color-scheme: dark;
            }

            .fixassets-audit-modal select.input option {
              background: #0b4d6b !important;
              color: #f4fbff !important;
            }

            @media (max-width: 1050px) {
              .fixassets-audit-content {
                grid-template-columns: minmax(0, 1fr) !important;
                grid-template-rows: minmax(320px, 1fr) minmax(260px, .8fr) !important;
              }

              .fixassets-audit-modal {
                height: 96vh !important;
              }
            }
          `}</style>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={disabled}>{buttonLabel}</Button>
      {modal}
    </>
  );
}
