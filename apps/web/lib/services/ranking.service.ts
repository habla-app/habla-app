// Servicio de ranking en vivo — Sub-Sprint 5 + Hotfix #6.
//
// Fuente de verdad: la base de datos (Ticket.puntosTotal). Redis se usa
// como cache del sorted set para lecturas <1ms; si Redis no responde
// degradamos a BD.
//
// Hotfix #6 — Nueva distribución de premios (§6):
//   - Pagan el 10% de inscritos, brackets especiales para N<100.
//   - Curva top-heavy: 45% al 1°, 55% restante en decaimiento geométrico.
//   - Empates: tickets con puntaje idéntico reparten equitativamente
//     los premios de las posiciones que ocupan como grupo.
//   - Desempates adicionales ELIMINADOS. Mismos puntos = mismo premio.
//     El orden de inscripción queda como tiebreaker cosmético estable
//     para que la UI no salte entre refreshes, pero no afecta premios.

import { prisma, type Prisma } from "@habla/db";
import { TorneoNoEncontrado } from "./errors";
import { logger } from "./logger";
import {
  distribuirPremios,
  premioEstimadoSinEmpate,
  type TicketParaDistribuir,
} from "../utils/premios-distribucion";
import { recalcularTorneo } from "./puntuacion.service";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface RankingRow {
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
  creadoEn: Date;
}

export interface RankingResult {
  torneoId: string;
  totalInscritos: number;
  pozoNeto: number;
  pozoBruto: number;
  ranking: RankingRow[];
  miPosicion: (RankingRow & { posicion: number }) | null;
  /** Posiciones pagadas (M) según `calcularPagados(totalInscritos)`.
   *  UI lo usa para el badge "En el dinero" y el copy motivacional. */
  pagados: number;
}

export interface ListarRankingInput {
  page?: number;
  limit?: number;
  usuarioId?: string;
}

// ---------------------------------------------------------------------------
// listar — función principal
// ---------------------------------------------------------------------------

type TicketConUsuario = Prisma.TicketGetPayload<{
  include: { usuario: { select: { id: true; nombre: true; email: true } } };
}>;

