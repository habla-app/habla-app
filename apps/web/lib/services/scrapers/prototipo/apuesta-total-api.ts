// Extractor exploratorio HTTP directo para Apuesta Total (Kambi B2B).
//
// Apuesta Total embebe el sportsbook de Kambi via el dominio
// `prod20392.kmianko.com`. El admin capturó via DevTools que el frontend
// hace fetch a `/api/pulse/snapshot/events?lang=ES-PE&t=hPNI` con
// CORS abierto.
//
// Primer intento (con `t=hPNI` capturado del DevTools) devolvió:
//   HTTP 400: "querystring/t must be equal to one of the allowed values"
//
// Eso indica que `t` es validado contra una lista cerrada y `hPNI` quizá
// rota por sesión o canal. Esta versión prueba varias combinaciones de
// `t` y endpoints alternativos en paralelo, y reporta cuáles funcionan.

import { logger } from "../../logger";

interface IntentoResultado {
  url: string;
  ok: boolean;
  httpStatus: number | null;
  bytes: number;
  ms: number;
  error?: string;
  /** Top-level keys del JSON si parseó OK. */
  topLevelKeys?: string[];
  /** Conteo de matches peruanos en el texto crudo. */
  matchesPeruanos?: Record<string, number>;
  /** Primeros 3 eventos peruanos detectados, si la respuesta tiene Events array. */
  eventosPeruanos?: unknown[];
  /** Sample del primer participant si existe. */
  sampleParticipant?: unknown;
}

interface ExploracionResultado {
  intentos: IntentoResultado[];
  resumen: {
    totalIntentos: number;
    intentosOk: number;
    primerIntentoOkIndex: number | null;
    msTotal: number;
  };
}

const URL_BASE = "https://prod20392.kmianko.com";

/**
 * Lista de URLs a probar. Si encontramos UNA que devuelve 200 + JSON
 * con partidos peruanos, hemos resuelto el problema. Si todas fallan,
 * el endpoint requiere un parámetro dinámico que tendremos que extraer
 * del HTML inicial.
 */
const URLS_A_PROBAR = [
  // Sin parámetro t — quizá es opcional.
  `${URL_BASE}/api/pulse/snapshot/events?lang=ES-PE`,
  // Valores típicos de canal en sistemas Kambi.
  `${URL_BASE}/api/pulse/snapshot/events?lang=ES-PE&t=web`,
  `${URL_BASE}/api/pulse/snapshot/events?lang=ES-PE&t=site`,
  `${URL_BASE}/api/pulse/snapshot/events?lang=ES-PE&t=portal`,
  `${URL_BASE}/api/pulse/snapshot/events?lang=ES-PE&t=mobile`,
  `${URL_BASE}/api/pulse/snapshot/events?lang=ES-PE&t=desktop`,
  `${URL_BASE}/api/pulse/snapshot/events?lang=ES-PE&t=app`,
  // Original capturado del DevTools (probablemente rotado por sesión).
  `${URL_BASE}/api/pulse/snapshot/events?lang=ES-PE&t=hPNI`,
  // Endpoint alternativo visto en la pestaña Red.
  `${URL_BASE}/api/pulse/events?language=ES-PE&customerLevel=0&draft=false&epoEnabled=true`,
  // Variante con language en lugar de lang.
  `${URL_BASE}/api/pulse/snapshot/events?language=ES-PE`,
];

const HEADERS_DEFAULT = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "es-PE,es;q=0.9,en;q=0.8",
  Origin: "https://www.apuestatotal.com",
  Referer: "https://www.apuestatotal.com/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
};

const REGEX_PERUANOS =
  /cajamarca|alianza|cristal|universitario|melgar|moquegua|cienciano|grau|huancayo|chankas|garcilaso|sport boys|deportivo/i;

