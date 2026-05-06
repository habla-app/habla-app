// Scraper Betano via browser + XHR intercept (Lote V.12 — May 2026).
//
// Betano usa Danae (Kaizen) como B2B. Cargamos la página de la liga y
// escuchamos las XHRs. Esperamos ver responses con shape:
//   { data: { events?: [...], markets: { id: market }, selections: { id: selection } } }
// donde markets/selections suelen estar indexed por id.
//
// Mapeo Kaizen:
//   market.type / typeId — MRES/1=1X2, DBLC/9=Doble Op, BTSC/15=BTTS, HCTG/13=Total
//   selection.typeId      — 1/2/3=Local/Empate/Visita; 28/30/29=1X/12/X2;
//                           39/40=Más/Menos (handicap=2.5); 43/44=Sí/No

import { logger } from "../logger";
import { similitudEquipos, UMBRAL_FUZZY_DEFAULT } from "./fuzzy-match";
import { capturarJsonsConCuotas } from "./xhr-intercept";
import { obtenerUrlListado } from "./urls-listing";
import { detectarLigaCanonica } from "./ligas-id-map";
import type { CuotasCapturadas, ResultadoScraper, Scraper } from "./types";

interface DanaeSelection {
  id?: number | string;
  price?: number;
  typeId?: number;
  shortName?: string;
  name?: string;
  handicap?: number;
}
interface DanaeMarket {
  id?: number | string;
  selectionIdList?: (number | string)[];
  type?: string;
  typeId?: number;
  name?: string;
}
interface DanaeEvent {
  id?: number | string;
  eventId?: number | string;
  name?: string;
  homeName?: string;
  awayName?: string;
  participants?: { name: string; type?: string }[];
  marketIdList?: (number | string)[];
  markets?: Record<string, DanaeMarket> | DanaeMarket[];
  selections?: Record<string, DanaeSelection> | DanaeSelection[];
}

