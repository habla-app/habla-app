// POST /api/v1/admin/cuotas/diagnostico-endpoints — Lote V.8.2 + V.8.3.
// Spec: docs/plan-tecnico-lote-v-motor-cuotas.md (extensión V.8).
//
// Ejecuta probes paralelos a todos los endpoints de discovery configurados
// para las 7 casas y devuelve resumen estructurado: status, latencia,
// bodyPreview, conteo de eventos detectados. Útil cuando el discovery
// falla en producción y necesitamos saber si los endpoints están vivos,
// devolviendo la estructura esperada, o bloqueados por WAF.
//
// Lote V.8.3: body opcional `urlsCustom` permite probar URLs custom (las
// que el admin descubrió en DevTools del browser real) sin esperar
// redeploy. Útil para iterar rápido cuando los endpoints predefinidos
// están todos rotos (caso 04/05/2026).
//
// Auth ADMIN (regla 11). Auditoría 100% (regla 21).
// El endpoint es read-only — no muta nada en BD — pero registramos en
// auditoría para trazabilidad de quién diagnostica cuándo.

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
import { logAuditoria } from "@/lib/services/auditoria.service";
import { ejecutarDiagnosticoEndpoints } from "@/lib/services/diagnostico-endpoints.service";
import { CASAS_CUOTAS, type CasaCuotas } from "@/lib/services/scrapers/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z
  .object({
    urlsCustom: z
      .array(
        z
          .object({
            casa: z.enum(
              CASAS_CUOTAS as unknown as readonly [CasaCuotas, ...CasaCuotas[]],
            ),
            url: z.string().url().min(8).max(500),
            headers: z.record(z.string()).optional(),
          })
          .strict(),
      )
      .max(40)
      .optional(),
  })
  .strict()
  .optional();

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado(
        "Solo administradores pueden ejecutar diagnóstico de endpoints.",
      );
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido.", {
        issues: parsed.error.flatten(),
      });
    }
    const body = parsed.data ?? {};

    const resultado = await ejecutarDiagnosticoEndpoints({
      urlsCustom: body.urlsCustom,
    });

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: "cuotas.diagnostico_endpoints",
      entidad: "MotorCuotas",
      entidadId: null,
      resumen: `Diagnóstico de endpoints ejecutado (${resultado.casas.length} casas, ${resultado.duracionMs}ms)`,
      metadata: {
        duracionMs: resultado.duracionMs,
        usandoUrlsCustom: !!body.urlsCustom?.length,
        cantidadUrlsCustom: body.urlsCustom?.length ?? 0,
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
