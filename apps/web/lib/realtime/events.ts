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
  /** Display del jugador. Registro formal (Abr 2026): contiene el
   *  `username` (sin @). La UI prefija `@` al renderizar. Se mantiene el
   *  nombre del campo como `nombre` por compat con clientes antiguos. */
  nombre: string;
  /** @handle del usuario. Nuevo campo explícito — los consumidores nuevos
   *  deben preferirlo sobre `nombre`. */
  username: string;
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
  /** Label renderizable del minuto (p.ej. "23'", "ENT", "FIN"). Bug #9.
   *  Si es null, la UI debe mostrar "—". Nunca "?". */
  minutoLabel: string | null;
  /** Hotfix #8 Bug #22: `fixture.status.short` del poller. El cliente lo
   *  usa junto con `elapsed` + `elapsedAgeMs` para correr un reloj local
   *  entre ticks del poller (30s). */
  statusShort: string | null;
  /** Hotfix #8 Ítem 4: edad (ms) del snapshot del cache al momento en que
   *  el server emitió este payload. Permite al cliente anclar el reloj
   *  local al tiempo REAL en que el server capturó `elapsed` (no al
   *  momento del mount del componente). Sin esto, el cliente inicializa
   *  `elapsedAnchorAt = Date.now()` asumiendo que el snapshot es fresco;
   *  si en realidad es de hace 5 min, el reloj aparece desfasado hasta
   *  que llegue el primer WS con datos frescos. Null si el server no
   *  tiene snap. */
  elapsedAgeMs: number | null;
  /** Hotfix #6: cantidad de posiciones pagadas (M). UI lo usa para
   *  calcular el badge "En el dinero" + copy motivacional. */
  pagados: number;
  timestamp: number;
}

/** Hotfix #6 — Ítem 2: evento invalidado (ej. gol anulado por VAR).
 *  El cliente remueve el evento de su timeline local. */
export interface PartidoEventoInvalidadoPayload {
  torneoId: string;
  partidoId: string;
  /** Natural key del evento que se eliminó. Coincide con la clave que
   *  el cliente usa para deduplicar eventos (tipo|minuto|equipo|jugador). */
  naturalKey: string;
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
    /** @handle (sin @) — compat con clientes antiguos que leían `nombre`. */
    nombre: string;
    username: string;
    puntosTotal: number;
    premioLukas: number;
  }>;
}

export interface ServerToClientEvents {
  "ranking:update": (payload: RankingUpdatePayload) => void;
  "partido:evento": (payload: PartidoEventoPayload) => void;
  "partido:evento-invalidado": (payload: PartidoEventoInvalidadoPayload) => void;
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
