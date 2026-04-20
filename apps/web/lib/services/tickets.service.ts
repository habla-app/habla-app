// Servicio de tickets — Sub-Sprint 4.
//
// Reglas de negocio (CLAUDE.md §6):
//  - Torneo en estado ABIERTO y cierreAt > now para aceptar ticket.
//  - Balance suficiente para la entrada.
//  - Máximo 10 tickets del mismo usuario en el mismo torneo.
//  - Respetar LimitesJuego.limiteDiarioTickets sobre la suma de tickets
//    del usuario en las últimas 24h.
//  - Ticket idéntico a uno previo del mismo usuario en el mismo torneo
//    → 409 (la unique constraint compuesta del schema ataja el caso).
//  - Todo en una transacción Prisma: descuento Lukas + crear/actualizar
//    Ticket + crear TransaccionLukas ENTRADA_TORNEO. Rollback total
//    si algún paso falla.
//  - Ticket placeholder del Sub-Sprint 3 (predicciones default LOCAL /
//    0-0 / todo false): si existe y el usuario manda predicciones
//    distintas → el placeholder se ACTUALIZA en vez de crear nuevo.
//    Esta es la única vez que un ticket es mutable; después queda
//    inmutable como exige la regla.

import {
  prisma,
  Prisma,
  type Ticket,
  type Torneo,
  type Partido,
} from "@habla/db";
import {
  BalanceInsuficiente,
  DomainError,
  LimiteExcedido,
  NoAutenticado,
  TorneoCerrado,
  TorneoNoEncontrado,
} from "./errors";
import { logger } from "./logger";
import type { CrearTicketBody } from "./tickets.schema";
import { verificarLimiteInscripcion, bloquearSiAutoExcluido } from "./limites.service";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

export const MAX_TICKETS_POR_TORNEO = 10;
/** Default de LimitesJuego.limiteDiarioTickets — Sub-Sprint 7 lo editará. */
export const DEFAULT_LIMITE_DIARIO_TICKETS = 10;

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type TicketConTorneo = Ticket & {
  torneo: Torneo & { partido: Partido };
};

export interface CrearTicketResult {
  ticket: Ticket;
  nuevoBalance: number;
  reemplazoPlaceholder: boolean;
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
  neto: number;
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
    // 1. Torneo ABIERTO y cierreAt > now
    const torneo = await tx.torneo.findUnique({
      where: { id: input.torneoId },
    });
    if (!torneo) throw new TorneoNoEncontrado(input.torneoId);
    if (torneo.estado !== "ABIERTO") throw new TorneoCerrado(input.torneoId);
    if (torneo.cierreAt.getTime() <= Date.now()) {
      throw new TorneoCerrado(input.torneoId);
    }

    // 2. Usuario existe
    const usuario = await tx.usuario.findUnique({
      where: { id: usuarioId },
      select: { balanceLukas: true },
    });
    if (!usuario) throw new NoAutenticado();

    // 3. Tickets previos de este usuario en este torneo (para validar
    //    límite de 10, detectar placeholder, detectar duplicado lógico).
    const previos = await tx.ticket.findMany({
      where: { usuarioId, torneoId: input.torneoId },
      orderBy: { creadoEn: "asc" },
    });

    const placeholders = previos.filter((p) => esPlaceholder(p));
    const conPredicciones = previos.filter((p) => !esPlaceholder(p));

    // Duplicado entre los tickets ya con predicciones reales
    const dup = conPredicciones.find((p) => prediccionesIguales(p, input));
    if (dup) {
      throw new DomainError(
        "TICKET_DUPLICADO",
        "Ya enviaste esta combinada.",
        409,
        { ticketId: dup.id },
      );
    }

    // Cuenta efectiva: placeholders se sobrescriben en la primera
    // inscripción real, así que no cuentan para el límite. Pero sí
    // cuenta el ticket que estamos por crear (o el que vamos a actualizar).
    const ticketsEfectivos = placeholders.length > 0
      ? conPredicciones.length + 1
      : conPredicciones.length + 1;

    if (ticketsEfectivos > MAX_TICKETS_POR_TORNEO) {
      throw new LimiteExcedido(
        `Máximo ${MAX_TICKETS_POR_TORNEO} tickets por torneo.`,
        { actual: conPredicciones.length, max: MAX_TICKETS_POR_TORNEO },
      );
    }

