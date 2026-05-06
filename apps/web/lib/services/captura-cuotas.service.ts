// Servicio orquestador del motor de captura de cuotas (Lote V).
//
// API pública mínima usada por:
//   - Endpoints admin (PATCH /admin/partidos/[id]/filtros, sesion/iniciar)
//     → iniciar/detener
//   - Cron diario (instrumentation.ts Job V) → encolarRefresh
//   - Recovery al boot (instrumentation.ts) → encolarRefresh para huérfanos
//
// El orquestador:
//   1. Detecta liga canónica del partido + valida que cada casa tenga URL
//      de listing configurada en `urls-listing.ts`.
//   2. Encola un job en BullMQ por cada casa con URL configurada (1-5
//      jobs por partido, una entrada por casa).
//   3. Registra estado del partido (INICIANDO al iniciar, DETENIDA al
//      detener).
//
// Los jobs encolados quedan en `waiting` hasta que el agente local del
// admin los consuma vía `GET /agente/jobs/proximos?token=X` (V.13+).

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
import { detectarLigaCanonica } from "./scrapers/ligas-id-map";
import { obtenerUrlListado } from "./scrapers/urls-listing";

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
 * Inicia la captura para un partido. Llamado desde el endpoint
 * `/agente/sesion/iniciar` (botón "↻ Actualizar cuotas") y desde el
 * handler que activa Filtro 1.
 *
 *   1. Marca `partido.estadoCaptura = INICIANDO`.
 *   2. Detecta liga canónica desde `partido.liga`.
 *   3. Por cada casa que tenga URL de listing configurada para esa liga,
 *      encola un job. Casas sin URL skipean silenciosamente.
 *
 * Los jobs quedan en `waiting` en BullMQ hasta que el agente local los
 * consuma. El agente abre Chrome real con el perfil persistido del admin
 * y ejecuta el scraper Playwright que navega el sportsbook + captura
 * cuotas + reporta vía `POST /agente/jobs/resultado`.
 */
