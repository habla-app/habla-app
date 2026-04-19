// GET /api/v1/partidos/:id/eventos
//
// Público. Devuelve la lista cronológica de eventos de un partido.
// Sub-Sprint 5.

import { prisma } from "@habla/db";
import { toErrorResponse, PartidoNoEncontrado } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

interface Context {
  params: { id: string };
}

export async function GET(_req: Request, { params }: Context) {
  try {
    const partido = await prisma.partido.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!partido) throw new PartidoNoEncontrado(params.id);

    const eventos = await prisma.eventoPartido.findMany({
      where: { partidoId: params.id },
      orderBy: [{ minuto: "asc" }, { creadoEn: "asc" }],
    });

    return Response.json({ data: { eventos } });
  } catch (err) {
    logger.error(
      { err, partidoId: params.id },
      "GET /api/v1/partidos/:id/eventos falló",
    );
    return toErrorResponse(err);
  }
}
