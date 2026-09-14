// src/components/ui/ExcelHeaderFilter.tsx
//
// Filtro tipo Excel por columna: botón en la cabecera + popup en portal con
// orden, selección de valores, búsqueda y filtro personalizado. Es la única
// implementación del repositorio; las tablas lo montan directamente o a través
// de `useExcelColumnFilters` (ver `ExcelFilters.tsx`).

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

export type ExcelFilterKind = "text" | "number" | "date";
export type ExcelSortDirection = "asc" | "desc";

export type ExcelFilterOperator =
  | "none"
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "greater"
  | "greater_equal"
  | "less"
  | "less_equal"
  | "between";

export type ExcelColumnFilter = {
  selected: string[] | null;
  operator: ExcelFilterOperator;
  value1: string;
  value2: string;
};

export const EMPTY_EXCEL_FILTER: ExcelColumnFilter = {
  selected: null,
  operator: "none",
  value1: "",
  value2: "",
};

function excelOperatorOptions(
  kind: ExcelFilterKind
): Array<{ value: ExcelFilterOperator; label: string }> {
  if (kind === "text") {
    return [
      { value: "none", label: "Sin filtro personalizado" },
      { value: "equals", label: "Es igual a" },
      { value: "not_equals", label: "No es igual a" },
      { value: "contains", label: "Contiene" },
      { value: "not_contains", label: "No contiene" },
      { value: "starts_with", label: "Comienza por" },
      { value: "ends_with", label: "Termina en" },
    ];
  }

  if (kind === "date") {
    return [
      { value: "none", label: "Sin filtro personalizado" },
      { value: "equals", label: "Es igual a" },
      { value: "not_equals", label: "No es igual a" },
      { value: "greater", label: "Después de" },
      { value: "greater_equal", label: "Después o igual a" },
      { value: "less", label: "Antes de" },
      { value: "less_equal", label: "Antes o igual a" },
      { value: "between", label: "Entre" },
    ];
  }

  return [
    { value: "none", label: "Sin filtro personalizado" },
    { value: "equals", label: "Es igual a" },
    { value: "not_equals", label: "No es igual a" },
    { value: "greater", label: "Mayor que" },
    { value: "greater_equal", label: "Mayor o igual que" },
    { value: "less", label: "Menor que" },
    { value: "less_equal", label: "Menor o igual que" },
    { value: "between", label: "Entre" },
  ];
}

export function excelFilterIsActive(filter: ExcelColumnFilter | undefined) {
  return Boolean(filter && (filter.selected !== null || filter.operator !== "none"));
}

/** Valor normalizado con el que se agrupa y compara: números a 2 decimales. */
export function excelFilterBucketValue(rawValue: unknown, kind: ExcelFilterKind) {
  const value = rawValue == null ? "" : String(rawValue).trim();

  if (kind !== "number" || !value) return value;

  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) return value;

  const rounded =
    Math.round((parsed + Math.sign(parsed || 1) * Number.EPSILON) * 100) / 100;

  return (Object.is(rounded, -0) ? 0 : rounded).toFixed(2);
}

