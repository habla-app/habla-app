// Servicio de torneos.
//
// Lote 2 (Abr 2026): demolido el sistema de Lukas. Las inscripciones son
// gratuitas — sólo crean un Ticket placeholder. Los torneos cancelados no
// reembolsan nada (no hay saldo). El cierre automático sólo cambia estado
// y deja CANCELADO los que no llegan al mínimo.
//
// Reglas vigentes:
// - Cierre = partido.fechaInicio (al kickoff, irreversible).
// - Torneo con <2 inscritos al cierre se cancela (sin reembolso).
// - Un Ticket placeholder se crea con predicciones default (LOCAL, 0-0,
//   todo en false). El usuario las edita después en el ComboModal. La
//   unique constraint `[usuarioId, torneoId, preds…]` evita doble
//   inscripción con defaults pero permite tickets adicionales con
//   predicciones distintas.

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
  PartidoNoEncontrado,
  TorneoCerrado,
  TorneoNoEncontrado,
  ValidacionFallida,
  YaInscrito,
  DomainError,
} from "./errors";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/**
 * Minutos antes del kickoff en los que se cierran las inscripciones.
 * Plan v6 lo bajó de 5 a 0 (cierre exacto al kickoff). Se mantiene la
 * constante porque varios callers (admin, partidos-import, schema) la
 * usan para calcular `cierreAt`.
 */
export const CIERRE_MIN_BEFORE = 0;
export const MIN_INSCRITOS_PARA_ACTIVAR = 2;

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
}

export interface CancelarResult {
  torneoId: string;
  motivo: string;
  refunded: number;
}

