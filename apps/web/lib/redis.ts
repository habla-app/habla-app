// Cliente Redis singleton. Se usa para:
//   - Sorted sets del ranking por torneo (`torneo:{id}:ranking`)
//   - Caches volátiles de live-match (ej. minutoPartido del último evento)
//
// La conexión es lazy: la primera vez que alguien hace `getRedis()` se
// abre. Si no hay REDIS_URL configurada, devolvemos `null` y los
// callers degradean graciosamente (ranking se calcula desde BD sin
// cache).
//
// Nota: `ioredis` usa módulos Node nativos (net/dns/tls/stream) que
// webpack intenta bundlear incluso para Edge runtime. Lo cargamos con
// un `require()` runtime dinámico para esquivar el static analysis de
// webpack; en Edge `getRedis()` devuelve null y nunca llega a requerir.

import { logger } from "./services/logger";

// Tipo ligero — no importamos el type completo de ioredis para no
// forzar a webpack a resolverlo.
interface RedisLike {
  zadd(key: string, score: number, member: string): Promise<unknown>;
  expire(key: string, ttl: number): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  zrevrange(
    key: string,
    start: number,
    stop: number,
    withScores?: "WITHSCORES",
  ): Promise<string[]>;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
}

let instance: RedisLike | null | undefined;

export function getRedis(): RedisLike | null {
  if (instance !== undefined) return instance;

  const url = process.env.REDIS_URL;
  if (!url) {
    logger.warn(
      "REDIS_URL no configurada — ranking corre sin cache Redis (lectura directa a BD)",
    );
    instance = null;
    return null;
  }

  // Edge runtime no tiene process.versions.node → si no estamos en
  // Node, fail closed.
  if (typeof process === "undefined" || !process.versions?.node) {
    instance = null;
    return null;
  }

  try {
    // Runtime require — webpack no sigue este path estático.
    const mod: {
      default?: new (url: string, opts: object) => RedisLike;
      Redis?: new (url: string, opts: object) => RedisLike;
    } = require("ioredis");
    const RedisClient =
      mod.default ?? mod.Redis ?? (mod as unknown as new (
        url: string,
        opts: object,
      ) => RedisLike);

    const client = new RedisClient(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    client.on("error", (err: unknown) => {
      logger.error({ err: (err as Error)?.message }, "redis error");
    });
    client.on("connect", () => {
      logger.info("redis conectado");
    });

    instance = client;
    return client;
  } catch (err) {
    logger.error({ err: (err as Error).message }, "redis init falló");
    instance = null;
    return null;
  }
}

/** Key del sorted set de ranking por torneo. Score = puntosTotal. */
export function keyRankingTorneo(torneoId: string): string {
  return `torneo:${torneoId}:ranking`;
}

/** TTL del ranking en Redis. 48h — cubre un torneo + tiempo de retry. */
export const RANKING_TTL_SECONDS = 48 * 60 * 60;

/**
 * Publica la posición de un ticket en el ranking del torneo. Idempotente:
 * sobreescribe el score anterior del ticket si ya existe.
 */
export async function setRankingScore(
  torneoId: string,
  ticketId: string,
  puntos: number,
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  const key = keyRankingTorneo(torneoId);
  await r.zadd(key, puntos, ticketId);
  await r.expire(key, RANKING_TTL_SECONDS);
}

/**
 * Borra el ranking completo del torneo (útil al finalizarlo o en rollback).
 */
export async function deleteRanking(torneoId: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.del(keyRankingTorneo(torneoId));
}
