// Worker BullMQ del motor de captura de cuotas (Lote V.13 — May 2026).
//
// V.13: el processor BullMQ ya NO corre en Railway. Los WAFs de Betano +
// Inkabet bloquean IPs datacenter (US) con 403 instantáneo, así que las
// 5 casas se procesan desde el agente local del admin (`apps/web/scripts/
// agente-cuotas.ts`) que abre Chrome real con perfil persistente.
//
// El backend en Railway:
//   - Mantiene la Queue BullMQ (encolar jobs sigue siendo idempotente).
//   - NO arranca el Worker (no procesa jobs).
//   - Expone endpoints HTTP para el agente (GET jobs/proximos, POST
//     jobs/resultado).
//   - El heartbeat sigue activo para diagnóstico.
//   - `procesarJobCaptura` se exporta para que el endpoint POST resultado
//     reuse `persistirCuotas` + `recalcularEstadoCapturaPartido` + auto-
//     aprendizaje de aliases (idéntica lógica al processor original, solo
//     que el `await scraper.capturarConPlaywright(...)` lo hace el agente).
//
// Patrón de carga: `iniciarCuotasWorker()` se llama desde
// `instrumentation.ts` y SOLO inicia el heartbeat — no crea Worker BullMQ.

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
  ResultadoScraper,
  Scraper,
} from "./scrapers/types";

interface BullMQWorkerLike {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  close(): Promise<void>;
  isPaused?(): Promise<boolean>;
  isRunning?(): boolean;
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
 * Persiste el resultado de una captura ejecutada por el agente local.
 *
 * Lote V.13: el processor BullMQ ya no corre. El agente local ejecuta
 * el scraper Playwright en su PC y reporta vía POST `/agente/jobs/resultado`,
 * que invoca esta función para reusar la lógica de persistencia + auto-
 * aprendizaje de aliases (idéntica al processor original).
 *
 * Casos:
 *   - `kind="ok"`: persistirCuotas + actualizarSaludScraper + recalcular
 *   - `kind="sin_datos"`: persistirSinDatos (no penaliza salud)
 *   - `kind="error"`: persistirError + actualizarSaludScraper("ERROR")
 */
export async function persistirResultadoAgente(args: {
  partidoId: string;
  casa: CasaCuotas;
  ligaCanonica: string;
  kind: "ok" | "sin_datos" | "error";
  resultado?: ResultadoScraper;
  mensaje?: string;
}): Promise<{ alertasCreadas: number }> {
  const { partidoId, casa, ligaCanonica, kind, resultado, mensaje } = args;

  if (kind === "sin_datos") {
    await persistirSinDatos({
      partidoId,
      casa,
      eventIdExterno: ligaCanonica,
      mensaje: mensaje ?? "partido no encontrado o variante suspendida",
    });
    await recalcularEstadoCapturaPartido(partidoId);
    logger.info(
      { partidoId, casa, mensaje, source: "cuotas-worker:agente" },
      `${casa}: SIN_DATOS — ${mensaje ?? "?"}`,
    );
    return { alertasCreadas: 0 };
  }

  if (kind === "error") {
    await persistirError({
      partidoId,
      casa,
      eventIdExterno: ligaCanonica,
      errorMensaje: mensaje ?? "error desconocido",
    });
    await actualizarSaludScraper(casa, "ERROR", mensaje ?? "?");
    await recalcularEstadoCapturaPartido(partidoId);
    logger.warn(
      { partidoId, casa, err: mensaje, source: "cuotas-worker:agente" },
      `${casa}: ERROR — ${mensaje ?? "?"}`,
    );
    return { alertasCreadas: 0 };
  }

  // kind === "ok"
  if (!resultado) {
    throw new Error("persistirResultadoAgente: kind=ok requiere `resultado`");
  }
  const { alertasCreadas } = await persistirCuotas({
    partidoId,
    casa,
    eventIdExterno: resultado.eventIdCasa ?? ligaCanonica,
    resultado,
  });
  await actualizarSaludScraper(casa, "OK");
  await recalcularEstadoCapturaPartido(partidoId);

  // Auto-aprendizaje de aliases (Lote V.7). Fire-and-forget.
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

  logger.info(
    { partidoId, casa, alertasCreadas, source: "cuotas-worker:agente" },
    `captura OK · ${casa}`,
  );
  return { alertasCreadas };
}

/** Marca un job de BullMQ como "no existe scraper". */
export async function persistirSinScraper(args: {
  partidoId: string;
  casa: CasaCuotas;
  ligaCanonica: string;
}): Promise<void> {
  await persistirError({
    partidoId: args.partidoId,
    casa: args.casa,
    eventIdExterno: args.ligaCanonica,
    errorMensaje: `scraper "${args.casa}" no registrado`,
  });
  await recalcularEstadoCapturaPartido(args.partidoId);
}

/**
 * Inicia el "worker" del motor de cuotas en Railway.
 *
 * Lote V.13: NO crea Worker BullMQ (los jobs los procesa el agente local
 * via HTTP polling). Solo arranca el heartbeat para diagnóstico de la
 * cola — útil para ver cuántos jobs están waiting cuando el agente está
 * apagado. Devuelve null siempre (el contrato de retorno se mantiene
 * compatible con `instrumentation.ts`).
 */
export function iniciarCuotasWorker(): BullMQWorkerLike | null {
  if (typeof process === "undefined" || !process.versions?.node) {
    return null;
  }
  // Forzar inicialización de la queue para que el heartbeat tenga algo
  // que medir.
  getCuotasQueue();
  iniciarHeartbeatWorker();
  logger.info(
    { moduleId: WORKER_MODULE_ID, source: "cuotas-worker" },
    "cuotas-worker (V.13 sin processor — agente local consume via HTTP)",
  );
  return null;
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
