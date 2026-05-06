// Interceptor de XHR genérico (Lote V.12 — May 2026).
//
// Idea: cargar una URL en Chromium headless y escuchar TODAS las
// responses HTTP. El browser hace solo el descubrimiento de endpoints
// (cuando el JS de la SPA pide cuotas via fetch/XHR, lo capturamos).
//
// Filtros aplicados a cada response para considerarla "candidata a
// cuotas":
//   - status 200
//   - Content-Type contiene `json` (excluye HTML, JS, imágenes)
//   - body parseable como JSON
//   - body string > 1KB (filtra responses vacías de heartbeat / config)
//   - body contiene al menos uno de los keywords de cuotas
//
// Devuelve la lista completa de candidatos. El caller se queda con el
// que matchea el partido buscado (cruce por nombre de equipo + parser).

import { logger } from "../logger";
import { obtenerPagina, liberarPagina, type PWPage } from "./browser";

const KEYWORDS_CUOTAS_DEFAULT = [
  "TrueOdds",
  "decimalOdds",
  "DisplayOdds",
  '"odds"',
  '"price"',
  '"value"',
  "selections",
  "market_odds",
  "outcomes",
  "Selections",
];

const TIMEOUT_DEFAULT_MS = 25_000;
const ESPERA_POST_LOAD_MS = 4_000;
const MIN_BODY_BYTES = 1024;

export interface JsonCapturado {
  url: string;
  status: number;
  body: unknown;
  bodyText: string;
  ms: number;
}

export interface InterceptOpts {
  /** Timeout total del navegación + intercepción. Default 25s. */
  timeoutMs?: number;
  /** Espera adicional tras `domcontentloaded` para que JS dispare XHRs. Default 4s. */
  esperaPostLoadMs?: number;
  /** Keywords case-sensitive en el body para considerarlo candidato. Override conservador. */
  keywords?: string[];
  /** Filtro adicional opcional (URL). Si retorna false la response se ignora aunque pase keywords. */
  predicateUrl?: (url: string) => boolean;
  /** `source` para logs Pino. */
  source?: string;
}

/**
 * Carga `url` en Chromium headless, escucha responses por
 * `esperaPostLoadMs + timeoutMs` y devuelve los JSONs candidatos.
 */
export async function capturarJsonsConCuotas(
  url: string,
  opts: InterceptOpts = {},
): Promise<JsonCapturado[]> {
  const {
    timeoutMs = TIMEOUT_DEFAULT_MS,
    esperaPostLoadMs = ESPERA_POST_LOAD_MS,
    keywords = KEYWORDS_CUOTAS_DEFAULT,
    predicateUrl,
    source = "scrapers:xhr-intercept",
  } = opts;

  const tInicio = Date.now();
  const candidatos: JsonCapturado[] = [];
  let totalResponses = 0;

  const page: PWPage = await obtenerPagina();

  // Listener de responses. Lee body de forma defensiva: page puede cerrarse
  // con responses pendientes; cada error se atrapa y descarta.
  const listener = (response: { url(): string; status(): number; headers(): Record<string, string>; text(): Promise<string>; ok(): boolean }) => {
    totalResponses += 1;
    const respUrl = response.url();
    if (predicateUrl && !predicateUrl(respUrl)) return;
    if (!response.ok() || response.status() !== 200) return;
    const ct = (response.headers()["content-type"] ?? "").toLowerCase();
    if (!ct.includes("json")) return;

    void (async () => {
      try {
        const text = await response.text();
        if (text.length < MIN_BODY_BYTES) return;
        if (!keywords.some((k) => text.includes(k))) return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          return;
        }
        candidatos.push({
          url: respUrl,
          status: response.status(),
          body: parsed,
          bodyText: text,
          ms: Date.now() - tInicio,
        });
      } catch {
        // Body unavailable (page closed, request aborted) — ignore.
      }
    })();
  };

  page.on("response", listener);

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    // Esperar a que el JS de la SPA dispare las XHRs de cuotas.
    await page.waitForTimeout(esperaPostLoadMs);
  } catch (err) {
    logger.warn(
      {
        url,
        err: (err as Error).message,
        ms: Date.now() - tInicio,
        candidatosHasta: candidatos.length,
        totalResponsesHasta: totalResponses,
        source,
      },
      "xhr-intercept: navegación falló — devolviendo candidatos parciales",
    );
  } finally {
    page.off("response", listener);
    await liberarPagina(page);
  }

  const ms = Date.now() - tInicio;
  logger.info(
    {
      url,
      ms,
      totalResponses,
      candidatos: candidatos.length,
      candidatosUrls: candidatos.map((c) => c.url).slice(0, 5),
      source,
    },
    `xhr-intercept · ${candidatos.length} JSONs candidatos en ${ms}ms (${totalResponses} responses totales)`,
  );

  return candidatos;
}
