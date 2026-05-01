// GET/POST /api/v1/crons/lighthouse-weekly — Lote G.
//
// Trigger del cron semanal de Lighthouse contra rutas críticas. El cron real
// corre in-process desde `instrumentation.ts` (lunes 6 AM PET). Este endpoint
// permite trigger manual.
//
// Auth: Bearer CRON_SECRET o sesión ADMIN.

import { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { correrLighthouseSemanal } from "@/lib/services/vitals.service";
import { logger } from "@/lib/services/logger";
import { NoAutenticado, NoAutorizado, toErrorResponse } from "@/lib/services/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

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

    const reporte = await correrLighthouseSemanal();
    logger.info(
      { ...reporte, source: "cron:lighthouse-weekly:http" },
      "GET /api/v1/crons/lighthouse-weekly ejecutado",
    );
    return Response.json({ ok: true, reporte });
  } catch (err) {
    logger.error(
      { err, source: "api:crons:lighthouse-weekly" },
      "GET /api/v1/crons/lighthouse-weekly falló",
    );
    return toErrorResponse(err);
  }
}

export const POST = GET;
