// Servicio de leaderboard mensual — Lote 5 (May 2026).
//
// Reemplaza al sistema de premios por torneo (demolido en Lote 2 junto con
// Lukas). Cada mes calendario forma un leaderboard que agrega
// `Ticket.puntosFinales` por usuario sobre tickets de torneos finalizados
// cuyo `partido.fechaInicio` cae dentro del mes en la tz America/Lima.
//
// Flujo:
//   - Mes en curso: `obtenerLeaderboardMesActual()` agrega on-the-fly
//     desde la tabla `tickets`. No persiste nada.
//   - Día 1 del mes siguiente, ≥01:00 hora Lima: el cron J llama a
//     `cerrarLeaderboard(mesAnterior)` — agrega, snapshotea Top 100 en
//     `Leaderboard.posiciones` (JSONB), crea `PremioMensual` para Top 10
//     según `TABLA_PREMIOS_MENSUAL`, marca `cerradoEn`.
//   - Mes cerrado: `obtenerLeaderboardCerrado(mes)` lee desde el JSONB
//     persistido. Es read-only.
//
// Idempotencia:
//   - `cerrarLeaderboard` chequea `cerradoEn` antes de tocar nada. Si ya
//     está cerrado retorna no-op.
//   - El UNIQUE index sobre `Leaderboard.mes` previene races entre
//     múltiples corridas del cron.
//
// Premios: tabla fija (no se cambia sin OK del PO):
//   1° S/ 500 · 2° S/ 200 · 3° S/ 200 · 4°-10° S/ 50 c/u → S/ 1,250 totales.

import { prisma, Prisma, type Leaderboard, type PremioMensual } from "@habla/db";
import { formatNombreMes, getMesKey, getMonthBounds } from "../utils/datetime";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Tabla de premios — fija. Total S/ 1,250 mensuales.
// ---------------------------------------------------------------------------

export const TABLA_PREMIOS_MENSUAL = [
  { posicion: 1, montoSoles: 500 },
  { posicion: 2, montoSoles: 200 },
  { posicion: 3, montoSoles: 200 },
  { posicion: 4, montoSoles: 50 },
  { posicion: 5, montoSoles: 50 },
  { posicion: 6, montoSoles: 50 },
  { posicion: 7, montoSoles: 50 },
  { posicion: 8, montoSoles: 50 },
  { posicion: 9, montoSoles: 50 },
  { posicion: 10, montoSoles: 50 },
] as const;

export const TOTAL_PREMIO_MENSUAL = TABLA_PREMIOS_MENSUAL.reduce(
  (acc, p) => acc + p.montoSoles,
  0,
);
export const PREMIO_PRIMER_PUESTO =
  TABLA_PREMIOS_MENSUAL.find((p) => p.posicion === 1)?.montoSoles ?? 0;

export function tablaPremios(): ReadonlyArray<{
  posicion: number;
  montoSoles: number;
}> {
  return TABLA_PREMIOS_MENSUAL;
}

export function premioParaPosicion(posicion: number): number {
  const fila = TABLA_PREMIOS_MENSUAL.find((p) => p.posicion === posicion);
  return fila?.montoSoles ?? 0;
}

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface LeaderboardRow {
  posicion: number;
  userId: string;
  username: string;
  puntos: number;
}

export interface LeaderboardActual {
  mes: string; // YYYY-MM
  nombreMes: string; // "abril 2026"
  totalUsuarios: number;
  filas: LeaderboardRow[]; // Top 100
  miFila: LeaderboardRow | null;
  /** true si el mes está cerrado (no aplica para "actual" pero el tipo se
   *  comparte con el de mes cerrado para reusar componente). */
  cerrado: false;
  cerradoEn: null;
}

export interface LeaderboardCerrado {
  mes: string;
  nombreMes: string;
  totalUsuarios: number;
  filas: LeaderboardRow[];
  miFila: LeaderboardRow | null;
  cerrado: true;
  cerradoEn: Date;
}

