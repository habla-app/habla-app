// KbdHint — indicador visual de atajo de teclado. Lote F (May 2026).
// Spec: docs/ux-spec/05-pista-admin-operacion/00-layout-admin.spec.md
// + componentes-admin.md.
//
// Uso:
//   <KbdHint>A</KbdHint>  → "[A]" estilizado
//   <KbdHint>↑↓</KbdHint>
//
// Reusable en topbar y en botones de acción (ej:
// <Button>Aprobar <KbdHint>A</KbdHint></Button>).
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface KbdHintProps {
  children: ReactNode;
  /** Tamaño visual. xs por default (compacto). */
  size?: "xs" | "sm";
  /** Tono. `dark` para sidebar/topbar oscuro, `light` para fondos claros. */
  tone?: "dark" | "light";
  className?: string;
}

const SIZE: Record<NonNullable<KbdHintProps["size"]>, string> = {
  xs: "h-4 min-w-4 px-1 text-[10px]",
  sm: "h-5 min-w-5 px-1.5 text-[11px]",
};

const TONE: Record<NonNullable<KbdHintProps["tone"]>, string> = {
  light: "border-strong bg-subtle text-dark",
  dark: "border-white/20 bg-white/10 text-white",
};

export function KbdHint({
  children,
  size = "xs",
  tone = "light",
  className,
}: KbdHintProps) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center rounded-sm border font-mono font-bold leading-none",
        SIZE[size],
        TONE[tone],
        className,
      )}
    >
      {children}
    </kbd>
  );
}
