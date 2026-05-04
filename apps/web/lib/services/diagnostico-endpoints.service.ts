// Diagnóstico de endpoints de discovery del motor de cuotas (Lote V.8.2).
//
// Sirve para responder en una sola request: "¿qué status devuelve cada
// endpoint de cada casa hoy mismo?". Útil cuando el discovery falla en
// producción y necesitamos ver si los endpoints están vivos, devolviendo
// la estructura esperada, o bloqueados por WAF.
//
// Cada casa tiene una lista propia de endpoints candidato (replicada de
// los scrapers). El servicio:
//   1. Hace `httpProbeJson` con timeout corto (10s) a cada endpoint.
//   2. Registra status, latencia, primeros 500 chars del body, conteo de
//      eventos detectados (intenta encontrar arrays de objetos con shape
//      de evento — heurística laxa común a las 7 casas).
//   3. Devuelve el resumen por casa.
//
// Sin imports cíclicos. No depende de los scrapers concretos — duplica
// la URL cuando es trivial. Si un scraper cambia su lista de endpoints,
// este archivo queda atrasado pero no rompe (tests admin reportan eso).

import { logger } from "./logger";
import { httpProbeJson } from "./scrapers/http";
import type { CasaCuotas } from "./scrapers/types";

export interface ProbeResultado {
  url: string;
  status: number | "fetch-fail";
  ms: number;
  bodyPreview: string;
  eventosDetectados: number;
  errorRecogido?: string;
}

export interface DiagnosticoCasa {
  casa: CasaCuotas;
  endpoints: ProbeResultado[];
  /** Total de eventos detectados en cualquier endpoint. */
  totalEventosDetectados: number;
  /** Endpoint con mayor count, o null si todos vacíos. */
  mejorEndpoint: string | null;
}

export interface DiagnosticoCompleto {
  iniciadoEn: Date;
  duracionMs: number;
  casas: DiagnosticoCasa[];
}

const TIMEOUT_PROBE_MS = 10_000;
const MAX_BODY_PREVIEW_CHARS = 500;

// ---------------------------------------------------------------------------
// Endpoints por casa
// ---------------------------------------------------------------------------

interface EndpointDef {
  url: string;
  /** Headers adicionales necesarios (Origin/Referer típicamente). */
  headers?: Record<string, string>;
}

