// POST /api/v1/admin/alarmas/manual — Lote G.
//
// Crea una alarma manual (recordatorio interno).

import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { crearAlarmaManual } from "@/lib/services/alarmas.service";
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
  titulo: z.string().min(3).max(200),
  descripcion: z.string().min(3).max(2000),
  severidad: z.enum(["INFO", "WARNING", "CRITICAL"]).default("INFO"),
});

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN")
      throw new NoAutorizado("Solo ADMIN puede crear alarmas");

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido", parsed.error.flatten());
    }

    const alarma = await crearAlarmaManual(parsed.data);

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email,
      accion: "alarma.crear_manual",
      entidad: "Alarma",
      entidadId: alarma.id,
      resumen: parsed.data.titulo,
      metadata: { ...parsed.data },
    });

    void track({
      evento: "admin_alarma_manual_creada",
      userId: session.user.id,
      props: { severidad: parsed.data.severidad },
    });

    return Response.json({ ok: true, alarma });
  } catch (err) {
    logger.error(
      { err, source: "api:admin:alarmas:manual" },
      "POST /api/v1/admin/alarmas/manual falló",
    );
    return toErrorResponse(err);
  }
}
