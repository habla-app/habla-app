// Scraper Inkabet via Playwright + XHR intercept (Lote V.12 — May 2026).
//
// Inkabet usa Octonovus/OBG. El listing dispara XHRs con `data.events[]`,
// `data.markets[]`, `data.selections[]`. Para los detalles full hay que
// hacer doble nav al slug del partido (ej.
// `/pe/apuestas-deportivas/futbol/peru/peru-liga-1/utc-cajamarca-vs-fc-cajamarca`).

import { logger } from "../logger";
import { similitudEquipos, UMBRAL_FUZZY_MATCH_PARTIDO } from "./fuzzy-match";
import {
  recolectarJsons,
  priceOk,
  norm,
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

const inkabetScraper: Scraper = {
  nombre: "inkabet",

  async capturarConPlaywright(partido, ligaCanonica) {
    const recolectado = await recolectarJsons({
      casa: "inkabet",
      ligaCanonica,
      partido,
      dobleNav: async (ctx) => dobleNavInkabet(ctx),
    });
    if (!recolectado) return null;

    const r = parsearInkabet(
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
          source: "scrapers:inkabet",
        },
        `inkabet: parser no encontró el partido`,
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

// ─── Doble navegación: encontrar slug en JSONs y navegar al detalle ──

async function dobleNavInkabet(ctx: DobleNavCtx): Promise<void> {
  const slug = encontrarSlug(ctx.todosJsons, ctx.partido);
  if (!slug) return;
  const urlDetalle = `https://inkabet.pe/pe/apuestas-deportivas/${slug}`;
  try {
    await ctx.page.goto(urlDetalle, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await ctx.page.waitForTimeout(2000);
    await ctx.page.waitForTimeout(TIEMPO_ESPERA_MS);
  } catch {
    /* doble nav best-effort */
  }
}

function encontrarSlug(
  jsons: JsonCapturado[],
  partido: { equipoLocal: string; equipoVisita: string },
): string | null {
  const tokensL = tokensDistintivos(partido.equipoLocal);
  const tokensV = tokensDistintivos(partido.equipoVisita);
  for (const j of jsons) {
    const found = walkBuscarSlug(j.body, tokensL, tokensV);
    if (found) return found;
  }
  return null;
}

function tokensDistintivos(equipo: string): string[] {
  return equipo
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\wáéíóúüñ]/g, ""))
    .filter((w) => w.length >= 3);
}

function walkBuscarSlug(
  obj: unknown,
  tokensL: string[],
  tokensV: string[],
  depth = 0,
): string | null {
  if (depth > 25 || obj === null || obj === undefined) return null;
  if (typeof obj === "string") {
    if (obj.includes("/")) {
      const lower = obj.toLowerCase();
      const hayL = tokensL.some((w) => lower.includes(w));
      const hayV = tokensV.some((w) => lower.includes(w));
      if (hayL && hayV) {
        const partes = obj.split("/").filter(Boolean);
        if (partes.length >= 4) return obj;
      }
    }
    return null;
  }
  if (typeof obj === "object") {
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = walkBuscarSlug(item, tokensL, tokensV, depth + 1);
        if (found) return found;
      }
    } else {
      const o = obj as Record<string, unknown>;
      for (const k of ["slug", "neutralPath", "url", "path"]) {
        if (typeof o[k] === "string") {
          const found = walkBuscarSlug(o[k], tokensL, tokensV, depth + 1);
          if (found) return found;
        }
      }
      for (const k of Object.keys(o)) {
        const found = walkBuscarSlug(o[k], tokensL, tokensV, depth + 1);
        if (found) return found;
      }
    }
  }
  return null;
}

// ─── Parser ───────────────────────────────────────────────────────────

interface ParserResult {
  cuotas: CuotasCapturadas;
  eventoId?: string;
  jsonUrl?: string;
  equipos?: { local: string; visita: string };
}