async function probarUrl(url: string): Promise<IntentoResultado> {
  const tInicio = Date.now();
  const intento: IntentoResultado = {
    url,
    ok: false,
    httpStatus: null,
    bytes: 0,
    ms: 0,
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: HEADERS_DEFAULT,
      signal: AbortSignal.timeout(15_000),
    });
    intento.httpStatus = response.status;
  } catch (err) {
    intento.ms = Date.now() - tInicio;
    intento.error = `fetch falló: ${(err as Error).message}`;
    return intento;
  }

  let rawText: string;
  try {
    rawText = await response.text();
    intento.bytes = rawText.length;
  } catch (err) {
    intento.ms = Date.now() - tInicio;
    intento.error = `lectura de body falló: ${(err as Error).message}`;
    return intento;
  }

  if (!response.ok) {
    intento.ms = Date.now() - tInicio;
    intento.error = `HTTP ${response.status}: ${rawText.slice(0, 200)}`;
    return intento;
  }

  let body: unknown;
  try {
    body = JSON.parse(rawText);
  } catch (err) {
    intento.ms = Date.now() - tInicio;
    intento.error = `parsing JSON falló: ${(err as Error).message}`;
    return intento;
  }

  // Análisis del response.
  if (typeof body === "object" && body !== null && !Array.isArray(body)) {
    const obj = body as Record<string, unknown>;
    intento.topLevelKeys = Object.keys(obj);

    // Sample del primer participant si existe.
    const participants = obj.Participants;
    if (Array.isArray(participants) && participants.length > 0) {
      intento.sampleParticipant = participants[0];
    }

    // Buscar eventos peruanos.
    const eventsKey = obj.Events ?? obj.events;
    if (Array.isArray(eventsKey)) {
      const peruanos: unknown[] = [];
      for (const event of eventsKey) {
        const eventStr = JSON.stringify(event ?? {});
        if (REGEX_PERUANOS.test(eventStr)) {
          peruanos.push(event);
          if (peruanos.length >= 3) break;
        }
      }
      intento.eventosPeruanos = peruanos;
    }
  }

  // Conteo de matches peruanos en el texto crudo (más rápido que iterar JSON).
  const lowerText = rawText.toLowerCase();
  intento.matchesPeruanos = {
    cajamarca: (lowerText.match(/cajamarca/g) ?? []).length,
    alianza: (lowerText.match(/alianza/g) ?? []).length,
    cristal: (lowerText.match(/cristal/g) ?? []).length,
    universitario: (lowerText.match(/universitario/g) ?? []).length,
    melgar: (lowerText.match(/melgar/g) ?? []).length,
    liga1: (lowerText.match(/liga 1|liga1/g) ?? []).length,
    peru: (lowerText.match(/per[uú]/g) ?? []).length,
  };

  intento.ok = true;
  intento.ms = Date.now() - tInicio;
  return intento;
}

/**
 * Prueba múltiples variantes de URL en paralelo y devuelve los
 * resultados de cada una. Usado para descubrir qué combinación de
 * parámetros funciona para llamar la API de Kambi de Apuesta Total.
 */
export async function fetchExploracionApuestaTotal(): Promise<ExploracionResultado> {
  const tInicio = Date.now();

  // Probar todas las URLs en paralelo (Promise.allSettled para no abortar
  // si una falla).
  const settled = await Promise.allSettled(URLS_A_PROBAR.map(probarUrl));

  const intentos: IntentoResultado[] = settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    return {
      url: URLS_A_PROBAR[i]!,
      ok: false,
      httpStatus: null,
      bytes: 0,
      ms: 0,
      error: `Promise rejected: ${s.reason?.message ?? String(s.reason)}`,
    };
  });

  const intentosOk = intentos.filter((i) => i.ok).length;
  const primerOk = intentos.findIndex((i) => i.ok);

  const resumen = {
    totalIntentos: intentos.length,
    intentosOk,
    primerIntentoOkIndex: primerOk >= 0 ? primerOk : null,
    msTotal: Date.now() - tInicio,
  };

  logger.info(
    {
      ...resumen,
      source: "scrapers:apuesta-total-api:exploracion",
    },
    `apuesta-total exploración · ${intentosOk}/${intentos.length} URLs respondieron OK · ${resumen.msTotal}ms total`,
  );

  return { intentos, resumen };
}