const ENDPOINTS_POR_CASA: Record<CasaCuotas, EndpointDef[]> = {
  stake: [
    {
      url: "https://pre-143o-sp.websbkt.com/cache/143/es/pe/sportsbookcommon/upcoming-events.json",
      headers: { Origin: "https://stake.pe", Referer: "https://stake.pe/deportes/" },
    },
    {
      url: "https://pre-143o-sp.websbkt.com/cache/143/es/pe/sportsbookcommon/pre-events.json",
      headers: { Origin: "https://stake.pe", Referer: "https://stake.pe/deportes/" },
    },
    {
      url: "https://pre-143o-sp.websbkt.com/cache/143/es/pe/sportsbookcommon/events-by-sport.json?sport=1",
      headers: { Origin: "https://stake.pe", Referer: "https://stake.pe/deportes/" },
    },
  ],
  apuesta_total: [
    {
      url: "https://prod20392.kmianko.com/api/eventbrowser/upcoming?sportId=66",
      headers: {
        Origin: "https://www.apuestatotal.com",
        Referer: "https://www.apuestatotal.com/apuestas-deportivas/",
      },
    },
    {
      url: "https://prod20392.kmianko.com/api/sportsbookv2/sports/66/events",
      headers: {
        Origin: "https://www.apuestatotal.com",
        Referer: "https://www.apuestatotal.com/apuestas-deportivas/",
      },
    },
    {
      url: "https://prod20392.kmianko.com/api/eventbrowser/sport/66/events",
      headers: {
        Origin: "https://www.apuestatotal.com",
        Referer: "https://www.apuestatotal.com/apuestas-deportivas/",
      },
    },
  ],
  coolbet: [
    {
      url: "https://www.coolbet.pe/s/sports/v1/upcoming?sportId=1",
      headers: { Origin: "https://www.coolbet.pe", Referer: "https://www.coolbet.pe/" },
    },
    {
      url: "https://www.coolbet.pe/s/sb-odds/odds/upcoming?sportId=1",
      headers: { Origin: "https://www.coolbet.pe", Referer: "https://www.coolbet.pe/" },
    },
    {
      url: "https://www.coolbet.pe/s/sports/in-play/upcoming?sportId=1",
      headers: { Origin: "https://www.coolbet.pe", Referer: "https://www.coolbet.pe/" },
    },
    {
      url: "https://www.coolbet.pe/s/sports/v1/events?sport=football&status=upcoming",
      headers: { Origin: "https://www.coolbet.pe", Referer: "https://www.coolbet.pe/" },
    },
  ],
  doradobet: [
    {
      url: "https://sb2integration-altenar2.biahosted.com/api/eventbrowser/upcoming?sportId=66",
      headers: {
        Origin: "https://doradobet.com",
        Referer: "https://doradobet.com/deportes/",
      },
    },
    {
      url: "https://sb2integration-altenar2.biahosted.com/api/sportsbookv2/sports/66/events",
      headers: {
        Origin: "https://doradobet.com",
        Referer: "https://doradobet.com/deportes/",
      },
    },
    {
      url: "https://sb2integration-altenar2.biahosted.com/api/eventbrowser/sport/66/events",
      headers: {
        Origin: "https://doradobet.com",
        Referer: "https://doradobet.com/deportes/",
      },
    },
  ],
  betano: [
    {
      url: "https://www.betano.pe/api/home/top-events-v2/",
      headers: { Origin: "https://www.betano.pe", Referer: "https://www.betano.pe/" },
    },
  ],
  inkabet: [
    {
      url: "https://d-cf.inkabetplayground.net/api/upcoming?sportId=1",
      headers: {
        Origin: "https://www.inkabet.pe",
        Referer: "https://www.inkabet.pe/pe/apuestas-deportivas",
      },
    },
    {
      url: "https://d-cf.inkabetplayground.net/api/sport/1/events",
      headers: {
        Origin: "https://www.inkabet.pe",
        Referer: "https://www.inkabet.pe/pe/apuestas-deportivas",
      },
    },
    {
      url: "https://d-cf.inkabetplayground.net/api/events?sport=football&status=upcoming",
      headers: {
        Origin: "https://www.inkabet.pe",
        Referer: "https://www.inkabet.pe/pe/apuestas-deportivas",
      },
    },
    {
      url: "https://d-cf.inkabetplayground.net/api/v1/events/upcoming?sportId=1",
      headers: {
        Origin: "https://www.inkabet.pe",
        Referer: "https://www.inkabet.pe/pe/apuestas-deportivas",
      },
    },
  ],
  te_apuesto: [
    {
      url: "https://api.teapuesto.pe/api/v4/nfs/matches-of-the-day?tournament_id=1899&tournamentId=1899&sport_id=1",
      headers: {
        Origin: "https://www.teapuesto.pe",
        Referer: "https://www.teapuesto.pe/",
      },
    },
    {
      url: "https://api.teapuesto.pe/api/v4/nfs/matches-of-the-day",
      headers: {
        Origin: "https://www.teapuesto.pe",
        Referer: "https://www.teapuesto.pe/",
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Detección heurística de eventos
// ---------------------------------------------------------------------------

/**
 * Heurística común a las 7 casas: el payload de un listado pre-match casi
 * siempre es un objeto JSON con un array de eventos en alguna propiedad
 * conocida (`events`, `data`, `matches`, etc.). Cada evento tiene
 * típicamente uno de estos campos: `home_team`/`homeTeam`/`homeName`/
 * `teams`/`h`. El extractor busca recursivamente arrays cuyo primer
 * elemento tenga ese shape.
 */
function contarEventosDetectados(payload: unknown, depth = 0): number {
  if (depth > 6 || !payload || typeof payload !== "object") return 0;
  if (Array.isArray(payload)) {
    const sample = payload.find((it) => it && typeof it === "object");
    if (sample && typeof sample === "object") {
      const keys = Object.keys(sample as object);
      if (
        keys.some((k) =>
          [
            "home_team",
            "hometeam",
            "homename",
            "home",
            "teams",
            "h",
            "team_home",
          ].includes(k.toLowerCase()),
        )
      ) {
        return payload.length;
      }
    }
    let max = 0;
    for (const item of payload) {
      const c = contarEventosDetectados(item, depth + 1);
      if (c > max) max = c;
    }
    return max;
  }
  const obj = payload as Record<string, unknown>;
  let max = 0;
  for (const [key, val] of Object.entries(obj)) {
    if (
      [
        "events",
        "matches",
        "items",
        "data",
        "list",
        "results",
        "fixtures",
      ].includes(key.toLowerCase()) ||
      Array.isArray(val) ||
      (val && typeof val === "object")
    ) {
      const c = contarEventosDetectados(val, depth + 1);
      if (c > max) max = c;
    }
  }
  return max;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

async function probarUnEndpoint(
  endpoint: EndpointDef,
  source: string,
): Promise<ProbeResultado> {
  const tInicio = Date.now();
  try {
    const probe = await httpProbeJson<unknown>(endpoint.url, {
      source,
      timeoutMs: TIMEOUT_PROBE_MS,
      headers: endpoint.headers,
    });
    const ms = Date.now() - tInicio;
    const bodyPreview = (probe.rawText ?? "").slice(0, MAX_BODY_PREVIEW_CHARS);
    const eventosDetectados =
      probe.status === 200 && probe.data !== null
        ? contarEventosDetectados(probe.data)
        : 0;
    return {
      url: endpoint.url,
      status: probe.status,
      ms,
      bodyPreview,
      eventosDetectados,
    };
  } catch (err) {
    const ms = Date.now() - tInicio;
    const errMsg =
      err instanceof Error ? err.message : String(err ?? "error desconocido");
    return {
      url: endpoint.url,
      status: "fetch-fail",
      ms,
      bodyPreview: "",
      eventosDetectados: 0,
      errorRecogido: errMsg.slice(0, 300),
    };
  }
}

/**
 * Ejecuta probes contra todos los endpoints de discovery de las 7 casas en
 * paralelo (paralelismo total — ~25 requests simultáneos, todas las casas
 * son independientes). Devuelve resumen estructurado para que el endpoint
 * admin lo serialice como JSON.
 */
export async function ejecutarDiagnosticoEndpoints(): Promise<DiagnosticoCompleto> {
  const iniciadoEn = new Date();
  const tInicio = Date.now();

  const promesas: Promise<DiagnosticoCasa>[] = (
    Object.keys(ENDPOINTS_POR_CASA) as CasaCuotas[]
  ).map(async (casa) => {
    const defs = ENDPOINTS_POR_CASA[casa];
    const resultados = await Promise.all(
      defs.map((d) => probarUnEndpoint(d, `diagnostico:${casa}`)),
    );
    let totalEventosDetectados = 0;
    let mejorEndpoint: string | null = null;
    let mejorCount = 0;
    for (const r of resultados) {
      totalEventosDetectados += r.eventosDetectados;
      if (r.eventosDetectados > mejorCount) {
        mejorCount = r.eventosDetectados;
        mejorEndpoint = r.url;
      }
    }
    return {
      casa,
      endpoints: resultados,
      totalEventosDetectados,
      mejorEndpoint,
    };
  });

  const casas = await Promise.all(promesas);
  const duracionMs = Date.now() - tInicio;

  logger.info(
    {
      duracionMs,
      casas: casas.map((c) => ({
        casa: c.casa,
        endpoints: c.endpoints.length,
        totalEventos: c.totalEventosDetectados,
        mejorEndpoint: c.mejorEndpoint,
      })),
      source: "diagnostico-endpoints",
    },
    `diagnóstico endpoints completado en ${duracionMs}ms`,
  );

  return { iniciadoEn, duracionMs, casas };
}
