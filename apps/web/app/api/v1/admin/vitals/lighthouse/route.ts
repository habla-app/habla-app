// POST /api/v1/admin/vitals/lighthouse — Lote G.
//
// Dispara una corrida manual de Lighthouse contra una URL específica.
// Usado por el botón "Correr Lighthouse" en /admin/mobile-vitals.
//
// Auth: ADMIN. Audita la acción en `auditoria_admin` (regla 21).

import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { correrLighthouseManual } from "@/lib/services/vitals.service";
import { logAuditoria } from "@/lib/services/auditoria.service";
import { logger } from "@/lib/services/logger";
import {
  NoAutenticado,
  NoAutorizado,
  ValidacionFallida,
  toErrorResponse,
} from "@/lib/services/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

const BodySchema = z.object({
  url: z.string().url().max(500),
  device: z.enum(["mobile", "desktop"]).default("mobile"),
});

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN")
      throw new NoAutorizado("Solo ADMIN puede correr Lighthouse");

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida("URL inválida", parsed.error.flatten());
    }

    const result = await correrLighthouseManual(
      parsed.data.url,
      parsed.data.device,
      session.user.email ?? session.user.id,
    );

    if (!result.ok) {
      return Response.json(
        { ok: false, error: result.error ?? "lighthouse falló" },
        { status: 502 },
      );
    }

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email,
      accion: "lighthouse.run_manual",
      entidad: "LighthouseRun",
      resumen: `Lighthouse ${parsed.data.device} contra ${parsed.data.url}: perf ${result.performance}`,
      metadata: {
        url: parsed.data.url,
        device: parsed.data.device,
        performance: result.performance,
        accessibility: result.accessibility,
      },
    });

    logger.info(
      { url: parsed.data.url, performance: result.performance, source: "admin:lighthouse" },
      "Lighthouse manual ejecutado",
    );
    return Response.json({ ok: true, result });
  } catch (err) {
    logger.error(
      { err, source: "api:admin:vitals:lighthouse" },
      "POST /api/v1/admin/vitals/lighthouse falló",
    );
    return toErrorResponse(err);
  }
}
