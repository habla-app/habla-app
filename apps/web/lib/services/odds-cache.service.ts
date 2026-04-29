// Servicio de cache de odds — Lote 9 (May 2026).
//
// Pipeline:
//   1. El cron N (instrumentation.ts) corre cada 30min y llama
//      `actualizarOddsPartido(partidoId)` para los próximos partidos en las
//      ligas top.
//   2. `actualizarOddsPartido()` lee el `externalId` (api-football fixture
//      ID) del Partido, fetchea odds de api-football, filtra a las casas que
//      tienen mapping Y existen como Afiliado activo en BD, calcula la mejor
//      casa por outcome y persiste en Redis con TTL 1800s.
//   3. El endpoint público `GET /api/v1/cuotas/[partidoId]` y los RSC de
//      `/cuotas` y `/partidos/[slug]` leen del cache vía
//      `obtenerOddsCacheadas(partidoId)`.
//
// Si Redis no está configurado (REDIS_URL ausente), el service degradea
// graciosamente: `obtenerOddsCacheadas` siempre devuelve null y los RSC
// renderizan estado vacío. El cron sigue corriendo pero no persiste.
//
// Errores de api-football (rate limit, sin odds, partido inexistente) se
// loggean vía `logsService.registrarError('warn', 'odds-cache', ...)` (Lote
// 6) — no rompen el request del cliente.

import { prisma } from "@habla/db";
import {
  APIFOOTBALL_BET_ID_1X2,
  APIFOOTBALL_BET_ID_BTTS,
  APIFOOTBALL_BET_ID_OU,
  fetchOddsByFixture,
  type ApiFootballOddsBookmaker,
  type ApiFootballOddsResponse,
} from "./api-football.client";
import { obtenerActivosOrdenados } from "./afiliacion.service";
import { logger } from "./logger";
import { registrarError } from "./logs.service";
import { getRedis } from "../redis";
import { LIGAS } from "../config/ligas";

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

/**
 * Mapping de bookmakers de api-football a slugs de Afiliado en BD. Sin
 * mapping = la casa se ignora en el comparador (aunque api-football la
 * devuelva). Los slugs deben coincidir con `Afiliado.slug` para que el
 * cross-check con `obtenerActivosOrdenados()` los reconozca.
 *
 * Agregar mappings adicionales conforme se firmen casas.
 */
export const BOOKMAKER_MAPPING: Record<string, string> = {
  Bet365: "bet365",
  Betsson: "betsson",
  "1xBet": "1xbet",
  Pinnacle: "pinnacle",
};

/**
 * Slugs de liga (ver `lib/config/ligas.ts`) cuyos partidos se refrescan
 * automáticamente por el cron N. El service mapea a `apiFootballId` al
 * vuelo cruzando con `LIGAS`.
 */
export const LIGAS_TOP_PARA_ODDS: ReadonlyArray<string> = [
  "liga-1-peru",
  "champions",
  "premier",
  "la-liga",
  "serie-a",
  "bundesliga",
  "ligue-1",
  "libertadores",
  "sudamericana",
];

/** TTL del cache en segundos. */
export const ODDS_CACHE_TTL_SECONDS = 1800; /* 30min */

/** Cuántos partidos próximos refrescar por corrida del cron. */
export const ODDS_CRON_BATCH_SIZE = 20;

/** Ventana en horas hacia adelante para el cron N. */
export const ODDS_CRON_LOOKAHEAD_HOURS = 24;

function keyOdds(partidoId: string): string {
  return `odds:partido:${partidoId}`;
}

// ---------------------------------------------------------------------------
// Tipos públicos del cache
// ---------------------------------------------------------------------------

export interface OddsOutcome {
  /** Slug del afiliado (clave en `Afiliado.slug` de BD). */
  casa: string;
  /** Nombre canónico del afiliado (para mostrar en UI). */
  casaNombre: string;
  /** Cuota numérica. Mayor = mejor. */
  odd: number;
}

export interface OddsMercados {
  /** Mercado 1X2 (Match Winner). */
  "1X2": {
    local: OddsOutcome | null;
    empate: OddsOutcome | null;
    visita: OddsOutcome | null;
  };
  /** Both Teams To Score. */
  BTTS: {
    si: OddsOutcome | null;
    no: OddsOutcome | null;
  };
  /** Over/Under 2.5 goles. */
  "+2.5": {
    over: OddsOutcome | null;
    under: OddsOutcome | null;
  };
}

