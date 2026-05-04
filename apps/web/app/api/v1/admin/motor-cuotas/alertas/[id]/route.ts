// PATCH /api/v1/admin/motor-cuotas/alertas/[id] — Lote V fase V.5.
// Spec: docs/plan-tecnico-lote-v-motor-cuotas.md § 9.5.
//
// Marca una alerta como vista (o desmarca). Auth ADMIN. Auditoría 100%.

import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import { logAuditoria } from "@/lib/services/auditoria.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const BodySchema = z.object({ vista: z.boolean() }).strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado(
        "Solo administradores pueden marcar alertas.",
      );
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido.", {
        issues: parsed.error.flatten(),
      });
    }
    const { vista } = parsed.data;

    const alerta = await prisma.alertaCuota.update({
      where: { id: params.id },
      data: { vistaPorAdmin: vista },
      select: { id: true, partidoId: true, casa: true, mercado: true, seleccion: true },
    });

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: "alerta_cuota.marcar",
      entidad: "AlertaCuota",
      entidadId: alerta.id,
      resumen: `Alerta ${vista ? "marcada como vista" : "marcada como no vista"} (${alerta.casa} · ${alerta.mercado} · ${alerta.seleccion})`,
      metadata: { partidoId: alerta.partidoId, vista },
    });

    return Response.json({ ok: true, id: alerta.id, vista });
  } catch (err) {
    logger.error(
      { err, alertaId: params.id, source: "api:admin-motor-cuotas-alertas-id" },
      "PATCH /api/v1/admin/motor-cuotas/alertas/[id] falló",
    );
    return toErrorResponse(err);
  }
}
