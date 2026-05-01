// GET/POST /api/v1/crons/evaluar-alarmas — Lote G.
//
// Trigger del cron de evaluación de alarmas KPI. El cron real corre
// in-process desde `instrumentation.ts` cada 1 hora. Este endpoint
// permite trigger manual (testing post-deploy + force-rerun).
//
// Auth: Bearer CRON_SECRET o sesión ADMIN.

import { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { evaluarAlarmas } from "@/lib/services/alarmas.service";
import { logger } from "@/lib/services/logger";
import { NoAutenticado, NoAutorizado, toErrorResponse } from "@/lib/services/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    const isAdmin = session?.user?.id && session.user.rol === "ADMIN";
    if (!isAdmin) {
      const secret = process.env.CRON_SECRET;
      if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
        if (!session?.user?.id) throw new NoAutenticado();
        throw new NoAutorizado("Solo ADMIN o Bearer CRON_SECRET");
      }
    }

    const reporte = await evaluarAlarmas();
    logger.info(
      { ...reporte, source: "cron:evaluar-alarmas:http" },
      "GET /api/v1/crons/evaluar-alarmas ejecutado",
    );
    return Response.json({ ok: true, reporte });
  } catch (err) {
    logger.error(
      { err, source: "api:crons:evaluar-alarmas" },
      "GET /api/v1/crons/evaluar-alarmas falló",
    );
    return toErrorResponse(err);
  }
}

export const POST = GET;
