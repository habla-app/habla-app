// Scraper Apuesta Total via API directa Kambi (Lote V.11.1 — May 2026).
//
// Apuesta Total embebe el sportsbook de Kambi via prod20392.kmianko.com.
// Validado el 2026-05-08 con JSON real provisto por admin (urls2.txt).
//
// Flow de 2 pasos:
//
//   1) GET /api/pulse/snapshot/events?lang=ES-PE
//      → array de FIXTURES con `_id`, `EventName`, `MasterLeagueId`,
//        `Participants[]`, `TotalMarketsCount`, etc.
//      → filtramos por `MasterLeagueId === ligaIdCasa` y matcheamos
//        equipos contra el partido.
//
//   2) GET /api/eventlist/eu/markets/all?markets={eventId}:ML0|DC|OU0|QA158
//      → array de MARKETS para esos eventos × esos tipos. Cada market
//        tiene `MarketType._id`, `EventId`, `Selections[]` con `TrueOdds`
//        + `OutcomeType` ("Local" / "Empate" / "Visita") + `Side` (1/2/3).
//
// MarketType IDs de Kambi (validados con JSON real):
//   - "ML0"   → Resultado del partido (1X2)
//   - "DC"    → Doble Oportunidad (probable; fallback "ML9")
//   - "OU0"   → Total goles Más/Menos (con line)
//   - "QA158" → Ambos equipos anotan
//
// Selection.OutcomeType ya viene normalizado en español:
//   "Local" / "Empate" / "Visita" para 1X2.
//   "Más" / "Menos" para Total.
//   "Sí" / "No" para BTTS.
//   "1X" / "12" / "X2" en BetslipLine para Doble Op (cuando aplica).

import { logger } from "../logger";
import { httpFetchJson } from "./http";
import { similitudEquipos, UMBRAL_FUZZY_DEFAULT } from "./fuzzy-match";
import type { CuotasCapturadas, ResultadoScraper, Scraper } from "./types";

const URL_BASE = "https://prod20392.kmianko.com";
const URL_SNAPSHOT = `${URL_BASE}/api/pulse/snapshot/events?lang=ES-PE`;

// Tipos a pedir en el segundo fetch: 1X2, Doble Op, Total goles, BTTS.
// Si Apuesta Total no expone DC, no rompe — la API solo devuelve los IDs
// que existen.
const MARKET_TYPES_DESEADOS = ["ML0", "DC", "ML9", "OU0", "QA158"];

interface KambiParticipant {
  _id: string;
  Name: string;
  VenueRole: "Home" | "Away";
}

interface KambiFixture {
  _id: string;
  Type: string;
  EventName: string;
  StartEventDate: number;
  LeagueId?: string;
  LeagueName?: string;
  MasterLeagueId?: string;
  RegionId?: string;
  RegionName?: string;
  Participants?: KambiParticipant[];
  TotalMarketsCount?: number;
}

interface KambiSelection {
  _id: string;
  BetslipLine?: string;
  Name?: string;
  OutcomeType?: "Local" | "Empate" | "Visita" | "Más" | "Menos" | "Sí" | "No" | string;
  TrueOdds?: number;
  DisplayOdds?: { Decimal?: string };
  Side?: number;
  IsDisabled?: boolean;
  IsRemoved?: boolean;
  EventId?: string;
  MarketId?: string;
  QAParam1?: number;
  QAParam2?: number;
}

interface KambiMarketType {
  _id?: string;
  Name?: string;
  LineTypeId?: number;
  LineTypeName?: string;
}

interface KambiMarket {
  _id?: string;
  EventId?: string;
  MarketType?: KambiMarketType;
  Name?: string;
  Selections?: KambiSelection[];
  IsSuspended?: boolean;
  IsRemoved?: boolean;
  // El line del Total puede venir en QAParam1 de las selections,
  // o como Tag/Metadata según versión.
}