export function matchesExcelFilter(
  rawValue: unknown,
  filter: ExcelColumnFilter | undefined,
  kind: ExcelFilterKind
) {
  if (!filter) return true;

  const value = excelFilterBucketValue(rawValue, kind);

  if (filter.selected !== null && !filter.selected.includes(value)) return false;
  if (filter.operator === "none") return true;

  const first = filter.value1.trim();
  const second = filter.value2.trim();

  if (!first && filter.operator !== "between") return true;

  if (kind === "text") {
    const current = value.toLocaleLowerCase("es");
    const a = first.toLocaleLowerCase("es");

    if (filter.operator === "equals") return current === a;
    if (filter.operator === "not_equals") return current !== a;
    if (filter.operator === "contains") return current.includes(a);
    if (filter.operator === "not_contains") return !current.includes(a);
    if (filter.operator === "starts_with") return current.startsWith(a);
    if (filter.operator === "ends_with") return current.endsWith(a);
    return true;
  }

  if (kind === "number") {
    const current = Number(value.replace(",", "."));
    const a = Number(excelFilterBucketValue(first, "number"));
    const b = Number(excelFilterBucketValue(second, "number"));

    if (!Number.isFinite(current) || !Number.isFinite(a)) return false;

    if (filter.operator === "equals") return current === a;
    if (filter.operator === "not_equals") return current !== a;
    if (filter.operator === "greater") return current > a;
    if (filter.operator === "greater_equal") return current >= a;
    if (filter.operator === "less") return current < a;
    if (filter.operator === "less_equal") return current <= a;
    if (filter.operator === "between") {
      return Number.isFinite(b) && current >= Math.min(a, b) && current <= Math.max(a, b);
    }
    return true;
  }

  const current = value.slice(0, 10);
  const a = first.slice(0, 10);
  const b = second.slice(0, 10);

  if (!current || !a) return false;

  if (filter.operator === "equals") return current === a;
  if (filter.operator === "not_equals") return current !== a;
  if (filter.operator === "greater") return current > a;
  if (filter.operator === "greater_equal") return current >= a;
  if (filter.operator === "less") return current < a;
  if (filter.operator === "less_equal") return current <= a;
  if (filter.operator === "between") {
    return Boolean(b) && current >= (a < b ? a : b) && current <= (a > b ? a : b);
  }
  return true;
}

export function compareExcelValues(
  aRaw: unknown,
  bRaw: unknown,
  kind: ExcelFilterKind,
  direction: ExcelSortDirection
) {
  const factor = direction === "asc" ? 1 : -1;
  const a = aRaw == null ? "" : String(aRaw).trim();
  const b = bRaw == null ? "" : String(bRaw).trim();

  if (kind === "number") {
    const aNum = Number(a.replace(",", "."));
    const bNum = Number(b.replace(",", "."));
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) return (aNum - bNum) * factor;
  }

  return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" }) * factor;
}

export type ExcelHeaderFilterProps = {
  label: string;
  kind: ExcelFilterKind;
  values: string[];
  filter?: ExcelColumnFilter;
  sortDirection?: ExcelSortDirection;
  onApply: (filter: ExcelColumnFilter) => void;
  onSort: (direction: ExcelSortDirection) => void;
};

const POPUP_WIDTH = 285;
const POPUP_HEIGHT = 520;
const VIEWPORT_PADDING = 8;

function menuButtonStyle(selected: boolean): CSSProperties {
  return {
    textAlign: "left",
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid rgba(147,211,230,.24)",
    background: selected ? "rgba(27,147,227,.24)" : "rgba(2,35,52,.38)",
    color: "#e8f1f7",
    cursor: "pointer",
  };
}

const menuInputStyle: CSSProperties = {
  width: "100%",
  height: 30,
  padding: "5px 8px",
  borderRadius: 6,
  border: "1px solid rgba(147,211,230,.30)",
  background: "rgba(2,35,52,.58)",
  color: "#e8f1f7",
  outline: "none",
};

const secondaryButtonStyle: CSSProperties = {
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid rgba(147,211,230,.24)",
  background: "transparent",
  color: "#a8c0cf",
  cursor: "pointer",
};

function cloneFilter(filter: ExcelColumnFilter | undefined): ExcelColumnFilter {
  return {
    ...(filter ?? EMPTY_EXCEL_FILTER),
    selected: filter?.selected ? [...filter.selected] : null,
  };
}

