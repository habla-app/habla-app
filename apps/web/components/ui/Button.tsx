// Button — primitiva base traducida de `.btn` del mockup (docs/habla-mockup-completo.html).
// Variantes: primary, ghost, danger, secondary. Tamaños: md (default), lg, xl.
import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "ghost" | "danger" | "secondary";
export type ButtonSize = "md" | "lg" | "xl";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

// --------------------------------------------------------------------------
// Las clases siguen las reglas del mockup línea por línea. Se exportan
// también para que componentes afines (ej. CTAs internas de match cards
// o anchor tags) puedan reusarlas sin envolver en <button>.
// --------------------------------------------------------------------------

export const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm px-5 py-[11px] text-[13px] font-bold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60";

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-gold text-black shadow-gold-btn hover:bg-brand-gold-light hover:-translate-y-px hover:shadow-gold",
  ghost:
    "border-[1.5px] border-strong bg-transparent text-body hover:border-brand-blue-main hover:text-brand-blue-main",
  danger:
    "border border-urgent-critical/30 bg-urgent-critical/10 text-danger hover:bg-urgent-critical/20",
  secondary:
    "bg-brand-blue-main text-white hover:bg-brand-blue-light",
};

export const BUTTON_SIZES: Record<ButtonSize, string> = {
  md: "",
  lg: "rounded-md px-7 py-[14px] text-[14px]",
  xl: "w-full rounded-md px-4 py-4 font-display text-[16px] font-extrabold uppercase tracking-[0.04em]",
};

export function buttonClassName({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}): string {
  return [
    BUTTON_BASE,
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClassName({ variant, size, className })}
      {...rest}
    />
  );
});
