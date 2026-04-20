// POST /api/v1/usuarios/verificacion/telefono/confirmar — Sub-Sprint 7.

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { confirmarCodigoTelefono } from "@/lib/services/verificacion.service";
import {
  NoAutenticado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

const BodySchema = z.object({
  codigo: z.string().regex(/^[0-9]{6}$/, "6 dígitos"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();

    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida("Código inválido.", {
        issues: parsed.error.flatten(),
      });
    }

    const result = await confirmarCodigoTelefono(
      session.user.id,
      parsed.data.codigo,
    );
    return Response.json({ data: result });
  } catch (err) {
    logger.error({ err }, "POST /usuarios/verificacion/telefono/confirmar falló");
    return toErrorResponse(err);
  }
}
