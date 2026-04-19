// Tipos compartidos de eventos WebSocket entre servidor y cliente.
// Sub-Sprint 5 — CLAUDE.md §12.
//
// Protocolo:
//   CLIENTE → SERVIDOR: join:torneo { torneoId }, leave:torneo { torneoId }
//   SERVIDOR → CLIENTE: ranking:update, partido:evento, torneo:cerrado,
//                       torneo:finalizado

import type { TipoEventoPartido, EquipoEvento } from "./eventos";

export interface JoinTorneoPayload {
  torneoId: string;
}

export interface LeaveTorneoPayload {
  torneoId: string;
}

/**
 * Snapshot mínimo del ranking que se emite en cada recálculo. El `rank`
 * es 1-indexado. Incluye el detalle de las 5 predicciones y sus puntos
 * desagregados para que el cliente pueda pintar los chips sin un
 * segundo fetch.
 */
export interface RankingRowPayload {
  rank: number;
  ticketId: string;
  usuarioId: string;
  nombre: string;
  puntosTotal: number;
  puntosDetalle: {
    resultado: number;
    btts: number;
    mas25: number;
    tarjeta: number;
    marcador: number;
  };
  predicciones: {
    predResultado: "LOCAL" | "EMPATE" | "VISITA";
    predBtts: boolean;
    predMas25: boolean;
    predTarjetaRoja: boolean;
    predMarcadorLocal: number;
    predMarcadorVisita: number;
  };
  premioEstimado: number;
}

export interface RankingUpdatePayload {
  torneoId: string;
  ranking: RankingRowPayload[];
  totalInscritos: number;
  pozoNeto: number;
  minutoPartido: number | null;
  timestamp: number;
}

export interface PartidoEventoPayload {
  torneoId: string;
  partidoId: string;
  tipo: TipoEventoPartido;
  equipo: EquipoEvento;
  minuto: number;
  jugador: string | null;
  detalle: string | null;
  marcadorLocal: number;
  marcadorVisita: number;
}

export interface TorneoCerradoPayload {
  torneoId: string;
}

export interface TorneoFinalizadoPayload {
  torneoId: string;
  ganadores: Array<{
    rank: number;
    ticketId: string;
    usuarioId: string;
    nombre: string;
    puntosTotal: number;
    premioLukas: number;
  }>;
}

export interface ServerToClientEvents {
  "ranking:update": (payload: RankingUpdatePayload) => void;
  "partido:evento": (payload: PartidoEventoPayload) => void;
  "torneo:cerrado": (payload: TorneoCerradoPayload) => void;
  "torneo:finalizado": (payload: TorneoFinalizadoPayload) => void;
}

export interface ClientToServerEvents {
  "join:torneo": (payload: JoinTorneoPayload) => void;
  "leave:torneo": (payload: LeaveTorneoPayload) => void;
}

export interface SocketData {
  usuarioId: string | null;
}

export const SOCKET_PATH = "/socket.io";
