// POST /api/v1/admin/prototipo-cuotas-api
//
// Endpoint admin temporal para validar el approach HTTP-API directo (sin
// Playwright) sobre proveedores B2B de sportsbook que exponen JSON
// público con CORS abierto.
//
// Hoy: solo Doradobet (Altenar B2B). Si se confirma que funciona desde
// Railway US, abre la puerta a una arquitectura sin agente local para
// las casas que tengan API similar.
//
// Auth: ADMIN o Bearer CRON_SECRET.

import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import {
  NoAutenticado,
  NoAutorizado,
  ValidacionFallida,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import {
  fetchCuotasDoradobet,
  CHAMP_ID_LIGA_1_PERU,
} from "@/lib/services/scrapers/prototipo/doradobet-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const BodySchema = z
  .object({
    casa: z.enum(["doradobet"]),
    /** champId de la liga en el sistema de Altenar. Default: 4042 (Liga 1 Perú). */
    champId: z.number().int().positive().optional(),
  })
  .strict();

export async function POST(req: NextRequest): Promise<Response> {
  try {
    let esAutorizado = false;
    const authHeader = req.headers.get("authorization");
    if (
      authHeader?.startsWith("Bearer ") &&
      process.env.CRON_SECRET &&
      authHeader.slice(7) === process.env.CRON_SECRET
    ) {
      esAutorizado = true;
    }
    if (!esAutorizado) {
      const session = await auth();
      if (!session?.user?.id) throw new NoAutenticado();
      if (session.user.rol !== "ADMIN") {
        throw new NoAutorizado(
          "Solo administradores pueden invocar el prototipo.",
        );
      }
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido.", {
        issues: parsed.error.flatten(),
      });
    }
    const body = parsed.data;

    const champId = body.champId ?? CHAMP_ID_LIGA_1_PERU;

    logger.info(
      { ...body, champId, source: "api:prototipo-cuotas-api" },
      `prototipo-cuotas-api: invocado para ${body.casa} champId=${champId}`,
    );

    const resultado = await fetchCuotasDoradobet(champId);

    return Response.json(resultado);
  } catch (err) {
    logger.error(
      { err, source: "api:prototipo-cuotas-api" },
      "POST /api/v1/admin/prototipo-cuotas-api falló",
    );
    return toErrorResponse(err);
  }
}
