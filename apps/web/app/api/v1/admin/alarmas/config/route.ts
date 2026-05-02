// POST /api/v1/admin/alarmas/config — Lote G.
//
// Upsert config de threshold para un KPI.

import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { upsertarConfigThreshold } from "@/lib/services/alarmas.service";
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

const BodySchema = z.object({
  metricId: z.string().min(1).max(100),
  metricLabel: z.string().min(1).max(200),
  thresholdMin: z.number().nullable().optional(),
  thresholdMax: z.number().nullable().optional(),
  duracionMinutos: z.number().int().min(0).max(10080).optional(),
  severidad: z.enum(["INFO", "WARNING", "CRITICAL"]).optional(),
  habilitada: z.boolean().optional(),
  notasInternas: z.string().max(500).nullable().optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN")
      throw new NoAutorizado("Solo ADMIN puede editar config de alarmas");

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido", parsed.error.flatten());
    }

    const config = await upsertarConfigThreshold(parsed.data);

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email,
      accion: "alarma.config_threshold",
      entidad: "AlarmaConfiguracion",
      entidadId: config.id,
      resumen: `Threshold ${parsed.data.metricLabel}: min ${parsed.data.thresholdMin ?? "—"} / max ${parsed.data.thresholdMax ?? "—"}`,
      metadata: { ...parsed.data },
    });

    return Response.json({ ok: true, config });
  } catch (err) {
    logger.error(
      { err, source: "api:admin:alarmas:config" },
      "POST /api/v1/admin/alarmas/config falló",
    );
    return toErrorResponse(err);
  }
}
