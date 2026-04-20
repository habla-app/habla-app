// POST /api/v1/usuarios/verificacion/dni — Sub-Sprint 7.
// Sube imagen del DNI (base64) + número. Estado PENDIENTE hasta revisión admin.

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  obtenerEstadoDni,
  subirDni,
} from "@/lib/services/verificacion.service";
import {
  NoAutenticado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  dniNumero: z.string().regex(/^[0-9]{8}$/, "DNI de 8 dígitos"),
  imagenBase64: z.string().min(100), // data:image/jpeg;base64,... o base64 crudo
  mimeType: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();

    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida("Datos inválidos.", {
        issues: parsed.error.flatten(),
      });
    }

    const result = await subirDni(session.user.id, parsed.data);
    return Response.json({ data: result }, { status: 201 });
  } catch (err) {
    logger.error({ err }, "POST /usuarios/verificacion/dni falló");
    return toErrorResponse(err);
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    const result = await obtenerEstadoDni(session.user.id);
    return Response.json({ data: result });
  } catch (err) {
    logger.error({ err }, "GET /usuarios/verificacion/dni falló");
    return toErrorResponse(err);
  }
}
