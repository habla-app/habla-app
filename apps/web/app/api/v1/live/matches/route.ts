// GET /api/v1/live/matches
//
// Público. Devuelve los partidos actualmente en vivo junto con el
// torneo principal (el de mayor pozoBruto) de cada uno y un preview
// del top 3 del ranking. Sub-Sprint 5.

import { prisma } from "@habla/db";
import { listarRanking } from "@/lib/services/ranking.service";
import { toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export async function GET() {
  try {
    const partidos = await prisma.partido.findMany({
      where: { estado: "EN_VIVO" },
      include: {
        torneos: {
          where: { estado: { in: ["EN_JUEGO", "CERRADO"] } },
          orderBy: { pozoBruto: "desc" },
        },
      },
      orderBy: { fechaInicio: "asc" },
    });

    const data = await Promise.all(
      partidos.map(async (p) => {
        const torneoPrincipal = p.torneos[0] ?? null;
        let topPreview: Array<{
          rank: number;
          nombre: string;
          puntosTotal: number;
        }> = [];
        if (torneoPrincipal) {
          try {
            const r = await listarRanking(torneoPrincipal.id, { limit: 3 });
            topPreview = r.ranking.map((row) => ({
              rank: row.rank,
              nombre: row.nombre,
              puntosTotal: row.puntosTotal,
            }));
          } catch (err) {
            logger.debug(
              { err, torneoId: torneoPrincipal.id },
              "topPreview falló para torneo",
            );
          }
        }
        return {
          id: p.id,
          partido: {
            id: p.id,
            liga: p.liga,
            equipoLocal: p.equipoLocal,
            equipoVisita: p.equipoVisita,
            golesLocal: p.golesLocal ?? 0,
            golesVisita: p.golesVisita ?? 0,
            round: p.round,
          },
          torneoPrincipalId: torneoPrincipal?.id ?? null,
          torneos: p.torneos.map((t) => ({
            id: t.id,
            nombre: t.nombre,
            pozoBruto: t.pozoBruto,
            totalInscritos: t.totalInscritos,
            estado: t.estado,
          })),
          topPreview,
        };
      }),
    );

    return Response.json({ data: { partidos: data } });
  } catch (err) {
    logger.error({ err }, "GET /api/v1/live/matches falló");
    return toErrorResponse(err);
  }
}