export type LeaderboardVista = LeaderboardActual | LeaderboardCerrado;

export interface CerrarLeaderboardResult {
  leaderboardId: string;
  mes: string;
  totalUsuarios: number;
  premiosCreados: PremioMensualEnviable[];
  alreadyClosed: boolean;
  /** true si se creó un PremioMensual dummy de inspección (sin actividad
   *  real en el mes y `dummy:true` en el input). */
  dummyCreado: boolean;
}

/** Forma "enviable" del premio — incluye los datos del usuario para el
 *  email + el nombre del mes + monto del 1° puesto (cierre motivacional). */
export interface PremioMensualEnviable {
  premioId: string;
  userId: string;
  email: string;
  nombre: string;
  username: string;
  posicion: number;
  montoSoles: number;
  mesKey: string;
  nombreMes: string;
  nombreMesSiguiente: string;
  premioPrimerPuestoSoles: number;
}

// ---------------------------------------------------------------------------
// Mes actual — agrega on-the-fly
// ---------------------------------------------------------------------------

/**
 * Agrega `puntosFinales` por usuario sobre tickets de torneos finalizados
 * del mes en curso. Devuelve top 100 + miFila si `usuarioIdActual`.
 */
export async function obtenerLeaderboardMesActual(input: {
  mes?: string; // YYYY-MM, default mes actual Lima
  usuarioIdActual?: string;
} = {}): Promise<LeaderboardActual> {
  const mes = input.mes ?? mesActualKey();
  const filas = await agregarPuntosDelMes(mes);
  return armarVistaActual(mes, filas, input.usuarioIdActual ?? null);
}

/**
 * Lee leaderboard cerrado desde `Leaderboard.posiciones` (JSONB). Si el mes
 * no existe o no está cerrado, retorna null.
 */
export async function obtenerLeaderboardCerrado(input: {
  mes: string;
  usuarioIdActual?: string;
}): Promise<LeaderboardCerrado | null> {
  const lb = await prisma.leaderboard.findUnique({
    where: { mes: input.mes },
  });
  if (!lb || !lb.cerradoEn) return null;

  const filas = parsePosiciones(lb.posiciones);
  const miFila = input.usuarioIdActual
    ? filas.find((f) => f.userId === input.usuarioIdActual) ?? null
    : null;

  return {
    mes: lb.mes,
    nombreMes: formatNombreMes(lb.mes),
    totalUsuarios: lb.totalUsuarios,
    filas,
    miFila,
    cerrado: true,
    cerradoEn: lb.cerradoEn,
  };
}

/**
 * Lista leaderboards cerrados (orden desc por mes). Para /admin/leaderboard
 * y para el footer de /comunidad ("Ver meses pasados").
 */
export async function listarLeaderboardsCerrados(): Promise<
  Array<{
    mes: string;
    nombreMes: string;
    cerradoEn: Date;
    totalUsuarios: number;
    totalPremiosPagados: number;
    totalPremiosPendientes: number;
  }>
> {
  const cerrados = await prisma.leaderboard.findMany({
    where: { cerradoEn: { not: null } },
    orderBy: { mes: "desc" },
    include: { premios: true },
  });
  return cerrados
    .filter((lb): lb is typeof lb & { cerradoEn: Date } => lb.cerradoEn !== null)
    .map((lb) => ({
      mes: lb.mes,
      nombreMes: formatNombreMes(lb.mes),
      cerradoEn: lb.cerradoEn,
      totalUsuarios: lb.totalUsuarios,
      totalPremiosPagados: lb.premios.filter((p) => p.estado === "PAGADO")
        .length,
      totalPremiosPendientes: lb.premios.filter(
        (p) => p.estado === "PENDIENTE" || p.estado === "COORDINADO",
      ).length,
    }));
}

