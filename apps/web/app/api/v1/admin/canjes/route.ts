// GET /api/v1/admin/canjes — Sub-Sprint 6.
// Admin-only. Listado de canjes con filtro por estado.

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { listarCanjesAdmin } from "@/lib/services/canjes.service";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") throw new NoAutorizado();

    const { searchParams } = new URL(req.url);
    const estado = searchParams.get("estado") as
      | "PENDIENTE"
      | "PROCESANDO"
      | "ENVIADO"
      | "ENTREGADO"
      | "CANCELADO"
      | null;

    const result = await listarCanjesAdmin({
      estado: estado ?? undefined,
      limit: Number(searchParams.get("limit") ?? 50),
      offset: Number(searchParams.get("offset") ?? 0),
    });

    return Response.json({ data: result });
  } catch (err) {
    logger.error({ err }, "GET /admin/canjes falló");
    return toErrorResponse(err);
  }
}
