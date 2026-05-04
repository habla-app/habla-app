// POST /api/v1/admin/motor-cuotas/scrapers/[casa]/reactivar — Lote V fase V.5.
// Spec: docs/plan-tecnico-lote-v-motor-cuotas.md § 9.5.
//
// Quita el estado BLOQUEADO de un scraper, reseteando diasConsecutivosError
// a 0 y volviendo a estado SANO. Pensado para cuando el admin sabe que la
// casa volvió a operar (ej. fix de subdominio rotado, ajuste de IP, etc).
//
// Auth ADMIN. Auditoría 100%.

import { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import { logAuditoria } from "@/lib/services/auditoria.service";
import {
  CASAS_CUOTAS,
  esCasaCuotasValida,
} from "@/lib/services/scrapers/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  _req: NextRequest,
  { params }: { params: { casa: string } },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado(
        "Solo administradores pueden reactivar scrapers.",
      );
    }

    const casa = params.casa;
    if (!esCasaCuotasValida(casa)) {
      throw new ValidacionFallida(
        `Casa inválida: "${casa}". Valores válidos: ${CASAS_CUOTAS.join(", ")}.`,
      );
    }

    const previo = await prisma.saludScraper.findUnique({ where: { casa } });

    await prisma.saludScraper.upsert({
      where: { casa },
      create: {
        casa,
        estado: "SANO",
        diasConsecutivosError: 0,
        detalleError: null,
      },
      update: {
        estado: "SANO",
        diasConsecutivosError: 0,
        detalleError: null,
      },
    });

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: "scraper.reactivar",
      entidad: "SaludScraper",
      entidadId: casa,
      resumen: `Scraper ${casa} reactivado (estado anterior: ${previo?.estado ?? "—"})`,
      metadata: {
        casa,
        estadoAnterior: previo?.estado ?? null,
        diasConsecutivosErrorAnterior: previo?.diasConsecutivosError ?? null,
      },
    });

    return Response.json({ ok: true, casa, estado: "SANO" });
  } catch (err) {
    logger.error(
      { err, casa: params.casa, source: "api:admin-motor-cuotas-reactivar" },
      "POST /api/v1/admin/motor-cuotas/scrapers/[casa]/reactivar falló",
    );
    return toErrorResponse(err);
  }
}