export async function iniciarCaptura(
  partidoId: string,
): Promise<ResumenIniciarCaptura> {
  try {
    await prisma.partido.update({
      where: { id: partidoId },
      data: { estadoCaptura: "INICIANDO" },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err ?? "?");
    logger.warn(
      { partidoId, err: errMsg, source: "captura-cuotas" },
      `iniciarCaptura: update estadoCaptura falló — ${errMsg} (continuando)`,
    );
  }

  // Leer datos del partido para conocer su liga canónica.
  const partido = await prisma.partido.findUnique({
    where: { id: partidoId },
    select: { liga: true },
  });
  if (!partido) {
    logger.error(
      { partidoId, source: "captura-cuotas" },
      `iniciarCaptura: partido ${partidoId} no existe`,
    );
    return { partidoId, casasEncoladas: [], casasSinEventId: [] };
  }

  const casasEncoladas: CasaCuotas[] = [];
  const casasSinEventId: CasaCuotas[] = [];
  const casasFallidas: { casa: CasaCuotas; error: string }[] = [];
  const casasSinLigaMapeada: CasaCuotas[] = [];

  // Lote V.12: detectar liga canónica una vez. Cada casa decide si
  // tiene URL listing configurada para esa liga.
  const ligaCanonica = detectarLigaCanonica(partido.liga);
  if (!ligaCanonica) {
    logger.info(
      { partidoId, liga: partido.liga, source: "captura-cuotas" },
      `iniciarCaptura: liga "${partido.liga}" sin liga canónica detectada — skip`,
    );
    return { partidoId, casasEncoladas: [], casasSinEventId: [] };
  }

  for (const casa of CUOTAS_CONFIG.CASAS) {
    if (!obtenerUrlListado(ligaCanonica, casa)) {
      casasSinLigaMapeada.push(casa);
      continue;
    }
    const data: CuotasJobData = {
      partidoId,
      casa,
      ligaCanonica,
      esRefresh: false,
    };
    try {
      const jobId = await encolarJobCaptura(data);
      if (jobId) {
        casasEncoladas.push(casa);
      } else {
        casasSinEventId.push(casa);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err ?? "?");
      casasFallidas.push({ casa, error: errMsg });
      logger.warn(
        { partidoId, casa, err: errMsg, source: "captura-cuotas" },
        `iniciarCaptura: encolar ${casa} falló — ${errMsg}`,
      );
    }
  }

  logger.info(
    {
      partidoId,
      liga: partido.liga,
      encoladas: casasEncoladas.length,
      sinCola: casasSinEventId.length,
      fallidas: casasFallidas.length,
      sinLigaMapeada: casasSinLigaMapeada,
      casasFallidas: casasFallidas.map((f) => `${f.casa}:${f.error.slice(0, 80)}`),
      source: "captura-cuotas",
    },
    `iniciarCaptura · ${casasEncoladas.length}/${CUOTAS_CONFIG.CASAS.length} encoladas, ${casasFallidas.length} fallaron, ${casasSinLigaMapeada.length} sin liga mapeada (${casasSinLigaMapeada.join(",")})`,
  );

  // Lote V.10.8: verificación empírica post-encolar. Lee `getJobCounts`
  // INMEDIATAMENTE para confirmar que los jobs realmente están en Redis y
  // visibles desde este contexto. Si counts.waiting < casasEncoladas,
  // hay un problema de module-isolation o el Redis del handler no es el
  // mismo que el del worker.
  if (casasEncoladas.length > 0) {
    try {
      const queue = getCuotasQueue();
      if (queue) {
        const counts = await queue.getJobCounts(
          "waiting",
          "active",
          "delayed",
          "failed",
          "completed",
        );
        logger.info(
          {
            partidoId,
            encoladas: casasEncoladas.length,
            counts,
            source: "captura-cuotas:verificar",
          },
          `iniciarCaptura post-encolar · counts: waiting=${counts.waiting ?? 0} active=${counts.active ?? 0} delayed=${counts.delayed ?? 0} failed=${counts.failed ?? 0} completed=${counts.completed ?? 0}`,
        );
      }
    } catch (err) {
      logger.warn(
        {
          partidoId,
          err: (err as Error)?.message,
          source: "captura-cuotas:verificar",
        },
        `iniciarCaptura: verificación post-encolar falló — ${(err as Error)?.message ?? "?"}`,
      );
    }
  }

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
  // Mismo flow que iniciarCaptura + guard "skip si OK reciente" para
  // evitar duplicación tras boots cercanos al cron.
  const partido = await prisma.partido.findUnique({
    where: { id: partidoId },
    select: { liga: true },
  });
  if (!partido) {
    logger.warn(
      { partidoId, source: "captura-cuotas:refresh" },
      `encolarRefresh: partido ${partidoId} no existe`,
    );
    return { partidoId, casasEncoladas: 0, casasSkipeadas: 0, casasSinEventId: 0 };
  }

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

  const ligaCanonica = detectarLigaCanonica(partido.liga);

  for (const casa of CUOTAS_CONFIG.CASAS) {
    const ultimoOk = exitoPorCasa.get(casa);
    if (ultimoOk) {
      const horasDesdeOk = (ahora - ultimoOk.getTime()) / (60 * 60 * 1000);
      if (horasDesdeOk < horasSkip) {
        casasSkipeadas++;
        continue;
      }
    }

    if (!ligaCanonica || !obtenerUrlListado(ligaCanonica, casa)) {
      casasSinEventId++;
      continue;
    }
    const data: CuotasJobData = {
      partidoId,
      casa,
      ligaCanonica,
      esRefresh: true,
    };
    const jobId = await encolarJobCaptura(data);
    if (jobId) {
      casasEncoladas++;
    } else {
      casasSinEventId++;
    }
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
