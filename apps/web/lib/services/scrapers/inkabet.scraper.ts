// Scraper Inkabet via API directa Octonovus/OBG (Lote V.11.1 — May 2026).
//
// Inkabet embebe el sportsbook de Octonovus/OBG via inkabetplayground.net.
// Validado el 2026-05-08 con JSON real provisto por admin (urls2.txt) que
// el endpoint:
//   https://d-cf.inkabetplayground.net/api/sb/v1/widgets/events-table/v2
// responde con shape `{ skeleton, topics, data: { events[], markets[],
// selections[] }}` donde:
//   - data.events[]  : metadatos del partido (participants, slug, fechas)
//   - data.markets[] : eventos × tipos de mercado (eventId + marketTemplateId)
//   - data.selections[]: cuotas por outcome (marketId + odds + selectionTemplateId)
//
// Las tres colecciones son arrays separados; se cruzan por `eventId` (en
// markets) y `marketId` (en selections).
//
// MarketTemplateIds relevantes (del skeleton del response):
//   - "MW3W" / "ESFMWINNER3W" / "E1X2M"          → 1X2 (Ganador del Partido)
//   - "MTG2W25" / "MTG2W" / "EOU25M"             → Total de Goles (line 2.5)
//   - "BTTS" / "ESFMBTS"                         → Ambos Equipos Anotan
//   - "DC" / "ESFMDCHANCE"                       → Doble Oportunidad
//
// SelectionTemplateIds dentro de cada market:
//   - 1X2: "HOME" / "DRAW" / "AWAY"
//   - Doble Op: "HOME_OR_DRAW" / "HOME_OR_AWAY" / "DRAW_OR_AWAY"
//   - Total: "OVER" / "UNDER" (con lineValue="2.5")
//   - BTTS: "YES" / "NO"
//
// Lote V.11 usaba `maxMarketCount=10` — bumpeado a `50` para no perder
// templates secundarios (Doble Op estaba siendo truncado).

import { logger } from "../logger";
import { httpFetchJson } from "./http";
import { similitudEquipos, UMBRAL_FUZZY_DEFAULT } from "./fuzzy-match";
import type { CuotasCapturadas, ResultadoScraper, Scraper } from "./types";

const URL_BASE = "https://d-cf.inkabetplayground.net";

interface OctonovusParticipant {
  label?: string;
  id?: string;
  side?: number;
  sortOrder?: number;
}

interface OctonovusEvent {
  nodeIdentifier?: string;
  globalId?: string;
  competitionId?: string;
  competitionName?: string;
  slug?: string;
  participants?: OctonovusParticipant[];
  startsAt?: string;
}

interface OctonovusMarket {
  eventId?: string;
  marketTemplateId?: string;
  lineValue?: string;
  lineValueRaw?: number;
  status?: string;
  id?: string;
}

interface OctonovusSelection {
  marketId?: string;
  odds?: number;
  alternateLabel?: string;
  participantLabel?: string;
  selectionTemplateId?: string;
  participant?: string;
  label?: string;
  id?: string;
  isHomeTeam?: boolean;
  isAwayTeam?: boolean;
}

interface OctonovusResponse {
  skeleton?: unknown;
  data?: {
    events?: OctonovusEvent[];
    markets?: OctonovusMarket[];
    selections?: OctonovusSelection[];
  };
}

