// /api/cron/backup-db — endpoint para backup de Postgres a R2.
//
// Este endpoint es complementario al cron in-process de instrumentation.ts.
// Sirve para:
//   1. Disparo manual de un backup ad-hoc (post-deploy, pre-migración).
//   2. Dispararlo desde un cron externo (GitHub Actions, etc.) si en el
//      futuro queremos redundar el cron in-process.
//   3. Inspeccionar el estado actual sin tener que mirar Railway logs (GET).
//
// Auth: header `Authorization: Bearer <CRON_SECRET>`. Si CRON_SECRET no
// está configurado, el endpoint queda deshabilitado (401).
//
// POST → ejecuta backup ahora mismo.
// GET  → reporta estado (R2 configurado?, último éxito, fallos seguidos,
//         lista de últimos 10 backups en bucket).

import { NextRequest } from "next/server";
import {
  getBackupHealth,
  getBackupState,
  hydrateBackupStateFromR2,
  isR2Configured,
  listRecentBackups,
  runBackup,
} from "@/lib/services/backup.service";
import { NoAutorizado, toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// El backup puede tardar unos segundos para una BD chica, pero queremos
// margen por si la BD crece. Next.js permite hasta 5 min en Node runtime.
export const maxDuration = 300;

function checkAuth(req: NextRequest): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logger.error("CRON_SECRET no configurado; /api/cron/backup-db deshabilitado");
    throw new NoAutorizado("Cron no configurado en este ambiente.");
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    throw new NoAutorizado("Cron secret inválido.");
  }
}

export async function POST(req: NextRequest) {
  try {
    checkAuth(req);
    if (!isR2Configured()) {
      return Response.json(
        {
          error: {
            code: "R2_NO_CONFIGURADO",
            message:
              "Falta alguna de R2_BUCKET / R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY",
          },
        },
        { status: 503 },
      );
    }
    const result = await runBackup();
    const status = result.ok ? 200 : 500;
    return Response.json({ data: { result, state: getBackupState() } }, { status });
  } catch (err) {
    logger.error({ err }, "POST /api/cron/backup-db falló");
    return toErrorResponse(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    checkAuth(req);
    // Hidratar el state desde R2 si todavía no lo hicimos. Útil para
    // chequear estado justo después de un deploy fresh.
    await hydrateBackupStateFromR2();
    const recent = isR2Configured() ? await listRecentBackups(10) : [];
    return Response.json({
      data: {
        configured: isR2Configured(),
        health: getBackupHealth(),
        state: getBackupState(),
        recent,
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /api/cron/backup-db falló");
    return toErrorResponse(err);
  }
}
