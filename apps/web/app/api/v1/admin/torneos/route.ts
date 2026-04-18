// POST /api/v1/admin/torneos
//
// Requiere rol ADMIN. Crea un torneo sobre un partido PROGRAMADO. cierreAt
// se calcula automáticamente = partido.fechaInicio - 5 min.

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { crear } from "@/lib/services/torneos.service";
import { CrearTorneoBodySchema } from "@/lib/services/torneos.schema";
import {
  NoAutenticado,
  NoAutorizado,
  ValidacionFallida,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado("Solo administradores pueden crear torneos.");
    }

    const body = await req.json().catch(() => ({}));
    const parsed = CrearTorneoBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida(
        "Body inválido para crear torneo.",
        { issues: parsed.error.flatten() },
      );
    }

    const torneo = await crear(parsed.data);
    return Response.json({ data: { torneo } }, { status: 201 });
  } catch (err) {
    logger.error({ err }, "POST /api/v1/admin/torneos falló");
    return toErrorResponse(err);
  }
}