const inkabetScraper: Scraper = {
  nombre: "inkabet",

  async capturarPorApi(partido, ligaIdCasa) {
    // Ventana 14 días desde ahora.
    const now = new Date();
    const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const startsOnOrAfter = now.toISOString().replace(/\.\d{3}Z$/, "Z");
    const startsBefore = in14.toISOString().replace(/\.\d{3}Z$/, "Z");

    const url =
      `${URL_BASE}/api/sb/v1/widgets/events-table/v2?` +
      new URLSearchParams({
        categoryIds: "1",
        competitionIds: ligaIdCasa,
        eventPhase: "Prematch",
        eventSortBy: "StartDate",
        includeSkeleton: "true",
        maxMarketCount: "50",
        pageNumber: "1",
        startsBefore,
        startsOnOrAfter,
        priceFormats: "1",
      });

    const body = await httpFetchJson<OctonovusResponse>(url, {
      headers: {
        Origin: URL_BASE,
        Referer: `${URL_BASE}/`,
      },
      source: "scrapers:inkabet",
    });

    const events = body?.data?.events ?? [];
    const allMarkets = body?.data?.markets ?? [];
    const allSelections = body?.data?.selections ?? [];

    if (events.length === 0) {
      logger.warn(
        {
          partidoId: partido.id,
          ligaIdCasa,
          shape: Object.keys(body ?? {}),
          source: "scrapers:inkabet",
        },
        `inkabet: response no contiene eventos`,
      );
      return null;
    }

    // Buscar el evento que matchea con el partido.
    let mejor: OctonovusEvent | null = null;
    let mejorScore = 0;
    for (const event of events) {
      const home = extractParticipant(event, "home");
      const away = extractParticipant(event, "away");
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
          source: "scrapers:inkabet",
        },
        `inkabet: partido no encontrado en response`,
      );
      return null;
    }

    const eventGlobalId = mejor.globalId;
    if (!eventGlobalId) {
      logger.warn(
        {
          partidoId: partido.id,
          source: "scrapers:inkabet",
        },
        `inkabet: evento matched pero sin globalId`,
      );
      return null;
    }

    // Filtrar markets de este evento; selections se filtran por marketId.
    const eventMarkets = allMarkets.filter((m) => m.eventId === eventGlobalId);
    const cuotas = mapearCuotasOctonovus(eventMarkets, allSelections);

    if (Object.keys(cuotas).length === 0) {
      logger.warn(
        {
          partidoId: partido.id,
          eventGlobalId,
          totalEventMarkets: eventMarkets.length,
          marketTemplates: eventMarkets.map((m) => m.marketTemplateId),
          totalSelections: allSelections.length,
          source: "scrapers:inkabet",
        },
        `inkabet: evento encontrado pero sin mercados extraíbles. Revisar shape.`,
      );
      return null;
    }

    return {
      cuotas,
      fuente: { url, capturadoEn: new Date() },
      eventIdCasa: eventGlobalId,
      equipos: {
        local: extractParticipant(mejor, "home") ?? partido.equipoLocal,
        visita: extractParticipant(mejor, "away") ?? partido.equipoVisita,
      },
    };
  },
};

function extractParticipant(
  event: OctonovusEvent,
  rol: "home" | "away",
): string | null {
  const participants = event.participants ?? [];
  // OBG usa `side: 1` para home y `side: 2` para away.
  const sideTarget = rol === "home" ? 1 : 2;
  return (
    participants.find((p) => p.side === sideTarget)?.label ??
    extractFromSlug(event.slug, rol) ??
    null
  );
}

function extractFromSlug(slug: string | undefined, rol: "home" | "away"): string | null {
  if (!slug) return null;
  // Slug pattern: "futbol/peru/peru-liga-1/utc-fc-cajamarca"
  const last = slug.split("/").pop();
  if (!last) return null;
  // Heurística: dividir en dos por el guión central. No siempre funciona
  // si los nombres tienen guiones internos — mejor confiar en participants.
  const parts = last.split("-");
  if (parts.length < 2) return null;
  const mid = Math.floor(parts.length / 2);
  return rol === "home"
    ? parts.slice(0, mid).join(" ")
    : parts.slice(mid).join(" ");
}

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