// ---------------------------------------------------------------------------
// Cierre de leaderboard — el corazón del lote.
// ---------------------------------------------------------------------------

/**
 * Cierra el leaderboard del mes dado. Idempotente: si ya tiene `cerradoEn`,
 * retorna `alreadyClosed: true` sin tocar nada.
 *
 * Pasos en una transacción:
 *   1. Re-chequea idempotencia bajo lock.
 *   2. Agrega tickets del mes → top 100.
 *   3. Upsertea Leaderboard con `posiciones` + `totalUsuarios` + `cerradoEn`.
 *   4. Crea PremioMensual para top 10.
 *   5. Si no hay actividad y `dummy:true`, crea un PremioMensual dummy
 *      (monto 0, estado CANCELADO, notas explicando).
 *
 * @param input.dummy si true y no hay actividad, crea un row dummy con
 *   userId del admin que lo dispara — solo para inspección manual.
 */
export async function cerrarLeaderboard(input: {
  mes: string;
  /** userId del admin que dispara — sólo se usa si `dummy:true`. */
  adminUserId?: string;
  /** Si true y no hay actividad real, crea un PremioMensual dummy
   *  (montoSoles=0, estado CANCELADO) anclado al admin para que la página
   *  /admin/premios-mensuales tenga al menos un row. */
  dummy?: boolean;
}): Promise<CerrarLeaderboardResult> {
  const filas = await agregarPuntosDelMes(input.mes);
  const top100 = filas.slice(0, 100);

  // Upsert con check de idempotencia dentro de transacción para que dos
  // crons concurrentes no dupliquen premios.
  const result = await prisma.$transaction(async (tx) => {
    const existente = await tx.leaderboard.findUnique({
      where: { mes: input.mes },
    });

    if (existente?.cerradoEn) {
      logger.info(
        { mes: input.mes, leaderboardId: existente.id },
        "cerrarLeaderboard: ya cerrado — skip",
      );
      return {
        leaderboard: existente,
        premiosCreados: [] as Array<
          PremioMensual & {
            usuario: { email: string; nombre: string; username: string };
          }
        >,
        alreadyClosed: true,
        dummyCreado: false,
      };
    }

    const ahora = new Date();
    // Cast: `LeaderboardRow` tiene sólo primitivos JSON-safe pero TS no
    // lo infiere como `InputJsonValue` por el index signature missing.
    // El contenido es estrictamente { posicion, userId, username, puntos }
    // — todos JSON-safe.
    const posiciones = top100 as unknown as Prisma.InputJsonValue;

    const lb = existente
      ? await tx.leaderboard.update({
          where: { id: existente.id },
          data: {
            posiciones,
            totalUsuarios: filas.length,
            cerradoEn: ahora,
          },
        })
      : await tx.leaderboard.create({
          data: {
            mes: input.mes,
            posiciones,
            totalUsuarios: filas.length,
            cerradoEn: ahora,
          },
        });

    // Premios: top 10 según tabla. Si hay <10 usuarios, sólo se crean los
    // que existan. Mantenemos `estado=PENDIENTE` para que el admin
    // coordine pago vía email.
    const top10 = top100.slice(0, 10);
    const premiosCreados: Array<
      PremioMensual & {
        usuario: { email: string; nombre: string; username: string };
      }
    > = [];

    for (const fila of top10) {
      const monto = premioParaPosicion(fila.posicion);
      if (monto === 0) continue; // safety, no debería ocurrir con tabla fija
      const premio = await tx.premioMensual.create({
        data: {
          leaderboardId: lb.id,
          posicion: fila.posicion,
          userId: fila.userId,
          montoSoles: monto,
          estado: "PENDIENTE",
        },
        include: {
          usuario: {
            select: { email: true, nombre: true, username: true },
          },
        },
      });
      premiosCreados.push(premio);
    }

    let dummyCreado = false;
    if (premiosCreados.length === 0 && input.dummy && input.adminUserId) {
      const adminPremio = await tx.premioMensual.create({
        data: {
          leaderboardId: lb.id,
          posicion: 0,
          userId: input.adminUserId,
          montoSoles: 0,
          estado: "CANCELADO",
          notas:
            "DUMMY de inspección — leaderboard cerrado sin actividad real. Creado por endpoint admin para verificar pipeline.",
        },
        include: {
          usuario: {
            select: { email: true, nombre: true, username: true },
          },
        },
      });
      premiosCreados.push(adminPremio);
      dummyCreado = true;
    }

    return {
      leaderboard: lb,
      premiosCreados,
      alreadyClosed: false,
      dummyCreado,
    };
  });

  logger.info(
    {
      mes: input.mes,
      totalUsuarios: filas.length,
      premiosCreados: result.premiosCreados.length,
      dummyCreado: result.dummyCreado,
      alreadyClosed: result.alreadyClosed,
    },
    "leaderboard mensual: cerrarLeaderboard",
  );

  const nombreMes = formatNombreMes(input.mes);
  const nombreMesSiguiente = formatNombreMes(mesSiguienteKey(input.mes));
  const enviables: PremioMensualEnviable[] = result.premiosCreados.map((p) => ({
    premioId: p.id,
    userId: p.userId,
    email: p.usuario.email,
    nombre: p.usuario.nombre,
    username: p.usuario.username,
    posicion: p.posicion,
    montoSoles: p.montoSoles,
    mesKey: input.mes,
    nombreMes,
    nombreMesSiguiente,
    premioPrimerPuestoSoles: PREMIO_PRIMER_PUESTO,
  }));

  return {
    leaderboardId: result.leaderboard.id,
    mes: input.mes,
    totalUsuarios: filas.length,
    premiosCreados: enviables,
    alreadyClosed: result.alreadyClosed,
    dummyCreado: result.dummyCreado,
  };
}

