// Scraper Apuesta Total via browser + XHR intercept (Lote V.12 — May 2026).
//
// Apuesta Total embebe Kambi (prod20392.kmianko.com). Cargamos la página
// de la liga en Chromium y capturamos las XHRs. Esperamos ver:
//   - /api/pulse/snapshot/events: array de fixtures sin cuotas
//   - /api/eventlist/eu/markets/all: array de markets con cuotas
//   - /api/pulse/all (variantes): empuja cuotas individualmente
//
// El parser intenta extraer cuotas de cualquiera de esos shapes. Para
// matching, primero busca el fixture por equipos, después junta los
// markets relacionados al EventId del fixture.

import { logger } from "../logger";
import { similitudEquipos, UMBRAL_FUZZY_DEFAULT } from "./fuzzy-match";
import { capturarJsonsConCuotas } from "./xhr-intercept";
import { obtenerUrlListado } from "./urls-listing";
import { detectarLigaCanonica } from "./ligas-id-map";
import {
  mercadosFaltantes,
  type CuotasCapturadas,
  type ResultadoScraper,
  type Scraper,
} from "./types";

interface KambiParticipant {
  Name: string;
  VenueRole: "Home" | "Away";
}
interface KambiFixture {
  _id: string;
  Type?: string;
  EventName?: string;
  Participants?: KambiParticipant[];
  MasterLeagueId?: string;
}
interface KambiSelection {
  Name?: string;
  BetslipLine?: string;
  OutcomeType?: string;
  TrueOdds?: number;
  DisplayOdds?: { Decimal?: string };
  Side?: number;
  IsDisabled?: boolean;
  IsRemoved?: boolean;
  QAParam1?: number;
}
interface KambiMarket {
  _id?: string;
  EventId?: string;
  MarketType?: { _id?: string; Name?: string };
  Selections?: KambiSelection[];
  IsSuspended?: boolean;
  IsRemoved?: boolean;
}

const apuestaTotalScraper: Scraper = {
  nombre: "apuesta_total",

  async capturarPorApi(partido) {
    const ligaCanonica = detectarLigaCanonica(partido.liga);
    if (!ligaCanonica) return null;
    const url = obtenerUrlListado(ligaCanonica, "apuesta_total");
    if (!url) return null;

    const candidatos = await capturarJsonsConCuotas(url, {
      source: "scrapers:apuesta-total",
      esperaPostLoadMs: 6_000, // Kambi tarda más en hidratar
    });

    // Buscar fixtures en cualquier candidato.
    const diagnostico: Array<{
      url: string;
      bytes: number;
      fixtures: number;
      mejorScore: number;
      mejorMatch?: { local: string; visita: string };
    }> = [];
    let fixture: KambiFixture | null = null;
    let fixtureUrl: string | null = null;
    for (const c of candidatos) {
      const fixtures = extractFixtures(c.body);
      const { matched, mejorScore, mejorMatch } = matchearFixtureConDiagnostico(
        fixtures,
        partido.equipoLocal,
        partido.equipoVisita,
      );
      diagnostico.push({
        url: c.url,
        bytes: c.bytes,
        fixtures: fixtures.length,
        mejorScore,
        mejorMatch,
      });
      if (matched && !fixture) {
        fixture = matched;
        fixtureUrl = c.url;
      }
    }

    if (!fixture) {
      logger.info(
        {
          partidoId: partido.id,
          equipoLocal: partido.equipoLocal,
          equipoVisita: partido.equipoVisita,
          candidatos: candidatos.length,
          diagnostico,
          umbralAceptacion: UMBRAL_FUZZY_DEFAULT * 0.7,
          source: "scrapers:apuesta-total",
        },
        `apuesta-total: ningún candidato contiene el fixture buscado (mejor score=${diagnostico.reduce((m, d) => Math.max(m, d.mejorScore), 0).toFixed(3)})`,
      );
      return null;
    }

    // Juntar markets de TODOS los candidatos que matcheen el EventId.
    const eventId = fixture._id;
    const markets: KambiMarket[] = [];
    for (const c of candidatos) {
      const ms = extractMarkets(c.body);
      for (const m of ms) {
        if (m.EventId === eventId) markets.push(m);
      }
    }

    const cuotas = mapearCuotasKambi(markets);
    if (Object.keys(cuotas).length === 0) {
      logger.warn(
        {
          partidoId: partido.id,
          eventId,
          marketsRecolectados: markets.length,
          source: "scrapers:apuesta-total",
        },
        `apuesta-total: fixture matched pero sin markets extraíbles`,
      );
      return null;
    }

    // V.12.3: requerir los 4 mercados.
    const faltan = mercadosFaltantes(cuotas);
    if (faltan.length > 0) {
      logger.info(
        {
          partidoId: partido.id,
          eventId,
          mercadosPresentes: Object.keys(cuotas),
          mercadosFaltantes: faltan,
          marketTypesEnResponse: Array.from(
            new Set(markets.map((m) => m.MarketType?._id).filter(Boolean)),
          ),
          source: "scrapers:apuesta-total",
        },
        `apuesta-total: cuotas parciales · faltan=[${faltan.join(",")}] (no persiste)`,
      );
      return null;
    }

    const home = fixture.Participants?.find((p) => p.VenueRole === "Home")?.Name;
    const away = fixture.Participants?.find((p) => p.VenueRole === "Away")?.Name;

    return {
      cuotas,
      fuente: { url: fixtureUrl!, capturadoEn: new Date() },
      eventIdCasa: eventId,
      equipos: {
        local: home ?? partido.equipoLocal,
        visita: away ?? partido.equipoVisita,
      },
    };
  },
};

