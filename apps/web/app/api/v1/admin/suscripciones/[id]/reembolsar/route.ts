// POST /api/v1/admin/suscripciones/[id]/reembolsar — Lote F.
//
// Reembolso del último pago. Si la suscripción está en garantía 7d, usa
// el flow normal (`reembolsarEnGarantia` del Lote E). Fuera de garantía
// es un override admin (`reembolsarManualAdmin`) — el cliente del modal
// debe haber confirmado explícitamente.
//
// Auth: sesión ADMIN obligatoria. Auditoría 100%.

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
import {
  reembolsarEnGarantia,
  reembolsarManualAdmin,
} from "@/lib/services/suscripciones.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  motivo: z.string().min(1).max(500),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") throw new NoAutorizado("Solo ADMIN");

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido", {
        issues: parsed.error.flatten(),
      });
    }

    const sus = await prisma.suscripcion.findUnique({ where: { id: params.id } });
    if (!sus) throw new ValidacionFallida("Suscripción no encontrada");

    if (sus.enGarantia) {
      await reembolsarEnGarantia({
        suscripcionId: sus.id,
        aprobadoPor: session.user.email ?? session.user.id,
      });
    } else {
      await reembolsarManualAdmin({
        suscripcionId: sus.id,
        motivo: parsed.data.motivo,
        aprobadoPor: session.user.email ?? session.user.id,
      });
    }

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: sus.enGarantia ? "suscripcion.reembolsar" : "suscripcion.reembolsar_override",
      entidad: "Suscripcion",
      entidadId: sus.id,
      resumen: `Reembolso ${sus.enGarantia ? "en garantía" : "OVERRIDE fuera de garantía"}: ${parsed.data.motivo.slice(0, 80)}`,
      metadata: {
        motivo: parsed.data.motivo,
        enGarantia: sus.enGarantia,
        plan: sus.plan,
      },
    });

    return Response.json({ ok: true });
  } catch (err) {
    logger.error(
      { err, source: "api:admin:suscripciones:reembolsar" },
      "POST /api/v1/admin/suscripciones/[id]/reembolsar falló",
    );
    return toErrorResponse(err);
  }
}