const apuestaTotalScraper: Scraper = {
  nombre: "apuesta_total",

  async capturarPorApi(partido, ligaIdCasa) {
    // Paso 1: snapshot — fixtures sin cuotas, filtrados por liga.
    const fixtures = await httpFetchJson<KambiFixture[]>(URL_SNAPSHOT, {
      headers: {
        Origin: "https://www.apuestatotal.com",
        Referer: "https://www.apuestatotal.com/",
      },
      timeoutMs: 25_000,
      source: "scrapers:apuesta-total",
    });

    if (!Array.isArray(fixtures)) {
      logger.warn(
        {
          partidoId: partido.id,
          source: "scrapers:apuesta-total",
        },
        `apuesta-total: snapshot no es array — formato inesperado`,
      );
      return null;
    }

    const ligaFixtures = fixtures.filter(
      (f) => f.MasterLeagueId === ligaIdCasa,
    );

    if (ligaFixtures.length === 0) {
      logger.info(
        {
          partidoId: partido.id,
          ligaIdCasa,
          totalFixturesEnResponse: fixtures.length,
          source: "scrapers:apuesta-total",
        },
        `apuesta-total: ningún fixture matchea MasterLeagueId=${ligaIdCasa}`,
      );
      return null;
    }

    let mejor: KambiFixture | null = null;
    let mejorScore = 0;
    for (const fixture of ligaFixtures) {
      const home = fixture.Participants?.find(
        (p) => p.VenueRole === "Home",
      )?.Name;
      const away = fixture.Participants?.find(
        (p) => p.VenueRole === "Away",
      )?.Name;
      if (!home || !away) continue;
      const sLocal = similitudEquipos(home, partido.equipoLocal);
      const sVisita = similitudEquipos(away, partido.equipoVisita);
      const score = Math.min(sLocal, sVisita);
      if (score > mejorScore) {
        mejorScore = score;
        mejor = fixture;
      }
    }

    if (!mejor || mejorScore < UMBRAL_FUZZY_DEFAULT * 0.7) {
      logger.info(
        {
          partidoId: partido.id,
          equipoLocal: partido.equipoLocal,
          equipoVisita: partido.equipoVisita,
          ligaIdCasa,
          fixturesEnLiga: ligaFixtures.length,
          mejorScore,
          source: "scrapers:apuesta-total",
        },
        `apuesta-total: partido no encontrado en fixtures de la liga`,
      );
      return null;
    }

    const eventId = mejor._id;
    const home = mejor.Participants?.find((p) => p.VenueRole === "Home")?.Name;
    const away = mejor.Participants?.find((p) => p.VenueRole === "Away")?.Name;

    // Paso 2: markets/all — cuotas para los tipos de mercado deseados.
    // Format: ?markets={eventId}:{ML0|DC|...}
    const marketsParam = `${eventId}:${MARKET_TYPES_DESEADOS.join("|")}`;
    const urlMarkets = `${URL_BASE}/api/eventlist/eu/markets/all?markets=${encodeURIComponent(marketsParam)}`;

    let markets: KambiMarket[] = [];
    try {
      const body = await httpFetchJson<KambiMarket[]>(urlMarkets, {
        headers: {
          Origin: "https://www.apuestatotal.com",
          Referer: "https://www.apuestatotal.com/",
        },
        source: "scrapers:apuesta-total",
      });
      if (Array.isArray(body)) markets = body;
    } catch (err) {
      logger.warn(
        {
          partidoId: partido.id,
          eventId,
          err: (err as Error).message,
          source: "scrapers:apuesta-total",
        },
        `apuesta-total: 2do fetch (markets/all) falló`,
      );
      return null;
    }

    if (markets.length === 0) {
      logger.warn(
        {
          partidoId: partido.id,
          eventId,
          source: "scrapers:apuesta-total",
        },
        `apuesta-total: 2do fetch retornó array vacío`,
      );
      return null;
    }

    const cuotas = mapearCuotasKambi(markets);

    if (Object.keys(cuotas).length === 0) {
      logger.warn(
        {
          partidoId: partido.id,
          eventId,
          marketsCount: markets.length,
          marketTypes: markets.map((m) => m.MarketType?._id),
          source: "scrapers:apuesta-total",
        },
        `apuesta-total: markets recibidos pero ningún mercado extraíble`,
      );
      return null;
    }

    return {
      cuotas,
      fuente: { url: urlMarkets, capturadoEn: new Date() },
      eventIdCasa: eventId,
      equipos: {
        local: home ?? partido.equipoLocal,
        visita: away ?? partido.equipoVisita,
      },
    };
  },
};

