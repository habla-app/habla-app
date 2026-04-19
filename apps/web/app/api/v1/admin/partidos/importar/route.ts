// POST /api/v1/admin/partidos/importar
//
// Requiere rol ADMIN. Trigger manual del auto-import de partidos desde
// api-football para las ligas whitelisteadas (lib/config/ligas.ts).
//
// No recibe body: la ventana es siempre hoy+14 días y las ligas salen
// de la config. El cron in-process lo corre cada 6h; este endpoint es
// un botón de panic para refrescar on-demand desde /admin (útil al
// agregar una liga nueva a LIGAS_ACTIVAS).
//
// Devuelve: { data: ImportLigaResult[] } con los 4 contadores por liga
// (partidosCreados, partidosActualizados, torneosCreados, errores) +
// la season resuelta.

import { auth } from "@/lib/auth";
import { importarPartidosTodasLasLigas } from "@/lib/services/partidos-import.service";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado("Solo administradores pueden importar partidos.");
    }

    const resultados = await importarPartidosTodasLasLigas();

    logger.info(
      {
        ligas: resultados.length,
        totales: resultados.reduce(
          (acc, r) => ({
            creados: acc.creados + r.partidosCreados,
            actualizados: acc.actualizados + r.partidosActualizados,
            torneos: acc.torneos + r.torneosCreados,
            errores: acc.errores + r.errores,
          }),
          { creados: 0, actualizados: 0, torneos: 0, errores: 0 },
        ),
      },
      "POST /api/v1/admin/partidos/importar ok",
    );

    return Response.json({ data: resultados });
  } catch (err) {
    logger.error({ err }, "POST /api/v1/admin/partidos/importar falló");
    return toErrorResponse(err);
  }
}
