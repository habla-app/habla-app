// Scraper Betano via API directa Danae (Lote V.11 — May 2026).
//
// Betano usa Danae como backend B2B (proveedor de Stoiximan/Kaizen).
// Validado el 2026-05-05 que el endpoint:
//   https://www.betano.pe/danae-webapi/api/live/overview/latest
// responde con todos los partidos. El user dijo "trae todo, hay que filtrar".
//
// El listado del frontend usa /api/live/overview pero EXISTE un endpoint
// análogo para prematch — conviene buscarlo en una segunda iteración. Por
// ahora intentamos `prematch/overview/latest` como variante natural; si
// no existe, fallback a `live/overview/latest` filtrando solo prematch.
//
// Estructura del JSON: inferida por patrones B2B (Kaizen Group). El
// parser maneja shape flexible. Si el real difiere, ajustamos via
// endpoint diagnóstico.

import { logger } from "../logger";
import { httpFetchJson } from "./http";
import { similitudEquipos, UMBRAL_FUZZY_DEFAULT } from "./fuzzy-match";
import type { CuotasCapturadas, ResultadoScraper, Scraper } from "./types";

const URL_BASE = "https://www.betano.pe";

interface BetanoSelection {
  selectionId?: number | string;
  id?: number | string;
  selnId?: number | string;
  name?: string;
  shortName?: string;
  price?: number;
  decimalOdds?: number;
  odds?: number;
}

interface BetanoMarket {
  marketId?: number | string;
  id?: number | string;
  name?: string;
  shortName?: string;
  type?: string;
  marketType?: string;
  selections?: BetanoSelection[];
  outcomes?: BetanoSelection[];
  specifiers?: Record<string, string>;
  line?: string | number;
}

interface BetanoEvent {
  eventId?: number | string;
  id?: number | string;
  name?: string;
  homeName?: string;
  awayName?: string;
  participants?: { name: string; type: string }[];
  competitionId?: number | string;
  leagueId?: number | string;
  tournamentId?: number | string;
  startTime?: string | number;
  markets?: BetanoMarket[];
}

interface BetanoResponse {
  events?: BetanoEvent[];
  data?: { events?: BetanoEvent[] };
  matches?: BetanoEvent[];
}

const URLS_A_PROBAR = [
  // Prematch específico (preferido — solo trae lo relevante).
  `${URL_BASE}/danae-webapi/api/prematch/overview/latest?includeVirtuals=false&queryLanguageId=8&queryOperatorId=12`,
  // Live overview (fallback — trae más data pero filtramos).
  `${URL_BASE}/danae-webapi/api/live/overview/latest?includeVirtuals=false&queryLanguageId=8&queryOperatorId=12`,
];

const betanoScraper: Scraper = {
  nombre: "betano",

  async capturarPorApi(partido, ligaIdCasa) {
    let body: BetanoResponse | BetanoEvent[] | null = null;
    let urlUsado: string | null = null;

    for (const url of URLS_A_PROBAR) {
      try {
        body = await httpFetchJson<BetanoResponse | BetanoEvent[]>(url, {
          headers: {
            Origin: URL_BASE,
            Referer: `${URL_BASE}/sport/futbol/peru/liga-1/${ligaIdCasa}/`,
          },
          source: "scrapers:betano",
        });
        urlUsado = url;
        break;
      } catch (err) {
        logger.debug(
          {
            url,
            err: (err as Error).message,
            source: "scrapers:betano",
          },
          `betano: URL no respondió, probando siguiente`,
        );
      }
    }

    if (!body || !urlUsado) {
      throw new Error("betano: ninguna URL de la lista respondió");
    }

    // Recolectar events del shape posible.
    let events: BetanoEvent[] = [];
    if (Array.isArray(body)) {
      events = body;
    } else if (body.events) {
      events = body.events;
    } else if (body.data?.events) {
      events = body.data.events;
    } else if (body.matches) {
      events = body.matches;
    }

    if (events.length === 0) {
      logger.warn(
        {
          partidoId: partido.id,
          ligaIdCasa,
          shape: Array.isArray(body) ? "array" : Object.keys(body ?? {}),
          source: "scrapers:betano",
        },
        `betano: response no contiene eventos reconocibles`,
      );
      return null;
    }

    // Filtrar por liga primero (cuando el campo está disponible) y
    // después matchear por nombres.
    const eventosLiga = events.filter((e) => {
      const ligaCampo =
        e.competitionId ?? e.leagueId ?? e.tournamentId;
      return ligaCampo !== undefined && String(ligaCampo) === ligaIdCasa;
    });
    const candidatos = eventosLiga.length > 0 ? eventosLiga : events;

    let mejor: BetanoEvent | null = null;
    let mejorScore = 0;
    for (const event of candidatos) {
      const home =
        event.homeName ??
        event.participants?.find((p) => p.type === "home")?.name ??
        extractHome(event.name);
      const away =
        event.awayName ??
        event.participants?.find((p) => p.type === "away")?.name ??
        extractAway(event.name);
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
          eventosLiga: eventosLiga.length,
          mejorScore,
          source: "scrapers:betano",
        },
        `betano: partido no encontrado en response`,
      );
      return null;
    }

    const cuotas = mapearCuotasBetano(mejor);

    if (Object.keys(cuotas).length === 0) {
      logger.warn(
        {
          partidoId: partido.id,
          eventId: mejor.eventId ?? mejor.id,
          markets: mejor.markets?.length ?? 0,
          source: "scrapers:betano",
        },
        `betano: evento encontrado pero sin mercados extraíbles. Revisar shape.`,
      );
      return null;
    }

    const home =
      mejor.homeName ??
      mejor.participants?.find((p) => p.type === "home")?.name ??
      extractHome(mejor.name) ??
      partido.equipoLocal;
    const away =
      mejor.awayName ??
      mejor.participants?.find((p) => p.type === "away")?.name ??
      extractAway(mejor.name) ??
      partido.equipoVisita;

    return {
      cuotas,
      fuente: { url: urlUsado, capturadoEn: new Date() },
      eventIdCasa: String(mejor.eventId ?? mejor.id ?? ""),
      equipos: { local: home, visita: away },
    };
  },
};

