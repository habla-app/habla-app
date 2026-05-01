// Retry con backoff exponencial — Lote E (May 2026).
//
// Helper para envíos críticos que pueden fallar transitoriamente: emails de
// bienvenida, mensajes WhatsApp 1:1, llamadas a OpenPay/Anthropic API.
// Estrategia: 3 intentos con delays 1s → 2s → 4s. Tras agotarlos, re-throw
// el último error para que el caller lo loggee como critical.
//
// El delay arranca después del primer fallo: el primer intento es
// inmediato. Los `intentos` incluyen al primero (intentos=3 → 1 inmediato +
// 2 retries con backoff).

import { logger } from "@/lib/services/logger";

export interface RetryOptions {
  /** Total de intentos (incluyendo el primero). Default 3. */
  intentos?: number;
  /** Delay base en ms para el backoff exponencial (1×, 2×, 4× …). Default 1000. */
  delayBaseMs?: number;
  /** Callback opcional para inspeccionar errores entre retries (ej: logging). */
  onRetry?: (err: unknown, intentoNum: number) => void;
  /** Etiqueta para los logs de retry. Útil para debugging. */
  label?: string;
}

/**
 * Ejecuta `fn` con retries. Retorna el resultado del primer intento exitoso.
 * Si todos los intentos fallan, re-throw el último error.
 */
export async function retryConBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const intentos = opts.intentos ?? 3;
  const delayBase = opts.delayBaseMs ?? 1000;
  const label = opts.label ?? "retry";

  let ultimoError: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      return await fn();
    } catch (err) {
      ultimoError = err;
      if (opts.onRetry) opts.onRetry(err, i + 1);

      if (i < intentos - 1) {
        const delay = delayBase * Math.pow(2, i); // 1s, 2s, 4s, ...
        logger.warn(
          { label, intento: i + 1, totalIntentos: intentos, delay, err },
          "retryConBackoff: falló, reintentando",
        );
        await new Promise((r) => setTimeout(r, delay));
      } else {
        logger.error(
          { label, intentos, err },
          "retryConBackoff: agotó todos los intentos",
        );
      }
    }
  }
  throw ultimoError;
}
