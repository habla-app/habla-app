// GET /api/v1/admin/motor-cuotas/alertas — Lote V fase V.5.
// Spec: docs/plan-tecnico-lote-v-motor-cuotas.md § 9.5.
//
// Lista alertas paginadas filtrables por vista/no vista. Auth ADMIN.

import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const QuerySchema = z.object({
  partidoId: z.string().optional(),
  soloNoVistas: z.enum(["1", "true", "0", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado(
        "Solo administradores pueden ver alertas de cuotas.",
      );
    }

    const url = new URL(req.url);
    const parsed = QuerySchema.parse({
      partidoId: url.searchParams.get("partidoId") ?? undefined,
      soloNoVistas: url.searchParams.get("soloNoVistas") ?? undefined,
      page: url.searchParams.get("page") ?? "1",
      pageSize: url.searchParams.get("pageSize") ?? "50",
    });

    const soloNoVistas =
      parsed.soloNoVistas === "1" || parsed.soloNoVistas === "true";

    const where = {
      ...(parsed.partidoId ? { partidoId: parsed.partidoId } : {}),
      ...(soloNoVistas ? { vistaPorAdmin: false } : {}),
    } as const;

    const [total, filas] = await prisma.$transaction([
      prisma.alertaCuota.count({ where }),
      prisma.alertaCuota.findMany({
        where,
        orderBy: { detectadoEn: "desc" },
        skip: (parsed.page - 1) * parsed.pageSize,
        take: parsed.pageSize,
      }),
    ]);

    return Response.json({
      page: parsed.page,
      pageSize: parsed.pageSize,
      total,
      filas: filas.map((f) => ({
        id: f.id,
        partidoId: f.partidoId,
        casa: f.casa,
        mercado: f.mercado,
        seleccion: f.seleccion,
        cuotaAnterior: f.cuotaAnterior.toNumber(),
        cuotaNueva: f.cuotaNueva.toNumber(),
        variacionPct: f.variacionPct.toNumber(),
        vistaPorAdmin: f.vistaPorAdmin,
        detectadoEn: f.detectadoEn.toISOString(),
      })),
    });
  } catch (err) {
    logger.error(
      { err, source: "api:admin-motor-cuotas-alertas" },
      "GET /api/v1/admin/motor-cuotas/alertas falló",
    );
    return toErrorResponse(err);
  }
}