function extractHome(name?: string): string | null {
  if (!name) return null;
  const parts = name.split(/\s+vs\.?\s+|\s+-\s+/i);
  return parts[0]?.trim() ?? null;
}
function extractAway(name?: string): string | null {
  if (!name) return null;
  const parts = name.split(/\s+vs\.?\s+|\s+-\s+/i);
  return parts[1]?.trim() ?? null;
}

function mapearCuotasBetano(event: BetanoEvent): CuotasCapturadas {
  const cuotas: CuotasCapturadas = {};
  const norm = (s: string | undefined): string =>
    (s ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  const getPrice = (s: BetanoSelection): number | null => {
    const v = s.price ?? s.decimalOdds ?? s.odds;
    return typeof v === "number" && v > 1 && v < 100 ? v : null;
  };

  for (const market of event.markets ?? []) {
    const tipo = norm(
      market.name ?? market.shortName ?? market.type ?? market.marketType,
    );
    const selections = market.selections ?? market.outcomes ?? [];

    if (
      (tipo.includes("1x2") ||
        tipo === "match result" ||
        tipo === "resultado") &&
      !cuotas["1x2"]
    ) {
      const local = selections.find(
        (s) =>
          norm(s.shortName ?? s.name) === "1" ||
          norm(s.shortName ?? s.name) === "local",
      );
      const empate = selections.find(
        (s) =>
          norm(s.shortName ?? s.name) === "x" ||
          norm(s.shortName ?? s.name) === "empate",
      );
      const visita = selections.find(
        (s) =>
          norm(s.shortName ?? s.name) === "2" ||
          norm(s.shortName ?? s.name) === "visitante",
      );
      const lP = local && getPrice(local);
      const eP = empate && getPrice(empate);
      const vP = visita && getPrice(visita);
      if (lP && eP && vP) cuotas["1x2"] = { local: lP, empate: eP, visita: vP };
    } else if (
      (tipo.includes("doble") || tipo === "double chance") &&
      !cuotas.doble_op
    ) {
      const x1 = selections.find((s) => norm(s.shortName ?? s.name) === "1x");
      const x12 = selections.find((s) => norm(s.shortName ?? s.name) === "12");
      const xx2 = selections.find((s) => norm(s.shortName ?? s.name) === "x2");
      const x1P = x1 && getPrice(x1);
      const x12P = x12 && getPrice(x12);
      const xx2P = xx2 && getPrice(xx2);
      if (x1P && x12P && xx2P) {
        cuotas.doble_op = { x1: x1P, x12: x12P, xx2: xx2P };
      }
    } else if (
      (tipo.includes("total") ||
        tipo.includes("over/under") ||
        tipo.includes("mas/menos") ||
        tipo.includes("goles")) &&
      !cuotas.mas_menos_25 &&
      (String(market.line ?? market.specifiers?.total ?? "") === "2.5" ||
        tipo.includes("2.5"))
    ) {
      const over = selections.find((s) => {
        const n = norm(s.shortName ?? s.name);
        return n.includes("mas") || n.includes("over") || n === "+";
      });
      const under = selections.find((s) => {
        const n = norm(s.shortName ?? s.name);
        return n.includes("menos") || n.includes("under") || n === "-";
      });
      const oP = over && getPrice(over);
      const uP = under && getPrice(under);
      if (oP && uP) cuotas.mas_menos_25 = { over: oP, under: uP };
    } else if (
      (tipo.includes("ambos") ||
        tipo.includes("btts") ||
        tipo.includes("both teams")) &&
      !cuotas.btts
    ) {
      const si = selections.find((s) => {
        const n = norm(s.shortName ?? s.name);
        return n === "si" || n === "yes" || n === "sí";
      });
      const no = selections.find((s) => norm(s.shortName ?? s.name) === "no");
      const sP = si && getPrice(si);
      const nP = no && getPrice(no);
      if (sP && nP) cuotas.btts = { si: sP, no: nP };
    }
  }

  return cuotas;
}

export default betanoScraper;