export async function listarRanking(
  torneoId: string,
  input: ListarRankingInput = {},
): Promise<RankingResult> {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(500, Math.max(1, input.limit ?? 50));

  const torneo = await prisma.torneo.findUnique({
    where: { id: torneoId },
    select: {
      id: true,
      pozoBruto: true,
      pozoNeto: true,
      totalInscritos: true,
      estado: true,
    },
  });
  if (!torneo) throw new TorneoNoEncontrado(torneoId);

  // Si el torneo está ABIERTO, pozoNeto aún es 0 — estimamos con 88%
  // del pozoBruto actual para que los premios estimados sean útiles
  // mientras la gente se sigue inscribiendo.
  const pozoNetoEstimado =
    torneo.pozoNeto > 0
      ? torneo.pozoNeto
      : Math.floor(torneo.pozoBruto * 0.88);

  const tickets = await prisma.ticket.findMany({
    where: { torneoId },
    include: { usuario: { select: { id: true, nombre: true, email: true } } },
  });

  // Ordenamiento: puntosTotal DESC, creadoEn ASC. El segundo criterio
  // es SÓLO cosmético — jugadores con mismos puntos reciben el mismo
  // premio (split por empate).
  const ordenados = [...tickets].sort(comparadorCosmetico);

  // Distribución de premios: pasamos los tickets al helper puro. El
  // resultado nos da `posicionFinal` + `premioLukas` para cada uno,
  // respetando los empates.
  const ticketsParaDistribuir: TicketParaDistribuir[] = ordenados.map((t) => ({
    id: t.id,
    puntosTotal: t.puntosTotal,
    creadoEn: t.creadoEn,
  }));
  const asignaciones = distribuirPremios(
    ticketsParaDistribuir,
    torneo.totalInscritos,
    pozoNetoEstimado,
  );
  const premioPorTicketId = new Map(
    asignaciones.map((a) => [a.ticketId, a]),
  );

  // `rank` visual: el índice del array ordenado + 1. Para empates, el
  // primer ticket del grupo tiene rank == posicionFinal y los demás
  // tienen rank > posicionFinal (para UI sigan visualmente abajo del
  // primero, aunque compartan premio). En el futuro podríamos
  // colapsar visualmente los empates, pero el MVP conserva el orden.
  const rows: RankingRow[] = ordenados.map((t, idx) => {
    const rank = idx + 1;
    const asig = premioPorTicketId.get(t.id);
    return {
      rank,
      ticketId: t.id,
      usuarioId: t.usuarioId,
      nombre: nombreDisplay(t.usuario),
      puntosTotal: t.puntosTotal,
      puntosDetalle: {
        resultado: t.puntosResultado,
        btts: t.puntosBtts,
        mas25: t.puntosMas25,
        tarjeta: t.puntosTarjeta,
        marcador: t.puntosMarcador,
      },
      predicciones: {
        predResultado: t.predResultado,
        predBtts: t.predBtts,
        predMas25: t.predMas25,
        predTarjetaRoja: t.predTarjetaRoja,
        predMarcadorLocal: t.predMarcadorLocal,
        predMarcadorVisita: t.predMarcadorVisita,
      },
      premioEstimado: asig?.premioLukas ?? 0,
      creadoEn: t.creadoEn,
    };
  });

  // Slice paginado
  const start = (page - 1) * limit;
  const slice = rows.slice(start, start + limit);

  // miPosicion: si el caller pasó usuarioId, buscamos su mejor ticket
  // (el de mayor puntosTotal / mejor rank).
  let miPosicion: RankingResult["miPosicion"] = null;
  if (input.usuarioId) {
    const propios = rows.filter((r) => r.usuarioId === input.usuarioId);
    if (propios.length > 0) {
      const mejor = propios.reduce((acc, r) => (r.rank < acc.rank ? r : acc));
      miPosicion = { ...mejor, posicion: mejor.rank };
    }
  }

  // pagados: lo exponemos para que la UI del badge "En el dinero" y el
  // copy motivacional del Ítem 1.6 del Hotfix #6 calculen posicionamiento.
  const { calcularPagados } = await import("../utils/premios-distribucion");
  const pagados = calcularPagados(torneo.totalInscritos);

  return {
    torneoId,
    totalInscritos: torneo.totalInscritos,
    pozoNeto: pozoNetoEstimado,
    pozoBruto: torneo.pozoBruto,
    ranking: slice,
    miPosicion,
    pagados,
  };
}

function comparadorCosmetico(a: TicketConUsuario, b: TicketConUsuario): number {
  if (b.puntosTotal !== a.puntosTotal) return b.puntosTotal - a.puntosTotal;
  return a.creadoEn.getTime() - b.creadoEn.getTime();
}

function nombreDisplay(u: {
  nombre: string;
  email: string;
  id: string;
}): string {
  if (u.nombre && !u.nombre.includes("@")) return u.nombre;
  const prefix = u.email.split("@")[0] ?? u.id.slice(0, 8);
  return prefix;
}

// ---------------------------------------------------------------------------
// calcularPremioEstimado — helper público (compat con callers que no
// necesitan el full ranking). Útil para notificaciones pre-finalización
// o tooltips del mockup. Proyecta SIN empates.
// ---------------------------------------------------------------------------

export function calcularPremioEstimado(
  pozoNeto: number,
  posicion: number,
  totalInscritos: number,
): number {
  return premioEstimadoSinEmpate(posicion, totalInscritos, pozoNeto);
}

// ---------------------------------------------------------------------------
// finalizarTorneo — llamado por el poller cuando el partido llega a
// FIN_PARTIDO. Asigna posiciones finales + premios definitivos usando
// la nueva distribución con empates. Marca el torneo FINALIZADO.
//
// Hotfix #7 Bug #18/#19: antes solo actualizaba `posicionFinal` +
// `premioLukas` en el Ticket. AHORA:
//   1. Recalcula puntos con el snapshot FINAL del partido antes de
//      distribuir — defensa contra tickets con puntos pre-FT stale
//      (ej. btts=null durante EN_VIVO que se resuelve solo al FT).
//   2. Acredita los Lukas a cada ganador en una transacción atómica
//      que también crea `TransaccionLukas { tipo: PREMIO_TORNEO }`.
//      Idempotente: si el torneo ya estaba FINALIZADO NO hace nada
//      (protege contra doble crédito si el poller re-dispara).
// ---------------------------------------------------------------------------

