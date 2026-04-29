// Servicio de límites de juego responsable.
//
// Lote 2 (Abr 2026): el sistema de Lukas se demolió. Quedan dos límites:
//  - Límite diario de tickets: bloqueante en inscripción/creación de
//    ticket. Por defecto 10/día (configurable desde /perfil).
//  - Auto-exclusión temporal (7/30/90 días): bloqueante en login + en
//    cualquier acción del usuario.
// El antiguo límite mensual de compra y `verificarLimiteCompra` se
// removieron junto con el flujo de compra de Lukas.

import { prisma, type Prisma } from "@habla/db";
import { LimiteExcedido } from "./errors";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/**
 * Default del límite diario de tickets (matchea schema.prisma).
 */
export const DEFAULT_LIMITE_DIARIO_TICKETS = 10;

/** Compatibilidad con la UI de /perfil que aún muestra el campo.
 *  El uso real del campo se removió cuando se demolió el flujo de compra. */
export const DEFAULT_LIMITE_MENSUAL_COMPRA = 300;
export const MAX_LIMITE_MENSUAL_COMPRA = 2000;

export const AUTOEXCLUSION_DIAS_VALIDOS = [7, 30, 90] as const;
export type DiasAutoExclusion = (typeof AUTOEXCLUSION_DIAS_VALIDOS)[number];

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface LimitesUsuario {
  usuarioId: string;
  limiteMensualCompra: number;
  limiteDiarioTickets: number;
  autoExclusionHasta: Date | null;
  uso: {
    /** Lukas comprados este mes — siempre 0 desde Lote 2 (no hay flujo de compra). */
    comprasMesActual: number;
    ticketsUltimas24h: number;
  };
}

// ---------------------------------------------------------------------------
// Consulta y update
// ---------------------------------------------------------------------------

export async function obtenerLimites(usuarioId: string): Promise<LimitesUsuario> {
  const existente = await prisma.limitesJuego.findUnique({ where: { usuarioId } });
  if (!existente) {
    await prisma.limitesJuego.create({
      data: {
        usuarioId,
        limiteMensualCompra: DEFAULT_LIMITE_MENSUAL_COMPRA,
        limiteDiarioTickets: DEFAULT_LIMITE_DIARIO_TICKETS,
      },
    });
  }

  const limites = existente ?? {
    usuarioId,
    limiteMensualCompra: DEFAULT_LIMITE_MENSUAL_COMPRA,
    limiteDiarioTickets: DEFAULT_LIMITE_DIARIO_TICKETS,
    autoExclusionHasta: null,
  };

  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const ticketsUltimas24h = await prisma.ticket.count({
    where: { usuarioId, creadoEn: { gte: hace24h } },
  });

  return {
    usuarioId,
    limiteMensualCompra: limites.limiteMensualCompra,
    limiteDiarioTickets: limites.limiteDiarioTickets,
    autoExclusionHasta: limites.autoExclusionHasta,
    uso: {
      comprasMesActual: 0,
      ticketsUltimas24h,
    },
  };
}

export interface ActualizarLimitesInput {
  limiteMensualCompra?: number;
  limiteDiarioTickets?: number;
}

export async function actualizarLimites(
  usuarioId: string,
  patch: ActualizarLimitesInput,
): Promise<LimitesUsuario> {
  if (
    (patch.limiteMensualCompra !== undefined && patch.limiteMensualCompra < 0) ||
    (patch.limiteDiarioTickets !== undefined && patch.limiteDiarioTickets < 0)
  ) {
    throw new LimiteExcedido("Los límites no pueden ser negativos.", { patch });
  }

  await prisma.limitesJuego.upsert({
    where: { usuarioId },
    create: {
      usuarioId,
      limiteMensualCompra: patch.limiteMensualCompra ?? DEFAULT_LIMITE_MENSUAL_COMPRA,
      limiteDiarioTickets: patch.limiteDiarioTickets ?? DEFAULT_LIMITE_DIARIO_TICKETS,
    },
    update: patch,
  });

  return obtenerLimites(usuarioId);
}

export async function activarAutoExclusion(
  usuarioId: string,
  dias: DiasAutoExclusion,
): Promise<LimitesUsuario> {
  if (!AUTOEXCLUSION_DIAS_VALIDOS.includes(dias)) {
    throw new LimiteExcedido(
      `Duración inválida (use ${AUTOEXCLUSION_DIAS_VALIDOS.join(", ")} días).`,
      { dias },
    );
  }
  const hasta = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
  await prisma.limitesJuego.upsert({
    where: { usuarioId },
    create: {
      usuarioId,
      limiteMensualCompra: DEFAULT_LIMITE_MENSUAL_COMPRA,
      limiteDiarioTickets: DEFAULT_LIMITE_DIARIO_TICKETS,
      autoExclusionHasta: hasta,
    },
    update: { autoExclusionHasta: hasta },
  });
  return obtenerLimites(usuarioId);
}

// ---------------------------------------------------------------------------
// Enforcement
// ---------------------------------------------------------------------------

/** Lee auto-exclusión. Si está vigente, lanza LimiteExcedido. */
export async function bloquearSiAutoExcluido(
  usuarioId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? prisma;
  const l = await client.limitesJuego.findUnique({
    where: { usuarioId },
    select: { autoExclusionHasta: true },
  });
  if (!l) return;
  if (l.autoExclusionHasta && l.autoExclusionHasta.getTime() > Date.now()) {
    throw new LimiteExcedido(
      `Tu cuenta está en auto-exclusión hasta ${l.autoExclusionHasta.toISOString()}.`,
      { autoExclusionHasta: l.autoExclusionHasta.toISOString() },
    );
  }
}

export interface ChequeoInscripcionInput {
  tx?: Prisma.TransactionClient;
  usuarioId: string;
}

/** Llamado desde tickets/torneos antes de crear el ticket. */
export async function verificarLimiteInscripcion(
  input: ChequeoInscripcionInput,
): Promise<void> {
  await bloquearSiAutoExcluido(input.usuarioId, input.tx);

  const client = input.tx ?? prisma;
  const limites = await client.limitesJuego.findUnique({
    where: { usuarioId: input.usuarioId },
    select: { limiteDiarioTickets: true },
  });
  const limiteDiario =
    limites?.limiteDiarioTickets ?? DEFAULT_LIMITE_DIARIO_TICKETS;

  if (limiteDiario === 0) return;

  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const cuenta = await client.ticket.count({
    where: { usuarioId: input.usuarioId, creadoEn: { gte: hace24h } },
  });

  if (cuenta + 1 > limiteDiario) {
    throw new LimiteExcedido(
      `Máximo ${limiteDiario} tickets por día. Llevas ${cuenta}.`,
      { actual: cuenta, max: limiteDiario },
    );
  }
}

/** Chequea solo auto-exclusión (canjes no tienen límite cuantitativo propio). */
export async function verificarLimiteCanje(input: {
  usuarioId: string;
  tx?: Prisma.TransactionClient;
}): Promise<void> {
  await bloquearSiAutoExcluido(input.usuarioId, input.tx);
}