    // 4. Enforcement de límites (Sub-Sprint 7).
    //    - Auto-exclusión SIEMPRE bloquea (aplica a placeholder update también).
    //    - Límite diario de tickets solo cuenta cuando se crea uno NUEVO; un
    //      placeholder update no suma al contador (misma "inscripción" lógica).
    const creamosNuevo = placeholders.length === 0;
    if (creamosNuevo) {
      await verificarLimiteInscripcion({
        tx,
        usuarioId,
        entradaLukas: torneo.entradaLukas,
      });
    } else {
      await bloquearSiAutoExcluido(usuarioId, tx);
    }

    // 5. Reemplazo de placeholder si existe
    let ticket: Ticket;
    let reemplazoPlaceholder = false;

    if (placeholders.length > 0) {
      // Hay un placeholder — lo actualizamos con las predicciones reales.
      // No se descuenta entrada de nuevo: la entrada ya se cobró al
      // inscribirse (Sub-Sprint 3). Capturamos P2002 por si el usuario
      // actualiza a predicciones idénticas a otro ticket ya real.
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
        nuevoBalance: usuario.balanceLukas,
        reemplazoPlaceholder,
      };
    }

    // 6. Ticket nuevo — requiere descuento de entrada
    if (usuario.balanceLukas < torneo.entradaLukas) {
      throw new BalanceInsuficiente(usuario.balanceLukas, torneo.entradaLukas);
    }

    await tx.usuario.update({
      where: { id: usuarioId },
      data: { balanceLukas: { decrement: torneo.entradaLukas } },
    });

    await tx.transaccionLukas.create({
      data: {
        usuarioId,
        tipo: "ENTRADA_TORNEO",
        monto: -torneo.entradaLukas,
        descripcion: `Inscripción a ${torneo.nombre}`,
        refId: input.torneoId,
      },
    });

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

    await tx.torneo.update({
      where: { id: input.torneoId },
      data: {
        totalInscritos: { increment: 1 },
        pozoBruto: { increment: torneo.entradaLukas },
      },
    });

    const nuevoBalance = usuario.balanceLukas - torneo.entradaLukas;

    logger.info(
      {
        torneoId: input.torneoId,
        usuarioId,
        ticketId: ticket.id,
        entradaLukas: torneo.entradaLukas,
        nuevoBalance,
      },
      "ticket creado",
    );

    return { ticket, nuevoBalance, reemplazoPlaceholder };
  });
}

// `obtenerLimiteDiario` fue reemplazado por `verificarLimiteInscripcion` del
// nuevo `limites.service` (Sub-Sprint 7) que ahora consulta `LimitesJuego`
// real + chequea auto-exclusión.

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
    where.premioLukas = { gt: 0 };
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
// stats
// ---------------------------------------------------------------------------

export async function calcularStats(usuarioId: string): Promise<TicketsStats> {
  const todos = await prisma.ticket.findMany({
    where: { usuarioId },
    include: { torneo: { select: { entradaLukas: true, estado: true } } },
  });

  const jugadas = todos.length;
  const ganadas = todos.filter((t) => t.premioLukas > 0).length;
  const finalizados = todos.filter((t) => t.torneo.estado === "FINALIZADO");
  const aciertoPct = finalizados.length > 0
    ? Math.round(
        (finalizados.filter((t) => t.premioLukas > 0).length /
          finalizados.length) *
          100,
      )
    : 0;

  const neto = todos.reduce((acc, t) => {
    // Torneos CANCELADOS reembolsaron la entrada → no resta
    if (t.torneo.estado === "CANCELADO") return acc;
    return acc + t.premioLukas - t.torneo.entradaLukas;
  }, 0);

  const posiciones = todos
    .map((t) => t.posicionFinal)
    .filter((p): p is number => p !== null && p > 0);
  const mejorPuesto = posiciones.length > 0 ? Math.min(...posiciones) : null;

  return { jugadas, ganadas, aciertoPct, neto, mejorPuesto };
}

// ---------------------------------------------------------------------------
// Helpers exportados para otros servicios y tests
// ---------------------------------------------------------------------------

export { esPlaceholder, prediccionesIguales };