function mapearCuotasOctonovus(
  eventMarkets: OctonovusMarket[],
  allSelections: OctonovusSelection[],
): CuotasCapturadas {
  const cuotas: CuotasCapturadas = {};

  const selectionsParaMarket = (marketId: string) =>
    allSelections.filter((s) => s.marketId === marketId);

  // 1X2
  for (const market of eventMarkets) {
    if (!cuotas["1x2"] && TEMPLATES_1X2.has(market.marketTemplateId ?? "")) {
      const sels = selectionsParaMarket(market.id ?? "");
      const home = sels.find((s) => s.selectionTemplateId === "HOME" || s.isHomeTeam);
      const draw = sels.find((s) => s.selectionTemplateId === "DRAW");
      const away = sels.find((s) => s.selectionTemplateId === "AWAY" || s.isAwayTeam);
      const localP = priceOk(home?.odds);
      const empateP = priceOk(draw?.odds);
      const visitaP = priceOk(away?.odds);
      if (localP && empateP && visitaP) {
        cuotas["1x2"] = { local: localP, empate: empateP, visita: visitaP };
      }
    }
  }

  // Doble Oportunidad
  for (const market of eventMarkets) {
    if (
      !cuotas.doble_op &&
      TEMPLATES_DOBLE_OP.has(market.marketTemplateId ?? "")
    ) {
      const sels = selectionsParaMarket(market.id ?? "");
      const x1 = sels.find(
        (s) => s.selectionTemplateId === "HOME_OR_DRAW" || normSel(s) === "1x",
      );
      const x12 = sels.find(
        (s) => s.selectionTemplateId === "HOME_OR_AWAY" || normSel(s) === "12",
      );
      const xx2 = sels.find(
        (s) => s.selectionTemplateId === "DRAW_OR_AWAY" || normSel(s) === "x2",
      );
      const x1P = priceOk(x1?.odds);
      const x12P = priceOk(x12?.odds);
      const xx2P = priceOk(xx2?.odds);
      if (x1P && x12P && xx2P) {
        cuotas.doble_op = { x1: x1P, x12: x12P, xx2: xx2P };
      }
    }
  }

  // Total goles 2.5
  for (const market of eventMarkets) {
    if (
      !cuotas.mas_menos_25 &&
      TEMPLATES_TOTAL.has(market.marketTemplateId ?? "")
    ) {
      // Algunos templates ya implican 2.5 ("MTG2W25"); otros traen el line
      // explícito en lineValue.
      const lineOk =
        market.marketTemplateId === "MTG2W25" ||
        market.marketTemplateId === "EOU25M" ||
        market.lineValue === "2.5" ||
        market.lineValueRaw === 2.5;
      if (!lineOk) continue;
      const sels = selectionsParaMarket(market.id ?? "");
      const over = sels.find((s) => {
        const t = (s.selectionTemplateId ?? "").toUpperCase();
        return t === "OVER" || t.includes("OVER") || normSel(s).includes("mas") || normSel(s).includes("over");
      });
      const under = sels.find((s) => {
        const t = (s.selectionTemplateId ?? "").toUpperCase();
        return t === "UNDER" || t.includes("UNDER") || normSel(s).includes("menos") || normSel(s).includes("under");
      });
      const oP = priceOk(over?.odds);
      const uP = priceOk(under?.odds);
      if (oP && uP) {
        cuotas.mas_menos_25 = { over: oP, under: uP };
      }
    }
  }

  // BTTS
  for (const market of eventMarkets) {
    if (!cuotas.btts && TEMPLATES_BTTS.has(market.marketTemplateId ?? "")) {
      const sels = selectionsParaMarket(market.id ?? "");
      const si = sels.find((s) => {
        const t = (s.selectionTemplateId ?? "").toUpperCase();
        return t === "YES" || normSel(s) === "si" || normSel(s) === "sí";
      });
      const no = sels.find((s) => {
        const t = (s.selectionTemplateId ?? "").toUpperCase();
        return t === "NO" || normSel(s) === "no";
      });
      const sP = priceOk(si?.odds);
      const nP = priceOk(no?.odds);
      if (sP && nP) {
        cuotas.btts = { si: sP, no: nP };
      }
    }
  }

  return cuotas;
}

function priceOk(v: number | undefined | null): number | null {
  return typeof v === "number" && v > 1 && v < 100 ? v : null;
}

function normSel(s: OctonovusSelection): string {
  return (s.alternateLabel ?? s.participantLabel ?? s.label ?? s.participant ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export default inkabetScraper;
