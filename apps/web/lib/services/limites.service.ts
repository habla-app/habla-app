// Servicio de límites de juego responsable — Sub-Sprint 7.
//
// Reglas (CLAUDE.md §6):
//  - Límite mensual de compra: bloqueante en el flujo de compra de Lukas
//    (Sub-Sprint 2 cuando se implemente). Por defecto S/ 300/mes (1:1 con Lukas).
//  - Límite diario de tickets: bloqueante en inscripción/creación de ticket.
//    Por defecto 10/día.
//  - Auto-exclusión temporal (7/30/90 días): bloqueante en login + en toda
//    acción que mueva Lukas (inscripción, canje). No aplicable a lectura.
//
// Centralización: este módulo es el único punto de enforcement. Los consumers
// (tickets, canjes, lukas-compra) llaman a los helpers específicos antes de
// ejecutar la mutación. Si el chequeo falla, lanza `LimiteExcedido` con meta.

import { prisma, type Prisma } from "@habla/db";
import { LimiteExcedido } from "./errors";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

export const DEFAULT_LIMITE_MENSUAL_COMPRA = 300;
export const DEFAULT_LIMITE_DIARIO_TICKETS = 10;

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
  /** Estadísticas en vivo — uso actual. */
  uso: {
    comprasMesActual: number; // Lukas comprados este mes (sólo tipo COMPRA)
    ticketsUltimas24h: number;
  };
}

// ---------------------------------------------------------------------------
// Consulta y update
// ---------------------------------------------------------------------------

export async function obtenerLimites(usuarioId: string): Promise<LimitesUsuario> {
  const existente = await prisma.limitesJuego.findUnique({ where: { usuarioId } });
  if (!existente) {
    // Crear defaults al leer por primera vez.
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

  // Estadísticas de uso
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [comprasMesAgg, ticketsUltimas24h] = await Promise.all([
    prisma.transaccionLukas.aggregate({
      where: {
        usuarioId,
        tipo: "COMPRA",
        creadoEn: { gte: inicioMes },
      },
      _sum: { monto: true },
    }),
    prisma.ticket.count({
      where: { usuarioId, creadoEn: { gte: hace24h } },
    }),
  ]);

  return {
    usuarioId,
    limiteMensualCompra: limites.limiteMensualCompra,
    limiteDiarioTickets: limites.limiteDiarioTickets,
    autoExclusionHasta: limites.autoExclusionHasta,
    uso: {
      comprasMesActual: comprasMesAgg._sum.monto ?? 0,
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
  // Validación defensiva: los límites no pueden ser negativos.
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
  if (!l) return; // Sin límites aún = sin auto-exclusión
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
  entradaLukas: number;
}

/** Llamado desde tickets.service antes de descontar Lukas. */
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

  if (limiteDiario === 0) return; // 0 = sin límite

  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const cuenta = await client.ticket.count({
    where: { usuarioId: input.usuarioId, creadoEn: { gte: hace24h } },
  });

  // El ticket que se está por crear agrega 1 a la cuenta.
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

export interface ChequeoCompraInput {
  tx?: Prisma.TransactionClient;
  usuarioId: string;
  montoLukas: number; // Lukas a comprar (1:1 soles)
}

/**
 * Stub listo para Sub-Sprint 2. Chequea auto-exclusión + límite mensual de
 * compra (comparando `montoLukas + comprasDelMes <= limiteMensualCompra`).
 */
export async function verificarLimiteCompra(
  input: ChequeoCompraInput,
): Promise<void> {
  await bloquearSiAutoExcluido(input.usuarioId, input.tx);

  const client = input.tx ?? prisma;
  const limites = await client.limitesJuego.findUnique({
    where: { usuarioId: input.usuarioId },
    select: { limiteMensualCompra: true },
  });
  const limite = limites?.limiteMensualCompra ?? DEFAULT_LIMITE_MENSUAL_COMPRA;
  if (limite === 0) return; // 0 = sin límite

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const agg = await client.transaccionLukas.aggregate({
    where: {
      usuarioId: input.usuarioId,
      tipo: "COMPRA",
      creadoEn: { gte: inicioMes },
    },
    _sum: { monto: true },
  });
  const yaComprado = agg._sum.monto ?? 0;

  if (yaComprado + input.montoLukas > limite) {
    throw new LimiteExcedido(
      `Excede tu límite de S/ ${limite}/mes. Este mes llevas S/ ${yaComprado}.`,
      { actual: yaComprado, intentado: input.montoLukas, max: limite },
    );
  }
}
