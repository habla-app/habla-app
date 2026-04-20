// POST /api/v1/usuarios/me/eliminar/confirmar — Sub-Sprint 7.
// Consume el token + ejecuta soft delete.

import { NextRequest } from "next/server";
import { z } from "zod";
import { confirmarEliminarCuenta } from "@/lib/services/usuarios.service";
import {
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

const BodySchema = z.object({
  token: z.string().min(32).max(128),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida("Token inválido.", {
        issues: parsed.error.flatten(),
      });
    }

    const result = await confirmarEliminarCuenta(parsed.data.token);
    return Response.json({ data: result });
  } catch (err) {
    logger.error({ err }, "POST /usuarios/me/eliminar/confirmar falló");
    return toErrorResponse(err);
  }
}
