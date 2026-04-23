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

export interface TopSemanaRow {
  /** ID del ticket — clave para React. */
  ticketId: string;
  /** @handle del ganador. */
  username: string;
  /** Lukas que ganó este ticket. */
  premioLukas: number;
  /** Posición final en el torneo (1, 2, 3, ...). */
  posicionFinal: number | null;
  /** Liga del partido relacionado. */
  liga: string;
  /** "Alianza 2-1 Cristal" — línea corta lista para pintar. */
  resumenPartido: string;
  /** Cuándo se disputó el partido. */
  fechaPartido: Date;
}

export interface PozosSemanaInput {
  /** Límite de filas. Default 5, máx 20. */
  limit?: number;
}

export interface StatsSemanaInput {
  /** Ventana hacia atrás en días. Default 7. */
  sinceDays?: number;
  /** Límite de filas. Default 5. */
  limit?: number;
}

function windowSince(sinceDays: number | undefined): Date {
  const days = Math.max(1, sinceDays ?? 7);
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
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
 * Top ganadores del período: tickets con mayor premio en los últimos N días.
 * Ordenado por premioLukas DESC.
 */
export async function listarTopSemana(
  input: StatsSemanaInput = {},
): Promise<TopSemanaRow[]> {
  const limit = Math.min(20, Math.max(1, input.limit ?? 5));
  const since = windowSince(input.sinceDays);

  const tickets = await prisma.ticket.findMany({
    where: {
      premioLukas: { gt: 0 },
      torneo: {
        estado: "FINALIZADO",
        partido: { fechaInicio: { gte: since } },
      },
    },
    include: {
      usuario: { select: { username: true } },
      torneo: { include: { partido: true } },
    },
    orderBy: { premioLukas: "desc" },
    take: limit,
  });

  return tickets.map((t) => ({
    ticketId: t.id,
    username: t.usuario.username,
    premioLukas: t.premioLukas,
    posicionFinal: t.posicionFinal,
    liga: t.torneo.partido.liga,
    resumenPartido: resumenPartido(t.torneo.partido),
    fechaPartido: t.torneo.partido.fechaInicio,
  }));
}