export interface CierreAutomaticoResult {
  cerrados: Array<{ torneoId: string }>;
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
// obtenerPorSlug — Lote C v3.1.
//
// Resuelve el torneo asociado a un partido a partir de un slug. En v3.1 el
// slug operativo es `Partido.id` (no hay columna `slug` en la tabla
// `partidos` — la mantenemos como decisión arquitectónica para evitar una
// migración por una vista de SEO marginal). Llama a este wrapper la nueva
// ruta `/comunidad/torneo/[slug]`; el redirect 301 desde `/torneo/[id]`
// (legacy) usa `obtener(id)` y mapea a `partido.id`.
//
// Si el partido tiene varios torneos (raro en v3.1, pero técnicamente
// posible), devuelve el más activo: ABIERTO > EN_JUEGO > CERRADO >
// FINALIZADO > CANCELADO.
// ---------------------------------------------------------------------------

const ESTADO_PRIORIDAD: Record<EstadoTorneo, number> = {
  ABIERTO: 0,
  EN_JUEGO: 1,
  CERRADO: 2,
  FINALIZADO: 3,
  CANCELADO: 4,
};

export async function obtenerPorSlug(
  slug: string,
  usuarioId?: string,
): Promise<ObtenerResult | null> {
  const partido = await prisma.partido.findUnique({
    where: { id: slug },
    select: { id: true },
  });
  if (!partido) return null;

  const torneos = await prisma.torneo.findMany({
    where: { partidoId: partido.id },
    include: { partido: true },
    orderBy: { creadoEn: "desc" },
  });
  if (torneos.length === 0) return null;

  const torneo = torneos.sort((a, b) => {
    const da = ESTADO_PRIORIDAD[a.estado] ?? 99;
    const db = ESTADO_PRIORIDAD[b.estado] ?? 99;
    return da - db;
  })[0]!;

  let miTicket: Ticket | null = null;
  if (usuarioId) {
    miTicket = await prisma.ticket.findFirst({
      where: { torneoId: torneo.id, usuarioId },
      orderBy: { creadoEn: "desc" },
    });
  }

  return { torneo, miTicket };
}

/**
 * Helper para el redirect 301 legacy `/torneo/:id` → `/comunidad/torneo/
 * :partidoId` desde `middleware.ts`. Devuelve el partidoId del torneo o
 * null si no existe (la middleware redirige a `/comunidad`).
 */
export async function partidoIdDeTorneoLegacy(
  torneoId: string,
): Promise<string | null> {
  const t = await prisma.torneo.findUnique({
    where: { id: torneoId },
    select: { partidoId: true },
  });
  return t?.partidoId ?? null;
}

// ---------------------------------------------------------------------------
// listarInscritos — devuelve los jugadores inscritos en un torneo + cuántos
// tickets tienen + su nivel. Si el torneo no está ABIERTO, también incluye
// las predicciones (antes del cierre se ocultan por privacidad competitiva).
// ---------------------------------------------------------------------------

export interface InscritoTicket {
  ticketId: string;
  /** Predicciones: solo presentes si torneo.estado !== 'ABIERTO'. */
  predicciones: {
    predResultado: "LOCAL" | "EMPATE" | "VISITA";
    predBtts: boolean;
    predMas25: boolean;
    predTarjetaRoja: boolean;
    predMarcadorLocal: number;
    predMarcadorVisita: number;
  } | null;
  puntosTotal: number;
  puntosDetalle: {
    resultado: number;
    btts: number;
    mas25: number;
    tarjeta: number;
    marcador: number;
  };
  posicionFinal: number | null;
  creadoEn: Date;
}

export interface InscritoInfo {
  usuarioId: string;
  /** "@handle" para mostrar en ranking/inscritos. Sin arroba; la UI lo
   *  prefija. */
  handle: string;
  /** Cantidad total de torneos (únicos) en los que el usuario jugó. */
  torneosJugados: number;
  /** Tickets de este usuario dentro de ESTE torneo. Al menos 1. */
  tickets: InscritoTicket[];
}

export interface ListarInscritosResult {
  inscritos: InscritoInfo[];
  total: number;
  /** Si el torneo está ABIERTO, forzamos a no exponer predicciones aún. */
  mostrarPredicciones: boolean;
}

function handleFromUsuario(u: {
  id: string;
  nombre: string;
  username: string;
  email: string;
}): string {
  if (u.username && !u.username.startsWith("new_")) return u.username;
  if (u.nombre && !u.nombre.includes("@") && !u.nombre.startsWith("new_")) {
    return u.nombre;
  }
  return u.email.split("@")[0] ?? u.id.slice(0, 8);
}

export interface ListarInscritosInput {
  page?: number;
  limit?: number;
}

export async function listarInscritos(
  torneoId: string,
  input: ListarInscritosInput = {},
): Promise<ListarInscritosResult> {
  const torneo = await prisma.torneo.findUnique({
    where: { id: torneoId },
    select: { id: true, estado: true },
  });
  if (!torneo) throw new TorneoNoEncontrado(torneoId);

  const mostrarPredicciones = torneo.estado !== "ABIERTO";

  const tickets = await prisma.ticket.findMany({
    where: { torneoId },
    include: {
      usuario: {
        select: { id: true, nombre: true, username: true, email: true },
      },
    },
    orderBy: { creadoEn: "asc" },
  });

  const porUsuario = new Map<string, InscritoInfo>();
  for (const t of tickets) {
    let info = porUsuario.get(t.usuarioId);
    if (!info) {
      info = {
        usuarioId: t.usuarioId,
        handle: handleFromUsuario(t.usuario),
        torneosJugados: 0,
        tickets: [],
      };
      porUsuario.set(t.usuarioId, info);
    }
    info.tickets.push({
      ticketId: t.id,
      predicciones: mostrarPredicciones
        ? {
            predResultado: t.predResultado,
            predBtts: t.predBtts,
            predMas25: t.predMas25,
            predTarjetaRoja: t.predTarjetaRoja,
            predMarcadorLocal: t.predMarcadorLocal,
            predMarcadorVisita: t.predMarcadorVisita,
          }
        : null,
      puntosTotal: t.puntosTotal,
      puntosDetalle: {
        resultado: t.puntosResultado,
        btts: t.puntosBtts,
        mas25: t.puntosMas25,
        tarjeta: t.puntosTarjeta,
        marcador: t.puntosMarcador,
      },
      posicionFinal: t.posicionFinal,
      creadoEn: t.creadoEn,
    });
  }

  const usuariosIds = Array.from(porUsuario.keys());
  if (usuariosIds.length > 0) {
    const todos = await prisma.ticket.findMany({
      where: { usuarioId: { in: usuariosIds } },
      select: { usuarioId: true, torneoId: true },
    });
    const torneosPorUsuario = new Map<string, Set<string>>();
    for (const t of todos) {
      if (!torneosPorUsuario.has(t.usuarioId)) {
        torneosPorUsuario.set(t.usuarioId, new Set());
      }
      torneosPorUsuario.get(t.usuarioId)!.add(t.torneoId);
    }
    for (const [usuarioId, info] of porUsuario) {
      info.torneosJugados = torneosPorUsuario.get(usuarioId)?.size ?? 0;
    }
  }

  const inscritos = Array.from(porUsuario.values());
  const total = inscritos.length;

  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));
  const start = (page - 1) * limit;
  const slice = inscritos.slice(start, start + limit);

  return {
    inscritos: slice,
    total,
    mostrarPredicciones,
  };
}

