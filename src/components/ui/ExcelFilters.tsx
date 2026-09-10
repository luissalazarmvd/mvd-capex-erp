// src/components/ui/ExcelFilters.tsx
//
// Capa de conveniencia sobre `ExcelHeaderFilter`: encapsula el estado de
// filtros por columna, el orden y el cálculo de valores distintos, de modo
// que montar filtros tipo Excel en una tabla existente no requiera tocar su
// carga de datos ni su guardado.
//
// Uso:
//   const excel = useExcelColumnFilters(rows, COLUMNS);
//   ...
//   <th>Placa <ExcelHeaderFilter {...excel.headerProps("placa")} /></th>
//   ...
//   {excel.rows.map(...)}

"use client";

import { useCallback, useMemo, useState } from "react";

import ExcelHeaderFilter, {
  compareExcelValues,
  excelFilterBucketValue,
  excelFilterIsActive,
  matchesExcelFilter,
  type ExcelColumnFilter,
  type ExcelFilterKind,
  type ExcelSortDirection,
} from "../trj-kardex/ExcelHeaderFilter";

export { ExcelHeaderFilter };
export type { ExcelColumnFilter, ExcelFilterKind, ExcelSortDirection };

export type ExcelColumnDef<T> = {
  key: string;
  label: string;
  kind?: ExcelFilterKind;
  value: (row: T) => unknown;
};

export function useExcelColumnFilters<T>(
  rows: T[],
  columns: Array<ExcelColumnDef<T>>
) {
  const [filters, setFilters] = useState<Record<string, ExcelColumnFilter>>({});

  const [sort, setSort] = useState<{
    key: string;
    direction: ExcelSortDirection;
  } | null>(null);

  const byKey = useMemo(() => {
    const map = new Map<string, ExcelColumnDef<T>>();
    columns.forEach((column) => map.set(column.key, column));
    return map;
  }, [columns]);

  const values = useMemo(() => {
    const result: Record<string, string[]> = {};

    columns.forEach((column) => {
      const kind = column.kind || "text";
      const seen = new Set<string>();

      rows.forEach((row) => {
        seen.add(excelFilterBucketValue(column.value(row), kind));
      });

      result[column.key] = Array.from(seen);
    });

    return result;
  }, [rows, columns]);

  const visibleRows = useMemo(() => {
    const entries = Object.entries(filters);

    const filtered = entries.length
      ? rows.filter((row) =>
          entries.every(([key, filter]) => {
            const column = byKey.get(key);
            if (!column) return true;

            return matchesExcelFilter(
              column.value(row),
              filter,
              column.kind || "text"
            );
          })
        )
      : rows;

    if (!sort) return filtered;

    const column = byKey.get(sort.key);
    if (!column) return filtered;

    return [...filtered].sort((a, b) =>
      compareExcelValues(
        column.value(a),
        column.value(b),
        column.kind || "text",
        sort.direction
      )
    );
  }, [rows, filters, sort, byKey]);

  const headerProps = useCallback(
    (key: string) => {
      const column = byKey.get(key);

      return {
        label: column?.label || key,
        kind: (column?.kind || "text") as ExcelFilterKind,
        values: values[key] || [],
        filter: filters[key],
        sortDirection: sort?.key === key ? sort.direction : undefined,
        onApply: (filter: ExcelColumnFilter) => {
          setFilters((current) => {
            const next = { ...current };

            if (excelFilterIsActive(filter)) next[key] = filter;
            else delete next[key];

            return next;
          });
        },
        onSort: (direction: ExcelSortDirection) => {
          setSort({ key, direction });
        },
      };
    },
    [byKey, values, filters, sort]
  );

  const clear = useCallback(() => {
    setFilters({});
    setSort(null);
  }, []);

  const activeCount = useMemo(
    () => Object.values(filters).filter(excelFilterIsActive).length,
    [filters]
  );

  return {
    rows: visibleRows,
    headerProps,
    clear,
    activeCount,
    hasSort: Boolean(sort),
  };
}
