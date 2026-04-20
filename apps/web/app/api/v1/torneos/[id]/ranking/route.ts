// GET /api/v1/torneos/:id/ranking?page=&limit=
//
// Público. Si hay sesión, incluye miPosicion en el payload. Sub-Sprint 5.
//
// Hotfix #6 Ítem 3: también devuelve `minutoLabel` + `minutoPartido`
// leídos del cache `live-partido-status` para que el polling de
// fallback del hook `useRankingEnVivo` pueda mantener fresco el minuto
// aunque el WS se caiga.

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import { listarRanking } from "@/lib/services/ranking.service";
import { getLiveStatus } from "@/lib/services/live-partido-status.cache";
import { toErrorResponse, ValidacionFallida } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

interface Context {
  params: { id: string };
}

const QuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(50),
});

export async function GET(req: NextRequest, { params }: Context) {
  try {
    const session = await auth();
    const q = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = QuerySchema.safeParse(q);
    if (!parsed.success) {
      throw new ValidacionFallida("Parámetros inválidos.", {
        issues: parsed.error.flatten(),
      });
    }
    const data = await listarRanking(params.id, {
      page: parsed.data.page,
      limit: parsed.data.limit,
      usuarioId: session?.user?.id,
    });

    // Hotfix #6 Ítem 3: adjunta el minuto del partido desde el cache
    // para que el fallback REST del hook useRankingEnVivo pueda
    // mantener fresco el LiveHero sin un request extra.
    const torneo = await prisma.torneo.findUnique({
      where: { id: params.id },
      select: { partidoId: true },
    });
    const liveSnap = torneo ? getLiveStatus(torneo.partidoId) : null;

    const now = Date.now();
    return Response.json({
      data: {
        ...data,
        minutoLabel: liveSnap?.label ?? null,
        minutoPartido: liveSnap?.minuto ?? null,
        // Hotfix #8 Bug #22 + Ítem 4: statusShort + elapsedAgeMs para
        // que el cliente ancle el reloj local al tiempo REAL en que el
        // server capturó el `elapsed` (no al momento del mount). Evita
        // que el hero muestre el minuto desfasado los primeros segundos
        // cada vez que se abre la pestaña cuando el cache tiene un
        // snapshot de hace varios minutos.
        statusShort: liveSnap?.statusShort ?? null,
        elapsedAgeMs: liveSnap ? now - liveSnap.updatedAt : null,
      },
    });
  } catch (err) {
    logger.error(
      { err, torneoId: params.id },
      "GET /api/v1/torneos/:id/ranking falló",
    );
    return toErrorResponse(err);
  }
}
