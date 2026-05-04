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

// Lote V.10.8: cache via globalThis para sobrevivir module isolation
// entre contextos de Next.js (instrumentation.ts vs route handlers).
// Sin esto, cada contexto creaba su propia Queue y los jobs encolados en
// el contexto del route handler no eran procesados por el worker que
// vive en el contexto del boot.
//
// El patrón `globalThis as unknown as {...}` es el estándar de Next.js
// para singletons cross-context (Prisma client lo usa, por ejemplo).
const globalForCuotas = globalThis as unknown as {
  __cuotasQueueInstance?: BullMQQueueLike | null | undefined;
  __cuotasConnectionInstance?: unknown | null | undefined;
  __cuotasModuleId?: string;
};

// Stable module ID para diagnosticar cuántos contextos cargaron el módulo.
const MODULE_ID = `cuotas-cola-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
if (!globalForCuotas.__cuotasModuleId) {
  globalForCuotas.__cuotasModuleId = MODULE_ID;
}

function getQueueInstance(): BullMQQueueLike | null | undefined {
  return globalForCuotas.__cuotasQueueInstance;
}

function setQueueInstance(v: BullMQQueueLike | null): void {
  globalForCuotas.__cuotasQueueInstance = v;
}

function getConnectionInstance(): unknown | null | undefined {
  return globalForCuotas.__cuotasConnectionInstance;
}

function setConnectionInstance(v: unknown | null): void {
  globalForCuotas.__cuotasConnectionInstance = v;
}

/**
 * Construye (lazy) y devuelve la `Queue` BullMQ. Devuelve null cuando no
 * es posible (Edge runtime o sin REDIS_URL). Los callers MUST tolerar
 * null para no romper en build/edge.
 *
 * Lote V.10.8: usa cache `globalThis` para singleton inter-contexto.
 * Si otro contexto ya inicializó la Queue, la reusa sin crear otra.
 */
export function getCuotasQueue(): BullMQQueueLike | null {
  const cached = getQueueInstance();
  if (cached !== undefined) {
    logger.debug(
      {
        moduleId: MODULE_ID,
        cachedFromGlobalThis: globalForCuotas.__cuotasModuleId !== MODULE_ID,
        source: "cuotas-cola",
      },
      "getCuotasQueue: reusando Queue de globalThis",
    );
    return cached as BullMQQueueLike | null;
  }

  const url = process.env.REDIS_URL;
  if (!url) {
    logger.warn(
      "REDIS_URL no configurada — cola cuotas-captura deshabilitada",
    );
    setQueueInstance(null);
    return null;
  }

  if (typeof process === "undefined" || !process.versions?.node) {
    setQueueInstance(null);
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
    setConnectionInstance(connection);

    // Lote V.10.4: listeners explícitos para diagnosticar conexión que
    // se desconecta silenciosamente. Si el worker no procesa jobs y los
    // listeners de BullMQ no disparan, suele ser que ioredis se
    // reconectó silencioso y el worker dejó de pollar.
    const conn = connection as {
      on?: (event: string, listener: (...args: unknown[]) => void) => void;
    };
    if (typeof conn.on === "function") {
      conn.on("connect", () => {
        logger.info(
          { source: "cuotas-cola:redis" },
          "ioredis (cuotas) connect · TCP establecido",
        );
      });
      conn.on("ready", () => {
        logger.info(
          { source: "cuotas-cola:redis" },
          "ioredis (cuotas) ready · listo para comandos",
        );
      });
      conn.on("error", (err: unknown) => {
        const e = err as Error | undefined;
        logger.error(
          { err: e?.message, source: "cuotas-cola:redis" },
          `ioredis (cuotas) error · ${e?.message ?? "?"}`,
        );
      });
      conn.on("close", () => {
        logger.warn(
          { source: "cuotas-cola:redis" },
          "ioredis (cuotas) close · conexión cerrada (reconnect debería disparar)",
        );
      });
      conn.on("reconnecting", (delay: unknown) => {
        logger.warn(
          { delay, source: "cuotas-cola:redis" },
          `ioredis (cuotas) reconnecting · intentando reconectar en ${delay}ms`,
        );
      });
      conn.on("end", () => {
        logger.error(
          { source: "cuotas-cola:redis" },
          "ioredis (cuotas) end · conexión terminada definitivamente (worker NO procesa más jobs)",
        );
      });
    }

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
      {
        cola: CUOTAS_CONFIG.NOMBRE_COLA,
        moduleId: MODULE_ID,
        primeraVezEnGlobalThis:
          globalForCuotas.__cuotasModuleId === MODULE_ID,
        source: "cuotas-cola",
      },
      `BullMQ — cola cuotas-captura inicializada (moduleId=${MODULE_ID})`,
    );

    setQueueInstance(queue);
    return queue;
  } catch (err) {
    logger.error(
      { err: (err as Error).message },
      "BullMQ — fallo al inicializar cola cuotas-captura",
    );
    setQueueInstance(null);
    return null;
  }
}

/**
 * Conexión Redis subyacente que comparten Queue + Worker. Sólo Node.
 * El worker lee este getter para reusar la misma conexión.
 */
export function getCuotasRedisConnection(): unknown | null {
  if (getQueueInstance() === undefined) {
    // Forzar inicialización si nadie pidió la queue todavía.
    getCuotasQueue();
  }
  return getConnectionInstance() ?? null;
}

/**
 * Espera a que la conexión ioredis subyacente esté en estado "ready".
 * Lote V.9.2: cubre la race condition observada al primer add tras una
 * inicialización lazy de la cola (logs muestran "BullMQ inicializada"
 * + "redis conectado" sucediendo simultáneamente, y el primer add
 * lanzando antes de que la conexión esté lista). ioredis bufferea
 * comandos por default, pero algunas versiones de bullmq igual hacen
 * checks que requieren conexión activa.
 */
async function esperarRedisReady(timeoutMs: number = 5_000): Promise<void> {
  const conn = getConnectionInstance() as
    | {
        status?: string;
        once?: (event: string, listener: () => void) => void;
        off?: (event: string, listener: () => void) => void;
      }
    | null
    | undefined;
  if (!conn) return;
  if (conn.status === "ready" || conn.status === "connect") return;
  if (typeof conn.once !== "function") return;

  await new Promise<void>((resolve) => {
    let resolved = false;
    const finish = (): void => {
      if (resolved) return;
      resolved = true;
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    if (typeof timer.unref === "function") timer.unref();
    conn.once!("ready", () => {
      clearTimeout(timer);
      finish();
    });
    conn.once!("connect", () => {
      clearTimeout(timer);
      finish();
    });
    conn.once!("error", () => {
      clearTimeout(timer);
      finish();
    });
  });
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

  // Lote V.9.2: esperar a que Redis esté ready antes del primer add.
  // Idempotente — si ya está conectado retorna inmediatamente.
  await esperarRedisReady();

  // jobId determinístico por (partidoId, casa, esRefresh-or-not). BullMQ
  // garantiza que dos jobs con el mismo `jobId` no coexisten en la cola
  // — el segundo add se vuelve idempotente. El sufijo cambia entre el
  // trigger admin y el cron diario para que ambos no se pisen.
  //
  // Lote V.9.3: BullMQ rechaza custom IDs con `:` (`Custom Id cannot
  // contain :`). El bug estaba latente desde el Lote V — nunca se había
  // notado porque el discovery HTTP fallaba siempre y se encolaban 0
  // jobs. V.9.1 destapó el bug al encolar las 7 casas siempre.
  // Reemplazamos `:` por `-` como separador.
  const jobId = data.esRefresh
    ? `cuotas-${data.partidoId}-${data.casa}-refresh`
    : `cuotas-${data.partidoId}-${data.casa}-initial`;

  // Lote V.10.8: log diagnóstico antes/después del add para verificar
  // que el escribe llegó al Redis correcto.
  const conn = getConnectionInstance() as { status?: string } | null | undefined;
  const job = await queue.add("captura", data, { jobId });
  logger.debug(
    {
      jobId,
      casa: data.casa,
      partidoId: data.partidoId,
      jobIdAsignado: job.id ?? null,
      connStatus: conn?.status ?? null,
      moduleId: MODULE_ID,
      source: "cuotas-cola:encolar",
    },
    `encolarJobCaptura · ${data.casa} jobId=${jobId} → asignado=${job.id ?? "null"} connStatus=${conn?.status ?? "?"}`,
  );
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
  const queue = getQueueInstance();
  if (queue) {
    try {
      await queue.close();
    } catch (err) {
      logger.warn(
        { err: (err as Error).message },
        "cuotas-cola — error al cerrar queue",
      );
    }
  }
  setQueueInstance(null);
  const conn = getConnectionInstance();
  if (conn && typeof (conn as { quit?: () => Promise<void> }).quit === "function") {
    try {
      await (conn as { quit: () => Promise<void> }).quit();
    } catch {
      // ignore
    }
  }
  setConnectionInstance(null);
}
