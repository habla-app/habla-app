// Card — átomo base v3.1 (Lote A). Spec:
// docs/ux-spec/00-design-system/componentes-base.md §9.
//
// Variantes:
// - default       → bg-card + border-light + shadow-sm (uso general)
// - elevated      → bg-card + shadow-md (sin border, hero cards)
// - urgent-critical → mcard-critical gradient + border urgent-critical
// - urgent-high   → mcard-high gradient + border urgent-high
// - premium       → premium-card-gradient + border-premium-border (oscuro)
// - outline       → bg-transparent + border-strong (admin)
// - flat          → bg-subtle + sin border (admin secciones)
//
// Padding: p-4 mobile (default), p-3 admin denso, p-6 admin spacious.
// El consumer decide via `padding` prop o sobrescribe con `className`.
import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type CardVariant =
  | "default"
  | "elevated"
  | "urgent-critical"
  | "urgent-high"
  | "premium"
  | "outline"
  | "flat";

export type CardPadding = "none" | "sm" | "md" | "lg";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  asChild?: boolean;
}

const VARIANTS: Record<CardVariant, string> = {
  default: "bg-card border border-light shadow-sm rounded-md",
  elevated: "bg-card shadow-md rounded-md",
  "urgent-critical":
    "bg-mcard-critical border border-urgent-critical shadow-urgent rounded-md",
  "urgent-high":
    "bg-mcard-high border border-urgent-high shadow-urgent-high-glow rounded-md",
  premium:
    "bg-premium-card-gradient border border-premium-border shadow-premium-card rounded-md text-premium-text-on-dark",
  outline: "bg-transparent border border-strong rounded-md",
  flat: "bg-subtle rounded-md",
};

const PADDINGS: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "default", padding = "md", className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(VARIANTS[variant], PADDINGS[padding], className)}
      {...rest}
    />
  );
});