export default function ExcelHeaderFilter({
  label,
  kind,
  values,
  filter,
  sortDirection,
  onApply,
  onSort,
}: ExcelHeaderFilterProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number } | null>(null);
  const [search, setSearch] = useState("");
  const [draftFilter, setDraftFilter] = useState<ExcelColumnFilter>(() => cloneFilter(filter));

  const closeMenu = useCallback(() => {
    setOpen(false);
    setPopupPosition(null);
  }, []);

  function toggleMenu() {
    if (open) {
      closeMenu();
      return;
    }
    setSearch("");
    setDraftFilter(cloneFilter(filter));
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) {
        closeMenu();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, closeMenu]);

  const updatePopupPosition = useCallback(() => {
    const anchor = rootRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const gap = 4;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const popupWidth = Math.min(POPUP_WIDTH, Math.max(0, viewportWidth - VIEWPORT_PADDING * 2));
    const popupHeight = Math.min(POPUP_HEIGHT, Math.max(240, viewportHeight - VIEWPORT_PADDING * 2));

    const top = Math.max(
      VIEWPORT_PADDING,
      Math.min(rect.bottom + gap, viewportHeight - popupHeight - VIEWPORT_PADDING)
    );
    const left = Math.min(
      Math.max(VIEWPORT_PADDING, rect.right - popupWidth),
      Math.max(VIEWPORT_PADDING, viewportWidth - popupWidth - VIEWPORT_PADDING)
    );

    setPopupPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;

    updatePopupPosition();
    window.addEventListener("resize", updatePopupPosition);
    window.addEventListener("scroll", updatePopupPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopupPosition);
      window.removeEventListener("scroll", updatePopupPosition, true);
    };
  }, [open, updatePopupPosition]);

  const distinctValues = useMemo(
    () =>
      Array.from(new Set(values.map((value) => excelFilterBucketValue(value, kind)))).sort(
        (a, b) => {
          if (a === "") return -1;
          if (b === "") return 1;

          if (kind === "number") {
            const aNum = Number(a.replace(",", "."));
            const bNum = Number(b.replace(",", "."));
            if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
          }

          return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
        }
      ),
    [values, kind]
  );

  const searchedValues = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("es");
    if (!needle) return distinctValues;
    return distinctValues.filter((value) =>
      (value || "(Vacíos)").toLocaleLowerCase("es").includes(needle)
    );
  }, [distinctValues, search]);

  const selectedSet = useMemo(
    () => new Set(draftFilter.selected === null ? distinctValues : draftFilter.selected),
    [draftFilter.selected, distinctValues]
  );

  const allSelected =
    distinctValues.length > 0 && distinctValues.every((value) => selectedSet.has(value));
  const active = excelFilterIsActive(filter) || Boolean(sortDirection);
  const inputType = kind === "date" ? "date" : kind === "number" ? "number" : "text";

  function toggleValue(value: string, checked: boolean) {
    const next = new Set(draftFilter.selected === null ? distinctValues : draftFilter.selected);
    if (checked) next.add(value);
    else next.delete(value);

    setDraftFilter((current) => ({
      ...current,
      selected: next.size === distinctValues.length ? null : Array.from(next),
    }));
  }

  function toggleAll(checked: boolean) {
    setDraftFilter((current) => ({ ...current, selected: checked ? null : [] }));
  }

  return (
    <div
      ref={rootRef}
      onClick={(event) => event.stopPropagation()}
      style={{ position: "relative", display: "inline-flex", alignItems: "center", flexShrink: 0 }}
    >
      <button
        type="button"
        onClick={toggleMenu}
        aria-label={`Filtrar ${label}`}
        title={`Filtrar ${label}`}
        aria-expanded={open}
        style={{
          width: 19,
          height: 19,
          padding: 0,
          borderRadius: 5,
          border: active ? "1px solid var(--mod)" : "1px solid var(--line)",
          background: active ? "var(--mod-soft)" : "transparent",
          color: active ? "var(--mod)" : "var(--ink-3)",
          fontSize: 9,
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        {active ? "◆" : "▼"}
      </button>

      {open && popupPosition
        ? createPortal(
            <div
              ref={popupRef}
              style={{
                position: "fixed",
                top: popupPosition.top,
                left: popupPosition.left,
                zIndex: 10000,
                width: `min(${POPUP_WIDTH}px, calc(100vw - ${VIEWPORT_PADDING * 2}px))`,
                maxHeight: `calc(100vh - ${VIEWPORT_PADDING * 2}px)`,
                overflowY: "auto",
                padding: 10,
                border: "1px solid rgba(147,211,230,.42)",
                borderRadius: 10,
                background: "#0f2a38",
                boxShadow: "0 14px 32px rgba(0,0,0,.40)",
                color: "#e8f1f7",
                textAlign: "left",
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{label}</div>

              <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    onSort("asc");
                    closeMenu();
                  }}
                  style={menuButtonStyle(sortDirection === "asc")}
                >
                  {kind === "number"
                    ? "Ordenar de menor a mayor"
                    : kind === "date"
                      ? "Ordenar de más antiguo a más reciente"
                      : "Ordenar de A a Z"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSort("desc");
                    closeMenu();
                  }}
                  style={menuButtonStyle(sortDirection === "desc")}
                >
                  {kind === "number"
                    ? "Ordenar de mayor a menor"
                    : kind === "date"
                      ? "Ordenar de más reciente a más antiguo"
                      : "Ordenar de Z a A"}
                </button>
              </div>

              <div style={{ borderTop: "1px solid rgba(147,211,230,.18)", paddingTop: 8 }}>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar valores..."
                  style={menuInputStyle}
                />

                <label
                  style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, fontWeight: 600 }}
                >
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) => toggleAll(event.target.checked)}
                  />
                  Seleccionar todo
                </label>

                <div style={{ maxHeight: 155, overflowY: "auto", marginTop: 5, paddingRight: 3 }}>
                  {searchedValues.map((value) => (
                    <label
                      key={value || "__EMPTY__"}
                      style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 0" }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSet.has(value)}
                        onChange={(event) => toggleValue(value, event.target.checked)}
                      />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {value || "(Vacíos)"}
                      </span>
                    </label>
                  ))}

                  {!searchedValues.length ? (
                    <div style={{ padding: "8px 0", opacity: 0.72 }}>Sin coincidencias</div>
                  ) : null}
                </div>
              </div>

              <div
                style={{
                  borderTop: "1px solid rgba(147,211,230,.18)",
                  marginTop: 8,
                  paddingTop: 8,
                  display: "grid",
                  gap: 6,
                }}
              >
                <select
                  value={draftFilter.operator}
                  onChange={(event) =>
                    setDraftFilter((current) => ({
                      ...current,
                      operator: event.target.value as ExcelFilterOperator,
                    }))
                  }
                  style={{ ...menuInputStyle, padding: "4px 7px", background: "#0a1f2c" }}
                >
                  {excelOperatorOptions(kind).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                {draftFilter.operator !== "none" ? (
                  <input
                    type={inputType}
                    value={draftFilter.value1}
                    step={kind === "number" ? "any" : undefined}
                    onChange={(event) =>
                      setDraftFilter((current) => ({ ...current, value1: event.target.value }))
                    }
                    placeholder={kind === "text" ? "Valor..." : undefined}
                    style={menuInputStyle}
                  />
                ) : null}

                {draftFilter.operator === "between" ? (
                  <input
                    type={inputType}
                    value={draftFilter.value2}
                    step={kind === "number" ? "any" : undefined}
                    onChange={(event) =>
                      setDraftFilter((current) => ({ ...current, value2: event.target.value }))
                    }
                    style={menuInputStyle}
                  />
                ) : null}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    onApply({ ...EMPTY_EXCEL_FILTER });
                    closeMenu();
                  }}
                  style={secondaryButtonStyle}
                >
                  Limpiar filtro
                </button>

                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={closeMenu} style={secondaryButtonStyle}>
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onApply(cloneFilter(draftFilter));
                      closeMenu();
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid rgba(147,211,230,.42)",
                      background: "rgba(27,147,227,.32)",
                      color: "#e8f1f7",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
