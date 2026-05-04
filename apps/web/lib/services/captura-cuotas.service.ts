// Servicio orquestador del motor de captura de cuotas (Lote V).
//
// API pública mínima usada por:
//   - Endpoints admin (PATCH /admin/partidos/[id]/filtros, etc.) → iniciar/detener
//   - Cron diario (instrumentation.ts Job V) → encolarRefresh
//   - Recovery al boot (instrumentation.ts) → encolarRefresh para huérfanos
//
// El orquestador:
//   1. Resuelve event IDs por casa (lee `EventIdExterno` ya guardados; el
//      discovery automático llega en V.5 con cada scraper exponiendo
//      `buscarEventIdExterno`).
//   2. Encola N jobs en BullMQ (uno por casa con event ID resuelto).
//   3. Registra estado del partido (INICIANDO al iniciar, DETENIDA al detener).
//
// V.1 deja la implementación funcional pero sin scrapers; las llamadas
// devuelven "casa pendiente de discovery" para todas hasta que V.5 active
// el discovery automático. La estructura del flujo es la final — los
// lotes posteriores sólo conectan piezas, no rediseñan.

import { prisma } from "@habla/db";
import { logger } from "./logger";
import { CUOTAS_CONFIG } from "../config/cuotas";
import {
  encolarJobCaptura,
  cancelarJobsDePartido,
  getCuotasQueue,
} from "./cuotas-cola";
import {
  iniciarCuotasWorker,
  detenerCuotasWorker,
} from "./cuotas-worker";
import type { CasaCuotas, CuotasJobData } from "./scrapers/types";

export interface ResumenIniciarCaptura {
  partidoId: string;
  casasEncoladas: CasaCuotas[];
  casasSinEventId: CasaCuotas[];
}

export interface ResumenRefresh {
  partidoId: string;
  casasEncoladas: number;
  casasSkipeadas: number;
  casasSinEventId: number;
}

/**
 * Inicia la captura para un partido. Llamado desde el handler que activa
 * Filtro 1 (sección 4.1 del plan).
 *
 * Flujo:
 *   1. Marca `partido.estadoCaptura = INICIANDO`.
 *   2. Lee `event_ids_externos` para el partido. Cualquier casa sin ID
 *      cae al fallback manual (la vista admin del Lote V.5 mostrará el
 *      botón "Vincular manualmente").
 *   3. Encola un job por cada casa con ID resuelto.
 *
 * Retorna el resumen para que el endpoint admin lo muestre al curador.
 */
export async function iniciarCaptura(
  partidoId: string,
): Promise<ResumenIniciarCaptura> {
  await prisma.partido.update({
    where: { id: partidoId },
    data: { estadoCaptura: "INICIANDO" },
  });

  const eventIds = await prisma.eventIdExterno.findMany({
    where: { partidoId },
    select: { casa: true, eventIdExterno: true },
  });

  const idsPorCasa = new Map<string, string>(
    eventIds.map((row) => [row.casa, row.eventIdExterno]),
  );

  const casasEncoladas: CasaCuotas[] = [];
  const casasSinEventId: CasaCuotas[] = [];

  for (const casa of CUOTAS_CONFIG.CASAS) {
    const eventId = idsPorCasa.get(casa);
    if (!eventId) {
      casasSinEventId.push(casa);
      continue;
    }
    const data: CuotasJobData = {
      partidoId,
      casa,
      eventIdExterno: eventId,
      esRefresh: false,
    };
    const jobId = await encolarJobCaptura(data);
    if (jobId) {
      casasEncoladas.push(casa);
    } else {
      // Cola no disponible (sin REDIS_URL). Marcamos como sin event id
      // para que la UI lo muestre como pendiente.
      casasSinEventId.push(casa);
    }
  }

  logger.info(
    {
      partidoId,
      encoladas: casasEncoladas.length,
      sinEventId: casasSinEventId.length,
      source: "captura-cuotas",
    },
    "iniciarCaptura",
  );

  return { partidoId, casasEncoladas, casasSinEventId };
}

/**
 * Detiene la captura para un partido. Cancela jobs en cola y marca el
 * estado. NO borra `cuotas_casa` (sección 4.2 del plan: "Conserva los
 * registros, no se borran"). Llamado desde el handler que desactiva
 * Filtro 1.
 */
export async function detenerCaptura(
  partidoId: string,
): Promise<{ jobsCancelados: number }> {
  const jobsCancelados = await cancelarJobsDePartido(partidoId);

  await prisma.partido.update({
    where: { id: partidoId },
    data: { estadoCaptura: "DETENIDA" },
  });

  logger.info(
    { partidoId, jobsCancelados, source: "captura-cuotas" },
    "detenerCaptura",
  );
  return { jobsCancelados };
}

/**
 * Encola un refresh para todas las casas con event ID resuelto. Aplica
 * el guard "skip si OK reciente" (sección 4.3 del plan): si una casa
 * devolvió OK hace menos que `SKIP_SI_OK_MENOS_DE_HORAS`, se skipea
 * silencioso para evitar duplicación tras boots cercanos.
 */
