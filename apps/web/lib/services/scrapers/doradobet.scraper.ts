// Scraper Doradobet via Playwright + XHR intercept (Lote V.12 — May 2026).
//
// Doradobet embebe el widget Altenar (`sb2frontend-altenar2.biahosted.com`).
// El listing trae 6 markets por evento con la línea "principal" de Total
// (ej. 4.5 para favoritos claros como Bayern @1.58). Para acceder a las
// líneas alternativas (incluyendo 2.5) hay que hacer click en el partido
// en el listing, lo que dispara el endpoint Altenar `GetEventDetails` con
// 322 markets + 1060 childMarkets. Doradobet usa Shadow DOM in-page (no
// iframe), así que `querySelectorAll` no penetra; sí lo hace Playwright
// `getByText`/`locator`.
//
// Limitación conocida: las líneas alternativas de Total goles puro
// (typeId=18 con sv distinto al principal) NO viajan por XHR HTTP — viven
// en WebSocket del endpoint `sb2integration-altenar2`. Para partidos con
// favorito muy claro donde la línea principal no es 2.5, el motor reporta
// PARCIAL (faltando mas_menos_25). Para partidos parejos (típicos de Liga 1
// Perú) la línea 2.5 sí está en el listing/detalle.

import { logger } from "../logger";
import { similitudEquipos, UMBRAL_FUZZY_DEFAULT } from "./fuzzy-match";
import {
  recolectarJsons,
  priceOk,
  type JsonCapturado,
  type DobleNavCtx,
} from "./playwright-runner";
import {
  type CuotasCapturadas,
  type ResultadoScraper,
  type Scraper,
} from "./types";

// Lote V.13.1: subido de 8s a 15s — paridad con script lean exitoso.
const TIEMPO_ESPERA_MS = 15_000;

