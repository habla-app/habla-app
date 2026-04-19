// GET /api/v1/tickets/stats
//
// Requiere sesión. Devuelve las 5 métricas del stats-summary de
// `/mis-combinadas`: jugadas, ganadas, aciertoPct, neto, mejorPuesto.

import { auth } from "@/lib/auth";
import { calcularStats } from "@/lib/services/tickets.service";
import { NoAutenticado, toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();

    const data = await calcularStats(session.user.id);
    return Response.json({ data });
  } catch (err) {
    logger.error({ err }, "GET /api/v1/tickets/stats falló");
    return toErrorResponse(err);
  }
}
