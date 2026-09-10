// src/components/ui/Button.tsx
import React from "react";

type Variant = "primary" | "ghost" | "default" | "danger";
type Size = "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: { padding: "6px 11px", borderRadius: "var(--r-1)", fontSize: 12.5, height: 30, lineHeight: "18px" },
  md: { padding: "8px 14px", borderRadius: "var(--r-1)", fontSize: 13.5, height: 36, lineHeight: "20px" },
  lg: { padding: "10px 18px", borderRadius: "var(--r-2)", fontSize: 14.5, height: 42, lineHeight: "22px" },
};

const variantStyles: Record<Variant, React.CSSProperties> = {
  default: {
    background: "transparent",
    border: "1px solid var(--line-2)",
    color: "var(--text)",
  },
  ghost: {
    background: "rgba(158,197,220,.06)",
    border: "1px solid var(--line)",
    color: "var(--ink-2)",
  },
  primary: {
    background: "var(--brand-blue)",
    border: "1px solid var(--brand-blue)",
    color: "#ffffff",
  },
  danger: {
    background: "transparent",
    border: "1px solid var(--bad-line)",
    color: "var(--bad)",
  },
};

const hoverStyles: Record<Variant, { background: string; borderColor: string }> = {
  default: { background: "rgba(158,197,220,.10)", borderColor: "var(--ink-3)" },
  ghost: { background: "rgba(158,197,220,.12)", borderColor: "var(--line-2)" },
  primary: { background: "var(--brand-blue-light)", borderColor: "var(--brand-blue-light)" },
  danger: { background: "var(--bad-bg)", borderColor: "var(--bad)" },
};

export function Button({ variant = "default", size = "md", style, disabled, ...props }: Props) {
  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        ...sizeStyles[size],
        ...variantStyles[variant],
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        fontWeight: 600,
        letterSpacing: 0.15,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transition: "background .15s ease, border-color .15s ease",
        ...(style || {}),
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        const h = hoverStyles[variant];
        e.currentTarget.style.background = h.background;
        e.currentTarget.style.borderColor = h.borderColor;
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        const v = variantStyles[variant];
        e.currentTarget.style.border = v.border as string;
        e.currentTarget.style.background = v.background as string;
      }}
    />
  );
}
