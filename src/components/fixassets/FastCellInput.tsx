"use client";

import React, { memo, startTransition, useState } from "react";

type Props = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "onBlur"
> & {
  value: string;
  onCommit: (value: string) => void;
  onLiveChange?: (value: string) => void;
  sanitize?: (value: string) => string;
  normalizeOnBlur?: (value: string) => string;
};

function FastCellInputBase({
  value,
  onCommit,
  onLiveChange,
  sanitize,
  normalizeOnBlur,
  onFocus,
  ...props
}: Props) {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <input
      {...props}
      value={isFocused ? localValue : value}
      onFocus={(event) => {
        setIsFocused(true);
        setLocalValue(value);
        onFocus?.(event);
      }}
      onChange={(event) => {
        const next = sanitize ? sanitize(event.target.value) : event.target.value;
        setLocalValue(next);
        if (onLiveChange) startTransition(() => onLiveChange(next));
      }}
      onBlur={() => {
        setIsFocused(false);
        const next = normalizeOnBlur ? normalizeOnBlur(localValue) : localValue;
        setLocalValue(next);
        if (onLiveChange) startTransition(() => onLiveChange(next));
        onCommit(next);
      }}
    />
  );
}

export const FastCellInput = memo(FastCellInputBase);
