// Servicio de torneos — operaciones principales del Sub-Sprint 3 + Hotfix #6.
//
// Reglas de negocio (CLAUDE.md §6):
// - Cierre = partido.fechaInicio (al kickoff, irreversible). Plan v6.
// - Rake = 12% del pozo bruto (al entero de Luka, floor).
// - Distribución (Hotfix #6): 10% de inscritos, curva top-heavy.
//   Ver `lib/utils/premios-distribucion.ts` para la fórmula exacta.
// - Torneo con <2 inscritos al cierre se cancela y se reembolsa.
// - Todo movimiento de Lukas es transacción atómica.
// - Un Ticket placeholder se crea con predicciones default (LOCAL, 0-0,
//   todo en false). El Sub-Sprint 4 permite editarlas. La unique
//   constraint `[usuarioId, torneoId, preds…]` evita doble inscripción
//   con defaults; en Sub-Sprint 4 los usuarios pueden crear tickets
//   adicionales siempre que las predicciones difieran.

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
  BalanceInsuficiente,
  NoAutenticado,
  PartidoNoEncontrado,
  TorneoCerrado,
  TorneoNoEncontrado,
  ValidacionFallida,
  YaInscrito,
  DomainError,
} from "./errors";
import { logger } from "./logger";
import { verificarLimiteInscripcion } from "./limites.service";
import { ENTRADA_LUKAS } from "../config/economia";

// ---------------------------------------------------------------------------
// Constantes del negocio
// ---------------------------------------------------------------------------

export const RAKE_PCT = 0.12;
/**
 * Minutos antes del kickoff en los que se cierran las inscripciones.
 * Plan v6 lo bajó de 5 a 0 (cierre exacto al kickoff). Se mantiene la
 * constante porque varios callers (admin, partidos-import, schema) la
 * usan para calcular `cierreAt`; cambiarla a 0 acá propaga a todos.
 */
export const CIERRE_MIN_BEFORE = 0;
export const MIN_INSCRITOS_PARA_ACTIVAR = 2;

/**
 * Descriptor serializable de la regla de distribución vigente al crearse
 * el torneo — se guarda en `Torneo.distribPremios` (Json?) como audit
 * trail. Los cálculos reales NO leen de acá: usan `distribuirPremios`
 * del helper puro. Si la regla cambia en el futuro, los torneos viejos
 * conservan su descriptor original y los nuevos reciben el nuevo.
 */
export const DISTRIB_PREMIOS_DESCRIPTOR = {
  tipo: "hotfix-6-top-heavy",
  rakePct: RAKE_PCT,
  maxPctInscritos: 0.1,
  share1: 0.45,
  decayFormula: "share[i] geometric with r = 1 - 2.8/M for M>=10",
} as const;

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
  nuevoBalance: number;
}

export interface CancelarResult {
  torneoId: string;
  motivo: string;
  refunded: number;
  reembolsoTotalLukas: number;
}

export interface CierreAutomaticoResult {
  cerrados: Array<{ torneoId: string; pozoBruto: number; pozoNeto: number; rake: number }>;
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
// listarInscritos — Hotfix #5 Bug #13.
//
// Devuelve los jugadores inscritos en un torneo + cuántos tickets tienen
// cada uno + su nivel (calculado sobre el total de torneos jugados en la
// plataforma). Si el torneo NO está ABIERTO, también incluye las
// predicciones + puntos de cada ticket — antes del cierre las predicciones
// se ocultan por privacidad competitiva (evita que otros copien las
// combinadas de quienes ya se inscribieron).
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
  premioLukas: number;
  creadoEn: Date;
}

export interface InscritoInfo {
  usuarioId: string;
  /** "@handle" para mostrar en ranking/inscritos. Sin arroba; la UI lo
   *  prefija. */
  handle: string;
  /** Cantidad total de torneos (únicos) en los que el usuario jugó.
   *  Alimenta el cálculo de nivel. */
  torneosJugados: number;
  /** Tickets de este usuario dentro de ESTE torneo. Al menos 1. */
  tickets: InscritoTicket[];
}

