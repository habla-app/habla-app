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
import type { CasaCuotas, CuotasJobData, Scraper } from "./scrapers/types";
import { CapturaSinDatosError } from "./scrapers/types";

interface BullMQWorkerLike {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  close(): Promise<void>;
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

let workerInstance: BullMQWorkerLike | null | undefined;

/**
 * Procesa un job: invoca el scraper de la casa, persiste resultado,
 * actualiza salud, recalcula estado del partido. Se exporta para que
 * tests puedan llamarlo directamente sin pasar por BullMQ.
 */
export async function procesarJobCaptura(job: BullMQJobLike): Promise<void> {
  const { partidoId, casa, eventIdExterno } = job.data;

  const scraper = scraperRegistry[casa];
  if (!scraper) {
    // V.1: ningún scraper implementado todavía. No es una falla externa,
    // sólo "todavía no hay código que cubra esta casa". Marcamos error
    // pero no penalizamos salud (el scraper como tal no falló).
    await persistirError({
      partidoId,
      casa,
      eventIdExterno,
      errorMensaje: "scraper no implementado (V.1)",
    });
    await recalcularEstadoCapturaPartido(partidoId);
    logger.debug(
      { partidoId, casa, source: "cuotas-worker" },
      "scraper no registrado, job marcado ERROR sin penalizar salud",
    );
    return;
  }

  try {
    const resultado = await scraper.capturarCuotas(eventIdExterno);
    const { alertasCreadas } = await persistirCuotas({
      partidoId,
      casa,
      eventIdExterno,
      resultado,
    });
    await actualizarSaludScraper(casa, "OK");
    await recalcularEstadoCapturaPartido(partidoId);
    logger.info(
      {
        partidoId,
        casa,
        alertasCreadas,
        source: "cuotas-worker",
      },
      "captura OK",
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
        eventIdExterno,
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
      eventIdExterno,
      errorMensaje: mensaje,
    });
    await actualizarSaludScraper(casa, "ERROR", mensaje);
    await recalcularEstadoCapturaPartido(partidoId);
    logger.warn(
      { partidoId, casa, err: mensaje, source: "cuotas-worker" },
      "captura falló",
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
  if (workerInstance !== undefined) return workerInstance;

  if (typeof process === "undefined" || !process.versions?.node) {
    workerInstance = null;
    return null;
  }

  const connection = getCuotasRedisConnection();
  if (!connection) {
    logger.warn(
      "cuotas-worker — Redis no disponible, worker no se inicia",
    );
    workerInstance = null;
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
          source: "cuotas-worker",
        },
        "BullMQ — job failed",
      );
    });

    worker.on("error", (...args: unknown[]) => {
      const err = args[0] as Error | undefined;
      logger.error(
        { err: err?.message, source: "cuotas-worker" },
        "BullMQ — worker error",
      );
    });

    workerInstance = worker;
    logger.info(
      {
        cola: CUOTAS_CONFIG.NOMBRE_COLA,
        concurrencia: CUOTAS_CONFIG.CONCURRENCIA_BULLMQ,
        rateLimitMs: CUOTAS_CONFIG.RATE_LIMIT_POR_WORKER_MS,
      },
      "cuotas-worker iniciado",
    );

    return worker;
  } catch (err) {
    logger.error(
      { err: (err as Error).message },
      "cuotas-worker — fallo al iniciar",
    );
    workerInstance = null;
    return null;
  }
}

/**
 * Detiene el worker y libera la conexión. Sólo en tests/shutdown explícito.
 */
export async function detenerCuotasWorker(): Promise<void> {
  if (workerInstance) {
    try {
      await workerInstance.close();
    } catch (err) {
      logger.warn(
        { err: (err as Error).message },
        "cuotas-worker — error al cerrar",
      );
    }
  }
  workerInstance = null;
}