export async function encolarRefresh(
  partidoId: string,
): Promise<ResumenRefresh> {
  const eventIds = await prisma.eventIdExterno.findMany({
    where: { partidoId },
    select: { casa: true, eventIdExterno: true },
  });
  const filasActuales = await prisma.cuotasCasa.findMany({
    where: { partidoId },
    select: { casa: true, ultimoExito: true, estado: true },
  });
  const exitoPorCasa = new Map<string, Date | null>(
    filasActuales.map((f) => [f.casa, f.ultimoExito]),
  );
  const horasSkip = CUOTAS_CONFIG.SKIP_SI_OK_MENOS_DE_HORAS;
  const ahora = Date.now();

  let casasEncoladas = 0;
  let casasSkipeadas = 0;
  let casasSinEventId = 0;

  for (const { casa, eventIdExterno } of eventIds) {
    const ultimoOk = exitoPorCasa.get(casa);
    if (ultimoOk) {
      const horasDesdeOk = (ahora - ultimoOk.getTime()) / (60 * 60 * 1000);
      if (horasDesdeOk < horasSkip) {
        casasSkipeadas++;
        continue;
      }
    }

    const data: CuotasJobData = {
      partidoId,
      casa: casa as CasaCuotas,
      eventIdExterno,
      esRefresh: true,
    };
    const jobId = await encolarJobCaptura(data);
    if (jobId) {
      casasEncoladas++;
    } else {
      casasSinEventId++;
    }
  }

  // Casas listadas en CUOTAS_CONFIG.CASAS pero sin event ID en BD.
  const casasConId = new Set(eventIds.map((r) => r.casa));
  for (const casa of CUOTAS_CONFIG.CASAS) {
    if (!casasConId.has(casa)) casasSinEventId++;
  }

  logger.debug(
    {
      partidoId,
      casasEncoladas,
      casasSkipeadas,
      casasSinEventId,
      source: "captura-cuotas:refresh",
    },
    "encolarRefresh",
  );

  return { partidoId, casasEncoladas, casasSkipeadas, casasSinEventId };
}

/**
 * Refresh global del cron diario. Recorre todos los partidos con
 * `mostrarAlPublico=true` (Filtro 1), `estado=PROGRAMADO` y
 * `fechaInicio>now`, y encola refresh para cada uno.
 */
export async function refrescarCuotasDelDia(): Promise<{
  partidosProcesados: number;
  jobsTotales: number;
  errores: number;
}> {
  const partidos = await prisma.partido.findMany({
    where: {
      mostrarAlPublico: true,
      estado: "PROGRAMADO",
      fechaInicio: { gte: new Date() },
    },
    select: { id: true },
  });

  let jobsTotales = 0;
  let errores = 0;
  for (const p of partidos) {
    try {
      const r = await encolarRefresh(p.id);
      jobsTotales += r.casasEncoladas;
    } catch (err) {
      errores++;
      logger.warn(
        { partidoId: p.id, err: (err as Error).message, source: "captura-cuotas:cron" },
        "refrescarCuotasDelDia — partido falló",
      );
    }
  }

  return { partidosProcesados: partidos.length, jobsTotales, errores };
}

/**
 * Recovery al boot (sección 7.4 del plan). Para cada partido con Filtro 1
 * activo cuya última captura sea > 25h, encola refresh. Cubre el caso de
 * un container que estuvo down más que el período del cron.
 */
export async function recuperarJobsHuerfanos(): Promise<{
  partidosRecuperados: number;
}> {
  const corteMs = 25 * 60 * 60 * 1000; // 25h
  const corte = new Date(Date.now() - corteMs);

  const partidos = await prisma.partido.findMany({
    where: {
      mostrarAlPublico: true,
      estado: "PROGRAMADO",
      fechaInicio: { gte: new Date() },
      OR: [
        { ultimaCapturaEn: null },
        { ultimaCapturaEn: { lt: corte } },
      ],
    },
    select: { id: true },
  });

  for (const p of partidos) {
    try {
      await encolarRefresh(p.id);
    } catch (err) {
      logger.warn(
        { partidoId: p.id, err: (err as Error).message, source: "captura-cuotas:recovery" },
        "recuperarJobsHuerfanos — partido falló",
      );
    }
  }

  return { partidosRecuperados: partidos.length };
}

/**
 * Inicializa el motor: arranca el worker BullMQ. Llamado desde
 * `instrumentation.ts` al boot.
 */
export function iniciar(): void {
  iniciarCuotasWorker();
}

/**
 * Tira abajo el motor: cierra el worker. Sólo en tests/shutdown.
 */
export async function detener(): Promise<void> {
  await detenerCuotasWorker();
  // Forzar cierre de la cola también — comparten conexión Redis.
  const queue = getCuotasQueue();
  if (queue) {
    try {
      await queue.close();
    } catch {
      // ignore
    }
  }
}