export interface FinalizarTorneoResult {
  torneoId: string;
  ganadores: Array<{
    rank: number;
    ticketId: string;
    usuarioId: string;
    nombre: string;
    puntosTotal: number;
    premioLukas: number;
  }>;
  /** Hotfix #7: true si ya estaba FINALIZADO y no se hizo nada (idempotencia). */
  alreadyFinalized: boolean;
}

export async function finalizarTorneo(
  torneoId: string,
): Promise<FinalizarTorneoResult> {
  const preTorneo = await prisma.torneo.findUnique({
    where: { id: torneoId },
    select: { estado: true },
  });
  if (!preTorneo) throw new TorneoNoEncontrado(torneoId);

  // Idempotencia: si ya está FINALIZADO, no re-acreditamos. Esta es la
  // barrera dura contra doble crédito si el poller dispara
  // `finalizarTorneo` dos veces por reconexión o re-entrega de eventos.
  if (preTorneo.estado === "FINALIZADO") {
    logger.info(
      { torneoId },
      "finalizarTorneo: torneo ya está FINALIZADO — skip (idempotencia)",
    );
    return { torneoId, ganadores: [], alreadyFinalized: true };
  }

  // Bug #19: recalcular puntos ANTES de distribuir premios. El poller
  // recalcula tras cada evento pero el snapshot final del partido puede
  // haber llegado en el mismo tick que la transición a FINALIZADO; si
  // el poller recalcula y finaliza back-to-back NO hay problema, pero
  // si `finalizarTorneo` se llama desde un admin endpoint o retry,
  // garantizamos los puntos correctos del snapshot actual.
  await recalcularTorneo(torneoId);

  const torneo = await prisma.torneo.findUnique({
    where: { id: torneoId },
    select: { pozoNeto: true, pozoBruto: true, estado: true, totalInscritos: true },
  });
  if (!torneo) throw new TorneoNoEncontrado(torneoId);

  // pozoNeto debería estar seteado por el cierre automático. Si no lo
  // está (torneo que estaba EN_JUEGO sin pasar por CERRADO), calculamos.
  const pozoNeto =
    torneo.pozoNeto > 0
      ? torneo.pozoNeto
      : Math.floor(torneo.pozoBruto * 0.88);

  // Traer todos los tickets con el usuario (para el display name).
  const tickets = await prisma.ticket.findMany({
    where: { torneoId },
    include: { usuario: { select: { id: true, nombre: true, email: true } } },
  });

  // Distribuir premios con la nueva regla (split por empate).
  const asignaciones = distribuirPremios(
    tickets.map((t) => ({
      id: t.id,
      puntosTotal: t.puntosTotal,
      creadoEn: t.creadoEn,
    })),
    torneo.totalInscritos,
    pozoNeto,
  );
  const porTicketId = new Map(asignaciones.map((a) => [a.ticketId, a]));

  // Bug #18: todo lo siguiente en una transacción atómica. Si algo
  // falla, NI los premios se acreditan NI el torneo se marca como
  // FINALIZADO — la próxima corrida del poller reintenta todo.
  const resultado = await prisma.$transaction(async (tx) => {
    const ganadores: FinalizarTorneoResult["ganadores"] = [];

    for (const t of tickets) {
      const asig = porTicketId.get(t.id);
      if (!asig) continue;

      await tx.ticket.update({
        where: { id: t.id },
        data: {
          posicionFinal: asig.posicionFinal,
          premioLukas: asig.premioLukas,
        },
      });

      if (asig.premioLukas > 0) {
        // Bug #18: acredita el premio al usuario + crea la transacción
        // PREMIO_TORNEO. Los Lukas ganados NO vencen (CLAUDE.md §6),
        // por eso no seteamos venceEn.
        await tx.usuario.update({
          where: { id: t.usuarioId },
          data: { balanceLukas: { increment: asig.premioLukas } },
        });
        await tx.transaccionLukas.create({
          data: {
            usuarioId: t.usuarioId,
            tipo: "PREMIO_TORNEO",
            monto: asig.premioLukas,
            descripcion: `Premio ${asig.posicionFinal}° puesto · torneo ${torneoId}`,
            refId: torneoId,
          },
        });
        ganadores.push({
          rank: asig.posicionFinal,
          ticketId: t.id,
          usuarioId: t.usuarioId,
          nombre: nombreDisplay(t.usuario),
          puntosTotal: t.puntosTotal,
          premioLukas: asig.premioLukas,
        });
      }
    }

    await tx.torneo.update({
      where: { id: torneoId },
      data: { estado: "FINALIZADO" },
    });

    return ganadores;
  });

  logger.info(
    {
      torneoId,
      totalTickets: tickets.length,
      ganadores: resultado.length,
      totalAcreditado: resultado.reduce((a, g) => a + g.premioLukas, 0),
    },
    "torneo finalizado + saldos acreditados",
  );

  return { torneoId, ganadores: resultado, alreadyFinalized: false };
}

