// Scraper Te Apuesto via API directa Coreix (Lote V.11.1 — May 2026).
//
// Te Apuesto usa Coreix (api-latam.core-ix.com) como backend B2B.
// Validado el 2026-05-08 con JSON real provisto por admin (urls2.txt) que
// el endpoint:
//   https://api-latam.core-ix.com/api/v1/tournament-events
// responde con shape:
//   {
//     data: {
//       sports: { ... },
//       categories: { ... },
//       tournaments: {
//         "1899": {
//           id, name, events: [{
//             id, name, start_time, status,
//             competitors: { id: { name, type: "home" | "away" } },
//             markets: [{
//               name, provider_market_id, type,
//               market_odds: [{ odds: [{ value, provider_odd_id, name, special_value? }] }]
//             }]
//           }]
//         }
//       },
//       markets: { ... },
//       market_groups: { ... }
//     }
//   }
//
// El endpoint requiere identificar el torneo via query param. La URL del
// frontend usa `?id=1,476,1899` (sport, country, tournament). Probamos
// primero `tournament_id={id}` como fallback más limpio; si no responde,
// el response sigue agrupando por tournament internamente así que la
// tupla completa también sirve.
//
// Mapeo provider_odd_id (común a varios proveedores latinoamericanos):
//   1X2:           "1" / "2" / "3"     → Local / Empate / Visita
//   Doble Op:      "9" / "10" / "11"   → 1X / 12 / X2
//   Más/Menos:     "12" / "13"         → Más / Menos (con special_value="2.5")
//   BTTS:          "74" / "76"         → Sí / No
//
// Nombre de mercado por palabra clave:
//   "1x2"                    → 1X2
//   "doble oportunidad"      → Doble Op
//   "ambos equipos marcan"   → BTTS
//   "total"                  → Total goles (filtrar special_value="2.5")

import { logger } from "../logger";
import { httpFetchJson } from "./http";
import { similitudEquipos, UMBRAL_FUZZY_DEFAULT } from "./fuzzy-match";
import type { CuotasCapturadas, ResultadoScraper, Scraper } from "./types";

const URL_BASE = "https://api-latam.core-ix.com";

interface CoreixOdd {
  id?: number | string;
  provider_odd_id?: string;
  feed_id?: number;
  name?: string;
  value?: number;
  order?: number;
  special_value?: string;
}

interface CoreixMarketOdd {
  is_favorite?: boolean;
  specifier_id?: number;
  odds?: CoreixOdd[];
  name?: string;
}

interface CoreixMarket {
  id?: number | string;
  provider_market_id?: string;
  type?: number;
  template_type?: number;
  name?: string;
  market_odds?: CoreixMarketOdd[];
}

interface CoreixCompetitor {
  id?: number;
  name?: string;
  type?: "home" | "away";
}

interface CoreixEvent {
  id?: number;
  code?: number;
  name?: string;
  start_time?: string;
  competitors?: Record<string, CoreixCompetitor>;
  markets?: CoreixMarket[];
}

interface CoreixTournament {
  id?: number;
  name?: string;
  events?: CoreixEvent[];
}

interface CoreixResponse {
  data?: {
    tournaments?: Record<string, CoreixTournament>;
  };
}

const teApuestoScraper: Scraper = {
  nombre: "te_apuesto",

  async capturarPorApi(partido, ligaIdCasa) {
    // Frontend usa `?id=1,476,1899` (sport,country,tournament). Probamos
    // primero `tournament_id` puro; el JSON real validado usaba esa forma.
    const urls = [
      `${URL_BASE}/api/v1/tournament-events?tournament_id=${ligaIdCasa}&language_id=1`,
      `${URL_BASE}/api/v1/tournament-events?id=1,476,${ligaIdCasa}&language_id=1`,
    ];

    let body: CoreixResponse | null = null;
    let urlUsado: string | null = null;

    for (const url of urls) {
      try {
        body = await httpFetchJson<CoreixResponse>(url, {
          headers: {
            Origin: "https://www.teapuesto.pe",
            Referer: "https://www.teapuesto.pe/",
          },
          source: "scrapers:te-apuesto",
        });
        urlUsado = url;
        break;
      } catch (err) {
        logger.debug(
          {
            url,
            err: (err as Error).message,
            source: "scrapers:te-apuesto",
          },
          `te-apuesto: variante de URL no respondió, probando siguiente`,
        );
      }
    }

    if (!body || !urlUsado) {
      throw new Error("te-apuesto: ninguna variante de URL respondió");
    }

    const tournaments = body.data?.tournaments ?? {};
    const tournament =
      tournaments[ligaIdCasa] ??
      Object.values(tournaments).find((t) => String(t.id) === ligaIdCasa) ??
      null;

    const events = tournament?.events ?? [];

    if (events.length === 0) {
      logger.warn(
        {
          partidoId: partido.id,
          ligaIdCasa,
          tournamentsKeys: Object.keys(tournaments),
          source: "scrapers:te-apuesto",
        },
        `te-apuesto: tournament no contiene eventos`,
      );
      return null;
    }

    let mejor: CoreixEvent | null = null;
    let mejorScore = 0;
    for (const event of events) {
      const home = extractCompetitor(event, "home");
      const away = extractCompetitor(event, "away");
      if (!home || !away) continue;
      const sLocal = similitudEquipos(home, partido.equipoLocal);
      const sVisita = similitudEquipos(away, partido.equipoVisita);
      const score = Math.min(sLocal, sVisita);
      if (score > mejorScore) {
        mejorScore = score;
        mejor = event;
      }
    }

    if (!mejor || mejorScore < UMBRAL_FUZZY_DEFAULT * 0.7) {
      logger.info(
        {
          partidoId: partido.id,
          equipoLocal: partido.equipoLocal,
          equipoVisita: partido.equipoVisita,
          ligaIdCasa,
          totalEvents: events.length,
          mejorScore,
          source: "scrapers:te-apuesto",
        },
        `te-apuesto: partido no encontrado en response`,
      );
      return null;
    }

    const cuotas = mapearCuotasCoreix(mejor);

    if (Object.keys(cuotas).length === 0) {
      logger.warn(
        {
          partidoId: partido.id,
          eventId: mejor.id,
          markets: mejor.markets?.length ?? 0,
          marketNames: mejor.markets?.map((m) => m.name),
          source: "scrapers:te-apuesto",
        },
        `te-apuesto: evento encontrado pero sin mercados extraíbles. Revisar shape.`,
      );
      return null;
    }

    return {
      cuotas,
      fuente: { url: urlUsado, capturadoEn: new Date() },
      eventIdCasa: String(mejor.id ?? ""),
      equipos: {
        local: extractCompetitor(mejor, "home") ?? partido.equipoLocal,
        visita: extractCompetitor(mejor, "away") ?? partido.equipoVisita,
      },
    };
  },
};

