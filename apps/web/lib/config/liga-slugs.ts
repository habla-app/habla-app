// Slugs de liga para la URL (?liga=champions) → nombre canónico que
// guardamos en Partido.liga. Debe mantenerse en sync con
// LIGAS_ACTIVAS de lib/config/ligas.ts; cada entrada aquí apunta al
// `nombre` exacto que el poller persiste.

export const LIGA_SLUGS: Record<string, string> = {
  "liga-1-peru": "Liga 1 Perú",
  "champions": "Champions League",
  "libertadores": "Copa Libertadores",
  "premier": "Premier League",
  "la-liga": "La Liga",
  "mundial": "Mundial 2026",
};

/**
 * Orden estable con el que queremos renderizar los chips de liga. Sirve
 * como fuente de verdad para LeagueFilterChips.
 */
export const LIGA_SLUGS_ORDER: ReadonlyArray<string> = [
  "liga-1-peru",
  "champions",
  "libertadores",
  "premier",
  "la-liga",
  "mundial",
];

export const LIGA_CHIP_LABELS: Record<string, string> = {
  "liga-1-peru": "Liga 1 Perú",
  "champions": "Champions",
  "libertadores": "Libertadores",
  "premier": "Premier",
  "la-liga": "La Liga",
  "mundial": "Mundial",
};

export function slugToLiga(slug: string | null): string | null {
  return slug ? (LIGA_SLUGS[slug] ?? null) : null;
}

/**
 * Reverso: "Liga 1 Perú" → "liga-1-peru". Devuelve null si la liga no
 * está en el whitelist (no debería ocurrir en prod porque solo
 * importamos ligas whitelisteadas; pero defensive para tests).
 */
export function ligaToSlug(liga: string): string | null {
  for (const [slug, nombre] of Object.entries(LIGA_SLUGS)) {
    if (nombre === liga) return slug;
  }
  return null;
}
