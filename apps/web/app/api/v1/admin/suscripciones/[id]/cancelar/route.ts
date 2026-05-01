// POST /api/v1/admin/suscripciones/[id]/cancelar — Lote F.
//
// Cancelación inmediata (override admin): cancela en OpenPay + revoca acceso
// al Channel ahora. Distinto a la cancelación normal del usuario (Lote E)
// que mantiene acceso hasta vencimiento.
//
// Auth: sesión ADMIN obligatoria. Auditoría 100%.

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
import { cancelarInmediatoAdmin } from "@/lib/services/suscripciones.service";

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

    await cancelarInmediatoAdmin({
      suscripcionId: params.id,
      motivo: parsed.data.motivo,
    });

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: "suscripcion.cancelar_inmediato",
      entidad: "Suscripcion",
      entidadId: params.id,
      resumen: `Cancelación inmediata: ${parsed.data.motivo.slice(0, 80)}`,
      metadata: { motivo: parsed.data.motivo },
    });

    return Response.json({ ok: true });
  } catch (err) {
    logger.error(
      { err, source: "api:admin:suscripciones:cancelar" },
      "POST /api/v1/admin/suscripciones/[id]/cancelar falló",
    );
    return toErrorResponse(err);
  }
}
