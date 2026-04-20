// POST /api/v1/usuarios/me/datos-download — Sub-Sprint 7.
// Solicita export de datos. Envía email con link a la descarga.

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { solicitarExportDatos } from "@/lib/services/usuarios.service";
import { NoAutenticado, toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();

    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host =
      req.headers.get("host") ?? req.headers.get("x-forwarded-host") ?? "";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`;

    const result = await solicitarExportDatos(session.user.id, baseUrl);
    return Response.json({ data: result });
  } catch (err) {
    logger.error({ err }, "POST /usuarios/me/datos-download falló");
    return toErrorResponse(err);
  }
}
