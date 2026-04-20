// POST /api/v1/usuarios/limites/autoexclusion — Sub-Sprint 7.
// Activa auto-exclusión temporal (7/30/90 días).

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  activarAutoExclusion,
  type DiasAutoExclusion,
} from "@/lib/services/limites.service";
import {
  NoAutenticado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

const BodySchema = z.object({
  dias: z.union([z.literal(7), z.literal(30), z.literal(90)]),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();

    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida("Duración inválida (7, 30 o 90 días).", {
        issues: parsed.error.flatten(),
      });
    }

    const data = await activarAutoExclusion(
      session.user.id,
      parsed.data.dias as DiasAutoExclusion,
    );
    return Response.json({ data });
  } catch (err) {
    logger.error({ err }, "POST /limites/autoexclusion falló");
    return toErrorResponse(err);
  }
}
