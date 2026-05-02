// GET/POST /api/v1/crons/evaluar-analisis — Lote L v3.2 (May 2026).
//
// Trigger HTTP del cron de evaluación de AnalisisPartido. El cron real corre
// in-process desde `instrumentation.ts` cada 1h. Este endpoint sirve para
// dispararlo a demanda (smoke test post-deploy o post-finalización masiva).
//
// Auth: Bearer CRON_SECRET o sesión ADMIN.

import { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { evaluarAnalisisFinalizados } from "@/lib/services/analisis-partido-evaluador.service";
import { logger } from "@/lib/services/logger";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
} from "@/lib/services/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    const isAdmin = session?.user?.id && session.user.rol === "ADMIN";
    if (!isAdmin) {
      const secret = process.env.CRON_SECRET;
      if (
        !secret ||
        req.headers.get("authorization") !== `Bearer ${secret}`
      ) {
        if (!session?.user?.id) throw new NoAutenticado();
        throw new NoAutorizado("Solo ADMIN o Bearer CRON_SECRET");
      }
    }

    const reporte = await evaluarAnalisisFinalizados();
    logger.info(
      { ...reporte, source: "cron:analisis-partido:eval-http" },
      "GET /api/v1/crons/evaluar-analisis ejecutado",
    );
    return Response.json({ ok: true, reporte });
  } catch (err) {
    logger.error(
      { err, source: "api:crons:evaluar-analisis" },
      "GET /api/v1/crons/evaluar-analisis falló",
    );
    return toErrorResponse(err);
  }
}

export const POST = GET;
