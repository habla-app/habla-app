// Scraper Coolbet via browser + XHR intercept (Lote V.12 — May 2026).
//
// El listing endpoint de Coolbet (`/s/sbgate/sports/fo-category/`) NO
// expone prices — sólo metadata (id/name/result_key/status). Cargando la
// página en navegador real, Coolbet hace requests adicionales que SÍ
// traen prices. Interceptamos todas las XHRs JSON que pasen por su
// keyword filter y probamos de extraer cuotas en cada una.
//
// Shape esperado (validado con urls2.txt):
// `[{matches: [{name, markets: [{name, line, outcomes: [{result_key, ...}]}]}]}]`
// El parser ya escrito en V.11.1 usa result_key + line para identificar
// cuotas, así que sólo cambia cómo obtenemos el JSON.

import { logger } from "../logger";
import { similitudEquipos, UMBRAL_FUZZY_DEFAULT } from "./fuzzy-match";
import { capturarJsonsConCuotas } from "./xhr-intercept";
import { obtenerUrlListado } from "./urls-listing";
import { detectarLigaCanonica } from "./ligas-id-map";
import {
  mercadosFaltantes,
  type CuotasCapturadas,
  type ResultadoScraper,
  type Scraper,
} from "./types";

interface CoolbetOutcome {
  id?: number | string;
  name?: string;
  result_key?: string;
  // Coolbet con prices (lo que esperamos del browser):
  odds?: number;
  price?: number;
  value?: number;
  decimal_odds?: number;
}
interface CoolbetMarket {
  id?: number | string;
  line?: number | string;
  raw_line?: number;
  name?: string;
  market_type_id?: number;
  outcomes?: CoolbetOutcome[];
}
interface CoolbetMatch {
  id?: number | string;
  name?: string;
  homeName?: string;
  awayName?: string;
  homeTeam?: string;
  awayTeam?: string;
  markets?: CoolbetMarket[];
}

const coolbetScraper: Scraper = {
  nombre: "coolbet",

  async capturarPorApi(partido) {
    const ligaCanonica = detectarLigaCanonica(partido.liga);
    if (!ligaCanonica) return null;
    const url = obtenerUrlListado(ligaCanonica, "coolbet");
    if (!url) return null;

    const candidatos = await capturarJsonsConCuotas(url, {
      source: "scrapers:coolbet",
      esperaPostLoadMs: 6_000,
    });

    const diagnostico: Array<{
      url: string;
      bytes: number;
      matches: number;
      mejorScore: number;
      mejorMatch?: { local: string; visita: string };
    }> = [];

    for (const c of candidatos) {
      const matches = extractMatches(c.body);

      let mejor: CoolbetMatch | null = null;
      let mejorScore = 0;
      let mejorMatch: { local: string; visita: string } | undefined;
      for (const m of matches) {
        const home = m.homeName ?? m.homeTeam ?? extractHomeFromName(m.name);
        const away = m.awayName ?? m.awayTeam ?? extractAwayFromName(m.name);
        if (!home || !away) continue;
        const score = Math.min(
          similitudEquipos(home, partido.equipoLocal),
          similitudEquipos(away, partido.equipoVisita),
        );
        if (score > mejorScore) {
          mejorScore = score;
          mejor = m;
          mejorMatch = { local: home, visita: away };
        }
      }
      diagnostico.push({
        url: c.url,
        bytes: c.bytes,
        matches: matches.length,
        mejorScore,
        mejorMatch,
      });
      if (!mejor || mejorScore < UMBRAL_FUZZY_DEFAULT * 0.7) continue;

      const cuotas = mapearCuotasCoolbet(mejor);
      if (Object.keys(cuotas).length === 0) continue;

      // V.12.3: requerir los 4 mercados.
      const faltan = mercadosFaltantes(cuotas);
      if (faltan.length > 0) {
        logger.info(
          {
            partidoId: partido.id,
            matchId: mejor.id,
            mercadosPresentes: Object.keys(cuotas),
            mercadosFaltantes: faltan,
            source: "scrapers:coolbet",
          },
          `coolbet: cuotas parciales · faltan=[${faltan.join(",")}] (probando siguiente candidato)`,
        );
        continue;
      }

      const home =
        mejor.homeName ?? mejor.homeTeam ?? extractHomeFromName(mejor.name);
      const away =
        mejor.awayName ?? mejor.awayTeam ?? extractAwayFromName(mejor.name);

      return {
        cuotas,
        fuente: { url: c.url, capturadoEn: new Date() },
        eventIdCasa: String(mejor.id ?? ""),
        equipos: {
          local: home ?? partido.equipoLocal,
          visita: away ?? partido.equipoVisita,
        },
      };
    }

    logger.info(
      {
        partidoId: partido.id,
        equipoLocal: partido.equipoLocal,
        equipoVisita: partido.equipoVisita,
        candidatos: candidatos.length,
        diagnostico,
        umbralAceptacion: UMBRAL_FUZZY_DEFAULT * 0.7,
        source: "scrapers:coolbet",
      },
      `coolbet: ningún JSON candidato matcheó el partido con cuotas (mejor score=${diagnostico.reduce((m, d) => Math.max(m, d.mejorScore), 0).toFixed(3)})`,
    );
    return null;
  },
};

