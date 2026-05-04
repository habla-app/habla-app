// POST /api/v1/admin/prototipo-cuotas
//
// Endpoint admin temporal para iterar sobre el prototipo de scraper
// Playwright especializado por casa (Lote V — fase de validación pre-V.11).
//
// Recibe `{casa, equipoLocal, equipoVisita}`, ejecuta el scraper específico
// (hoy: Stake), devuelve JSON con telemetría rica:
//   - tiempos por etapa (búsqueda en listado, navegación a detalle, extracción)
//   - candidatos vistos en el listado + el elegido
//   - cuotas extraídas por mercado (o `null` si no se extrajo)
//   - muestra de las primeras 30 .wol-odd con todos sus atributos data-*
//   - screenshot del detalle en base64 PNG
//
// Cero contacto con BD/BullMQ — no escribe nada. Solo abre browser, navega,
// extrae, devuelve.
//
// Auth:
//   - Sesión ADMIN, o
//   - Header `Authorization: Bearer ${CRON_SECRET}` (para curl directo).

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
import { ejecutarPrototipoStake } from "@/lib/services/scrapers/prototipo/runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Playwright puede demorar 30-60s entre listado + detalle + extracción.
// Damos 120s de margen.
export const maxDuration = 120;

const BodySchema = z
  .object({
    casa: z.enum(["stake"]),
    equipoLocal: z.string().min(2).max(80),
    equipoVisita: z.string().min(2).max(80),
  })
  .strict();

export async function POST(req: NextRequest): Promise<Response> {
  try {
    // Auth: ADMIN o Bearer CRON_SECRET.
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

    logger.info(
      { ...body, source: "api:prototipo-cuotas" },
      `prototipo-cuotas: invocado para ${body.casa} · ${body.equipoLocal} vs ${body.equipoVisita}`,
    );

    const resultado = await ejecutarPrototipoStake(body);

    return Response.json(resultado);
  } catch (err) {
    logger.error(
      { err, source: "api:prototipo-cuotas" },
      "POST /api/v1/admin/prototipo-cuotas falló",
    );
    return toErrorResponse(err);
  }
}
