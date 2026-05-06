// Scraper Te Apuesto via browser + XHR intercept (Lote V.12 — May 2026).
//
// Te Apuesto usa Coreix (api-latam.core-ix.com). Cargamos su página de
// la liga y escuchamos las XHRs. La response esperada:
//   { data: { tournaments: { "1899": { events: [{markets: [...]}] } } } }
//
// Mapeo provider_odd_id (Coreix):
//   1X2:        "1"/"2"/"3" (Local/Empate/Visita)
//   Doble Op:   "9"/"10"/"11" (1X/12/X2)
//   Total:      "12"/"13" (Más/Menos, con special_value="2.5")
//   BTTS:       "74"/"76" (Sí/No)

import { logger } from "../logger";
import { similitudEquipos, UMBRAL_FUZZY_DEFAULT } from "./fuzzy-match";
import { capturarJsonsConCuotas } from "./xhr-intercept";
import { obtenerUrlListado } from "./urls-listing";
import { detectarLigaCanonica } from "./ligas-id-map";
import type { CuotasCapturadas, ResultadoScraper, Scraper } from "./types";

interface CoreixOdd {
  id?: number | string;
  provider_odd_id?: string;
  name?: string;
  value?: number;
  special_value?: string;
}
interface CoreixMarketOdd {
  odds?: CoreixOdd[];
}
interface CoreixMarket {
  provider_market_id?: string;
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
  name?: string;
  competitors?: Record<string, CoreixCompetitor>;
  markets?: CoreixMarket[];
}
interface CoreixTournament {
  events?: CoreixEvent[];
}
interface CoreixBody {
  data?: {
    tournaments?: Record<string, CoreixTournament>;
  };
}

const teApuestoScraper: Scraper = {
  nombre: "te_apuesto",

  async capturarPorApi(partido) {
    const ligaCanonica = detectarLigaCanonica(partido.liga);
    if (!ligaCanonica) return null;
    const url = obtenerUrlListado(ligaCanonica, "te_apuesto");
    if (!url) return null;

    const candidatos = await capturarJsonsConCuotas(url, {
      source: "scrapers:te-apuesto",
      esperaPostLoadMs: 6_000,
    });

    const diagnostico: Array<{
      url: string;
      bytes: number;
      tournaments: number;
      eventos: number;
      mejorScore: number;
      mejorMatch?: { local: string; visita: string };
    }> = [];

    for (const c of candidatos) {
      const body = c.body as CoreixBody;
      const tournaments = body?.data?.tournaments;
      const events: CoreixEvent[] = [];
      if (tournaments) {
        for (const t of Object.values(tournaments)) {
          if (t.events) events.push(...t.events);
        }
      }

      let mejor: CoreixEvent | null = null;
      let mejorScore = 0;
      let mejorMatch: { local: string; visita: string } | undefined;
      for (const e of events) {
        const home = extractCompetitor(e, "home");
        const away = extractCompetitor(e, "away");
        if (!home || !away) continue;
        const score = Math.min(
          similitudEquipos(home, partido.equipoLocal),
          similitudEquipos(away, partido.equipoVisita),
        );
        if (score > mejorScore) {
          mejorScore = score;
          mejor = e;
          mejorMatch = { local: home, visita: away };
        }
      }
      diagnostico.push({
        url: c.url,
        bytes: c.bytes,
        tournaments: tournaments ? Object.keys(tournaments).length : 0,
        eventos: events.length,
        mejorScore,
        mejorMatch,
      });
      if (!mejor || mejorScore < UMBRAL_FUZZY_DEFAULT * 0.7) continue;

      const cuotas = mapearCuotasCoreix(mejor);
      if (Object.keys(cuotas).length === 0) continue;

      return {
        cuotas,
        fuente: { url: c.url, capturadoEn: new Date() },
        eventIdCasa: String(mejor.id ?? ""),
        equipos: {
          local: extractCompetitor(mejor, "home") ?? partido.equipoLocal,
          visita: extractCompetitor(mejor, "away") ?? partido.equipoVisita,
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
        source: "scrapers:te-apuesto",
      },
      `te-apuesto: ningún JSON candidato matcheó el partido (mejor score=${diagnostico.reduce((m, d) => Math.max(m, d.mejorScore), 0).toFixed(3)})`,
    );
    return null;
  },
};

function extractCompetitor(event: CoreixEvent, rol: "home" | "away"): string | null {
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

  type FlatOdd = CoreixOdd & { marketName: string; providerMarketId: string };
  const allOdds: FlatOdd[] = [];
  for (const m of event.markets ?? []) {
    const marketName = norm(m.name);
    const providerMarketId = String(m.provider_market_id ?? "");
    for (const mo of m.market_odds ?? []) {
      for (const o of mo.odds ?? []) {
        allOdds.push({ ...o, marketName, providerMarketId });
      }
    }
  }

  // 1X2
  const odds1x2 = allOdds.filter(
    (o) => o.marketName === "1x2" || o.providerMarketId === "1",
  );
  if (odds1x2.length > 0) {
    const l = priceOk(odds1x2.find((o) => o.provider_odd_id === "1")?.value);
    const e = priceOk(odds1x2.find((o) => o.provider_odd_id === "2")?.value);
    const v = priceOk(odds1x2.find((o) => o.provider_odd_id === "3")?.value);
    if (l && e && v) cuotas["1x2"] = { local: l, empate: e, visita: v };
  }

  // Doble Op
  const oddsDoble = allOdds.filter(
    (o) => o.marketName.includes("doble") || o.providerMarketId === "10",
  );
  if (oddsDoble.length > 0) {
    const x1 = priceOk(oddsDoble.find((o) => o.provider_odd_id === "9")?.value);
    const x12 = priceOk(oddsDoble.find((o) => o.provider_odd_id === "10")?.value);
    const xx2 = priceOk(oddsDoble.find((o) => o.provider_odd_id === "11")?.value);
    if (x1 && x12 && xx2) cuotas.doble_op = { x1, x12, xx2 };
  }

  // BTTS
  const oddsBtts = allOdds.filter(
    (o) =>
      o.marketName.includes("ambos") ||
      o.marketName.includes("btts") ||
      o.providerMarketId === "29",
  );
  if (oddsBtts.length > 0) {
    const si = priceOk(oddsBtts.find((o) => o.provider_odd_id === "74")?.value);
    const no = priceOk(oddsBtts.find((o) => o.provider_odd_id === "76")?.value);
    if (si && no) cuotas.btts = { si, no };
  }

  // Total goles 2.5 — excluir explícitamente Mitad markets.
  const oddsTotal = allOdds.filter(
    (o) =>
      (o.marketName === "total" || o.providerMarketId === "18") &&
      o.special_value === "2.5",
  );
  if (oddsTotal.length > 0) {
    const over = priceOk(oddsTotal.find((o) => o.provider_odd_id === "12")?.value);
    const under = priceOk(oddsTotal.find((o) => o.provider_odd_id === "13")?.value);
    if (over && under) cuotas.mas_menos_25 = { over, under };
  }

  return cuotas;
}

export default teApuestoScraper;
