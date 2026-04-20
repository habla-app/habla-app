// GET /api/v1/canjes/mis-canjes — Sub-Sprint 6.
// Requiere sesión. Devuelve los canjes del usuario con datos del premio.

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { listarMisCanjes } from "@/lib/services/canjes.service";
import {
  NoAutenticado,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();

    const { searchParams } = new URL(req.url);
    const estado = searchParams.get("estado") as
      | "PENDIENTE"
      | "PROCESANDO"
      | "ENVIADO"
      | "ENTREGADO"
      | "CANCELADO"
      | null;

    const result = await listarMisCanjes(session.user.id, {
      estado: estado ?? undefined,
      limit: Number(searchParams.get("limit") ?? 20),
      offset: Number(searchParams.get("offset") ?? 0),
    });

    return Response.json({ data: result });
  } catch (err) {
    logger.error({ err }, "GET /canjes/mis-canjes falló");
    return toErrorResponse(err);
  }
}