function extractCompetitor(
  event: CoreixEvent,
  rol: "home" | "away",
): string | null {
  if (!event.competitors) return null;
  const found = Object.values(event.competitors).find((c) => c.type === rol);
  return found?.name ?? null;
}

function mapearCuotasCoreix(event: CoreixEvent): CuotasCapturadas {
  const cuotas: CuotasCapturadas = {};

  const norm = (s: string | undefined): string =>
    (s ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();

  const priceOk = (v: number | undefined): number | null =>
    typeof v === "number" && v > 1 && v < 100 ? v : null;

  // Aplanar todas las odds del evento con info de su mercado.
  type FlatOdd = CoreixOdd & {
    marketName: string;
    providerMarketId: string;
  };
  const allOdds: FlatOdd[] = [];
  for (const market of event.markets ?? []) {
    const marketName = norm(market.name);
    const providerMarketId = String(market.provider_market_id ?? "");
    for (const mo of market.market_odds ?? []) {
      for (const o of mo.odds ?? []) {
        allOdds.push({ ...o, marketName, providerMarketId });
      }
    }
  }

  // 1X2: market.name="1x2" o providerMarketId="1"
  const odds1x2 = allOdds.filter(
    (o) => o.marketName === "1x2" || o.providerMarketId === "1",
  );
  if (odds1x2.length > 0) {
    const local = odds1x2.find((o) => o.provider_odd_id === "1");
    const empate = odds1x2.find((o) => o.provider_odd_id === "2");
    const visita = odds1x2.find((o) => o.provider_odd_id === "3");
    const lP = priceOk(local?.value);
    const eP = priceOk(empate?.value);
    const vP = priceOk(visita?.value);
    if (lP && eP && vP) cuotas["1x2"] = { local: lP, empate: eP, visita: vP };
  }

  // Doble Op: market.name contiene "doble"
  const oddsDoble = allOdds.filter(
    (o) => o.marketName.includes("doble") || o.providerMarketId === "10",
  );
  if (oddsDoble.length > 0) {
    const x1 = oddsDoble.find((o) => o.provider_odd_id === "9");
    const x12 = oddsDoble.find((o) => o.provider_odd_id === "10");
    const xx2 = oddsDoble.find((o) => o.provider_odd_id === "11");
    const x1P = priceOk(x1?.value);
    const x12P = priceOk(x12?.value);
    const xx2P = priceOk(xx2?.value);
    if (x1P && x12P && xx2P) {
      cuotas.doble_op = { x1: x1P, x12: x12P, xx2: xx2P };
    }
  }

  // BTTS: market.name contiene "ambos" o providerMarketId="29"
  const oddsBtts = allOdds.filter(
    (o) =>
      o.marketName.includes("ambos") ||
      o.marketName.includes("btts") ||
      o.providerMarketId === "29",
  );
  if (oddsBtts.length > 0) {
    const si = oddsBtts.find((o) => o.provider_odd_id === "74");
    const no = oddsBtts.find((o) => o.provider_odd_id === "76");
    const sP = priceOk(si?.value);
    const nP = priceOk(no?.value);
    if (sP && nP) cuotas.btts = { si: sP, no: nP };
  }

  // Total goles 2.5: market.name="total" filtrar special_value="2.5"
  // Excluir explícitamente "1º Mitad - total" / "2º Mitad - total" para
  // que no roben el match — sólo queremos el total del partido completo.
  const oddsTotal = allOdds.filter(
    (o) =>
      (o.marketName === "total" || o.providerMarketId === "18") &&
      o.special_value === "2.5",
  );
  if (oddsTotal.length > 0) {
    const over = oddsTotal.find((o) => o.provider_odd_id === "12");
    const under = oddsTotal.find((o) => o.provider_odd_id === "13");
    const oP = priceOk(over?.value);
    const uP = priceOk(under?.value);
    if (oP && uP) cuotas.mas_menos_25 = { over: oP, under: uP };
  }

  return cuotas;
}

export default teApuestoScraper;
