"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "../ui/Button";
import type { VaiExportBlock, VaiExportTable } from "../../lib/vai/export";

type ExportContextValue = {
  busy: boolean;
  disabled: boolean;
  context: string[];
  run: (action: () => Promise<void>) => void;
  register: (id: string, order: number, get: () => VaiExportBlock) => () => void;
};
const ExportContext = createContext<ExportContextValue | null>(null);

export function VaiExportProvider({ title, context, disabled, children }: { title: string; context: string[]; disabled: boolean; children: ReactNode }) {
  const blocks = useRef(new Map<string, { order: number; get: () => VaiExportBlock }>());
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const register = useCallback((id: string, order: number, get: () => VaiExportBlock) => {
    blocks.current.set(id, { order, get });
    return () => { blocks.current.delete(id); };
  }, []);
  const run = useCallback((action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setError("");
    void action().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo exportar. Inténtalo de nuevo.")).finally(() => { lock.current = false; setBusy(false); });
  }, []);
  return (
    <ExportContext.Provider value={{ busy, disabled, context, run, register }}>
      <div className="vai-export-toolbar" data-vai-export-ignore>
        <span className="muted" aria-live="polite">{busy ? "Preparando archivo…" : "Exporta con los filtros actuales y todas las páginas de las tablas."}</span>
        <Button size="sm" disabled={disabled || busy} onClick={() => run(async () => {
          const { downloadDashboardPdf } = await import("../../lib/vai/export");
          await downloadDashboardPdf(title, [...blocks.current.values()].sort((a, b) => a.order - b.order).map((item) => item.get()), context);
        })}>Exportar dashboard a PDF</Button>
      </div>
      {error ? <div className="vai-message" data-error="true" role="alert">{error}</div> : null}
      {children}
    </ExportContext.Provider>
  );
}

export function VaiExportSection({ id, order = 0, title, kind, table, children, controls }: {
  id?: string; order?: number; title: string; kind: VaiExportBlock["kind"]; table?: VaiExportTable; children: ReactNode; controls?: ReactNode;
}) {
  const context = useContext(ExportContext);
  const ref = useRef<HTMLDivElement>(null);
  const register = context?.register;
  useEffect(() => {
    if (!id || !register) return;
    return register(id, order, () => ({ title, kind, table, element: ref.current }));
  }, [id, register, order, title, kind, table]);
  return (
    <div className="vai-export-section">
      <div className="vai-export-tools" data-vai-export-ignore>
        {controls}
        <Button size="sm" variant="ghost" disabled={!context || context.disabled || context.busy} aria-label={`Exportar ${title} a PDF`} onClick={() => context?.run(async () => {
          const { downloadDashboardPdf } = await import("../../lib/vai/export");
          await downloadDashboardPdf(title, [{ title, kind, table, element: ref.current }], context.context);
        })}>PDF</Button>
        {table ? <Button size="sm" variant="ghost" disabled={!context || context.disabled || context.busy} aria-label={`Exportar ${title} a Excel`} onClick={() => context?.run(async () => {
          const { downloadTableExcel } = await import("../../lib/vai/export");
          await downloadTableExcel(title, table);
        })}>Excel</Button> : null}
      </div>
      <div ref={ref} className="vai-export-content">{children}</div>
    </div>
  );
}
