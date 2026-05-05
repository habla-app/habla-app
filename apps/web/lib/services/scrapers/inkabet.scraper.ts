// Scraper Inkabet via API directa Octonovus (Lote V.11 — May 2026).
//
// Inkabet embebe el sportsbook de Octonovus via inkabetplayground.net.
// Validado el 2026-05-05 que el endpoint:
//   https://d-cf.inkabetplayground.net/api/sb/v1/widgets/events-table/v2
// responde con partidos de Liga 1 Perú filtrados por competitionIds.
//
// Parámetros descubiertos del query:
//   - categoryIds=1: deporte (1 = fútbol)
//   - competitionIds={id}: ID de la liga (Liga 1 Perú = 22988)
//   - eventPhase=Prematch: solo partidos pre-match (no en vivo)
//   - eventSortBy=StartDate
//   - includeSkeleton=true
//   - maxMarketCount=1 (en el query observado — subimos para traer todos)
//   - pageNumber=1
//   - startsBefore / startsOnOrAfter: ventana de fechas (ISO 8601 UTC)
//   - priceFormats=1 (decimal)
//
// El user mencionó "salía en un link aparte por la fecha" — la API
// devuelve los eventos del rango, una request por rango si quiere paginar
// por día. Para este lote: ventana ancha (próximos 14 días) en una sola
// request.

import { logger } from "../logger";
import { httpFetchJson } from "./http";
import { similitudEquipos, UMBRAL_FUZZY_DEFAULT } from "./fuzzy-match";
import type { CuotasCapturadas, ResultadoScraper, Scraper } from "./types";

const URL_BASE = "https://d-cf.inkabetplayground.net";

interface OctonovusOutcome {
  id?: number | string;
  outcomeId?: number | string;
  name?: string;
  shortName?: string;
  price?: number;
  decimalPrice?: number;
}

interface OctonovusMarket {
  id?: number | string;
  marketId?: number | string;
  name?: string;
  shortName?: string;
  type?: string;
  marketType?: string;
  outcomes?: OctonovusOutcome[];
  specifiers?: Record<string, string>;
  line?: string | number;
}

interface OctonovusEvent {
  id?: number | string;
  eventId?: number | string;
  name?: string;
  homeTeam?: { name: string };
  awayTeam?: { name: string };
  competitors?: { name: string; type?: string }[];
  participants?: { name: string; venueRole?: string }[];
  startDate?: string;
  startTime?: string;
  competitionId?: number | string;
  markets?: OctonovusMarket[];
}

interface OctonovusResponse {
  events?: OctonovusEvent[];
  data?: { events?: OctonovusEvent[] };
}

const inkabetScraper: Scraper = {
  nombre: "inkabet",

  async capturarPorApi(partido, ligaIdCasa) {
    // Ventana 14 días desde ahora.
    const now = new Date();
    const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const startsOnOrAfter = now.toISOString().replace(/\.\d{3}Z$/, "Z");
    const startsBefore = in14.toISOString().replace(/\.\d{3}Z$/, "Z");

    const url =
      `${URL_BASE}/api/sb/v1/widgets/events-table/v2?` +
      new URLSearchParams({
        categoryIds: "1",
        competitionIds: ligaIdCasa,
        eventPhase: "Prematch",
        eventSortBy: "StartDate",
        includeSkeleton: "true",
        maxMarketCount: "10",
        pageNumber: "1",
        startsBefore,
        startsOnOrAfter,
        priceFormats: "1",
      });

    const body = await httpFetchJson<OctonovusResponse | OctonovusEvent[]>(
      url,
      {
        headers: {
          Origin: URL_BASE,
          Referer: `${URL_BASE}/`,
        },
        source: "scrapers:inkabet",
      },
    );

    let events: OctonovusEvent[] = [];
    if (Array.isArray(body)) {
      events = body;
    } else if (body.events) {
      events = body.events;
    } else if (body.data?.events) {
      events = body.data.events;
    }

    if (events.length === 0) {
      logger.warn(
        {
          partidoId: partido.id,
          ligaIdCasa,
          shape: Array.isArray(body) ? "array" : Object.keys(body ?? {}),
          source: "scrapers:inkabet",
        },
        `inkabet: response no contiene eventos`,
      );
      return null;
    }

    let mejor: OctonovusEvent | null = null;
    let mejorScore = 0;
    for (const event of events) {
      const home = extractHomeOctonovus(event);
      const away = extractAwayOctonovus(event);
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
          source: "scrapers:inkabet",
        },
        `inkabet: partido no encontrado en response`,
      );
      return null;
    }

    const cuotas = mapearCuotasOctonovus(mejor);

    if (Object.keys(cuotas).length === 0) {
      logger.warn(
        {
          partidoId: partido.id,
          eventId: mejor.eventId ?? mejor.id,
          markets: mejor.markets?.length ?? 0,
          source: "scrapers:inkabet",
        },
        `inkabet: evento encontrado pero sin mercados extraíbles. Revisar shape.`,
      );
      return null;
    }

    return {
      cuotas,
      fuente: { url, capturadoEn: new Date() },
      eventIdCasa: String(mejor.eventId ?? mejor.id ?? ""),
      equipos: {
        local: extractHomeOctonovus(mejor) ?? partido.equipoLocal,
        visita: extractAwayOctonovus(mejor) ?? partido.equipoVisita,
      },
    };
  },
};

