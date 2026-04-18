// GET /api/v1/torneos/:id
//
// Público. Si hay sesión, incluye el ticket del usuario en el torneo.

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { obtener } from "@/lib/services/torneos.service";
import { toErrorResponse } from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

interface Context {
  params: { id: string };
}

export async function GET(_req: NextRequest, { params }: Context) {
  try {
    const session = await auth();
    const usuarioId = session?.user?.id;
    const data = await obtener(params.id, usuarioId);
    return Response.json({ data });
  } catch (err) {
    logger.error(
      { err, torneoId: params.id },
      "GET /api/v1/torneos/:id falló",
    );
    return toErrorResponse(err);
  }
}
