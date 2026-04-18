// POST /api/v1/admin/partidos/importar
//
// Requiere rol ADMIN. Body: { fecha: "YYYY-MM-DD" }. Dispara el fetch a
// api-football y upsertea los partidos del día.

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { importarDeApiFootball } from "@/lib/services/partidos.service";
import { ImportarPartidosBodySchema } from "@/lib/services/torneos.schema";
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
      throw new NoAutorizado("Solo administradores pueden importar partidos.");
    }

    const body = await req.json().catch(() => ({}));
    const parsed = ImportarPartidosBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida(
        "Body inválido para importar partidos.",
        { issues: parsed.error.flatten() },
      );
    }

    const result = await importarDeApiFootball(parsed.data.fecha);
    return Response.json({ data: result });
  } catch (err) {
    logger.error({ err }, "POST /api/v1/admin/partidos/importar falló");
    return toErrorResponse(err);
  }
}
