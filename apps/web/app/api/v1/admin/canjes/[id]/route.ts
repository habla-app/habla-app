// PATCH /api/v1/admin/canjes/:id — Sub-Sprint 6.
// Admin-only. Transiciona el estado de un canje.
// Máquina de estados en canjes.service:
//   PENDIENTE → PROCESANDO → ENVIADO → ENTREGADO
//   [cualquiera excepto ENTREGADO] → CANCELADO (con reembolso automático)

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { actualizarEstadoAdmin } from "@/lib/services/canjes.service";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

const BodySchema = z.object({
  estado: z.enum([
    "PENDIENTE",
    "PROCESANDO",
    "ENVIADO",
    "ENTREGADO",
    "CANCELADO",
  ]),
  metodo: z.string().max(120).optional(),
  codigoSeguimiento: z.string().max(80).optional(),
  motivoCancelacion: z.string().max(200).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") throw new NoAutorizado();

    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida("Datos inválidos.", {
        issues: parsed.error.flatten(),
      });
    }

    const result = await actualizarEstadoAdmin(params.id, parsed.data);
    return Response.json({ data: result });
  } catch (err) {
    logger.error({ err, canjeId: params.id }, "PATCH /admin/canjes/:id falló");
    return toErrorResponse(err);
  }
}
