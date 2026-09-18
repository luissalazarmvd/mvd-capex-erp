"use client";
import { useRef, useState, type ChangeEvent, type FocusEvent, type InputHTMLAttributes, type KeyboardEvent, type MouseEvent } from "react";

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string;
  onCommit: (value: string) => void;
};

// Selector de fecha para filtros que disparan consultas a endpoints. El
// `<input type="date">` nativo emite `change` en cada flecha o dígito sobre
// un segmento, lo que recargaba la vista (y mostraba el overlay de carga) a
// cada paso. Aquí el valor se mantiene como borrador y solo se confirma
// (`onCommit`) cuando termina la selección: al elegir un día en el popup del
// calendario —único `change` que llega sin teclado previo—, con Enter o al
// salir del campo. Escape descarta el borrador.
export function DateInput({ value, onCommit, onBlur, onClick, onKeyDown, ...props }: DateInputProps) {
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  const typing = useRef(false);

  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value);
  }

  const commit = (next: string) => {
    typing.current = false;
    if (next !== value) onCommit(next);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setDraft(next);
    if (!typing.current) commit(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "Enter") {
      commit(event.currentTarget.value);
    } else if (event.key === "Escape") {
      typing.current = false;
      setDraft(value);
    } else if (event.key !== "Tab") {
      typing.current = true;
    }
  };

  const handleClick = (event: MouseEvent<HTMLInputElement>) => {
    onClick?.(event);
    typing.current = false;
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    onBlur?.(event);
    commit(event.currentTarget.value);
  };

  return (
    <input
      {...props}
      type="date"
      value={draft}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      onBlur={handleBlur}
    />
  );
}
