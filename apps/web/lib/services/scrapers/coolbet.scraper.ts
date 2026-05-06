// Scraper Coolbet via API directa propia (Lote V.11.1 — May 2026).
//
// Coolbet expone una API JSON propia (no es B2B externo) en:
//   https://www.coolbet.pe/s/sbgate/sports/fo-category/?categoryId={id}
// Validado el 2026-05-08 con JSON real (urls2.txt) que el listing devuelve
// fixtures + outcomes (con `id`, `name`, `result_key`, `status`) PERO
// SIN cuotas/prices. Las cuotas se cargan a través de un endpoint
// separado que el frontend invoca después.
//
// Sin la URL exacta del endpoint de prices, este scraper:
//   1) Matchea el partido en el listing (funciona — names + IDs presentes)
//   2) Intenta fetchear cuotas via varios endpoints probables:
//        - /s/sbgate/sports/fo-match/{matchId}
//        - /s/sbgate/sports/fo-event/{matchId}
//        - /s/sbgate/sports/fo-category/?categoryId={id}&include=odds
//   3) Si ninguno expone prices, retorna null con log explícito.
//
// PENDIENTE: admin debe abrir DevTools en Coolbet, navegar al partido y
// capturar la URL exacta del request que trae las cuotas. Una vez
// confirmada se ajusta este scraper en V.11.2.

import { logger } from "../logger";
import { httpFetchJson } from "./http";
import { similitudEquipos, UMBRAL_FUZZY_DEFAULT } from "./fuzzy-match";
import type { CuotasCapturadas, ResultadoScraper, Scraper } from "./types";

const URL_BASE = "https://www.coolbet.pe";

interface CoolbetOutcome {
  id?: number | string;
  name?: string;
  status?: string;
  result_key?: string;
  // Si algún día el listing trae prices, los respetamos (compat futuro)
  odds?: number;
  price?: number;
  value?: number;
  line?: number | string;
  marketName?: string;
}

interface CoolbetMarket {
  id?: number | string;
  market_type_id?: number;
  line?: number | string;
  raw_line?: number;
  name?: string;
  type?: string;
  status?: string;
  outcomes?: CoolbetOutcome[];
}

interface CoolbetMatch {
  id?: number | string;
  matchId?: number | string;
  name?: string;
  homeName?: string;
  awayName?: string;
  homeTeam?: string;
  awayTeam?: string;
  status?: string;
  inplay?: boolean;
  startTime?: string | number;
  markets?: CoolbetMarket[];
}

interface CoolbetCategory {
  id?: number;
  matches?: CoolbetMatch[];
}

