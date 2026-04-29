// POST /api/v1/admin/partidos/[id]/descartar — Lote 5.1.
//
// Saca un partido del pool de "disponibles para crear torneo" creando un
// torneo placeholder CANCELADO sobre él. Persiste contra el auto-import
// (que skipea partidos con torneo existente).

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { descartarPartidoParaTorneo } from "@/lib/services/partidos.service";
import {
  DomainError,
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado("Solo administradores.");
    }

    try {
      await descartarPartidoParaTorneo(params.id);
    } catch (err) {
      if (err instanceof Error && /torneo activo/i.test(err.message)) {
        throw new DomainError("PARTIDO_CON_TORNEO_ACTIVO", err.message, 409);
      }
      throw err;
    }

    logger.info({ partidoId: params.id }, "partido descartado del pool");
    return Response.json({ data: { ok: true } });
  } catch (err) {
    logger.error(
      { err, partidoId: params.id },
      "POST /api/v1/admin/partidos/[id]/descartar falló",
    );
    return toErrorResponse(err);
  }
}
