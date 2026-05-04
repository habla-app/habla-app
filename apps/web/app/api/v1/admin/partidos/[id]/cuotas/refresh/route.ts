// POST /api/v1/admin/partidos/[id]/cuotas/refresh — Lote V fase V.5.
// Spec: docs/plan-tecnico-lote-v-motor-cuotas.md § 9.5.
//
// Encola los 7 scrapers para UN partido específico. Para cada casa con
// EventIdExterno resuelto: encola job con esRefresh=true. Las casas sin
// event ID se reportan en la respuesta como "pendientes" para que el admin
// las vincule manualmente.
//
// Auth ADMIN (regla 11). Auditoría 100% (regla 21).

import { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import {
  NoAutenticado,
  NoAutorizado,
  PartidoNoEncontrado,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import { logAuditoria } from "@/lib/services/auditoria.service";
import { encolarRefresh } from "@/lib/services/captura-cuotas.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado(
        "Solo administradores pueden forzar refresh de cuotas.",
      );
    }

    const partido = await prisma.partido.findUnique({
      where: { id: params.id },
      select: { id: true, equipoLocal: true, equipoVisita: true },
    });
    if (!partido) throw new PartidoNoEncontrado(params.id);

    const resumen = await encolarRefresh(partido.id);

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: "partido.cuotas_refresh",
      entidad: "Partido",
      entidadId: partido.id,
      resumen: `Refresh manual de cuotas (todas las casas) sobre ${partido.equipoLocal} vs ${partido.equipoVisita}`,
      metadata: {
        casasEncoladas: resumen.casasEncoladas,
        casasSkipeadas: resumen.casasSkipeadas,
        casasSinEventId: resumen.casasSinEventId,
      },
    });

    return Response.json({ ok: true, ...resumen });
  } catch (err) {
    logger.error(
      { err, partidoId: params.id, source: "api:admin-partidos-cuotas-refresh" },
      "POST /api/v1/admin/partidos/[id]/cuotas/refresh falló",
    );
    return toErrorResponse(err);
  }
}
