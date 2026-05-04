// POST /api/v1/admin/motor-cuotas/refresh-global — Lote V fase V.5.
// Spec: docs/plan-tecnico-lote-v-motor-cuotas.md § 9.5.
//
// Encola refresh para todos los partidos con Filtro 1 ON (mostrarAlPublico).
// Auth ADMIN. Auditoría 100%.

import { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import { logAuditoria } from "@/lib/services/auditoria.service";
import { refrescarCuotasDelDia } from "@/lib/services/captura-cuotas.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado(
        "Solo administradores pueden forzar refresh global.",
      );
    }

    const resumen = await refrescarCuotasDelDia();

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: "motor_cuotas.refresh_global",
      entidad: "MotorCuotas",
      entidadId: null,
      resumen: `Refresh global encolado: ${resumen.partidosProcesados} partidos, ${resumen.jobsTotales} jobs`,
      metadata: resumen,
    });

    return Response.json({ ok: true, ...resumen });
  } catch (err) {
    logger.error(
      { err, source: "api:admin-motor-cuotas-refresh-global" },
      "POST /api/v1/admin/motor-cuotas/refresh-global falló",
    );
    return toErrorResponse(err);
  }
}