// ---------------------------------------------------------------------------
// Premios — gestión admin
// ---------------------------------------------------------------------------

export const ESTADOS_VALIDOS_TUPLE = [
  "PENDIENTE",
  "COORDINADO",
  "PAGADO",
  "CANCELADO",
] as const;

export type EstadoPremio = (typeof ESTADOS_VALIDOS_TUPLE)[number];

export function esEstadoValido(s: string): s is EstadoPremio {
  return (ESTADOS_VALIDOS_TUPLE as readonly string[]).includes(s);
}

export interface PremioListadoFila {
  id: string;
  leaderboardId: string;
  mes: string;
  nombreMes: string;
  posicion: number;
  userId: string;
  username: string;
  email: string;
  nombre: string;
  montoSoles: number;
  estado: EstadoPremio;
  datosPago: unknown;
  pagadoEn: Date | null;
  notas: string | null;
  creadoEn: Date;
}

export async function listarPremios(input: {
  estado?: EstadoPremio;
  mes?: string;
  limit?: number;
} = {}): Promise<PremioListadoFila[]> {
  const limit = Math.min(500, Math.max(1, input.limit ?? 200));
  const where: Prisma.PremioMensualWhereInput = {};
  if (input.estado) where.estado = input.estado;
  if (input.mes) where.leaderboard = { mes: input.mes };

  const rows = await prisma.premioMensual.findMany({
    where,
    include: {
      leaderboard: { select: { mes: true } },
      usuario: { select: { username: true, email: true, nombre: true } },
    },
    orderBy: [
      { leaderboard: { mes: "desc" } },
      { posicion: "asc" },
    ],
    take: limit,
  });

  return rows.map((p) => ({
    id: p.id,
    leaderboardId: p.leaderboardId,
    mes: p.leaderboard.mes,
    nombreMes: formatNombreMes(p.leaderboard.mes),
    posicion: p.posicion,
    userId: p.userId,
    username: p.usuario.username,
    email: p.usuario.email,
    nombre: p.usuario.nombre,
    montoSoles: p.montoSoles,
    estado: (esEstadoValido(p.estado) ? p.estado : "PENDIENTE") as EstadoPremio,
    datosPago: p.datosPago,
    pagadoEn: p.pagadoEn,
    notas: p.notas,
    creadoEn: p.creadoEn,
  }));
}