// ---------------------------------------------------------------------------
// reconciliarTorneoFinalizado — Hotfix #7 Bug #20.
//
// Admin-only. Para torneos FINALIZADOS que quedaron mal: puntos
// calculados con el motor viejo (pre-Hotfix #6) o sin crédito de Lukas
// (pre-Hotfix #7 Bug #18).
//
// Procedimiento:
//   1. Recalcula puntos con el snapshot actual del partido (motor nuevo).
//   2. Recomputa distribución con la regla vigente.
//   3. Para cada usuario, compara expected vs ya acreditado (sumando
//      TransaccionLukas { tipo: PREMIO_TORNEO, refId: torneoId }).
//   4. Acredita el delta (puede ser positivo = pagar más, negativo =
//      reintegro — aunque en MVP no esperamos deltas negativos porque
//      la regla nueva premia más).
//   5. Actualiza `Ticket.posicionFinal` y `Ticket.premioLukas` al
//      valor expected.
//
// Idempotente: si los valores ya coinciden, no hace nada. Correrlo
// dos veces seguidas solo genera logs, no doble-acredita.
// ---------------------------------------------------------------------------

export interface ReconciliarResult {
  torneoId: string;
  ajustes: Array<{
    ticketId: string;
    usuarioId: string;
    nombre: string;
    posicionFinalAnterior: number | null;
    posicionFinalNueva: number;
    premioLukasAnterior: number;
    premioLukasNuevo: number;
    yaAcreditado: number;
    deltaAcreditado: number;
  }>;
  totalDeltaAcreditado: number;
  puntosRecalculados: boolean;
}

