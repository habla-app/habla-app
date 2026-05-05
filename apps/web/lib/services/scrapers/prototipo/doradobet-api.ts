// Extractor HTTP directo para Doradobet (Altenar B2B).
//
// Doradobet usa Altenar como proveedor de plataforma de sportsbook. Su
// frontend hace requests al endpoint público de Altenar para cargar los
// partidos. Como la API tiene `access-control-allow-origin: *`, podemos
// llamarla directamente desde server-side sin Playwright ni browser
// headless.
//
// Validado el 2026-05-05 con response real capturado por el admin desde
// DevTools de Firefox. La estructura del JSON está documentada abajo.
//
// Ventajas vs scraping del DOM:
//   - 1 request HTTP en vez de browser + render + DOM walk.
//   - No requiere IP peruana (CORS abierto).
//   - JSON estructurado, sin ambigüedad de selectores.
//   - Una sola request trae TODOS los partidos de la liga.
//
// Desventajas:
//   - Si Altenar cambia el shape del JSON, hay que actualizar el parser.
//   - Si Altenar agrega rate limiting o auth, se rompe.
//   - Pero la API es de uso público frontend — cambios mayores son raros.

import { logger } from "../../logger";

// ─── Tipos del response de Altenar ─────────────────────────────────────

interface AltenarEvent {
  id: number;
  name: string;
  startDate: string;
  marketIds: number[];
  competitorIds: number[];
  champId: number;
  catId: number;
  sportId: number;
  status: number;
}

interface AltenarMarket {
  id: number;
  typeId: number;
  oddIds: number[];
  name: string;
  /** "sv" + "sn" indica el "valor especial" del mercado.
   *  Ej. para Total: sv="2.5" significa Más/Menos 2.5 goles. */
  sv?: string;
  sn?: string;
}

interface AltenarOdd {
  id: number;
  typeId: number;
  price: number;
  name: string;
  competitorId?: number;
}

interface AltenarCompetitor {
  id: number;
  name: string;
}

interface AltenarChamp {
  id: number;
  name: string;
}

interface AltenarResponse {
  events: AltenarEvent[];
  markets: AltenarMarket[];
  odds: AltenarOdd[];
  competitors: AltenarCompetitor[];
  champs: AltenarChamp[];
}

// ─── Constantes del modelo de Altenar ──────────────────────────────────
//
// Estas se infieren del response real. Documentadas para que el lector
// futuro pueda mapear en la cabeza qué significa cada typeId.

/** typeId del MERCADO (en `markets[].typeId`). */
const MARKET_1X2 = 1;
const MARKET_DOBLE_OP = 10;
const MARKET_TOTAL = 18; // Más/Menos goles
const MARKET_BTTS = 29; // Ambos equipos marcan

/** typeId de la SELECCIÓN dentro de un mercado (en `odds[].typeId`). */
const ODD_LOCAL = 1;
const ODD_EMPATE = 2;
const ODD_VISITA = 3;
const ODD_DOBLE_1X = 9;
const ODD_DOBLE_12 = 10;
const ODD_DOBLE_X2 = 11;
const ODD_OVER = 12;
const ODD_UNDER = 13;
const ODD_BTTS_SI = 74;
const ODD_BTTS_NO = 76;

/** champId de Liga 1 Perú según el JSON real. */
export const CHAMP_ID_LIGA_1_PERU = 4042;

// ─── Tipos de salida ───────────────────────────────────────────────────

export interface CuotasPartido {
  eventId: number;
  nombre: string;
  startDate: string;
  equipoLocal: string;
  equipoVisita: string;
  cuotas: {
    m1x2: { local: number; empate: number; visita: number } | null;
    mDoble: { x1: number; x12: number; xx2: number } | null;
    mMasMenos25: { over: number; under: number } | null;
    mBtts: { si: number; no: number } | null;
  };
}

export interface ResultadoExtraccion {
  ok: boolean;
  champId: number;
  totalPartidos: number;
  partidos: CuotasPartido[];
  raw: {
    httpStatus: number | null;
    bytes: number;
    ms: number;
    url: string;
  };
  error?: string;
}

// ─── Builder de URL ────────────────────────────────────────────────────

/**
 * Construye la URL del endpoint Altenar para una liga (champId) específica
 * de Doradobet. El champId se obtiene de la URL pública de Doradobet:
 * `https://doradobet.com/deportes/liga/{champId}` → ej. 4042 para Liga 1 Perú.
 */
export function buildAltenarUrl(
  champId: number,
  opts?: { integration?: string },
): string {
  const integration = opts?.integration ?? "doradobet";
  const params = new URLSearchParams({
    culture: "es-ES",
    timezoneOffset: "240",
    integration,
    deviceType: "1",
    numFormat: "en-GB",
    countryCode: "PE",
    eventCount: "0",
    sportId: "0",
    champIds: String(champId),
  });
  return `https://sb2frontend-altenar2.biahosted.com/api/widget/GetEvents?${params}`;
}

// ─── Fetch + parser ────────────────────────────────────────────────────

/**
 * Descarga el JSON de Altenar para una liga y devuelve las cuotas
 * extraídas para los 4 mercados que el motor necesita.
 *
 * Headers cuidados para imitar al frontend (algunas APIs validan Origin):
 *   - Origin: https://doradobet.com
 *   - Referer: https://doradobet.com/
 *   - Accept: application/json
 *   - User-Agent realista (no Node default).
 */
