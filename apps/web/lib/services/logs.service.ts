// Servicio de logs persistentes — Lote 6 (May 2026).
//
// Reemplaza a Sentry (eliminado en Lote 1) con una tabla `log_errores` en
// Postgres + dashboard admin. La inserción es fire-and-forget desde el
// hook del logger Pino (ver `logger.ts` — para `level >= error` además de
// stdout, persiste acá). También se llama directo cuando un service quiere
// loggear un warning operativo que no pasó por Pino (raro, pero ej:
// preflight de un cron que decidió no correr).
//
// Niveles permitidos: warn | error | critical.
//   - warn      → cosas raras pero no rompen el flujo (ej: API-Football
//                 devolvió 429, vamos a reintentar).
//   - error     → algo se rompió pero el sistema sigue (ej: notify de
//                 email falló para un usuario, log y seguir).
//   - critical  → algo se rompió y necesita atención humana (ej: backup
//                 falló por 2 días seguidos, FK constraint violado en
//                 prod). El cron M (instrumentation.ts) busca SÓLO este
//                 nivel y manda email a ADMIN_ALERT_EMAIL si hay > 0 en
//                 la última hora.
//
// `source` es texto libre pero seguir convención `<capa>:<modulo>` para
// que los filtros de /admin/logs sirvan: "api:tickets", "cron:cierre-
// leaderboard", "service:backup-r2", "logger" (para los que pasaron por
// Pino sin source explícito).

import { prisma, Prisma } from "@habla/db";

export type LogLevel = "warn" | "error" | "critical";

export interface RegistrarErrorInput {
  level: LogLevel;
  source: string;
  message: string;
  /** Si se pasa, se extrae `.stack`. Acepta `unknown` para no obligar a
   *  los callers a hacer typecheck antes (es lo que vienen pasando con
   *  el patrón `logger.error({ err }, "...")`). */
  error?: unknown;
  metadata?: Record<string, unknown>;
  userId?: string;
}

/**
 * Persiste un error/warning en `log_errores`. Nunca tira — captura
 * cualquier fallo de Postgres con `console.error` y sigue. Diseñado para
 * llamarse desde el hook del logger sin riesgo de romper el request
 * original.
 */
export async function registrarError(input: RegistrarErrorInput): Promise<void> {
  try {
    const stack =
      input.error instanceof Error
        ? input.error.stack ?? null
        : typeof input.error === "object" && input.error !== null && "stack" in input.error
          ? String((input.error as { stack: unknown }).stack)
          : null;

    await prisma.logError.create({
      data: {
        level: input.level,
        source: input.source,
        message: input.message.slice(0, 4000), // hard cap defensivo
        stack: stack ? stack.slice(0, 16000) : null,
        userId: input.userId ?? null,
        metadata: input.metadata
          ? (input.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  } catch (err) {
    // ÚNICO `console.error` permitido en el proyecto: si el logger persistente
    // falla, no podemos usarlo para reportarlo (ciclo). Cae a stderr nativo.
    // CLAUDE.md §14 sigue prohibiendo console.* en el resto del código.
    // eslint-disable-next-line no-console
    console.error("[logs.service] persistencia falló — log perdido:", err);
  }
}

// ---------------------------------------------------------------------------
// Lectura — alimentan /admin/logs
// ---------------------------------------------------------------------------

export interface FiltrosErrores {
  level?: LogLevel;
  source?: string;
  desde?: Date;
  hasta?: Date;
  /** 1-indexed. */
  page?: number;
  pageSize?: number;
}

export interface ErrorRow {
  id: string;
  level: string;
  source: string;
  message: string;
  stack: string | null;
  userId: string | null;
  metadata: unknown;
  creadoEn: Date;
}

export interface ErroresPage {
  rows: ErrorRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function obtenerErroresRecientes(
  filtros: FiltrosErrores = {},
): Promise<ErroresPage> {
  const page = Math.max(1, filtros.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, filtros.pageSize ?? DEFAULT_PAGE_SIZE),
  );

  const where: Prisma.LogErrorWhereInput = {};
  if (filtros.level) where.level = filtros.level;
  if (filtros.source) where.source = { contains: filtros.source, mode: "insensitive" };
  if (filtros.desde || filtros.hasta) {
    where.creadoEn = {};
    if (filtros.desde) where.creadoEn.gte = filtros.desde;
    if (filtros.hasta) where.creadoEn.lte = filtros.hasta;
  }

  const [total, rows] = await Promise.all([
    prisma.logError.count({ where }),
    prisma.logError.findMany({
      where,
      orderBy: { creadoEn: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      level: r.level,
      source: r.source,
      message: r.message,
      stack: r.stack,
      userId: r.userId,
      metadata: r.metadata,
      creadoEn: r.creadoEn,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export interface StatsErrores24h {
  porLevel: Array<{ level: string; count: number }>;
  porSource: Array<{ source: string; count: number }>;
  total: number;
  desde: Date;
  hasta: Date;
}

/**
 * Conteos de las últimas 24h. Alimenta los headers de /admin/logs y
 * potencialmente las tarjetas de "salud" en /admin/dashboard.
 */
export async function obtenerStatsErroresUltimas24h(): Promise<StatsErrores24h> {
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - 24 * 60 * 60 * 1000);

  const [porLevel, porSource, total] = await Promise.all([
    prisma.logError.groupBy({
      by: ["level"],
      where: { creadoEn: { gte: desde, lte: hasta } },
      _count: { _all: true },
    }),
    prisma.logError.groupBy({
      by: ["source"],
      where: { creadoEn: { gte: desde, lte: hasta } },
      _count: { _all: true },
      orderBy: { _count: { source: "desc" } },
      take: 10,
    }),
    prisma.logError.count({ where: { creadoEn: { gte: desde, lte: hasta } } }),
  ]);

  return {
    porLevel: porLevel.map((p) => ({ level: p.level, count: p._count._all })),
    porSource: porSource.map((p) => ({ source: p.source, count: p._count._all })),
    total,
    desde,
    hasta,
  };
}

// ---------------------------------------------------------------------------
// Para cron M — alertas por email cada 1h con anti-spam.
// ---------------------------------------------------------------------------

export interface ResumenCriticosUltimaHora {
  total: number;
  desde: Date;
  hasta: Date;
  /** Top 5 mensajes únicos con count. */
  topMensajes: Array<{ message: string; count: number; source: string }>;
  /** Count por source. */
  porSource: Array<{ source: string; count: number }>;
}

/**
 * Resumen de errores `level=critical` en la última hora. Lo consume el
 * cron M para decidir si dispara el email de alerta. `topMensajes` se
 * agrupa por (message, source) para no spamear con la misma falla
 * repetida.
 */
export async function obtenerResumenCriticosUltimaHora(): Promise<ResumenCriticosUltimaHora> {
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - 60 * 60 * 1000);

  const where = {
    level: "critical",
    creadoEn: { gte: desde, lte: hasta },
  };

  const [total, agrupados, porSource] = await Promise.all([
    prisma.logError.count({ where }),
    prisma.logError.groupBy({
      by: ["message", "source"],
      where,
      _count: { _all: true },
      orderBy: { _count: { message: "desc" } },
      take: 5,
    }),
    prisma.logError.groupBy({
      by: ["source"],
      where,
      _count: { _all: true },
      orderBy: { _count: { source: "desc" } },
    }),
  ]);

  return {
    total,
    desde,
    hasta,
    topMensajes: agrupados.map((g) => ({
      message: g.message,
      source: g.source,
      count: g._count._all,
    })),
    porSource: porSource.map((p) => ({ source: p.source, count: p._count._all })),
  };
}
