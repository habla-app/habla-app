// Chip — primitiva traducida de `.chip` del mockup. Patrón reutilizable
// para filter chips (ligas, categorías). Estado activo → dorado.
import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export const CHIP_BASE =
  "flex-shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-semibold shadow-sm transition-all duration-150";

export const CHIP_NEUTRAL =
  "border-light bg-card text-muted-d hover:border-brand-gold hover:bg-chip-hover hover:text-brand-gold-dark";

export const CHIP_ACTIVE =
  "border-brand-gold bg-brand-gold font-bold text-black";

export function chipClassName(active: boolean, className?: string): string {
  return [CHIP_BASE, active ? CHIP_ACTIVE : CHIP_NEUTRAL, className]
    .filter(Boolean)
    .join(" ");
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { active = false, className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={active}
      className={chipClassName(active, className)}
      {...rest}
    />
  );
});
