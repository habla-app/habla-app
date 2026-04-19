"use client";
// BackButton — "← Volver a partidos" prominente arriba-izquierda del
// detalle de torneo. Hotfix #5 Bug #13.
//
// Estrategia: intenta `router.back()`. Si no hay historial (deep-link
// desde un email o share), cae a `href` (default `/matches`).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

interface Props {
  /** Destino fallback si el history está vacío. Default "/matches". */
  fallbackHref?: string;
  /** Etiqueta visible. Default "Volver a Partidos". */
  label?: string;
}

export function BackButton({
  fallbackHref = "/matches",
  label = "Volver a Partidos",
}: Props) {
  const router = useRouter();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Si hay historial (hemos navegado dentro de la app), preferimos
      // router.back() para volver al contexto exacto (filtros, scroll).
      // window.history.length > 1 indica que vinimos de otra ruta.
      if (typeof window !== "undefined" && window.history.length > 1) {
        e.preventDefault();
        router.back();
      }
    },
    [router],
  );

  return (
    <Link
      href={fallbackHref}
      onClick={handleClick}
      data-testid="torneo-back-button"
      className="inline-flex items-center gap-2 rounded-sm border border-light bg-card px-3 py-2 text-[13px] font-semibold text-body shadow-sm transition-all hover:-translate-y-px hover:border-brand-blue-main hover:text-brand-blue-main"
    >
      <span aria-hidden>←</span>
      <span>{label}</span>
    </Link>
  );
}
