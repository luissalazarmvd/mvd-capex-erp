"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
): Array<{
  value: ExcelFilterOperator;
  label: string;
}> {
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

export function excelFilterIsActive(
  filter: ExcelColumnFilter | undefined
) {
  return Boolean(
    filter &&
      (
        filter.selected !== null ||
        filter.operator !== "none"
      )
  );
}

export function excelFilterBucketValue(
  rawValue: unknown,
  kind: ExcelFilterKind
) {
  const value =
    rawValue == null ? "" : String(rawValue).trim();

  if (kind !== "number" || !value) {
    return value;
  }

  const parsed = Number(value.replace(",", "."));

  if (!Number.isFinite(parsed)) {
    return value;
  }

  const rounded =
    Math.round(
      (
        parsed +
        Math.sign(parsed || 1) * Number.EPSILON
      ) * 100
    ) / 100;

  return (
    Object.is(rounded, -0) ? 0 : rounded
  ).toFixed(2);
}

export function matchesExcelFilter(
  rawValue: unknown,
  filter: ExcelColumnFilter | undefined,
  kind: ExcelFilterKind
) {
  if (!filter) return true;

  const value = excelFilterBucketValue(
    rawValue,
    kind
  );

  if (
    filter.selected !== null &&
    !filter.selected.includes(value)
  ) {
    return false;
  }

  if (filter.operator === "none") {
    return true;
  }

  const first = filter.value1.trim();
  const second = filter.value2.trim();

  if (
    !first &&
    filter.operator !== "between"
  ) {
    return true;
  }

  if (kind === "text") {
    const current =
      value.toLocaleLowerCase("es");
    const a =
      first.toLocaleLowerCase("es");

    if (filter.operator === "equals") {
      return current === a;
    }

    if (filter.operator === "not_equals") {
      return current !== a;
    }

    if (filter.operator === "contains") {
      return current.includes(a);
    }

    if (filter.operator === "not_contains") {
      return !current.includes(a);
    }

    if (filter.operator === "starts_with") {
      return current.startsWith(a);
    }

    if (filter.operator === "ends_with") {
      return current.endsWith(a);
    }

    return true;
  }

  if (kind === "number") {
    const current = Number(
      value.replace(",", ".")
    );

    const a = Number(
      excelFilterBucketValue(
        first,
        "number"
      )
    );

    const b = Number(
      excelFilterBucketValue(
        second,
        "number"
      )
    );

    if (
      !Number.isFinite(current) ||
      !Number.isFinite(a)
    ) {
      return false;
    }

    if (filter.operator === "equals") {
      return current === a;
    }

    if (filter.operator === "not_equals") {
      return current !== a;
    }

    if (filter.operator === "greater") {
      return current > a;
    }

    if (filter.operator === "greater_equal") {
      return current >= a;
    }

    if (filter.operator === "less") {
      return current < a;
    }

    if (filter.operator === "less_equal") {
      return current <= a;
    }

    if (filter.operator === "between") {
      return (
        Number.isFinite(b) &&
        current >= Math.min(a, b) &&
        current <= Math.max(a, b)
      );
    }

    return true;
  }

  const current = value.slice(0, 10);
  const a = first.slice(0, 10);
  const b = second.slice(0, 10);

  if (!current || !a) {
    return false;
  }

  if (filter.operator === "equals") {
    return current === a;
  }

  if (filter.operator === "not_equals") {
    return current !== a;
  }

  if (filter.operator === "greater") {
    return current > a;
  }

  if (filter.operator === "greater_equal") {
    return current >= a;
  }

  if (filter.operator === "less") {
    return current < a;
  }

  if (filter.operator === "less_equal") {
    return current <= a;
  }

  if (filter.operator === "between") {
    return (
      Boolean(b) &&
      current >= (a < b ? a : b) &&
      current <= (a > b ? a : b)
    );
  }

  return true;
}

export function compareExcelValues(
  aRaw: unknown,
  bRaw: unknown,
  kind: ExcelFilterKind,
  direction: ExcelSortDirection
) {
  const factor =
    direction === "asc" ? 1 : -1;

  const a =
    aRaw == null ? "" : String(aRaw).trim();

  const b =
    bRaw == null ? "" : String(bRaw).trim();

  if (kind === "number") {
    const aNum = Number(
      a.replace(",", ".")
    );

    const bNum = Number(
      b.replace(",", ".")
    );

    if (
      Number.isFinite(aNum) &&
      Number.isFinite(bNum)
    ) {
      return (aNum - bNum) * factor;
    }
  }

  return (
    a.localeCompare(
      b,
      "es",
      {
        numeric: true,
        sensitivity: "base",
      }
    ) * factor
  );
}

type Props = {
  label: string;
  kind: ExcelFilterKind;
  values: string[];
  filter?: ExcelColumnFilter;
  sortDirection?: ExcelSortDirection;
  onApply: (
    filter: ExcelColumnFilter
  ) => void;
  onSort: (
    direction: ExcelSortDirection
  ) => void;
};

export default function ExcelHeaderFilter({
  label,
  kind,
  values,
  filter,
  sortDirection,
  onApply,
  onSort,
}: Props) {
  const rootRef =
    useRef<HTMLDivElement | null>(null);

  const popupRef =
    useRef<HTMLDivElement | null>(null);

  const [open, setOpen] =
    useState(false);

  const [
    popupPosition,
    setPopupPosition,
  ] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const [search, setSearch] =
    useState("");

  const [
    draftFilter,
    setDraftFilter,
  ] = useState<ExcelColumnFilter>(
    () =>
      filter ||
      EMPTY_EXCEL_FILTER
  );

  useEffect(() => {
    if (!open) return;

    setSearch("");

    setDraftFilter(
      filter
        ? {
            ...filter,
            selected:
              filter.selected
                ? [...filter.selected]
                : null,
          }
        : {
            ...EMPTY_EXCEL_FILTER,
          }
    );
  }, [open, filter]);

  useEffect(() => {
    if (!open) return;

    const close = (
      event: MouseEvent
    ) => {
      const target =
        event.target as Node;

      if (
        !rootRef.current?.contains(target) &&
        !popupRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      close
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        close
      );
  }, [open]);

  const updatePopupPosition =
    useCallback(() => {
      const anchor =
        rootRef.current;

      if (!anchor) return;

      const rect =
        anchor.getBoundingClientRect();

      const viewportPadding = 8;
      const gap = 4;
      const viewportHeight =
        window.innerHeight;
      const viewportWidth =
        window.innerWidth;

      const popupWidth =
        Math.min(
          285,
          Math.max(
            0,
            viewportWidth -
              viewportPadding * 2
          )
        );

      const maxPopupHeight =
        Math.max(
          240,
          viewportHeight -
            viewportPadding * 2
        );

      const preferredPopupHeight =
        Math.min(
          520,
          maxPopupHeight
        );

      const top =
        Math.max(
          viewportPadding,
          Math.min(
            rect.bottom + gap,
            viewportHeight -
              preferredPopupHeight -
              viewportPadding
          )
        );

      const left =
        Math.min(
          Math.max(
            viewportPadding,
            rect.right - popupWidth
          ),
          Math.max(
            viewportPadding,
            viewportWidth -
              popupWidth -
              viewportPadding
          )
        );

      setPopupPosition({
        top,
        left,
      });
    }, []);

  useEffect(() => {
    if (!open) {
      setPopupPosition(null);
      return;
    }

    updatePopupPosition();

    const reposition = () =>
      updatePopupPosition();

    window.addEventListener(
      "resize",
      reposition
    );

    window.addEventListener(
      "scroll",
      reposition,
      true
    );

    return () => {
      window.removeEventListener(
        "resize",
        reposition
      );

      window.removeEventListener(
        "scroll",
        reposition,
        true
      );
    };
  }, [
    open,
    updatePopupPosition,
  ]);

  const distinctValues =
    useMemo(
      () =>
        Array.from(
          new Set(
            values.map((value) =>
              excelFilterBucketValue(
                value,
                kind
              )
            )
          )
        ).sort((a, b) => {
          if (a === "") return -1;
          if (b === "") return 1;

          if (kind === "number") {
            const aNum =
              Number(
                a.replace(",", ".")
              );

            const bNum =
              Number(
                b.replace(",", ".")
              );

            if (
              Number.isFinite(aNum) &&
              Number.isFinite(bNum)
            ) {
              return aNum - bNum;
            }
          }

          return a.localeCompare(
            b,
            "es",
            {
              numeric: true,
              sensitivity: "base",
            }
          );
        }),
      [values, kind]
    );

  const searchedValues =
    useMemo(() => {
      const needle =
        search
          .trim()
          .toLocaleLowerCase("es");

      if (!needle) {
        return distinctValues;
      }

      return distinctValues.filter(
        (value) =>
          (
            value ||
            "(Vacíos)"
          )
            .toLocaleLowerCase("es")
            .includes(needle)
      );
    }, [
      distinctValues,
      search,
    ]);

  const selectedSet =
    useMemo(
      () =>
        new Set(
          draftFilter.selected === null
            ? distinctValues
            : draftFilter.selected
        ),
      [
        draftFilter.selected,
        distinctValues,
      ]
    );

  const allSelected =
    distinctValues.length > 0 &&
    distinctValues.every(
      (value) =>
        selectedSet.has(value)
    );

  const active =
    excelFilterIsActive(filter) ||
    Boolean(sortDirection);

  const firstInputType =
    kind === "date"
      ? "date"
      : kind === "number"
        ? "number"
        : "text";

  function toggleValue(
    value: string,
    checked: boolean
  ) {
    const next =
      new Set(
        draftFilter.selected === null
          ? distinctValues
          : draftFilter.selected
      );

    if (checked) {
      next.add(value);
    } else {
      next.delete(value);
    }

    setDraftFilter(
      (current) => ({
        ...current,
        selected:
          next.size ===
          distinctValues.length
            ? null
            : Array.from(next),
      })
    );
  }

  function toggleAll(
    checked: boolean
  ) {
    setDraftFilter(
      (current) => ({
        ...current,
        selected:
          checked
            ? null
            : [],
      })
    );
  }

  return (
    <div
      ref={rootRef}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      <button
        type="button"
        onClick={() =>
          setOpen(
            (current) => !current
          )
        }
        aria-label={`Filtrar ${label}`}
        title={`Filtrar ${label}`}
        style={{
          width: 20,
          height: 20,
          padding: 0,
          borderRadius: 5,
          border: active
            ? "1px solid rgba(147,211,230,.72)"
            : "1px solid rgba(147,211,230,.30)",
          background: active
            ? "rgba(27,147,227,.32)"
            : "rgba(2,35,52,.34)",
          color: "#eaf8ff",
          fontSize: 10,
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        {active ? "◆" : "▼"}
      </button>

      {open &&
      popupPosition
        ? createPortal(
            <div
              ref={popupRef}
              style={{
                position: "fixed",
                top:
                  popupPosition.top,
                left:
                  popupPosition.left,
                zIndex: 10000,
                width:
                  "min(285px, calc(100vw - 16px))",
                maxHeight:
                  "calc(100vh - 16px)",
                overflowY:
                  "auto",
                padding: 10,
                border:
                  "1px solid rgba(147,211,230,.42)",
                borderRadius: 10,
                background:
                  "#07364d",
                boxShadow:
                  "0 14px 32px rgba(0,0,0,.40)",
                color:
                  "#f4fbff",
                textAlign:
                  "left",
                fontSize: 12,
              }}
            >
              <div
                style={{
                  fontWeight: 900,
                  marginBottom: 8,
                }}
              >
                {label}
              </div>

              <div
                style={{
                  display:
                    "grid",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSort("asc");
                    setOpen(false);
                  }}
                  style={{
                    textAlign:
                      "left",
                    padding:
                      "6px 8px",
                    borderRadius: 7,
                    border:
                      "1px solid rgba(147,211,230,.24)",
                    background:
                      sortDirection ===
                      "asc"
                        ? "rgba(27,147,227,.24)"
                        : "rgba(2,35,52,.38)",
                    color:
                      "#f4fbff",
                    cursor:
                      "pointer",
                  }}
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
                    setOpen(false);
                  }}
                  style={{
                    textAlign:
                      "left",
                    padding:
                      "6px 8px",
                    borderRadius: 7,
                    border:
                      "1px solid rgba(147,211,230,.24)",
                    background:
                      sortDirection ===
                      "desc"
                        ? "rgba(27,147,227,.24)"
                        : "rgba(2,35,52,.38)",
                    color:
                      "#f4fbff",
                    cursor:
                      "pointer",
                  }}
                >
                  {kind === "number"
                    ? "Ordenar de mayor a menor"
                    : kind === "date"
                      ? "Ordenar de más reciente a más antiguo"
                      : "Ordenar de Z a A"}
                </button>
              </div>

              <div
                style={{
                  borderTop:
                    "1px solid rgba(147,211,230,.18)",
                  paddingTop: 8,
                }}
              >
                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Buscar valores..."
                  style={{
                    width: "100%",
                    height: 30,
                    padding:
                      "5px 8px",
                    borderRadius: 7,
                    border:
                      "1px solid rgba(147,211,230,.30)",
                    background:
                      "rgba(2,35,52,.58)",
                    color:
                      "#f4fbff",
                    outline:
                      "none",
                  }}
                />

                <label
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap: 7,
                    marginTop: 8,
                    fontWeight: 800,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={
                      allSelected
                    }
                    onChange={(
                      event
                    ) =>
                      toggleAll(
                        event
                          .target
                          .checked
                      )
                    }
                  />
                  Seleccionar todo
                </label>

                <div
                  style={{
                    maxHeight: 155,
                    overflowY:
                      "auto",
                    marginTop: 5,
                    paddingRight: 3,
                  }}
                >
                  {searchedValues.map(
                    (value) => (
                      <label
                        key={
                          value ||
                          "__EMPTY__"
                        }
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap: 7,
                          padding:
                            "3px 0",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSet.has(
                            value
                          )}
                          onChange={(
                            event
                          ) =>
                            toggleValue(
                              value,
                              event
                                .target
                                .checked
                            )
                          }
                        />

                        <span
                          style={{
                            overflow:
                              "hidden",
                            textOverflow:
                              "ellipsis",
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {value ||
                            "(Vacíos)"}
                        </span>
                      </label>
                    )
                  )}

                  {!searchedValues.length && (
                    <div
                      style={{
                        padding:
                          "8px 0",
                        opacity:
                          0.72,
                      }}
                    >
                      Sin coincidencias
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  borderTop:
                    "1px solid rgba(147,211,230,.18)",
                  marginTop: 8,
                  paddingTop: 8,
                  display:
                    "grid",
                  gap: 6,
                }}
              >
                <select
                  value={
                    draftFilter.operator
                  }
                  onChange={(
                    event
                  ) =>
                    setDraftFilter(
                      (current) => ({
                        ...current,
                        operator:
                          event
                            .target
                            .value as ExcelFilterOperator,
                      })
                    )
                  }
                  style={{
                    width: "100%",
                    height: 30,
                    padding:
                      "4px 7px",
                    borderRadius: 7,
                    border:
                      "1px solid rgba(147,211,230,.30)",
                    background:
                      "#0b4d6b",
                    color:
                      "#f4fbff",
                  }}
                >
                  {excelOperatorOptions(
                    kind
                  ).map(
                    (option) => (
                      <option
                        key={
                          option.value
                        }
                        value={
                          option.value
                        }
                      >
                        {
                          option.label
                        }
                      </option>
                    )
                  )}
                </select>

                {draftFilter.operator !==
                  "none" && (
                  <input
                    type={
                      firstInputType
                    }
                    value={
                      draftFilter.value1
                    }
                    step={
                      kind ===
                      "number"
                        ? "any"
                        : undefined
                    }
                    onChange={(
                      event
                    ) =>
                      setDraftFilter(
                        (
                          current
                        ) => ({
                          ...current,
                          value1:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    placeholder={
                      kind ===
                      "text"
                        ? "Valor..."
                        : undefined
                    }
                    style={{
                      width:
                        "100%",
                      height: 30,
                      padding:
                        "5px 8px",
                      borderRadius: 7,
                      border:
                        "1px solid rgba(147,211,230,.30)",
                      background:
                        "rgba(2,35,52,.58)",
                      color:
                        "#f4fbff",
                      outline:
                        "none",
                    }}
                  />
                )}

                {draftFilter.operator ===
                  "between" && (
                  <input
                    type={
                      firstInputType
                    }
                    value={
                      draftFilter.value2
                    }
                    step={
                      kind ===
                      "number"
                        ? "any"
                        : undefined
                    }
                    onChange={(
                      event
                    ) =>
                      setDraftFilter(
                        (
                          current
                        ) => ({
                          ...current,
                          value2:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    style={{
                      width:
                        "100%",
                      height: 30,
                      padding:
                        "5px 8px",
                      borderRadius: 7,
                      border:
                        "1px solid rgba(147,211,230,.30)",
                      background:
                        "rgba(2,35,52,.58)",
                      color:
                        "#f4fbff",
                      outline:
                        "none",
                    }}
                  />
                )}
              </div>

              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  gap: 6,
                  marginTop: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    onApply({
                      ...EMPTY_EXCEL_FILTER,
                    });
                    setOpen(false);
                  }}
                  style={{
                    padding:
                      "6px 8px",
                    borderRadius: 7,
                    border:
                      "1px solid rgba(147,211,230,.24)",
                    background:
                      "transparent",
                    color:
                      "#d8eef8",
                    cursor:
                      "pointer",
                  }}
                >
                  Limpiar filtro
                </button>

                <div
                  style={{
                    display:
                      "flex",
                    gap: 6,
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpen(false)
                    }
                    style={{
                      padding:
                        "6px 8px",
                      borderRadius: 7,
                      border:
                        "1px solid rgba(147,211,230,.24)",
                      background:
                        "transparent",
                      color:
                        "#d8eef8",
                      cursor:
                        "pointer",
                    }}
                  >
                    Cancelar
                  </button>
                  

                  <button
                    type="button"
                    onClick={() => {
                      onApply(
                        draftFilter
                      );
                      setOpen(false);
                    }}
                    style={{
                      padding:
                        "6px 10px",
                      borderRadius: 7,
                      border:
                        "1px solid rgba(147,211,230,.42)",
                      background:
                        "rgba(27,147,227,.32)",
                      color:
                        "#f4fbff",
                      fontWeight: 900,
                      cursor:
                        "pointer",
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