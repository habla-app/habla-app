// Scraper Te Apuesto via API directa Coreix (Lote V.11 — May 2026).
//
// Te Apuesto usa Coreix como backend B2B (api-latam.core-ix.com).
// Validado el 2026-05-05 que el endpoint:
//   https://api-latam.core-ix.com/api/v1/tournament-events
// trae los eventos de un torneo específico.
//
// Parámetros descubiertos: el endpoint requiere identificar el torneo.
// La URL del frontend tiene `?id=1,476,1899` donde 1899 es el tournament
// id de Liga 1 Perú (1 = sport, 476 = country).
//
// Estructura del JSON: shape inferido de patrones B2B latinoamericanos.
// El parser maneja shape flexible. Cualquier discrepancia se ajusta via
// endpoint diagnóstico.

import { logger } from "../logger";
import { httpFetchJson } from "./http";
import { similitudEquipos, UMBRAL_FUZZY_DEFAULT } from "./fuzzy-match";
import type { CuotasCapturadas, ResultadoScraper, Scraper } from "./types";

const URL_BASE = "https://api-latam.core-ix.com";

interface CoreixOdd {
  id?: number | string;
  name?: string;
  short_name?: string;
  shortName?: string;
  value?: number;
  odd?: number;
  price?: number;
}

interface CoreixMarket {
  id?: number | string;
  name?: string;
  type_id?: number;
  type?: string;
  short_name?: string;
  outcomes?: CoreixOdd[];
  odds?: CoreixOdd[];
  line?: string | number;
  specifier?: string;
}

interface CoreixEvent {
  id?: number | string;
  event_id?: number | string;
  name?: string;
  home_team?: string;
  away_team?: string;
  home_team_name?: string;
  away_team_name?: string;
  team1?: string;
  team2?: string;
  participants?: { name: string; type?: string }[];
  start_date?: string;
  start_time?: string;
  tournament_id?: number | string;
  league_id?: number | string;
  markets?: CoreixMarket[];
  odds?: CoreixOdd[];
}

interface CoreixResponse {
  events?: CoreixEvent[];
  data?: { events?: CoreixEvent[] };
  result?: CoreixEvent[];
}