function extractMatches(body: unknown): CoolbetMatch[] {
  // Shape A: array de categorías con matches[]
  if (Array.isArray(body)) {
    const out: CoolbetMatch[] = [];
    for (const cat of body) {
      if (cat && typeof cat === "object" && "matches" in cat) {
        const ms = (cat as { matches?: CoolbetMatch[] }).matches;
        if (Array.isArray(ms)) out.push(...ms);
      }
    }
    if (out.length > 0) return out;
    // Shape A2: array directo de matches
    return body.filter(
      (x): x is CoolbetMatch =>
        x !== null && typeof x === "object" && "markets" in x,
    );
  }
  // Shape B: { matches: [...] }
  if (body && typeof body === "object" && "matches" in body) {
    const ms = (body as { matches?: CoolbetMatch[] }).matches;
    if (Array.isArray(ms)) return ms;
  }
  return [];
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

function mapearCuotasCoolbet(match: CoolbetMatch): CuotasCapturadas {
  const cuotas: CuotasCapturadas = {};
  const flat: (CoolbetOutcome & { marketName?: string; marketLine?: string | number })[] = [];
  for (const m of match.markets ?? []) {
    for (const o of m.outcomes ?? []) {
      flat.push({ ...o, marketName: m.name, marketLine: m.line ?? m.raw_line });
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
    const v = o.odds ?? o.price ?? o.value ?? o.decimal_odds;
    return typeof v === "number" && v > 1 && v < 100 ? v : null;
  };

  // 1X2 por result_key
  const local = priceOk(
    flat.find(
      (o) => o.result_key === "[Home]" || norm(o.name) === "1" || norm(o.name) === "local",
    ),
  );
  const empate = priceOk(
    flat.find(
      (o) => o.result_key === "Draw" || norm(o.name) === "x" || norm(o.name) === "empate",
    ),
  );
  const visita = priceOk(
    flat.find(
      (o) => o.result_key === "[Away]" || norm(o.name) === "2" || norm(o.name) === "visita",
    ),
  );
  if (local && empate && visita) cuotas["1x2"] = { local, empate, visita };

  // Doble Op
  const x1 = priceOk(flat.find((o) => o.result_key === "[Home]/Draw" || norm(o.name) === "1x"));
  const x12 = priceOk(flat.find((o) => o.result_key === "[Home]/[Away]" || norm(o.name) === "12"));
  const xx2 = priceOk(flat.find((o) => o.result_key === "Draw/[Away]" || norm(o.name) === "x2"));
  if (x1 && x12 && xx2) cuotas.doble_op = { x1, x12, xx2 };

  // Total 2.5
  const over25 = priceOk(
    flat.find((o) => {
      const line = String(o.marketLine ?? "");
      return o.result_key === "Over" && line === "2.5";
    }),
  );
  const under25 = priceOk(
    flat.find((o) => {
      const line = String(o.marketLine ?? "");
      return o.result_key === "Under" && line === "2.5";
    }),
  );
  if (over25 && under25) cuotas.mas_menos_25 = { over: over25, under: under25 };

  // BTTS
  const bttsSi = priceOk(
    flat.find((o) => {
      const m = norm(o.marketName);
      const n = norm(o.name);
      const rk = (o.result_key ?? "").toLowerCase();
      return (
        (m.includes("ambos") || m.includes("btts") || m.includes("both")) &&
        (n === "si" || n === "sí" || n === "yes" || rk === "yes")
      );
    }),
  );
  const bttsNo = priceOk(
    flat.find((o) => {
      const m = norm(o.marketName);
      const n = norm(o.name);
      const rk = (o.result_key ?? "").toLowerCase();
      return (
        (m.includes("ambos") || m.includes("btts") || m.includes("both")) &&
        (n === "no" || rk === "no")
      );
    }),
  );
  if (bttsSi && bttsNo) cuotas.btts = { si: bttsSi, no: bttsNo };

  return cuotas;
}

export default coolbetScraper;
