// IconButton — botón solo ícono. v3.1 (Lote A). Spec:
// docs/ux-spec/00-design-system/componentes-base.md §2.
//
// Para acciones secundarias en mobile (compartir, bookmark) y filas
// densas en admin (editar, eliminar). aria-label OBLIGATORIO.
//
// Variantes: ghost (default), outline, solid.
// Tamaños: sm (32px, admin), md (40px, ambos), lg (48px, mobile sticky).
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type IconButtonVariant = "ghost" | "outline" | "solid";
export type IconButtonSize = "sm" | "md" | "lg";

interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Texto leído por screen readers — OBLIGATORIO. */
  ariaLabel: string;
  icon: ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

const VARIANTS: Record<IconButtonVariant, string> = {
  ghost: "bg-transparent text-muted-d hover:bg-hover hover:text-dark",
  outline:
    "bg-transparent border border-strong text-dark hover:bg-hover",
  solid: "bg-brand-blue-main text-white hover:bg-brand-blue-light",
};

const SIZES: Record<IconButtonSize, string> = {
  sm: "h-8 w-8 text-[14px] rounded-sm",
  md: "h-10 w-10 text-[16px] rounded-md",
  lg: "h-12 w-12 text-[18px] rounded-md",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      ariaLabel,
      icon,
      variant = "ghost",
      size = "md",
      className,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        className={cn(
          "inline-flex items-center justify-center transition-all duration-150",
          "active:scale-[0.95] disabled:opacity-50 disabled:cursor-not-allowed",
          VARIANTS[variant],
          SIZES[size],
          className,
        )}
        {...rest}
      >
        <span aria-hidden>{icon}</span>
      </button>
    );
  },
);
