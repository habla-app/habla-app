// Servicio de ranking en vivo — Sub-Sprint 5 + Hotfix #6.
//
// Fuente de verdad: la base de datos (Ticket.puntosTotal). Redis se usa
// como cache del sorted set para lecturas <1ms; si Redis no responde
// degradamos a BD.
//
// Hotfix #6 — Nueva distribución de premios (§6):
//   - Pagan el 10% de inscritos, brackets especiales para N<100.
//   - Curva top-heavy: 45% al 1°, 55% restante en decaimiento geométrico.
//   - Empates: tickets con puntaje idéntico reparten equitativamente
//     los premios de las posiciones que ocupan como grupo.
//   - Desempates adicionales ELIMINADOS. Mismos puntos = mismo premio.
//     El orden de inscripción queda como tiebreaker cosmético estable
//     para que la UI no salte entre refreshes, pero no afecta premios.

import { prisma, type Prisma } from "@habla/db";
import { TorneoNoEncontrado } from "./errors";
import { logger } from "./logger";
import {
  distribuirPremios,
  premioEstimadoSinEmpate,
  type TicketParaDistribuir,
} from "../utils/premios-distribucion";

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
  /** Posiciones pagadas (M) según `calcularPagados(totalInscritos)`.
   *  UI lo usa para el badge "En el dinero" y el copy motivacional. */
  pagados: number;
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
  include: { usuario: { select: { id: true; nombre: true; email: true } } };
}>;

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

  // Ordenamiento: puntosTotal DESC, creadoEn ASC. El segundo criterio
  // es SÓLO cosmético — jugadores con mismos puntos reciben el mismo
  // premio (split por empate).
  const ordenados = [...tickets].sort(comparadorCosmetico);

  // Distribución de premios: pasamos los tickets al helper puro. El
  // resultado nos da `posicionFinal` + `premioLukas` para cada uno,
  // respetando los empates.
  const ticketsParaDistribuir: TicketParaDistribuir[] = ordenados.map((t) => ({
    id: t.id,
    puntosTotal: t.puntosTotal,
    creadoEn: t.creadoEn,
  }));
  const asignaciones = distribuirPremios(
    ticketsParaDistribuir,
    torneo.totalInscritos,
    pozoNetoEstimado,
  );
  const premioPorTicketId = new Map(
    asignaciones.map((a) => [a.ticketId, a]),
  );

  // `rank` visual: el índice del array ordenado + 1. Para empates, el
  // primer ticket del grupo tiene rank == posicionFinal y los demás
  // tienen rank > posicionFinal (para UI sigan visualmente abajo del
  // primero, aunque compartan premio). En el futuro podríamos
  // colapsar visualmente los empates, pero el MVP conserva el orden.
  const rows: RankingRow[] = ordenados.map((t, idx) => {
    const rank = idx + 1;
    const asig = premioPorTicketId.get(t.id);
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
      premioEstimado: asig?.premioLukas ?? 0,
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
      const mejor = propios.reduce((acc, r) => (r.rank < acc.rank ? r : acc));
      miPosicion = { ...mejor, posicion: mejor.rank };
    }
  }

  // pagados: lo exponemos para que la UI del badge "En el dinero" y el
  // copy motivacional del Ítem 1.6 del Hotfix #6 calculen posicionamiento.
  const { calcularPagados } = await import("../utils/premios-distribucion");
  const pagados = calcularPagados(torneo.totalInscritos);

  return {
    torneoId,
    totalInscritos: torneo.totalInscritos,
    pozoNeto: pozoNetoEstimado,
    pozoBruto: torneo.pozoBruto,
    ranking: slice,
    miPosicion,
    pagados,
  };
}

function comparadorCosmetico(a: TicketConUsuario, b: TicketConUsuario): number {
  if (b.puntosTotal !== a.puntosTotal) return b.puntosTotal - a.puntosTotal;
  return a.creadoEn.getTime() - b.creadoEn.getTime();
}

function nombreDisplay(u: {
  nombre: string;
  email: string;
  id: string;
}): string {
  if (u.nombre && !u.nombre.includes("@")) return u.nombre;
  const prefix = u.email.split("@")[0] ?? u.id.slice(0, 8);
  return prefix;
}

// ---------------------------------------------------------------------------
// calcularPremioEstimado — helper público (compat con callers que no
// necesitan el full ranking). Útil para notificaciones pre-finalización
// o tooltips del mockup. Proyecta SIN empates.
// ---------------------------------------------------------------------------

export function calcularPremioEstimado(
  pozoNeto: number,
  posicion: number,
  totalInscritos: number,
): number {
  return premioEstimadoSinEmpate(posicion, totalInscritos, pozoNeto);
}

// ---------------------------------------------------------------------------
// finalizarTorneo — llamado por el poller cuando el partido llega a
// FIN_PARTIDO. Asigna posiciones finales + premios definitivos usando
// la nueva distribución con empates. Marca el torneo FINALIZADO.
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
    select: { pozoNeto: true, pozoBruto: true, estado: true, totalInscritos: true },
  });
  if (!torneo) throw new TorneoNoEncontrado(torneoId);

  // pozoNeto debería estar seteado por el cierre automático. Si no lo
  // está (torneo que estaba EN_JUEGO sin pasar por CERRADO), calculamos.
  const pozoNeto =
    torneo.pozoNeto > 0
      ? torneo.pozoNeto
      : Math.floor(torneo.pozoBruto * 0.88);

  // Traer todos los tickets con el usuario (para el display name).
  const tickets = await prisma.ticket.findMany({
    where: { torneoId },
    include: { usuario: { select: { id: true, nombre: true, email: true } } },
  });

  // Distribuir premios con la nueva regla (split por empate).
  const asignaciones = distribuirPremios(
    tickets.map((t) => ({
      id: t.id,
      puntosTotal: t.puntosTotal,
      creadoEn: t.creadoEn,
    })),
    torneo.totalInscritos,
    pozoNeto,
  );
  const porTicketId = new Map(asignaciones.map((a) => [a.ticketId, a]));

  // Actualiza cada ticket con su posición y premio final.
  // Tickets empatados reciben el mismo posicionFinal (ej. los 3 empatados
  // en 1° reciben posicionFinal=1 todos).
  const ganadores: FinalizarTorneoResult["ganadores"] = [];
  for (const t of tickets) {
    const asig = porTicketId.get(t.id);
    if (!asig) continue;
    await prisma.ticket.update({
      where: { id: t.id },
      data: {
        posicionFinal: asig.posicionFinal,
        premioLukas: asig.premioLukas,
      },
    });
    if (asig.premioLukas > 0) {
      ganadores.push({
        rank: asig.posicionFinal,
        ticketId: t.id,
        usuarioId: t.usuarioId,
        nombre: nombreDisplay(t.usuario),
        puntosTotal: t.puntosTotal,
        premioLukas: asig.premioLukas,
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
      totalTickets: tickets.length,
      ganadores: ganadores.length,
    },
    "torneo finalizado",
  );

  return { torneoId, ganadores };
}
