"use client";

// Banner — notificación persistente in-app (Lote H).
//
// A diferencia de `<Toaster />`/`showToast` (efímero, auto-dismiss), un
// Banner se queda visible hasta que el usuario lo descarta o el caller lo
// desmonta. Se usa para situaciones que requieren atención continua:
//   - "Tu Premium expira en 5 días" + CTA "Mantener Premium"
//   - "Falta tu número de WhatsApp para recibir picks" + CTA "Agregar"
//   - (admin) "{N} picks pendientes desde hace más de 24h"
//
// Variantes: info / warning / error. Los tokens vienen del design system
// Lote A (alert.* + brand-gold + alert.danger-*). La acción opcional es
// un Link (href) o un button (onClick). `dismissible` agrega una "x".
//
// Cero z-index fijo: el caller decide si lo embebe inline o sticky.

import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";

export type BannerVariant = "info" | "warning" | "error";

interface BannerProps {
  variant: BannerVariant;
  /** Mensaje principal — corto, max ~100 caracteres. */
  mensaje: ReactNode;
  /** Acción opcional: Link interno (href) o handler (onClick). */
  accion?:
    | { label: string; href: string }
    | { label: string; onClick: () => void };
  /** Si true, muestra una "x" que descarta el banner localmente. Default
   *  false (persistente real — el caller decide cuándo desmontarlo). */
  dismissible?: boolean;
  /** Callback opcional cuando el banner se descarta. */
  onDismiss?: () => void;
  /** Override de className del wrapper exterior. */
  className?: string;
}

const VARIANT_STYLES: Record<
  BannerVariant,
  { wrap: string; icon: string; iconStr: string; accion: string }
> = {
  info: {
    wrap:
      "bg-alert-info-bg border-alert-info-border text-alert-info-text",
    icon: "text-alert-info-text",
    iconStr: "ℹ",
    accion: "bg-brand-blue-main text-white hover:bg-brand-blue-light",
  },
  warning: {
    wrap:
      "bg-alert-warning-bg border-alert-warning-border text-alert-warning-text",
    icon: "text-alert-warning-text",
    iconStr: "⚠",
    accion: "bg-brand-gold text-dark hover:bg-brand-gold-light",
  },
  error: {
    wrap:
      "bg-alert-danger-bg border-alert-danger-border text-alert-danger-text",
    icon: "text-alert-danger-text",
    iconStr: "⚠",
    accion: "bg-danger text-white hover:opacity-90",
  },
};

export function Banner({
  variant,
  mensaje,
  accion,
  dismissible = false,
  onDismiss,
  className,
}: BannerProps) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  const styles = VARIANT_STYLES[variant];
  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  const wrapClass = [
    "flex items-start gap-3 rounded-md border px-4 py-3 text-[13px] leading-snug",
    styles.wrap,
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div role={variant === "error" ? "alert" : "status"} className={wrapClass}>
      <span
        aria-hidden
        className={`flex-shrink-0 text-base font-bold ${styles.icon}`}
      >
        {styles.iconStr}
      </span>
      <div className="flex-1">{mensaje}</div>

      {accion ? (
        "href" in accion ? (
          <Link
            href={accion.href}
            className={`flex-shrink-0 rounded-sm px-3 py-1.5 text-[12px] font-bold transition ${styles.accion}`}
          >
            {accion.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={accion.onClick}
            className={`flex-shrink-0 rounded-sm px-3 py-1.5 text-[12px] font-bold transition ${styles.accion}`}
          >
            {accion.label}
          </button>
        )
      ) : null}

      {dismissible ? (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Cerrar"
          className="flex-shrink-0 rounded-sm p-1 opacity-60 hover:opacity-100"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
