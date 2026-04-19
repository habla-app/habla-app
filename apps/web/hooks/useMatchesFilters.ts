"use client";
// Estado de filtros de /matches (liga + día) anclado en la URL. Un
// refresh del navegador o un deep-link mantiene los filtros activos.
//
// Nota: `router.replace` con `scroll: false` evita que cambiar chips
// haga scroll al top — mejor UX cuando el usuario está navegando una
// lista larga.

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

export interface MatchesFilters {
  /** Slug en URL ("champions", "liga-1-peru"…) o null (todas). */
  liga: string | null;
  /**
   * YYYY-MM-DD en hora Perú cuando hay filtro activo, o null (default
   * "Todos" — no se aplica ningún rango de fechas).
   */
  dia: string | null;
}

export function useMatchesFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const filters: MatchesFilters = {
    liga: params.get("liga"),
    dia: params.get("dia"),
  };

  const setFilter = useCallback(
    (key: keyof MatchesFilters, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null) next.delete(key);
      else next.set(key, value);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, params, router],
  );

  return { filters, setFilter };
}