export async function fetchCuotasDoradobet(
  champId: number = CHAMP_ID_LIGA_1_PERU,
): Promise<ResultadoExtraccion> {
  const url = buildAltenarUrl(champId);
  const tInicio = Date.now();

  let response: Response;
  let body: AltenarResponse;
  let httpStatus: number | null = null;
  let bytes = 0;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "es-PE,es;q=0.9,en;q=0.8",
        Origin: "https://doradobet.com",
        Referer: "https://doradobet.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
      },
    });
    httpStatus = response.status;
  } catch (err) {
    return {
      ok: false,
      champId,
      totalPartidos: 0,
      partidos: [],
      raw: {
        httpStatus: null,
        bytes: 0,
        ms: Date.now() - tInicio,
        url,
      },
      error: `fetch falló: ${(err as Error).message}`,
    };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      ok: false,
      champId,
      totalPartidos: 0,
      partidos: [],
      raw: {
        httpStatus,
        bytes: text.length,
        ms: Date.now() - tInicio,
        url,
      },
      error: `HTTP ${httpStatus}: ${text.slice(0, 200)}`,
    };
  }

  try {
    const text = await response.text();
    bytes = text.length;
    body = JSON.parse(text) as AltenarResponse;
  } catch (err) {
    return {
      ok: false,
      champId,
      totalPartidos: 0,
      partidos: [],
      raw: {
        httpStatus,
        bytes,
        ms: Date.now() - tInicio,
        url,
      },
      error: `parsing JSON falló: ${(err as Error).message}`,
    };
  }

  // Mapear el JSON a la estructura del motor.
  const partidos = parsearAltenarResponse(body);
  const ms = Date.now() - tInicio;

  logger.info(
    {
      champId,
      totalPartidos: partidos.length,
      bytes,
      ms,
      source: "scrapers:doradobet-api",
    },
    `doradobet-api · ${partidos.length} partidos en ${ms}ms (${bytes} bytes)`,
  );

  return {
    ok: true,
    champId,
    totalPartidos: partidos.length,
    partidos,
    raw: {
      httpStatus,
      bytes,
      ms,
      url,
    },
  };
}

/**
 * Parser puro del JSON de Altenar. Aislado del fetch para que se pueda
 * testear con un fixture sin red.
 */
export function parsearAltenarResponse(
  body: AltenarResponse,
): CuotasPartido[] {
  // Index para búsquedas O(1) en lugar de O(n) por cada market/odd.
  const marketsById = new Map<number, AltenarMarket>();
  for (const m of body.markets ?? []) marketsById.set(m.id, m);

  const oddsById = new Map<number, AltenarOdd>();
  for (const o of body.odds ?? []) oddsById.set(o.id, o);

  const competitorsById = new Map<number, AltenarCompetitor>();
  for (const c of body.competitors ?? []) competitorsById.set(c.id, c);

  const out: CuotasPartido[] = [];
  for (const event of body.events ?? []) {
    const local =
      competitorsById.get(event.competitorIds?.[0] ?? -1)?.name ?? "";
    const visita =
      competitorsById.get(event.competitorIds?.[1] ?? -1)?.name ?? "";

    const cuotas: CuotasPartido["cuotas"] = {
      m1x2: null,
      mDoble: null,
      mMasMenos25: null,
      mBtts: null,
    };

    for (const marketId of event.marketIds ?? []) {
      const market = marketsById.get(marketId);
      if (!market) continue;
      const odds = (market.oddIds ?? [])
        .map((id) => oddsById.get(id))
        .filter((o): o is AltenarOdd => o !== undefined);

      if (market.typeId === MARKET_1X2) {
        const l = odds.find((o) => o.typeId === ODD_LOCAL)?.price;
        const e = odds.find((o) => o.typeId === ODD_EMPATE)?.price;
        const v = odds.find((o) => o.typeId === ODD_VISITA)?.price;
        if (l && e && v) {
          cuotas.m1x2 = { local: l, empate: e, visita: v };
        }
      } else if (market.typeId === MARKET_DOBLE_OP) {
        const x1 = odds.find((o) => o.typeId === ODD_DOBLE_1X)?.price;
        const x12 = odds.find((o) => o.typeId === ODD_DOBLE_12)?.price;
        const xx2 = odds.find((o) => o.typeId === ODD_DOBLE_X2)?.price;
        if (x1 && x12 && xx2) {
          cuotas.mDoble = { x1, x12, xx2 };
        }
      } else if (market.typeId === MARKET_TOTAL && market.sv === "2.5") {
        const over = odds.find((o) => o.typeId === ODD_OVER)?.price;
        const under = odds.find((o) => o.typeId === ODD_UNDER)?.price;
        if (over && under) {
          cuotas.mMasMenos25 = { over, under };
        }
      } else if (market.typeId === MARKET_BTTS) {
        const si = odds.find((o) => o.typeId === ODD_BTTS_SI)?.price;
        const no = odds.find((o) => o.typeId === ODD_BTTS_NO)?.price;
        if (si && no) {
          cuotas.mBtts = { si, no };
        }
      }
    }

    out.push({
      eventId: event.id,
      nombre: event.name,
      startDate: event.startDate,
      equipoLocal: local,
      equipoVisita: visita,
      cuotas,
    });
  }

  return out;
}
