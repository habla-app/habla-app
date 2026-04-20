// POST /api/v1/usuarios/verificacion/telefono — solicita código SMS (Sub-Sprint 7).

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { solicitarCodigoTelefono } from "@/lib/services/verificacion.service";
import {
  NoAutenticado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

const BodySchema = z.object({
  telefono: z.string().min(7).max(20),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();

    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida("Teléfono inválido.", {
        issues: parsed.error.flatten(),
      });
    }

    const result = await solicitarCodigoTelefono(
      session.user.id,
      parsed.data.telefono,
    );
    return Response.json({ data: result });
  } catch (err) {
    logger.error({ err }, "POST /usuarios/verificacion/telefono falló");
    return toErrorResponse(err);
  }
}
