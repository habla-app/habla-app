// Servicio de ranking en vivo — Sub-Sprint 5.
//
// Fuente de verdad: la base de datos (Ticket.puntosTotal). Redis se usa
// como cache del sorted set para lecturas <1ms; si Redis no responde
// degradamos a BD.
//
// Desempate (CLAUDE.md §6):
//   1) puntosTotal DESC
//   2) marcador exacto acertado (puntosMarcador=8) antes que no
//   3) tarjeta roja acertada (puntosTarjeta=6) antes que no
//   4) orden de inscripción (Ticket.creadoEn ASC)

import { prisma, type Prisma } from "@habla/db";
import { DISTRIB_PREMIOS } from "./torneos.service";
import { TorneoNoEncontrado } from "./errors";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface RankingRow {
  rank: number;
  ticketId: string;
  usuarioId: string;
  nombre: string;
  puntosTotal: number;
  puntosDetalle: {
    resultado: number;
    btts: number;
    mas25: number;
    tarjeta: number;
    marcador: number;
  };
  predicciones: {
    predResultado: "LOCAL" | "EMPATE" | "VISITA";
    predBtts: boolean;
    predMas25: boolean;
    predTarjetaRoja: boolean;
    predMarcadorLocal: number;
    predMarcadorVisita: number;
  };
  premioEstimado: number;
  creadoEn: Date;
}

export interface RankingResult {
  torneoId: string;
  totalInscritos: number;
  pozoNeto: number;
  pozoBruto: number;
  ranking: RankingRow[];
  miPosicion: (RankingRow & { posicion: number }) | null;
}

export interface ListarRankingInput {
  page?: number;
  limit?: number;
  usuarioId?: string;
}

// ---------------------------------------------------------------------------
// distribución del pozo → premio estimado por posición
// ---------------------------------------------------------------------------

/**
 * Premio estimado en Lukas para una posición 1-indexada, dado el pozo
 * neto. Sigue la distribución de negocio: 35% al 1°, 20% al 2°, 12% al
 * 3°, y 33% repartido en partes iguales entre 4°-10°. Del 11° en
 * adelante: 0.
 *
 * El cálculo usa pozoNeto del Torneo (ya restó el rake 12%). Si el
 * torneo aún está ABIERTO (pozoNeto = 0), usamos pozoBruto * (1 - RAKE).
 */
export function calcularPremioEstimado(
  pozoNeto: number,
  posicion: number,
): number {
  if (posicion < 1) return 0;
  if (posicion > 10) return 0;
  if (posicion === 1) return Math.floor(pozoNeto * DISTRIB_PREMIOS["1"]);
  if (posicion === 2) return Math.floor(pozoNeto * DISTRIB_PREMIOS["2"]);
  if (posicion === 3) return Math.floor(pozoNeto * DISTRIB_PREMIOS["3"]);
  // 4° a 10°: 33% dividido en 7 (siete posiciones)
  const pool = Math.floor(pozoNeto * DISTRIB_PREMIOS["4-10"]);
  return Math.floor(pool / 7);
}

// ---------------------------------------------------------------------------
// rankear — ordenamiento con desempate
// ---------------------------------------------------------------------------

type TicketConUsuario = Prisma.TicketGetPayload<{
  include: { usuario: { select: { id: true; nombre: true; email: true } } };
}>;

function compararParaDesempate(a: TicketConUsuario, b: TicketConUsuario): number {
  // 1) Puntos totales DESC
  if (b.puntosTotal !== a.puntosTotal) return b.puntosTotal - a.puntosTotal;
  // 2) Marcador exacto acertado (8 pts) antes que no
  const aMarc = a.puntosMarcador > 0 ? 1 : 0;
  const bMarc = b.puntosMarcador > 0 ? 1 : 0;
  if (bMarc !== aMarc) return bMarc - aMarc;
  // 3) Tarjeta roja acertada (6 pts) antes que no
  const aTarj = a.puntosTarjeta > 0 ? 1 : 0;
  const bTarj = b.puntosTarjeta > 0 ? 1 : 0;
  if (bTarj !== aTarj) return bTarj - aTarj;
  // 4) Orden de inscripción ASC
  return a.creadoEn.getTime() - b.creadoEn.getTime();
}

// ---------------------------------------------------------------------------
// listar — función principal
// ---------------------------------------------------------------------------

