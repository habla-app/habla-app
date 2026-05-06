// Scraper Inkabet via browser + XHR intercept (Lote V.12 — May 2026).
//
// Inkabet usa Octonovus/OBG. La página de la liga dispara XHRs a
// `/api/sb/v1/widgets/events-table/v2` con shape:
//   { skeleton, data: { events[], markets[], selections[] } }
//
// Cargamos la página en navegador → el JS pide la cantidad correcta de
// markets sin que tengamos que setear `maxMarketCount`. Nos llega el
// shape completo y lo parseamos.

import { logger } from "../logger";
import { similitudEquipos, UMBRAL_FUZZY_DEFAULT } from "./fuzzy-match";
import { capturarJsonsConCuotas } from "./xhr-intercept";
import { obtenerUrlListado } from "./urls-listing";
import { detectarLigaCanonica } from "./ligas-id-map";
import type { CuotasCapturadas, ResultadoScraper, Scraper } from "./types";

interface OBGParticipant {
  label?: string;
  side?: number;
}
interface OBGEvent {
  globalId?: string;
  competitionId?: string;
  slug?: string;
  participants?: OBGParticipant[];
}
interface OBGMarket {
  eventId?: string;
  marketTemplateId?: string;
  lineValue?: string;
  lineValueRaw?: number;
  id?: string;
}
interface OBGSelection {
  marketId?: string;
  odds?: number;
  alternateLabel?: string;
  participantLabel?: string;
  selectionTemplateId?: string;
  isHomeTeam?: boolean;
  isAwayTeam?: boolean;
}
interface OBGBody {
  data?: {
    events?: OBGEvent[];
    markets?: OBGMarket[];
    selections?: OBGSelection[];
  };
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

const inkabetScraper: Scraper = {
  nombre: "inkabet",

  async capturarPorApi(partido) {
    const ligaCanonica = detectarLigaCanonica(partido.liga);
    if (!ligaCanonica) return null;
    const url = obtenerUrlListado(ligaCanonica, "inkabet");
    if (!url) return null;

    const candidatos = await capturarJsonsConCuotas(url, {
      source: "scrapers:inkabet",
      esperaPostLoadMs: 6_000,
    });

    for (const c of candidatos) {
      const body = c.body as OBGBody;
      const events = body?.data?.events ?? [];
      if (events.length === 0) continue;
      const markets = body?.data?.markets ?? [];
      const selections = body?.data?.selections ?? [];

      let mejor: OBGEvent | null = null;
      let mejorScore = 0;
      for (const e of events) {
        const home = extractParticipant(e, 1);
        const away = extractParticipant(e, 2);
        if (!home || !away) continue;
        const score = Math.min(
          similitudEquipos(home, partido.equipoLocal),
          similitudEquipos(away, partido.equipoVisita),
        );
        if (score > mejorScore) {
          mejorScore = score;
          mejor = e;
        }
      }
      if (!mejor || mejorScore < UMBRAL_FUZZY_DEFAULT * 0.7) continue;

      const eventId = mejor.globalId;
      if (!eventId) continue;
      const eventMarkets = markets.filter((m) => m.eventId === eventId);
      const cuotas = mapearCuotasOBG(eventMarkets, selections);
      if (Object.keys(cuotas).length === 0) continue;

      return {
        cuotas,
        fuente: { url: c.url, capturadoEn: new Date() },
        eventIdCasa: eventId,
        equipos: {
          local: extractParticipant(mejor, 1) ?? partido.equipoLocal,
          visita: extractParticipant(mejor, 2) ?? partido.equipoVisita,
        },
      };
    }

    logger.info(
      {
        partidoId: partido.id,
        candidatos: candidatos.length,
        source: "scrapers:inkabet",
      },
      `inkabet: ningún JSON candidato matcheó el partido`,
    );
    return null;
  },
};

function extractParticipant(event: OBGEvent, side: number): string | null {
  return (
    event.participants?.find((p) => p.side === side)?.label ??
    extractFromSlug(event.slug, side === 1 ? "home" : "away") ??
    null
  );
}

function extractFromSlug(slug: string | undefined, rol: "home" | "away"): string | null {
  if (!slug) return null;
  const last = slug.split("/").pop();
  if (!last) return null;
  const parts = last.split("-");
  if (parts.length < 2) return null;
  const mid = Math.floor(parts.length / 2);
  return rol === "home"
    ? parts.slice(0, mid).join(" ")
    : parts.slice(mid).join(" ");
}

function mapearCuotasOBG(
  eventMarkets: OBGMarket[],
  allSelections: OBGSelection[],
): CuotasCapturadas {
  const cuotas: CuotasCapturadas = {};
  const selsParaMarket = (mid: string) =>
    allSelections.filter((s) => s.marketId === mid);
  const priceOk = (v: number | undefined): number | null =>
    typeof v === "number" && v > 1 && v < 100 ? v : null;
  const norm = (s: OBGSelection): string =>
    (s.alternateLabel ?? s.participantLabel ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();

  for (const m of eventMarkets) {
    if (!cuotas["1x2"] && TEMPLATES_1X2.has(m.marketTemplateId ?? "")) {
      const sels = selsParaMarket(m.id ?? "");
      const l = priceOk(
        sels.find((s) => s.selectionTemplateId === "HOME" || s.isHomeTeam)?.odds,
      );
      const e = priceOk(sels.find((s) => s.selectionTemplateId === "DRAW")?.odds);
      const v = priceOk(
        sels.find((s) => s.selectionTemplateId === "AWAY" || s.isAwayTeam)?.odds,
      );
      if (l && e && v) cuotas["1x2"] = { local: l, empate: e, visita: v };
    }
    if (!cuotas.doble_op && TEMPLATES_DOBLE_OP.has(m.marketTemplateId ?? "")) {
      const sels = selsParaMarket(m.id ?? "");
      const x1 = priceOk(
        sels.find((s) => s.selectionTemplateId === "HOME_OR_DRAW" || norm(s) === "1x")?.odds,
      );
      const x12 = priceOk(
        sels.find((s) => s.selectionTemplateId === "HOME_OR_AWAY" || norm(s) === "12")?.odds,
      );
      const xx2 = priceOk(
        sels.find((s) => s.selectionTemplateId === "DRAW_OR_AWAY" || norm(s) === "x2")?.odds,
      );
      if (x1 && x12 && xx2) cuotas.doble_op = { x1, x12, xx2 };
    }
    if (!cuotas.mas_menos_25 && TEMPLATES_TOTAL.has(m.marketTemplateId ?? "")) {
      const lineOk =
        m.marketTemplateId === "MTG2W25" ||
        m.marketTemplateId === "EOU25M" ||
        m.lineValue === "2.5" ||
        m.lineValueRaw === 2.5;
      if (lineOk) {
        const sels = selsParaMarket(m.id ?? "");
        const over = priceOk(
          sels.find((s) => {
            const t = (s.selectionTemplateId ?? "").toUpperCase();
            return t.includes("OVER") || norm(s).includes("mas") || norm(s).includes("over");
          })?.odds,
        );
        const under = priceOk(
          sels.find((s) => {
            const t = (s.selectionTemplateId ?? "").toUpperCase();
            return t.includes("UNDER") || norm(s).includes("menos") || norm(s).includes("under");
          })?.odds,
        );
        if (over && under) cuotas.mas_menos_25 = { over, under };
      }
    }
    if (!cuotas.btts && TEMPLATES_BTTS.has(m.marketTemplateId ?? "")) {
      const sels = selsParaMarket(m.id ?? "");
      const si = priceOk(
        sels.find((s) => {
          const t = (s.selectionTemplateId ?? "").toUpperCase();
          return t === "YES" || norm(s) === "si" || norm(s) === "sí";
        })?.odds,
      );
      const no = priceOk(
        sels.find((s) => {
          const t = (s.selectionTemplateId ?? "").toUpperCase();
          return t === "NO" || norm(s) === "no";
        })?.odds,
      );
      if (si && no) cuotas.btts = { si, no };
    }
  }

  return cuotas;
}

export default inkabetScraper;
