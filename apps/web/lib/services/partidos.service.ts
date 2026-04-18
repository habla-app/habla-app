// Servicio de partidos. En el Sub-Sprint 3:
//   - importarDeApiFootball: admin dispara el fetch de fixtures para una
//     fecha. Upsertea los partidos en BD.
//   - listarDisponiblesParaTorneo: partidos PROGRAMADO con fechaInicio a
//     futuro, que el admin puede convertir en torneo.
//   - obtener: búsqueda por id.
//   - actualizarEstado: usada por el poller de Sub-Sprint 5.

import { prisma, type Partido } from "@habla/db";
import { fetchFixturesByDate } from "./api-football.client";
import { fixtureToPartidoInput } from "./partidos.mapper";
import { PartidoNoEncontrado, ValidacionFallida } from "./errors";
import { logger } from "./logger";

export interface ImportarResult {
  fecha: string;
  importados: number;
  actualizados: number;
  total: number;
}

/**
 * Descarga los fixtures del día desde api-football y los upsertea.
 * Timezone por defecto: America/Lima. Devuelve contadores para el admin.
 */
export async function importarDeApiFootball(
  fechaISO: string, /* YYYY-MM-DD */
): Promise<ImportarResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) {
    throw new ValidacionFallida(
      "La fecha debe tener formato YYYY-MM-DD.",
      { fechaISO },
    );
  }

  const fixtures = await fetchFixturesByDate(fechaISO, {
    timezone: "America/Lima",
  });

  let importados = 0;
  let actualizados = 0;

  for (const fixture of fixtures) {
    const input = fixtureToPartidoInput(fixture);
    const result = await prisma.partido.upsert({
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
      },
    });
    // Prisma no devuelve si fue insert o update; aproximamos con createdAt.
    const createdMsAgo = Date.now() - result.creadoEn.getTime();
    if (createdMsAgo < 5000) importados += 1;
    else actualizados += 1;
  }

  logger.info(
    { fecha: fechaISO, importados, actualizados, total: fixtures.length },
    "import api-football",
  );

  return {
    fecha: fechaISO,
    importados,
    actualizados,
    total: fixtures.length,
  };
}

/**
 * Partidos futuros (PROGRAMADO con fecha de inicio a futuro) que todavía
 * no tienen torneo asociado. El admin los usa como pool para crear nuevos
 * torneos.
 */
export async function listarDisponiblesParaTorneo(): Promise<Partido[]> {
  return prisma.partido.findMany({
    where: {
      estado: "PROGRAMADO",
      fechaInicio: { gt: new Date() },
      torneos: { none: {} },
    },
    orderBy: { fechaInicio: "asc" },
    take: 100,
  });
}

export async function obtener(id: string): Promise<Partido> {
  const partido = await prisma.partido.findUnique({ where: { id } });
  if (!partido) throw new PartidoNoEncontrado(id);
  return partido;
}