const doradobetScraper: Scraper = {
  nombre: "doradobet",

  async capturarConPlaywright(partido, ligaCanonica) {
    const recolectado = await recolectarJsons({
      casa: "doradobet",
      ligaCanonica,
      partido,
      dobleNav: async (ctx) => dobleNavDoradobet(ctx),
    });
    if (!recolectado) return null;

    const r = parsearDoradobet(
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
          source: "scrapers:doradobet",
        },
        `doradobet: parser no encontró el partido`,
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

// ─── Doble nav: click Shadow DOM en el partido del listing ──────────

async function dobleNavDoradobet(ctx: DobleNavCtx): Promise<void> {
  const pageAny = ctx.page as any;
  // Click via getByText (penetra Shadow DOM del widget Altenar)
  const candidatosLocator: any[] = [];
  if (typeof pageAny.getByText === "function") {
    candidatosLocator.push(
      pageAny.getByText(ctx.partido.equipoLocal, { exact: false }),
    );
    candidatosLocator.push(
      pageAny.getByText(ctx.partido.equipoVisita, { exact: false }),
    );
  }
  candidatosLocator.push(
    pageAny.locator(`text=${ctx.partido.equipoLocal}`),
    pageAny.locator(`text=${ctx.partido.equipoVisita}`),
  );
  for (const loc of candidatosLocator) {
    try {
      const first = loc.first();
      if (await first.isVisible({ timeout: 2500 })) {
        await first.click({ timeout: 5000 });
        await ctx.page.waitForTimeout(3000);
        await ctx.page.waitForTimeout(TIEMPO_ESPERA_MS);
        return;
      }
    } catch {
      /* probar siguiente */
    }
  }
}

// ─── Parser Altenar ─────────────────────────────────────────────────

interface ParserResult {
  cuotas: CuotasCapturadas;
  eventoId?: string | number;
  jsonUrl?: string;
  equipos?: { local: string; visita: string };
}

function parsearDoradobet(
  jsons: JsonCapturado[],
  equipoLocal: string,
  equipoVisita: string,
): ParserResult | null {
  // 1) Identificar el evento matched en /widget/GetEvents (listing)
  const jListing = jsons.find(
    (x) =>
      x.url.includes("/widget/GetEvents") &&
      Array.isArray((x.body as any)?.events),
  );
  if (!jListing) return null;

  const bodyListing: any = jListing.body;
  const competitorsById = new Map<number, any>();
  for (const c of bodyListing.competitors ?? []) competitorsById.set(c.id, c);

  let mejorEv: any = null;
  let mejorScore = 0;
  for (const ev of bodyListing.events ?? []) {
    const local = competitorsById.get(ev.competitorIds?.[0])?.name;
    const visita = competitorsById.get(ev.competitorIds?.[1])?.name;
    if (!local || !visita) continue;
    const score = Math.min(
      similitudEquipos(local, equipoLocal),
      similitudEquipos(visita, equipoVisita),
    );
    if (score > mejorScore) {
      mejorScore = score;
      mejorEv = ev;
    }
  }
  if (!mejorEv || mejorScore < UMBRAL_FUZZY_DEFAULT * 0.7) return null;

  // 2) Combinar markets+odds de TODOS los JSONs Altenar (listing + detalle)
  // PREFER LISTING: el listing tiene shape completo (typeId/sv/oddIds);
  // el detalle sobrescribe con shape distinto si comparte ids.
  const marketsById = new Map<number, any>();
  const oddsById = new Map<number, any>();
  // Pasada 1: listing
  for (const x of jsons) {
    const b: any = x.body;
    if (
      !b ||
      typeof b !== "object" ||
      !Array.isArray(b.events) ||
      !Array.isArray(b.markets)
    ) {
      continue;
    }
    for (const m of b.markets) {
      if (m && typeof m.id === "number") marketsById.set(m.id, m);
    }
    if (Array.isArray(b.odds)) {
      for (const o of b.odds) {
        if (o && typeof o.id === "number") oddsById.set(o.id, o);
      }
    }
  }
  // Pasada 2: detalle (GetEventDetails con markets + childMarkets)
  for (const x of jsons) {
    const b: any = x.body;
    if (!b || typeof b !== "object") continue;
    if (Array.isArray(b.events) && Array.isArray(b.markets)) continue;
    if (Array.isArray(b.markets)) {
      for (const m of b.markets) {
        if (m && typeof m.id === "number" && !marketsById.has(m.id)) {
          marketsById.set(m.id, m);
        }
      }
    }
    if (Array.isArray(b.childMarkets)) {
      for (const m of b.childMarkets) {
        if (m && typeof m.id === "number" && !marketsById.has(m.id)) {
          marketsById.set(m.id, m);
        }
      }
    }
    if (Array.isArray(b.odds)) {
      for (const o of b.odds) {
        if (o && typeof o.id === "number" && !oddsById.has(o.id)) {
          oddsById.set(o.id, o);
        }
      }
    }
  }

  // 3) Resolver marketIds del evento:
  //    a) marketIds del mejorEv (listing)
  //    b) markets con eventId === mejorEv.id (detalle con field eventId)
  //    c) markets de un body GetEventDetails cuyo body.id === mejorEv.id
  //       (cada market en ese body NO tiene eventId — body entero es del evento)
  const marketIdsDelEvento = new Set<number>(
    Array.isArray(mejorEv.marketIds) ? mejorEv.marketIds : [],
  );
  for (const m of marketsById.values()) {
    if (m.eventId === mejorEv.id) marketIdsDelEvento.add(m.id);
  }
  for (const x of jsons) {
    const b: any = x.body;
    if (!b || typeof b !== "object" || Array.isArray(b)) continue;
    const bodyEvtId = b.id ?? b.feedEventId;
    if (bodyEvtId !== mejorEv.id) continue;
    for (const arr of [b.markets, b.childMarkets]) {
      if (!Array.isArray(arr)) continue;
      for (const m of arr) {
        if (m && typeof m.id === "number") marketIdsDelEvento.add(m.id);
      }
    }
  }

  // 4) Índice inverso oddsByMarketId (GetEventDetails trae market.oddIds=[]
  // vacío; las odds tienen `marketId` que apunta al market).
  const oddsByMarketId = new Map<number, any[]>();
  for (const o of oddsById.values()) {
    if (typeof o.marketId === "number") {
      const arr = oddsByMarketId.get(o.marketId) ?? [];
      arr.push(o);
      oddsByMarketId.set(o.marketId, arr);
    }
  }

  // 5) Extraer cuotas
  const cuotas: CuotasCapturadas = {};
  for (const mid of marketIdsDelEvento) {
    const m = marketsById.get(mid);
    if (!m) continue;
    let odds = (m.oddIds ?? [])
      .map((id: number) => oddsById.get(id))
      .filter(Boolean);
    if (odds.length === 0) {
      odds = oddsByMarketId.get(m.id) ?? [];
    }

    if (m.typeId === 1 && !cuotas["1x2"]) {
      const l = priceOk(odds.find((o: any) => o.typeId === 1)?.price);
      const e = priceOk(odds.find((o: any) => o.typeId === 2)?.price);
      const v = priceOk(odds.find((o: any) => o.typeId === 3)?.price);
      if (l && e && v) cuotas["1x2"] = { local: l, empate: e, visita: v };
    } else if (m.typeId === 10 && !cuotas.doble_op) {
      const x1 = priceOk(odds.find((o: any) => o.typeId === 9)?.price);
      const x12 = priceOk(odds.find((o: any) => o.typeId === 10)?.price);
      const xx2 = priceOk(odds.find((o: any) => o.typeId === 11)?.price);
      if (x1 && x12 && xx2) cuotas.doble_op = { x1, x12, xx2 };
    } else if (m.typeId === 18 && m.sv === "2.5" && !cuotas.mas_menos_25) {
      const over = priceOk(odds.find((o: any) => o.typeId === 12)?.price);
      const under = priceOk(odds.find((o: any) => o.typeId === 13)?.price);
      if (over && under) cuotas.mas_menos_25 = { over, under };
    } else if (m.typeId === 29 && !cuotas.btts) {
      const si = priceOk(odds.find((o: any) => o.typeId === 74)?.price);
      const no = priceOk(odds.find((o: any) => o.typeId === 76)?.price);
      if (si && no) cuotas.btts = { si, no };
    }
  }

  const local = competitorsById.get(mejorEv.competitorIds?.[0])?.name;
  const visita = competitorsById.get(mejorEv.competitorIds?.[1])?.name;
  return {
    cuotas,
    eventoId: mejorEv.id,
    jsonUrl: jListing.url,
    equipos: local && visita ? { local, visita } : undefined,
  };
}

export default doradobetScraper;
