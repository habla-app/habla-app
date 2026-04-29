// Servicio de tickets.
//
// Lote 2 (Abr 2026): demolido el sistema de Lukas. La inscripción a un
// torneo es gratuita; este service sólo gestiona la creación / actualización
// de Tickets con sus predicciones.
//
// Reglas:
//  - Torneo en estado ABIERTO y cierreAt > now para aceptar ticket.
//  - Máximo 10 tickets del mismo usuario en el mismo torneo.
//  - Respetar LimitesJuego.limiteDiarioTickets (sólo cuando el ticket es
//    nuevo, no en updates de placeholder).
//  - Ticket idéntico a uno previo del mismo usuario en el mismo torneo
//    → 409 (la unique constraint compuesta del schema ataja el caso).
//  - Ticket placeholder del flujo de inscripción (predicciones default
//    LOCAL / 0-0 / todo false): si existe y el usuario manda predicciones
//    distintas → el placeholder se ACTUALIZA en vez de crear nuevo.

import {
  prisma,
  Prisma,
  type Ticket,
  type Torneo,
  type Partido,
} from "@habla/db";
import {
  DomainError,
  LimiteExcedido,
  NoAutenticado,
  TorneoCerrado,
  TorneoNoEncontrado,
} from "./errors";
import { logger } from "./logger";
import type { CrearTicketBody } from "./tickets.schema";
import {
  verificarLimiteInscripcion,
  bloquearSiAutoExcluido,
} from "./limites.service";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

export const MAX_TICKETS_POR_TORNEO = 10;
/** Default de LimitesJuego.limiteDiarioTickets. */
export const DEFAULT_LIMITE_DIARIO_TICKETS = 10;

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type TicketConTorneo = Ticket & {
  torneo: Torneo & { partido: Partido };
};

export interface TorneoCountersSnapshot {
  id: string;
  totalInscritos: number;
  cierreAt: Date;
}

export interface CrearTicketResult {
  ticket: Ticket;
  reemplazoPlaceholder: boolean;
  /** Snapshot del torneo POST-create. Permite a la UI repintar contadores
   *  en el modal de éxito sin un GET adicional. */
  torneo: TorneoCountersSnapshot;
}

