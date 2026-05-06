// Scraper Betano via Playwright + XHR intercept (Lote V.12 — May 2026).
//
// Betano usa Danae (Kaizen) como B2B. Sus XHRs traen markets+selections
// per-evento (`/api/betbuilderplus/event?id=N&sportCode=FOOT`). El
// listing dispara un fetch por cada partido visible — incluyendo el
// nuestro. Sin doble nav.

import { logger } from "../logger";
import { similitudEquipos, UMBRAL_FUZZY_DEFAULT } from "./fuzzy-match";
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

const betanoScraper: Scraper = {
  nombre: "betano",

  async capturarConPlaywright(partido, ligaCanonica) {
    const recolectado = await recolectarJsons({
      casa: "betano",
      ligaCanonica,
      partido,
    });
    if (!recolectado) return null;

    const r = parsearBetano(
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
          source: "scrapers:betano",
        },
        `betano: parser no encontró el partido`,
      );
      return null;
    }

    // Lote V.14: persistir parciales en vez de descartarlos.
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

function parsearBetano(
  jsons: JsonCapturado[],
  equipoLocal: string,
  equipoVisita: string,
): ParserResult | null {
  const candidatos = jsons.filter(
    (j) =>
      (j.body as any)?.data?.markets &&
      (j.body as any)?.data?.selections,
  );
  for (const j of candidatos) {
    const data = (j.body as any).data;
    const roster = data.roster;
    let homeName = "";
    let awayName = "";
    if (roster && Array.isArray(roster)) {
      const home = roster.find((r: any) => r.type === "home");
      const away = roster.find((r: any) => r.type === "away");
      homeName = home?.name ?? "";
      awayName = away?.name ?? "";
    }
    if (homeName && awayName) {
      const score = Math.min(
        similitudEquipos(homeName, equipoLocal),
        similitudEquipos(awayName, equipoVisita),
      );
      if (score < UMBRAL_FUZZY_DEFAULT * 0.7) continue;
    } else {
      // Fallback: confiar en que el JSON contiene rastros del partido
      const txt = JSON.stringify(j.body).toLowerCase();
      const tokensLocal = equipoLocal
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 3);
      const tokensVisita = equipoVisita
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 3);
      const hayLocal = tokensLocal.some((w) => txt.includes(w));
      const hayVisita = tokensVisita.some((w) => txt.includes(w));
      if (!hayLocal || !hayVisita) continue;
    }

    const markets = data.markets;
    const selections = data.selections;
    const cuotas: CuotasCapturadas = {};
    const sP = (s: any) => priceOk(s?.price);

    for (const k of Object.keys(markets)) {
      const m = markets[k];
      const sels = (m.selectionIdList ?? [])
        .map((id: any) => selections[String(id)])
        .filter(Boolean);

      if ((m.type === "MRES" || m.typeId === 1) && !cuotas["1x2"]) {
        const l = sP(
          sels.find((s: any) => s.typeId === 1 || s.shortName === "1"),
        );
        const e = sP(
          sels.find((s: any) => s.typeId === 2 || s.shortName === "X"),
        );
        const v = sP(
          sels.find((s: any) => s.typeId === 3 || s.shortName === "2"),
        );
        if (l && e && v) cuotas["1x2"] = { local: l, empate: e, visita: v };
      } else if ((m.type === "DBLC" || m.typeId === 9) && !cuotas.doble_op) {
        const x1 = sP(
          sels.find(
            (s: any) =>
              s.typeId === 28 || s.shortName === "1X" || s.shortName === "1 ó X",
          ),
        );
        const x12 = sP(
          sels.find(
            (s: any) =>
              s.typeId === 30 || s.shortName === "12" || s.shortName === "1 ó 2",
          ),
        );
        const xx2 = sP(
          sels.find(
            (s: any) =>
              s.typeId === 29 || s.shortName === "X2" || s.shortName === "X ó 2",
          ),
        );
        if (x1 && x12 && xx2) cuotas.doble_op = { x1, x12, xx2 };
      } else if ((m.type === "BTSC" || m.typeId === 15) && !cuotas.btts) {
        const si = sP(
          sels.find((s: any) => {
            const sn = (s.shortName ?? "").toLowerCase();
            return s.typeId === 43 || sn === "sí" || sn === "si" || sn === "yes";
          }),
        );
        const no = sP(
          sels.find((s: any) => {
            const sn = (s.shortName ?? "").toLowerCase();
            return s.typeId === 44 || sn === "no";
          }),
        );
        if (si && no) cuotas.btts = { si, no };
      } else if ((m.type === "HCTG" || m.typeId === 13) && !cuotas.mas_menos_25) {
        const over = sP(
          sels.find(
            (s: any) =>
              (s.typeId === 39 ||
                (s.shortName ?? "").toLowerCase().startsWith("más") ||
                (s.shortName ?? "").toLowerCase().startsWith("over")) &&
              s.handicap === 2.5,
          ),
        );
        const under = sP(
          sels.find(
            (s: any) =>
              (s.typeId === 40 ||
                (s.shortName ?? "").toLowerCase().startsWith("menos") ||
                (s.shortName ?? "").toLowerCase().startsWith("under")) &&
              s.handicap === 2.5,
          ),
        );
        if (over && under) cuotas.mas_menos_25 = { over, under };
      }
    }

    if (Object.keys(cuotas).length > 0) {
      return {
        cuotas,
        jsonUrl: j.url,
        equipos:
          homeName && awayName
            ? { local: homeName, visita: awayName }
            : undefined,
      };
    }
  }
  return null;
}

export default betanoScraper;
