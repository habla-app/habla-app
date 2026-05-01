// POST /api/v1/admin/finanzas/comisiones — Lote G.
//
// Upsert de comisión de afiliación pagada por la casa.

import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { upsertarComision } from "@/lib/services/finanzas.service";
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
  mes: z.string().regex(/^\d{4}-\d{2}$/),
  afiliadoId: z.string().min(1),
  montoSoles: z.number().int().min(0).max(10_000_000),
  ftdsContados: z.number().int().min(0).max(100_000).optional(),
  notas: z.string().max(500).optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN")
      throw new NoAutorizado("Solo ADMIN puede registrar comisiones");

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido", parsed.error.flatten());
    }

    const fila = await upsertarComision({
      mes: parsed.data.mes,
      afiliadoId: parsed.data.afiliadoId,
      montoSoles: parsed.data.montoSoles,
      ftdsContados: parsed.data.ftdsContados,
      notas: parsed.data.notas ?? null,
      registradoPor: session.user.id,
    });

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email,
      accion: "comision_afiliacion.registrar",
      entidad: "ComisionAfiliacion",
      entidadId: fila.id,
      resumen: `Comisión ${parsed.data.mes} ${fila.afiliadoNombre}: S/${parsed.data.montoSoles}`,
      metadata: { ...parsed.data },
    });

    void track({
      evento: "admin_comision_afiliacion_registrada",
      userId: session.user.id,
      props: {
        mes: parsed.data.mes,
        afiliadoId: parsed.data.afiliadoId,
        monto: parsed.data.montoSoles,
      },
    });

    logger.info(
      { adminId: session.user.id, mes: parsed.data.mes, source: "admin:finanzas:comisiones" },
      "Comisión registrada",
    );

    return Response.json({ ok: true, fila });
  } catch (err) {
    logger.error(
      { err, source: "api:admin:finanzas:comisiones" },
      "POST /api/v1/admin/finanzas/comisiones falló",
    );
    return toErrorResponse(err);
  }
}
