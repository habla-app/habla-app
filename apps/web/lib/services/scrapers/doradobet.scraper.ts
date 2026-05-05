// Scraper Doradobet via API directa de Altenar (Lote V.11 — May 2026).
//
// Validado el 2026-05-05 con response real desde Railway US:
//   - URL: https://sb2frontend-altenar2.biahosted.com/api/widget/GetEvents
//   - Status 200, ~30 KB, 139ms desde Railway US.
//   - 9 partidos de Liga 1 Perú extraídos correctamente con sus 4 mercados.
//
// Estructura del response Altenar:
//   - events[]: metadata de cada partido (id, name, marketIds, competitorIds).
//   - markets[]: definiciones de mercado (id, oddIds, typeId, sv, sn).
//   - odds[]: cuotas individuales (id, typeId, price, name).
//   - competitors[]: equipos (id, name).
//
// Mapeo typeId del MERCADO:
//   1   = 1X2
//   10  = Doble Oportunidad
//   18  = Total (más/menos goles, sv = línea)
//   29  = Ambos equipos marcan
//
// Mapeo typeId de la SELECCIÓN dentro del mercado:
//   1/2/3   = Local/Empate/Visita en 1X2
//   9/10/11 = 1X / 12 / X2 en Doble Op
//   12/13   = Más / Menos en Total
//   74/76   = Sí / No en BTTS

import { logger } from "../logger";
import { httpFetchJson } from "./http";
import { similitudEquipos, UMBRAL_FUZZY_DEFAULT } from "./fuzzy-match";
import type { CuotasCapturadas, ResultadoScraper, Scraper } from "./types";

interface AltenarEvent {
  id: number;
  name: string;
  startDate: string;
  marketIds: number[];
  competitorIds: number[];
  champId: number;
}

interface AltenarMarket {
  id: number;
  typeId: number;
  oddIds: number[];
  name: string;
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

interface AltenarResponse {
  events: AltenarEvent[];
  markets: AltenarMarket[];
  odds: AltenarOdd[];
  competitors: AltenarCompetitor[];
}

const URL_BASE = "https://sb2frontend-altenar2.biahosted.com";

const MARKET_1X2 = 1;
const MARKET_DOBLE_OP = 10;
const MARKET_TOTAL = 18;
const MARKET_BTTS = 29;

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

const doradobetScraper: Scraper = {
  nombre: "doradobet",

  async capturarPorApi(partido, ligaIdCasa) {
    const url =
      `${URL_BASE}/api/widget/GetEvents?` +
      new URLSearchParams({
        culture: "es-ES",
        timezoneOffset: "240",
        integration: "doradobet",
        deviceType: "1",
        numFormat: "en-GB",
        countryCode: "PE",
        eventCount: "0",
        sportId: "0",
        champIds: ligaIdCasa,
      });

    const body = await httpFetchJson<AltenarResponse>(url, {
      headers: {
        Origin: "https://doradobet.com",
        Referer: "https://doradobet.com/",
      },
      source: "scrapers:doradobet",
    });

    // Index para búsquedas O(1).
    const competitorsById = new Map<number, AltenarCompetitor>();
    for (const c of body.competitors ?? []) competitorsById.set(c.id, c);

    // Buscar evento por matching de equipos.
    const event = encontrarEventoPorEquipos(
      body.events ?? [],
      competitorsById,
      partido.equipoLocal,
      partido.equipoVisita,
    );
    if (!event) {
      logger.info(
        {
          partidoId: partido.id,
          equipoLocal: partido.equipoLocal,
          equipoVisita: partido.equipoVisita,
          ligaIdCasa,
          totalEventosEnResponse: body.events?.length ?? 0,
          source: "scrapers:doradobet",
        },
        `doradobet: partido no encontrado en response Altenar`,
      );
      return null;
    }

    // Index markets/odds.
    const marketsById = new Map<number, AltenarMarket>();
    for (const m of body.markets ?? []) marketsById.set(m.id, m);
    const oddsById = new Map<number, AltenarOdd>();
    for (const o of body.odds ?? []) oddsById.set(o.id, o);

    const cuotas: CuotasCapturadas = {};

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
        if (l && e && v) cuotas["1x2"] = { local: l, empate: e, visita: v };
      } else if (market.typeId === MARKET_DOBLE_OP) {
        const x1 = odds.find((o) => o.typeId === ODD_DOBLE_1X)?.price;
        const x12 = odds.find((o) => o.typeId === ODD_DOBLE_12)?.price;
        const xx2 = odds.find((o) => o.typeId === ODD_DOBLE_X2)?.price;
        if (x1 && x12 && xx2) cuotas.doble_op = { x1, x12, xx2 };
      } else if (market.typeId === MARKET_TOTAL && market.sv === "2.5") {
        const over = odds.find((o) => o.typeId === ODD_OVER)?.price;
        const under = odds.find((o) => o.typeId === ODD_UNDER)?.price;
        if (over && under) cuotas.mas_menos_25 = { over, under };
      } else if (market.typeId === MARKET_BTTS) {
        const si = odds.find((o) => o.typeId === ODD_BTTS_SI)?.price;
        const no = odds.find((o) => o.typeId === ODD_BTTS_NO)?.price;
        if (si && no) cuotas.btts = { si, no };
      }
    }

    if (Object.keys(cuotas).length === 0) {
      logger.warn(
        {
          partidoId: partido.id,
          eventIdAltenar: event.id,
          source: "scrapers:doradobet",
        },
        `doradobet: evento encontrado pero ningún mercado extraído`,
      );
      return null;
    }

    const equipoLocalCasa =
      competitorsById.get(event.competitorIds?.[0] ?? -1)?.name ??
      partido.equipoLocal;
    const equipoVisitaCasa =
      competitorsById.get(event.competitorIds?.[1] ?? -1)?.name ??
      partido.equipoVisita;

    return {
      cuotas,
      fuente: { url, capturadoEn: new Date() },
      eventIdCasa: String(event.id),
      equipos: { local: equipoLocalCasa, visita: equipoVisitaCasa },
    };
  },
};

/**
 * Busca un evento del response Altenar matcheando por nombres de
 * equipos. Usa exact match normalizado primero, fuzzy Jaro-Winkler como
 * fallback.
 */
function encontrarEventoPorEquipos(
  events: AltenarEvent[],
  competitorsById: Map<number, AltenarCompetitor>,
  equipoLocal: string,
  equipoVisita: string,
): AltenarEvent | null {
  let mejor: AltenarEvent | null = null;
  let mejorScore = 0;
  for (const event of events) {
    const local = competitorsById.get(event.competitorIds?.[0] ?? -1)?.name;
    const visita = competitorsById.get(event.competitorIds?.[1] ?? -1)?.name;
    if (!local || !visita) continue;
    const sLocal = similitudEquipos(local, equipoLocal);
    const sVisita = similitudEquipos(visita, equipoVisita);
    const score = Math.min(sLocal, sVisita);
    if (score > mejorScore) {
      mejorScore = score;
      mejor = event;
    }
  }
  if (mejorScore < UMBRAL_FUZZY_DEFAULT * 0.7) return null;
  return mejor;
}

export default doradobetScraper;