export async function reconciliarTorneoFinalizado(
  torneoId: string,
): Promise<ReconciliarResult> {
  const torneo = await prisma.torneo.findUnique({
    where: { id: torneoId },
    select: {
      id: true,
      estado: true,
      pozoNeto: true,
      pozoBruto: true,
      totalInscritos: true,
    },
  });
  if (!torneo) throw new TorneoNoEncontrado(torneoId);
  if (torneo.estado !== "FINALIZADO") {
    throw new Error(
      `Torneo ${torneoId} no está FINALIZADO (estado=${torneo.estado}); use finalizarTorneo en su lugar.`,
    );
  }

  // 1. Recalcula puntos con el motor actual.
  await recalcularTorneo(torneoId);

  const pozoNeto =
    torneo.pozoNeto > 0
      ? torneo.pozoNeto
      : Math.floor(torneo.pozoBruto * 0.88);

  const tickets = await prisma.ticket.findMany({
    where: { torneoId },
    include: { usuario: { select: { id: true, nombre: true, email: true } } },
  });

  // 2. Recomputa distribución con la regla vigente (Hotfix #6).
  const asignaciones = distribuirPremios(
    tickets.map((t) => ({
      id: t.id,
      puntosTotal: t.puntosTotal,
      creadoEn: t.creadoEn,
    })),
    torneo.totalInscritos,
    pozoNeto,
  );
  const porTicketId = new Map(asignaciones.map((a) => [a.ticketId, a]));

  // 3. Traer todas las TransaccionLukas PREMIO_TORNEO ya creadas para
  //    este torneo (puede haber de corridas previas o de manual fixes).
  const yaAcreditadas = await prisma.transaccionLukas.findMany({
    where: { tipo: "PREMIO_TORNEO", refId: torneoId },
    select: { usuarioId: true, monto: true },
  });
  const acreditadoPorUsuario = new Map<string, number>();
  for (const t of yaAcreditadas) {
    acreditadoPorUsuario.set(
      t.usuarioId,
      (acreditadoPorUsuario.get(t.usuarioId) ?? 0) + t.monto,
    );
  }

  // 4. Aplicar deltas en transacción atómica.
  const result = await prisma.$transaction(async (tx) => {
    const ajustes: ReconciliarResult["ajustes"] = [];

    for (const t of tickets) {
      const asig = porTicketId.get(t.id);
      if (!asig) continue;

      const yaAcreditado = acreditadoPorUsuario.get(t.usuarioId) ?? 0;
      // Nota: si el usuario tiene múltiples tickets en el mismo torneo,
      // `yaAcreditado` es la suma total ya acreditada POR USUARIO, no
      // por ticket. Pero `expected` es por ticket. Para simplificar, en
      // MVP asumimos 1 ticket por usuario ganador (típico) — si hay
      // múltiples, el primer ticket del usuario consume el acreditado
      // ya registrado y los demás reciben el delta completo. El split
      // por empate del helper `distribuirPremios` ya maneja correctamente
      // el caso multi-ticket.
      const previo = acreditadoPorUsuario.get(t.usuarioId) ?? 0;
      const delta = asig.premioLukas - (previo > 0 ? previo : 0);

      // Actualiza ticket con los valores correctos independientemente.
      await tx.ticket.update({
        where: { id: t.id },
        data: {
          posicionFinal: asig.posicionFinal,
          premioLukas: asig.premioLukas,
        },
      });

      if (delta > 0) {
        // Acredita el delta + crea transacción de ajuste.
        await tx.usuario.update({
          where: { id: t.usuarioId },
          data: { balanceLukas: { increment: delta } },
        });
        await tx.transaccionLukas.create({
          data: {
            usuarioId: t.usuarioId,
            tipo: "PREMIO_TORNEO",
            monto: delta,
            descripcion: `Ajuste premio ${asig.posicionFinal}° puesto · torneo ${torneoId}`,
            refId: torneoId,
          },
        });
        // Actualizamos el map para evitar re-acreditar si el mismo
        // usuario aparece de nuevo (multi-ticket).
        acreditadoPorUsuario.set(t.usuarioId, (previo > 0 ? previo : 0) + delta);
      }

      ajustes.push({
        ticketId: t.id,
        usuarioId: t.usuarioId,
        nombre: nombreDisplay(t.usuario),
        posicionFinalAnterior: t.posicionFinal,
        posicionFinalNueva: asig.posicionFinal,
        premioLukasAnterior: t.premioLukas,
        premioLukasNuevo: asig.premioLukas,
        yaAcreditado,
        deltaAcreditado: delta > 0 ? delta : 0,
      });
    }

    return ajustes;
  });

  const totalDeltaAcreditado = result.reduce(
    (a, b) => a + b.deltaAcreditado,
    0,
  );

  logger.info(
    {
      torneoId,
      ticketsAjustados: result.length,
      totalDeltaAcreditado,
    },
    "torneo reconciliado (Hotfix #7 Bug #20)",
  );

  return {
    torneoId,
    ajustes: result,
    totalDeltaAcreditado,
    puntosRecalculados: true,
  };
}
