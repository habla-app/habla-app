// Spinner — indicador de carga circular. v3.1 (Lote A). Spec:
// docs/ux-spec/00-design-system/componentes-base.md §13.
//
// Tamaños: xs (12px), sm (16px), md (24px), lg (32px). Color heredado
// del parent vía `currentColor`. Para casi todos los casos preferir
// <Skeleton> antes que un spinner centrado (que parece error de carga).
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type SpinnerSize = "xs" | "sm" | "md" | "lg";

interface SpinnerProps extends Omit<HTMLAttributes<HTMLSpanElement>, "role"> {
  size?: SpinnerSize;
  /** Texto leído por screen readers. Default "Cargando". */
  label?: string;
}

const SIZES: Record<SpinnerSize, string> = {
  xs: "h-3 w-3 border-[1.5px]",
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-[3px]",
};

export function Spinner({
  size = "md",
  label = "Cargando",
  className,
  ...rest
}: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block animate-spin rounded-full border-current border-t-transparent",
        SIZES[size],
        className,
      )}
      {...rest}
    />
  );
}
