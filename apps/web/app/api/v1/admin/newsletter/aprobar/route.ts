// POST /api/v1/admin/newsletter/aprobar — Lote 10.
//
// Aprueba el digest de la semana y dispara el envío. Idempotente: si ya
// fue enviado, retorna 200 con `enviados:0`.
//
// Auth: sesión ADMIN o Bearer CRON_SECRET (mismo patrón que
// /api/v1/admin/leaderboard/cerrar y /api/v1/admin/odds/refresh).
//
// Body: { semana?: string }. Si `semana` se omite, usa la semana actual.

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  aprobarYEnviarDigest,
  getSemanaIsoKey,
} from "@/lib/services/newsletter.service";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import { logAuditoria } from "@/lib/services/auditoria.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; /* envíos en lotes de 50 — puede tardar */

const BodySchema = z
  .object({
    semana: z
      .string()
      .regex(/^\d{4}-W\d{2}$/, "semana debe ser formato YYYY-WW")
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
          "Solo administradores o Bearer CRON_SECRET pueden aprobar el digest.",
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

    const semana = parsed.data.semana ?? getSemanaIsoKey();
    const aprobadoPor = session?.user?.email ?? "cron-secret";
    const result = await aprobarYEnviarDigest({ semana, aprobadoPor });

    // Auditoría 100% — regla 21 del CLAUDE.md
    await logAuditoria({
      actorId: session?.user?.id ?? null,
      actorEmail: session?.user?.email ?? null,
      accion: "newsletter.aprobar_y_enviar",
      entidad: "DigestEnviado",
      entidadId: semana,
      resumen: `Digest semana ${semana} aprobado y enviado`,
      metadata: { ...result },
    });

    logger.info(result, "POST /api/v1/admin/newsletter/aprobar");
    return Response.json({ data: result });
  } catch (err) {
    logger.error(
      { err, source: "api:admin-newsletter-aprobar" },
      "POST /api/v1/admin/newsletter/aprobar falló",
    );
    return toErrorResponse(err);
  }
}
