// GET /api/v1/admin/partidos/disponibles
//
// Requiere rol ADMIN. Lista de partidos PROGRAMADO a futuro sin torneo
// asociado — el pool del admin para crear nuevos torneos.

import { auth } from "@/lib/auth";
import { listarDisponiblesParaTorneo } from "@/lib/services/partidos.service";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado("Solo administradores.");
    }

    const partidos = await listarDisponiblesParaTorneo();
    return Response.json({ data: { partidos } });
  } catch (err) {
    logger.error({ err }, "GET /api/v1/admin/partidos/disponibles falló");
    return toErrorResponse(err);
  }
}
