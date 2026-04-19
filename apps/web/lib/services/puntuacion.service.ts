// Motor de puntuación — Sub-Sprint 5.
//
// Tabla oficial (CLAUDE.md §2, inamovible):
//   Resultado (1X2):        3 pts
//   Ambos anotan (BTTS):    2 pts
//   Más de 2.5 goles:       2 pts
//   Tarjeta roja:           6 pts
//   Marcador exacto:        8 pts
//   TOTAL MÁX POR TICKET: 21 pts
//
// El cálculo es una función pura: mismos inputs → mismos puntos. La
// idempotencia del motor depende de esto (si el poller reentra, los
// puntos no se duplican — simplemente se re-escriben con el mismo valor).

import { prisma, type Partido, type Ticket } from "@habla/db";
import { PUNTOS } from "@habla/shared";
import { logger } from "./logger";
import { setRankingScore } from "../redis";

/**
 * Snapshot del partido que necesita el motor para puntuar. Lo que se
 * persiste en `Partido`:
 *   - golesLocal / golesVisita: definen resultado (1X2), BTTS, +2.5
 *   - huboTarjetaRoja: derivado por el poller de /fixtures/events
 */
export interface SnapshotPartido {
  golesLocal: number | null;
  golesVisita: number | null;
  btts: boolean | null;
  mas25Goles: boolean | null;
  huboTarjetaRoja: boolean | null;
  estado: "PROGRAMADO" | "EN_VIVO" | "FINALIZADO" | "CANCELADO";
}

export interface PuntosDetalle {
  resultado: number;
  btts: number;
  mas25: number;
  tarjeta: number;
  marcador: number;
  total: number;
}

export const PUNTOS_CERO: PuntosDetalle = {
  resultado: 0,
  btts: 0,
  mas25: 0,
  tarjeta: 0,
  marcador: 0,
  total: 0,
};

type PrediccionesTicket = Pick<
  Ticket,
  | "predResultado"
  | "predBtts"
  | "predMas25"
  | "predTarjetaRoja"
  | "predMarcadorLocal"
  | "predMarcadorVisita"
>;

/**
 * Calcula puntos de un ticket contra un snapshot de partido. Función
 * pura — apta para tests unitarios.
 *
 * Semántica de campos null:
 *   - golesLocal/golesVisita null → el partido aún no tiene marcador
 *     (PROGRAMADO o arranque). Todo queda en 0 pendiente.
 *   - btts / mas25Goles null → el poller aún no los derivó. Dejamos en 0.
 *   - huboTarjetaRoja null → aún no hubo evento. Si el ticket predijo
 *     "No habrá roja", le damos los 6 pts sólo si el partido
 *     FINALIZÓ sin roja; durante EN_VIVO queda en pendiente (0).
 */
export function calcularPuntosTicket(
  preds: PrediccionesTicket,
  partido: SnapshotPartido,
): PuntosDetalle {
  const { golesLocal, golesVisita } = partido;

  // Sin marcador → nada se puede confirmar todavía.
  if (golesLocal === null || golesVisita === null) return { ...PUNTOS_CERO };

  const d: PuntosDetalle = { ...PUNTOS_CERO };

  // 1. Resultado 1X2 (3 pts)
  const resultadoReal: "LOCAL" | "EMPATE" | "VISITA" =
    golesLocal > golesVisita
      ? "LOCAL"
      : golesLocal < golesVisita
        ? "VISITA"
        : "EMPATE";
  if (preds.predResultado === resultadoReal) d.resultado = PUNTOS.RESULTADO;

  // 2. BTTS (2 pts) — durante EN_VIVO sólo se confirma CUANDO se cumple
  //    por lado positivo. Si el partido no terminó y btts es null,
  //    podemos inferir:
  //      - goles.home > 0 && goles.away > 0 → btts = true (ya pasó,
  //        no puede "desverdadcer")
  //      - de lo contrario → null (puede anotar el que no anotó)
  const bttsEfectivo =
    partido.btts !== null
      ? partido.btts
      : golesLocal > 0 && golesVisita > 0
        ? true
        : partido.estado === "FINALIZADO"
          ? false
          : null;
  if (bttsEfectivo !== null && preds.predBtts === bttsEfectivo) {
    d.btts = PUNTOS.BTTS;
  }

  // 3. +2.5 goles (2 pts) — análogo: si ya hay 3+ goles ya está
  //    confirmado true; si quedan menos de 3 pero partido FT → false.
  const mas25Efectivo =
    partido.mas25Goles !== null
      ? partido.mas25Goles
      : golesLocal + golesVisita > 2
        ? true
        : partido.estado === "FINALIZADO"
          ? false
          : null;
  if (mas25Efectivo !== null && preds.predMas25 === mas25Efectivo) {
    d.mas25 = PUNTOS.MAS_25_GOLES;
  }

  // 4. Tarjeta roja (6 pts) — se confirma verdadero en cuanto hubo
  //    una; "No" sólo se confirma al finalizar el partido.
  let tarjetaEfectiva: boolean | null = partido.huboTarjetaRoja ?? null;
  if (tarjetaEfectiva === null && partido.estado === "FINALIZADO") {
    tarjetaEfectiva = false;
  }
  if (tarjetaEfectiva !== null && preds.predTarjetaRoja === tarjetaEfectiva) {
    d.tarjeta = PUNTOS.TARJETA_ROJA;
  }

  // 5. Marcador exacto (8 pts) — sólo se confirma al FINALIZADO.
  //    Durante EN_VIVO no se dan los 8 pts aunque momentáneamente
  //    el score coincida, porque podría cambiar.
  if (
    partido.estado === "FINALIZADO" &&
    preds.predMarcadorLocal === golesLocal &&
    preds.predMarcadorVisita === golesVisita
  ) {
    d.marcador = PUNTOS.MARCADOR_EXACTO;
  }

  d.total = d.resultado + d.btts + d.mas25 + d.tarjeta + d.marcador;
  return d;
}