const coolbetScraper: Scraper = {
  nombre: "coolbet",

  async capturarPorApi(partido, ligaIdCasa) {
    // Paso 1: listing — fixtures (matches) sin prices.
    const urlListado =
      `${URL_BASE}/s/sbgate/sports/fo-category/?` +
      new URLSearchParams({
        categoryId: ligaIdCasa,
        country: "PE",
        isMobile: "0",
        language: "pe",
        layout: "EUROPEAN",
        limit: "50",
      });

    const body = await httpFetchJson<CoolbetCategory[] | { matches?: CoolbetMatch[] }>(
      urlListado,
      {
        headers: {
          Origin: URL_BASE,
          Referer: `${URL_BASE}/pe/deportes/futbol`,
        },
        source: "scrapers:coolbet",
      },
    );

    let matches: CoolbetMatch[] = [];
    if (Array.isArray(body)) {
      // Shape real: array de categorías; cada una con matches[]
      for (const cat of body) {
        if (cat.matches) matches.push(...cat.matches);
      }
    } else if (body && typeof body === "object" && "matches" in body && Array.isArray(body.matches)) {
      matches = body.matches as CoolbetMatch[];
    }

    if (matches.length === 0) {
      logger.warn(
        {
          partidoId: partido.id,
          ligaIdCasa,
          shape: Array.isArray(body) ? "array-categorias" : Object.keys(body ?? {}),
          source: "scrapers:coolbet",
        },
        `coolbet: response no contiene partidos`,
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

    const matchId = String(mejor.id ?? mejor.matchId ?? "");
    const home =
      mejor.homeName ?? mejor.homeTeam ?? extractHomeFromName(mejor.name);
    const away =
      mejor.awayName ?? mejor.awayTeam ?? extractAwayFromName(mejor.name);

    // Intento 1: parsear cuotas del listing por si el shape cambia y
    // empieza a traer prices (defensivo / compat futuro).
    let cuotas = mapearCuotas(mejor);

    // Intento 2: probar endpoints per-match probables si el listing no
    // trae prices.
    if (Object.keys(cuotas).length === 0 && matchId) {
      const urlsPerMatch = [
        `${URL_BASE}/s/sbgate/sports/fo-match/?matchId=${matchId}&country=PE&language=pe&layout=EUROPEAN`,
        `${URL_BASE}/s/sbgate/sports/fo-event/?eventId=${matchId}&country=PE&language=pe&layout=EUROPEAN`,
        `${URL_BASE}/s/sbgate/sports/fo-match/${matchId}/?country=PE&language=pe`,
      ];
      for (const url of urlsPerMatch) {
        try {
          const detail = await httpFetchJson<CoolbetMatch | { match?: CoolbetMatch }>(
            url,
            {
              headers: {
                Origin: URL_BASE,
                Referer: `${URL_BASE}/pe/deportes/futbol`,
              },
              source: "scrapers:coolbet",
            },
          );
          const m =
            detail && typeof detail === "object" && "match" in detail && detail.match
              ? (detail.match as CoolbetMatch)
              : (detail as CoolbetMatch);
          const c = mapearCuotas(m);
          if (Object.keys(c).length > 0) {
            cuotas = c;
            break;
          }
        } catch (err) {
          logger.debug(
            {
              url,
              err: (err as Error).message,
              source: "scrapers:coolbet",
            },
            `coolbet: per-match URL no respondió`,
          );
        }
      }
    }

    if (Object.keys(cuotas).length === 0) {
      logger.warn(
        {
          partidoId: partido.id,
          matchId,
          marketsCount: mejor.markets?.length ?? 0,
          source: "scrapers:coolbet",
        },
        `coolbet: partido matched pero ningún endpoint expone prices. PENDIENTE: capturar URL exacta de cuotas via DevTools.`,
      );
      return null;
    }

    return {
      cuotas,
      fuente: { url: urlListado, capturadoEn: new Date() },
      eventIdCasa: matchId,
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

function mapearCuotas(match: CoolbetMatch | undefined): CuotasCapturadas {
  const cuotas: CuotasCapturadas = {};
  if (!match) return cuotas;

  // Aplanar todos los outcomes con su market context.
  const outcomes: (CoolbetOutcome & { marketName?: string; marketLine?: string | number })[] = [];
  if (match.markets) {
    for (const m of match.markets) {
      if (m.outcomes) {
        for (const o of m.outcomes) {
          outcomes.push({ ...o, marketName: m.name ?? m.type, marketLine: m.line ?? m.raw_line });
        }
      }
    }
  }

  const norm = (s: string | undefined): string =>
    (s ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();

  const priceOk = (o: CoolbetOutcome | undefined): number | null => {
    if (!o) return null;
    const v = o.odds ?? o.price ?? o.value;
    return typeof v === "number" && v > 1 && v < 100 ? v : null;
  };

  // 1X2 — usar result_key que viene confiable: "[Home]" / "Draw" / "[Away]"
  const local = outcomes.find(
    (o) => o.result_key === "[Home]" || norm(o.name) === "1" || norm(o.name) === "local",
  );
  const empate = outcomes.find(
    (o) => o.result_key === "Draw" || norm(o.name) === "x" || norm(o.name) === "empate",
  );
  const visita = outcomes.find(
    (o) => o.result_key === "[Away]" || norm(o.name) === "2" || norm(o.name) === "visita",
  );
  const lP = priceOk(local);
  const eP = priceOk(empate);
  const vP = priceOk(visita);
  if (lP && eP && vP) cuotas["1x2"] = { local: lP, empate: eP, visita: vP };

  // Doble Op
  const x1 = outcomes.find((o) => o.result_key === "[Home]/Draw" || norm(o.name) === "1x");
  const x12 = outcomes.find(
    (o) => o.result_key === "[Home]/[Away]" || norm(o.name) === "12",
  );
  const xx2 = outcomes.find(
    (o) => o.result_key === "Draw/[Away]" || norm(o.name) === "x2",
  );
  const x1P = priceOk(x1);
  const x12P = priceOk(x12);
  const xx2P = priceOk(xx2);
  if (x1P && x12P && xx2P) {
    cuotas.doble_op = { x1: x1P, x12: x12P, xx2: xx2P };
  }

  // Más/Menos 2.5: filtrar por market line === 2.5 + result_key Over/Under
  const over25 = outcomes.find((o) => {
    const line = String(o.marketLine ?? o.line ?? "");
    return o.result_key === "Over" && line === "2.5";
  });
  const under25 = outcomes.find((o) => {
    const line = String(o.marketLine ?? o.line ?? "");
    return o.result_key === "Under" && line === "2.5";
  });
  const overP = priceOk(over25);
  const underP = priceOk(under25);
  if (overP && underP) {
    cuotas.mas_menos_25 = { over: overP, under: underP };
  }

  // BTTS
  const bttsSi = outcomes.find((o) => {
    const m = norm(o.marketName);
    const n = norm(o.name);
    const rk = (o.result_key ?? "").toLowerCase();
    return (
      (m.includes("ambos") || m.includes("btts") || m.includes("both")) &&
      (n === "si" || n === "sí" || n === "yes" || rk === "yes")
    );
  });
  const bttsNo = outcomes.find((o) => {
    const m = norm(o.marketName);
    const n = norm(o.name);
    const rk = (o.result_key ?? "").toLowerCase();
    return (
      (m.includes("ambos") || m.includes("btts") || m.includes("both")) &&
      (n === "no" || rk === "no")
    );
  });
  const bttsSiP = priceOk(bttsSi);
  const bttsNoP = priceOk(bttsNo);
  if (bttsSiP && bttsNoP) {
    cuotas.btts = { si: bttsSiP, no: bttsNoP };
  }

  return cuotas;
}

export default coolbetScraper;