function extractHomeOctonovus(event: OctonovusEvent): string | null {
  return (
    event.homeTeam?.name ??
    event.competitors?.find((c) => c.type === "home")?.name ??
    event.participants?.find((p) => p.venueRole === "Home")?.name ??
    extractHomeFromName(event.name) ??
    null
  );
}
function extractAwayOctonovus(event: OctonovusEvent): string | null {
  return (
    event.awayTeam?.name ??
    event.competitors?.find((c) => c.type === "away")?.name ??
    event.participants?.find((p) => p.venueRole === "Away")?.name ??
    extractAwayFromName(event.name) ??
    null
  );
}
function extractHomeFromName(name?: string): string | null {
  if (!name) return null;
  const parts = name.split(/\s+vs\.?\s+|\s+-\s+/i);
  return parts[0]?.trim() ?? null;
}
function extractAwayFromName(name?: string): string | null {
  if (!name) return null;
  const parts = name.split(/\s+vs\.?\s+|\s+-\s+/i);
  return parts[1]?.trim() ?? null;
}

function mapearCuotasOctonovus(event: OctonovusEvent): CuotasCapturadas {
  const cuotas: CuotasCapturadas = {};
  const norm = (s: string | undefined): string =>
    (s ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  const getPrice = (o: OctonovusOutcome): number | null => {
    const v = o.price ?? o.decimalPrice;
    return typeof v === "number" && v > 1 && v < 100 ? v : null;
  };

  for (const market of event.markets ?? []) {
    const tipo = norm(
      market.name ?? market.shortName ?? market.type ?? market.marketType,
    );
    const outcomes = market.outcomes ?? [];

    if (
      (tipo.includes("ganador del partido") ||
        tipo.includes("1x2") ||
        tipo === "match result" ||
        tipo === "resultado") &&
      !cuotas["1x2"]
    ) {
      const local = outcomes.find(
        (o) =>
          norm(o.shortName ?? o.name) === "1" ||
          norm(o.shortName ?? o.name) === "local",
      );
      const empate = outcomes.find(
        (o) =>
          norm(o.shortName ?? o.name) === "x" ||
          norm(o.shortName ?? o.name) === "empate",
      );
      const visita = outcomes.find(
        (o) =>
          norm(o.shortName ?? o.name) === "2" ||
          norm(o.shortName ?? o.name) === "visita" ||
          norm(o.shortName ?? o.name) === "visitante",
      );
      const lP = local && getPrice(local);
      const eP = empate && getPrice(empate);
      const vP = visita && getPrice(visita);
      if (lP && eP && vP) cuotas["1x2"] = { local: lP, empate: eP, visita: vP };
    } else if (
      (tipo.includes("doble oportunidad") || tipo.includes("double chance")) &&
      !cuotas.doble_op
    ) {
      const x1 = outcomes.find((o) => norm(o.shortName ?? o.name) === "1x");
      const x12 = outcomes.find((o) => norm(o.shortName ?? o.name) === "12");
      const xx2 = outcomes.find((o) => norm(o.shortName ?? o.name) === "x2");
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
      const over = outcomes.find((o) => {
        const n = norm(o.shortName ?? o.name);
        return n.includes("mas") || n.includes("over") || n.startsWith("+");
      });
      const under = outcomes.find((o) => {
        const n = norm(o.shortName ?? o.name);
        return n.includes("menos") || n.includes("under") || n.startsWith("-");
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
      const si = outcomes.find((o) => {
        const n = norm(o.shortName ?? o.name);
        return n === "si" || n === "yes" || n === "sí";
      });
      const no = outcomes.find((o) => norm(o.shortName ?? o.name) === "no");
      const sP = si && getPrice(si);
      const nP = no && getPrice(no);
      if (sP && nP) cuotas.btts = { si: sP, no: nP };
    }
  }

  return cuotas;
}

export default inkabetScraper;