export interface OddsCacheEntry {
  partidoId: string;
  mercados: OddsMercados;
  /** ISO-8601 del momento en que se persistió la entrada. */
  actualizadoEn: string;
}

// ---------------------------------------------------------------------------
// Lectura — usado por endpoint y RSC
// ---------------------------------------------------------------------------

/**
 * Lee del cache. Devuelve null si:
 *   - Redis no está configurado.
 *   - No hay entry para ese partido.
 *   - El JSON serializado se corrompió (best-effort: log warn y null).
 */
export async function obtenerOddsCacheadas(
  partidoId: string,
): Promise<OddsCacheEntry | null> {
  const r = getRedis();
  if (!r) return null;

  try {
    const raw = await r.get(keyOdds(partidoId));
    if (!raw) return null;
    return JSON.parse(raw) as OddsCacheEntry;
  } catch (err) {
    logger.warn(
      { err, partidoId, source: "odds-cache:obtener" },
      "obtenerOddsCacheadas: lectura/parse falló (descartado)",
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Escritura — actualización via cron N o force-refresh admin
// ---------------------------------------------------------------------------

export interface ActualizarResult {
  partidoId: string;
  ok: boolean;
  /** "no-fixture" | "sin-odds" | "sin-bookmakers-validos" | "error" */
  motivo?: string;
  bookmakersDisponibles?: number;
  bookmakersUsados?: number;
}

/**
 * Refresca el cache de un partido. Idempotente: cada call sobreescribe la
 * entry anterior (TTL renovado a 1800s).
 *
 * Pasos:
 *   1. Lee `Partido.externalId` (api-football fixture ID).
 *   2. Llama a `fetchOddsByFixture(fixtureId)`.
 *   3. Cross-check con `obtenerActivosOrdenados()`: descarta bookmakers
 *      sin mapping o cuyo afiliado está inactivo en BD.
 *   4. Para cada mercado (1X2, BTTS, +2.5), calcula mejor casa por outcome.
 *   5. Persiste con TTL 1800s.
 *
 * Errores se loggean en `log_errores` con level=warn y source=odds-cache.
 * No tira: el caller (cron) sigue con el siguiente partido.
 */
export async function actualizarOddsPartido(
  partidoId: string,
): Promise<ActualizarResult> {
  const partido = await prisma.partido.findUnique({
    where: { id: partidoId },
    select: { id: true, externalId: true, equipoLocal: true, equipoVisita: true },
  });
  if (!partido || !partido.externalId) {
    await registrarError({
      level: "warn",
      source: "odds-cache",
      message: `actualizarOddsPartido: partido ${partidoId} no existe o sin externalId`,
      metadata: { partidoId },
    });
    return { partidoId, ok: false, motivo: "no-fixture" };
  }

  // Lookup de afiliados activos para cross-check.
  const afiliadosActivos = await obtenerActivosOrdenados();
  const slugToNombre = new Map<string, string>(
    afiliadosActivos.map((a) => [a.slug, a.nombre]),
  );

  // Fetch a api-football. Si rompe (rate limit, plan limits), loggeamos y
  // salimos con ok:false; el cron lo cuenta para alertar si fallan >50%.
  let response: ApiFootballOddsResponse[];
  try {
    response = await fetchOddsByFixture(partido.externalId);
  } catch (err) {
    await registrarError({
      level: "warn",
      source: "odds-cache",
      message: `fetchOddsByFixture falló para partido ${partidoId} (fixture ${partido.externalId})`,
      error: err,
      metadata: { partidoId, externalId: partido.externalId },
    });
    return { partidoId, ok: false, motivo: "error" };
  }

  const oddsResp = response[0];
  if (!oddsResp || !oddsResp.bookmakers || oddsResp.bookmakers.length === 0) {
    // Partido sin odds en api-football (Liga 1 muchas veces, partidos lejanos
    // o ya finalizados). NO es error — es estado válido. Persistimos un
    // entry vacío para que el endpoint público responda hit con mercados
    // vacíos en lugar de quedarse en `updating` para siempre.
    await persistirEntry({
      partidoId,
      mercados: emptyMercados(),
      actualizadoEn: new Date().toISOString(),
    });
    return { partidoId, ok: true, motivo: "sin-odds", bookmakersDisponibles: 0 };
  }

  const bookmakersValidos = oddsResp.bookmakers.filter((b) => {
    const slug = BOOKMAKER_MAPPING[b.name];
    return slug && slugToNombre.has(slug);
  });

  if (bookmakersValidos.length === 0) {
    // api-football tiene odds, pero ningún bookmaker está en BOOKMAKER_MAPPING
    // o ningún Afiliado activo coincide. Persistimos entry vacía igual.
    await persistirEntry({
      partidoId,
      mercados: emptyMercados(),
      actualizadoEn: new Date().toISOString(),
    });
    return {
      partidoId,
      ok: true,
      motivo: "sin-bookmakers-validos",
      bookmakersDisponibles: oddsResp.bookmakers.length,
      bookmakersUsados: 0,
    };
  }

  const mercados = calcularMejoresOdds(bookmakersValidos, slugToNombre);

  await persistirEntry({
    partidoId,
    mercados,
    actualizadoEn: new Date().toISOString(),
  });

  return {
    partidoId,
    ok: true,
    bookmakersDisponibles: oddsResp.bookmakers.length,
    bookmakersUsados: bookmakersValidos.length,
  };
}

async function persistirEntry(entry: OddsCacheEntry): Promise<void> {
  const r = getRedis();
  if (!r) return; // sin Redis, el caller no se entera (degradación graceful)
  try {
    await r.set(
      keyOdds(entry.partidoId),
      JSON.stringify(entry),
      "EX",
      ODDS_CACHE_TTL_SECONDS,
    );
  } catch (err) {
    logger.warn(
      { err, partidoId: entry.partidoId, source: "odds-cache:persist" },
      "persistirEntry: write Redis falló (descartado)",
    );
  }
}

function emptyMercados(): OddsMercados {
  return {
    "1X2": { local: null, empate: null, visita: null },
    BTTS: { si: null, no: null },
    "+2.5": { over: null, under: null },
  };
}

// ---------------------------------------------------------------------------
// Cálculo: mejor casa por outcome
// ---------------------------------------------------------------------------

/**
 * Recorre todos los `(bookmaker, bet, value)` y para cada outcome conocido
 * (Home/Draw/Away, Yes/No, Over 2.5/Under 2.5) elige la cuota más alta.
 *
 * Si dos casas empatan en cuota, gana la que apareció primero en
 * `bookmakers` (orden de api-football). No es relevante operativamente —
 * el usuario igual ve UNA mejor cuota.
 */
function calcularMejoresOdds(
  bookmakers: ApiFootballOddsBookmaker[],
  slugToNombre: Map<string, string>,
): OddsMercados {
  const mercados = emptyMercados();

  for (const bm of bookmakers) {
    const slug = BOOKMAKER_MAPPING[bm.name];
    if (!slug) continue;
    const nombre = slugToNombre.get(slug);
    if (!nombre) continue;

    for (const bet of bm.bets) {
      if (bet.id === APIFOOTBALL_BET_ID_1X2) {
        for (const v of bet.values) {
          const odd = parseOdd(v.odd);
          if (odd === null) continue;
          if (v.value === "Home") {
            mercados["1X2"].local = pickMejor(
              mercados["1X2"].local,
              { casa: slug, casaNombre: nombre, odd },
            );
          } else if (v.value === "Draw") {
            mercados["1X2"].empate = pickMejor(
              mercados["1X2"].empate,
              { casa: slug, casaNombre: nombre, odd },
            );
          } else if (v.value === "Away") {
            mercados["1X2"].visita = pickMejor(
              mercados["1X2"].visita,
              { casa: slug, casaNombre: nombre, odd },
            );
          }
        }
      } else if (bet.id === APIFOOTBALL_BET_ID_OU) {
        for (const v of bet.values) {
          if (v.value === "Over 2.5") {
            const odd = parseOdd(v.odd);
            if (odd === null) continue;
            mercados["+2.5"].over = pickMejor(
              mercados["+2.5"].over,
              { casa: slug, casaNombre: nombre, odd },
            );
          } else if (v.value === "Under 2.5") {
            const odd = parseOdd(v.odd);
            if (odd === null) continue;
            mercados["+2.5"].under = pickMejor(
              mercados["+2.5"].under,
              { casa: slug, casaNombre: nombre, odd },
            );
          }
        }
      } else if (bet.id === APIFOOTBALL_BET_ID_BTTS) {
        for (const v of bet.values) {
          const odd = parseOdd(v.odd);
          if (odd === null) continue;
          if (v.value === "Yes") {
            mercados.BTTS.si = pickMejor(
              mercados.BTTS.si,
              { casa: slug, casaNombre: nombre, odd },
            );
          } else if (v.value === "No") {
            mercados.BTTS.no = pickMejor(
              mercados.BTTS.no,
              { casa: slug, casaNombre: nombre, odd },
            );
          }
        }
      }
    }
  }

  return mercados;
}

function parseOdd(raw: string): number | null {
  if (!raw) return null;
  // api-football suele mandar "1.85"; algunos planes usan coma "1,85".
  const normalized = raw.replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 1) return null; // odd válida es > 1
  return Math.round(n * 100) / 100; // 2 decimales
}

function pickMejor(
  actual: OddsOutcome | null,
  candidato: OddsOutcome,
): OddsOutcome {
  if (!actual) return candidato;
  return candidato.odd > actual.odd ? candidato : actual;
}

// ---------------------------------------------------------------------------
// Selección de partidos para el cron N
// ---------------------------------------------------------------------------

export interface PartidoParaRefresh {
  id: string;
  liga: string;
  externalId: string;
  fechaInicio: Date;
  equipoLocal: string;
  equipoVisita: string;
}

/**
 * Selecciona los próximos N partidos en las ligas top con kickoff dentro de
 * la ventana `LOOKAHEAD_HOURS`. Devuelve ordenados por fecha ASC. El cron N
 * los procesa secuencialmente para no quemar quota de api-football.
 */
export async function listarPartidosParaCronOdds(): Promise<PartidoParaRefresh[]> {
  const ligasTop = LIGAS.filter((l) => LIGAS_TOP_PARA_ODDS.includes(l.slug));
  const nombresLigas = ligasTop.map((l) => l.nombre);
  if (nombresLigas.length === 0) return [];

  const ahora = new Date();
  const limite = new Date(
    ahora.getTime() + ODDS_CRON_LOOKAHEAD_HOURS * 60 * 60 * 1000,
  );

  const partidos = await prisma.partido.findMany({
    where: {
      liga: { in: nombresLigas },
      fechaInicio: { gte: ahora, lte: limite },
      estado: "PROGRAMADO",
    },
    select: {
      id: true,
      liga: true,
      externalId: true,
      fechaInicio: true,
      equipoLocal: true,
      equipoVisita: true,
    },
    orderBy: { fechaInicio: "asc" },
    take: ODDS_CRON_BATCH_SIZE,
  });

  return partidos;
}

// ---------------------------------------------------------------------------
// Helper para el cron N + endpoint admin
// ---------------------------------------------------------------------------

export interface CronOddsResultado {
  procesados: number;
  ok: number;
  fallidos: number;
  sinOdds: number;
  sinBookmakersValidos: number;
}

/**
 * Recorre los próximos partidos top y refresca cada uno. Devuelve resumen.
 * Si fallan >50% de los partidos, loggea level=critical para disparar el
 * Job M de alertas (Lote 6).
 */
export async function ejecutarCronOdds(): Promise<CronOddsResultado> {
  const partidos = await listarPartidosParaCronOdds();
  const resumen: CronOddsResultado = {
    procesados: partidos.length,
    ok: 0,
    fallidos: 0,
    sinOdds: 0,
    sinBookmakersValidos: 0,
  };

  for (const p of partidos) {
    const r = await actualizarOddsPartido(p.id);
    if (!r.ok) {
      resumen.fallidos += 1;
    } else {
      resumen.ok += 1;
      if (r.motivo === "sin-odds") resumen.sinOdds += 1;
      if (r.motivo === "sin-bookmakers-validos")
        resumen.sinBookmakersValidos += 1;
    }
  }

  if (
    resumen.procesados > 0 &&
    resumen.fallidos / resumen.procesados > 0.5
  ) {
    await registrarError({
      level: "critical",
      source: "odds-cache:cron",
      message: `Cron N de odds: ${resumen.fallidos}/${resumen.procesados} partidos fallaron en una corrida (>50%)`,
      metadata: { resumen },
    });
  }

  return resumen;
}
