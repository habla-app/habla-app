// POST /api/v1/admin/cuotas/diagnostico-endpoints — Lote V.8.2.
// Spec: docs/plan-tecnico-lote-v-motor-cuotas.md (extensión V.8).
//
// Ejecuta probes paralelos a todos los endpoints de discovery configurados
// para las 7 casas y devuelve resumen estructurado: status, latencia,
// bodyPreview, conteo de eventos detectados. Útil cuando el discovery
// falla en producción y necesitamos saber si los endpoints están vivos,
// devolviendo la estructura esperada, o bloqueados por WAF.
//
// Auth ADMIN (regla 11). Auditoría 100% (regla 21).
// El endpoint es read-only — no muta nada en BD — pero registramos en
// auditoría para trazabilidad de quién diagnostica cuándo.

import { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import { logAuditoria } from "@/lib/services/auditoria.service";
import { ejecutarDiagnosticoEndpoints } from "@/lib/services/diagnostico-endpoints.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado(
        "Solo administradores pueden ejecutar diagnóstico de endpoints.",
      );
    }

    const resultado = await ejecutarDiagnosticoEndpoints();

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: "cuotas.diagnostico_endpoints",
      entidad: "MotorCuotas",
      entidadId: null,
      resumen: `Diagnóstico de endpoints ejecutado (${resultado.casas.length} casas, ${resultado.duracionMs}ms)`,
      metadata: {
        duracionMs: resultado.duracionMs,
        resumenPorCasa: resultado.casas.map((c) => ({
          casa: c.casa,
          endpoints: c.endpoints.length,
          totalEventosDetectados: c.totalEventosDetectados,
          mejorEndpoint: c.mejorEndpoint,
        })),
      },
    });

    return Response.json({
      ok: true,
      ...resultado,
    });
  } catch (err) {
    logger.error(
      { err, source: "api:admin-cuotas-diagnostico-endpoints" },
      "POST /api/v1/admin/cuotas/diagnostico-endpoints falló",
    );
    return toErrorResponse(err);
  }
}