function extractFixtures(body: unknown): KambiFixture[] {
  if (Array.isArray(body)) {
    return body.filter(
      (x): x is KambiFixture =>
        x !== null &&
        typeof x === "object" &&
        "Participants" in x &&
        "_id" in x,
    );
  }
  return [];
}

function extractMarkets(body: unknown): KambiMarket[] {
  if (Array.isArray(body)) {
    return body.filter(
      (x): x is KambiMarket =>
        x !== null &&
        typeof x === "object" &&
        "MarketType" in x &&
        "Selections" in x,
    );
  }
  return [];
}

function matchearFixtureConDiagnostico(
  fixtures: KambiFixture[],
  equipoLocal: string,
  equipoVisita: string,
): {
  matched: KambiFixture | null;
  mejorScore: number;
  mejorMatch?: { local: string; visita: string };
} {
  let mejor: KambiFixture | null = null;
  let mejorScore = 0;
  let mejorMatch: { local: string; visita: string } | undefined;
  for (const f of fixtures) {
    const home = f.Participants?.find((p) => p.VenueRole === "Home")?.Name;
    const away = f.Participants?.find((p) => p.VenueRole === "Away")?.Name;
    if (!home || !away) continue;
    const score = Math.min(
      similitudEquipos(home, equipoLocal),
      similitudEquipos(away, equipoVisita),
    );
    if (score > mejorScore) {
      mejorScore = score;
      mejor = f;
      mejorMatch = { local: home, visita: away };
    }
  }
  const matched = mejorScore >= UMBRAL_FUZZY_DEFAULT * 0.7 ? mejor : null;
  return { matched, mejorScore, mejorMatch };
}

function mapearCuotasKambi(markets: KambiMarket[]): CuotasCapturadas {
  const cuotas: CuotasCapturadas = {};
  const norm = (s: string | undefined): string =>
    (s ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  const priceOk = (s: KambiSelection | undefined): number | null => {
    if (!s) return null;
    const v = s.TrueOdds ?? Number(s.DisplayOdds?.Decimal);
    return typeof v === "number" && Number.isFinite(v) && v > 1 && v < 100
      ? v
      : null;
  };

  for (const m of markets) {
    if (m.IsSuspended || m.IsRemoved) continue;
    const tipoId = m.MarketType?._id ?? "";
    const sels = (m.Selections ?? []).filter(
      (s) => !s.IsDisabled && !s.IsRemoved,
    );

    if (tipoId === "ML0" && !cuotas["1x2"]) {
      const l = priceOk(sels.find((s) => s.OutcomeType === "Local" || s.Side === 1));
      const e = priceOk(sels.find((s) => s.OutcomeType === "Empate" || s.Side === 2));
      const v = priceOk(sels.find((s) => s.OutcomeType === "Visita" || s.Side === 3));
      if (l && e && v) cuotas["1x2"] = { local: l, empate: e, visita: v };
    } else if ((tipoId === "DC" || tipoId === "ML9") && !cuotas.doble_op) {
      const x1 = priceOk(sels.find((s) => norm(s.BetslipLine) === "1x"));
      const x12 = priceOk(sels.find((s) => norm(s.BetslipLine) === "12"));
      const xx2 = priceOk(sels.find((s) => norm(s.BetslipLine) === "x2"));
      if (x1 && x12 && xx2) cuotas.doble_op = { x1, x12, xx2 };
    } else if (tipoId === "OU0" && !cuotas.mas_menos_25) {
      const over = priceOk(
        sels.find((s) => {
          const line = String(s.QAParam1 ?? "");
          const bs = norm(s.BetslipLine);
          return (
            (s.OutcomeType === "Más" || bs.startsWith("mas")) &&
            (line === "2.5" || bs.includes("2.5"))
          );
        }),
      );
      const under = priceOk(
        sels.find((s) => {
          const line = String(s.QAParam1 ?? "");
          const bs = norm(s.BetslipLine);
          return (
            (s.OutcomeType === "Menos" || bs.startsWith("menos")) &&
            (line === "2.5" || bs.includes("2.5"))
          );
        }),
      );
      if (over && under) cuotas.mas_menos_25 = { over, under };
    } else if (tipoId === "QA158" && !cuotas.btts) {
      const si = priceOk(
        sels.find(
          (s) =>
            s.OutcomeType === "Sí" ||
            norm(s.Name) === "si" ||
            norm(s.Name) === "sí" ||
            norm(s.BetslipLine) === "sí" ||
            norm(s.BetslipLine) === "si",
        ),
      );
      const no = priceOk(
        sels.find(
          (s) =>
            s.OutcomeType === "No" ||
            norm(s.Name) === "no" ||
            norm(s.BetslipLine) === "no",
        ),
      );
      if (si && no) cuotas.btts = { si, no };
    }
  }

  return cuotas;
}

export default apuestaTotalScraper;
