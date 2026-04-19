// Cliente para api-football.com (cuenta directa hablaplay@gmail.com).
//
// IMPORTANTE (CLAUDE.md §13): header es `x-apisports-key`, NO `X-RapidAPI-Key`.
// Usamos api-football.com directo, no RapidAPI.
//
// Endpoints usados:
//   - GET /fixtures?date=YYYY-MM-DD — partidos del día (import manual legado)
//   - GET /fixtures?league=&season=&from=&to= — ventana por liga (auto-import)
//   - GET /leagues?id=&current=true — resuelve la temporada activa de una liga
//
// Endpoints que llegan en Sub-Sprint 5 (motor de puntuación):
//   - GET /fixtures/events?fixture={id} — eventos en vivo (goles, tarjetas)
//   - GET /fixtures?id={id}&live=all — estado en vivo

import { ApiFootballError } from "./errors";
import { logger } from "./logger";

const HOST =
  process.env.API_FOOTBALL_HOST ?? "v3.football.api-sports.io";

function apiKey(): string {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    throw new ApiFootballError(
      "API_FOOTBALL_KEY no está configurada en el entorno.",
    );
  }
  return key;
}

interface ApiFootballResponse<T> {
  get: string;
  parameters: Record<string, string>;
  errors: unknown[] | Record<string, string>;
  results: number;
  paging: { current: number; total: number };
  response: T[];
}

async function apiFetch<T>(path: string): Promise<T[]> {
  const url = `https://${HOST}${path}`;
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "x-apisports-key": apiKey(),
        Accept: "application/json",
      },
      // Importante: NO cachear en el fetch layer. El caller decide.
      cache: "no-store",
    });
  } catch (err) {
    logger.error({ err, url }, "api-football fetch falló");
    throw new ApiFootballError(
      `No se pudo conectar a api-football: ${(err as Error).message}`,
    );
  }

  const ms = Date.now() - started;

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error(
      { status: res.status, url, ms, body: body.slice(0, 500) },
      "api-football respondió con error",
    );
    throw new ApiFootballError(
      `api-football respondió ${res.status}.`,
      { status: res.status },
    );
  }

  const payload = (await res.json()) as ApiFootballResponse<T>;

  // api-football devuelve errores con shape variable: array vacío si OK, o
  // un objeto/array con mensajes si algo falló (limites de plan, etc.).
  const errors = payload.errors;
  const hasErrors = Array.isArray(errors)
    ? errors.length > 0
    : errors && typeof errors === "object" && Object.keys(errors).length > 0;
  if (hasErrors) {
    logger.error({ url, ms, errors }, "api-football devolvió errors en el payload");
    throw new ApiFootballError(
      `api-football devolvió errors: ${JSON.stringify(errors).slice(0, 200)}`,
      { errors },
    );
  }

  logger.debug(
    { url, ms, results: payload.results },
    "api-football fetch ok",
  );
  return payload.response;
}

// ---------------------------------------------------------------------------
// Shapes mínimos del payload de api-football — solo lo que usamos.
// Documentación: https://www.api-football.com/documentation-v3
// ---------------------------------------------------------------------------

export interface ApiFootballFixture {
  fixture: {
    id: number;
    date: string; /* ISO 8601 */
    timestamp: number;
    status: {
      long: string;
      short: string; /* e.g. "NS" (Not Started), "1H", "FT", "AET", "PEN" */
      elapsed: number | null;
    };
    venue?: {
      name: string | null;
      city: string | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    season: number;
    round: string;
  };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

export async function fetchFixturesByDate(
  dateISO: string, /* YYYY-MM-DD */
  opts: { timezone?: string; league?: number } = {},
): Promise<ApiFootballFixture[]> {
  const qs = new URLSearchParams({ date: dateISO });
  if (opts.timezone) qs.set("timezone", opts.timezone);
  if (opts.league) qs.set("league", String(opts.league));
  return apiFetch<ApiFootballFixture>(`/fixtures?${qs.toString()}`);
}

/**
 * Ventana de fixtures por liga + temporada. La usa el auto-import
 * (apps/web/lib/services/partidos-import.service.ts).
 *
 * api-football NO acepta `season=current` en /fixtures: hay que resolver
 * primero la temporada activa con getCurrentSeason().
 */
export async function fetchFixturesByLeague(
  leagueId: number,
  season: number,
  from: string, /* YYYY-MM-DD */
  to: string,
): Promise<ApiFootballFixture[]> {
  const qs = new URLSearchParams({
    league: String(leagueId),
    season: String(season),
    from,
    to,
  });
  return apiFetch<ApiFootballFixture>(`/fixtures?${qs.toString()}`);
}

// ---------------------------------------------------------------------------
// Leagues — resolver temporada activa dinámicamente
// ---------------------------------------------------------------------------

export interface ApiFootballLeague {
  league: {
    id: number;
    name: string;
    type: string;
  };
  country: {
    name: string;
    code: string | null;
    flag: string | null;
  };
  seasons: Array<{
    year: number;
    start: string;
    end: string;
    current: boolean;
  }>;
}

/**
 * Devuelve el año de la temporada `current` según api-football.
 * Lanza ApiFootballError si la liga no existe o no tiene temporada actual.
 */
export async function getCurrentSeason(leagueId: number): Promise<number> {
  const qs = new URLSearchParams({
    id: String(leagueId),
    current: "true",
  });
  const response = await apiFetch<ApiFootballLeague>(
    `/leagues?${qs.toString()}`,
  );
  const liga = response[0];
  if (!liga) {
    throw new ApiFootballError(
      `api-football no devolvió datos para la liga ${leagueId}.`,
      { leagueId },
    );
  }
  const current = liga.seasons.find((s) => s.current);
  if (!current) {
    throw new ApiFootballError(
      `La liga ${leagueId} no tiene temporada activa.`,
      { leagueId },
    );
  }
  return current.year;
}
