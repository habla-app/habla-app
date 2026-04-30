// POST /api/v1/admin/mincetur/verificar — Lote 10.
//
// Dispara la verificación MINCETUR a demanda. Casos de uso:
//   - Smoke post-deploy: confirmar que el cron K funciona sin esperar al
//     próximo lunes.
//   - Forzar re-verificación tras agregar un afiliado nuevo o resolver un
//     `verificacionPendiente=true`.
//
// Auth: sesión ADMIN o Bearer CRON_SECRET.
//
// Body: { slug?: string } — si se pasa `slug`, verifica sólo ese
// afiliado (usa cache de scrape de la corrida). Si se omite, corre la
// verificación masiva.

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  verificarCasa,
  verificarTodasActivas,
} from "@/lib/services/mincetur-check.service";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Verificar todas con throttle 5s puede tardar varios minutos.
export const maxDuration = 600;

const BodySchema = z
  .object({
    slug: z
      .string()
      .min(2)
      .max(60)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const isAdmin = session?.user?.id && session.user.rol === "ADMIN";
    if (!isAdmin) {
      const secret = process.env.CRON_SECRET;
      if (
        !secret ||
        req.headers.get("authorization") !== `Bearer ${secret}`
      ) {
        if (!session?.user?.id) throw new NoAutenticado();
        throw new NoAutorizado(
          "Solo administradores o Bearer CRON_SECRET pueden disparar la verificación MINCETUR.",
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

    if (parsed.data.slug) {
      const r = await verificarCasa(parsed.data.slug);
      logger.info(
        { slug: parsed.data.slug, estado: r.estado, source: "mincetur-check:admin" },
        "POST /api/v1/admin/mincetur/verificar — slug",
      );
      return Response.json({ data: r });
    }

    const r = await verificarTodasActivas();
    logger.info(
      {
        total: r.total,
        ok: r.ok,
        perdio: r.perdio,
        indeterminado: r.indeterminado,
        source: "mincetur-check:admin",
      },
      "POST /api/v1/admin/mincetur/verificar — todas",
    );
    return Response.json({ data: r });
  } catch (err) {
    logger.error(
      { err, source: "api:admin-mincetur-verificar" },
      "POST /api/v1/admin/mincetur/verificar falló",
    );
    return toErrorResponse(err);
  }
}
