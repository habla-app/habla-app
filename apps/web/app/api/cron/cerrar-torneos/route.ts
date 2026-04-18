// GET /api/cron/cerrar-torneos
//
// Endpoint de cron (no en /api/v1/). Se dispara externamente cada minuto
// (Railway Cron, GitHub Actions, etc.) con el header:
//
//   Authorization: Bearer <CRON_SECRET>
//
// Cierra torneos con cierreAt <= NOW: los con <2 inscritos se cancelan
// (reembolso automático); el resto pasa a CERRADO con rake 12% calculado.
//
// Devuelve el resumen para que el cron caller pueda loguearlo.

import { NextRequest } from "next/server";
import { procesarCierreAutomatico } from "@/lib/services/torneos.service";
import { NoAutorizado, toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      logger.error("CRON_SECRET no configurado; endpoint deshabilitado");
      throw new NoAutorizado("El endpoint de cron no está configurado.");
    }

    const auth = req.headers.get("authorization") ?? "";
    const expected = `Bearer ${secret}`;
    if (auth !== expected) {
      throw new NoAutorizado("Cron secret inválido.");
    }

    const result = await procesarCierreAutomatico();
    logger.info(
      {
        cerrados: result.cerrados.length,
        cancelados: result.cancelados.length,
      },
      "cron cerrar-torneos ejecutado",
    );

    return Response.json({ data: result });
  } catch (err) {
    logger.error({ err }, "cron cerrar-torneos falló");
    return toErrorResponse(err);
  }
}