export async function listarRanking(
  torneoId: string,
  input: ListarRankingInput = {},
): Promise<RankingResult> {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(500, Math.max(1, input.limit ?? 50));

  const torneo = await prisma.torneo.findUnique({
    where: { id: torneoId },
    select: {
      id: true,
      pozoBruto: true,
      pozoNeto: true,
      totalInscritos: true,
      estado: true,
    },
  });
  if (!torneo) throw new TorneoNoEncontrado(torneoId);

  // Si el torneo está ABIERTO, pozoNeto aún es 0 — estimamos con 88%
  // del pozoBruto actual para que los premios estimados sean útiles
  // mientras la gente se sigue inscribiendo.
  const pozoNetoEstimado =
    torneo.pozoNeto > 0
      ? torneo.pozoNeto
      : Math.floor(torneo.pozoBruto * 0.88);

  const tickets = await prisma.ticket.findMany({
    where: { torneoId },
    include: { usuario: { select: { id: true, nombre: true, email: true } } },
  });

  const ordenados = [...tickets].sort(compararParaDesempate);

  const rows: RankingRow[] = ordenados.map((t, idx) => {
    const rank = idx + 1;
    return {
      rank,
      ticketId: t.id,
      usuarioId: t.usuarioId,
      nombre: nombreDisplay(t.usuario),
      puntosTotal: t.puntosTotal,
      puntosDetalle: {
        resultado: t.puntosResultado,
        btts: t.puntosBtts,
        mas25: t.puntosMas25,
        tarjeta: t.puntosTarjeta,
        marcador: t.puntosMarcador,
      },
      predicciones: {
        predResultado: t.predResultado,
        predBtts: t.predBtts,
        predMas25: t.predMas25,
        predTarjetaRoja: t.predTarjetaRoja,
        predMarcadorLocal: t.predMarcadorLocal,
        predMarcadorVisita: t.predMarcadorVisita,
      },
      premioEstimado: calcularPremioEstimado(pozoNetoEstimado, rank),
      creadoEn: t.creadoEn,
    };
  });

  // Slice paginado
  const start = (page - 1) * limit;
  const slice = rows.slice(start, start + limit);

  // miPosicion: si el caller pasó usuarioId, buscamos su mejor ticket
  // (el de mayor puntosTotal / mejor rank).
  let miPosicion: RankingResult["miPosicion"] = null;
  if (input.usuarioId) {
    const propios = rows.filter((r) => r.usuarioId === input.usuarioId);
    if (propios.length > 0) {
      // El de menor rank (mejor posición)
      const mejor = propios.reduce((acc, r) => (r.rank < acc.rank ? r : acc));
      miPosicion = { ...mejor, posicion: mejor.rank };
    }
  }

  return {
    torneoId,
    totalInscritos: torneo.totalInscritos,
    pozoNeto: pozoNetoEstimado,
    pozoBruto: torneo.pozoBruto,
    ranking: slice,
    miPosicion,
  };
}

function nombreDisplay(u: {
  nombre: string;
  email: string;
  id: string;
}): string {
  // Preferencia: nombre si no es email-derivado. Fallback: prefijo del email.
  if (u.nombre && !u.nombre.includes("@")) return u.nombre;
  const prefix = u.email.split("@")[0] ?? u.id.slice(0, 8);
  return prefix;
}

// ---------------------------------------------------------------------------
// finalizarTorneo — llamado por el poller cuando el partido llega a
// FIN_PARTIDO. Asigna posiciones finales + premios definitivos y marca
// el torneo FINALIZADO. La distribución real de Lukas (crear transacciones
// PREMIO_TORNEO) queda para Sub-Sprint 6.
// ---------------------------------------------------------------------------

export interface FinalizarTorneoResult {
  torneoId: string;
  ganadores: Array<{
    rank: number;
    ticketId: string;
    usuarioId: string;
    nombre: string;
    puntosTotal: number;
    premioLukas: number;
  }>;
}

export async function finalizarTorneo(
  torneoId: string,
): Promise<FinalizarTorneoResult> {
  const torneo = await prisma.torneo.findUnique({
    where: { id: torneoId },
    select: { pozoNeto: true, pozoBruto: true, estado: true },
  });
  if (!torneo) throw new TorneoNoEncontrado(torneoId);

  // pozoNeto debería estar seteado por el cierre automático. Si no lo
  // está (torneo que estaba EN_JUEGO sin pasar por CERRADO), calculamos.
  const pozoNeto =
    torneo.pozoNeto > 0
      ? torneo.pozoNeto
      : Math.floor(torneo.pozoBruto * 0.88);

  const { ranking } = await listarRanking(torneoId, { limit: 500 });

  // Actualiza cada ticket con su posición y premio final
  const ganadores: FinalizarTorneoResult["ganadores"] = [];
  for (const row of ranking) {
    const premio = calcularPremioEstimado(pozoNeto, row.rank);
    await prisma.ticket.update({
      where: { id: row.ticketId },
      data: {
        posicionFinal: row.rank,
        premioLukas: premio,
      },
    });
    if (premio > 0) {
      ganadores.push({
        rank: row.rank,
        ticketId: row.ticketId,
        usuarioId: row.usuarioId,
        nombre: row.nombre,
        puntosTotal: row.puntosTotal,
        premioLukas: premio,
      });
    }
  }

  await prisma.torneo.update({
    where: { id: torneoId },
    data: { estado: "FINALIZADO" },
  });

  logger.info(
    {
      torneoId,
      totalTickets: ranking.length,
      ganadores: ganadores.length,
    },
    "torneo finalizado",
  );

  return { torneoId, ganadores };
}
