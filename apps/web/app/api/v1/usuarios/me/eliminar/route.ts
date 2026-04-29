// POST /api/v1/usuarios/me/eliminar — Sub-Sprint 7.
// Solicita eliminación de cuenta. Envía email con token de confirmación (TTL 48h).

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { solicitarEliminarCuenta } from "@/lib/services/usuarios.service";
import { NoAutenticado, toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();

    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host = req.headers.get("host") ?? req.headers.get("x-forwarded-host") ?? "";
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`;

    const result = await solicitarEliminarCuenta(session.user.id, baseUrl);
    // No revelamos el tokenUrl en la respuesta por seguridad — se envía por email.
    return Response.json({
      data: { ok: true, expiraEn: result.expiraEn },
    });
  } catch (err) {
    logger.error({ err }, "POST /usuarios/me/eliminar falló");
    return toErrorResponse(err);
  }
}
