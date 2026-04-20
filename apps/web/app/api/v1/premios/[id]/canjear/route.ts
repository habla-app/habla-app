// POST /api/v1/premios/:id/canjear — Sub-Sprint 6.
//
// Canjea un premio. Requiere sesión. Body: { direccion?: DireccionEnvio }.
// Respuesta: { data: { canje, nuevoBalance } } — el cliente llama
// `useLukasStore.setBalance(nuevoBalance)` para sincronizar (§14).

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { crearCanje } from "@/lib/services/canjes.service";
import {
  NoAutenticado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

const DireccionSchema = z.object({
  nombre: z.string().min(2).max(100),
  telefono: z.string().min(7).max(20),
  direccion: z.string().min(5).max(200),
  ciudad: z.string().min(2).max(80),
  referencia: z.string().max(200).optional(),
});

const BodySchema = z.object({
  direccion: DireccionSchema.optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
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

    const result = await crearCanje(session.user.id, {
      premioId: params.id,
      direccion: parsed.data.direccion,
    });

    return Response.json({ data: result }, { status: 201 });
  } catch (err) {
    logger.error({ err, premioId: params.id }, "POST /premios/:id/canjear falló");
    return toErrorResponse(err);
  }
}
