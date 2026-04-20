// GET/PATCH /api/v1/usuarios/notificaciones — Sub-Sprint 7.

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  actualizarPreferencias,
  obtenerPreferencias,
} from "@/lib/services/notificaciones.service";
import {
  NoAutenticado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  notifInicioTorneo: z.boolean().optional(),
  notifResultados: z.boolean().optional(),
  notifPremios: z.boolean().optional(),
  notifSugerencias: z.boolean().optional(),
  notifCierreTorneo: z.boolean().optional(),
  notifPromos: z.boolean().optional(),
  emailSemanal: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    const data = await obtenerPreferencias(session.user.id);
    return Response.json({ data });
  } catch (err) {
    logger.error({ err }, "GET /usuarios/notificaciones falló");
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

    const data = await actualizarPreferencias(session.user.id, parsed.data);
    return Response.json({ data });
  } catch (err) {
    logger.error({ err }, "PATCH /usuarios/notificaciones falló");
    return toErrorResponse(err);
  }
}
