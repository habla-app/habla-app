// Auto-import de partidos y torneos desde api-football.
//
// Este service es el corazón del job periódico que corre en el cron
// in-process (apps/web/instrumentation.ts) cada 6h. Hace 2 cosas
// idempotentes:
//
//   1. UPSERT de partidos por externalId (unique constraint). Si el
//      partido ya existe, refresca fecha/estado/marcador. Si no, lo
//      crea.
//   2. CREA el torneo asociado a cada partido importado cuando no
//      existe. Si ya existe, no lo toca. Esto es regla dura del
//      negocio: todo partido de una liga whitelisteada debe tener
//      exactamente un torneo.
//
// Ventana: hoy hasta hoy+DIAS_VENTANA_IMPORT (14 días rodantes).
// Ligas: las definidas en lib/config/ligas.ts.
//
// Si api-football devuelve error para una liga, se loguea y seguimos
// con las demás (una liga caída no tumba la corrida completa).

import { prisma } from "@habla/db";
import {
  LIGAS_ACTIVAS,
  DIAS_VENTANA_IMPORT,
  type LigaConfig,
} from "../config/ligas";
import {
  fetchFixturesByLeague,
  type ApiFootballFixture,
} from "./api-football.client";
import { fixtureToPartidoInput } from "./partidos.mapper";
import { getSeasonForLeague } from "./seasons.cache";
import {
  CIERRE_MIN_BEFORE,
  DISTRIB_PREMIOS_DESCRIPTOR,
} from "./torneos.service";
import { ENTRADA_LUKAS } from "../config/economia";
import { logger } from "./logger";

export interface ImportLigaResult {
  liga: string;
  season: number | null;
  partidosCreados: number;
  partidosActualizados: number;
  torneosCreados: number;
  errores: number;
}

function formatDateYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Corre el auto-import para todas las ligas whitelisteadas. Devuelve un
 * resultado por liga, aun si alguna falló (para que el admin vea qué
 * pasó).
 */
export async function importarPartidosTodasLasLigas(): Promise<
  ImportLigaResult[]
> {
  const hoy = new Date();
  const hasta = new Date(hoy.getTime() + DIAS_VENTANA_IMPORT * 86_400_000);
  const from = formatDateYMD(hoy);
  const to = formatDateYMD(hasta);

  const resultados: ImportLigaResult[] = [];

  for (const liga of LIGAS_ACTIVAS) {
    try {
      const season = await getSeasonForLeague(liga.apiFootballId);
      const fixtures = await fetchFixturesByLeague(
        liga.apiFootballId,
        season,
        from,
        to,
      );
      const counters = await procesarFixtures(fixtures, liga);
      resultados.push({
        liga: liga.nombre,
        season,
        ...counters,
        errores: 0,
      });
      logger.info(
        {
          liga: liga.nombre,
          season,
          from,
          to,
          ...counters,
        },
        "[import partidos] liga procesada",
      );
    } catch (err) {
      logger.error(
        { err, liga: liga.nombre, leagueId: liga.apiFootballId },
        "[import partidos] error importando liga",
      );
      resultados.push({
        liga: liga.nombre,
        season: null,
        partidosCreados: 0,
        partidosActualizados: 0,
        torneosCreados: 0,
        errores: 1,
      });
    }
  }

  return resultados;
}

/**
 * Para un array de fixtures de una liga: upsertea partidos y garantiza
 * que cada uno tenga torneo. Es idempotente — correrlo N veces deja el
 * mismo estado.
 */
async function procesarFixtures(
  fixtures: ApiFootballFixture[],
  liga: LigaConfig,
): Promise<{
  partidosCreados: number;
  partidosActualizados: number;
  torneosCreados: number;
}> {
  let partidosCreados = 0;
  let partidosActualizados = 0;
  let torneosCreados = 0;

  for (const fixture of fixtures) {
    const input = fixtureToPartidoInput(fixture);
    // El nombre de la liga del fixture es el que devuelve api-football;
    // preferimos el nombre canónico de nuestra config para evitar drift.
    input.liga = liga.nombre;

    // ── 1. UPSERT partido ──
    const existia = await prisma.partido.findUnique({
      where: { externalId: input.externalId },
      select: { id: true },
    });

    const partido = await prisma.partido.upsert({
      where: { externalId: input.externalId },
      create: input,
      update: {
        liga: input.liga,
        equipoLocal: input.equipoLocal,
        equipoVisita: input.equipoVisita,
        fechaInicio: input.fechaInicio,
        estado: input.estado,
        golesLocal: input.golesLocal,
        golesVisita: input.golesVisita,
        btts: input.btts,
        mas25Goles: input.mas25Goles,
        round: input.round,
        venue: input.venue,
      },
    });

    if (existia) partidosActualizados += 1;
    else partidosCreados += 1;

    // ── 2. CREAR torneo si no existe (regla dura) ──
    // Solo creamos torneo para partidos que todavía pueden jugarse. Si
    // el partido ya empezó o terminó y no tenía torneo, no tiene sentido
    // crear uno ahora — quedaría con cierreAt en el pasado y sin
    // inscritos posibles.
    const cierreAt = new Date(
      partido.fechaInicio.getTime() - CIERRE_MIN_BEFORE * 60 * 1000,
    );
    const yaCerrado = cierreAt.getTime() <= Date.now();
    if (yaCerrado) continue;

    const torneoExistente = await prisma.torneo.findFirst({
      where: { partidoId: partido.id },
      select: { id: true },
    });
    if (torneoExistente) continue;

    await prisma.torneo.create({
      data: {
        nombre: `${partido.equipoLocal} vs ${partido.equipoVisita}`,
        tipo: liga.tipoTorneo,
        // Plan v6: entrada uniforme. `liga.tipoTorneo` se conserva
        // sólo como badge visual.
        entradaLukas: ENTRADA_LUKAS,
        partidoId: partido.id,
        cierreAt,
        distribPremios: DISTRIB_PREMIOS_DESCRIPTOR,
      },
    });
    torneosCreados += 1;
  }

  return { partidosCreados, partidosActualizados, torneosCreados };
}
