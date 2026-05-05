// Scraper Coolbet via API directa propia (Lote V.11 — May 2026).
//
// Coolbet expone una API JSON propia (no es B2B externo) en:
//   https://www.coolbet.pe/s/sbgate/sports/fo-category/
// Validado el 2026-05-05 que la URL responde con partidos peruanos.
//
// Parámetros descubiertos:
//   - categoryId={id}: ID interno de la liga (Liga 1 Perú = 127).
//   - country=PE
//   - isMobile=0
//   - language=pe
//   - layout=EUROPEAN
//   - limit=6 (cantidad de partidos a traer; subimos a 50 para no truncar)
//
// Estructura del JSON: inferida de patrones comunes para sportsbooks.
// El parser maneja variaciones flexibles. Si el shape real difiere,
// el endpoint diagnóstico (sub-fase 4) permite ajustarlo.

import { logger } from "../logger";
import { httpFetchJson } from "./http";
import { similitudEquipos, UMBRAL_FUZZY_DEFAULT } from "./fuzzy-match";
import type { CuotasCapturadas, ResultadoScraper, Scraper } from "./types";

const URL_BASE = "https://www.coolbet.pe";

interface CoolbetOutcome {
  id?: number | string;
  outcomeId?: number | string;
  name?: string;
  outcomeName?: string;
  odds?: number;
  price?: number;
  value?: number;
  line?: number | string;
  marketName?: string;
}

interface CoolbetMarket {
  id?: number | string;
  marketId?: number | string;
  name?: string;
  type?: string;
  outcomes?: CoolbetOutcome[];
}

interface CoolbetMatch {
  matchId?: number | string;
  id?: number | string;
  name?: string;
  homeName?: string;
  awayName?: string;
  homeTeam?: string;
  awayTeam?: string;
  startTime?: string | number;
  startDate?: string | number;
  markets?: CoolbetMarket[];
  outcomes?: CoolbetOutcome[];
}

interface CoolbetResponse {
  matches?: CoolbetMatch[];
  events?: CoolbetMatch[];
  data?: CoolbetMatch[];
}

const coolbetScraper: Scraper = {
  nombre: "coolbet",

  async capturarPorApi(partido, ligaIdCasa) {
    const url =
      `${URL_BASE}/s/sbgate/sports/fo-category/?` +
      new URLSearchParams({
        categoryId: ligaIdCasa,
        country: "PE",
        isMobile: "0",
        language: "pe",
        layout: "EUROPEAN",
        limit: "50",
      });

    const body = await httpFetchJson<CoolbetResponse | CoolbetMatch[]>(url, {
      headers: {
        Origin: URL_BASE,
        Referer: `${URL_BASE}/pe/deportes/futbol`,
      },
      source: "scrapers:coolbet",
    });

    // El response puede venir como array directo o envuelto en { matches/events/data }.
    let matches: CoolbetMatch[] = [];
    if (Array.isArray(body)) {
      matches = body;
    } else if (body.matches) {
      matches = body.matches;
    } else if (body.events) {
      matches = body.events;
    } else if (body.data) {
      matches = body.data;
    }

    if (matches.length === 0) {
      logger.warn(
        {
          partidoId: partido.id,
          ligaIdCasa,
          shape: Array.isArray(body) ? "array" : Object.keys(body ?? {}),
          source: "scrapers:coolbet",
        },
        `coolbet: response no contiene array de partidos reconocible`,
      );
      return null;
    }

    // Buscar partido por nombres.
    let mejor: CoolbetMatch | null = null;
    let mejorScore = 0;
    for (const match of matches) {
      const home =
        match.homeName ?? match.homeTeam ?? extractHomeFromName(match.name);
      const away =
        match.awayName ?? match.awayTeam ?? extractAwayFromName(match.name);
      if (!home || !away) continue;
      const sLocal = similitudEquipos(home, partido.equipoLocal);
      const sVisita = similitudEquipos(away, partido.equipoVisita);
      const score = Math.min(sLocal, sVisita);
      if (score > mejorScore) {
        mejorScore = score;
        mejor = match;
      }
    }

    if (!mejor || mejorScore < UMBRAL_FUZZY_DEFAULT * 0.7) {
      logger.info(
        {
          partidoId: partido.id,
          equipoLocal: partido.equipoLocal,
          equipoVisita: partido.equipoVisita,
          ligaIdCasa,
          totalMatches: matches.length,
          mejorScore,
          source: "scrapers:coolbet",
        },
        `coolbet: partido no encontrado en response`,
      );
      return null;
    }

    const cuotas = mapearCuotas(mejor);

    if (Object.keys(cuotas).length === 0) {
      logger.warn(
        {
          partidoId: partido.id,
          matchId: mejor.matchId ?? mejor.id,
          markets: mejor.markets?.length ?? 0,
          outcomes: mejor.outcomes?.length ?? 0,
          source: "scrapers:coolbet",
        },
        `coolbet: partido encontrado pero ningún mercado extraído. Revisar shape via diagnostico-api.`,
      );
      return null;
    }

    const home =
      mejor.homeName ?? mejor.homeTeam ?? extractHomeFromName(mejor.name);
    const away =
      mejor.awayName ?? mejor.awayTeam ?? extractAwayFromName(mejor.name);

    return {
      cuotas,
      fuente: { url, capturadoEn: new Date() },
      eventIdCasa: String(mejor.matchId ?? mejor.id ?? ""),
      equipos: {
        local: home ?? partido.equipoLocal,
        visita: away ?? partido.equipoVisita,
      },
    };
  },
};

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

