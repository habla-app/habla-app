// GET/PATCH /api/v1/usuarios/limites — Sub-Sprint 7.

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  actualizarLimites,
  obtenerLimites,
  MAX_LIMITE_MENSUAL_COMPRA,
} from "@/lib/services/limites.service";
import {
  NoAutenticado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

// Plan v6: tope mensual configurable hasta MAX_LIMITE_MENSUAL_COMPRA
// (S/ 1.000). Usuarios viejos pueden tener valores mayores en BD; el
// PATCH solo aplica al payload entrante.
const PatchSchema = z.object({
  limiteMensualCompra: z
    .number()
    .int()
    .min(0)
    .max(MAX_LIMITE_MENSUAL_COMPRA)
    .optional(),
  limiteDiarioTickets: z.number().int().min(0).max(100).optional(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    const data = await obtenerLimites(session.user.id);
    return Response.json({ data });
  } catch (err) {
    logger.error({ err }, "GET /usuarios/limites falló");
    return toErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();

    const body = await req.json().catch(() => ({}));
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida("Datos inválidos.", {
        issues: parsed.error.flatten(),
      });
    }

    const data = await actualizarLimites(session.user.id, parsed.data);
    return Response.json({ data });
  } catch (err) {
    logger.error({ err }, "PATCH /usuarios/limites falló");
    return toErrorResponse(err);
  }
}
