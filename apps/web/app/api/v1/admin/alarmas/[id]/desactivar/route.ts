// POST /api/v1/admin/alarmas/[id]/desactivar — Lote G.

import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { desactivarAlarma } from "@/lib/services/alarmas.service";
import { logAuditoria } from "@/lib/services/auditoria.service";
import { logger } from "@/lib/services/logger";
import { track } from "@/lib/services/analytics.service";
import {
  NoAutenticado,
  NoAutorizado,
  ValidacionFallida,
  toErrorResponse,
} from "@/lib/services/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  motivo: z.string().min(5).max(1000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN")
      throw new NoAutorizado("Solo ADMIN puede desactivar alarmas");

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida(
        "Motivo obligatorio",
        parsed.error.flatten(),
      );
    }

    const alarma = await desactivarAlarma(
      params.id,
      parsed.data.motivo,
      session.user.id,
    );

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email,
      accion: "alarma.desactivar",
      entidad: "Alarma",
      entidadId: params.id,
      resumen: alarma.titulo,
      metadata: { motivo: parsed.data.motivo, metricId: alarma.metricId },
    });

    void track({
      evento: "admin_alarma_desactivada",
      userId: session.user.id,
      props: { metricId: alarma.metricId, motivo: parsed.data.motivo },
    });

    return Response.json({ ok: true, alarma });
  } catch (err) {
    logger.error(
      { err, source: "api:admin:alarmas:desactivar" },
      "POST /api/v1/admin/alarmas/[id]/desactivar falló",
    );
    return toErrorResponse(err);
  }
}
