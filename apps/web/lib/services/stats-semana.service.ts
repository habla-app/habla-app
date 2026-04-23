// Stats agregados de la semana.
// Alimenta el sidebar de /matches (widgets "Los Pozos más grandes de la
// semana" y "Los más pagados de la semana", Abr 2026).
//
// Ventana por default: semana calendario actual (lunes 00:00 → domingo
// 23:59 en America/Lima). Ver `lib/utils/datetime.ts:getWeekBounds`.

import { prisma } from "@habla/db";
import { getWeekBounds } from "../utils/datetime";

export interface PozoSemanaRow {
  /** ID del torneo. */
  torneoId: string;
  /** Lukas en el pozo bruto (ordenación). */
  pozoBruto: number;
  /** Liga del partido. */
  liga: string;
  /** "Alianza 2-1 Cristal" — línea corta lista para pintar. */
  resumenPartido: string;
  /** Fecha del partido. */
  fechaPartido: Date;
}

export interface MasPagadoSemanaRow {
  /** ID del usuario — clave para React. */
  usuarioId: string;
  /** @handle del ganador (sin @). */
  username: string;
  /** Lukas acumulados en premios de torneo en la semana (bruto). */
  totalGanado: number;
}

export interface PozosSemanaInput {
  /** Límite de filas. Default 5, máx 20. */
  limit?: number;
}

export interface MasPagadosSemanaInput {
  /** Límite de filas. Default 10, máx 50. */
  limit?: number;
}

function resumenPartido(p: {
  equipoLocal: string;
  equipoVisita: string;
  golesLocal: number | null;
  golesVisita: number | null;
  estado: string;
}): string {
  if (
    p.estado === "FINALIZADO" &&
    p.golesLocal !== null &&
    p.golesVisita !== null
  ) {
    return `${p.equipoLocal} ${p.golesLocal}-${p.golesVisita} ${p.equipoVisita}`;
  }
  return `${p.equipoLocal} vs ${p.equipoVisita}`;
}

/**
 * Pozos más grandes de la semana: torneos cuyo partido cae en la semana
 * calendario actual (lunes 00:00 → domingo 23:59 en America/Lima)
 * ordenados por `pozoBruto` DESC. Incluye torneos ABIERTO / EN_JUEGO /
 * FINALIZADO — cualquier estado excepto CANCELADO.
 */
export async function listarPozosMasGrandesSemana(
  input: PozosSemanaInput = {},
): Promise<PozoSemanaRow[]> {
  const limit = Math.min(20, Math.max(1, input.limit ?? 5));
  const { desde, hasta } = getWeekBounds();

  const torneos = await prisma.torneo.findMany({
    where: {
      pozoBruto: { gt: 0 },
      estado: { not: "CANCELADO" },
      partido: { fechaInicio: { gte: desde, lte: hasta } },
    },
    include: { partido: true },
    orderBy: { pozoBruto: "desc" },
    take: limit,
  });

  return torneos.map((t) => ({
    torneoId: t.id,
    pozoBruto: t.pozoBruto,
    liga: t.partido.liga,
    resumenPartido: resumenPartido(t.partido),
    fechaPartido: t.partido.fechaInicio,
  }));
}

/**
 * Usuarios más pagados de la semana: suma de `TransaccionLukas.monto`
 * con `tipo = PREMIO_TORNEO` dentro de la semana calendario en curso
 * (bruto, sin netear la entrada del torneo). Ordenado DESC, top N.
 */
export async function listarMasPagadosSemana(
  input: MasPagadosSemanaInput = {},
): Promise<MasPagadoSemanaRow[]> {
  const limit = Math.min(50, Math.max(1, input.limit ?? 10));
  const { desde, hasta } = getWeekBounds();

  const grouped = await prisma.transaccionLukas.groupBy({
    by: ["usuarioId"],
    where: {
      tipo: "PREMIO_TORNEO",
      creadoEn: { gte: desde, lte: hasta },
    },
    _sum: { monto: true },
    orderBy: { _sum: { monto: "desc" } },
    take: limit,
  });

  const rows = grouped
    .map((g) => ({ usuarioId: g.usuarioId, total: g._sum?.monto ?? 0 }))
    .filter((g) => g.total > 0);
  if (rows.length === 0) return [];

  const usuarios = await prisma.usuario.findMany({
    where: { id: { in: rows.map((r) => r.usuarioId) } },
    select: { id: true, username: true },
  });
  const usernameByUserId = new Map(usuarios.map((u) => [u.id, u.username]));

  return rows.map((r) => ({
    usuarioId: r.usuarioId,
    username: usernameByUserId.get(r.usuarioId) ?? "",
    totalGanado: r.total,
  }));
}
