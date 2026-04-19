// Cache in-memory de la temporada activa por liga.
//
// Motivo: api-football NO acepta `season=current` en /fixtures. Hay que
// resolver la temporada con /leagues?current=true y cachearla para evitar
// quemar cuota (este valor cambia 1–2 veces al año).
//
// Refresh: refreshAllSeasons() corre al arrancar y cada 24h desde
// apps/web/instrumentation.ts. Entre refreshes, la siguiente lookup usa
// el valor cacheado.
//
// Caveat: el cache vive en memoria del proceso. Si escalamos web a >1
// réplica, cada réplica tendrá su propio cache — no hay problema de
// consistencia porque el valor es inmutable entre refreshes.

import { LIGAS_ACTIVAS, INTERVALO_REFRESH_SEASONS_MS } from "../config/ligas";
import { getCurrentSeason } from "./api-football.client";
import { logger } from "./logger";

type CacheEntry = { season: number; cachedAt: number };

const cache = new Map<number, CacheEntry>();

/**
 * Devuelve la temporada activa de una liga, usando cache si aún está
 * fresco. Si no hay entry o está vencido, pega a api-football y actualiza.
 */
export async function getSeasonForLeague(leagueId: number): Promise<number> {
  const entry = cache.get(leagueId);
  const age = entry ? Date.now() - entry.cachedAt : Infinity;

  if (entry && age < INTERVALO_REFRESH_SEASONS_MS) {
    return entry.season;
  }

  const season = await getCurrentSeason(leagueId);
  cache.set(leagueId, { season, cachedAt: Date.now() });
  logger.info({ leagueId, season }, "Season resuelta desde api-football");
  return season;
}

/**
 * Refresca en paralelo la temporada de todas las ligas whitelisteadas.
 * Se llama al arranque del server y cada 24h. Si falla la resolución de
 * una liga, se loguea pero no interrumpe el resto.
 */
export async function refreshAllSeasons(): Promise<void> {
  await Promise.all(
    LIGAS_ACTIVAS.map(async (l) => {
      try {
        // Forzamos bypass del cache para que refleje cualquier cambio
        // upstream (transición de temporada). Reseteamos el entry.
        cache.delete(l.apiFootballId);
        await getSeasonForLeague(l.apiFootballId);
      } catch (err) {
        logger.error(
          { err, liga: l.nombre, leagueId: l.apiFootballId },
          "No se pudo resolver temporada",
        );
      }
    }),
  );
}
