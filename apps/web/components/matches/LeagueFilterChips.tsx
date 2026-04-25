"use client";
// Chips de filtro por liga para /matches. Lee y escribe el filtro
// `?liga=<slug>` vía useMatchesFilters. El chip "Todas las ligas"
// corresponde a liga=null (sin query param).
//
// Lote 7: con 19 ligas la fila se cortaba en pantalla. Envolvemos en
// HorizontalScrollChips para tener scroll horizontal con flechas en
// desktop, swipe en mobile, edge fades, y auto-scroll al chip activo
// (útil cuando el usuario llega vía deep link como ?liga=nations-league
// que está al final de la lista).

import { Chip, HorizontalScrollChips } from "@/components/ui";
import { useMatchesFilters } from "@/hooks/useMatchesFilters";
import {
  LIGA_SLUGS_ORDER,
  LIGA_CHIP_LABELS,
} from "@/lib/config/liga-slugs";

export function LeagueFilterChips() {
  const { filters, setFilter } = useMatchesFilters();
  const activeSlug = filters.liga;

  return (
    <HorizontalScrollChips ariaLabel="Filtrar por liga">
      <Chip
        key="todas"
        active={activeSlug === null}
        data-active={activeSlug === null ? "true" : "false"}
        onClick={() => setFilter("liga", null)}
      >
        Todas las ligas
      </Chip>
      {LIGA_SLUGS_ORDER.map((slug) => (
        <Chip
          key={slug}
          active={activeSlug === slug}
          data-active={activeSlug === slug ? "true" : "false"}
          onClick={() => setFilter("liga", slug)}
        >
          {LIGA_CHIP_LABELS[slug]}
        </Chip>
      ))}
    </HorizontalScrollChips>
  );
}
