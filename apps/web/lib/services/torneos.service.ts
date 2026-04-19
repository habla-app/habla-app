// Servicio de torneos — operaciones principales del Sub-Sprint 3.
//
// Reglas de negocio (CLAUDE.md §6):
// - Cierre = partido.fechaInicio - 5 minutos (irreversible).
// - Rake = 12% del pozo bruto (al entero de Luka, floor).
// - Distribución: 35% / 20% / 12% / 33% repartido entre 4°-10°.
// - Torneo con <2 inscritos al cierre se cancela y se reembolsa.
// - Todo movimiento de Lukas es transacción atómica.
// - Un Ticket placeholder se crea con predicciones default (LOCAL, 0-0,
//   todo en false). El Sub-Sprint 4 permite editarlas. La unique
//   constraint `[usuarioId, torneoId, preds…]` evita doble inscripción
//   con defaults; en Sub-Sprint 4 los usuarios pueden crear tickets
//   adicionales siempre que las predicciones difieran.

import {
  prisma,
  Prisma,
  type Partido,
  type Ticket,
  type Torneo,
  type EstadoTorneo,
  type TipoTorneo,
} from "@habla/db";
import {
  BalanceInsuficiente,
  NoAutenticado,
  PartidoNoEncontrado,
  TorneoCerrado,
  TorneoNoEncontrado,
  ValidacionFallida,
  YaInscrito,
  DomainError,
} from "./errors";
import { logger } from "./logger";
import { verificarLimiteInscripcion } from "./limites.service";

// ---------------------------------------------------------------------------
// Constantes del negocio
// ---------------------------------------------------------------------------

export const RAKE_PCT = 0.12;
export const CIERRE_MIN_BEFORE = 5; /* minutos antes del partido */
export const MIN_INSCRITOS_PARA_ACTIVAR = 2;

export const DISTRIB_PREMIOS = {
  "1": 0.35,
  "2": 0.20,
  "3": 0.12,
  "4-10": 0.33,
} as const;

// ---------------------------------------------------------------------------
// Tipos de retorno
// ---------------------------------------------------------------------------

export type TorneoConPartido = Torneo & { partido: Partido };

export interface ListarInput {
  estado?: EstadoTorneo;
  liga?: string;
  /** Filtro sobre partido.fechaInicio (inclusive). */
  desde?: Date;
  /** Filtro sobre partido.fechaInicio (inclusive). */
  hasta?: Date;
  page?: number;
  limit?: number;
}

