"use client";
// Chips de filtro por liga para /matches. Lee y escribe el filtro
// `?liga=<slug>` vía useMatchesFilters. El chip "Todas las ligas"
// corresponde a liga=null (sin query param).

import { Chip } from "@/components/ui";
import { useMatchesFilters } from "@/hooks/useMatchesFilters";
import {
  LIGA_SLUGS_ORDER,
  LIGA_CHIP_LABELS,
} from "@/lib/config/liga-slugs";

export function LeagueFilterChips() {
  const { filters, setFilter } = useMatchesFilters();
  const activeSlug = filters.liga;

  return (
    <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
      <Chip
        key="todas"
        active={activeSlug === null}
        onClick={() => setFilter("liga", null)}
      >
        Todas las ligas
      </Chip>
      {LIGA_SLUGS_ORDER.map((slug) => (
        <Chip
          key={slug}
          active={activeSlug === slug}
          onClick={() => setFilter("liga", slug)}
        >
          {LIGA_CHIP_LABELS[slug]}
        </Chip>
      ))}
    </div>
  );
}
