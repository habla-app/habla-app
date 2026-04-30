// Divider — separador horizontal. v3.1 (Lote A). Spec:
// docs/ux-spec/00-design-system/componentes-base.md §15.
//
// Variantes:
// - solid       → línea simple `border-t border-light`
// - dashed      → línea punteada
// - decorative  → con texto centrado (✂ "Línea de premio", "10°", etc.)
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type DividerVariant = "solid" | "dashed" | "decorative";

interface DividerProps extends HTMLAttributes<HTMLDivElement> {
  variant?: DividerVariant;
  /** Solo aplica a variant="decorative". */
  label?: ReactNode;
}

export function Divider({
  variant = "solid",
  label,
  className,
  ...rest
}: DividerProps) {
  if (variant === "decorative") {
    return (
      <div
        role="separator"
        aria-label={typeof label === "string" ? label : undefined}
        className={cn("flex items-center gap-3 my-3", className)}
        {...rest}
      >
        <span className="h-px flex-1 bg-border-light" />
        {label && (
          <span className="text-label-sm text-muted-d">{label}</span>
        )}
        <span className="h-px flex-1 bg-border-light" />
      </div>
    );
  }

  return (
    <hr
      className={cn(
        "border-0 border-t my-3",
        variant === "dashed"
          ? "border-dashed border-strong"
          : "border-solid border-light",
        className,
      )}
      {...rest}
    />
  );
}