// ---------------------------------------------------------------------------
// recalcularTorneo — re-puntúa todos los tickets de un torneo y emite
// `ranking:update` por el room del torneo.
// ---------------------------------------------------------------------------

export interface RecalcularResult {
  torneoId: string;
  ticketsActualizados: number;
  puntosMaximo: number;
}

/**
 * Re-calcula los puntos de todos los tickets de un torneo usando el
 * snapshot actual del partido asociado. Idempotente: correrlo N veces
 * seguidas con el mismo partido devuelve los mismos puntos.
 */
export async function recalcularTorneo(
  torneoId: string,
): Promise<RecalcularResult> {
  const torneo = await prisma.torneo.findUnique({
    where: { id: torneoId },
    include: { partido: true, tickets: true },
  });
  if (!torneo) {
    throw new Error(`Torneo ${torneoId} no existe`);
  }

  const snapshot = partidoToSnapshot(torneo.partido);

  const updates = torneo.tickets.map(async (ticket) => {
    const d = calcularPuntosTicket(ticket, snapshot);
    // Sólo actualiza si cambió algo (reduce escrituras cuando los goles
    // no movieron la aguja para este ticket).
    if (
      ticket.puntosTotal === d.total &&
      ticket.puntosResultado === d.resultado &&
      ticket.puntosBtts === d.btts &&
      ticket.puntosMas25 === d.mas25 &&
      ticket.puntosTarjeta === d.tarjeta &&
      ticket.puntosMarcador === d.marcador
    ) {
      return { changed: false, total: d.total };
    }
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        puntosTotal: d.total,
        puntosResultado: d.resultado,
        puntosBtts: d.btts,
        puntosMas25: d.mas25,
        puntosTarjeta: d.tarjeta,
        puntosMarcador: d.marcador,
      },
    });
    // Redis sorted set — score = puntosTotal. Soporta ranking en <1ms.
    await setRankingScore(torneoId, ticket.id, d.total);
    return { changed: true, total: d.total };
  });

  const results = await Promise.all(updates);
  const ticketsActualizados = results.filter((r) => r.changed).length;
  const puntosMaximo = results.reduce(
    (acc, r) => (r.total > acc ? r.total : acc),
    0,
  );

  logger.info(
    {
      torneoId,
      ticketsActualizados,
      ticketsTotal: torneo.tickets.length,
      puntosMaximo,
    },
    "torneo recalculado",
  );

  return {
    torneoId,
    ticketsActualizados,
    puntosMaximo,
  };
}

export function partidoToSnapshot(partido: Partido): SnapshotPartido {
  return {
    golesLocal: partido.golesLocal,
    golesVisita: partido.golesVisita,
    btts: partido.btts,
    mas25Goles: partido.mas25Goles,
    huboTarjetaRoja: partido.huboTarjetaRoja,
    estado: partido.estado,
  };
}
