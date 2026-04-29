// Servicio de ranking en vivo.
//
// Lote 2 (Abr 2026): demolido el sistema de Lukas. El ranking ya no
// distribuye premios — sólo posiciona a los tickets por puntos totales.
// `finalizarTorneo` se limita a asignar `posicionFinal` y a marcar el
// torneo FINALIZADO. Sin transacciones, sin créditos, sin pozos.
//
// Empates: tickets con mismos puntos comparten posicionFinal (competition
// ranking). Para la UI usamos un comparador estable (creadoEn ASC) que
// sólo afecta el orden visual dentro del grupo de empate, no la posición
// asignada.

import { prisma, type Prisma } from "@habla/db";
import { TorneoNoEncontrado } from "./errors";
import { logger } from "./logger";
import { recalcularTorneo } from "./puntuacion.service";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface RankingRow {
  rank: number;
  ticketId: string;
  usuarioId: string;
  /** Display del jugador. Es `@username` (sin el prefijo @ — la UI lo
   *  añade al renderizar). */
  nombre: string;
  /** @handle del usuario. Mismo valor que `nombre`. */
  username: string;
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
  creadoEn: Date;
}

export interface RankingResult {
  torneoId: string;
  totalInscritos: number;
  ranking: RankingRow[];
  miPosicion: (RankingRow & { posicion: number }) | null;
}

export interface ListarRankingInput {
  page?: number;
  limit?: number;
  usuarioId?: string;
}

// ---------------------------------------------------------------------------
// listar — función principal
// ---------------------------------------------------------------------------

type TicketConUsuario = Prisma.TicketGetPayload<{
  include: {
    usuario: {
      select: {
        id: true;
        nombre: true;
        username: true;
        email: true;
      };
    };
  };
}>;

export async function listarRanking(
  torneoId: string,
  input: ListarRankingInput = {},
): Promise<RankingResult> {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(500, Math.max(1, input.limit ?? 50));

  const torneo = await prisma.torneo.findUnique({
    where: { id: torneoId },
    select: { id: true, totalInscritos: true, estado: true },
  });
  if (!torneo) throw new TorneoNoEncontrado(torneoId);

  const tickets = await prisma.ticket.findMany({
    where: { torneoId },
    include: {
      usuario: {
        select: { id: true, nombre: true, username: true, email: true },
      },
    },
  });

  const ordenados = [...tickets].sort(comparadorCosmetico);

  const rows: RankingRow[] = ordenados.map((t, idx) => {
    const handle = handleDisplay(t.usuario);
    return {
      rank: idx + 1,
      ticketId: t.id,
      usuarioId: t.usuarioId,
      nombre: handle,
      username: handle,
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
      creadoEn: t.creadoEn,
    };
  });

  const start = (page - 1) * limit;
  const slice = rows.slice(start, start + limit);

  let miPosicion: RankingResult["miPosicion"] = null;
  if (input.usuarioId) {
    const propios = rows.filter((r) => r.usuarioId === input.usuarioId);
    if (propios.length > 0) {
      const mejor = propios.reduce((acc, r) => (r.rank < acc.rank ? r : acc));
      miPosicion = { ...mejor, posicion: mejor.rank };
    }
  }

  return {
    torneoId,
    totalInscritos: torneo.totalInscritos,
    ranking: slice,
    miPosicion,
  };
}

function comparadorCosmetico(a: TicketConUsuario, b: TicketConUsuario): number {
  if (b.puntosTotal !== a.puntosTotal) return b.puntosTotal - a.puntosTotal;
  return a.creadoEn.getTime() - b.creadoEn.getTime();
}

function handleDisplay(u: {
  username: string;
  nombre: string;
  email: string;
  id: string;
}): string {
  if (u.username && !u.username.startsWith("new_")) return u.username;
  if (u.nombre && !u.nombre.includes("@") && !u.nombre.startsWith("new_")) {
    return u.nombre;
  }
  return u.email.split("@")[0] ?? u.id.slice(0, 8);
}

// ---------------------------------------------------------------------------
// finalizarTorneo — asigna posicionFinal a cada ticket usando competition
// ranking (empates comparten posición). Marca el torneo FINALIZADO.
// Idempotente: si ya está FINALIZADO no hace nada.
// ---------------------------------------------------------------------------

export interface FinalizarTorneoResult {
  torneoId: string;
  posicionados: Array<{
    rank: number;
    ticketId: string;
    usuarioId: string;
    nombre: string;
    username: string;
    puntosTotal: number;
  }>;
  /** true si ya estaba FINALIZADO y no se hizo nada (idempotencia). */
  alreadyFinalized: boolean;
}

export async function finalizarTorneo(
  torneoId: string,
): Promise<FinalizarTorneoResult> {
  const preTorneo = await prisma.torneo.findUnique({
    where: { id: torneoId },
    select: { estado: true },
  });
  if (!preTorneo) throw new TorneoNoEncontrado(torneoId);

  if (preTorneo.estado === "FINALIZADO") {
    logger.info({ torneoId }, "finalizarTorneo: ya FINALIZADO — skip");
    return { torneoId, posicionados: [], alreadyFinalized: true };
  }

  // Recalcular puntos con el snapshot final del partido antes de
  // posicionar. Defensa contra puntos pre-FT stale.
  await recalcularTorneo(torneoId);

  const tickets = await prisma.ticket.findMany({
    where: { torneoId },
    include: {
      usuario: {
        select: { id: true, nombre: true, username: true, email: true },
      },
    },
  });

  const ordenados = [...tickets].sort(comparadorCosmetico);

  // Competition ranking: empates comparten posición; el siguiente grupo
  // salta tantas posiciones como tickets había en el grupo previo.
  // Ej: 10pts, 8pts, 8pts, 5pts → posiciones 1, 2, 2, 4.
  const posicionPorTicket = new Map<string, number>();
  let posicionActual = 0;
  let puntosPrevio = Number.NaN;
  ordenados.forEach((t, idx) => {
    if (t.puntosTotal !== puntosPrevio) {
      posicionActual = idx + 1;
      puntosPrevio = t.puntosTotal;
    }
    posicionPorTicket.set(t.id, posicionActual);
  });

  const posicionados = await prisma.$transaction(async (tx) => {
    const out: FinalizarTorneoResult["posicionados"] = [];
    for (const t of ordenados) {
      const posicion = posicionPorTicket.get(t.id)!;
      await tx.ticket.update({
        where: { id: t.id },
        data: { posicionFinal: posicion },
      });
      const handle = handleDisplay(t.usuario);
      out.push({
        rank: posicion,
        ticketId: t.id,
        usuarioId: t.usuarioId,
        nombre: handle,
        username: handle,
        puntosTotal: t.puntosTotal,
      });
    }
    await tx.torneo.update({
      where: { id: torneoId },
      data: { estado: "FINALIZADO" },
    });
    return out;
  });

  logger.info(
    { torneoId, totalTickets: tickets.length, posicionados: posicionados.length },
    "torneo finalizado + posiciones asignadas",
  );

  return { torneoId, posicionados, alreadyFinalized: false };
}
