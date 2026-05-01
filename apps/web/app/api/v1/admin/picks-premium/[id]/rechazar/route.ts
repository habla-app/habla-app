// POST /api/v1/admin/picks-premium/[id]/rechazar — Lote E.
//
// Marca un pick PENDIENTE como RECHAZADO con motivo. Idempotente.
// Auth: sesión ADMIN o Bearer CRON_SECRET.

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
import { track } from "@/lib/services/analytics.service";
import { logAuditoria } from "@/lib/services/auditoria.service";

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
    let adminUserId: string | undefined;
    const session = await auth();
    if (session?.user?.id && session.user.rol === "ADMIN") {
      adminUserId = session.user.id;
    } else {
      const secret = process.env.CRON_SECRET;
      if (
        !secret ||
        req.headers.get("authorization") !== `Bearer ${secret}`
      ) {
        if (!session?.user?.id) throw new NoAutenticado();
        throw new NoAutorizado(
          "Solo administradores o Bearer CRON_SECRET pueden rechazar picks.",
        );
      }
      adminUserId = "cron";
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido.", {
        issues: parsed.error.flatten(),
      });
    }

    const pick = await prisma.pickPremium.findUnique({
      where: { id: params.id },
    });
    if (!pick) {
      throw new ValidacionFallida("Pick no encontrado", { pickId: params.id });
    }
    if (pick.estado === "RECHAZADO") {
      return Response.json({ ok: true, pickId: pick.id, idempotent: true });
    }
    if (pick.aprobado) {
      throw new ValidacionFallida(
        "El pick ya fue aprobado y enviado. No se puede rechazar.",
      );
    }

    await prisma.pickPremium.update({
      where: { id: pick.id },
      data: {
        estado: "RECHAZADO",
        rechazadoMotivo: parsed.data.motivo,
        aprobadoPor: adminUserId ?? "admin",
      },
    });

    void track({
      evento: "pick_premium_rechazado",
      userId: adminUserId !== "cron" ? adminUserId : undefined,
      props: { pickId: pick.id, motivo: parsed.data.motivo.slice(0, 100) },
    });
    await logAuditoria({
      actorId: adminUserId !== "cron" ? adminUserId ?? null : null,
      actorEmail: session?.user?.email ?? null,
      accion: "pick.rechazar",
      entidad: "PickPremium",
      entidadId: pick.id,
      resumen: `Pick ${pick.id} rechazado: ${parsed.data.motivo.slice(0, 80)}`,
      metadata: { partidoId: pick.partidoId, motivo: parsed.data.motivo },
    });

    return Response.json({ ok: true, pickId: pick.id });
  } catch (err) {
    logger.error(
      { err, source: "api:admin-picks-premium-rechazar" },
      "POST /api/v1/admin/picks-premium/[id]/rechazar falló",
    );
    return toErrorResponse(err);
  }
}
