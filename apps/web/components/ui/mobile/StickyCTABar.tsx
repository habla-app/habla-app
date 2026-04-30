"use client";

// StickyCTABar — barra flotante de CTAs encima del BottomNav. v3.1 (Lote A).
// Spec: docs/ux-spec/00-design-system/componentes-mobile.md §3.
//
// Container que contiene 1-2 botones primarios fijos al fondo, dentro de la
// zona del pulgar. Position sticky bottom-[64px] (encima del BottomNav).
//
// Reglas:
// - Solo en vistas con conversión (Producto B, Producto C, Premium landing,
//   Checkout). Nunca en home, perfil, listings.
// - Si hay 2 botones: secondary 30% / primary 70%.
// - El consumer pasa los botones como children o usa props primary/secondary
//   para una API simplificada.
//
// Implementación API: API simple por defecto, escapamos a children si el
// consumer necesita algo más exótico (ej. un Spinner inline).
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import type { ButtonVariant } from "@/components/ui/Button";

interface CTAOption {
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
}

interface StickyCTABarProps {
  primary?: CTAOption;
  secondary?: CTAOption;
  /** Si se pasan children, ignora primary/secondary. */
  children?: ReactNode;
  /** Esconde la barra al hacer scroll hacia abajo. Default false. */
  hideOnScroll?: boolean;
  className?: string;
}

export function StickyCTABar({
  primary,
  secondary,
  children,
  hideOnScroll = false,
  className,
}: StickyCTABarProps) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    if (!hideOnScroll) return;
    function onScroll() {
      const y = window.scrollY;
      // Threshold 8px para evitar flicker por sub-pixel scrolls
      if (y - lastY.current > 8) setHidden(true);
      else if (lastY.current - y > 8) setHidden(false);
      lastY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hideOnScroll]);

  return (
    <div
      role="region"
      aria-label="Acciones principales"
      className={cn(
        // Posición: encima del BottomNav (64px) en mobile, abajo del viewport
        // en desktop (lg+).
        "sticky bottom-[64px] z-sticky px-4 py-3 lg:bottom-4",
        "bg-card shadow-nav-top border-t border-light",
        "transition-transform duration-200",
        hidden && "translate-y-full",
        className,
      )}
    >
      {children ?? (
        <div className="flex items-center gap-2">
          {secondary && (
            <Button
              variant={secondary.variant ?? "ghost"}
              size="lg"
              onClick={secondary.onClick}
              disabled={secondary.disabled || secondary.loading}
              className="flex-[3]"
            >
              {secondary.label}
            </Button>
          )}
          {primary && (
            <Button
              variant={primary.variant ?? "primary"}
              size="lg"
              onClick={primary.onClick}
              disabled={primary.disabled || primary.loading}
              className={cn(secondary ? "flex-[7]" : "w-full")}
            >
              {primary.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