function extraerEventsMarketsSelections(body: any): {
  events: any[];
  markets: any[];
  selections: any[];
} {
  const events: any[] = [];
  const markets: any[] = [];
  const selections: any[] = [];
  function walk(obj: any, depth = 0): void {
    if (depth > 20 || obj === null || obj === undefined) return;
    if (Array.isArray(obj)) {
      const first = obj[0];
      if (first && typeof first === "object") {
        if ("globalId" in first && "participants" in first) {
          events.push(...obj);
        } else if (
          "marketTemplateId" in first ||
          ("eventId" in first && "id" in first && "lineValue" in first)
        ) {
          markets.push(...obj);
        } else if ("marketId" in first && "odds" in first) {
          selections.push(...obj);
        } else {
          for (const item of obj) walk(item, depth + 1);
        }
      } else {
        for (const item of obj) walk(item, depth + 1);
      }
    } else if (typeof obj === "object") {
      if (obj.events && Array.isArray(obj.events) && obj.events[0]?.globalId) {
        events.push(...obj.events);
      }
      if (
        obj.markets &&
        Array.isArray(obj.markets) &&
        obj.markets[0]?.marketTemplateId
      ) {
        markets.push(...obj.markets);
      }
      if (
        obj.selections &&
        Array.isArray(obj.selections) &&
        obj.selections[0]?.marketId
      ) {
        selections.push(...obj.selections);
      }
      for (const k of Object.keys(obj)) walk(obj[k], depth + 1);
    }
  }
  walk(body);
  return { events, markets, selections };
}

