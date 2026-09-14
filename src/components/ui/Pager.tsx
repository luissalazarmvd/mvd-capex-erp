// src/components/ui/Pager.tsx
//
// Paginador compacto de las tablas: ← Página X / Y →. Los límites se
// deshabilitan solos; `disabled` bloquea ambos botones durante carga o guardado.
import { Button } from "./Button";

type Props = {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  disabled?: boolean;
  minWidth?: number;
};

export function Pager({ page, totalPages, onPrev, onNext, disabled = false, minWidth = 90 }: Props) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <Button
        type="button"
        size="sm"
        variant="default"
        onClick={onPrev}
        disabled={disabled || page <= 1}
        aria-label="Página anterior"
      >
        ←
      </Button>

      <div
        style={{
          minWidth,
          textAlign: "center",
          fontSize: 12,
          fontWeight: 700,
          padding: "6px 10px",
          borderRadius: "var(--r-pill)",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(216,238,255,.18)",
        }}
      >
        Página {page} / {totalPages}
      </div>

      <Button
        type="button"
        size="sm"
        variant="default"
        onClick={onNext}
        disabled={disabled || page >= totalPages}
        aria-label="Página siguiente"
      >
        →
      </Button>
    </div>
  );
}
