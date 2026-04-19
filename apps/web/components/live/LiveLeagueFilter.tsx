"use client";
// Filter chips por liga para el switcher de `/live-match` (Bug #11).
// Mismo patrón que LeagueFilterChips de /matches (primitivo `Chip` +
// `?liga=` en URL), pero con la lista de ligas derivada dinámicamente
// de los partidos EN_VIVO actuales — solo aparecen chips para ligas
// con al menos 1 partido en vivo ahora mismo.

import { Chip } from "@/components/ui";
import { useLigaFilter } from "@/hooks/useLigaFilter";

export interface LigaChipInfo {
  slug: string;
  label: string;
}

interface LiveLeagueFilterProps {
  /** Ligas con al menos 1 partido en vivo ahora (derivadas server-side). */
  ligas: LigaChipInfo[];
}

export function LiveLeagueFilter({ ligas }: LiveLeagueFilterProps) {
  const { liga: activeSlug, setLiga } = useLigaFilter();

  // Si no hay ligas disponibles (no hay partidos en vivo), ni
  // renderizamos la fila — dejamos que el empty state hable.
  if (ligas.length === 0) return null;

  return (
    <div
      className="scrollbar-none mb-3 flex gap-2 overflow-x-auto pb-1"
      data-testid="live-league-filter"
      role="toolbar"
      aria-label="Filtrar por liga"
    >
      <Chip
        active={activeSlug === null}
        onClick={() => setLiga(null)}
        data-testid="liga-chip-todas"
      >
        Todas
      </Chip>
      {ligas.map((l) => (
        <Chip
          key={l.slug}
          active={activeSlug === l.slug}
          onClick={() => setLiga(l.slug)}
          data-testid={`liga-chip-${l.slug}`}
        >
          {l.label}
        </Chip>
      ))}
    </div>
  );
}