export interface MisTicketsResult {
  tickets: TicketConTorneo[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface TicketsStats {
  jugadas: number;
  ganadas: number;
  aciertoPct: number;
  mejorPuesto: number | null;
}

// ---------------------------------------------------------------------------
// Helpers privados
// ---------------------------------------------------------------------------

function esPlaceholder(t: {
  predResultado: string;
  predBtts: boolean;
  predMas25: boolean;
  predTarjetaRoja: boolean;
  predMarcadorLocal: number;
  predMarcadorVisita: number;
}): boolean {
  return (
    t.predResultado === "LOCAL" &&
    t.predBtts === false &&
    t.predMas25 === false &&
    t.predTarjetaRoja === false &&
    t.predMarcadorLocal === 0 &&
    t.predMarcadorVisita === 0
  );
}

function prediccionesIguales(
  a: {
    predResultado: string;
    predBtts: boolean;
    predMas25: boolean;
    predTarjetaRoja: boolean;
    predMarcadorLocal: number;
    predMarcadorVisita: number;
  },
  b: CrearTicketBody,
): boolean {
  return (
    a.predResultado === b.predResultado &&
    a.predBtts === b.predBtts &&
    a.predMas25 === b.predMas25 &&
    a.predTarjetaRoja === b.predTarjetaRoja &&
    a.predMarcadorLocal === b.predMarcadorLocal &&
    a.predMarcadorVisita === b.predMarcadorVisita
  );
}

// ---------------------------------------------------------------------------
// crear — flujo principal
// ---------------------------------------------------------------------------

export async function crear(
  usuarioId: string,
  input: CrearTicketBody,
): Promise<CrearTicketResult> {
  return prisma.$transaction(async (tx) => {
    const torneo = await tx.torneo.findUnique({
      where: { id: input.torneoId },
    });
    if (!torneo) throw new TorneoNoEncontrado(input.torneoId);
    if (torneo.estado !== "ABIERTO") throw new TorneoCerrado(input.torneoId);
    if (torneo.cierreAt.getTime() <= Date.now()) {
      throw new TorneoCerrado(input.torneoId);
    }

    const usuario = await tx.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, deletedAt: true },
    });
    if (!usuario || usuario.deletedAt) throw new NoAutenticado();

    const previos = await tx.ticket.findMany({
      where: { usuarioId, torneoId: input.torneoId },
      orderBy: { creadoEn: "asc" },
    });

    const placeholders = previos.filter((p) => esPlaceholder(p));
    const conPredicciones = previos.filter((p) => !esPlaceholder(p));

    const dup = conPredicciones.find((p) => prediccionesIguales(p, input));
    if (dup) {
      throw new DomainError(
        "TICKET_DUPLICADO",
        "Ya enviaste esta combinada.",
        409,
        { ticketId: dup.id },
      );
    }

    const ticketsEfectivos = conPredicciones.length + 1;
    if (ticketsEfectivos > MAX_TICKETS_POR_TORNEO) {
      throw new LimiteExcedido(
        `Máximo ${MAX_TICKETS_POR_TORNEO} tickets por torneo.`,
        { actual: conPredicciones.length, max: MAX_TICKETS_POR_TORNEO },
      );
    }

    // Auto-exclusión SIEMPRE bloquea (aplica a placeholder update también).
    // Límite diario sólo cuenta cuando se crea uno NUEVO; un placeholder
    // update no suma al contador (misma "inscripción" lógica).
    const creamosNuevo = placeholders.length === 0;
    if (creamosNuevo) {
      await verificarLimiteInscripcion({ tx, usuarioId });
    } else {
      await bloquearSiAutoExcluido(usuarioId, tx);
    }

    let ticket: Ticket;
    let reemplazoPlaceholder = false;

    if (placeholders.length > 0) {
      const placeholder = placeholders[0]!;
      try {
        ticket = await tx.ticket.update({
          where: { id: placeholder.id },
          data: {
            predResultado: input.predResultado,
            predBtts: input.predBtts,
            predMas25: input.predMas25,
            predTarjetaRoja: input.predTarjetaRoja,
            predMarcadorLocal: input.predMarcadorLocal,
            predMarcadorVisita: input.predMarcadorVisita,
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          throw new DomainError(
            "TICKET_DUPLICADO",
            "Ya enviaste esta combinada.",
            409,
          );
        }
        throw err;
      }
      reemplazoPlaceholder = true;

      logger.info(
        { torneoId: input.torneoId, usuarioId, ticketId: ticket.id },
        "placeholder actualizado con predicciones reales",
      );

      return {
        ticket,
        reemplazoPlaceholder,
        torneo: {
          id: torneo.id,
          totalInscritos: torneo.totalInscritos,
          cierreAt: torneo.cierreAt,
        },
      };
    }

    try {
      ticket = await tx.ticket.create({
        data: {
          usuarioId,
          torneoId: input.torneoId,
          predResultado: input.predResultado,
          predBtts: input.predBtts,
          predMas25: input.predMas25,
          predTarjetaRoja: input.predTarjetaRoja,
          predMarcadorLocal: input.predMarcadorLocal,
          predMarcadorVisita: input.predMarcadorVisita,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new DomainError(
          "TICKET_DUPLICADO",
          "Ya enviaste esta combinada.",
          409,
        );
      }
      throw err;
    }

    const torneoActualizado = await tx.torneo.update({
      where: { id: input.torneoId },
      data: { totalInscritos: { increment: 1 } },
      select: {
        id: true,
        totalInscritos: true,
        cierreAt: true,
      },
    });

    logger.info(
      { torneoId: input.torneoId, usuarioId, ticketId: ticket.id },
      "ticket creado",
    );

    return {
      ticket,
      reemplazoPlaceholder,
      torneo: torneoActualizado,
    };
  });
}

// ---------------------------------------------------------------------------
// listarMisTickets
// ---------------------------------------------------------------------------

const ESTADOS_ACTIVOS: Array<
  "ABIERTO" | "CERRADO" | "EN_JUEGO" | "FINALIZADO" | "CANCELADO"
> = ["ABIERTO", "CERRADO", "EN_JUEGO"];
const ESTADOS_HISTORIAL: Array<
  "ABIERTO" | "CERRADO" | "EN_JUEGO" | "FINALIZADO" | "CANCELADO"
> = ["FINALIZADO", "CANCELADO"];

export interface ListarMisTicketsInput {
  estado?: "ACTIVOS" | "GANADOS" | "HISTORIAL";
  page?: number;
  limit?: number;
}

export async function listarMisTickets(
  usuarioId: string,
  input: ListarMisTicketsInput = {},
): Promise<MisTicketsResult> {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.TicketWhereInput = { usuarioId };

  if (input.estado === "ACTIVOS") {
    where.torneo = { estado: { in: ESTADOS_ACTIVOS } };
  } else if (input.estado === "GANADOS") {
    // "Ganados" pasa a significar tickets en torneos finalizados con
    // posicionFinal > 0 (entre los inscritos).
    where.AND = [
      { torneo: { estado: "FINALIZADO" } },
      { posicionFinal: { not: null } },
    ];
  } else if (input.estado === "HISTORIAL") {
    where.torneo = { estado: { in: ESTADOS_HISTORIAL } };
  }

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: { torneo: { include: { partido: true } } },
      orderBy: { creadoEn: "desc" },
      skip,
      take: limit,
    }),
    prisma.ticket.count({ where }),
  ]);

  return {
    tickets,
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

// ---------------------------------------------------------------------------
// stats — Lote 2: 4 métricas (Predicciones · Aciertos · % Acierto · Mejor puesto).
// ---------------------------------------------------------------------------

export async function calcularStats(usuarioId: string): Promise<TicketsStats> {
  const todos = await prisma.ticket.findMany({
    where: { usuarioId },
    include: { torneo: { select: { estado: true } } },
  });

  const jugadas = todos.length;
  const finalizados = todos.filter((t) => t.torneo.estado === "FINALIZADO");
  // Un ticket "ganado" en Lote 2+ = quedó dentro del top 10 del ranking
  // final del torneo. La distribución de premios en Lukas se eliminó; sólo
  // la posición importa.
  const TOP = 10;
  const ganadas = finalizados.filter(
    (t) => t.posicionFinal != null && t.posicionFinal <= TOP,
  ).length;
  const aciertoPct = finalizados.length > 0
    ? Math.round((ganadas / finalizados.length) * 100)
    : 0;

  const posiciones = todos
    .map((t) => t.posicionFinal)
    .filter((p): p is number => p !== null && p > 0);
  const mejorPuesto = posiciones.length > 0 ? Math.min(...posiciones) : null;

  return { jugadas, ganadas, aciertoPct, mejorPuesto };
}

// ---------------------------------------------------------------------------
// Helpers exportados
// ---------------------------------------------------------------------------

export { esPlaceholder, prediccionesIguales };
