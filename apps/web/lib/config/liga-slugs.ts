// Slugs de liga para la URL (?liga=champions) → nombre canónico que
// guardamos en Partido.liga.
//
// Lote 5: las constantes derivan de `LIGAS` (lib/config/ligas.ts) — fuente
// única de verdad. Antes había duplicación literal; ahora cualquier alta
// de liga se hace en un solo lugar.

import { LIGAS } from "./ligas";

const SORTED = [...LIGAS].sort(
  (a, b) => a.prioridadDisplay - b.prioridadDisplay,
);

export const LIGA_SLUGS: Record<string, string> = Object.fromEntries(
  SORTED.map((l) => [l.slug, l.nombre]),
);

/**
 * Orden estable con el que renderizamos los chips de liga.
 * Sirve como fuente de verdad para LeagueFilterChips.
 */
export const LIGA_SLUGS_ORDER: ReadonlyArray<string> = SORTED.map((l) => l.slug);

export const LIGA_CHIP_LABELS: Record<string, string> = Object.fromEntries(
  SORTED.map((l) => [l.slug, l.chipLabel]),
);

export function slugToLiga(slug: string | null): string | null {
  return slug ? (LIGA_SLUGS[slug] ?? null) : null;
}

/**
 * Reverso: "Liga 1 Perú" → "liga-1-peru". Devuelve null si la liga no
 * está en el catálogo (no debería ocurrir en prod porque solo
 * importamos ligas del catálogo; pero defensive para tests).
 */
export function ligaToSlug(liga: string): string | null {
  for (const [slug, nombre] of Object.entries(LIGA_SLUGS)) {
    if (nombre === liga) return slug;
  }
  return null;
}
