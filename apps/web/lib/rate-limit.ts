// Rate limiter sliding-window en memoria — Lote 1.
//
// Edge runtime-safe: solo usa Map y números, sin deps Node. Vive a
// nivel de módulo, por lo que el estado persiste mientras el proceso
// esté vivo (Railway corre 1 réplica de Next 24/7).
//
// CAVEAT: no cross-replica. Si escalamos a >1 réplica:
//   (a) Cada réplica tendría su propia ventana → límite efectivo N×.
//   (b) Migrar a un store compartido (Redis con INCR+EXPIRE, o
//       Upstash Ratelimit via HTTP si ya tenemos cuenta). El shape de
//       `checkLimit` no cambia — solo la implementación.
//
// Diseño: para cada key mantenemos un array de timestamps. En cada
// llamada descartamos los que salen de la ventana y contamos los
// restantes. Si quedó lleno, rechazamos. Si no, agregamos el actual.

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
  remaining: number;
  limit: number;
}

const buckets = new Map<string, number[]>();

// Housekeeping: cada ~1000 llamadas purgamos keys vacías para que la
// Map no crezca indefinido.
let callCount = 0;
const HOUSEKEEP_EVERY = 1000;

export function checkLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const since = now - windowMs;

  const arr = buckets.get(key) ?? [];
  // Drop timestamps fuera de la ventana.
  let firstValidIdx = 0;
  while (firstValidIdx < arr.length && arr[firstValidIdx] <= since) {
    firstValidIdx++;
  }
  const recent = firstValidIdx === 0 ? arr : arr.slice(firstValidIdx);

  if (recent.length >= limit) {
    // Retry-after = cuánto falta para que el timestamp más antiguo caiga
    // fuera de la ventana. Ceil a segundos para el header HTTP.
    const oldest = recent[0];
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    buckets.set(key, recent);
    return {
      ok: false,
      retryAfterSec: Math.ceil(retryAfterMs / 1000) || 1,
      remaining: 0,
      limit,
    };
  }

  recent.push(now);
  buckets.set(key, recent);

  callCount++;
  if (callCount >= HOUSEKEEP_EVERY) {
    callCount = 0;
    housekeep(since);
  }

  return {
    ok: true,
    retryAfterSec: 0,
    remaining: limit - recent.length,
    limit,
  };
}

function housekeep(since: number): void {
  for (const [k, arr] of buckets) {
    // Si la última entrada está fuera de la ventana, drop la key entera.
    if (arr.length === 0 || arr[arr.length - 1] <= since) {
      buckets.delete(k);
    }
  }
}

/** Solo para tests — no usar en runtime. */
export function __resetRateLimiterForTest(): void {
  buckets.clear();
  callCount = 0;
}