function parsearInkabet(
  jsons: JsonCapturado[],
  equipoLocal: string,
  equipoVisita: string,
): ParserResult | null {
  type Candidato = {
    url: string;
    events: any[];
    markets: any[];
    selections: any[];
  };
  const candidatos: Candidato[] = [];
  for (const j of jsons) {
    const { events, markets, selections } = extraerEventsMarketsSelections(
      j.body,
    );
    if (events.length > 0 || markets.length > 0) {
      candidatos.push({ url: j.url, events, markets, selections });
    }
  }

  const tokensL = equipoLocal
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  const tokensV = equipoVisita
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  const jsonsConToken = jsons.filter((j) => {
    try {
      const t = JSON.stringify(j.body).toLowerCase();
      return tokensL.some((w) => t.includes(w)) || tokensV.some((w) => t.includes(w));
    } catch {
      return false;
    }
  });

  const allEvents = candidatos.flatMap((c) => c.events);
  const allMarkets = candidatos.flatMap((c) => c.markets);
  const allSelections = candidatos.flatMap((c) => c.selections);

  if (allEvents.length === 0 && allMarkets.length === 0) return null;

  const TEMPLATES_1X2 = new Set(["MW3W", "ESFMWINNER3W", "E1X2M"]);
  const TEMPLATES_DOBLE_OP = new Set(["DC", "ESFMDCHANCE"]);
  const TEMPLATES_TOTAL = new Set([
    "MTG2W25",
    "MTG2W",
    "ESFMTOTAL",
    "ESFMATOTAL",
    "EOU25M",
  ]);
  const TEMPLATES_BTTS = new Set(["BTTS", "ESFMBTS"]);

  let mejor: any = null;
  let mejorScore = 0;
  let mejorHome = "";
  let mejorAway = "";
  for (const ev of allEvents) {
    const home = ev.participants?.find((p: any) => p.side === 1)?.label;
    const away = ev.participants?.find((p: any) => p.side === 2)?.label;
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

  let eventMarkets: any[];
  let eventId = "";
  if (mejor && mejorScore >= UMBRAL_FUZZY_MATCH_PARTIDO) {
    let id: string = mejor.globalId ?? "";
    if (id.includes(".")) {
      const partes = id.split(".");
      id = partes[partes.length - 1];
    }
    eventId = id;
    eventMarkets = allMarkets.filter((m: any) => m.eventId === eventId);
  } else if (allMarkets.length > 0) {
    let eventIdEnUrl = "";
    for (const j of jsonsConToken) {
      const m = j.url.match(/[?&]eventId=([^&]+)/);
      if (m && m[1]) {
        const raw = decodeURIComponent(m[1]);
        let id = raw;
        if (id.includes(".")) {
          const partes = id.split(".");
          id = partes[partes.length - 1];
        }
        eventIdEnUrl = id;
        break;
      }
    }
    if (eventIdEnUrl) {
      eventId = eventIdEnUrl;
      eventMarkets = allMarkets.filter((m: any) => m.eventId === eventIdEnUrl);
      mejorHome = equipoLocal;
      mejorAway = equipoVisita;
    } else {
      const idsUnicos = new Set(
        allMarkets.map((m: any) => m.eventId).filter(Boolean),
      );
      if (idsUnicos.size !== 1) return null;
      eventId = Array.from(idsUnicos)[0] as string;
      eventMarkets = allMarkets;
      mejorHome = equipoLocal;
      mejorAway = equipoVisita;
    }
  } else {
    return null;
  }

  if (eventMarkets.length === 0) return null;

  const selsParaMarket = (mid: string) =>
    allSelections.filter((s: any) => s.marketId === mid);

  const cuotas: CuotasCapturadas = {};
  const sP = (v: number | undefined) => priceOk(v);
  const normSel = (s: any): string =>
    norm(s.alternateLabel ?? s.participantLabel ?? "");

  for (const m of eventMarkets) {
    if (!cuotas["1x2"] && TEMPLATES_1X2.has(m.marketTemplateId)) {
      const sels = selsParaMarket(m.id);
      // Octonovus a veces solo trae HOME con selectionTemplateId completo;
      // DRAW/AWAY vienen con templateId vacío. Fallback a sortOrder.
      const l = sP(
        sels.find(
          (s: any) =>
            s.selectionTemplateId === "HOME" ||
            s.isHomeTeam === true ||
            s.sortOrder === 1,
        )?.odds,
      );
      const e = sP(
        sels.find(
          (s: any) => s.selectionTemplateId === "DRAW" || s.sortOrder === 2,
        )?.odds,
      );
      const v = sP(
        sels.find(
          (s: any) =>
            s.selectionTemplateId === "AWAY" ||
            s.isAwayTeam === true ||
            s.sortOrder === 3,
        )?.odds,
      );
      if (l && e && v) cuotas["1x2"] = { local: l, empate: e, visita: v };
    }
    if (!cuotas.doble_op && TEMPLATES_DOBLE_OP.has(m.marketTemplateId)) {
      const sels = selsParaMarket(m.id);
      const matchTpl = (s: any, ...opts: string[]) =>
        opts.includes((s.selectionTemplateId ?? "").toUpperCase());
      const x1 = sP(
        sels.find(
          (s: any) =>
            matchTpl(s, "HOME_OR_DRAW", "HOMEORDRAW", "1X") ||
            normSel(s) === "1x" ||
            normSel(s) === "1 o x",
        )?.odds,
      );
      const x12 = sP(
        sels.find(
          (s: any) =>
            matchTpl(s, "HOME_OR_AWAY", "HOMEORAWAY", "12") ||
            normSel(s) === "12" ||
            normSel(s) === "1 o 2",
        )?.odds,
      );
      const xx2 = sP(
        sels.find(
          (s: any) =>
            matchTpl(s, "DRAW_OR_AWAY", "DRAWORAWAY", "X2") ||
            normSel(s) === "x2" ||
            normSel(s) === "x o 2",
        )?.odds,
      );
      if (x1 && x12 && xx2) cuotas.doble_op = { x1, x12, xx2 };
    }
    if (!cuotas.mas_menos_25 && TEMPLATES_TOTAL.has(m.marketTemplateId)) {
      const lineOk =
        m.marketTemplateId === "MTG2W25" ||
        m.marketTemplateId === "EOU25M" ||
        m.lineValue === "2.5" ||
        m.lineValueRaw === 2.5;
      if (lineOk) {
        const sels = selsParaMarket(m.id);
        const over = sP(
          sels.find((s: any) => {
            const t = (s.selectionTemplateId ?? "").toUpperCase();
            return (
              t.includes("OVER") ||
              normSel(s).includes("mas") ||
              normSel(s).includes("over")
            );
          })?.odds,
        );
        const under = sP(
          sels.find((s: any) => {
            const t = (s.selectionTemplateId ?? "").toUpperCase();
            return (
              t.includes("UNDER") ||
              normSel(s).includes("menos") ||
              normSel(s).includes("under")
            );
          })?.odds,
        );
        if (over && under) cuotas.mas_menos_25 = { over, under };
      }
    }
    if (!cuotas.btts && TEMPLATES_BTTS.has(m.marketTemplateId)) {
      const sels = selsParaMarket(m.id);
      const si = sP(
        sels.find((s: any) => {
          const t = (s.selectionTemplateId ?? "").toUpperCase();
          return t === "YES" || normSel(s) === "si" || normSel(s) === "sí";
        })?.odds,
      );
      const no = sP(
        sels.find((s: any) => {
          const t = (s.selectionTemplateId ?? "").toUpperCase();
          return t === "NO" || normSel(s) === "no";
        })?.odds,
      );
      if (si && no) cuotas.btts = { si, no };
    }
  }

  if (Object.keys(cuotas).length === 0) return null;
  return {
    cuotas,
    eventoId: eventId,
    jsonUrl: candidatos[0]?.url ?? "",
    equipos: { local: mejorHome, visita: mejorAway },
  };
}

export default inkabetScraper;