function mapearCuotas(match: CoolbetMatch): CuotasCapturadas {
  const cuotas: CuotasCapturadas = {};
  // Recolectar todos los outcomes (de markets si existen, sino del array
  // directo).
  const outcomes: CoolbetOutcome[] = [];
  if (match.markets) {
    for (const m of match.markets) {
      if (m.outcomes) {
        outcomes.push(
          ...m.outcomes.map((o) => ({ ...o, marketName: m.name ?? m.type })),
        );
      }
    }
  } else if (match.outcomes) {
    outcomes.push(...match.outcomes);
  }

  const norm = (s: string | undefined): string =>
    (s ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  const getPrice = (o: CoolbetOutcome): number | null => {
    const v = o.odds ?? o.price ?? o.value;
    return typeof v === "number" && v > 1 && v < 100 ? v : null;
  };

  // 1X2: outcomes "1" / "X" / "2" o "Local" / "Empate" / "Visita".
  const local = outcomes.find(
    (o) =>
      norm(o.outcomeName ?? o.name) === "1" ||
      norm(o.outcomeName ?? o.name) === "local" ||
      norm(o.outcomeName ?? o.name) === "home",
  );
  const empate = outcomes.find(
    (o) =>
      norm(o.outcomeName ?? o.name) === "x" ||
      norm(o.outcomeName ?? o.name) === "empate" ||
      norm(o.outcomeName ?? o.name) === "draw",
  );
  const visita = outcomes.find(
    (o) =>
      norm(o.outcomeName ?? o.name) === "2" ||
      norm(o.outcomeName ?? o.name) === "visitante" ||
      norm(o.outcomeName ?? o.name) === "visita" ||
      norm(o.outcomeName ?? o.name) === "away",
  );
  const localP = local && getPrice(local);
  const empateP = empate && getPrice(empate);
  const visitaP = visita && getPrice(visita);
  if (localP && empateP && visitaP) {
    cuotas["1x2"] = { local: localP, empate: empateP, visita: visitaP };
  }

  // Doble Op
  const x1 = outcomes.find((o) => norm(o.outcomeName ?? o.name) === "1x");
  const x12 = outcomes.find((o) => norm(o.outcomeName ?? o.name) === "12");
  const xx2 = outcomes.find((o) => norm(o.outcomeName ?? o.name) === "x2");
  const x1P = x1 && getPrice(x1);
  const x12P = x12 && getPrice(x12);
  const xx2P = xx2 && getPrice(xx2);
  if (x1P && x12P && xx2P) {
    cuotas.doble_op = { x1: x1P, x12: x12P, xx2: xx2P };
  }

  // Más/Menos 2.5
  const overOutcome = outcomes.find((o) => {
    const n = norm(o.outcomeName ?? o.name);
    const line = String(o.line ?? "");
    return (
      (n.includes("mas") || n.includes("over")) &&
      (line === "2.5" || n.includes("2.5"))
    );
  });
  const underOutcome = outcomes.find((o) => {
    const n = norm(o.outcomeName ?? o.name);
    const line = String(o.line ?? "");
    return (
      (n.includes("menos") || n.includes("under")) &&
      (line === "2.5" || n.includes("2.5"))
    );
  });
  const overP = overOutcome && getPrice(overOutcome);
  const underP = underOutcome && getPrice(underOutcome);
  if (overP && underP) {
    cuotas.mas_menos_25 = { over: overP, under: underP };
  }

  // BTTS
  const bttsSi = outcomes.find((o) => {
    const n = norm(o.outcomeName ?? o.name);
    const m = norm(o.marketName);
    return (
      (m.includes("ambos") || m.includes("btts") || m.includes("both")) &&
      (n === "si" || n === "yes" || n === "sí")
    );
  });
  const bttsNo = outcomes.find((o) => {
    const n = norm(o.outcomeName ?? o.name);
    const m = norm(o.marketName);
    return (
      (m.includes("ambos") || m.includes("btts") || m.includes("both")) &&
      n === "no"
    );
  });
  const bttsSiP = bttsSi && getPrice(bttsSi);
  const bttsNoP = bttsNo && getPrice(bttsNo);
  if (bttsSiP && bttsNoP) {
    cuotas.btts = { si: bttsSiP, no: bttsNoP };
  }

  return cuotas;
}

export default coolbetScraper;
