"use client";
// Hook genérico de filtro por liga anclado en URL (`?liga=<slug>`).
// Refleja el estado en el querystring para permitir deep-linking,
// share y refresh estable. Bug #11: se introduce en /live-match;
// /matches todavía usa `useMatchesFilters` (que maneja liga + día).
//
// Si en el futuro consolidamos ambos lugares, `useMatchesFilters`
// podría delegar a este helper para el eje "liga". Por ahora
// coexisten con interfaces similares pero sin acoplar la lógica de
// día (que /live-match no necesita).

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

export interface LigaFilterState {
  /** Slug de la liga activa ("champions", "liga-1-peru"…) o null. */
  liga: string | null;
  /** Actualiza el filtro (o lo remueve si value=null). */
  setLiga: (value: string | null) => void;
}

export function useLigaFilter(): LigaFilterState {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const liga = params.get("liga");

  const setLiga = useCallback(
    (value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null) next.delete("liga");
      else next.set("liga", value);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, params, router],
  );

  return { liga, setLiga };
}
