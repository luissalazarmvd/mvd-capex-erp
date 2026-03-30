// src/components/sustainability/SustainabilityIGAFOMTable.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../../lib/apiClient";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";

type IGAFOMRow = {
  provider_id: string | number | null;
  ruc: string | null;
  provider_name: string | null;
  document_type_id: string | number | null;
  image_id: string | number | null;
  image_path: string | null;
  concession_id: string | number | null;
  concession_code: string | null;
  concession_name: string | null;
  url: string | null;
  updated_at?: string | null;
};

type GetResp = {
  ok: boolean;
  rows?: IGAFOMRow[];
  count?: number;
  error?: string;
};

type ProviderOption = {
  value: string;
  label: string;
};

type ConcessionOption = {
  value: string;
  label: string;
};

function normalizeText(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeSearch(v: unknown) {
  return normalizeText(v).toLowerCase();
}

function uniqueByValue<T extends { value: string }>(items: T[]) {
  const seen = new Set<string>();
  const out: T[] = [];

  for (const item of items) {
    if (!item.value || seen.has(item.value)) continue;
    seen.add(item.value);
    out.push(item);
  }

  return out;
}

function normalizeDownloadUrl(url: string | null | undefined) {
  const value = normalizeText(url);
  if (!value) return "";

  if (/^https?:\/\//i.test(value)) return value;

  return `http://${value.replace(/^\/+/, "")}`;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

function buildProxyPdfUrl(
  url: string | null | undefined,
  disposition: "inline" | "attachment" = "inline"
) {
  const finalUrl = normalizeDownloadUrl(url);
  if (!finalUrl || !API_BASE_URL) return "";

  return `${API_BASE_URL}/api/sustainability/igafom/download?url=${encodeURIComponent(finalUrl)}&disposition=${disposition}`;
}

function openPdf(url: string | null | undefined) {
  const proxyUrl = buildProxyPdfUrl(url, "attachment");
  if (!proxyUrl) return;

  window.open(proxyUrl, "_blank", "noopener,noreferrer");
}

function openProxyPdf(proxyUrl: string | null | undefined) {
  if (!proxyUrl) return;
  window.open(proxyUrl, "_blank", "noopener,noreferrer");
}

type SearchableSelectProps = {
  label: string;
  placeholder: string;
  text: string;
  setText: (value: string) => void;
  selectedValue: string | null;
  setSelectedValue: (value: string | null) => void;
  options: { value: string; label: string }[];
};

function SearchableSelect({
  label,
  placeholder,
  text,
  setText,
  selectedValue,
  setSelectedValue,
  options,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const filteredOptions = useMemo(() => {
    const q = normalizeSearch(text);
    if (!q) return options.slice(0, 100);
    return options.filter((opt) => normalizeSearch(opt.label).includes(q)).slice(0, 100);
  }, [options, text]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div style={{ display: "grid", gap: 6, minWidth: 280, position: "relative" }} ref={wrapperRef}>
      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.9 }}>{label}</div>

      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={text}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value);
            setSelectedValue(null);
            setOpen(true);
          }}
          style={{
            width: "100%",
            padding: "10px 38px 10px 12px",
            borderRadius: 8,
            border: "1px solid rgba(191,231,255,.18)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            outline: "none",
            fontSize: 13,
          }}
        />

        {(text || selectedValue) ? (
          <button
            type="button"
            onClick={() => {
              setText("");
              setSelectedValue(null);
              setOpen(false);
            }}
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.75)",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
            }}
            title="Limpiar"
          >
            ×
          </button>
        ) : null}

        {open ? (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              maxHeight: 260,
              overflow: "auto",
              borderRadius: 10,
              border: "1px solid rgba(191,231,255,.18)",
              background: "rgb(6, 36, 58)",
              boxShadow: "0 10px 30px rgba(0,0,0,.35)",
              zIndex: 50,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setText("");
                setSelectedValue(null);
                setOpen(false);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                border: "none",
                background: "transparent",
                color: "rgb(185,185,185)",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              Todos
            </button>

            {filteredOptions.length ? (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setText(opt.label);
                    setSelectedValue(opt.value);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "none",
                    background:
                      selectedValue === opt.value
                        ? "rgba(102,199,255,.14)"
                        : "transparent",
                    color: "rgb(185,185,185)",
                    cursor: "pointer",
                  }}
                  title={opt.label}
                >
                  {opt.label}
                </button>
              ))
            ) : (
              <div
                style={{
                  padding: "10px 12px",
                  color: "rgba(255,255,255,.7)",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                Sin resultados
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function SustainabilityIGAFOMTable() {
  const [rows, setRows] = useState<IGAFOMRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDownloadUrl, setPreviewDownloadUrl] = useState<string | null>(null);

  const [providerText, setProviderText] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const [concessionText, setConcessionText] = useState("");
  const [selectedConcession, setSelectedConcession] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setMsg(null);

    try {
      const resp = (await apiGet("/api/sustainability/igafom")) as GetResp;

      if (!resp?.ok) {
        throw new Error(resp?.error || "No se pudo cargar sustainability IGAFOM.");
      }

      setRows(Array.isArray(resp.rows) ? resp.rows : []);
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo cargar información")}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function previewPdf(url: string | null | undefined) {
    const proxyInlineUrl = buildProxyPdfUrl(url, "inline");
    const proxyDownloadUrl = buildProxyPdfUrl(url, "attachment");

    if (!proxyInlineUrl) return;

    try {
      setMsg(null);

      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }

      const resp = await fetch(proxyInlineUrl, {
        method: "GET",
        cache: "no-store",
      });

      if (!resp.ok) {
        throw new Error(`No se pudo cargar preview. Status ${resp.status}`);
      }

      const blob = await resp.blob();
      const pdfBlob =
        blob.type?.toLowerCase().includes("pdf")
          ? blob
          : new Blob([blob], { type: "application/pdf" });

      const blobUrl = URL.createObjectURL(pdfBlob);

      setPreviewUrl(blobUrl);
      setPreviewDownloadUrl(proxyDownloadUrl || proxyInlineUrl);
    } catch (e: any) {
      setMsg(`ERROR: ${String(e?.message || e || "No se pudo cargar preview")}`);
    }
  }

  const providerOptions = useMemo(() => {
    const raw: ProviderOption[] = rows.map((row) => {
      const value = normalizeText(row.provider_id);
      const ruc = normalizeText(row.ruc);
      const name = normalizeText(row.provider_name);
      const label = [ruc, name].filter(Boolean).join(" - ");

      return { value, label };
    });

    return uniqueByValue(raw)
      .filter((x) => x.value && x.label)
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" })
      );
  }, [rows]);

  const concessionOptions = useMemo(() => {
    const raw: ConcessionOption[] = rows.map((row) => {
      const value = normalizeText(row.concession_id);
      const code = normalizeText(row.concession_code);
      const name = normalizeText(row.concession_name);
      const label = [code, name].filter(Boolean).join(" - ");

      return { value, label };
    });

    return uniqueByValue(raw)
      .filter((x) => x.value && x.label)
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" })
      );
  }, [rows]);

  const filteredRows = useMemo(() => {
    const providerQ = normalizeSearch(providerText);
    const concessionQ = normalizeSearch(concessionText);

    return rows.filter((row) => {
      const providerId = normalizeText(row.provider_id);
      const providerLabel = [normalizeText(row.ruc), normalizeText(row.provider_name)]
        .filter(Boolean)
        .join(" - ")
        .toLowerCase();

      const concessionId = normalizeText(row.concession_id);
      const concessionLabel = [normalizeText(row.concession_code), normalizeText(row.concession_name)]
        .filter(Boolean)
        .join(" - ")
        .toLowerCase();

      const providerOk = selectedProvider
        ? providerId === selectedProvider
        : providerQ
        ? providerLabel.includes(providerQ)
        : true;

      const concessionOk = selectedConcession
        ? concessionId === selectedConcession
        : concessionQ
        ? concessionLabel.includes(concessionQ)
        : true;

      return providerOk && concessionOk;
    });
  }, [rows, providerText, selectedProvider, concessionText, selectedConcession]);

  const totalPdf = filteredRows.filter((row) => normalizeText(row.url)).length;
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
    padding: "8px 10px",
    fontSize: 12,
    lineHeight: "16px",
    boxSizing: "border-box",
    color: "rgb(185,185,185)",
    verticalAlign: "middle",
  };

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        minWidth: 0,
        minHeight: 0,
        width: "100%",
        height: "100%",
        maxWidth: "100%",
        overflow: "hidden",
      }}
    >
      <div
        className="panel-inner"
        style={{
          padding: "10px 12px",
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        <div style={{ fontWeight: 900 }}>Sustainability · IGAFOM</div>

        <div
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            fontSize: 12,
            fontWeight: 900,
            color: "rgba(255,255,255,0.9)",
          }}
        >
          Filas: {rows.length}
        </div>

        <div
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            fontSize: 12,
            fontWeight: 900,
            color: "rgba(255,255,255,0.9)",
          }}
        >
          PDFs filtrados: {totalPdf}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Button type="button" size="sm" variant="default" onClick={loadData} disabled={loading}>
            {loading ? "Cargando…" : "Refrescar"}
          </Button>
        </div>
      </div>

      <div
        className="panel-inner"
        style={{
          padding: "12px",
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          flexShrink: 0,
          overflow: "visible",
        }}
      >
        <SearchableSelect
          label="Proveedor"
          placeholder="Buscar RUC o nombre del proveedor"
          text={providerText}
          setText={setProviderText}
          selectedValue={selectedProvider}
          setSelectedValue={setSelectedProvider}
          options={providerOptions}
        />

        <SearchableSelect
          label="Concesión"
          placeholder="Buscar código o nombre de concesión"
          text={concessionText}
          setText={setConcessionText}
          selectedValue={selectedConcession}
          setSelectedValue={setSelectedConcession}
          options={concessionOptions}
        />
      </div>

      {msg ? (
        <div
          className="panel-inner"
          style={{
            padding: 10,
            flexShrink: 0,
            border: "1px solid rgba(255,80,80,.45)",
            background: "rgba(255,80,80,.10)",
            fontWeight: 800,
          }}
        >
          {msg}
        </div>
      ) : null}

      <div
        className="panel-inner"
        style={{
          padding: 0,
          minWidth: 0,
          minHeight: 0,
          width: "100%",
          height: "100%",
          maxWidth: "100%",
          maxHeight: "calc(100vh - 290px)",
          overflow: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ minWidth: 980 }}>
          <Table stickyHeader disableScrollWrapper>
            <colgroup>
              <col style={{ width: 140 }} />
              <col style={{ width: 320 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 320 }} />
              <col style={{ width: 150 }} />
            </colgroup>

            <thead>
              <tr>
                <th
                  className="capex-th"
                  style={{
                    ...stickyHead,
                    border: headerBorder,
                    padding: "8px 10px",
                    textAlign: "left",
                    fontSize: 12,
                    height: 44,
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                  }}
                >
                  RUC
                </th>
                <th
                  className="capex-th"
                  style={{
                    ...stickyHead,
                    border: headerBorder,
                    padding: "8px 10px",
                    textAlign: "left",
                    fontSize: 12,
                    height: 44,
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                  }}
                >
                  Proveedor
                </th>
                <th
                  className="capex-th"
                  style={{
                    ...stickyHead,
                    border: headerBorder,
                    padding: "8px 10px",
                    textAlign: "left",
                    fontSize: 12,
                    height: 44,
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                  }}
                >
                  Código Concesión
                </th>
                <th
                  className="capex-th"
                  style={{
                    ...stickyHead,
                    border: headerBorder,
                    padding: "8px 10px",
                    textAlign: "left",
                    fontSize: 12,
                    height: 44,
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                  }}
                >
                  Nombre Concesión
                </th>
                <th
                  className="capex-th"
                  style={{
                    ...stickyHead,
                    border: headerBorder,
                    padding: "8px 10px",
                    textAlign: "center",
                    fontSize: 12,
                    height: 44,
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                  }}
                >
                  Descargar
                </th>
              </tr>
            </thead>

            <tbody>
              {!loading &&
                filteredRows.map((row, index) => {
                  const url = normalizeDownloadUrl(row.url);

                  return (
                    <tr
                      key={`${normalizeText(row.provider_id)}_${normalizeText(row.concession_id)}_${normalizeText(row.image_id)}_${index}`}
                      className="capex-tr"
                    >
                      <td
                        className="capex-td"
                        style={{
                          ...cellBase,
                          borderTop: gridH,
                          borderBottom: gridH,
                          borderRight: gridV,
                          background: rowBg,
                        }}
                        title={normalizeText(row.ruc) || "—"}
                      >
                        {normalizeText(row.ruc) || "—"}
                      </td>

                      <td
                        className="capex-td"
                        style={{
                          ...cellBase,
                          borderTop: gridH,
                          borderBottom: gridH,
                          borderRight: gridV,
                          background: rowBg,
                        }}
                        title={normalizeText(row.provider_name) || "—"}
                      >
                        {normalizeText(row.provider_name) || "—"}
                      </td>

                      <td
                        className="capex-td"
                        style={{
                          ...cellBase,
                          borderTop: gridH,
                          borderBottom: gridH,
                          borderRight: gridV,
                          background: rowBg,
                        }}
                        title={normalizeText(row.concession_code) || "—"}
                      >
                        {normalizeText(row.concession_code) || "—"}
                      </td>

                      <td
                        className="capex-td"
                        style={{
                          ...cellBase,
                          borderTop: gridH,
                          borderBottom: gridH,
                          borderRight: gridV,
                          background: rowBg,
                        }}
                        title={normalizeText(row.concession_name) || "—"}
                      >
                        {normalizeText(row.concession_name) || "—"}
                      </td>

                      <td
                        className="capex-td"
                        style={{
                          ...cellBase,
                          borderTop: gridH,
                          borderBottom: gridH,
                          background: rowBg,
                          textAlign: "center",
                        }}
                      >
                        {url ? (
                          <div
                            style={{
                              display: "inline-flex",
                              gap: 8,
                              alignItems: "center",
                              justifyContent: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => previewPdf(row.url)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                minHeight: 32,
                                padding: "0 12px",
                                borderRadius: 8,
                                background: "rgba(255,255,255,0.10)",
                                color: "#fff",
                                fontWeight: 800,
                                fontSize: 12,
                                border: "1px solid rgba(255,255,255,0.15)",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Preview
                            </button>

                            <button
                              type="button"
                              onClick={() => openPdf(row.url)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                minHeight: 32,
                                padding: "0 12px",
                                borderRadius: 8,
                                background: "#0ea5e9",
                                color: "#fff",
                                fontWeight: 800,
                                fontSize: 12,
                                border: "none",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Descargar PDF
                            </button>
                          </div>
                        ) : (
                          <span style={{ opacity: 0.65, fontWeight: 800 }}>Sin URL</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

              {!loading && filteredRows.length === 0 ? (
                <tr className="capex-tr">
                  <td
                    className="capex-td"
                    style={{ ...cellBase, fontWeight: 900 }}
                    colSpan={5}
                  >
                    No hay filas para mostrar.
                  </td>
                </tr>
              ) : null}

              {loading ? (
                <tr className="capex-tr">
                  <td
                    className="capex-td"
                    style={{ ...cellBase, fontWeight: 900 }}
                    colSpan={5}
                  >
                    Cargando sustainability IGAFOM…
                  </td>
                </tr>
              ) : null}
            </tbody>

            <tfoot>
              <tr>
                <td
                  className="capex-td"
                  style={{
                    ...cellBase,
                    fontWeight: 900,
                    borderTop: headerBorder,
                    borderRight: gridV,
                    background: "rgba(255,255,255,0.06)",
                  }}
                >
                  Filas: {filteredRows.length}
                </td>
                <td
                  className="capex-td"
                  colSpan={4}
                  style={{
                    ...cellBase,
                    borderTop: headerBorder,
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  Filtros activos por proveedor y/o concesión
                </td>
              </tr>
            </tfoot>
          </Table>
        </div>
      </div>

      {previewUrl ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
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
              width: "min(1200px, 96vw)",
              height: "min(90vh, 900px)",
              display: "grid",
              gridTemplateRows: "auto 1fr",
              gap: 10,
              padding: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontWeight: 900 }}>Preview PDF</div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => openProxyPdf(previewDownloadUrl)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 34,
                    padding: "0 12px",
                    borderRadius: 8,
                    background: "#0ea5e9",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 12,
                    border: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Descargar PDF
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (previewUrl?.startsWith("blob:")) {
                      URL.revokeObjectURL(previewUrl);
                    }
                    setPreviewUrl(null);
                    setPreviewDownloadUrl(null);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 34,
                    padding: "0 12px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.10)",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 12,
                    border: "1px solid rgba(255,255,255,0.15)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div
              style={{
                minWidth: 0,
                minHeight: 0,
                borderRadius: 10,
                overflow: "hidden",
                background: "#111",
              }}
            >
              <iframe
                src={previewUrl || undefined}
                title="Preview PDF"
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  background: "#111",
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}