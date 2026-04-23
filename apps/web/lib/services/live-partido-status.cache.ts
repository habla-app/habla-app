// Cache in-memory del estado en vivo de cada partido. Guarda el
// `status.short` + `status.elapsed` + `status.extra` más reciente que el
// poller vio en api-football, junto con el label renderizable.
//
// Se usa para:
//   - Enriquecer `/api/v1/live/matches` con el minuto label sin un
//     request extra al upstream.
//   - Server-side render de `/live-match`: el tab activo muestra el
//     label inmediatamente (no espera al primer WS).
//   - `emitirRankingUpdate` lee el label del cache antes de publicar.
//
// No persistimos en BD (MVP): el cache se reconstruye en cada tick del
// poller (30s). Si el proceso reinicia, el primer render entre el
// boot y el primer tick muestra "—" — aceptable.
//
// Estructura: Map<partidoId, LiveStatusSnapshot>. Sin eviction activa:
// el set de partidos en vivo es chico (<50 simultáneos en MVP) y el
// overhead es trivial. Se limpia solo cuando el poller marca el partido
// como FINALIZADO más allá del TTL (o al restart).
//
// Hotfix #6 Ítem 3: TTL extendido de 10 a 30 minutos. Motivación: en
// halftime largos (entretiempos de clásicos con ceremonias) el poller
// sigue recibiendo `status.short=HT` pero si el último tick con
// `elapsed` numérico pasó hace >10 min, el snapshot caducaba y el
// LiveHero mostraba "—" en lugar de "ENT". Con 30 min cubrimos HT
// + prórrogas sin comprometer memory (el cache se limpia al FT).

import { getMinutoLabel } from "../utils/minuto-label";

export interface LiveStatusSnapshot {
  partidoId: string;
  /** `fixture.status.short` de api-football. */
  statusShort: string | null;
  /** Minuto cursando (o minuto final si FINALIZADO). Null si no aplica. */
  minuto: number | null;
  /** Minutos de descuento/añadido (1H/2H). Null/0 fuera de injury time. */
  extra: number | null;
  /** Label ya renderizado. La UI lo pinta directo. */
  label: string;
  /** Timestamp epoch ms de la última actualización. */
  updatedAt: number;
}

/** TTL: si pasan más de 30 min sin update, consideramos el snapshot stale.
 *  Hotfix #6 Ítem 3: extendido desde 10 min para cubrir HT largos +
 *  prórrogas. */
export const SNAPSHOT_TTL_MS = 30 * 60 * 1000;

const cache = new Map<string, LiveStatusSnapshot>();

/**
 * Escribe/actualiza el snapshot del partido. Calcula el label con el
 * mapper puro. Called desde el poller en cada tick.
 */
export function setLiveStatus(
  partidoId: string,
  statusShort: string | null,
  minuto: number | null,
  extra: number | null = null,
): LiveStatusSnapshot {
  const snap: LiveStatusSnapshot = {
    partidoId,
    statusShort,
    minuto,
    extra,
    label: getMinutoLabel({ statusShort, minuto, extra }),
    updatedAt: Date.now(),
  };
  cache.set(partidoId, snap);
  return snap;
}

/**
 * Lee el snapshot del partido. Si no existe o está stale, retorna null.
 * Los callers que necesitan un label SIEMPRE deben tener un fallback
 * ("—" por ejemplo) — este getter no lo garantiza.
 */
export function getLiveStatus(partidoId: string): LiveStatusSnapshot | null {
  const snap = cache.get(partidoId);
  if (!snap) return null;
  if (Date.now() - snap.updatedAt > SNAPSHOT_TTL_MS) {
    cache.delete(partidoId);
    return null;
  }
  return snap;
}

/**
 * Elimina el snapshot. Lo usa el poller cuando un partido transiciona
 * a FINALIZADO y pasa TTL — evita que crezca el Map para siempre.
 */
export function clearLiveStatus(partidoId: string): void {
  cache.delete(partidoId);
}

/** Test helper — NO usar en prod. */
export function __resetLiveStatusCacheForTests(): void {
  cache.clear();
}
