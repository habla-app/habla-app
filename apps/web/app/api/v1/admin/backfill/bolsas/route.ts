// POST /api/v1/admin/backfill/bolsas — Lote 6A.
//
// Dispara el backfill de las 3 bolsas de Lukas post-deploy.
// Guard: Authorization: Bearer <CRON_SECRET>
//
// Idempotente: si ya corrió (todas las txs tienen bolsa NOT NULL),
// retorna inmediatamente con txsActualizadas=0.

import { NextRequest } from "next/server";
import { runBackfill } from "@/lib/services/backfill-bolsas.service";
import { NoAutorizado, toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      logger.error("CRON_SECRET no configurado; backfill endpoint deshabilitado");
      throw new NoAutorizado("El endpoint de backfill no está configurado.");
    }

    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      throw new NoAutorizado("Secret inválido.");
    }

    logger.info("POST /api/v1/admin/backfill/bolsas — iniciando");
    const result = await runBackfill();
    logger.info(result, "POST /api/v1/admin/backfill/bolsas — completado");

    return Response.json({ data: result });
  } catch (err) {
    logger.error({ err }, "POST /api/v1/admin/backfill/bolsas falló");
    return toErrorResponse(err);
  }
}
