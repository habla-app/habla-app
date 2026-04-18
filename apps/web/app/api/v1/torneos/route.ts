// GET /api/v1/torneos?estado=&liga=&page=&limit=
//
// Público. Lista paginada de torneos ordenados por cierreAt ASC.

import { NextRequest } from "next/server";
import { listar } from "@/lib/services/torneos.service";
import { ListarTorneosQuerySchema } from "@/lib/services/torneos.schema";
import { toErrorResponse, ValidacionFallida } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = ListarTorneosQuerySchema.safeParse(params);
    if (!parsed.success) {
      throw new ValidacionFallida(
        "Parámetros de consulta inválidos.",
        { issues: parsed.error.flatten() },
      );
    }

    const data = await listar(parsed.data);
    return Response.json({ data });
  } catch (err) {
    logger.error({ err }, "GET /api/v1/torneos falló");
    return toErrorResponse(err);
  }
}
