// GET /api/v1/admin/motor-cuotas/salud — Lote V fase V.5.
// Spec: docs/plan-tecnico-lote-v-motor-cuotas.md § 9.5.
//
// Devuelve estado de los 7 scrapers (SaludScraper) + counts de cola BullMQ.
// Auth ADMIN (regla 11).

import { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import { obtenerSaludMotor } from "@/lib/services/motor-cuotas-dashboard.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(_req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado(
        "Solo administradores pueden ver el motor de cuotas.",
      );
    }
    const data = await obtenerSaludMotor();
    return Response.json(data);
  } catch (err) {
    logger.error(
      { err, source: "api:admin-motor-cuotas-salud" },
      "GET /api/v1/admin/motor-cuotas/salud falló",
    );
    return toErrorResponse(err);
  }
}