export interface ListarInscritosResult {
  inscritos: InscritoInfo[];
  total: number;
  /** Si el torneo está ABIERTO, forzamos a no exponer predicciones aún
   *  (defensa en profundidad: aunque el caller ignore el campo
   *  `predicciones`, el service lo devuelve siempre null hasta que
   *  cierre el torneo). */
  mostrarPredicciones: boolean;
}

/**
 * Handle derivado del usuario. Registro formal (Abr 2026): preferimos
 * `username` (NOT NULL en BD). Si el username es temporal `new_<hex>`
 * (OAuth que no completó) caemos al prefijo del email para no ensuciar
 * rankings con placeholders. Coincide con `handleDisplay` de
 * ranking.service para que el handle que aparece en /torneo/:id sea el
 * mismo que en /live-match.
 */
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

  // Agrupa tickets por usuarioId preservando orden de inscripción.
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
      premioLukas: t.premioLukas,
      creadoEn: t.creadoEn,
    });
  }

  // Cuenta torneos jugados (únicos) por cada usuario — para el nivel.
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

  // Paginación en memoria — el payload full ya está en RAM (típicamente
  // <500 tickets por torneo MVP, pico <5000).
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
//
// Plan v6 (Lote 4): la entrada se unifica a ENTRADA_LUKAS (3) para
// TODOS los tipos de torneo. Si el caller envía un valor distinto en
// `input.entradaLukas`, se ignora y se loguea — mantenemos el campo en
// `CrearInput` por compat con el panel admin existente, pero ya no
// configura nada. Los torneos preexistentes con entrada distinta
// quedan como están.
// ---------------------------------------------------------------------------

export interface CrearInput {
  partidoId: string;
  tipo: TipoTorneo;
  /** @deprecated Plan v6 — la entrada es siempre ENTRADA_LUKAS. Sólo se
   *  mantiene para compat del panel admin; cualquier valor enviado se
   *  ignora silenciosamente. */
  entradaLukas?: number;
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
      entradaLukas: ENTRADA_LUKAS,
      partidoId: input.partidoId,
      cierreAt,
      distribPremios: DISTRIB_PREMIOS_DESCRIPTOR,
    },
    include: { partido: true },
  });

  logger.info(
    {
      torneoId: torneo.id,
      partidoId: partido.id,
      tipo: input.tipo,
      entradaLukas: ENTRADA_LUKAS,
    },
    "torneo creado",
  );

  return torneo;
}

// ---------------------------------------------------------------------------
// inscribir — transacción atómica.
// Pasos:
//   1. Valida torneo ABIERTO y cierreAt > NOW.
//   2. Valida balance suficiente (dentro de la tx para evitar race).
//   3. Valida límites de juego (stub).
//   4. Descuenta entrada + crea TransaccionLukas ENTRADA_TORNEO.
//   5. Crea Ticket placeholder (predicciones default; Sub-Sprint 4 las
//      completa).
//   6. Incrementa totalInscritos + pozoBruto.
// Cualquier fallo → rollback total.
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

    const usuario = await tx.usuario.findUnique({
      where: { id: usuarioId },
      select: { balanceLukas: true },
    });
    if (!usuario) throw new NoAutenticado();
    if (usuario.balanceLukas < torneo.entradaLukas) {
      throw new BalanceInsuficiente(usuario.balanceLukas, torneo.entradaLukas);
    }

    await verificarLimiteInscripcion({
      tx,
      usuarioId,
      entradaLukas: torneo.entradaLukas,
    });

    await tx.usuario.update({
      where: { id: usuarioId },
      data: { balanceLukas: { decrement: torneo.entradaLukas } },
    });
    await tx.transaccionLukas.create({
      data: {
        usuarioId,
        tipo: "ENTRADA_TORNEO",
        monto: -torneo.entradaLukas,
        descripcion: `Inscripción a ${torneo.nombre}`,
        refId: torneoId,
      },
    });

    // Ticket placeholder — predicciones default. Sub-Sprint 4 las edita.
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
        // El unique compuesto impidió la doble inscripción con defaults
        throw new YaInscrito(torneoId);
      }
      throw err;
    }

    const torneoActualizado = await tx.torneo.update({
      where: { id: torneoId },
      data: {
        totalInscritos: { increment: 1 },
        pozoBruto: { increment: torneo.entradaLukas },
      },
    });

    const nuevoBalance = usuario.balanceLukas - torneo.entradaLukas;

    logger.info(
      {
        torneoId,
        usuarioId,
        ticketId: ticket.id,
        entradaLukas: torneo.entradaLukas,
        nuevoBalance,
      },
      "inscripción creada",
    );

    return { ticket, torneo: torneoActualizado, nuevoBalance };
  });
}

