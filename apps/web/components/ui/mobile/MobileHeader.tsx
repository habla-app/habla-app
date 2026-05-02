"use client";

// MobileHeader — header sticky superior pista usuario v3.1 (Lote A). Spec:
// docs/ux-spec/00-design-system/componentes-mobile.md §1.
//
// Reemplaza al `<PublicHeader>` actual (Lote 8) con versión optimizada
// mobile. Altura fija 56px, sticky top, z-header. Tres variantes:
//
// - public:      bg-card + border-bottom (capa pública)
// - main:        bg-card + border-bottom + avatar a la derecha (capa auth)
// - transparent: sin fondo (se monta sobre hero coloreado tipo /partidos)
//
// Slots:
// - showBack:    botón ← arriba izquierda. Si onBack está definido, usa
//                callback; si no, router.back().
// - showLogo:    logotipo Habla! centrado.
// - rightActions: ReactNode con campana, menu, avatar, etc.
//
// El consumo concreto (qué iconos exactos van) se define en Lote B cuando
// se reemplazan los layouts de (public)/ y (main)/.
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type MobileHeaderVariant = "public" | "main" | "transparent";

interface MobileHeaderProps {
  variant?: MobileHeaderVariant;
  showBack?: boolean;
  showLogo?: boolean;
  /** Si está, se usa en lugar de router.back(). */
  onBack?: () => void;
  /** Título centrado (alterna con logo). */
  title?: string;
  rightActions?: ReactNode;
  className?: string;
}

const VARIANTS: Record<MobileHeaderVariant, string> = {
  public: "bg-card border-b border-light text-dark",
  main: "bg-card border-b border-light text-dark",
  transparent: "bg-transparent text-white",
};

export function MobileHeader({
  variant = "public",
  showBack = false,
  showLogo = false,
  onBack,
  title,
  rightActions,
  className,
}: MobileHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  return (
    <header
      role="banner"
      className={cn(
        "sticky top-0 z-header flex h-14 items-center gap-2 px-3",
        VARIANTS[variant],
        className,
      )}
    >
      {/* Slot izquierdo: back button o spacer */}
      <div className="flex w-10 items-center justify-start">
        {showBack && (
          <button
            type="button"
            onClick={handleBack}
            aria-label="Volver"
            className={cn(
              "touch-target inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors",
              variant === "transparent"
                ? "text-white hover:bg-white/10"
                : "text-dark hover:bg-hover",
            )}
          >
            <span aria-hidden className="text-[20px] leading-none">
              ‹
            </span>
          </button>
        )}
      </div>

      {/* Slot centro: logo o título */}
      <div className="flex flex-1 items-center justify-center">
        {showLogo ? (
          <span
            className={cn(
              "font-display text-display-sm font-extrabold uppercase tracking-[0.04em]",
              variant === "transparent" ? "text-white" : "text-dark",
            )}
          >
            Habla!
          </span>
        ) : title ? (
          <h1
            className={cn(
              "font-display text-display-sm",
              variant === "transparent" ? "text-white" : "text-dark",
            )}
          >
            {title}
          </h1>
        ) : null}
      </div>

      {/* Slot derecho: actions o spacer */}
      <div className="flex w-auto min-w-10 items-center justify-end gap-1">
        {rightActions}
      </div>
    </header>
  );
}
