// Scraper Apuesta Total via API directa de Kambi (Lote V.11 — May 2026).
//
// Apuesta Total embebe el sportsbook de Kambi via prod20392.kmianko.com.
// Validado el 2026-05-05: el endpoint /api/pulse/snapshot/events?lang=ES-PE
// responde 200 desde Railway US, 3.94 MB con TODOS los eventos del operador.
// Filtramos client-side por MasterLeagueId.
//
// Estructura del JSON:
//   - Array directo de Fixtures con campos:
//     _id, EventName, StartEventDate, MasterLeagueId, RegionId, RegionName,
//     LeagueName, Participants[], TotalMarketsCount, ...
//
// Lote V.11 entrega el extractor de FIXTURES (lista de partidos). Las
// CUOTAS vienen de un segundo endpoint que aún no inspeccionamos:
// probablemente /api/pulse/all?markets={ids}. Si el primer smoke productivo
// confirma que el snapshot solo trae fixtures sin cuotas, ajustamos en
// 1 push agregando el segundo fetch (~30 min). Mientras tanto el scraper
// devuelve los fixtures matched + estructura vacía de cuotas para que
// el sistema vea el partido pero registre advertencia.

import { logger } from "../logger";
import { httpFetchJson } from "./http";
import { similitudEquipos, UMBRAL_FUZZY_DEFAULT } from "./fuzzy-match";
import type { CuotasCapturadas, ResultadoScraper, Scraper } from "./types";

interface KambiParticipant {
  _id: string;
  Name: string;
  VenueRole: "Home" | "Away";
}

interface KambiFixture {
  _id: string;
  Type: string; // "Fixture"
  EventName: string;
  StartEventDate: number;
  LeagueId?: string;
  LeagueName?: string;
  MasterLeagueId?: string;
  RegionId?: string;
  RegionName?: string;
  Participants?: KambiParticipant[];
  TotalMarketsCount?: number;
}

const URL_SNAPSHOT =
  "https://prod20392.kmianko.com/api/pulse/snapshot/events?lang=ES-PE";

const apuestaTotalScraper: Scraper = {
  nombre: "apuesta_total",

  async capturarPorApi(partido, ligaIdCasa) {
    // Snapshot trae todos los fixtures del operador (~4 MB). Filtramos
    // por MasterLeagueId que coincide con ligaIdCasa.
    const fixtures = await httpFetchJson<KambiFixture[]>(URL_SNAPSHOT, {
      headers: {
        Origin: "https://www.apuestatotal.com",
        Referer: "https://www.apuestatotal.com/",
      },
      timeoutMs: 25_000,
      source: "scrapers:apuesta-total",
    });

    if (!Array.isArray(fixtures)) {
      logger.warn(
        {
          partidoId: partido.id,
          source: "scrapers:apuesta-total",
        },
        `apuesta-total: response no es array — formato inesperado`,
      );
      return null;
    }

    // Filtrar por liga primero, después por equipos.
    const ligaFixtures = fixtures.filter(
      (f) => f.MasterLeagueId === ligaIdCasa,
    );

    if (ligaFixtures.length === 0) {
      logger.info(
        {
          partidoId: partido.id,
          ligaIdCasa,
          totalFixturesEnResponse: fixtures.length,
          source: "scrapers:apuesta-total",
        },
        `apuesta-total: ningún fixture matchea MasterLeagueId=${ligaIdCasa}`,
      );
      return null;
    }

    // Buscar fixture por nombres de equipos.
    let mejor: KambiFixture | null = null;
    let mejorScore = 0;
    for (const fixture of ligaFixtures) {
      const home = fixture.Participants?.find(
        (p) => p.VenueRole === "Home",
      )?.Name;
      const away = fixture.Participants?.find(
        (p) => p.VenueRole === "Away",
      )?.Name;
      if (!home || !away) continue;
      const sLocal = similitudEquipos(home, partido.equipoLocal);
      const sVisita = similitudEquipos(away, partido.equipoVisita);
      const score = Math.min(sLocal, sVisita);
      if (score > mejorScore) {
        mejorScore = score;
        mejor = fixture;
      }
    }

    if (!mejor || mejorScore < UMBRAL_FUZZY_DEFAULT * 0.7) {
      logger.info(
        {
          partidoId: partido.id,
          equipoLocal: partido.equipoLocal,
          equipoVisita: partido.equipoVisita,
          ligaIdCasa,
          fixturesEnLiga: ligaFixtures.length,
          mejorScore,
          source: "scrapers:apuesta-total",
        },
        `apuesta-total: partido no encontrado en fixtures de la liga`,
      );
      return null;
    }

    // El snapshot solo trae metadata sin cuotas. Para obtener cuotas hace
    // falta llamar /api/pulse/all?markets={ids} con los marketIds del
    // fixture, que no vienen en este endpoint. Pendiente de mapear el
    // segundo fetch en el siguiente ajuste post-deploy.
    //
    // Por ahora devolvemos el evento matched con cuotas vacías + log
    // explícito. El motor va a persistir como SIN_DATOS y la UI admin
    // mostrará el evento como detectado pero sin cuotas hasta que
    // implementemos el segundo fetch.
    logger.warn(
      {
        partidoId: partido.id,
        eventIdKambi: mejor._id,
        totalMarketsCount: mejor.TotalMarketsCount,
        source: "scrapers:apuesta-total",
      },
      `apuesta-total: fixture matched pero cuotas requieren segundo fetch (TODO)`,
    );

    const home = mejor.Participants?.find((p) => p.VenueRole === "Home")?.Name;
    const away = mejor.Participants?.find((p) => p.VenueRole === "Away")?.Name;

    const resultado: ResultadoScraper = {
      cuotas: {},
      fuente: { url: URL_SNAPSHOT, capturadoEn: new Date() },
      eventIdCasa: mejor._id,
      equipos: {
        local: home ?? partido.equipoLocal,
        visita: away ?? partido.equipoVisita,
      },
    };
    return resultado;
  },
};

export default apuestaTotalScraper;
