// Scraper Betano via API directa Danae/Kaizen (Lote V.11.1 — May 2026).
//
// Betano usa Danae (Kaizen Group) como backend B2B. Validado el 2026-05-08
// con JSON real (urls2.txt) que el endpoint:
//   https://www.betano.pe/api/betbuilderplus/event?id={eventId}&sportCode=FOOT
// responde por evento con shape:
//   {
//     data: {
//       marketIdList: [...],
//       markets: { "id": { selectionIdList[], type, typeId, name, ... } },
//       selections: { "id": { price, typeId, shortName, name, handicap?, ... } }
//     }
//   }
//
// El endpoint provisto es PER-EVENT (no listing). Para cubrir captura
// automática sin manual-link, probamos en cascada:
//
//   1) `/api/betbuilderplus/event-list?competitionId={ligaIdCasa}` (intento)
//   2) `/danae-webapi/api/prematch/overview/latest` (legacy probe)
//   3) Si los listings fallan: log explícito + null.
//
// Vinculación manual (admin pega URL Betano vía /event-ids) sigue siendo
// la ruta confiable hasta que descubramos el listing endpoint.
//
// MarketType (campo `type` o `typeId` de Kaizen):
//   - "MRES" / typeId 1   → Resultado del partido (1X2)
//   - "DBLC" / typeId 9   → Doble Oportunidad
//   - "BTSC" / typeId 15  → Ambos equipos anotan
//   - "HCTG" / typeId 13  → Goles totales Más/Menos (con handicap)
//
// Selection.typeId (cuando aplica):
//   1 / 2 / 3        → Local / Empate / Visita
//   28 / 30 / 29     → 1X / 12 / X2
//   39 / 40          → Más / Menos (con campo handicap=2.5)
//   43 / 44          → Sí / No (BTTS)

import { logger } from "../logger";
import { httpFetchJson } from "./http";
import { similitudEquipos, UMBRAL_FUZZY_DEFAULT } from "./fuzzy-match";
import type { CuotasCapturadas, ResultadoScraper, Scraper } from "./types";

const URL_BASE = "https://www.betano.pe";

interface DanaeSelection {
  id?: number | string;
  price?: number;
  typeId?: number;
  shortName?: string;
  name?: string;
  fullName?: string;
  handicap?: number;
}

interface DanaeMarket {
  id?: number | string;
  selectionIdList?: (number | string)[];
  type?: string;
  typeId?: number;
  name?: string;
}

interface DanaeEventListItem {
  id?: number | string;
  eventId?: number | string;
  name?: string;
  description?: string;
  homeName?: string;
  awayName?: string;
  participants?: { name: string; type?: string }[];
  competitionId?: number | string;
  leagueId?: number | string;
  tournamentId?: number | string;
  startTime?: string | number;
  marketIdList?: (number | string)[];
  markets?: Record<string, DanaeMarket> | DanaeMarket[];
  selections?: Record<string, DanaeSelection> | DanaeSelection[];
}

interface DanaeListResponse {
  data?: {
    events?: DanaeEventListItem[];
    markets?: Record<string, DanaeMarket>;
    selections?: Record<string, DanaeSelection>;
  };
  events?: DanaeEventListItem[];
}

const URLS_LISTADO = (ligaIdCasa: string) => [
  `${URL_BASE}/api/betbuilderplus/event-list?competitionId=${ligaIdCasa}&sportCode=FOOT`,
  `${URL_BASE}/api/sportscompo/v1/competition/${ligaIdCasa}/events?sportCode=FOOT`,
  `${URL_BASE}/danae-webapi/api/prematch/overview/latest?includeVirtuals=false&queryLanguageId=8&queryOperatorId=12`,
];

