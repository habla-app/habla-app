// Servicio de sesiones del agente local (Lote V.14 — May 2026).
//
// Cuando el admin pulsa "Actualizar cuotas" desde la UI:
//   1. Backend genera un token UUID con TTL 5min en Redis.
//   2. Encola los jobs en BullMQ para los partidos del scope.
//   3. Devuelve `{token, urlProtocol}` — la URL apunta al Custom URL
//      Protocol `habla-agente://run?token=xxx` que dispara el agente
//      local en la PC del admin.
//   4. El agente recibe el token vía argumento, pollea
//      `GET /agente/jobs/proximos?token=xxx` que solo le devuelve los
//      jobs asociados a esa sesión.
//   5. Cuando el agente termina (no quedan jobs en su scope), se cierra.
//
// La sesión "expira" sola en 5min — si el agente crashea mid-run, la
// próxima vez que el admin pulse el botón se genera token nuevo.

import { randomUUID } from "node:crypto";
import { getRedis } from "../redis";
import { logger } from "./logger";

const SESION_TTL_SECONDS = 5 * 60;
const PREFIX = "agente:sesion:";

export type AgenteScope = "partido" | "global";

export interface SesionAgente {
  scope: AgenteScope;
  partidoIds: string[];
  creadoEn: string; // ISO
}

/**
 * Crea una sesión del agente y la persiste en Redis con TTL.
 * Devuelve token + URL protocol para que la UI dispare el lanzamiento.
 */
export async function crearSesionAgente(args: {
  scope: AgenteScope;
  partidoIds: string[];
}): Promise<{ token: string; urlProtocol: string } | null> {
  const redis = getRedis();
  if (!redis) {
    logger.warn(
      { source: "agente-sesion" },
      "crearSesionAgente: Redis no disponible",
    );
    return null;
  }

  const token = randomUUID();
  const sesion: SesionAgente = {
    scope: args.scope,
    partidoIds: args.partidoIds,
    creadoEn: new Date().toISOString(),
  };

  await redis.set(
    `${PREFIX}${token}`,
    JSON.stringify(sesion),
    "EX",
    SESION_TTL_SECONDS,
  );

  // URL del Custom URL Protocol que dispara el agente en la PC del admin.
  // Windows tiene registrado `habla-agente://` apuntando al script
  // lanzador (ver `apps/web/scripts/setup-agente-windows.bat`).
  const urlProtocol = `habla-agente://run?token=${encodeURIComponent(token)}`;

  logger.info(
    {
      token: token.slice(0, 8),
      scope: args.scope,
      partidos: args.partidoIds.length,
      source: "agente-sesion",
    },
    `sesión creada · scope=${args.scope} · ${args.partidoIds.length} partidos`,
  );

  return { token, urlProtocol };
}

/**
 * Valida un token de sesión y devuelve los partidoIds asociados.
 * Retorna null si el token no existe o expiró.
 */
export async function validarSesionAgente(
  token: string,
): Promise<SesionAgente | null> {
  const redis = getRedis();
  if (!redis) return null;
  if (!token || token.length < 8) return null;

  try {
    const raw = await redis.get(`${PREFIX}${token}`);
    if (!raw) return null;
    return JSON.parse(raw) as SesionAgente;
  } catch (err) {
    logger.warn(
      { token: token.slice(0, 8), err: (err as Error).message, source: "agente-sesion" },
      "validarSesionAgente: parse falló",
    );
    return null;
  }
}

/**
 * Cierra una sesión (cuando el agente reporta que terminó todos los
 * jobs). Idempotente.
 */
export async function cerrarSesionAgente(token: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(`${PREFIX}${token}`);
  } catch {
    /* ignore */
  }
}
