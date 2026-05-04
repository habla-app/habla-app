// Cola BullMQ del motor de captura de cuotas (Lote V).
//
// Una sola cola "cuotas-captura" donde se encolan jobs `CuotasJobData`
// (uno por (partido, casa) cuando se activa Filtro 1, uno por (partido, casa)
// por día durante el refresh diario).
//
// Patrón de carga lazy + null-safe similar al de `apps/web/lib/redis.ts`:
//   - Edge runtime → devuelve null. BullMQ depende de net/dns/tls de Node.
//   - Sin REDIS_URL → devuelve null. Aplica a entornos de tests/build.
//   - Con REDIS_URL en Node → carga ioredis con `require()` runtime
//     dinámico (mismo patrón que redis.ts) y construye la `Queue`.
//
// El Worker vive en `cuotas-worker.ts` y comparte la misma conexión Redis;
// la lib BullMQ permite múltiples consumers contra la misma queue.
//
// Las funciones `encolarJobCaptura` y `cancelarJobsDePartido` son los
// únicos puntos de entrada — los callers no tocan la `Queue` directo.

import { logger } from "./logger";
import { CUOTAS_CONFIG } from "../config/cuotas";
import type { CuotasJobData } from "./scrapers/types";

// Tipos ligeros — no importamos `bullmq` en el top-level porque arrastraría
// `ioredis` a webpack incluso para Edge. Las funciones que usan estos
// tipos sólo corren en Node runtime.
interface BullMQQueueLike {
  add(
    name: string,
    data: CuotasJobData,
    opts?: Record<string, unknown>,
  ): Promise<{ id?: string }>;
  getJobs(
    states: string[],
    start?: number,
    end?: number,
  ): Promise<Array<{ id?: string; data: CuotasJobData; remove(): Promise<void> }>>;
  close(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  getJobCounts(...states: string[]): Promise<Record<string, number>>;
}

let queueInstance: BullMQQueueLike | null | undefined;
let connectionInstance: unknown | null | undefined;

/**
 * Construye (lazy) y devuelve la `Queue` BullMQ. Devuelve null cuando no
 * es posible (Edge runtime o sin REDIS_URL). Los callers MUST tolerar
 * null para no romper en build/edge.
 */
export function getCuotasQueue(): BullMQQueueLike | null {
  if (queueInstance !== undefined) return queueInstance;

  const url = process.env.REDIS_URL;
  if (!url) {
    logger.warn(
      "REDIS_URL no configurada — cola cuotas-captura deshabilitada",
    );
    queueInstance = null;
    return null;
  }

  if (typeof process === "undefined" || !process.versions?.node) {
    queueInstance = null;
    return null;
  }

  try {
    // Reuso de patrón de require() dinámico de redis.ts. La diferencia es
    // que BullMQ pide su propia conexión ioredis (no la del singleton de
    // ranking) porque setea `maxRetriesPerRequest: null` y otros flags.
    const ioredisMod: {
      default?: new (url: string, opts: object) => unknown;
      Redis?: new (url: string, opts: object) => unknown;
    } = require("ioredis");
    const RedisClient =
      ioredisMod.default ??
      ioredisMod.Redis ??
      (ioredisMod as unknown as new (url: string, opts: object) => unknown);

    const connection = new RedisClient(url, {
      // Required by BullMQ: blocking commands necesitan reintentos infinitos.
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      // Mismo lookup dual-stack que el resto del repo (Railway IPv6 internal).
      family: 0,
    });
    connectionInstance = connection;

    const bullmqMod: { Queue: new (name: string, opts: object) => BullMQQueueLike } =
      require("bullmq");

    const queue = new bullmqMod.Queue(CUOTAS_CONFIG.NOMBRE_COLA, {
      connection,
      defaultJobOptions: {
        attempts: CUOTAS_CONFIG.REINTENTOS_POR_JOB,
        backoff: {
          type: "exponential",
          delay: CUOTAS_CONFIG.BACKOFF_INICIAL_MS,
        },
        removeOnComplete: CUOTAS_CONFIG.RETENCION_JOBS_OK,
        removeOnFail: CUOTAS_CONFIG.RETENCION_JOBS_FAIL,
      },
    });

    logger.info(
      { cola: CUOTAS_CONFIG.NOMBRE_COLA },
      "BullMQ — cola cuotas-captura inicializada",
    );

    queueInstance = queue;
    return queue;
  } catch (err) {
    logger.error(
      { err: (err as Error).message },
      "BullMQ — fallo al inicializar cola cuotas-captura",
    );
    queueInstance = null;
    return null;
  }
}

/**
 * Conexión Redis subyacente que comparten Queue + Worker. Sólo Node.
 * El worker lee este getter para reusar la misma conexión.
 */
export function getCuotasRedisConnection(): unknown | null {
  if (queueInstance === undefined) {
    // Forzar inicialización si nadie pidió la queue todavía.
    getCuotasQueue();
  }
  return connectionInstance ?? null;
}

/**
 * Encola un job de captura. No-op si la cola no está disponible (sin
 * REDIS_URL). Devuelve el id del job o null.
 */
export async function encolarJobCaptura(
  data: CuotasJobData,
): Promise<string | null> {
  const queue = getCuotasQueue();
  if (!queue) return null;

  // jobId determinístico por (partidoId, casa, esRefresh-or-not). BullMQ
  // garantiza que dos jobs con el mismo `jobId` no coexisten en la cola
  // — el segundo add se vuelve idempotente. El sufijo cambia entre el
  // trigger admin y el cron diario para que ambos no se pisen.
  const jobId = data.esRefresh
    ? `cuotas:${data.partidoId}:${data.casa}:refresh`
    : `cuotas:${data.partidoId}:${data.casa}:initial`;

  const job = await queue.add("captura", data, { jobId });
  return job.id ?? null;
}

/**
 * Cancela todos los jobs activos/pendientes para un partido. Se llama
 * cuando admin desactiva Filtro 1 (sección 4.2 del plan). Idempotente.
 */
export async function cancelarJobsDePartido(partidoId: string): Promise<number> {
  const queue = getCuotasQueue();
  if (!queue) return 0;

  // Estados removibles: cualquier job que no esté terminal.
  const jobs = await queue.getJobs(
    ["wait", "waiting", "delayed", "active", "paused", "prioritized"],
    0,
    -1,
  );

  let removidos = 0;
  for (const job of jobs) {
    if (job.data?.partidoId === partidoId) {
      try {
        await job.remove();
        removidos++;
      } catch (err) {
        // Race condition normal: el job pasó a "active" entre el listado y
        // el remove(). No es crítico, log y seguir.
        logger.debug(
          { jobId: job.id, err: (err as Error).message },
          "cuotas-cola — job no removible (probablemente activo)",
        );
      }
    }
  }
  return removidos;
}

/**
 * Cierra la cola y la conexión Redis. Sólo se invoca en shutdown explícito
 * (tests o señales). En runtime productivo la cola vive el proceso entero.
 */
export async function cerrarCuotasQueue(): Promise<void> {
  if (queueInstance) {
    try {
      await queueInstance.close();
    } catch (err) {
      logger.warn(
        { err: (err as Error).message },
        "cuotas-cola — error al cerrar queue",
      );
    }
  }
  queueInstance = null;
  if (connectionInstance && typeof (connectionInstance as { quit?: () => Promise<void> }).quit === "function") {
    try {
      await (connectionInstance as { quit: () => Promise<void> }).quit();
    } catch {
      // ignore
    }
  }
  connectionInstance = null;
}
