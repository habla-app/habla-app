// GET/PATCH /api/v1/usuarios/me — Sub-Sprint 7.

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  actualizarPerfil,
  obtenerMiPerfil,
} from "@/lib/services/usuarios.service";
import {
  NoAutenticado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  nombre: z.string().min(2).max(100).optional(),
  username: z.string().min(3).max(20).optional(),
  ubicacion: z.string().max(80).optional(),
  telefono: z.string().max(20).optional(),
  image: z.string().url().optional(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    const data = await obtenerMiPerfil(session.user.id);
    return Response.json({ data });
  } catch (err) {
    logger.error({ err }, "GET /usuarios/me falló");
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

    const data = await actualizarPerfil(session.user.id, parsed.data);
    return Response.json({ data });
  } catch (err) {
    logger.error({ err }, "PATCH /usuarios/me falló");
    return toErrorResponse(err);
  }
}
