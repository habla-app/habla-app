// GET /api/v1/live/matches
//
// Público. Devuelve los partidos actualmente en vivo junto con el
// torneo principal (priorizado por estado y pozoBruto) y un preview del
// top 3 del ranking. Sub-Sprint 5.
//
// Hotfix post-Sub-Sprint 5 (Bug #2): comparte el helper
// `obtenerLiveMatches` con la página `/live-match` para que ambas vistas
// vean el mismo conjunto de partidos. El filtro previo a EN_JUEGO/CERRADO
// excluía partidos cuyos torneos quedaban en ABIERTO por jitter del cron.

import { listarRanking } from "@/lib/services/ranking.service";
import {
  elegirTorneoPrincipal,
  obtenerLiveMatches,
} from "@/lib/services/live-matches.service";
import { getLiveStatus } from "@/lib/services/live-partido-status.cache";
import { toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export async function GET() {
  try {
    const partidos = await obtenerLiveMatches({
      limit: 20,
      incluirFinalizados: false,
    });

    const data = await Promise.all(
      partidos.map(async (p) => {
        const torneoPrincipal = elegirTorneoPrincipal(p.torneos);
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
        // Bug #9: adjuntamos minuto + label del cache del poller.
        // Hotfix #8 Bug #22 + Ítem 4: incluimos statusShort + elapsedAgeMs
        // para que el cliente ancle el reloj local al momento REAL en que
        // el server capturó el elapsed (y no al momento del mount).
        const liveSnap = await getLiveStatus(p.id);
        const nowMs = Date.now();
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
            fechaInicio: p.fechaInicio.toISOString(),
            minutoLabel: liveSnap?.label ?? null,
            minutoPartido: liveSnap?.minuto ?? null,
            minutoExtra: liveSnap?.extra ?? null,
            statusShort: liveSnap?.statusShort ?? null,
            elapsedAgeMs: liveSnap ? nowMs - liveSnap.updatedAt : null,
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
