// POST /api/v1/admin/partidos/[id]/regenerar-analisis — Lote L v3.2.
// Spec: docs/plan-trabajo-claude-code-v3.2.md § Lote L #6.
//
// Fuerza una regeneración del AnalisisPartido, ignorando la idempotencia
// "ya-aprobado" del generador. La regeneración degrada el estado a
// PENDIENTE — el editor debe revisar y aprobar de nuevo (regla 18: cero
// auto-publicación).
//
// Auth: sesión ADMIN. Auditoría 100%.
//
// Sincrónico: la regeneración tarda 6-15s (llamada a Claude API). El admin
// espera la respuesta para ver el resultado en /admin/picks. El maxDuration
// se sube a 180s para cubrir picos.

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
import { regenerarAnalisis } from "@/lib/services/analisis-partido-generador.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado(
        "Solo administradores pueden regenerar análisis.",
      );
    }

    const partido = await prisma.partido.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        equipoLocal: true,
        equipoVisita: true,
        analisisPartido: { select: { id: true, estado: true } },
      },
    });
    if (!partido) throw new PartidoNoEncontrado(params.id);

    const resultado = await regenerarAnalisis(partido.id);

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: "analisis.regenerar",
      entidad: "AnalisisPartido",
      entidadId: resultado.analisisId ?? partido.analisisPartido?.id ?? null,
      resumen: `Regeneración manual de análisis sobre ${partido.equipoLocal} vs ${partido.equipoVisita}`,
      metadata: {
        partidoId: partido.id,
        motivo: resultado.motivo,
        latenciaMs: resultado.latenciaMs ?? null,
        tokensInput: resultado.tokensInput ?? null,
        tokensOutput: resultado.tokensOutput ?? null,
      },
    });

    if (!resultado.ok) {
      logger.warn(
        {
          partidoId: partido.id,
          motivo: resultado.motivo,
          source: "admin:partidos:regenerar",
        },
        "regenerar-analisis: generador no produjo resultado nuevo",
      );
      return Response.json(
        {
          ok: false,
          motivo: resultado.motivo,
          analisisId: resultado.analisisId ?? null,
        },
        { status: 422 },
      );
    }

    return Response.json({
      ok: true,
      analisisId: resultado.analisisId,
      latenciaMs: resultado.latenciaMs,
      tokensInput: resultado.tokensInput,
      tokensOutput: resultado.tokensOutput,
    });
  } catch (err) {
    logger.error(
      { err, partidoId: params.id, source: "api:admin-partidos-regenerar" },
      "POST /api/v1/admin/partidos/[id]/regenerar-analisis falló",
    );
    return toErrorResponse(err);
  }
}
