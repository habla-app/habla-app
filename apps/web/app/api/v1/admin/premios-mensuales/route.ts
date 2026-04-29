// GET /api/v1/admin/premios-mensuales — Lote 5.
//
// Lista premios mensuales con filtros opcionales (?estado=, ?mes=).
// Auth: sesión ADMIN.

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  esEstadoValido,
  listarPremios,
  type EstadoPremio,
} from "@/lib/services/leaderboard.service";
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
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado("Solo administradores.");
    }

    const sp = req.nextUrl.searchParams;
    const estadoRaw = sp.get("estado");
    const mes = sp.get("mes") ?? undefined;
    const estado: EstadoPremio | undefined =
      estadoRaw && esEstadoValido(estadoRaw) ? estadoRaw : undefined;

    const premios = await listarPremios({ estado, mes: mes ?? undefined });
    return Response.json({ data: { premios } });
  } catch (err) {
    logger.error({ err }, "GET /api/v1/admin/premios-mensuales falló");
    return toErrorResponse(err);
  }
}