const betanoScraper: Scraper = {
  nombre: "betano",

  async capturarPorApi(partido) {
    const ligaCanonica = detectarLigaCanonica(partido.liga);
    if (!ligaCanonica) return null;
    const url = obtenerUrlListado(ligaCanonica, "betano");
    if (!url) return null;

    const candidatos = await capturarJsonsConCuotas(url, {
      source: "scrapers:betano",
      esperaPostLoadMs: 6_000,
    });

    for (const c of candidatos) {
      const events = extractEvents(c.body);
      if (events.length === 0) continue;

      let mejor: DanaeEvent | null = null;
      let mejorScore = 0;
      for (const e of events) {
        const home = extractHome(e);
        const away = extractAway(e);
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

      const cuotas = mapearCuotasDanae(mejor, c.body);
      if (Object.keys(cuotas).length === 0) continue;

      return {
        cuotas,
        fuente: { url: c.url, capturadoEn: new Date() },
        eventIdCasa: String(mejor.id ?? mejor.eventId ?? ""),
        equipos: {
          local: extractHome(mejor) ?? partido.equipoLocal,
          visita: extractAway(mejor) ?? partido.equipoVisita,
        },
      };
    }

    logger.info(
      {
        partidoId: partido.id,
        candidatos: candidatos.length,
        source: "scrapers:betano",
      },
      `betano: ningún JSON candidato matcheó el partido`,
    );
    return null;
  },
};

function extractEvents(body: unknown): DanaeEvent[] {
  if (!body || typeof body !== "object") return [];
  const obj = body as Record<string, unknown>;
  const data = (obj.data ?? obj) as Record<string, unknown>;
  const events = data.events;
  if (Array.isArray(events)) return events as DanaeEvent[];
  // Shape per-event (betbuilderplus): no array, el evento mismo es body.data
  if (data.markets && data.selections) {
    return [data as unknown as DanaeEvent];
  }
  return [];
}

function extractHome(event: DanaeEvent): string | null {
  if (event.homeName) return event.homeName;
  const home = event.participants?.find((p) => p.type === "home" || p.type === "1");
  if (home?.name) return home.name;
  if (event.name) {
    const parts = event.name.split(/\s+vs\.?\s+|\s+-\s+/i);
    return parts[0]?.trim() ?? null;
  }
  return null;
}

function extractAway(event: DanaeEvent): string | null {
  if (event.awayName) return event.awayName;
  const away = event.participants?.find((p) => p.type === "away" || p.type === "2");
  if (away?.name) return away.name;
  if (event.name) {
    const parts = event.name.split(/\s+vs\.?\s+|\s+-\s+/i);
    return parts[1]?.trim() ?? null;
  }
  return null;
}

function mapearCuotasDanae(
  event: DanaeEvent,
  body: unknown,
): CuotasCapturadas {
  const cuotas: CuotasCapturadas = {};

  // Resolver markets para este evento (inline o via top-level indexed).
  let markets: DanaeMarket[] = [];
  if (event.markets) {
    markets = Array.isArray(event.markets)
      ? event.markets
      : Object.values(event.markets);
  } else if (
    event.marketIdList &&
    body &&
    typeof body === "object" &&
    "data" in body
  ) {
    const data = (body as { data?: { markets?: Record<string, DanaeMarket> } }).data;
    if (data?.markets) {
      markets = event.marketIdList
        .map((id) => data.markets![String(id)])
        .filter((m): m is DanaeMarket => Boolean(m));
    }
  }

  // Map selections.
  let selectionsRoot: Record<string, DanaeSelection> = {};
  if (event.selections) {
    if (Array.isArray(event.selections)) {
      for (const s of event.selections) {
        if (s.id !== undefined) selectionsRoot[String(s.id)] = s;
      }
    } else {
      selectionsRoot = event.selections;
    }
  } else if (body && typeof body === "object" && "data" in body) {
    const data = (body as { data?: { selections?: Record<string, DanaeSelection> } }).data;
    if (data?.selections) selectionsRoot = data.selections;
  }

  const resolverSelections = (m: DanaeMarket): DanaeSelection[] => {
    if (!m.selectionIdList) return [];
    return m.selectionIdList
      .map((id) => selectionsRoot[String(id)])
      .filter((s): s is DanaeSelection => Boolean(s));
  };

  const priceOk = (s: DanaeSelection | undefined): number | null => {
    const v = s?.price;
    return typeof v === "number" && v > 1 && v < 100 ? v : null;
  };

  for (const m of markets) {
    const tipo = m.type ?? "";
    const typeId = m.typeId;

    if ((tipo === "MRES" || typeId === 1) && !cuotas["1x2"]) {
      const sels = resolverSelections(m);
      const l = priceOk(sels.find((s) => s.typeId === 1 || s.shortName === "1"));
      const e = priceOk(sels.find((s) => s.typeId === 2 || s.shortName === "X"));
      const v = priceOk(sels.find((s) => s.typeId === 3 || s.shortName === "2"));
      if (l && e && v) cuotas["1x2"] = { local: l, empate: e, visita: v };
    } else if ((tipo === "DBLC" || typeId === 9) && !cuotas.doble_op) {
      const sels = resolverSelections(m);
      const x1 = priceOk(
        sels.find((s) => s.typeId === 28 || s.shortName === "1X" || s.shortName === "1 ó X"),
      );
      const x12 = priceOk(
        sels.find((s) => s.typeId === 30 || s.shortName === "12" || s.shortName === "1 ó 2"),
      );
      const xx2 = priceOk(
        sels.find((s) => s.typeId === 29 || s.shortName === "X2" || s.shortName === "X ó 2"),
      );
      if (x1 && x12 && xx2) cuotas.doble_op = { x1, x12, xx2 };
    } else if ((tipo === "BTSC" || typeId === 15) && !cuotas.btts) {
      const sels = resolverSelections(m);
      const si = priceOk(
        sels.find((s) => {
          const sn = (s.shortName ?? "").toLowerCase();
          return s.typeId === 43 || sn === "sí" || sn === "si" || sn === "yes";
        }),
      );
      const no = priceOk(
        sels.find((s) => {
          const sn = (s.shortName ?? "").toLowerCase();
          return s.typeId === 44 || sn === "no";
        }),
      );
      if (si && no) cuotas.btts = { si, no };
    } else if ((tipo === "HCTG" || typeId === 13) && !cuotas.mas_menos_25) {
      const sels = resolverSelections(m);
      const over = priceOk(
        sels.find(
          (s) =>
            (s.typeId === 39 ||
              (s.shortName ?? "").toLowerCase().startsWith("más") ||
              (s.shortName ?? "").toLowerCase().startsWith("over")) &&
            s.handicap === 2.5,
        ),
      );
      const under = priceOk(
        sels.find(
          (s) =>
            (s.typeId === 40 ||
              (s.shortName ?? "").toLowerCase().startsWith("menos") ||
              (s.shortName ?? "").toLowerCase().startsWith("under")) &&
            s.handicap === 2.5,
        ),
      );
      if (over && under) cuotas.mas_menos_25 = { over, under };
    }
  }

  return cuotas;
}

export default betanoScraper;