export interface ActualizarPremioInput {
  estado?: EstadoPremio;
  datosPago?: Record<string, unknown> | null;
  notas?: string | null;
}

export async function actualizarPremio(
  premioId: string,
  patch: ActualizarPremioInput,
): Promise<PremioMensual> {
  const data: Prisma.PremioMensualUpdateInput = {};
  if (patch.estado !== undefined) {
    data.estado = patch.estado;
    if (patch.estado === "PAGADO") data.pagadoEn = new Date();
    if (patch.estado === "PENDIENTE") data.pagadoEn = null;
  }
  if (patch.datosPago !== undefined) {
    data.datosPago =
      patch.datosPago === null
        ? Prisma.JsonNull
        : (patch.datosPago as Prisma.InputJsonValue);
  }
  if (patch.notas !== undefined) data.notas = patch.notas;

  return prisma.premioMensual.update({ where: { id: premioId }, data });
}

// ---------------------------------------------------------------------------
// /mis-combinadas — stats mensuales del usuario
// ---------------------------------------------------------------------------

export interface MisStatsMensuales {
  mes: string;
  nombreMes: string;
  posicionDelMes: number | null; // null si el usuario no participó
  totalUsuariosMes: number;
  mejorMes: { mes: string; nombreMes: string; posicion: number } | null;
}

/**
 * Stats mensuales para /mis-combinadas:
 *   - Posición en el leaderboard del mes en curso.
 *   - Mejor posición histórica entre los meses CERRADOS.
 */
export async function obtenerMisStatsMensuales(
  usuarioId: string,
): Promise<MisStatsMensuales> {
  const mes = mesActualKey();
  const nombreMes = formatNombreMes(mes);

  const filas = await agregarPuntosDelMes(mes);
  const posIdx = filas.findIndex((f) => f.userId === usuarioId);
  const posicionDelMes = posIdx >= 0 ? filas[posIdx]!.posicion : null;

  // Mejor mes histórico (sólo cerrados; el JSONB ya está rankeado).
  const cerrados = await prisma.leaderboard.findMany({
    where: { cerradoEn: { not: null } },
    select: { mes: true, posiciones: true },
  });
  let mejorMes: MisStatsMensuales["mejorMes"] = null;
  for (const lb of cerrados) {
    const arr = parsePosiciones(lb.posiciones);
    const fila = arr.find((f) => f.userId === usuarioId);
    if (!fila) continue;
    if (mejorMes === null || fila.posicion < mejorMes.posicion) {
      mejorMes = {
        mes: lb.mes,
        nombreMes: formatNombreMes(lb.mes),
        posicion: fila.posicion,
      };
    }
  }

  return {
    mes,
    nombreMes,
    posicionDelMes,
    totalUsuariosMes: filas.length,
    mejorMes,
  };
}

/**
 * Tickets del mes en curso de un usuario (torneos FINALIZADOS, con puntos
 * congelados). Para el tab "Mes en curso" de /mis-combinadas.
 */
export async function listarMisTicketsDelMesActual(usuarioId: string) {
  const mes = mesActualKey();
  const { desde, hasta } = getMonthBounds(mes);
  return prisma.ticket.findMany({
    where: {
      usuarioId,
      puntosFinales: { not: null },
      torneo: {
        estado: "FINALIZADO",
        partido: { fechaInicio: { gte: desde, lt: hasta } },
      },
    },
    include: {
      torneo: { include: { partido: true } },
    },
    orderBy: { puntosFinales: "desc" },
  });
}

// ---------------------------------------------------------------------------
// Helpers privados
// ---------------------------------------------------------------------------

