// POST /api/v1/admin/partidos/[id]/cuotas/discovery — Lote V fase V.6.
// Spec: docs/plan-tecnico-lote-v-motor-cuotas.md § 5.1 (discovery automático).
//
// Fuerza discovery manual sobre las 7 casas para un partido. Usado desde
// la vista admin /admin/partidos/[id] cuando:
//   - El primer discovery falló o quedó incompleto.
//   - La tabla AliasEquipo se enriqueció después del primer intento.
//   - Una casa publicó el partido tarde (no estaba al activar Filtro 1).
//
// Body (opcional):
//   { forzarRedescubrimiento?: boolean }  // default false
//
// Si `forzarRedescubrimiento=true`, también re-ejecuta scrapers para casas
// que ya tienen AUTOMATICO previo (pisa el eventId si encuentra otro). Las
// filas con `metodoDiscovery="MANUAL"` se respetan SIEMPRE, sin importar
// el flag.
//
// Auth ADMIN (regla 11). Auditoría 100% (regla 21).

import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import {
  NoAutenticado,
  NoAutorizado,
  PartidoNoEncontrado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import { logAuditoria } from "@/lib/services/auditoria.service";
import { ejecutarDiscoveryParaPartido } from "@/lib/services/discovery-cuotas.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z
  .object({
    forzarRedescubrimiento: z.boolean().optional(),
  })
  .strict()
  .optional();

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado(
        "Solo administradores pueden re-ejecutar discovery de cuotas.",
      );
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido.", {
        issues: parsed.error.flatten(),
      });
    }
    const body = parsed.data ?? {};
    const forzar = body.forzarRedescubrimiento === true;

    const partido = await prisma.partido.findUnique({
      where: { id: params.id },
      select: { id: true, equipoLocal: true, equipoVisita: true },
    });
    if (!partido) throw new PartidoNoEncontrado(params.id);

    const resumen = await ejecutarDiscoveryParaPartido(partido.id, {
      forzarRedescubrimiento: forzar,
    });

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: "partido.cuotas_discovery_manual",
      entidad: "Partido",
      entidadId: partido.id,
      resumen: `Discovery automático manual sobre ${partido.equipoLocal} vs ${partido.equipoVisita}${forzar ? " (forzado)" : ""}`,
      metadata: {
        forzarRedescubrimiento: forzar,
        resueltas: resumen.resueltas.map((r) => r.casa),
        sinResolver: resumen.sinResolver,
        fallidas: resumen.fallidas.map((f) => f.casa),
        skipeadasPorManual: resumen.skipeadasPorManual,
        skipeadasPorAutomaticoPrevio: resumen.skipeadasPorAutomaticoPrevio,
      },
    });

    return Response.json({
      ok: true,
      partidoId: partido.id,
      resueltas: resumen.resueltas,
      sinResolver: resumen.sinResolver,
      fallidas: resumen.fallidas,
      skipeadasPorManual: resumen.skipeadasPorManual,
      skipeadasPorAutomaticoPrevio: resumen.skipeadasPorAutomaticoPrevio,
    });
  } catch (err) {
    logger.error(
      { err, partidoId: params.id, source: "api:admin-partidos-cuotas-discovery" },
      "POST /api/v1/admin/partidos/[id]/cuotas/discovery falló",
    );
    return toErrorResponse(err);
  }
}