// ---------------------------------------------------------------------------
// cancelar — marca CANCELADO y reembolsa a todos los inscritos.
// ---------------------------------------------------------------------------

export async function cancelar(
  torneoId: string,
  motivo: string,
): Promise<CancelarResult> {
  return prisma.$transaction(async (tx) => {
    const torneo = await tx.torneo.findUnique({
      where: { id: torneoId },
      include: {
        tickets: { select: { id: true, usuarioId: true } },
      },
    });
    if (!torneo) throw new TorneoNoEncontrado(torneoId);
    if (
      torneo.estado === "CANCELADO" ||
      torneo.estado === "FINALIZADO"
    ) {
      throw new DomainError(
        "TORNEO_NO_CANCELABLE",
        "El torneo ya está cerrado y no se puede cancelar.",
        409,
        { estadoActual: torneo.estado },
      );
    }

    await tx.torneo.update({
      where: { id: torneoId },
      data: { estado: "CANCELADO" },
    });

    for (const ticket of torneo.tickets) {
      await tx.usuario.update({
        where: { id: ticket.usuarioId },
        data: { balanceLukas: { increment: torneo.entradaLukas } },
      });
      await tx.transaccionLukas.create({
        data: {
          usuarioId: ticket.usuarioId,
          tipo: "REEMBOLSO",
          monto: torneo.entradaLukas,
          descripcion: `Reembolso torneo cancelado: ${motivo}`,
          refId: torneoId,
        },
      });
    }

    const reembolsoTotalLukas = torneo.tickets.length * torneo.entradaLukas;

    logger.info(
      {
        torneoId,
        motivo,
        refunded: torneo.tickets.length,
        reembolsoTotalLukas,
      },
      "torneo cancelado y reembolsado",
    );

    return {
      torneoId,
      motivo,
      refunded: torneo.tickets.length,
      reembolsoTotalLukas,
    };
  });
}

// ---------------------------------------------------------------------------
// procesarCierreAutomatico — usada por el cron. Busca torneos ABIERTOS
// con cierreAt <= NOW y aplica:
//   - <2 inscritos  → cancelar (que reembolsa).
//   - ≥2 inscritos  → CERRADO, calcular rake 12% floor y pozoNeto.
//
// Plan v6: cierreAt ahora coincide con kickoff. El guard `estado:
// "ABIERTO"` del where es la condición explícita — un torneo ya en
// EN_VIVO/CERRADO/FINALIZADO/CANCELADO no se vuelve a tocar acá.
// ---------------------------------------------------------------------------

export async function procesarCierreAutomatico(): Promise<CierreAutomaticoResult> {
  const vencidos = await prisma.torneo.findMany({
    where: {
      // Guard duro: solo cerramos los que siguen ABIERTOS. Si el poller
      // ya los pasó a EN_VIVO o el admin los canceló, los ignoramos.
      estado: "ABIERTO",
      cierreAt: { lte: new Date() },
    },
    select: {
      id: true,
      totalInscritos: true,
      pozoBruto: true,
    },
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
      const rake = Math.floor(t.pozoBruto * RAKE_PCT);
      const pozoNeto = t.pozoBruto - rake;
      await prisma.torneo.update({
        where: { id: t.id },
        data: {
          estado: "CERRADO",
          rake,
          pozoNeto,
        },
      });
      cerrados.push({
        torneoId: t.id,
        pozoBruto: t.pozoBruto,
        pozoNeto,
        rake,
      });
      logger.info(
        { torneoId: t.id, pozoBruto: t.pozoBruto, pozoNeto, rake },
        "torneo cerrado",
      );
    }
  }

  return { cerrados, cancelados };
}
