// Extractor exploratorio HTTP directo para Apuesta Total (Kambi B2B).
//
// Apuesta Total embebe el sportsbook de Kambi via el dominio
// `prod20392.kmianko.com`. El admin capturó via DevTools que el frontend
// hace fetch a `/api/pulse/snapshot/events?lang=ES-PE&t=hPNI` con
// CORS abierto (access-control-allow-credentials: true, methods GET/OPTIONS).
//
// La respuesta es ~3.93 MB sin comprimir (269 KB con gzip). Trae TODOS
// los partidos del operador — no solo Liga 1 Perú. El frontend filtra
// client-side. Nuestro approach: pegarle al endpoint, parsear, filtrar
// por "Liga 1" o "Perú" en el server.
//
// Esta es la fase EXPLORATORIA: solo hacemos fetch y devolvemos
// metadata + sample. No mapeamos a CuotasPartido todavía porque el
// shape exacto del JSON aún no está documentado (la respuesta de
// DevTools del admin se truncó a 1138 chars). Una vez veamos la
// estructura completa, escribimos el parser específico.

import { logger } from "../../logger";

interface SampleResultado {
  ok: boolean;
  raw: {
    httpStatus: number | null;
    bytes: number;
    ms: number;
    url: string;
  };
  /** Top-level keys del JSON (ej. "Participants", "Events", "BetOffers"). */
  estructura?: {
    topLevelKeys: string[];
    /** Para cada key array, su length y un sample del primer elemento. */
    samplesPorKey: Record<
      string,
      {
        tipo: "array" | "object" | "primitive";
        length?: number;
        sampleKeys?: string[];
        sample?: unknown;
      }
    >;
  };
  /** Conteo total de strings que matchean equipos/ligas peruanas (heuristic). */
  matchesPeruanos?: {
    cajamarca: number;
    alianza: number;
    cristal: number;
    universitario: number;
    melgar: number;
    liga1: number;
    peru: number;
  };
  /** Si encontramos eventos con equipos peruanos, devolvemos los primeros 3. */
  eventosPeruanos?: unknown[];
  error?: string;
}

const URL_APUESTA_TOTAL =
  "https://prod20392.kmianko.com/api/pulse/snapshot/events?lang=ES-PE&t=hPNI";

export async function fetchExploracionApuestaTotal(): Promise<SampleResultado> {
  const tInicio = Date.now();

  let response: Response;
  let bytes = 0;
  let httpStatus: number | null = null;
  let body: unknown;

  try {
    response = await fetch(URL_APUESTA_TOTAL, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "es-PE,es;q=0.9,en;q=0.8",
        Origin: "https://www.apuestatotal.com",
        Referer: "https://www.apuestatotal.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
      },
    });
    httpStatus = response.status;
  } catch (err) {
    return {
      ok: false,
      raw: {
        httpStatus: null,
        bytes: 0,
        ms: Date.now() - tInicio,
        url: URL_APUESTA_TOTAL,
      },
      error: `fetch falló: ${(err as Error).message}`,
    };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      ok: false,
      raw: {
        httpStatus,
        bytes: text.length,
        ms: Date.now() - tInicio,
        url: URL_APUESTA_TOTAL,
      },
      error: `HTTP ${httpStatus}: ${text.slice(0, 300)}`,
    };
  }

  let rawText: string;
  try {
    rawText = await response.text();
    bytes = rawText.length;
    body = JSON.parse(rawText);
  } catch (err) {
    return {
      ok: false,
      raw: {
        httpStatus,
        bytes,
        ms: Date.now() - tInicio,
        url: URL_APUESTA_TOTAL,
      },
      error: `parsing JSON falló: ${(err as Error).message}`,
    };
  }

  // Análisis de la estructura.
  const estructura: NonNullable<SampleResultado["estructura"]> = {
    topLevelKeys: [],
    samplesPorKey: {},
  };

  if (typeof body === "object" && body !== null && !Array.isArray(body)) {
    const obj = body as Record<string, unknown>;
    estructura.topLevelKeys = Object.keys(obj);
    for (const key of estructura.topLevelKeys) {
      const value = obj[key];
      if (Array.isArray(value)) {
        const first = value[0];
        estructura.samplesPorKey[key] = {
          tipo: "array",
          length: value.length,
          sampleKeys:
            first && typeof first === "object" && first !== null
              ? Object.keys(first as Record<string, unknown>).slice(0, 30)
              : [],
          sample: first ?? null,
        };
      } else if (value && typeof value === "object") {
        estructura.samplesPorKey[key] = {
          tipo: "object",
          sampleKeys: Object.keys(value as Record<string, unknown>).slice(
            0,
            30,
          ),
        };
      } else {
        estructura.samplesPorKey[key] = {
          tipo: "primitive",
          sample: value,
        };
      }
    }
  }

  // Heurística: contar matches de palabras peruanas en el texto crudo.
  // Más rápido que iterar el árbol JSON.
  const lowerText = rawText.toLowerCase();
  const matchesPeruanos: NonNullable<SampleResultado["matchesPeruanos"]> = {
    cajamarca: (lowerText.match(/cajamarca/g) ?? []).length,
    alianza: (lowerText.match(/alianza/g) ?? []).length,
    cristal: (lowerText.match(/cristal/g) ?? []).length,
    universitario: (lowerText.match(/universitario/g) ?? []).length,
    melgar: (lowerText.match(/melgar/g) ?? []).length,
    liga1: (lowerText.match(/liga 1|liga1/g) ?? []).length,
    peru: (lowerText.match(/per[uú]/g) ?? []).length,
  };

  // Si hay eventos, intentar encontrar 3 que tengan nombres de equipos
  // peruanos para ver el shape concreto.
  const eventosPeruanos: unknown[] = [];
  if (
    body !== null &&
    typeof body === "object" &&
    "Events" in (body as Record<string, unknown>)
  ) {
    const events = (body as { Events?: unknown[] }).Events;
    if (Array.isArray(events)) {
      const NAMES_PERUANOS_REGEX =
        /cajamarca|alianza|cristal|universitario|melgar|moquegua|cienciano|grau|huancayo|chankas|garcilaso|sport boys|deportivo/i;
      for (const event of events) {
        const eventStr = JSON.stringify(event ?? {});
        if (NAMES_PERUANOS_REGEX.test(eventStr)) {
          eventosPeruanos.push(event);
          if (eventosPeruanos.length >= 3) break;
        }
      }
    }
  }

  const ms = Date.now() - tInicio;
  logger.info(
    {
      bytes,
      ms,
      topKeys: estructura.topLevelKeys,
      matchesPeruanos,
      eventosPeruanosCount: eventosPeruanos.length,
      source: "scrapers:apuesta-total-api:exploracion",
    },
    `apuesta-total-api exploración · ${bytes} bytes en ${ms}ms · ${eventosPeruanos.length} eventos peruanos detectados`,
  );

  return {
    ok: true,
    raw: { httpStatus, bytes, ms, url: URL_APUESTA_TOTAL },
    estructura,
    matchesPeruanos,
    eventosPeruanos,
  };
}
