// Worker BullMQ del motor de captura de cuotas (Lote V — fase V.1).
//
// En V.1 el worker existe pero no hay scrapers registrados, así que cada
// job entra → busca scraper en el dispatcher → no encuentra → marca el
// resultado como ERROR con mensaje "scraper no implementado". La salud
// del scraper no se penaliza en este caso (no fue una falla externa).
//
// Cuando V.2/V.3/V.4 registren scrapers concretos en el `dispatcher`, el
// worker pasa a invocarlos transparentemente — sin tocar este archivo.
//
// Patrón de carga: el Worker SE INICIA cuando alguien llama a
// `iniciarCuotasWorker()` desde `instrumentation.ts`. La instancia es
// singleton; segunda llamada retorna la existente.
//
// Importante: BullMQ Worker es un proceso de larga duración. En producción
// vive el lifetime del container. En tests el caller debe llamar a
// `detenerCuotasWorker()` para no leakear.

import { prisma } from "@habla/db";
import { logger } from "./logger";
import { CUOTAS_CONFIG } from "../config/cuotas";
import { getCuotasRedisConnection, getCuotasQueue } from "./cuotas-cola";
import {
  persistirCuotas,
  persistirError,
  persistirSinDatos,
  actualizarSaludScraper,
  recalcularEstadoCapturaPartido,
} from "./cuotas-persistencia";
import { aprenderAlias } from "./scrapers/alias-equipo";
import type {
  CasaCuotas,
  CuotasJobData,
  ResultadoScraper,
  Scraper,
} from "./scrapers/types";
import { CapturaSinDatosError } from "./scrapers/types";

interface BullMQWorkerLike {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  close(): Promise<void>;
  /** Lote V.10.4: BullMQ expone `isPaused()`. */
  isPaused?(): Promise<boolean>;
  /** Lote V.10.4: BullMQ expone `isRunning()`. */
  isRunning?(): boolean;
}

interface BullMQJobLike {
  id?: string;
  data: CuotasJobData;
  attemptsMade?: number;
}

/**
 * Dispatcher de scrapers — registry de implementaciones por casa. En V.1
 * está vacío. En V.2 se llena con Te Apuesto/Stake/Altenar; V.3 con
 * Coolbet/Inkabet; V.4 con Betano. Los scrapers se registran via
 * `registrarScraper()` en su propio archivo (sin tocar este worker).
 */
const scraperRegistry: Partial<Record<CasaCuotas, Scraper>> = {};

export function registrarScraper(scraper: Scraper): void {
  if (scraperRegistry[scraper.nombre]) {
    logger.warn(
      { casa: scraper.nombre },
      "cuotas-worker — scraper ya registrado, sobrescribiendo (HMR?)",
    );
  }
  scraperRegistry[scraper.nombre] = scraper;
}

export function obtenerScraper(casa: CasaCuotas): Scraper | undefined {
  return scraperRegistry[casa];
}

// Lote V.10.8: cache via globalThis para sobrevivir module isolation
// entre contextos de Next.js. Mismo patrón que `cuotas-cola.ts`.
const globalForWorker = globalThis as unknown as {
  __cuotasWorkerInstance?: BullMQWorkerLike | null | undefined;
  __cuotasHeartbeatTimer?: ReturnType<typeof setInterval> | null;
  __cuotasWorkerModuleId?: string;
};

