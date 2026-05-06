// Scraper Doradobet via browser + XHR intercept (Lote V.12 — May 2026).
//
// Doradobet usa Altenar como backend B2B. En vez de hacer HTTP directo,
// cargamos su página de la liga en Chromium headless, interceptamos las
// XHRs y agarramos la respuesta de Altenar (`/api/widget/GetEvents`).
//
// Mapeo typeId del MERCADO Altenar:
//   1=1X2, 10=Doble Op, 18=Total (sv=línea), 29=BTTS
// Mapeo typeId de la SELECCIÓN:
//   1/2/3=Local/Empate/Visita; 9/10/11=1X/12/X2; 12/13=Más/Menos; 74/76=Sí/No

import { logger } from "../logger";
import { similitudEquipos, UMBRAL_FUZZY_DEFAULT } from "./fuzzy-match";
import { capturarJsonsConCuotas } from "./xhr-intercept";
import { obtenerUrlListado } from "./urls-listing";
import { detectarLigaCanonica } from "./ligas-id-map";
import type { CuotasCapturadas, ResultadoScraper, Scraper } from "./types";

interface AltenarEvent {
  id: number;
  name: string;
  startDate: string;
  marketIds: number[];
  competitorIds: number[];
  champId?: number;
}
interface AltenarMarket {
  id: number;
  typeId: number;
  oddIds: number[];
  name: string;
  sv?: string;
}
interface AltenarOdd {
  id: number;
  typeId: number;
  price: number;
  name: string;
}
interface AltenarCompetitor {
  id: number;
  name: string;
}
interface AltenarBody {
  events?: AltenarEvent[];
  markets?: AltenarMarket[];
  odds?: AltenarOdd[];
  competitors?: AltenarCompetitor[];
}

const doradobetScraper: Scraper = {
  nombre: "doradobet",

  async capturarPorApi(partido) {
    const ligaCanonica = detectarLigaCanonica(partido.liga);
    if (!ligaCanonica) return null;
    const url = obtenerUrlListado(ligaCanonica, "doradobet");
    if (!url) return null;

    const candidatos = await capturarJsonsConCuotas(url, {
      source: "scrapers:doradobet",
    });

    for (const c of candidatos) {
      const body = c.body as AltenarBody;
      if (!body?.events || !body?.markets || !body?.odds) continue;

      const competitorsById = new Map<number, AltenarCompetitor>();
      for (const cmp of body.competitors ?? []) competitorsById.set(cmp.id, cmp);

      let mejor: AltenarEvent | null = null;
      let mejorScore = 0;
      for (const ev of body.events) {
        const local = competitorsById.get(ev.competitorIds?.[0] ?? -1)?.name;
        const visita = competitorsById.get(ev.competitorIds?.[1] ?? -1)?.name;
        if (!local || !visita) continue;
        const score = Math.min(
          similitudEquipos(local, partido.equipoLocal),
          similitudEquipos(visita, partido.equipoVisita),
        );
        if (score > mejorScore) {
          mejorScore = score;
          mejor = ev;
        }
      }
      if (!mejor || mejorScore < UMBRAL_FUZZY_DEFAULT * 0.7) continue;

      const marketsById = new Map<number, AltenarMarket>();
      for (const m of body.markets) marketsById.set(m.id, m);
      const oddsById = new Map<number, AltenarOdd>();
      for (const o of body.odds) oddsById.set(o.id, o);

      const cuotas: CuotasCapturadas = {};
      for (const mid of mejor.marketIds ?? []) {
        const m = marketsById.get(mid);
        if (!m) continue;
        const odds = (m.oddIds ?? [])
          .map((id) => oddsById.get(id))
          .filter((o): o is AltenarOdd => o !== undefined);

        if (m.typeId === 1) {
          const l = odds.find((o) => o.typeId === 1)?.price;
          const e = odds.find((o) => o.typeId === 2)?.price;
          const v = odds.find((o) => o.typeId === 3)?.price;
          if (l && e && v) cuotas["1x2"] = { local: l, empate: e, visita: v };
        } else if (m.typeId === 10) {
          const x1 = odds.find((o) => o.typeId === 9)?.price;
          const x12 = odds.find((o) => o.typeId === 10)?.price;
          const xx2 = odds.find((o) => o.typeId === 11)?.price;
          if (x1 && x12 && xx2) cuotas.doble_op = { x1, x12, xx2 };
        } else if (m.typeId === 18 && m.sv === "2.5") {
          const over = odds.find((o) => o.typeId === 12)?.price;
          const under = odds.find((o) => o.typeId === 13)?.price;
          if (over && under) cuotas.mas_menos_25 = { over, under };
        } else if (m.typeId === 29) {
          const si = odds.find((o) => o.typeId === 74)?.price;
          const no = odds.find((o) => o.typeId === 76)?.price;
          if (si && no) cuotas.btts = { si, no };
        }
      }

      if (Object.keys(cuotas).length === 0) continue;

      const local =
        competitorsById.get(mejor.competitorIds?.[0] ?? -1)?.name ??
        partido.equipoLocal;
      const visita =
        competitorsById.get(mejor.competitorIds?.[1] ?? -1)?.name ??
        partido.equipoVisita;

      return {
        cuotas,
        fuente: { url: c.url, capturadoEn: new Date() },
        eventIdCasa: String(mejor.id),
        equipos: { local, visita },
      };
    }

    logger.info(
      {
        partidoId: partido.id,
        candidatos: candidatos.length,
        source: "scrapers:doradobet",
      },
      `doradobet: ningún JSON candidato matcheó el partido`,
    );
    return null;
  },
};

export default doradobetScraper;
