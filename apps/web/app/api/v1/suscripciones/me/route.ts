// GET /api/v1/suscripciones/me — Lote D.
//
// Usado por la vista /premium/exito para hacer polling cada 3s mientras se
// verifica que el webhook OpenPay acreditó el pago. Devuelve la suscripción
// más reciente del usuario (activa o no) o `null`.
//
// Solo expone campos no sensibles que necesita la UI: estado, plan, fecha
// vencimiento. Nunca tokens / IDs OpenPay / datos de tarjeta.

import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import { NoAutenticado, toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();

    const sus = await prisma.suscripcion.findFirst({
      where: { usuarioId: session.user.id },
      orderBy: { iniciada: "desc" },
      select: {
        id: true,
        plan: true,
        estado: true,
        activa: true,
        cancelada: true,
        iniciada: true,
        proximoCobro: true,
        vencimiento: true,
      },
    });

    if (!sus) {
      return Response.json({ data: null });
    }

    return Response.json({
      data: {
        id: sus.id,
        plan: sus.plan,
        estado: sus.estado,
        activa: sus.activa,
        cancelada: sus.cancelada,
        iniciada: sus.iniciada.toISOString(),
        proximoCobro: sus.proximoCobro?.toISOString() ?? null,
        vencimiento: sus.vencimiento?.toISOString() ?? null,
      },
    });
  } catch (err) {
    logger.error({ err, source: "api:suscripciones-me" }, "GET /suscripciones/me falló");
    return toErrorResponse(err);
  }
}