const betanoScraper: Scraper = {
  nombre: "betano",

  async capturarPorApi(partido, ligaIdCasa) {
    let body: DanaeListResponse | null = null;
    let urlUsado: string | null = null;

    for (const url of URLS_LISTADO(ligaIdCasa)) {
      try {
        body = await httpFetchJson<DanaeListResponse>(url, {
          headers: {
            Origin: URL_BASE,
            Referer: `${URL_BASE}/sport/futbol/peru/liga-1/${ligaIdCasa}/`,
          },
          source: "scrapers:betano",
        });
        urlUsado = url;
        break;
      } catch (err) {
        logger.debug(
          {
            url,
            err: (err as Error).message,
            source: "scrapers:betano",
          },
          `betano: URL no respondió, probando siguiente`,
        );
      }
    }

    if (!body || !urlUsado) {
      logger.info(
        {
          partidoId: partido.id,
          ligaIdCasa,
          source: "scrapers:betano",
        },
        `betano: ningún listing endpoint respondió. Captura automática no disponible — usar /event-ids manual con URL Betano del partido.`,
      );
      return null;
    }

    const events = body.data?.events ?? body.events ?? [];

    if (events.length === 0) {
      logger.warn(
        {
          partidoId: partido.id,
          ligaIdCasa,
          urlUsado,
          shape: Object.keys(body ?? {}),
          source: "scrapers:betano",
        },
        `betano: response no contiene eventos`,
      );
      return null;
    }

    // Filtrar por liga primero cuando el campo está disponible.
    const eventosLiga = events.filter((e) => {
      const ligaCampo = e.competitionId ?? e.leagueId ?? e.tournamentId;
      return ligaCampo !== undefined && String(ligaCampo) === ligaIdCasa;
    });
    const candidatos = eventosLiga.length > 0 ? eventosLiga : events;

    let mejor: DanaeEventListItem | null = null;
    let mejorScore = 0;
    for (const event of candidatos) {
      const home = extractHome(event);
      const away = extractAway(event);
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
          eventosLiga: eventosLiga.length,
          mejorScore,
          source: "scrapers:betano",
        },
        `betano: partido no encontrado en response`,
      );
      return null;
    }

    // Mapear cuotas: el evento puede traer markets/selections inline
    // (formato listing) o referenciar IDs (formato indexed). En el último
    // caso resolvemos contra los maps top-level.
    const cuotas = mapearCuotasDanae(mejor, body);

    if (Object.keys(cuotas).length === 0) {
      logger.warn(
        {
          partidoId: partido.id,
          eventId: mejor.id ?? mejor.eventId,
          source: "scrapers:betano",
        },
        `betano: evento encontrado pero sin mercados extraíbles. Revisar shape via /diagnostico-api.`,
      );
      return null;
    }

    return {
      cuotas,
      fuente: { url: urlUsado, capturadoEn: new Date() },
      eventIdCasa: String(mejor.id ?? mejor.eventId ?? ""),
      equipos: {
        local: extractHome(mejor) ?? partido.equipoLocal,
        visita: extractAway(mejor) ?? partido.equipoVisita,
      },
    };
  },
};

function extractHome(event: DanaeEventListItem): string | null {
  if (event.homeName) return event.homeName;
  const home = event.participants?.find((p) => p.type === "home" || p.type === "1");
  if (home?.name) return home.name;
  const name = event.name ?? event.description;
  if (name) {
    const parts = name.split(/\s+vs\.?\s+|\s+-\s+/i);
    return parts[0]?.trim() ?? null;
  }
  return null;
}

function extractAway(event: DanaeEventListItem): string | null {
  if (event.awayName) return event.awayName;
  const away = event.participants?.find((p) => p.type === "away" || p.type === "2");
  if (away?.name) return away.name;
  const name = event.name ?? event.description;
  if (name) {
    const parts = name.split(/\s+vs\.?\s+|\s+-\s+/i);
    return parts[1]?.trim() ?? null;
  }
  return null;
}

