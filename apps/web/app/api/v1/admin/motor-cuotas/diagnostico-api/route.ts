// POST /api/v1/admin/motor-cuotas/diagnostico-api — Lote V.11.
//
// Endpoint para invocar manualmente cualquier scraper API contra una
// liga × partido específico, sin pasar por la cola BullMQ. Devuelve
// telemetría rica para debug:
//   - URL llamada + httpStatus + ms.
//   - cuotas extraídas por mercado.
//   - advertencias del parser (mercado X no encontrado, etc.).
//   - eventIdCasa descubierto.
//
// Uso típico: cuando un parser tiene bug en producción (ej. Coolbet
// devuelve estado ERROR en el cron 5am), se invoca este endpoint con
// la casa específica para ver el response real y ajustar el parser.
//
// Auth: ADMIN o Bearer CRON_SECRET.

import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import {
  NoAutenticado,
  NoAutorizado,
  ValidacionFallida,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import { CASAS_CUOTAS } from "@/lib/services/scrapers/types";
import { obtenerScraper } from "@/lib/services/cuotas-worker";
import {
  detectarLigaCanonica,
  LIGAS_CANONICAS,
} from "@/lib/services/scrapers/ligas-id-map";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

const BodySchema = z
  .object({
    casa: z.enum(CASAS_CUOTAS),
    /** ID de un Partido en la BD productiva. Usado para resolver liga + equipos. */
    partidoId: z.string().optional(),
    /** Override manual de liga (si no hay partidoId). */
    ligaCanonica: z.enum(LIGAS_CANONICAS).optional(),
    /** Override manual de equipos (si no hay partidoId). */
    equipoLocal: z.string().min(2).max(80).optional(),
    equipoVisita: z.string().min(2).max(80).optional(),
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
          "Solo administradores pueden invocar el diagnóstico.",
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

    // Resolver partido. Si vino partidoId, lo leemos de BD. Sino,
    // construimos un partido sintético con los overrides manuales.
    let partido: {
      id: string;
      liga: string;
      equipoLocal: string;
      equipoVisita: string;
      fechaInicio: Date;
    };
    if (body.partidoId) {
      const p = await prisma.partido.findUnique({
        where: { id: body.partidoId },
      });
      if (!p) {
        throw new ValidacionFallida(
          `Partido ${body.partidoId} no existe.`,
        );
      }
      partido = p;
    } else {
      if (!body.ligaCanonica || !body.equipoLocal || !body.equipoVisita) {
        throw new ValidacionFallida(
          "Sin partidoId, hay que mandar ligaCanonica + equipoLocal + equipoVisita.",
        );
      }
      partido = {
        id: "synthetic",
        liga: body.ligaCanonica,
        equipoLocal: body.equipoLocal,
        equipoVisita: body.equipoVisita,
        fechaInicio: new Date(),
      };
    }

    // Resolver liga canónica.
    const ligaCanonica =
      body.ligaCanonica ?? detectarLigaCanonica(partido.liga);
    if (!ligaCanonica) {
      return Response.json({
        ok: false,
        casa: body.casa,
        error: `liga "${partido.liga}" no se pudo mapear a canónica`,
        partido: {
          id: partido.id,
          liga: partido.liga,
          equipos: [partido.equipoLocal, partido.equipoVisita],
        },
      });
    }

    const scraper = obtenerScraper(body.casa);
    if (!scraper) {
      return Response.json({
        ok: false,
        casa: body.casa,
        error: `scraper "${body.casa}" no registrado en el dispatcher`,
      });
    }

    logger.info(
      {
        casa: body.casa,
        ligaCanonica,
        partidoId: partido.id,
        source: "api:diagnostico-api",
      },
      `diagnostico-api: invocando ${body.casa} para liga ${ligaCanonica}`,
    );

    const tInicio = Date.now();
    let resultado:
      | Awaited<ReturnType<typeof scraper.capturarConPlaywright>>
      | null = null;
    let errorMsg: string | null = null;
    try {
      resultado = await scraper.capturarConPlaywright(
        partido as Parameters<typeof scraper.capturarConPlaywright>[0],
        ligaCanonica,
      );
    } catch (err) {
      errorMsg = (err as Error).message;
    }
    const ms = Date.now() - tInicio;

    return Response.json({
      ok: !errorMsg,
      casa: body.casa,
      ligaCanonica,
      partido: {
        id: partido.id,
        liga: partido.liga,
        equipoLocal: partido.equipoLocal,
        equipoVisita: partido.equipoVisita,
      },
      ms,
      error: errorMsg,
      resultado,
    });
  } catch (err) {
    logger.error(
      { err, source: "api:diagnostico-api" },
      "POST /api/v1/admin/motor-cuotas/diagnostico-api falló",
    );
    return toErrorResponse(err);
  }
}
