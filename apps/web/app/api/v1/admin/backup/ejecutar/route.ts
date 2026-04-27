// POST /api/v1/admin/backup/ejecutar — Lote 7.
//
// Dispara `ejecutarBackupDiario()` ad-hoc. Usos:
//   - Validación post-deploy / post-cambio de env vars.
//   - Backup manual antes de una migración riesgosa.
//   - Forzar la primera ejecución sin esperar a la ventana 04:00 PET.
//
// Auth: Authorization: Bearer <CRON_SECRET>
// Devuelve el `BackupResult` completo en la response (incluso en fallo).

import { NextRequest } from "next/server";
import { ejecutarBackupDiario, isR2Configured } from "@/lib/services/backup-r2.service";
import { NoAutorizado, toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// pg_dump puede tardar varios segundos para BDs medianas; margen amplio.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      logger.error(
        "CRON_SECRET no configurado; /api/v1/admin/backup/ejecutar deshabilitado",
      );
      throw new NoAutorizado("Cron no configurado en este ambiente.");
    }
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      throw new NoAutorizado("Cron secret inválido.");
    }

    if (!isR2Configured()) {
      return Response.json(
        {
          error: {
            code: "R2_NO_CONFIGURADO",
            message:
              "Falta alguna de R2_ACCOUNT_ID / R2_BUCKET_BACKUPS / R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY",
          },
        },
        { status: 503 },
      );
    }

    const result = await ejecutarBackupDiario();
    logger.info(
      {
        ok: result.ok,
        archivo: result.archivo,
        bytes: result.bytes,
        durationMs: result.durationMs,
      },
      "POST /api/v1/admin/backup/ejecutar",
    );
    return Response.json({ data: result }, { status: result.ok ? 200 : 500 });
  } catch (err) {
    logger.error({ err }, "POST /api/v1/admin/backup/ejecutar falló");
    return toErrorResponse(err);
  }
}
