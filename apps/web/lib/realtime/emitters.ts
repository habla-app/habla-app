// Emisores WS — funciones helper que buscan la instancia global de
// Socket.io (seteada por server.ts) y despachan eventos al room
// correspondiente.
//
// Si el server WS no está corriendo (ej. durante dev en un proceso sin
// custom server, o en tests), las emisiones son no-op: los route
// handlers y el poller funcionan igual sin real-time, y los clientes
// reciben los datos por fetch normal.

import type { Server as SocketIOServer } from "socket.io";
import { listarRanking } from "../services/ranking.service";
import { getLiveStatus } from "../services/live-partido-status.cache";
import { logger } from "../services/logger";
import type {
  ClientToServerEvents,
  PartidoEventoPayload,
  PartidoEventoInvalidadoPayload,
  RankingUpdatePayload,
  ServerToClientEvents,
  SocketData,
  TorneoCerradoPayload,
  TorneoFinalizadoPayload,
} from "./events";

type IO = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

/**
 * Referencia a la instancia de Socket.io guardada como global. El server
 * custom (`apps/web/server.ts`) la setea al arrancar; el poller y los
 * route handlers la leen desde acá.
 */
export function getIO(): IO | null {
  const g = globalThis as unknown as { __hablaIO?: IO };
  return g.__hablaIO ?? null;
}

export function setIO(io: IO): void {
  const g = globalThis as unknown as { __hablaIO?: IO };
  g.__hablaIO = io;
}

/**
 * Key del room por torneo. Coincide exacto con el string usado en el
 * server al recibir `join:torneo`.
 */
export function roomTorneo(torneoId: string): string {
  return `torneo:${torneoId}`;
}

// ---------------------------------------------------------------------------
// Emisores específicos
// ---------------------------------------------------------------------------

export async function emitirRankingUpdate(
  torneoId: string,
  opts: {
    /** PartidoId asociado al torneo, para leer el snapshot del minuto
     *  del cache in-memory (Bug #9). Si es null, minutoLabel queda null. */
    partidoId?: string | null;
    /** Override explícito del minuto (ej. caller ya tiene el valor).
     *  Si no se pasa, se lee del cache por partidoId. */
    minutoPartido?: number | null;
  } = {},
): Promise<void> {
  const io = getIO();
  if (!io) return;
  try {
    const r = await listarRanking(torneoId, { limit: 100 });
    // Bug #9: leer label del cache si hay partidoId, sino null.
    // Hotfix #8 Bug #22: también extraemos statusShort para que el
    // cliente sepa qué fase del partido y corra reloj local anclado
    // a `Partido.fechaInicio` (ya persistido en BD, no depende del cache).
    const snapshot = opts.partidoId ? getLiveStatus(opts.partidoId) : null;
    const minutoPartido =
      opts.minutoPartido !== undefined
        ? opts.minutoPartido
        : (snapshot?.minuto ?? null);
    const minutoLabel = snapshot?.label ?? null;
    const statusShort = snapshot?.statusShort ?? null;
    const payload: RankingUpdatePayload = {
      torneoId,
      ranking: r.ranking.map((row) => ({
        rank: row.rank,
        ticketId: row.ticketId,
        usuarioId: row.usuarioId,
        nombre: row.nombre,
        puntosTotal: row.puntosTotal,
        puntosDetalle: row.puntosDetalle,
        predicciones: row.predicciones,
        premioEstimado: row.premioEstimado,
      })),
      totalInscritos: r.totalInscritos,
      pozoNeto: r.pozoNeto,
      minutoPartido,
      minutoLabel,
      statusShort,
      pagados: r.pagados,
      timestamp: Date.now(),
    };
    io.to(roomTorneo(torneoId)).emit("ranking:update", payload);
  } catch (err) {
    logger.error({ err, torneoId }, "emitirRankingUpdate falló");
  }
}

export function emitirPartidoEvento(payload: PartidoEventoPayload): void {
  const io = getIO();
  if (!io) return;
  io.to(roomTorneo(payload.torneoId)).emit("partido:evento", payload);
}

/** Hotfix #6 — Ítem 2: avisa al cliente que un evento se invalidó
 *  (ej. gol anulado por VAR). El cliente lo remueve de la timeline. */
export function emitirPartidoEventoInvalidado(
  payload: PartidoEventoInvalidadoPayload,
): void {
  const io = getIO();
  if (!io) return;
  io.to(roomTorneo(payload.torneoId)).emit("partido:evento-invalidado", payload);
}

export function emitirTorneoCerrado(payload: TorneoCerradoPayload): void {
  const io = getIO();
  if (!io) return;
  io.to(roomTorneo(payload.torneoId)).emit("torneo:cerrado", payload);
}

export function emitirTorneoFinalizado(
  payload: TorneoFinalizadoPayload,
): void {
  const io = getIO();
  if (!io) return;
  io.to(roomTorneo(payload.torneoId)).emit("torneo:finalizado", payload);
}
