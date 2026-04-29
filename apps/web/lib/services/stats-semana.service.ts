// Stats agregados de la semana — alimenta los widgets del sidebar de
// /matches.
//
// Lote 2 (Abr 2026): demolido el sistema de Lukas. Los widgets de "pozos"
// y "más pagados" se removieron. Los widgets vigentes que usan este
// service son:
//   - Top tipsters de la semana — top usuarios por puntos acumulados en
//     tickets creados durante la semana en curso.
//   - Próximos partidos top — torneos ABIERTOS con cierre próximo,
//     ordenados por mayor cantidad de inscritos.

import { prisma } from "@habla/db";
import { getWeekBounds } from "../utils/datetime";

export interface TopTipsterSemanaRow {
  /** ID del usuario — clave para React. */
  usuarioId: string;
  /** @handle del usuario (sin @). */
  username: string;
  /** Puntos acumulados en la semana. */
  puntosTotal: number;
}

export interface ProximoTorneoTopRow {
  /** ID del torneo. */
  torneoId: string;
  /** Liga del partido. */
  liga: string;
  /** "Alianza vs Cristal" — línea corta. */
  resumenPartido: string;
  /** Fecha del partido. */
  fechaPartido: Date;
  /** Inscritos al momento (orden). */
  totalInscritos: number;
}

export interface TopTipstersInput {
  /** Límite de filas. Default 5, máx 20. */
  limit?: number;
}

export interface ProximosTopInput {
  /** Límite de filas. Default 5, máx 20. */
  limit?: number;
}

function resumenPartido(p: {
  equipoLocal: string;
  equipoVisita: string;
}): string {
  return `${p.equipoLocal} vs ${p.equipoVisita}`;
}

/**
 * Top tipsters de la semana — usuarios ordenados por suma de
 * `Ticket.puntosTotal` para tickets creados en la semana calendario en
 * curso. Excluye usuarios soft-deleted.
 */
export async function listarTopTipstersSemana(
  input: TopTipstersInput = {},
): Promise<TopTipsterSemanaRow[]> {
  const limit = Math.min(20, Math.max(1, input.limit ?? 5));
  const { desde, hasta } = getWeekBounds();

  const grouped = await prisma.ticket.groupBy({
    by: ["usuarioId"],
    where: {
      creadoEn: { gte: desde, lte: hasta },
      usuario: { deletedAt: null },
    },
    _sum: { puntosTotal: true },
    orderBy: { _sum: { puntosTotal: "desc" } },
    take: limit,
  });

  const rows = grouped
    .map((g) => ({ usuarioId: g.usuarioId, puntos: g._sum?.puntosTotal ?? 0 }))
    .filter((g) => g.puntos > 0);
  if (rows.length === 0) return [];

  const usuarios = await prisma.usuario.findMany({
    where: { id: { in: rows.map((r) => r.usuarioId) } },
    select: { id: true, username: true },
  });
  const usernameByUserId = new Map(usuarios.map((u) => [u.id, u.username]));

  return rows.map((r) => ({
    usuarioId: r.usuarioId,
    username: usernameByUserId.get(r.usuarioId) ?? "",
    puntosTotal: r.puntos,
  }));
}

/**
 * Próximos partidos top — torneos ABIERTOS con cierre próximo (next 48h),
 * ordenados por inscritos DESC.
 */
export async function listarProximosTopTorneos(
  input: ProximosTopInput = {},
): Promise<ProximoTorneoTopRow[]> {
  const limit = Math.min(20, Math.max(1, input.limit ?? 5));
  const ahora = new Date();
  const en48h = new Date(ahora.getTime() + 48 * 60 * 60 * 1000);

  const torneos = await prisma.torneo.findMany({
    where: {
      estado: "ABIERTO",
      cierreAt: { gte: ahora, lte: en48h },
    },
    include: { partido: true },
    orderBy: [{ totalInscritos: "desc" }, { cierreAt: "asc" }],
    take: limit,
  });

  return torneos.map((t) => ({
    torneoId: t.id,
    liga: t.partido.liga,
    resumenPartido: resumenPartido(t.partido),
    fechaPartido: t.partido.fechaInicio,
    totalInscritos: t.totalInscritos,
  }));
}
