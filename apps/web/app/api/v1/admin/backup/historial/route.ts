// GET /api/v1/admin/backup/historial — Lote 7.
//
// Devuelve los últimos 30 rows de `BackupLog` ordenados por fechaIntento
// desc. Útil para inspección rápida del histórico sin tener que abrir
// Prisma Studio o leer Railway logs.
//
// Auth: Authorization: Bearer <CRON_SECRET>

import { NextRequest } from "next/server";
import {
  getBackupHealth,
  isR2Configured,
  listarIntentos,
} from "@/lib/services/backup-r2.service";
import { NoAutorizado, toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      throw new NoAutorizado("CRON_SECRET no configurado.");
    }
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      throw new NoAutorizado("Secret inválido.");
    }

    const [intentos, health] = await Promise.all([
      listarIntentos(30),
      getBackupHealth(),
    ]);

    return Response.json({
      data: {
        configured: isR2Configured(),
        health,
        intentos,
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /api/v1/admin/backup/historial falló");
    return toErrorResponse(err);
  }
}
