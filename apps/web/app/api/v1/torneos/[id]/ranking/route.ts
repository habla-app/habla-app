// GET /api/v1/torneos/:id/ranking?page=&limit=
//
// Público. Si hay sesión, incluye miPosicion en el payload. Sub-Sprint 5.

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { listarRanking } from "@/lib/services/ranking.service";
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
    return Response.json({ data });
  } catch (err) {
    logger.error(
      { err, torneoId: params.id },
      "GET /api/v1/torneos/:id/ranking falló",
    );
    return toErrorResponse(err);
  }
}