function mesActualKey(): string {
  return getMesKey();
}

function mesSiguienteKey(mes: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m) return mes;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const nextYear = mo === 12 ? y + 1 : y;
  const nextMonth = mo === 12 ? 1 : mo + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

/**
 * Agrega `puntosFinales` por usuario para el mes dado. Filtra por:
 *   - puntosFinales no null (ticket de torneo ya finalizado),
 *   - torneo.estado FINALIZADO,
 *   - partido.fechaInicio dentro del mes en tz Lima.
 *
 * Devuelve un array YA RANKEADO (competition ranking — empates comparten
 * posición; el siguiente grupo salta tantas posiciones como tickets había
 * en el grupo previo).
 */
async function agregarPuntosDelMes(mes: string): Promise<LeaderboardRow[]> {
  const { desde, hasta } = getMonthBounds(mes);

  const tickets = await prisma.ticket.findMany({
    where: {
      puntosFinales: { not: null },
      torneo: {
        estado: "FINALIZADO",
        partido: { fechaInicio: { gte: desde, lt: hasta } },
      },
    },
    select: {
      usuarioId: true,
      puntosFinales: true,
      usuario: { select: { username: true, deletedAt: true } },
    },
  });

  // Sumar puntos por usuario (excluir usuarios soft-deleted del top
  // visible, pero sus tickets siguen contando para totalUsuarios — no, en
  // realidad, si el usuario fue anonimizado, su puntaje no debería figurar
  // en un ranking público. Lo excluimos enteramente).
  const sumas = new Map<
    string,
    { userId: string; username: string; puntos: number }
  >();
  for (const t of tickets) {
    if (t.usuario.deletedAt) continue;
    const prev = sumas.get(t.usuarioId);
    const puntos = t.puntosFinales ?? 0;
    if (prev) {
      prev.puntos += puntos;
    } else {
      sumas.set(t.usuarioId, {
        userId: t.usuarioId,
        username: t.usuario.username,
        puntos,
      });
    }
  }

  const ordenados = [...sumas.values()].sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    // Empate: orden alfabético por username (estable y determinístico).
    return a.username.localeCompare(b.username, "es");
  });

  // Competition ranking (igual que ranking.service.finalizarTorneo).
  const filas: LeaderboardRow[] = [];
  let posActual = 0;
  let puntosPrevio = Number.NaN;
  ordenados.forEach((u, idx) => {
    if (u.puntos !== puntosPrevio) {
      posActual = idx + 1;
      puntosPrevio = u.puntos;
    }
    filas.push({
      posicion: posActual,
      userId: u.userId,
      username: u.username,
      puntos: u.puntos,
    });
  });

  return filas;
}

function armarVistaActual(
  mes: string,
  filas: LeaderboardRow[],
  usuarioId: string | null,
): LeaderboardActual {
  const top100 = filas.slice(0, 100);
  const miFila = usuarioId
    ? filas.find((f) => f.userId === usuarioId) ?? null
    : null;
  return {
    mes,
    nombreMes: formatNombreMes(mes),
    totalUsuarios: filas.length,
    filas: top100,
    miFila,
    cerrado: false,
    cerradoEn: null,
  };
}

function parsePosiciones(json: Leaderboard["posiciones"]): LeaderboardRow[] {
  if (!Array.isArray(json)) return [];
  const filas: LeaderboardRow[] = [];
  for (const item of json) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const posicion = typeof o.posicion === "number" ? o.posicion : null;
    const userId = typeof o.userId === "string" ? o.userId : null;
    const username = typeof o.username === "string" ? o.username : null;
    const puntos = typeof o.puntos === "number" ? o.puntos : null;
    if (
      posicion === null ||
      userId === null ||
      username === null ||
      puntos === null
    ) {
      continue;
    }
    filas.push({ posicion, userId, username, puntos });
  }
  return filas;
}