// ---------------------------------------------------------------------------
// crear — admin crea un torneo sobre un partido disponible.
// ---------------------------------------------------------------------------

export interface CrearInput {
  partidoId: string;
  tipo: TipoTorneo;
  nombre?: string;
}

export async function crear(input: CrearInput): Promise<TorneoConPartido> {
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
      "El partido ya empezó; no se puede crear torneo.",
    );
  }

  const nombre =
    input.nombre?.trim() ||
    `${partido.equipoLocal} vs ${partido.equipoVisita}`;

  const torneo = await prisma.torneo.create({
    data: {
      nombre,
      tipo: input.tipo,
      partidoId: input.partidoId,
      cierreAt,
    },
    include: { partido: true },
  });

  logger.info(
    { torneoId: torneo.id, partidoId: partido.id, tipo: input.tipo },
    "torneo creado",
  );

  return torneo;
}

// ---------------------------------------------------------------------------
// inscribir — sin movimiento de saldo (Lote 2). Sólo crea Ticket placeholder
// + incrementa totalInscritos. El usuario edita las predicciones en el
// ComboModal; el guard del unique compuesto evita doble inscripción.
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
        throw new YaInscrito(torneoId);
      }
      throw err;
    }

    const torneoActualizado = await tx.torneo.update({
      where: { id: torneoId },
      data: { totalInscritos: { increment: 1 } },
    });

    logger.info(
      { torneoId, usuarioId, ticketId: ticket.id },
      "inscripción creada",
    );

    return { ticket, torneo: torneoActualizado };
  });
}

// ---------------------------------------------------------------------------
// cancelar — marca el torneo CANCELADO. Sin reembolso (no hay saldo).
// ---------------------------------------------------------------------------

export async function cancelar(
  torneoId: string,
  motivo: string,
): Promise<CancelarResult> {
  const torneo = await prisma.torneo.findUnique({
    where: { id: torneoId },
    include: { tickets: { select: { id: true } } },
  });
  if (!torneo) throw new TorneoNoEncontrado(torneoId);
  if (torneo.estado === "CANCELADO" || torneo.estado === "FINALIZADO") {
    throw new DomainError(
      "TORNEO_NO_CANCELABLE",
      "El torneo ya está cerrado y no se puede cancelar.",
      409,
      { estadoActual: torneo.estado },
    );
  }

  await prisma.torneo.update({
    where: { id: torneoId },
    data: { estado: "CANCELADO" },
  });

  logger.info(
    { torneoId, motivo, refunded: torneo.tickets.length },
    "torneo cancelado",
  );

  return {
    torneoId,
    motivo,
    refunded: torneo.tickets.length,
  };
}

// ---------------------------------------------------------------------------
// procesarCierreAutomatico — usada por el cron. Busca torneos ABIERTOS con
// cierreAt <= NOW:
//   - <2 inscritos  → cancelar.
//   - ≥2 inscritos  → CERRADO.
// Sin cálculo de rake/pozoNeto (no hay saldo en Lote 2+).
// ---------------------------------------------------------------------------

export async function procesarCierreAutomatico(): Promise<CierreAutomaticoResult> {
  const vencidos = await prisma.torneo.findMany({
    where: {
      estado: "ABIERTO",
      cierreAt: { lte: new Date() },
    },
    select: { id: true, totalInscritos: true },
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
      await prisma.torneo.update({
        where: { id: t.id },
        data: { estado: "CERRADO" },
      });
      cerrados.push({ torneoId: t.id });
      logger.info({ torneoId: t.id }, "torneo cerrado");
    }
  }

  return { cerrados, cancelados };
}
