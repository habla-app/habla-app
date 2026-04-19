// Motor de puntuación — Sub-Sprint 5 + Hotfix #6.
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
//
// Hotfix #6 — Bug #4: TODOS los campos proyectan "si el partido terminara
// ahora" durante EN_VIVO, incluido el marcador exacto (reversal de la
// decisión del Sub-Sprint 5). La volatilidad es esperada — el ranking
// refleja la pregunta "¿quién gana si terminara ahora?" y la UI comunica
// ese significado con el copy motivacional del tab Ranking.
//
// Reglas proyectivas:
//   - Resultado 1X2: según score actual (ya era así).
//   - BTTS:         true si ambos anotaron; false como proyección mientras
//                   alguno tenga 0 — puede "desproyectarse" si anota.
//   - +2.5 goles:    true si local+visita ≥ 3; false como proyección.
//   - Tarjeta roja:  true si confirmada; false como proyección (null se
//                   trata como "aún no hay roja").
//   - Marcador:      true si coincide con score actual. Proyecta en vivo.

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
 * Semántica de campos null (Hotfix #6):
 *   - golesLocal/golesVisita null → el partido aún no tiene marcador
 *     (PROGRAMADO o arranque). Todo queda en 0 pendiente.
 *   - btts / mas25Goles null → derivamos de los goles proyectando
 *     en vivo. Todos los campos proyectan como si el partido terminara
 *     ahora.
 *   - huboTarjetaRoja null → se interpreta como "aún no hubo roja";
 *     la predicción "No habrá roja" recibe los 6 pts como proyección.
 *     Si después hay una tarjeta, el motor revierte los puntos en el
 *     siguiente recalc.
 */
export function calcularPuntosTicket(
  preds: PrediccionesTicket,
  partido: SnapshotPartido,
): PuntosDetalle {
  const { golesLocal, golesVisita } = partido;

  // Sin marcador → nada se puede confirmar todavía.
  if (golesLocal === null || golesVisita === null) return { ...PUNTOS_CERO };

  const d: PuntosDetalle = { ...PUNTOS_CERO };

  // 1. Resultado 1X2 (3 pts) — proyecta en vivo según marcador actual.
  const resultadoReal: "LOCAL" | "EMPATE" | "VISITA" =
    golesLocal > golesVisita
      ? "LOCAL"
      : golesLocal < golesVisita
        ? "VISITA"
        : "EMPATE";
  if (preds.predResultado === resultadoReal) d.resultado = PUNTOS.RESULTADO;

  // 2. BTTS (2 pts) — proyecta en vivo.
  //    - Si ambos anotaron → true (irreversible, ya pasó).
  //    - Si alguno tiene 0 → false como proyección (puede mutar).
  //    El campo persistido `btts` se respeta cuando el poller ya lo
  //    cristalizó al FINALIZADO.
  const bttsEfectivo: boolean =
    partido.btts !== null
      ? partido.btts
      : golesLocal > 0 && golesVisita > 0;
  if (preds.predBtts === bttsEfectivo) {
    d.btts = PUNTOS.BTTS;
  }

  // 3. +2.5 goles (2 pts) — proyecta en vivo.
  //    - Si hay 3+ goles → true.
  //    - Si hay <3 goles → false como proyección.
  const mas25Efectivo: boolean =
    partido.mas25Goles !== null
      ? partido.mas25Goles
      : golesLocal + golesVisita > 2;
  if (preds.predMas25 === mas25Efectivo) {
    d.mas25 = PUNTOS.MAS_25_GOLES;
  }

  // 4. Tarjeta roja (6 pts) — proyecta en vivo.
  //    - Si hubo roja confirmada → true (irreversible).
  //    - Si null / false → false como proyección. "No habrá roja" recibe
  //      los puntos desde el minuto 1 y se revierte si más adelante
  //      aparece una roja (el motor es función pura de inputs).
  const tarjetaEfectiva: boolean = partido.huboTarjetaRoja === true;
  if (preds.predTarjetaRoja === tarjetaEfectiva) {
    d.tarjeta = PUNTOS.TARJETA_ROJA;
  }

  // 5. Marcador exacto (8 pts) — Hotfix #6: proyecta en vivo.
  //    Si el score actual coincide con la predicción, adjudica los 8 pts.
  //    Puede mutar en cada gol (la función es pura: se re-evalúa cada
  //    recálculo).
  if (
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
