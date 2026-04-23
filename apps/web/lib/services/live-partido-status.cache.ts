// Cache del estado en vivo de cada partido con dos niveles:
//   L1 — Map in-memory (process-local). Lecturas O(1) entre ticks del
//        poller, sin round-trip a BD.
//   L2 — Columnas `liveStatusShort/liveElapsed/liveExtra/liveUpdatedAt`
//        en la tabla `Partido`. Persiste el snapshot cross-proceso —
//        sobrevive restarts de Railway y cubre el caso de múltiples
//        réplicas leyendo desde instancias L1 distintas.
//
// Antes de Abr 2026 vivía solo como Map in-memory. Síntoma del bug: en
// prod `GET /api/v1/live/matches` devolvía todos los campos del minuto
// null incluso con partidos EN_VIVO activos — la réplica que servía la
// request tenía su Map vacío (restart reciente o no era la que corría el
// poller). Los eventos sí persistían porque viven en BD; el minuto no,
// porque vivía solo en memoria.
//
// Consumidores (siempre async):
//   - `/api/v1/live/matches` enriquece cada partido con el minuto.
//   - `/api/v1/torneos/:id/ranking` idem para el hero de /live-match.
//   - SSR de `/live-match` (`buildLiveTabs` en `page.tsx`).
//   - `emitirRankingUpdate` arma el payload del WS.

import { prisma } from "@habla/db";
import { getMinutoLabel } from "../utils/minuto-label";
import { logger } from "./logger";

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
 *  Cubre HT largos (clásicos con ceremonias) + prórrogas sin vaciar el
 *  cache antes de tiempo. */
export const SNAPSHOT_TTL_MS = 30 * 60 * 1000;

const cache = new Map<string, LiveStatusSnapshot>();

/**
 * Escribe/actualiza el snapshot del partido. Llamada desde el poller en
 * cada tick. Escribe L1 sincrónicamente y L2 de forma best-effort — si
 * la BD falla, el L1 ya quedó escrito y los consumidores del MISMO
 * proceso siguen viendo el minuto hasta el próximo tick.
 */
export async function setLiveStatus(
  partidoId: string,
  statusShort: string | null,
  minuto: number | null,
  extra: number | null = null,
): Promise<LiveStatusSnapshot> {
  const snap: LiveStatusSnapshot = {
    partidoId,
    statusShort,
    minuto,
    extra,
    label: getMinutoLabel({ statusShort, minuto, extra }),
    updatedAt: Date.now(),
  };
  cache.set(partidoId, snap);
  try {
    await prisma.partido.update({
      where: { id: partidoId },
      data: {
        liveStatusShort: statusShort,
        liveElapsed: minuto,
        liveExtra: extra,
        liveUpdatedAt: new Date(snap.updatedAt),
      },
    });
  } catch (err) {
    logger.error(
      { err, partidoId },
      "setLiveStatus L2 write falló — L1 ya actualizado, próximo tick reintenta",
    );
  }
  return snap;
}

/**
 * Lee el snapshot del partido. L1 primero; si no está o expiró, cae a L2
 * (BD) y rehidrata L1. Si ninguno tiene data o todos expiraron, retorna
 * null — los callers siempre deben tener fallback ("—" en la UI).
 */
export async function getLiveStatus(
  partidoId: string,
): Promise<LiveStatusSnapshot | null> {
  const mem = cache.get(partidoId);
  if (mem) {
    if (Date.now() - mem.updatedAt <= SNAPSHOT_TTL_MS) return mem;
    cache.delete(partidoId);
  }

  let row: {
    liveStatusShort: string | null;
    liveElapsed: number | null;
    liveExtra: number | null;
    liveUpdatedAt: Date | null;
  } | null;
  try {
    row = await prisma.partido.findUnique({
      where: { id: partidoId },
      select: {
        liveStatusShort: true,
        liveElapsed: true,
        liveExtra: true,
        liveUpdatedAt: true,
      },
    });
  } catch (err) {
    logger.error({ err, partidoId }, "getLiveStatus L2 read falló");
    return null;
  }
  if (!row || !row.liveUpdatedAt) return null;
  const updatedAt = row.liveUpdatedAt.getTime();
  if (Date.now() - updatedAt > SNAPSHOT_TTL_MS) return null;
  const snap: LiveStatusSnapshot = {
    partidoId,
    statusShort: row.liveStatusShort,
    minuto: row.liveElapsed,
    extra: row.liveExtra,
    label: getMinutoLabel({
      statusShort: row.liveStatusShort,
      minuto: row.liveElapsed,
      extra: row.liveExtra,
    }),
    updatedAt,
  };
  cache.set(partidoId, snap);
  return snap;
}

/**
 * Elimina el snapshot de L1 in-memory. NO toca L2 — las columnas en BD
 * quedan y expiran por TTL a los 30 min. Usado principalmente para tests.
 */
export function clearLiveStatus(partidoId: string): void {
  cache.delete(partidoId);
}

/** Test helper — resetea el L1. NO usar en prod. */
export function __resetLiveStatusCacheForTests(): void {
  cache.clear();
}
