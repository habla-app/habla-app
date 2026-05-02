// Badge — píldora de estado. v3.1 (Lote A). Spec:
// docs/ux-spec/00-design-system/componentes-base.md §8.
//
// Variantes:
// - gold              → ★ MEJOR CUOTA, ⭐ DESTACADO
// - urgent-critical   → "Cierra en 8 min"
// - urgent-high       → "Mañana 3pm"
// - info              → "Verificada MINCETUR"
// - success           → "Activa", "Pagado"
// - warning           → "Pendiente"
// - danger            → "Cancelada"
// - live              → ● EN VIVO (pulse animado)
// - premium           → 💎 PREMIUM (dorado)
// - neutral           → píldora gris discreta
//
// Tamaños: sm (10px, mobile chip mini), md (12px, default), lg (14px,
// mobile prominente).
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeVariant =
  | "gold"
  | "urgent-critical"
  | "urgent-high"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "live"
  | "premium"
  | "neutral";

export type BadgeSize = "sm" | "md" | "lg";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const VARIANTS: Record<BadgeVariant, string> = {
  gold: "bg-brand-gold text-black",
  "urgent-critical": "bg-urgent-critical-bg text-urgent-critical",
  "urgent-high": "bg-urgent-high-bg text-urgent-high-dark",
  info: "bg-alert-info-bg text-alert-info-text border border-alert-info-border",
  success:
    "bg-alert-success-bg text-alert-success-text border border-alert-success-border",
  warning:
    "bg-alert-warning-bg text-alert-warning-text border border-alert-warning-border",
  danger:
    "bg-alert-danger-bg text-alert-danger-text border border-alert-danger-border",
  live: "bg-urgent-critical text-white",
  premium:
    "bg-premium-card-gradient text-brand-gold border border-premium-border",
  neutral: "bg-status-neutral-bg text-status-neutral-text",
};

const SIZES: Record<BadgeSize, string> = {
  sm: "text-label-sm h-5 px-2",
  md: "text-label-md h-6 px-2.5",
  lg: "text-display-xs h-7 px-3",
};

export function Badge({
  variant = "neutral",
  size = "md",
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-full font-bold",
        VARIANTS[variant],
        SIZES[size],
        variant === "live" && "animate-live-pulse",
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
