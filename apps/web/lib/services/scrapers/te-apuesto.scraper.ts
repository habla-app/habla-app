// Scraper Te Apuesto via Playwright + XHR intercept (Lote V.12 — May 2026).
//
// Te Apuesto usa la API Coreix: el JSON `tournament-events` trae todos
// los markets+odds en un solo response al cargar el listing. El listing
// es self-suficiente — sin doble nav.

import { logger } from "../logger";
import { similitudEquipos, UMBRAL_FUZZY_MATCH_PARTIDO } from "./fuzzy-match";
import {
  recolectarJsons,
  priceOk,
  type JsonCapturado,
} from "./playwright-runner";
import {
  type CuotasCapturadas,
  type ResultadoScraper,
  type Scraper,
} from "./types";

const teApuestoScraper: Scraper = {
  nombre: "te_apuesto",

  async capturarConPlaywright(partido, ligaCanonica) {
    const recolectado = await recolectarJsons({
      casa: "te_apuesto",
      ligaCanonica,
      partido,
    });
    if (!recolectado) return null;

    const r = parsearTeApuesto(
      recolectado.jsons,
      partido.equipoLocal,
      partido.equipoVisita,
    );
    if (!r) {
      logger.info(
        {
          partidoId: partido.id,
          ligaCanonica,
          jsonsCapturados: recolectado.jsons.length,
          source: "scrapers:te-apuesto",
        },
        `te-apuesto: parser no encontró el partido`,
      );
      return null;
    }

    // Lote V.14: persistir parciales en vez de descartarlos (la admin
    // necesita ver lo que se capturó aunque falten algunos mercados).
    const result: ResultadoScraper = {
      cuotas: r.cuotas,
      fuente: { url: r.jsonUrl ?? recolectado.listingUrl, capturadoEn: new Date() },
      eventIdCasa: r.eventoId ? String(r.eventoId) : undefined,
      equipos: r.equipos,
    };
    return result;
  },
};

interface ParserResult {
  cuotas: CuotasCapturadas;
  eventoId?: string | number;
  jsonUrl?: string;
  equipos?: { local: string; visita: string };
}

function parsearTeApuesto(
  jsons: JsonCapturado[],
  equipoLocal: string,
  equipoVisita: string,
): ParserResult | null {
  const candidatos = jsons.filter((j) => {
    const t = (j.body as any)?.data?.tournaments;
    return t && typeof t === "object";
  });
  for (const j of candidatos) {
    const tournaments = (j.body as any).data.tournaments;
    const events: any[] = [];
    for (const t of Object.values(tournaments)) {
      const tt = t as any;
      if (tt.events) events.push(...tt.events);
    }
    if (events.length === 0) continue;

    let mejor: any = null;
    let mejorScore = 0;
    let mejorHome = "";
    let mejorAway = "";
    for (const ev of events) {
      if (!ev.competitors) continue;
      const competitors = Object.values(ev.competitors) as any[];
      const home = competitors.find((c) => c.type === "home")?.name;
      const away = competitors.find((c) => c.type === "away")?.name;
      if (!home || !away) continue;
      const score = Math.min(
        similitudEquipos(home, equipoLocal),
        similitudEquipos(away, equipoVisita),
      );
      if (score > mejorScore) {
        mejorScore = score;
        mejor = ev;
        mejorHome = home;
        mejorAway = away;
      }
    }
    if (!mejor || mejorScore < UMBRAL_FUZZY_MATCH_PARTIDO) continue;

    const allOdds: any[] = [];
    for (const m of mejor.markets ?? []) {
      const marketName = (m.name ?? "").toLowerCase();
      const providerMarketId = String(m.provider_market_id ?? "");
      for (const mo of m.market_odds ?? []) {
        for (const o of mo.odds ?? []) {
          allOdds.push({ ...o, marketName, providerMarketId });
        }
      }
    }
    const sP = (v: any) => priceOk(v);
    const cuotas: CuotasCapturadas = {};

    const o1x2 = allOdds.filter(
      (o) => o.marketName === "1x2" || o.providerMarketId === "1",
    );
    if (o1x2.length > 0) {
      const l = sP(o1x2.find((o) => o.provider_odd_id === "1")?.value);
      const e = sP(o1x2.find((o) => o.provider_odd_id === "2")?.value);
      const v = sP(o1x2.find((o) => o.provider_odd_id === "3")?.value);
      if (l && e && v) cuotas["1x2"] = { local: l, empate: e, visita: v };
    }
    const oDoble = allOdds.filter(
      (o) => o.marketName.includes("doble") || o.providerMarketId === "10",
    );
    if (oDoble.length > 0) {
      const x1 = sP(oDoble.find((o) => o.provider_odd_id === "9")?.value);
      const x12 = sP(oDoble.find((o) => o.provider_odd_id === "10")?.value);
      const xx2 = sP(oDoble.find((o) => o.provider_odd_id === "11")?.value);
      if (x1 && x12 && xx2) cuotas.doble_op = { x1, x12, xx2 };
    }
    const oBtts = allOdds.filter(
      (o) =>
        o.marketName.includes("ambos") ||
        o.marketName.includes("btts") ||
        o.providerMarketId === "29",
    );
    if (oBtts.length > 0) {
      const si = sP(oBtts.find((o) => o.provider_odd_id === "74")?.value);
      const no = sP(oBtts.find((o) => o.provider_odd_id === "76")?.value);
      if (si && no) cuotas.btts = { si, no };
    }
    const oTotal = allOdds.filter(
      (o) =>
        (o.marketName === "total" || o.providerMarketId === "18") &&
        o.special_value === "2.5",
    );
    if (oTotal.length > 0) {
      const over = sP(oTotal.find((o) => o.provider_odd_id === "12")?.value);
      const under = sP(oTotal.find((o) => o.provider_odd_id === "13")?.value);
      if (over && under) cuotas.mas_menos_25 = { over, under };
    }

    if (Object.keys(cuotas).length > 0) {
      return {
        cuotas,
        eventoId: mejor.id,
        jsonUrl: j.url,
        equipos: { local: mejorHome, visita: mejorAway },
      };
    }
  }
  return null;
}

export default teApuestoScraper;
