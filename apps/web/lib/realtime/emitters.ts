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
import { logger } from "../services/logger";
import type {
  ClientToServerEvents,
  PartidoEventoPayload,
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
  minutoPartido: number | null = null,
): Promise<void> {
  const io = getIO();
  if (!io) return;
  try {
    const r = await listarRanking(torneoId, { limit: 100 });
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