const WORKER_MODULE_ID = `cuotas-worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
if (!globalForWorker.__cuotasWorkerModuleId) {
  globalForWorker.__cuotasWorkerModuleId = WORKER_MODULE_ID;
}

function getWorkerInstance(): BullMQWorkerLike | null | undefined {
  return globalForWorker.__cuotasWorkerInstance;
}

function setWorkerInstance(v: BullMQWorkerLike | null): void {
  globalForWorker.__cuotasWorkerInstance = v;
}

// Lote V.10.4: heartbeat para diagnosticar worker que no procesa.

function iniciarHeartbeatWorker(): void {
  if (globalForWorker.__cuotasHeartbeatTimer) return;
  globalForWorker.__cuotasHeartbeatTimer = setInterval(() => {
    void (async () => {
      try {
        const queue = getCuotasQueue();
        const worker = getWorkerInstance();
        if (!queue || !worker) {
          logger.warn(
            {
              queueOk: queue !== null,
              workerOk: worker !== null,
              source: "cuotas-worker:heartbeat",
            },
            "heartbeat · queue o worker no disponibles",
          );
          return;
        }
        const counts = await queue
          .getJobCounts("waiting", "active", "delayed", "failed", "completed")
          .catch(() => ({}) as Record<string, number>);
        // Lote V.10.7: BullMQ.isPaused() puede retornar boolean sincrono o
        // Promise<boolean> según versión. Resolvemos uniformemente con
        // Promise.resolve() y atrapamos cualquier error para no romper el
        // heartbeat (la observabilidad nunca debe matar al worker).
        let isPaused: boolean | null = null;
        try {
          if (typeof worker.isPaused === "function") {
            const r = worker.isPaused() as unknown;
            isPaused =
              r && typeof (r as Promise<boolean>).then === "function"
                ? await (r as Promise<boolean>)
                : (r as boolean);
          }
        } catch {
          isPaused = null;
        }
        let isRunning: boolean | null = null;
        try {
          if (typeof worker.isRunning === "function") {
            isRunning = worker.isRunning();
          }
        } catch {
          isRunning = null;
        }
        // Lote V.11: heartbeat sin Playwright (motor API-only). Solo
        // counts BullMQ + isPaused/isRunning + memoria RSS del proceso.
        const memMb =
          typeof process.memoryUsage === "function"
            ? Math.round(process.memoryUsage().rss / (1024 * 1024))
            : null;
        logger.info(
          {
            counts,
            isPaused,
            isRunning,
            rssMb: memMb,
            source: "cuotas-worker:heartbeat",
          },
          `heartbeat · waiting=${counts.waiting ?? 0} active=${counts.active ?? 0} delayed=${counts.delayed ?? 0} failed=${counts.failed ?? 0} completed=${counts.completed ?? 0} · paused=${isPaused} running=${isRunning} · rss=${memMb ?? "?"}MB`,
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err ?? "?");
        const errStack =
          err instanceof Error
            ? (err.stack?.split("\n").slice(0, 3).join(" | ") ?? "")
            : "";
        logger.warn(
          {
            err: errMsg,
            stack: errStack,
            source: "cuotas-worker:heartbeat",
          },
          `heartbeat falló — ${errMsg}`,
        );
      }
    })();
  }, 60_000);
  const t = globalForWorker.__cuotasHeartbeatTimer;
  if (t && typeof (t as { unref?: () => void }).unref === "function") {
    (t as { unref: () => void }).unref();
  }
}

/**
 * Procesa un job: invoca el scraper de la casa, persiste resultado,
 * actualiza salud, recalcula estado del partido. Se exporta para que
 * tests puedan llamarlo directamente sin pasar por BullMQ.
 */
export async function procesarJobCaptura(job: BullMQJobLike): Promise<void> {
  const { partidoId, casa, ligaCanonica } = job.data;

  const scraper = scraperRegistry[casa];
  if (!scraper) {
    await persistirError({
      partidoId,
      casa,
      eventIdExterno: ligaCanonica, // legacy: el campo en BD aún se llama así
      errorMensaje: `scraper "${casa}" no registrado`,
    });
    await recalcularEstadoCapturaPartido(partidoId);
    logger.debug(
      { partidoId, casa, source: "cuotas-worker" },
      "scraper no registrado, job marcado ERROR sin penalizar salud",
    );
    return;
  }

  // Lote V.12: Playwright + XHR intercept. Recibe ligaCanonica.
  const tInicioJob = Date.now();
  logger.info(
    {
      partidoId,
      casa,
      ligaCanonica,
      source: "cuotas-worker",
    },
    `procesando job ${casa} vía Playwright (liga=${ligaCanonica})`,
  );

  try {
    const partidoEntidad = await prisma.partido.findUnique({
      where: { id: partidoId },
    });
    if (!partidoEntidad) {
      throw new Error(`partido ${partidoId} no existe`);
    }
    const r = await scraper.capturarConPlaywright(
      partidoEntidad,
      ligaCanonica,
    );
    if (r === null) {
      // Partido no encontrado en response de la casa para esa liga.
      // No es ERROR técnico — registramos como SIN_DATOS para que el
      // próximo ciclo reintente sin penalizar salud.
      await persistirSinDatos({
        partidoId,
        casa,
        eventIdExterno: ligaCanonica,
        mensaje: "partido no encontrado en response de la casa",
      });
      await recalcularEstadoCapturaPartido(partidoId);
      logger.info(
        { partidoId, casa, ligaCanonica, source: "cuotas-worker:playwright" },
        `${casa}: partido no encontrado tras navegar listing`,
      );
      return;
    }
    const resultado = r;

    const { alertasCreadas } = await persistirCuotas({
      partidoId,
      casa,
      eventIdExterno: resultado.eventIdCasa ?? ligaCanonica,
      resultado,
    });
    await actualizarSaludScraper(casa, "OK");
    await recalcularEstadoCapturaPartido(partidoId);

    // Lote V.7: auto-aprendizaje de aliases. Si el scraper expuso
    // los nombres de los equipos en el payload, comparamos contra el
    // canónico del partido y persistimos el alias cuando difiere. Esto
    // cubre el caso de vinculación MANUAL (admin pega URL → primer job
    // corre acá → alias aprendido) sin tocar el contrato Scraper para
    // las casas que aún no exponen `equipos`.
    if (resultado.equipos) {
      void (async () => {
        try {
          const partido = await prisma.partido.findUnique({
            where: { id: partidoId },
            select: { equipoLocal: true, equipoVisita: true },
          });
          if (partido) {
            await Promise.all([
              aprenderAlias(resultado.equipos!.local, casa, partido.equipoLocal),
              aprenderAlias(resultado.equipos!.visita, casa, partido.equipoVisita),
            ]);
          }
        } catch (err) {
          logger.warn(
            {
              partidoId,
              casa,
              err: (err as Error)?.message,
              source: "cuotas-worker:aprender-alias",
            },
            "auto-aprendizaje post-captura falló (no crítico)",
          );
        }
      })();
    }

    const msTotalJob = Date.now() - tInicioJob;
    logger.info(
      {
        partidoId,
        casa,
        alertasCreadas,
        equiposEnPayload: resultado.equipos !== undefined,
        ms: msTotalJob,
        source: "cuotas-worker",
      },
      `captura OK · ${casa} (${msTotalJob}ms)`,
    );
  } catch (err) {
    const mensaje = (err as Error)?.message ?? "error desconocido";

    // SIN_DATOS: la casa no expone la variante canónica en este momento
    // (ej. Inkabet con la variante regular suspendida). NO es una falla
    // del scraper — no penaliza salud y no triggerea retry de BullMQ.
    // El próximo ciclo del cron 24h reintenta naturalmente.
    if (err instanceof CapturaSinDatosError) {
      await persistirSinDatos({
        partidoId,
        casa,
        eventIdExterno: ligaCanonica,
        mensaje,
      });
      await recalcularEstadoCapturaPartido(partidoId);
      logger.info(
        { partidoId, casa, mensaje, source: "cuotas-worker" },
        "captura sin datos — variante canónica suspendida, próximo ciclo reintenta",
      );
      return;
    }

    await persistirError({
      partidoId,
      casa,
      eventIdExterno: ligaCanonica,
      errorMensaje: mensaje,
    });
    await actualizarSaludScraper(casa, "ERROR", mensaje);
    await recalcularEstadoCapturaPartido(partidoId);
    const msTotalJob = Date.now() - tInicioJob;
    logger.warn(
      {
        partidoId,
        casa,
        err: mensaje,
        ms: msTotalJob,
        source: "cuotas-worker",
      },
      `captura falló · ${casa} (${msTotalJob}ms) — ${mensaje}`,
    );
    // Re-lanzar para que BullMQ aplique la política de reintentos.
    throw err;
  }
}

/**
 * Inicia el worker BullMQ. Idempotente: segunda llamada devuelve la
 * misma instancia. Devuelve null si Redis no está disponible (sin
 * REDIS_URL o en Edge runtime), permitiendo que el caller siga su flujo.
 */
export function iniciarCuotasWorker(): BullMQWorkerLike | null {
  const cached = getWorkerInstance();
  if (cached !== undefined) {
    logger.debug(
      {
        moduleId: WORKER_MODULE_ID,
        cachedFromGlobalThis:
          globalForWorker.__cuotasWorkerModuleId !== WORKER_MODULE_ID,
        source: "cuotas-worker",
      },
      "iniciarCuotasWorker: reusando worker de globalThis",
    );
    return cached as BullMQWorkerLike | null;
  }

  if (typeof process === "undefined" || !process.versions?.node) {
    setWorkerInstance(null);
    return null;
  }

  const connection = getCuotasRedisConnection();
  if (!connection) {
    logger.warn(
      "cuotas-worker — Redis no disponible, worker no se inicia",
    );
    setWorkerInstance(null);
    return null;
  }

  // Forzar inicialización de la queue para que la conexión esté lista.
  getCuotasQueue();

  try {
    const bullmqMod: {
      Worker: new (
        name: string,
        processor: (job: BullMQJobLike) => Promise<void>,
        opts: object,
      ) => BullMQWorkerLike;
    } = require("bullmq");

    const worker = new bullmqMod.Worker(
      CUOTAS_CONFIG.NOMBRE_COLA,
      procesarJobCaptura,
      {
        connection,
        concurrency: CUOTAS_CONFIG.CONCURRENCIA_BULLMQ,
        limiter: {
          max: 1,
          duration: CUOTAS_CONFIG.RATE_LIMIT_POR_WORKER_MS,
        },
      },
    );

    // Lote V.10.4: listeners completos para diagnosticar por qué el
    // worker no procesa jobs en producción. Cada evento se loggea con msg
    // legible para que sea visible en Railway sin drill-down.
    worker.on("active", (...args: unknown[]) => {
      const job = args[0] as { id?: string; data?: CuotasJobData } | undefined;
      logger.info(
        {
          jobId: job?.id,
          partidoId: job?.data?.partidoId,
          casa: job?.data?.casa,
          source: "cuotas-worker:bullmq",
        },
        `BullMQ active · job ${job?.id} (${job?.data?.casa ?? "?"}) tomado por worker`,
      );
    });

    worker.on("completed", (...args: unknown[]) => {
      const job = args[0] as { id?: string; data?: CuotasJobData } | undefined;
      logger.info(
        {
          jobId: job?.id,
          casa: job?.data?.casa,
          source: "cuotas-worker:bullmq",
        },
        `BullMQ completed · job ${job?.id} (${job?.data?.casa ?? "?"})`,
      );
    });

    worker.on("failed", (...args: unknown[]) => {
      const job = args[0] as { id?: string; data?: CuotasJobData; attemptsMade?: number } | undefined;
      const err = args[1] as Error | undefined;
      logger.warn(
        {
          jobId: job?.id,
          partidoId: job?.data?.partidoId,
          casa: job?.data?.casa,
          attempts: job?.attemptsMade,
          err: err?.message,
          source: "cuotas-worker:bullmq",
        },
        `BullMQ failed · job ${job?.id} (${job?.data?.casa ?? "?"}) — ${err?.message ?? "?"}`,
      );
    });

    worker.on("stalled", (...args: unknown[]) => {
      const jobId = args[0] as string | undefined;
      logger.warn(
        { jobId, source: "cuotas-worker:bullmq" },
        `BullMQ stalled · job ${jobId} se atascó (visibility timeout)`,
      );
    });

    worker.on("error", (...args: unknown[]) => {
      const err = args[0] as Error | undefined;
      logger.error(
        {
          err: err?.message,
          stack: err?.stack?.split("\n").slice(0, 5).join(" | "),
          source: "cuotas-worker:bullmq",
        },
        `BullMQ error · ${err?.message ?? "?"}`,
      );
    });

    worker.on("ready", (...args: unknown[]) => {
      void args;
      logger.info(
        { source: "cuotas-worker:bullmq" },
        "BullMQ ready · worker conectado y listo para procesar",
      );
    });

    worker.on("closing", () => {
      logger.warn(
        { source: "cuotas-worker:bullmq" },
        "BullMQ closing · worker está cerrándose",
      );
    });

    worker.on("closed", () => {
      logger.warn(
        { source: "cuotas-worker:bullmq" },
        "BullMQ closed · worker cerrado (NO va a procesar más jobs hasta restart)",
      );
    });

    setWorkerInstance(worker);
    logger.info(
      {
        cola: CUOTAS_CONFIG.NOMBRE_COLA,
        concurrencia: CUOTAS_CONFIG.CONCURRENCIA_BULLMQ,
        rateLimitMs: CUOTAS_CONFIG.RATE_LIMIT_POR_WORKER_MS,
        moduleId: WORKER_MODULE_ID,
        primeraVezEnGlobalThis:
          globalForWorker.__cuotasWorkerModuleId === WORKER_MODULE_ID,
      },
      `cuotas-worker iniciado (moduleId=${WORKER_MODULE_ID})`,
    );

    // Heartbeat cada 60s: confirma que el worker sigue vivo + reporta
    // counts de la cola. Si los logs muestran "iniciado" pero no
    // heartbeats, el event loop está saturado o el proceso murió.
    iniciarHeartbeatWorker();

    return worker;
  } catch (err) {
    logger.error(
      { err: (err as Error).message },
      "cuotas-worker — fallo al iniciar",
    );
    setWorkerInstance(null);
    return null;
  }
}

/**
 * Detiene el worker y libera la conexión. Sólo en tests/shutdown explícito.
 */
export async function detenerCuotasWorker(): Promise<void> {
  if (globalForWorker.__cuotasHeartbeatTimer) {
    clearInterval(globalForWorker.__cuotasHeartbeatTimer);
    globalForWorker.__cuotasHeartbeatTimer = null;
  }
  const worker = getWorkerInstance();
  if (worker) {
    try {
      await worker.close();
    } catch (err) {
      logger.warn(
        { err: (err as Error).message },
        "cuotas-worker — error al cerrar",
      );
    }
  }
  setWorkerInstance(null);
}