const teApuestoScraper: Scraper = {
  nombre: "te_apuesto",

  async capturarPorApi(partido, ligaIdCasa) {
    // El frontend usa ?id=1,476,1899 (sport,country,tournament).
    // Probamos con tournament_id puro primero, después fallback a la
    // tupla completa.
    const urls = [
      `${URL_BASE}/api/v1/tournament-events?tournament_id=${ligaIdCasa}&language_id=1`,
      `${URL_BASE}/api/v1/tournament-events?id=1,476,${ligaIdCasa}&language_id=1`,
      `${URL_BASE}/api/v1/tournament-events?tournamentId=${ligaIdCasa}&languageId=1`,
    ];

    let body: CoreixResponse | CoreixEvent[] | null = null;
    let urlUsado: string | null = null;

    for (const url of urls) {
      try {
        body = await httpFetchJson<CoreixResponse | CoreixEvent[]>(url, {
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

    let events: CoreixEvent[] = [];
    if (Array.isArray(body)) {
      events = body;
    } else if (body.events) {
      events = body.events;
    } else if (body.data?.events) {
      events = body.data.events;
    } else if (body.result) {
      events = body.result;
    }

    if (events.length === 0) {
      logger.warn(
        {
          partidoId: partido.id,
          ligaIdCasa,
          shape: Array.isArray(body) ? "array" : Object.keys(body ?? {}),
          source: "scrapers:te-apuesto",
        },
        `te-apuesto: response no contiene eventos`,
      );
      return null;
    }

    let mejor: CoreixEvent | null = null;
    let mejorScore = 0;
    for (const event of events) {
      const home = extractHomeCoreix(event);
      const away = extractAwayCoreix(event);
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
          eventId: mejor.event_id ?? mejor.id,
          markets: mejor.markets?.length ?? 0,
          source: "scrapers:te-apuesto",
        },
        `te-apuesto: evento encontrado pero sin mercados extraíbles. Revisar shape.`,
      );
      return null;
    }

    return {
      cuotas,
      fuente: { url: urlUsado, capturadoEn: new Date() },
      eventIdCasa: String(mejor.event_id ?? mejor.id ?? ""),
      equipos: {
        local: extractHomeCoreix(mejor) ?? partido.equipoLocal,
        visita: extractAwayCoreix(mejor) ?? partido.equipoVisita,
      },
    };
  },
};

function extractHomeCoreix(event: CoreixEvent): string | null {
  return (
    event.home_team ??
    event.home_team_name ??
    event.team1 ??
    event.participants?.find((p) => p.type === "home" || p.type === "1")?.name ??
    extractHomeFromName(event.name) ??
    null
  );
}
function extractAwayCoreix(event: CoreixEvent): string | null {
  return (
    event.away_team ??
    event.away_team_name ??
    event.team2 ??
    event.participants?.find((p) => p.type === "away" || p.type === "2")?.name ??
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

function mapearCuotasCoreix(event: CoreixEvent): CuotasCapturadas {
  const cuotas: CuotasCapturadas = {};
  const norm = (s: string | undefined): string =>
    (s ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  const getPrice = (o: CoreixOdd): number | null => {
    const v = o.value ?? o.odd ?? o.price;
    return typeof v === "number" && v > 1 && v < 100 ? v : null;
  };

  for (const market of event.markets ?? []) {
    const tipo = norm(market.name ?? market.short_name ?? market.type);
    const outcomes = market.outcomes ?? market.odds ?? [];

    if (
      (tipo.includes("1x2") ||
        tipo === "match result" ||
        tipo === "resultado" ||
        tipo.includes("ganador")) &&
      !cuotas["1x2"]
    ) {
      const local = outcomes.find(
        (o) =>
          norm(o.short_name ?? o.shortName ?? o.name) === "1" ||
          norm(o.short_name ?? o.shortName ?? o.name) === "local",
      );
      const empate = outcomes.find(
        (o) =>
          norm(o.short_name ?? o.shortName ?? o.name) === "x" ||
          norm(o.short_name ?? o.shortName ?? o.name) === "empate",
      );
      const visita = outcomes.find(
        (o) =>
          norm(o.short_name ?? o.shortName ?? o.name) === "2" ||
          norm(o.short_name ?? o.shortName ?? o.name) === "visitante",
      );
      const lP = local && getPrice(local);
      const eP = empate && getPrice(empate);
      const vP = visita && getPrice(visita);
      if (lP && eP && vP) cuotas["1x2"] = { local: lP, empate: eP, visita: vP };
    } else if (
      (tipo.includes("doble") || tipo.includes("double chance")) &&
      !cuotas.doble_op
    ) {
      const x1 = outcomes.find(
        (o) => norm(o.short_name ?? o.shortName ?? o.name) === "1x",
      );
      const x12 = outcomes.find(
        (o) => norm(o.short_name ?? o.shortName ?? o.name) === "12",
      );
      const xx2 = outcomes.find(
        (o) => norm(o.short_name ?? o.shortName ?? o.name) === "x2",
      );
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
      (String(market.line ?? market.specifier ?? "") === "2.5" ||
        tipo.includes("2.5"))
    ) {
      const over = outcomes.find((o) => {
        const n = norm(o.short_name ?? o.shortName ?? o.name);
        return n.includes("mas") || n.includes("over") || n.startsWith("+");
      });
      const under = outcomes.find((o) => {
        const n = norm(o.short_name ?? o.shortName ?? o.name);
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
        const n = norm(o.short_name ?? o.shortName ?? o.name);
        return n === "si" || n === "yes" || n === "sí";
      });
      const no = outcomes.find(
        (o) => norm(o.short_name ?? o.shortName ?? o.name) === "no",
      );
      const sP = si && getPrice(si);
      const nP = no && getPrice(no);
      if (sP && nP) cuotas.btts = { si: sP, no: nP };
    }
  }

  return cuotas;
}

export default teApuestoScraper;
