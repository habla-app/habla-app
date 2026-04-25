// POST /api/cron/vencimiento-lukas — Lote 6A.
//
// Dispara el job de vencimiento de Lukas comprados manualmente.
// Guard: Authorization: Bearer <CRON_SECRET>
//
// En producción el job corre automáticamente cada 1h via instrumentation.ts.
// Este endpoint permite dispararlo ad-hoc (testing, debug, reprocesar).

import { NextRequest } from "next/server";
import { vencimientoLukasJob } from "@/lib/services/vencimiento-lukas.job";
import { NoAutorizado, toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      logger.error("CRON_SECRET no configurado; endpoint deshabilitado");
      throw new NoAutorizado("El endpoint de cron no está configurado.");
    }

    const authHeader = req.headers.get("authorization") ?? "";
    if (authHeader !== `Bearer ${secret}`) {
      throw new NoAutorizado("Cron secret inválido.");
    }

    const result = await vencimientoLukasJob();
    logger.info(result, "cron vencimiento-lukas ejecutado");

    return Response.json({ data: result });
  } catch (err) {
    logger.error({ err }, "cron vencimiento-lukas falló");
    return toErrorResponse(err);
  }
}
