// src/components/ui/Button.tsx
import React from "react";

type Variant = "primary" | "ghost" | "default" | "danger";
type Size = "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: { padding: "6px 10px", borderRadius: 10, fontSize: 13, height: 34, lineHeight: "22px" },
  md: { padding: "10px 14px", borderRadius: 12, fontSize: 14, height: 40, lineHeight: "24px" },
  lg: { padding: "12px 16px", borderRadius: 14, fontSize: 15, height: 46, lineHeight: "26px" },
};

const variantStyles: Record<Variant, React.CSSProperties> = {
  default: {
    background: "rgba(0,0,0,.12)",
    border: "1px solid var(--border)",
    color: "var(--text)",
  },
  ghost: {
    background: "rgba(255,255,255,.08)",
    border: "1px solid var(--border)",
    color: "var(--text)",
  },
  primary: {
    background: "rgba(102,199,255,.22)",
    border: "1px solid rgba(102,199,255,.55)",
    color: "var(--text)",
  },
  danger: {
    background: "rgba(255,80,80,.18)",
    border: "1px solid rgba(255,80,80,.45)",
    color: "var(--text)",
  },
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
        gap: 8,
        fontWeight: 800,
        letterSpacing: 0.2,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "all .15s ease",
        ...(style || {}),
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.borderColor = "rgba(102,199,255,.75)";
        e.currentTarget.style.background = variant === "primary" ? "rgba(102,199,255,.28)" : "rgba(0,0,0,.18)";
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        const v = variantStyles[variant];
        e.currentTarget.style.borderColor =
          (v.border as string)?.includes("rgba") ? (v.border as string).split(" ").pop()! : "var(--border)";
        e.currentTarget.style.background = v.background as string;
      }}
    />
  );
}
