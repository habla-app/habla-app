// GET /api/v1/partidos/:id/stats
//
// Público. Devuelve estadísticas del partido (posesión, tiros, etc.)
// desde api-football. Los datos NO se persisten — se sirven en vivo
// y se cachean 15s por partido para evitar saturar el upstream.
// Sub-Sprint 5.

import { prisma } from "@habla/db";
import { fetchFixtureStats } from "@/lib/services/api-football.client";
import {
  parseEntero,
  parsePorcentaje,
  type EstadisticasPartidoLado,
} from "@/lib/services/eventos.mapper";
import {
  toErrorResponse,
  PartidoNoEncontrado,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

interface Context {
  params: { id: string };
}

interface CachedStats {
  at: number;
  data: unknown;
}

// Cache in-memory por partido (TTL 15s). Simple, no-eviction — el set
// de partidos en vivo es chico (<50 simultáneos en MVP).
const CACHE_TTL_MS = 15_000;
const cache = new Map<string, CachedStats>();

export async function GET(_req: Request, { params }: Context) {
  try {
    const partido = await prisma.partido.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        externalId: true,
        equipoLocal: true,
        equipoVisita: true,
      },
    });
    if (!partido) throw new PartidoNoEncontrado(params.id);

    const cached = cache.get(partido.id);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return Response.json({ data: cached.data });
    }

    const raw = await fetchFixtureStats(partido.externalId);

    const home = findStatsForTeam(raw, partido.equipoLocal);
    const away = findStatsForTeam(raw, partido.equipoVisita);

    const data = { home, away };
    cache.set(partido.id, { at: Date.now(), data });
    return Response.json({ data });
  } catch (err) {
    logger.error(
      { err, partidoId: params.id },
      "GET /api/v1/partidos/:id/stats falló",
    );
    return toErrorResponse(err);
  }
}

function findStatsForTeam(
  raw: Awaited<ReturnType<typeof fetchFixtureStats>>,
  nombreEquipo: string,
): EstadisticasPartidoLado {
  const match = raw.find((r) => r.team?.name === nombreEquipo);
  if (!match) {
    return {
      posesion: null,
      tiros: null,
      tirosAlArco: null,
      tarjetas: null,
      corners: null,
      faltas: null,
      offsides: null,
      pases: null,
    };
  }
  const find = (type: string) =>
    match.statistics.find((s) => (s.type ?? "").toLowerCase() === type)
      ?.value ?? null;

  return {
    posesion: parsePorcentaje(find("ball possession")),
    tiros: parseEntero(find("total shots")),
    tirosAlArco: parseEntero(find("shots on goal")),
    tarjetas:
      (parseEntero(find("yellow cards")) ?? 0) +
      (parseEntero(find("red cards")) ?? 0),
    corners: parseEntero(find("corner kicks")),
    faltas: parseEntero(find("fouls")),
    offsides: parseEntero(find("offsides")),
    pases: parseEntero(find("total passes")),
  };
}
