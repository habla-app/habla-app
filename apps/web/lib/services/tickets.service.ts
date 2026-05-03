// Servicio de tickets.
//
// Lote 2 (Abr 2026): demolido el sistema de Lukas. La inscripción a un
// torneo es gratuita; este service sólo gestiona la creación / actualización
// de Tickets con sus predicciones.
// Lote 3 (Abr 2026): demolido el sistema de límites de juego responsable
// (LimitesJuego, auto-exclusión). Ya no aplica en el modelo editorial /
// comunidad / afiliación MINCETUR — el operador final maneja sus propios
// límites bajo regulación. Sólo queda el cap de 10 tickets por torneo.
//
// Lote M v3.2 (May 2026): aplica las 9 sub-decisiones §4.9 del análisis.
// Una combinada por jugador por torneo (unique constraint del Lote K).
// El usuario puede editar (incrementa numEdiciones) y eliminar antes del
// kickoff. Después del kickoff, todo inmutable. Tres operaciones nuevas:
//   - editar()   — actualiza una combinada existente
//   - eliminar() — borra una combinada antes del kickoff
//   - obtenerMiCombinada() — atajo para precargar el modal
//
// Reglas integrales (§4.9):
//  - 4.9.1 Unique (usuarioId, torneoId) en BD (Lote K) — bloqueo duro.
//  - 4.9.2 Validación servidor antes del kickoff (race condition guard).
//  - 4.9.5 Eliminación voluntaria + recreación libre antes del kickoff.
//  - 4.9.6 Las 5 predicciones obligatorias (Zod ya valida).
//  - 4.9.7 numEdiciones se incrementa en cada edición.
//  - 4.9.8 Privacidad: combinadas ajenas no se exponen antes del kickoff
//    (responsabilidad del caller — listar/leer).
//  - 4.9.9 Combinadas en torneos cerrados son históricas e inmutables.

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

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

export const MAX_TICKETS_POR_TORNEO = 10;

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
      include: { partido: { select: { fechaInicio: true } } },
    });
    if (!torneo) throw new TorneoNoEncontrado(input.torneoId);
    if (torneo.estado !== "ABIERTO") throw new TorneoCerrado(input.torneoId);
    // Decisión §4.9.2: race condition guard. Validamos contra
    // partido.fechaInicio (fuente de verdad de "ya empezó") además del
    // cierreAt del torneo. Cualquiera que pase ya es trigger de cierre.
    const ahora = Date.now();
    if (
      torneo.cierreAt.getTime() <= ahora ||
      torneo.partido.fechaInicio.getTime() <= ahora
    ) {
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
// editar — Lote M v3.2 (decisiones §4.9.2 + §4.9.5 + §4.9.7).
//
// Actualiza la combinada del usuario en el torneo. Reglas:
//   - El usuario debe ser dueño del ticket (404 si no).
//   - El partido NO debe haber empezado todavía (TORNEO_CERRADO si sí —
//     race condition guard del 4.9.2: comparamos contra partido.fechaInicio
//     en BD para no depender de cierreAt mutable).
//   - numEdiciones += 1.
//   - Idempotente respecto al unique compuesto: si las nuevas predicciones
//     son idénticas a las viejas, también incrementa numEdiciones (la
//     intención del usuario igual fue editar).
// ---------------------------------------------------------------------------

export interface EditarTicketResult {
  ticket: Ticket;
}

export async function editar(
  ticketId: string,
  usuarioId: string,
  input: CrearTicketBody,
): Promise<EditarTicketResult> {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      include: { torneo: { include: { partido: true } } },
    });
    if (!ticket) {
      throw new DomainError(
        "TICKET_NO_ENCONTRADO",
        "No existe esa combinada.",
        404,
      );
    }
    if (ticket.usuarioId !== usuarioId) {
      throw new DomainError(
        "NO_AUTORIZADO",
        "Esta combinada no es tuya.",
        403,
      );
    }
    // Decisión §4.9.2: validar contra partido.fechaInicio, no cierreAt.
    // Si por algún hotfix el cierreAt diverge de la fecha real (raro pero
    // posible), priorizamos la fecha del partido — es lo que ve el usuario
    // y lo que indica "ya empezó".
    if (ticket.torneo.partido.fechaInicio.getTime() <= Date.now()) {
      throw new TorneoCerrado(ticket.torneoId);
    }
    if (ticket.torneo.estado !== "ABIERTO") {
      throw new TorneoCerrado(ticket.torneoId);
    }

    let actualizado: Ticket;
    try {
      actualizado = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          predResultado: input.predResultado,
          predBtts: input.predBtts,
          predMas25: input.predMas25,
          predTarjetaRoja: input.predTarjetaRoja,
          predMarcadorLocal: input.predMarcadorLocal,
          predMarcadorVisita: input.predMarcadorVisita,
          numEdiciones: { increment: 1 },
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        // Conflict en la unique de predicciones identicas: alguna ediciòn
        // anterior ya quedó con esta combinaciòn. Lo tratamos como noop
        // semántico: el usuario no perdiò datos, su combinada queda válida.
        throw new DomainError(
          "TICKET_DUPLICADO",
          "Esta combinada coincide con una variante anterior tuya.",
          409,
        );
      }
      throw err;
    }

    logger.info(
      {
        torneoId: ticket.torneoId,
        usuarioId,
        ticketId: ticket.id,
        numEdiciones: actualizado.numEdiciones,
      },
      "ticket editado",
    );

    return { ticket: actualizado };
  });
}

// ---------------------------------------------------------------------------
// eliminar — Lote M v3.2 (decisión §4.9.5).
//
// Borra la combinada del usuario antes del kickoff. Después del kickoff,
// rechaza con TORNEO_CERRADO. Decrementa totalInscritos del torneo.
// ---------------------------------------------------------------------------

export interface EliminarTicketResult {
  torneoId: string;
}

export async function eliminar(
  ticketId: string,
  usuarioId: string,
): Promise<EliminarTicketResult> {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      include: { torneo: { include: { partido: true } } },
    });
    if (!ticket) {
      throw new DomainError(
        "TICKET_NO_ENCONTRADO",
        "No existe esa combinada.",
        404,
      );
    }
    if (ticket.usuarioId !== usuarioId) {
      throw new DomainError(
        "NO_AUTORIZADO",
        "Esta combinada no es tuya.",
        403,
      );
    }
    if (ticket.torneo.partido.fechaInicio.getTime() <= Date.now()) {
      throw new TorneoCerrado(ticket.torneoId);
    }
    if (ticket.torneo.estado !== "ABIERTO") {
      throw new TorneoCerrado(ticket.torneoId);
    }

    await tx.ticket.delete({ where: { id: ticket.id } });
    await tx.torneo.update({
      where: { id: ticket.torneoId },
      data: {
        totalInscritos: { decrement: 1 },
      },
    });

    logger.info(
      { torneoId: ticket.torneoId, usuarioId, ticketId },
      "ticket eliminado",
    );

    return { torneoId: ticket.torneoId };
  });
}

// ---------------------------------------------------------------------------
// obtenerMiCombinada — Lote M v3.2.
//
// Devuelve la combinada del usuario para un torneo dado. Útil para
// precargar el ComboModal sin tener que hacer dos round-trips (resolver
// el partido + buscar el ticket). null si no existe.
// ---------------------------------------------------------------------------

export async function obtenerMiCombinada(
  torneoId: string,
  usuarioId: string,
): Promise<Ticket | null> {
  return prisma.ticket.findFirst({
    where: { torneoId, usuarioId },
    orderBy: { creadoEn: "desc" },
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
