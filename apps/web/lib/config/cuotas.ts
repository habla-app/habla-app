// Configuración del motor de captura de cuotas (Lote V).
//
// Toda la política operativa del motor vive acá: lista de casas, refresh,
// umbrales de alerta, concurrencia BullMQ, reintentos. Cero variables de
// entorno — la única excepción justificada sería el flag de Playwright
// (V.4) y el destinatario de alertas, pero no aplican para V.1.
//
// Cualquier ajuste futuro al umbral o a la cadencia debe pasar por acá:
// es la fuente única para el worker, el orquestador y la vista admin.

import type { CasaCuotas } from "../services/scrapers/types";

/**
 * Lista canónica de casas cubiertas por el motor. El orden no es semántico
 * pero se mantiene estable porque alimenta el orden de la tabla admin
 * "salud de scrapers" (sección 9.4 del plan).
 */
export const CASAS_CUOTAS: readonly CasaCuotas[] = [
  "doradobet",
  "apuesta_total",
  "coolbet",
  "betano",
  "inkabet",
  "te_apuesto",
];

/**
 * Configuración runtime del motor. `as const` para que TypeScript trate
 * los valores como literales y no como `number | string`.
 */
export const CUOTAS_CONFIG = {
  CASAS: CASAS_CUOTAS,

  // ---- Refresh ----
  /** Período del cron diario. */
  REFRESH_INTERVAL_HORAS: 24,
  /** Hora local Lima objetivo del refresh diario (5am PET). */
  REFRESH_HORA_LIMA: 5,
  /** Frecuencia con la que el cron tickeа (1h). El service decide si dispara. */
  CRON_TICK_INTERVAL_MS: 60 * 60 * 1000,
  /**
   * Margen de re-captura: si una casa devolvió OK hace menos que esta
   * ventana, el job se considera redundante y hace skip silencioso. Evita
   * doble captura en caso de boot reciente + cron disparando temprano.
   */
  SKIP_SI_OK_MENOS_DE_HORAS: 22,

  // ---- Alertas ----
  /**
   * Umbral mínimo de variación absoluta para emitir `AlertaCuota`. Hardcoded
   * por decisión del lote V (regla del plan: "Umbral hardcoded en 5%").
   */
  UMBRAL_VARIACION_ALERTA_PCT: 5,

  // ---- Estado ----
  /** Si la última captura OK fue hace más que esto, la fila pasa a STALE. */
  STALE_DESPUES_DE_HORAS: 26,
  /** Días consecutivos con error que disparan estado BLOQUEADO en SaludScraper. */
  BLOQUEADO_TRAS_DIAS_ERROR: 3,

  // ---- BullMQ ----
  /**
   * Workers procesando en paralelo.
   *
   * Lote V.11: subido a 6 (= 1 por casa) porque ahora cada captura es un
   * solo fetch HTTP server-side (sin browser headless). Memoria por job:
   * ~5-10 MB del response JSON. Concurrencia 6 = ~30-60 MB total, muy
   * por debajo del límite Railway 1GB.
   */
  CONCURRENCIA_BULLMQ: 6,
  /** Rate limit por worker (ms entre jobs). Reduce risk de IP bans. */
  RATE_LIMIT_POR_WORKER_MS: 1500,
  /** Retención en cola de jobs completados (count). */
  RETENCION_JOBS_OK: 100,
  /** Retención en cola de jobs fallidos (count). Más alta para debug. */
  RETENCION_JOBS_FAIL: 500,

  // ---- Reintentos ----
  REINTENTOS_POR_JOB: 3,
  BACKOFF_INICIAL_MS: 2000,

  // ---- Cola ----
  /** Nombre de la cola BullMQ. Usado tanto por Queue como por Worker. */
  NOMBRE_COLA: "cuotas-captura",
} as const;

/**
 * Atajo. Importable desde cualquier service para chequear si una variación
 * porcentual amerita generar `AlertaCuota`.
 */
export const UMBRAL_VARIACION_ALERTA_PCT =
  CUOTAS_CONFIG.UMBRAL_VARIACION_ALERTA_PCT;
