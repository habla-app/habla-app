// Helpers HTTP compartidos por los scrapers del motor de captura (Lote V).
//
// Cada scraper hace al menos un fetch JSON contra la API pública de su casa.
// Centralizamos User-Agent, Accept-Language, timeout y manejo de errores
// acá para que las implementaciones por casa queden enfocadas en su parser
// específico.
//
// Reglas (CLAUDE.md §6):
//   - undici (`fetch` nativo de Node 18+) es la única dependencia HTTP.
//     Cero `axios`, `got`, etc.
//   - Loggear con Pino (`logger.warn`/`logger.error`), nunca `console.*`.
//   - Lanzar `Error` con mensaje claro al fallar — el worker lo captura y
//     persiste el row de `cuotas_casa` con `estado="ERROR"` + `errorMensaje`.
//
// El timeout default (15s) cubre la latencia esperada de las casas peruanas
// vista en el POC del 03/05/2026 (la más lenta — Doradobet — respondió en
// ~7s incluyendo TLS handshake desde Lima).

import { logger } from "../logger";

/**
 * UA realista: Chrome 147 sobre Windows. Replicamos la huella usada en el
 * POC empírico (Chrome conectado vía Claude in Chrome) para minimizar
 * diferencias de comportamiento entre POC y producción.
 */
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

export interface HttpOpts {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  /**
   * Body de la request. Si es objeto, se serializa como JSON y se setea
   * `Content-Type: application/json` automáticamente. Si es string, se
   * envía tal cual (caller responsable del Content-Type).
   */
  body?: unknown;
  /** Default 15s. Aborta con AbortController. */
  timeoutMs?: number;
  /** Códigos HTTP aceptados como éxito. Default [200]. */
  acceptStatus?: number[];
  /** `source` para los logs Pino. Default "scrapers:http". */
  source?: string;
}

function buildHeaders(opts: HttpOpts): Record<string, string> {
  const out: Record<string, string> = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Accept-Language": "es-PE,es;q=0.9,en;q=0.8",
    Accept: "application/json, text/plain, */*",
    ...opts.headers,
  };
  // Si mandamos body objeto, forzamos Content-Type JSON salvo override.
  if (opts.body !== undefined && typeof opts.body !== "string" && !out["Content-Type"]) {
    out["Content-Type"] = "application/json";
  }
  return out;
}

interface RawFetchResult {
  status: number;
  text: string;
  ms: number;
  url: string;
}

async function fetchRaw(url: string, opts: HttpOpts): Promise<RawFetchResult> {
  const {
    method = "GET",
    body,
    timeoutMs = 15_000,
    acceptStatus = [200],
    source = "scrapers:http",
  } = opts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: buildHeaders(opts),
      body:
        body === undefined
          ? undefined
          : typeof body === "string"
            ? body
            : JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    clearTimeout(timer);
    const e = err as Error;
    const isAbort = e?.name === "AbortError";
    const msg = isAbort ? `timeout >${timeoutMs}ms` : e.message;
    logger.warn(
      { url, method, source, err: msg },
      "scrapers:http fetch falló",
    );
    throw new Error(`${method} ${url} falló: ${msg}`);
  }
  clearTimeout(timer);

  const ms = Date.now() - started;
  const text = await res.text();

  if (!acceptStatus.includes(res.status)) {
    logger.warn(
      {
        url,
        method,
        status: res.status,
        ms,
        source,
        bodyPreview: text.slice(0, 300),
      },
      "scrapers:http status fuera de acceptStatus",
    );
    throw new Error(`${method} ${url} respondió ${res.status}`);
  }

  logger.debug(
    { url, method, status: res.status, ms, source },
    "scrapers:http fetch OK",
  );
  return { status: res.status, text, ms, url };
}

/**
 * GET/POST que parsea body como JSON. Tipado genérico al caller; el parser
 * específico (Zod o validador propio) corre en el scraper.
 *
 * Lanza `Error` con mensaje legible si:
 *   - timeout
 *   - red inalcanzable
 *   - status fuera de `acceptStatus`
 *   - body no es JSON parseable
 */
export async function httpFetchJson<T = unknown>(
  url: string,
  opts: HttpOpts = {},
): Promise<T> {
  const { text, status, ms } = await fetchRaw(url, opts);
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    logger.warn(
      {
        url,
        status,
        ms,
        source: opts.source ?? "scrapers:http",
        sample: text.slice(0, 300),
        err: (err as Error).message,
      },
      "scrapers:http body no es JSON parseable",
    );
    throw new Error(
      `${opts.method ?? "GET"} ${url} body no-JSON: ${(err as Error).message}`,
    );
  }
}

/**
 * Variante que devuelve el body como texto crudo. Útil para parsear HTML
 * (ej. extraer subdominio dinámico de Apuesta Total desde la home).
 */
export async function httpFetchText(
  url: string,
  opts: HttpOpts = {},
): Promise<string> {
  const { text } = await fetchRaw(url, opts);
  return text;
}

/**
 * Variante que NO lanza si el status está fuera del rango esperado —
 * devuelve el resultado completo para que el caller decida. Sirve para
 * detección de subdominios caídos (404 de Apuesta Total → trigger de
 * descubrimiento dinámico) sin convertirlo en throw.
 */
export async function httpProbeJson<T = unknown>(
  url: string,
  opts: HttpOpts = {},
): Promise<{ status: number; data: T | null; rawText: string }> {
  // acceptStatus = todos los códigos posibles → fetchRaw no lanza por status.
  const { text, status } = await fetchRaw(url, {
    ...opts,
    acceptStatus: opts.acceptStatus ?? Array.from({ length: 600 }, (_, i) => i),
  });
  let data: T | null = null;
  try {
    data = JSON.parse(text) as T;
  } catch {
    /* ignore — data se queda en null si no parsea */
  }
  return { status, data, rawText: text };
}
