// Stats agregados de la semana: ganadores recientes + top del período.
// Alimenta el sidebar de /matches (widgets "Ya ganaron en la semana" y
// "Top de la Semana", Abr 2026).
//
// Ventana por defecto: últimos 7 días. Solo considera tickets con
// `premioLukas > 0` (ganadores reales) sobre torneos FINALIZADOS.

import { prisma } from "@habla/db";

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

export interface YaGanaronSemanaRow {
  /** ID del torneo. */
  torneoId: string;
  /** Lukas repartidos al pozo neto. */
  pozoNeto: number;
  /** Liga del partido. */
  liga: string;
  /** "Alianza 2-1 Cristal" — línea corta lista para pintar. */
  resumenPartido: string;
  /** Fecha del partido. */
  fechaPartido: Date;
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
  if (p.estado === "FINALIZADO" && p.golesLocal !== null && p.golesVisita !== null) {
    return `${p.equipoLocal} ${p.golesLocal}-${p.golesVisita} ${p.equipoVisita}`;
  }
  return `${p.equipoLocal} vs ${p.equipoVisita}`;
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

/**
 * Torneos FINALIZADOS recientes con su pozo repartido. Alimenta el
 * widget "Ya ganaron en la semana" del sidebar de /matches.
 */
export async function listarYaGanaronSemana(
  input: StatsSemanaInput = {},
): Promise<YaGanaronSemanaRow[]> {
  const limit = Math.min(20, Math.max(1, input.limit ?? 5));
  const since = windowSince(input.sinceDays);

  const torneos = await prisma.torneo.findMany({
    where: {
      estado: "FINALIZADO",
      partido: { fechaInicio: { gte: since } },
      pozoNeto: { gt: 0 },
    },
    include: { partido: true },
    orderBy: { partido: { fechaInicio: "desc" } },
    take: limit,
  });

  return torneos.map((t) => ({
    torneoId: t.id,
    pozoNeto: t.pozoNeto,
    liga: t.partido.liga,
    resumenPartido: resumenPartido(t.partido),
    fechaPartido: t.partido.fechaInicio,
  }));
}
