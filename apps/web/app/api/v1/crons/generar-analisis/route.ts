// GET/POST /api/v1/crons/generar-analisis — Lote L v3.2 (May 2026).
//
// Trigger HTTP del cron de generación de AnalisisPartido. El cron real corre
// in-process desde `instrumentation.ts` cada 4h. Este endpoint sirve para
// dispararlo a demanda (smoke test post-deploy).
//
// Auth: Bearer CRON_SECRET o sesión ADMIN.

import { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { generarAnalisisDelDia } from "@/lib/services/analisis-partido-generador.service";
import { logger } from "@/lib/services/logger";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
} from "@/lib/services/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Generación de hasta 3 partidos × hasta 15s/llamada Claude API.
export const maxDuration = 300;

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

    const reporte = await generarAnalisisDelDia();
    logger.info(
      { ...reporte, source: "cron:analisis-partido:gen-http" },
      "GET /api/v1/crons/generar-analisis ejecutado",
    );
    return Response.json({ ok: true, reporte });
  } catch (err) {
    logger.error(
      { err, source: "api:crons:generar-analisis" },
      "GET /api/v1/crons/generar-analisis falló",
    );
    return toErrorResponse(err);
  }
}

export const POST = GET;
