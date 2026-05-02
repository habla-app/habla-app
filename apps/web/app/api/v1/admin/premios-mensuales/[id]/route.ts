// PATCH /api/v1/admin/premios-mensuales/[id] — Lote 5.
//
// Updatea un PremioMensual. Campos editables:
//   - estado (PENDIENTE | COORDINADO | PAGADO | CANCELADO)
//   - datosPago (objeto JSON libre con datos de pago, o null para limpiar)
//   - notas (string libre, o null para limpiar)
//
// Side effect: al pasar a PAGADO seteamos `pagadoEn = NOW()`. Al volver a
// PENDIENTE limpiamos `pagadoEn`.

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  actualizarPremio,
  ESTADOS_VALIDOS_TUPLE,
  type ActualizarPremioInput,
} from "@/lib/services/leaderboard.service";
import {
  NoAutenticado,
  NoAutorizado,
  ValidacionFallida,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import { logAuditoria } from "@/lib/services/auditoria.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PatchSchema = z.object({
  estado: z.enum(ESTADOS_VALIDOS_TUPLE).optional(),
  datosPago: z.record(z.unknown()).nullable().optional(),
  notas: z.string().max(2000).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado("Solo administradores.");
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = PatchSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido.", {
        issues: parsed.error.flatten(),
      });
    }

    const patch: ActualizarPremioInput = {
      estado: parsed.data.estado,
      datosPago: parsed.data.datosPago,
      notas: parsed.data.notas,
    };
    const updated = await actualizarPremio(params.id, patch);

    // Auditoría 100% — regla 21 del CLAUDE.md
    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: parsed.data.estado === "PAGADO" ? "premio.marcar_pagado" : "premio.actualizar",
      entidad: "PremioMensual",
      entidadId: params.id,
      resumen: `Premio ${params.id} actualizado${parsed.data.estado ? ` → ${parsed.data.estado}` : ""}`,
      metadata: { ...patch },
    });

    logger.info(
      { premioId: params.id, patch },
      "PATCH /api/v1/admin/premios-mensuales/[id]",
    );
    return Response.json({ data: { premio: updated } });
  } catch (err) {
    logger.error(
      { err, premioId: params.id },
      "PATCH /api/v1/admin/premios-mensuales/[id] falló",
    );
    return toErrorResponse(err);
  }
}