function mapearCuotasKambi(markets: KambiMarket[]): CuotasCapturadas {
  const cuotas: CuotasCapturadas = {};

  const norm = (s: string | undefined): string =>
    (s ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();

  const priceOk = (s: KambiSelection): number | null => {
    const v = s.TrueOdds ?? Number(s.DisplayOdds?.Decimal);
    return typeof v === "number" && Number.isFinite(v) && v > 1 && v < 100
      ? v
      : null;
  };

  for (const market of markets) {
    if (market.IsSuspended || market.IsRemoved) continue;
    const tipoId = market.MarketType?._id ?? "";
    const sels = (market.Selections ?? []).filter(
      (s) => !s.IsDisabled && !s.IsRemoved,
    );

    // 1X2: ML0
    if (tipoId === "ML0" && !cuotas["1x2"]) {
      const local = sels.find((s) => s.OutcomeType === "Local" || s.Side === 1);
      const empate = sels.find((s) => s.OutcomeType === "Empate" || s.Side === 2);
      const visita = sels.find((s) => s.OutcomeType === "Visita" || s.Side === 3);
      const lP = local && priceOk(local);
      const eP = empate && priceOk(empate);
      const vP = visita && priceOk(visita);
      if (lP && eP && vP) cuotas["1x2"] = { local: lP, empate: eP, visita: vP };
    }

    // Doble Op: DC o ML9
    else if ((tipoId === "DC" || tipoId === "ML9") && !cuotas.doble_op) {
      const x1 = sels.find((s) => norm(s.BetslipLine ?? s.Name) === "1x");
      const x12 = sels.find((s) => norm(s.BetslipLine ?? s.Name) === "12");
      const xx2 = sels.find((s) => norm(s.BetslipLine ?? s.Name) === "x2");
      const x1P = x1 && priceOk(x1);
      const x12P = x12 && priceOk(x12);
      const xx2P = xx2 && priceOk(xx2);
      if (x1P && x12P && xx2P) {
        cuotas.doble_op = { x1: x1P, x12: x12P, xx2: xx2P };
      }
    }

    // Total goles: OU0 — buscar selections con line=2.5 (puede haber
    // múltiples líneas; QAParam1 o BetslipLine "Más 2.5" / "Menos 2.5"
    // suelen indicar el line)
    else if (tipoId === "OU0" && !cuotas.mas_menos_25) {
      const over = sels.find((s) => {
        const line = String(s.QAParam1 ?? "");
        const bs = norm(s.BetslipLine);
        return (
          (s.OutcomeType === "Más" || bs.startsWith("mas")) &&
          (line === "2.5" || bs.includes("2.5"))
        );
      });
      const under = sels.find((s) => {
        const line = String(s.QAParam1 ?? "");
        const bs = norm(s.BetslipLine);
        return (
          (s.OutcomeType === "Menos" || bs.startsWith("menos")) &&
          (line === "2.5" || bs.includes("2.5"))
        );
      });
      const oP = over && priceOk(over);
      const uP = under && priceOk(under);
      if (oP && uP) cuotas.mas_menos_25 = { over: oP, under: uP };
    }

    // BTTS: QA158
    else if (tipoId === "QA158" && !cuotas.btts) {
      const si = sels.find(
        (s) =>
          s.OutcomeType === "Sí" ||
          norm(s.Name) === "si" ||
          norm(s.Name) === "sí" ||
          norm(s.BetslipLine) === "sí" ||
          norm(s.BetslipLine) === "si",
      );
      const no = sels.find(
        (s) =>
          s.OutcomeType === "No" ||
          norm(s.Name) === "no" ||
          norm(s.BetslipLine) === "no",
      );
      const sP = si && priceOk(si);
      const nP = no && priceOk(no);
      if (sP && nP) cuotas.btts = { si: sP, no: nP };
    }
  }

  return cuotas;
}

export default apuestaTotalScraper;
