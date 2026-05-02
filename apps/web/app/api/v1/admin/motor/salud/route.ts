// GET /api/v1/admin/motor/salud — Lote L v3.2 (May 2026).
// Spec: docs/plan-trabajo-claude-code-v3.2.md § Lote L #6.
//
// Endpoint admin para consumir métricas del motor de análisis. Alimenta la
// vista /admin/motor del Lote P (KPIs + tendencia 90d + causas de rechazo).
//
// Auth: sesión ADMIN o Bearer CRON_SECRET (para healthcheck periódico).
//
// Query params:
//   - rango: '7d' | '30d' | '90d' (default '30d')
//   - refresh: '1' invalida el cache (uso ad-hoc post-aprobación masiva)

import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import {
  invalidarCacheMotorSalud,
  obtenerCausasRechazo,
  obtenerKPIsMotor,
  obtenerTendenciaMotor,
} from "@/lib/services/motor-salud.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const QuerySchema = z.object({
  rango: z.enum(["7d", "30d", "90d"]).default("30d"),
  refresh: z.string().optional(),
});

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    const isAdmin =
      !!session?.user?.id && session.user.rol === "ADMIN";
    if (!isAdmin) {
      const secret = process.env.CRON_SECRET;
      if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
        if (!session?.user?.id) throw new NoAutenticado();
        throw new NoAutorizado("Solo ADMIN o Bearer CRON_SECRET");
      }
    }

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      rango: url.searchParams.get("rango") ?? undefined,
      refresh: url.searchParams.get("refresh") ?? undefined,
    });
    if (!parsed.success) {
      throw new ValidacionFallida("Query inválida.", {
        issues: parsed.error.flatten(),
      });
    }
    if (parsed.data.refresh === "1") {
      invalidarCacheMotorSalud();
    }

    const [kpis, tendencia, causasRechazo] = await Promise.all([
      obtenerKPIsMotor(parsed.data.rango),
      obtenerTendenciaMotor(),
      obtenerCausasRechazo(parsed.data.rango),
    ]);

    return Response.json({
      ok: true,
      data: { kpis, tendencia, causasRechazo },
    });
  } catch (err) {
    logger.error(
      { err, source: "api:admin-motor-salud" },
      "GET /api/v1/admin/motor/salud falló",
    );
    return toErrorResponse(err);
  }
}