export interface ListarResult {
  torneos: TorneoConPartido[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface InscribirResult {
  ticket: Ticket;
  torneo: Torneo;
  nuevoBalance: number;
}

export interface CancelarResult {
  torneoId: string;
  motivo: string;
  refunded: number;
  reembolsoTotalLukas: number;
}

export interface CierreAutomaticoResult {
  cerrados: Array<{ torneoId: string; pozoBruto: number; pozoNeto: number; rake: number }>;
  cancelados: Array<{ torneoId: string; motivo: string; refunded: number }>;
}

// ---------------------------------------------------------------------------
// listar — paginado + filtros
// ---------------------------------------------------------------------------

export async function listar(input: ListarInput = {}): Promise<ListarResult> {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.TorneoWhereInput = {};
  if (input.estado) where.estado = input.estado;

  const partidoFilter: Prisma.PartidoWhereInput = {};
  if (input.liga) partidoFilter.liga = input.liga;
  if (input.desde || input.hasta) {
    partidoFilter.fechaInicio = {};
    if (input.desde) partidoFilter.fechaInicio.gte = input.desde;
    if (input.hasta) partidoFilter.fechaInicio.lte = input.hasta;
  }
  if (Object.keys(partidoFilter).length > 0) where.partido = partidoFilter;

  const [torneos, total] = await Promise.all([
    prisma.torneo.findMany({
      where,
      include: { partido: true },
      orderBy: { cierreAt: "asc" },
      skip,
      take: limit,
    }),
    prisma.torneo.count({ where }),
  ]);

  return {
    torneos,
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

// ---------------------------------------------------------------------------
// obtener — detalle con partido y ticket propio (si hay sesión)
// ---------------------------------------------------------------------------

export interface ObtenerResult {
  torneo: TorneoConPartido;
  miTicket: Ticket | null;
}

export async function obtener(
  id: string,
  usuarioId?: string,
): Promise<ObtenerResult> {
  const torneo = await prisma.torneo.findUnique({
    where: { id },
    include: { partido: true },
  });
  if (!torneo) throw new TorneoNoEncontrado(id);

  let miTicket: Ticket | null = null;
  if (usuarioId) {
    miTicket = await prisma.ticket.findFirst({
      where: { torneoId: id, usuarioId },
    });
  }

  return { torneo, miTicket };
}

// ---------------------------------------------------------------------------
// crear — admin crea un torneo sobre un partido disponible
// ---------------------------------------------------------------------------

export interface CrearInput {
  partidoId: string;
  tipo: TipoTorneo;
  entradaLukas: number;
  nombre?: string;
}

export async function crear(input: CrearInput): Promise<TorneoConPartido> {
  if (input.entradaLukas < 1) {
    throw new ValidacionFallida("La entrada debe ser al menos 1 Luka.", {
      entradaLukas: input.entradaLukas,
    });
  }

  const partido = await prisma.partido.findUnique({
    where: { id: input.partidoId },
  });
  if (!partido) throw new PartidoNoEncontrado(input.partidoId);
  if (partido.estado !== "PROGRAMADO") {
    throw new ValidacionFallida(
      "Solo se pueden crear torneos sobre partidos programados.",
      { estadoActual: partido.estado },
    );
  }

  const cierreAt = new Date(
    partido.fechaInicio.getTime() - CIERRE_MIN_BEFORE * 60 * 1000,
  );
  if (cierreAt.getTime() <= Date.now()) {
    throw new ValidacionFallida(
      `El partido está a menos de ${CIERRE_MIN_BEFORE} minutos; no se puede crear torneo.`,
    );
  }

  const nombre =
    input.nombre?.trim() ||
    `${partido.equipoLocal} vs ${partido.equipoVisita}`;

  const torneo = await prisma.torneo.create({
    data: {
      nombre,
      tipo: input.tipo,
      entradaLukas: input.entradaLukas,
      partidoId: input.partidoId,
      cierreAt,
      distribPremios: DISTRIB_PREMIOS,
    },
    include: { partido: true },
  });

  logger.info(
    {
      torneoId: torneo.id,
      partidoId: partido.id,
      tipo: input.tipo,
      entradaLukas: input.entradaLukas,
    },
    "torneo creado",
  );

  return torneo;
}

// ---------------------------------------------------------------------------
// inscribir — transacción atómica.
// Pasos:
//   1. Valida torneo ABIERTO y cierreAt > NOW.
//   2. Valida balance suficiente (dentro de la tx para evitar race).
//   3. Valida límites de juego (stub).
//   4. Descuenta entrada + crea TransaccionLukas ENTRADA_TORNEO.
//   5. Crea Ticket placeholder (predicciones default; Sub-Sprint 4 las
//      completa).
//   6. Incrementa totalInscritos + pozoBruto.
// Cualquier fallo → rollback total.
// ---------------------------------------------------------------------------

export async function inscribir(
  usuarioId: string,
  torneoId: string,
): Promise<InscribirResult> {
  return prisma.$transaction(async (tx) => {
    const torneo = await tx.torneo.findUnique({ where: { id: torneoId } });
    if (!torneo) throw new TorneoNoEncontrado(torneoId);
    if (torneo.estado !== "ABIERTO") throw new TorneoCerrado(torneoId);
    if (torneo.cierreAt.getTime() <= Date.now()) {
      throw new TorneoCerrado(torneoId);
    }

    const usuario = await tx.usuario.findUnique({
      where: { id: usuarioId },
      select: { balanceLukas: true },
    });
    if (!usuario) throw new NoAutenticado();
    if (usuario.balanceLukas < torneo.entradaLukas) {
      throw new BalanceInsuficiente(usuario.balanceLukas, torneo.entradaLukas);
    }

    await verificarLimiteInscripcion({
      tx,
      usuarioId,
      entradaLukas: torneo.entradaLukas,
    });

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
        refId: torneoId,
      },
    });

    // Ticket placeholder — predicciones default. Sub-Sprint 4 las edita.
    let ticket: Ticket;
    try {
      ticket = await tx.ticket.create({
        data: {
          usuarioId,
          torneoId,
          predResultado: "LOCAL",
          predBtts: false,
          predMas25: false,
          predTarjetaRoja: false,
          predMarcadorLocal: 0,
          predMarcadorVisita: 0,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        // El unique compuesto impidió la doble inscripción con defaults
        throw new YaInscrito(torneoId);
      }
      throw err;
    }

    const torneoActualizado = await tx.torneo.update({
      where: { id: torneoId },
      data: {
        totalInscritos: { increment: 1 },
        pozoBruto: { increment: torneo.entradaLukas },
      },
    });

    const nuevoBalance = usuario.balanceLukas - torneo.entradaLukas;

    logger.info(
      {
        torneoId,
        usuarioId,
        ticketId: ticket.id,
        entradaLukas: torneo.entradaLukas,
        nuevoBalance,
      },
      "inscripción creada",
    );

    return { ticket, torneo: torneoActualizado, nuevoBalance };
  });
}

// ---------------------------------------------------------------------------
// cancelar — marca CANCELADO y reembolsa a todos los inscritos.
// ---------------------------------------------------------------------------

export async function cancelar(
  torneoId: string,
  motivo: string,
): Promise<CancelarResult> {
  return prisma.$transaction(async (tx) => {
    const torneo = await tx.torneo.findUnique({
      where: { id: torneoId },
      include: {
        tickets: { select: { id: true, usuarioId: true } },
      },
    });
    if (!torneo) throw new TorneoNoEncontrado(torneoId);
    if (
      torneo.estado === "CANCELADO" ||
      torneo.estado === "FINALIZADO"
    ) {
      throw new DomainError(
        "TORNEO_NO_CANCELABLE",
        "El torneo ya está cerrado y no se puede cancelar.",
        409,
        { estadoActual: torneo.estado },
      );
    }

    await tx.torneo.update({
      where: { id: torneoId },
      data: { estado: "CANCELADO" },
    });

    for (const ticket of torneo.tickets) {
      await tx.usuario.update({
        where: { id: ticket.usuarioId },
        data: { balanceLukas: { increment: torneo.entradaLukas } },
      });
      await tx.transaccionLukas.create({
        data: {
          usuarioId: ticket.usuarioId,
          tipo: "REEMBOLSO",
          monto: torneo.entradaLukas,
          descripcion: `Reembolso torneo cancelado: ${motivo}`,
          refId: torneoId,
        },
      });
    }

    const reembolsoTotalLukas = torneo.tickets.length * torneo.entradaLukas;

    logger.info(
      {
        torneoId,
        motivo,
        refunded: torneo.tickets.length,
        reembolsoTotalLukas,
      },
      "torneo cancelado y reembolsado",
    );

    return {
      torneoId,
      motivo,
      refunded: torneo.tickets.length,
      reembolsoTotalLukas,
    };
  });
}

// ---------------------------------------------------------------------------
// procesarCierreAutomatico — usada por el cron. Busca torneos ABIERTOS
// con cierreAt <= NOW y aplica:
//   - <2 inscritos  → cancelar (que reembolsa).
//   - ≥2 inscritos  → CERRADO, calcular rake 12% floor y pozoNeto.
// ---------------------------------------------------------------------------

export async function procesarCierreAutomatico(): Promise<CierreAutomaticoResult> {
  const vencidos = await prisma.torneo.findMany({
    where: {
      estado: "ABIERTO",
      cierreAt: { lte: new Date() },
    },
    select: {
      id: true,
      totalInscritos: true,
      pozoBruto: true,
    },
  });

  const cerrados: CierreAutomaticoResult["cerrados"] = [];
  const cancelados: CierreAutomaticoResult["cancelados"] = [];

  for (const t of vencidos) {
    if (t.totalInscritos < MIN_INSCRITOS_PARA_ACTIVAR) {
      try {
        const r = await cancelar(
          t.id,
          "Torneo cancelado por no alcanzar el mínimo de inscritos.",
        );
        cancelados.push({
          torneoId: t.id,
          motivo: r.motivo,
          refunded: r.refunded,
        });
      } catch (err) {
        logger.error({ torneoId: t.id, err }, "fallo al cancelar torneo");
      }
    } else {
      const rake = Math.floor(t.pozoBruto * RAKE_PCT);
      const pozoNeto = t.pozoBruto - rake;
      await prisma.torneo.update({
        where: { id: t.id },
        data: {
          estado: "CERRADO",
          rake,
          pozoNeto,
        },
      });
      cerrados.push({
        torneoId: t.id,
        pozoBruto: t.pozoBruto,
        pozoNeto,
        rake,
      });
      logger.info(
        { torneoId: t.id, pozoBruto: t.pozoBruto, pozoNeto, rake },
        "torneo cerrado",
      );
    }
  }

  return { cerrados, cancelados };
}