function mapearCuotasDanae(
  event: DanaeEventListItem,
  body: DanaeListResponse,
): CuotasCapturadas {
  const cuotas: CuotasCapturadas = {};

  // Resolver markets para este evento. Pueden venir:
  //   a) Inline: event.markets como object {id: market} o array
  //   b) Top-level indexed: body.data.markets {id: market} + event.marketIdList
  let markets: DanaeMarket[] = [];
  if (event.markets) {
    markets = Array.isArray(event.markets)
      ? event.markets
      : Object.values(event.markets);
  } else if (event.marketIdList && body.data?.markets) {
    const mkRoot = body.data.markets;
    markets = event.marketIdList
      .map((id) => mkRoot[String(id)])
      .filter((m): m is DanaeMarket => Boolean(m));
  }

  // Map para resolver selections.
  let selectionsRoot: Record<string, DanaeSelection> = {};
  if (event.selections) {
    if (Array.isArray(event.selections)) {
      for (const s of event.selections) {
        if (s.id !== undefined) selectionsRoot[String(s.id)] = s;
      }
    } else {
      selectionsRoot = event.selections;
    }
  } else if (body.data?.selections) {
    selectionsRoot = body.data.selections;
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

  for (const market of markets) {
    const tipo = market.type ?? "";
    const typeId = market.typeId;

    // 1X2: type="MRES" o typeId=1
    if ((tipo === "MRES" || typeId === 1) && !cuotas["1x2"]) {
      const sels = resolverSelections(market);
      const local = sels.find((s) => s.typeId === 1 || s.shortName === "1");
      const empate = sels.find((s) => s.typeId === 2 || s.shortName === "X");
      const visita = sels.find((s) => s.typeId === 3 || s.shortName === "2");
      const lP = priceOk(local);
      const eP = priceOk(empate);
      const vP = priceOk(visita);
      if (lP && eP && vP) cuotas["1x2"] = { local: lP, empate: eP, visita: vP };
    }

    // Doble Op: type="DBLC" o typeId=9
    else if ((tipo === "DBLC" || typeId === 9) && !cuotas.doble_op) {
      const sels = resolverSelections(market);
      const x1 = sels.find(
        (s) => s.typeId === 28 || s.shortName === "1X" || s.shortName === "1 ó X",
      );
      const x12 = sels.find(
        (s) => s.typeId === 30 || s.shortName === "12" || s.shortName === "1 ó 2",
      );
      const xx2 = sels.find(
        (s) => s.typeId === 29 || s.shortName === "X2" || s.shortName === "X ó 2",
      );
      const x1P = priceOk(x1);
      const x12P = priceOk(x12);
      const xx2P = priceOk(xx2);
      if (x1P && x12P && xx2P) {
        cuotas.doble_op = { x1: x1P, x12: x12P, xx2: xx2P };
      }
    }

    // BTTS: type="BTSC" o typeId=15
    else if ((tipo === "BTSC" || typeId === 15) && !cuotas.btts) {
      const sels = resolverSelections(market);
      const si = sels.find(
        (s) =>
          s.typeId === 43 ||
          (s.shortName ?? "").toLowerCase() === "sí" ||
          (s.shortName ?? "").toLowerCase() === "si" ||
          (s.shortName ?? "").toLowerCase() === "yes",
      );
      const no = sels.find(
        (s) =>
          s.typeId === 44 || (s.shortName ?? "").toLowerCase() === "no",
      );
      const sP = priceOk(si);
      const nP = priceOk(no);
      if (sP && nP) cuotas.btts = { si: sP, no: nP };
    }

    // Total goles: type="HCTG" o typeId=13 — filtrar handicap=2.5 en
    // selections. Cada market HCTG suele cubrir UN line; hay múltiples
    // markets HCTG con líneas distintas (0.5, 1.5, 2.5, 3.5, ...). Sólo
    // tomamos el de 2.5.
    else if ((tipo === "HCTG" || typeId === 13) && !cuotas.mas_menos_25) {
      const sels = resolverSelections(market);
      const over = sels.find(
        (s) =>
          (s.typeId === 39 ||
            (s.shortName ?? "").toLowerCase().startsWith("más") ||
            (s.shortName ?? "").toLowerCase().startsWith("over")) &&
          s.handicap === 2.5,
      );
      const under = sels.find(
        (s) =>
          (s.typeId === 40 ||
            (s.shortName ?? "").toLowerCase().startsWith("menos") ||
            (s.shortName ?? "").toLowerCase().startsWith("under")) &&
          s.handicap === 2.5,
      );
      const oP = priceOk(over);
      const uP = priceOk(under);
      if (oP && uP) cuotas.mas_menos_25 = { over: oP, under: uP };
    }
  }

  return cuotas;
}

export default betanoScraper;
